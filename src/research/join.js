// Il join di Research: snapshot intere per revisione, mai campo per campo.
//
// Il server non conosce la copertura degli stati, che il wire non porta: per
// questo non fonde i campi (addendum G3A/G5 §5.1). Conserva, per ogni
// contribution, la revisione massima e l'insieme bounded delle varianti
// canoniche a quella revisione: al massimo tre body, i tre hash minori, piu'
// un booleano `overflow` che dice «ne ho viste almeno quattro» (G5b §4).
//
// L'unione di due summary alla stessa revisione e' commutativa, associativa e
// idempotente; le classi di monotonia sono un controllo in piu' sul client
// onesto a parita' di modello, non parte dell'algebra.

import { J } from "./canonico.js";

export class CollisioneHash extends Error {
  constructor() {
    super("stesso variant_hash con body diversi");
    this.name = "CollisioneHash";
  }
}

export function confrontaRevisione(a, b) {
  if (a.modello !== b.modello) return a.modello < b.modello ? -1 : 1;
  if (a.osservazioni !== b.osservazioni) return a.osservazioni < b.osservazioni ? -1 : 1;
  return 0;
}

export function effettiva(stato) {
  return stato.retained.length === 1 && !stato.overflow;
}

export function unisciSummary(a, b) {
  const perHash = new Map();
  for (const variante of [...a.retained, ...b.retained]) {
    const nota = perHash.get(variante.hash);
    if (nota && J(nota.body) !== J(variante.body)) throw new CollisioneHash();
    if (!nota) perHash.set(variante.hash, variante);
  }
  const ordinate = [...perHash.values()].sort((x, y) => (x.hash < y.hash ? -1 : x.hash > y.hash ? 1 : 0));
  return {
    revisione: a.revisione,
    retained: ordinate.slice(0, 3),
    overflow: a.overflow || b.overflow || ordinate.length > 3,
  };
}

function stessoSummary(a, b) {
  return a.overflow === b.overflow && a.retained.length === b.retained.length &&
    a.retained.every((v, i) => v.hash === b.retained[i].hash);
}

const esitoConflitto = (stato) => (stato.overflow ? "conflict_overflow" : "conflict");

/**
 * Applica un arrivo (un summary: di solito una variante sola) allo stato
 * conservato. Restituisce l'esito e lo stato dopo; quando lo stato non
 * cambia, e' lo stesso oggetto di prima.
 */
export function decidi(corrente, arrivo) {
  if (corrente === null) {
    return { esito: effettiva(arrivo) ? "accepted_new" : esitoConflitto(arrivo), stato: arrivo };
  }
  const ordine = confrontaRevisione(arrivo.revisione, corrente.revisione);
  if (ordine < 0) return { esito: "stale", stato: corrente };
  if (ordine > 0) {
    if (arrivo.revisione.modello === corrente.revisione.modello &&
        effettiva(corrente) && effettiva(arrivo)) {
      const dove = violazioneClassi(corrente.retained[0].body, arrivo.retained[0].body);
      if (dove) {
        return { esito: "rejected", motivo: "regressione_non_dichiarata", percorso: dove,
          stato: corrente };
      }
    }
    return { esito: effettiva(arrivo) ? "updated" : esitoConflitto(arrivo), stato: arrivo };
  }
  const unito = unisciSummary(corrente, arrivo);
  if (stessoSummary(unito, corrente)) {
    return { esito: effettiva(corrente) ? "unchanged" : esitoConflitto(corrente), stato: corrente };
  }
  return { esito: esitoConflitto(unito), stato: unito };
}

// ------------------------------------------------ classi di monotonia

const CAMPI_ESATTI_MATCH = ["evento", "formato", "esito", "arena", "rank"];
const GRUPPI_ESATTI_GAME = {
  on_play: ["on_play"], mulligans: ["mulligans"], free_mulligans: ["free_mulligans"],
  mulligan_type: ["mulligan_type"], cards_bottomed: ["cards_bottomed"], result: ["result"],
  opening_hand: ["opening_hand_kept", "opening_hand_size"],
  deck: ["deck", "deck_source"], sideboard_delta: ["sideboard_in", "sideboard_out"],
};
// Contesi che possono tornare noti: la copertura maggiore decide (G3A/G5 §5.2).
const CONTESI_NON_ASSORBENTI = new Set(["turni", "state_reset_observed", "state_gap_observed"]);

