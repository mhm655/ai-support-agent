"""
Rate limiting for the unauthenticated public chat endpoint.

Why this exists
---------------
`/public/agents/{agent_id}/chat` is the only unauthenticated route in the
API, and the `agent_id` that authorises it is embedded in a `<script>` tag
on the customer's own website — so it is readable by anyone who views
source. That is intentional and is the product.

What is not intentional is that every request spends *the business
owner's* Gemini quota. Without a limit, a trivial loop pointed at a
scraped `agent_id` exhausts a customer's daily allowance, and on a paid
tier spends their money directly. CORS on this route is wide open by
design and that reasoning is sound, but it is about credential leakage,
which is a different problem from resource exhaustion.

Design notes and limits
-----------------------
This is a per-process, in-memory sliding window. No Redis, no new
dependency. That is a deliberate trade for a single-instance hobby-tier
deployment, and it has a real consequence worth being explicit about:

  **the effective limit is multiplied by the number of worker processes.**

Railway currently runs one uvicorn worker, so the configured numbers are
the actual numbers. If workers are ever scaled up, or the service runs on
more than one instance, this needs to move to a shared store before the
limits mean what they say.

It is still worth having in this form: it turns "one script can drain a
customer's quota in a minute" into "one script can drain it in a minute
per worker", which for a single worker is the whole fix.
"""

import threading
import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.config import settings

# Stop the key dictionaries growing without bound if the endpoint is
# scanned with many distinct agent ids or from many addresses. Eviction is
# lazy and only touches keys whose window has fully expired.
MAX_TRACKED_KEYS = 20_000


def guard_single_instance() -> None:
    """
    Refuses to start if `settings.expected_app_instances` says this
    deployment runs more than one process.

    The limiters below are per-process, in-memory state. With N processes
    (uvicorn `--workers`, or Railway replicas) each one enforces the
    configured limit independently, so the *actual* ceiling is the
    configured number times N -- silently, with no error and no log line,
    just a business's Gemini quota draining faster than the numbers in
    config.py say it should.

    `expected_app_instances` cannot be read from the environment: a worker
    process has no view of its siblings, and Railway's replica count is a
    dashboard setting with no env var exposing it. So this can only catch
    a deliberate, remembered change to that setting -- not an ops-side
    scale-up that forgets to touch this file. It is a tripwire for the
    change happening through this codebase, not a complete guarantee.

    Raising here, rather than just logging, is deliberate: a warning that
    scrolls by in deploy logs is exactly the kind of thing that gets
    missed, and the cost of being wrong (quota silently draining N times
    faster) is high enough to justify refusing to boot instead.
    """
    if settings.expected_app_instances > 1:
        raise RuntimeError(
            "expected_app_instances is set above 1, but the public chat "
            "rate limiter (SlidingWindowLimiter) is per-process, in-memory "
            "state -- each process would enforce the configured limits "
            "independently, multiplying the effective ceiling by the "
            "instance count. Move the limiter to a shared store (Redis, "
            "or a counters table in Supabase Postgres) before running more "
            "than one instance. See core/rate_limit.py."
        )


class SlidingWindowLimiter:
    """
    Counts hits per key inside a rolling window.

    A sliding window log rather than a fixed window counter: a fixed
    window lets a caller send the full allowance at 0:59 and again at
    1:01, which is double the intended rate right at the boundary. Storing
    the timestamps costs a little more memory and removes that edge, and
    at these volumes the memory is irrelevant.
    """

    def __init__(self, limit: int, window_seconds: float) -> None:
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> float | None:
        """
        Records a hit. Returns None if allowed, or the number of seconds
        to wait if the key is over its limit.

        A blocked request is deliberately *not* recorded, so a caller that
        keeps hammering while limited does not push its own retry time
        further and further out.
        """
        now = time.monotonic()
        cutoff = now - self.window

        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= cutoff:
                hits.popleft()

            if len(hits) >= self.limit:
                # `hits` is empty when limit <= 0, which means "allow
                # nothing". The route never constructs that case (it skips
                # limiters with limit <= 0), but indexing an empty deque
                # here would raise IndexError instead of rate limiting, so
                # it is handled rather than left to the caller's guard.
                if not hits:
                    return self.window
                return max(0.0, hits[0] + self.window - now)

            hits.append(now)

            if len(self._hits) > MAX_TRACKED_KEYS:
                self._evict(cutoff)
            return None

    def _evict(self, cutoff: float) -> None:
        """Drops keys with no hits left in the window. Caller holds the lock."""
        stale = [k for k, v in self._hits.items() if not v or v[-1] <= cutoff]
        for key in stale:
            del self._hits[key]

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


def client_ip(request: Request) -> str:
    """
    Best-effort client address.

    Railway terminates TLS and proxies, so `request.client.host` is the
    proxy and every visitor looks like one address. Railway's edge sets
    X-Real-IP to the caller's address -- the header its networking docs
    name for exactly this ("Specs & Limits" > Request Headers).

    X-Forwarded-For is deliberately NOT read. This used to trust its first
    entry, on the belief that Railway overwrites it; Railway documents no
    such thing, and the first entry is whatever the client sent. Verified
    against a local server on 2026-09-24: ten requests each carrying a
    different invented X-Forwarded-For all got through a limit of eight,
    so the per-IP limit could be skipped by anyone who knew to try.

    Without a proxy (local dev, tests) there is no X-Real-IP and the socket
    peer is already the real client. Run uvicorn with --no-proxy-headers
    locally, or it rewrites the socket peer from X-Forwarded-For for
    loopback connections and the forged header gets in that way instead.

    The assumption this rests on: X-Real-IP is only trustworthy behind a
    proxy that sets it. Deployed anywhere without one, a client could send
    it themselves. Still a courtesy limit either way -- the per-agent
    limits below are what bound spend, and no header affects those.
    """
    real_ip = request.headers.get("x-real-ip", "").strip()
    if real_ip:
        return real_ip
    return request.client.host if request.client else "unknown"
