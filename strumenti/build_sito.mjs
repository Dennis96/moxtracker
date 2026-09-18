import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RADICE = fileURLToPath(new URL("..", import.meta.url));
const SORGENTE = join(RADICE, "sito");
const USCITA = join(RADICE, ".dist", "sito");
const ORIGINE_PUBBLICA = "https://moxtracker.app";
const IMMAGINE_SOCIAL = `${ORIGINE_PUBBLICA}/assets/social/mox-social-card.png`;
const PAGINE_PUBBLICHE = new Set([
  "index.html", "meta.html", "draft.html", "download.html", "archetipo.html", "account.html",
  "supporto.html", "privacy.html", "cosa-invia-mox.html", "note-versione.html",
]);
const PAGINE_SEO = new Set([
  "index.html", "meta.html", "draft.html", "download.html", "supporto.html",
  "privacy.html", "cosa-invia-mox.html", "note-versione.html",
]);
const ESTENSIONI_VERSIONATE = new Set([
  ".css", ".ico", ".js", ".png", ".svg", ".webp", ".woff2",
]);

async function fileDentro(cartella) {
  const risultati = [];
  for (const voce of await readdir(cartella, { withFileTypes: true })) {
    // Wrangler può creare cache operative dentro la cartella passata a Pages.
    // Non sono sorgenti del sito e non devono cambiare build ID o finire online.
    if (voce.name === ".wrangler") continue;
    const percorso = join(cartella, voce.name);
    if (voce.isDirectory()) risultati.push(...await fileDentro(percorso));
    else if (voce.isFile()) risultati.push(percorso);
  }
  return risultati.sort((a, b) => a.localeCompare(b));
}

