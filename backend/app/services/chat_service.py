import json
import logging
from typing import Iterator

import httpx
from google.genai import errors as genai_errors
from google.genai import types

from app.core.supabase_client import get_supabase
from app.services.embeddings import get_genai_client
from app.services.retrieval import retrieve_relevant_chunks

logger = logging.getLogger(__name__)

CHAT_MODEL = "gemini-3.5-flash-lite"  # gemini-3.5-flash's free tier on this project
# caps at 20 requests/day (each chat message costs 2 calls), which made testing
# impossible. gemini-2.5-flash is deprecated for new projects (404 as of Aug 2026).
# flash-lite is the tier Google positions for free/high-volume use, so it's the
# safer bet for a workable daily quota — confirmed working live against this key.

CAPTURE_LEAD_TOOL = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="capture_lead",
            description=(
                "Call this when the customer has shown clear interest (e.g. wants to book, "
                "wants a callback, or explicitly asks to be contacted) AND you have at least "
                "their name or email. Do not call this just because contact info was mentioned "
                "in passing — only when they want to be followed up with."
            ),
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "email": {"type": "string"},
                    "phone": {"type": "string"},
                    "interest": {"type": "string", "description": "What they're interested in"},
                },
                "required": [],
            },
        )
    ]
)


def _build_system_prompt(agent: dict) -> str:
    parts = [
        f"You are {agent['name']}, an AI customer support assistant.",
        # Formatting/brevity is a hard platform rule, not a style choice, so
        # it goes first and explicitly overrides personality — and it calls
        # out context-mirroring by name, since that's the actual failure
        # mode observed: the model was copying the retrieved context's own
        # bullet/bold formatting into replies rather than following an
        # abstract "no markdown" instruction, even with that instruction
        # present elsewhere in the prompt.
        "HARD FORMATTING RULE, overrides personality/tone below: this is a "
        "live chat bubble with no markdown rendering, not email or a "
        "document. Never write *, **, #, -, or numbered-list syntax, even "
        "if the context below uses that formatting — rewrite anything from "
        "the context as flowing plain-text sentences. Example: context "
        "showing \"* New patient: $120\\n* Returning: $95\" becomes \"It's "
        "$120 for new patients, $95 if you've been in before.\" Keep replies "
        "short, usually 1-3 sentences, like a text message — not a summary "
        "of everything relevant in the context, just the answer to what was "
        "asked.",
    ]
    if agent.get("personality"):
        parts.append(f"Personality/tone: {agent['personality']}")
    if agent.get("instructions"):
        parts.append(f"Business-specific instructions: {agent['instructions']}")
    parts.append(
        "Answer using ONLY the context provided below. If the answer isn't in the "
        "context, say you don't have that information and offer to have someone "
        "follow up — do not make up facts about prices, policies, or availability. "
        "Answer only what was asked — don't volunteer extra hours, policies, or "
        "details from the context that weren't asked about, unless the "
        "business-specific instructions above tell you to add something."
    )
    return "\n\n".join(parts)


def _get_or_create_conversation(agent_id: str, conversation_id: str | None, visitor_id: str | None) -> str:
    supabase = get_supabase()
    if conversation_id:
        return conversation_id
    result = (
        supabase.table("conversations")
        .insert({"agent_id": agent_id, "visitor_id": visitor_id})
        .execute()
    )
    return result.data[0]["id"]


def _load_history(conversation_id: str) -> list[dict]:
    supabase = get_supabase()
    result = (
        supabase.table("messages")
        .select("role, content")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .execute()
    )
    return [{"role": m["role"], "content": m["content"]} for m in result.data]


def _save_message(conversation_id: str, role: str, content: str) -> None:
    get_supabase().table("messages").insert(
        {"conversation_id": conversation_id, "role": role, "content": content}
    ).execute()


def _capture_lead(agent_id: str, conversation_id: str, args: dict) -> None:
    get_supabase().table("leads").insert(
        {
            "agent_id": agent_id,
            "conversation_id": conversation_id,
            "name": args.get("name"),
            "email": args.get("email"),
            "phone": args.get("phone"),
            "interest": args.get("interest"),
        }
    ).execute()


