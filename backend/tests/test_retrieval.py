from unittest.mock import MagicMock

from app.services import retrieval


def test_retrieve_relevant_chunks_embeds_query_and_calls_match_chunks_rpc(monkeypatch):
    monkeypatch.setattr(retrieval, "embed_query", lambda text: [0.1, 0.2, 0.3])

    fake_supabase = MagicMock()
    fake_supabase.rpc.return_value.execute.return_value = MagicMock(
        data=[{"content": "chunk A"}, {"content": "chunk B"}]
    )
    monkeypatch.setattr(retrieval, "get_supabase", lambda: fake_supabase)

    result = retrieval.retrieve_relevant_chunks("do you accept Cigna?", "agent-1", match_count=3)

    assert result == ["chunk A", "chunk B"]
    fake_supabase.rpc.assert_called_once_with(
        "match_chunks",
        {
            "query_embedding": [0.1, 0.2, 0.3],
            "match_agent_id": "agent-1",
            "match_count": 3,
        },
    )


def test_retrieve_relevant_chunks_returns_empty_list_when_no_matches(monkeypatch):
    monkeypatch.setattr(retrieval, "embed_query", lambda text: [0.1])
    fake_supabase = MagicMock()
    fake_supabase.rpc.return_value.execute.return_value = MagicMock(data=[])
    monkeypatch.setattr(retrieval, "get_supabase", lambda: fake_supabase)

    result = retrieval.retrieve_relevant_chunks("irrelevant question", "agent-1")

    assert result == []
