// Le prove di quello che il server accetta e rifiuta.
//
// Girano con `npm run prove`: nessuna rete, nessun database, mezzo secondo.
// Il pacchetto di partenza e' copiato da quello che Mox produce davvero -
// `python strumenti/pacchetto_partita.py --esempio` - perche' una prova
// costruita su un pacchetto inventato prova il server contro se stesso.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { controlla, riga, LIMITI } from "../src/controlli.js";

function pacchettoBuono(cambia = {}) {
  return {
    versione: 1,
    partita: "d8e352c369",
    mittente: "0".repeat(32),
    evento: "Ladder",
    formato: "Standard",
    mazzo: {
      impronta: "a".repeat(64),
      carte: { "101": 4, "102": 2 },
    },
    avversario: { carte: [201, 202] },
    andamento: { esito: "vinta", mulligan: 1, su_gioco: true, giochi: ["vinta", "persa", "vinta"] },
    quando: "2026-08-17T18:24:00Z",
    fuso: 120,
    durata: 517,
    turni: 18,
    rank: { costruito: { classe: "Gold", livello: 3 } },
    apertura: { "101": 2 },
    mox: "2 beta 2.6",
    arena: "2026.62.1",
    ...cambia,
  };
}

test("un pacchetto come lo manda Mox passa", () => {
  assert.equal(controlla(pacchettoBuono()), null);
});

test("un pacchetto minimo passa: quello che manca non e' un errore", () => {
  // Le registrazioni vecchie non hanno data, turni, rank. Devono poter
  // arrivare lo stesso, se no il server rifiuterebbe meta' archivio.
  const magro = {
    versione: 1,
    partita: "d8e352c369",
    mittente: "0".repeat(32),
    evento: "Ladder",
    formato: null,
    mazzo: { impronta: "a".repeat(64), carte: { "101": 60 } },
    avversario: { carte: [] },
    andamento: { esito: "persa", mulligan: 0 },
    mox: "2 beta 2.6",
  };
  assert.equal(controlla(magro), null);
});

test("la versione sconosciuta si rifiuta invece di indovinare", () => {
  assert.equal(controlla(pacchettoBuono({
    versione: 2, segreto_cancellazione: "d".repeat(64),
  })), null,
    "la v2 e' quella prodotta da Mox 2.9");
  assert.match(controlla(pacchettoBuono({ versione: 2 })), /segreto/);
  assert.match(controlla(pacchettoBuono({ versione: 3 })), /versione/);
  assert.match(controlla(pacchettoBuono({ versione: undefined })), /versione/);
});

test("gli identificativi devono avere la forma giusta", () => {
  assert.match(controlla(pacchettoBuono({ partita: "corto" })), /partita/);
  assert.match(controlla(pacchettoBuono({ partita: "MAIUSCOLO1" })), /partita/);
  assert.match(controlla(pacchettoBuono({ mittente: "x".repeat(32) })), /mittente/);
  assert.match(controlla(pacchettoBuono({ mittente: 12345 })), /mittente/);
});

test("dell'avversario non si accetta niente oltre le carte rivelate", () => {
  const conMano = pacchettoBuono({
    avversario: { carte: [201], mano: [301, 302] },
  });
  assert.match(controlla(conMano), /mano/);
  const conNome = pacchettoBuono({ avversario: { carte: [201], nome: "Qualcuno" } });
  assert.match(controlla(conNome), /nome/);
});

test("i numeri fuori dal mondo si fermano qui", () => {
  assert.match(controlla(pacchettoBuono({ turni: 0 })), /turni/);
  assert.match(controlla(pacchettoBuono({ turni: 10000 })), /turni/);
  assert.match(controlla(pacchettoBuono({ durata: -1 })), /durata/);
  assert.match(controlla(pacchettoBuono({ durata: LIMITI.durataMassima + 1 })), /durata/);
  assert.match(controlla(pacchettoBuono({ andamento: { esito: "vinta", mulligan: 9 } })), /mulligan/);
  assert.match(controlla(pacchettoBuono({ andamento: { esito: "pareggio", mulligan: 0 } })), /esito/);
});

test("un mazzo impossibile non entra", () => {
  assert.match(controlla(pacchettoBuono({ mazzo: { impronta: "a".repeat(64), carte: {} } })), /carte/);
  const troppe = {};
  for (let n = 0; n < 300; n += 1) troppe[String(1000 + n)] = 4;
  assert.match(controlla(pacchettoBuono({ mazzo: { impronta: "a".repeat(64), carte: troppe } })), /carte/);
  assert.match(controlla(pacchettoBuono({
    mazzo: { impronta: "a".repeat(64), carte: { "nome carta": 4 } },
  })), /carte/);
});

test("la data deve essere UTC e vera", () => {
  assert.match(controlla(pacchettoBuono({ quando: "17/08/2026 20:24" })), /data/);
  assert.match(controlla(pacchettoBuono({ quando: "2026-13-45T99:99:99Z" })), /data/);
  assert.match(controlla(pacchettoBuono({ fuso: 5000 })), /fuso/);
});

test("quello che non e' un pacchetto viene detto, non ignorato", () => {
  for (const roba of [null, 42, "ciao", [], undefined]) {
    assert.ok(controlla(roba), `${JSON.stringify(roba)} doveva essere rifiutato`);
  }
});

test("la riga per il database conserva il pacchetto intero", () => {
  const dato = pacchettoBuono();
  const r = riga(dato, "2026-08-18T10:00:00.000Z");
  assert.equal(r.id, "d8e352c369");
  assert.equal(r.esito, "vinta");
  assert.equal(r.su_gioco, 1);
  assert.equal(r.giochi, 3);
  assert.equal(r.rank_classe, "Gold");
  assert.equal(r.rank_livello, 3);
  assert.equal(r.rank_stato, "completo");
  assert.deepEqual(JSON.parse(r.dato), dato, "il pacchetto originale deve restare intero");
});

test("senza rank e senza play/draw le colonne restano vuote, non zero", () => {
  const dato = pacchettoBuono();
  delete dato.rank;
  delete dato.andamento.su_gioco;
  delete dato.turni;
  const r = riga(dato, "2026-08-18T10:00:00.000Z");
  assert.equal(r.rank_classe, null);
  assert.equal(r.rank_livello, null);
  assert.equal(r.rank_stato, "assente");
  assert.equal(r.su_gioco, null, "«non si sa» non deve diventare «alla risposta»");
  assert.equal(r.turni, null);
});

test("il rank del limited vale quando non c'e' il costruito", () => {
  const dato = pacchettoBuono({ rank: { limitato: { classe: "Silver", livello: 4 } } });
  const r = riga(dato, "2026-08-18T10:00:00.000Z");
  assert.equal(r.rank_classe, "Silver");
  assert.equal(r.rank_livello, 4);
  assert.equal(r.rank_stato, "completo");
});

test("un livello ricevuto senza classe resta un rank parziale", () => {
  const dato = pacchettoBuono({ rank: { costruito: { livello: 3, vinte: 3, perse: 4 } } });
  const r = riga(dato, "2026-08-22T12:04:22.591Z");
  assert.equal(r.rank_classe, null);
  assert.equal(r.rank_livello, 3);
  assert.equal(r.rank_stato, "parziale");
});
