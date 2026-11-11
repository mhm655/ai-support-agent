"""
Regression tests for the 2026-09-24 hardening pass on the dashboard API.

Each test pins a specific failure found by testing, not a hypothetical:
malformed ids 500ing, agent delete 500ing on production's foreign keys,
a double-submitted signup creating two businesses, uploads of any type
being stored, and analytics truncating at PostgREST's row cap.
"""

from unittest.mock import MagicMock

import pytest
from postgrest.exceptions import APIError

from app.api.routers import agents as agents_router
from app.api.routers import analytics as analytics_router
from app.api.routers import businesses as businesses_router
from app.api.routers import documents as documents_router
from app.services.storage import _safe_name
from conftest import make_supabase_mock

AGENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


# --- malformed ids ------------------------------------------------------------


@pytest.mark.parametrize(
    "method, path",
    [
        ("get", "/agents/not-a-uuid"),
        ("patch", "/agents/not-a-uuid"),
        ("delete", "/agents/not-a-uuid"),
        ("get", "/agents/not-a-uuid/analytics"),
        ("get", "/agents/not-a-uuid/conversations"),
        ("get", "/agents/not-a-uuid/leads"),
        ("get", "/agents/not-a-uuid/documents"),
        ("delete", "/documents/not-a-uuid"),
        ("get", "/conversations/not-a-uuid/messages"),
        ("get", "/agents/1' OR '1'='1/leads"),
    ],
)
def test_malformed_ids_are_refused_before_the_database(authed_client, monkeypatch, method, path):
    """Postgres answers a malformed uuid with an error, which was a 500."""
    touched = MagicMock()
    for module in (agents_router, analytics_router, documents_router):
        monkeypatch.setattr(module, "get_supabase", touched)

    kwargs = {"json": {"name": "x"}} if method == "patch" else {}
    response = getattr(authed_client, method)(path, **kwargs)

    assert response.status_code in (404, 422), response.text
    touched.assert_not_called()


# --- agent delete --------------------------------------------------------------


def _delete_mock(documents, delete_error=None):
    mock = make_supabase_mock([{"id": AGENT_ID, "documents": documents}])
    if delete_error is not None:
        original = mock.execute.return_value

        calls = {"n": 0}

        def execute():
            calls["n"] += 1
            if calls["n"] == 2:  # the first execute is the ownership read
                raise delete_error
            return original

        mock.execute = execute
    return mock


def test_deleting_an_agent_removes_its_stored_files(authed_client, monkeypatch):
    monkeypatch.setattr(
        agents_router,
        "get_supabase",
        lambda: _delete_mock([{"storage_path": "a/1-x.pdf"}, {"storage_path": "a/2-y.txt"}]),
    )
    removed = []
    monkeypatch.setattr(agents_router, "delete_stored_document", removed.append)

    assert authed_client.delete(f"/agents/{AGENT_ID}").status_code == 204
    assert removed == ["a/1-x.pdf", "a/2-y.txt"]


def test_a_failed_file_removal_does_not_fail_the_delete(authed_client, monkeypatch):
    monkeypatch.setattr(agents_router, "get_supabase", lambda: _delete_mock([{"storage_path": "a/1.pdf"}]))

    def boom(path):
        raise RuntimeError("storage down")

    monkeypatch.setattr(agents_router, "delete_stored_document", boom)
    assert authed_client.delete(f"/agents/{AGENT_ID}").status_code == 204


def test_foreign_key_block_is_a_readable_409_not_a_500(authed_client, monkeypatch):
    fk = APIError({"code": "23503", "message": "violates foreign key constraint"})
    monkeypatch.setattr(agents_router, "get_supabase", lambda: _delete_mock([], delete_error=fk))
    removed = []
    monkeypatch.setattr(agents_router, "delete_stored_document", removed.append)

    response = authed_client.delete(f"/agents/{AGENT_ID}")

    assert response.status_code == 409
    assert removed == []  # nothing deleted from storage when the rows stayed


# --- businesses race -------------------------------------------------------------


def test_concurrent_signup_loser_gets_409_not_500(authed_client, monkeypatch):
    mock = make_supabase_mock([])  # the existence check finds nothing...
    mock.insert.side_effect = APIError({"code": "23505", "message": "duplicate key"})  # ...but the insert races
    monkeypatch.setattr(businesses_router, "get_supabase", lambda: mock)

    response = authed_client.post("/businesses/", json={"name": "Northside Dental"})
    assert response.status_code == 409


# --- uploads ---------------------------------------------------------------------


@pytest.mark.parametrize("filename", ["payload.exe", "page.html", "notes.pdf.exe", "noextension", ""])
def test_unsupported_uploads_are_refused_before_storage(authed_client, monkeypatch, filename):
    monkeypatch.setattr(documents_router, "get_supabase", lambda: make_supabase_mock([{"id": AGENT_ID}]))
    stored = []
    monkeypatch.setattr(documents_router, "upload_document", lambda *a: stored.append(a))

    response = authed_client.post(
        f"/agents/{AGENT_ID}/documents", files={"file": (filename, b"hello", "application/octet-stream")}
    )

    assert response.status_code in (400, 422)
    assert stored == []


def test_overlong_filename_is_refused(authed_client, monkeypatch):
    monkeypatch.setattr(documents_router, "get_supabase", lambda: make_supabase_mock([{"id": AGENT_ID}]))
    response = authed_client.post(
        f"/agents/{AGENT_ID}/documents", files={"file": ("a" * 300 + ".txt", b"hello", "text/plain")}
    )
    assert response.status_code == 400


@pytest.mark.parametrize(
    "hostile",
    ["../../bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/evil.pdf", "..\\..\\x.pdf", "a/b/c.txt", "/etc/passwd.txt"],
)
def test_stored_name_can_never_contain_a_path_separator(hostile):
    safe = _safe_name(hostile)
    assert "/" not in safe and "\\" not in safe
    assert safe not in ("", ".", "..")


def test_stored_name_keeps_ordinary_names_readable():
    assert _safe_name("Price List 2026.pdf") == "Price_List_2026.pdf"


# --- analytics ---------------------------------------------------------------------


def test_analytics_counts_through_the_database_not_by_listing_ids(authed_client, monkeypatch):
    mock = make_supabase_mock([{"id": AGENT_ID}])
    mock.execute.return_value = MagicMock(data=[{"id": AGENT_ID}], count=1500)
    monkeypatch.setattr(analytics_router, "get_supabase", lambda: mock)

    body = authed_client.get(f"/agents/{AGENT_ID}/analytics").json()

    assert body["message_count"] == 1500  # not capped at PostgREST's 1000 rows
    mock.in_.assert_not_called()  # no id list in the URL
