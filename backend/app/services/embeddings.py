from functools import lru_cache

from google import genai
from google.genai import types

from app.core.config import settings
from app.core.supabase_client import CLIENT_TIMEOUT_SECONDS

EMBEDDING_MODEL = "gemini-embedding-2"
EMBEDDING_DIMENSIONS = 1536  # matches the `vector(1536)` column in document_chunks

# How many chunks go in one embed_content request.
#
# The API limits how many inputs a single request may carry; the SDK does
# not, so an oversized batch fails server-side and takes the whole document
# with it. That is not a corner case here: the upload limit is 10MB, and at
# 800-word chunks a large PDF produces thousands of them, so "one request
# for every chunk" reliably failed for exactly the documents most worth
# ingesting -- and failed quietly, since process_document catches, marks the
# row 'failed' and logs. 100 is well under any published cap and keeps each
# request's payload modest.
EMBEDDING_BATCH_SIZE = 100


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
    Embeds every chunk, batching them across as few requests as the API
    allows — far faster and cheaper than one call per chunk, without the
    all-or-nothing failure of trying to send them all at once.

    Returns one vector per input, in input order.
    """
    if not texts:
        return []

    client = get_genai_client()
    vectors: list[list[float]] = []
    for start in range(0, len(texts), EMBEDDING_BATCH_SIZE):
        response = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=texts[start:start + EMBEDDING_BATCH_SIZE],
            config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIMENSIONS),
        )
        vectors.extend(embedding.values for embedding in response.embeddings)
    return vectors


def embed_query(text: str) -> list[float]:
    return embed_texts([text])[0]
