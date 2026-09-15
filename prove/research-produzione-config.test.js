// La configurazione di produzione di Research, verificabile senza segreti e
// senza deploy (blocker B4): quale Worker, quale rotta, quale D1, quale
// modalita' iniziale, quali cap, quali limitatori. Il controllo e' lo stesso
// che `strumenti/research-produzione/verifica.mjs` stampa prima di un deploy.

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { configResearch } from "../src/research/config.js";
import { controllaProduzione, descriviDeploy, leggiToml, qualificationProduzione }
  from "../strumenti/research-produzione/config-produzione.mjs";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const TESTO_PRODUZIONE = readFileSync(QUI + "../wrangler.toml", "utf8");
const PRODUZIONE = leggiToml(TESTO_PRODUZIONE);
const STAGING = leggiToml(readFileSync(QUI + "../wrangler.research-staging.toml", "utf8"));
const copia = (x) => JSON.parse(JSON.stringify(x));
const CHIAVI = JSON.stringify({ lineage: { corrente: 1, versioni: { 1: "ab".repeat(32) } },
  tombstone: { corrente: 1, versioni: { 1: "cd".repeat(32) } } });
const limitatore = { limit: async () => ({ success: true }) };

test("il lettore TOML legge il sottoinsieme che usano i nostri file", () => {
  const t = leggiToml([
    'name = "x" # nota', "# commento", "[vars]", 'A = "1"', 'B = \'{"k":1}\'',
    "[triggers]", 'crons = [ "17 3 * * *" ]', "[[ratelimits]]", 'name = "R"',
    'namespace_id = "7"', "  [ratelimits.simple]", "  limit = 5", "  period = 60",
    "[[routes]]", 'pattern = "p"', "custom_domain = true", "",
  ].join("\n"));
  assert.equal(t.name, "x");
  assert.deepEqual(t.vars, { A: "1", B: '{"k":1}' });
  assert.deepEqual(t.triggers.crons, ["17 3 * * *"]);
  assert.deepEqual(t.ratelimits, [{ name: "R", namespace_id: "7", simple: { limit: 5, period: 60 } }]);
  assert.deepEqual(t.routes, [{ pattern: "p", custom_domain: true }]);
});

test("produzione: Worker, rotta, D1, Research spenta, cap 33/1000 e i due limitatori", () => {
  assert.deepEqual(controllaProduzione(PRODUZIONE, STAGING), []);
  const d = descriviDeploy(PRODUZIONE);
  assert.equal(d.worker, "moxtracker");
  assert.deepEqual(d.rotte, ["api.moxtracker.app"]);
  assert.equal(d.d1.DB, "85145457-e78e-41bb-b069-41269321db1c");
  assert.deepEqual(d.research, {
    RESEARCH_MODE: "off", RESEARCH_AMBIENTE: "produzione",
    RESEARCH_DEPLOYMENT: "research-produzione-r3",
    RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST: "33", RESEARCH_MAX_D1_QUERIES_PER_REQUEST: "1000",
  });
  assert.deepEqual(d.limitatori.RESEARCH_RATE_LIMITER_INGRESSO,
    { namespace_id: "29021", limit: 30, period: 60 });
  assert.deepEqual(d.limitatori.RESEARCH_RATE_LIMITER_CICLO,
    { namespace_id: "29022", limit: 60, period: 60 });
  assert.deepEqual(d.limitatori.TICKET_RATE_LIMITER,
    { namespace_id: "29011", limit: 10, period: 60 }, "il limitatore dei ticket non cambia");
});

test("nel file di produzione non ci sono chiavi Research ne' risorse di staging", () => {
  assert.doesNotMatch(TESTO_PRODUZIONE, /RESEARCH_HMAC_KEYS\s*=|RESEARCH_MISURE|02829757|[0-9a-f]{64}/);
  assert.equal(PRODUZIONE.vars.RESEARCH_RUNTIME_QUALIFICATION, undefined,
    "la qualification nasce al deploy, non prima");
});

test("staging e produzione restano separati", () => {
  const s = descriviDeploy(STAGING);
  assert.equal(s.worker, "moxtracker-research-staging");
  assert.deepEqual(s.rotte, []);
  assert.equal(s.d1.DB, "02829757-def3-4f6e-9593-b985e01f92f6");
  assert.equal(s.research.RESEARCH_AMBIENTE, "staging");
  assert.equal(s.research.RESEARCH_MODE, "on");
});

test("dalla configurazione di produzione: off, poi drain, poi on con la qualification generata", () => {
  const base = { ...PRODUZIONE.vars, RESEARCH_HMAC_KEYS: CHIAVI,
    RESEARCH_RATE_LIMITER_INGRESSO: limitatore, RESEARCH_RATE_LIMITER_CICLO: limitatore };
  const spenta = configResearch(base);
  assert.deepEqual([spenta.modo, spenta.enabled, spenta.lifecycle], ["off", false, false]);
  const drain = configResearch({ ...base, RESEARCH_MODE: "drain" });
  assert.deepEqual([drain.modo, drain.enabled, drain.lifecycle], ["drain", false, true]);
  const q = qualificationProduzione(PRODUZIONE.vars, "2099-01-01T00:00:00Z", "q-produzione-1");
  const accesa = configResearch({ ...base, RESEARCH_MODE: "on", RESEARCH_RUNTIME_QUALIFICATION: q });
  assert.deepEqual([accesa.modo, accesa.enabled, accesa.max_contributions_per_request,
    accesa.max_d1_queries_per_request, accesa.qualification.stato], ["on", true, 33, 1000, "valida"]);
  const senzaQ = configResearch({ ...base, RESEARCH_MODE: "on" });
  assert.deepEqual([senzaQ.enabled, senzaQ.motivo], [false, "qualification_assente"]);
});

test("il controllo pre-deploy rifiuta una produzione sbagliata", () => {
  const casi = {
    "cap diversi": (c) => { c.vars.RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST = "5"; },
    "chiavi nel file": (c) => { c.vars.RESEARCH_HMAC_KEYS = "{}"; },
    "modalita' non valida": (c) => { c.vars.RESEARCH_MODE = "acceso"; },
    "on senza qualification": (c) => { c.vars.RESEARCH_MODE = "on"; },
    "limitatore d'ingresso mancante": (c) => {
      c.ratelimits = c.ratelimits.filter((r) => r.name !== "RESEARCH_RATE_LIMITER_INGRESSO"); },
    "limitatore del ciclo mancante": (c) => {
      c.ratelimits = c.ratelimits.filter((r) => r.name !== "RESEARCH_RATE_LIMITER_CICLO"); },
    "stesso namespace dei ticket": (c) => {
      c.ratelimits.find((r) => r.name === "RESEARCH_RATE_LIMITER_CICLO").namespace_id = "29011"; },
    "D1 di staging": (c) => { c.d1_databases[0].database_id = "02829757-def3-4f6e-9593-b985e01f92f6"; },
    "rotta cambiata": (c) => { c.routes[0].pattern = "moxtracker.app"; },
  };
  for (const [nome, rompi] of Object.entries(casi)) {
    const c = copia(PRODUZIONE);
    rompi(c);
    assert.ok(controllaProduzione(c, STAGING).length > 0, nome);
  }
});
