import pytest
from fastapi import HTTPException

from app.services.document_parsing import extract_text


def test_extracts_text_from_txt():
    content = b"Business hours are 9am to 5pm."
    assert extract_text("hours.txt", content) == "Business hours are 9am to 5pm."


def test_extracts_text_from_md():
    content = b"# Policies\n\nRefunds within 30 days."
    result = extract_text("policies.md", content)
    assert "Refunds within 30 days." in result


def test_strips_surrounding_whitespace():
    result = extract_text("notes.txt", b"   padded text   \n")
    assert result == "padded text"


def test_rejects_unsupported_file_type():
    with pytest.raises(HTTPException) as exc_info:
        extract_text("resume.docx", b"whatever")
    assert exc_info.value.status_code == 400
    assert "Unsupported file type" in exc_info.value.detail


def test_rejects_empty_file():
    with pytest.raises(HTTPException) as exc_info:
        extract_text("empty.txt", b"   ")
    assert exc_info.value.status_code == 400
    assert "extract any text" in exc_info.value.detail
