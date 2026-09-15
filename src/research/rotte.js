// Le route Research, separate dal legacy `/partite`.
//
// Il client e' un programma desktop: niente CORS, niente cache. Con la
// configurazione spenta, invalida o non qualificata ogni route risponde 503
// prima di creare il context, quindi senza nessun accesso D1 Research.

import { configResearch } from "./config.js";
import { consenti, elimina, revoca, riceviResearch } from "./servizio.js";

const ROTTE = {
  "/research/partite": riceviResearch,
  "/research/consenso": consenti,
  "/research/consenso/revoca": revoca,
  "/research/elimina": elimina,
};

function rispostaResearch(corpo, stato) {
  return new Response(JSON.stringify(corpo) + "\n", {
    status: stato,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function gestisciResearch(richiesta, ambiente, indirizzo) {
  if (!indirizzo.pathname.startsWith("/research/")) return null;
  const gestore = ROTTE[indirizzo.pathname];
  if (!gestore) return rispostaResearch({ errore: "non_trovato" }, 404);
  if (richiesta.method !== "POST") return rispostaResearch({ errore: "usa_post" }, 405);
  const config = configResearch(ambiente);
  if (!config.enabled) {
    return rispostaResearch({ errore: "research_disabilitata", motivo: config.motivo }, 503);
  }
  try {
    const { stato, corpo } = await gestore(richiesta, ambiente, config);
    return rispostaResearch(corpo, stato);
  } catch (guasto) {
    // Solo il tipo dell'errore: un messaggio D1 potrebbe riportare valori.
    console.error("research: guasto non classificato", guasto?.name || "errore");
    return rispostaResearch({ errore: "guasto_temporaneo", retryable: true }, 503);
  }
}
