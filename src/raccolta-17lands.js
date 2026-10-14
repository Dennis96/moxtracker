// Raccolta centrale delle tabelle 17Lands (API): **implementata, non attiva**.
//
// Nasce il 14/10/2026 (macro-task dei dati Draft centralizzati). Se 17Lands e
// il proprietario lo autorizzeranno, sara' MOX — un solo punto, con un nome,
// a frequenza limitata — a chiedere `card_data` e `color_ratings`, e i client
// riceveranno aggregati dal Worker (`dati-draft.js`, spazio `api/`) invece di
// chiamare 17Lands uno per uno.
//
// La chiama il cron orario del Worker (`eseguiRaccolta`; 14/10/2026, decisione
// del proprietario: `central_api` attivo dall'inizio). Non fa niente senza due
// cancelli espliciti, entrambi da aprire a mano:
//  1. la policy (`MOX_EXTERNAL_DATA_POLICY`) con canale `central_api`,
//     `api_authorization` scritta (base e riferimento), modo `enabled`;
//  2. la variabile `MOX_17LANDS_RACCOLTA` esattamente `on`.
// Raccoglie solo i set di `config/set-attivi.json` usciti dall'embargo
// (`set-attivi.js`).
// L'assenza di uno dei due e' un no, mai un si' implicito. Le prove usano solo
// `fetch` finti: nessun socket verso 17Lands.

import { canaleEffettivo, politicaCorrente } from "./politica-dati-esterni.js";
import { FORMATI_API, chiaveTabellaApi, coppiaCanonica } from "./dati-draft.js";
import { inEmbargo, leggiSetAttivi } from "./set-attivi.js";

export const ENDPOINT_17LANDS = Object.freeze({
  card_data: "https://www.17lands.com/api/card_data",
  color_ratings: "https://www.17lands.com/color_ratings/data",
});
export const AGENTE = "MoxCentral/1 (+https://moxtracker.app)";
// Il cron della raccolta: al minuto 23 di ogni ora (la manutenzione e' alle 3:17).
export const CRON_RACCOLTA_17LANDS = "23 * * * *";
export const LIMITI_RACCOLTA = Object.freeze({
  millisecondiRete: 15000,
  byteMassimi: 4 * 1024 * 1024,
  tentativi: 2,
  // Una tabella (set, formato, coppia) al piu' ogni 12 ore: la stessa
  // freschezza della cache che i client hanno sempre avuto.
  intervalloMinimoMs: 12 * 3600 * 1000,
  richiestePerEsecuzione: 30,
  // Un giro non comincia tabelle nuove dopo 8 minuti: con 17Lands lento i
  // timeout (2 × 15 s per tabella) arriverebbero ai 15 minuti di un cron.
  millisecondiPerGiro: 8 * 60 * 1000,
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
  const autorizzazione = politica.providers["17lands"].api_authorization;
  return { ok: true, base: autorizzazione.basis, riferimento: autorizzazione.reference };
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

class RispostaNonValida extends Error {}

async function leggiLimitato(risposta, massimo) {
  const dichiarata = Number(risposta.headers.get("content-length"));
  if (Number.isFinite(dichiarata) && dichiarata > massimo) {
    try { await risposta.body?.cancel(); } catch { /* Il rifiuto resta definitivo. */ }
    throw new RispostaNonValida("risposta troppo grande");
  }
  if (!risposta.body) return "";
  const lettore = risposta.body.getReader();
  const pezzi = [];
  let totale = 0;
  try {
    while (true) {
      const { done, value } = await lettore.read();
      if (done) break;
      totale += value.byteLength;
      if (totale > massimo) {
        try { await lettore.cancel(); } catch { /* Il limite e' gia' superato. */ }
        throw new RispostaNonValida("risposta troppo grande");
      }
      pezzi.push(value);
    }
  } finally {
    lettore.releaseLock();
  }
  const byte = new Uint8Array(totale);
  let posizione = 0;
  for (const pezzo of pezzi) { byte.set(pezzo, posizione); posizione += pezzo.byteLength; }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(byte); }
  catch { throw new RispostaNonValida("codifica non valida"); }
}

const attendi = (millisecondi) => new Promise((risolvi) => setTimeout(risolvi, millisecondi));

export function payloadApi({ tabella, set, formato, coppia, righe, base, riferimento, adesso }) {
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
    attribution: { text: "Dati di 17Lands (17lands.com), raccolti centralmente da MOX. "
      + "17Lands non approva ne' sostiene MOX.", source_url: "https://www.17lands.com/card_data" },
    // Su che cosa si regge la raccolta, scritto com'e': una decisione del
    // proprietario non e' un permesso di 17Lands.
    collection: { basis: base, reference: riferimento },
    cards: tabella === "card_data" ? righe : [],
    color_ratings: tabella === "color_ratings" ? righe : null,
  };
}

