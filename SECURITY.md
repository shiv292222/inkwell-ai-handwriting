# Security policy

## Supported versions

Security fixes are applied to the latest release and the `main` branch.

## Design guarantees

- The browser app has no backend, analytics, cookies, or external API calls.
- Note content is XML-escaped before it enters generated SVG.
- Production CLI/MCP input is limited to 100,000 characters and rejects empty content.
- Browser font uploads are limited to 2 MB and accepted only as font files.
- The document engine has three pinned dependency families: Pillow, ReportLab, and python-docx. Dependabot and CI monitor them.
- Output paths are supplied explicitly by the user or agent. Inkwell never scans unrelated directories.

The production engine renders note text into pixels before placing pages in PDF or DOCX containers. It does not interpret HTML, execute document macros, or create active PDF content. DOCX output contains only standard document markup and locally generated PNG page images.

The optional legacy browser preview produces SVG. It does not include scripts, event handlers, links, or foreign objects; treat SVG from any other source as untrusted.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting feature instead of opening a public issue. Include the affected version, reproduction steps, impact, and a minimal proof of concept. Do not include private note content or personal handwriting samples.

## Responsible-use boundary

Do not use Inkwell for signature generation, identity impersonation, forged records, academic misrepresentation, or non-consensual cloning of another person's handwriting. Reports requesting those capabilities will not be accepted as features.
