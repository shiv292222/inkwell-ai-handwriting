---
name: create-handwritten-notes
description: Convert user-provided text or notes into polished local handwritten PDF, Word DOCX, or PNG documents. Use for handwritten study notes, letters, and printable note exports; do not use for signatures, impersonation, forged documents, or cloning another person's handwriting without consent.
---

# Create handwritten notes

Use the `create_handwritten_notes` MCP tool when available. Otherwise run the installed `inkwell` command. From a source checkout, install once with `python3 -m pip install -e .` or run `python3 bin/inkwell.py`.

Preserve the user's wording unless they ask for editing or summarization. Choose sensible defaults when visual details are unspecified: A4, ruled paper, casual handwriting, blue ink, 0.32 variation, and 200 DPI. Use a stable seed when repeatable output matters. Prefer PDF for printing/sharing, DOCX when the user asks for Word, and PNG for page images.

Save outputs only to the workspace or requested directory. Report the page count and exact file paths. Open or render representative output when the environment supports it so clipping, overlap, and pagination defects are caught before delivery.

Keep text and custom fonts local. Never send them to a model, font service, analytics service, or remote renderer. Do not create signatures, imitate a specific person's writing without their permission, or help disguise authorship for fraud or academic misrepresentation.

For large inputs, rely on Inkwell pagination rather than truncating. The DOCX intentionally contains one full-page rendered image per page so the handwriting and layout remain identical on computers that do not have the bundled fonts installed.
