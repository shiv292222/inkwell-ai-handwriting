import hashlib
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from inkwell.engine import MAX_TEXT_LENGTH, RenderOptions, generate_document, render_pages


class EngineTests(unittest.TestCase):
    def test_rejects_empty_text(self):
        with self.assertRaisesRegex(ValueError, "non-empty"):
            render_pages("  ")

    def test_rejects_oversized_text(self):
        with self.assertRaisesRegex(ValueError, "character limit"):
            render_pages("x" * (MAX_TEXT_LENGTH + 1))

    def test_validates_options(self):
        bad = [
            RenderOptions(paper="legal"), RenderOptions(paper_style="dots"),
            RenderOptions(font="fake"), RenderOptions(ink="blue"),
            RenderOptions(font_size=9), RenderOptions(variation=1.1),
            RenderOptions(dpi=72), RenderOptions(margin_mm=3),
            RenderOptions(line_spacing=1),
        ]
        for options in bad:
            with self.subTest(options=options), self.assertRaises(ValueError):
                render_pages("hello", options)

    def test_is_deterministic(self):
        opts = RenderOptions(seed="fixed", dpi=96)
        first = render_pages("The same words every time", opts).pages[0].tobytes()
        second = render_pages("The same words every time", opts).pages[0].tobytes()
        self.assertEqual(hashlib.sha256(first).digest(), hashlib.sha256(second).digest())

    def test_different_seeds_change_pixels(self):
        first = render_pages("Seeded natural variation", RenderOptions(seed="a", dpi=96)).pages[0].tobytes()
        second = render_pages("Seeded natural variation", RenderOptions(seed="b", dpi=96)).pages[0].tobytes()
        self.assertNotEqual(hashlib.sha256(first).digest(), hashlib.sha256(second).digest())

    def test_words_do_not_overlap_on_a_line(self):
        text = "A deliberately crowded line with WWW wide words and iii narrow words " * 3
        doc = render_pages(text, RenderOptions(variation=1, dpi=150, font_size=26))
        groups = {}
        for placement in doc.placements:
            groups.setdefault((placement.page, placement.line), []).append(placement)
        for key, placements in groups.items():
            ordered = sorted(placements, key=lambda value: value.box[0])
            for left, right in zip(ordered, ordered[1:]):
                with self.subTest(line=key, left=left.text, right=right.text):
                    self.assertLessEqual(left.box[2], right.box[0])

    def test_all_words_remain_inside_page(self):
        doc = render_pages("safe bounds " * 500, RenderOptions(dpi=96, variation=1))
        width, height = doc.pages[0].size
        for placement in doc.placements:
            x1, y1, x2, y2 = placement.box
            self.assertGreaterEqual(x1, 0)
            self.assertGreaterEqual(y1, 0)
            self.assertLessEqual(x2, width)
            self.assertLessEqual(y2, height)

    def test_long_unbroken_word_wraps(self):
        doc = render_pages("W" * 500, RenderOptions(dpi=96))
        self.assertGreater(len({p.line for p in doc.placements}), 1)

    def test_markdown_headings_and_bullets_render(self):
        doc = render_pages("# Topic\n\n- first\n- second\n## Detail", RenderOptions(dpi=96))
        words = " ".join(item.text for item in doc.placements)
        self.assertIn("Topic", words)
        self.assertIn("first", words)

    def test_paginates_large_input(self):
        doc = render_pages("one two three four five six seven eight nine ten\n" * 250, RenderOptions(dpi=96))
        self.assertGreater(len(doc.pages), 2)

    def test_paper_sizes_have_expected_order(self):
        a5 = render_pages("x", RenderOptions(paper="a5", dpi=96)).pages[0]
        a4 = render_pages("x", RenderOptions(paper="a4", dpi=96)).pages[0]
        letter = render_pages("x", RenderOptions(paper="letter", dpi=96)).pages[0]
        self.assertLess(a5.width, a4.width)
        self.assertGreater(letter.width, a4.width)

    def test_custom_title_is_rendered(self):
        doc = render_pages("body", RenderOptions(title="My title", dpi=96))
        self.assertEqual(doc.placements[0].text, "My")

    def test_png_export_creates_numbered_pages(self):
        with tempfile.TemporaryDirectory() as temp:
            doc, files = generate_document("hello", Path(temp) / "pages", "png", RenderOptions(dpi=96))
            self.assertEqual(len(doc.pages), len(files))
            self.assertEqual(files[0].name, "page-01.png")
            self.assertTrue(files[0].is_file())


if __name__ == "__main__":
    unittest.main()

