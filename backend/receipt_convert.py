"""
Converts an uploaded receipt file (image, PDF, OXPS, or other) into a list of
PNG image paths ready to hand to a vision model for extraction.

Replaces the old pytesseract+regex pipeline: instead of extracting raw text
with traditional OCR and then pattern-matching it, we render every format
down to images and let a vision-capable model (GLM-OCR or Claude) read them
directly, the same way a person would look at the receipt.
"""
import shutil
from pathlib import Path
from typing import List

import fitz  # PyMuPDF — handles PDF and OXPS/XPS natively
from PIL import Image

RENDER_DPI = 200

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".webp"}
FITZ_EXTENSIONS = {".pdf", ".oxps", ".xps"}


def file_to_images(src_path: Path, out_dir: Path) -> List[Path]:
    """
    Returns a list of PNG image paths representing every page of the source
    file, in order. Raises ValueError for genuinely unsupported formats.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    ext = src_path.suffix.lower()

    if ext in IMAGE_EXTENSIONS:
        # Normalize to PNG so downstream code only deals with one format
        dst = out_dir / f"{src_path.stem}.png"
        img = Image.open(src_path).convert("RGB")
        img.save(dst, "PNG")
        return [dst]

    if ext in FITZ_EXTENSIONS:
        doc = fitz.open(src_path)
        pages = []
        for i, page in enumerate(doc):
            pix = page.get_pixmap(dpi=RENDER_DPI)
            dst = out_dir / f"{src_path.stem}_p{i}.png"
            pix.save(dst)
            pages.append(dst)
        doc.close()
        if not pages:
            raise ValueError(f"'{src_path.name}' has no pages to render")
        return pages

    if ext in {".doc", ".docx"}:
        # Convert to PDF via LibreOffice, then render that
        import subprocess
        result = subprocess.run(
            ["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", str(out_dir), str(src_path)],
            capture_output=True, text=True, timeout=60,
        )
        if result.returncode != 0:
            raise ValueError(f"Could not convert '{src_path.name}': {result.stderr}")
        pdf_path = out_dir / f"{src_path.stem}.pdf"
        return file_to_images(pdf_path, out_dir)

    raise ValueError(
        f"Unsupported file type '{ext}'. Supported: images (jpg/png/etc), PDF, OXPS/XPS, DOC/DOCX."
    )
