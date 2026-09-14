// Il budget preventivo di righe scritte degli strumenti di staging.
//
// Nasce dall'incidente del 14/09/2026 (R3-OP-01): i benchmark sullo staging
// hanno esaurito la quota D1 gratuita, che vale per l'account intero, e hanno
// bloccato le scritture anche in produzione. Da qui: nessuna run remota senza
// un tetto esplicito, una stima prima di partire e un arresto prima della
// richiesta che lo supererebbe.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { BudgetRighe, RigheOltreBudget, righeMisurate, stimaRigheRichiesta }
  from "../strumenti/research-staging/budget-righe.mjs";
import { FORME, contribution } from "../strumenti/research-staging/forme.mjs";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const STAGING = "https://moxtracker-research-staging.esempio.workers.dev";

test("la stima e' conservativa rispetto alle righe misurate sul D1 reale (schema pre-compattazione)", () => {
  // Misure del 14/09/2026 sullo staging: 163, 417, 1.310, 13.521 righe scritte.
  const misurate = { tipica: 163, p95: 417, grande: 1310, "worst-case legale": 13521 };
  const attese = { tipica: 165, p95: 420, grande: 1314, "worst-case legale": 13527 };
  for (const [nome, reali] of Object.entries(misurate)) {
    const stima = stimaRigheRichiesta([contribution(FORME[nome])]);
    assert.equal(stima, attese[nome], nome);
    assert.ok(stima >= reali, `${nome}: stima ${stima} sotto le ${reali} misurate`);
  }
  assert.equal(stimaRigheRichiesta([contribution(FORME.tipica), contribution(FORME.tipica)]), 330);
});

test("il budget rifiuta la richiesta che lo supererebbe, prima di mandarla", () => {
  const budget = new BudgetRighe(1000);
  budget.prenota(600, "prima");
  budget.registra(580);
  assert.equal(budget.consumate, 580);
  assert.throws(() => budget.prenota(421, "seconda"), RigheOltreBudget);
  assert.equal(budget.consumate, 580, "un rifiuto non consuma niente");
  budget.prenota(420, "terza");
  budget.registra(null, 420);
  assert.equal(budget.consumate, 1000, "senza misura reale vale la stima");
  assert.throws(() => new BudgetRighe(0), RangeError);
  assert.throws(() => new BudgetRighe(Number.NaN), RangeError);
});

test("una misura che manca non vale zero: vale la stima", () => {
  assert.equal(righeMisurate(undefined), null);
  assert.equal(righeMisurate({ letture: 0, statement: 0, meta_visti: 0, meta_senza_righe: 0, righe_scritte: 0 }), 0,
    "nessuna chiamata a D1, nessuna riga");
  assert.equal(righeMisurate({ letture: 3, statement: 5, meta_visti: 5, meta_senza_righe: 0, righe_scritte: 40 }), 40);
  assert.equal(righeMisurate({ letture: 3, statement: 5, meta_visti: 5, meta_senza_righe: 5, righe_scritte: 0 }), null,
    "binding senza rows_written (il finto D1 locale)");
  assert.equal(righeMisurate({ letture: 3, statement: 5, meta_visti: 5, righe_scritte: 0 }), null,
    "Worker di staging senza il contatore");
  assert.equal(righeMisurate({ letture: 2, statement: 0, meta_visti: 0, meta_senza_righe: 0, righe_scritte: 0 }), null,
    "letture senza meta: non si sa");
});

function lancia(script, argomenti) {
  return spawnSync(process.execPath, [QUI + `../strumenti/research-staging/${script}`, ...argomenti],
    { env: { ...process.env, MOX_STAGING_TOKEN: "t".repeat(64) }, encoding: "utf8", timeout: 30000 });
}

test("senza --budget-righe gli strumenti di staging non partono", () => {
  for (const script of ["capacita.mjs", "accettazione.mjs"]) {
    const esito = lancia(script, ["--url", STAGING]);
    assert.equal(esito.status, 2, `${script}: ${esito.stderr}`);
    assert.match(esito.stderr, /budget-righe/);
  }
});

test("se la stima preventiva supera il tetto la run si ferma prima della prima richiesta", () => {
  for (const script of ["capacita.mjs", "accettazione.mjs"]) {
    const esito = lancia(script, ["--url", STAGING, "--budget-righe", "500"]);
    assert.equal(esito.status, 3, `${script}: ${esito.stderr}`);
    assert.match(esito.stderr, /stima preventiva/);
    assert.doesNotMatch(esito.stdout + esito.stderr, /fetch failed|ENOTFOUND/, "nessuna richiesta di rete");
  }
});

test("la stima preventiva della capacita' segue il piano scelto", () => {
  // Sei tipiche da sole: 6 x 165 righe piu' 30 del consenso.
  const esito = lancia("capacita.mjs", ["--url", STAGING, "--budget-righe", "1", "--forme", "tipica", "--senza-batch"]);
  assert.equal(esito.status, 3, esito.stderr);
  assert.match(esito.stderr, /stima preventiva: 1020 righe/);
});
