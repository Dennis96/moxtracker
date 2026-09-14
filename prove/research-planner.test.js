// Il planner: dal contenuto validato e dallo stato letto ai descriptor
// congelati che il writer eseguira' tali e quali.

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  planContribution, pianoDeleteContribution, pianoMarkDelete, pianoCompletionDelete,
  summaryDaContribution, MAX_PARAMETRI,
} from "../src/research/planner.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const GOLDEN = JSON.parse(readFileSync(QUI + "fixtures/research-golden-rev2.json", "utf8"));
const copia = (x) => JSON.parse(JSON.stringify(x));

const CONTESTO = Object.freeze({
  mittente: "1".repeat(32), lineage_tag: "a".repeat(64), generation_hash: "b".repeat(64),
  versione_consenso: 1, credential_tag: "c".repeat(64), tag_soppressione: ["d".repeat(64)],
  mox: "prova", adesso: "2026-09-14T12:00:00Z",
});

const tipi = (piano) => piano.atomic_write_batch.map((d) => d.kind);

async function nuova(contribution) {
  return planContribution(CONTESTO, await summaryDaContribution(contribution),
    { versione_server: 0, summary: null });
}

test("una contribution nuova: guardia, contribution, variante e proiezioni, niente delete", async () => {
  const piano = await nuova(copia(GOLDEN.richiesta.partite[0]));
  assert.equal(piano.outcome.esito, "accepted_new");
  assert.deepEqual(tipi(piano), ["guardia_cas", "contribution_upsert", "variante_insert",
    "game_insert", "event_insert", "deck_insert"]);
  const guardia = piano.atomic_write_batch[0];
  assert.equal(guardia.params[2], 1, "la versione successiva a 0");
  assert.ok(Object.isFrozen(piano) && Object.isFrozen(piano.atomic_write_batch));
  // BO1 golden: 2 draw + 1 cast + 1 land, main di 3 voci e sideboard {}.
  assert.equal((piano.atomic_write_batch[4].params.length - 2) / 5, 4);
  assert.equal((piano.atomic_write_batch[5].params.length - 2) / 4, 3);
});

test("un aggiornamento riscrive proiezioni e varianti e archivia la snapshot superata", async () => {
  const vecchia = copia(GOLDEN.richiesta.partite[1]);
  const nuovaSnap = copia(vecchia);
  nuovaSnap.revisione.osservazioni = 4;
  const corrente = { versione_server: 3, summary: await summaryDaContribution(vecchia) };
  const piano = planContribution(CONTESTO, await summaryDaContribution(nuovaSnap), corrente);
  assert.equal(piano.outcome.esito, "updated");
  assert.deepEqual(tipi(piano), ["guardia_cas", "contribution_upsert",
    "storia_insert", "storia_potatura", "variante_delete", "variante_insert",
    "event_delete", "deck_delete", "delta_delete", "game_delete",
    // 33 righe di mazzo (3 game x 11 voci) con 24 righe per statement: due chunk.
    "game_insert", "event_insert", "deck_insert", "deck_insert", "delta_insert"]);
  assert.equal(piano.atomic_write_batch[0].params[2], 4);
});

test("un conflitto toglie le proiezioni e non ne scrive di nuove", async () => {
  const a = copia(GOLDEN.richiesta.partite[0]);
  const b = copia(a); b.turni = 7;
  const corrente = { versione_server: 1, summary: await summaryDaContribution(a) };
  const piano = planContribution(CONTESTO, await summaryDaContribution(b), corrente);
  assert.equal(piano.outcome.esito, "conflict");
  assert.deepEqual(tipi(piano), ["guardia_cas", "contribution_upsert", "variante_delete",
    "variante_insert", "event_delete", "deck_delete", "delta_delete", "game_delete"]);
  const upsert = piano.atomic_write_batch[1];
  assert.ok(upsert.params.includes("conflitto"));
  // Da conflitto a conflitto le proiezioni non esistono: niente delete inutili.
  const ancora = copia(a); ancora.turni = 8;
  const piano2 = planContribution(CONTESTO, await summaryDaContribution(ancora),
    { versione_server: 2, summary: piano.outcome.stato });
  assert.deepEqual(tipi(piano2), ["guardia_cas", "contribution_upsert", "variante_delete",
    "variante_insert"]);
});

