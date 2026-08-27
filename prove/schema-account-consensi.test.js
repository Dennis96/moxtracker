import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fileURLToPath } from "node:url";

const RADICE = fileURLToPath(new URL("..", import.meta.url));
const SCHEMA = readFileSync(`${RADICE}/schema.sql`, "utf8");
const MIGRAZIONE = readFileSync(
  `${RADICE}/migrazioni/2026-08-27-account-consensi.sql`, "utf8");

function colonneConsensi(db) {
  return db.prepare("PRAGMA table_info(account_dispositivo)").all()
    .filter((voce) => voce.name.startsWith("consenso_") ||
      voce.name === "consensi_aggiornati")
    .map((voce) => ({ name: voce.name, type: voce.type, notnull: voce.notnull,
      dflt_value: voce.dflt_value, pk: voce.pk }));
}

test("bootstrap e migrazione creano gli stessi campi per i consensi correnti", () => {
  const bootstrap = new DatabaseSync(":memory:");
  bootstrap.exec(SCHEMA);

  const migrato = new DatabaseSync(":memory:");
  migrato.exec(`CREATE TABLE account_dispositivo (
    mittente TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    segreto_hash TEXT NOT NULL,
    collegato TEXT NOT NULL
  )`);
  migrato.exec(MIGRAZIONE);

  assert.deepEqual(colonneConsensi(bootstrap), colonneConsensi(migrato));
  assert.throws(() => bootstrap.prepare(`INSERT INTO account_dispositivo
    (mittente, account_id, nome, segreto_hash, collegato, consenso_partite)
    VALUES ('a', 'b', 'pc', 'c', '2026-08-27', 2)`).run(), /CHECK constraint/);
});
