"""
Retrieval eval harness for the RAG pipeline.

Runs every question in the golden set through the real chunker and the
real embedding model, ranks the corpus, and scores the result against the
labelled answer span.

Usage
-----
    python evals/retrieval_eval.py                  # production config only
    python evals/retrieval_eval.py --sweep          # all chunk configs
    python evals/retrieval_eval.py --sweep --task-type
    python evals/retrieval_eval.py --failures       # list what missed

Metrics
-------
recall@k        Fraction of questions where at least one chunk containing
                the answer span appears in the top k. This is the number
                that matters for RAG: the generator needs the answer to be
                somewhere in the context, and it does not care whether the
                second copy of it also made the cut. Reported as the
                headline figure.

strict_recall@k The textbook definition, |relevant AND retrieved| divided
                by |relevant|, averaged over questions. Differs from
                recall@k only where overlap put the answer span in two
                adjacent chunks and only one was retrieved.

precision@k     |relevant AND retrieved| / k, averaged. NOTE the ceiling:
                nearly every question has exactly one chunk containing its
                span, so the best achievable precision@3 is 0.333 and
                precision@5 is 0.200. Read it against that ceiling, not
                against 1.0. It is reported because it is asked for, but
                on a single-answer eval set it carries almost no
                information that recall@k does not.

MRR             Mean reciprocal rank of the first relevant chunk. Sensitive
                to ordering in a way recall@k is not: it separates "the
                answer was ranked first" from "the answer scraped in at
                position five".

context_words@k Mean total words across the k retrieved chunks. Not a
                quality metric, a cost one. Recall can always be bought by
                making chunks bigger, and this is the column that shows
                what that purchase cost in prompt size.
"""

import argparse
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from evals.common import (  # noqa: E402
    PRODUCTION_CONFIG,
    chunk_corpus_with_headings,
    RESULTS_DIR,
    SWEEP_CONFIGS,
    ChunkConfig,
    Question,
    chunk_corpus,
    embed_cached,
    load_corpus,
    load_eval_set,
    rank_chunks,
    relevant_chunk_indices,
    write_json,
)

K_VALUES = (3, 5)


def evaluate(
    cfg: ChunkConfig,
    corpus: dict[str, str],
    questions: list[Question],
    task_type: str | None = None,
    verbose: bool = True,
    headings: bool = False,
) -> dict:
    if verbose:
        print(f"\n  config {cfg.label}"
              + ("  +headings" if headings else "")
              + (f"  task_type={task_type}" if task_type else ""))

    chunks = (chunk_corpus_with_headings(corpus, cfg) if headings
              else chunk_corpus(corpus, cfg))
    if verbose:
        print(f"    {len(chunks)} chunks")

    doc_task = "RETRIEVAL_DOCUMENT" if task_type else None
    query_task = "RETRIEVAL_QUERY" if task_type else None

    chunk_vectors = embed_cached([c.embedding_input for c in chunks], doc_task,
                                 verbose=verbose)
    query_vectors = embed_cached([q.question for q in questions], query_task,
                                 verbose=verbose)

    per_question = []
    orphans = []

    for question, qvec in zip(questions, query_vectors):
        relevant = set(relevant_chunk_indices(question, chunks))
        if not relevant:
            # The span was split across every chunk boundary at this config.
            # Unreachable regardless of embedding quality; recorded, not scored.
            orphans.append(question.id)
            continue

        ranking = rank_chunks(qvec, chunk_vectors)

        first_rank = next(
            (pos + 1 for pos, idx in enumerate(ranking) if idx in relevant),
            None,
        )

        row = {
            "id": question.id,
            "type": question.type,
            "question": question.question,
            "doc": question.doc,
            "n_relevant": len(relevant),
            "first_relevant_rank": first_rank,
            "rr": 1.0 / first_rank if first_rank else 0.0,
            "top1_doc": chunks[ranking[0]].doc,
        }

        for k in K_VALUES:
            topk = ranking[:k]
            found = relevant.intersection(topk)
            row[f"hit@{k}"] = 1 if found else 0
            row[f"strict_recall@{k}"] = len(found) / len(relevant)
            row[f"precision@{k}"] = len(found) / k
            row[f"context_words@{k}"] = sum(
                len(chunks[i].text.split()) for i in topk
            )

        per_question.append(row)

    n = len(per_question)
    summary = {
        "config": cfg.label,
        "chunk_size": cfg.chunk_size,
        "overlap": cfg.overlap,
        "task_type": task_type,
        "headings": headings,
        "n_chunks": len(chunks),
        "n_questions_scored": n,
        "orphaned_questions": orphans,
        "mrr": _mean(r["rr"] for r in per_question),
    }
    for k in K_VALUES:
        summary[f"recall@{k}"] = _mean(r[f"hit@{k}"] for r in per_question)
        summary[f"strict_recall@{k}"] = _mean(r[f"strict_recall@{k}"]
                                              for r in per_question)
        summary[f"precision@{k}"] = _mean(r[f"precision@{k}"] for r in per_question)
        # The best precision@k physically achievable on this eval set: a
        # question whose span sits in only one chunk cannot exceed 1/k no
        # matter how good the retriever is. Overlap puts a few spans in two
        # adjacent chunks, which lifts the ceiling above a flat 1/k, so it
        # is computed rather than assumed.
        summary[f"precision_ceiling@{k}"] = _mean(
            min(r["n_relevant"], k) / k for r in per_question
        )
        summary[f"context_words@{k}"] = _mean(r[f"context_words@{k}"]
                                              for r in per_question)

    return {"summary": summary, "per_question": per_question}


