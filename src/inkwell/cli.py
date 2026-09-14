from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .engine import RenderOptions, generate_document


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Create realistic handwritten PDF, Word, or PNG notes locally.")
    parser.add_argument("input", nargs="?", help="UTF-8 text/Markdown file; omit to read stdin")
    parser.add_argument("-o", "--output", default="output/handwritten-notes.pdf", help="Output .pdf/.docx path or PNG directory")
    parser.add_argument("--format", choices=("pdf", "docx", "png"), help="Override format inferred from output")
    parser.add_argument("--paper", choices=("a4", "letter", "a5"), default="a4")
    parser.add_argument("--paper-style", choices=("ruled", "grid", "blank"), default="ruled")
    parser.add_argument("--font", choices=("casual", "neat", "light"), default="casual")
    parser.add_argument("--ink", default="#173b67")
    parser.add_argument("--font-size", type=float, default=20)
    parser.add_argument("--variation", type=float, default=0.32)
    parser.add_argument("--seed", default="inkwell")
    parser.add_argument("--dpi", type=int, default=200)
    parser.add_argument("--margin-mm", type=float, default=18)
    parser.add_argument("--line-spacing", type=float, default=1.48)
    parser.add_argument("--title")
    parser.add_argument("--json", action="store_true", help="Print machine-readable output")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        text = Path(args.input).read_text(encoding="utf-8") if args.input else sys.stdin.read()
        options = RenderOptions(
            paper=args.paper,
            paper_style=args.paper_style,
            font=args.font,
            ink=args.ink,
            font_size=args.font_size,
            variation=args.variation,
            seed=args.seed,
            dpi=args.dpi,
            margin_mm=args.margin_mm,
            line_spacing=args.line_spacing,
            title=args.title,
        )
        document, files = generate_document(text, args.output, args.format, options)
        result = {"ok": True, "format": (args.format or Path(args.output).suffix.lstrip(".") or "pdf"), "pages": len(document.pages), "files": [str(path) for path in files], "seed": options.seed}
        print(json.dumps(result) if args.json else f"Created {len(document.pages)} page(s):\n" + "\n".join(f"  {path}" for path in files))
        return 0
    except (OSError, ValueError) as error:
        print(f"inkwell: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

