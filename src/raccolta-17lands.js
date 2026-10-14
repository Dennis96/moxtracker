// Raccolta centrale delle tabelle 17Lands (API): **implementata, non attiva**.
//
// Nasce il 14/10/2026 (macro-task dei dati Draft centralizzati). Se 17Lands e
// il proprietario lo autorizzeranno, sara' MOX — un solo punto, con un nome,
// a frequenza limitata — a chiedere `card_data` e `color_ratings`, e i client
// riceveranno aggregati dal Worker (`dati-draft.js`, spazio `api/`) invece di
// chiamare 17Lands uno per uno.
//
// Oggi **nessun codice la chiama**: niente cron, niente rotta, nessun import da
// `index.js` (una prova lo controlla). Anche chiamata, non fa niente senza
// due cancelli espliciti, entrambi da aprire a mano:
//  1. la policy (`MOX_EXTERNAL_DATA_POLICY`) con canale `central_api`,
//     `api_permission.granted: true` con riferimento scritto, modo `enabled`;
//  2. la variabile `MOX_17LANDS_RACCOLTA` esattamente `on`.
// L'assenza di uno dei due e' un no, mai un si' implicito. Le prove usano solo
// `fetch` finti: nessun socket verso 17Lands.

import { canaleEffettivo, politicaCorrente } from "./politica-dati-esterni.js";
import { FORMATI_API, chiaveTabellaApi, coppiaCanonica } from "./dati-draft.js";

export const ENDPOINT_17LANDS = Object.freeze({
  card_data: "https://www.17lands.com/api/card_data",
  color_ratings: "https://www.17lands.com/color_ratings/data",
});
export const AGENTE = "MoxCentral/1 (+https://moxtracker.app)";
export const LIMITI_RACCOLTA = Object.freeze({
  millisecondiRete: 15000,
  byteMassimi: 4 * 1024 * 1024,
  tentativi: 2,
  // Una tabella (set, formato, coppia) al piu' ogni 12 ore: la stessa
  // freschezza della cache che i client hanno sempre avuto.
  intervalloMinimoMs: 12 * 3600 * 1000,
  richiestePerEsecuzione: 30,
});
const SET = /^[A-Z0-9]{2,8}$/;

export function raccoltaAutorizzata(ambiente) {
  if (ambiente?.MOX_17LANDS_RACCOLTA !== "on") return { ok: false, motivo: "raccolta spenta" };
  const politica = politicaCorrente(ambiente);
  if (!politica) return { ok: false, motivo: "policy assente o non valida" };
  if (canaleEffettivo(politica) !== "central_api") {
    return { ok: false, motivo: "canale diverso da central_api o permesso assente" };
  }
  if (politica.providers["17lands"].mode !== "enabled") {
    return { ok: false, motivo: "modo diverso da enabled" };
  }
  return { ok: true, riferimento: politica.providers["17lands"].api_permission.reference };
}

export function parametriRaccolta(tabella, set, formato, colori) {
  if (!ENDPOINT_17LANDS[tabella] || !SET.test(set ?? "") || !FORMATI_API.includes(formato)) {
    return null;
  }
  const coppia = coppiaCanonica(colori);
  if (coppia === undefined || (tabella === "color_ratings" && coppia)) return null;
  const parametri = new URLSearchParams({ expansion: set, event_type: formato,
    time_period: "ALL_TIME" });
  if (coppia) parametri.set("colors", coppia);
  return parametri;
}

function intero(v) { return Number.isInteger(v) && v >= 0; }
function tasso(v) { return v === null || v === undefined || (typeof v === "number" && v >= 0 && v <= 1); }

// Solo i campi che il client usa: niente URL di immagini, niente altro.
const CAMPI_CARTA = ["mtga_id", "name", "ever_drawn_game_count", "ever_drawn_win_rate",
  "game_count", "win_rate", "never_drawn_game_count", "never_drawn_win_rate",
  "drawn_improvement_win_rate", "avg_pick", "pick_count"];

export function righeCarte(dati) {
  const righe = Array.isArray(dati) ? dati : dati?.data;
  if (!Array.isArray(righe)) return null;
  const viste = new Set();
  const uscita = [];
  for (const r of righe) {
    if (!r || typeof r !== "object" || !Number.isInteger(r.mtga_id) || r.mtga_id < 1
      || viste.has(r.mtga_id)) return null;
    viste.add(r.mtga_id);
    for (const c of ["ever_drawn_game_count", "game_count", "never_drawn_game_count", "pick_count"]) {
      if (r[c] !== undefined && r[c] !== null && !intero(r[c])) return null;
    }
    for (const c of ["ever_drawn_win_rate", "win_rate", "never_drawn_win_rate"]) {
      if (!tasso(r[c])) return null;
    }
    const riga = {};
    for (const c of CAMPI_CARTA) if (r[c] !== undefined) riga[c] = r[c] ?? null;
    if (typeof riga.name !== "string") riga.name = "";
    uscita.push(riga);
  }
  return uscita;
}

export function righeColori(dati) {
  if (!Array.isArray(dati)) return null;
  const uscita = [];
  for (const r of dati) {
    if (!r || typeof r !== "object" || !intero(r.games) || !intero(r.wins) || r.wins > r.games
      || typeof r.color_name !== "string") return null;
    uscita.push({ color_name: r.color_name, short_name: typeof r.short_name === "string"
      ? r.short_name : null, games: r.games, wins: r.wins });
  }
  return uscita;
}

