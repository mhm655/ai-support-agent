import logging

from app.core.supabase_client import get_supabase
from app.services.chunking import chunk_text
from app.services.document_parsing import extract_text
from app.services.embeddings import embed_texts

logger = logging.getLogger(__name__)


def process_document(document_id: str, filename: str, content: bytes) -> None:
    """
    The actual RAG ingestion pipeline: extract text -> chunk -> embed ->
    store. Runs as a FastAPI BackgroundTask (see documents.py router) so
    the upload request returns immediately instead of the user waiting
    for embedding calls to finish.

    This is intentionally synchronous/in-process rather than a real task
    queue (Celery, RQ) — fine for MVP scale. If documents get large or
    uploads get frequent, that's the natural next upgrade, not a rewrite.
    """
    supabase = get_supabase()

    try:
        text = extract_text(filename, content)
        chunks = chunk_text(text)

        if not chunks:
            _mark_status(document_id, "failed")
            return

        embeddings = embed_texts(chunks)

        rows = [
            {"document_id": document_id, "content": chunk, "embedding": embedding}
            for chunk, embedding in zip(chunks, embeddings)
        ]
        supabase.table("document_chunks").insert(rows).execute()

        _mark_status(document_id, "done")
    except Exception:
        logger.exception("Document processing failed for document_id=%s", document_id)
        _mark_status(document_id, "failed")


def _mark_status(document_id: str, status: str) -> None:
    get_supabase().table("documents").update({"status": status}).eq("id", document_id).execute()
