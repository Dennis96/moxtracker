// Gli stessi pacchetti che prova Mox, giudicati qui dal Worker.
//
// A109, 26/08/2026. Fra il 24 e il 26 agosto il server ha rifiutato quattro
// Draft veri con «pool e sequenza delle scelte non coincidono», e il client
// continuava a spedirli: le due implementazioni erano provate ognuna sui casi
// che si scriveva da sola, e nessun pacchetto nato da un Draft vero era mai
// passato da `controllaDraft` dentro una suite.
//
// Il file dei casi vive in `Codice/prove/casi-pacchetto-draft.json` e qui ce
// n'e' una copia identica: e' la suite di Mox a controllare che le due copie
// coincidano byte per byte. Se una delle due implementazioni cambia regola,
// questo file diventa rosso da una parte sola — che e' esattamente lo scopo.

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { controllaDraft } from "../src/draft.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const CASI = JSON.parse(
  readFileSync(QUI + "casi-pacchetto-draft.json", "utf8"));

test("i casi condivisi con Mox danno lo stesso verdetto", () => {
  assert.ok(CASI.casi.length >= 15, `solo ${CASI.casi.length} casi`);
  for (const caso of CASI.casi) {
    const detto = controllaDraft(structuredClone(caso.pacchetto));
    assert.equal(detto, caso.atteso, `«${caso.nome}» -> ${JSON.stringify(detto)}`);
  }
});

test("fra i casi c'e' anche il difetto vero di A109", () => {
  // Se questo caso sparisse, il file resterebbe verde senza provare piu' la
  // cosa per cui e' nato.
  const a109 = CASI.casi.filter((caso) =>
    caso.atteso === "pool e sequenza delle scelte non coincidono");
  assert.ok(a109.length >= 2, "manca il caso del pool rimescolato");
});
