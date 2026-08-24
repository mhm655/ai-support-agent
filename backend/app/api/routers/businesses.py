from fastapi import APIRouter, HTTPException, status

from app.core.security import CurrentUserDep
from app.core.supabase_client import get_supabase
from app.schemas.business import BusinessCreate, BusinessResponse, BusinessUpdate

router = APIRouter(prefix="/businesses", tags=["businesses"])


@router.post("/", response_model=BusinessResponse, status_code=status.HTTP_201_CREATED)
async def create_business(payload: BusinessCreate, current_user: CurrentUserDep) -> BusinessResponse:
    """
    Called once, right after signup, to turn a Supabase auth user into a
    business. Every other resource (agents, leads, etc.) hangs off this row.
    """
    supabase = get_supabase()

    existing = (
        supabase.table("businesses")
        .select("id")
        .eq("auth_user_id", current_user.user_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Business already exists for this account")

    result = (
        supabase.table("businesses")
        .insert({"auth_user_id": current_user.user_id, "name": payload.name})
        .execute()
    )
    return result.data[0]


@router.get("/me", response_model=BusinessResponse)
async def get_my_business(current_user: CurrentUserDep) -> BusinessResponse:
    supabase = get_supabase()
    result = (
        supabase.table("businesses")
        .select("*")
        .eq("auth_user_id", current_user.user_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No business found for this account")
    return result.data[0]


@router.patch("/me", response_model=BusinessResponse)
async def update_my_business(payload: BusinessUpdate, current_user: CurrentUserDep) -> BusinessResponse:
    supabase = get_supabase()
    result = (
        supabase.table("businesses")
        .update({"name": payload.name})
        .eq("auth_user_id", current_user.user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No business found for this account")
    return result.data[0]
