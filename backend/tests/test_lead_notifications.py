"""
Tests for lead notification email.

The two properties worth guarding are not "does it send an email". They
are that it cannot break a visitor's chat, and that it cannot send one
business's lead to another business's owner.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.core.config import settings
from app.services import email, lead_notifications

AGENT = {
    "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "business_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "name": "Front Desk",
}
LEAD = {"name": "Dana", "email": "dana@example.com", "phone": None, "interest": "a viewing"}


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(settings, "smtp_from", "bot@example.com")


def _supabase_with_owner(owner_email, business_rows=None):
    mock = MagicMock()
    for name in ("table", "select", "eq", "limit"):
        getattr(mock, name).return_value = mock
    rows = business_rows if business_rows is not None else [{"auth_user_id": "user-1"}]
    mock.execute.return_value = MagicMock(data=rows)
    mock.auth.admin.get_user_by_id.return_value = MagicMock(
        user=MagicMock(email=owner_email)
    )
    return mock


# --- off by default --------------------------------------------------------


def test_does_nothing_when_smtp_is_not_configured(monkeypatch):
    """
    Unconfigured is the normal state, not an error. Nothing should be
    started, so deployments that never set SMTP behave as before.
    """
    monkeypatch.setattr(settings, "smtp_host", None)
    monkeypatch.setattr(settings, "smtp_from", None)

    with patch.object(lead_notifications.threading, "Thread") as thread:
        lead_notifications.notify_lead_captured(AGENT, LEAD)

    thread.assert_not_called()


def test_is_configured_needs_both_host_and_sender(monkeypatch):
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(settings, "smtp_from", None)
    assert email.is_configured() is False


# --- it must never break chat ---------------------------------------------


def test_send_failure_is_swallowed(configured):
    """
    The lead row is already committed by the time this runs. An exception
    escaping here would surface as a broken SSE stream for a visitor whose
    lead was in fact captured successfully.
    """
    supabase = _supabase_with_owner("owner@example.com")

    with patch.object(lead_notifications, "get_supabase", return_value=supabase), \
         patch.object(email, "send_email", side_effect=RuntimeError("smtp down")):
        lead_notifications._send(AGENT, LEAD)  # must not raise


def test_missing_owner_email_is_handled(configured):
    supabase = _supabase_with_owner(None, business_rows=[])

    with patch.object(lead_notifications, "get_supabase", return_value=supabase), \
         patch.object(email, "send_email") as send:
        lead_notifications._send(AGENT, LEAD)

    send.assert_not_called()


def test_notify_returns_without_waiting(configured):
    """Sending happens off the visitor's path, on its own thread."""
    with patch.object(lead_notifications.threading, "Thread") as thread:
        lead_notifications.notify_lead_captured(AGENT, LEAD)

    thread.assert_called_once()
    assert thread.call_args.kwargs["daemon"] is True
    assert thread.call_args.kwargs["target"] is lead_notifications._send


# --- it must go to the right owner ----------------------------------------


def test_recipient_is_resolved_from_the_agents_own_business(configured):
    """
    The address is looked up from this agent's business_id, never from
    anything the visitor supplied. Getting this wrong would mail one
    business's lead to another business's owner.
    """
    supabase = _supabase_with_owner("owner@example.com")

    with patch.object(lead_notifications, "get_supabase", return_value=supabase), \
         patch.object(email, "send_email") as send:
        lead_notifications._send(AGENT, LEAD)

    supabase.eq.assert_any_call("id", AGENT["business_id"])
    assert send.call_args.args[0] == "owner@example.com"


# --- body ------------------------------------------------------------------


def test_body_omits_fields_the_visitor_did_not_give():
    """
    Every capture_lead argument is optional. Printing "Phone: None" for
    the ones left out makes a short email look like a broken one.
    """
    _, body = lead_notifications._format(AGENT, LEAD)

    assert "Dana" in body
    assert "dana@example.com" in body
    assert "Phone" not in body
    assert "None" not in body


def test_body_handles_a_lead_with_no_details_at_all():
    subject, body = lead_notifications._format(AGENT, {})

    assert "Front Desk" in subject
    assert "No contact details" in body


def test_dashboard_link_is_omitted_when_no_base_url(monkeypatch):
    """Better no link than one pointing at localhost."""
    monkeypatch.setattr(settings, "dashboard_base_url", None)
    _, body = lead_notifications._format(AGENT, LEAD)
    assert "http" not in body


def test_dashboard_link_points_at_the_agent(monkeypatch):
    monkeypatch.setattr(settings, "dashboard_base_url", "https://example.com/")
    _, body = lead_notifications._format(AGENT, LEAD)
    assert f"https://example.com/dashboard/agents/{AGENT['id']}" in body


# --- the SMTP call itself --------------------------------------------------


def _smtp_double(monkeypatch):
    """Captures the sequence of calls made against a connection."""
    conn = MagicMock()
    conn.__enter__.return_value = conn
    factory = MagicMock(return_value=conn)
    monkeypatch.setattr(email.smtplib, "SMTP", factory)
    return factory, conn


def test_credentials_are_only_sent_after_tls(configured, monkeypatch):
    """
    starttls() must be called before login(), or the password crosses the
    wire in the clear. Asserting the order, not just that both happened.
    """
    monkeypatch.setattr(settings, "smtp_username", "user")
    monkeypatch.setattr(settings, "smtp_password", "secret")
    _, conn = _smtp_double(monkeypatch)

    email.send_email("owner@example.com", "subject", "body")

    order = [name for name, _, _ in conn.mock_calls if name in ("starttls", "login", "send_message")]
    assert order == ["starttls", "login", "send_message"]


def test_login_is_skipped_when_no_credentials(configured, monkeypatch):
    """Some relays accept mail without auth; do not send an empty login."""
    monkeypatch.setattr(settings, "smtp_username", None)
    monkeypatch.setattr(settings, "smtp_password", None)
    _, conn = _smtp_double(monkeypatch)

    email.send_email("owner@example.com", "subject", "body")

    conn.login.assert_not_called()
    conn.send_message.assert_called_once()


def test_connection_is_given_a_timeout(configured, monkeypatch):
    """
    This runs on a worker thread. Without a timeout an unreachable host
    hangs until the OS gives up, which can be minutes.
    """
    factory, _ = _smtp_double(monkeypatch)

    email.send_email("owner@example.com", "subject", "body")

    assert factory.call_args.kwargs["timeout"] == settings.smtp_timeout_seconds


def test_refuses_to_send_when_unconfigured(monkeypatch):
    monkeypatch.setattr(settings, "smtp_host", None)
    monkeypatch.setattr(settings, "smtp_from", None)

    with pytest.raises(RuntimeError):
        email.send_email("owner@example.com", "subject", "body")
