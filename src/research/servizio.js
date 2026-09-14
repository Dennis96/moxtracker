// L'orchestrazione delle route Research: consenso, revoca, delete e upload.
//
// Ogni route segue lo stesso ordine (addendum finale M8 §8):
//
//   gate in memoria (config, qualification, body, forma)
//   -> un ResearchD1BudgetContext con charged = 0
//   -> ogni lettura D1 tramite il gateway
//   -> piano immutabile e reservation dell'intero piano iniziale
//   -> batch tramite token; retry, rilettura e ripiano sullo stesso context.
//
// Questo modulo non tocca mai un binding D1: parla solo con il context. E non
// scrive mai nei log token, segreti o corpi: al massimo un codice.

import { BudgetEsaurito, contestoResearch, descrittore } from "./budget.js";
import {
  byteInHex, credentialTag, deletedContributionTag, lineageTag, sha256Hex, stessoValore,
} from "./canonico.js";
import { CollisioneHash, confrontaRevisione, unisciSummary } from "./join.js";
import {
  pianoCompletionDelete, pianoConsenso, pianoDeleteContribution, pianoMarkDelete, pianoRevoca,
  planContribution, summaryDaContribution,
} from "./planner.js";
import { VERSIONI_CONSENSO_RESEARCH } from "./registro.js";
import { leggiCorpo, validaBusta, validaContribution } from "./validatore.js";

// Stessa soglia del legacy (addendum G3B/G5 §8): scritture per giorno.
const QUOTA_GIORNALIERA = 300;
const MAX_CORPO_LIFECYCLE = 2048;
const HEX32 = /^[0-9a-f]{32}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const CENSIMENTO_PER_GIRO = 25;
const TENTATIVI_CAS = 3;

class EsitoIncerto extends Error {}

const esito = (stato, corpo) => ({ stato, corpo });
const adesso = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

function vincoloFallito(errore) {
  return /constraint failed/i.test(String(errore?.message));
}

// D1 riporta con questo prefisso gli errori di statement, dopo il rollback.
function rollbackNoto(errore) {
  return vincoloFallito(errore) || /^D1_ERROR/.test(String(errore?.message));
}

async function corpoLifecycle(richiesta, chiavi) {
  const lettura = await leggiCorpo(richiesta, MAX_CORPO_LIFECYCLE);
  if (!lettura.ok) return { errore: esito(lettura.stato, { errore: lettura.errore }) };
  let corpo;
  try { corpo = JSON.parse(lettura.testo); } catch {
    return { errore: esito(400, { errore: "struttura_non_valida" }) };
  }
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo) ||
      Object.keys(corpo).some((k) => !chiavi.includes(k)) ||
      !HEX32.test(corpo.mittente ?? "") || !HEX64.test(corpo.segreto_cancellazione ?? "")) {
    return { errore: esito(400, { errore: "struttura_non_valida" }) };
  }
  return { corpo };
}

async function limitaFrequenza(ambiente, richiesta, mittente) {
  const limitatore = ambiente.RESEARCH_RATE_LIMITER;
  if (!limitatore) return true;
  const origine = richiesta.headers.get("cf-connecting-ip") || "sconosciuta";
  for (const chiave of [`research-origine:${origine}`, `research-mittente:${mittente}`]) {
    const { success } = await limitatore.limit({ key: chiave });
    if (!success) return false;
  }
  return true;
}

function versioni(famiglia) {
  return Object.keys(famiglia.versioni).map(Number).sort((a, b) => a - b);
}

export async function trovaLineage(ctx, chiavi, mittente) {
  const candidati = [];
  for (const versione of versioni(chiavi.lineage)) {
    candidati.push({ versione, tag: await lineageTag(chiavi, versione, mittente) });
  }
  const riga = await ctx.first(descrittore("lineage_lettura", `SELECT lineage_tag,
    lineage_key_version, credential_tag, credential_key_version, stato
    FROM research_lineage WHERE lineage_tag IN (SELECT value FROM json_each(?1)) LIMIT 1`,
  [JSON.stringify(candidati.map((c) => c.tag))]));
  return { riga, candidati };
}

