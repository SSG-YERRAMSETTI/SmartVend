from pathlib import Path
import subprocess
import tempfile
from PIL import Image
import pytesseract
import sys

def make_searchable_pdf(src_pdf: Path, dst_pdf: Path):
    """
    Run ocrmypdf to make a searchable PDF.

    IMPORTANT: we must NOT pass both --force-ocr and --skip-text.
    We'll just use --force-ocr so every page is OCR'd.
    """
    dst_pdf.parent.mkdir(parents=True, exist_ok=True)

    # You can change flags later, but NEVER combine --force-ocr with --skip-text
    cmd = [
        "ocrmypdf",
        "--force-ocr",        # always OCR all pages
        "--optimize", "1",
        str(src_pdf),
        str(dst_pdf),
    ]

    # capture_output=True is useful for debugging if something goes wrong
    result = subprocess.run(cmd, check=False, capture_output=True, text=True)

    if result.returncode != 0:
        # Log the error and fall back to using the original PDF without OCR
        print("ERROR running ocrmypdf:", result.stderr)
        # fallback: just copy src to dst so downstream code has a file
        dst_pdf.write_bytes(src_pdf.read_bytes())


def extract_text_from_pdf(pdf_path: Path) -> str:
    """
    Use pdfminer.six to extract text from a (searchable) PDF.

    IMPORTANT: Use sys.executable so we call the same Python that has pdfminer installed
    (your venv), not the global Python 3.13.
    """
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as tmp:
        out_txt = tmp.name

    cmd = [
        sys.executable,  # python from your .venv
        "-m",
        "pdfminer.high_level",
        str(pdf_path),
        "-o",
        out_txt,
    ]

    result = subprocess.run(cmd, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        print("ERROR running pdfminer:", result.stderr)
        return ""

    return Path(out_txt).read_text(encoding="utf-8", errors="ignore")


def extract_text_from_image(img_path: Path) -> str:
    img = Image.open(img_path)
    text = pytesseract.image_to_string(img, lang="eng")
    return text


def extract_text_from_email(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def extract_text_any(path: Path, searchable_dir: Path) -> str:
    """
    Main entry: choose extraction based on file extension.
    - PDF  → ocrmypdf + pdfminer
    - image → pytesseract
    - text/eml/html → read as text
    """
    ext = path.suffix.lower()

    if ext == ".pdf":
        dst = searchable_dir / path.name
        make_searchable_pdf(path, dst)
        return extract_text_from_pdf(dst)

    elif ext in [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"]:
        return extract_text_from_image(path)

    elif ext in [".txt", ".eml", ".html", ".htm"]:
        return extract_text_from_email(path)

    else:
        # Fallback: treat unknown extensions as text
        return extract_text_from_email(path)
