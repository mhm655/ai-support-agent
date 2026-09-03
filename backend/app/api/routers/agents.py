from fastapi import APIRouter, HTTPException, status

from app.core.security import CurrentBusinessIdDep
from app.core.supabase_client import get_supabase
from app.schemas.agent import AgentCreate, AgentResponse, AgentUpdate

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
async def get_agent(agent_id: str, business_id: CurrentBusinessIdDep) -> AgentResponse:
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
async def update_agent(agent_id: str, payload: AgentUpdate, business_id: CurrentBusinessIdDep) -> AgentResponse:
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
async def delete_agent(agent_id: str, business_id: CurrentBusinessIdDep) -> None:
    supabase = get_supabase()
    result = (
        supabase.table("agents")
        .delete()
        .eq("id", agent_id)
        .eq("business_id", business_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
