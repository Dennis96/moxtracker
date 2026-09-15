// Il planner di Research: dal contenuto validato e dallo stato letto ai
// descriptor che il writer eseguira' tali e quali (G5c §3, M8 finale §6).
//
// E' puro: non tocca D1, non conosce il binding, non ha orologio proprio.
// Decide qui - e solo qui - quali statement servono, quali famiglie vuote si
// omettono e dove cadono i chunk. Il costo di una richiesta e' il numero dei
// descriptor prodotti: non esiste una formula parallela da tenere allineata.

import { descrittore } from "./budget.js";
import { J, varianteHash } from "./canonico.js";
import { confrontaRevisione, decidi, effettiva } from "./join.js";

// D1: al massimo 100 parametri legati per statement. `?1` e `?2` (mittente e
// id_pubblico) sono condivisi da tutte le righe di un INSERT multi-riga.
export const MAX_PARAMETRI = 100;
const CONDIVISI = 2;

// La chiave interna della contribution, risolta dentro lo stesso statement:
// le proiezioni non ripetono piu' `mittente` e `id_pubblico` (compattazione D1).
// Se la contribution non c'e' vale NULL e il NOT NULL abortisce il batch.
const CID = "(SELECT id FROM research_contribution WHERE mittente = ?1 AND id_pubblico = ?2)";

export async function summaryDaContribution(contribution) {
  return {
    revisione: { modello: contribution.revisione.modello,
      osservazioni: contribution.revisione.osservazioni },
    retained: [{ hash: await varianteHash(contribution), body: contribution }],
    overflow: false,
  };
}

function bool(valore) {
  return typeof valore === "boolean" ? (valore ? 1 : 0) : null;
}

function valore(oggetto, chiave) {
  return chiave in oggetto ? oggetto[chiave] : null;
}

// Un INSERT multi-riga per ogni chunk: le righe si dividono in modo che
// nessuno statement superi MAX_PARAMETRI.
function inserimenti(kind, tabella, colonne, righe, mittente, idPubblico, verbo = "INSERT") {
  const perRiga = colonne.length;
  const perChunk = Math.floor((MAX_PARAMETRI - CONDIVISI) / perRiga);
  const fuori = [];
  for (let inizio = 0; inizio < righe.length; inizio += perChunk) {
    const blocco = righe.slice(inizio, inizio + perChunk);
    const params = [mittente, idPubblico];
    const valori = blocco.map((riga) => {
      const segni = riga.map((v) => { params.push(v); return `?${params.length}`; });
      return `(${segni.join(", ")})`;
    });
    const scelte = colonne.map((_, i) => `column${i + 1}`).join(", ");
    fuori.push(descrittore(kind,
      `${verbo} INTO ${tabella} (contribution_id, ${colonne.join(", ")}) `
      + `SELECT ${CID}, ${scelte} FROM (VALUES ${valori.join(", ")})`,
      params));
  }
  return fuori;
}

const COLONNE_GAME = ["game_number", "on_play", "mulligans", "free_mulligans", "mulligan_type",
  "opening_hand_size", "cards_bottomed", "result", "turni", "state_reset_observed",
  "state_gap_observed"];
const TIPO_EVENTO = { draws: "draw", casts: "cast", lands: "land" };

function righeProiezioni(body) {
  const giochi = [];
  const eventi = [];
  const carte = [];
  const delta = [];
  for (const g of body.games) {
    giochi.push([g.game_number, bool(g.on_play), valore(g, "mulligans"),
      valore(g, "free_mulligans"), valore(g, "mulligan_type"), valore(g, "opening_hand_size"),
      valore(g, "cards_bottomed"), valore(g, "result"), valore(g, "turni"),
      bool(g.state_reset_observed), bool(g.state_gap_observed)]);
    for (const [contenitore, tipo] of Object.entries(TIPO_EVENTO)) {
      for (const e of g[contenitore] || []) {
        eventi.push([g.game_number, tipo, e.event_id, e.turno, e.card_id]);
      }
    }
    if (g.deck) {
      for (const sezione of ["main", "sideboard"]) {
        for (const [carta, copie] of Object.entries(g.deck[sezione] || {})) {
          carte.push([g.game_number, sezione, Number(carta), copie]);
        }
      }
    }
    for (const [campo, direzione] of [["sideboard_in", "in"], ["sideboard_out", "out"]]) {
      const conti = new Map();
      for (const carta of g[campo] || []) conti.set(carta, (conti.get(carta) || 0) + 1);
      for (const [carta, copie] of conti) delta.push([g.game_number, direzione, carta, copie]);
    }
  }
  return { giochi, eventi, carte, delta };
}

