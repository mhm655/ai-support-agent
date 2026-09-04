"""
Locust load test for the public chat endpoint. See LOADTEST.md.

Deliberately reuses `one_request` from evals/latency_chat.py rather than
reimplementing SSE parsing, so the load test and the single-shot latency
benchmark measure the same thing the same way. A load test that measures
subtly differently from the baseline it is compared against is worse than
no load test.

Reports three custom timings per request:
  connect  to the `conversation` event (fires before retrieval and before
           any Gemini call, so it isolates queueing)
  ttft     to the first `token` event
  total    to `done`

`connect` is the interesting one under load: it should stay flat until the
Starlette threadpool saturates at 40 concurrent streams, then rise sharply.

Run (see LOADTEST.md for the full ramp plan and the approval it needs):

    locust -f evals/locustfile.py --host http://localhost:8000
    locust -f evals/locustfile.py --host http://localhost:8000 \
           --headless -u 10 -r 2 -t 60s
"""

import sys
from pathlib import Path

import httpx
from locust import HttpUser, between, events, task

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from evals.common import EVALS_DIR, load_eval_set  # noqa: E402
from evals.latency_chat import one_request  # noqa: E402

AGENT_ID_FILE = EVALS_DIR / ".eval_agent_id"


def _load_agent_id() -> str:
    if not AGENT_ID_FILE.exists():
        raise RuntimeError(
            "No benchmark agent. Run: python evals/setup_eval_agent.py"
        )
    return AGENT_ID_FILE.read_text(encoding="utf-8").strip()


QUESTIONS = [q.question for q in load_eval_set()]


class ChatUser(HttpUser):
    # A real visitor reads the reply before asking again. Zero think time
    # would measure how fast Locust can spam, not how the endpoint behaves
    # under a plausible number of simultaneous conversations.
    wait_time = between(2, 5)

    def on_start(self) -> None:
        self.agent_id = _load_agent_id()
        self.counter = 0
        # Locust's own self.client is a requests.Session wrapper, which has
        # no .stream() context manager. one_request needs httpx, and using
        # the same client type as the single-shot benchmark is the point --
        # otherwise the two are not measuring through the same transport.
        self.http = httpx.Client(timeout=120.0)

    def on_stop(self) -> None:
        self.http.close()

    @task
    def ask(self) -> None:
        message = QUESTIONS[self.counter % len(QUESTIONS)]
        self.counter += 1

        record = one_request(self.http, self.host, self.agent_id, message)

        if record["error"]:
            self._fire("total", record["total_ms"] or 0, record["error"])
            return

        for name, field in (("connect", "connect_ms"),
                            ("ttft", "ttft_ms"),
                            ("total", "total_ms")):
            if record[field] is not None:
                self._fire(name, record[field], None)

    def _fire(self, name: str, ms: float, error: str | None) -> None:
        events.request.fire(
            request_type="SSE",
            name=name,
            response_time=ms,
            response_length=0,
            exception=Exception(error) if error else None,
            context={},
        )
