"""
Runs the real FastAPI app with Gemini and Supabase replaced by fakes, for
level L1 of the load test (see LOADTEST.md).

The point of L1 is to measure a property of *this codebase* -- the
Starlette threadpool ceiling on synchronous streaming generators -- rather
than a property of Google's free tier or of the network. Both external
dependencies are therefore replaced with stubs that sleep for a fixed,
realistic duration, so per-request time is deterministic and the ceiling
shows up as a clean inflection instead of being buried in vendor variance.

Production code is not modified. This patches at import time, in a
separate process, and nothing here is importable by the app itself.

    python evals/loadtest_server.py --port 8001
    locust -f evals/locustfile.py --host http://localhost:8001

Sleep durations default to the medians actually measured on this project
(see EVALS.md), so the simulated request has a realistic shape.
"""

import argparse
import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def install_stubs(embed_s: float, decide_s: float,
                  stream_s: float, supabase_s: float) -> None:
    from app.services import chat_service, retrieval

    class FakeResponse:
        """Mimics the parts of the genai response chat_service reads."""

        def __init__(self, text: str = "") -> None:
            self.text = text
            self.function_calls = []

    class FakeClient:
        class models:
            @staticmethod
            def generate_content(**_kwargs):
                time.sleep(decide_s)
                return FakeResponse()

            @staticmethod
            def generate_content_stream(**_kwargs):
                # Emit tokens over the same wall-clock span a real reply
                # takes, so time-to-first-token and total stay distinct.
                n = 24
                for _ in range(n):
                    time.sleep(stream_s / n)
                    yield FakeResponse("word ")

    def fake_retrieve(query, agent_id, match_count=5):
        time.sleep(embed_s + supabase_s)
        return [f"Stubbed context chunk {i} for load testing." for i in range(match_count)]

    class FakeTable:
        def __init__(self, name):
            self.name = name

        def insert(self, rows):
            self._rows = rows if isinstance(rows, list) else [rows]
            return self

        def select(self, *_a, **_k):
            self._rows = []
            return self

        def update(self, *_a, **_k):
            self._rows = []
            return self

        def delete(self):
            self._rows = []
            return self

        def eq(self, *_a, **_k):
            return self

        def order(self, *_a, **_k):
            return self

        def limit(self, *_a, **_k):
            return self

        def execute(self):
            time.sleep(supabase_s)
            rows = getattr(self, "_rows", [])
            if self.name == "conversations":
                return type("R", (), {"data": [{"id": str(uuid.uuid4())}]})()
            return type("R", (), {"data": rows or []})()

    class FakeSupabase:
        def table(self, name):
            return FakeTable(name)

    chat_service.get_genai_client = lambda: FakeClient()
    chat_service.get_supabase = lambda: FakeSupabase()
    retrieval.retrieve_relevant_chunks = fake_retrieve
    chat_service.retrieve_relevant_chunks = fake_retrieve

    # public_chat looks the agent up before streaming; give it one.
    from app.api.routers import public_chat

    class AgentSupabase(FakeSupabase):
        def table(self, name):
            table = FakeTable(name)
            if name == "agents":
                table.execute = lambda: type("R", (), {"data": [{
                    "id": "loadtest-agent",
                    "name": "Load Test Agent",
                    "personality": "Brief.",
                    "instructions": "Stubbed.",
                }]})()
            return table

    public_chat.get_supabase = lambda: AgentSupabase()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8001)
    parser.add_argument("--embed-s", type=float, default=0.15)
    parser.add_argument("--decide-s", type=float, default=0.8)
    parser.add_argument("--stream-s", type=float, default=1.2)
    parser.add_argument("--supabase-s", type=float, default=0.02,
                        help="per Supabase round trip; default assumes a "
                             "colocated backend, not a home connection")
    args = parser.parse_args()

    install_stubs(args.embed_s, args.decide_s, args.stream_s, args.supabase_s)

    import uvicorn

    from app.main import app

    print(f"Stubbed app on :{args.port} -- Gemini and Supabase are fakes.")
    print(f"  embed {args.embed_s}s | decide {args.decide_s}s | "
          f"stream {args.stream_s}s | supabase {args.supabase_s}s x5")
    print(f"  expected per-request time ~"
          f"{args.embed_s + args.decide_s + args.stream_s + args.supabase_s * 5:.2f}s")
    print("  any agent id works; the agent lookup is stubbed too")
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
