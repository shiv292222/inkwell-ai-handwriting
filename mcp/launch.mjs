#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const venvPython = process.platform === "win32" ? join(root, ".venv", "Scripts", "python.exe") : join(root, ".venv", "bin", "python");
const python = process.env.INKWELL_PYTHON || (existsSync(venvPython) ? venvPython : (process.platform === "win32" ? "python" : "python3"));
const child = spawn(python, [join(root, "mcp", "server.py")], { cwd: root, stdio: "inherit" });

child.on("error", (error) => {
  console.error(`Inkwell could not start Python (${python}): ${error.message}. Run: python3 -m venv .venv && .venv/bin/python -m pip install -e .`);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
