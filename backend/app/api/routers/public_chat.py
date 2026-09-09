import uuid

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.rate_limit import SlidingWindowLimiter, client_ip
from app.core.supabase_client import get_supabase
from app.schemas.chat import ChatRequest
from app.services.chat_service import stream_chat_response

router = APIRouter(prefix="/public", tags=["public-chat"])

# Module-level so the windows persist across requests. See
# core/rate_limit.py for the per-process caveat.
_ip_limiter = SlidingWindowLimiter(settings.public_chat_per_ip_per_minute, 60.0)
_agent_limiter = SlidingWindowLimiter(settings.public_chat_per_agent_per_minute, 60.0)


def _enforce_limit(limiter: SlidingWindowLimiter, key: str, scope: str) -> None:
    """
    Raises 429 if `key` is over `limiter`'s allowance for the window.

    Both limiters run before the agent lookup and before anything is
    streamed, so a blocked request costs one dictionary operation rather
    than a Supabase round trip and two Gemini calls. That ordering is the
    entire point: a limiter that runs after the expensive work protects
    nothing.
    """
    if limiter.limit <= 0:  # 0 disables the limit
        return
    retry_after = limiter.check(key)
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many messages {scope}. Please wait a moment and try again.",
            headers={"Retry-After": str(max(1, int(retry_after) + 1))},
        )


def _enforce_ip_limit(request: Request) -> None:
    _enforce_limit(_ip_limiter, client_ip(request), "from your network")


def _enforce_agent_limit(agent_id: str) -> None:
    _enforce_limit(_agent_limiter, agent_id, "for this agent")


def _not_found(detail: str) -> HTTPException:
    """
    404 for anything unresolvable on this route.

    Deliberately uniform: a malformed id, a well-formed id that does not
    exist, and an id that exists but belongs to someone else all answer
    identically, so probing this endpoint reveals nothing about which ids
    are real.
    """
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _require_uuid(value: str, detail: str) -> None:
    """
    Rejects a value Postgres would refuse as a malformed uuid.

    agent_id and conversation_id are both interpolated into queries against
    uuid columns, and Postgres answers a malformed value with a driver-level
    error rather than an empty result -- so without this, a visitor
    requesting /public/agents/foo/chat got a 500 off an unauthenticated
    route. 404 rather than 422 for the reason in _not_found.
    """
    try:
        uuid.UUID(value)
    except ValueError:
        raise _not_found(detail) from None


# Deliberately unauthenticated: this is what the embeddable widget calls
# from a visitor's browser on a completely different website, so there's
# no Supabase session to attach a JWT from. The agent_id in the URL is
# effectively the "API key" for this integration — anyone with it can chat
# with that agent, which is the intended behavior (that's the product).
# It does NOT grant access to the business's dashboard data.


@router.post("/agents/{agent_id}/chat")
async def public_chat(
    agent_id: str, payload: ChatRequest, request: Request
) -> StreamingResponse:
    # Per-IP first. It is keyed on the address rather than on anything in
    # the URL, so it applies to junk traffic too and needs nothing about
    # the request to be valid first.
    _enforce_ip_limit(request)

    _require_uuid(agent_id, "Agent not found")

    # Per-agent only once agent_id is known to be a well-formed uuid.
    # Keying a window on unvalidated input meant a scan of invented ids
    # filled the limiter's key table with strings that could never name a
    # real agent, competing for space with the keys that matter. Still
    # ahead of every Supabase and Gemini call, which is what the limit is
    # actually for.
    _enforce_agent_limit(agent_id)

    supabase = get_supabase()
    result = supabase.table("agents").select("*").eq("id", agent_id).limit(1).execute()
    if not result.data:
        raise _not_found("Agent not found")
    agent = result.data[0]

    # conversation_id arrives from the caller -- the widget replays whatever
    # it kept in localStorage -- so it has to be verified, not trusted.
    # Without the agent_id filter below, posting one agent's id in the URL
    # alongside another agent's conversation_id loaded that conversation's
    # history into this prompt and appended new messages to it: a
    # cross-tenant read *and* write through an unauthenticated route.
    #
    # Tested for truthiness rather than `is not None` to match
    # _get_or_create_conversation's own check -- otherwise an empty string
    # would 404 here while the service layer treats it as "none yet".
    if payload.conversation_id:
        _require_uuid(payload.conversation_id, "Conversation not found")
        owned = (
            supabase.table("conversations")
            .select("id")
            .eq("id", payload.conversation_id)
            .eq("agent_id", agent_id)  # ownership check -- not just existence
            .limit(1)
            .execute()
        )
        if not owned.data:
            raise _not_found("Conversation not found")

    return StreamingResponse(
        stream_chat_response(agent, payload.message, payload.conversation_id, payload.visitor_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # prevents proxies from buffering the stream
        },
    )
