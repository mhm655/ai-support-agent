# Load test: `/public/agents/{agent_id}/chat`

**Status: L1 has been run locally against a fully stubbed instance. L2 and
L3 have not been run and still need the approvals described at the bottom.
Nothing has touched the Railway deployment.**

**The L1 result falsified the central hypothesis below.** The hypothesis
and the reasoning behind it are left intact rather than rewritten, because
the way it was wrong is the useful part. Results and the corrected model
are in "L1 results".

This targets the public chat endpoint specifically because it is the only
unauthenticated route in the API. Anyone with an `agent_id` can call it,
and the `agent_id` is embedded in a `<script>` tag on a public website, so
it is readable by anyone who views source. That makes it both the most
exposed surface and the most expensive one per request.

---

## Tool choice: Locust, not k6

k6 is the more common answer and it is the wrong one here.

The endpoint returns Server-Sent Events, and the metric that matters is
**time to first token**, not total response time. k6's `http.post` buffers
the entire response body before returning, so it cannot see the first
`token` event as it arrives. Measuring SSE properly in k6 needs the
`xk6-sse` extension, which means building a custom k6 binary with Go
toolchain installed.

Locust is plain Python. It runs in the existing `backend/venv`, it can
stream a response with `httpx` and stamp the first token directly, and the
SSE parsing is already written and tested in `evals/latency_chat.py` —
the locustfile imports `one_request` from it rather than reimplementing
it, so the load test and the single-shot benchmark measure the same thing
the same way.

The one real k6 advantage, much lower client-side overhead per virtual
user, does not bind at the concurrency levels below.

```bash
cd backend
venv\Scripts\activate
pip install locust        # not added to requirements.txt; load-test only
```

---

## The hypothesis to falsify

This is worth stating in advance so the test can disprove it rather than
being read to confirm it.

`chat_service.stream_chat_response` is a **synchronous generator**
(verified: `inspect.isgeneratorfunction` returns True). `public_chat` is
`async def` but hands that sync generator to `StreamingResponse`, so
Starlette iterates it with `iterate_in_threadpool`. That threadpool is
anyio's default, and its limiter holds **40 tokens** (verified on the
pinned versions: anyio 4.14.2, starlette 0.38.6, fastapi 0.115.0).

Each request occupies one of those 40 threads for its *entire* duration —
not just the CPU part. That duration includes two Gemini calls and five
sequential Supabase round-trips (`_get_or_create_conversation`,
`_save_message`, `retrieve_relevant_chunks`, `_load_history`, and the
final `_save_message`).

So the prediction is:

> Throughput ceiling ≈ 40 / mean_request_seconds, regardless of CPU. At a
> 5s mean that is ~8 requests/second. Past 40 concurrent in-flight
> requests, new ones queue *before the generator starts*, so even the
> `conversation` event — which normally fires in milliseconds, before any
> Gemini or retrieval work — gets delayed.

That last part is the sharp, easily-falsifiable bit. `connect_ms` is
already measured separately in `latency_chat.py` precisely so this is
visible: if the threadpool hypothesis is right, `connect_ms` stays flat
and then hockey-sticks at a specific concurrency. If `connect_ms` degrades
smoothly from the start instead, the bottleneck is somewhere else and the
hypothesis is wrong.

---

## Three levels, because "load test" means three different questions

The endpoint calls Gemini twice and Supabase five times per request. If
everything is left real, the test measures Google's rate limiter and the
network, not this application. Each level answers a different question and
they should not be conflated.

### L1 — stub Gemini and Supabase: how much can the app itself take?

Answers: *does the 40-thread ceiling exist, and where exactly is it?*

This is the level that produces the defensible engineering finding,
because it isolates the one variable that is a property of this codebase
rather than of a vendor's free tier. Both dependencies are replaced with
fakes that sleep for a realistic, fixed duration, so per-request time is
deterministic and the ceiling shows up cleanly.

Run against a local instance. No quota cost, no production impact.

### L2 — stub Gemini only, real Supabase: what does the database add?

Answers: *how much of the latency is the five sequential round-trips?*

Worth running once. Note that from a local machine this measures the local
uplink: baseline Supabase RTT from the development machine was measured at
**581ms median for a trivial query**, so five round-trips is ~3s before
any model call. That number will look completely different from Railway,
which is why L2 is more informative run against the deployed instance than
locally.

### L3 — everything real: where does the free tier give out?

