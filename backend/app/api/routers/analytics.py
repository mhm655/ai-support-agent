from fastapi import APIRouter, HTTPException, status

from app.core.ids import UUIDPath
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
async def get_analytics(agent_id: UUIDPath, business_id: CurrentBusinessIdDep) -> AnalyticsSummary:
    _assert_owns_agent(agent_id, business_id)
    supabase = get_supabase()

    # Every count is computed by Postgres (count="exact") with limit(1), so
    # one row crosses the wire per query rather than the whole table.
    #
    # Messages used to be counted by fetching every conversation id and
    # sending them back in an `in` filter. That had two failure modes that
    # grow with a successful agent: PostgREST caps a response at 1000 rows,
    # so past 1000 conversations the id list -- and the message count --
    # was silently short; and the ids travel in the URL, which eventually
    # exceeds the server's length limit and fails outright. Filtering
    # through the join instead needs neither. Verified against production
    # on 2026-09-24 to return the same count as the old method.
    def count(table: str, select: str, column: str) -> int:
        result = (
            supabase.table(table)
            .select(select, count="exact")
            .eq(column, agent_id)
            .limit(1)
            .execute()
        )
        return result.count or 0

    return AnalyticsSummary(
        conversation_count=count("conversations", "id", "agent_id"),
        message_count=count("messages", "id, conversations!inner(agent_id)", "conversations.agent_id"),
        lead_count=count("leads", "id", "agent_id"),
        document_count=count("documents", "id", "agent_id"),
    )
