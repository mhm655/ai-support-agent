"""
Tests for the documents router.

Covers the two failure modes the happy path never showed: an upload big
enough to matter, and what a delete leaves behind in Storage.

On sizes: MAX_FILE_SIZE and UPLOAD_READ_CHUNK are patched down to bytes
here instead of allocating real 10MB payloads. The behaviour under test is
"does the guard hold while reading", which is independent of the real
limit, and pushing tens of megabytes through the multipart parser on every
run is a cost with no matching benefit -- worse, a failing assertion then
asks pytest to render those buffers.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.api.routers import documents
from tests.conftest import TEST_BUSINESS_ID

AGENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
DOCUMENT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
STORAGE_PATH = f"{AGENT_ID}/abc123-handbook.pdf"

SMALL_LIMIT = 1024
SMALL_CHUNK = 256


def _supabase(data):
    mock = MagicMock()
    for name in ("table", "select", "insert", "update", "delete", "eq", "limit", "order"):
        getattr(mock, name).return_value = mock
    mock.execute.return_value = MagicMock(data=data)
    return mock


# --- upload size -----------------------------------------------------------


def test_oversized_upload_is_rejected(authed_client):
    with patch.object(documents, "MAX_FILE_SIZE", SMALL_LIMIT), \
         patch.object(documents, "UPLOAD_READ_CHUNK", SMALL_CHUNK), \
         patch.object(documents, "get_supabase", return_value=_supabase([{"id": AGENT_ID}])), \
         patch.object(documents, "upload_document") as store:
        response = authed_client.post(
            f"/agents/{AGENT_ID}/documents",
            files={"file": ("big.txt", b"x" * (SMALL_LIMIT + 1), "text/plain")},
        )

    assert response.status_code == 413
    # Rejected before anything was stored or a row was written.
    store.assert_not_called()


def test_upload_exactly_at_the_limit_is_accepted(authed_client):
    row = {
        "id": DOCUMENT_ID,
        "agent_id": AGENT_ID,
        "filename": "atlimit.txt",
        "status": "pending",
        "created_at": "2026-09-09T00:00:00Z",
    }

    with patch.object(documents, "MAX_FILE_SIZE", SMALL_LIMIT), \
         patch.object(documents, "UPLOAD_READ_CHUNK", SMALL_CHUNK), \
         patch.object(documents, "get_supabase", return_value=_supabase([row])), \
         patch.object(documents, "upload_document", return_value=STORAGE_PATH), \
         patch.object(documents, "process_document"):
        response = authed_client.post(
            f"/agents/{AGENT_ID}/documents",
            files={"file": ("atlimit.txt", b"x" * SMALL_LIMIT, "text/plain")},
        )

    # Off-by-one guard: the limit itself must be allowed, not rejected.
    assert response.status_code == 201, response.text


class _RecordingUpload:
    """
    Stands in for UploadFile, recording the size argument of every read so a
    bounded read can be told apart from `read()` with no argument.
    """

    filename = "huge.txt"

    def __init__(self, data: bytes) -> None:
        self._data = data
        self.consumed = 0
        self.read_sizes: list[int] = []

    async def read(self, size: int = -1) -> bytes:
        self.read_sizes.append(size)
        if size is None or size < 0:
            chunk = self._data[self.consumed :]
        else:
            chunk = self._data[self.consumed : self.consumed + size]
        self.consumed += len(chunk)
        return chunk


async def test_upload_is_read_in_bounded_chunks():
    """
    The size guard has to hold *while* reading, not after. Measuring an
    already-fully-read body means a file of any size sits in memory before
    anything decides to reject it, so this asserts the handler asks for
    fixed-size pieces and stops early instead of draining the upload.
    """
    from fastapi import BackgroundTasks, HTTPException

    upload = _RecordingUpload(b"x" * (SMALL_LIMIT * 3))

    with patch.object(documents, "MAX_FILE_SIZE", SMALL_LIMIT), \
         patch.object(documents, "UPLOAD_READ_CHUNK", SMALL_CHUNK), \
         patch.object(documents, "get_supabase", return_value=_supabase([{"id": AGENT_ID}])), \
         patch.object(documents, "upload_document") as store:
        with pytest.raises(HTTPException) as excinfo:
            await documents.upload_agent_document(
                AGENT_ID, upload, BackgroundTasks(), TEST_BUSINESS_ID
            )

    assert excinfo.value.status_code == 413
    # Never read() with no argument, which is the unbounded form.
    assert upload.read_sizes, "the upload was never read"
    assert all(size == SMALL_CHUNK for size in upload.read_sizes)
    # Stopped just past the limit rather than consuming everything.
    assert upload.consumed <= SMALL_LIMIT + SMALL_CHUNK
    store.assert_not_called()


def test_read_chunk_is_not_larger_than_the_limit():
    """
    If the chunk size exceeded the limit the first read would already hold
    more than the guard permits, which defeats the point of reading
    incrementally.
    """
    assert documents.UPLOAD_READ_CHUNK <= documents.MAX_FILE_SIZE


# --- delete ----------------------------------------------------------------


def test_delete_removes_the_stored_file(authed_client):
    """
    Without this the bucket keeps every file ever uploaded, invisible in the
    dashboard and counted against quota forever.
    """
    supabase = _supabase([{"agent_id": AGENT_ID, "storage_path": STORAGE_PATH}])

    with patch.object(documents, "get_supabase", return_value=supabase), \
         patch.object(documents, "delete_stored_document") as remove:
        response = authed_client.delete(f"/documents/{DOCUMENT_ID}")

    assert response.status_code == 204
    remove.assert_called_once_with(STORAGE_PATH)


def test_delete_succeeds_even_if_storage_removal_fails(authed_client):
    """
    The rows are already gone by then, so the delete the user asked for has
    happened. Failing the request would report otherwise and invite a retry
    that can no longer find the document.
    """
    supabase = _supabase([{"agent_id": AGENT_ID, "storage_path": STORAGE_PATH}])

    with patch.object(documents, "get_supabase", return_value=supabase), \
         patch.object(
             documents, "delete_stored_document", side_effect=RuntimeError("bucket down")
         ):
        response = authed_client.delete(f"/documents/{DOCUMENT_ID}")

    assert response.status_code == 204


def test_delete_of_unknown_document_is_404(authed_client):
    with patch.object(documents, "get_supabase", return_value=_supabase([])), \
         patch.object(documents, "delete_stored_document") as remove:
        response = authed_client.delete(f"/documents/{DOCUMENT_ID}")

    assert response.status_code == 404
    remove.assert_not_called()
