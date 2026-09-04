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

# Stop the key dictionaries growing without bound if the endpoint is
# scanned with many distinct agent ids or from many addresses. Eviction is
# lazy and only touches keys whose window has fully expired.
MAX_TRACKED_KEYS = 20_000


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
    proxy and every visitor looks like one address. The first entry of
    X-Forwarded-For is the original client.

    Caveat worth stating: X-Forwarded-For is client-supplied and can be
    spoofed unless the edge proxy overwrites it. Railway does overwrite
    it, so this is sound in the current deployment, but it means the
    per-IP limit is a courtesy control against casual abuse rather than a
    security boundary. The per-agent limit below is the one that actually
    caps quota spend, and it cannot be evaded by forging a header.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"
