from fastapi import APIRouter, HTTPException, status

from app.core.security import CurrentBusinessIdDep
from app.core.supabase_client import get_supabase
from app.schemas.lead import LeadResponse

router = APIRouter(tags=["leads"])


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


@router.get("/agents/{agent_id}/leads", response_model=list[LeadResponse])
async def list_leads(agent_id: str, business_id: CurrentBusinessIdDep) -> list[LeadResponse]:
    _assert_owns_agent(agent_id, business_id)
    supabase = get_supabase()
    result = (
        supabase.table("leads")
        .select("*")
        .eq("agent_id", agent_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data
