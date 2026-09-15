// La configurazione Research: un solo oggetto, fail-closed, letto da route,
// preflight e `/salute`. Ogni valore mancante o storto spegne Research; non
// esiste un default permissivo.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { configResearch, saluteResearch } from "../src/research/config.js";
import {
  SUPPORTED_RESEARCH_MODELS, modelloSupportato, TRANSPORT_RESEARCH,
} from "../src/research/registro.js";

const ADESSO = Date.parse("2026-09-14T12:00:00Z");
const CHIAVI_PROVA = JSON.stringify({
  lineage: { corrente: 7, versioni: {
    7: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f" } },
  tombstone: { corrente: 9, versioni: {
    9: "202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f" } },
});
const CHIAVI_VERE = JSON.stringify({
  lineage: { corrente: 1, versioni: { 1: "ab".repeat(32) } },
  tombstone: { corrente: 1, versioni: { 1: "cd".repeat(32) } },
});

function qualifica(cambia = {}) {
  return JSON.stringify({
    versione: 1, id: "q-prova-1", deployment: "staging-1",
    max_contributions_per_request: 5, max_d1_queries_per_request: 300,
    valida_fino: "2026-10-01T00:00:00Z", ...cambia,
  });
}

function ambiente(cambia = {}) {
  return {
    RESEARCH_ENABLED: "true",
    RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST: "5",
    RESEARCH_MAX_D1_QUERIES_PER_REQUEST: "300",
    RESEARCH_DEPLOYMENT: "staging-1",
    RESEARCH_RUNTIME_QUALIFICATION: qualifica(),
    RESEARCH_HMAC_KEYS: CHIAVI_VERE,
    ...cambia,
  };
}

test("con tutto valido Research e' accesa con i cap configurati", () => {
  const config = configResearch(ambiente(), ADESSO);
  assert.equal(config.enabled, true);
  assert.equal(config.max_contributions_per_request, 5);
  assert.equal(config.max_d1_queries_per_request, 300);
  assert.equal(config.qualification.stato, "valida");
});

test("senza interruttore esplicito resta spenta", () => {
  for (const valore of [undefined, "", "1", "TRUE", "si", true]) {
    const config = configResearch(ambiente({ RESEARCH_ENABLED: valore }), ADESSO);
    assert.equal(config.enabled, false, String(valore));
  }
});

test("un cap contribution fuori 1..33 o di tipo sbagliato spegne Research", () => {
  for (const valore of [undefined, "0", "34", "-1", "2.5", "abc", "", true, "05x", 1.5]) {
    const config = configResearch(ambiente({
      RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST: valore }), ADESSO);
    assert.equal(config.enabled, false, String(valore));
    assert.equal(config.motivo, "cap_contributi_non_valido");
  }
  assert.equal(configResearch(ambiente({ RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST: "33",
    RESEARCH_RUNTIME_QUALIFICATION: qualifica({ max_contributions_per_request: 33 }) }),
  ADESSO).enabled, true);
});

test("un budget D1 assente, zero, negativo o non intero spegne Research", () => {
  for (const valore of [undefined, "0", "-4", "3.2", "mille", false, null]) {
    const config = configResearch(ambiente({
      RESEARCH_MAX_D1_QUERIES_PER_REQUEST: valore }), ADESSO);
    assert.equal(config.enabled, false, String(valore));
    assert.equal(config.motivo, "budget_d1_non_valido");
  }
});

test("la qualification assente, stale, divergente o illeggibile spegne Research", () => {
  const casi = [
    [undefined, "assente"],
    ["{", "invalida"],
    [qualifica({ versione: 2 }), "invalida"],
    [qualifica({ valida_fino: "2026-09-14T11:59:59Z" }), "stale"],
    [qualifica({ deployment: "altro" }), "divergente"],
    [qualifica({ max_contributions_per_request: 6 }), "divergente"],
    [qualifica({ max_d1_queries_per_request: 301 }), "divergente"],
  ];
  for (const [valore, stato] of casi) {
    const config = configResearch(ambiente({ RESEARCH_RUNTIME_QUALIFICATION: valore }),
      ADESSO);
    assert.equal(config.enabled, false, stato);
    assert.equal(config.qualification.stato, stato);
    assert.equal(config.motivo, `qualification_${stato}`);
  }
});

test("le chiavi fixture pubbliche valgono solo nell'ambiente di prova locale", () => {
  assert.equal(configResearch(ambiente({ RESEARCH_HMAC_KEYS: CHIAVI_PROVA }),
    ADESSO).motivo, "chiavi_non_valide");
  assert.equal(configResearch(ambiente({ RESEARCH_HMAC_KEYS: CHIAVI_PROVA,
    RESEARCH_AMBIENTE: "prova_locale" }), ADESSO).enabled, true);
  for (const guaste of [undefined, "{}", JSON.stringify({ lineage: { corrente: 1,
    versioni: { 1: "zz" } }, tombstone: { corrente: 1, versioni: {} } })]) {
    assert.equal(configResearch(ambiente({ RESEARCH_HMAC_KEYS: guaste }), ADESSO).motivo,
      "chiavi_non_valide");
  }
});

test("/salute pubblica la stessa configurazione, senza chiavi ne' segreti", () => {
  const config = configResearch(ambiente(), ADESSO);
  const pubblica = saluteResearch(config);
  assert.equal(pubblica.enabled, true);
  assert.equal(pubblica.transport, TRANSPORT_RESEARCH);
  assert.deepEqual(pubblica.models, [...SUPPORTED_RESEARCH_MODELS[TRANSPORT_RESEARCH]]);
  assert.equal(pubblica.max_body_bytes, 262144);
  assert.equal(pubblica.client_payload_upper_bound, 33);
  assert.equal(pubblica.max_contributions_per_request, 5);
  assert.equal(pubblica.max_d1_queries_per_request, 300);
  assert.deepEqual(pubblica.qualification, { stato: "valida", id: "q-prova-1" });
  const testo = JSON.stringify(pubblica);
  assert.ok(!testo.includes("ab".repeat(32)) && !testo.includes("cd".repeat(32)));
  const spenta = saluteResearch(configResearch({}, ADESSO));
  assert.equal(spenta.enabled, false);
  assert.equal(spenta.motivo, "spenta");
  assert.equal(spenta.max_contributions_per_request, null);
});

test("il registro autorizza solo le coppie transport/modello scritte", () => {
  assert.equal(modelloSupportato(4, 1), true);
  for (const modello of [0, 2, 1000, -1, 1.5, "1", true, null]) {
    assert.equal(modelloSupportato(4, modello), false, String(modello));
  }
  assert.equal(modelloSupportato(3, 1), false);
  assert.equal(modelloSupportato(5, 1), false);
  assert.throws(() => { SUPPORTED_RESEARCH_MODELS[4].push(2); });
});
