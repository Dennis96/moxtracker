// Il validator del wire Research rev2 (transport 4).
//
// E' chiuso a ogni livello: l'insieme delle chiavi ammesse e' esatto, `null`
// non esiste, un campo sconosciuto non si ignora e non si ripulisce, si
// rifiuta. Il motivo e' lo stesso del legacy (`controlli.js`): un pacchetto
// che il server conserva senza averlo capito diventa un dato che nessuno sa
// piu' interpretare. Qui in piu' ci sono i gruppi atomici e i marcatori di
// conflitto dell'addendum G5, e il registro esatto dei modelli del G5b.
//
// Le regole numeriche vengono dall'addendum G3B/G5 §8 (M5); le forme dal
// contratto G3A con le modifiche rev2. Nessun limite qui e' una capacita' D1.

import { MAX_BODY_BYTES, TRANSPORT_RESEARCH, modelloSupportato } from "./registro.js";

const HEX32 = /^[0-9a-f]{32}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const MOX = /^[0-9A-Za-z .+_-]{1,40}$/;
const EVENTO = /^[A-Za-z0-9_.:-]{1,80}$/;
const FORMATO = /^[A-Za-z0-9_ -]{1,40}$/;
const ARENA = /^[0-9A-Za-z._-]{1,40}$/;
const TIPO_MULLIGAN = /^[A-Za-z_]{1,40}$/;
const CLASSE = /^[A-Za-z]{1,20}$/;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const CARTA = /^[1-9][0-9]{0,6}$/;
const ISTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

const CHIAVI_BUSTA = new Set(["versione", "mox", "mittente", "segreto_cancellazione",
  "consenso_research", "partite"]);
const CHIAVI_CONTRIBUTION = new Set(["id_pubblico", "revisione", "quando", "fuso",
  "turni", "evento", "formato", "esito", "arena", "rank", "avversario",
  "campi_contesi", "games"]);
const CHIAVI_GAME = new Set(["game_number", "on_play", "mulligans", "free_mulligans",
  "mulligan_type", "opening_hand_kept", "opening_hand_size", "cards_bottomed",
  "draws", "casts", "lands", "incomplete_event_types", "conflicted_fields",
  "conflicted_event_ids", "result", "turni", "deck", "deck_source",
  "sideboard_in", "sideboard_out", "state_reset_observed", "state_gap_observed"]);
const CHIAVI_RANK = new Set(["classe", "livello", "step", "stagione", "vinte", "perse",
  "pareggi"]);

const CAMPI_CONTESI_MATCH = ["arena", "esito", "evento", "formato", "rank"];
const TIPI_EVENTO = { draws: "draw", casts: "cast", lands: "land" };
// I gruppi di `conflicted_fields` e i campi che ciascuno toglie dal game.
const GRUPPI = {
  cards_bottomed: ["cards_bottomed"],
  deck: ["deck", "deck_source"],
  free_mulligans: ["free_mulligans"],
  mulligan_type: ["mulligan_type"],
  mulligans: ["mulligans"],
  on_play: ["on_play"],
  opening_hand: ["opening_hand_kept", "opening_hand_size"],
  result: ["result"],
  sideboard_delta: ["sideboard_in", "sideboard_out"],
  state_gap_observed: ["state_gap_observed"],
  state_reset_observed: ["state_reset_observed"],
  turni: ["turni"],
};

class Rifiuto extends Error {
  constructor(motivo, percorso) {
    super(motivo);
    this.motivo = motivo;
    this.percorso = percorso;
  }
}

function fallisci(motivo, percorso) {
  throw new Rifiuto(motivo, percorso);
}

const unisci = (percorso, chiave) => (percorso ? `${percorso}.${chiave}` : chiave);

function semplice(valore) {
  return valore !== null && typeof valore === "object" && !Array.isArray(valore);
}

