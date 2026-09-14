// Join a snapshot revisionata, classi anti-regressione e summary top-3.
//
// Gli esiti attesi sono scritti a mano dalla tabella dell'addendum G3B/G5 §2
// e dal G5b §4; le proprieta' algebriche si provano su tutte le permutazioni.

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  confrontaRevisione, decidi, unisciSummary, violazioneClassi, CollisioneHash, effettiva,
} from "../src/research/join.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const GOLDEN = JSON.parse(readFileSync(QUI + "fixtures/research-golden-rev2.json", "utf8"));
const copia = (x) => JSON.parse(JSON.stringify(x));
const bo1 = () => copia(GOLDEN.richiesta.partite[0]);
const bo3 = () => copia(GOLDEN.richiesta.partite[1]);

const h = (n) => n.toString(16).padStart(64, "0");
const arrivo = (modello, osservazioni, ...varianti) => ({
  revisione: { modello, osservazioni },
  retained: varianti.map(([hash, body]) => ({ hash, body })),
  overflow: false,
});

test("le revisioni si ordinano per modello e poi per osservazioni", () => {
  assert.equal(confrontaRevisione({ modello: 1, osservazioni: 9 }, { modello: 2, osservazioni: 1 }), -1);
  assert.equal(confrontaRevisione({ modello: 1, osservazioni: 3 }, { modello: 1, osservazioni: 2 }), 1);
  assert.equal(confrontaRevisione({ modello: 1, osservazioni: 2 }, { modello: 1, osservazioni: 2 }), 0);
});

test("la tabella degli esiti del join", () => {
  const a = bo1();
  const piu = bo1(); piu.revisione.osservazioni = 3; piu.turni = 7;
  const primo = decidi(null, arrivo(1, 2, [h(5), a]));
  assert.equal(primo.esito, "accepted_new");
  assert.equal(effettiva(primo.stato), true);
  assert.equal(decidi(primo.stato, arrivo(1, 1, [h(4), a])).esito, "stale");
  assert.equal(decidi(primo.stato, arrivo(1, 2, [h(5), a])).esito, "unchanged");
  const cresciuto = decidi(primo.stato, arrivo(1, 3, [h(6), piu]));
  assert.equal(cresciuto.esito, "updated");
  assert.deepEqual(cresciuto.stato.revisione, { modello: 1, osservazioni: 3 });
  const conteso = decidi(primo.stato, arrivo(1, 2, [h(7), bo3()]));
  assert.equal(conteso.esito, "conflict");
  assert.equal(effettiva(conteso.stato), false);
  assert.deepEqual(conteso.stato.retained.map((v) => v.hash), [h(5), h(7)]);
});

test("un modello maggiore sostituisce senza classi, il minore e' stale", () => {
  const vecchio = bo1();
  const nuovo = bo1(); nuovo.turni = 1;      // regressione, ma con modello nuovo
  const stato = decidi(null, arrivo(1, 5, [h(1), vecchio])).stato;
  const bump = decidi(stato, arrivo(2, 1, [h(2), nuovo]));
  assert.equal(bump.esito, "updated");
  assert.equal(decidi(bump.stato, arrivo(1, 99, [h(1), vecchio])).esito, "stale");
  // Anche uno stato in conflitto viene sostituito per intero dal bump.
  const conflitto = decidi(stato, arrivo(1, 5, [h(3), bo3()])).stato;
  const risolto = decidi(conflitto, arrivo(2, 1, [h(2), nuovo]));
  assert.equal(risolto.esito, "updated");
  assert.equal(effettiva(risolto.stato), true);
});

