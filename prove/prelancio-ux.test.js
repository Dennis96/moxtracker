// Cleanup UX pre-launch (21/09/2026): le sei correzioni nate dalla QA manuale.
//
// Sono prove di contratto pubblico: come il sito si presenta a chi lo apre.
// Ognuna difende una decisione di prodotto, non un dettaglio di stile.

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { nomeReleasePubblico } from "../sito/js/format.js";
import { SOGLIA_SCONTRI, SOGLIA_SCONTRI_SOLIDA, leggiScontri } from "../src/lettura.js";
import { creaFintoD1 } from "./finto-d1.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const leggi = (percorso) => readFileSync(QUI + "../sito/" + percorso, "utf8");
const SCHEMA = QUI + "../schema.sql";

// --- 1. Download: tre card, una fila sola ------------------------------------

test("le tre card del Download hanno la stessa struttura e la stessa altezza", () => {
  const html = leggi("download.html");
  const card = [...html.matchAll(/<article class="panel">([\s\S]*?)<\/article>/g)].map((m) => m[1]);
  assert.equal(card.length, 3, "i passi restano tre");
  // Stessa struttura: numero del passo, titolo, una spiegazione. Se una card
  // avesse un elemento in piu' la fila si romperebbe di nuovo.
  for (const [indice, corpo] of card.entries()) {
    assert.match(corpo, new RegExp(`^<span>${indice + 1}</span><h2>[^<]+</h2><p>[^<]+</p>$`),
      `card ${indice + 1}`);
  }
  const css = leggi("css/site.css");
  const griglia = css.match(/\.download-steps \{[^}]*\}/)[0];
  const articolo = css.match(/\.download-steps article \{[^}]*\}/)[0];
  assert.match(griglia, /align-items: stretch/, "la fila si allinea in altezza");
  assert.match(articolo, /display: flex/);
  assert.match(articolo, /flex-direction: column/);
  assert.match(articolo, /height: 100%/);
  // L'altezza minima fissa era il difetto: bastava un testo piu' lungo - o una
  // traduzione - perche' una sola card crescesse e sfalsasse le altre.
  assert.doesNotMatch(articolo, /min-height/);
  // E l'altro difetto, quello che le faceva partire da altezze diverse:
  // `.panel + .panel` in redesign.css distanzia i pannelli impilati, e qui
  // spingeva in basso la seconda e la terza card di 24px.
  assert.match(leggi("css/redesign.css"), /\.panel \+ \.panel \{ margin-top: 24px; \}/,
    "se la regola generica cambia, questa correzione va rivista");
  assert.match(leggi("css/redesign.css"), /\.download-steps > \.panel \+ \.panel \{ margin-top: 0; \}/);
  // I figli restano larghi quanto la card, come nel layout a blocchi di prima:
  // `align-items: flex-start` li restringerebbe al contenuto.
  assert.doesNotMatch(articolo, /align-items: flex-start/);
  // A schermo stretto tornano una sotto l'altra da sole.
  assert.match(css, /\.download-steps \{ grid-template-columns: 1fr; \}/);
});

// --- 2. Il nome pubblico della release ---------------------------------------

test("il nome pubblico di una release e' sempre «MOX Beta x.y.z»", () => {
  assert.equal(nomeReleasePubblico("mox-v2-beta2.11.0"), "MOX Beta 2.11.0");
  assert.equal(nomeReleasePubblico("2 beta 2.11.0"), "MOX Beta 2.11.0");
  assert.equal(nomeReleasePubblico("v2.11.1"), "MOX Beta 2.11.1");
  assert.equal(nomeReleasePubblico("MOX 2 beta 2.9.24"), "MOX Beta 2.9.24");
  assert.equal(nomeReleasePubblico("2.11"), "MOX Beta 2.11");
  // Senza un numero riconoscibile non si inventa un nome, e soprattutto non si
  // ripiega sul tag tecnico.
  assert.equal(nomeReleasePubblico("latest"), null);
  assert.equal(nomeReleasePubblico(""), null);
  assert.equal(nomeReleasePubblico(null), null);
  assert.equal(nomeReleasePubblico(undefined), null);
});