function chiuso(valore, percorso, ammesse, obbligatorie = []) {
  if (!semplice(valore)) fallisci("struttura_non_valida", percorso);
  for (const chiave of Object.keys(valore)) {
    if (!ammesse.has(chiave)) fallisci("campo_non_ammesso", unisci(percorso, chiave));
  }
  for (const chiave of obbligatorie) {
    if (!(chiave in valore)) fallisci("campo_mancante", unisci(percorso, chiave));
  }
}

function intero(valore, minimo, massimo, percorso) {
  if (!Number.isSafeInteger(valore) || valore < minimo || valore > massimo) {
    fallisci("valore_non_valido", percorso);
  }
}

function testo(valore, forma, percorso) {
  if (typeof valore !== "string" || !forma.test(valore) || UUID.test(valore)) {
    fallisci("valore_non_valido", percorso);
  }
}

function booleano(valore, percorso) {
  if (typeof valore !== "boolean") fallisci("valore_non_valido", percorso);
}

// Lista ordinata in modo non decrescente (le copie si ripetono).
function carteOrdinate(valore, minimo, massimo, percorso) {
  if (!Array.isArray(valore) || valore.length < minimo || valore.length > massimo) {
    fallisci("valore_non_valido", percorso);
  }
  valore.forEach((carta, i) => {
    intero(carta, 1, 9999999, `${percorso}[${i}]`);
    if (i > 0 && carta < valore[i - 1]) fallisci("valore_non_valido", percorso);
  });
}

// Lista di stringhe strettamente crescente, quindi ordinata e senza doppioni.
function insiemeOrdinato(valore, ammessi, percorso) {
  if (!Array.isArray(valore) || valore.length === 0) fallisci("valore_non_valido", percorso);
  valore.forEach((voce, i) => {
    if (typeof voce !== "string" || !ammessi(voce)) fallisci("valore_non_valido", `${percorso}[${i}]`);
    if (i > 0 && !(valore[i - 1] < voce)) fallisci("valore_non_valido", percorso);
  });
}

function mappaCarte(valore, minimo, percorso) {
  if (!semplice(valore)) fallisci("valore_non_valido", percorso);
  const voci = Object.entries(valore);
  if (voci.length < minimo || voci.length > 250) fallisci("valore_non_valido", percorso);
  let totale = 0;
  for (const [carta, copie] of voci) {
    // Una chiave che non e' un grpId non e' una carta: e' un campo estraneo.
    if (!CARTA.test(carta)) fallisci("campo_non_ammesso", unisci(percorso, carta));
    intero(copie, 1, 250, unisci(percorso, carta));
    totale += copie;
  }
  if (totale > 250) fallisci("valore_non_valido", percorso);
}

function multinsieme(mappa) {
  const fuori = new Map();
  for (const [carta, copie] of Object.entries(mappa)) fuori.set(Number(carta), copie);
  return fuori;
}

// Le carte di `a` che `b` non ha, ripetute per le copie, in ordine crescente.
function differenza(a, b) {
  const fuori = [];
  for (const [carta, copie] of a) {
    for (let i = 0; i < copie - (b.get(carta) || 0); i += 1) fuori.push(carta);
  }
  return fuori.sort((x, y) => x - y);
}

