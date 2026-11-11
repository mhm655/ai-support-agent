"""
Request body size limits (app/core/body_limit.py) and the ChatRequest caps.

The attack these pin down was reproduced against a real server before the
fix: a 5MB JSON body sent to the unauthenticated chat route was fully read
and parsed. It must now be refused before any of it is parsed, and before
the route (or Supabase behind it) is reached at all.
"""

import json
from unittest.mock import patch

from app.core.body_limit import DEFAULT_MAX_BODY, UPLOAD_MAX_BODY, _limit_for

CHAT_URL = "/public/agents/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/chat"


def test_oversized_json_is_refused_before_the_route_runs(client):
    body = json.dumps({"message": "hi", "visitor_id": "x" * 5_000_000})
    with patch("app.api.routers.public_chat.get_supabase") as supabase:
        response = client.post(CHAT_URL, content=body, headers={"Content-Type": "application/json"})
    assert response.status_code == 413
    supabase.assert_not_called()


def test_413_carries_cors_headers_so_the_widget_can_read_it(client):
    response = client.post(
        CHAT_URL,
        content=b"x" * (DEFAULT_MAX_BODY + 1),
        headers={"Content-Type": "application/json", "Origin": "https://customer-site.example"},
    )
    assert response.status_code == 413
    assert response.headers.get("access-control-allow-origin") == "*"


def test_retry_after_is_readable_by_the_cross_origin_widget(client):
    response = client.post(
        CHAT_URL, json={"message": "   "}, headers={"Origin": "https://customer-site.example"}
    )
    exposed = response.headers.get("access-control-expose-headers", "")
    assert "retry-after" in exposed.lower()


def test_chunked_body_without_length_is_cut_off(client):
    """
    Omitting Content-Length (chunked transfer) must not be a way around the
    up-front check. The route must never see a complete oversized body.
    """
    def chunks():
        for _ in range(20):
            yield b"x" * 16 * 1024  # 320KB in total, no declared length

    with patch("app.api.routers.public_chat.get_supabase") as supabase:
        response = client.post(CHAT_URL, content=chunks(), headers={"Content-Type": "application/json"})
    # The truncated stream fails body parsing, so FastAPI answers 400 and
    # the route itself never runs.
    assert response.status_code == 400
    supabase.assert_not_called()


def test_normal_sized_requests_are_unaffected(client):
    # Reaches the route (and its 404 for an unknown agent), not a 413.
    with patch("app.api.routers.public_chat.get_supabase") as supabase:
        supabase.return_value.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
        response = client.post(CHAT_URL, json={"message": "What are your hours?"})
    assert response.status_code == 404


def test_uploads_get_the_larger_allowance():
    upload = {"method": "POST", "path": "/agents/abc/documents"}
    listing = {"method": "GET", "path": "/agents/abc/documents"}
    assert _limit_for(upload) == UPLOAD_MAX_BODY
    assert _limit_for(listing) == DEFAULT_MAX_BODY
    assert _limit_for({"method": "POST", "path": CHAT_URL}) == DEFAULT_MAX_BODY


# --- ChatRequest field caps -------------------------------------------------


def test_whitespace_only_message_is_rejected(client):
    assert client.post(CHAT_URL, json={"message": "   "}).status_code == 422


def test_oversized_visitor_id_is_rejected(client):
    assert client.post(CHAT_URL, json={"message": "hi", "visitor_id": "v" * 101}).status_code == 422


def test_oversized_conversation_id_is_rejected(client):
    assert client.post(CHAT_URL, json={"message": "hi", "conversation_id": "c" * 65}).status_code == 422
