"""
Emails a business owner when their agent captures a lead.

Why this exists: leads are the product's whole point, and until now they
landed in a dashboard tab with nothing to say they had arrived. Nobody
running a small business logs into a dashboard daily on the chance
something appeared, so a captured lead could sit unread for days, which
for an enquiry about booking is the same as losing it.

Two rules shape everything below.

  1. The visitor must never wait for it. Sending happens on its own
     thread, so a slow or unreachable mail server cannot add seconds to
     the reply the visitor is watching arrive token by token.

  2. A failure here must never cost a lead. The row is already committed
     to the database before any of this runs, so the dashboard is correct
     whatever happens; a failed send means a missing notification, never a
     missing lead. Every exception is therefore caught and logged rather
     than raised.
"""

import logging
import threading

from app.core.config import settings
from app.core.supabase_client import get_supabase
from app.services import email

logger = logging.getLogger(__name__)


def _owner_email(business_id: str) -> str | None:
    """
    The account email of the business that owns this agent.

    Two hops, because the address lives in Supabase Auth rather than in
    our own tables: businesses.auth_user_id, then the Auth admin API. The
    service-role key is what makes the second one possible.
    """
    supabase = get_supabase()
    business = (
        supabase.table("businesses")
        .select("auth_user_id")
        .eq("id", business_id)
        .limit(1)
        .execute()
    )
    if not business.data:
        logger.warning("No business row for business_id=%s", business_id)
        return None

    user = supabase.auth.admin.get_user_by_id(business.data[0]["auth_user_id"])
    return getattr(getattr(user, "user", None), "email", None)


def _format(agent: dict, lead: dict) -> tuple[str, str]:
    """Builds the subject and plain-text body."""
    agent_name = agent.get("name") or "your agent"
    subject = f"New lead from {agent_name}"

    lines = [f"{agent_name} captured a new lead."]

    # Only what the visitor actually gave. The tool's arguments are all
    # optional, and printing "Phone: None" for the three they left out
    # makes a short email look like a broken one.
    fields = (("Name", "name"), ("Email", "email"), ("Phone", "phone"), ("Interest", "interest"))
    details = [f"{label}: {lead[key]}" for label, key in fields if lead.get(key)]
    if details:
        lines.append("\n".join(details))
    else:
        lines.append("No contact details were captured with it.")

    if settings.dashboard_base_url:
        base = settings.dashboard_base_url.rstrip("/")
        lines.append(f"See it here: {base}/dashboard/agents/{agent['id']}")

    return subject, "\n\n".join(lines)


def _send(agent: dict, lead: dict) -> None:
    try:
        recipient = _owner_email(agent["business_id"])
        if not recipient:
            logger.warning(
                "No owner email for business_id=%s, skipping lead notification",
                agent.get("business_id"),
            )
            return

        subject, body = _format(agent, lead)
        email.send_email(recipient, subject, body)
    except Exception:
        # Deliberately broad, and deliberately swallowed. The lead is
        # already saved; nothing here is worth failing a visitor's chat
        # for, and this runs on a thread with nobody to catch it.
        logger.exception(
            "Failed to send lead notification for agent_id=%s", agent.get("id")
        )


def notify_lead_captured(agent: dict, lead: dict) -> None:
    """
    Fire-and-forget notification. Returns immediately.

    A daemon thread rather than a task queue: this is one small network
    call, and the rate limiter already caps how many can be started per
    minute. Daemon so it can never hold up interpreter shutdown, which
    also means a send in flight during a deploy is simply dropped -- an
    acceptable trade for not delaying the visitor, and the lead itself is
    safe in the database either way.
    """
    if not email.is_configured():
        return  # Not configured is the normal state, not an error.

    threading.Thread(
        target=_send,
        args=(agent, lead),
        name=f"lead-notify-{agent.get('id', '')[:8]}",
        daemon=True,
    ).start()
