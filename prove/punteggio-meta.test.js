import assert from "node:assert/strict";
import test from "node:test";
import { confrontaFormule, limiteWilson } from "../strumenti/analizza_punteggio_meta.mjs";
import { candidatiMetaScore, POLICY_META_SCORE } from "../src/lettura.js";

test("il candidato esclude i campioni sotto soglia e penalizza l'incertezza", () => {
  const risultato = confrontaFormule({ mazzi: [
    { nome: "Grande", partite: 100, vittorie: 55, win_rate: 55, quota_meta: 50,
      dati_sufficienti: true },
    { nome: "Piccolo", partite: 20, vittorie: 16, win_rate: 80, quota_meta: null,
      dati_sufficienti: false },
    { nome: "Medio", partite: 40, vittorie: 22, win_rate: 55, quota_meta: 20,
      dati_sufficienti: true },
  ] });
  assert.deepEqual(risultato.map((r) => r.nome), ["Grande", "Medio"]);
  assert.ok(risultato[0].wilson_95_inferiore > risultato[1].wilson_95_inferiore);
});

test("Wilson resta nell'intervallo e non inventa un valore senza partite", () => {
  assert.equal(limiteWilson(0, 0), null);
  assert.ok(limiteWilson(5, 10) > 0 && limiteWilson(5, 10) < 0.5);
});

test("il motore Meta locale esclude campioni piccoli e conserva i pesi dichiarati", () => {
  const candidati = candidatiMetaScore([
    { archetipo_id: "a", partite: 100, vittorie: 56 },
    { archetipo_id: "b", partite: 20, vittorie: 19 },
    { archetipo_id: "c", partite: 40, vittorie: 24 },
  ]);
  assert.deepEqual(candidati.map(r => r.id), ["a", "c"]);
  assert.equal(POLICY_META_SCORE.peso_qualita, 0.7);
  assert.equal(POLICY_META_SCORE.peso_popolarita, 0.3);
});
