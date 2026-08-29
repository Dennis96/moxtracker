import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fileURLToPath } from "node:url";

const RADICE = fileURLToPath(new URL("..", import.meta.url));
const SCHEMA = readFileSync(`${RADICE}/schema.sql`, "utf8");
const MIGRAZIONE = readFileSync(
  `${RADICE}/migrazioni/2026-08-27-account-consensi.sql`, "utf8");
const MIGRAZIONE_EMAIL = readFileSync(
  `${RADICE}/migrazioni/2026-08-29-ticket-email.sql`, "utf8");
const MIGRAZIONE_NASCOSTI = readFileSync(
  `${RADICE}/migrazioni/2026-08-29-account-mazzo-nascosto.sql`, "utf8");

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

test("bootstrap e migrazione creano le stesse tabelle per email ticket", () => {
  const bootstrap = new DatabaseSync(":memory:"); bootstrap.exec(SCHEMA);
  const migrato = new DatabaseSync(":memory:");
  migrato.exec(`CREATE TABLE ticket (
    id TEXT PRIMARY KEY, account_id TEXT, accesso_hash TEXT, categoria TEXT NOT NULL,
    titolo TEXT NOT NULL, stato TEXT NOT NULL, versione_mox TEXT, diagnostica_id TEXT,
    creato TEXT NOT NULL, aggiornato TEXT NOT NULL
  )`);
  migrato.exec(MIGRAZIONE_EMAIL);
  for (const tabella of ["ticket_notifica_email", "ticket_notifica_accesso"]) {
    const daBootstrap = bootstrap.prepare(`PRAGMA table_info(${tabella})`).all()
      .map(({ name, type, notnull, pk }) => ({ name, type, notnull, pk }));
    const daMigrazione = migrato.prepare(`PRAGMA table_info(${tabella})`).all()
      .map(({ name, type, notnull, pk }) => ({ name, type, notnull, pk }));
    assert.deepEqual(daBootstrap, daMigrazione);
  }
  assert.ok(migrato.prepare("SELECT name FROM sqlite_master WHERE name = 'ticket_notifica_accesso_ticket'").get());
});

test("la preferenza di nascondere un mazzo e' reversibile e appartiene all'account", () => {
  const db = new DatabaseSync(":memory:"); db.exec(SCHEMA);
  const migrato = new DatabaseSync(":memory:"); migrato.exec(MIGRAZIONE_NASCOSTI);
  for (const database of [db, migrato]) {
    database.prepare("INSERT INTO account_mazzo_nascosto (account_id, impronta, aggiornato) VALUES ('a', 'b', 'c')").run();
    assert.equal(database.prepare("SELECT COUNT(*) AS n FROM account_mazzo_nascosto WHERE account_id = 'a'").get().n, 1);
  }
});
