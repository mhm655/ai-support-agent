"""
Tests that the SSE stream always terminates cleanly.

stream_chat_response yields into a StreamingResponse, so the response
headers are gone the moment the first event is sent. After that FastAPI
cannot convert an exception into an error response -- an unhandled one
just drops the socket, which the widget can only show as a spinner that
never resolves, with nothing in the response to say why. So every path
out of this generator has to end in an `error` (or a reply) followed by
`done`, including the paths where Supabase, not Gemini, is what broke.
"""

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.services import chat_service

AGENT = {"id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "name": "Front Desk"}
NEW_CONVERSATION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"


class _PostgrestLikeError(Exception):
    """
    Stands in for postgrest's APIError, which is what a Supabase query
    actually raises. Deliberately not one of the types the specific
    handlers name, since the point is the paths nobody enumerated.
    """


def _events(chunks):
    """Parses the raw SSE strings back into (event_name, ...) order."""
    names = []
    for chunk in chunks:
        for line in chunk.split("\n"):
            if line.startswith("event: "):
                names.append(line[len("event: ") :].strip())
    return names


def _run(supabase, **patches):
    defaults = {
        "retrieve_relevant_chunks": lambda *a, **k: ["some context"],
        "get_genai_client": lambda: MagicMock(),
        "_generate_with_fallback": lambda *a, **k: MagicMock(function_calls=[]),
        "_stream_with_fallback": lambda *a, **k: iter(["hi"]),
    }
    defaults.update(patches)
    with patch.object(chat_service, "get_supabase", return_value=supabase):
        stack = [patch.object(chat_service, name, value) for name, value in defaults.items()]
        for s in stack:
            s.start()
        try:
            return list(
                chat_service.stream_chat_response(AGENT, "hi there", None, "visitor-1")
            )
        finally:
            for s in stack:
                s.stop()


def _supabase(insert_result=NEW_CONVERSATION, fail_on=None):
    """
    A builder mock whose .execute() can be made to raise. `fail_on` is the
    table name that should blow up.
    """
    mock = MagicMock()
    for name in ("table", "select", "insert", "update", "delete", "eq", "limit", "order"):
        getattr(mock, name).return_value = mock

    state = {"table": None}
    real_table = mock.table

    def table(name):
        state["table"] = name
        return real_table(name)

    mock.table = table

    def execute():
        if fail_on is not None and state["table"] == fail_on:
            raise _PostgrestLikeError(f"permission denied for table {fail_on}")
        return MagicMock(data=[{"id": insert_result, "role": "user", "content": "hi"}])

    mock.execute = execute
    return mock


def test_happy_path_ends_with_done_and_leads_with_conversation():
    names = _events(_run(_supabase()))
    assert names[0] == "conversation", names
    assert names[-1] == "done", names
    assert "error" not in names


def test_conversation_insert_failure_still_reports_and_closes():
    """
    This is the regression. Opening the conversation used to happen before
    the try block, so a Supabase failure here escaped the generator
    entirely and killed the stream with no event at all.
    """
    names = _events(_run(_supabase(fail_on="conversations")))
    assert names == ["error", "done"], names


def test_saving_the_visitor_message_failure_still_reports_and_closes():
    names = _events(_run(_supabase(fail_on="messages")))
    # The conversation id is emitted before the save is attempted, so the
    # widget keeps it and does not orphan the row on retry.
    assert names == ["conversation", "error", "done"], names


def test_unexpected_error_is_reported_not_leaked():
    def boom(*_a, **_k):
        raise _PostgrestLikeError("something nobody predicted")

    names = _events(_run(_supabase(), retrieve_relevant_chunks=boom))
    assert names == ["conversation", "error", "done"], names


def test_timeout_keeps_its_specific_message():
    """The catch-all must not swallow the more useful specific handlers."""

    def slow(*_a, **_k):
        raise httpx.ReadTimeout("too slow")

    chunks = _run(_supabase(), retrieve_relevant_chunks=slow)
    assert _events(chunks) == ["conversation", "error", "done"]
    assert "taking longer than expected" in "".join(chunks)


@pytest.mark.parametrize("fail_on", ["conversations", "messages"])
def test_stream_never_raises_out_of_the_generator(fail_on):
    """
    The property that actually matters: whatever breaks, iterating the
    generator to exhaustion must not raise, because there is no longer an
    HTTP response left to carry the error.
    """
    _run(_supabase(fail_on=fail_on))  # would raise if unhandled