Answers: *at what concurrency do visitors start seeing errors?*

This is a legitimate finding and arguably the most operationally relevant
one, but it measures the **deployment's quota**, not the code's capacity.
It should be reported as such, and never as a throughput number for the
application.

L3 is the expensive one. See the quota arithmetic below.

---

## L1 results

Ramp against the fully stubbed server (`evals/loadtest_server.py`), 30
seconds per step, Gemini and Supabase both faked with fixed sleeps so
per-request time is deterministic. Driver: `evals/run_loadtest_ramp.py`.

| users | requests | req/s | connect p50 | connect p95 | ttft p50 | ttft p95 | total p95 | failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5 | 0.2 | 43 ms | 46 ms | 1100 ms | 1100 ms | 2300 ms | 0 |
| 5 | 25 | 0.8 | 43 ms | 76 ms | 1100 ms | 1100 ms | 2300 ms | 0 |
| 10 | 48 | 1.6 | 43 ms | 120 ms | 1100 ms | 1200 ms | 2400 ms | 0 |
| 20 | 103 | 3.4 | 43 ms | 180 ms | 1100 ms | 1200 ms | 2400 ms | 0 |
| 40 | 199 | 6.6 | 43 ms | 200 ms | 1100 ms | 1200 ms | 2400 ms | 0 |
| 60 | 293 | 9.8 | 43 ms | 220 ms | 1100 ms | 1300 ms | 3300 ms | 0 |
| 80 | 342 | 11.4 | 66 ms | 250 ms | 1100 ms | 1300 ms | 3900 ms | 0 |

Zero failures throughout.

### The hypothesis was wrong

There is **no cliff at 40 concurrent users**. `connect` p50 stays flat at
43 ms right through 60 users and only moves at 80. `ttft` p50 does not move
at all. Throughput scales roughly linearly to 11.4 req/s with no inflection.

The prediction was that a request holds one of the 40 threadpool tokens for
its entire duration. That is not what Starlette does. `iterate_in_threadpool`
calls `next()` on the generator as a **separate** `anyio.to_thread.run_sync`
per yielded chunk:

```python
while True:
    yield await anyio.to_thread.run_sync(_next, as_iterator)
```

So a thread token is acquired and released **per yield**, not per request.
It is held only for the duration of one inter-yield segment, and released
while the event loop writes that chunk to the socket.

### The corrected model

The ceiling is 40 concurrent *inter-yield segments*, not 40 concurrent
requests. What matters is therefore the **longest single segment**, which
in `stream_chat_response` is the non-streaming tool-decision Gemini call —
everything from the `conversation` yield up to the first token is one
uninterrupted blocking stretch.

That gives a much more permissive ceiling:

> requests/second ceiling ≈ 40 / longest_blocking_segment_seconds

With the stub's 0.8 s decide call that is ~50 req/s. The test reached 11.4
req/s, so it never came close, which is exactly why no cliff appeared.

The practical consequence is the reverse of the original worry: the
architecture is more scalable than the sync-generator smell suggests. The
per-yield token release means a 24-token streaming reply is 24 short thread
acquisitions rather than one long one.

### What did degrade, and the caveat

`total` p95 does rise meaningfully past 40 users: 2400 ms → 3300 ms → 3900 ms,
about 60% between 40 and 80 users, while `ttft` stays flat. Latency is
accumulating in the token-streaming phase, not before the first token.

**Do not read that as a server finding.** Locust, its 80 greenlets, 80 httpx
clients and the server were all on one Windows laptop. At the top of the
ramp the client is a plausible bottleneck. Establishing where the server's
real ceiling is would need the load generator on a separate machine and an
arrival rate around 50 req/s.

**So the honest claim is bounded: no degradation cliff was found up to 11.4
req/s and 80 concurrent users.** Where the ceiling actually is remains
unmeasured.

### A measurement bug worth recording

The first ramp run reported `connect` p95 of 1100 ms, which was impossible —
that event fires after three stubbed 20 ms calls and should be ~60 ms.

The cause was not the application. The benchmark was pointed at
`http://localhost:8001` while the stub server binds `127.0.0.1`. On Windows,
`localhost` resolves to `::1` first, that connection fails, and the client
falls back to IPv4 after roughly a second.

| stage | via `localhost` | via `127.0.0.1` |
| --- | --- | --- |
| connect | 1052 ms | **42 ms** |
| ttft | 2094 ms | **1084 ms** |
| total | 3278 ms | **2268 ms** |

