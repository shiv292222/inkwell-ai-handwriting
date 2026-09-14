import { renderDocument } from "./core/engine.js";

const $ = (selector) => document.querySelector(selector);
const controls = {
  text: $("#note-input"), font: $("#font"), paperStyle: $("#paper-style"),
  paper: $("#paper"), ink: $("#ink"), variation: $("#variation"),
  fontSize: $("#font-size"), fontUpload: $("#font-upload"),
};
let fontDataUrl = "";
let seedNonce = 0;
let current = null;
let renderTimer;

function options() {
  return {
    font: controls.font.value,
    paperStyle: controls.paperStyle.value,
    paper: controls.paper.value,
    ink: controls.ink.value,
    variation: controls.variation.value,
    fontSize: controls.fontSize.value,
    seed: `inkwell-${seedNonce}`,
    fontDataUrl,
    title: "Inkwell handwritten note",
  };
}

function render() {
  current = renderDocument(controls.text.value, options());
  $("#pages").replaceChildren(...current.svgs.map((svg, index) => {
    const wrapper = document.createElement("article");
    wrapper.className = "page";
    wrapper.dataset.page = String(index + 1);
    wrapper.innerHTML = `${svg}<div class="page-number">Page ${index + 1}</div>`;
    return wrapper;
  }));
  $("#page-count").textContent = `${current.svgs.length} ${current.svgs.length === 1 ? "page" : "pages"}`;
  $("#char-count").textContent = `${controls.text.value.length.toLocaleString()} characters`;
  $("#variation-value").textContent = `${Math.round(controls.variation.value * 100)}%`;
  $("#size-value").textContent = `${controls.fontSize.value}px`;
  $("#ink-value").textContent = controls.ink.value;
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 80);
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function svgBlob(svg) {
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}

Object.values(controls).forEach((control) => {
  if (control !== controls.fontUpload) control.addEventListener("input", scheduleRender);
});

controls.fontUpload.addEventListener("change", async () => {
  const file = controls.fontUpload.files?.[0];
  if (!file) return;
  if (!/\.(?:ttf|otf|woff2?)$/iu.test(file.name)) {
    $("#status").textContent = "Font rejected: choose a .ttf, .otf, .woff, or .woff2 file.";
    controls.fontUpload.value = "";
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    $("#status").textContent = "Font rejected: the 2 MB local safety limit was exceeded.";
    controls.fontUpload.value = "";
    return;
  }
  fontDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const mime = file.name.toLowerCase().endsWith(".woff2") ? "font/woff2"
        : file.name.toLowerCase().endsWith(".woff") ? "font/woff"
          : file.name.toLowerCase().endsWith(".otf") ? "font/otf" : "font/ttf";
      resolve(String(reader.result).replace(/^data:[^;]*;/u, `data:${mime};`));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  $("#status").textContent = `Using ${file.name} locally · it will not be uploaded`;
  render();
});

$("#shuffle").addEventListener("click", () => { seedNonce += 1; render(); });
$("#download-svg").addEventListener("click", () => {
  current.svgs.forEach((svg, index) => download(svgBlob(svg), `inkwell-page-${index + 1}.svg`));
  $("#status").textContent = `Downloaded ${current.svgs.length} editable SVG page(s)`;
});
$("#download-png").addEventListener("click", async () => {
  for (let index = 0; index < current.svgs.length; index += 1) {
    const url = URL.createObjectURL(svgBlob(current.svgs[index]));
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth * 2;
    canvas.height = image.naturalHeight * 2;
    const context = canvas.getContext("2d");
    context.scale(2, 2);
    context.drawImage(image, 0, 0);
    URL.revokeObjectURL(url);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    download(blob, `inkwell-page-${index + 1}.png`);
  }
  $("#status").textContent = `Downloaded ${current.svgs.length} high-resolution PNG page(s)`;
});
$("#print").addEventListener("click", () => window.print());

render();