// Una tabella: `{ esito, ... }`. `registro` (Map chiave -> ultimo tentativo)
// deduplica le richieste ravvicinate; `fetch` e' iniettato (le prove lo fingono).
export async function raccogliTabella({ tabella, set, formato, colori = null, ambiente,
  fetch: prendi, adesso = Date.now(), registro = new Map(), dormi = attendi }) {
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
    if (!raccoltaAutorizzata(ambiente).ok) return { esito: "negata", chiave };
    const interruttore = new AbortController();
    const timer = setTimeout(() => interruttore.abort(), LIMITI_RACCOLTA.millisecondiRete);
    try {
      const risposta = await prendi(url, { headers: { "user-agent": AGENTE,
        accept: "application/json" }, signal: interruttore.signal, redirect: "manual" });
      if (risposta.status === 429 || risposta.status >= 500) {
        ultimoErrore = `HTTP ${risposta.status}`;
        continue;
      }
      if (risposta.status !== 200) {
        registro.set(chiave, adesso);
        return { esito: "errore", definitivo: true, chiave, motivo: `HTTP ${risposta.status}` };
      }
      let dati;
      try {
        const testo = await leggiLimitato(risposta, LIMITI_RACCOLTA.byteMassimi);
        dati = JSON.parse(testo);
      } catch (e) {
        // Timeout e guasti di trasporto restano transitori; dimensione,
        // codifica e JSON non validi sono rifiuti definitivi.
        if (!(e instanceof SyntaxError || e instanceof RispostaNonValida)) throw e;
        registro.set(chiave, adesso);
        return { esito: "errore", definitivo: true, chiave, motivo: "risposta non valida" };
      }
      const righe = tabella === "card_data" ? righeCarte(dati) : righeColori(dati);
      registro.set(chiave, adesso);
      if (!righe) return { esito: "errore", definitivo: true, chiave, motivo: "risposta non valida" };
      const coppia = coppiaCanonica(colori) ?? null;
      const payload = payloadApi({ tabella, set, formato, coppia, righe,
        base: permesso.base, riferimento: permesso.riferimento, adesso });
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
  await archivio.put(risultato.chiave, byte, { httpMetadata: { contentType: "application/json" },
    customMetadata: { raccolto_il: risultato.payload.generated_at } });
  return { esito: "salvata", chiave: risultato.chiave, byte: byte.byteLength };
}

// Il segnaposto di un rifiuto definitivo, accanto alla tabella (mai servito:
// le rotte leggono solo le chiavi `.json` della whitelist).
export function chiaveRifiuto(chiave) { return `${chiave}.rifiuto`; }

const COPPIE = Object.freeze(["WU", "WB", "WR", "WG", "UB", "UR", "UG", "BR", "BG", "RG"]);

// Le tabelle di un set: per formato la globale, i colori e le dieci coppie.
export function tabelleDelSet(voce) {
  const tabelle = [];
  for (const formato of voce.formati) {
    tabelle.push({ tabella: "card_data", set: voce.set, formato, colori: null });
    tabelle.push({ tabella: "color_ratings", set: voce.set, formato, colori: null });
    for (const coppia of COPPIE) tabelle.push({ tabella: "card_data", set: voce.set, formato, colori: coppia });
  }
  return tabelle;
}

// Il cron: le tabelle dei set fuori embargo piu' vecchie di 12 ore, al piu'
// `richiestePerEsecuzione` per giro, le globali prima delle coppie. Con il
// cron orario ogni tabella si rinnova due volte al giorno.
export async function eseguiRaccolta(ambiente, { fetch: prendi = fetch, adesso = Date.now(),
  orologio = () => Date.now(), dormi = attendi } = {}) {
  const inizio = orologio();
  const permesso = raccoltaAutorizzata(ambiente);
  if (!permesso.ok) return { esito: "spenta", motivo: permesso.motivo };
  const archivio = ambiente.DRAFT_STATS;
  if (!archivio || typeof archivio.head !== "function") return { esito: "senza_archivio" };
  const set = (await leggiSetAttivi(archivio, adesso)).filter((v) => !inEmbargo(v, adesso));
  const scadute = [];
  for (const voce of set) {
    for (const t of tabelleDelSet(voce)) {
      const chiave = chiaveTabellaApi(t.tabella, parametriRaccolta(t.tabella, t.set, t.formato, t.colori));
      const oggetto = await archivio.head(chiave);
      const quando = Date.parse(oggetto?.customMetadata?.raccolto_il ?? "");
      if (adesso - quando < LIMITI_RACCOLTA.intervalloMinimoMs) continue;
      // Un rifiuto definitivo (4xx, risposta non valida) lascia un segnaposto:
      // la tabella si ritenta dopo l'intervallo minimo, non a ogni giro.
      const rifiuto = await archivio.head(chiaveRifiuto(chiave));
      if (adesso - Date.parse(rifiuto?.customMetadata?.tentato_il ?? "") < LIMITI_RACCOLTA.intervalloMinimoMs) {
        continue;
      }
      scadute.push({ ...t, quando: Number.isNaN(quando) ? 0 : quando });
    }
  }
  scadute.sort((a, b) => (a.colori ? 1 : 0) - (b.colori ? 1 : 0) || a.quando - b.quando);
  const conti = { salvate: 0, errori: 0, rinviate: 0 };
  const registro = new Map();
  for (const [indice, t] of scadute.entries()) {
    if (indice >= LIMITI_RACCOLTA.richiestePerEsecuzione
      || orologio() - inizio >= LIMITI_RACCOLTA.millisecondiPerGiro) {
      conti.rinviate += 1;
      continue;
    }
    const { quando: _quando, ...voce } = t;
    const esito = await raccogliTabella({ ...voce, ambiente, fetch: prendi, adesso, registro, dormi });
    const salvato = await salvaTabellaApi(archivio, ambiente, esito);
    if (salvato.esito === "salvata") {
      conti.salvate += 1;
    } else {
      conti.errori += 1;
      if (esito.definitivo) {
        await archivio.put(chiaveRifiuto(esito.chiave), new Uint8Array(0),
          { customMetadata: { tentato_il: new Date(adesso).toISOString(), motivo: esito.motivo } });
      }
    }
  }
  return { esito: "eseguita", set: set.map((v) => v.set), ...conti };
}
