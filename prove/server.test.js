// Il server per intero: una richiesta entra, una partita finisce nel database.
//
// Gira su un SQLite vero (vedi `finto-d1.js`), quindi prova anche che lo
// schema e le query siano giuste - non solo che il codice non esploda.

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import server from "../src/index.js";
import { creaFintoD1 } from "./finto-d1.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const SCHEMA = QUI + "../schema.sql";
const ESEMPIO = JSON.parse(readFileSync(QUI + "partita-esempio.json", "utf8"));

function copia(cambia = {}) {
  return JSON.parse(JSON.stringify({ ...ESEMPIO, ...cambia }));
}

async function manda(db, corpo, metodo = "POST", percorso = "/partite") {
  const richiesta = new Request("https://esempio.invalid" + percorso, {
    method: metodo,
    headers: { "content-type": "application/json" },
    body: metodo === "POST" ? JSON.stringify(corpo) : undefined,
  });
  const risposta = await server.fetch(richiesta, { DB: db });
  return { stato: risposta.status, corpo: await risposta.json() };
}

test("il pacchetto di esempio e' quello che Mox produce davvero", () => {
  // Se questa fallisce, il formato e' cambiato in `pacchetto_partita.py` e il
  // server va aggiornato: e' il punto in cui le due parti si toccano.
  assert.equal(ESEMPIO.versione, 1);
  assert.equal(typeof ESEMPIO.mittente, "string");
  assert.ok(ESEMPIO.mazzo && ESEMPIO.avversario && ESEMPIO.andamento);
});

test("dice se e' vivo", async () => {
  const db = creaFintoD1(SCHEMA);
  const { stato, corpo } = await manda(db, null, "GET", "/salute");
  assert.equal(stato, 200);
  assert.equal(corpo.stato, "vivo");
});

test("una partita entra, e le sue carte con lei", async () => {
  const db = creaFintoD1(SCHEMA);
  const { stato, corpo } = await manda(db, copia());
  assert.equal(stato, 200);
  assert.equal(corpo.accettate, 1);
  assert.equal(corpo.rifiutate.length, 0);
  assert.equal(db.conta("partite"), 1);
  assert.equal(db.conta("carte_mazzo"), Object.keys(ESEMPIO.mazzo.carte).length);
  assert.equal(db.conta("carte_avversario"), ESEMPIO.avversario.carte.length);

  const riga = db.tutte("SELECT * FROM partite")[0];
  assert.equal(riga.esito, ESEMPIO.andamento.esito);
  assert.equal(riga.su_gioco, 1);
  assert.equal(riga.rank_classe, "Gold");
  assert.deepEqual(JSON.parse(riga.dato), ESEMPIO, "il pacchetto deve restare intero");
});

test("la stessa partita due volte conta una volta sola", async () => {
  const db = creaFintoD1(SCHEMA);
  await manda(db, copia());
  const { corpo } = await manda(db, copia());
  assert.equal(corpo.accettate, 0);
  assert.equal(corpo.gia_presenti, 1);
  assert.equal(db.conta("partite"), 1, "il doppione ha creato una riga");
});

test("piu' partite in una volta, e le rifiutate non fermano le buone", async () => {
  const db = creaFintoD1(SCHEMA);
  const buona = copia({ partita: "aaaaaaaaaa" });
  const rotta = copia({ partita: "bbbbbbbbbb", turni: 99999 });
  const altra = copia({ partita: "cccccccccc" });
  const { stato, corpo } = await manda(db, { partite: [buona, rotta, altra] });
  assert.equal(stato, 200);
  assert.equal(corpo.accettate, 2);
  assert.equal(corpo.rifiutate.length, 1);
  assert.equal(corpo.rifiutate[0].partita, "bbbbbbbbbb");
  assert.match(corpo.rifiutate[0].motivo, /turni/);
  assert.equal(db.conta("partite"), 2);
});

test("se sono tutte da rifiutare, il server lo dice con 400", async () => {
  const db = creaFintoD1(SCHEMA);
  const { stato, corpo } = await manda(db, copia({ versione: 99 }));
  assert.equal(stato, 400);
  assert.equal(corpo.accettate, 0);
  assert.match(corpo.rifiutate[0].motivo, /versione/);
  assert.equal(db.conta("partite"), 0);
});

test("la mano dell'avversario non entra nemmeno se qualcuno la manda", async () => {
  const db = creaFintoD1(SCHEMA);
  const furbo = copia();
  furbo.avversario.mano = [901, 902, 903];
  const { stato, corpo } = await manda(db, furbo);
  assert.equal(stato, 400);
  assert.match(corpo.rifiutate[0].motivo, /mano/);
  assert.equal(db.conta("partite"), 0);
});

test("una richiesta, un mittente solo", async () => {
  const db = creaFintoD1(SCHEMA);
  const mia = copia({ partita: "aaaaaaaaaa" });
  const altrui = copia({ partita: "bbbbbbbbbb", mittente: "1".repeat(32) });
  const { stato, corpo } = await manda(db, { partite: [mia, altrui] });
  assert.equal(stato, 400);
  assert.match(corpo.errore, /mittente/);
});

test("il tetto giornaliero ferma chi ne manda troppe", async () => {
  const db = creaFintoD1(SCHEMA);
  const oggi = new Date().toISOString();
  // Si riempie il database direttamente: mandare trecento partite dal Worker
  // proverebbe la stessa cosa e ci metterebbe dieci volte tanto.
  for (let n = 0; n < 300; n += 1) {
    db.prepare(
      `INSERT INTO partite (id, mittente, ricevuta, esito, versione, dato)
       VALUES (?, ?, ?, 'vinta', 1, '{}')`
    ).bind(`p${String(n).padStart(9, "0")}`, ESEMPIO.mittente, oggi).esegui();
  }
  const { stato, corpo } = await manda(db, copia());
  assert.equal(stato, 429);
  assert.match(corpo.errore, /tetto/);
  assert.equal(corpo.gia_ricevute, 300);
});

test("le partite vecchie di ieri non contano per il tetto di oggi", async () => {
  const db = creaFintoD1(SCHEMA);
  const dueGiorniFa = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  for (let n = 0; n < 300; n += 1) {
    db.prepare(
      `INSERT INTO partite (id, mittente, ricevuta, esito, versione, dato)
       VALUES (?, ?, ?, 'vinta', 1, '{}')`
    ).bind(`v${String(n).padStart(9, "0")}`, ESEMPIO.mittente, dueGiorniFa).esegui();
  }
  const { stato } = await manda(db, copia());
  assert.equal(stato, 200, "il tetto guarda le ultime 24 ore, non tutta la storia");
});

test("le strade sbagliate rispondono, invece di restare mute", async () => {
  const db = creaFintoD1(SCHEMA);
  assert.equal((await manda(db, null, "GET", "/partite")).stato, 405);
  assert.equal((await manda(db, null, "GET", "/qualcosa")).stato, 404);

  const senzaJson = new Request("https://esempio.invalid/partite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "questo non e' JSON",
  });
  const risposta = await server.fetch(senzaJson, { DB: db });
  assert.equal(risposta.status, 400);
});

test("un guasto del database non racconta com'e' fatto dentro", async () => {
  const rotto = {
    prepare() { throw new Error("tabella segreta_interna non esiste"); },
    async batch() { throw new Error("mai arrivato qui"); },
  };
  const { stato, corpo } = await manda(rotto, copia());
  assert.equal(stato, 500);
  assert.equal(corpo.errore, "guasto del server");
  assert.ok(!JSON.stringify(corpo).includes("segreta_interna"));
});
