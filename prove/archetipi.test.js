import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  aggregaMeta, classificaFirma, classificaImpronte, firmaDaCarte,
  nomeCartaArena, somiglianza, somiglianzaCore, stampaCartaArena,
} from "../src/archetipi.js";
import { CATALOGO_ARCHETIPI } from "../src/catalogo-archetipi-generato.js";

const catalogo = {
  versione: 2,
  generato: true,
  formato: "Standard",
  aggiornato: "2026-08-17",
  id_a_nome: {
    "1": "alpha", "2": "beta", "3": "gamma", "4": "delta",
    "5": "epsilon", "6": "zeta", "7": "eta", "8": "theta", "9": "plains",
  },
  basi_ids: [9],
  liste: [
    {
      id: "a1", archetipo_id: "archetipo-a", archetipo: "Archetipo A",
      strategia: "midrange", colori: ["U", "B"], modalita: "Bo1",
      firma: { alpha: 4, beta: 4, gamma: 2, zeta: 4, eta: 4, theta: 4 },
      core: ["alpha", "beta", "gamma", "zeta", "eta", "theta"],
    },
    {
      id: "a2", archetipo_id: "archetipo-a", archetipo: "Archetipo A",
      strategia: "midrange", colori: ["U", "B"], modalita: "Bo3",
      firma: { alpha: 4, beta: 3, gamma: 3, zeta: 4, eta: 3, theta: 3 },
      core: ["alpha", "beta", "gamma", "zeta", "eta", "theta"],
    },
    {
      id: "b1", archetipo_id: "archetipo-b", archetipo: "Archetipo B",
      strategia: "aggro", colori: ["R"], modalita: "Bo1",
      firma: { delta: 5, epsilon: 5, zeta: 2 },
      core: ["delta", "epsilon", "zeta", "x", "y", "w"],
    },
  ],
};

test("il catalogo risolve anche le carte HOB per il fallback immagini", () => {
  assert.equal(nomeCartaArena(103441), "front porch sentries");
  assert.equal(nomeCartaArena(103490), "smaug's fury");
  assert.deepEqual(stampaCartaArena(103441), { set: "hob", numero: "67" });
  assert.deepEqual(stampaCartaArena(103490), { set: "hob", numero: "111" });
});

test("la firma usa gli ID Arena, esclude le terre base e non ignora carte sconosciute", () => {
  const firma = firmaDaCarte([
    { carta: 1, copie: 4 }, { carta: 2, copie: 4 },
    { carta: 9, copie: 20 }, { carta: 999, copie: 2 },
  ], catalogo);
  assert.deepEqual(firma, { alpha: 4, beta: 4, "#999": 2 });
});

test("la somiglianza della lista completa resta conservativa", () => {
  assert.equal(somiglianza({ a: 4, b: 4, c: 2 }, { a: 4, b: 4, c: 2 }), 1);
  assert.equal(somiglianza({ a: 4, b: 4, c: 1, x: 1 }, { a: 4, b: 4, c: 2 }), 0.9);
});

test("il core conta presenza delle carte caratteristiche, non le copie esatte", () => {
  assert.deepEqual(
    somiglianzaCore({ alpha: 1, beta: 4, gamma: 2 }, ["alpha", "beta", "gamma", "zeta"]),
    { punteggio: 0.75, carte: 3, totale: 4 },
  );
});

test("una lista al 90 percento viene riconosciuta come variante", () => {
  const locale = {
    ...catalogo,
    liste: [{
      ...catalogo.liste[0],
      firma: { alpha: 4, beta: 4, gamma: 2 },
      core: ["alpha", "beta", "gamma", "zeta", "eta", "theta"],
    }],
  };
  const novanta = classificaFirma({ alpha: 4, beta: 4, gamma: 1, "#99": 1 }, locale);
  assert.equal(novanta?.archetipo_id, "archetipo-a");
  assert.equal(novanta?.livello_classificazione, "variante");
  assert.equal(novanta?.lista_id, "a1");
});

test("sotto il 90 percento il core puo riconoscere l'archetipo senza inventare la variante", () => {
  const firma = { alpha: 4, beta: 4, gamma: 1, zeta: 3, eta: 4, "#99": 8 };
  const risultato = classificaFirma(firma, catalogo);
  assert.equal(risultato?.archetipo_id, "archetipo-a");
  assert.equal(risultato?.livello_classificazione, "archetipo");
  assert.equal(risultato?.lista_id, null);
  assert.equal(risultato?._core.carte, 5);
});

test("un core con meno di cinque carte caratteristiche resta anonimo", () => {
  const risultato = classificaFirma({ alpha: 4, beta: 4, gamma: 4, zeta: 4, "#99": 20 }, catalogo);
  assert.equal(risultato, null);
});

