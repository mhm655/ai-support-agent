from app.services.chunking import chunk_text


def test_empty_text_returns_no_chunks():
    assert chunk_text("") == []
    assert chunk_text("   ") == []


def test_short_text_returns_single_chunk():
    text = "one two three four five"
    chunks = chunk_text(text, chunk_size=800, overlap=150)
    assert chunks == [text]


def test_long_text_splits_into_overlapping_chunks():
    # 1000 distinct words so we can tell exactly which ones land where
    words = [f"word{i}" for i in range(1000)]
    text = " ".join(words)

    chunks = chunk_text(text, chunk_size=800, overlap=150)

    assert len(chunks) == 2
    first_words = chunks[0].split()
    second_words = chunks[1].split()
    assert len(first_words) == 800
    # second chunk starts at 800 - 150 = 650, so it re-includes the last
    # 150 words of the first chunk before continuing to the end
    assert second_words[0] == "word650"
    assert second_words[-1] == "word999"
    assert len(second_words) == 1000 - 650


def test_chunks_cover_every_word_with_no_gap():
    words = [f"w{i}" for i in range(50)]
    text = " ".join(words)

    chunks = chunk_text(text, chunk_size=20, overlap=5)

    # every word must appear in at least one chunk, in order
    seen = set()
    for chunk in chunks:
        seen.update(chunk.split())
    assert seen == set(words)
