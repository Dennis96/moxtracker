import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  aggregaMeta, classificaFirma, classificaImpronte, firmaDaCarte,
  somiglianza,
} from "../src/archetipi.js";

const catalogo = {
  versione: 1,
  generato: true,
  formato: "Standard",
  aggiornato: "2026-08-17",
  id_a_nome: {
    "1": "alpha", "2": "beta", "3": "gamma", "4": "delta",
    "5": "epsilon", "9": "plains",
  },
  basi_ids: [9],
  liste: [
    {
      id: "a1", archetipo_id: "archetipo-a", archetipo: "Archetipo A",
      strategia: "midrange", colori: ["U", "B"], modalita: "Bo1",
      firma: { alpha: 4, beta: 4, gamma: 2 },
    },
    {
      id: "a2", archetipo_id: "archetipo-a", archetipo: "Archetipo A",
      strategia: "midrange", colori: ["U", "B"], modalita: "Bo1",
      firma: { alpha: 4, beta: 3, gamma: 3 },
    },
    {
      id: "b1", archetipo_id: "archetipo-b", archetipo: "Archetipo B",
      strategia: "aggro", colori: ["R"], modalita: "Bo1",
      firma: { delta: 5, epsilon: 5 },
    },
  ],
};

test("la firma usa gli ID Arena, esclude le terre base e non ignora carte sconosciute", () => {
  const firma = firmaDaCarte([
    { carta: 1, copie: 4 }, { carta: 2, copie: 4 },
    { carta: 9, copie: 20 }, { carta: 999, copie: 2 },
  ], catalogo);
  assert.deepEqual(firma, { alpha: 4, beta: 4, "#999": 2 });
});

test("la somiglianza replica il criterio conservativo gia usato dal Consigliere", () => {
  assert.equal(somiglianza({ a: 4, b: 4, c: 2 }, { a: 4, b: 4, c: 2 }), 1);
  assert.equal(somiglianza({ a: 4, b: 4, c: 1, x: 1 }, { a: 4, b: 4, c: 2 }), 0.9);
});

test("un mazzo al 90 percento viene classificato ma sotto soglia resta anonimo", () => {
  const novanta = classificaFirma({ alpha: 4, beta: 4, gamma: 1, "#99": 1 }, catalogo);
  assert.equal(novanta?.archetipo_id, "archetipo-a");
  const ottanta = classificaFirma({ alpha: 4, beta: 4, "#99": 2 }, catalogo);
  assert.equal(ottanta, null);
});

test("due varianti dello stesso archetipo non creano una falsa ambiguita", () => {
  const risultato = classificaFirma({ alpha: 4, beta: 4, gamma: 2 }, catalogo,
    { soglia: 0.8, margine: 0.2 });
  assert.equal(risultato?.archetipo_id, "archetipo-a");
});

test("due archetipi diversi troppo vicini vengono lasciati non identificati", () => {
  const ambiguo = {
    ...catalogo,
    liste: [
      { ...catalogo.liste[0], firma: { alpha: 5, beta: 5 } },
      { ...catalogo.liste[2], firma: { alpha: 5, beta: 4, delta: 1 } },
    ],
  };
  const risultato = classificaFirma({ alpha: 5, beta: 5 }, ambiguo,
    { soglia: 0.8, margine: 0.11 });
  assert.equal(risultato, null);
});

test("la classificazione lavora per impronta e usa la lista completa del nostro mazzo", () => {
  const mappa = classificaImpronte([
    { impronta: "aaa", carta: 1, copie: 4 },
    { impronta: "aaa", carta: 2, copie: 4 },
    { impronta: "aaa", carta: 3, copie: 2 },
  ], "Standard", catalogo);
  assert.equal(mappa.get("aaa")?.archetipo_id, "archetipo-a");
});

test("piu impronte dello stesso archetipo vengono aggregate prima delle percentuali", () => {
  const righeMeta = [
    { impronta: "aaa", partite: 20, vittorie: 12 },
    { impronta: "bbb", partite: 15, vittorie: 9 },
  ];
  const carte = [
    { impronta: "aaa", carta: 1, copie: 4 }, { impronta: "aaa", carta: 2, copie: 4 }, { impronta: "aaa", carta: 3, copie: 2 },
    { impronta: "bbb", carta: 1, copie: 4 }, { impronta: "bbb", carta: 2, copie: 3 }, { impronta: "bbb", carta: 3, copie: 3 },
  ];
  const gruppi = aggregaMeta(righeMeta, carte, 35, 30, "Standard", catalogo);
  assert.equal(gruppi.length, 1);
  assert.equal(gruppi[0].archetipo_id, "archetipo-a");
  assert.equal(gruppi[0].partite, 35);
  assert.equal(gruppi[0].vittorie, 21);
  assert.equal(gruppi[0].dati_sufficienti, true);
  assert.equal(gruppi[0].win_rate, 60);
  assert.equal(gruppi[0].quota_meta, 100);
  assert.equal(gruppi[0].impronte_raggruppate, 2);
});