test("a parita' di modello una regressione non dichiarata viene rifiutata", () => {
  const base = bo3();
  const stato = decidi(null, arrivo(1, 3, [h(1), base])).stato;
  const casi = {
    "turni match scende": (c) => { c.turni = 23; },
    "quando si sposta dopo": (c) => { c.quando = "2026-09-13T09:00:01Z"; },
    "quando sparisce": (c) => { delete c.quando; delete c.fuso; },
    "evento cambia": (c) => { c.evento = "Altro"; },
    "evento sparisce senza contesa": (c) => { delete c.evento; },
    "carte avversarie calano": (c) => { c.avversario.carte = [9101, 9102]; },
    "campo conteso torna noto": (c) => { delete c.campi_contesi; c.rank = { costruito: { classe: "Gold" } }; },
    "un game sparisce": (c) => { c.games.pop(); },
    "mano tenuta cambia": (c) => { c.games[0].opening_hand_kept = [2001, 2001, 2003, 2004, 2005, 2006]; },
    "mazzo cambia": (c) => { c.games[0].deck.main["2001"] = 3; c.games[0].deck.main["6001"] = 35; },
    "evento pubblico sparisce": (c) => { delete c.games[0].draws; },
    "evento cambia carta": (c) => { c.games[0].draws[0].card_id = 2999; },
    "conflitto di gruppo sparisce": (c) => { delete c.games[1].conflicted_fields; c.games[1].on_play = false; },
    "evento conteso torna pubblico": (c) => { delete c.games[2].conflicted_event_ids; },
    "turni del game scendono": (c) => { c.games[0].turni = 7; },
  };
  for (const [nome, muta] of Object.entries(casi)) {
    const nuovo = bo3(); nuovo.revisione.osservazioni = 4; muta(nuovo);
    const esito = decidi(stato, arrivo(1, 4, [h(2), nuovo]));
    assert.equal(esito.esito, "rejected", nome);
    assert.equal(esito.motivo, "regressione_non_dichiarata", nome);
    assert.equal(esito.stato, stato, `${nome}: stato invariato`);
  }
});

test("le transizioni ammesse dalle classi passano", () => {
  const base = bo3();
  const stato = decidi(null, arrivo(1, 3, [h(1), base])).stato;
  const casi = {
    "turni match crescono": (c) => { c.turni = 25; },
    "quando si anticipa": (c) => { c.quando = "2026-09-13T08:59:00Z"; },
    "evento diventa conteso": (c) => { delete c.evento; c.campi_contesi = ["evento", "rank"]; },
    "carte avversarie crescono": (c) => { c.avversario.carte = [9101, 9102, 9103, 9103]; },
    "un evento diventa conteso": (c) => {
      const id = c.games[0].casts[0].event_id; delete c.games[0].casts;
      c.games[0].conflicted_event_ids = [id]; c.games[0].incomplete_event_types = ["cast"];
    },
    "evento nuovo": (c) => { c.games[0].draws.push({ event_id: h(77), turno: 3, card_id: 2005 }); },
    "gruppo noto diventa conteso": (c) => {
      delete c.games[0].opening_hand_kept; delete c.games[0].opening_hand_size;
      c.games[0].conflicted_fields = ["opening_hand"];
    },
    "turni del game contesi": (c) => { delete c.games[0].turni; c.games[0].conflicted_fields = ["turni"]; },
    "segnale di stato libero": (c) => { c.games[0].state_reset_observed = true; },
    "diagnostica libera": (c) => { delete c.games[2].incomplete_event_types; },
    "campo ignoto diventa noto": (c) => { c.games[1].mulligans = 0; },
    "game nuovo": (c) => { c.games.push({ game_number: 4, result: "vinta" }); },
  };
  for (const [nome, muta] of Object.entries(casi)) {
    const nuovo = bo3(); nuovo.revisione.osservazioni = 4; muta(nuovo);
    assert.equal(violazioneClassi(base, nuovo), null, nome);
    assert.equal(decidi(stato, arrivo(1, 4, [h(2), nuovo])).esito, "updated", nome);
  }
  // turni del game: da conteso puo' tornare noto.
  const conteso = bo3(); delete conteso.games[0].turni; conteso.games[0].conflicted_fields = ["turni"];
  const noto = bo3(); noto.games[0].turni = 3;
  assert.equal(violazioneClassi(conteso, noto), null);
});

