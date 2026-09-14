// I controesempi G5c restano regressioni normative: body e numero di
// contribution entro i cap non autorizzano nessuna di queste forme. Il costo
// esce dal piano reale (descriptor + letture), e il budget si confronta con
// quello: un credito in meno ferma tutto prima delle write, il costo esatto
// passa.
//
// I byte non sono quelli storici del G5c (14.844 / 205.836 / 262.068): quelle
// richieste venivano da un generatore temporaneo. Qui si ricostruiscono le
// stesse forme - N=1 con 141 eventi, N=33 con 500 righe di mazzo, N=33 con in
// piu' 551 eventi - e si pretende soltanto che stiano dentro body e count.

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import server from "../src/index.js";
import { J } from "../src/research/canonico.js";
import { creaFintoD1 } from "./finto-d1.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const GOLDEN = JSON.parse(readFileSync(QUI + "fixtures/research-golden-rev2.json", "utf8"));
const copia = (x) => JSON.parse(JSON.stringify(x));
const CHIAVI = JSON.stringify({
  lineage: { corrente: 7, versioni: {
    7: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f" } },
  tombstone: { corrente: 9, versioni: {
    9: "202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f" } },
});

function ambiente(db, query) {
  return { DB: db, RESEARCH_ENABLED: "true", RESEARCH_AMBIENTE: "prova_locale",
    RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST: "33",
    RESEARCH_MAX_D1_QUERIES_PER_REQUEST: String(query), RESEARCH_DEPLOYMENT: "prova-locale",
    RESEARCH_HMAC_KEYS: CHIAVI,
    RESEARCH_RUNTIME_QUALIFICATION: JSON.stringify({ versione: 1, id: "q",
      deployment: "prova-locale", max_contributions_per_request: 33,
      max_d1_queries_per_request: query, valida_fino: "2099-01-01T00:00:00Z" }) };
}

const esa = (n) => n.toString(16).padStart(64, "0");

function forma(indice, { eventi = 0, righeMazzo = 1 }) {
  const c = copia(GOLDEN.richiesta.partite[0]);
  c.id_pubblico = esa(0x1000 + indice);
  const g = c.games[0];
  for (const k of ["conflicted_event_ids", "incomplete_event_types", "casts", "lands", "draws"]) delete g[k];
  const evento = (i) => ({ event_id: esa(indice * 1000 + i + 1), turno: 1 + (i % 40), card_id: 11 });
  if (eventi) g.draws = Array.from({ length: Math.min(eventi, 200) }, (_, i) => evento(i));
  if (eventi > 200) g.casts = Array.from({ length: eventi - 200 }, (_, i) => evento(200 + i));
  const principali = Math.min(righeMazzo, 250);
  g.deck.main = Object.fromEntries(Array.from({ length: principali }, (_, i) => [String(100000 + i), 1]));
  g.deck.sideboard = Object.fromEntries(Array.from({ length: righeMazzo - principali },
    (_, i) => [String(200000 + i), 1]));
  return c;
}

async function invia(query, partite) {
  const db = creaFintoD1(QUI + "../schema.sql");
  const amb = ambiente(db, query);
  const post = async (percorso, corpo, token) => {
    const headers = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    const r = await server.fetch(new Request(`https://e.invalid${percorso}`,
      { method: "POST", headers, body: JSON.stringify(corpo) }), amb);
    return { stato: r.status, corpo: await r.json() };
  };
  const { mittente, segreto_cancellazione: segreto } = GOLDEN.richiesta;
  const consenso = await post("/research/consenso",
    { mittente, segreto_cancellazione: segreto, versione_consenso: 1 });
  const scritturePrima = db.registro.statement;
  const esito = await post("/research/partite", { ...copia(GOLDEN.richiesta), partite },
    consenso.corpo.generation);
  return { esito, scritture: db.registro.statement - scritturePrima, db };
}

const FORME = {
  "N=1, 141 eventi, 1 riga di mazzo": () => [forma(0, { eventi: 141, righeMazzo: 1 })],
  "N=33, 500 righe di mazzo ciascuna": () => Array.from({ length: 33 }, (_, i) =>
    forma(i, { righeMazzo: 500 })),
  "N=33, 500 righe di mazzo e 551 eventi distribuiti": () => Array.from({ length: 33 }, (_, i) =>
    forma(i, { righeMazzo: 500, eventi: i < 23 ? 17 : 16 })),
};

for (const [nome, crea] of Object.entries(FORME)) {
  test(`${nome}: dentro body e count, fuori budget se il budget e' sotto il piano`, async () => {
    const partite = crea();
    const byte = Buffer.byteLength(J({ ...GOLDEN.richiesta, partite }), "utf8");
    assert.ok(byte <= 262144, `${byte} byte`);
    assert.ok(partite.length <= 33);
    const largo = await invia(1000000, partite);
    assert.equal(largo.esito.stato, 200, JSON.stringify(largo.esito.corpo).slice(0, 300));
    const costo = largo.esito.corpo.diagnostica.charged;
    assert.equal(costo, largo.esito.corpo.diagnostica.letture + largo.scritture,
      "costo = letture + statement consegnati");
    assert.equal(largo.scritture, largo.esito.corpo.diagnostica.statement_pianificati);
    const sotto = await invia(costo - 1, partite);
    assert.equal(sotto.esito.stato, 413);
    assert.equal(sotto.esito.corpo.errore, "budget_d1_superato");
    assert.equal(sotto.scritture, 0);
    assert.equal(sotto.db.conta("research_contribution"), 0);
    const esatto = await invia(costo, partite);
    assert.equal(esatto.esito.stato, 200);
    assert.equal(esatto.esito.corpo.diagnostica.charged, costo);
    assert.ok(esatto.esito.corpo.risultati.every((r) => r.stato === "accepted_new"));
    console.log(`# ${nome}: ${byte} byte, costo del piano ${costo}`);
  });
}
