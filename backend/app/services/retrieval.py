from app.core.supabase_client import get_supabase
from app.services.embeddings import embed_query


def retrieve_relevant_chunks(query: str, agent_id: str, match_count: int = 5) -> list[str]:
    """
    Embeds the incoming question and calls the match_chunks Postgres
    function (defined in your schema SQL) to find the most similar
    document chunks for this specific agent via pgvector cosine distance.
    """
    query_embedding = embed_query(query)
    supabase = get_supabase()
    result = supabase.rpc(
        "match_chunks",
        {
            "query_embedding": query_embedding,
            "match_agent_id": agent_id,
            "match_count": match_count,
        },
    ).execute()
    return [row["content"] for row in result.data]
