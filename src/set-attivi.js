// I set di cui MOX raccoglie le statistiche API, e l'embargo di 17Lands.
//
// Nasce il 14/10/2026 (decisione del proprietario: `central_api` attivo
// dall'inizio, embargo rispettato). L'elenco sta nel bucket dei dati Draft,
// `config/set-attivi.json`, e si cambia con `strumenti/dati-draft/set-attivi.mjs`:
// un set nuovo non richiede un deploy del Worker.
//
// Embargo: le Usage Guidelines di 17Lands chiedono agli strumenti di terzi di
// non mostrare i dati di un set nuovo «until the 12th day it has been released
// on MTG Arena (typically the second Monday after the set release)», 7 giorni
// per i set speciali (cube, Double Feature…). Si conta in modo prudente: un set
// uscito il martedi' T si apre il secondo lunedi', T + 13 giorni (T + 8 per i
// set speciali). Prima di quella data niente raccolta e niente distribuzione.

import { FORMATI_API } from "./dati-draft.js";

export const CHIAVE_SET_ATTIVI = "config/set-attivi.json";
export const GIORNI_EMBARGO = Object.freeze({ normale: 13, speciale: 8 });
export const MASSIMO_SET = 8;
const SET = /^[A-Z0-9]{2,8}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const GIORNO = 24 * 3600 * 1000;
const MEMORIA_MS = 5 * 60 * 1000;

export function validaSetAttivi(dato) {
  const errori = [];
  if (!dato || typeof dato !== "object" || dato.schema !== 1 || !Array.isArray(dato.set)) {
    return { ok: false, errori: ["schema 1 con un elenco `set` richiesto"], set: [] };
  }
  if (dato.set.length > MASSIMO_SET) errori.push(`al massimo ${MASSIMO_SET} set`);
  const visti = new Set();
  for (const v of dato.set) {
    if (!v || typeof v !== "object" || !SET.test(v.set ?? "")) { errori.push("set non valido"); continue; }
    if (visti.has(v.set)) errori.push(`set ripetuto ${v.set}`);
    visti.add(v.set);
    if (!DATA.test(v.uscita ?? "") || Number.isNaN(Date.parse(`${v.uscita}T00:00:00Z`))) {
      errori.push(`${v.set}: data di uscita non valida`);
    }
    if (typeof v.speciale !== "boolean") errori.push(`${v.set}: speciale deve essere true o false`);
    if (!Array.isArray(v.formati) || !v.formati.length
      || v.formati.some((f) => !FORMATI_API.includes(f)) || new Set(v.formati).size !== v.formati.length) {
      errori.push(`${v.set}: formati non validi`);
    }
  }
  return { ok: errori.length === 0, errori, set: errori.length ? [] : dato.set };
}

export function fineEmbargo(voce) {
  const giorni = voce.speciale ? GIORNI_EMBARGO.speciale : GIORNI_EMBARGO.normale;
  return Date.parse(`${voce.uscita}T00:00:00Z`) + giorni * GIORNO;
}

export function inEmbargo(voce, adesso = Date.now()) {
  return adesso < fineEmbargo(voce);
}

let memoria = null;

// L'elenco valido, o `[]` se manca o e' rotto (fail-closed: niente raccolta).
// Tenuto in memoria cinque minuti per isolato, qualunque sia l'oggetto del
// binding (puo' cambiare a ogni richiesta): il bucket e' uno solo.
export async function leggiSetAttivi(archivio, adesso = Date.now()) {
  if (memoria && 0 <= adesso - memoria.quando && adesso - memoria.quando < MEMORIA_MS) {
    return memoria.set;
  }
  let set = [];
  try {
    const oggetto = await archivio.get(CHIAVE_SET_ATTIVI);
    if (oggetto) set = validaSetAttivi(JSON.parse(await oggetto.text())).set;
  } catch {
    set = [];
  }
  memoria = { quando: adesso, set };
  return set;
}

export function dimenticaSetAttivi() { memoria = null; }
