import { comandiPuliziaBrew } from "./brew-gruppi.js";

export const GIORNI_RETENTION_CONTRIBUTI = 730;
const GIORNO_MS = 24 * 60 * 60 * 1000;
const DIMENSIONE_PAGINA_R2 = 1000;

export function limiteRetention(adesso = Date.now()) {
  return new Date(adesso - GIORNI_RETENTION_CONTRIBUTI * GIORNO_MS).toISOString();
}

async function pulisciPartite(db, limite) {
  const vecchie = "SELECT id FROM partite WHERE ricevuta < ?";
  const esiti = await db.batch([
    db.prepare(`DELETE FROM carte_mazzo WHERE partita IN (${vecchie})`).bind(limite),
    db.prepare(`DELETE FROM carte_avversario WHERE partita IN (${vecchie})`).bind(limite),
    db.prepare("DELETE FROM partite WHERE ricevuta < ?").bind(limite),
    ...await comandiPuliziaBrew(db),
  ]);
  return Number(esiti[2]?.meta?.changes || 0);
}

async function pulisciDraft(db, r2, limite) {
  let ultimoId = "";
  for (;;) {
    const { results = [] } = await db.prepare(
      "SELECT id, oggetto_r2 FROM draft WHERE ricevuto < ? AND id > ? ORDER BY id LIMIT ?"
    ).bind(limite, ultimoId, DIMENSIONE_PAGINA_R2).all();
    if (!results.length) break;
    // Prima R2: se D1 fallisce, il prossimo cron trova ancora gli ID e ritenta.
    // La delete R2 e' idempotente anche se il lifecycle ha gia' rimosso l'oggetto.
    await r2.delete(results.map((riga) => riga.oggetto_r2));
    ultimoId = results.at(-1).id;
  }
  const vecchi = "SELECT id FROM draft WHERE ricevuto < ?";
  const esiti = await db.batch([
    db.prepare(`DELETE FROM draft_pick WHERE draft_id IN (${vecchi})`).bind(limite),
    db.prepare(`DELETE FROM draft_mazzo WHERE draft_id IN (${vecchi})`).bind(limite),
    db.prepare(`DELETE FROM draft_link WHERE draft_id IN (${vecchi})`).bind(limite),
    db.prepare("DELETE FROM draft WHERE ricevuto < ?").bind(limite),
  ]);
  return Number(esiti[3]?.meta?.changes || 0);
}

export async function pulisciContributiScaduti(ambiente, adesso = Date.now()) {
  const limite = limiteRetention(adesso);
  const partite = await pulisciPartite(ambiente.DB, limite);
  const draft = await pulisciDraft(ambiente.DRAFT_DB, ambiente.DRAFT_RAW, limite);
  return { limite, partite, draft };
}
