from app.api.routers import agents as agents_router
from conftest import TEST_BUSINESS_ID, make_supabase_mock

AGENT = {
    "id": "agent-1",
    "business_id": TEST_BUSINESS_ID,
    "name": "Front Desk Bot",
    "personality": "friendly",
    "instructions": "Answer from the uploaded docs only.",
    "created_at": "2026-01-01T00:00:00Z",
}


def test_list_agents_returns_only_this_businesss_agents(authed_client, monkeypatch):
    mock = make_supabase_mock([AGENT])
    monkeypatch.setattr(agents_router, "get_supabase", lambda: mock)

    res = authed_client.get("/agents/")

    assert res.status_code == 200
    assert res.json() == [AGENT]
    mock.eq.assert_any_call("business_id", TEST_BUSINESS_ID)


def test_create_agent_returns_201(authed_client, monkeypatch):
    monkeypatch.setattr(agents_router, "get_supabase", lambda: make_supabase_mock([AGENT]))

    res = authed_client.post("/agents/", json={"name": "Front Desk Bot"})

    assert res.status_code == 201
    assert res.json()["name"] == "Front Desk Bot"


def test_create_agent_rejects_blank_name(authed_client, monkeypatch):
    monkeypatch.setattr(agents_router, "get_supabase", lambda: make_supabase_mock([AGENT]))

    res = authed_client.post("/agents/", json={"name": ""})

    assert res.status_code == 422


def test_get_agent_404s_when_not_owned_by_this_business(authed_client, monkeypatch):
    # Simulates another business's agent ID: the .eq("business_id", ...)
    # filter means the query legitimately returns no rows.
    monkeypatch.setattr(agents_router, "get_supabase", lambda: make_supabase_mock([]))

    res = authed_client.get("/agents/some-other-business-agent")

    assert res.status_code == 404


def test_update_agent_with_no_fields_is_rejected(authed_client, monkeypatch):
    monkeypatch.setattr(agents_router, "get_supabase", lambda: make_supabase_mock([AGENT]))

    res = authed_client.patch("/agents/agent-1", json={})

    assert res.status_code == 400


def test_update_agent_applies_partial_update(authed_client, monkeypatch):
    updated = {**AGENT, "name": "Renamed Bot"}
    monkeypatch.setattr(agents_router, "get_supabase", lambda: make_supabase_mock([updated]))

    res = authed_client.patch("/agents/agent-1", json={"name": "Renamed Bot"})

    assert res.status_code == 200
    assert res.json()["name"] == "Renamed Bot"


def test_update_agent_clears_a_nullable_field_when_sent_as_null(authed_client, monkeypatch):
    # personality and instructions are nullable, so an explicit null is a
    # request to clear the field, not an absent value to ignore. The dashboard
    # sends both fields on every save, so dropping Nones meant "clear the
    # personality" silently kept the old text.
    cleared = {**AGENT, "personality": None}
    mock = make_supabase_mock([cleared])
    monkeypatch.setattr(agents_router, "get_supabase", lambda: mock)

    res = authed_client.patch(
        "/agents/agent-1",
        json={"personality": None, "instructions": "Answer from the uploaded docs only."},
    )

    assert res.status_code == 200
    assert res.json()["personality"] is None
    sent = mock.update.call_args[0][0]
    assert sent["personality"] is None


def test_update_agent_ignores_fields_that_were_not_sent(authed_client, monkeypatch):
    # An omitted field must stay untouched, which is what separates
    # exclude_unset from simply passing every field through.
    mock = make_supabase_mock([AGENT])
    monkeypatch.setattr(agents_router, "get_supabase", lambda: mock)

    res = authed_client.patch("/agents/agent-1", json={"name": "Renamed Bot"})

    assert res.status_code == 200
    assert mock.update.call_args[0][0] == {"name": "Renamed Bot"}


def test_delete_agent_404s_when_not_found(authed_client, monkeypatch):
    monkeypatch.setattr(agents_router, "get_supabase", lambda: make_supabase_mock([]))

    res = authed_client.delete("/agents/agent-1")

    assert res.status_code == 404


def test_delete_agent_succeeds(authed_client, monkeypatch):
    monkeypatch.setattr(agents_router, "get_supabase", lambda: make_supabase_mock([AGENT]))

    res = authed_client.delete("/agents/agent-1")

    assert res.status_code == 204
