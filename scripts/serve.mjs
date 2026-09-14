import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json" };

createServer(async (request, response) => {
  const rawPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const relative = rawPath === "/" ? "index.html" : rawPath.replace(/^\/+/, "");
  const file = normalize(join(root, relative));
  if (!file.startsWith(root)) { response.writeHead(403).end("Forbidden"); return; }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error("Not a file");
    response.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`Inkwell running at http://127.0.0.1:${port}`));
