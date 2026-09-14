from __future__ import annotations

import json
import sys
from pathlib import Path

from .engine import RenderOptions, generate_document


TOOL = {
    "name": "create_handwritten_notes",
    "description": "Generate real handwritten PDF, Word DOCX, or PNG page files locally with measured, collision-safe layout.",
    "inputSchema": {
        "type": "object",
        "required": ["text", "output"],
        "properties": {
            "text": {"type": "string", "minLength": 1, "maxLength": 100000},
            "output": {"type": "string", "description": "A .pdf/.docx path, or a directory for PNG pages"},
            "format": {"type": "string", "enum": ["pdf", "docx", "png"]},
            "paper": {"type": "string", "enum": ["a4", "letter", "a5"]},
            "paperStyle": {"type": "string", "enum": ["ruled", "grid", "blank"]},
            "font": {"type": "string", "enum": ["casual", "neat", "light"]},
            "ink": {"type": "string", "pattern": "^#[0-9a-fA-F]{6}$"},
            "fontSize": {"type": "number", "minimum": 10, "maximum": 42},
            "variation": {"type": "number", "minimum": 0, "maximum": 1},
            "seed": {"type": "string", "maxLength": 200},
            "dpi": {"type": "integer", "minimum": 96, "maximum": 300},
            "marginMm": {"type": "number", "minimum": 8, "maximum": 35},
            "lineSpacing": {"type": "number", "minimum": 1.15, "maximum": 2},
            "title": {"type": "string", "maxLength": 300},
        },
        "additionalProperties": False,
    },
}


def _write(message: dict) -> None:
    payload = json.dumps(message, ensure_ascii=False).encode("utf-8")
    sys.stdout.buffer.write(f"Content-Length: {len(payload)}\r\n\r\n".encode("ascii") + payload)
    sys.stdout.buffer.flush()


def _result(request_id, result: dict) -> None:
    _write({"jsonrpc": "2.0", "id": request_id, "result": result})


def _error(request_id, code: int, message: str) -> None:
    _write({"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}})


def _options(args: dict) -> RenderOptions:
    return RenderOptions(
        paper=args.get("paper", "a4"),
        paper_style=args.get("paperStyle", "ruled"),
        font=args.get("font", "casual"),
        ink=args.get("ink", "#173b67"),
        font_size=args.get("fontSize", 20),
        variation=args.get("variation", 0.32),
        seed=args.get("seed", "inkwell"),
        dpi=args.get("dpi", 200),
        margin_mm=args.get("marginMm", 18),
        line_spacing=args.get("lineSpacing", 1.48),
        title=args.get("title"),
    )


def handle(message: dict) -> None:
    request_id = message.get("id")
    method = message.get("method")
    if method == "initialize":
        version = message.get("params", {}).get("protocolVersion", "2025-03-26")
        _result(request_id, {"protocolVersion": version, "capabilities": {"tools": {}}, "serverInfo": {"name": "inkwell", "version": "1.0.0"}})
    elif method == "notifications/initialized":
        return
    elif method == "ping":
        _result(request_id, {})
    elif method == "tools/list":
        _result(request_id, {"tools": [TOOL]})
    elif method == "tools/call":
        params = message.get("params") or {}
        if params.get("name") != TOOL["name"]:
            _error(request_id, -32601, f"Unknown tool: {params.get('name')}")
            return
        args = params.get("arguments") or {}
        allowed = set(TOOL["inputSchema"]["properties"])
        unknown = set(args) - allowed
        if unknown:
            _error(request_id, -32602, f"Unknown argument: {sorted(unknown)[0]}")
            return
        if not isinstance(args.get("text"), str) or not args["text"].strip():
            _error(request_id, -32602, "text must be a non-empty string")
            return
        if not isinstance(args.get("output"), str) or not args["output"].strip():
            _error(request_id, -32602, "output must be a non-empty path")
            return
        try:
            document, files = generate_document(args["text"], args["output"], args.get("format"), _options(args))
            data = {"ok": True, "pageCount": len(document.pages), "files": [str(path) for path in files], "format": args.get("format") or Path(args["output"]).suffix.lstrip(".") or "pdf"}
            _result(request_id, {"content": [{"type": "text", "text": json.dumps(data)}], "structuredContent": data})
        except (OSError, ValueError) as error:
            _error(request_id, -32602, str(error))
    elif request_id is not None:
        _error(request_id, -32601, f"Method not found: {method}")


def main() -> None:
    stream = sys.stdin.buffer
    while True:
        headers: dict[str, str] = {}
        while True:
            line = stream.readline()
            if not line:
                return
            if line in {b"\r\n", b"\n"}:
                break
            key, _, value = line.decode("ascii").partition(":")
            headers[key.lower().strip()] = value.strip()
        try:
            length = int(headers.get("content-length", "0"))
            if length <= 0:
                continue
            handle(json.loads(stream.read(length).decode("utf-8")))
        except (UnicodeError, ValueError, json.JSONDecodeError) as error:
            _error(None, -32700, str(error))


if __name__ == "__main__":
    main()

