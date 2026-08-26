from functools import lru_cache

from google import genai
from google.genai import types

from app.core.config import settings
from app.core.supabase_client import CLIENT_TIMEOUT_SECONDS

EMBEDDING_MODEL = "gemini-embedding-2"
EMBEDDING_DIMENSIONS = 1536  # matches the `vector(1536)` column in document_chunks


@lru_cache
def get_genai_client() -> genai.Client:
    # See the comment on CLIENT_TIMEOUT_SECONDS in supabase_client.py -- same
    # failure mode applies here: an unbounded Gemini call inside the sync
    # generator StreamingResponse runs in a thread pool can hold that thread
    # forever. HttpOptions.timeout is milliseconds, unlike Supabase's seconds.
    return genai.Client(
        api_key=settings.gemini_api_key,
        http_options=types.HttpOptions(timeout=CLIENT_TIMEOUT_SECONDS * 1000),
    )


def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Batches all chunks into a single API call rather than one call per
    chunk — much faster and cheaper. Gemini's embed_content endpoint
    accepts a list of inputs natively.
    """
    if not texts:
        return []
    client = get_genai_client()
    response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=texts,
        config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIMENSIONS),
    )
    return [embedding.values for embedding in response.embeddings]


def embed_query(text: str) -> list[float]:
    return embed_texts([text])[0]