function deleteProiezioni(mittente, idPubblico) {
  return [
    ["event_delete", "research_event"], ["deck_delete", "research_deck_card"],
    ["delta_delete", "research_sideboard_delta"], ["game_delete", "research_game_contribution"],
  ].map(([kind, tabella]) => descrittore(kind,
    `DELETE FROM ${tabella} WHERE contribution_id = ${CID}`, [mittente, idPubblico]));
}

const SQL_GUARDIA_CAS = `INSERT INTO research_revisione_server
  (mittente, id_pubblico, versione, generation_hash, creata, guardia)
  VALUES (?1, ?2, ?3, ?4, ?5, CASE WHEN
    EXISTS (SELECT 1 FROM research_lineage WHERE lineage_tag = ?6 AND stato = 'active')
    AND EXISTS (SELECT 1 FROM research_consent_generation WHERE hash = ?4
      AND stato = 'active' AND mittente = ?1 AND lineage_tag = ?6
      AND versione_consenso = ?7 AND credential_tag = ?8)
    AND NOT EXISTS (SELECT 1 FROM research_deleted_contribution
      WHERE tag IN (SELECT value FROM json_each(?9)))
    AND COALESCE((SELECT versione_server FROM research_contribution
      WHERE mittente = ?1 AND id_pubblico = ?2), 0) = ?3 - 1
  THEN 1 ELSE 0 END)`;

const SQL_CONTRIBUTION = `INSERT INTO research_contribution
  (mittente, id_pubblico, versione_server, revisione_modello, revisione_osservazioni, stato,
   overflow, snapshot, variant_hash, generation_hash, mox, quando, evento, formato, esito,
   turni, ricevuta, aggiornata)
  VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?17)
  ON CONFLICT (mittente, id_pubblico) DO UPDATE SET
    versione_server = excluded.versione_server,
    revisione_modello = excluded.revisione_modello,
    revisione_osservazioni = excluded.revisione_osservazioni,
    stato = excluded.stato, overflow = excluded.overflow, snapshot = excluded.snapshot,
    variant_hash = excluded.variant_hash, generation_hash = excluded.generation_hash,
    mox = excluded.mox, quando = excluded.quando, evento = excluded.evento,
    formato = excluded.formato, esito = excluded.esito, turni = excluded.turni,
    aggiornata = excluded.aggiornata`;

/**
 * Il piano di una contribution. `contesto` porta identita', generation,
 * tag di soppressione e l'istante della richiesta; `corrente` lo stato letto
 * (`versione_server` 0 e `summary` null se la contribution non esiste).
 */
