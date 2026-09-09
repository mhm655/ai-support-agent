from unittest.mock import MagicMock

from app.services import embeddings


def test_embed_texts_returns_empty_list_for_empty_input():
    assert embeddings.embed_texts([]) == []


def test_embed_texts_calls_gemini_with_correct_dimensionality(monkeypatch):
    fake_embedding = MagicMock(values=[0.1] * embeddings.EMBEDDING_DIMENSIONS)
    fake_response = MagicMock(embeddings=[fake_embedding, fake_embedding])
    fake_client = MagicMock()
    fake_client.models.embed_content.return_value = fake_response

    monkeypatch.setattr(embeddings, "get_genai_client", lambda: fake_client)

    result = embeddings.embed_texts(["chunk one", "chunk two"])

    assert len(result) == 2
    assert all(len(vec) == embeddings.EMBEDDING_DIMENSIONS for vec in result)

    _, kwargs = fake_client.models.embed_content.call_args
    assert kwargs["model"] == embeddings.EMBEDDING_MODEL
    assert kwargs["contents"] == ["chunk one", "chunk two"]
    assert kwargs["config"].output_dimensionality == embeddings.EMBEDDING_DIMENSIONS


def test_embed_query_returns_single_vector(monkeypatch):
    fake_embedding = MagicMock(values=[0.5, 0.6, 0.7])
    fake_response = MagicMock(embeddings=[fake_embedding])
    fake_client = MagicMock()
    fake_client.models.embed_content.return_value = fake_response

    monkeypatch.setattr(embeddings, "get_genai_client", lambda: fake_client)

    result = embeddings.embed_query("a single chunk")

    assert result == [0.5, 0.6, 0.7]


# The batch size is patched down to a small number in the tests below rather
# than used to size their input. Deriving test data from the production
# constant means a change to that constant silently changes how much memory
# the test allocates -- at one point this file built a list of two billion
# strings and took the machine down with it. A test should exercise the
# batching *logic*, which does not care what the real value is.
TEST_BATCH_SIZE = 4


def _recording_client(monkeypatch):
    """Returns (client, calls) where calls records the contents of each request."""
    calls = []

    def embed_content(*, model, contents, config):
        calls.append(list(contents))
        # Echo each input back as its own vector so ordering stays checkable.
        return MagicMock(embeddings=[MagicMock(values=[float(t)]) for t in contents])

    client = MagicMock()
    client.models.embed_content = embed_content
    monkeypatch.setattr(embeddings, "get_genai_client", lambda: client)
    monkeypatch.setattr(embeddings, "EMBEDDING_BATCH_SIZE", TEST_BATCH_SIZE)
    return client, calls


def test_large_input_is_split_across_requests_in_order(monkeypatch):
    """
    A 10MB upload chunks into far more pieces than one embed_content request
    may carry. Sending them all at once failed server-side and took the whole
    document with it -- quietly, since process_document catches, marks the row
    'failed' and logs.
    """
    _, calls = _recording_client(monkeypatch)

    count = TEST_BATCH_SIZE * 2 + 3  # two full batches and a partial one
    result = embeddings.embed_texts([str(i) for i in range(count)])

    assert len(calls) == 3, "expected three requests, not one oversized one"
    assert all(len(c) <= TEST_BATCH_SIZE for c in calls)
    # One vector per input, still in input order.
    assert [v[0] for v in result] == [float(i) for i in range(count)]


def test_input_at_the_batch_size_stays_one_request(monkeypatch):
    _, calls = _recording_client(monkeypatch)

    embeddings.embed_texts([str(i) for i in range(TEST_BATCH_SIZE)])

    assert len(calls) == 1


def test_batch_size_is_a_sane_constant():
    """
    Guards the value itself. It was briefly 10**9, which defeats batching
    entirely -- one request for every chunk, the bug this exists to prevent.
    """
    assert 1 <= embeddings.EMBEDDING_BATCH_SIZE <= 1000
