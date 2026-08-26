import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fileURLToPath } from "node:url";

const RADICE = fileURLToPath(new URL("..", import.meta.url));
const SCHEMA = readFileSync(`${RADICE}/schema-draft.sql`, "utf8");
const MIGRAZIONE = readFileSync(
  `${RADICE}/migrazioni/2026-08-25-draft-sospetto.sql`, "utf8");

function oggettiSospetto(db) {
  const trovata = db.prepare("PRAGMA table_info(draft)").all()
    .find((voce) => voce.name === "sospetto");
  const colonna = trovata && {
    name: trovata.name, type: trovata.type, notnull: trovata.notnull,
    dflt_value: trovata.dflt_value, pk: trovata.pk,
  };
  const indice = db.prepare(`SELECT sql FROM sqlite_master
    WHERE type = 'index' AND name = 'draft_sospetto'`).get();
  return { colonna, indice: indice?.sql?.replace(/\s+/g, " ").trim() };
}

test("bootstrap e migrazione creano lo stesso campo e indice Draft sospetto", () => {
  const bootstrap = new DatabaseSync(":memory:");
  bootstrap.exec(SCHEMA);

  const migrato = new DatabaseSync(":memory:");
  migrato.exec(`CREATE TABLE draft (
    id TEXT PRIMARY KEY,
    versione INTEGER NOT NULL
  )`);
  migrato.exec(MIGRAZIONE);

  assert.deepEqual(oggettiSospetto(bootstrap), oggettiSospetto(migrato));
});
