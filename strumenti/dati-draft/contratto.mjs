// Il contratto `mox.draft-stats/1` lato publisher: gli stessi controlli del
// client (`mox-core/strumenti/dati_draft_centrali.py`), piu' quelli che solo
// chi pubblica deve fare — niente righe individuali, niente identificativi.
//
// Contratto completo:
// `mox-core/passaggi/draft/contratti/CONTRATTO-DATI-DRAFT-CENTRALIZZATI-2026-10-14.md`.

import { createHash } from "node:crypto";

export const SCHEMA_PAYLOAD = "mox.draft-stats/1";
export const SCHEMA_MANIFESTO = "mox.draft-stats-manifest/1";
export const SORGENTI = Object.freeze({ public: "17lands_public_dataset", api: "17lands_api" });
export const MASSIMO_PAYLOAD = 4 * 1024 * 1024;
export const MASSIMO_MANIFESTO = 256 * 1024;
export const MASSIMO_CARTE = 1000;
// Chiavi che in un aggregato non devono mai comparire, a nessuna profondita'.
export const CHIAVI_VIETATE = Object.freeze(["draft_id", "game_id", "user", "user_id",
  "screen_name", "player", "player_id", "opponent", "rank", "opp_rank", "deck", "pool",
  "replay", "draft_time", "game_time", "user_n_games_bucket", "user_game_win_rate_bucket"]);
const SET = /^[A-Z0-9]{2,8}$/;
const FORMATO = /^[A-Za-z]{3,32}$/;
const SHA = /^[0-9a-f]{64}$/;
const COPPIA = /^(W?U?B?R?G?)$/;

export function sha256(byte) {
  return createHash("sha256").update(byte).digest("hex");
}

function chiaviVietate(valore, percorso = "") {
  if (Array.isArray(valore)) {
    for (const [i, v] of valore.entries()) {
      const trovata = chiaviVietate(v, `${percorso}[${i}]`);
      if (trovata) return trovata;
    }
  } else if (valore && typeof valore === "object") {
    for (const [k, v] of Object.entries(valore)) {
      if (CHIAVI_VIETATE.includes(k)) return `${percorso}.${k}`;
      const trovata = chiaviVietate(v, `${percorso}.${k}`);
      if (trovata) return trovata;
    }
  }
  return null;
}

const numero = (v, min, max, intero = false) => typeof v === "number" && Number.isFinite(v)
  && (!intero || Number.isInteger(v)) && (min === undefined || v >= min)
  && (max === undefined || v <= max);

export function validaPayload(documento, spazio = "public") {
  const errori = [];
  const d = documento;
  if (!d || typeof d !== "object" || d.schema !== SCHEMA_PAYLOAD) return ["schema non supportato"];
  if (d.source !== SORGENTI[spazio]) errori.push("sorgente diversa dallo spazio");
  if (!SET.test(d.set ?? "")) errori.push("set non valido");
  if (!FORMATO.test(d.format ?? "")) errori.push("formato non valido");
  const colori = d.filter?.main_colors;
  if (colori !== null && !(typeof colori === "string" && colori.length === 2 && COPPIA.test(colori))) {
    errori.push("filtro colori non valido");
  }
  if (!d.metrics || Object.values(d.metrics).some((v) => !["supported", "unsupported"].includes(v))) {
    errori.push("metrics non valido");
  }
  if (typeof d.attribution?.text !== "string") errori.push("attribution assente");
  if (spazio === "public" && d.attribution?.license !== "CC BY 4.0") errori.push("licenza assente");
  if (!Array.isArray(d.cards) || d.cards.length > MASSIMO_CARTE) {
    errori.push("cards assente o troppo lunga");
  } else {
    const viste = new Set();
    for (const r of d.cards) {
      if (!numero(r?.mtga_id, 1, undefined, true) || viste.has(r.mtga_id)) {
        errori.push("mtga_id non valido o duplicato");
        break;
      }
      viste.add(r.mtga_id);
      for (const c of ["ever_drawn_win_rate", "win_rate", "never_drawn_win_rate"]) {
        if (r[c] !== null && r[c] !== undefined && !numero(r[c], 0, 1)) errori.push(`${c} fuori da [0,1]`);
      }
      for (const c of ["ever_drawn_game_count", "game_count", "never_drawn_game_count", "pick_count"]) {
        if (r[c] !== undefined && !numero(r[c], 0, undefined, true)) errori.push(`${c} non intero`);
      }
    }
  }
  if (d.color_ratings !== null && d.color_ratings !== undefined) {
    if (!Array.isArray(d.color_ratings) || d.color_ratings.some((r) => !numero(r?.games, 0, undefined, true)
      || !numero(r?.wins, 0, r?.games, true) || typeof r?.color_name !== "string")) {
      errori.push("color_ratings non valido");
    }
  }
  const vietata = chiaviVietate(d);
  if (vietata) errori.push(`chiave vietata in un aggregato: ${vietata}`);
  return [...new Set(errori)];
}

export function validaManifesto(documento, spazio = "public") {
  const errori = [];
  const m = documento;
  if (!m || m.schema !== SCHEMA_MANIFESTO) return ["schema del manifesto non supportato"];
  if (m.namespace !== spazio || m.source !== SORGENTI[spazio]) errori.push("spazio diverso");
  if (!numero(m.revision, 1, undefined, true)) errori.push("revision non valida");
  if (!Array.isArray(m.entries)) return [...errori, "entries assente"];
  const viste = new Set();
  for (const v of m.entries) {
    const chiave = `${v?.set}|${v?.format}|${v?.main_colors}`;
    if (viste.has(chiave)) errori.push(`voce duplicata ${chiave}`);
    viste.add(chiave);
    if (!SET.test(v?.set ?? "") || !FORMATO.test(v?.format ?? "")) errori.push(`voce non valida ${chiave}`);
    if (!SHA.test(v?.sha256 ?? "")) errori.push(`sha256 non valido ${chiave}`);
    if (!numero(v?.bytes, 1, MASSIMO_PAYLOAD, true)) errori.push(`bytes fuori limite ${chiave}`);
  }
  return errori;
}
