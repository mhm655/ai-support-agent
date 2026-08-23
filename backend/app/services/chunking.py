def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> list[str]:
    """
    Splits text into overlapping word-based chunks.

    Why overlap: if a sentence containing the answer to a customer's
    question gets cut exactly at a chunk boundary, the chunk on either
    side alone might lose the context. Overlap means that sentence is
    likely to appear whole in at least one chunk.

    chunk_size/overlap are word counts, not characters or tokens — simple
    and good enough for MVP. If retrieval quality becomes an issue later,
    a token-aware splitter (tiktoken) or a sentence-boundary-aware
    splitter would be the next upgrade, not a full rewrite.
    """
    words = text.split()
    if not words:
        return []

    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        if end >= len(words):
            break
        start = end - overlap  # step forward, but re-include the overlap

    return chunks