function uguali(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function validaRank(rank, percorso) {
  if (!semplice(rank) || Object.keys(rank).length === 0) fallisci("valore_non_valido", percorso);
  chiuso(rank, percorso, new Set(["costruito", "limitato"]));
  for (const [sezione, dati] of Object.entries(rank)) {
    const qui = unisci(percorso, sezione);
    if (!semplice(dati) || Object.keys(dati).length === 0) fallisci("valore_non_valido", qui);
    chiuso(dati, qui, CHIAVI_RANK);
    for (const [chiave, valore] of Object.entries(dati)) {
      if (chiave === "classe") testo(valore, CLASSE, unisci(qui, chiave));
      else intero(valore, 0, 100000, unisci(qui, chiave));
    }
  }
}

function validaGame(gioco, percorso, precedente) {
  chiuso(gioco, percorso, CHIAVI_GAME, ["game_number"]);
  const numero = gioco.game_number;
  intero(numero, 1, 5, unisci(percorso, "game_number"));
  if ("on_play" in gioco) booleano(gioco.on_play, unisci(percorso, "on_play"));
  for (const nome of ["mulligans", "free_mulligans", "cards_bottomed"]) {
    if (nome in gioco) intero(gioco[nome], 0, 7, unisci(percorso, nome));
  }
  if ("mulligan_type" in gioco) testo(gioco.mulligan_type, TIPO_MULLIGAN, unisci(percorso, "mulligan_type"));
  if (("opening_hand_kept" in gioco) !== ("opening_hand_size" in gioco)) {
    fallisci("campo_mancante", unisci(percorso, "opening_hand"));
  }
  if ("opening_hand_kept" in gioco) {
    carteOrdinate(gioco.opening_hand_kept, 0, 7, unisci(percorso, "opening_hand_kept"));
    intero(gioco.opening_hand_size, 0, 7, unisci(percorso, "opening_hand_size"));
    if (gioco.opening_hand_size !== gioco.opening_hand_kept.length) {
      fallisci("valore_non_valido", unisci(percorso, "opening_hand_size"));
    }
  }
  const idVisti = new Set();
  let eventi = 0;
  for (const contenitore of Object.keys(TIPI_EVENTO)) {
    if (!(contenitore in gioco)) continue;
    const lista = gioco[contenitore];
    const qui = unisci(percorso, contenitore);
    if (!Array.isArray(lista) || lista.length === 0 || lista.length > 200) {
      fallisci("valore_non_valido", qui);
    }
    eventi += lista.length;
    lista.forEach((evento, i) => {
      const dove = `${qui}[${i}]`;
      chiuso(evento, dove, new Set(["event_id", "turno", "card_id"]),
        ["event_id", "turno", "card_id"]);
      testo(evento.event_id, HEX64, unisci(dove, "event_id"));
      if (idVisti.has(evento.event_id)) fallisci("valore_non_valido", unisci(dove, "event_id"));
      idVisti.add(evento.event_id);
      intero(evento.turno, 1, 500, unisci(dove, "turno"));
      intero(evento.card_id, 1, 9999999, unisci(dove, "card_id"));
    });
  }
  if (eventi > 400) fallisci("valore_non_valido", percorso);
  if ("incomplete_event_types" in gioco) {
    insiemeOrdinato(gioco.incomplete_event_types,
      (v) => ["cast", "draw", "land"].includes(v), unisci(percorso, "incomplete_event_types"));
  }
  if ("result" in gioco && !["vinta", "persa"].includes(gioco.result)) {
    fallisci("valore_non_valido", unisci(percorso, "result"));
  }
  if ("turni" in gioco) intero(gioco.turni, 1, 500, unisci(percorso, "turni"));
  for (const nome of ["state_reset_observed", "state_gap_observed"]) {
    if (nome in gioco) booleano(gioco[nome], unisci(percorso, nome));
  }
  if (("deck" in gioco) !== ("deck_source" in gioco)) {
    fallisci("campo_mancante", unisci(percorso, "deck" in gioco ? "deck_source" : "deck"));
  }
  if ("deck" in gioco) {
    const qui = unisci(percorso, "deck");
    chiuso(gioco.deck, qui, new Set(["main", "sideboard"]), ["main"]);
    mappaCarte(gioco.deck.main, 1, unisci(qui, "main"));
    if ("sideboard" in gioco.deck) mappaCarte(gioco.deck.sideboard, 0, unisci(qui, "sideboard"));
    const fonte = gioco.deck_source;
    const dove = unisci(percorso, "deck_source");
    chiuso(fonte, dove, new Set(["kind", "compared_to_game"]), ["kind"]);
    if (fonte.kind === "initial_declaration") {
      if ("compared_to_game" in fonte) fallisci("campo_non_ammesso", unisci(dove, "compared_to_game"));
    } else if (fonte.kind === "sideboard_submission") {
      if (!("compared_to_game" in fonte)) fallisci("campo_mancante", unisci(dove, "compared_to_game"));
      if (numero < 2 || fonte.compared_to_game !== numero - 1) {
        fallisci("valore_non_valido", unisci(dove, "compared_to_game"));
      }
    } else {
      fallisci("valore_non_valido", unisci(dove, "kind"));
    }
  }
  if (("sideboard_in" in gioco) !== ("sideboard_out" in gioco)) {
    fallisci("campo_mancante", unisci(percorso, "sideboard_delta"));
  }
  if ("sideboard_in" in gioco) {
    if (numero < 2) fallisci("campo_non_ammesso", unisci(percorso, "sideboard_in"));
    carteOrdinate(gioco.sideboard_in, 0, 250, unisci(percorso, "sideboard_in"));
    carteOrdinate(gioco.sideboard_out, 0, 250, unisci(percorso, "sideboard_out"));
    // Il delta e' una sottrazione fra le due dichiarazioni adiacenti: quando
    // il wire le porta entrambe, deve tornare.
    if (precedente && precedente.game_number === numero - 1 &&
        precedente.deck && gioco.deck) {
      const ora = multinsieme(gioco.deck.main);
      const prima = multinsieme(precedente.deck.main);
      if (!uguali(differenza(ora, prima), gioco.sideboard_in) ||
          !uguali(differenza(prima, ora), gioco.sideboard_out)) {
        fallisci("valore_non_valido", unisci(percorso, "sideboard_in"));
      }
    }
  }
  if ("conflicted_fields" in gioco) {
    const qui = unisci(percorso, "conflicted_fields");
    insiemeOrdinato(gioco.conflicted_fields, (v) => v in GRUPPI, qui);
    for (const gruppo of gioco.conflicted_fields) {
      for (const membro of GRUPPI[gruppo]) {
        if (membro in gioco) fallisci("valore_non_valido", unisci(percorso, membro));
      }
    }
  }
  if ("conflicted_event_ids" in gioco) {
    const qui = unisci(percorso, "conflicted_event_ids");
    insiemeOrdinato(gioco.conflicted_event_ids, (v) => HEX64.test(v), qui);
    for (const id of gioco.conflicted_event_ids) {
      if (idVisti.has(id)) fallisci("valore_non_valido", qui);
    }
  }
}

function controllaContribution(c) {
  chiuso(c, "", CHIAVI_CONTRIBUTION, ["id_pubblico", "revisione", "games"]);
  testo(c.id_pubblico, HEX64, "id_pubblico");
  chiuso(c.revisione, "revisione", new Set(["modello", "osservazioni"]),
    ["modello", "osservazioni"]);
  const modello = c.revisione.modello;
  if (!Number.isSafeInteger(modello) || modello < 1) fallisci("modello_non_valido", "revisione.modello");
  intero(c.revisione.osservazioni, 1, 100000, "revisione.osservazioni");
  if (("quando" in c) !== ("fuso" in c)) fallisci("campo_mancante", "quando" in c ? "fuso" : "quando");
  if ("quando" in c) {
    if (typeof c.quando !== "string" || !ISTANTE.test(c.quando) ||
        Number.isNaN(Date.parse(c.quando))) fallisci("valore_non_valido", "quando");
    intero(c.fuso, -840, 840, "fuso");
  }
  if ("turni" in c) intero(c.turni, 1, 500, "turni");
  if ("evento" in c) testo(c.evento, EVENTO, "evento");
  if ("formato" in c) testo(c.formato, FORMATO, "formato");
  if ("esito" in c && !["vinta", "persa"].includes(c.esito)) fallisci("valore_non_valido", "esito");
  if ("arena" in c) testo(c.arena, ARENA, "arena");
  if ("rank" in c) validaRank(c.rank, "rank");
  if ("avversario" in c) {
    chiuso(c.avversario, "avversario", new Set(["carte"]), ["carte"]);
    carteOrdinate(c.avversario.carte, 1, 200, "avversario.carte");
  }
  if ("campi_contesi" in c) {
    insiemeOrdinato(c.campi_contesi, (v) => CAMPI_CONTESI_MATCH.includes(v), "campi_contesi");
    for (const campo of c.campi_contesi) {
      if (campo in c) fallisci("valore_non_valido", campo);
    }
  }
  if (!Array.isArray(c.games) || c.games.length === 0 || c.games.length > 5) {
    fallisci("valore_non_valido", "games");
  }
  c.games.forEach((gioco, i) => {
    validaGame(gioco, `games[${i}]`, i > 0 ? c.games[i - 1] : null);
    if (i > 0 && !(c.games[i - 1].game_number < gioco.game_number)) {
      fallisci("valore_non_valido", `games[${i}].game_number`);
    }
  });
  // Per ultimo il registro: la forma e' gia' provata, qui si decide soltanto
  // se questo server ha pubblicato quel modello.
  if (!modelloSupportato(TRANSPORT_RESEARCH, modello)) {
    fallisci("modello_non_supportato", "revisione.modello");
  }
}

/** `null` se la contribution e' valida, altrimenti `{motivo_codice, percorso}`. */
export function validaContribution(contribution) {
  try {
    controllaContribution(contribution);
    return null;
  } catch (errore) {
    if (errore instanceof Rifiuto) return { motivo_codice: errore.motivo, percorso: errore.percorso };
    throw errore;
  }
}

/**
 * La busta: chiusa, un mittente, un marker di consenso, da 1 al cap di
 * contribution. Il marker dichiara una versione, non prova il consenso: la
 * prova e' la generation, verificata dopo.
 */
export function validaBusta(corpo, config) {
  try {
    chiuso(corpo, "", CHIAVI_BUSTA, [...CHIAVI_BUSTA]);
    if (corpo.versione !== TRANSPORT_RESEARCH) fallisci("valore_non_valido", "versione");
    testo(corpo.mox, MOX, "mox");
    testo(corpo.mittente, HEX32, "mittente");
    testo(corpo.segreto_cancellazione, HEX64, "segreto_cancellazione");
    chiuso(corpo.consenso_research, "consenso_research", new Set(["versione"]), ["versione"]);
    intero(corpo.consenso_research.versione, 1, 1000000, "consenso_research.versione");
    if (!Array.isArray(corpo.partite) || corpo.partite.length === 0) {
      fallisci("valore_non_valido", "partite");
    }
  } catch (errore) {
    if (errore instanceof Rifiuto) {
      return { ok: false, stato: 400, errore: errore.motivo, percorso: errore.percorso };
    }
    throw errore;
  }
  const cap = config.max_contributions_per_request;
  if (corpo.partite.length > cap) {
    return { ok: false, stato: 413, errore: "troppi_contributi", cap };
  }
  return { ok: true };
}

/**
 * Legge il body contando i byte davvero arrivati. `Content-Length` serve solo
 * a rifiutare prima: un header assente o falso non allarga il tetto.
 */
export async function leggiCorpo(richiesta, massimo = MAX_BODY_BYTES) {
  const troppo = { ok: false, stato: 413, errore: "body_troppo_grande", max_body_bytes: massimo };
  const dichiarata = richiesta.headers.get("content-length");
  if (dichiarata !== null && Number(dichiarata) > massimo) return troppo;
  const parti = [];
  let byte = 0;
  if (richiesta.body) {
    const lettore = richiesta.body.getReader();
    for (;;) {
      const { done, value } = await lettore.read();
      if (done) break;
      byte += value.byteLength;
      if (byte > massimo) {
        await lettore.cancel().catch(() => {});
        return troppo;
      }
      parti.push(value);
    }
  }
  const tutto = new Uint8Array(byte);
  let posizione = 0;
  for (const parte of parti) { tutto.set(parte, posizione); posizione += parte.byteLength; }
  try {
    return { ok: true, testo: new TextDecoder("utf-8", { fatal: true }).decode(tutto), byte };
  } catch {
    return { ok: false, stato: 400, errore: "struttura_non_valida" };
  }
}
