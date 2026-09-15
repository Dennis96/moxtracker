// Il validator Research: chiuso a ogni livello, niente null, niente campi
// locali o GRE, gruppi atomici e registro esatto dei modelli.
//
// La golden rev2 e' la fixture permanente: deve passare intera. Ogni
// mutazione qui sotto deve essere rifiutata, mai ignorata o ripulita.

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { leggiCorpo, validaBusta, validaContribution } from "../src/research/validatore.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const GOLDEN = JSON.parse(readFileSync(QUI + "fixtures/research-golden-rev2.json", "utf8"));
const CONFIG = { max_contributions_per_request: 5, max_body_bytes: 262144 };

const copia = (x) => JSON.parse(JSON.stringify(x));
const bo1 = () => copia(GOLDEN.richiesta.partite[0]);
const bo3 = () => copia(GOLDEN.richiesta.partite[1]);
const busta = () => copia(GOLDEN.richiesta);

function rifiuto(contribution) {
  const esito = validaContribution(contribution);
  assert.ok(esito, "doveva essere rifiutata");
  return esito;
}

test("le due contribution golden e la busta golden passano", () => {
  assert.equal(validaContribution(bo1()), null);
  assert.equal(validaContribution(bo3()), null);
  assert.deepEqual(validaBusta(busta(), CONFIG), { ok: true });
});

// Tutti gli oggetti della contribution, con il loro percorso: a ciascuno si
// aggiunge una chiave estranea, e a ciascuna foglia si sostituisce null.
function nodi(valore, percorso = "", fuori = []) {
  if (Array.isArray(valore)) {
    valore.forEach((v, i) => nodi(v, `${percorso}[${i}]`, fuori));
  } else if (valore && typeof valore === "object") {
    fuori.push({ percorso, oggetto: true });
    for (const [k, v] of Object.entries(valore)) {
      const qui = percorso ? `${percorso}.${k}` : k;
      fuori.push({ percorso: qui, oggetto: false });
      nodi(v, qui, fuori);
    }
  }
  return fuori;
}

function raggiungi(radice, percorso) {
  const passi = percorso.match(/[^.[\]]+/g) || [];
  let nodo = radice;
  for (const passo of passi) nodo = nodo[/^\d+$/.test(passo) ? Number(passo) : passo];
  return nodo;
}

function genitoreEChiave(radice, percorso) {
  const passi = percorso.match(/[^.[\]]+/g);
  const ultima = passi.pop();
  let nodo = radice;
  for (const passo of passi) nodo = nodo[/^\d+$/.test(passo) ? Number(passo) : passo];
  return [nodo, /^\d+$/.test(ultima) ? Number(ultima) : ultima];
}

test("una chiave estranea in qualunque oggetto della golden viene rifiutata", () => {
  for (const crea of [bo1, bo3]) {
    for (const { percorso, oggetto } of nodi(crea())) {
      if (!oggetto) continue;
      const c = crea();
      const bersaglio = percorso ? raggiungi(c, percorso) : c;
      bersaglio.campo_estraneo = 1;
      const esito = rifiuto(c);
      assert.equal(esito.motivo_codice, "campo_non_ammesso", percorso);
    }
  }
});

test("null al posto di qualunque valore della golden viene rifiutato", () => {
  for (const crea of [bo1, bo3]) {
    for (const { percorso, oggetto } of nodi(crea())) {
      if (oggetto || !percorso) continue;
      const c = crea();
      const [genitore, chiave] = genitoreEChiave(c, percorso);
      genitore[chiave] = null;
      rifiuto(c);
    }
  }
});

test("durata, provenance e segreti non entrano nel wire Research", () => {
  for (const [dove, chiave] of [["", "durata"], ["", "segreto_cancellazione"],
    ["", "partita"], ["", "apertura"], ["games[0]", "_eventi_provenienza"],
    ["games[0]", "_copertura"], ["games[0].draws[0]", "game_state_id"],
    ["avversario", "mano"]]) {
    const c = bo1();
    (dove ? raggiungi(c, dove) : c)[chiave] = 1;
    assert.equal(rifiuto(c).motivo_codice, "campo_non_ammesso", chiave);
  }
});

