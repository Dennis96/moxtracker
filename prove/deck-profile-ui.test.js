import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const leggi = (relative) => readFileSync(QUI + relative, "utf8");

test("profilo mazzo rende la curva come grafico e i colori come simboli mana", () => {
  const script = leggi("../sito/js/deck-profile.js");
  const css = leggi("../sito/css/step53.css");

  assert.match(script, /function curvaGrafica\(curva\)/);
  assert.match(script, /mana-curve-column/);
  assert.match(script, /function coloriMana\(colori\)/);
  assert.match(script, /mana-symbol-\$\{colore\}/);
  assert.match(script, /"Copie per identità di colore"/);
  assert.match(script, /Non sono costi o fonti di mana/);
  assert.match(script, /Una carta multicolore conta in ogni colore della sua identità/);
  assert.match(leggi("../sito/js/card-images.js"), /colors: Array\.isArray\(card\.color_identity\)/,
    "il profilo usa la color identity di Scryfall, non il costo di mana");
  assert.doesNotMatch(script, /blocco\.append\(heading, elenco\)/);
  assert.match(css, /\.mana-curve-bar/);
  assert.match(css, /\.mana-symbol-W/);
  assert.match(css, /\.mana-symbol-G/);
});
