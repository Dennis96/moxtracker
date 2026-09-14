import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Regressioni del redesign congelato in passaggi/sito/SPEC-SITO-MOX-REDESIGN-2026-09-13.md.
const QUI = fileURLToPath(new URL(".", import.meta.url));
const leggi = (percorso) => readFileSync(QUI + "../sito/" + percorso, "utf8");
const leggiRadice = (percorso) => readFileSync(QUI + "../" + percorso, "utf8");

const PAGINE = ["index.html", "meta.html", "draft.html", "download.html", "archetipo.html", "account.html",
  "supporto.html", "privacy.html", "cosa-invia-mox.html", "note-versione.html", "admin.html"];

function eseguiLegacy(hash, search = "") {
  const chiamate = [];
  const contesto = { location: { hash, search, replace: (url) => chiamate.push(url) } };
  contesto.globalThis = contesto;
  vm.runInNewContext(leggi("js/meta-legacy.js"), contesto);
  return chiamate;
}

test("i vecchi ingressi al Meta della Home portano a meta.html senza cicli", () => {
  assert.deepEqual(eseguiLegacy("#meta"), ["./meta.html"]);
  assert.deepEqual(eseguiLegacy("#matchup", "?x=1"), ["./meta.html?x=1#matchup"]);
  assert.deepEqual(eseguiLegacy("#metodo"), ["./meta.html#metodo"]);
  assert.deepEqual(eseguiLegacy(""), []);
  assert.deepEqual(eseguiLegacy("#scarica"), []);
  assert.match(leggi("index.html"), /<script src="\.\/js\/meta-legacy\.js"><\/script>/);
  assert.doesNotMatch(leggi("meta.html"), /meta-legacy/, "la pagina Meta non deve reindirizzare");
});

test("la build pubblica meta.html anche in inglese e la navigazione punta a meta.html", () => {
  assert.match(leggiRadice("strumenti/build_sito.mjs"), /"meta\.html"/);
  assert.match(leggi("js/site-shell.js"), /meta: "\.\/meta\.html"/);
  assert.match(leggiRadice("strumenti/smoke_beta.mjs"), /\$\{base\}\/meta`/);
  assert.match(leggiRadice("strumenti/smoke_beta.mjs"), /\$\{base\}\/en\/meta`/);
});

