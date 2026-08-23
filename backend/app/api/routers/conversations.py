from fastapi import APIRouter, HTTPException, status

from app.core.security import CurrentBusinessIdDep
from app.core.supabase_client import get_supabase
from app.schemas.conversation import ConversationResponse, MessageResponse

router = APIRouter(tags=["conversations"])


def _assert_owns_agent(agent_id: str, business_id: str) -> None:
    supabase = get_supabase()
    result = (
        supabase.table("agents")
        .select("id")
        .eq("id", agent_id)
        .eq("business_id", business_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")


@router.get("/agents/{agent_id}/conversations", response_model=list[ConversationResponse])
async def list_conversations(agent_id: str, business_id: CurrentBusinessIdDep) -> list[ConversationResponse]:
    _assert_owns_agent(agent_id, business_id)
    supabase = get_supabase()
    result = (
        supabase.table("conversations")
        .select("*")
        .eq("agent_id", agent_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageResponse])
async def get_conversation_messages(conversation_id: str, business_id: CurrentBusinessIdDep) -> list[MessageResponse]:
    supabase = get_supabase()
    convo = (
        supabase.table("conversations")
        .select("agent_id")
        .eq("id", conversation_id)
        .limit(1)
        .execute()
    )
    if not convo.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    _assert_owns_agent(convo.data[0]["agent_id"], business_id)

    result = (
        supabase.table("messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .execute()
    )
    return result.data
