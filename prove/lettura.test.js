import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { creaFintoD1 } from "./finto-d1.js";
import { leggiMeta, leggiGiocoRisposta, leggiScontri } from "../src/lettura.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const SCHEMA = QUI + "../schema.sql";

function aggiungi(db, {
  id, impronta="a".repeat(64), formato="Standard", esito="vinta",
  su=1, rank="Gold", ricevuta="2026-08-18T21:00:00Z"
}) {
  db.prepare(`INSERT INTO partite
    (id, mittente, ricevuta, formato, esito, su_gioco, rank_classe,
     impronta_mazzo, versione, dato)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, '{}')`)
    .bind(id, "f".repeat(32), ricevuta, formato, esito, su, rank, impronta).esegui();
}

function url(percorso) {
  return new URL("https://x.invalid" + percorso);
}

test("meta nasconde percentuali sotto 30 e le mostra da 30", async () => {
  const db = creaFintoD1(SCHEMA);
  for (let i = 0; i < 30; i += 1) {
    aggiungi(db, {
      id: `a${String(i).padStart(9, "0")}`,
      esito: i < 18 ? "vinta" : "persa",
    });
  }
  for (let i = 0; i < 29; i += 1) {
    aggiungi(db, {
      id: `b${String(i).padStart(9, "0")}`,
      impronta: "b".repeat(64),
      esito: "vinta",
    });
  }
  const r = await leggiMeta(db, url("/meta?formato=Standard"));
  assert.equal(r.stato, 200);
  assert.equal(r.corpo.partite_totali, 59);
  assert.equal(r.corpo.mazzi[0].partite, 30);
  assert.equal(r.corpo.mazzi[0].win_rate, 60);
  assert.equal(r.corpo.mazzi[0].quota_meta, 50.85);
  assert.equal(r.corpo.mazzi[1].partite, 29);
  assert.equal(r.corpo.mazzi[1].win_rate, null);
  assert.equal(r.corpo.mazzi[1].quota_meta, null);
});

test("meta filtra il rank", async () => {
  const db = creaFintoD1(SCHEMA);
  aggiungi(db, { id: "a000000001", rank: "Gold" });
  aggiungi(db, { id: "a000000002", rank: "Silver" });
  const r = await leggiMeta(db, url("/meta?formato=Standard&rank=Gold"));
  assert.equal(r.corpo.partite_totali, 1);
  assert.equal(r.corpo.filtri.rank, "Gold");
});

test("gioco-risposta usa la stessa soglia di 30 per le percentuali", async () => {
  const db = creaFintoD1(SCHEMA);
  for (let i = 0; i < 30; i += 1) {
    aggiungi(db, {
      id: `g${String(i).padStart(9, "0")}`,
      su: 1,
      esito: i < 15 ? "vinta" : "persa",
    });
  }
  for (let i = 0; i < 5; i += 1) {
    aggiungi(db, {
      id: `r${String(i).padStart(9, "0")}`,
      su: 0,
      esito: "vinta",
    });
  }
  aggiungi(db, { id: "n000000001", su: null });
  const r = await leggiGiocoRisposta(db, url("/gioco-risposta?formato=Standard"));
  assert.equal(r.corpo.partite_totali, 36);
  assert.equal(r.corpo.partite_con_iniziativa_nota, 35);
  assert.equal(r.corpo.al_gioco.win_rate, 50);
  assert.equal(r.corpo.alla_risposta.win_rate, null);
});

test("scontri dichiara esplicitamente che non puo' inventare l'avversario", async () => {
  const db = creaFintoD1(SCHEMA);
  aggiungi(db, { id: "a000000001" });
  const r = await leggiScontri(db, url("/scontri?formato=Standard"));
  assert.equal(r.stato, 200);
  assert.equal(r.corpo.disponibile, false);
  assert.deepEqual(r.corpo.scontri, []);
  assert.match(r.corpo.motivo, /avversario/);
});

test("il formato e' obbligatorio", async () => {
  const db = creaFintoD1(SCHEMA);
  const r = await leggiMeta(db, url("/meta"));
  assert.equal(r.stato, 400);
});
