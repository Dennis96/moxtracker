// Le modalita' Research (off, drain, on), i due limitatori e le conferme del
// ciclo di vita: la remediation dei blocker B1 e B4 della review indipendente.
//
// Dopo la pubblicazione della 2.11.0 il rollback di Research non e' «torna al
// Worker di prima»: e' `RESEARCH_MODE=drain`, dove non entra niente di nuovo
// ma revoca e cancellazione continuano a funzionare.

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import server from "../src/index.js";
import { configResearch } from "../src/research/config.js";
import { creaFintoD1 } from "./finto-d1.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const SCHEMA = QUI + "../schema.sql";
const GOLDEN = JSON.parse(readFileSync(QUI + "fixtures/research-golden-rev2.json", "utf8"));
const copia = (x) => JSON.parse(JSON.stringify(x));
const MITTENTE = GOLDEN.richiesta.mittente;
const SEGRETO = GOLDEN.richiesta.segreto_cancellazione;
const CREDENZIALI = { mittente: MITTENTE, segreto_cancellazione: SEGRETO };
const CHIAVI = JSON.stringify({ lineage: { corrente: 1, versioni: { 1: "ab".repeat(32) } },
  tombstone: { corrente: 1, versioni: { 1: "cd".repeat(32) } } });
const ROTTE = ["/research/partite", "/research/consenso", "/research/consenso/revoca",
  "/research/elimina"];

function limitatore(massimo = Infinity) {
  const conti = new Map();
  return {
    chiavi: [],
    async limit({ key }) {
      this.chiavi.push(key);
      const n = (conti.get(key) || 0) + 1;
      conti.set(key, n);
      return { success: n <= massimo };
    },
  };
}

function qualification(query) {
  return JSON.stringify({ versione: 1, id: "q-prod", deployment: "research-produzione-r3",
    max_contributions_per_request: 33, max_d1_queries_per_request: query,
    valida_fino: "2099-01-01T00:00:00Z" });
}

function ambiente(db, { modo = "on", query = 1000, ...extra } = {}) {
  return {
    DB: db, RESEARCH_MODE: modo, RESEARCH_AMBIENTE: "produzione",
    RESEARCH_DEPLOYMENT: "research-produzione-r3",
    RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST: "33",
    RESEARCH_MAX_D1_QUERIES_PER_REQUEST: String(query),
    RESEARCH_RUNTIME_QUALIFICATION: qualification(query), RESEARCH_HMAC_KEYS: CHIAVI,
    RESEARCH_RATE_LIMITER_INGRESSO: limitatore(), RESEARCH_RATE_LIMITER_CICLO: limitatore(),
    ...extra,
  };
}

async function manda(amb, percorso, corpo, { token, metodo = "POST" } = {}) {
  const headers = { "content-type": "application/json", "cf-connecting-ip": "203.0.113.7" };
  if (token) headers.authorization = `Bearer ${token}`;
  const risposta = await server.fetch(new Request("https://esempio.invalid" + percorso, {
    method: metodo, headers, body: metodo === "POST" ? JSON.stringify(corpo) : undefined,
  }), amb);
  const testo = await risposta.text();
  let dati = null;
  try { dati = testo ? JSON.parse(testo) : null; } catch { dati = { testo }; }
  return { stato: risposta.status, corpo: dati };
}

async function consenso(amb) {
  const r = await manda(amb, "/research/consenso", { ...CREDENZIALI, versione_consenso: 1 });
  assert.equal(r.stato, 200, JSON.stringify(r.corpo));
  return r.corpo.generation;
}

const busta = (partite) => ({ ...copia(GOLDEN.richiesta), partite: copia(partite) });

test("modalita' assente o non valida vale off; RESEARCH_ENABLED da solo non accende niente", () => {
  for (const modo of [undefined, "", "ON", "true", "attiva", "enabled", "drain "]) {
    const c = configResearch(ambiente(null, { RESEARCH_MODE: modo }));
    assert.deepEqual([c.modo, c.enabled, c.lifecycle], ["off", false, false], String(modo));
  }
  const vecchio = configResearch(ambiente(null, { RESEARCH_MODE: undefined, RESEARCH_ENABLED: "true" }));
  assert.deepEqual([vecchio.modo, vecchio.enabled, vecchio.lifecycle], ["off", false, false]);
  const acceso = configResearch(ambiente(null));
  assert.deepEqual([acceso.modo, acceso.enabled, acceso.lifecycle], ["on", true, true]);
  const drain = configResearch(ambiente(null, { modo: "drain" }));
  assert.deepEqual([drain.modo, drain.enabled, drain.lifecycle, drain.motivo],
    ["drain", false, true, "drain"]);
});

test("off: ogni route Research risponde 503 senza nessun accesso D1", async () => {
  const db = creaFintoD1(SCHEMA);
  for (const percorso of ROTTE) {
    const r = await manda(ambiente(db, { modo: "off" }), percorso,
      { ...CREDENZIALI, versione_consenso: 1 });
    assert.equal(r.stato, 503, percorso);
    assert.equal(r.corpo.errore, "research_disabilitata", percorso);
  }
  assert.equal(db.registro.letture + db.registro.statement, 0);
});