async function leggiLimitato(risposta, massimo) {
  const dichiarata = Number(risposta.headers.get("content-length"));
  if (Number.isFinite(dichiarata) && dichiarata > massimo) throw new Error("risposta troppo grande");
  const byte = await risposta.arrayBuffer();
  if (byte.byteLength > massimo) throw new Error("risposta troppo grande");
  return new TextDecoder().decode(byte);
}

export function payloadApi({ tabella, set, formato, coppia, righe, riferimento, adesso }) {
  return {
    schema: "mox.draft-stats/1",
    source: "17lands_api",
    set, format: formato,
    filter: { main_colors: coppia ?? null },
    population: "17Lands API, time_period ALL_TIME",
    time_window: { kind: "api_time_period", label: "ALL_TIME" },
    generated_at: new Date(adesso).toISOString(),
    source_published_at: null,
    metrics: tabella === "card_data"
      ? { gih_wr: "supported", gp_wr: "supported", iwd: "supported", ata: "supported",
        color_ratings: "unsupported" }
      : { gih_wr: "unsupported", gp_wr: "unsupported", iwd: "unsupported",
        ata: "unsupported", color_ratings: "supported" },
    attribution: { text: "Dati di 17Lands (17lands.com), raccolti centralmente da MOX "
      + `con permesso registrato (${riferimento}). 17Lands non approva ne' sostiene MOX.`,
    source_url: "https://www.17lands.com/card_data" },
    cards: tabella === "card_data" ? righe : [],
    color_ratings: tabella === "color_ratings" ? righe : null,
  };
}

// Una tabella: `{ esito, ... }`. `registro` (Map chiave -> ultimo tentativo)
// deduplica le richieste ravvicinate; `fetch` e' iniettato (le prove lo fingono).
export async function raccogliTabella({ tabella, set, formato, colori = null, ambiente,
  fetch: prendi, adesso = Date.now(), registro = new Map(), dormi = null }) {
  const permesso = raccoltaAutorizzata(ambiente);
  if (!permesso.ok) return { esito: "negata", motivo: permesso.motivo };
  const parametri = parametriRaccolta(tabella, set, formato, colori);
  if (!parametri) return { esito: "rifiutata", motivo: "parametri non ammessi" };
  const chiave = chiaveTabellaApi(tabella, parametri);
  const ultimo = registro.get(chiave);
  if (ultimo !== undefined && adesso - ultimo < LIMITI_RACCOLTA.intervalloMinimoMs) {
    return { esito: "troppo_presto", chiave };
  }
  // Il registro si scrive solo per esiti definitivi (risposta usata, HTTP 4xx,
  // risposta non valida): un 429, un 5xx o un timeout non devono bloccare la
  // tabella per dodici ore.
  const url = `${ENDPOINT_17LANDS[tabella]}?${parametri}`;
  let ultimoErrore = "nessun tentativo";
  for (let tentativo = 0; tentativo < LIMITI_RACCOLTA.tentativi; tentativo += 1) {
    if (tentativo && dormi) await dormi(2000 * tentativo);
    const interruttore = new AbortController();
    const timer = setTimeout(() => interruttore.abort(), LIMITI_RACCOLTA.millisecondiRete);
    try {
      const risposta = await prendi(url, { headers: { "user-agent": AGENTE,
        accept: "application/json" }, signal: interruttore.signal });
      if (risposta.status === 429 || risposta.status >= 500) {
        ultimoErrore = `HTTP ${risposta.status}`;
        continue;
      }
      if (risposta.status !== 200) {
        registro.set(chiave, adesso);
        return { esito: "errore", motivo: `HTTP ${risposta.status}` };
      }
      const dati = JSON.parse(await leggiLimitato(risposta, LIMITI_RACCOLTA.byteMassimi));
      const righe = tabella === "card_data" ? righeCarte(dati) : righeColori(dati);
      registro.set(chiave, adesso);
      if (!righe) return { esito: "errore", motivo: "risposta non valida" };
      const coppia = coppiaCanonica(colori) ?? null;
      const payload = payloadApi({ tabella, set, formato, coppia, righe,
        riferimento: permesso.riferimento, adesso });
      return { esito: "ok", chiave, payload };
    } catch (e) {
      ultimoErrore = e?.name === "AbortError" ? "timeout" : String(e?.message ?? e);
    } finally {
      clearTimeout(timer);
    }
  }
  return { esito: "errore", motivo: ultimoErrore };
}

// Piu' tabelle in fila, mai piu' di `richiestePerEsecuzione`, una alla volta:
// niente raffiche verso 17Lands. Le voci oltre il tetto si dichiarano rinviate.
export async function raccogliLotto(voci, opzioni) {
  const risultati = [];
  for (const [i, voce] of voci.entries()) {
    if (i >= LIMITI_RACCOLTA.richiestePerEsecuzione) {
      risultati.push({ esito: "rinviata", voce });
      continue;
    }
    risultati.push(await raccogliTabella({ ...opzioni, ...voce }));
  }
  return risultati;
}

// Salva un risultato nello spazio `api/` **solo se** il permesso vale ancora
// al momento della scrittura: una revoca arrivata durante la richiesta vince.
export async function salvaTabellaApi(archivio, ambiente, risultato) {
  if (risultato?.esito !== "ok") return { esito: "saltata" };
  if (!raccoltaAutorizzata(ambiente).ok) return { esito: "negata" };
  const byte = new TextEncoder().encode(JSON.stringify(risultato.payload));
  if (byte.byteLength > LIMITI_RACCOLTA.byteMassimi) return { esito: "troppo_grande" };
  await archivio.put(risultato.chiave, byte, { httpMetadata: { contentType: "application/json" } });
  return { esito: "salvata", chiave: risultato.chiave, byte: byte.byteLength };
}
