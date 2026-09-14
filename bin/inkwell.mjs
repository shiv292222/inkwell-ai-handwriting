#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { stdin, stdout, stderr, exit } from "node:process";
import { renderDocument } from "../src/core/engine.js";

const HELP = `Inkwell — turn plain text or Markdown into handwritten SVG pages

Usage:
  inkwell input.txt --output ./notes
  echo "My notes" | inkwell --output ./notes

Options:
  -o, --output <dir>       Output directory (default: ./output)
  --paper <a4|letter|a5>   Page size (default: a4)
  --style <ruled|grid|blank>
  --font <casual|cursive|neat|journal>
  --ink <hex>              Ink color (default: #183a73)
  --size <14-64>           Text size in px (default: 27)
  --variation <0-1>        Natural variation (default: 0.7)
  --seed <text>            Deterministic rendering seed
  --json                   Print a machine-readable result
  -h, --help               Show this help
`;

function parseArgs(argv) {
  const result = { output: "output" };
  const valueFlags = new Map([["-o", "output"], ["--output", "output"], ["--paper", "paper"], ["--style", "paperStyle"], ["--font", "font"], ["--ink", "ink"], ["--size", "fontSize"], ["--variation", "variation"], ["--seed", "seed"]]);
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "-h" || item === "--help") result.help = true;
    else if (item === "--json") result.json = true;
    else if (valueFlags.has(item)) {
      if (!argv[i + 1]) throw new Error(`${item} requires a value`);
      result[valueFlags.get(item)] = argv[++i];
    } else if (item.startsWith("-")) throw new Error(`Unknown option: ${item}`);
    else if (!result.input) result.input = item;
    else throw new Error(`Unexpected argument: ${item}`);
  }
  return result;
}

function validateArgs(args) {
  const enumOptions = {
    paper: ["a4", "letter", "a5"],
    paperStyle: ["ruled", "grid", "blank"],
    font: ["casual", "cursive", "neat", "journal"],
  };
  for (const [key, allowed] of Object.entries(enumOptions)) {
    if (args[key] !== undefined && !allowed.includes(args[key])) {
      throw new Error(`Invalid ${key}: expected ${allowed.join(", ")}`);
    }
  }
  if (args.ink !== undefined && !/^#[0-9a-f]{6}$/iu.test(args.ink)) throw new Error("Invalid ink: expected a six-digit hex color such as #183a73");
  if (args.fontSize !== undefined && (!Number.isFinite(Number(args.fontSize)) || Number(args.fontSize) < 14 || Number(args.fontSize) > 64)) throw new Error("Invalid size: expected a number from 14 to 64");
  if (args.variation !== undefined && (!Number.isFinite(Number(args.variation)) || Number(args.variation) < 0 || Number(args.variation) > 1)) throw new Error("Invalid variation: expected a number from 0 to 1");
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { stdout.write(HELP); return; }
  validateArgs(args);
  const text = args.input ? await readFile(resolve(args.input), "utf8") : await readStdin();
  if (!text.trim()) throw new Error("No note text was provided.");
  const outputDir = resolve(args.output);
  const document = renderDocument(text, args);
  await mkdir(outputDir, { recursive: true });
  const files = [];
  for (let index = 0; index < document.svgs.length; index += 1) {
    const file = join(outputDir, `page-${String(index + 1).padStart(2, "0")}.svg`);
    await writeFile(file, document.svgs[index], "utf8");
    files.push(file);
  }
  const result = { ok: true, pages: files.length, files, seed: document.options.seed };
  stdout.write(args.json ? `${JSON.stringify(result)}\n` : `Created ${files.length} page(s) in ${outputDir}\n`);
}

main().catch((error) => { stderr.write(`inkwell: ${error.message}\n`); exit(1); });
