from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.core.config import settings
from app.core.supabase_client import get_supabase

bearer_scheme = HTTPBearer(auto_error=True)


class CurrentUser:
    def __init__(self, user_id: str, email: str | None):
        self.user_id = user_id
        self.email = email


@lru_cache
def _get_jwks_client() -> PyJWKClient:
    """
    This project's Supabase instance uses the newer asymmetric signing keys
    (ES256 — confirmed via Project Settings > JWT Keys > JWT Signing Keys).
    Supabase publishes a public JWKS endpoint for exactly this case, so
    verification needs no shared secret and survives key rotation
    automatically (no code change needed if Supabase rotates the key again).
    """
    jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    return PyJWKClient(jwks_url, cache_keys=True)


def _decode_supabase_jwt(token: str) -> dict:
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError:
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
