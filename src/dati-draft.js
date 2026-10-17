// Distribuzione delle statistiche Draft ai client Mox: `/mox/draft-data/v1/...`.
//
// Nasce il 14/10/2026 (macro-task dei dati Draft centralizzati). Il client non
// chiede piu' niente a 17Lands: riceve da qui tabelle aggregate, in due spazi
// che non si mescolano mai.
//
// - `public/` — aggregati calcolati offline dai 17Lands Public Data Sets
//   (CC BY 4.0, `mox-core/strumenti/dati_draft_pubblici.py`). Un manifesto
//   piccolo (`public/manifest.json`, cache breve con ETag) punta a payload
//   immutabili indirizzati dal loro SHA-256 (`public/payload/<sha>.json`, cache
//   lunga). Il canale `off` li nega: il client non li chiede nemmeno, ma un
//   client vecchio o modificato non deve ricevere niente.
// - `api/` — aggregati nati dall'API di 17Lands e raccolti centralmente. Si
//   servono **solo** con il canale `central_api` (che richiede il permesso
//   registrato nella policy) **e** la variabile `MOX_DRAFT_API_DISTRIBUTION`
//   esattamente `on`; sempre `private, no-store`, cosi' una revoca vale alla
//   richiesta successiva e nessuna CDN ne tiene una copia. Mai link statici.
//
// Lo spazio di archiviazione e' il binding R2 `DRAFT_STATS`, configurato in
// `wrangler.toml` e attivo dal 14/10/2026 (stato e runbook correnti).
// Senza binding ogni rotta risponde 503 `no-store` e il client usa i ripieghi.
// I binding produttivi (`DRAFT_RAW`, `TICKET_FILES`, `MOX_RELEASES`, D1) qui non
// si toccano.

import { canaleEffettivo, politicaCorrente } from "./politica-dati-esterni.js";
import { inEmbargo, leggiSetAttivi } from "./set-attivi.js";

export const PREFISSO = "/mox/draft-data/v1/";
export const MASSIMO_MANIFESTO = 256 * 1024;
export const MASSIMO_PAYLOAD = 4 * 1024 * 1024;
// Una tabella API piu' vecchia di cosi' non si serve: se la raccolta si ferma
// (17Lands rifiuta, cron rotto) il client ripiega sui Public Data Sets invece
// di mostrare per settimane numeri vecchi come attuali.
export const ETA_MASSIMA_API_MS = 7 * 24 * 3600 * 1000;
const SHA = /^[0-9a-f]{64}$/;
const SET = /^[A-Z0-9]{2,8}$/;
// I formati che la raccolta API puo' chiedere: quelli che il client usa.
export const FORMATI_API = Object.freeze(["PremierDraft", "TradDraft", "QuickDraft",
  "PickTwoDraft", "Sealed", "TradSealed"]);
const COPPIA = /^(W?U?B?R?G?)$/;

const NIENTE_CACHE = { "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store" };

function errore(messaggio, stato) {
  return new Response(JSON.stringify({ errore: messaggio }) + "\n",
    { status: stato, headers: NIENTE_CACHE });
}

