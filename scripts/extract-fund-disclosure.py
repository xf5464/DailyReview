import hashlib
import json
import os
import sys
from pathlib import Path
from pypdf import PdfReader

source = Path(sys.argv[1])
target = Path(sys.argv[2])
data = source.read_bytes()
reader = PdfReader(source)
mode = sys.argv[3] if len(sys.argv) > 3 else "plain"
pages = [{"page": index + 1, "text": (page.extract_text(extraction_mode="layout") if mode == "layout" else page.extract_text()) or ""} for index, page in enumerate(reader.pages)]
if not any(page["text"].strip() for page in pages):
    raise ValueError("PDF contains no extractable disclosure text")
temporary = target.with_name(target.name + f".{os.getpid()}.tmp")
temporary.write_text(json.dumps({"pdfSha256": hashlib.sha256(data).hexdigest(), "extractionMode": mode, "pages": pages}, ensure_ascii=False), encoding="utf-8")

os.replace(temporary, target)