async function credenzialeValida(chiavi, riga, mittente, segreto) {
  if (!(riga.credential_key_version in chiavi.lineage.versioni)) return false;
  const tag = await credentialTag(chiavi, riga.credential_key_version, mittente, segreto);
  return stessoValore(tag, riga.credential_tag);
}

async function lineageDelMittente(chiavi, riga, mittente) {
  if (!(riga.lineage_key_version in chiavi.lineage.versioni)) return false;
  return stessoValore(await lineageTag(chiavi, riga.lineage_key_version, mittente), riga.lineage_tag);
}

async function tagSoppressione(chiavi, lineage, idPubblico) {
  const fuori = [];
  for (const versione of versioni(chiavi.tombstone)) {
    fuori.push({ tag: await deletedContributionTag(chiavi, versione, lineage, idPubblico),
      key_version: versione });
  }
  return fuori;
}

function soppressa(ctx, tag) {
  return ctx.first(descrittore("soppressione_lettura", `SELECT 1 AS presente
    FROM research_deleted_contribution WHERE tag IN (SELECT value FROM json_each(?1)) LIMIT 1`,
  [JSON.stringify(tag.map((t) => t.tag))]));
}

async function leggiCorrente(ctx, mittente, idPubblico) {
  const { results: righe = [] } = await ctx.all(descrittore("prejoin_lettura", `SELECT
    c.versione_server, c.revisione_modello, c.revisione_osservazioni, c.overflow,
    v.variant_hash, v.body
    FROM research_contribution c LEFT JOIN research_contribution_variante v
      ON v.mittente = c.mittente AND v.id_pubblico = c.id_pubblico
    WHERE c.mittente = ?1 AND c.id_pubblico = ?2 ORDER BY v.variant_hash`,
  [mittente, idPubblico]));
  if (!righe.length) return { versione_server: 0, summary: null };
  const prima = righe[0];
  return {
    versione_server: prima.versione_server,
    summary: {
      revisione: { modello: prima.revisione_modello, osservazioni: prima.revisione_osservazioni },
      retained: righe.filter((r) => r.variant_hash)
        .map((r) => ({ hash: r.variant_hash, body: JSON.parse(r.body) })),
      overflow: Boolean(prima.overflow),
    },
  };
}

// ------------------------------------------------------------ consenso

export async function consenti(richiesta, ambiente, config) {
  const { corpo, errore } = await corpoLifecycle(richiesta,
    ["mittente", "segreto_cancellazione", "versione_consenso"]);
  if (errore) return errore;
  if (!VERSIONI_CONSENSO_RESEARCH.includes(corpo.versione_consenso)) {
    return esito(400, { errore: "versione_consenso_non_supportata" });
  }
  if (!await limitaFrequenza(ambiente, richiesta, corpo.mittente)) {
    return esito(429, { errore: "troppe_richieste" });
  }
  const { mittente, segreto_cancellazione: segreto, versione_consenso: versione } = corpo;
  const chiavi = config.chiavi;
  const ctx = contestoResearch(ambiente, config.max_d1_queries_per_request);
  try {
    const { riga, candidati } = await trovaLineage(ctx, chiavi, mittente);
    let lineage;
    if (riga) {
      if (!await credenzialeValida(chiavi, riga, mittente, segreto)) {
        return esito(403, { errore: "lineage_credential_mismatch" });
      }
      if (riga.stato === "deleting") return esito(409, { errore: "lineage_delete_in_progress" });
      lineage = { lineage_tag: riga.lineage_tag, lineage_key_version: riga.lineage_key_version,
        credential_tag: riga.credential_tag, credential_key_version: riga.credential_key_version };
    } else {
      // TOFU dichiarato: se il mittente ha gia' verificatori legacy, il
      // segreto deve coincidere con tutti, come in `collegaMox`.
      const impronta = await sha256Hex(segreto);
      for (const db of ["DB", "DRAFT_DB"]) {
        if (!ctx.disponibile(db)) continue;
        const legacy = await ctx.first(descrittore("verificatore_legacy",
          "SELECT cancellazione_hash FROM contributori WHERE mittente = ?1", [mittente], db));
        if (legacy && !stessoValore(legacy.cancellazione_hash, impronta)) {
          return esito(403, { errore: "lineage_credential_mismatch" });
        }
      }
      const corrente = chiavi.lineage.corrente;
      lineage = { lineage_tag: candidati.find((c) => c.versione === corrente).tag,
        lineage_key_version: corrente,
        credential_tag: await credentialTag(chiavi, corrente, mittente, segreto),
        credential_key_version: corrente };
    }
    const token = byteInHex(crypto.getRandomValues(new Uint8Array(32)));
    const creata = adesso();
    try {
      await ctx.budgetedBatch(pianoConsenso({ ...lineage, generation_hash: await sha256Hex(token),
        mittente, versione_consenso: versione, adesso: creata }));
    } catch (guasto) {
      if (vincoloFallito(guasto)) return esito(409, { errore: "lineage_delete_in_progress" });
      throw guasto;
    }
    return esito(200, { generation: token, versione_consenso: versione, creata });
  } catch (guasto) {
    if (guasto instanceof BudgetEsaurito) return esito(413, { errore: "budget_d1_superato" });
    throw guasto;
  }
}

