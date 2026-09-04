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


def _enforce_rate_limits(agent_id: str, request: Request) -> None:
    """
    Raises 429 if this caller or this agent is over its per-minute limit.

    Checked before the agent lookup and before anything is streamed, so a
    blocked request costs one dictionary operation rather than a Supabase
    round trip and two Gemini calls. That ordering is the entire point:
    a limiter that runs after the expensive work protects nothing.
    """
    checks = (
        (_ip_limiter, client_ip(request), "from your network"),
        (_agent_limiter, agent_id, "for this agent"),
    )

    for limiter, key, scope in checks:
        if limiter.limit <= 0:  # 0 disables the limit
            continue
        retry_after = limiter.check(key)
        if retry_after is not None:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many messages {scope}. Please wait a moment and try again.",
                headers={"Retry-After": str(max(1, int(retry_after) + 1))},
            )

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
    _enforce_rate_limits(agent_id, request)

    supabase = get_supabase()
    result = supabase.table("agents").select("*").eq("id", agent_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    agent = result.data[0]

    return StreamingResponse(
        stream_chat_response(agent, payload.message, payload.conversation_id, payload.visitor_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # prevents proxies from buffering the stream
        },
    )
