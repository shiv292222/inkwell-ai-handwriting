import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function frame(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

function parseFrames(buffer) {
  const messages = [];
  let source = buffer;
  while (source.length) {
    const headerEnd = source.indexOf("\r\n\r\n");
    if (headerEnd < 0) break;
    const match = source.subarray(0, headerEnd).toString("utf8").match(/content-length:\s*(\d+)/i);
    if (!match) break;
    const length = Number(match[1]);
    const start = headerEnd + 4;
    if (source.length < start + length) break;
    messages.push(JSON.parse(source.subarray(start, start + length).toString("utf8")));
    source = source.subarray(start + length);
  }
  return messages;
}

async function request(child, output, message) {
  child.stdin.write(frame(message));
  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) {
    const found = parseFrames(Buffer.concat(output)).find((item) => item.id === message.id);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`MCP response ${message.id} timed out`);
}

function server(context) {
  const child = spawn(process.execPath, ["mcp/server.mjs"], { stdio: ["pipe", "pipe", "pipe"] });
  const output = [];
  child.stdout.on("data", (chunk) => output.push(chunk));
  context.after(() => child.kill());
  return { child, output };
}

test("MCP server initializes and lists its tool", async (context) => {
  const { child, output } = server(context);
  const initialized = await request(child, output, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } });
  const listed = await request(child, output, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  assert.equal(initialized.result.serverInfo.name, "inkwell");
  assert.equal(listed.result.tools[0].name, "create_handwritten_notes");
  assert.equal(listed.result.tools[0].inputSchema.additionalProperties, false);
});

test("MCP tool returns inline SVG without writing by default", async (context) => {
  const { child, output } = server(context);
  const result = await request(child, output, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "create_handwritten_notes", arguments: { text: "Agent note", seed: "agent" } } });
  const payload = JSON.parse(result.result.content[0].text);
  assert.equal(result.result.structuredContent.pageCount, 1);
  assert.deepEqual(result.result.structuredContent.files, []);
  assert.match(payload.svg[0], />Agent<\/text>/);
  assert.match(payload.svg[0], />note<\/text>/);
});

test("MCP tool writes numbered pages when explicitly requested", async (context) => {
  const { child, output } = server(context);
  const directory = await mkdtemp(join(tmpdir(), "inkwell-mcp-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const result = await request(child, output, { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "create_handwritten_notes", arguments: { text: "Saved note", outputDirectory: directory, paperStyle: "blank" } } });
  assert.equal(result.result.structuredContent.files.length, 1);
  const svg = await readFile(result.result.structuredContent.files[0], "utf8");
  assert.match(svg, />Saved<\/text>/);
  assert.match(svg, />note<\/text>/);
});

test("MCP rejects malformed, excessive, and unknown arguments", async (context) => {
  const { child, output } = server(context);
  const empty = await request(child, output, { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "create_handwritten_notes", arguments: { text: "" } } });
  const unknown = await request(child, output, { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "create_handwritten_notes", arguments: { text: "note", execute: true } } });
  const long = await request(child, output, { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "create_handwritten_notes", arguments: { text: "x".repeat(20001) } } });
  const badNumber = await request(child, output, { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "create_handwritten_notes", arguments: { text: "note", variation: Number.NaN } } });
  assert.equal(empty.error.code, -32602);
  assert.match(unknown.error.message, /unknown argument/);
  assert.match(long.error.message, /20,000/);
  assert.match(badNumber.error.message, /variation/);
});

test("MCP reports unknown methods and tools", async (context) => {
  const { child, output } = server(context);
  const method = await request(child, output, { jsonrpc: "2.0", id: 9, method: "made/up", params: {} });
  const tool = await request(child, output, { jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "wrong", arguments: { text: "note" } } });
  assert.equal(method.error.code, -32601);
  assert.equal(tool.error.code, -32601);
});