test("drain: niente consenso nuovo e niente upload; revoca e cancellazione funzionano", async () => {
  const db = creaFintoD1(SCHEMA);
  const token = await consenso(ambiente(db));
  const caricate = await manda(ambiente(db), "/research/partite",
    busta(GOLDEN.richiesta.partite), { token });
  assert.equal(caricate.stato, 200, JSON.stringify(caricate.corpo));
  const drain = ambiente(db, { modo: "drain" });
  const nuovo = await manda(drain, "/research/consenso", { ...CREDENZIALI, versione_consenso: 1 });
  assert.deepEqual([nuovo.stato, nuovo.corpo.errore, nuovo.corpo.retryable],
    [503, "research_drain", true]);
  const upload = await manda(drain, "/research/partite", busta(GOLDEN.richiesta.partite), { token });
  assert.deepEqual([upload.stato, upload.corpo.errore, upload.corpo.retryable],
    [503, "research_drain", true]);
  const revoca = await manda(drain, "/research/consenso/revoca", CREDENZIALI);
  assert.deepEqual([revoca.stato, revoca.corpo.operazione, revoca.corpo.revocata],
    [200, "revoca", true]);
  const elimina = await manda(drain, "/research/elimina", CREDENZIALI);
  assert.deepEqual([elimina.stato, elimina.corpo.operazione, elimina.corpo.stato],
    [200, "elimina", "deleted"]);
  assert.equal(db.conta("research_contribution"), 0);
});

test("drain: la cancellazione lunga continua con le continuation 202", async () => {
  const db = creaFintoD1(SCHEMA);
  const token = await consenso(ambiente(db));
  const tante = Array.from({ length: 5 }, (_, i) => {
    const c = copia(GOLDEN.richiesta.partite[0]);
    c.id_pubblico = (i + 1).toString(16).padStart(64, "0");
    return c;
  });
  await manda(ambiente(db), "/research/partite", busta(tante), { token });
  const corto = ambiente(db, { modo: "drain", query: 20 });
  let r = await manda(corto, "/research/elimina", CREDENZIALI);
  assert.deepEqual([r.stato, r.corpo.operazione, r.corpo.stato], [202, "elimina", "deleting"]);
  for (let giri = 0; r.corpo.stato === "deleting" && giri < 10; giri += 1) {
    r = await manda(corto, "/research/elimina", CREDENZIALI);
  }
  assert.deepEqual([r.stato, r.corpo.operazione, r.corpo.stato], [200, "elimina", "deleted"]);
  assert.equal(db.conta("research_deleted_contribution"), 5);
});

test("/salute dice drain al client, senza cap ne' segreti", async () => {
  for (const [modo, enabled, lifecycle] of [["off", false, false], ["drain", false, true],
    ["on", true, true]]) {
    const r = await manda(ambiente(creaFintoD1(SCHEMA), { modo }), "/salute", null,
      { metodo: "GET" });
    assert.equal(r.corpo.stato, "vivo");
    assert.deepEqual(r.corpo.versioni_partite_accettate, [1, 2]);
    assert.deepEqual([r.corpo.research.modo, r.corpo.research.enabled, r.corpo.research.lifecycle],
      [modo, enabled, lifecycle], modo);
    if (!enabled) assert.equal(r.corpo.research.max_contributions_per_request, null);
    const testo = JSON.stringify(r.corpo);
    assert.ok(!testo.includes("ab".repeat(32)) && !testo.includes("cd".repeat(32)), modo);
  }
});

test("on in produzione: senza il limitatore d'ingresso non e' pronta, il ciclo di vita si'", async () => {
  const senza = configResearch(ambiente(null, { RESEARCH_RATE_LIMITER_INGRESSO: undefined }));
  assert.deepEqual([senza.enabled, senza.motivo, senza.lifecycle],
    [false, "rate_limiter_assente", true]);
  const senzaCiclo = configResearch(ambiente(null, { RESEARCH_RATE_LIMITER_CICLO: undefined }));
  assert.deepEqual([senzaCiclo.enabled, senzaCiclo.lifecycle], [true, true]);
  for (const luogo of ["staging", "prova_locale"]) {
    const c = configResearch(ambiente(null, { RESEARCH_AMBIENTE: luogo,
      RESEARCH_RATE_LIMITER_INGRESSO: undefined }));
    assert.equal(c.enabled, true, luogo);
  }
  const db = creaFintoD1(SCHEMA);
  const amb = ambiente(db, { RESEARCH_RATE_LIMITER_INGRESSO: undefined });
  const r = await manda(amb, "/research/consenso", { ...CREDENZIALI, versione_consenso: 1 });
  assert.deepEqual([r.stato, r.corpo.motivo], [503, "rate_limiter_assente"]);
  const elimina = await manda(amb, "/research/elimina", CREDENZIALI);
  assert.deepEqual([elimina.stato, elimina.corpo.operazione], [200, "elimina"]);
});