function estensione(percorso) {
  const pulito = percorso.split(/[?#]/, 1)[0];
  const punto = pulito.lastIndexOf(".");
  return punto < 0 ? "" : pulito.slice(punto).toLowerCase();
}

function versione(percorso, buildId) {
  if (!percorso.startsWith(".") || !ESTENSIONI_VERSIONATE.has(estensione(percorso))) {
    return percorso;
  }
  const [senzaFrammento, frammento] = percorso.split("#", 2);
  const [pathname, query = ""] = senzaFrammento.split("?", 2);
  const parametri = new URLSearchParams(query);
  parametri.set("v", buildId);
  const nuovaQuery = parametri.toString();
  return pathname + (nuovaQuery ? `?${nuovaQuery}` : "") +
    (frammento === undefined ? "" : `#${frammento}`);
}

function trasforma(testo, tipo, buildId) {
  let risultato = testo;
  if (tipo === ".html") {
    risultato = risultato.replace(
      /((?:src|href)\s*=\s*["'])(\.{1,2}\/[^"']+)(["'])/gi,
      (_, prima, percorso, dopo) => prima + versione(percorso, buildId) + dopo,
    );
  }
  if (tipo === ".js") {
    risultato = risultato.replace(
      /((?:from\s+|import\s*\(\s*)["'])(\.{1,2}\/[^"']+)(["'])/g,
      (_, prima, percorso, dopo) => prima + versione(percorso, buildId) + dopo,
    );
  }
  if (tipo === ".css") {
    risultato = risultato.replace(
      /(url\(\s*["']?)(\.{1,2}\/[^"')]+)(["']?\s*\))/gi,
      (_, prima, percorso, dopo) => prima + versione(percorso, buildId) + dopo,
    );
  }
  return risultato;
}

function traduciTesto(testo, traduzioni) {
  const traduci = (valore) => {
    const iniziale = valore.match(/^\s*/)?.[0] || "";
    const finale = valore.match(/\s*$/)?.[0] || "";
    const chiave = valore.trim();
    return chiave && traduzioni[chiave] ? iniziale + traduzioni[chiave] + finale : valore;
  };
  return testo
    .replace(/<html\s+lang="it"/, '<html lang="en"')
    .replace(/>([^<>]+)</g, (_, valore) => `>${traduci(valore)}<`)
    .replace(/\b(aria-label|title|placeholder|content|alt)="([^"]+)"/g,
      (_, attributo, valore) => `${attributo}="${traduzioni[valore] || valore}"`);
}

function paginaInglese(testo, traduzioni, nome) {
  const profondita = nome.split("/").length;
  const prefisso = "../".repeat(profondita);
  let risultato = traduciTesto(testo, traduzioni);
  risultato = risultato.replace(
    /((?:src|href)=["'])(\.\/(?:assets|css|js)\/)/gi,
    (_, prima, percorso) => prima + prefisso + percorso.slice(2),
  );
  risultato = risultato.replace(
    /(<\/head>)/i,
    `  <script type="module" src="${prefisso}js/translate.js"></script>\n$1`,
  );
  return risultato;
}

function percorsoPubblico(nome, lingua) {
  const base = nome === "index.html" ? "" : nome.slice(0, -5);
  if (lingua === "en") return base ? `/en/${base}` : "/en/";
  return base ? `/${base}` : "/";
}

function urlPubblico(nome, lingua) {
  return new URL(percorsoPubblico(nome, lingua), ORIGINE_PUBBLICA).href;
}

function escapeAttributo(valore) {
  return valore
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function estraiTitolo(testo) {
  return testo.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "MOX Arena Assistant";
}

function estraiDescrizione(testo) {
  return testo.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1]?.trim() || "";
}

function aggiungiSeo(testo, nome, lingua) {
  if (!PAGINE_SEO.has(nome)) return testo;
  const titolo = escapeAttributo(estraiTitolo(testo));
  const descrizione = escapeAttributo(estraiDescrizione(testo));
  const canonical = urlPubblico(nome, lingua);
  const italiano = urlPubblico(nome, "it");
  const inglese = urlPubblico(nome, "en");
  const locale = lingua === "en" ? "en_US" : "it_IT";
  const alternativo = lingua === "en" ? "it_IT" : "en_US";
  const meta = [
    `<link rel="canonical" href="${canonical}">`,
    `<link rel="alternate" hreflang="it" href="${italiano}">`,
    `<link rel="alternate" hreflang="en" href="${inglese}">`,
    `<link rel="alternate" hreflang="x-default" href="${italiano}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="MOX">`,
    `<meta property="og:locale" content="${locale}">`,
    `<meta property="og:locale:alternate" content="${alternativo}">`,
    `<meta property="og:title" content="${titolo}">`,
    `<meta property="og:description" content="${descrizione}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image" content="${IMMAGINE_SOCIAL}">`,
    `<meta property="og:image:alt" content="MOX Arena Assistant">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${titolo}">`,
    `<meta name="twitter:description" content="${descrizione}">`,
    `<meta name="twitter:image" content="${IMMAGINE_SOCIAL}">`,
  ].map((riga) => `  ${riga}`).join("\n");
  return testo.replace(/(<\/head>)/i, `${meta}\n$1`);
}

function escapeXml(valore) {
  return valore
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function generaSitemap() {
  const righe = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];
  for (const nome of PAGINE_SEO) {
    const italiano = urlPubblico(nome, "it");
    const inglese = urlPubblico(nome, "en");
    for (const corrente of [italiano, inglese]) {
      righe.push(
        "  <url>",
        `    <loc>${escapeXml(corrente)}</loc>`,
        `    <xhtml:link rel="alternate" hreflang="it" href="${escapeXml(italiano)}" />`,
        `    <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(inglese)}" />`,
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(italiano)}" />`,
        "  </url>",
      );
    }
  }
  righe.push("</urlset>", "");
  return righe.join("\n");
}

function shaGit() {
  try {
    return execFileSync("git", [
      "-c", `safe.directory=${RADICE.replaceAll("\\", "/")}`,
      "rev-parse", "HEAD",
    ], { cwd: RADICE, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function intestazioniCache(nomiHtml) {
  const pagine = new Set(["/"]);
  for (const nome of nomiHtml) {
    const base = basename(nome, ".html");
    pagine.add(`/${nome.replaceAll(sep, "/")}`);
    if (base !== "index") pagine.add(`/${nome.slice(0, -5).replaceAll(sep, "/")}`);
    else {
      const cartella = dirname(nome).replaceAll(sep, "/");
      if (cartella !== ".") pagine.add(`/${cartella}/`);
    }
  }
  const noStore = [...pagine].sort().map((pagina) =>
    `${pagina}\n  Cache-Control: no-store`).join("\n\n");
  return `${noStore}\n\n/js/*\n  Cache-Control: public, max-age=31556952, immutable\n\n` +
    `/css/*\n  Cache-Control: public, max-age=31556952, immutable\n\n` +
    `/assets/*\n  Cache-Control: public, max-age=31556952, immutable\n`;
}

async function main() {
  const sorgenti = await fileDentro(SORGENTE);
  const hashSorgente = createHash("sha256");
  const contenuti = new Map();
  for (const file of sorgenti) {
    const relativo = relative(SORGENTE, file).replaceAll(sep, "/");
    const corpo = await readFile(file);
    contenuti.set(relativo, corpo);
    hashSorgente.update(relativo).update("\0").update(corpo).update("\0");
  }
  const sorgenteSha256 = hashSorgente.digest("hex");
  const buildId = sorgenteSha256.slice(0, 16);
  const traduzioni = JSON.parse(contenuti.get("i18n/en.json")?.toString("utf8") || "{}");

  const uscitaRisolta = resolve(USCITA);
  const radiceRisolta = resolve(RADICE);
  if (!uscitaRisolta.startsWith(radiceRisolta + sep) || basename(uscitaRisolta) !== "sito") {
    throw new Error("cartella di build non sicura");
  }
  await rm(uscitaRisolta, { recursive: true, force: true });
  await mkdir(uscitaRisolta, { recursive: true });

  const hashFile = {};
  const html = [];
  for (const [relativo, corpo] of contenuti) {
    const destinazione = join(uscitaRisolta, relativo);
    await mkdir(dirname(destinazione), { recursive: true });
    let uscita = corpo;
    const tipo = estensione(relativo);
    if ([".css", ".html", ".js"].includes(tipo)) {
      let testo = corpo.toString("utf8");
      if (tipo === ".html") testo = aggiungiSeo(testo, relativo, "it");
      uscita = Buffer.from(trasforma(testo, tipo, buildId));
    }
    if (relativo === "_headers") continue;
    await writeFile(destinazione, uscita);
    hashFile[relativo] = createHash("sha256").update(uscita).digest("hex");
    if (tipo === ".html") html.push(relativo);
  }

  for (const nome of PAGINE_PUBBLICHE) {
    const corpo = contenuti.get(nome);
    if (!corpo) throw new Error(`pagina pubblica mancante: ${nome}`);
    const relativo = `en/${nome}`;
    const destinazione = join(uscitaRisolta, relativo);
    await mkdir(dirname(destinazione), { recursive: true });
    const tradotta = aggiungiSeo(paginaInglese(corpo.toString("utf8"), traduzioni, nome), nome, "en");
    const uscita = Buffer.from(trasforma(tradotta, ".html", buildId));
    await writeFile(destinazione, uscita);
    hashFile[relativo] = createHash("sha256").update(uscita).digest("hex");
    html.push(relativo);
  }

  const sitemap = generaSitemap();
  await writeFile(join(uscitaRisolta, "sitemap.xml"), sitemap);
  hashFile["sitemap.xml"] = createHash("sha256").update(sitemap).digest("hex");

  const headersBase = (contenuti.get("_headers") || Buffer.from("")).toString("utf8").trimEnd();
  const headers = `${headersBase}\n\n# Cache generata dalla build ${buildId}\n` +
    intestazioniCache(html);
  await writeFile(join(uscitaRisolta, "_headers"), headers);
  hashFile._headers = createHash("sha256").update(headers).digest("hex");

  const manifesto = {
    versione: 1,
    build_id: buildId,
    sorgente_sha256: sorgenteSha256,
    commit_git: shaGit(),
    file: Object.fromEntries(Object.entries(hashFile).sort(([a], [b]) => a.localeCompare(b))),
  };
  await writeFile(join(uscitaRisolta, "build-manifest.json"),
    JSON.stringify(manifesto, null, 2) + "\n");
  console.log(`Build sito ${buildId}: ${Object.keys(hashFile).length} file in ${uscitaRisolta}`);
}

await main();
