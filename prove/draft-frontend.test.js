import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const QUI = fileURLToPath(new URL(".", import.meta.url));
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
  assert.match(html, /Consenso separato/);
  assert.match(html, /nessuna modifica avviene automaticamente/);
  assert.match(html, /solo aggregati pubblici/);
  assert.match(html, /Le garanzie del metodo/);
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
