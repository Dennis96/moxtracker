import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const leggi = (file) => readFileSync(QUI + `../sito/${file}`, "utf8");

test("le viste rese dopo il caricamento richiamano la traduzione inglese", () => {
  const traduci = leggi("js/translate.js");
  const main = leggi("js/main.js");
  const draft = leggi("js/draft.js");
  const dettaglio = leggi("js/archetype.js");
  const inglese = leggi("i18n/en.json");
  assert.match(traduci, /export function traduciDocumento/);
  for (const source of [main, draft, dettaglio]) {
    assert.match(source, /import \{ traduciDocumento \} from "\.\/translate\.js"/);
    assert.match(source, /traduciDocumento\(\)/);
  }
  assert.match(inglese, /"Archetipo \/ mazzo": "Archetype \/ deck"/);
  assert.match(traduci, /\.catch\(\(\) => null\)/,
    "un dizionario inglese non raggiungibile non deve bloccare la pagina");
});
