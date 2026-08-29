import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const html = readFileSync(QUI + "../sito/draft.html", "utf8");
const js = readFileSync(QUI + "../sito/js/draft.js", "utf8");
const css = readFileSync(QUI + "../sito/css/draft.css", "utf8");

test("Draft pubblico separa set evento e periodo senza esporre diagnostica interna", () => {
  assert.match(html, /Come Mox migliora il Draft/);
  assert.match(html, /Consenso separato/);
  assert.match(html, /nessuna modifica avviene automaticamente/);
  assert.match(html, /solo aggregati pubblici/);
  assert.match(html, /30 match/);
  assert.match(html, /Evento Arena/);
  assert.match(html, /<select id="draft-set">/);
  assert.match(html, /Tutti i set/);
  assert.doesNotMatch(html, /<input id="draft-set"/);
  assert.match(html, /id="draft-period"/);
  assert.match(html, /Espansioni ed eventi/);
  assert.doesNotMatch(html, /Accordo con il consiglio|Verifica per fase|Politica:/);
  assert.doesNotMatch(js, /accordo_mox|draft-policy|tracce_marcate|mazzo_montato/);
  assert.match(js, /Dati insufficienti/);
  assert.match(js, /riga\.set/);
  assert.match(js, /riga\.formato/);
  assert.match(js, /function aggiornaSet/);
  assert.match(html, /id="draft-insights"/);
  assert.match(html, /id="draft-17lands"/);
  assert.match(js, /fonte_17lands/);
  assert.match(js, /Non viene sommata ai dati Mox/);
});

test("Metodo Draft ha una disposizione mobile esplicita", () => {
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.match(html, /name="viewport"/);
});
