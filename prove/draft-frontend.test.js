import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { paginaGuide } from '../strumenti/news/pagine.mjs';

const QUI = fileURLToPath(new URL(".", import.meta.url));
const fonti = JSON.parse(readFileSync(QUI + '../config/news-fonti.json', 'utf8'));
const html = readFileSync(QUI + "../sito/draft.html", "utf8");
const css = readFileSync(QUI + "../sito/css/draft.css", "utf8");

test("la pagina Draft racconta il prodotto e il metodo, senza dati Limited", () => {
  // I filtri, i contatori e il riquadro «Colori e carte» sono stati tolti dal
  // launch candidate: davano l'aria di una vista dati che non esiste ancora.
  assert.match(html, /<h1[^>]*>Assistente al Draft<\/h1>/);
  assert.doesNotMatch(html, /Assistente al Draft e dati Limited/);
  assert.doesNotMatch(html, /Dati Limited sul sito|Espansioni ed eventi/);
  // «Colori e carte» resta come impegno futuro, ma il pannello che fingeva di
  // averli gia' non c'e' piu'.
  assert.doesNotMatch(html, /id="insights-title"|soon-box|In raccolta/);
  assert.doesNotMatch(html, /id="draft-set"|id="draft-period"|id="draft-format"|id="draft-summary"/);
  assert.doesNotMatch(html, /Draft completi|Scelte registrate|Partite collegate|Nessun numero prematuro/);
  assert.doesNotMatch(html, /js\/draft\.js/, "la pagina non chiede piu' le statistiche Draft");
  // Quello che la pagina deve continuare a dire.
  const guide = paginaGuide(fonti);
  assert.match(html, /guide\.html#usa-draft/);
  assert.match(guide, /Ogni condivisione è una scelta separata/);
  assert.match(guide, /non modifica Arena e non sceglie al posto tuo/);
  assert.match(guide, /contributi personali dei giocatori non vengono inoltrati a 17Lands/);
  assert.match(guide, /punteggio MOX 0–110 non è un win rate/);
  const nuoveFonti = structuredClone(fonti);
  nuoveFonti.channels.stable.data.versione = '2 beta 9.9.9';
  nuoveFonti.verified_at = '2030-01-01T00:00:00Z';
  const aggiornato = paginaGuide(nuoveFonti);
  assert.match(aggiornato, /MOX 2\.11\.8 · Contenuti verificati il <time datetime="2026-10-15"/);
  assert.doesNotMatch(aggiornato, /9\.9\.9|2030/);
});

test("«Il futuro del Draft» promette il metodo, non una data", () => {
  assert.match(html, /<h2 id="futuro-title">Il futuro del Draft<\/h2>/);
  assert.match(html, /Nessuna data: la vista arriva quando i dati la reggono\./);
  assert.match(html, /status-soon">In sviluppo</);
  // I quattro impegni: filtri, carte, rendimento col campione, definizioni.
  for (const voce of ["Filtri per set, evento e periodo", "Colori e carte",
    "Rendimento, col campione accanto", "Definizioni in chiaro"]) {
    assert.ok(html.includes(`<h3>${voce}</h3>`), voce);
  }
  // Niente che suoni come una promessa di disponibilita'.
  assert.doesNotMatch(html, /a breve|prossimamente|entro il|disponibile da/i);
  const inglese = JSON.parse(readFileSync(QUI + "../sito/i18n/en.json", "utf8"));
  assert.equal(inglese["Il futuro del Draft"], "The future of Draft");
  assert.ok(inglese["Nessuna data: la vista arriva quando i dati la reggono."]);
});

test("Metodo Draft ha una disposizione mobile esplicita", () => {
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.match(html, /name="viewport"/);
});
