import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const leggi = (file) => readFileSync(QUI + `../sito/${file}`, "utf8");

const MARCATORI_ITALIANI = /[àèéìòù]|\b(?:accedi|aggiorna|aiuta|andamento|apri|azzera|campione|cancella|carico|cerca|chiudi|colori|consenso|contributi|dati|descrizione|dispositivi|elimina|esito|esporta|filtra|gioco|informativa|mazzi|migliora|nessun|nessuna|partite|privacy|risultati|scarica|scelte|sconfitte|separati|soglia|statistiche|tutti|ultimo|vittorie)\b/i;

function testiStatici(html) {
  const pulito = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--([\s\S]*?)-->/g, "");
  const valori = [];
  for (const match of pulito.matchAll(/>([^<>]+)</g)) {
    const valore = match[1].trim();
    if (valore) valori.push(valore);
  }
  for (const match of pulito.matchAll(/\b(?:aria-label|title|placeholder|content|alt)="([^"]+)"/g)) {
    const valore = match[1].trim();
    if (valore) valori.push(valore);
  }
  return [...new Set(valori)];
}

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

test("Home, Meta, Draft e Account non aggiungono testo italiano senza chiave inglese", () => {
  const dizionario = JSON.parse(leggi("i18n/en.json"));
  const mancanti = [];
  for (const pagina of ["index.html", "draft.html", "account.html"]) {
    for (const testo of testiStatici(leggi(pagina))) {
      if (MARCATORI_ITALIANI.test(testo) && !dizionario[testo]) {
        mancanti.push(`${pagina}: ${testo}`);
      }
    }
  }
  assert.deepEqual(mancanti, [], `chiavi inglesi mancanti:\n${mancanti.join("\n")}`);
});
