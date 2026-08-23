import uuid

from app.core.supabase_client import get_supabase

BUCKET = "documents"


def upload_document(agent_id: str, filename: str, content: bytes) -> str:
    """
    Uploads a file to the 'documents' Supabase Storage bucket, namespaced
    by agent so files from different agents never collide, and returns
    the storage path (not a public URL — this bucket should be private,
    accessed only via the backend's service-role key).

    Requires a bucket named exactly "documents" to exist in Supabase
    Storage — see SETUP.md for how to create it.
    """
    supabase = get_supabase()
    # A random prefix avoids overwriting a file if two uploads share a
    # filename for the same agent.
    storage_path = f"{agent_id}/{uuid.uuid4()}-{filename}"
    supabase.storage.from_(BUCKET).upload(
        storage_path,
        content,
        file_options={"content-type": "application/octet-stream"},
    )
    return storage_path
