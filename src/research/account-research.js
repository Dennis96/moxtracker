// Research dentro il lifecycle dell'account: export e cancellazione.
//
// L'account e' facoltativo e resta separato dalla lineage pseudonima: qui si
// arriva solo per i mittenti gia' collegati all'account (prova del segreto
// al collegamento) o dopo la verifica del segreto legacy. Anche queste
// operazioni passano dal gateway budgetizzato: nessun accesso D1 Research
// fuori dal context.
//
// Due scelte, e il perche':
// - se la configurazione Research e' spenta o invalida si usa comunque un
//   budget fisso per request (BUDGET_ACCOUNT): cancellare i propri dati non
//   deve dipendere dall'essere Research accesa. Un budget che finisce lascia
//   la lineage in `deleting` e l'account chiede di ripetere;
// - un database a cui la migrazione Research non e' ancora stata applicata
//   non ha dati Research: export e delete proseguono come prima.

import { BudgetEsaurito, contestoResearch, descrittore } from "./budget.js";
import { configResearch } from "./config.js";
import { eliminaLineage, trovaLineage } from "./servizio.js";

const BUDGET_ACCOUNT = 100;
const NOTA_OVERFLOW = "almeno quattro varianti osservate: qui le prime tre per impronta";

function tabelleAssenti(errore) {
  return /no such table/i.test(String(errore?.message));
}

function contesto(ambiente, config) {
  const max = config.max_d1_queries_per_request;
  return contestoResearch(ambiente, Number.isSafeInteger(max) && max > 0 ? max : BUDGET_ACCOUNT);
}

const revisione = (r) => ({ modello: r.revisione_modello, osservazioni: r.revisione_osservazioni });

/**
 * Tutto quello che Research conserva di questi mittenti e che ha un
 * significato per chi l'ha mandato. Mai hash di generation, tag di lineage o
 * credential, tombstone, righe CAS.
 */
export async function esportaResearch(ambiente, mittenti) {
  const ctx = contesto(ambiente, configResearch(ambiente));
  const lista = JSON.stringify(mittenti);
  const dentro = "mittente IN (SELECT value FROM json_each(?1))";
  try {
    const { results: righe = [] } = await ctx.all(descrittore("export_contribution",
      `SELECT mittente, id_pubblico, revisione_modello, revisione_osservazioni, stato, overflow,
       snapshot, ricevuta, aggiornata FROM research_contribution WHERE ${dentro}
       ORDER BY ricevuta, id_pubblico`, [lista]));
    const { results: varianti = [] } = await ctx.all(descrittore("export_varianti",
      `SELECT c.mittente, c.id_pubblico, v.variant_hash, v.body
       FROM research_contribution_variante v JOIN research_contribution c
         ON c.id = v.contribution_id
       WHERE c.stato = 'conflitto' AND c.${dentro} ORDER BY v.variant_hash`, [lista]));
    const { results: storia = [] } = await ctx.all(descrittore("export_storia",
      `SELECT c.mittente, c.id_pubblico, s.revisione_modello, s.revisione_osservazioni,
       s.variant_hash, s.overflow, s.body, s.archiviata
       FROM research_snapshot_storia s JOIN research_contribution c ON c.id = s.contribution_id
       WHERE c.${dentro} ORDER BY s.archiviata, c.id_pubblico, s.variant_hash`, [lista]));
    const { results: consensi = [] } = await ctx.all(descrittore("export_consensi",
      `SELECT mittente, versione_consenso, stato, creata, revocata
       FROM research_consent_generation WHERE ${dentro} ORDER BY creata`, [lista]));
    const variantiDi = new Map();
    for (const v of varianti) {
      const chiave = `${v.mittente}:${v.id_pubblico}`;
      if (!variantiDi.has(chiave)) variantiDi.set(chiave, []);
      variantiDi.get(chiave).push({ variant_hash: v.variant_hash, body: JSON.parse(v.body) });
    }
    return {
      contribution: righe.map((r) => {
        const base = { mittente: r.mittente, id_pubblico: r.id_pubblico, revisione: revisione(r),
          ricevuta: r.ricevuta, aggiornata: r.aggiornata, overflow: Boolean(r.overflow) };
        if (r.stato === "effettiva") return { ...base, stato: "effettiva", snapshot: JSON.parse(r.snapshot) };
        return { ...base, stato: "conteso",
          varianti: variantiDi.get(`${r.mittente}:${r.id_pubblico}`) || [],
          ...(r.overflow ? { nota: NOTA_OVERFLOW } : {}) };
      }),
      storia: storia.map((s) => ({ mittente: s.mittente, id_pubblico: s.id_pubblico,
        revisione: revisione(s), variant_hash: s.variant_hash, overflow: Boolean(s.overflow),
        body: JSON.parse(s.body), archiviata: s.archiviata })),
      consensi: consensi.map((c) => ({ mittente: c.mittente, versione_consenso: c.versione_consenso,
        stato: c.stato, creata: c.creata, revocata: c.revocata })),
    };
  } catch (errore) {
    if (tabelleAssenti(errore)) return { disponibile: false };
    throw errore;
  }
}

/**
 * Cancella la lineage Research di un mittente gia' autorizzato dal chiamante.
 * `stato` e' `deleted` soltanto quando non resta niente: in ogni altro caso il
 * chiamante non deve togliere le credenziali, cosi' il retry resta possibile.
 */
export async function eliminaResearchMittente(ambiente, mittente) {
  const config = configResearch(ambiente);
  const ctx = contesto(ambiente, config);
  // Research vive nel database delle partite: senza quel binding non c'e'
  // niente di Research da cancellare.
  if (!ctx.disponibile("DB")) return { stato: "deleted", eliminate: 0 };
  try {
    const presenza = await ctx.first(descrittore("research_presenza", `SELECT
      (SELECT COUNT(*) FROM research_contribution WHERE mittente = ?1)
      + (SELECT COUNT(*) FROM research_consent_generation WHERE mittente = ?1) AS n`,
    [mittente]));
    if (!presenza?.n) return { stato: "deleted", eliminate: 0 };
    // Senza chiavi non si calcolano i tombstone: cancellare comunque aprirebbe
    // la resurrezione. Si ferma e si dice perche'.
    if (!config.chiavi) return { stato: "bloccato", motivo: "chiavi_non_disponibili", eliminate: 0 };
    const { riga } = await trovaLineage(ctx, config.chiavi, mittente);
    if (!riga) return { stato: "bloccato", motivo: "lineage_non_risolta", eliminate: 0 };
    return await eliminaLineage(ctx, config.chiavi, { lineage_tag: riga.lineage_tag, mittente });
  } catch (errore) {
    if (tabelleAssenti(errore)) return { stato: "deleted", eliminate: 0 };
    if (errore instanceof BudgetEsaurito) {
      return { stato: "deleting", eliminate: 0, continuation: true,
        motivo_codice: "budget_d1_retry_esaurito" };
    }
    throw errore;
  }
}
