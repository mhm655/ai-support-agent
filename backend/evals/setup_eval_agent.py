"""
Creates (or reuses) a throwaway agent loaded with the benchmark corpus,
so the latency benchmarks have something real to retrieve against.

Everything it creates is named with the BENCHMARK_PREFIX below and can be
removed with:

    python evals/setup_eval_agent.py --teardown

This talks to Supabase with the service-role key, the same client the
backend uses, so it bypasses RLS. It writes to whatever project your
backend/.env points at -- which for this repo is production. Nothing here
touches rows it did not create.

Usage:
    python evals/setup_eval_agent.py            # create + ingest
    python evals/setup_eval_agent.py --status   # show what exists
    python evals/setup_eval_agent.py --teardown # delete it all
"""

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.supabase_client import get_supabase  # noqa: E402
from app.services.chunking import chunk_text  # noqa: E402
from app.services.embeddings import embed_texts  # noqa: E402
from evals.common import EVALS_DIR, load_corpus  # noqa: E402

BENCHMARK_PREFIX = "ZZ-BENCHMARK"
AGENT_NAME = f"{BENCHMARK_PREFIX} Brightleaf Dental (safe to delete)"
AGENT_ID_FILE = EVALS_DIR / ".eval_agent_id"


def find_agent() -> dict | None:
    result = (
        get_supabase().table("agents").select("*").eq("name", AGENT_NAME).limit(1).execute()
    )
    return result.data[0] if result.data else None


def create_agent() -> dict:
    supabase = get_supabase()

    businesses = supabase.table("businesses").select("id, name").limit(1).execute()
    if not businesses.data:
        raise SystemExit(
            "No business rows exist. Sign up through the app first so a "
            "business exists to own the benchmark agent."
        )
    business = businesses.data[0]
    print(f"  attaching to business {business['name']} ({business['id']})")

    result = (
        supabase.table("agents")
        .insert(
            {
                "business_id": business["id"],
                "name": AGENT_NAME,
                "personality": "Warm, brief, factual.",
                "instructions": (
                    "Answer only from the provided context. This agent exists "
                    "purely for latency benchmarking and can be deleted."
                ),
            }
        )
        .execute()
    )
    return result.data[0]


def ingest(agent_id: str) -> None:
    """
    Loads the corpus using the same chunk -> embed -> insert sequence as
    rag_pipeline.process_document.

    It does not call process_document itself only because that reads a
    file through document_parsing and marks document status; here the
    corpus is already text. The chunking and embedding calls are the
    identical production functions.
    """
    supabase = get_supabase()
    corpus = load_corpus()

    for filename, text in sorted(corpus.items()):
        existing = (
            supabase.table("documents")
            .select("id")
            .eq("agent_id", agent_id)
            .eq("filename", filename)
            .execute()
        )
        if existing.data:
            print(f"  {filename}: already ingested, skipping")
            continue

        document = (
            supabase.table("documents")
            .insert(
                {
                    "agent_id": agent_id,
                    "filename": filename,
                    "storage_path": f"benchmark/{agent_id}/{filename}",
                    "status": "pending",
                }
            )
            .execute()
        ).data[0]

        chunks = chunk_text(text)
        start = time.perf_counter()
        embeddings = embed_texts(chunks)
        elapsed = time.perf_counter() - start

        supabase.table("document_chunks").insert(
            [
                {"document_id": document["id"], "content": chunk, "embedding": emb}
                for chunk, emb in zip(chunks, embeddings)
            ]
        ).execute()
        supabase.table("documents").update({"status": "done"}).eq(
            "id", document["id"]
        ).execute()

        print(f"  {filename}: {len(chunks)} chunks, embedded in {elapsed:.2f}s")
        # Stay clear of the 100 embeds/minute free-tier ceiling.
        time.sleep(2)


def teardown() -> int:
    supabase = get_supabase()
    agent = find_agent()
    if not agent:
        print("Nothing to remove: no benchmark agent found.")
        AGENT_ID_FILE.unlink(missing_ok=True)
        return 0

    docs = (
        supabase.table("documents").select("id").eq("agent_id", agent["id"]).execute()
    ).data
    convs = (
        supabase.table("conversations").select("id").eq("agent_id", agent["id"]).execute()
    ).data

    print(f"Removing benchmark agent {agent['id']}")
    print(f"  {len(docs)} documents, {len(convs)} conversations")

    # document_chunks and messages cascade from documents/conversations,
    # and documents/conversations/leads cascade from the agent, but they
    # are deleted explicitly so the counts above are verifiable.
    for doc in docs:
        supabase.table("document_chunks").delete().eq("document_id", doc["id"]).execute()
    supabase.table("documents").delete().eq("agent_id", agent["id"]).execute()
    for conv in convs:
        supabase.table("messages").delete().eq("conversation_id", conv["id"]).execute()
    supabase.table("conversations").delete().eq("agent_id", agent["id"]).execute()
    supabase.table("leads").delete().eq("agent_id", agent["id"]).execute()
    supabase.table("agents").delete().eq("id", agent["id"]).execute()

    AGENT_ID_FILE.unlink(missing_ok=True)
    print("Done. Nothing benchmark-related remains.")
    return 0


def status() -> int:
    supabase = get_supabase()
    agent = find_agent()
    if not agent:
        print("No benchmark agent exists.")
        return 0
    docs = (
        supabase.table("documents").select("id, filename, status")
        .eq("agent_id", agent["id"]).execute()
    ).data
    total = 0
    for doc in docs:
        n = (
            supabase.table("document_chunks").select("id", count="exact")
            .eq("document_id", doc["id"]).execute()
        ).count or 0
        total += n
    print(f"Benchmark agent: {agent['id']}")
    print(f"  {len(docs)} documents, {total} chunks")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--teardown", action="store_true")
    parser.add_argument("--status", action="store_true")
    args = parser.parse_args()

    if args.teardown:
        return teardown()
    if args.status:
        return status()

    agent = find_agent()
    if agent:
        print(f"Reusing existing benchmark agent {agent['id']}")
    else:
        print("Creating benchmark agent")
        agent = create_agent()
        print(f"  created {agent['id']}")

    ingest(agent["id"])
    AGENT_ID_FILE.write_text(agent["id"], encoding="utf-8")
    print(f"\nAgent id written to {AGENT_ID_FILE}")
    print(f"  {agent['id']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