async function autenticaLineage(ctx, chiavi, corpo) {
  const { riga } = await trovaLineage(ctx, chiavi, corpo.mittente);
  if (!riga) return { errore: esito(404, { errore: "lineage_sconosciuta" }) };
  if (!await credenzialeValida(chiavi, riga, corpo.mittente, corpo.segreto_cancellazione)) {
    return { errore: esito(403, { errore: "lineage_credential_mismatch" }) };
  }
  return { riga };
}

export async function revoca(richiesta, ambiente, config) {
  const { corpo, errore } = await corpoLifecycle(richiesta, ["mittente", "segreto_cancellazione"]);
  if (errore) return errore;
  const ctx = contestoResearch(ambiente, config.max_d1_queries_per_request);
  try {
    const { riga, errore: negato } = await autenticaLineage(ctx, config.chiavi, corpo);
    if (negato) return negato;
    await ctx.budgetedBatch(pianoRevoca({ lineage_tag: riga.lineage_tag, adesso: adesso() }));
    return esito(200, { revocata: true });
  } catch (guasto) {
    if (guasto instanceof BudgetEsaurito) return esito(413, { errore: "budget_d1_superato" });
    throw guasto;
  }
}

// -------------------------------------------------------------- delete

/**
 * Il delete fail-closed di una lineage: mark `deleting` e revoca, poi un
 * chunk per contribution (tombstone e dati nella stessa transazione), poi la
 * completion. Se il budget finisce dopo il mark, lo stato resta `deleting` e
 * si risponde con una continuation: nessun chunk parte senza reservation.
 */
export async function eliminaLineage(ctx, chiavi, { lineage_tag: lineage, mittente }) {
  const quando = adesso();
  const riga = await ctx.first(descrittore("lineage_stato",
    "SELECT stato FROM research_lineage WHERE lineage_tag = ?1", [lineage]));
  if (!riga) return { stato: "deleted", eliminate: 0 };
  if (riga.stato === "deleted") return { stato: "deleted", eliminate: 0 };
  await ctx.budgetedBatch(pianoMarkDelete({ lineage_tag: lineage, adesso: quando }));
  let eliminate = 0;
  try {
    for (;;) {
      const { results: ids = [] } = await ctx.all(descrittore("censimento_delete",
        `SELECT id_pubblico FROM research_contribution WHERE mittente = ?1
         ORDER BY id_pubblico LIMIT ${CENSIMENTO_PER_GIRO}`, [mittente]));
      if (!ids.length) break;
      for (const { id_pubblico: id } of ids) {
        await ctx.budgetedBatch(pianoDeleteContribution({ lineage_tag: lineage, mittente,
          id_pubblico: id, tag: await tagSoppressione(chiavi, lineage, id), adesso: quando }));
        eliminate += 1;
      }
    }
    await ctx.budgetedBatch(pianoCompletionDelete({ lineage_tag: lineage, mittente,
      adesso: quando }));
  } catch (guasto) {
    if (guasto instanceof BudgetEsaurito) {
      return { stato: "deleting", eliminate, continuation: true,
        motivo_codice: "budget_d1_retry_esaurito" };
    }
    throw guasto;
  }
  return { stato: "deleted", eliminate };
}

