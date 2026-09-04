"""
Sanity-checks the golden eval set before it is used to produce numbers.

An eval set that has not been validated is worse than no eval set: a
mislabelled span silently becomes an unreachable answer, and the score
you report is measuring your typo rather than your retriever.

Four checks:

1. Every answer_span appears verbatim in the document it is attributed to.
2. No answer_span appears in a second document, which would make the
   ground truth ambiguous (a "wrong" doc could legitimately contain it).
3. Question ids are unique.
4. For each chunk config under test, at least one chunk contains the whole
   span. A span that straddles a chunk boundary is unreachable at that
   config no matter how good the embeddings are -- that is a real property
   of the config, but it needs to be visible rather than silently scored
   as a retrieval failure.

Run:  python -m evals.validate_eval_set
"""

import sys
from pathlib import Path

# Allow `python evals/validate_eval_set.py` as well as `-m evals.validate_eval_set`
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from evals.common import (  # noqa: E402
    SWEEP_CONFIGS,
    ChunkConfig,
    load_corpus,
    load_eval_set,
    normalize,
)


def main() -> int:
    corpus = load_corpus()
    questions = load_eval_set()

    norm_docs = {name: normalize(text) for name, text in corpus.items()}
    failures: list[str] = []

    print(f"Corpus:    {len(corpus)} documents, "
          f"{sum(len(t.split()) for t in corpus.values()):,} words")
    print(f"Eval set:  {len(questions)} questions\n")

    # --- check 3: unique ids -------------------------------------------
    seen: set[str] = set()
    for q in questions:
        if q.id in seen:
            failures.append(f"{q.id}: duplicate question id")
        seen.add(q.id)

    # --- checks 1 and 2: span present, and present only once -----------
    for q in questions:
        if q.doc not in norm_docs:
            failures.append(f"{q.id}: doc {q.doc!r} not found in corpus")
            continue

        span = normalize(q.answer_span)

        if span not in norm_docs[q.doc]:
            failures.append(
                f"{q.id}: answer_span NOT found verbatim in {q.doc}\n"
                f"        span: {q.answer_span[:90]!r}"
            )
            continue

        others = [name for name, text in norm_docs.items()
                  if name != q.doc and span in text]
        if others:
            failures.append(
                f"{q.id}: answer_span is ambiguous, also appears in {others}"
            )

    if failures:
        print("FAILED\n")
        for f in failures:
            print("  " + f)
        return 1

    print("All spans present, unambiguous, and ids unique.\n")

    # --- check 4: span survives chunking at each config ----------------
    print("Span reachability per chunk config")
    print("(a span split across a boundary cannot be retrieved at that config)\n")
    print(f"  {'config':>12}  {'chunks':>6}  {'reachable':>9}  orphaned")

    for cfg in SWEEP_CONFIGS:
        chunks = build_chunks(corpus, cfg)
        norm_chunks = [normalize(c.text) for c in chunks]
        orphans = [
            q.id for q in questions
            if not any(normalize(q.answer_span) in nc for nc in norm_chunks)
        ]
        reachable = len(questions) - len(orphans)
        label = ", ".join(orphans) if orphans else "-"
        print(f"  {cfg.label:>12}  {len(chunks):>6}  "
              f"{reachable:>4}/{len(questions):<4}  {label}")

    return 0


def build_chunks(corpus: dict[str, str], cfg: ChunkConfig):
    from evals.common import chunk_corpus
    return chunk_corpus(corpus, cfg)


if __name__ == "__main__":
    raise SystemExit(main())
