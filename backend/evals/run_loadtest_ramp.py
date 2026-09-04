"""
Drives the L1 load-test ramp: runs locust headless at each concurrency
level in turn and collects the per-stage percentiles into one table.

See LOADTEST.md for the hypothesis this is testing. In short: the endpoint
streams through a *synchronous* generator, which Starlette runs in a
threadpool limited to 40 concurrent tokens, so throughput should hit a
ceiling near 40 in-flight requests and `connect` latency -- normally
milliseconds, since it fires before any real work -- should hockey-stick
past that point.

Usage:
    python evals/run_loadtest_ramp.py --host http://localhost:8001
"""

import argparse
import csv
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from evals.common import EVALS_DIR, RESULTS_DIR, write_json  # noqa: E402

STEPS = [1, 5, 10, 20, 40, 60, 80]


def run_step(host: str, users: int, duration: str, out_dir: Path) -> dict:
    prefix = out_dir / f"u{users:03d}"
    cmd = [
        sys.executable, "-m", "locust",
        "-f", str(EVALS_DIR / "locustfile.py"),
        "--host", host,
        "--headless",
        "-u", str(users),
        "-r", str(max(1, min(users, 25))),
        "-t", duration,
        "--csv", str(prefix),
        "--only-summary",
    ]
    subprocess.run(cmd, check=False, capture_output=True, text=True)

    stats_path = Path(f"{prefix}_stats.csv")
    if not stats_path.exists():
        return {"users": users, "error": "no stats produced"}

    rows = {}
    with stats_path.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            rows[row["Name"]] = row

    result: dict = {"users": users}
    for name in ("connect", "ttft", "total"):
        row = rows.get(name)
        if not row:
            continue
        result[name] = {
            "n": int(row["Request Count"]),
            "p50": float(row["50%"]),
            "p95": float(row["95%"]),
            "max": float(row["Max Response Time"]),
        }
    agg = rows.get("Aggregated")
    if agg:
        # locust's aggregate Requests/s counts every custom event, and the
        # locustfile fires three per HTTP request (connect, ttft, total).
        # The true request rate is the `ttft` row's count over the run
        # duration; using the aggregate here would overstate throughput 3x.
        result["locust_events_per_s"] = float(agg["Requests/s"])
        result["failures"] = int(agg["Failure Count"])
    if "ttft" in result:
        result["rps"] = result["ttft"]["n"] / _duration_seconds(duration)
    return result


def _duration_seconds(duration: str) -> float:
    unit = duration[-1]
    value = float(duration[:-1])
    return value * {"s": 1, "m": 60, "h": 3600}.get(unit, 1)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="http://localhost:8001")
    parser.add_argument("--duration", default="40s")
    parser.add_argument("--steps", type=int, nargs="+", default=STEPS)
    args = parser.parse_args()

    out_dir = RESULTS_DIR / "loadtest"
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"L1 ramp against {args.host}, {args.duration} per step\n")
    results = []
    for users in args.steps:
        print(f"  running {users} users...", flush=True)
        result = run_step(args.host, users, args.duration, out_dir)
        results.append(result)
        if "ttft" in result:
            print(f"    n={result['ttft']['n']:>4}  "
                  f"connect p95 {result['connect']['p95']:>7.0f}ms  "
                  f"ttft p95 {result['ttft']['p95']:>7.0f}ms  "
                  f"rps {result.get('rps', 0):>5.2f}  "
                  f"fail {result.get('failures', 0)}")
        else:
            print(f"    {result}")

    print(f"\n{'users':>6} {'reqs':>6} {'rps':>7} "
          f"{'connect p50':>12} {'connect p95':>12} "
          f"{'ttft p50':>10} {'ttft p95':>10} {'total p95':>10} {'fail':>5}")
    for r in results:
        if "ttft" not in r:
            continue
        print(f"{r['users']:>6} {r['ttft']['n']:>6} {r.get('rps', 0):>7.2f} "
              f"{r['connect']['p50']:>11.0f}m {r['connect']['p95']:>11.0f}m "
              f"{r['ttft']['p50']:>9.0f}m {r['ttft']['p95']:>9.0f}m "
              f"{r['total']['p95']:>9.0f}m {r.get('failures', 0):>5}")

    write_json(RESULTS_DIR / "loadtest_l1.json", results)
    print(f"\nWrote {RESULTS_DIR / 'loadtest_l1.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