test("il modello si controlla contro il registro esatto, non un intervallo", () => {
  for (const [modello, motivo] of [[0, "modello_non_valido"], [-1, "modello_non_valido"],
    [1.5, "modello_non_valido"], ["1", "modello_non_valido"], [true, "modello_non_valido"],
    [2, "modello_non_supportato"], [1000, "modello_non_supportato"]]) {
    const c = bo1();
    c.revisione.modello = modello;
    assert.equal(rifiuto(c).motivo_codice, motivo, String(modello));
  }
  const c = bo1();
  c.revisione.osservazioni = 0;
  rifiuto(c);
});

test("i gruppi atomici non si spezzano", () => {
  const casi = [
    (c) => { delete c.games[0].deck_source; },
    (c) => { delete c.games[0].deck; },
    (c) => { delete c.fuso; },
    (c) => { delete c.quando; },
  ];
  for (const muta of casi) { const c = bo1(); muta(c); rifiuto(c); }
  const mano = bo3();
  mano.games[0].opening_hand_size = 5;
  rifiuto(mano);
  const soloIn = bo3();
  delete soloIn.games[2].sideboard_out;
  rifiuto(soloIn);
});

test("delta e compared_to_game devono essere coerenti con i game adiacenti", () => {
  const lontano = bo3();
  lontano.games[2].deck_source.compared_to_game = 1;
  rifiuto(lontano);
  const incoerente = bo3();
  incoerente.games[2].sideboard_in = [4001];
  rifiuto(incoerente);
  const primo = bo3();
  primo.games[0].sideboard_in = [];
  primo.games[0].sideboard_out = [];
  rifiuto(primo);
  const iniziale = bo3();
  iniziale.games[0].deck_source.compared_to_game = 0;
  rifiuto(iniziale);
});

test("marcatori di conflitto: ordinati, non vuoti e senza i membri contesi", () => {
  const presente = bo3();
  presente.games[1].on_play = true;           // on_play e' conteso in G2
  rifiuto(presente);
  const vuoto = bo3();
  vuoto.games[1].conflicted_fields = [];
  rifiuto(vuoto);
  const disordinato = bo3();
  disordinato.campi_contesi = ["rank", "evento"];
  delete disordinato.evento;
  rifiuto(disordinato);
  const matchPresente = bo3();
  matchPresente.rank = { costruito: { classe: "Gold" } };
  rifiuto(matchPresente);
  const evento = bo1();
  evento.games[0].conflicted_event_ids = [evento.games[0].draws[0].event_id];
  rifiuto(evento);
  const ignoto = bo1();
  ignoto.games[0].conflicted_fields = ["tutto"];
  rifiuto(ignoto);
});

test("eventi: forma esatta, id unici nel game, liste non vuote", () => {
  const doppio = bo1();
  doppio.games[0].casts[0].event_id = doppio.games[0].draws[0].event_id;
  rifiuto(doppio);
  const vuoto = bo1();
  vuoto.games[0].lands = [];
  rifiuto(vuoto);
  const turno = bo1();
  turno.games[0].draws[0].turno = 0;
  rifiuto(turno);
  const maiuscolo = bo1();
  maiuscolo.games[0].draws[0].event_id = maiuscolo.games[0].draws[0].event_id.toUpperCase();
  rifiuto(maiuscolo);
  const tipi = bo1();
  tipi.games[0].incomplete_event_types = [];
  rifiuto(tipi);
  const ordine = bo1();
  ordine.games[0].incomplete_event_types = ["land", "draw"];
  rifiuto(ordine);
});