test("unchanged, stale e rejected non scrivono niente", async () => {
  const a = copia(GOLDEN.richiesta.partite[1]);
  const corrente = { versione_server: 1, summary: await summaryDaContribution(a) };
  assert.equal(planContribution(CONTESTO, await summaryDaContribution(a), corrente)
    .atomic_write_batch.length, 0);
  const vecchia = copia(a); vecchia.revisione.osservazioni = 2;
  const stale = planContribution(CONTESTO, await summaryDaContribution(vecchia), corrente);
  assert.equal(stale.outcome.esito, "stale");
  assert.equal(stale.atomic_write_batch.length, 0);
  const regressione = copia(a); regressione.revisione.osservazioni = 9; regressione.turni = 1;
  const rifiutata = planContribution(CONTESTO, await summaryDaContribution(regressione), corrente);
  assert.equal(rifiutata.outcome.esito, "rejected");
  assert.equal(rifiutata.atomic_write_batch.length, 0);
});

function contributionConEventi(eventi, voci = 1) {
  const c = copia(GOLDEN.richiesta.partite[0]);
  const g = c.games[0];
  delete g.conflicted_event_ids; delete g.incomplete_event_types;
  g.draws = Array.from({ length: eventi }, (_, i) => ({
    event_id: (i + 1).toString(16).padStart(64, "0"), turno: 1 + (i % 40), card_id: 11 }));
  delete g.casts; delete g.lands;
  g.deck.main = Object.fromEntries(Array.from({ length: voci }, (_, i) => [String(100 + i), 1]));
  return c;
}

test("i chunk rispettano il limite dei parametri e il piano deriva dai descriptor", async () => {
  const piano = await nuova(contributionConEventi(141, 1));
  const eventi = piano.atomic_write_batch.filter((d) => d.kind === "event_insert");
  assert.equal(eventi.reduce((n, d) => n + (d.params.length - 2) / 5, 0), 141);
  for (const d of piano.atomic_write_batch) assert.ok(d.params.length <= MAX_PARAMETRI, d.kind);
  const grande = await nuova(contributionConEventi(200, 250));
  const mazzo = grande.atomic_write_batch.filter((d) => d.kind === "deck_insert");
  assert.equal(mazzo.reduce((n, d) => n + (d.params.length - 2) / 4, 0), 250);
  for (const d of grande.atomic_write_batch) assert.ok(d.params.length <= MAX_PARAMETRI, d.kind);
});

test("il delete di una contribution: guardia, tombstone, dati, e la guardia si svuota", () => {
  const piano = pianoDeleteContribution({ lineage_tag: "a".repeat(64), mittente: "1".repeat(32),
    id_pubblico: "e".repeat(64), tag: [{ tag: "f".repeat(64), key_version: 9 }],
    adesso: CONTESTO.adesso });
  assert.deepEqual(piano.map((d) => d.kind), ["guardia_deleting", "tombstone_insert",
    "event_delete", "deck_delete", "delta_delete", "game_delete", "variante_delete",
    "storia_delete", "revisione_delete", "contribution_delete", "guardia_svuota"]);
  assert.ok(Object.isFrozen(piano));
  const mark = pianoMarkDelete({ lineage_tag: "a".repeat(64), adesso: CONTESTO.adesso });
  assert.deepEqual(mark.map((d) => d.kind), ["lineage_deleting", "generation_revoca"]);
  const fine = pianoCompletionDelete({ lineage_tag: "a".repeat(64), mittente: "1".repeat(32),
    adesso: CONTESTO.adesso });
  assert.equal(fine[0].kind, "guardia_completion");
  assert.equal(fine.at(-1).kind, "guardia_svuota");
  assert.ok(fine.map((d) => d.kind).includes("generation_tombstone"));
});
