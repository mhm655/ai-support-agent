"""
Tests for the public (unauthenticated) chat route.

This route is the only one reachable without a JWT, so the ids in the
request are the *whole* authorization story: agent_id comes from a
<script> tag anyone can read, and conversation_id is replayed from the
visitor's own localStorage. Both are caller-controlled, so both are
checked here rather than trusted.
"""

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.api.routers import public_chat

AGENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
OTHER_AGENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
OWN_CONVERSATION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
FOREIGN_CONVERSATION = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"

TABLES = {
    "agents": [
        {
            "id": AGENT_ID,
            "business_id": "22222222-2222-2222-2222-222222222222",
            "name": "Front Desk",
            "personality": None,
            "instructions": None,
        }
    ],
    "conversations": [
        {"id": OWN_CONVERSATION, "agent_id": AGENT_ID},
        {"id": FOREIGN_CONVERSATION, "agent_id": OTHER_AGENT_ID},
    ],
}


class _FakeQuery:
    """
    Enough of the supabase-py builder to answer the router's selects, but
    unlike a blanket MagicMock it actually *applies* the .eq() filters --
    which is the whole point here: a mock that ignores .eq("agent_id", ...)
    would pass even with the ownership check deleted.
    """

    def __init__(self, rows):
        self._rows = rows
        self._filters = {}

    def select(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def eq(self, column, value):
        self._filters[column] = value
        return self

    def execute(self):
        rows = [
            row
            for row in self._rows
            if all(row.get(col) == val for col, val in self._filters.items())
        ]
        return SimpleNamespace(data=rows)


class _FakeSupabase:
    def table(self, name):
        return _FakeQuery(TABLES.get(name, []))


@pytest.fixture(autouse=True)
def _isolate_route():
    """
    Point the route at the fake database and stub the stream, so these
    tests exercise validation only -- no Gemini, no Supabase.

    The limiters are module-level and persist between requests, so they are
    reset here; otherwise the per-IP window (8/min, and TestClient always
    presents the same address) would start 429ing partway through the file
    and the failures would look like validation bugs.
    """
    public_chat._ip_limiter.reset()
    public_chat._agent_limiter.reset()

    def fake_stream(*_args, **_kwargs):
        yield "event: done\ndata: {}\n\n"

    with patch.object(public_chat, "get_supabase", return_value=_FakeSupabase()), patch.object(
        public_chat, "stream_chat_response", fake_stream
    ):
        yield


def _post(client, agent_id, **body):
    return client.post(
        f"/public/agents/{agent_id}/chat", json={"message": "hi", **body}
    )


# --- agent_id ---------------------------------------------------------------


def test_malformed_agent_id_is_404_not_500(client):
    """A non-uuid would reach Postgres as a driver-level error, not an empty result."""
    assert _post(client, "foo").status_code == 404


def test_unknown_agent_is_404(client):
    assert _post(client, OTHER_AGENT_ID).status_code == 404


def test_known_agent_streams(client):
    assert _post(client, AGENT_ID).status_code == 200


# --- conversation_id --------------------------------------------------------


def test_conversation_belonging_to_another_agent_is_rejected(client):
    """
    The cross-tenant case. Accepting this id let one agent's chat load
    another agent's history into its prompt and write new messages into
    that conversation, unauthenticated.
    """
    response = _post(client, AGENT_ID, conversation_id=FOREIGN_CONVERSATION)
    assert response.status_code == 404


def test_unknown_conversation_is_rejected(client):
    response = _post(
        client, AGENT_ID, conversation_id="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
    )
    assert response.status_code == 404


def test_malformed_conversation_id_is_404_not_500(client):
    response = _post(client, AGENT_ID, conversation_id="not-a-uuid")
    assert response.status_code == 404


def test_own_conversation_is_accepted(client):
    response = _post(client, AGENT_ID, conversation_id=OWN_CONVERSATION)
    assert response.status_code == 200


def test_absent_conversation_id_starts_a_new_one(client):
    assert _post(client, AGENT_ID, conversation_id=None).status_code == 200


def test_empty_conversation_id_is_treated_as_absent(client):
    """
    Matches _get_or_create_conversation's truthiness check. If the route
    used `is not None` instead, "" would 404 here while the service layer
    would have happily opened a new conversation.
    """
    assert _post(client, AGENT_ID, conversation_id="").status_code == 200


# --- the rejections must be indistinguishable from each other ---------------


def test_rejections_do_not_reveal_which_ids_exist(client):
    """
    A malformed id, a nonexistent one, and someone else's all answer the
    same, so the endpoint cannot be used to enumerate real ids.
    """
    bodies = {
        _post(client, AGENT_ID, conversation_id=key).json()["detail"]
        for key in ("not-a-uuid", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", FOREIGN_CONVERSATION)
    }
    assert bodies == {"Conversation not found"}