export async function elimina(richiesta, ambiente, config) {
  const { corpo, errore } = await corpoLifecycle(richiesta, ["mittente", "segreto_cancellazione"]);
  if (errore) return errore;
  const ctx = contestoResearch(ambiente, config.max_d1_queries_per_request);
  try {
    const { riga, errore: negato } = await autenticaLineage(ctx, config.chiavi, corpo);
    if (negato) return negato.stato === 404 ? esito(200, { stato: "deleted", eliminate: 0 }) : negato;
    const fatto = await eliminaLineage(ctx, config.chiavi,
      { lineage_tag: riga.lineage_tag, mittente: corpo.mittente });
    return esito(fatto.stato === "deleted" ? 200 : 202,
      fatto.stato === "deleted" ? fatto : { ...fatto, retryable: true });
  } catch (guasto) {
    if (guasto instanceof BudgetEsaurito) return esito(413, { errore: "budget_d1_superato" });
    // Un chunk fallito e' tornato indietro con il suo tombstone: lo stato
    // resta `deleting` e il retry riprende dal censimento.
    console.error("research: delete interrotto", guasto?.name || "errore");
    return esito(503, { errore: "guasto_temporaneo", stato: "deleting", retryable: true });
  }
}

// -------------------------------------------------------------- upload

function risultato(lavoro, stato, motivo, percorso) {
  return { id_pubblico: lavoro.id, input_indices: lavoro.indici, stato,
    ...(motivo ? { motivo_codice: motivo } : {}), ...(percorso ? { percorso } : {}) };
}

function daOutcome(lavoro, outcome) {
  return risultato(lavoro, outcome.esito, outcome.motivo, outcome.percorso);
}

async function eseguiConRetry(ctx, lavoro, token, base) {
  let piano = lavoro.piano;
  let gettone = token;
  for (let tentativo = 1; ; tentativo += 1) {
    try {
      if (gettone) await ctx.invokeReservedBatch(gettone, piano.atomic_write_batch);
      else await ctx.budgetedBatch(piano.atomic_write_batch);
      return daOutcome(lavoro, piano.outcome);
    } catch (guasto) {
      if (guasto instanceof BudgetEsaurito) return risultato(lavoro, "retryable", "budget_d1_retry_esaurito");
      if (!rollbackNoto(guasto)) throw new EsitoIncerto();
      if (!vincoloFallito(guasto)) return risultato(lavoro, "retryable", "guasto_transitorio");
      if (tentativo >= TENTATIVI_CAS) return risultato(lavoro, "retryable", "cas_esaurito");
    }
    // Guardia o CAS persi: si rilegge tutto quello da cui il piano dipendeva
    // e si ripianifica sullo stesso ledger. Il piano vecchio non si riusa.
    try {
      const stato = await ctx.first(descrittore("guardia_rilettura", `SELECT g.stato AS g,
        l.stato AS l FROM research_consent_generation g JOIN research_lineage l
        ON l.lineage_tag = g.lineage_tag WHERE g.hash = ?1`, [base.generation_hash]));
      if (!stato || stato.g !== "active" || stato.l !== "active") {
        return risultato(lavoro, "rejected", "generation_inactive");
      }
      if (await soppressa(ctx, lavoro.tag)) return risultato(lavoro, "rejected", "deleted_contribution");
      const corrente = await leggiCorrente(ctx, base.mittente, lavoro.id);
      piano = planContribution({ ...base, tag_soppressione: lavoro.tag.map((t) => t.tag) },
        lavoro.arrivo, corrente);
      lavoro.statementPianificati += piano.atomic_write_batch.length;
      gettone = null;
      if (!piano.atomic_write_batch.length) return daOutcome(lavoro, piano.outcome);
    } catch (guasto) {
      if (guasto instanceof BudgetEsaurito) return risultato(lavoro, "retryable", "budget_d1_retry_esaurito");
      throw guasto;
    }
  }
}

