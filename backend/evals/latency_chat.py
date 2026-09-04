"""
Measures end-to-end latency of the public chat endpoint.

Hits POST /public/agents/{agent_id}/chat exactly the way the embeddable
widget does, parses the hand-rolled SSE stream, and times three points:

  connect_ms   to the `conversation` event. This fires before retrieval or
               any Gemini call, so it isolates network plus the
               conversation-row insert.
  ttft_ms      to the first `token` event. This is the number a visitor
               actually feels: it covers the query embedding, the pgvector
               search, the history load, and the *entire* non-streaming
               tool-decision pass, because none of that produces output.
  total_ms     to the `done` event.

Requests are sent sequentially, each on a fresh conversation. Fresh
conversations matter: chat_service loads the full message history into
every request, so reusing one conversation would make each successive
request slower than the last and the trend would be mistaken for variance.

Usage:
    python evals/latency_chat.py --n 25
    python evals/latency_chat.py --n 25 --base-url https://your-app.up.railway.app
"""

import argparse
import json
import statistics
import sys
import time
import uuid
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from evals.common import EVALS_DIR, RESULTS_DIR, load_eval_set, write_json  # noqa: E402

AGENT_ID_FILE = EVALS_DIR / ".eval_agent_id"


def _host_slug(base_url: str) -> str:
    """A filesystem-safe identifier for the host actually measured."""
    from urllib.parse import urlparse

    parsed = urlparse(base_url if "//" in base_url else f"//{base_url}")
    host = (parsed.hostname or base_url).replace(".", "-")
    port = f"-{parsed.port}" if parsed.port else ""
    return f"{host}{port}"


def percentile(values: list[float], pct: float) -> float:
    """
    Nearest-rank percentile.

    No interpolation on purpose: at n=25 there is no meaningful precision
    to interpolate toward, and nearest-rank always returns a value that
    was actually observed rather than one that was not.
    """
    if not values:
        return 0.0
    ordered = sorted(values)
    rank = max(1, min(len(ordered), int(round(pct / 100.0 * len(ordered) + 0.5))))
    return ordered[rank - 1]


def one_request(client: httpx.Client, base_url: str, agent_id: str,
                message: str) -> dict:
    url = f"{base_url.rstrip('/')}/public/agents/{agent_id}/chat"
    payload = {"message": message, "visitor_id": f"bench-{uuid.uuid4().hex[:8]}"}

    record: dict = {
        "message": message,
        "connect_ms": None,
        "ttft_ms": None,
        "total_ms": None,
        "tokens": 0,
        "reply_chars": 0,
        "error": None,
        "http_status": None,
    }

    start = time.perf_counter()
    try:
        with client.stream("POST", url, json=payload) as response:
            record["http_status"] = response.status_code
            if response.status_code != 200:
                record["error"] = f"HTTP {response.status_code}"
                return record

            event = None
            for line in response.iter_lines():
                if line.startswith("event: "):
                    event = line[7:].strip()
                    continue
                if not line.startswith("data: "):
                    continue

                now = (time.perf_counter() - start) * 1000
                data = line[6:]

                if event == "conversation" and record["connect_ms"] is None:
                    record["connect_ms"] = now
                elif event == "token":
                    if record["ttft_ms"] is None:
                        record["ttft_ms"] = now
                    record["tokens"] += 1
                    try:
                        record["reply_chars"] += len(json.loads(data).get("text", ""))
                    except json.JSONDecodeError:
                        pass
                elif event == "error":
                    # The backend emits this for Gemini 429s and timeouts.
                    # Counted as a failure, never folded into the latency
                    # percentiles -- a fast error is not a fast response.
                    try:
                        record["error"] = json.loads(data).get("message", "error")
                    except json.JSONDecodeError:
                        record["error"] = "error event"
                elif event == "done":
                    record["total_ms"] = now
                    break
    except (httpx.HTTPError, OSError) as exc:
        record["error"] = f"{type(exc).__name__}: {exc}"

    return record


