// Research dentro il lifecycle dell'account: export, delete account, delete
// della sezione partite e `/contributi/elimina`. Piu' il censimento
// permanente delle tabelle: una tabella Research nuova che nessun delete
// copre fa fallire questa prova.

import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import worker from "../src/index.js";
import { sha256 } from "../src/draft.js";
import { pianoCompletionDelete, pianoDeleteContribution } from "../src/research/planner.js";
import { creaFintoD1 } from "./finto-d1.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const SCHEMA = join(QUI, "..", "schema.sql");
const SCHEMA_DRAFT = join(QUI, "..", "schema-draft.sql");
const GOLDEN = JSON.parse(readFileSync(join(QUI, "fixtures", "research-golden-rev2.json"), "utf8"));
const copia = (x) => JSON.parse(JSON.stringify(x));
const MITTENTE = GOLDEN.richiesta.mittente;
const SEGRETO = GOLDEN.richiesta.segreto_cancellazione;
const ALTRO = "3".repeat(32);
const SEGRETO_ALTRO = "4".repeat(64);
const ORIGINE = "https://moxtracker.app";
const CHIAVI = JSON.stringify({
  lineage: { corrente: 7, versioni: {
    7: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f" } },
  tombstone: { corrente: 9, versioni: {
    9: "202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f" } },
});

function research(query = 500) {
  return {
    RESEARCH_ENABLED: "true", RESEARCH_AMBIENTE: "prova_locale",
    RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST: "5",
    RESEARCH_MAX_D1_QUERIES_PER_REQUEST: String(query),
    RESEARCH_DEPLOYMENT: "prova-locale",
    RESEARCH_RUNTIME_QUALIFICATION: JSON.stringify({ versione: 1, id: "q", deployment: "prova-locale",
      max_contributions_per_request: 5, max_d1_queries_per_request: query,
      valida_fino: "2099-01-01T00:00:00Z" }),
    RESEARCH_HMAC_KEYS: CHIAVI,
  };
}

function ambiente(schema = SCHEMA) {
  return {
    DB: creaFintoD1(schema), DRAFT_DB: creaFintoD1(SCHEMA_DRAFT),
    SITE_ORIGIN: ORIGINE, PREVIEW_ORIGIN: "https://preview.moxtracker.pages.dev",
    GOOGLE_CLIENT_ID: "google-client", GOOGLE_CLIENT_SECRET: "google-secret",
    OAUTH_FETCH: async (url) => (String(url).includes("token")
      ? new Response(JSON.stringify({ access_token: "accesso" }), { status: 200 })
      : new Response(JSON.stringify({ sub: "google-123", name: "Amico di Mox" }), { status: 200 })),
    ...research(),
  };
}

const cookie = (r) => r.headers.get("set-cookie").split(";", 1)[0];

async function accedi(env) {
  const inizio = await worker.fetch(new Request(
    "https://api.moxtracker.app/auth/google?ritorno=/account.html"), env);
  const stato = new URL(inizio.headers.get("location")).searchParams.get("state");
  const fine = await worker.fetch(new Request(
    `https://api.moxtracker.app/auth/google/callback?code=codice&state=${stato}`,
    { headers: { cookie: cookie(inizio) } }), env);
  const sessione = cookie(fine);
  const [{ id }] = env.DB.tutte("SELECT id FROM account");
  await env.DB.batch([env.DB.prepare(`INSERT INTO account_dispositivo
    (mittente, account_id, nome, segreto_hash, collegato) VALUES (?, ?, ?, ?, ?)`)
    .bind(MITTENTE, id, "pc", await sha256(SEGRETO), "2026-09-14T00:00:00Z")]);
  return sessione;
}

async function account(env, sessione, percorso, corpo) {
  const risposta = await worker.fetch(new Request(`https://api.moxtracker.app${percorso}`, {
    method: corpo ? "POST" : "GET",
    headers: { cookie: sessione, origin: ORIGINE, "content-type": "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  }), env);
  return { stato: risposta.status, corpo: await risposta.json() };
}

async function manda(env, percorso, corpo, token) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await worker.fetch(new Request(`https://api.moxtracker.app${percorso}`,
    { method: "POST", headers, body: JSON.stringify(corpo) }), env);
  return { stato: r.status, corpo: await r.json() };
}

async function contribuisci(env, partite, mittente = MITTENTE, segreto = SEGRETO) {
  const consenso = await manda(env, "/research/consenso",
    { mittente, segreto_cancellazione: segreto, versione_consenso: 1 });
  const token = consenso.corpo.generation;
  const esito = await manda(env, "/research/partite", { ...copia(GOLDEN.richiesta), mittente,
    segreto_cancellazione: segreto, partite: copia(partite) }, token);
  assert.equal(esito.stato, 200, JSON.stringify(esito.corpo));
  return token;
}

const bo1 = () => copia(GOLDEN.richiesta.partite[0]);
const bo3 = () => copia(GOLDEN.richiesta.partite[1]);

function perMittente(env, mittente) {
  const tabelle = env.DB.tutte(`SELECT name FROM sqlite_master WHERE type = 'table'
    AND name LIKE 'research_%'`).map((r) => r.name);
  const fuori = {};
  for (const tabella of tabelle) {
    const colonne = env.DB.tutte(`PRAGMA table_info(${tabella})`).map((c) => c.name);
    if (colonne.includes("mittente")) {
      fuori[tabella] = env.DB.tutte(`SELECT COUNT(*) AS n FROM ${tabella} WHERE mittente = ?`,
        mittente)[0].n;
    }
  }
  return fuori;
}

test("export: snapshot, varianti contese, storia e consensi, senza hash ne' tag", async () => {
  const env = ambiente();
  const sessione = await accedi(env);
  const token = await contribuisci(env, [bo1(), bo3()]);
  const piu = bo1(); piu.revisione.osservazioni = 3; piu.turni = 7;
  await manda(env, "/research/partite", { ...copia(GOLDEN.richiesta), partite: [piu] }, token);
  for (const turni of [8, 9, 10, 11]) {
    const v = bo3(); v.turni = turni;
    await manda(env, "/research/partite", { ...copia(GOLDEN.richiesta), partite: [v] }, token);
  }
  const { stato, corpo } = await account(env, sessione, "/account/export");
  assert.equal(stato, 200);
  const perId = Object.fromEntries(corpo.research.contribution.map((c) => [c.id_pubblico, c]));
  assert.equal(perId[piu.id_pubblico].stato, "effettiva");
  assert.deepEqual(perId[piu.id_pubblico].snapshot, piu);
  const conteso = perId[bo3().id_pubblico];
  assert.equal(conteso.stato, "conteso");
  assert.equal(conteso.varianti.length, 3);
  assert.equal(conteso.overflow, true);
  assert.equal(conteso.nota, "almeno quattro varianti osservate: qui le prime tre per impronta");
  assert.ok(conteso.varianti.every((v) => /^[0-9a-f]{64}$/.test(v.variant_hash) && v.body.games));
  assert.equal(corpo.research.storia.length, 1);
  assert.deepEqual(corpo.research.storia[0].revisione, { modello: 1, osservazioni: 2 });
  assert.deepEqual(corpo.research.consensi.map((c) => Object.keys(c).sort()),
    [["creata", "mittente", "revocata", "stato", "versione_consenso"]]);
  const testo = JSON.stringify(corpo);
  const [generation] = env.DB.tutte("SELECT hash, lineage_tag, credential_tag FROM research_consent_generation");
  for (const vietato of [token, SEGRETO, generation.hash, generation.lineage_tag, generation.credential_tag]) {
    assert.ok(!testo.includes(vietato));
  }
});

test("delete account: Research della lineage via, tombstone restano, l'altro mittente intatto", async () => {
  const env = ambiente();
  const sessione = await accedi(env);
  await contribuisci(env, [bo1(), bo3()]);
  await contribuisci(env, [bo1()], ALTRO, SEGRETO_ALTRO);
  const esito = await account(env, sessione, "/account/delete", { conferma: "ELIMINA" });
  assert.equal(esito.stato, 200, JSON.stringify(esito.corpo));
  assert.equal(esito.corpo.contributi.research, 2);
  for (const [tabella, n] of Object.entries(perMittente(env, MITTENTE))) assert.equal(n, 0, tabella);
  assert.equal(perMittente(env, ALTRO).research_contribution, 1);
  assert.equal(env.DB.conta("research_deleted_contribution"), 2);
  assert.equal(env.DB.conta("account"), 0);
});

test("delete account oltre il budget Research: 409, account intatto, poi completa", async () => {
  const env = ambiente();
  const sessione = await accedi(env);
  const tante = Array.from({ length: 5 }, (_, i) => {
    const c = bo1(); c.id_pubblico = (i + 1).toString(16).padStart(64, "0"); return c;
  });
  await contribuisci(env, tante);
  Object.assign(env, research(20));
  const primo = await account(env, sessione, "/account/delete", { conferma: "ELIMINA" });
  assert.equal(primo.stato, 409);
  assert.equal(primo.corpo.errore, "cancellazione_research_in_corso");
  assert.equal(env.DB.conta("account"), 1);
  assert.equal(env.DB.conta("account_dispositivo"), 1, "il collegamento resta per il retry");
  let esito = primo;
  for (let giri = 0; esito.stato === 409 && giri < 10; giri += 1) {
    esito = await account(env, sessione, "/account/delete", { conferma: "ELIMINA" });
  }
  assert.equal(esito.stato, 200);
  assert.equal(env.DB.conta("research_contribution"), 0);
  assert.equal(env.DB.conta("research_deleted_contribution"), 5);
});

test("delete della sezione partite e /contributi/elimina includono Research", async () => {
  const env = ambiente();
  const sessione = await accedi(env);
  await contribuisci(env, [bo1()]);
  const sezione = await account(env, sessione, "/account/delete-section",
    { sezione: "partite", conferma: "PARTITE" });
  assert.equal(sezione.stato, 200);
  assert.equal(sezione.corpo.research, 1);
  assert.equal(env.DB.conta("research_contribution"), 0);

  const env2 = ambiente();
  await contribuisci(env2, [bo1(), bo3()]);
  await env2.DB.batch([env2.DB.prepare(`INSERT INTO contributori (mittente, cancellazione_hash, creato)
    VALUES (?, ?, ?)`).bind(MITTENTE, await sha256(SEGRETO), "2026-09-14T00:00:00Z")]);
  const legacy = await worker.fetch(new Request("https://api.moxtracker.app/contributi/elimina", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ mittente: MITTENTE, segreto: SEGRETO }) }), env2);
  const corpo = await legacy.json();
  assert.equal(legacy.status, 200, JSON.stringify(corpo));
  assert.equal(corpo.eliminati.research, 2);
  assert.equal(env2.DB.conta("research_contribution"), 0);
});

test("un database senza tabelle Research: export e delete account funzionano come prima", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "mox-schema-"));
  const legacy = readFileSync(SCHEMA, "utf8").split("-- Research R3")[0];
  const percorso = join(cartella, "schema-legacy.sql");
  writeFileSync(percorso, legacy);
  const env = ambiente(percorso);
  delete env.RESEARCH_ENABLED;
  const sessione = await accedi(env);
  const esporta = await account(env, sessione, "/account/export");
  assert.equal(esporta.stato, 200);
  assert.deepEqual(esporta.corpo.research, { disponibile: false });
  const elimina = await account(env, sessione, "/account/delete", { conferma: "ELIMINA" });
  assert.equal(elimina.stato, 200, JSON.stringify(elimina.corpo));
  assert.equal(env.DB.conta("account"), 0);
});