async function sha256Esadecimale(byte) {
  const digest = await crypto.subtle.digest("SHA-256", byte);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function coppiaCanonica(valore) {
  if (valore === null || valore === undefined || valore === "") return null;
  const lettere = new Set(String(valore).toUpperCase());
  if ([...lettere].some((c) => !"WUBRG".includes(c))) return undefined;
  const coppia = [..."WUBRG"].filter((c) => lettere.has(c)).join("");
  return coppia.length === 2 && COPPIA.test(coppia) ? coppia : undefined;
}

// La chiave R2 di una tabella API, dopo la whitelist dei parametri.
export function chiaveTabellaApi(tabella, parametri) {
  if (!["card_data", "color_ratings"].includes(tabella)) return null;
  const ammessi = new Set(["expansion", "event_type", "time_period", "colors"]);
  // Ogni parametro una volta sola: `get` leggerebbe il primo e ignorerebbe il resto.
  for (const nome of parametri.keys()) {
    if (!ammessi.has(nome) || parametri.getAll(nome).length !== 1) return null;
  }
  const set = parametri.get("expansion");
  const formato = parametri.get("event_type");
  const periodo = parametri.get("time_period") ?? "ALL_TIME";
  if (!SET.test(set ?? "") || !FORMATI_API.includes(formato) || periodo !== "ALL_TIME") {
    return null;
  }
  const colori = coppiaCanonica(parametri.get("colors"));
  if (colori === undefined || (tabella === "color_ratings" && colori)) return null;
  return `api/${tabella}/${set}/${formato}/${colori ?? "tutti"}.json`;
}

export function distribuzioneApiAttiva(ambiente) {
  const politica = politicaCorrente(ambiente);
  if (!politica || canaleEffettivo(politica) !== "central_api") return false;
  if (politica.providers["17lands"].mode === "disabled") return false;
  return ambiente.MOX_DRAFT_API_DISTRIBUTION === "on";
}

function canaleNegaTutto(ambiente) {
  const grezzo = ambiente?.MOX_EXTERNAL_DATA_POLICY;
  if (grezzo === undefined || grezzo === null || grezzo === "") return false;
  const politica = politicaCorrente(ambiente);
  // Un secret rotto non apre niente di nuovo: per i dati Draft vale `off`.
  return !politica || canaleEffettivo(politica) === "off";
}

async function servi(oggetto, massimo, intestazioni, richiesta) {
  if (!oggetto) return errore("non trovato", 404);
  if (oggetto.size > massimo) return errore("oggetto oltre il limite", 500);
  const etag = oggetto.httpEtag;
  if (etag && richiesta.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ...intestazioni, etag } });
  }
  const byte = await oggetto.arrayBuffer();
  const headers = { "content-type": "application/json; charset=utf-8", ...intestazioni,
    "x-mox-sha256": await sha256Esadecimale(byte) };
  if (etag) headers.etag = etag;
  return new Response(byte, { status: 200, headers });
}

export async function gestisciDatiDraft(richiesta, ambiente, indirizzo) {
  if (!indirizzo.pathname.startsWith(PREFISSO)) return null;
  if (richiesta.method !== "GET") return errore("usa GET", 405);
  const resto = indirizzo.pathname.slice(PREFISSO.length);
  const archivio = ambiente.DRAFT_STATS;
  if (!archivio || typeof archivio.get !== "function") {
    return errore("distribuzione dei dati Draft non configurata", 503);
  }

  if (resto === "public/manifest.json" || resto.startsWith("public/payload/")) {
    if (canaleNegaTutto(ambiente)) return errore("dati esterni spenti", 403);
    if (resto === "public/manifest.json") {
      return servi(await archivio.get("public/manifest.json"), MASSIMO_MANIFESTO,
        { "cache-control": "public, max-age=300" }, richiesta);
    }
    const nome = resto.slice("public/payload/".length);
    const sha = nome.endsWith(".json") ? nome.slice(0, -5) : "";
    if (!SHA.test(sha)) return errore("payload non valido", 400);
    return servi(await archivio.get(`public/payload/${sha}.json`), MASSIMO_PAYLOAD,
      { "cache-control": "public, max-age=31536000, immutable" }, richiesta);
  }

  if (resto === "api/card_data" || resto === "api/color_ratings") {
    if (!distribuzioneApiAttiva(ambiente)) {
      return errore("dati API non autorizzati", 403);
    }
    const chiave = chiaveTabellaApi(resto.slice(4), indirizzo.searchParams);
    if (!chiave) return errore("parametri non ammessi", 400);
    // Embargo di 17Lands: un set in elenco ancora nei primi giorni non si serve,
    // anche se per errore ci fosse una tabella salvata.
    const set = indirizzo.searchParams.get("expansion");
    const voce = (await leggiSetAttivi(archivio)).find((v) => v.set === set);
    if (!voce || !voce.formati.includes(indirizzo.searchParams.get("event_type"))
      || inEmbargo(voce)) return errore("set non disponibile o in embargo", 404);
    const oggetto = await archivio.get(chiave);
    const raccolto = Date.parse(oggetto?.customMetadata?.raccolto_il ?? "");
    if (oggetto && !(Date.now() - raccolto < ETA_MASSIMA_API_MS)) {
      return errore("dati API scaduti", 404);
    }
    return servi(oggetto, MASSIMO_PAYLOAD, { "cache-control": "private, no-store" }, richiesta);
  }
  return errore("non trovato", 404);
}
