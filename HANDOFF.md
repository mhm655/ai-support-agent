# HANDOFF.md

The running conversation between the agents working on this repo. Newest entry first.
Rules are in `AGENTS.md`. Mohammad (the owner) reads this too.

## Entry template

```
## YYYY-MM-DD: <Agent> : <short title>
Branch/PR:
What I did:
Why:
Decisions (and alternatives I rejected):
How to verify:
Open questions for <next agent>:
```

---

## 2026-10-29: Claude : Plan for the Decider 2B lead-capture guardrail

Branch/PR: none yet. Codex, please create `feat/decider-lead-guardrail`.

What I did: Read the backend, wrote `AGENTS.md` and this file, and planned the first task below.
No code changed.

Why: `chat_service.stream_chat_response` saves whatever arguments Gemini passes to `capture_lead`
(lines ~310-318), with no check that the customer actually said them. If the model guesses or
hallucinates an email, a fake lead lands in the business's dashboard and triggers a notification
email. That is exactly the failure Strands Decider 2B is built for: a small open model that
answers typed yes/no or choice questions with a confidence score, instead of generating text.

### Task for Codex

Add an optional guardrail that runs between "Gemini proposed `capture_lead`" and `_capture_lead(...)`.

1. **New module `backend/app/services/lead_guardrail.py`** with one function, for example
   `check_lead(history: list[dict], args: dict) -> GuardrailResult`. Ask Decider two yes/no
   questions, with the recent conversation as the state:
   - Grounding: "Did the customer themselves write this contact detail in their messages?"
     Check each non-empty field among name, email, phone that Gemini supplied.
   - Intent: "Did the customer ask to be contacted, book, or get a callback?"

   Allow the capture only if every check is at or above a threshold (default 0.7). Return the
   decision plus the raw scores, so they can be logged and shown in the demo.

2. **How to call Decider:** run it as its own HTTP server with `strands-decider serve <model>`
   (see the README at github.com/strands-labs/strands-decider), and call it from the backend with
   `httpx`, which is already a dependency. **Read the README and `examples/` for the real request
   and response JSON before writing the client.** Don't guess the schema. Use whichever
   checkpoint the README currently recommends. The model is about 2B parameters, so it stays out of
   the FastAPI process: the Railway deploy must not gain torch or model weights.

3. **Config** (in `config.py`, off by default): `decider_url: str | None = None`,
   `decider_threshold: float = 0.7`, `decider_timeout_seconds: float = 2.0`. With `decider_url`
   unset, behaviour is exactly as it is today.

4. **Wiring in `chat_service.py`:** only call the guard when `decider_url` is set. If the guard
   blocks a lead, don't save it, notify, or emit `lead_captured`. Log the scores at INFO so
   the decision is visible. The reply pass then runs as normal.

5. **Fail-open decision (mine, open to challenge):** if Decider is unreachable or times out, save
   the lead anyway and log a warning. Reasoning: for a small business, losing a real lead costs
   more than storing one doubtful one, and the guardrail is an extra layer, not the only check.

6. **Tests** in `backend/tests/test_lead_guardrail.py`, all with Decider mocked:
   grounded and intended → saved; hallucinated email → blocked; no intent → blocked;
   Decider down → saved plus warning; `decider_url` unset → Decider never called.
   Existing tests must still pass.

7. **Reusable pattern:** add `docs/decider-lead-guardrail.md` covering the exact questions, the
   threshold, how to wire it into another agent's tool call, and how to run the Decider server
   locally. This is what goes in the write-up later.

Out of scope for now: frontend changes, deploying Decider anywhere, and switching to Bedrock.

How to verify: `cd backend && python -m pytest -v` passes. Then do a manual run with
`strands-decider serve` locally, `DECIDER_URL` set, and two test chats, one with a real email and
one where Gemini has to invent it. Paste the logged scores into your HANDOFF entry.

Open questions for Codex:
- Does the server accept several questions in one request? If so, batch all checks into one call
  and say what that did to latency.
- Is 0.7 sensible given the actual scores you see? Change it if not, and say why.
- If you think fail-open is wrong, argue it in your entry before changing it.
