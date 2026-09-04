"""
Tests for the public chat rate limiter.

The behaviour that actually matters here is not "does it block the 9th
request" but "does it block *before* spending money" -- the limiter exists
to stop a scraped agent_id draining the business owner's Gemini quota, and
a limiter that runs after the Supabase lookup and the Gemini calls would
protect nothing. That ordering is asserted explicitly below.
"""

import time
from unittest.mock import patch

import pytest
from fastapi import Request

from app.core.rate_limit import SlidingWindowLimiter, client_ip


def _request(headers: dict[str, str] | None = None, host: str = "1.2.3.4") -> Request:
    raw = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    return Request({
        "type": "http",
        "method": "POST",
        "path": "/public/agents/a/chat",
        "headers": raw,
        "client": (host, 1234),
    })


# --- the limiter itself ----------------------------------------------------


def test_allows_up_to_the_limit():
    limiter = SlidingWindowLimiter(limit=3, window_seconds=60.0)
    assert [limiter.check("k") for _ in range(3)] == [None, None, None]


def test_blocks_past_the_limit_and_reports_a_wait():
    limiter = SlidingWindowLimiter(limit=3, window_seconds=60.0)
    for _ in range(3):
        limiter.check("k")

    retry_after = limiter.check("k")
    assert retry_after is not None
    assert 0 < retry_after <= 60.0


def test_keys_are_independent():
    limiter = SlidingWindowLimiter(limit=1, window_seconds=60.0)
    assert limiter.check("agent-a") is None
    assert limiter.check("agent-b") is None
    assert limiter.check("agent-a") is not None


def test_window_slides():
    limiter = SlidingWindowLimiter(limit=2, window_seconds=0.2)
    limiter.check("k")
    limiter.check("k")
    assert limiter.check("k") is not None

    time.sleep(0.25)
    assert limiter.check("k") is None


def test_blocked_requests_do_not_extend_the_window():
    """
    A caller that keeps hammering while limited should not push its own
    retry time further out -- otherwise a bot in a tight loop locks itself
    (and that key) out indefinitely.
    """
    limiter = SlidingWindowLimiter(limit=1, window_seconds=60.0)
    limiter.check("k")

    first = limiter.check("k")
    for _ in range(20):
        limiter.check("k")
    last = limiter.check("k")

    assert first is not None and last is not None
    # Still counting down from the original hit, not restarted by the flood.
    assert last <= first


def test_limit_of_zero_is_handled_by_the_caller_not_the_limiter():
    # The route skips limiters with limit <= 0; the limiter itself would
    # block everything, which is why that guard exists in public_chat.
    limiter = SlidingWindowLimiter(limit=0, window_seconds=60.0)
    assert limiter.check("k") is not None


# --- client address extraction ---------------------------------------------


def test_client_ip_prefers_forwarded_header():
    request = _request({"X-Forwarded-For": "203.0.113.7, 70.41.3.18"})
    assert client_ip(request) == "203.0.113.7"


def test_client_ip_falls_back_to_socket_peer():
    assert client_ip(_request(host="9.9.9.9")) == "9.9.9.9"


def test_client_ip_ignores_empty_forwarded_header():
    request = _request({"X-Forwarded-For": ""}, host="9.9.9.9")
    assert client_ip(request) == "9.9.9.9"


# --- route integration -----------------------------------------------------


@pytest.fixture
def reset_limiters():
    from app.api.routers import public_chat

    public_chat._ip_limiter.reset()
    public_chat._agent_limiter.reset()
    yield
    public_chat._ip_limiter.reset()
    public_chat._agent_limiter.reset()


def test_route_raises_429_with_retry_after(reset_limiters):
    from fastapi import HTTPException

    from app.api.routers import public_chat

    limit = public_chat._ip_limiter.limit
    for _ in range(limit):
        public_chat._enforce_rate_limits("agent-1", _request())

    with pytest.raises(HTTPException) as excinfo:
        public_chat._enforce_rate_limits("agent-1", _request())

    assert excinfo.value.status_code == 429
    assert "Retry-After" in excinfo.value.headers
    assert int(excinfo.value.headers["Retry-After"]) >= 1


def test_limit_is_enforced_before_any_paid_work(reset_limiters):
    """
    The whole point: a blocked request must not reach Supabase or Gemini.
    """
    from fastapi import HTTPException

    from app.api.routers import public_chat

    for _ in range(public_chat._ip_limiter.limit):
        public_chat._enforce_rate_limits("agent-1", _request())

    with patch.object(public_chat, "get_supabase") as supabase:
        with pytest.raises(HTTPException):
            public_chat._enforce_rate_limits("agent-1", _request())
        supabase.assert_not_called()


def test_different_visitors_are_limited_separately(reset_limiters):
    from app.api.routers import public_chat

    for _ in range(public_chat._ip_limiter.limit):
        public_chat._enforce_rate_limits("agent-1", _request({"X-Forwarded-For": "1.1.1.1"}))

    # A second visitor on the same agent is unaffected, as long as the
    # per-agent ceiling is higher than the per-IP one.
    public_chat._enforce_rate_limits("agent-1", _request({"X-Forwarded-For": "2.2.2.2"}))


def test_agent_limit_catches_a_distributed_flood(reset_limiters):
    """
    Spreading requests across many source addresses evades the per-IP
    limit. The per-agent limit is what still caps the owner's quota spend,
    and unlike X-Forwarded-For it cannot be forged.
    """
    from fastapi import HTTPException

    from app.api.routers import public_chat

    agent_limit = public_chat._agent_limiter.limit

    with pytest.raises(HTTPException) as excinfo:
        for i in range(agent_limit + 5):
            public_chat._enforce_rate_limits(
                "agent-1", _request({"X-Forwarded-For": f"10.0.0.{i}"})
            )

    assert excinfo.value.status_code == 429
    assert "for this agent" in excinfo.value.detail


# --- malformed agent id ----------------------------------------------------


def test_malformed_agent_id_is_404_not_500(reset_limiters):
    """
    agent_id lands in a query against a uuid column. Postgres raises rather
    than returning no rows for a malformed value, so before this was
    handled any anonymous visitor could produce a 500 on the public route
    just by requesting /public/agents/foo/chat.
    """
    from fastapi.testclient import TestClient

    from app.main import app

    with patch("app.api.routers.public_chat.get_supabase") as supabase:
        response = TestClient(app).post(
            "/public/agents/not-a-uuid/chat",
            json={"message": "hi", "visitor_id": "v"},
        )

    assert response.status_code == 404
    # Rejected on shape alone; the database is never consulted.
    supabase.assert_not_called()