test("due archetipi con core troppo vicini vengono lasciati non identificati", () => {
  const ambiguo = {
    ...catalogo,
    liste: [
      { ...catalogo.liste[0], core: ["alpha", "beta", "gamma", "zeta", "eta"] },
      { ...catalogo.liste[2], core: ["alpha", "beta", "gamma", "zeta", "epsilon"] },
    ],
  };
  const risultato = classificaFirma(
    { alpha: 1, beta: 1, gamma: 1, zeta: 1, eta: 1, epsilon: 1, "#99": 20 },
    ambiguo,
    { soglia: 0.9, margine: 0.03, core_soglia: 0.6, core_min_carte: 5, core_margine: 0.2 },
  );
  assert.equal(risultato, null);
});

test("il caso Mono White Auras viene riconosciuto dal core anche con molti slot diversi", () => {
  const mono = {
    versione: 2, generato: true, formato: "Standard", aggiornato: "2026-08-17",
    id_a_nome: {}, basi_ids: [],
    liste: [{
      id: "mono-white-ladder", archetipo_id: "aure-mono-bianco",
      archetipo: "Aure aggressive", strategia: "aggro", colori: ["W"], modalita: "Bo1",
      firma: {
        "ethereal armor": 4, "fear of surveillance": 2, "feather of flight": 4,
        "optimistic scavenger": 4, "origin of spider-man": 4, "seam rip": 2,
        "shardmage's rescue": 4, "sheltered by ghosts": 4, "skyward spider": 4,
        "slumbering keepguard": 4, "spellbook vendor": 4,
      },
      core: [
        "ethereal armor", "optimistic scavenger", "sheltered by ghosts",
        "feather of flight", "origin of spider-man", "shardmage's rescue",
        "skyward spider", "spellbook vendor",
      ],
    }],
  };
  const reale = {
    "ethereal armor": 4, "feather of flight": 2, "optimistic scavenger": 4,
    "shardmage's rescue": 1, "sheltered by ghosts": 4, "seam rip": 3,
    "origin of spider-man": 4, "skyward spider": 4,
    "#104893": 3, "#104900": 3, "#104901": 2, "#104918": 3, "#104921": 3,
  };
  const risultato = classificaFirma(reale, mono);
  assert.equal(risultato?.archetipo_id, "aure-mono-bianco");
  assert.equal(risultato?.livello_classificazione, "archetipo");
  assert.equal(risultato?._core.carte, 7);
  assert.equal(risultato?._core.totale, 8);
});

test("la classificazione lavora per impronta e usa la lista completa del nostro mazzo", () => {
  const mappa = classificaImpronte([
    { impronta: "aaa", carta: 1, copie: 4 },
    { impronta: "aaa", carta: 2, copie: 4 },
    { impronta: "aaa", carta: 3, copie: 2 },
    { impronta: "aaa", carta: 6, copie: 4 },
    { impronta: "aaa", carta: 7, copie: 4 },
    { impronta: "aaa", carta: 8, copie: 4 },
  ], "Standard", catalogo);
  assert.equal(mappa.get("aaa")?.archetipo_id, "archetipo-a");
});

test("la lista reale Thor Capstone viene ricondotta al suo archetipo", () => {
  // Decklist anonimizzata dal difetto del 22/08: 60 carte dichiarate nel
  // connectResp di Arena. Non e' una lista di riferimento dell'utente.
  const carte = {
    58449: 18, 69407: 1, 82853: 1, 86958: 4, 86983: 1, 87279: 1,
    93901: 1, 93905: 2, 95516: 1, 96166: 2, 96832: 3, 97426: 3,
    97430: 3, 102574: 1, 102579: 3, 102591: 4, 102793: 1,
    103472: 3, 105019: 2, 105022: 3, 105051: 2,
  };
  const firma = firmaDaCarte(Object.entries(carte).map(([carta, copie]) => ({
    carta: Number(carta), copie,
  })), CATALOGO_ARCHETIPI);
  const risultato = classificaFirma(firma, CATALOGO_ARCHETIPI);
  assert.equal(risultato?.archetipo_id, "thor-capstone");
  assert.equal(risultato?.livello_classificazione, "archetipo");
});

test("piu impronte dello stesso archetipo vengono aggregate come varianti dello stesso meta", () => {
  const righeMeta = [
    { impronta: "aaa", partite: 20, vittorie: 12 },
    { impronta: "bbb", partite: 15, vittorie: 9 },
  ];
  const carte = [
    { impronta: "aaa", carta: 1, copie: 4 }, { impronta: "aaa", carta: 2, copie: 4 }, { impronta: "aaa", carta: 3, copie: 2 },
    { impronta: "aaa", carta: 6, copie: 4 }, { impronta: "aaa", carta: 7, copie: 4 }, { impronta: "aaa", carta: 8, copie: 4 },
    { impronta: "bbb", carta: 1, copie: 4 }, { impronta: "bbb", carta: 2, copie: 3 }, { impronta: "bbb", carta: 3, copie: 3 },
    { impronta: "bbb", carta: 6, copie: 4 }, { impronta: "bbb", carta: 7, copie: 3 }, { impronta: "bbb", carta: 8, copie: 3 },
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
  assert.equal(gruppi[0].varianti_rilevate, 2);
  assert.deepEqual(gruppi[0].carte_core, catalogo.liste[0].core);
});
