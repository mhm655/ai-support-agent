"""
Tests for the replayed-history window.

Unbounded, this was the project's real cost bug: the widget keeps one
conversation id in localStorage indefinitely, so a returning visitor
resent their whole history on every message, to two Gemini calls each
time, until the context window ran out.
"""

from unittest.mock import MagicMock, patch

from app.core.config import settings
from app.services import chat_service

CONVERSATION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"


def _supabase_returning(rows):
    """
    Records the query the caller built, and hands back `rows` as though the
    database had already applied the order and limit.
    """
    mock = MagicMock()
    calls = {}

    for name in ("table", "select", "eq"):
        getattr(mock, name).return_value = mock

    def order(column, desc=False):
        calls["order"] = (column, desc)
        return mock

    def limit(n):
        calls["limit"] = n
        return mock

    mock.order = order
    mock.limit = limit
    mock.execute = lambda: MagicMock(data=rows)
    return mock, calls


def _message(i):
    return {"role": "user" if i % 2 == 0 else "assistant", "content": f"m{i}"}


def test_history_is_bounded_by_the_database_not_in_python():
    """
    Slicing after the fact would still transfer every message in the
    conversation, which is the cost this is here to avoid.
    """
    supabase, calls = _supabase_returning([])

    with patch.object(chat_service, "get_supabase", return_value=supabase):
        chat_service._load_history(CONVERSATION)

    assert calls["limit"] == settings.chat_history_messages
    # Newest-first, so the limit keeps the most recent messages.
    assert calls["order"] == ("created_at", True)


def test_history_is_returned_oldest_first():
    """
    The rows arrive newest-first because of the limit, but a model expects
    the turns in the order they happened.
    """
    newest_first = [_message(i) for i in (4, 3, 2, 1, 0)]
    supabase, _ = _supabase_returning(newest_first)

    with patch.object(chat_service, "get_supabase", return_value=supabase):
        history = chat_service._load_history(CONVERSATION)

    assert [m["content"] for m in history] == ["m0", "m1", "m2", "m3", "m4"]


def test_limit_never_drops_below_one(monkeypatch):
    """
    The window includes the message just saved, so a limit of 0 would send
    the model no user turn at all -- a failed request rather than a
    forgetful one.
    """
    monkeypatch.setattr(settings, "chat_history_messages", 0)
    supabase, calls = _supabase_returning([])

    with patch.object(chat_service, "get_supabase", return_value=supabase):
        chat_service._load_history(CONVERSATION)

    assert calls["limit"] == 1


def test_default_window_is_a_sane_size():
    assert 1 <= settings.chat_history_messages <= 200
