import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { creaFintoD1 } from "./finto-d1.js";
import { leggiMeta, leggiGiocoRisposta, leggiScontri } from "../src/lettura.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const SCHEMA = QUI + "../schema.sql";

function aggiungi(db, {
  id, impronta="a".repeat(64), formato="Standard", esito="vinta",
  su=1, rank="Gold", ricevuta="2026-08-18T21:00:00Z", evento="Ladder"
}) {
  db.prepare(`INSERT INTO partite
    (id, mittente, ricevuta, formato, evento, esito, su_gioco, rank_classe,
     impronta_mazzo, versione, dato)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '{}')`)
    .bind(id, "f".repeat(32), ricevuta, formato, evento, esito, su, rank, impronta).esegui();
}

function url(percorso) {
  return new URL("https://x.invalid" + percorso);
}

test("meta raggruppa le liste Brew in Altro e applica la soglia al gruppo", async () => {
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
  assert.equal(r.corpo.mazzi.length, 1);
  assert.equal(r.corpo.mazzi[0].partite, 59);
  assert.equal(r.corpo.mazzi[0].win_rate, 79.66);
  assert.equal(r.corpo.mazzi[0].quota_meta, 100);
  assert.equal(r.corpo.mazzi[0].nome, "Altro (Brew)");
  assert.equal(r.corpo.mazzi[0].impronte_raggruppate, 2);
});

test("Altro resta visibile ma senza percentuali sotto 30 partite", async () => {
  const db = creaFintoD1(SCHEMA);
  for (let i = 0; i < 29; i += 1) aggiungi(db, { id: `c${String(i).padStart(9, "0")}` });
  const r = await leggiMeta(db, url("/meta?formato=Standard"));
  assert.equal(r.corpo.mazzi[0].partite, 29);
  assert.equal(r.corpo.mazzi[0].win_rate, null);
  assert.equal(r.corpo.mazzi[0].quota_meta, null);
});

test("meta filtra il rank", async () => {
  const db = creaFintoD1(SCHEMA);
  aggiungi(db, { id: "a000000001", rank: "Gold" });
  aggiungi(db, { id: "a000000002", rank: "Silver" });
  const r = await leggiMeta(db, url("/meta?formato=Standard&rank=Gold"));
  assert.equal(r.corpo.partite_totali, 1);
  assert.equal(r.corpo.filtri.rank, "Gold");
});

test("meta separa periodo e BO1/BO3", async () => {
  const db = creaFintoD1(SCHEMA);
  aggiungi(db, { id: "a000000001", evento: "Ladder" });
  aggiungi(db, { id: "a000000002", evento: "Traditional_Ladder" });
  const bo1 = await leggiMeta(db, url("/meta?formato=Standard&periodo=30&modalita=BO1"));
  const bo3 = await leggiMeta(db, url("/meta?formato=Standard&periodo=30&modalita=BO3"));
  assert.equal(bo1.corpo.partite_totali, 1);
  assert.equal(bo3.corpo.partite_totali, 1);
  assert.equal(bo3.corpo.filtri.modalita, "BO3");
  const nonValido = await leggiMeta(db, url("/meta?formato=Standard&periodo=365"));
  assert.equal(nonValido.stato, 400);
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
