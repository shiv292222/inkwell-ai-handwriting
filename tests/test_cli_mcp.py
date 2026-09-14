import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PYTHON = sys.executable


def framed(message):
    body = json.dumps(message).encode()
    return f"Content-Length: {len(body)}\r\n\r\n".encode() + body


def parse_frame(data):
    header, body = data.split(b"\r\n\r\n", 1)
    length = int(header.decode().split(":", 1)[1].strip())
    return json.loads(body[:length])


class CliMcpTests(unittest.TestCase):
    def test_cli_pdf_from_stdin(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "cli.pdf"
            run = subprocess.run([PYTHON, str(ROOT / "bin/inkwell.py"), "-o", str(output), "--dpi", "96", "--json"], input="CLI note", text=True, capture_output=True)
            self.assertEqual(run.returncode, 0, run.stderr)
            result = json.loads(run.stdout)
            self.assertTrue(result["ok"])
            self.assertTrue(output.is_file())

    def test_cli_rejects_empty_input(self):
        run = subprocess.run([PYTHON, str(ROOT / "bin/inkwell.py")], input="", text=True, capture_output=True)
        self.assertEqual(run.returncode, 2)
        self.assertIn("non-empty", run.stderr)

    def test_mcp_lists_pdf_docx_and_png_tool(self):
        request = framed({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
        run = subprocess.run([PYTHON, str(ROOT / "mcp/server.py")], input=request, capture_output=True)
        self.assertEqual(run.returncode, 0, run.stderr.decode())
        response = parse_frame(run.stdout)
        formats = response["result"]["tools"][0]["inputSchema"]["properties"]["format"]["enum"]
        self.assertEqual(formats, ["pdf", "docx", "png"])

    def test_plugin_launcher_uses_project_environment(self):
        request = framed({"jsonrpc": "2.0", "id": 7, "method": "ping"})
        run = subprocess.run(["node", str(ROOT / "mcp/launch.mjs")], input=request, capture_output=True)
        self.assertEqual(run.returncode, 0, run.stderr.decode())
        self.assertEqual(parse_frame(run.stdout)["result"], {})

    def test_mcp_generates_docx(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "agent.docx"
            request = framed({"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "create_handwritten_notes", "arguments": {"text": "Agent generated note", "output": str(output), "format": "docx", "dpi": 96}}})
            run = subprocess.run([PYTHON, str(ROOT / "mcp/server.py")], input=request, capture_output=True)
            response = parse_frame(run.stdout)
            self.assertTrue(response["result"]["structuredContent"]["ok"])
            self.assertTrue(output.is_file())

    def test_mcp_rejects_unknown_arguments(self):
        request = framed({"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "create_handwritten_notes", "arguments": {"text": "x", "output": "x.pdf", "surprise": True}}})
        run = subprocess.run([PYTHON, str(ROOT / "mcp/server.py")], input=request, capture_output=True)
        response = parse_frame(run.stdout)
        self.assertEqual(response["error"]["code"], -32602)


if __name__ == "__main__":
    unittest.main()
