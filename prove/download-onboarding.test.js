import { strict as assert } from "node:assert";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { zipUnicoDellaRelease } from "../sito/js/download.js";

const RADICE = fileURLToPath(new URL("..", import.meta.url));
const SITO = join(RADICE, "sito");
const leggi = (percorso) => readFileSync(join(SITO, percorso), "utf8");
const PAGINE = readdirSync(SITO).filter((nome) => nome.endsWith(".html"));

test("ogni CTA Scarica MOX passa dal resolver globale", () => {
  for (const pagina of PAGINE) {
    const html = leggi(pagina);
    for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
      if (!/Scarica MOX(?: per Windows)?/.test(match[2])) continue;
      assert.match(match[1], /\bdata-download\b/, `${pagina}: CTA senza data-download`);
      assert.match(match[1], /href="#download"/, `${pagina}: fallback inatteso`);
    }
    if (html.includes("class=\"nav-download\"")) {
      assert.match(html, /class="nav-download" data-download href="#download">Scarica MOX<\/a>/, pagina);
    }
  }

  const javascript = readdirSync(join(SITO, "js"))
    .filter((nome) => nome.endsWith(".js"))
    .map((nome) => leggi(`js/${nome}`)).join("\n");
  assert.equal((javascript.match(/preparaDownloadLatest\(\);/g) || []).length, 1,
    "il resolver globale deve essere inizializzato soltanto da site-shell.js");
  assert.match(leggi("js/site-shell.js"), /preparaDownloadLatest\(\);/);
  assert.match(leggi("js/download.js"), /new WeakSet\(\)/);
  assert.match(leggi("js/download.js"), /linkDownloadInizializzati\.has\(link\)/);
});

test("il resolver accetta soltanto l'unico ZIP della Latest Release", () => {
  const asset = { name: "MOX-2.11.0.zip", browser_download_url: "https://example.invalid/MOX-2.11.0.zip" };
  assert.equal(zipUnicoDellaRelease({ assets: [asset] }), asset);
  assert.equal(zipUnicoDellaRelease({ assets: [] }), null);
  assert.equal(zipUnicoDellaRelease({ assets: [asset, { ...asset, name: "altro.zip" }] }), null);
  assert.equal(zipUnicoDellaRelease({ assets: [{ name: "note.txt", browser_download_url: "x" }] }), null);
});

test("download.html e' la guida completa Scarica e inizia", () => {
  const html = leggi("download.html");
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /<h1 id="download-title">Scarica e inizia con MOX<\/h1>/);
  for (const sezione of [
    "Inizia in pochi minuti", "I tre strumenti", "Durante una partita",
    "Durante un Draft", "Mazzi e statistiche", "Consensi e privacy",
    "Account facoltativo", "Se Windows blocca MOX", "Serve aiuto?",
  ]) assert.match(html, new RegExp(sezione), sezione);

  for (const asset of [
    "assets/home/preview-contatore.webp", "assets/home/preview-draft.webp",
    "assets/home/preview-mazzi.webp", "assets/home/icon-contatore.png",
    "assets/home/icon-draft.png", "assets/home/icon-mazzi.png",
  ]) {
    assert.match(html, new RegExp(asset.replace(/[./-]/g, "\\$&")), asset);
    assert.equal(existsSync(join(SITO, asset)), true, asset);
  }

  assert.match(html, /href="\.\/download\.html">Download<\/a>/,
    "il footer deve continuare a portare alla guida");
  assert.doesNotMatch(html, /data-download[^>]*href="\.\/download\.html"/);
  assert.doesNotMatch(html, /(?:disabilita|disattiva) (?:Windows Defender|Smart App Control)/i);
  assert.match(html, /Non disabilitare Windows Defender o altre protezioni/);
});

test("la guida e' bilingue, responsive e non espone il vecchio filename", () => {
  const dizionario = JSON.parse(leggi("i18n/en.json"));
  for (const chiave of [
    "Scarica e inizia con MOX", "Inizia in pochi minuti", "I tre strumenti",
    "Durante una partita", "Durante un Draft", "Mazzi e statistiche",
    "Consensi e privacy", "Account facoltativo", "Se Windows blocca MOX",
    "Serve aiuto?",
  ]) assert.ok(dizionario[chiave], `manca EN: ${chiave}`);

  const css = leggi("css/site.css");
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.download-steps \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.download-howto, \.download-info-grid, \.download-support-grid \{ grid-template-columns: 1fr; \}/);
  const pubblico = readdirSync(SITO, { recursive: true })
    .filter((voce) => String(voce).match(/\.(?:html|js|css|json)$/))
    .map((voce) => readFileSync(join(SITO, voce), "utf8")).join("\n");
  assert.doesNotMatch(pubblico, /Mox-v2-beta[^\s"']*-con-python\.zip/);
});
