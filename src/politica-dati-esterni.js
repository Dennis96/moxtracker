// Il kill switch dei dati esterni di Mox: `GET /mox/external-data-policy`.
//
// Nasce il 28/09/2026. 17Lands scrive in ogni risposta della sua API che quei
// dati valgono solo su 17lands.com; il permesso e' stato chiesto e, se la
// risposta fosse «smettete», Mox deve smettere su tutte le macchine senza
// aspettare un aggiornamento. La decisione sta nel secret
// `MOX_EXTERNAL_DATA_POLICY`; il client (`strumenti/politica_dati_esterni.py`
// in mox-core) la legge, la ricorda e non la promuove mai per un guasto.
// Runbook: `mox-core/passaggi/coordinamento/KILL-SWITCH-17LANDS-2026-09-28.md`.
//
// Tre esiti, e nessuno ripete il contenuto del secret:
// - secret assente -> `enabled` con `configurata: false`, il comportamento di
//   Mox fino a oggi. Il client lo tratta come «nessuna policy»: non
//   sovrascrive un `disabled` gia' ricevuto. Per riabilitare si scrive
//   `enabled` nel secret, non lo si cancella;
// - secret valido -> la policy normalizzata;
// - secret rotto (JSON, schema, modo) -> 503: il server non inventa un modo, e
//   il client resta su quello che aveva.
//
// **Il canale dei dati Draft (14/10/2026).** Campo in piu', additivo, nella
// stessa voce: `providers["17lands"].channel` = `central_api` | `public_only` |
// `off`. I client fino alla 2.11.8 lo ignorano (scartano i campi sconosciuti,
// provato in `prove/politica-dati-esterni.test.js` e in mox-core con il
// modulo congelato della 2.11.8); per loro conta solo `mode`, e qui si fa in
// modo che dica la cosa giusta:
// - `public_only` e `off` forzano `mode: "disabled"` nella risposta, qualunque
//   modo sia scritto nel secret: i client 2.11.4–2.11.8 smettono di chiamare
//   17Lands **e** di leggere le cache API. Nessun client vecchio usa i Public
//   Data Sets, quindi `disabled` e' l'unico modo legacy coerente con entrambi;
// - `central_api` vale solo con `api_permission.granted === true` e un
//   riferimento scritto (`reference`): senza, il canale effettivo e'
//   `public_only` (fail-closed, mai un `enabled` implicito). Con il permesso il
//   modo legacy resta quello scritto;
// - senza `channel` la risposta e' **byte per byte quella di prima**.
// I client fino alla 2.11.3 non leggono questa route: nessun canale li ferma.

export const MODI_DATI_ESTERNI = Object.freeze(["enabled", "cache_only", "disabled"]);
export const CANALI_DATI_DRAFT = Object.freeze(["central_api", "public_only", "off"]);

const INTESTAZIONI = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(corpo, stato = 200) {
  return new Response(JSON.stringify(corpo) + "\n", { status: stato, headers: INTESTAZIONI });
}

function testo(valore, massimo) {
  return typeof valore === "string" ? valore.slice(0, massimo) : null;
}

// Il permesso API come lo scrive il comando amministrativo: niente di implicito.
export function permessoApiValido(voce) {
  const permesso = voce && typeof voce === "object" ? voce.api_permission : null;
  return Boolean(permesso && typeof permesso === "object" && permesso.granted === true
    && typeof permesso.reference === "string" && permesso.reference.trim().length >= 3);
}

export function normalizzaPolitica(grezzo) {
  let dato;
  try { dato = JSON.parse(grezzo); } catch { return null; }
  if (!dato || typeof dato !== "object" || dato.schema !== 1) return null;
  const fornitori = dato.providers;
  const voce = fornitori && typeof fornitori === "object" ? fornitori["17lands"] : null;
  if (!voce || typeof voce !== "object" || !MODI_DATI_ESTERNI.includes(voce.mode)) {
    return null;
  }
  const uscita = {
    mode: voce.mode,
    reason: typeof voce.reason === "string" ? voce.reason.slice(0, 200) : "",
    updated_at: typeof voce.updated_at === "string" ? voce.updated_at.slice(0, 40) : null,
  };
  if (Object.prototype.hasOwnProperty.call(voce, "channel")) {
    // Un canale scritto male e' un secret rotto: 503, come un modo sconosciuto.
    if (!CANALI_DATI_DRAFT.includes(voce.channel)) return null;
    let canale = voce.channel;
    if (canale === "central_api" && !permessoApiValido(voce)) canale = "public_only";
    uscita.channel = canale;
    if (canale !== "central_api") uscita.mode = "disabled";
    uscita.api_permission = canale === "central_api"
      ? { granted: true, reference: testo(voce.api_permission.reference, 200),
        granted_at: testo(voce.api_permission.granted_at, 40) }
      : { granted: false };
  }
  return { schema: 1, providers: { "17lands": uscita } };
}

// Il canale effettivo di una policy normalizzata (per le rotte dei dati Draft).
export function canaleEffettivo(politica) {
  const voce = politica?.providers?.["17lands"];
  if (!voce) return "off";
  return voce.channel ?? "public_only";
}

// La policy del secret, normalizzata, o `null` se assente o rotta.
export function politicaCorrente(ambiente) {
  const grezzo = ambiente?.MOX_EXTERNAL_DATA_POLICY;
  if (grezzo === undefined || grezzo === null || grezzo === "") return null;
  return normalizzaPolitica(String(grezzo));
}

export function politicaDatiEsterni(richiesta, ambiente) {
  if (richiesta.method !== "GET") return json({ errore: "usa GET" }, 405);
  const grezzo = ambiente.MOX_EXTERNAL_DATA_POLICY;
  if (grezzo === undefined || grezzo === null || grezzo === "") {
    return json({
      schema: 1,
      providers: { "17lands": { mode: "enabled", reason: "", updated_at: null } },
      configurata: false,
    });
  }
  const politica = normalizzaPolitica(String(grezzo));
  if (!politica) return json({ errore: "policy dati esterni non valida" }, 503);
  return json({ ...politica, configurata: true });
}
