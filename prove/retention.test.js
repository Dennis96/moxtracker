import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { creaFintoD1 } from "./finto-d1.js";
import { leggiMeta } from "../src/lettura.js";
import { statisticheDraft } from "../src/draft.js";
import { limiteRetention, pulisciContributiScaduti } from "../src/retention.js";

const SCHEMA = fileURLToPath(new URL("../schema.sql", import.meta.url));
const SCHEMA_DRAFT = fileURLToPath(new URL("../schema-draft.sql", import.meta.url));
const ADESSO = Date.UTC(2026, 8, 25, 12);
const GIORNO = 86400000;
const data = (giorni, extraMs = 0) => new Date(ADESSO - giorni * GIORNO + extraMs).toISOString();

function ambiente() {
  const oggetti = new Set();
  let guastoR2 = false;
  const env = {
    DB: creaFintoD1(SCHEMA), DRAFT_DB: creaFintoD1(SCHEMA_DRAFT),
    DRAFT_RAW: {
      oggetti,
      fallisci() { guastoR2 = true; },
      async delete(chiavi) {
        if (guastoR2) { guastoR2 = false; throw new Error("R2 indisponibile"); }
        for (const chiave of chiavi) oggetti.delete(chiave);
      },
    },
  };
  return env;
}

function partita(db, id, ricevuta, mittente = "a", impronta = "b".repeat(64)) {
  db.prepare(`INSERT INTO partite
    (id, mittente, ricevuta, quando, formato, evento, esito, impronta_mazzo, versione, dato)
    VALUES (?, ?, ?, ?, 'Standard', 'Ladder', 'vinta', ?, 1, '{}')`)
    .bind(id, mittente, ricevuta, data(900), impronta).run();
  db.prepare("INSERT INTO carte_mazzo VALUES (?, 123, 4)").bind(id).run();
  db.prepare("INSERT INTO carte_avversario VALUES (?, 456)").bind(id).run();
}

function draft(env, id, ricevuto) {
  const chiave = `2024-01/${id}.json`;
  env.DRAFT_DB.prepare(`INSERT INTO draft
    (id, mittente, ricevuto, iniziato, set_code, formato, completo, pick,
     politica, oggetto_r2, byte, versione)
    VALUES (?, 'a', ?, ?, 'HOB', 'PremierDraft', 1, 1, 'test', ?, 12, 1)`)
    .bind(id, ricevuto, data(900), chiave).run();
  env.DRAFT_DB.prepare(`INSERT INTO draft_pick
    (draft_id, numero, fase, consiglio, scelta, seguito, vicina, campione, politica)
    VALUES (?, 1, 'early', 1, 1, 1, 0, 100, 'test')`).bind(id).run();
  env.DRAFT_DB.prepare(`INSERT INTO draft_mazzo
    (draft_id, versione, carte, distinte, lista) VALUES (?, 1, 40, 1, '[]')`).bind(id).run();
  env.DRAFT_DB.prepare("INSERT INTO draft_link VALUES (?, 'p', 'vinta')").bind(id).run();
  env.DRAFT_RAW.oggetti.add(chiave);
}

