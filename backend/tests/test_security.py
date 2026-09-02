from unittest.mock import MagicMock

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException

from app.core import security


@pytest.fixture
def ec_keypair():
    """A throwaway EC keypair, standing in for Supabase's real ES256 signing key."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    return private_key, private_key.public_key()


def _patch_jwks(monkeypatch, public_key):
    fake_signing_key = MagicMock(key=public_key)
    fake_jwks_client = MagicMock()
    fake_jwks_client.get_signing_key_from_jwt.return_value = fake_signing_key
    monkeypatch.setattr(security, "_get_jwks_client", lambda: fake_jwks_client)


def test_valid_token_decodes_to_current_user(monkeypatch, ec_keypair):
    private_key, public_key = ec_keypair
    _patch_jwks(monkeypatch, public_key)

    token = jwt.encode(
        {"sub": "user-123", "email": "a@example.com", "aud": "authenticated"},
        private_key,
        algorithm="ES256",
    )

    payload = security._decode_supabase_jwt(token)
    assert payload["sub"] == "user-123"
    assert payload["email"] == "a@example.com"


def test_expired_or_malformed_token_raises_401(monkeypatch, ec_keypair):
    _, public_key = ec_keypair
    _patch_jwks(monkeypatch, public_key)

    with pytest.raises(HTTPException) as exc_info:
        security._decode_supabase_jwt("not-a-real-jwt")
    assert exc_info.value.status_code == 401


def test_token_signed_with_wrong_key_is_rejected(monkeypatch, ec_keypair):
    _, public_key = ec_keypair
    _patch_jwks(monkeypatch, public_key)

    other_private_key = ec.generate_private_key(ec.SECP256R1())
    forged_token = jwt.encode(
        {"sub": "attacker", "aud": "authenticated"}, other_private_key, algorithm="ES256"
    )

    with pytest.raises(HTTPException) as exc_info:
        security._decode_supabase_jwt(forged_token)
    assert exc_info.value.status_code == 401


def test_wrong_audience_is_rejected(monkeypatch, ec_keypair):
    private_key, public_key = ec_keypair
    _patch_jwks(monkeypatch, public_key)

    token = jwt.encode(
        {"sub": "user-123", "aud": "some-other-audience"}, private_key, algorithm="ES256"
    )

    with pytest.raises(HTTPException) as exc_info:
        security._decode_supabase_jwt(token)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_rejects_token_missing_subject(monkeypatch, ec_keypair):
    private_key, public_key = ec_keypair
    _patch_jwks(monkeypatch, public_key)

    token = jwt.encode({"aud": "authenticated"}, private_key, algorithm="ES256")
    credentials = MagicMock(credentials=token)

    with pytest.raises(HTTPException) as exc_info:
        await security.get_current_user(credentials)
    assert exc_info.value.status_code == 401
    assert "subject" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_business_id_404s_when_no_business_row(monkeypatch):
    current_user = security.CurrentUser(user_id="user-123", email=None)
    empty_result = MagicMock(data=[])
    fake_supabase = MagicMock()
    fake_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
        empty_result
    )
    monkeypatch.setattr(security, "get_supabase", lambda: fake_supabase)

    with pytest.raises(HTTPException) as exc_info:
        await security.get_current_business_id(current_user)
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_get_current_business_id_returns_id_when_found(monkeypatch):
    current_user = security.CurrentUser(user_id="user-123", email=None)
    found_result = MagicMock(data=[{"id": "biz-456"}])
    fake_supabase = MagicMock()
    fake_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
        found_result
    )
    monkeypatch.setattr(security, "get_supabase", lambda: fake_supabase)

    business_id = await security.get_current_business_id(current_user)
    assert business_id == "biz-456"
