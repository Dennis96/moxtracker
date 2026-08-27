// Il mazzo che il giocatore ha davvero montato dopo il Draft.
//
// Mox lo manda dal 24/08/2026 dentro la traccia; fino al 25/08 finiva solo
// nell'oggetto R2 e non era interrogabile. Serve a rispondere alla domanda che
// dice davvero se il consiglio era buono: **cosa l'utente cambia del mazzo che
// gli abbiamo proposto**.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import server from "../src/index.js";
import { controllaDraft } from "../src/draft.js";
import { creaFintoD1 } from "./finto-d1.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const SCHEMA = QUI + "../schema.sql";
const SCHEMA_DRAFT = QUI + "../schema-draft.sql";

function esempio(cambia = {}) {
  return {
    versione: 1,
    draft: "a".repeat(32),
    mittente: "b".repeat(32),
    mox: "2.9.19",
    set: "HOB",
    formato: "PremierDraft",
    completo: true,
    segreto_cancellazione: "d".repeat(64),
    pick: [
      { numero: 1, offerte: [101, 102], pool_prima: [], consiglio_mox: 101,
        politica: "policy-test", scelta: 102,
        candidati: [{ carta: 101, rango_mox: 1, campione: 900, vicina: false },
                    { carta: 102, rango_mox: 2, campione: 800, vicina: true }] },
    ],
    pool_finale: [102],
    ...cambia,
  };
}

const DUE_VERSIONI = [
  { quando: "2026-08-25T10:00:00Z", mazzo: [[101, 1], [102, 2]], riserva: [[103, 1]] },
  { quando: "2026-08-25T10:40:00Z", mazzo: [[101, 1], [104, 3]] },
];

function r2Finto() {
  const oggetti = new Map();
  return {
    oggetti,
    async put(chiave, valore) { oggetti.set(chiave, valore); },
    async delete(chiavi) {
      for (const chiave of Array.isArray(chiavi) ? chiavi : [chiavi]) oggetti.delete(chiave);
    },
  };
}

function ambiente() {
  return { DB: creaFintoD1(SCHEMA), DRAFT_DB: creaFintoD1(SCHEMA_DRAFT),
    DRAFT_RAW: r2Finto() };
}

async function manda(env, percorso, corpo) {
  const richiesta = new Request("https://esempio.invalid" + percorso, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const risposta = await server.fetch(richiesta, env);
  return { stato: risposta.status, corpo: await risposta.json() };
}

test("indicizza ogni versione del mazzo montato, in ordine", async () => {
  const env = ambiente();
  assert.equal((await manda(env, "/draft", esempio({ mazzo_giocato: DUE_VERSIONI }))).stato, 200);
  const righe = env.DRAFT_DB.tutte(
    "SELECT versione, quando, carte, distinte, lista, riserva FROM draft_mazzo ORDER BY versione");
  assert.equal(righe.length, 2);
  assert.equal(righe[0].versione, 1);
  assert.equal(righe[0].quando, "2026-08-25T10:00:00Z");
  assert.equal(righe[0].carte, 3);                 // 1 + 2 copie
  assert.equal(righe[0].distinte, 2);
  assert.deepEqual(JSON.parse(righe[0].lista), [[101, 1], [102, 2]]);
  assert.deepEqual(JSON.parse(righe[0].riserva), [[103, 1]]);
  assert.equal(righe[1].versione, 2);
  assert.equal(righe[1].riserva, null);            // la riserva puo' mancare
});

test("un Draft senza mazzo montato resta valido e non scrive niente", async () => {
  // E' il caso di tutte le copie di Mox precedenti alla 2.9.19: devono
  // continuare a essere accettate esattamente come prima.
  const env = ambiente();
  assert.equal(controllaDraft(esempio()), null);
  assert.equal((await manda(env, "/draft", esempio())).stato, 200);
  assert.equal(env.DRAFT_DB.conta("draft_mazzo"), 0);
  assert.equal(env.DRAFT_DB.conta("draft"), 1);
});

test("rifiuta un mazzo montato malformato senza scrivere niente", async () => {
  const casi = {
    "zero copie": [{ mazzo: [[101, 0]] }],
    "carta ripetuta": [{ mazzo: [[101, 1], [101, 2]] }],
    "mazzo vuoto": [{ mazzo: [] }],
    "non e' una coppia": [{ mazzo: [[101]] }],
    "carta non numerica": [{ mazzo: [["101", 1]] }],
    "troppe versioni": Array.from({ length: 31 }, () => ({ mazzo: [[101, 1]] })),
    "riserva sbagliata": [{ mazzo: [[101, 1]], riserva: [[102, 0]] }],
    "non e' un elenco": { mazzo: [[101, 1]] },
  };
  for (const [nome, mazzo_giocato] of Object.entries(casi)) {
    const guaio = controllaDraft(esempio({ mazzo_giocato }));
    assert.ok(guaio, `${nome}: doveva essere rifiutato`);
    const env = ambiente();
    assert.equal((await manda(env, "/draft", esempio({ mazzo_giocato }))).stato, 400, nome);
    assert.equal(env.DRAFT_DB.conta("draft_mazzo"), 0, nome);
    assert.equal(env.DRAFT_RAW.oggetti.size, 0, nome);
  }
});

test("la cancellazione porta via anche il mazzo montato", async () => {
  // Se restasse, «cancelli e sparisce tutto» sarebbe falso: quelle righe sono
  // la lista delle carte di quella persona.
  const env = ambiente();
  await manda(env, "/draft", esempio({ mazzo_giocato: DUE_VERSIONI }));
  assert.equal(env.DRAFT_DB.conta("draft_mazzo"), 2);
  const esito = await manda(env, "/contributi/elimina", {
    mittente: "b".repeat(32), segreto: "d".repeat(64) });
  assert.equal(esito.stato, 200);
  assert.equal(env.DRAFT_DB.conta("draft_mazzo"), 0);
  assert.equal(env.DRAFT_DB.conta("draft"), 0);
  assert.equal(env.DRAFT_RAW.oggetti.size, 0);
});

test("il mazzo montato non fa sforare i limiti di D1 Free", async () => {
  // Trenta versioni sono il tetto: entrano in quattro statement da otto righe.
  const env = ambiente();
  const molte = Array.from({ length: 30 }, (_, n) => ({
    quando: `2026-08-25T10:${String(n).padStart(2, "0")}:00Z`,
    mazzo: [[101, 1], [102 + n, 2]],
  }));
  assert.equal((await manda(env, "/draft", esempio({ mazzo_giocato: molte }))).stato, 200);
  assert.equal(env.DRAFT_DB.conta("draft_mazzo"), 30);
});

test("le statistiche pubbliche non espongono diagnostica del mazzo montato", async () => {
  const env = ambiente();
  await manda(env, "/draft", esempio({ mazzo_giocato: DUE_VERSIONI }));
  const richiesta = new Request("https://esempio.invalid/draft/statistiche");
  const risposta = await server.fetch(richiesta, env);
  const corpo = await risposta.json();
  assert.equal("mazzo_montato" in corpo, false);
  assert.equal(JSON.stringify(corpo).includes("101"), false);
});