export function planContribution(contesto, arrivo, corrente) {
  const decisione = decidi(corrente.summary, arrivo);
  const mittente = contesto.mittente;
  const idPubblico = arrivo.retained[0].body.id_pubblico;
  const nuovo = decisione.stato;
  const outcome = Object.freeze({ ...decisione });
  if (nuovo === corrente.summary) {
    return Object.freeze({ outcome, atomic_write_batch: Object.freeze([]) });
  }
  const adesso = contesto.adesso;
  const versione = corrente.versione_server + 1;
  const batch = [];
  batch.push(descrittore("guardia_cas", SQL_GUARDIA_CAS, [mittente, idPubblico, versione,
    contesto.generation_hash, adesso, contesto.lineage_tag, contesto.versione_consenso,
    contesto.credential_tag, JSON.stringify(contesto.tag_soppressione)]));

  const effettivo = effettiva(nuovo);
  const body = effettivo ? nuovo.retained[0].body : null;
  const proiezione = (chiave) => (body && chiave in body ? body[chiave] : null);
  batch.push(descrittore("contribution_upsert", SQL_CONTRIBUTION, [mittente, idPubblico,
    versione, nuovo.revisione.modello, nuovo.revisione.osservazioni,
    effettivo ? "effettiva" : "conflitto", nuovo.overflow ? 1 : 0,
    body ? J(body) : null, effettivo ? nuovo.retained[0].hash : null,
    contesto.generation_hash, contesto.mox, proiezione("quando"), proiezione("evento"),
    proiezione("formato"), proiezione("esito"), proiezione("turni"), adesso]));

  const prima = corrente.summary;
  if (prima && confrontaRevisione(nuovo.revisione, prima.revisione) > 0) {
    // La snapshot superata va in storia (al massimo le ultime due revisioni).
    batch.push(...inserimenti("storia_insert", "research_snapshot_storia",
      ["revisione_modello", "revisione_osservazioni", "variant_hash", "overflow", "body",
        "archiviata"],
      prima.retained.map((v) => [prima.revisione.modello, prima.revisione.osservazioni, v.hash,
        prima.overflow ? 1 : 0, J(v.body), adesso]), mittente, idPubblico,
      "INSERT OR IGNORE"));
    batch.push(descrittore("storia_potatura", `DELETE FROM research_snapshot_storia
      WHERE contribution_id = ${CID}
      AND (revisione_modello, revisione_osservazioni) NOT IN (
        SELECT revisione_modello, revisione_osservazioni FROM research_snapshot_storia
        WHERE contribution_id = ${CID}
        GROUP BY revisione_modello, revisione_osservazioni
        ORDER BY revisione_modello DESC, revisione_osservazioni DESC LIMIT 2)`,
    [mittente, idPubblico]));
  }
  // Le varianti esistono solo in conflitto: una snapshot effettiva sta nella
  // contribution e basta. Da effettiva a conflitto entrano tutte le
  // trattenute, compresa quella che era effettiva.
  if (prima && !effettiva(prima)) {
    batch.push(descrittore("variante_delete", `DELETE FROM research_contribution_variante
      WHERE contribution_id = ${CID}`, [mittente, idPubblico]));
  }
  if (!effettivo) {
    batch.push(...inserimenti("variante_insert", "research_contribution_variante",
      ["variant_hash", "body", "ricevuta"],
      nuovo.retained.map((v) => [v.hash, J(v.body), adesso]), mittente, idPubblico));
  }

  // Le proiezioni esistono solo se lo stato precedente era effettivo.
  if (prima && effettiva(prima)) batch.push(...deleteProiezioni(mittente, idPubblico));
  if (effettivo) {
    const righe = righeProiezioni(body);
    batch.push(...inserimenti("game_insert", "research_game_contribution", COLONNE_GAME,
      righe.giochi, mittente, idPubblico));
    batch.push(...inserimenti("event_insert", "research_event",
      ["game_number", "event_type", "event_id", "turno", "card_id"], righe.eventi,
      mittente, idPubblico));
    batch.push(...inserimenti("deck_insert", "research_deck_card",
      ["game_number", "sezione", "card_id", "copie"], righe.carte, mittente, idPubblico));
    batch.push(...inserimenti("delta_insert", "research_sideboard_delta",
      ["game_number", "direzione", "card_id", "copie"], righe.delta, mittente, idPubblico));
  }
  return Object.freeze({ outcome, atomic_write_batch: Object.freeze(batch) });
}

// ------------------------------------------------------------ lifecycle

const SQL_GUARDIA_SVUOTA = "DELETE FROM research_guardia";

function guardia(kind, condizione, params) {
  return descrittore(kind, `INSERT INTO research_guardia (ok)
    VALUES (CASE WHEN ${condizione} THEN 1 ELSE 0 END)`, params);
}

/** Tombstone e cancellazione di una contribution nella stessa unita' atomica. */
export function pianoDeleteContribution({ lineage_tag: lineage, mittente, id_pubblico: id, tag, adesso }) {
  const segni = tag.map((_, i) => `(?${i * 2 + 2}, ?${i * 2 + 3}, ?1, 'delete')`);
  const params = [adesso, ...tag.flatMap((t) => [t.tag, t.key_version])];
  const cancella = (kind, tabella) => descrittore(kind,
    `DELETE FROM ${tabella} WHERE mittente = ?1 AND id_pubblico = ?2`, [mittente, id]);
  // Figlie della contribution: per chiave interna, prima che la contribution sparisca.
  const cancellaFiglie = (kind, tabella) => descrittore(kind,
    `DELETE FROM ${tabella} WHERE contribution_id = ${CID}`, [mittente, id]);
  return Object.freeze([
    guardia("guardia_deleting",
      "EXISTS (SELECT 1 FROM research_lineage WHERE lineage_tag = ?1 AND stato = 'deleting')",
      [lineage]),
    descrittore("tombstone_insert", `INSERT OR IGNORE INTO research_deleted_contribution
      (tag, key_version, creato, motivo) VALUES ${segni.join(", ")}`, params),
    cancellaFiglie("event_delete", "research_event"),
    cancellaFiglie("deck_delete", "research_deck_card"),
    cancellaFiglie("delta_delete", "research_sideboard_delta"),
    cancellaFiglie("game_delete", "research_game_contribution"),
    cancellaFiglie("variante_delete", "research_contribution_variante"),
    cancellaFiglie("storia_delete", "research_snapshot_storia"),
    cancella("revisione_delete", "research_revisione_server"),
    cancella("contribution_delete", "research_contribution"),
    descrittore("guardia_svuota", SQL_GUARDIA_SVUOTA, []),
  ]);
}

