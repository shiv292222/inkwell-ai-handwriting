#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const localPython = process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python";
const python = process.env.INKWELL_PYTHON || (existsSync(localPython) ? localPython : (process.platform === "win32" ? "python" : "python3"));
const result = spawnSync(python, ["-m", "unittest", "discover", "-s", "tests", "-v"], { stdio: "inherit" });
if (result.error) {
  console.error(`Unable to start ${python}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