def _to_contents(history: list[dict]) -> list[types.Content]:
    # Gemini uses "model" rather than "assistant" for the assistant role.
    return [
        types.Content(
            role="model" if m["role"] == "assistant" else "user",
            parts=[types.Part(text=m["content"])],
        )
        for m in history
    ]


def stream_chat_response(
    agent: dict, message: str, conversation_id: str | None, visitor_id: str | None
) -> Iterator[str]:
    """
    Yields Server-Sent-Events-formatted strings. Two Gemini calls happen:
    1. A non-streaming call that can decide to call `capture_lead` — tool
       calls don't play well with streaming, so this pass is quick and
       silent to the user.
    2. A streaming call for the actual visible reply, which is what the
       user watches arrive token by token.

    This trade-off (an extra ~1s non-streaming call before the visible
    stream starts) is simpler and more reliable than trying to stream
    while also handling a tool call mid-stream — worth it for an MVP.
    """
    conversation_id = _get_or_create_conversation(agent["id"], conversation_id, visitor_id)
    _save_message(conversation_id, "user", message)

    # First, tell the frontend which conversation this is, so it can be
    # reused on the next message (widget stores this client-side).
    yield f"event: conversation\ndata: {json.dumps({'conversation_id': conversation_id})}\n\n"

    # Retrieval, history, and both Gemini calls all talk to an external
    # service (Supabase or Gemini) with a bounded timeout (see
    # CLIENT_TIMEOUT_SECONDS in supabase_client.py) -- wrap the lot so a
    # timeout or API error reaches the visitor as a readable message instead
    # of crashing the SSE stream with an unhandled 500 (FastAPI can't turn
    # that into a normal error response once streaming has already started,
    # since the "conversation" event above already sent the response headers).
    try:
        context_chunks = retrieve_relevant_chunks(message, agent["id"])
        context = "\n\n---\n\n".join(context_chunks) if context_chunks else "(no matching information found)"

        system_prompt = _build_system_prompt(agent) + f"\n\nContext:\n{context}"
        history = _load_history(conversation_id)
        contents = _to_contents(history)

        client = get_genai_client()

        # Pass 1: decide on tool use (non-streaming, cheap)
        decision = client.models.generate_content(
            model=CHAT_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                tools=[CAPTURE_LEAD_TOOL],
            ),
        )

        for call in decision.function_calls or []:
            if call.name == "capture_lead":
                args = call.args or {}
                _capture_lead(agent["id"], conversation_id, args)
                yield f"event: lead_captured\ndata: {json.dumps(args)}\n\n"

        # Pass 2: stream the actual reply
        full_reply = ""
        stream = client.models.generate_content_stream(
            model=CHAT_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(system_instruction=system_prompt),
        )
        for chunk in stream:
            delta = chunk.text
            if delta:
                full_reply += delta
                yield f"event: token\ndata: {json.dumps({'text': delta})}\n\n"

        _save_message(conversation_id, "assistant", full_reply)
    except genai_errors.ClientError as e:
        logger.warning("Gemini client error during chat: %s", e)
        message = (
            "This agent is getting more questions than its current plan allows right now. "
            "Please try again in a minute."
            if e.code == 429
            else "Something went wrong generating a reply. Please try again."
        )
        yield f"event: error\ndata: {json.dumps({'message': message})}\n\n"
        yield "event: done\ndata: {}\n\n"
        return
    except genai_errors.APIError as e:
        logger.exception("Gemini API error during chat: %s", e)
        yield f"event: error\ndata: {json.dumps({'message': 'Something went wrong generating a reply. Please try again.'})}\n\n"
        yield "event: done\ndata: {}\n\n"
        return
    except httpx.TimeoutException as e:
        # Covers both Supabase (retrieval, history, saving messages) and
        # Gemini (both clients are httpx-based under the hood) timing out.
        # This is the case that used to hang forever instead of reaching
        # here at all -- see CLIENT_TIMEOUT_SECONDS in supabase_client.py.
        logger.warning("Timed out waiting on an external call during chat: %s", e)
        yield f"event: error\ndata: {json.dumps({'message': 'This is taking longer than expected. Please try again.'})}\n\n"
        yield "event: done\ndata: {}\n\n"
        return

    yield "event: done\ndata: {}\n\n"
