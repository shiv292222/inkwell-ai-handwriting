import test from "node:test";
import assert from "node:assert/strict";
import { escapeXml, makeRandom, normalizeOptions, paginate, renderDocument, renderPageSvg, wrapText } from "../src/core/engine.js";

test("seeded randomness is deterministic", () => {
  const a = makeRandom("same-seed");
  const b = makeRandom("same-seed");
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test("XML content is escaped", () => {
  assert.equal(escapeXml(`<script a="b">&</script>`), "&lt;script a=&quot;b&quot;&gt;&amp;&lt;/script&gt;");
});

test("long words and paragraphs wrap without losing text", () => {
  const lines = wrapText("one two\n\nsupercalifragilistic", 5);
  assert.deepEqual(lines.slice(0, 3), ["one", "two", ""]);
  assert.equal(lines.slice(3).join(""), "supercalifragilistic");
});

test("pagination creates additional pages", () => {
  const result = paginate("note ".repeat(3000), { paper: "a5", fontSize: 42 });
  assert.ok(result.pages.length > 1);
  assert.ok(result.linesPerPage > 0);
});

test("renderer is deterministic and does not emit raw markup", () => {
  const first = renderDocument("Hello <script>alert(1)</script>", { seed: "fixed" });
  const second = renderDocument("Hello <script>alert(1)</script>", { seed: "fixed" });
  assert.deepEqual(first.svgs, second.svgs);
  assert.match(first.svgs[0], /&lt;script&gt;/);
  assert.doesNotMatch(first.svgs[0], /<script>alert/);
});

test("unsafe style values fall back instead of entering SVG", () => {
  const document = renderDocument("Safe", { ink: `red' onload='alert(1)`, paperColor: "url(evil)" });
  assert.doesNotMatch(document.svgs[0], /onload|url\(evil\)/);
  assert.match(document.svgs[0], /#183a73/);
});

test("options are bounded and invalid enums fall back", () => {
  const options = normalizeOptions({ paper: "poster", font: "remote", paperStyle: "danger", fontSize: 900, lineHeight: -4, margin: 2, variation: 9 });
  assert.equal(options.paper, "a4");
  assert.equal(options.font, "casual");
  assert.equal(options.paperStyle, "ruled");
  assert.equal(options.fontSize, 64);
  assert.equal(options.lineHeight, 1.1);
  assert.equal(options.margin, 30);
  assert.equal(options.variation, 1);
});

test("blank input still produces one valid page", () => {
  const document = renderDocument("");
  assert.equal(document.pages.length, 1);
  assert.match(document.svgs[0], /^<svg/);
});

test("different seeds change natural variation", () => {
  const a = renderDocument("repeatable handwriting", { seed: "one" });
  const b = renderDocument("repeatable handwriting", { seed: "two" });
  assert.notEqual(a.svgs[0], b.svgs[0]);
});

test("paper dimensions and styles render correctly", () => {
  const grid = renderPageSvg(["hello"], { paper: "letter", paperStyle: "grid" });
  const blank = renderPageSvg(["hello"], { paper: "a5", paperStyle: "blank" });
  assert.match(grid, /width="816" height="1056"/);
  assert.match(grid, /stroke="#bdd2e5"/);
  assert.match(blank, /width="559" height="794"/);
  assert.doesNotMatch(blank, /#bdd2e5|#b7d1e8/);
});

test("only bounded font data URLs are embedded", () => {
  const valid = renderDocument("font", { fontDataUrl: "data:font/ttf;base64,QUJD" });
  const invalid = renderDocument("font", { fontDataUrl: "javascript:alert(1)" });
  assert.match(valid.svgs[0], /@font-face/);
  assert.doesNotMatch(invalid.svgs[0], /javascript|@font-face/);
});

test("every paginated line stays within the page capacity", () => {
  const result = paginate("alpha beta gamma delta ".repeat(800), { paper: "a5", fontSize: 35 });
  assert.ok(result.pages.every((page) => page.length <= result.linesPerPage));
  assert.equal(result.pages.flat().filter(Boolean).join(" ").replaceAll(/\s+/gu, " ").trim(), "alpha beta gamma delta ".repeat(800).trim());
});
