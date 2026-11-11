import logging

from fastapi import APIRouter, HTTPException, status
from postgrest.exceptions import APIError

from app.core.ids import UUIDPath
from app.core.security import CurrentBusinessIdDep
from app.core.supabase_client import get_supabase
from app.schemas.agent import AgentCreate, AgentResponse, AgentUpdate
from app.services.storage import delete_document as delete_stored_document

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("/", response_model=list[AgentResponse])
async def list_agents(business_id: CurrentBusinessIdDep) -> list[AgentResponse]:
    supabase = get_supabase()
    result = (
        supabase.table("agents")
        .select("*")
        .eq("business_id", business_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.post("/", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(payload: AgentCreate, business_id: CurrentBusinessIdDep) -> AgentResponse:
    supabase = get_supabase()
    result = (
        supabase.table("agents")
        .insert(
            {
                "business_id": business_id,
                "name": payload.name,
                "personality": payload.personality,
                "instructions": payload.instructions,
            }
        )
        .execute()
    )
    return result.data[0]


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: UUIDPath, business_id: CurrentBusinessIdDep) -> AgentResponse:
    supabase = get_supabase()
    result = (
        supabase.table("agents")
        .select("*")
        .eq("id", agent_id)
        .eq("business_id", business_id)  # ownership check — not just existence
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return result.data[0]


@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_agent(agent_id: UUIDPath, payload: AgentUpdate, business_id: CurrentBusinessIdDep) -> AgentResponse:
    supabase = get_supabase()
    # exclude_unset, not "drop the Nones": personality and instructions are
    # nullable, so an explicit null is a real instruction to clear the field.
    # Filtering all Nones out made clearing one silently revert on the next
    # load, and clearing both fail with "No fields to update".
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    result = (
        supabase.table("agents")
        .update(updates)
        .eq("id", agent_id)
        .eq("business_id", business_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return result.data[0]


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(agent_id: UUIDPath, business_id: CurrentBusinessIdDep) -> None:
    supabase = get_supabase()

    # Collected before the delete, while the rows still exist. The database
    # removes the agent's documents with it (ON DELETE CASCADE), but the
    # files they point at live in Storage, which no cascade reaches -- so
    # without this every deleted agent left its uploads in the bucket.
    # Scoped by business_id through the agent, so this reads nothing when
    # the agent is not the caller's.
    owned = (
        supabase.table("agents")
        .select("id, documents(storage_path)")
        .eq("id", agent_id)
        .eq("business_id", business_id)
        .limit(1)
        .execute()
    )
    if not owned.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    paths = [d["storage_path"] for d in owned.data[0].get("documents") or []]

    try:
        supabase.table("agents").delete().eq("id", agent_id).eq("business_id", business_id).execute()
    except APIError as exc:
        # 23503 is a foreign key violation: the database still has child
        # rows without ON DELETE CASCADE. Production was found in exactly
        # that state on 2026-09-24 (every foreign key NO ACTION), which made
        # this route a bare 500 for any agent that had ever been used.
        # supabase/migrations/20260924000000_harden_schema.sql adds the
        # cascades; until it is applied, say what is wrong instead.
        if exc.code == "23503":
            logger.error("Agent %s delete blocked by a foreign key; cascades missing", agent_id)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This agent still has documents or conversations that could not be removed. Please contact support.",
            ) from None
        raise

    for path in paths:
        try:
            delete_stored_document(path)
        except Exception:
            # Same trade as deleting a single document: the rows are gone,
            # which is the delete the user asked for; a leftover file is
            # logged and recoverable.
            logger.warning("Deleted agent %s but a stored file may remain at %s", agent_id, path)