function arrivoDelGruppo(summaries) {
  const massima = summaries.reduce((a, b) =>
    (confrontaRevisione(a.revisione, b.revisione) >= 0 ? a : b));
  return summaries.filter((s) => confrontaRevisione(s.revisione, massima.revisione) === 0)
    .reduce((a, b) => unisciSummary(a, b));
}

export async function riceviResearch(richiesta, ambiente, config) {
  const autorizzazione = /^Bearer ([0-9a-f]{64})$/.exec(richiesta.headers.get("authorization") || "");
  if (!autorizzazione) return esito(400, { errore: "generation_mancante" });
  const lettura = await leggiCorpo(richiesta, config.max_body_bytes);
  if (!lettura.ok) {
    return esito(lettura.stato, { errore: lettura.errore,
      ...(lettura.max_body_bytes ? { max_body_bytes: lettura.max_body_bytes } : {}) });
  }
  let corpo;
  try { corpo = JSON.parse(lettura.testo); } catch {
    return esito(400, { errore: "struttura_non_valida" });
  }
  const busta = validaBusta(corpo, config);
  if (!busta.ok) {
    return esito(busta.stato, { errore: busta.errore,
      ...(busta.percorso ? { percorso: busta.percorso } : {}),
      ...(busta.cap ? { cap: busta.cap } : {}) });
  }
  const { mittente, segreto_cancellazione: segreto } = corpo;
  if (!await limitaFrequenza(ambiente, richiesta, mittente)) {
    return esito(429, { errore: "troppe_richieste" });
  }
  const risultati = [];
  const gruppi = new Map();
  corpo.partite.forEach((c, indice) => {
    const rifiuto = validaContribution(c);
    if (rifiuto) {
      const id = typeof c?.id_pubblico === "string" && HEX64.test(c.id_pubblico) ? c.id_pubblico : null;
      risultati.push({ primo: indice, voce: { id_pubblico: id, input_indices: [indice],
        stato: "rejected", motivo_codice: rifiuto.motivo_codice, percorso: rifiuto.percorso } });
      return;
    }
    if (!gruppi.has(c.id_pubblico)) gruppi.set(c.id_pubblico, { indici: [], contribution: [] });
    gruppi.get(c.id_pubblico).indici.push(indice);
    gruppi.get(c.id_pubblico).contribution.push(c);
  });
  const chiavi = config.chiavi;
  const ctx = contestoResearch(ambiente, config.max_d1_queries_per_request);
  const hashToken = await sha256Hex(autorizzazione[1]);
  let statementPianificati = 0;
  try {
    const generation = await ctx.first(descrittore("generation_lettura", `SELECT mittente,
      lineage_tag, versione_consenso, stato FROM research_consent_generation WHERE hash = ?1`,
    [hashToken]));
    if (!generation || generation.stato !== "active" ||
        !stessoValore(generation.mittente, mittente)) {
      return esito(403, { errore: "generation_inactive" });
    }
    if (generation.versione_consenso !== corpo.consenso_research.versione) {
      return esito(403, { errore: "consenso_versione_errata" });
    }
    const lineage = await ctx.first(descrittore("lineage_upload", `SELECT lineage_tag,
      lineage_key_version, credential_tag, credential_key_version, stato
      FROM research_lineage WHERE lineage_tag = ?1`, [generation.lineage_tag]));
    if (!lineage || lineage.stato !== "active") return esito(403, { errore: "generation_inactive" });
    if (!await lineageDelMittente(chiavi, lineage, mittente) ||
        !await credenzialeValida(chiavi, lineage, mittente, segreto)) {
      return esito(403, { errore: "lineage_credential_mismatch" });
    }
    const ieri = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const quotaMittente = await ctx.first(descrittore("quota_mittente", `SELECT COUNT(*) AS n
      FROM research_revisione_server WHERE mittente = ?1 AND creata >= ?2`, [mittente, ieri]));
    const quotaGeneration = await ctx.first(descrittore("quota_generation", `SELECT COUNT(*) AS n
      FROM research_revisione_server WHERE generation_hash = ?1 AND creata >= ?2`,
    [hashToken, ieri]));
    const nuove = [...gruppi.keys()].length;
    if (quotaMittente.n + nuove > QUOTA_GIORNALIERA || quotaGeneration.n + nuove > QUOTA_GIORNALIERA) {
      return esito(429, { errore: "quota_superata", tetto: QUOTA_GIORNALIERA });
    }
    const base = { mittente, lineage_tag: lineage.lineage_tag, generation_hash: hashToken,
      versione_consenso: generation.versione_consenso, credential_tag: lineage.credential_tag,
      mox: corpo.mox, adesso: adesso() };
    const lavori = [];
    for (const [id, gruppo] of gruppi) {
      const lavoro = { id, indici: gruppo.indici, statementPianificati: 0 };
      const primo = gruppo.indici[0];
      try {
        lavoro.arrivo = arrivoDelGruppo(await Promise.all(gruppo.contribution.map(summaryDaContribution)));
      } catch (guasto) {
        if (!(guasto instanceof CollisioneHash)) throw guasto;
        risultati.push({ primo, voce: risultato(lavoro, "rejected", "collisione_hash") });
        continue;
      }
      lavoro.tag = await tagSoppressione(chiavi, lineage.lineage_tag, id);
      if (await soppressa(ctx, lavoro.tag)) {
        risultati.push({ primo, voce: risultato(lavoro, "rejected", "deleted_contribution") });
        continue;
      }
      const corrente = await leggiCorrente(ctx, mittente, id);
      try {
        lavoro.piano = planContribution({ ...base, tag_soppressione: lavoro.tag.map((t) => t.tag) },
          lavoro.arrivo, corrente);
      } catch (guasto) {
        if (!(guasto instanceof CollisioneHash)) throw guasto;
        risultati.push({ primo, voce: risultato(lavoro, "rejected", "collisione_hash") });
        continue;
      }
      lavoro.statementPianificati = lavoro.piano.atomic_write_batch.length;
      lavori.push({ primo, lavoro });
    }
    // Il piano iniziale si riserva tutto insieme, prima della prima write.
    const conBatch = lavori.filter(({ lavoro }) => lavoro.piano.atomic_write_batch.length);
    const token = conBatch.length
      ? ctx.reserveInitialWritePlan(conBatch.map(({ lavoro }) => lavoro.piano.atomic_write_batch))
      : [];
    const tokenDi = new Map(conBatch.map(({ lavoro }, i) => [lavoro, token[i]]));
    for (const { primo, lavoro } of lavori) {
      const voce = tokenDi.has(lavoro)
        ? await eseguiConRetry(ctx, lavoro, tokenDi.get(lavoro), base)
        : daOutcome(lavoro, lavoro.piano.outcome);
      statementPianificati += lavoro.statementPianificati;
      risultati.push({ primo, voce });
    }
  } catch (guasto) {
    if (guasto instanceof BudgetEsaurito) return esito(413, { errore: "budget_d1_superato" });
    if (guasto instanceof EsitoIncerto) {
      console.error("research: esito di un batch non noto");
      return esito(503, { errore: "esito_incerto", retryable: true });
    }
    throw guasto;
  }
  risultati.sort((a, b) => a.primo - b.primo);
  return esito(200, {
    versione: 1,
    risultati: risultati.map((r) => r.voce),
    diagnostica: { charged: ctx.charged, letture: ctx.lettureTentate,
      statement_pianificati: statementPianificati, statement_tentati: ctx.statementTentati },
  });
}
