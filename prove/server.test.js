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

async function manda(db, corpo, metodo = "POST", percorso = "/partite", extra = {}) {
  const richiesta = new Request("https://esempio.invalid" + percorso, {
    method: metodo,
    headers: { "content-type": "application/json" },
    body: metodo === "POST" ? JSON.stringify(corpo) : undefined,
  });
  const risposta = await server.fetch(richiesta, { DB: db, ...extra });
  return { stato: risposta.status, corpo: await risposta.json(),
    headers: risposta.headers };
}

test("il pacchetto di esempio e' quello che Mox produce davvero", () => {
  // Se questa fallisce, il formato e' cambiato in `pacchetto_partita.py` e il
  // server va aggiornato: e' il punto in cui le due parti si toccano.
  assert.equal(ESEMPIO.versione, 2);
  assert.equal(typeof ESEMPIO.mittente, "string");
  assert.equal(typeof ESEMPIO.segreto_cancellazione, "string");
  assert.ok(ESEMPIO.mazzo && ESEMPIO.avversario && ESEMPIO.andamento);
});

test("dice se e' vivo", async () => {
  const db = creaFintoD1(SCHEMA);
  const { stato, corpo } = await manda(db, null, "GET", "/salute");
  assert.equal(stato, 200);
  assert.equal(corpo.stato, "vivo");
});

test("release Mox resta spenta senza manifesto e pubblica quello firmato", async () => {
  const db = creaFintoD1(SCHEMA);
  const percorso = "/mox/release?piattaforma=win-x64&canale=stable&corrente=2%20beta%202.9.4";
  const vuota = await manda(db, null, "GET", percorso);
  assert.equal(vuota.stato, 200);
  assert.equal(vuota.corpo.disponibile, false);

  const manifesto = {
    versione: "2 beta 2.9.5", url: "https://example.invalid/Mox.exe",
    sha256: "a".repeat(64), dimensione: 123, firma: "firma",
    note: "prova", minima: "2 beta 2.9.4",
  };
  const pronta = await manda(db, null, "GET", percorso,
    { MOX_RELEASE_MANIFEST: JSON.stringify(manifesto) });
  assert.equal(pronta.stato, 200);
  assert.equal(pronta.corpo.disponibile, true);
  assert.equal(pronta.corpo.versione, "2 beta 2.9.5");
  assert.equal(pronta.headers.get("cache-control"), "no-store");

  const aggiornata = await manda(db, null, "GET",
    percorso.replace("2.9.4", "2.9.5"),
    { MOX_RELEASE_MANIFEST: JSON.stringify(manifesto) });
  assert.equal(aggiornata.corpo.disponibile, false);
});

test("il canary vede la sua release, e non ripiega mai sullo stable", async () => {
  // Serve a provare una release su questa macchina prima che vada a tutti.
  // Se ripiegasse sullo stable, chi crede di collaudare la versione nuova si
  // ritroverebbe a riscaricare quella che hanno gia' tutti.
  const db = creaFintoD1(SCHEMA);
  const percorso = "/mox/release?piattaforma=win-x64&canale=canary&corrente=2%20beta%202.9.22";
  const stabile = {
    versione: "2 beta 2.9.22", url: "https://example.invalid/vecchia.exe",
    sha256: "a".repeat(64), dimensione: 1, firma: "f",
  };
  const canary = { ...stabile, versione: "2 beta 2.9.23",
    url: "https://example.invalid/nuova.exe" };

  const senza = await manda(db, null, "GET", percorso,
    { MOX_RELEASE_MANIFEST: JSON.stringify(canary) });
  assert.equal(senza.corpo.disponibile, false, "niente ripiego sullo stable");

  const con = await manda(db, null, "GET", percorso,
    { MOX_RELEASE_MANIFEST: JSON.stringify(stabile),
      MOX_RELEASE_MANIFEST_CANARY: JSON.stringify(canary) });
  assert.equal(con.corpo.disponibile, true);
  assert.equal(con.corpo.versione, "2 beta 2.9.23");

  // e chi resta sullo stable non vede il canary
  const pubblico = await manda(db, null, "GET",
    percorso.replace("canale=canary", "canale=stable"),
    { MOX_RELEASE_MANIFEST: JSON.stringify(stabile),
      MOX_RELEASE_MANIFEST_CANARY: JSON.stringify(canary) });
  assert.equal(pubblico.corpo.disponibile, false);

  const sconosciuto = await manda(db, null, "GET",
    percorso.replace("canale=canary", "canale=beta"),
    { MOX_RELEASE_MANIFEST_CANARY: JSON.stringify(canary) });
  assert.equal(sconosciuto.stato, 400);
});

