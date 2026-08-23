from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.core.supabase_client import get_supabase
from app.schemas.chat import ChatRequest
from app.services.chat_service import stream_chat_response

router = APIRouter(prefix="/public", tags=["public-chat"])

# Deliberately unauthenticated: this is what the embeddable widget calls
# from a visitor's browser on a completely different website, so there's
# no Supabase session to attach a JWT from. The agent_id in the URL is
# effectively the "API key" for this integration — anyone with it can chat
# with that agent, which is the intended behavior (that's the product).
# It does NOT grant access to the business's dashboard data.


@router.post("/agents/{agent_id}/chat")
async def public_chat(agent_id: str, payload: ChatRequest) -> StreamingResponse:
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