test("il summary tiene i tre hash minori e marca overflow dalla quarta variante", () => {
  const corpo = (n) => ({ n });
  let stato = decidi(null, arrivo(1, 1, [h(50), corpo(50)])).stato;
  const esiti = [];
  for (const n of [40, 60, 30, 70, 10]) {
    const r = decidi(stato, arrivo(1, 1, [h(n), corpo(n)]));
    esiti.push(r.esito);
    stato = r.stato;
  }
  assert.deepEqual(esiti, ["conflict", "conflict", "conflict_overflow", "conflict_overflow",
    "conflict_overflow"]);
  assert.deepEqual(stato.retained.map((v) => v.hash), [h(10), h(30), h(40)]);
  assert.equal(stato.overflow, true);
  // Un hash scartato ritentato non cambia niente.
  const ancora = decidi(stato, arrivo(1, 1, [h(60), corpo(60)]));
  assert.equal(ancora.esito, "conflict_overflow");
  assert.deepEqual(ancora.stato, stato);
  // Un hash noto ritentato in conflitto: invariato.
  assert.deepEqual(decidi(stato, arrivo(1, 1, [h(10), corpo(10)])).stato, stato);
});

test("lo stesso hash con due body diversi e' una collisione, non un retry", () => {
  const stato = decidi(null, arrivo(1, 1, [h(1), { a: 1 }])).stato;
  assert.throws(() => decidi(stato, arrivo(1, 1, [h(1), { a: 2 }])), CollisioneHash);
});

function permutazioni(lista) {
  if (lista.length <= 1) return [lista];
  return lista.flatMap((x, i) => permutazioni([...lista.slice(0, i), ...lista.slice(i + 1)])
    .map((resto) => [x, ...resto]));
}

test("unione dei summary: commutativa, associativa e idempotente su 4-8 varianti", () => {
  for (const quante of [4, 5, 6, 7, 8]) {
    const singole = Array.from({ length: quante }, (_, i) =>
      arrivo(1, 1, [h(1000 - i * 37), { v: i }]));
    let atteso = null;
    for (const ordine of permutazioni(singole).slice(0, 720)) {
      const fuso = ordine.reduce((acc, s) => (acc ? unisciSummary(acc, s) : s), null);
      if (atteso === null) atteso = fuso;
      assert.deepEqual(fuso, atteso);
      assert.deepEqual(unisciSummary(fuso, fuso), fuso, "idempotente");
    }
    assert.equal(atteso.overflow, true);
    assert.equal(atteso.retained.length, 3);
    // associativita' con raggruppamenti diversi e summary gia' in overflow
    const [a, b, c, ...resto] = singole;
    const sinistra = unisciSummary(unisciSummary(a, b), unisciSummary(c, resto.reduce(unisciSummary)));
    const destra = unisciSummary(a, unisciSummary(b, unisciSummary(c, resto.reduce(unisciSummary))));
    assert.deepEqual(sinistra, destra);
  }
});

test("l'esito finale del join sequenziale non dipende dall'ordine degli arrivi", () => {
  const corpo = (n) => ({ n });
  const arrivi = [
    arrivo(1, 1, [h(9), corpo(9)]), arrivo(1, 2, [h(8), corpo(8)]),
    arrivo(1, 2, [h(7), corpo(7)]), arrivo(1, 2, [h(8), corpo(8)]),
    arrivo(1, 2, [h(6), corpo(6)]), arrivo(1, 2, [h(5), corpo(5)]),
  ];
  let atteso = null;
  for (const ordine of permutazioni(arrivi)) {
    const stato = ordine.reduce((s, a) => decidi(s, a).stato, null);
    if (atteso === null) atteso = stato;
    assert.deepEqual(stato, atteso);
  }
  assert.deepEqual(atteso.revisione, { modello: 1, osservazioni: 2 });
  assert.deepEqual(atteso.retained.map((v) => v.hash), [h(5), h(6), h(7)]);
  assert.equal(atteso.overflow, true);
});