A flat ~1010 ms penalty on every request. With `127.0.0.1` all three
figures match the stub's configured sleeps almost exactly, which is what
confirmed the diagnosis rather than merely being consistent with it.

Every local measurement in this repo should use `127.0.0.1`, never
`localhost`. This does not affect the retrieval or ingestion numbers in
EVALS.md, which never went through a local HTTP server.

Also fixed while writing this up: locust's aggregate `Requests/s` counted
all three custom events per request, overstating throughput 3x. The req/s
column above is the true rate, taken from the `ttft` row count over the run
duration.

---

## Quota arithmetic, before anyone runs L3

Per chat request: **1 embedding call** (query embedding for retrieval) plus
**2 chat completions** (the tool-decision pass and the streaming reply).

Measured free-tier limits on this project:

- `gemini-embedding-2`: **100 requests/minute**, and each *text* in a batch
  counts, not each HTTP call.
- `gemini-3.5-flash`: 20 requests/day, which is what drove the original
  switch away from it.
- `gemini-3.5-flash-lite`: higher, exact ceiling not established.

A single 60-second ramp holding 40 concurrent users at ~5s per request is
roughly 480 requests. That is **480 embedding calls and 960 chat
completions** — comfortably past the embedding limit inside the first
15 seconds, at which point the test is measuring HTTP 429s.

**Conclusion: L3 cannot produce a meaningful latency curve on a free
tier.** What it can produce is a single honest number: the concurrency at
which quota errors begin. Getting that does not need a 40-user ramp; it
needs a slow ramp that stops at the first sustained error. Budget ~30-60
requests, not 480.

---

## Proposed run plan

Ramp concurrency in steps, holding each level long enough for latency to
settle, and stop automatically on sustained errors.

| step | concurrent users | hold | purpose |
| --- | --- | --- | --- |
| 1 | 1 | 60s | baseline, should match `latency_chat.py` |
| 2 | 5 | 60s | well under the threadpool limit |
| 3 | 10 | 60s | still under |
| 4 | 20 | 60s | half the predicted ceiling |
| 5 | 40 | 60s | at the predicted ceiling |
| 6 | 60 | 60s | past it — `connect_ms` should hockey-stick here |
| 7 | 80 | 60s | confirm the shape, then stop |

Record at each step: `connect_ms`, `ttft_ms`, `total_ms` (p50 and p95),
requests/second, and the error count by type. The headline output is the
concurrency at which p95 TTFT first exceeds roughly 2x its value at
concurrency 1 — that is what "meaningfully degrades" should be defined as,
fixed in advance rather than chosen after seeing the graph.

For L1 the full ramp is fine. For L3, stop at step 2.

---

## Before running this

Two things need deciding, and neither is mine to decide:

1. **Where.** Everything above assumes a local instance. Running any of it
   against `ai-support-agent-production-6e2e.up.railway.app` needs
   explicit approval — it is a real deployment on a hobby tier, and step 6
   would put 60 concurrent streams through it.

2. **L3 at all.** Even the reduced ~30-60 request version spends real
   Gemini quota on the shared project key, which would degrade the live
   demo page for anyone using it at the time.

My recommendation: run **L1 locally** for the engineering finding, run
**L2 against Railway** once and briefly for the database round-trip cost,
and skip L3 until the chat model is on a paid tier where the number would
mean something.

Also worth noting: at the time of writing, `gemini-3.5-flash-lite` is
returning 503 UNAVAILABLE on every call, so L2 and L3 are blocked
regardless.

---

## A note on what this endpoint does not have

Not a load test finding, but it came up while reading the code for one,
and it is the reason a load test against this route is worth caring about:

**there is no rate limiting on `/public/*` at all.** No per-agent quota, no
per-IP throttle, no request cost accounting. The `agent_id` is public by
design, and each request to it spends the *business owner's* Gemini quota.
A single script pointed at a scraped `agent_id` can exhaust a customer's
daily allowance, and on a paid tier would spend their money directly.

CORS being wide open on `/public/*` is correctly documented in `main.py` as
deliberate and safe — that reasoning is about credential leakage and it
holds. It is a separate question from resource exhaustion, which is not
currently addressed anywhere.

This is out of scope for a benchmark, but it is the thing the load test
would demonstrate most vividly, and it is worth a decision before this
product has real customers.
