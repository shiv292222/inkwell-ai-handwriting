export const PAPER_SIZES = Object.freeze({
  a4: { width: 794, height: 1123, label: "A4" },
  letter: { width: 816, height: 1056, label: "US Letter" },
  a5: { width: 559, height: 794, label: "A5" },
});

export const FONT_STACKS = Object.freeze({
  casual: "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive",
  cursive: "'Snell Roundhand', 'Apple Chancery', 'URW Chancery L', cursive",
  neat: "'Noteworthy', 'Segoe Print', 'Comic Sans MS', cursive",
  journal: "'Chalkboard SE', 'Marker Felt', 'Segoe Print', cursive",
});

export const DEFAULT_OPTIONS = Object.freeze({
  paper: "a4",
  paperStyle: "ruled",
  font: "casual",
  fontFamily: "",
  fontDataUrl: "",
  fontSize: 27,
  lineHeight: 1.72,
  margin: 74,
  ink: "#183a73",
  paperColor: "#fffdf7",
  seed: "inkwell",
  variation: 0.7,
  title: "Handwritten notes",
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const safeColor = (value, fallback) => /^#[0-9a-f]{6}$/iu.test(String(value || "")) ? String(value) : fallback;
const safeFontData = (value) => {
  const font = String(value || "");
  return font.length <= 3_000_000 && /^data:(?:font\/|application\/(?:font|x-font|octet-stream))[^,]*;base64,[a-z0-9+/=]+$/iu.test(font) ? font : "";
};

export function normalizeOptions(input = {}) {
  const paper = PAPER_SIZES[input.paper] ? input.paper : DEFAULT_OPTIONS.paper;
  const font = FONT_STACKS[input.font] ? input.font : DEFAULT_OPTIONS.font;
  return {
    ...DEFAULT_OPTIONS,
    ...input,
    paper,
    font,
    paperStyle: ["ruled", "grid", "blank"].includes(input.paperStyle)
      ? input.paperStyle
      : DEFAULT_OPTIONS.paperStyle,
    fontSize: clamp(Number(input.fontSize) || DEFAULT_OPTIONS.fontSize, 14, 64),
    lineHeight: clamp(Number(input.lineHeight) || DEFAULT_OPTIONS.lineHeight, 1.1, 2.4),
    margin: clamp(Number(input.margin) || DEFAULT_OPTIONS.margin, 30, 140),
    variation: clamp(Number(input.variation) || 0, 0, 1),
    ink: safeColor(input.ink, DEFAULT_OPTIONS.ink),
    paperColor: safeColor(input.paperColor, DEFAULT_OPTIONS.paperColor),
    fontFamily: "",
    fontDataUrl: safeFontData(input.fontDataUrl),
    seed: String(input.seed || DEFAULT_OPTIONS.seed).slice(0, 100),
    title: String(input.title || DEFAULT_OPTIONS.title).slice(0, 120),
  };
}

export function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function makeRandom(seed) {
  let state = hashSeed(seed) || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function wrapText(text, maxChars) {
  const lines = [];
  const paragraphs = String(text).replaceAll("\r\n", "\n").split("\n");
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    const words = paragraph.trim().split(/\s+/u);
    let line = "";
    for (const word of words) {
      if (word.length > maxChars) {
        if (line) lines.push(line);
        for (let i = 0; i < word.length; i += maxChars) {
          lines.push(word.slice(i, i + maxChars));
        }
        line = "";
        continue;
      }
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxChars) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
}

export function paginate(text, inputOptions = {}) {
  const options = normalizeOptions(inputOptions);
  const paper = PAPER_SIZES[options.paper];
  const usableWidth = paper.width - options.margin * 2;
  const usableHeight = paper.height - options.margin * 2;
  const averageGlyphWidth = options.fontSize * 0.58;
  const maxChars = Math.max(8, Math.floor(usableWidth / averageGlyphWidth));
  const lineStep = options.fontSize * options.lineHeight;
  const linesPerPage = Math.max(1, Math.floor(usableHeight / lineStep));
  const lines = wrapText(text, maxChars);
  const pages = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  return { pages, options, lineStep, maxChars, linesPerPage };
}

function paperMarkup(options, paper) {
  if (options.paperStyle === "blank") return "";
  const color = options.paperStyle === "grid" ? "#bdd2e5" : "#b7d1e8";
  const step = options.fontSize * options.lineHeight;
  const horizontal = [];
  for (let y = options.margin + step * 0.7; y < paper.height - options.margin / 2; y += step) {
    horizontal.push(`<line x1="0" y1="${y.toFixed(2)}" x2="${paper.width}" y2="${y.toFixed(2)}"/>`);
  }
  const vertical = [];
  if (options.paperStyle === "grid") {
    for (let x = options.margin; x < paper.width; x += step) {
      vertical.push(`<line x1="${x.toFixed(2)}" y1="0" x2="${x.toFixed(2)}" y2="${paper.height}"/>`);
    }
  }
  const marginLine = options.paperStyle === "ruled"
    ? `<line x1="${options.margin - 18}" y1="0" x2="${options.margin - 18}" y2="${paper.height}" stroke="#e8a8a8" stroke-width="1.2"/>`
    : "";
  return `<g stroke="${color}" stroke-width="0.8" opacity="0.72">${horizontal.join("")}${vertical.join("")}</g>${marginLine}`;
}

function lineMarkup(line, lineIndex, pageIndex, options, y) {
  if (!line) return "";
  const random = makeRandom(`${options.seed}:${pageIndex}:${lineIndex}:${line}`);
  const variation = options.variation;
  let x = options.margin + (random() - 0.5) * 4 * variation;
  const words = line.split(" ");
  return words.map((word, wordIndex) => {
    const width = word.length * options.fontSize * (0.53 + random() * 0.06);
    const dx = (random() - 0.5) * 2.8 * variation;
    const dy = (random() - 0.5) * 3.4 * variation;
    const rotate = (random() - 0.5) * 1.3 * variation;
    const spacing = options.fontSize * (0.34 + random() * 0.1);
    const opacity = 0.93 + random() * 0.07;
    const markup = `<text x="${(x + dx).toFixed(2)}" y="${(y + dy).toFixed(2)}" transform="rotate(${rotate.toFixed(3)} ${(x + dx).toFixed(2)} ${(y + dy).toFixed(2)})" opacity="${opacity.toFixed(3)}">${escapeXml(word)}</text>`;
    x += width + spacing;
    return markup;
  }).join("");
}

export function renderPageSvg(lines, inputOptions = {}, pageIndex = 0) {
  const options = normalizeOptions(inputOptions);
  const paper = PAPER_SIZES[options.paper];
  const fontFamily = options.fontFamily || FONT_STACKS[options.font];
  const fontFace = options.fontDataUrl
    ? `@font-face{font-family:'InkwellUserFont';src:url('${String(options.fontDataUrl).replaceAll("'", "")}');}`
    : "";
  const effectiveFont = options.fontDataUrl ? "'InkwellUserFont'" : fontFamily;
  const text = lines.map((line, index) => {
    const y = options.margin + options.fontSize + index * options.fontSize * options.lineHeight;
    return lineMarkup(line, index, pageIndex, options, y);
  }).join("");
  const fiberId = `paperFiber-${pageIndex}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${paper.width}" height="${paper.height}" viewBox="0 0 ${paper.width} ${paper.height}" role="img" aria-label="${escapeXml(options.title)}, page ${pageIndex + 1}">
  <title>${escapeXml(options.title)} — page ${pageIndex + 1}</title>
  <defs>
    <filter id="${fiberId}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="2" seed="${hashSeed(options.seed + pageIndex) % 97}" result="noise"/><feBlend in="SourceGraphic" in2="noise" mode="multiply"/></filter>
    <style>${fontFace}text{font-family:${effectiveFont};font-size:${options.fontSize}px;fill:${options.ink};font-weight:400;font-kerning:normal}</style>
  </defs>
  <rect width="100%" height="100%" fill="${options.paperColor}"/>
  <rect width="100%" height="100%" fill="#ffffff" opacity="0.025" filter="url(#${fiberId})"/>
  ${paperMarkup(options, paper)}
  <g>${text}</g>
</svg>`;
}

export function renderDocument(text, inputOptions = {}) {
  const result = paginate(text, inputOptions);
  return {
    ...result,
    svgs: result.pages.map((lines, index) => renderPageSvg(lines, result.options, index)),
  };
}
