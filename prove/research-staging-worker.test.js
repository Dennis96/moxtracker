// Il Worker di staging G5C-03, provato in locale prima di andare su D1 vero:
// le sonde stanno dietro token, il resto e' il Worker vero invariato.

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import staging from "../strumenti/research-staging/worker.mjs";
import { creaFintoD1 } from "./finto-d1.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const MIGRAZIONE = QUI + "../migrazioni/2026-09-14-research-r3.sql";
const GOLDEN = JSON.parse(readFileSync(QUI + "fixtures/research-golden-rev2.json", "utf8"));
const TOKEN = "t".repeat(40);

function ambiente(db, extra = {}) {
  return {
    DB: db, RESEARCH_MISURE: "attive", RESEARCH_MISURE_TOKEN: TOKEN,
    RESEARCH_AMBIENTE: "staging", RESEARCH_DEPLOYMENT: "research-staging-g5c03",
    RESEARCH_ENABLED: "true", RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST: "5",
    RESEARCH_MAX_D1_QUERIES_PER_REQUEST: "40",
    RESEARCH_HMAC_KEYS: JSON.stringify({
      lineage: { corrente: 1, versioni: { 1: "ab".repeat(32) } },
      tombstone: { corrente: 1, versioni: { 1: "cd".repeat(32) } } }),
    ...extra,
  };
}

async function sonda(amb, percorso, corpo, token = TOKEN) {
  const r = await staging.fetch(new Request(`https://s.invalid${percorso}`, {
    method: "POST", headers: { "content-type": "application/json", "x-mox-misure": token },
    body: JSON.stringify(corpo) }), amb, {});
  return { stato: r.status, corpo: await r.json() };
}

test("senza token, o con le misure spente, le sonde non esistono", async () => {
  const db = creaFintoD1(MIGRAZIONE);
  assert.equal((await sonda(ambiente(db), "/__misure/sql", {}, "x".repeat(40))).stato, 404);
  assert.equal((await sonda(ambiente(db, { RESEARCH_MISURE: undefined }), "/__misure/sql", {})).stato, 404);
  assert.equal(db.registro.letture, 0);
});

test("rollback: CHECK, UNIQUE e FOREIGN KEY annullano anche lo statement precedente", async () => {
  const db = creaFintoD1(MIGRAZIONE);
  // Deve scattare proprio il vincolo del caso: un errore qualsiasi (una
  // colonna che non esiste piu' dopo una migrazione) annullerebbe il batch lo
  // stesso e la prova passerebbe per il motivo sbagliato.
  const atteso = { check: /CHECK constraint/i, unique: /UNIQUE constraint/i, fk: /FOREIGN KEY constraint/i };
  for (const caso of ["check", "unique", "fk"]) {
    const { corpo } = await sonda(ambiente(db), "/__misure/rollback", { caso });
    assert.match(corpo.errore || "", atteso[caso], caso);
    assert.equal(corpo.righe_dopo, 0, caso);
  }
  const ok = await sonda(ambiente(db), "/__misure/rollback", { caso: "ok" });
  assert.equal(ok.corpo.errore, null);
  assert.equal(ok.corpo.righe_dopo, 1);
  assert.equal(db.conta("research_consent_tombstone"), 0, "le sonde si ripuliscono");
});

test("le funzioni SQL del planner esistono", async () => {
  const { corpo } = await sonda(ambiente(creaFintoD1(MIGRAZIONE)), "/__misure/sql", {});
  assert.equal(corpo.json_each, 3);
  assert.equal(corpo.row_value_not_in, 1);
});

test("applica: route vera, configurazione scelta, binding strumentato", async () => {
  const db = creaFintoD1(MIGRAZIONE);
  const amb = ambiente(db);
  const { mittente, segreto_cancellazione: segreto } = GOLDEN.richiesta;
  const consenso = await sonda(amb, "/__misure/applica", { percorso: "/research/consenso",
    corpo: { mittente, segreto_cancellazione: segreto, versione_consenso: 1 } });
  assert.equal(consenso.stato, 200, JSON.stringify(consenso.corpo));
  const token = consenso.corpo.corpo.generation;
  const upload = await sonda(amb, "/__misure/applica", { percorso: "/research/partite",
    headers: { authorization: `Bearer ${token}` }, corpo: GOLDEN.richiesta });
  assert.equal(upload.corpo.stato, 200);
  const d = upload.corpo.corpo.diagnostica;
  assert.equal(upload.corpo.strumento.letture, d.letture, "letture viste dal binding = ledger");
  assert.equal(upload.corpo.strumento.statement, d.statement_tentati);
  assert.equal(d.statement_tentati, d.statement_pianificati);
  // Il finto D1 non riporta rows_written: il binding lo deve dire, perche' il
  // budget di righe non scambi una misura assente per zero righe.
  assert.ok(upload.corpo.strumento.meta_senza_righe > 0, JSON.stringify(upload.corpo.strumento));
  const stretto = await sonda(amb, "/__misure/applica", { percorso: "/research/partite",
    headers: { authorization: `Bearer ${token}` }, corpo: GOLDEN.richiesta,
    config: { RESEARCH_MAX_D1_QUERIES_PER_REQUEST: "4" } });
  assert.equal(stretto.corpo.stato, 413);
  assert.equal(stretto.corpo.strumento.letture, 4);
  assert.equal(stretto.corpo.strumento.statement, 0);
  for (const tipo of ["assente", "stale", "divergente", "invalida"]) {
    const chiuso = await sonda(amb, "/__misure/applica", { percorso: "/research/partite",
      headers: { authorization: `Bearer ${token}` }, corpo: GOLDEN.richiesta, qualification: tipo });
    assert.equal(chiuso.corpo.stato, 503, tipo);
    assert.equal(chiuso.corpo.strumento.letture + chiuso.corpo.strumento.statement, 0, tipo);
  }
  const s = await sonda(amb, "/__misure/stato", { mittente });
  assert.equal(s.corpo.research_contribution, 2);
});

test("fuori da /__misure il Worker vero risponde come sempre", async () => {
  const r = await staging.fetch(new Request("https://s.invalid/salute"), ambiente(creaFintoD1(MIGRAZIONE)), {});
  const corpo = await r.json();
  assert.equal(corpo.stato, "vivo");
  assert.equal(typeof corpo.research.enabled, "boolean");
});
