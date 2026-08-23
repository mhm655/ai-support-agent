from fastapi import APIRouter, HTTPException, status

from app.core.security import CurrentBusinessIdDep
from app.core.supabase_client import get_supabase
from app.schemas.analytics import AnalyticsSummary

router = APIRouter(tags=["analytics"])


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


@router.get("/agents/{agent_id}/analytics", response_model=AnalyticsSummary)
async def get_analytics(agent_id: str, business_id: CurrentBusinessIdDep) -> AnalyticsSummary:
    _assert_owns_agent(agent_id, business_id)
    supabase = get_supabase()

    conversations = (
        supabase.table("conversations").select("id", count="exact").eq("agent_id", agent_id).execute()
    )
    conversation_ids = [c["id"] for c in conversations.data]

    message_count = 0
    if conversation_ids:
        messages = (
            supabase.table("messages")
            .select("id", count="exact")
            .in_("conversation_id", conversation_ids)
            .execute()
        )
        message_count = messages.count or 0

    leads = supabase.table("leads").select("id", count="exact").eq("agent_id", agent_id).execute()
    documents = supabase.table("documents").select("id", count="exact").eq("agent_id", agent_id).execute()

    return AnalyticsSummary(
        conversation_count=conversations.count or 0,
        message_count=message_count,
        lead_count=leads.count or 0,
        document_count=documents.count or 0,
    )