def _mean(values) -> float:
    values = list(values)
    return sum(values) / len(values) if values else 0.0


def wilson_interval(successes: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """
    95% Wilson score interval for a proportion.

    At n=40 the interval on a recall around 90% is roughly plus or minus
    9 points. Without this printed next to it, a 2.5 point gap between two
    configs reads as an improvement when it is one question changing its
    mind. The normal approximation is not usable this close to 1.0, which
    is why this is Wilson rather than Wald.
    """
    if n == 0:
        return (0.0, 0.0)
    p = successes / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    margin = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return (max(0.0, centre - margin), min(1.0, centre + margin))


def mcnemar_exact(b: int, c: int) -> float:
    """
    Two-sided exact McNemar p-value for two configs scored on the same
    questions.

    b and c are the discordant counts: questions config A got right and B
    got wrong, and the reverse. Concordant questions carry no information
    about which config is better and are correctly ignored. Paired testing
    matters here because the two configs are evaluated on identical
    questions, so treating their scores as independent samples throws away
    most of the statistical power and would widen every comparison.
    """
    n = b + c
    if n == 0:
        return 1.0
    # Under H0 each discordant question is a fair coin flip.
    total = 2 ** n
    tail = sum(math.comb(n, i) for i in range(0, min(b, c) + 1))
    return min(1.0, 2.0 * tail / total)


def compare_configs(results: list[dict], k: int = 5) -> None:
    """Paired comparison of every config against the production default."""
    by_label = {
        r["summary"]["config"]
        + ("+hdr" if r["summary"].get("headings") else "")
        + ("+asym" if r["summary"]["task_type"] else ""): r
        for r in results
    }
    base_label = PRODUCTION_CONFIG.label
    if base_label not in by_label:
        return

    base = {r["id"]: r[f"hit@{k}"] for r in by_label[base_label]["per_question"]}

    print(f"\nPaired comparison against production {base_label}, at k={k}")
    print("(b = fixed by the new config, c = broken by it; "
          "p from exact McNemar)\n")
    print(f"  {'config':>14} {'R@' + str(k):>7} {'delta':>7} "
          f"{'b':>3} {'c':>3} {'p':>7}  verdict")

    for label, result in by_label.items():
        hits = {r["id"]: r[f"hit@{k}"] for r in result["per_question"]}
        shared = set(base) & set(hits)
        b = sum(1 for i in shared if hits[i] and not base[i])
        c = sum(1 for i in shared if base[i] and not hits[i])
        recall = result["summary"][f"recall@{k}"]
        delta = recall - by_label[base_label]["summary"][f"recall@{k}"]
        p = mcnemar_exact(b, c)
        if label == base_label:
            verdict = "baseline"
        elif p < 0.05:
            verdict = "significant"
        else:
            verdict = "not distinguishable"
        print(f"  {label:>14} {recall:>6.1%} {delta:>+6.1%} "
              f"{b:>3} {c:>3} {p:>7.3f}  {verdict}")


def print_table(results: list[dict]) -> None:
    header = (
        f"{'config':>10} {'task':>5} {'chunks':>7} "
        f"{'R@3':>7} {'R@5':>7} {'R@5 95% CI':>16} {'MRR':>7} "
        f"{'P@3':>14} {'P@5':>14} {'ctx@5':>7}"
    )
    print("\n" + header)
    print("-" * len(header))
    for r in results:
        s = r["summary"]
        task = ("hdr" if s.get("headings") else
                "asym" if s["task_type"] else "prod")
        p3 = f"{s['precision@3']:.1%}/{s['precision_ceiling@3']:.1%}"
        p5 = f"{s['precision@5']:.1%}/{s['precision_ceiling@5']:.1%}"
        n = s["n_questions_scored"]
        lo, hi = wilson_interval(round(s["recall@5"] * n), n)
        ci = f"[{lo:.0%}, {hi:.0%}]"
        print(
            f"{s['config']:>10} {task:>5} {s['n_chunks']:>7} "
            f"{s['recall@3']:>6.1%} {s['recall@5']:>6.1%} {ci:>16} {s['mrr']:>7.3f} "
            f"{p3:>14} {p5:>14} "
            f"{s['context_words@5']:>7.0f}"
        )
    print("\nP@k shown as achieved/ceiling. The ceiling is set by the eval set,")
    print("not the retriever: most spans sit in exactly one chunk, so P@5")
    print("cannot exceed about 20% however good retrieval is.")
    print("ctx@5 = mean words fed to the generator at k=5 (cost, not quality).")


def print_failures(result: dict, k: int = 5) -> None:
    s = result["summary"]
    misses = [r for r in result["per_question"] if not r[f"hit@{k}"]]
    print(f"\n  Misses at k={k} for config {s['config']}: "
          f"{len(misses)}/{s['n_questions_scored']}")
    for r in misses:
        rank = r["first_relevant_rank"]
        where = f"rank {rank}" if rank else "not ranked in corpus"
        print(f"    {r['id']} [{r['type']}] {r['question']}")
        print(f"         answer chunk at {where}; "
              f"top hit came from {r['top1_doc']}")

    weak = [r for r in result["per_question"]
            if r[f"hit@{k}"] and r["first_relevant_rank"] > 2]
    if weak:
        print(f"\n  Scraped in at rank 3-{k} (would fail at a smaller k):")
        for r in weak:
            print(f"    {r['id']} rank {r['first_relevant_rank']}: {r['question']}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sweep", action="store_true",
                        help="run every chunk config, not just production")
    parser.add_argument("--task-type", action="store_true",
                        help="also run each config with asymmetric "
                             "RETRIEVAL_DOCUMENT/RETRIEVAL_QUERY embeddings")
    parser.add_argument("--headings", action="store_true",
                        help="also run each config with document/section "
                             "headings prefixed to the embedding input")
    parser.add_argument("--failures", action="store_true",
                        help="list the questions that missed")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    corpus = load_corpus()
    questions = load_eval_set()
    verbose = not args.quiet

    print(f"Corpus:   {len(corpus)} docs, "
          f"{sum(len(t.split()) for t in corpus.values()):,} words")
    print(f"Eval set: {len(questions)} questions")

    configs = SWEEP_CONFIGS if args.sweep else [PRODUCTION_CONFIG]

    results = []
    for cfg in configs:
        results.append(evaluate(cfg, corpus, questions, None, verbose))
    if args.task_type:
        for cfg in configs:
            results.append(
                evaluate(cfg, corpus, questions, "RETRIEVAL_DOCUMENT", verbose)
            )
    if args.headings:
        for cfg in configs:
            results.append(
                evaluate(cfg, corpus, questions, None, verbose, headings=True)
            )

    print_table(results)
    compare_configs(results)

    if args.failures:
        for r in results:
            print_failures(r)

    out = RESULTS_DIR / ("sweep.json" if args.sweep else "baseline.json")
    write_json(out, [r for r in results])
    print(f"\nWrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
