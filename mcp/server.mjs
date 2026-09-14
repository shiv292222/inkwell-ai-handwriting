#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { stdin, stdout, stderr } from "node:process";
import { renderDocument } from "../src/core/engine.js";

const TOOLS = [{
  name: "create_handwritten_notes",
  description: "Convert text into deterministic, privacy-preserving handwritten SVG pages. Optionally save the pages to a local directory.",
  inputSchema: {
    type: "object",
    required: ["text"],
    properties: {
      text: { type: "string", description: "Plain text or Markdown-like note content", maxLength: 20000 },
      outputDirectory: { type: "string", description: "Optional local directory for SVG pages" },
      paper: { type: "string", enum: ["a4", "letter", "a5"] },
      paperStyle: { type: "string", enum: ["ruled", "grid", "blank"] },
      font: { type: "string", enum: ["casual", "cursive", "neat", "journal"] },
      ink: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
      fontSize: { type: "number", minimum: 14, maximum: 64 },
      variation: { type: "number", minimum: 0, maximum: 1 },
      seed: { type: "string", maxLength: 100 }
    },
    additionalProperties: false
  }
}];

function send(message) {
  const payload = JSON.stringify(message);
  stdout.write(`Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`);
}

function response(id, result) { send({ jsonrpc: "2.0", id, result }); }
function failure(id, code, message) { send({ jsonrpc: "2.0", id, error: { code, message } }); }

function validateArguments(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) return "arguments must be an object";
  const allowedKeys = new Set(["text", "outputDirectory", "paper", "paperStyle", "font", "ink", "fontSize", "variation", "seed"]);
  const unknown = Object.keys(args).find((key) => !allowedKeys.has(key));
  if (unknown) return `unknown argument: ${unknown}`;
  if (typeof args.text !== "string" || !args.text.trim()) return "text must be a non-empty string";
  if (args.text.length > 20000) return "text exceeds the 20,000 character limit";
  if (args.outputDirectory !== undefined && (typeof args.outputDirectory !== "string" || !args.outputDirectory.trim() || args.outputDirectory.length > 1024)) return "outputDirectory must be a non-empty path no longer than 1,024 characters";
  const enumOptions = { paper: ["a4", "letter", "a5"], paperStyle: ["ruled", "grid", "blank"], font: ["casual", "cursive", "neat", "journal"] };
  for (const [key, allowed] of Object.entries(enumOptions)) {
    if (args[key] !== undefined && !allowed.includes(args[key])) return `${key} must be one of: ${allowed.join(", ")}`;
  }
  if (args.ink !== undefined && (typeof args.ink !== "string" || !/^#[0-9a-f]{6}$/iu.test(args.ink))) return "ink must be a six-digit hex color";
  if (args.fontSize !== undefined && (typeof args.fontSize !== "number" || !Number.isFinite(args.fontSize) || args.fontSize < 14 || args.fontSize > 64)) return "fontSize must be a number from 14 to 64";
  if (args.variation !== undefined && (typeof args.variation !== "number" || !Number.isFinite(args.variation) || args.variation < 0 || args.variation > 1)) return "variation must be a number from 0 to 1";
  if (args.seed !== undefined && (typeof args.seed !== "string" || args.seed.length > 100)) return "seed must be a string no longer than 100 characters";
  return "";
}

async function handle(message) {
  const { id, method, params = {} } = message;
  if (method === "initialize") {
    response(id, { protocolVersion: params.protocolVersion || "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "inkwell", version: "0.1.0" } });
  } else if (method === "notifications/initialized") {
    // Notifications intentionally have no response.
  } else if (method === "ping") response(id, {});
  else if (method === "tools/list") response(id, { tools: TOOLS });
  else if (method === "tools/call") {
    if (params.name !== TOOLS[0].name) return failure(id, -32601, `Unknown tool: ${params.name}`);
    const args = params.arguments || {};
    const validationError = validateArguments(args);
    if (validationError) return failure(id, -32602, validationError);
    const document = renderDocument(args.text, args);
    const files = [];
    if (args.outputDirectory) {
      const directory = resolve(args.outputDirectory.trim());
      await mkdir(directory, { recursive: true });
      for (let index = 0; index < document.svgs.length; index += 1) {
        const file = join(directory, `page-${String(index + 1).padStart(2, "0")}.svg`);
        await writeFile(file, document.svgs[index], "utf8");
        files.push(file);
      }
    }
    response(id, {
      content: [{ type: "text", text: JSON.stringify({ pages: document.svgs.length, files, svg: files.length ? undefined : document.svgs }) }],
      structuredContent: { pageCount: document.svgs.length, files }
    });
  } else if (id !== undefined) failure(id, -32601, `Method not found: ${method}`);
}

let buffer = Buffer.alloc(0);
stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd < 0) break;
    const header = buffer.subarray(0, headerEnd).toString("utf8");
    const match = header.match(/content-length:\s*(\d+)/i);
    if (!match) { buffer = Buffer.alloc(0); break; }
    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + length) break;
    const body = buffer.subarray(bodyStart, bodyStart + length).toString("utf8");
    buffer = buffer.subarray(bodyStart + length);
    try {
      const message = JSON.parse(body);
      Promise.resolve(handle(message)).catch((error) => failure(message.id ?? null, -32603, error.message));
    }
    catch (error) { failure(null, -32700, error.message); }
  }
});
stdin.on("error", (error) => stderr.write(`${error.message}\n`));
