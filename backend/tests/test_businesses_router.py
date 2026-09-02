from app.api.routers import businesses as businesses_router
from conftest import TEST_USER_ID, make_supabase_mock


def test_health_check(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_get_my_business_returns_404_when_none_exists(authed_client, monkeypatch):
    monkeypatch.setattr(businesses_router, "get_supabase", lambda: make_supabase_mock([]))

    res = authed_client.get("/businesses/me")

    assert res.status_code == 404


def test_get_my_business_returns_business(authed_client, monkeypatch):
    business = {
        "id": "biz-1",
        "auth_user_id": TEST_USER_ID,
        "name": "Acme Dental",
        "created_at": "2026-01-01T00:00:00Z",
    }
    monkeypatch.setattr(businesses_router, "get_supabase", lambda: make_supabase_mock([business]))

    res = authed_client.get("/businesses/me")

    assert res.status_code == 200
    assert res.json()["name"] == "Acme Dental"


def test_create_business_conflicts_if_already_exists(authed_client, monkeypatch):
    existing = {"id": "biz-1", "auth_user_id": TEST_USER_ID, "name": "Acme Dental"}
    monkeypatch.setattr(businesses_router, "get_supabase", lambda: make_supabase_mock([existing]))

    res = authed_client.post("/businesses/", json={"name": "New Name"})

    assert res.status_code == 409


def test_update_my_business_renames(authed_client, monkeypatch):
    updated = {
        "id": "biz-1",
        "auth_user_id": TEST_USER_ID,
        "name": "Renamed Co",
        "created_at": "2026-01-01T00:00:00Z",
    }
    monkeypatch.setattr(businesses_router, "get_supabase", lambda: make_supabase_mock([updated]))

    res = authed_client.patch("/businesses/me", json={"name": "Renamed Co"})

    assert res.status_code == 200
    assert res.json()["name"] == "Renamed Co"


def test_update_my_business_404s_when_none_exists(authed_client, monkeypatch):
    monkeypatch.setattr(businesses_router, "get_supabase", lambda: make_supabase_mock([]))

    res = authed_client.patch("/businesses/me", json={"name": "Doesn't matter"})

    assert res.status_code == 404


def test_businesses_me_requires_auth(client):
    # No auth override on this client, and no Authorization header sent —
    # HTTPBearer should reject the request before it reaches the route.
    res = client.get("/businesses/me")
    assert res.status_code in (401, 403)
