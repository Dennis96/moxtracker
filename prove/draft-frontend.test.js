import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const html = readFileSync(QUI + "../sito/draft.html", "utf8");
const js = readFileSync(QUI + "../sito/js/draft.js", "utf8");
const css = readFileSync(QUI + "../sito/css/draft.css", "utf8");

test("Metodo Draft spiega il miglioramento verificabile ed espone soglie senza numeri finti", () => {
  assert.match(html, /Come Mox migliora il Draft/);
  assert.match(html, /Consenso separato/);
  assert.match(html, /nessuna modifica avviene automaticamente/);
  assert.match(html, /solo aggregati pubblici/);
  assert.match(html, /100 pick/);
  assert.match(html, /30 match/);
  assert.match(js, /accordo_mox === null/);
  assert.match(js, /Dati insufficienti/);
  for (const fase of ["apertura", "direzione", "struttura", "chiusura"]) {
    assert.ok(js.includes("riga.fase") || html.includes(fase));
  }
});

test("Metodo Draft ha una disposizione mobile esplicita", () => {
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.match(html, /name="viewport"/);
});
