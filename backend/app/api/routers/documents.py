from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, status

from app.core.security import CurrentBusinessIdDep
from app.core.supabase_client import get_supabase
from app.schemas.document import DocumentResponse
from app.services.rag_pipeline import process_document
from app.services.storage import upload_document

router = APIRouter(tags=["documents"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB — generous for text/PDF docs, keeps costs predictable


def _assert_owns_agent(agent_id: str, business_id: str) -> None:
    supabase = get_supabase()
    result = (
        supabase.table("agents")
        .select("id")
        .eq("id", agent_id)
        .eq("business_id", business_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")


@router.post(
    "/agents/{agent_id}/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_agent_document(
    agent_id: str,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    business_id: CurrentBusinessIdDep,
) -> DocumentResponse:
    _assert_owns_agent(agent_id, business_id)

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large (max 10MB)",
        )

    storage_path = upload_document(agent_id, file.filename, content)

    supabase = get_supabase()
    result = (
        supabase.table("documents")
        .insert(
            {
                "agent_id": agent_id,
                "filename": file.filename,
                "storage_path": storage_path,
                "status": "pending",
            }
        )
        .execute()
    )
    document = result.data[0]

    # Returns to the caller immediately; embedding happens after the
    # response is sent. The frontend should poll GET /documents to see
    # the status flip from "pending" to "done" (or "failed").
    background_tasks.add_task(process_document, document["id"], file.filename, content)

    return document


@router.get("/agents/{agent_id}/documents", response_model=list[DocumentResponse])
async def list_agent_documents(agent_id: str, business_id: CurrentBusinessIdDep) -> list[DocumentResponse]:
    _assert_owns_agent(agent_id, business_id)
    supabase = get_supabase()
    result = (
        supabase.table("documents")
        .select("*")
        .eq("agent_id", agent_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: str, business_id: CurrentBusinessIdDep) -> None:
    supabase = get_supabase()
    # Ownership check via join: does this document belong to an agent
    # that belongs to this business?
    doc = supabase.table("documents").select("agent_id").eq("id", document_id).limit(1).execute()
    if not doc.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    _assert_owns_agent(doc.data[0]["agent_id"], business_id)

    # document_chunks rows are cleaned up too, since they reference this
    # document_id and the DB schema doesn't currently cascade-delete —
    # do it explicitly to avoid orphaned embeddings.
    supabase.table("document_chunks").delete().eq("document_id", document_id).execute()
    supabase.table("documents").delete().eq("id", document_id).execute()
