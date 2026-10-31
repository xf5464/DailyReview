import hashlib
import json
import os
import sys
from pathlib import Path

source = Path(sys.argv[1])
target = Path(sys.argv[2])
data = source.read_bytes()
mode = sys.argv[3] if len(sys.argv) > 3 else "plain"
engine = sys.argv[4] if len(sys.argv) > 4 else "auto"
native = None
if mode == "plain" and engine != "pypdf":
    try:
        import pymupdf
        native = pymupdf
    except ImportError:
        pass
if native:
    with native.open(source) as reader:
        pages = [{"page": index + 1, "text": page.get_text("text", sort=True) or ""} for index, page in enumerate(reader)]
    used_engine = "pymupdf-text-" + native.VersionBind
else:
    from pypdf import PdfReader
    reader = PdfReader(source)
    pages = [{"page": index + 1, "text": (page.extract_text(extraction_mode="layout") if mode == "layout" else page.extract_text()) or ""} for index, page in enumerate(reader.pages)]
    used_engine = "pypdf"
if not any(page["text"].strip() for page in pages):
    raise ValueError("PDF contains no extractable disclosure text")
temporary = target.with_name(target.name + f".{os.getpid()}.tmp")
temporary.write_text(json.dumps({"pdfSha256": hashlib.sha256(data).hexdigest(), "extractionMode": mode, "extractionEngine": used_engine, "pages": pages}, ensure_ascii=False), encoding="utf-8")

os.replace(temporary, target)
