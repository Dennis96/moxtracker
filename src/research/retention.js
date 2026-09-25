import { contestoResearch, descrittore } from "./budget.js";
import { configResearch } from "./config.js";
import { pianoScadenzaContribution } from "./planner.js";
import { tagSoppressione } from "./servizio.js";

const GIORNO_MS = 24 * 60 * 60 * 1000;
const PAGINA = 25;
const MASSIMO_PER_CRON = 75;

export function limiteResearch(adesso = Date.now()) {
  return new Date(adesso - 730 * GIORNO_MS).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Cancella in batch atomici, conservando il consenso e la lineage. */
export async function pulisciResearchScaduta(ambiente, adesso = Date.now()) {
  const config = configResearch(ambiente, adesso);
  if (!config.chiavi || !config.max_d1_queries_per_request) {
    if (config.modo === "off") return { eliminate: 0, saltata: true };
    throw new Error("configurazione retention Research non valida");
  }
  if (config.max_d1_queries_per_request < 13) {
    throw new Error("budget D1 insufficiente per la retention Research");
  }
  const ctx = contestoResearch(ambiente, config.max_d1_queries_per_request);
  const limite = limiteResearch(adesso);
  const quando = new Date(adesso).toISOString().replace(/\.\d{3}Z$/, "Z");
  let cursor = 0;
  let eliminate = 0;
  while (eliminate < MASSIMO_PER_CRON && ctx.residuo > 13) {
    const { results: righe = [] } = await ctx.all(descrittore("scadenza_censimento", `
      SELECT c.id, c.mittente, c.id_pubblico, g.lineage_tag
      FROM research_contribution c
      JOIN research_consent_generation g ON g.hash = c.generation_hash
      WHERE c.id > ?1 AND c.ricevuta <= ?2
      ORDER BY c.id LIMIT ?3`, [cursor, limite, Math.min(PAGINA, MASSIMO_PER_CRON - eliminate)]));
    if (!righe.length) break;
    for (const riga of righe) {
      cursor = riga.id;
      const tag = await tagSoppressione(config.chiavi, riga.lineage_tag, riga.id_pubblico);
      const piano = pianoScadenzaContribution({ ...riga, tag, adesso: quando, limite });
      if (ctx.residuo < piano.length) return { limite, eliminate, incompleta: true };
      try {
        await ctx.budgetedBatch(piano);
        eliminate += 1;
      } catch (errore) {
        if (!/constraint failed/i.test(String(errore?.message))) throw errore;
        // Un delete concorrente puo' avere gia' eliminato la contribution.
        const corrente = await ctx.first(descrittore("scadenza_rilettura",
          "SELECT id FROM research_contribution WHERE id = ?1", [riga.id]));
        if (corrente) throw errore;
      }
    }
    if (righe.length < PAGINA) break;
  }
  return { limite, eliminate, incompleta: eliminate === MASSIMO_PER_CRON || ctx.residuo <= 13 };
}
