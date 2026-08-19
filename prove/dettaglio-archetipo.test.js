import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { creaFintoD1 } from "./finto-d1.js";
import { leggiArchetipo } from "../src/dettaglio-archetipo.js";
import server from "../src/index.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const SCHEMA = QUI + "../schema.sql";
const IMPRONTA = "4".repeat(64);

function preparaMonoWhite(db) {
  db.prepare(`INSERT INTO partite
    (id, mittente, ricevuta, formato, esito, su_gioco, rank_classe,
     impronta_mazzo, versione, dato)
    VALUES (?, ?, ?, 'Standard', 'vinta', 1, 'Gold', ?, 1, '{}')`)
    .bind("a000000001", "f".repeat(32), "2026-08-19T10:00:00Z", IMPRONTA).esegui();

  const carte = [
    [51307, 4],   // Ethereal Armor
    [92081, 4],   // Optimistic Scavenger
    [92090, 4],   // Sheltered by Ghosts
    [97823, 4],   // Origin of Spider-Man
    [97964, 4],   // Skyward Spider
    [91549, 2],   // Feather of Flight
    [92089, 2],   // Shardmage's Rescue
    [66499, 20],  // Plains
  ];
  for (const [carta, copie] of carte) {
    db.prepare("INSERT INTO carte_mazzo (partita, carta, copie) VALUES (?, ?, ?)")
      .bind("a000000001", carta, copie).esegui();
  }
}

function url(path) { return new URL("https://x.invalid" + path); }

test("dettaglio archetipo separa nome canonico, varianti osservate e riferimenti", async () => {
  const db = creaFintoD1(SCHEMA);
  preparaMonoWhite(db);
  const r = await leggiArchetipo(db, url("/archetipo?formato=Standard&id=aure-mono-bianco"));
  assert.equal(r.stato, 200);
  assert.equal(r.corpo.archetipo_id, "aure-mono-bianco");
  assert.equal(r.corpo.nome, "Mono White Auras");
  assert.equal(r.corpo.partite, 1);
  assert.equal(r.corpo.dati_sufficienti, false);
  assert.equal(r.corpo.win_rate, null);
  assert.equal(r.corpo.varianti_osservate, 1);
  assert.equal(r.corpo.varianti[0].impronta, IMPRONTA);
  assert.ok(r.corpo.varianti[0].carte.length >= 8);
  assert.ok(r.corpo.liste_riferimento.length >= 1);
  assert.ok(r.corpo.liste_riferimento[0].lista.length >= 1);
});

test("dettaglio archetipo rispetta il filtro rank", async () => {
  const db = creaFintoD1(SCHEMA);
  preparaMonoWhite(db);
  const r = await leggiArchetipo(db, url("/archetipo?formato=Standard&id=aure-mono-bianco&rank=Silver"));
  assert.equal(r.stato, 404);
});

test("la strada pubblica /archetipo usa GET", async () => {
  const db = creaFintoD1(SCHEMA);
  preparaMonoWhite(db);
  const richiesta = new Request("https://x.invalid/archetipo?formato=Standard&id=aure-mono-bianco", { method: "GET" });
  const risposta = await server.fetch(richiesta, { DB: db });
  const corpo = await risposta.json();
  assert.equal(risposta.status, 200);
  assert.equal(corpo.nome, "Mono White Auras");
});

test("archetipo richiede id valido", async () => {
  const db = creaFintoD1(SCHEMA);
  const r = await leggiArchetipo(db, url("/archetipo?formato=Standard"));
  assert.equal(r.stato, 400);
});
