from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.core.supabase_client import get_supabase

bearer_scheme = HTTPBearer(auto_error=True)


class CurrentUser:
    def __init__(self, user_id: str, email: str | None):
        self.user_id = user_id
        self.email = email


def _decode_supabase_jwt(token: str) -> dict:
    try:
        # Supabase issues HS256 tokens signed with the project's JWT secret,
        # audience "authenticated". If your project has migrated to the newer
        # asymmetric signing keys (JWT Keys page shows ES256 keys instead of
        # a legacy secret), this verification approach needs to switch to
        # fetching the JWKS instead — ask if that's the case.
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> CurrentUser:
    payload = _decode_supabase_jwt(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )
    return CurrentUser(user_id=user_id, email=payload.get("email"))


async def get_current_business_id(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> str:
    """
    Resolves the authenticated user to their business row.
    Every route that touches business-owned data should depend on this,
    not just get_current_user — this is what actually scopes the request.
    """
    supabase = get_supabase()
    result = (
        supabase.table("businesses")
        .select("id")
        .eq("auth_user_id", current_user.user_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No business found for this account. Complete onboarding first.",
        )
    return result.data[0]["id"]


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
CurrentBusinessIdDep = Annotated[str, Depends(get_current_business_id)]
