import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { creaFintoD1 } from "./finto-d1.js";
import { leggiMeta, leggiGiocoRisposta, leggiScontri, raggruppaBrew, SOGLIA_META } from "../src/lettura.js";

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

// Una riga come la produce il motore: riconosciuta (archetipo_id) oppure una
// sola impronta non classificata.
function mazzo(impronta, partite, vittorie, archetipoId = null) {
  const sufficienti = partite >= 30;
  return {
    nome: archetipoId || "Mazzo non classificato", archetipo_id: archetipoId,
    impronta: archetipoId ? null : impronta, impronte_raggruppate: 1, varianti_rilevate: 1,
    partite, vittorie, sconfitte: partite - vittorie, dati_sufficienti: sufficienti,
    win_rate: sufficienti ? 50 : null, quota_meta: null,
  };
}
const altroDi = (mazzi) => mazzi.find((m) => m.nome === "Altro (Brew)");

test("senza Brew non compare Altro e nessuna variante Brew", () => {
  const mazzi = raggruppaBrew([mazzo(null, 40, 20, "mono-rosso")], 40, SOGLIA_META);
  assert.equal(mazzi.length, 1);
  assert.equal(altroDi(mazzi), undefined);
  assert.ok(mazzi.every((m) => !("varianti_brew" in m)));
});

test("un solo Brew: Altro lo elenca come Brew #1 con la sua impronta", () => {
  const altro = altroDi(raggruppaBrew([mazzo("c".repeat(64), 12, 7)], 12, SOGLIA_META));
  assert.deepEqual(altro.varianti_brew, [{
    etichetta: "Brew #1", impronta: "c".repeat(64), partite: 12, vittorie: 7, sconfitte: 5,
    dati_sufficienti: false, win_rate: null, quota_meta: null,
  }]);
});

test("piu' Brew: ordine per partite, vittorie e impronta, qualunque sia l'ordine di arrivo", () => {
  const a = mazzo("a".repeat(64), 30, 10);
  const b = mazzo("b".repeat(64), 30, 20);
  const c = mazzo("c".repeat(64), 48, 31);
  const d = mazzo("d".repeat(64), 30, 20);
  const attese = ["c", "b", "d", "a"].map((x) => x.repeat(64));
  for (const ingresso of [[a, b, c, d], [d, c, b, a], [b, d, a, c]]) {
    const altro = altroDi(raggruppaBrew(ingresso, 200, SOGLIA_META));
    assert.deepEqual(altro.varianti_brew.map((v) => v.impronta), attese);
    assert.deepEqual(altro.varianti_brew.map((v) => v.etichetta), ["Brew #1", "Brew #2", "Brew #3", "Brew #4"]);
  }
});

test("le varianti Brew lasciano invariati i totali di Altro e il win rate resta sotto soglia", () => {
  // La seconda lista arriva con un win rate che non doveva esserci: sotto 30
  // partite non si pubblica comunque.
  const trapelato = { ...mazzo("b".repeat(64), 29, 29), win_rate: 100, quota_meta: 29 };
  const altro = altroDi(raggruppaBrew([mazzo("a".repeat(64), 48, 31), trapelato], 100, SOGLIA_META));
  assert.equal(altro.partite, 77);
  assert.equal(altro.vittorie, 60);
  assert.equal(altro.sconfitte, 17);
  assert.equal(altro.win_rate, 77.92);
  assert.equal(altro.quota_meta, 77);
  assert.equal(altro.impronta, null);
  assert.equal(altro.impronte_raggruppate, 2);
  assert.equal(altro.varianti_rilevate, 2);
  const [prima, seconda] = altro.varianti_brew;
  assert.equal(prima.dati_sufficienti, true);
  assert.equal(prima.win_rate, 64.58);
  assert.equal(prima.quota_meta, 48);
  assert.equal(seconda.dati_sufficienti, false);
  assert.equal(seconda.win_rate, null);
  assert.equal(seconda.quota_meta, null);
});

test("meta pubblica le varianti di Altro con l'impronta per il dettaglio", async () => {
  const db = creaFintoD1(SCHEMA);
  for (let i = 0; i < 30; i += 1) {
    aggiungi(db, { id: `a${String(i).padStart(9, "0")}`, esito: i < 18 ? "vinta" : "persa" });
  }
  for (let i = 0; i < 29; i += 1) {
    aggiungi(db, { id: `b${String(i).padStart(9, "0")}`, impronta: "b".repeat(64) });
  }
  const r = await leggiMeta(db, url("/meta?formato=Standard"));
  const altro = altroDi(r.corpo.mazzi);
  assert.deepEqual(altro.varianti_brew.map((v) => [v.etichetta, v.impronta, v.win_rate]),
    [["Brew #1", "a".repeat(64), 60], ["Brew #2", "b".repeat(64), null]]);
});

test("il formato e' obbligatorio", async () => {
  const db = creaFintoD1(SCHEMA);
  const r = await leggiMeta(db, url("/meta"));
  assert.equal(r.stato, 400);
});
