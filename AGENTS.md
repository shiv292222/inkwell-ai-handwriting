# Agent guide

Inkwell is a local-first handwriting document generator. The Python engine in `src/inkwell/` is the production source of truth for CLI and MCP output. The JavaScript browser is an optional lightweight preview, not the document exporter.

## Commands

- `python3 -m pip install -e ".[test]"`: install the engine and test tools.
- `inkwell --help`: production CLI contract.
- `python3 -m unittest discover -s tests -v`: document-engine tests.
- `npm start`: optional browser preview on `127.0.0.1:4173`.
- `npm run check`: browser and installed Python test suites.

## Implementation boundaries

- Put production rendering, measured layout, pagination, and exports in `src/inkwell/engine.py`; do not duplicate them in CLI or MCP.
- Keep note text local. Do not add telemetry, remote fonts, cloud inference, or upload APIs without an explicit product decision and clear opt-in UX.
- Keep seeded production output deterministic across CLI and MCP.
- Treat custom handwriting as biometric-adjacent personal data. Never persist or transmit it implicitly.
- Do not add signature imitation, identity cloning, or anti-detection features.

## Verification

Test observable behavior: measured non-overlap, page bounds, pagination, deterministic seeds, input limits, valid PDF/DOCX structures, agent protocol behavior, and rendered output. Visually inspect sample PDF and DOCX pages after meaningful export changes.