test("ogni pagina ha la testata del redesign, la CTA di download e i link Meta nuovi", () => {
  for (const pagina of PAGINE) {
    const html = leggi(pagina);
    assert.match(html, /href="\.\/css\/redesign\.css"/, pagina);
    assert.match(html, /class="nav-download" href="\.\/download\.html">Scarica MOX</, pagina);
    assert.doesNotMatch(html, /index\.html#meta/, `${pagina}: link Meta vecchio`);
    // In meta.html #meta è il proprio contenuto (skip link), altrove sarebbe il vecchio Meta.
    if (pagina !== "meta.html") assert.doesNotMatch(html, /href="#meta"/, `${pagina}: link Meta vecchio`);
    // La CSP ha style-src 'self': uno stile inline nel markup verrebbe bloccato.
    assert.doesNotMatch(html, /\sstyle="/, `${pagina}: stile inline bloccato dalla CSP`);
  }
  const css = leggi("css/redesign.css");
  assert.match(css, /@font-face[\s\S]*?url\("\.\.\/assets\/fonts\/spectral-600-latin\.woff2"\)/);
  assert.match(css, /@font-face[\s\S]*?url\("\.\.\/assets\/fonts\/hanken-grotesk-latin\.woff2"\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
});

test("l'Explorer vive in meta.html e non nella Home", () => {
  const meta = leggi("meta.html");
  for (const id of ["format-filter", "rank-min", "rank-max", "rank-label", "rank-ticks", "archetype-search",
    "strategy-filter", "clear-local-filters", "meta-body", "meta-count", "meta-updated", "meta-threshold",
    "meta-visible", "matchup-state", "classification-help"]) {
    assert.match(meta, new RegExp(`id="${id}"`), id);
  }
  assert.match(meta, /name="periodo" value="30" checked/);
  assert.match(meta, /name="modalita" value="" checked/);
  assert.match(meta, /data-color="W"/);
  assert.match(meta, /js\/main\.js/);
  assert.match(meta, /data-page="meta"/);
  assert.match(meta, /<h1[^>]*>Meta Explorer<\/h1>/);
  const home = leggi("index.html");
  assert.doesNotMatch(home, /id="meta-body"|js\/main\.js|id="format-filter"/);
  assert.match(home, /href="\.\/meta\.html"/);
  const main = leggi("js/main.js");
  assert.doesNotMatch(main, /home-games|home-drafts|home-updated/);
  assert.match(main, /function valoreSegmento\(/);
});

test("sotto soglia la tabella dice quante partite mancano", () => {
  const render = leggi("js/render.js");
  assert.match(render, /export function partiteMancanti\(/);
  assert.match(render, /ne mancano/);
  assert.doesNotMatch(render, /deck-mark/);
  assert.match(render, /aria-sort/);
  assert.match(leggi("js/translate.js"), /ne mancano/);
});

test("la Home segue la specifica e scarica la release Latest", () => {
  const home = leggi("index.html");
  assert.match(home, /<h1[^>]*>Tracker, Assistente al Draft, mazzi e statistiche per MTG Arena\.<\/h1>/);
  assert.match(home, /Windows · Beta pubblica · Download da GitHub/);
  assert.equal((home.match(/data-download href="#download">Scarica MOX</g) || []).length, 2);
  assert.match(home, /js\/home\.js/);
  for (const sezione of ["Cosa fa MOX", "MOX sul web", "In sviluppo", "Pianificato"]) assert.match(home, new RegExp(sezione));
  for (const momento of ["Durante la partita", "Durante il Draft", "Dopo il Draft", "Dopo le partite"]) {
    assert.match(home, new RegExp(`>${momento}<`));
  }
  assert.doesNotMatch(home, /Tauri|Proposta di pagina|Gioca meglio|research-teaser/);
  assert.match(leggi("js/home.js"), /preparaDownloadLatest\(\)/);
});

test("archetipo: ordine della specifica e contratto URL invariato", () => {
  const html = leggi("archetipo.html");
  const ordine = ["detail-path", "detail-summary", "variants-panel", "detail-grid"].map((id) => html.indexOf(`id="${id}"`));
  assert.ok(ordine.every((i) => i > 0), ordine.join(","));
  assert.deepEqual([...ordine].sort((a, b) => a - b), ordine);
  assert.match(html, /id="variants-split"/);
  assert.match(html, /id="trend-panel"/);
  const js = leggi("js/archetype.js");
  for (const p of ["formato", "rank", "periodo", "modalita", "impronta", "id", "variante"]) {
    assert.match(js, new RegExp(`params\\.get\\("${p}"\\)`), p);
  }
  assert.match(js, /export function ripartizioneVarianti\(/);
  assert.match(js, /new URL\("\.\/meta\.html"/);
  assert.doesNotMatch(js, /Apri variante →/);
});

test("profilo della lista con etichette per esteso", () => {
  const js = leggi("js/deck-profile.js");
  assert.match(js, /"Copie per tipo di carta"/);
  assert.match(js, /"Copie per colore d'identità"/);
  assert.match(js, /copie con il/);
  assert.doesNotMatch(js, /"Colori del mazzo"/);
});

test("Draft: prima il prodotto, poi i dati, poi il metodo", () => {
  const html = leggi("draft.html");
  const i = (testo) => html.indexOf(testo);
  assert.match(html, /<h1[^>]*>Assistente al Draft e dati Limited<\/h1>/);
  assert.ok(i(">Nel programma<") > 0 && i(">Nel programma<") < i(">Dati Limited sul sito<"));
  assert.ok(i(">Dati Limited sul sito<") < i(">Il metodo<"));
  assert.ok(i(">Il metodo<") < i(">Le garanzie del metodo<"));
  assert.doesNotMatch(html, /Next Gen/);
});

test("Il mio MOX: cinque schede accessibili e nessuna funzione persa", () => {
  const html = leggi("account.html");
  const schede = [...html.matchAll(/role="tab"[^>]*aria-controls="scheda-([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(schede, ["panoramica", "mazzi", "partite", "draft", "account"]);
  for (const id of ["account-loading", "account-login", "account-dashboard", "account-name", "total-matches",
    "recent-form", "last-send", "decks", "rank-chart", "opponent-stats", "draft-sessions", "matches",
    "matches-section", "filter-deck", "create-link", "devices", "tickets", "admin-link", "logout",
    "delete-account", "detail-dialog", "overview-decks", "overview-matches"]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.doesNotMatch(html, /Dati di esempio/);
  const tabs = leggi("js/account-tabs.js");
  assert.match(tabs, /ArrowRight/);
  assert.match(tabs, /aria-selected/);
  assert.match(tabs, /export function mostraScheda/);
  assert.match(leggi("js/account.js"), /mostraScheda\("partite"\)/);
});

// Nomi propri e sigle che restano uguali in inglese.
const NEUTRI = new Set(["MOX", "Meta", "Draft", "Account", "Home", "Privacy", "GitHub", "Download", "MOX home", "Footer",
  "W", "U", "B", "R", "G", "BO1", "BO3", "BO1 + BO3", "Rank", "Record", "Matchup", "Set", "Win rate", "Meta Explorer",
  "Premier Draft", "Quick Draft", "Traditional Draft", "Pick-Two Draft", "MOX Research", "Draft Assistant Next Gen",
  "Standard", "Menu", "Meta Explorer — MOX Arena Assistant"]);

test("ogni testo e attributo delle pagine ridisegnate ha la traduzione inglese", () => {
  const en = JSON.parse(leggi("i18n/en.json"));
  const mancanti = [];
  for (const pagina of ["index.html", "meta.html", "archetipo.html", "draft.html", "account.html"]) {
    const html = leggi(pagina).replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
    const testi = [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1].trim());
    const attributi = [...html.matchAll(/\b(?:aria-label|title|placeholder|alt|content)="([^"]+)"/g)].map((m) => m[1].trim());
    for (const testo of new Set([...testi, ...attributi])) {
      if (!/[a-zà-ù]/i.test(testo) || NEUTRI.has(testo) || /^#|^width=/.test(testo)) continue;
      if (!en[testo]) mancanti.push(`${pagina}: ${testo}`);
    }
  }
  assert.deepEqual(mancanti, []);
});

test("il ritorno al Meta conserva i filtri e i rank sono in italiano", () => {
  const archetipo = leggi("js/archetype.js");
  assert.match(archetipo, /for \(const nome of \["formato", "periodo", "modalita", "rank"\]\)/);
  assert.match(archetipo, /#detail-change-filters/);
  assert.match(leggi("js/main.js"), /function applicaFiltriDaUrl\(/);
  assert.match(leggi("js/config.js"), /export function nomeRank\(/);
  assert.match(leggi("js/config.js"), /Mythic: "Mitico"/);
});

test("i testi composti dal JavaScript nascono già nella lingua della pagina", () => {
  const archetipo = leggi("js/archetype.js");
  assert.doesNotMatch(archetipo, /altre\.innerHTML/);
  assert.match(archetipo, /Observed variant #/);
  assert.match(archetipo, /aggregated \$\{partite === 1/);
  assert.match(leggi("js/account.js"), /Open match \$\{id\}/);
  // La query di meta.html segue i filtri scelti: ricaricando si ritrovano quelli.
  assert.match(leggi("js/main.js"), /history\.replaceState/);
});

test("il banco sintetico dell'anteprima resta fuori dal sito pubblicato", () => {
  const anteprima = leggiRadice("strumenti/anteprima_sito.mjs");
  assert.match(anteprima, /MOX_BANCO_SINTETICO/);
  const banco = JSON.parse(leggiRadice("prove/fixtures/account-sintetico.json"));
  assert.ok(Object.keys(banco).every((percorso) => percorso.startsWith("/account/")));
});
