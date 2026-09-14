# Inkwell

Inkwell turns ordinary text or Markdown-like notes into polished handwritten **PDF**, **Word DOCX**, or **PNG** documents—locally, with no note uploads and no AI API required.

The repository is designed for people *and* agents: it includes a Python CLI, a standard MCP tool, a Codex plugin and skill, `AGENTS.md`, Claude guidance, Copilot instructions, tests, and bundled open-license handwriting fonts.

> **Responsible use:** Create personal notes, study aids, letters, and creative work. Do not forge signatures, impersonate people, falsify records, or misrepresent authorship. Only use custom handwriting you own or have permission to use.

## What changed in 1.0

The production renderer is a true document engine, not a browser-print workaround:

- Actual font metrics determine every wrap and horizontal advance.
- Each word receives subtle seeded baseline, angle, and ink-pressure variation inside a reserved safety gutter, preventing collisions.
- A4, A5, and Letter pages paginate automatically.
- PDF output is a real multi-page PDF written by ReportLab.
- Word output is a real DOCX containing one print-accurate handwritten page image per page, so font substitution cannot break it.
- PNG export creates numbered high-resolution pages.
- Kalam (Light, Regular, Bold) and Patrick Hand are bundled under the SIL Open Font License.

## Install

Python 3.10+ is required.

```bash
git clone https://github.com/shiv292222/inkwell-ai-handwriting.git
cd inkwell-ai-handwriting
python3 -m venv .venv
source .venv/bin/activate             # Windows: .venv\Scripts\activate
python -m pip install -e .
```

## Create notes

PDF:

```bash
inkwell notes.txt -o handwritten-notes.pdf --title "Biology revision"
```

Word:

```bash
inkwell notes.txt -o handwritten-notes.docx --font neat --paper-style grid
```

Standard input and machine-readable output:

```bash
printf "# Physics\n\n- Force = mass × acceleration" | \
  inkwell -o physics.pdf --seed lesson-4 --json
```

Useful options include `--paper a4|letter|a5`, `--paper-style ruled|grid|blank`, `--font casual|neat|light`, `--font-size`, `--variation`, `--dpi`, `--ink`, `--margin-mm`, and `--line-spacing`. Run `inkwell --help` for the complete contract.

## Use from any AI agent via MCP

Install the Python package, then add this server to the agent's MCP configuration:

```json
{
  "mcpServers": {
    "inkwell": {
      "command": "node",
      "args": ["/absolute/path/to/inkwell-ai-handwriting/mcp/launch.mjs"]
    }
  }
}
```

The launcher automatically uses the repository's `.venv` when present. The server exposes one focused tool, `create_handwritten_notes`. It accepts note text, a required output path, format (`pdf`, `docx`, or `png`), page/style controls, and a deterministic seed. It returns the created file paths and page count.

## Codex skill and plugin

This checkout is a Codex plugin root. Its plugin manifest is `.codex-plugin/plugin.json`, MCP declaration is `.mcp.json`, and reusable skill is `skills/create-handwritten-notes/SKILL.md`. After installing the Python dependencies, install the repository as a plugin or copy/use the skill in an agent workspace. The included instructions teach the agent to choose PDF, DOCX, or PNG, preserve wording, verify output, and avoid identity imitation.

## Optional browser preview

`npm start` opens the original lightweight visual preview at `http://127.0.0.1:4173`. It is not the production exporter. Use the Python CLI or MCP tool for final PDF and Word files.

## Tests

```bash
python -m pip install -e ".[test]"
python -m unittest discover -s tests -v
npm test
```

The suites cover dense-line collision safety, page bounds, long-word wrapping, Markdown-like headings and bullets, deterministic seeds, pagination, paper sizes, invalid input, PNG files, PDF structure/page counts, DOCX package/page images, CLI behavior, and MCP framing/validation. CI runs both Python and browser compatibility suites.

## Research and licensing

Inkwell takes product ideas—not code—from established open-source projects such as [sjvasquez/handwriting-synthesis](https://github.com/sjvasquez/handwriting-synthesis), [Grzego/handwriting-generation](https://github.com/Grzego/handwriting-generation), and [bannyvishwas/MyHandWriting](https://github.com/bannyvishwas/MyHandWriting). Its implementation is original and uses a simpler, auditable font-rendering approach rather than opaque model checkpoints.

Bundled typefaces come from the [Google Fonts repository](https://github.com/google/fonts): Kalam and Patrick Hand are both distributed under SIL OFL 1.1. Their license texts are included beside the font files.

Project code is MIT licensed. See `SECURITY.md` for privacy and safety details.
