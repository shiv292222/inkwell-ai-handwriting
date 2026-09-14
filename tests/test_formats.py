import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from docx import Document
from pypdf import PdfReader

from inkwell.engine import RenderOptions, generate_document


LONG_TEXT = "# Biology revision\n\n- Cells are the basic unit of life.\n- DNA stores genetic information.\n\n" * 90


class FormatTests(unittest.TestCase):
    def test_real_pdf_has_matching_page_count(self):
        with tempfile.TemporaryDirectory() as temp:
            doc, files = generate_document(LONG_TEXT, Path(temp) / "notes.pdf", options=RenderOptions(dpi=96))
            reader = PdfReader(files[0])
            self.assertEqual(len(reader.pages), len(doc.pages))
            self.assertGreater(files[0].stat().st_size, 10_000)

    def test_real_docx_has_one_page_image_per_rendered_page(self):
        with tempfile.TemporaryDirectory() as temp:
            doc, files = generate_document(LONG_TEXT, Path(temp) / "notes.docx", options=RenderOptions(dpi=96))
            parsed = Document(files[0])
            self.assertEqual(len(parsed.inline_shapes), len(doc.pages))
            with zipfile.ZipFile(files[0]) as archive:
                media = [name for name in archive.namelist() if name.startswith("word/media/")]
            self.assertEqual(len(media), len(doc.pages))

    def test_extension_is_added(self):
        with tempfile.TemporaryDirectory() as temp:
            _, files = generate_document("hello", Path(temp) / "notes", "pdf", RenderOptions(dpi=96))
            self.assertEqual(files[0].suffix, ".pdf")

    def test_rejects_lossy_jpeg(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(ValueError, "degrades"):
                generate_document("hello", Path(temp) / "notes.jpg", options=RenderOptions(dpi=96))


if __name__ == "__main__":
    unittest.main()