// Il bucket delle release in miniatura: chiavi, byte, e l'elenco delle chiavi
// chieste, per vedere che il Worker non legga mai niente fuori forma.
function bucketFinto(oggetti = {}) {
  const dentro = new Map(Object.entries(oggetti));
  const chieste = [];
  return {
    chieste,
    metti(chiave, testo) { dentro.set(chiave, new TextEncoder().encode(testo)); },
    async get(chiave) {
      chieste.push(chiave);
      const byte = dentro.get(chiave);
      return byte ? { body: new Blob([byte]).stream(), size: byte.length } : null;
    },
  };
}

async function scarica(percorso, ambiente, metodo = "GET") {
  const risposta = await server.fetch(
    new Request("https://esempio.invalid" + percorso, { method: metodo }), ambiente);
  return { stato: risposta.status, testo: await risposta.text(), headers: risposta.headers };
}

async function sha256(testo) {
  const impronta = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo));
  return [...new Uint8Array(impronta)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function releaseFinta(bucket, versione, numero, contenuto) {
  const impronta = await sha256(contenuto);
  const percorso = `/mox/installer/${numero}/${impronta}/Mox-Installer-win-x64.exe`;
  bucket.metti(percorso.replace("/mox/", ""), contenuto);
  return { versione, url: "https://api.moxtracker.app" + percorso, sha256: impronta,
    dimensione: contenuto.length, firma: "f" };
}

test("stable e canary scaricano ognuno i propri byte, e il canary non tocca lo stable", async () => {
  const db = creaFintoD1(SCHEMA);
  const bucket = bucketFinto();
  const stabile = await releaseFinta(bucket, "2 beta 2.11.3", "2.11.3", "installer-A");
  const ambiente = { MOX_RELEASES: bucket, MOX_RELEASE_MANIFEST: JSON.stringify(stabile) };
  const release = "/mox/release?piattaforma=win-x64&corrente=2%20beta%202.11.2&canale=";

  const primo = await manda(db, null, "GET", release + "stable", ambiente);
  const percorsoStabile = new URL(primo.corpo.url).pathname;
  const prima = await scarica(percorsoStabile, { DB: db, ...ambiente });
  assert.equal(prima.stato, 200);
  assert.equal(prima.testo, "installer-A");
  assert.equal(prima.headers.get("cache-control"), "no-store");
  // senza manifesto canary il canary non ripiega sullo stable
  const vuoto = await manda(db, null, "GET", release + "canary", ambiente);
  assert.equal(vuoto.corpo.disponibile, false);

  // si pubblica un canary: installer nuovo, manifesto canary
  const canary = await releaseFinta(bucket, "2 beta 2.12.0", "2.12.0", "installer-B");
  ambiente.MOX_RELEASE_MANIFEST_CANARY = JSON.stringify(canary);
  const dalCanary = await manda(db, null, "GET", release + "canary", ambiente);
  assert.equal(dalCanary.corpo.versione, "2 beta 2.12.0");
  const byteCanary = await scarica(new URL(dalCanary.corpo.url).pathname, { DB: db, ...ambiente });
  assert.equal(byteCanary.testo, "installer-B");

  // lo stable resta identico: stesso manifesto, stesso URL, stessi byte
  const dopo = await manda(db, null, "GET", release + "stable", ambiente);
  assert.equal(dopo.corpo.versione, "2 beta 2.11.3");
  assert.equal(dopo.corpo.url, primo.corpo.url);
  const ancora = await scarica(percorsoStabile, { DB: db, ...ambiente });
  assert.equal(ancora.testo, "installer-A");
  assert.equal(await sha256(ancora.testo), stabile.sha256);

  // un canary ripubblicato con lo stesso numero finisce in un'altra chiave
  const ribattuto = await releaseFinta(bucket, "2 beta 2.12.0", "2.12.0", "installer-C");
  assert.notEqual(ribattuto.url, canary.url);
  assert.equal((await scarica(percorsoStabile, { DB: db, ...ambiente })).testo, "installer-A");
});

test("l'indirizzo storico serve ancora l'oggetto storico, e solo quello", async () => {
  const bucket = bucketFinto();
  bucket.metti("Mox-Installer-win-x64.exe", "installer-2.11.2");
  bucket.metti(`installer/2.12.0/${"a".repeat(64)}/Mox-Installer-win-x64.exe`, "canary");
  const storico = await scarica("/mox/download.exe", { MOX_RELEASES: bucket });
  assert.equal(storico.stato, 200);
  assert.equal(storico.testo, "installer-2.11.2");
  assert.equal(storico.headers.get("content-disposition"),
    "attachment; filename=\"Mox-Installer-win-x64.exe\"");
  assert.deepEqual(bucket.chieste, ["Mox-Installer-win-x64.exe"]);

  const post = await scarica("/mox/download.exe", { MOX_RELEASES: bucket }, "POST");
  assert.equal(post.stato, 405);
  const senzaBucket = await scarica("/mox/download.exe", {});
  assert.equal(senzaBucket.stato, 503);
});

test("un percorso di installer fuori forma non legge niente dal bucket", async () => {
  const bucket = bucketFinto({ "Mox-Installer-win-x64.exe": new Uint8Array([1]) });
  const buono = "a".repeat(64);
  const fuoriForma = [
    `/mox/installer/2.12.0/${"A".repeat(64)}/Mox-Installer-win-x64.exe`,
    `/mox/installer/2.12.0/${"a".repeat(63)}/Mox-Installer-win-x64.exe`,
    `/mox/installer/2.12/${buono}/Mox-Installer-win-x64.exe`,
    `/mox/installer/2.12.0-canary1/${buono}/Mox-Installer-win-x64.exe`,
    `/mox/installer/2.12.0/${buono}/altro.exe`,
    `/mox/installer/2.12.0/${buono}/Mox-Installer-win-x64.exe/extra`,
    `/mox/installer/../Mox-Installer-win-x64.exe`,
    `/mox/installer/2.12.0/%2e%2e/Mox-Installer-win-x64.exe`,
    "/mox/installer/",
  ];
  for (const percorso of fuoriForma) {
    const esito = await scarica(percorso, { MOX_RELEASES: bucket });
    assert.notEqual(esito.stato, 200, percorso);
  }
  assert.deepEqual(bucket.chieste, []);

  const mancante = await scarica(`/mox/installer/2.12.0/${buono}/Mox-Installer-win-x64.exe`,
    { MOX_RELEASES: bucket });
  assert.equal(mancante.stato, 404);
  assert.deepEqual(bucket.chieste, [`installer/2.12.0/${buono}/Mox-Installer-win-x64.exe`]);
});

test("un manifesto rotto risponde 503 su entrambi i canali, senza ripieghi", async () => {
  const db = creaFintoD1(SCHEMA);
  const buono = JSON.stringify({ versione: "2 beta 2.11.3", url: "https://x.invalid/a.exe",
    sha256: "a".repeat(64), dimensione: 1, firma: "f" });
  const incompleto = JSON.stringify({ versione: "2 beta 2.11.3", url: "https://x.invalid/a.exe" });
  for (const canale of ["stable", "canary"]) {
    const variabile = canale === "canary" ? "MOX_RELEASE_MANIFEST_CANARY" : "MOX_RELEASE_MANIFEST";
    const altro = canale === "canary" ? "MOX_RELEASE_MANIFEST" : "MOX_RELEASE_MANIFEST_CANARY";
    const percorso = `/mox/release?piattaforma=win-x64&canale=${canale}&corrente=2%20beta%202.11.2`;
    for (const rotto of ["{non json", incompleto, "null"]) {
      const esito = await manda(db, null, "GET", percorso, { [variabile]: rotto, [altro]: buono });
      assert.equal(esito.stato, 503, `${canale}: ${rotto}`);
      assert.equal(esito.headers.get("cache-control"), "no-store");
    }
  }
});

test("il ponte updater ritarda solo i client precedenti alla correzione", async () => {
  const db = creaFintoD1(SCHEMA);
  const manifesto = {
    versione: "2 beta 2.9.22", url: "https://example.invalid/Mox.exe",
    sha256: "a".repeat(64), dimensione: 123, firma: "firma",
  };
  const inizio = Date.now();
  const esito = await manda(db, null, "GET",
    "/mox/release?piattaforma=win-x64&canale=stable&corrente=2%20beta%202.9.21",
    { MOX_RELEASE_MANIFEST: JSON.stringify(manifesto),
      MOX_RELEASE_RECOVERY_DELAY_MS: "25" });

  assert.equal(esito.corpo.disponibile, true);
  assert.ok(Date.now() - inizio >= 20);
  assert.equal(esito.headers.get("cache-control"), "no-store");
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
  assert.equal(riga.rank_stato, "completo");
  const conservato = structuredClone(ESEMPIO);
  delete conservato.segreto_cancellazione;
  assert.deepEqual(JSON.parse(riga.dato), conservato,
    "il pacchetto deve restare intero salvo il segreto di cancellazione");
});

test("un evento con mazzo fornito entra senza formato e non sporca Standard", async () => {
  const db = creaFintoD1(SCHEMA);
  const fornita = copia({ evento: "DualColorPrecons", formato: null });
  const ingresso = await manda(db, fornita);
  assert.equal(ingresso.stato, 200);
  assert.equal(ingresso.corpo.accettate, 1);

  const meta = await manda(db, null, "GET", "/meta?formato=Standard");
  assert.equal(meta.stato, 200);
  assert.equal(meta.corpo.partite_totali, 0);
  assert.deepEqual(meta.corpo.mazzi, []);
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