test("senza un numero riconoscibile le pagine non restano sul messaggio di attesa", () => {
  // Il difetto da evitare: `nomeReleasePubblico` torna null e il testo iniziale
  // «Controllo la release Windows corrente...» resta a schermo per sempre.
  const note = leggi("js/release-note.js");
  assert.match(note, /host\.textContent = nome/);
  assert.match(note, /La release Windows più recente è quella collegata qui sotto\./);
  assert.doesNotMatch(note, /if \(nome\) host\.textContent/);
  const download = leggi("js/download.js");
  assert.match(download, /if \(!nome\) \{/);
  const en = JSON.parse(leggi("i18n/en.json"));
  assert.ok(en["La release Windows più recente è quella collegata qui sotto."]);
});

test("la nota dei Draft senza risultati sta su una riga sua", () => {
  // `.personal-grid` e' una griglia a tre colonne: una nota senza regola
  // propria prenderebbe una colonna e si leggerebbe come una card vuota.
  assert.match(leggi("css/account-support.css"),
    /\.personal-grid > \.detail-note \{ grid-column: 1 \/ -1; margin: 0; \}/);
  assert.ok(leggi("js/account.js").includes('nodo("p", "detail-note",'));
});

test("nessuna pagina mostra il tag tecnico di GitHub", () => {
  const download = leggi("js/download.js");
  const note = leggi("js/release-note.js");
  for (const sorgente of [download, note]) {
    assert.match(sorgente, /nomeReleasePubblico/);
  }
  // Il tag e il campo del manifesto passano dal formatter, mai dritti a schermo.
  assert.doesNotMatch(download, /\$\{versione \|\| asset\.name\}/);
  assert.doesNotMatch(note, /\$\{release\.versione\}/);
  // E nei testi statici non resta scritto da nessuna parte.
  for (const pagina of ["index.html", "download.html", "note-versione.html", "supporto.html",
    "privacy.html", "cosa-invia-mox.html"]) {
    assert.doesNotMatch(leggi(pagina), /mox-v2-beta|2 beta 2\./, pagina);
  }
});

// --- 3. Pagina Draft ---------------------------------------------------------

test("la pagina Draft non chiede piu' le statistiche Limited", () => {
  const api = leggi("js/api.js");
  assert.doesNotMatch(api, /fetchStatisticheDraft/,
    "senza consumatori la chiamata non resta nel bundle");
  assert.doesNotMatch(leggi("draft.html"), /draft\/statistiche|js\/draft\.js/);
});

// --- 4. Account --------------------------------------------------------------

test("l'Account non mostra piu' il confronto con gli archetipi avversari", () => {
  const html = leggi("account.html");
  const js = leggi("js/account.js");
  assert.doesNotMatch(html, /Contro gli archetipi|opponent-stats|opponent-summary/);
  assert.doesNotMatch(js, /renderAvversari|opponent-stat-row/);
  // Niente conteggio «riconosciuti / non classificabili» da nessuna parte.
  assert.doesNotMatch(js, /non classificabili/);
  assert.doesNotMatch(html, /non classificabili/);
  // Le cinque schede restano cinque: non si e' persa una sezione intera.
  const schede = [...html.matchAll(/role="tab"[^>]*aria-controls="scheda-([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(schede, ["panoramica", "mazzi", "partite", "draft", "account"]);
});

// --- 5. Account Draft: niente doppioni, niente euristiche --------------------

test("nel tab Draft restano le tracce vere, e i risultati solo dai link esatti", () => {
  const js = leggi("js/account.js");
  const render = js.match(/function renderDraft\(\)[\s\S]*?\n\}/)[0];
  // La fonte e' una sola: le tracce del dashboard. Le sessioni ricostruite per
  // vicinanza cronologica non entrano piu' nell'elenco.
  assert.match(render, /ordinaVociDraft\(\[\], stato\.dashboard\.draft\)/);
  assert.doesNotMatch(js, /sessioni_limited/);
  assert.doesNotMatch(js, /Partite Limited senza traccia/);
  // Il record esce dai campi che il server riempie dai collegamenti esatti, e
  // il frontend non prova a dedurlo.
  assert.match(render, /Number\(draft\.vittorie \|\| 0\)/);
  assert.match(render, /Number\(draft\.sconfitte \|\| 0\)/);
  assert.match(render, /I risultati compaiono quando MOX pu/);
  // Nessuna euristica di accoppiamento nel frontend: niente finestre temporali,
  // niente confronti di set o di evento per decidere che due cose sono la stessa.
  assert.doesNotMatch(js, /12 \* 60 \* 60 \* 1000|ore di distanza|stessa sessione/);
});

test("il collegamento fra partita e Draft resta deterministico lato server", async () => {
  const src = readFileSync(QUI + "../src/draft.js", "utf8");
  const collega = src.match(/export async function collegaPartiteDraft[\s\S]*?\n\}/)[0];
  // Si collega solo per identificativo: l'impronta HMAC che il client calcola
  // dal `draftId` di Arena. Mai per orario, set, formato o record.
  assert.match(collega, /SELECT id FROM draft WHERE impronta_arena = \?/);
  assert.match(collega, /stringaHex\(partita\.draft, 64\)/);
  assert.doesNotMatch(collega, /quando|ricevuta|set_code|formato|BETWEEN/);
});

// --- 6. Matchup: 30 pubblicabile, 100 piu' solido ---------------------------

test("la soglia dei matchup e' 30 per pubblicare, 100 per dire «solido»", async () => {
  assert.equal(SOGLIA_SCONTRI, 30);
  assert.equal(SOGLIA_SCONTRI_SOLIDA, 100);
  const db = creaFintoD1(SCHEMA);
  const esito = await leggiScontri(db, new URL("https://x.invalid/scontri?formato=Standard"));
  assert.equal(esito.corpo.soglia_coppia, 30);
  assert.equal(esito.corpo.soglia_coppia_solida, 100);
  // La matrice non c'e' ancora, e il motivo resta scritto nella risposta.
  assert.equal(esito.corpo.disponibile, false);
  assert.deepEqual(esito.corpo.scontri, []);
});

test("il sito non promette piu' 100 partite per coppia come cancello", () => {
  for (const pagina of ["meta.html", "archetipo.html"]) {
    const html = leggi(pagina);
    assert.doesNotMatch(html, /100\+ per coppia|100\+ matchup/, pagina);
    assert.doesNotMatch(html, /solo da 100 partite affidabili/, pagina);
  }
  assert.match(leggi("meta.html"), /da 30 partite per coppia/);
  assert.match(leggi("meta.html"), /status-soon">In sviluppo</);
  // Le due soglie hanno significati diversi e il testo lo dice.
  assert.match(leggi("meta.html"), /Da 100 in su il campione è più solido/);
});

// --- IT/EN -------------------------------------------------------------------

test("ogni testo nuovo ha la sua traduzione inglese", () => {
  const en = JSON.parse(leggi("i18n/en.json"));
  for (const chiave of [
    "Il futuro del Draft", "Che cosa vogliamo pubblicare", "In sviluppo",
    "Filtri per set, evento e periodo", "Rendimento, col campione accanto",
    "Definizioni in chiaro", "30+ matchup", "Assistente al Draft",
    "Assistente al Draft — MOX Arena Assistant",
    "I risultati compaiono quando MOX può collegare con certezza le partite alla traccia Draft.",
  ]) {
    assert.ok(en[chiave], `manca la traduzione: ${chiave}`);
  }
  assert.equal(en["Il futuro del Draft"], "The future of Draft");
  // Il nome pubblico della release non si traduce: e' lo stesso in tutte le lingue.
  assert.equal(nomeReleasePubblico("mox-v2-beta2.11.0"), "MOX Beta 2.11.0");
});
