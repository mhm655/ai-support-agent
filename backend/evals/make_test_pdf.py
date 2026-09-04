"""
Builds a multi-page text PDF from the eval corpus, for the ingestion
latency benchmark.

Written by hand rather than with reportlab because the backend has no PDF
writer dependency and this benchmark should not add one just to generate
its own fixture. pypdf (already a dependency) reads it back, which is the
only consumer that matters -- document_parsing.extract_text is what runs
against it.

The output is a *text* PDF, not a scanned one. That distinction matters
for the benchmark: pypdf extracts text from this in milliseconds, whereas
a scanned image PDF would yield no text at all and fail upload with the
"scanned/image PDF" error rather than being slow. So these numbers
describe the good case.

Usage:  python evals/make_test_pdf.py [pages]
"""

import sys
import textwrap
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from evals.common import CORPUS_DIR, EVALS_DIR  # noqa: E402

LINES_PER_PAGE = 52
CHARS_PER_LINE = 88
FONT_SIZE = 10
LEADING = 13


def _escape(text: str) -> str:
    return (
        text.replace("\\", r"\\")
        .replace("(", r"\(")
        .replace(")", r"\)")
    )


def _page_stream(lines: list[str]) -> bytes:
    parts = [f"BT /F1 {FONT_SIZE} Tf {LEADING} TL 50 750 Td"]
    for line in lines:
        parts.append(f"({_escape(line)}) Tj T*")
    parts.append("ET")
    return "\n".join(parts).encode("latin-1", errors="replace")


def build_pdf(lines: list[str]) -> bytes:
    pages = [lines[i:i + LINES_PER_PAGE]
             for i in range(0, len(lines), LINES_PER_PAGE)]

    objects: list[bytes] = []          # 1-indexed on output
    n_pages = len(pages)
    # Object layout: 1 catalog, 2 pages tree, 3 font,
    # then per page: page object and content stream.
    page_obj_ids = [4 + 2 * i for i in range(n_pages)]
    content_ids = [5 + 2 * i for i in range(n_pages)]

    kids = " ".join(f"{pid} 0 R" for pid in page_obj_ids)
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(
        f"<< /Type /Pages /Kids [{kids}] /Count {n_pages} >>".encode()
    )
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    for page_lines, cid in zip(pages, content_ids):
        objects.append(
            (
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                "/Resources << /Font << /F1 3 0 R >> >> "
                f"/Contents {cid} 0 R >>"
            ).encode()
        )
        stream = _page_stream(page_lines)
        objects.append(
            b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n"
            + stream + b"\nendstream"
        )

    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for i, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"

    xref_pos = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for off in offsets[1:]:
        out += f"{off:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_pos}\n%%EOF\n"
    ).encode()
    return bytes(out)


def main() -> int:
    target_pages = int(sys.argv[1]) if len(sys.argv) > 1 else 12

    lines: list[str] = []
    for path in sorted(CORPUS_DIR.glob("*.md")):
        for raw in path.read_text(encoding="utf-8").splitlines():
            raw = raw.replace("#", "").strip()
            if not raw:
                lines.append("")
                continue
            lines.extend(textwrap.wrap(raw, CHARS_PER_LINE) or [""])

    needed = target_pages * LINES_PER_PAGE
    while len(lines) < needed:
        lines.extend(lines[: needed - len(lines)])
    lines = lines[:needed]

    pdf = build_pdf(lines)
    out = EVALS_DIR / "fixtures" / f"benchmark_{target_pages}pages.pdf"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(pdf)

    # Verify with the exact parser production uses, so a malformed PDF
    # fails here rather than silently skewing the ingestion benchmark.
    from app.services.document_parsing import extract_text

    text = extract_text(out.name, pdf)
    print(f"Wrote {out}")
    print(f"  {target_pages} pages, {len(pdf):,} bytes")
    print(f"  pypdf extracted {len(text.split()):,} words, "
          f"{len(text):,} chars")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
