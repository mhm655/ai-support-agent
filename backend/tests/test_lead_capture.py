"""
Lead capture treats the model's tool arguments as untrusted input.

The model writes capture_lead's arguments and the visitor steers the
model, so a hostile visitor effectively controls them. Before these
guards, one conversation could produce a new lead, and a new email to the
business owner, on every message, carrying values of any size or type.
"""

from unittest.mock import MagicMock, patch

from app.services import chat_service
from app.services.chat_service import LEAD_FIELD_LIMITS, _capture_lead, _clean_lead

AGENT = {"id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "name": "Front Desk", "business_id": "b"}
CONVERSATION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"


# --- _clean_lead -------------------------------------------------------------


def test_keeps_and_trims_real_contact_details():
    assert _clean_lead({"name": "  Alex  ", "email": "a@example.com"}) == {
        "name": "Alex",
        "email": "a@example.com",
    }


def test_truncates_oversized_values():
    lead = _clean_lead({"name": "A" * 10_000, "interest": "B" * 10_000})
    assert len(lead["name"]) == LEAD_FIELD_LIMITS["name"]
    assert len(lead["interest"]) == LEAD_FIELD_LIMITS["interest"]


def test_drops_values_that_are_not_strings():
    lead = _clean_lead({"name": "Alex", "email": {"$ne": ""}, "phone": 5551234, "interest": ["x"]})
    assert lead == {"name": "Alex"}


def test_drops_unknown_keys():
    assert _clean_lead({"name": "Alex", "agent_id": "someone-else", "id": "x"}) == {"name": "Alex"}


def test_rejects_a_lead_with_no_way_to_contact_anyone():
    assert _clean_lead({"interest": "buying a house"}) is None
    assert _clean_lead({"name": "   ", "email": ""}) is None
    assert _clean_lead({}) is None


# --- _capture_lead: one per conversation --------------------------------------


def _supabase(existing_rows):
    mock = MagicMock()
    for name in ("table", "select", "insert", "update", "eq", "limit"):
        getattr(mock, name).return_value = mock
    mock.execute.return_value = MagicMock(data=existing_rows)
    return mock


def test_first_capture_in_a_conversation_inserts():
    supabase = _supabase(existing_rows=[])
    with patch.object(chat_service, "get_supabase", return_value=supabase):
        assert _capture_lead(AGENT["id"], CONVERSATION, {"name": "Alex"}) is True
    supabase.insert.assert_called_once()
    supabase.update.assert_not_called()


def test_repeat_capture_updates_instead_of_adding_a_lead():
    supabase = _supabase(existing_rows=[{"id": "lead-1"}])
    with patch.object(chat_service, "get_supabase", return_value=supabase):
        assert _capture_lead(AGENT["id"], CONVERSATION, {"email": "new@example.com"}) is False
    supabase.update.assert_called_once_with({"email": "new@example.com"})
    supabase.insert.assert_not_called()


# --- the stream: what gets saved, notified and echoed -------------------------


def _call(**args):
    call = MagicMock()
    call.name = "capture_lead"
    call.args = args
    return call


def _stream(function_calls, capture_returns=True):
    decision = MagicMock(function_calls=function_calls)
    with patch.object(chat_service, "_get_or_create_conversation", return_value=CONVERSATION), \
         patch.object(chat_service, "_save_message"), \
         patch.object(chat_service, "_load_history", return_value=[{"role": "user", "content": "hi"}]), \
         patch.object(chat_service, "retrieve_relevant_chunks", return_value=[]), \
         patch.object(chat_service, "get_genai_client"), \
         patch.object(chat_service, "_generate_with_fallback", return_value=decision), \
         patch.object(chat_service, "_stream_with_fallback", return_value=iter(["ok"])), \
         patch.object(chat_service, "_capture_lead", return_value=capture_returns) as capture, \
         patch.object(chat_service, "notify_lead_captured") as notify:
        events = "".join(chat_service.stream_chat_response(AGENT, "hi", None, "v"))
    return events, capture, notify


def test_several_capture_calls_in_one_turn_save_only_one():
    events, capture, notify = _stream([_call(name="A"), _call(name="B"), _call(name="C")])
    assert capture.call_count == 1
    assert notify.call_count == 1
    assert events.count("event: lead_captured") == 1


def test_repeat_lead_in_a_conversation_does_not_email_the_owner_again():
    _, capture, notify = _stream([_call(email="a@example.com")], capture_returns=False)
    capture.assert_called_once()
    notify.assert_not_called()


def test_garbage_arguments_save_nothing_and_email_nobody():
    events, capture, notify = _stream([_call(interest="x" * 5000, phone=12345)])
    capture.assert_not_called()
    notify.assert_not_called()
    assert "lead_captured" not in events


def test_what_is_saved_and_emailed_is_the_cleaned_lead():
    _, capture, notify = _stream([_call(name="  Alex  ", email=["not", "a", "string"], extra="x")])
    saved = capture.call_args.args[2]
    assert saved == {"name": "Alex"}
    assert notify.call_args.args[1] == {"name": "Alex"}