/** Primo passo del delete: la lineage si chiude e le generation si revocano. */
export function pianoMarkDelete({ lineage_tag: lineage, adesso }) {
  return Object.freeze([
    descrittore("lineage_deleting", `UPDATE research_lineage SET stato = 'deleting',
      aggiornata = ?2 WHERE lineage_tag = ?1 AND stato IN ('active', 'deleting')`,
    [lineage, adesso]),
    descrittore("generation_revoca", `UPDATE research_consent_generation
      SET stato = 'revoked', revocata = ?2 WHERE lineage_tag = ?1 AND stato = 'active'`,
    [lineage, adesso]),
  ]);
}

/** Ultimo passo: generation in tombstone, poi via; la lineage diventa `deleted`. */
export function pianoCompletionDelete({ lineage_tag: lineage, mittente, adesso }) {
  return Object.freeze([
    guardia("guardia_completion", `EXISTS (SELECT 1 FROM research_lineage
      WHERE lineage_tag = ?1 AND stato = 'deleting')
      AND NOT EXISTS (SELECT 1 FROM research_contribution WHERE mittente = ?2)`,
    [lineage, mittente]),
    descrittore("generation_tombstone", `INSERT OR IGNORE INTO research_consent_tombstone
      (hash, creato, motivo) SELECT hash, ?2, 'delete' FROM research_consent_generation
      WHERE lineage_tag = ?1`, [lineage, adesso]),
    descrittore("generation_delete",
      "DELETE FROM research_consent_generation WHERE lineage_tag = ?1 OR mittente = ?2",
      [lineage, mittente]),
    descrittore("revisione_residui", "DELETE FROM research_revisione_server WHERE mittente = ?1",
      [mittente]),
    descrittore("lineage_deleted", `UPDATE research_lineage SET stato = 'deleted',
      aggiornata = ?2 WHERE lineage_tag = ?1 AND stato = 'deleting'`, [lineage, adesso]),
    descrittore("guardia_svuota", SQL_GUARDIA_SVUOTA, []),
  ]);
}

/**
 * Consenso: la lineage si apre (o si riapre dopo un delete completato, con la
 * stessa credential), le generation precedenti si revocano e ne nasce una.
 */
export function pianoConsenso(p) {
  return Object.freeze([
    descrittore("lineage_upsert", `INSERT INTO research_lineage (lineage_tag,
      lineage_key_version, credential_tag, credential_key_version, stato, creata, aggiornata)
      VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?5)
      ON CONFLICT (lineage_tag) DO UPDATE SET stato = 'active', aggiornata = excluded.aggiornata
      WHERE research_lineage.stato IN ('active', 'deleted')
        AND research_lineage.credential_tag = excluded.credential_tag`,
    [p.lineage_tag, p.lineage_key_version, p.credential_tag, p.credential_key_version, p.adesso]),
    guardia("guardia_consenso", `EXISTS (SELECT 1 FROM research_lineage
      WHERE lineage_tag = ?1 AND stato = 'active' AND credential_tag = ?2)`,
    [p.lineage_tag, p.credential_tag]),
    descrittore("generation_revoca", `UPDATE research_consent_generation
      SET stato = 'revoked', revocata = ?2 WHERE lineage_tag = ?1 AND stato = 'active'`,
    [p.lineage_tag, p.adesso]),
    descrittore("generation_insert", `INSERT INTO research_consent_generation (hash, mittente,
      lineage_tag, credential_tag, versione_consenso, stato, creata)
      VALUES (?1, ?2, ?3, ?4, ?5, 'active', ?6)`,
    [p.generation_hash, p.mittente, p.lineage_tag, p.credential_tag, p.versione_consenso,
      p.adesso]),
    descrittore("guardia_svuota", SQL_GUARDIA_SVUOTA, []),
  ]);
}

export function pianoRevoca({ lineage_tag: lineage, adesso }) {
  return Object.freeze([descrittore("generation_revoca", `UPDATE research_consent_generation
    SET stato = 'revoked', revocata = ?2 WHERE lineage_tag = ?1 AND stato = 'active'`,
  [lineage, adesso])]);
}