def summarize(records: list[dict], label: str) -> dict:
    ok = [r for r in records if r["error"] is None and r["ttft_ms"] is not None]
    failed = [r for r in records if r["error"] is not None]

    summary = {
        "label": label,
        "n_requests": len(records),
        "n_ok": len(ok),
        "n_failed": len(failed),
        "errors": sorted({r["error"] for r in failed}),
    }

    for field in ("connect_ms", "ttft_ms", "total_ms"):
        values = [r[field] for r in ok if r[field] is not None]
        if not values:
            continue
        summary[field] = {
            "min": min(values),
            "p50": percentile(values, 50),
            "p95": percentile(values, 95),
            "max": max(values),
            "mean": statistics.fmean(values),
        }

    if ok:
        summary["mean_reply_chars"] = statistics.fmean(r["reply_chars"] for r in ok)
        summary["mean_tokens"] = statistics.fmean(r["tokens"] for r in ok)
    return summary


def print_summary(summary: dict) -> None:
    print(f"\n  {summary['label']}")
    print(f"    {summary['n_ok']}/{summary['n_requests']} succeeded"
          + (f", {summary['n_failed']} failed" if summary["n_failed"] else ""))
    for err in summary["errors"]:
        print(f"      error: {err}")

    if summary["n_ok"] == 0:
        return

    print(f"\n    {'stage':>12} {'min':>9} {'p50':>9} {'p95':>9} {'max':>9}")
    for field, name in (("connect_ms", "connect"),
                        ("ttft_ms", "TTFT"),
                        ("total_ms", "total")):
        s = summary.get(field)
        if not s:
            continue
        print(f"    {name:>12} {s['min']:>8.0f}m {s['p50']:>8.0f}m "
              f"{s['p95']:>8.0f}m {s['max']:>8.0f}m")
    print(f"\n    mean reply {summary['mean_reply_chars']:.0f} chars "
          f"over {summary['mean_tokens']:.1f} SSE token events")
    if summary["n_ok"] < 20:
        print(f"    NOTE: p95 on n={summary['n_ok']} is essentially the "
              "second-worst sample. Treat it as indicative only.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--n", type=int, default=25)
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--agent-id", default=None)
    parser.add_argument("--delay", type=float, default=1.0,
                        help="seconds between requests")
    parser.add_argument("--label", default=None)
    parser.add_argument("--out", default=None,
                        help="result filename stem; defaults to the host")
    args = parser.parse_args()

    agent_id = args.agent_id
    if not agent_id:
        if not AGENT_ID_FILE.exists():
            raise SystemExit("No agent id. Run evals/setup_eval_agent.py first, "
                             "or pass --agent-id.")
        agent_id = AGENT_ID_FILE.read_text(encoding="utf-8").strip()

    label = args.label or args.base_url
    questions = [q.question for q in load_eval_set()]

    print(f"Target:  {args.base_url}")
    print(f"Agent:   {agent_id}")
    print(f"Requests: {args.n}, sequential, {args.delay}s apart")

    records = []
    with httpx.Client(timeout=120.0) as client:
        for i in range(args.n):
            message = questions[i % len(questions)]
            record = one_request(client, args.base_url, agent_id, message)
            records.append(record)

            status = record["error"] or (
                f"ttft {record['ttft_ms']:.0f}ms  total {record['total_ms']:.0f}ms"
                if record["ttft_ms"] else "no tokens"
            )
            print(f"  [{i + 1:>2}/{args.n}] {status}")

            if i < args.n - 1:
                time.sleep(args.delay)

    summary = summarize(records, label)
    print_summary(summary)

    # Derived from the actual host rather than guessed. An earlier version
    # keyed off the substring "localhost" and so wrote results from a local
    # 127.0.0.1 run into a file named "deployed" -- a result file whose name
    # lies about where it came from is worse than no result file.
    out = RESULTS_DIR / f"latency_chat_{args.out or _host_slug(args.base_url)}.json"
    write_json(out, {"summary": summary, "records": records})
    print(f"\n  Wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
