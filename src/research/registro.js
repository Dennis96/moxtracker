// Il registro normativo di Research: che cosa il server accetta, scritto una
// volta sola e letto sia dal validator sia da `/salute`.
//
// Un modello non e' autorizzato perche' sta in un intervallo: e' autorizzato
// perche' compare qui (addendum G5b §3). Aggiungerne uno vuol dire cambiare
// questa riga con un deploy coordinato, e decidere le sue transizioni.

export const TRANSPORT_RESEARCH = 4;

export const SUPPORTED_RESEARCH_MODELS = Object.freeze({
  [TRANSPORT_RESEARCH]: Object.freeze([1]),
});

export const VERSIONI_CONSENSO_RESEARCH = Object.freeze([1]);

// Tetto di prodotto sul body realmente letto e limite di composizione del
// client (M8). Nessuno dei due e' una capacita' D1.
export const MAX_BODY_BYTES = 262144;
export const UPPER_BOUND_CLIENT = 33;

export function modelloSupportato(transport, modello) {
  const ammessi = SUPPORTED_RESEARCH_MODELS[transport];
  return Array.isArray(ammessi) && Number.isSafeInteger(modello) &&
    ammessi.includes(modello);
}

// Esiti per elemento del batch: catalogo chiuso (addendum G3B/G5 §12, G5b §4).
export const ESITI_ELEMENTO = Object.freeze([
  "accepted_new", "updated", "unchanged", "stale",
  "conflict", "conflict_overflow", "rejected", "retryable",
]);

// Motivi che possono accompagnare un esito o un errore di route. Nessun
// messaggio interno, nessun valore privato: solo questi codici.
export const MOTIVI = Object.freeze([
  // validator
  "struttura_non_valida", "campo_non_ammesso", "campo_mancante", "valore_non_valido",
  "modello_non_valido", "modello_non_supportato",
  // join e lifecycle
  "regressione_non_dichiarata", "deleted_contribution", "collisione_hash",
  "conflitto_revisione", "conflitto_overflow", "generation_inactive",
  // concorrenza e budget
  "cas_esaurito", "budget_d1_retry_esaurito", "esito_incerto", "guasto_transitorio",
]);
