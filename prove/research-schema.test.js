// Lo schema Research: la migrazione e il bootstrap devono creare le stesse
// tabelle, gli stessi indici e gli stessi vincoli, e la migrazione deve poter
// girare due volte. Nessuna delle due e' mai stata applicata a un D1 remoto.

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const RADICE = fileURLToPath(new URL("..", import.meta.url));
const SCHEMA = readFileSync(`${RADICE}/schema.sql`, "utf8");
const MIGRAZIONE = readFileSync(`${RADICE}/migrazioni/2026-09-14-research-r3.sql`, "utf8");

function forma(db) {
  const tabelle = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'
    AND name LIKE 'research_%' ORDER BY name`).all().map((r) => r.name);
  return tabelle.map((t) => ({
    tabella: t,
    colonne: db.prepare(`PRAGMA table_info(${t})`).all()
      .map(({ name, type, notnull, pk }) => ({ name, type, notnull, pk })),
    indici: db.prepare(`PRAGMA index_list(${t})`).all().map((i) => i.name).sort(),
    esterne: db.prepare(`PRAGMA foreign_key_list(${t})`).all()
      .map(({ table, from, to }) => ({ table, from, to })),
    sql: db.prepare("SELECT sql FROM sqlite_master WHERE name = ?").get(t).sql,
  }));
}

test("schema.sql porta in coda esattamente la migrazione Research", () => {
  assert.ok(SCHEMA.endsWith(MIGRAZIONE));
});

test("bootstrap e legacy+migrazione (due volte) creano la stessa forma", () => {
  const bootstrap = new DatabaseSync(":memory:");
  bootstrap.exec(SCHEMA);
  const migrato = new DatabaseSync(":memory:");
  migrato.exec(SCHEMA.slice(0, SCHEMA.length - MIGRAZIONE.length));
  assert.equal(forma(migrato).length, 0, "il legacy non ha tabelle Research");
  migrato.exec(MIGRAZIONE);
  migrato.exec(MIGRAZIONE);
  assert.deepEqual(forma(migrato), forma(bootstrap));
  assert.ok(forma(bootstrap).length >= 13);
});

test("chiavi esterne e CHECK fermano stati impossibili", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);
  assert.throws(() => db.prepare(`INSERT INTO research_event VALUES
    (1, 1, 'draw', 'e', 1, 1)`).run(), /FOREIGN KEY/);
  assert.throws(() => db.prepare(`INSERT INTO research_revisione_server VALUES
    ('m', 'i', 1, 'g', 't', 0)`).run(), /CHECK/);
  assert.throws(() => db.prepare(`INSERT INTO research_contribution (mittente, id_pubblico,
    versione_server, revisione_modello, revisione_osservazioni, stato, overflow, snapshot,
    variant_hash, generation_hash, mox, ricevuta, aggiornata)
    VALUES ('m', 'i', 1, 1, 1, 'conflitto', 0, '{}', 'h', 'g', 'x', 't', 't')`).run(), /CHECK/,
  "una contribution in conflitto non ha snapshot effettiva");
  assert.throws(() => db.prepare(`INSERT INTO research_lineage VALUES
    ('t', 1, 'c', 1, 'sospesa', 'x', 'x')`).run(), /CHECK/);
  assert.throws(() => db.prepare("INSERT INTO research_guardia (ok) VALUES (0)").run(), /CHECK/);
});
