import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const leggi = percorso => readFileSync(QUI + "../sito/" + percorso, "utf8");
const leggiRadice = percorso => readFileSync(QUI + "../" + percorso, "utf8");

test("pre-lancio collega il download MOX al canale firmato aggiornato", () => {
  const configurazione = leggi("js/config.js");
  const download = "https://api.moxtracker.app/mox/download.exe";
  assert.match(configurazione, new RegExp(download.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const home = leggi("index.html");
  assert.equal((home.match(new RegExp(`data-download href="${download}"`, "g")) || []).length, 2);
  assert.match(leggi("note-versione.html"), new RegExp(`data-download href="${download}"`));
  assert.match(configurazione, /RELEASE_MANIFEST_URL/);
  assert.match(leggi("js\/release-note.js"), /release\.versione/);
  assert.doesNotMatch(home, /data-download aria-disabled="true"/);
  // Il numero di versione scritto a mano nel pulsante invecchia a ogni
  // release: il 23/08/2026 il sito serviva gia' la 2.9.13 e i due pulsanti
  // dicevano ancora 2.9.12. L'URL e' stabile, il testo deve esserlo altrettanto.
  assert.match(home, /Scarica MOX per Windows/);
  assert.doesNotMatch(home, /Scarica MOX \d/);
});

test("pre-lancio espone beta, privacy e Draft anche nella navigazione mobile", () => {
  for (const pagina of ["index.html", "draft.html", "archetipo.html", "privacy.html"]) {
    const html = leggi(pagina);
    assert.match(html, /beta-banner/);
    assert.match(html, /privacy\.html/);
  }
  assert.match(leggi("index.html"), /id="nav-toggle"/);
  assert.match(leggi("css/site.css"), /\.nav-links\[data-open\]/);
  assert.doesNotMatch(leggi("css/site.css"), /nav-links a:nth-child\(n\+3\)/);
});

test("pre-lancio locale usa il proxy omonimo e produzione l'API pubblica", () => {
  assert.match(leggi("js/config.js"), /window\.location\.origin.*\/api/);
  assert.match(leggi("js/config.js"), /https:\/\/api\.moxtracker\.app/);
  assert.match(leggi("_headers"), /connect-src 'self' https:\/\/api\.moxtracker\.app/);
});

test("il monitor della beta controlla preview, API e CORS account", () => {
  const workflow = leggiRadice(".github/workflows/monitoraggio-beta.yml");
  const smoke = leggiRadice("strumenti/smoke_beta.mjs");
  assert.match(workflow, /MOX_SITE_URL: https:\/\/preview\.moxtracker\.pages\.dev/);
  assert.match(smoke, /access-control-request-method/);
  assert.match(smoke, /access-control-allow-credentials/);
  assert.match(smoke, /valoreOpzione\("--site"\)/);
  assert.match(smoke, /readFile\(new URL\("\.\.\/sito\/js\/config\.js"/);
});

test("pre-lancio compatta i matchup ancora non pubblicabili", () => {
  assert.match(leggi("js/render.js"), /is-unavailable/);
  assert.match(leggi("css/site.css"), /matchup-panel\.is-unavailable/);
});

test("homepage presenta Mox con due schermate reali e pagine di trasparenza", () => {
  const home = leggi("index.html");
  assert.match(home, /mox-draft-scelta\.png/);
  assert.match(home, /mox-draft-mazzo\.png/);
  assert.match(home, /id="home-games"/);
  assert.match(home, /id="home-drafts"/);
  assert.match(home, /cosa-invia-mox\.html/);
  assert.match(home, /note-versione\.html/);
  assert.match(home, /tiene il conto delle partite/);
  assert.match(home, /archivio di risultati e mazzi/);
  assert.match(home, /contributi anonimi alimentano le statistiche pubbliche/);
  assert.match(home, /condivisione con gli amici sarà una scelta separata/);
  assert.match(home, /Più persone scaricano e usano Mox/);
  assert.match(leggi("cosa-invia-mox.html"), /Player\.log/);
  assert.match(leggi("note-versione.html"), /Tutte le note di versione/);
  assert.match(leggi("download.html"), /Scarica Mox/);
  assert.match(leggi("download.html"), /data-download href="https:\/\/api\.moxtracker\.app\/mox\/download\.exe"/);
  assert.match(home, /Scarica Mox e contribuisci al Meta/);
});

test("il reset del Meta ripristina anche periodo, modalita e rank", () => {
  const main = leggi("js/main.js");
  assert.match(main, /state\.apiFilters = \{ formato: DEFAULT_FORMAT, rank: "", periodo: "30", modalita: "" \}/);
  assert.match(main, /#period-filter["']\)\.value = "30"/);
  assert.match(main, /#mode-filter["']\)\.value = ""/);
  assert.match(main, /#rank-min["']\)\.value = "0"/);
  assert.match(main, /#rank-max["']\)\.value = "5"/);
  assert.match(leggi("css/site.css"), /@media \(max-width: 1500px\)[\s\S]*?explorer-controls/);
});