const insieme = (lista) => new Set(Array.isArray(lista) ? lista : []);
const contenuto = (piccolo, grande) => [...piccolo].every((v) => grande.has(v));

function gruppo(oggetto, membri) {
  return J(membri.map((m) => (m in oggetto ? oggetto[m] : "__assente__")));
}

function presente(oggetto, membri) {
  return membri.some((m) => m in oggetto);
}

function multinsiemeContenuto(piccolo, grande) {
  const conti = new Map();
  for (const carta of grande) conti.set(carta, (conti.get(carta) || 0) + 1);
  for (const carta of piccolo) {
    const resta = (conti.get(carta) || 0) - 1;
    if (resta < 0) return false;
    conti.set(carta, resta);
  }
  return true;
}

function eventiPerId(gioco) {
  const fuori = new Map();
  for (const contenitore of ["draws", "casts", "lands"]) {
    for (const evento of gioco[contenitore] || []) {
      fuori.set(evento.event_id, J([contenitore, evento.turno, evento.card_id]));
    }
  }
  return fuori;
}

function violazioneGame(vecchio, nuovo, dove) {
  const contesiV = insieme(vecchio.conflicted_fields);
  const contesiN = insieme(nuovo.conflicted_fields);
  for (const nome of contesiV) {
    if (!CONTESI_NON_ASSORBENTI.has(nome) && !contesiN.has(nome)) return `${dove}.conflicted_fields`;
  }
  for (const [nome, membri] of Object.entries(GRUPPI_ESATTI_GAME)) {
    if (contesiV.has(nome) || !presente(vecchio, membri)) continue;
    if (contesiN.has(nome)) continue;
    if (gruppo(vecchio, membri) !== gruppo(nuovo, membri)) return `${dove}.${nome}`;
  }
  if ("turni" in vecchio && !contesiN.has("turni") &&
      !(Number.isInteger(nuovo.turni) && nuovo.turni >= vecchio.turni)) {
    return `${dove}.turni`;
  }
  const contesiEventiN = insieme(nuovo.conflicted_event_ids);
  if (!contenuto(insieme(vecchio.conflicted_event_ids), contesiEventiN)) {
    return `${dove}.conflicted_event_ids`;
  }
  const nuovi = eventiPerId(nuovo);
  for (const [id, forma] of eventiPerId(vecchio)) {
    if (contesiEventiN.has(id)) continue;
    if (nuovi.get(id) !== forma) return `${dove}.eventi`;
  }
  return null;
}

/**
 * `null` se `nuovo` e' una transizione ammessa da `vecchio` a parita' di
 * modello, altrimenti il percorso del primo campo che regredisce.
 */
export function violazioneClassi(vecchio, nuovo) {
  if ("quando" in vecchio) {
    if (!("quando" in nuovo) || nuovo.quando > vecchio.quando) return "quando";
    if (nuovo.quando === vecchio.quando && nuovo.fuso !== vecchio.fuso) return "fuso";
  }
  if ("turni" in vecchio && !(Number.isInteger(nuovo.turni) && nuovo.turni >= vecchio.turni)) {
    return "turni";
  }
  const contesiV = insieme(vecchio.campi_contesi);
  const contesiN = insieme(nuovo.campi_contesi);
  if (!contenuto(contesiV, contesiN)) return "campi_contesi";
  for (const campo of CAMPI_ESATTI_MATCH) {
    if (!(campo in vecchio) || contesiN.has(campo)) continue;
    if (!(campo in nuovo) || J(vecchio[campo]) !== J(nuovo[campo])) return campo;
  }
  if (vecchio.avversario) {
    if (!nuovo.avversario ||
        !multinsiemeContenuto(vecchio.avversario.carte, nuovo.avversario.carte)) {
      return "avversario.carte";
    }
  }
  const nuoviGame = new Map((nuovo.games || []).map((g) => [g.game_number, g]));
  for (const gioco of vecchio.games || []) {
    const dove = `games[${gioco.game_number}]`;
    const corrispondente = nuoviGame.get(gioco.game_number);
    if (!corrispondente) return dove;
    const violazione = violazioneGame(gioco, corrispondente, dove);
    if (violazione) return violazione;
  }
  return null;
}
