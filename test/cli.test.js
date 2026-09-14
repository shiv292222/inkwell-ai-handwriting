import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

async function tempDirectory(context) {
  const directory = await mkdtemp(join(tmpdir(), "inkwell-cli-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("CLI renders stdin and returns JSON", async (context) => {
  const directory = await tempDirectory(context);
  const run = spawnSync(process.execPath, ["bin/inkwell.mjs", "--output", directory, "--json", "--seed", "test"], { input: "CLI note", encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.ok, true);
  assert.equal(result.pages, 1);
  const svg = await readFile(result.files[0], "utf8");
  assert.match(svg, />CLI<\/text>/);
  assert.match(svg, />note<\/text>/);
});

test("CLI renders a file with requested paper style", async (context) => {
  const directory = await tempDirectory(context);
  const input = join(directory, "note.txt");
  const output = join(directory, "pages");
  await writeFile(input, "Grid note", "utf8");
  const run = spawnSync(process.execPath, ["bin/inkwell.mjs", input, "--output", output, "--style", "grid", "--paper", "a5"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const svg = await readFile(join(output, "page-01.svg"), "utf8");
  assert.match(svg, /width="559" height="794"/);
  assert.match(svg, /#bdd2e5/);
});

test("CLI rejects missing content and invalid options", () => {
  const empty = spawnSync(process.execPath, ["bin/inkwell.mjs", "--json"], { input: "", encoding: "utf8" });
  const badStyle = spawnSync(process.execPath, ["bin/inkwell.mjs", "--style", "malicious"], { input: "note", encoding: "utf8" });
  const unknown = spawnSync(process.execPath, ["bin/inkwell.mjs", "--execute"], { input: "note", encoding: "utf8" });
  assert.equal(empty.status, 1);
  assert.match(empty.stderr, /No note text/);
  assert.equal(badStyle.status, 1);
  assert.match(badStyle.stderr, /Invalid paperStyle/);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Unknown option/);
});