test("730 giorni UTC: solo ricezione server, figli e dati pubblici aggiornati", async () => {
  const env = ambiente();
  const limite = limiteRetention(ADESSO);
  assert.equal(limite, data(730));
  partita(env.DB, "old", data(730, -1));
  partita(env.DB, "edge", limite);
  partita(env.DB, "young", data(729));
  partita(env.DB, "other", data(729), "altro", "c".repeat(64));
  // Una variante inizialmente pubblicabile scende sotto 30 partite.
  for (let i = 0; i < 27; i++) partita(env.DB, `same-${i}`, data(729));
  env.DB.prepare(`INSERT INTO account (id, nome, creato, aggiornato)
    VALUES ('u', 'utente', ?, ?)`).bind(limite, limite).run();
  env.DB.prepare(`INSERT INTO ticket (id, categoria, titolo, stato, creato, aggiornato)
    VALUES ('t', 'altro', 'test', 'aperto', ?, ?)`).bind(limite, limite).run();
  env.DB.prepare(`INSERT INTO research_lineage
    (lineage_tag, lineage_key_version, credential_tag, credential_key_version, stato, creata, aggiornata)
    VALUES ('r', 1, 'c', 1, 'active', ?, ?)`).bind(limite, limite).run();
  const prima = await leggiMeta(env.DB, new URL("https://test/meta?formato=Standard&periodo=totale"));
  assert.equal(prima.corpo.partite_totali, 31);
  assert.equal(prima.corpo.mazzi.some((m) => m.gruppi_brew?.some((g) =>
    g.varianti_brew.some((v) => v.decklist_pubblicabile))), true);
  const esito = await pulisciContributiScaduti(env, ADESSO);
  assert.equal(esito.partite, 1);
  assert.equal(env.DB.conta("partite"), 30);
  assert.equal(env.DB.conta("carte_mazzo"), 30);
  assert.equal(env.DB.conta("carte_avversario"), 30);
  assert.deepEqual(env.DB.tutte("SELECT id FROM partite WHERE id IN ('edge','young','other') ORDER BY id")
    .map((r) => r.id), ["edge", "other", "young"]);
  const dopo = await leggiMeta(env.DB, new URL("https://test/meta?formato=Standard&periodo=totale"));
  assert.equal(dopo.corpo.partite_totali, 30);
  assert.equal(dopo.corpo.mazzi.some((m) => m.gruppi_brew?.some((g) =>
    g.varianti_brew.some((v) => v.decklist_pubblicabile))), false);
  assert.equal(env.DB.conta("account"), 1);
  assert.equal(env.DB.conta("ticket"), 1);
  assert.equal(env.DB.conta("research_lineage"), 1);
  assert.equal((await pulisciContributiScaduti(env, ADESSO)).partite, 0);
});

test("Draft: D1, figli e R2 sono eliminati; i conteggi rimasti sono corretti", async () => {
  const env = ambiente();
  draft(env, "old", data(731));
  draft(env, "edge", data(730));
  draft(env, "young", data(729));
  const esito = await pulisciContributiScaduti(env, ADESSO);
  assert.equal(esito.draft, 1);
  for (const tabella of ["draft", "draft_pick", "draft_mazzo", "draft_link"]) {
    assert.equal(env.DRAFT_DB.conta(tabella), 2, tabella);
  }
  assert.equal(env.DRAFT_RAW.oggetti.has("2024-01/old.json"), false);
  assert.equal(env.DRAFT_RAW.oggetti.size, 2);
  const stats = await statisticheDraft(env.DRAFT_DB,
    new URL("https://test/draft/statistiche?periodo=totale"));
  assert.equal(stats.totali.draft, 2);
  assert.equal(stats.totali.pick, 2);
  assert.equal(stats.risultati.campione, 2);
  assert.equal((await pulisciContributiScaduti(env, ADESSO)).draft, 0);
});

test("errore R2 o D1: il cron successivo recupera senza orfani persistenti", async () => {
  const env = ambiente();
  draft(env, "old", data(731));
  env.DRAFT_RAW.fallisci();
  await assert.rejects(pulisciContributiScaduti(env, ADESSO), /R2 indisponibile/);
  assert.equal(env.DRAFT_DB.conta("draft"), 1);
  assert.equal(env.DRAFT_RAW.oggetti.size, 1);
  env.DRAFT_DB.guasti.statement = 3;
  await assert.rejects(pulisciContributiScaduti(env, ADESSO), /D1_ERROR/);
  assert.equal(env.DRAFT_DB.conta("draft"), 1);
  assert.equal(env.DRAFT_DB.conta("draft_pick"), 1);
  assert.equal(env.DRAFT_RAW.oggetti.size, 0);
  assert.equal((await pulisciContributiScaduti(env, ADESSO)).draft, 1);
  assert.equal(env.DRAFT_DB.conta("draft"), 0);
});
