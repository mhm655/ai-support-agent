"""
Shared plumbing for the retrieval evals.

Everything here that touches chunking or embedding calls the real
production code in app.services rather than reimplementing it, so the
numbers describe the shipped pipeline and not a copy of it that has
drifted.

The one deliberate substitution is the similarity search itself: this
module ranks chunks with exact cosine similarity in process, where
production ranks them with the match_chunks RPC against a pgvector
IVFFlat index. See EVALS.md for why, and for the cross-check that
measures how far apart the two actually are.
"""

import hashlib
import json
import math
import os
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.chunking import chunk_text  # noqa: E402

EVALS_DIR = Path(__file__).resolve().parent
CORPUS_DIR = EVALS_DIR / "corpus"
CACHE_DIR = EVALS_DIR / ".embedding_cache"
RESULTS_DIR = EVALS_DIR / "results"


@dataclass(frozen=True)
class ChunkConfig:
    chunk_size: int
    overlap: int

    @property
    def label(self) -> str:
        return f"{self.chunk_size}/{self.overlap}"


# The production default is the first entry. chunking.chunk_text signature:
# chunk_text(text, chunk_size=800, overlap=150)
PRODUCTION_CONFIG = ChunkConfig(800, 150)

SWEEP_CONFIGS = [
    ChunkConfig(800, 150),   # production default
    ChunkConfig(600, 120),
    ChunkConfig(400, 80),
    ChunkConfig(300, 60),
    ChunkConfig(200, 40),
    ChunkConfig(400, 0),     # isolates the contribution of overlap
    ChunkConfig(400, 160),   # heavy overlap, 40 percent
]


@dataclass(frozen=True)
class Chunk:
    doc: str
    index: int
    text: str
    # What actually gets embedded. Defaults to `text`; the heading
    # experiment sets it to a context-prefixed variant while leaving
    # `text` -- the thing stored and later handed to the generator --
    # untouched. Keeping these separate is what makes the experiment a
    # clean single-variable comparison: chunk boundaries, relevance
    # labels and retrieved context size are all identical to baseline,
    # and only the vector changes.
    embed_text: str | None = None

    @property
    def embedding_input(self) -> str:
        return self.embed_text if self.embed_text is not None else self.text


@dataclass(frozen=True)
class Question:
    id: str
    question: str
    doc: str
    answer_span: str
    type: str


def normalize(text: str) -> str:
    """
    Collapse all whitespace to single spaces.

    chunk_text does `text.split()` then `" ".join(...)`, so chunks always
    come back single-spaced while the source documents are hard-wrapped.
    Both sides of every containment check go through this so a line break
    in the source never causes a spurious miss.
    """
    return " ".join(text.split())


def load_corpus() -> dict[str, str]:
    docs = {}
    for path in sorted(CORPUS_DIR.glob("*.md")):
        docs[path.name] = path.read_text(encoding="utf-8")
    if not docs:
        raise RuntimeError(f"No corpus documents found in {CORPUS_DIR}")
    return docs


def load_eval_set() -> list[Question]:
    data = json.loads((EVALS_DIR / "eval_set.json").read_text(encoding="utf-8"))
    return [Question(**q) for q in data["questions"]]


def _heading_map(text: str) -> tuple[str, list[tuple[int, str]]]:
    """
    Maps word offsets to the markdown heading in force at that offset.

    Returns the document H1 plus a list of (word_index, h2_text) pairs.
    Word offsets are counted the same way chunk_text counts them --
    `str.split()` over the whole document -- so the indices line up with
    chunk boundaries exactly.
    """
    h1 = ""
    h2s: list[tuple[int, str]] = []
    word_index = 0

    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("## "):
            h2s.append((word_index, stripped[3:].strip()))
        elif stripped.startswith("# ") and not h1:
            h1 = stripped[2:].strip()
        word_index += len(line.split())

    return h1, h2s


