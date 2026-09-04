"""
Measures the document ingestion pipeline: upload -> parse -> chunk ->
embed -> store.

Times each stage of rag_pipeline.process_document separately, using the
real production functions, against generated multi-page text PDFs. The
stages are timed individually because the totals are dominated by one of
them and an undifferentiated total would hide that.

Storage upload is timed separately from processing, because in production
they are not sequential from the user's point of view: documents.py
uploads to Supabase Storage and inserts the row inside the request, then
hands processing to a BackgroundTask and returns immediately. The user
waits for the former; the document stays "pending" for the latter.

Usage:
    python evals/latency_ingest.py
    python evals/latency_ingest.py --reps 3 --pages 4 12 24
"""

import argparse
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.supabase_client import get_supabase  # noqa: E402
from app.services.chunking import chunk_text  # noqa: E402
from app.services.document_parsing import extract_text  # noqa: E402
from app.services.embeddings import embed_texts  # noqa: E402
from evals.common import EVALS_DIR, RESULTS_DIR, write_json  # noqa: E402
from evals.latency_chat import percentile  # noqa: E402

AGENT_ID_FILE = EVALS_DIR / ".eval_agent_id"
FIXTURES = EVALS_DIR / "fixtures"


def ensure_pdf(pages: int) -> Path:
    path = FIXTURES / f"benchmark_{pages}pages.pdf"
    if not path.exists():
        import subprocess

        subprocess.run(
            [sys.executable, str(EVALS_DIR / "make_test_pdf.py"), str(pages)],
            check=True,
            capture_output=True,
        )
    return path


def time_one(agent_id: str, pdf_path: Path) -> dict:
    """One full ingestion, timed by stage. Cleans up the rows it creates."""
    supabase = get_supabase()
    content = pdf_path.read_bytes()

    t0 = time.perf_counter()
    text = extract_text(pdf_path.name, content)
    t_parse = time.perf_counter() - t0

    t0 = time.perf_counter()
    chunks = chunk_text(text)
    t_chunk = time.perf_counter() - t0

    document = (
        supabase.table("documents")
        .insert(
            {
                "agent_id": agent_id,
                "filename": f"__latency_probe_{pdf_path.stem}",
                "storage_path": f"benchmark/probe/{pdf_path.name}",
                "status": "pending",
            }
        )
        .execute()
    ).data[0]

    try:
        t0 = time.perf_counter()
        embeddings = embed_texts(chunks)
        t_embed = time.perf_counter() - t0

        t0 = time.perf_counter()
        supabase.table("document_chunks").insert(
            [
                {"document_id": document["id"], "content": c, "embedding": e}
                for c, e in zip(chunks, embeddings)
            ]
        ).execute()
        t_insert = time.perf_counter() - t0

        t0 = time.perf_counter()
        supabase.table("documents").update({"status": "done"}).eq(
            "id", document["id"]
        ).execute()
        t_status = time.perf_counter() - t0
    finally:
        supabase.table("document_chunks").delete().eq(
            "document_id", document["id"]
        ).execute()
        supabase.table("documents").delete().eq("id", document["id"]).execute()

    return {
        "pages": int(pdf_path.stem.split("_")[1].replace("pages", "")),
        "bytes": len(content),
        "words": len(text.split()),
        "chunks": len(chunks),
        "parse_s": t_parse,
        "chunk_s": t_chunk,
        "embed_s": t_embed,
        "insert_s": t_insert,
        "status_s": t_status,
        "total_s": t_parse + t_chunk + t_embed + t_insert + t_status,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reps", type=int, default=3)
    parser.add_argument("--pages", type=int, nargs="+", default=[4, 12, 24])
    parser.add_argument("--primary", type=int, default=12,
                        help="page count to repeat --reps times")
    args = parser.parse_args()

    if not AGENT_ID_FILE.exists():
        raise SystemExit("Run evals/setup_eval_agent.py first.")
    agent_id = AGENT_ID_FILE.read_text(encoding="utf-8").strip()

    runs: list[dict] = []
    for pages in args.pages:
        pdf = ensure_pdf(pages)
        reps = args.reps if pages == args.primary else 1
        for rep in range(reps):
            record = time_one(agent_id, pdf)
            runs.append(record)
            print(f"  {pages:>3}pg rep{rep + 1}: "
                  f"{record['words']:>6,}w -> {record['chunks']:>2} chunks | "
                  f"parse {record['parse_s'] * 1000:>6.0f}ms  "
                  f"chunk {record['chunk_s'] * 1000:>5.1f}ms  "
                  f"embed {record['embed_s']:>5.2f}s  "
                  f"insert {record['insert_s']:>5.2f}s  "
                  f"TOTAL {record['total_s']:>5.2f}s")
            # Well under the 100 embeds/minute free-tier ceiling.
            time.sleep(3)

    print(f"\n{'pages':>6} {'words':>7} {'chunks':>7} {'parse':>9} {'chunk':>9} "
          f"{'embed':>9} {'insert':>9} {'total':>9}")
    by_pages: dict[int, list[dict]] = {}
    for r in runs:
        by_pages.setdefault(r["pages"], []).append(r)

    for pages in sorted(by_pages):
        group = by_pages[pages]
        med = {k: statistics.median(r[k] for r in group)
               for k in ("parse_s", "chunk_s", "embed_s", "insert_s", "total_s")}
        print(f"{pages:>6} {group[0]['words']:>7,} {group[0]['chunks']:>7} "
              f"{med['parse_s'] * 1000:>8.0f}m {med['chunk_s'] * 1000:>8.1f}m "
              f"{med['embed_s']:>8.2f}s {med['insert_s']:>8.2f}s "
              f"{med['total_s']:>8.2f}s")

    primary = by_pages.get(args.primary, [])
    summary = {
        "runs": runs,
        "primary_pages": args.primary,
        "primary_n": len(primary),
    }
    if primary:
        totals = [r["total_s"] for r in primary]
        summary["primary_total_s"] = {
            "min": min(totals),
            "p50": percentile(totals, 50),
            "p95": percentile(totals, 95),
            "max": max(totals),
        }
        share = statistics.median(r["embed_s"] / r["total_s"] for r in primary)
        summary["embed_share_of_total"] = share
        print(f"\n  {args.primary}-page document, n={len(primary)}: "
              f"p50 {percentile(totals, 50):.2f}s, max {max(totals):.2f}s")
        print(f"  Embedding is {share:.0%} of total ingestion time.")

    out = RESULTS_DIR / "latency_ingest.json"
    write_json(out, summary)
    print(f"\n  Wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
