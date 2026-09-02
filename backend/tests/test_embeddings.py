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
