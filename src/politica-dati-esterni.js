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

export const MODI_DATI_ESTERNI = Object.freeze(["enabled", "cache_only", "disabled"]);

const INTESTAZIONI = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(corpo, stato = 200) {
  return new Response(JSON.stringify(corpo) + "\n", { status: stato, headers: INTESTAZIONI });
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
  return {
    schema: 1,
    providers: {
      "17lands": {
        mode: voce.mode,
        reason: typeof voce.reason === "string" ? voce.reason.slice(0, 200) : "",
        updated_at: typeof voce.updated_at === "string" ? voce.updated_at.slice(0, 40) : null,
      },
    },
  };
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
