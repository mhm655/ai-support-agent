"""
Outbound email over SMTP.

SMTP rather than a provider SDK on purpose. It needs no new dependency
(smtplib is stdlib), and every service worth using speaks it, so moving
from a Gmail app password to Resend or Postmark later is a change of
environment variables rather than a change of code.

Entirely optional. With no SMTP host configured, is_configured() is False
and nothing anywhere tries to send. That is the deployed state until the
variables are set, so adding this file changes no existing behaviour.
"""

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    """Whether enough is set to attempt a send at all."""
    return bool(settings.smtp_host and settings.smtp_from)


def send_email(to: str, subject: str, body: str) -> None:
    """
    Sends one plain-text email. Raises on failure; callers decide whether
    that matters.

    Plain text, not HTML: it renders in every client, cannot break, and
    needs no templating. There is nothing here a table would say better.

    The timeout is the point of this wrapper as much as the sending is. An
    SMTP connection to an unreachable host will otherwise hang until the
    OS gives up, which can be minutes, and this runs on a worker thread.
    """
    if not is_configured():
        raise RuntimeError("SMTP is not configured")

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    timeout = settings.smtp_timeout_seconds
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=timeout) as smtp:
        smtp.starttls()
        # Some relays accept mail without auth; only log in when told to.
        if settings.smtp_username and settings.smtp_password:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)

    logger.info("Sent notification email to %s", to)
