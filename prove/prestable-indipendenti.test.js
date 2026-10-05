// Esiti per singolo Draft, ritenti e aggiornamento del mazzo giocato.
//
// Nate dal pre-Stable del 04/10/2026. P1: un blocco di quattro Draft con un
// guasto al quarto rispondeva 500 per tutta la richiesta, con tre Draft gia'
// salvati; la cancellazione compensativa poteva togliere l'oggetto R2 di un
// Draft gia' indicizzato, o lasciarne uno orfano (D1 41 righe, R2 42 oggetti il
// 02/10). P2: lo stesso Draft rispedito con il mazzo montato era scartato come
// «gia' presente», e nessun Draft 2.11.x aveva il mazzo sul server.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import server from "../src/index.js";
import { riconciliaStorageDraft, collegaPartiteDraft, LIMITI_DRAFT } from "../src/draft.js";
import { creaFintoD1 } from "./finto-d1.js";

const repo = fileURLToPath(new URL("..", import.meta.url));
const QUI = fileURLToPath(new URL(".", import.meta.url));
const SCHEMA = QUI + "../schema.sql";
const SCHEMA_DRAFT = QUI + "../schema-draft.sql";

function esempio(cambia = {}) {
  return {
    versione: 1,
    draft: "a".repeat(32),
    mittente: "b".repeat(32),
    mox: "2 beta 2.11.6",
    set: "FRA",
    formato: "PremierDraft",
    iniziato: "2026-10-02T19:36:42Z",
    finito: "2026-10-02T19:46:52Z",
    completo: true,
    impronta_arena: "c".repeat(64),
    segreto_cancellazione: "d".repeat(64),
    pick: [
      { numero: 1, posizione: [1, 1], offerte: [101, 102], pool_prima: [],
        consiglio_mox: 101, politica: "policy-test", scelta: 102, seguito_mox: false,
        candidati: [
          { carta: 101, rango_mox: 1, campione: 1200, vicina: false },
          { carta: 102, rango_mox: 2, campione: 1100, vicina: true },
        ] },
      { numero: 2, posizione: [3, 2], offerte: [103, 104], pool_prima: [102],
        consiglio_mox: 103, politica: "policy-test", scelta: 103, seguito_mox: true,
        candidati: [{ carta: 103, rango_mox: 1, campione: 900, vicina: false }] },
    ],
    pool_finale: [102, 103],
    ...cambia,
  };
}

const VERSIONE_1 = { quando: "2026-10-02T19:51:25Z", mazzo: [[102, 1], [103, 22], [9001, 17]], riserva: [] };
const VERSIONE_2 = { quando: "2026-10-02T20:30:00Z", mazzo: [[103, 23], [9001, 17]], riserva: [[102, 1]] };

function idDraft(n) {
  return String(n).repeat(32);
}