test("limiti: game, turni, mazzo, carte e stringhe", () => {
  const casi = [
    (c) => { c.turni = 0; },
    (c) => { c.games[0].turni = 501; },
    (c) => { c.games[0].game_number = 0; },
    (c) => { c.games.push({ ...copia(c.games[0]), game_number: 1 }); },
    (c) => { c.games[0].deck.main = {}; },
    (c) => { c.games[0].deck.main = { "11": 251 }; },
    (c) => { c.games[0].deck.main = { "011": 4 }; },
    (c) => { c.avversario.carte = []; },
    (c) => { c.avversario.carte = [9002, 9001]; },
    (c) => { c.evento = "x".repeat(81); },
    (c) => { c.evento = "0b1c2d3e-aaaa-bbbb-cccc-0123456789ab"; },
    (c) => { c.arena = "con spazio"; },
    (c) => { c.esito = "pareggio"; },
    (c) => { c.fuso = 900; },
    (c) => { c.quando = "2026-09-13 08:00:00"; },
    (c) => { c.id_pubblico = c.id_pubblico.slice(1); },
    (c) => { c.games = []; },
    (c) => { c.games[0].mulligans = 8; },
    (c) => { c.turni = 2 ** 60; },
  ];
  casi.forEach((muta, i) => { const c = bo1(); muta(c); assert.ok(validaContribution(c), `caso ${i}`); });
  const sideboardVuoto = bo1();
  assert.deepEqual(sideboardVuoto.games[0].deck.sideboard, {});
  assert.equal(validaContribution(sideboardVuoto), null, "{} vale sideboard dichiarato vuoto");
});

test("la busta e' chiusa e controlla versione, identita' e numero di partite", () => {
  const casi = [
    [(b) => { b.extra = 1; }, 400, "campo_non_ammesso"],
    [(b) => { b.versione = 3; }, 400, "valore_non_valido"],
    [(b) => { b.mittente = "ABCDEF0123456789ABCDEF0123456789"; }, 400, "valore_non_valido"],
    [(b) => { b.segreto_cancellazione = "1"; }, 400, "valore_non_valido"],
    [(b) => { b.consenso_research = { versione: 0 }; }, 400, "valore_non_valido"],
    [(b) => { b.consenso_research = { versione: 1, id: "x" }; }, 400, "campo_non_ammesso"],
    [(b) => { b.mox = "x".repeat(41); }, 400, "valore_non_valido"],
    [(b) => { b.partite = []; }, 400, "valore_non_valido"],
    [(b) => { delete b.partite; }, 400, "campo_mancante"],
    [(b) => { b.partite = Array(6).fill(b.partite[0]); }, 413, "troppi_contributi"],
  ];
  for (const [muta, stato, errore] of casi) {
    const b = busta();
    muta(b);
    const esito = validaBusta(b, CONFIG);
    assert.equal(esito.ok, false);
    assert.equal(esito.stato, stato, errore);
    assert.equal(esito.errore, errore);
  }
  assert.equal(validaBusta([], CONFIG).stato, 400);
  assert.equal(validaBusta(busta(), { ...CONFIG, max_contributions_per_request: 1 }).cap, 1);
});

function richiesta(corpo, intestazioni = {}) {
  return new Request("https://esempio.invalid/research/partite", {
    method: "POST", body: corpo, headers: intestazioni,
  });
}

test("il body si misura sui byte letti, non su Content-Length", async () => {
  const piccolo = await leggiCorpo(richiesta("{}"), 10);
  assert.deepEqual(piccolo, { ok: true, testo: "{}", byte: 2 });
  const grande = await leggiCorpo(richiesta("x".repeat(11)), 10);
  assert.equal(grande.ok, false);
  assert.equal(grande.stato, 413);
  assert.equal(grande.errore, "body_troppo_grande");
  const dichiarato = await leggiCorpo(richiesta("{}", { "content-length": "999" }), 10);
  assert.equal(dichiarato.stato, 413);
  // Uno stream senza lunghezza dichiarata viene comunque contato.
  const stream = new ReadableStream({ start(c) {
    c.enqueue(new TextEncoder().encode("x".repeat(6)));
    c.enqueue(new TextEncoder().encode("x".repeat(6)));
    c.close();
  } });
  const flusso = await leggiCorpo(new Request("https://e.invalid/", {
    method: "POST", body: stream, duplex: "half" }), 10);
  assert.equal(flusso.stato, 413);
  const utf8 = await leggiCorpo(richiesta("ééé"), 5);
  assert.equal(utf8.stato, 413, "i byte UTF-8 sono 6, non 3 caratteri");
});