test("censimento: ogni tabella Research e' cancellata dal delete o e' un'eccezione opaca", () => {
  const schema = readFileSync(SCHEMA, "utf8");
  const tabelle = new Map();
  for (const [, nome, corpo] of schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\)( WITHOUT ROWID)?;/g)) {
    tabelle.set(nome, corpo);
  }
  const research = [...tabelle.keys()].filter((t) => t.startsWith("research_"));
  assert.ok(research.length >= 13);
  const piano = [
    ...pianoDeleteContribution({ lineage_tag: "a".repeat(64), mittente: "1".repeat(32),
      id_pubblico: "e".repeat(64), tag: [{ tag: "f".repeat(64), key_version: 1 }], adesso: "x" }),
    ...pianoCompletionDelete({ lineage_tag: "a".repeat(64), mittente: "1".repeat(32), adesso: "x" }),
  ];
  const cancellate = new Set(piano.flatMap((d) => [...d.sql.matchAll(/DELETE FROM (\w+)/g)].map((m) => m[1])));
  // Eccezioni dichiarate: soppressioni e tombstone opachi, e la guardia che
  // resta vuota per costruzione (ogni batch la svuota).
  const ECCEZIONI = new Set(["research_lineage", "research_deleted_contribution",
    "research_consent_tombstone"]);
  for (const tabella of research) {
    assert.ok(cancellate.has(tabella) || ECCEZIONI.has(tabella), `${tabella} non censita`);
    if (ECCEZIONI.has(tabella)) {
      assert.ok(!/\b(mittente|id_pubblico|snapshot|body)\b/.test(tabelle.get(tabella)),
        `${tabella} deve restare opaca`);
    }
    if (/\bmittente\b/.test(tabelle.get(tabella))) assert.ok(cancellate.has(tabella), tabella);
  }
});