def chunk_corpus_with_headings(
    corpus: dict[str, str], cfg: ChunkConfig
) -> list[Chunk]:
    """
    Same chunk boundaries as chunk_corpus, but each chunk's *embedding
    input* is prefixed with the document title and every section heading
    the chunk covers.

    The motivation came out of the baseline failure analysis: misses
    clustered on questions whose answer sits under a heading whose wording
    does not match how a customer would ask. "What if a filling you placed
    breaks" lives under a *guarantees* heading, and the chunk body never
    says "guarantee" near the relevant sentence. Prefixing puts that word
    into the vector.

    Boundaries are recomputed here rather than taken from chunk_text so
    the start offset of each chunk is known; the stepping arithmetic is
    kept identical to chunking.chunk_text and is checked against it in
    the assertion below.
    """
    chunks: list[Chunk] = []

    for name, text in sorted(corpus.items()):
        produced = chunk_text(text, cfg.chunk_size, cfg.overlap)
        h1, h2s = _heading_map(text)
        words = text.split()

        start = 0
        for i, body in enumerate(produced):
            end = start + cfg.chunk_size

            # Every section the chunk actually covers: the heading in
            # force where it starts, plus any that begin inside it.
            #
            # Using only the heading at the start is wrong for large
            # chunks. At 800 words a chunk spans several sections, so the
            # start heading is frequently not the one describing the text
            # that answers the question -- the policies.md chunk holding
            # the treatment guarantee starts under "Records and privacy".
            # That would prefix the misleading heading and could plausibly
            # hurt rather than help.
            covering = ""
            spanned: list[str] = []
            for offset, title in h2s:
                if offset <= start:
                    covering = title
                elif offset < end:
                    spanned.append(title)
                else:
                    break

            sections: list[str] = []
            for title in ([covering] if covering else []) + spanned:
                if title not in sections:
                    sections.append(title)

            label = " - ".join(
                part for part in ([h1] + sections) if part
            )
            prefix = f"{label}\n\n" if label else ""

            chunks.append(
                Chunk(doc=name, index=i, text=body, embed_text=prefix + body)
            )

            if end >= len(words):
                break
            start = end - cfg.overlap

    # The boundaries must match chunk_corpus exactly, or the comparison
    # against baseline stops being paired and the McNemar test is invalid.
    baseline = chunk_corpus(corpus, cfg)
    assert [c.text for c in chunks] == [c.text for c in baseline], (
        "heading-prefixed chunking drifted from chunk_text boundaries"
    )
    return chunks


def chunk_corpus(corpus: dict[str, str], cfg: ChunkConfig) -> list[Chunk]:
    """
    Chunks each document independently, which is what rag_pipeline does:
    process_document is called per uploaded file, so chunks never span
    two documents.
    """
    chunks: list[Chunk] = []
    for name, text in sorted(corpus.items()):
        for i, piece in enumerate(chunk_text(text, cfg.chunk_size, cfg.overlap)):
            chunks.append(Chunk(doc=name, index=i, text=piece))
    return chunks


# --------------------------------------------------------------------------
# Embedding, with a disk cache
# --------------------------------------------------------------------------

def _cache_key(text: str, task_type: str | None) -> str:
    from app.services.embeddings import EMBEDDING_DIMENSIONS, EMBEDDING_MODEL

    payload = f"{EMBEDDING_MODEL}|{EMBEDDING_DIMENSIONS}|{task_type or 'none'}|{text}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


# Gemini free tier allows 100 embed_content requests per minute for
# gemini-embedding-2, and each *text* inside a batch counts against it
# rather than each HTTP call -- confirmed by hitting the 429 with only
# seven batched calls in flight. Pace below the limit and leave headroom.
EMBED_RATE_LIMIT_PER_MIN = 90
_embed_times: list[float] = []


def _throttle(n: int, verbose: bool) -> None:
    """Blocks until n more embeddings fit inside the rolling minute."""
    import time

    while True:
        now = time.monotonic()
        _embed_times[:] = [t for t in _embed_times if now - t < 60.0]
        if len(_embed_times) + n <= EMBED_RATE_LIMIT_PER_MIN:
            return
        wait = 60.0 - (now - _embed_times[0]) + 0.5
        if verbose:
            print(f"    rate limit: waiting {wait:.0f}s "
                  f"({len(_embed_times)}/{EMBED_RATE_LIMIT_PER_MIN} used)")
        time.sleep(max(wait, 1.0))


