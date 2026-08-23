import io

from fastapi import HTTPException, status
from pypdf import PdfReader


def extract_text(filename: str, content: bytes) -> str:
    """
    Pulls raw text out of an uploaded file. Add more branches here as you
    support more formats (docx via python-docx, etc.) — this is the one
    place that needs to change to add a new file type.
    """
    lower = filename.lower()

    if lower.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(content))
        text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
    elif lower.endswith((".txt", ".md")):
        text = content.decode("utf-8", errors="ignore")
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Upload a PDF, .txt, or .md file.",
        )

    text = text.strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Couldn't extract any text from this file (it may be a scanned/image PDF).",
        )
    return text
