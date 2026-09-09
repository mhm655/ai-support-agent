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


def delete_document(storage_path: str) -> None:
    """
    Removes a stored file, called when its document row is deleted.

    Without this the bucket keeps every file ever uploaded, including for
    documents the dashboard no longer shows. Those are invisible, count
    against the storage quota forever, and mean a customer asking for
    their data to be deleted does not actually get that.
    """
    supabase = get_supabase()
    supabase.storage.from_(BUCKET).remove([storage_path])