def embed_cached(
    texts: list[str],
    task_type: str | None = None,
    batch_size: int = 30,
    verbose: bool = True,
) -> list[list[float]]:
    """
    Embeds texts, reading and writing a content-addressed disk cache.

    The sweep re-embeds the same corpus at seven chunk configs and the
    same 40 questions every run. Without the cache that is a few thousand
    redundant Gemini calls per iteration, which on a free tier key is the
    difference between an eval you can rerun freely and one you run once
    and then avoid touching.

    task_type=None reproduces production exactly: app.services.embeddings
    .embed_texts sets no task type, so documents and queries are embedded
    the same way. A non-None value goes through the client directly and is
    an experiment, not current behaviour.
    """
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    results: list[list[float] | None] = [None] * len(texts)
    pending: list[tuple[int, str]] = []

    for i, text in enumerate(texts):
        path = CACHE_DIR / f"{_cache_key(text, task_type)}.json"
        if path.exists():
            results[i] = json.loads(path.read_text())
        else:
            pending.append((i, text))

    if pending and verbose:
        print(f"    embedding {len(pending)} new / {len(texts)} total "
              f"({len(texts) - len(pending)} cached)")

    for start in range(0, len(pending), batch_size):
        batch = pending[start:start + batch_size]
        _throttle(len(batch), verbose)
        vectors = _embed_with_retry([t for _, t in batch], task_type, verbose)
        for (i, text), vector in zip(batch, vectors):
            results[i] = vector
            # Written per vector, so an interrupted or rate-limited run
            # keeps everything it already paid for and resumes cheaply.
            path = CACHE_DIR / f"{_cache_key(text, task_type)}.json"
            path.write_text(json.dumps(vector))

    missing = [i for i, r in enumerate(results) if r is None]
    if missing:
        raise RuntimeError(f"Embedding failed for indices {missing}")
    return results  # type: ignore[return-value]


def _embed_with_retry(
    texts: list[str],
    task_type: str | None,
    verbose: bool,
    attempts: int = 5,
) -> list[list[float]]:
    """
    Retries on 429, honouring the retryDelay Gemini returns.

    The throttle above should keep us under the limit, but the quota is
    per project rather than per process, so a dev server or a second eval
    run can still push us over it.
    """
    import re
    import time

    for attempt in range(attempts):
        try:
            vectors = _embed_raw(texts, task_type)
            _embed_times.extend([time.monotonic()] * len(texts))
            return vectors
        except Exception as exc:  # noqa: BLE001 - re-raised below
            message = str(exc)
            if "RESOURCE_EXHAUSTED" not in message and "429" not in message:
                raise
            if attempt == attempts - 1:
                raise
            match = re.search(r"retryDelay['\"]?:\s*['\"]?(\d+)", message)
            wait = int(match.group(1)) + 2 if match else 30 * (attempt + 1)
            if verbose:
                print(f"    429 from Gemini, retrying in {wait}s "
                      f"(attempt {attempt + 1}/{attempts})")
            time.sleep(wait)
            _embed_times.clear()

    raise RuntimeError("unreachable")


def _embed_raw(texts: list[str], task_type: str | None) -> list[list[float]]:
    if task_type is None:
        # The exact production path.
        from app.services.embeddings import embed_texts
        return embed_texts(texts)

    from google.genai import types

    from app.services.embeddings import (
        EMBEDDING_DIMENSIONS,
        EMBEDDING_MODEL,
        get_genai_client,
    )

    response = get_genai_client().models.embed_content(
        model=EMBEDDING_MODEL,
        contents=texts,
        config=types.EmbedContentConfig(
            output_dimensionality=EMBEDDING_DIMENSIONS,
            task_type=task_type,
        ),
    )
    return [e.values for e in response.embeddings]


# --------------------------------------------------------------------------
# Similarity and metrics
# --------------------------------------------------------------------------

def cosine(a: list[float], b: list[float]) -> float:
    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / math.sqrt(na * nb)


def rank_chunks(
    query_vector: list[float],
    chunk_vectors: list[list[float]],
) -> list[int]:
    """Indices of all chunks, best match first."""
    scored = [(cosine(query_vector, cv), i) for i, cv in enumerate(chunk_vectors)]
    scored.sort(key=lambda pair: (-pair[0], pair[1]))
    return [i for _, i in scored]


def relevant_chunk_indices(question: Question, chunks: list[Chunk]) -> list[int]:
    """
    Every chunk that fully contains the answer span.

    Usually one, but overlap means an answer sitting near a boundary can
    legitimately appear in two adjacent chunks, and both are correct
    retrievals. Counting only one of them would understate precision.
    """
    span = normalize(question.answer_span)
    return [i for i, c in enumerate(chunks) if span in normalize(c.text)]


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
