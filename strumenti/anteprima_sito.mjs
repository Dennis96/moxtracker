import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = resolve(process.env.MOX_SITO_DIR ||
  fileURLToPath(new URL("../.dist/sito", import.meta.url)));
const PORTA = Number(process.env.MOX_SITO_PORTA || 8790);
const API = String(process.env.MOX_API_ORIGIN || "https://api.moxtracker.app").replace(/\/$/, "");
// Banco sintetico facoltativo per verificare in locale Il mio MOX o una
// risposta del Meta che l'API pubblicata non ha ancora: risponde soltanto alle
// route elencate nel file JSON (dati inventati, fuori dalla build). Di norma
// la query non conta, salvo le chiavi scritte con la query; tutto il resto
// continua ad andare all'API.
const BANCO = process.env.MOX_BANCO_SINTETICO
  ? JSON.parse(await readFile(resolve(process.env.MOX_BANCO_SINTETICO), "utf8"))
  : null;
const TIPI = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);

function rispondi(res, stato, corpo, tipo = "text/plain; charset=utf-8") {
  res.writeHead(stato, {
    "content-type": tipo,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
  res.end(corpo);
}

async function inoltraApi(url, res) {
  const percorso = url.pathname.slice(4) || "/salute";
  // Una chiave con la query, scritta come la costruisce il sito, vince su
  // quella del solo percorso: serve a provare in locale il passaggio da un
  // vecchio link per impronta al gruppo Brew canonico.
  const conQuery = percorso + url.search;
  const chiave = !BANCO ? null
    : Object.prototype.hasOwnProperty.call(BANCO, conQuery) ? conQuery
      : Object.prototype.hasOwnProperty.call(BANCO, percorso) ? percorso : null;
  if (chiave) {
    rispondi(res, 200, JSON.stringify(BANCO[chiave]), "application/json; charset=utf-8");
    return;
  }
  try {
    const risposta = await fetch(API + percorso + url.search, {
      headers: { accept: "application/json" },
    });
    const corpo = Buffer.from(await risposta.arrayBuffer());
    rispondi(res, risposta.status, corpo, risposta.headers.get("content-type") || "application/json; charset=utf-8");
  } catch {
    rispondi(res, 502, JSON.stringify({ errore: "API pubblica non raggiungibile" }), "application/json; charset=utf-8");
  }
}

async function serveFile(url, res) {
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { rispondi(res, 400, "Percorso non valido"); return; }
  if (pathname.endsWith("/")) pathname += "index.html";
  else if (!extname(pathname)) pathname += ".html";
  const file = resolve(RADICE, "." + pathname);
  if (file !== RADICE && !file.startsWith(RADICE + sep)) {
    rispondi(res, 403, "Percorso non consentito"); return;
  }
  try {
    const corpo = await readFile(file);
    rispondi(res, 200, corpo, TIPI.get(extname(file).toLowerCase()) || "application/octet-stream");
  } catch {
    rispondi(res, 404, "Pagina non trovata");
  }
}

const server = createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    rispondi(res, 405, "Usa GET"); return;
  }
  const url = new URL(req.url || "/", `http://${req.headers.host || `127.0.0.1:${PORTA}`}`);
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) await inoltraApi(url, res);
  else await serveFile(url, res);
});

server.listen(PORTA, "127.0.0.1", () => {
  console.log(`Anteprima MOX pronta su http://127.0.0.1:${PORTA}`);
});