test("limitatore d'ingresso esaurito: 429 su consenso e upload, revoca e cancellazione passano", async () => {
  const db = creaFintoD1(SCHEMA);
  const ingresso = limitatore(1);
  const ciclo = limitatore();
  const amb = ambiente(db, { RESEARCH_RATE_LIMITER_INGRESSO: ingresso,
    RESEARCH_RATE_LIMITER_CICLO: ciclo });
  const token = await consenso(amb);
  const troppo = await manda(amb, "/research/consenso", { ...CREDENZIALI, versione_consenso: 1 });
  assert.equal(troppo.stato, 429);
  const upload = await manda(amb, "/research/partite", busta(GOLDEN.richiesta.partite), { token });
  assert.equal(upload.stato, 429);
  const revoca = await manda(amb, "/research/consenso/revoca", CREDENZIALI);
  assert.deepEqual([revoca.stato, revoca.corpo.operazione], [200, "revoca"]);
  const elimina = await manda(amb, "/research/elimina", CREDENZIALI);
  assert.deepEqual([elimina.stato, elimina.corpo.stato], [200, "deleted"]);
  assert.ok(ingresso.chiavi.length && ingresso.chiavi.every((k) => k.startsWith("research-ingresso:")));
  assert.deepEqual([...new Set(ciclo.chiavi)], [`research-ciclo:mittente:${MITTENTE}`]);
});

test("limitatore del ciclo di vita esaurito: 429 con l'operazione, l'ingresso non c'entra", async () => {
  const db = creaFintoD1(SCHEMA);
  const amb = ambiente(db, { RESEARCH_RATE_LIMITER_CICLO: limitatore(0) });
  await consenso(amb);
  const r = await manda(amb, "/research/elimina", CREDENZIALI);
  assert.deepEqual([r.stato, r.corpo.operazione, r.corpo.errore], [429, "elimina", "troppe_richieste"]);
  const revoca = await manda(amb, "/research/consenso/revoca", CREDENZIALI);
  assert.deepEqual([revoca.stato, revoca.corpo.operazione], [429, "revoca"]);
  assert.equal(db.conta("research_lineage"), 1, "niente e' stato cancellato");
});

test("B1: revoca e cancellazione rispondono sempre con l'operazione", async () => {
  const db = creaFintoD1(SCHEMA);
  const amb = ambiente(db);
  const ignota = await manda(amb, "/research/consenso/revoca", CREDENZIALI);
  assert.deepEqual([ignota.stato, ignota.corpo.operazione, ignota.corpo.errore],
    [404, "revoca", "lineage_sconosciuta"]);
  const vuota = await manda(amb, "/research/elimina", CREDENZIALI);
  assert.deepEqual([vuota.stato, vuota.corpo.operazione, vuota.corpo.stato],
    [200, "elimina", "deleted"]);
  await consenso(amb);
  const sbagliata = await manda(amb, "/research/consenso/revoca",
    { mittente: MITTENTE, segreto_cancellazione: "9".repeat(64) });
  assert.deepEqual([sbagliata.stato, sbagliata.corpo.operazione, sbagliata.corpo.errore],
    [403, "revoca", "lineage_credential_mismatch"]);
  const revoca = await manda(amb, "/research/consenso/revoca", CREDENZIALI);
  assert.deepEqual([revoca.stato, revoca.corpo.operazione, revoca.corpo.revocata],
    [200, "revoca", true]);
});

test("qualification non valida: niente upload, il ciclo di vita resta", async () => {
  const db = creaFintoD1(SCHEMA);
  await consenso(ambiente(db));
  const stale = ambiente(db, { RESEARCH_RUNTIME_QUALIFICATION: JSON.stringify({ versione: 1,
    id: "q-prod", deployment: "research-produzione-r3", max_contributions_per_request: 33,
    max_d1_queries_per_request: 1000, valida_fino: "2026-01-01T00:00:00Z" }) });
  const c = configResearch(stale);
  assert.deepEqual([c.enabled, c.motivo, c.lifecycle], [false, "qualification_stale", true]);
  const upload = await manda(stale, "/research/partite", busta(GOLDEN.richiesta.partite),
    { token: "a".repeat(64) });
  assert.equal(upload.stato, 503);
  const revoca = await manda(stale, "/research/consenso/revoca", CREDENZIALI);
  assert.deepEqual([revoca.stato, revoca.corpo.operazione], [200, "revoca"]);
});

test("il legacy non cambia con la modalita' Research", async () => {
  const risposte = [];
  for (const modo of ["off", "drain", "on"]) {
    const amb = ambiente(creaFintoD1(SCHEMA), { modo });
    const partite = await manda(amb, "/partite", {});
    const salute = await manda(amb, "/salute", null, { metodo: "GET" });
    risposte.push(JSON.stringify([partite.stato, partite.corpo,
      salute.corpo.versioni_partite_accettate, salute.corpo.versioni_draft_accettate]));
  }
  assert.equal(new Set(risposte).size, 1, risposte.join("\n"));
  assert.ok(!risposte[0].includes("research"));
});