function r2Finto() {
  const oggetti = new Map();
  const r2 = {
    oggetti,
    guastoPut: false,
    guastiDelete: 0,
    async put(chiave, valore) {
      if (r2.guastoPut) throw new Error("R2 put guasto simulato");
      oggetti.set(chiave, valore);
    },
    async get(chiave) {
      const valore = oggetti.get(chiave);
      if (valore === undefined) return null;
      return { async text() { return valore; } };
    },
    async delete(chiavi) {
      if (r2.guastiDelete > 0) {
        r2.guastiDelete -= 1;
        throw new Error("R2 delete guasto simulato");
      }
      for (const chiave of Array.isArray(chiavi) ? chiavi : [chiavi]) oggetti.delete(chiave);
    },
    async list(opzioni = {}) {
      const tutte = [...oggetti.entries()].sort(([a], [b]) => a.localeCompare(b));
      const inizio = Number(opzioni.cursor || 0);
      const fine = Math.min(tutte.length, inizio + Number(opzioni.limit || 1000));
      return {
        objects: tutte.slice(inizio, fine).map(([key, valore]) => ({
          key, size: new TextEncoder().encode(valore).byteLength,
        })),
        truncated: fine < tutte.length,
        cursor: fine < tutte.length ? String(fine) : undefined,
      };
    },
  };
  return r2;
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

async function coerente(env) {
  const rapporto = await riconciliaStorageDraft(env.DRAFT_DB, env.DRAFT_RAW);
  assert.ok(rapporto.coerente, JSON.stringify(rapporto));
}

function esiti(corpo) {
  return corpo.esiti.map((e) => e.esito);
}

function byteRaw(dato) {
  const pulito = structuredClone(dato);
  delete pulito.segreto_cancellazione;
  return new TextEncoder().encode(JSON.stringify(pulito)).byteLength;
}

test("IND-27 B4: raw valido ma discordante dai fatti D1 non autorizza append", async () => {
  for (const campo of ["scelta", "consiglio", "politica", "campione", "vicina", "fonte"]) {
    const env = ambiente();
    await manda(env, "/draft", esempio());
    const riga = env.DRAFT_DB.tutte("SELECT * FROM draft")[0];
    const originale = env.DRAFT_RAW.oggetti.get(riga.oggetto_r2);
    const raw = JSON.parse(originale);
    if (campo === "scelta") {
      raw.pick[0].scelta = 101;
      raw.pick[1].pool_prima = [101];
      raw.pool_finale = [101, 103];
    }
    if (campo === "consiglio") raw.pick[0].consiglio_mox = 102;
    if (campo === "politica") raw.pick[0].politica = "altra";
    if (campo === "campione") raw.pick[0].candidati[1].campione += 1;
    if (campo === "vicina") raw.pick[0].candidati[1].vicina = false;
    if (campo === "fonte") raw.pick[0].candidati[1].fonte_17lands = "altra";
    env.DRAFT_RAW.oggetti.set(riga.oggetto_r2, JSON.stringify(raw));
    const pickPrima = env.DRAFT_DB.tutte("SELECT * FROM draft_pick ORDER BY numero");
    const richiesta = { ...raw, segreto_cancellazione: esempio().segreto_cancellazione,
      mazzo_giocato: [VERSIONE_1] };
    const risposta = await manda(env, "/draft", richiesta);
    assert.equal(risposta.stato, 503, campo);
    assert.deepEqual(esiti(risposta.corpo), ["temporaneo"], campo);
    assert.deepEqual(env.DRAFT_DB.tutte("SELECT * FROM draft_pick ORDER BY numero"), pickPrima);
    assert.equal(env.DRAFT_DB.conta("draft_mazzo"), 0);
    assert.equal(env.DRAFT_RAW.oggetti.size, 1);
    assert.equal(env.DRAFT_DB.tutte("SELECT oggetto_r2 FROM draft")[0].oggetto_r2, riga.oggetto_r2);
    // Recovery separata simulata: ripristinare il raw originale consente
    // il retry normale, senza inventare o riscrivere la storia dei pick.
    env.DRAFT_RAW.oggetti.set(riga.oggetto_r2, originale);
    assert.deepEqual(esiti((await manda(env, "/draft", esempio({mazzo_giocato:[VERSIONE_1]}))).corpo), ["aggiornato"]);
    await coerente(env);
  }
});

test("IND-28 B4: fatti pick D1 incompleti restano temporanei e non vengono ricostruiti", async () => {
  const env = ambiente();
  await manda(env, "/draft", esempio());
  env.DRAFT_DB.prepare("DELETE FROM draft_pick WHERE numero=1").run();
  const prima = env.DRAFT_DB.tutte("SELECT * FROM draft_pick");
  const r = await manda(env, "/draft", esempio({mazzo_giocato:[VERSIONE_1]}));
  assert.equal(r.stato, 503);
  assert.deepEqual(esiti(r.corpo), ["temporaneo"]);
  assert.deepEqual(env.DRAFT_DB.tutte("SELECT * FROM draft_pick"), prima);
  assert.equal(env.DRAFT_DB.conta("draft_mazzo"), 0);
});

// Oracolo dei sorgenti Git: "insieme" e' il Worker precedente al deploy
// 8f8327f; "abbinate" serve solo a costruire righe della variante NON deployata.
const FASI = ["apertura", "direzione", "struttura", "chiusura"];

function righePickStoriche(dato, convenzione) {
  const righe = [];
  for (const voce of dato.pick) {
    const scelte = voce.scelte ?? [voce.scelta];
    const consigli = voce.consigli_mox ?? [voce.consiglio_mox];
    const liberi = [...consigli];
    const abbinate = scelte.map((scelta) => {
      const posto = liberi.indexOf(scelta);
      if (posto < 0) return { seguito: false, consiglio: null };
      liberi.splice(posto, 1);
      return { seguito: true, consiglio: scelta };
    });
    for (const voceAbbinata of abbinate) {
      if (!voceAbbinata.seguito) voceAbbinata.consiglio = liberi.shift() ?? consigli[0];
    }
    scelte.forEach((scelta, indice) => {
      const { seguito, consiglio } = convenzione === "insieme"
        ? { seguito: consigli.includes(scelta),
          consiglio: consigli.includes(scelta) ? scelta : (consigli[indice] ?? consigli[0]) }
        : abbinate[indice];
      const numero = voce.pool_prima.length + indice + 1;
      const candidato = voce.candidati.find((c) => c.carta === scelta);
      righe.push([dato.draft, numero, FASI[Math.min(3, [4, 17, 27].filter((n) => numero > n).length)], consiglio, scelta, seguito ? 1 : 0,
        voce.candidati.some((c) => c.carta === scelta && c.vicina) ? 1 : 0,
        Number(candidato?.campione || 0), candidato?.fonte_17lands ?? null, voce.politica]);
    });
  }
  return righe;
}

function riscriviPick(env, dato, convenzione) {
  env.DRAFT_DB.prepare("DELETE FROM draft_pick WHERE draft_id = ?").bind(dato.draft).run();
  for (const riga of righePickStoriche(dato, convenzione)) {
    env.DRAFT_DB.prepare("INSERT INTO draft_pick VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(...riga).run();
  }
}

// Prendi Due: la prima scelta non segue il consiglio, la seconda segue il
// primo. Il Worker di agosto scriveva consiglio 201 sulla prima riga,
// quello di oggi 202.
function prendiDueStorico(cambia = {}) {
  return esempio({ draft: "e".repeat(32), formato: "PickTwoDraft", completo: false,
    impronta_arena: "f".repeat(64),
    pick: [{ numero: 1, offerte: [201, 202, 203], pool_prima: [], consiglio_mox: 201,
      consigli_mox: [201, 202], politica: "policy-test", scelte: [203, 201], candidati: [
        { carta: 201, rango_mox: 1, campione: 50, vicina: false },
        { carta: 202, rango_mox: 2, campione: 40, vicina: false },
        { carta: 203, rango_mox: 3, campione: 30, vicina: true }] }],
    pool_finale: [203, 201], ...cambia });
}

// Due copie valide solo dal deploy 8f8327f. Riscriverne i fatti con una
// convenzione precedente costruisce un indice che nessun Worker deployato
// avrebbe prodotto: il vecchio validatore rifiutava gia' le offerte.
function copiaDoppiaStorica(cambia = {}) {
  return esempio({ draft: "9".repeat(32), completo: false, impronta_arena: "8".repeat(64),
    pick: [{ numero: 1, offerte: [101, 101, 102], pool_prima: [], consiglio_mox: 101,
      politica: "policy-test", scelta: 101, candidati: [
        { carta: 101, rango_mox: 1, campione: 1200, vicina: false },
        { carta: 101, rango_mox: 2, campione: 1200, vicina: true },
        { carta: 102, rango_mox: 3, campione: 1100, vicina: false }] }],
    pool_finale: [101], ...cambia });
}

test("IND-29 B4: Draft indicizzati dai Worker prima del 30/09 si aggiornano ancora", async () => {
  for (const fabbrica of [prendiDueStorico]) {
    for (const convenzione of ["insieme"]) {
      const caso = `${fabbrica.name}/${convenzione}`;
      const env = ambiente();
      assert.deepEqual(esiti((await manda(env, "/draft", fabbrica())).corpo), ["nuovo"], caso);
      riscriviPick(env, fabbrica(), convenzione);
      const pickPrima = env.DRAFT_DB.tutte("SELECT * FROM draft_pick ORDER BY numero");
      const r = await manda(env, "/draft", fabbrica({ mazzo_giocato: [VERSIONE_1] }));
      assert.equal(r.stato, 200, caso);
      assert.deepEqual(esiti(r.corpo), ["aggiornato"], caso);
      assert.deepEqual(env.DRAFT_DB.tutte("SELECT * FROM draft_pick ORDER BY numero"), pickPrima, caso);
      assert.equal(env.DRAFT_DB.conta("draft_mazzo"), 1, caso);
      await coerente(env);
    }
  }
});


function fotografia(env) {
  return { draft: env.DRAFT_DB.tutte("SELECT * FROM draft ORDER BY id"),
    pick: env.DRAFT_DB.tutte("SELECT * FROM draft_pick ORDER BY draft_id, numero"),
    mazzi: env.DRAFT_DB.tutte("SELECT * FROM draft_mazzo ORDER BY draft_id, versione"),
    raw: [...env.DRAFT_RAW.oggetti], batch: env.DRAFT_DB.registro.batch.length };
}

test("IND-31 B4: copie con fatti di una convenzione mai deployata restano temporanee", async () => {
  for (const convenzione of ["insieme", "abbinate"]) {
    const env = ambiente();
    const dato = copiaDoppiaStorica();
    await manda(env, "/draft", dato);
    riscriviPick(env, dato, convenzione);
    const prima = fotografia(env);
    const r = await manda(env, "/draft", { ...dato, mazzo_giocato: [VERSIONE_1] });
    assert.equal(r.stato, 503, convenzione);
    assert.deepEqual(esiti(r.corpo), ["temporaneo"]);
    assert.deepEqual(fotografia(env), prima);
  }
});

test("IND-32 B4: spostare vicina o rango fra copie non passa un fallback storico", async () => {
  for (const campo of ["vicina", "rango", "entrambi"]) {
    const env = ambiente();
    const dato = copiaDoppiaStorica();
    dato.pick[0].candidati[0].vicina = true;
    dato.pick[0].candidati[1].vicina = false;
    await manda(env, "/draft", dato);
    const riga = env.DRAFT_DB.tutte("SELECT * FROM draft")[0];
    const raw = JSON.parse(env.DRAFT_RAW.oggetti.get(riga.oggetto_r2));
    if (campo === "vicina") {
      raw.pick[0].candidati[0].vicina = false;
      raw.pick[0].candidati[1].vicina = true;
    } else {
      raw.pick[0].candidati[0].rango_mox = 2;
      raw.pick[0].candidati[1].rango_mox = 1;
      if (campo === "entrambi") raw.pick[0].candidati[0].vicina = false;
    }
    env.DRAFT_RAW.oggetti.set(riga.oggetto_r2, JSON.stringify(raw));
    const prima = fotografia(env);
    const r = await manda(env, "/draft", { ...raw,
      segreto_cancellazione: dato.segreto_cancellazione, mazzo_giocato: [VERSIONE_1] });
    assert.equal(r.stato, 503, campo);
    assert.deepEqual(esiti(r.corpo), ["temporaneo"]);
    assert.deepEqual(fotografia(env), prima);
  }
});

test("IND-33 M1: copie nuove mantengono fatti, retry, ordine candidati e secondo mazzo", async () => {
  const env = ambiente();
  const dato = copiaDoppiaStorica();
  assert.deepEqual(esiti((await manda(env, "/draft", dato)).corpo), ["nuovo"]);
  const prima = env.DRAFT_DB.tutte("SELECT * FROM draft_pick ORDER BY numero");
  assert.equal(prima[0].vicina, 0);
  assert.deepEqual(esiti((await manda(env, "/draft", { ...dato, mazzo_giocato: [VERSIONE_1] })).corpo), ["aggiornato"]);
  assert.deepEqual(esiti((await manda(env, "/draft", { ...dato, mazzo_giocato: [VERSIONE_1] })).corpo), ["gia"]);
  const riordinato = structuredClone(dato);
  riordinato.pick[0].candidati.reverse();
  assert.deepEqual(esiti((await manda(env, "/draft", { ...riordinato, mazzo_giocato: [VERSIONE_1, VERSIONE_2] })).corpo), ["aggiornato"]);
  assert.equal(env.DRAFT_DB.conta("draft_mazzo"), 2);
  assert.deepEqual(env.DRAFT_DB.tutte("SELECT * FROM draft_pick ORDER BY numero"), prima);
  await coerente(env);
});

test("IND-30 B4: una convenzione storica non copre un raw diverso dai pick", async () => {
  const env = ambiente();
  await manda(env, "/draft", prendiDueStorico());
  riscriviPick(env, prendiDueStorico(), "insieme");
  const riga = env.DRAFT_DB.tutte("SELECT * FROM draft")[0];
  const raw = JSON.parse(env.DRAFT_RAW.oggetti.get(riga.oggetto_r2));
  raw.pick[0].candidati[2].campione = 31;
  env.DRAFT_RAW.oggetti.set(riga.oggetto_r2, JSON.stringify(raw));
  const pickPrima = env.DRAFT_DB.tutte("SELECT * FROM draft_pick ORDER BY numero");
  const r = await manda(env, "/draft", { ...raw, segreto_cancellazione: esempio().segreto_cancellazione,
    mazzo_giocato: [VERSIONE_1] });
  assert.equal(r.stato, 503);
  assert.deepEqual(esiti(r.corpo), ["temporaneo"]);
  assert.deepEqual(env.DRAFT_DB.tutte("SELECT * FROM draft_pick ORDER BY numero"), pickPrima);
  assert.equal(env.DRAFT_DB.conta("draft_mazzo"), 0);
  assert.equal(env.DRAFT_DB.tutte("SELECT oggetto_r2 FROM draft")[0].oggetto_r2, riga.oggetto_r2);
});

test("IND-26 blocco massimo: quattro Draft, 45 pick, 30 mazzi entro il budget dei binding", async (t) => {
  const env = ambiente();
  const pick = Array.from({ length: 45 }, (_, i) => ({
    numero: i + 1, posizione: [Math.floor(i / 15) + 1, i % 15 + 1],
    offerte: [101], pool_prima: Array(i).fill(101), consiglio_mox: 101,
    politica: "policy-test", scelta: 101, seguito_mox: true,
    candidati: [{ carta: 101, rango_mox: 1, campione: 1200, vicina: false }],
  }));
  const draft = [1, 2, 3, 4].map((n) => esempio({ draft: idDraft(n), pick,
    pool_finale: Array(45).fill(101),
    mazzo_giocato: Array.from({ length: 30 }, () => structuredClone(VERSIONE_1)),
  }));
  const risposta = await manda(env, "/draft", { draft });
  assert.equal(risposta.stato, 200, JSON.stringify(risposta.corpo));
  assert.deepEqual(esiti(risposta.corpo), Array(4).fill("nuovo"));
  // Il binding D1 invia l'intero batch con una chiamata, non una per SQL.
  const chiamate = env.DRAFT_DB.registro.letture + env.DRAFT_DB.registro.batch.length;
  t.diagnostic(`D1: ${chiamate} chiamate, ${env.DRAFT_DB.registro.statement} statement nel batch; R2 put: ${env.DRAFT_RAW.oggetti.size}`);
  assert.ok(chiamate + env.DRAFT_RAW.oggetti.size <= 50);
  assert.equal(env.DRAFT_DB.conta("draft_pick"), 180);
  assert.equal(env.DRAFT_DB.conta("draft_mazzo"), 120);
  await coerente(env);
});

test("IND-24 quota byte: append prima del nuovo Draft non supera il tetto del blocco", async () => {
  const env = ambiente();
  const prima = esempio();
  await manda(env, "/draft", prima);
  const append = esempio({ mazzo_giocato: [VERSIONE_1] });
  const nuovo = esempio({ draft: idDraft(2) });
  const limite = LIMITI_DRAFT.byteConservati;
  LIMITI_DRAFT.byteConservati = byteRaw(append) + byteRaw(nuovo) - 1;
  try {
    const risposta = await manda(env, "/draft", { draft: [append, nuovo] });
    assert.equal(risposta.stato, 503);
    assert.deepEqual(esiti(risposta.corpo), ["aggiornato", "temporaneo"]);
    assert.ok(env.DRAFT_DB.tutte("SELECT SUM(byte) AS n FROM draft")[0].n <= LIMITI_DRAFT.byteConservati);
    await coerente(env);
  } finally {
    LIMITI_DRAFT.byteConservati = limite;
  }
});

test("IND-25 quota byte: ID duplicato con prima voce piu' grande non sottostima la scrittura", async () => {
  const env = ambiente();
  const piccolo = esempio();
  const grande = esempio({ mazzo_giocato: [VERSIONE_1] });
  const limite = LIMITI_DRAFT.byteConservati;
  LIMITI_DRAFT.byteConservati = byteRaw(grande) - 1;
  try {
    const risposta = await manda(env, "/draft", { draft: [grande, piccolo] });
    assert.equal(risposta.stato, 503);
    assert.deepEqual(esiti(risposta.corpo), ["temporaneo", "nuovo"]);
    assert.ok(env.DRAFT_DB.tutte("SELECT SUM(byte) AS n FROM draft")[0].n <= LIMITI_DRAFT.byteConservati);
    await coerente(env);
  } finally {
    LIMITI_DRAFT.byteConservati = limite;
  }
});

test("IND-23 collisioni compatibili con il limite D1 di 50 byte nei pattern LIKE", async () => {
  const env = ambiente();
  const prepara = env.DRAFT_DB.prepare;
  env.DRAFT_DB.prepare = (sql) => {
    const originale = prepara(sql);
    return { ...originale, bind(...argomenti) {
      if (/\bLIKE\s+\?/i.test(sql) && argomenti.some((a) =>
          typeof a === "string" && new TextEncoder().encode(a).byteLength > 50)) {
        throw new Error("D1: pattern LIKE oltre 50 byte");
      }
      assert.ok(argomenti.length <= 100);
      return originale.bind(...argomenti);
    } };
  };
  for (const n of [1, 2, 3]) {
    assert.equal((await manda(env, "/draft", esempio({ draft: idDraft(n) }))).stato, 200);
  }
  await collegaPartiteDraft(env.DRAFT_DB, [{ versione: 2, draft: "c".repeat(64),
    partita: "e".repeat(32), andamento: { esito: "vinta" } }]);
  assert.equal(env.DRAFT_DB.conta("draft_link"), 0);
  await coerente(env);
});

async function silenzia(lavoro) {
  const errore = console.error;
  const avviso = console.warn;
  const registro = console.log;
  const righe = [];
  console.error = (...argomenti) => righe.push(argomenti.join(" "));
  console.warn = (...argomenti) => righe.push(argomenti.join(" "));
  console.log = (...argomenti) => righe.push(argomenti.join(" "));
  try {
    return { esito: await lavoro(), righe };
  } finally {
    console.error = errore;
    console.warn = avviso;
    console.log = registro;
  }
}


test("IND-01 impronta riusata: partita di B deve rimanere senza link", async () => {
  const env = ambiente();
  await manda(env, "/draft", esempio({draft:idDraft(1)}));
  await manda(env, "/draft", esempio({draft:idDraft(2), iniziato:"2026-10-03T10:00:00Z"}));
  await collegaPartiteDraft(env.DRAFT_DB, [{versione:2, draft:"c".repeat(64), partita:"e".repeat(32), andamento:{esito:"vinta"}}]);
  const links = env.DRAFT_DB.tutte("SELECT * FROM draft_link");
  assert.deepEqual(links, [], "link falso: " + JSON.stringify(links));
});

test("IND-02 quota al limite: retry identico resta idempotente", async () => {
  const env = ambiente();
  const d = esempio();
  await manda(env, "/draft", d);
  await env.DRAFT_DB.batch(Array.from({length:29}, (_,i) => env.DRAFT_DB.prepare(`INSERT INTO draft
    (id,mittente,ricevuto,set_code,formato,completo,pick,politica,oggetto_r2,byte,versione)
    VALUES (?, ?, ?, 'FRA','PremierDraft',1,2,'p',?,1,1)`).bind(i.toString(16).padStart(32,'0'),d.mittente,new Date().toISOString(),`finto/${i}.json`)));
  const retry = await manda(env, "/draft", d);
  assert.equal(retry.stato,200, JSON.stringify(retry));
  assert.equal(esiti(retry.corpo)[0],"gia");
});

test("IND-03 D1 fallito: un concorrente committa dopo rilettura e prima del delete", async () => {
  const env = ambiente();
  env.DRAFT_DB.guasti.statement=0;
  const del = env.DRAFT_RAW.delete.bind(env.DRAFT_RAW);
  let once = true;
  env.DRAFT_RAW.delete = async (key) => {
    if (once) {
      once=false;
      const b = await manda(env,"/draft",esempio());
      assert.equal(b.stato,200);
    }
    return del(key);
  };
  await manda(env,"/draft",esempio());
  await coerente(env);
});

test("IND-04 raw mancante: nessun successo definitivo o UPDATE non verificabile", async () => {
  const env = ambiente();
  await manda(env,"/draft",esempio());
  env.DRAFT_RAW.oggetti.clear();
  const prima=env.DRAFT_DB.tutte("SELECT * FROM draft");
  const r=await manda(env,"/draft",esempio());
  assert.equal(r.stato,503);assert.deepEqual(esiti(r.corpo),["temporaneo"]);
  assert.deepEqual(env.DRAFT_DB.tutte("SELECT * FROM draft"),prima);
  assert.equal(env.DRAFT_RAW.oggetti.size,0);
});

test("IND-17 collisione invalida link precedenti, tutti i raw conservano l'impronta",async()=>{
  const env=ambiente();const match={versione:2,draft:"c".repeat(64),partita:"e".repeat(32),andamento:{esito:"persa"}};
  await manda(env,"/draft",esempio({draft:idDraft(1)}));
  await collegaPartiteDraft(env.DRAFT_DB,[match]);assert.equal(env.DRAFT_DB.conta("draft_link"),1);
  for(const n of [2,3]) assert.equal((await manda(env,"/draft",esempio({draft:idDraft(n)}))).stato,200);
  await collegaPartiteDraft(env.DRAFT_DB,[match]);assert.equal(env.DRAFT_DB.conta("draft_link"),0);
  assert.ok([...env.DRAFT_RAW.oggetti.values()].every(v=>JSON.parse(v).impronta_arena===match.draft));
  await coerente(env);
});

test("IND-18 collisione concorrente alla creazione del link rimane fail-closed",async()=>{
  const env=ambiente();await manda(env,"/draft",esempio({draft:idDraft(1)}));
  env.DRAFT_DB.primaDelBatch=async()=>{await manda(env,"/draft",esempio({draft:idDraft(2)}));};
  await collegaPartiteDraft(env.DRAFT_DB,[{versione:2,draft:"c".repeat(64),partita:"e".repeat(32),andamento:{esito:"vinta"}}]);
  assert.equal(env.DRAFT_DB.conta("draft_link"),0);await coerente(env);
});

test("IND-19 riparazione D1 in gara con append: CAS preserva due versioni vive",async()=>{
  const env=ambiente();await manda(env,"/draft",esempio({mazzo_giocato:[VERSIONE_1]}));
  await env.DRAFT_DB.prepare("DELETE FROM draft_mazzo").run();
  env.DRAFT_DB.primaDelBatch=async()=>{
    assert.equal((await manda(env,"/draft",esempio({mazzo_giocato:[VERSIONE_1,VERSIONE_2]}))).stato,200);
  };
  const result=await manda(env,"/draft",esempio({mazzo_giocato:[VERSIONE_1]}));
  assert.ok(["gia","aggiornato","temporaneo"].includes(esiti(result.corpo)[0]));
  await coerente(env);
  assert.equal(env.DRAFT_DB.conta("draft_mazzo"),2);
  const row=env.DRAFT_DB.tutte("SELECT oggetto_r2 FROM draft")[0];
  assert.equal(JSON.parse(env.DRAFT_RAW.oggetti.get(row.oggetto_r2)).mazzo_giocato.length,2);
});

test("IND-20 D1 avanti al raw non viene cancellato come riparazione",async()=>{
  const env=ambiente();await manda(env,"/draft",esempio({mazzo_giocato:[VERSIONE_1]}));
  await env.DRAFT_DB.prepare(`INSERT INTO draft_mazzo
    (draft_id,versione,quando,carte,distinte,lista,riserva) VALUES (?,2,?,40,2,?,?)`)
    .bind(esempio().draft,VERSIONE_2.quando,JSON.stringify(VERSIONE_2.mazzo),JSON.stringify(VERSIONE_2.riserva)).run();
  const result=await manda(env,"/draft",esempio({mazzo_giocato:[VERSIONE_1,VERSIONE_2]}));
  assert.equal(result.stato,503);assert.equal(esiti(result.corpo)[0],"temporaneo");
  assert.equal(env.DRAFT_DB.conta("draft_mazzo"),2);
});

test("IND-21 quota dopo successo parziale: retry legacy e append P2 al limite",async()=>{
  const env=ambiente();const d=esempio();
  await env.DRAFT_DB.batch(Array.from({length:26},(_,i)=>env.DRAFT_DB.prepare(`INSERT INTO draft
    (id,mittente,ricevuto,set_code,formato,completo,pick,politica,oggetto_r2,byte,versione)
    VALUES (?, ?, ?, 'FRA','PremierDraft',1,2,'p',?,1,1)`).bind(i.toString(16).padStart(32,'0'),d.mittente,new Date().toISOString(),`finto/${i}.json`)));
  const block=["7","8","9","a"].map(n=>esempio({draft:n.repeat(32),impronta_arena:n.repeat(64)}));
  env.DRAFT_DB.guasti.saltaBatch=3;env.DRAFT_DB.guasti.statement=0;
  const first=await manda(env,"/draft",{draft:block});assert.equal(first.stato,503);
  const retry=await manda(env,"/draft",{draft:block});assert.equal(retry.stato,200);
  assert.deepEqual(esiti(retry.corpo),["gia","gia","gia","nuovo"]);
  assert.equal((await manda(env,"/draft",{...block[0],mazzo_giocato:[VERSIONE_1]})).stato,200);
  assert.equal((await manda(env,"/draft",esempio({draft:"b".repeat(32),impronta_arena:"b".repeat(64)}))).stato,429);
});

test("IND-22 trenta versioni: indici continui e nessuno statement sopra 100 parametri",async()=>{
  const env=ambiente();await manda(env,"/draft",esempio());
  const versions=Array.from({length:30},(_,i)=>({...VERSIONE_1,quando:String(i)}));
  const batch=env.DRAFT_DB.batch.bind(env.DRAFT_DB);
  env.DRAFT_DB.batch=async(commands)=>{assert.ok(commands.every(c=>c.argomenti.length<=100));return batch(commands);};
  const result=await manda(env,"/draft",esempio({mazzo_giocato:versions}));assert.equal(result.stato,200);
  assert.deepEqual(env.DRAFT_DB.tutte("SELECT versione FROM draft_mazzo ORDER BY versione").map(v=>v.versione),Array.from({length:30},(_,i)=>i+1));
  await coerente(env);
});

test("IND-05 R2 assente: un contenuto immutabile differente non puo' riparare", async () => {
  const env = ambiente();
  await manda(env,"/draft",esempio());
  env.DRAFT_RAW.oggetti.clear();
  const changed=esempio({mazzo_giocato:[VERSIONE_1]});
  changed.pick[1].scelta=104; changed.pick[1].seguito_mox=false; changed.pool_finale=[102,104];
  const result=await manda(env,"/draft",changed);
  assert.notEqual(esiti(result.corpo)[0],"aggiornato","storia diversa resa viva sopra draft_pick originale");
});

test("IND-06 draft_mazzo incompleto: retry identico ripara versioni mancanti", async () => {
  const env=ambiente();
  const d=esempio({mazzo_giocato:[VERSIONE_1,VERSIONE_2]});
  await manda(env,"/draft",d);
  await env.DRAFT_DB.prepare("DELETE FROM draft_mazzo WHERE versione=1").run();
  const result=await manda(env,"/draft",d);
  assert.notEqual(esiti(result.corpo)[0],"gia");
  const rows=env.DRAFT_DB.tutte("SELECT versione FROM draft_mazzo ORDER BY versione");
  assert.deepEqual(rows.map(r=>r.versione),[1,2], JSON.stringify(result));
});

test("IND-07 P2 update concorrenti identici e differenti preservano il vincitore", async () => {
  for (const different of [false,true]) {
    const env=ambiente(); await manda(env,"/draft",esempio());
    const first=esempio({mazzo_giocato:[VERSIONE_1]});
    const winner=esempio({mazzo_giocato:[different ? VERSIONE_2:VERSIONE_1]});
    env.DRAFT_DB.primaDelBatch=async()=>{assert.equal((await manda(env,"/draft",winner)).stato,200);};
    const result=await manda(env,"/draft",first);
    assert.ok(different ? esiti(result.corpo)[0]==="rifiutato" : ["gia","aggiornato"].includes(esiti(result.corpo)[0]));
    await coerente(env);
    assert.equal(env.DRAFT_DB.conta("draft_mazzo"),1);
  }
});

test("IND-11 P3 v1/v2: 250 carte bounded, 251 rifiutate, mano avversaria vietata", async () => {
  const {controlla}=await import(pathToFileURL(repo+"/src/controlli.js"));
  const base={versione:1,partita:"d8e352c369",mittente:"0".repeat(32),evento:"Ladder",formato:"Standard",
    mazzo:{impronta:"a".repeat(64),carte:{101:60}},avversario:{carte:[201]},
    andamento:{esito:"vinta",mulligan:0},mox:"prova"};
  for(const versione of [1,2]) {
    const p={...base,versione,segreto_cancellazione:"d".repeat(64),apertura:{101:250}};
    assert.equal(controlla(p),null);
    assert.match(controlla({...p,apertura:{101:251}}),/apertura/);
    assert.match(controlla({...p,avversario:{carte:[201],mano:[201]}}),/avversario/);
  }
});

test("IND-12 A121 ranghi distinti, copie fisiche e ordine: vicina invariata", async () => {
  const {controllaDraft}=await import(pathToFileURL(repo+"/src/draft.js"));
  const values=[];
  for(const reverse of [false,true]) {
    const env=ambiente();const d=esempio({completo:false});
    d.pick=[{numero:1,offerte:[101,101,102],pool_prima:[],scelta:101,consiglio_mox:101,
      seguito_mox:true,politica:"p",candidati:[{carta:101,rango_mox:1,campione:1200,vicina:false},
      {carta:101,rango_mox:2,campione:1200,vicina:true}]}];d.pool_finale=[101];
    if(reverse) d.pick[0].candidati.reverse();
    assert.equal(controllaDraft(d),null);await manda(env,"/draft",d);
    values.push(env.DRAFT_DB.tutte("SELECT vicina FROM draft_pick")[0].vicina);
    d.pick[0].candidati[1].rango_mox=d.pick[0].candidati[0].rango_mox;
    assert.equal(controllaDraft(d),"rango Mox duplicato");
  }
  assert.deepEqual(values,[0,0]);
});

test("IND-13 P5 waitUntil e fallimenti multipli ancora osservabili", async () => {
  let waited;
  await server.scheduled({}, {}, {waitUntil(p){waited=p;}});
  assert.ok(waited instanceof Promise);
  await assert.rejects(waited, e=>e instanceof AggregateError && e.message.includes("retention_contributi, brew") && e.errors.length>=4);
});

test("IND-14 P2 oggetto legacy, update al cambio mese, retry stale", async () => {
  const env=ambiente();await manda(env,"/draft",esempio());
  const old=env.DRAFT_DB.tutte("SELECT oggetto_r2 FROM draft")[0].oggetto_r2;
  const legacy="2026-09/"+esempio().draft+".json";
  env.DRAFT_RAW.oggetti.set(legacy,env.DRAFT_RAW.oggetti.get(old));env.DRAFT_RAW.oggetti.delete(old);
  await env.DRAFT_DB.prepare("UPDATE draft SET oggetto_r2=?").bind(legacy).run();
  assert.equal((await manda(env,"/draft",esempio())).corpo.esiti[0].esito,"gia");
  assert.equal((await manda(env,"/draft",esempio({mazzo_giocato:[VERSIONE_1]}))).corpo.esiti[0].esito,"aggiornato");
  assert.ok(!env.DRAFT_RAW.oggetti.has(legacy));await coerente(env);
  assert.equal((await manda(env,"/draft",esempio())).corpo.esiti[0].esito,"gia");
});

test("IND-15 backfill amministrativo deve accettare le chiavi R2 nuove", async()=>{
  const {readFileSync}=await import("node:fs");
  const {runInNewContext}=await import("node:vm");
  const source=readFileSync(repo+"/strumenti/ricalcola_sospetti_draft.mjs","utf8");
  const func=source.slice(source.indexOf("function leggiTraccia("),source.indexOf("function preparaAggiornamenti("));
  const get=runInNewContext(func+"\nleggiTraccia",{wrangler:()=>'{"draft":"sintetico"}',BUCKET:"finto"});
  assert.equal(get("2026-10/"+"a".repeat(32)+"-"+"b".repeat(16)+".json").draft,"sintetico");
  assert.equal(get("2026-09/"+"a".repeat(32)+".json").draft,"sintetico");
});

test("IND-16 P1 misto: rifiuto semantico, R2 put fallito e successi nello stesso ordine",async()=>{
  const env=ambiente();const put=env.DRAFT_RAW.put.bind(env.DRAFT_RAW);
  env.DRAFT_RAW.put=async(k,v)=>{if(JSON.parse(v).draft===idDraft(2))throw Error("put item 2");return put(k,v);};
  const batch=[1,2,3,4].map(n=>esempio({draft:idDraft(n),impronta_arena:String(n).repeat(64)}));
  batch[2].set="x";
  const r=await manda(env,"/draft",{draft:batch});
  assert.equal(r.stato,503);assert.deepEqual(esiti(r.corpo),["nuovo","temporaneo","rifiutato","nuovo"]);
  assert.deepEqual(r.corpo.esiti.map(v=>v.indice),[0,1,2,3]);
  assert.deepEqual(r.corpo.esiti.map(v=>v.draft),batch.map(v=>v.draft));
  assert.equal(r.corpo.accettati,2);assert.equal(r.corpo.rifiutati.length,1);
  assert.deepEqual(r.corpo.da_ritentare,[idDraft(2)]);
  env.DRAFT_RAW.put=put;
  assert.equal((await manda(env,"/draft",batch[1])).stato,200);await coerente(env);
});

test("IND-08 R2 cleanup fallito dopo update: orfano osservabile, oggetto vivo salvo", async () => {
  const env=ambiente(); await manda(env,"/draft",esempio()); env.DRAFT_RAW.guastiDelete=2;
  const result=await manda(env,"/draft",esempio({mazzo_giocato:[VERSIONE_1]}));
  assert.equal(esiti(result.corpo)[0],"aggiornato");
  const report=await riconciliaStorageDraft(env.DRAFT_DB,env.DRAFT_RAW);
  assert.equal(report.senza_oggetto.length,0); assert.equal(report.orfani_r2.length,1);
});

test("IND-09 storia dei consigli non deve divergere fra D1 e raw dopo update", async () => {
  const env=ambiente(); await manda(env,"/draft",esempio());
  const changed=esempio({mazzo_giocato:[VERSIONE_1]});
  changed.pick[0].politica="altra-policy";
  changed.pick[0].consiglio_mox=102; changed.pick[0].seguito_mox=true;
  const result=await manda(env,"/draft",changed);
  assert.equal(esiti(result.corpo)[0],"rifiutato", "consiglio raw cambia ma draft_pick resta originale");
});

test("IND-10 rilettura D1 fallita dopo risposta persa: retry salva oggetto vivo", async () => {
  const env=ambiente(); env.DRAFT_DB.guasti.dopoCommit=true;
  const prepare=env.DRAFT_DB.prepare;
  env.DRAFT_DB.prepare=(sql)=>{
    const s=prepare(sql);
    if(sql.startsWith("SELECT ricevuto, oggetto_r2")) return {bind:()=>({first:()=>{throw Error("read guasto")}})};
    return s;
  };
  assert.equal((await manda(env,"/draft",esempio())).stato,503);
  env.DRAFT_DB.prepare=prepare;
  assert.equal((await manda(env,"/draft",esempio())).stato,200); await coerente(env);
});
