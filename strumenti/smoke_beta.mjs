import { readFile } from "node:fs/promises";

function valoreOpzione(nome) {
  const indice = process.argv.indexOf(nome);
  return indice >= 0 ? process.argv[indice + 1] : null;
}

// Durante la beta il comando senza parametri deve controllare la preview: la
// produzione si verifica solo passando intenzionalmente --site oppure una env.
const base = String(valoreOpzione("--site") || process.env.MOX_SITE_URL || "https://preview.moxtracker.pages.dev").replace(/\/$/, "");
const api = String(valoreOpzione("--api") || process.env.MOX_API_URL || "https://api.moxtracker.app").replace(/\/$/, "");
const configurazioneSito = await readFile(new URL("../sito/js/config.js", import.meta.url), "utf8");
const download = configurazioneSito.match(/^export const DOWNLOAD_URL = "([^"\r\n]+)";\r?$/m)?.[1];
const githubLatest = configurazioneSito.match(/^export const GITHUB_LATEST_RELEASE_API = "([^"\r\n]+)";\r?$/m)?.[1];
if (!download || !githubLatest) throw new Error("download MOX non configurato");
const controlli = [
  ["home", `${base}/`, /MOX/i],
  ["draft", `${base}/draft`, /Draft/i],
  ["account", `${base}/account`, /Account|Il mio MOX/i],
  ["supporto", `${base}/supporto`, /Supporto|Support/i],
  ["privacy", `${base}/privacy`, /Privacy/i],
  // Il testo e' tradotto a runtime: qui controlliamo l'asset inglese reale,
  // senza scambiare per guasto una frase che compare dopo il caricamento JS.
  ["inglese", `${base}/en/`, /<html\s+lang="en"/i],
  ["salute API", `${api}/salute`, /"stato"\s*:\s*"vivo"/i],
  ["meta API", `${api}/meta?formato=Standard`, /"partite_totali"/i],
  ["draft API", `${api}/draft/statistiche?periodo=30`, /"totali"/i],
  ["gate account", `${api}/account/me`, /accesso richiesto/i, 401],
];

let fallimenti = 0;
for (const [nome, url, atteso, statoAtteso = 200] of controlli) {
  try {
    const risposta = await fetch(url, { redirect: "follow",
      headers: { accept: "text/html,application/json;q=0.9" } });
    const corpo = await risposta.text();
    const valido = risposta.status === statoAtteso && atteso.test(corpo);
    console.log(`${valido ? "OK" : "ERRORE"} ${nome}: HTTP ${risposta.status}`);
    if (!valido) fallimenti += 1;
  } catch (errore) {
    fallimenti += 1;
    console.error(`ERRORE ${nome}: ${errore.message}`);
  }
}

const origineSito = new URL(base).origin;
if (!["localhost", "127.0.0.1", "::1"].includes(new URL(base).hostname)) {
  try {
    const risposta = await fetch(`${api}/account/me`, {
      method: "OPTIONS",
      headers: {
        origin: origineSito,
        "access-control-request-method": "GET",
      },
    });
    const valido = risposta.status === 204 &&
      risposta.headers.get("access-control-allow-origin") === origineSito &&
      risposta.headers.get("access-control-allow-credentials") === "true";
    console.log(`${valido ? "OK" : "ERRORE"} CORS account: HTTP ${risposta.status}`);
    if (!valido) fallimenti += 1;
  } catch (errore) {
    fallimenti += 1;
    console.error(`ERRORE CORS account: ${errore.message}`);
  }
}

try {
  const release = await fetch(githubLatest, { headers: { accept: "application/vnd.github+json" } });
  const corpo = await release.json().catch(() => null);
  const assetZip = Array.isArray(corpo?.assets) && corpo.assets.some((asset) =>
    /\.zip$/i.test(String(asset?.name || "")) && asset?.browser_download_url);
  console.log(`${release.ok && assetZip ? "OK" : "ERRORE"} download GitHub Latest: HTTP ${release.status}`);
  if (!release.ok || !assetZip) fallimenti += 1;
} catch (errore) {
  fallimenti += 1;
  console.error(`ERRORE download GitHub Latest: ${errore.message}`);
}
if (fallimenti) process.exitCode = 1;
