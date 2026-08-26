import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const RADICE = fileURLToPath(new URL("..", import.meta.url));
const SCRIPT = "strumenti/ricalcola_sospetti_draft.mjs";

function esegui(...argomenti) {
  return spawnSync(process.execPath, [SCRIPT, ...argomenti], {
    cwd: RADICE, encoding: "utf8",
  });
}

test("il backfill Draft non legge R2 senza consenso privato esplicito", () => {
  const esito = esegui();
  assert.notEqual(esito.status, 0);
  assert.match(esito.stderr, /LEGGI-TRACCE-DRAFT-PRIVATE/);
});

test("il backfill Draft non scrive D1 con il solo consenso di lettura", () => {
  const esito = esegui("--conferma-lettura=LEGGI-TRACCE-DRAFT-PRIVATE", "--apply");
  assert.notEqual(esito.status, 0);
  assert.match(esito.stderr, /AGGIORNA-DRAFT-SOSPETTI/);
});

test("l'help del backfill non accede ai servizi remoti", () => {
  const esito = esegui("--help");
  assert.equal(esito.status, 0);
  assert.match(esito.stdout, /conferma-lettura/);
});

test("il backfill usa il binding D1 configurato", () => {
  const script = readFileSync(new URL(`../${SCRIPT}`, import.meta.url), "utf8");
  assert.match(script, /const DATABASE = "DRAFT_DB"/);
});
