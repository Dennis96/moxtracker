// La configurazione di produzione di Research, letta dai file wrangler e
// controllata prima di un deploy, senza segreti e senza toccare Cloudflare
// (blocker B4 della review indipendente R3). La usano la prova
// `prove/research-produzione-config.test.js` e `verifica.mjs`, che stampa
// Worker, rotte, D1, variabili Research e limitatori che il deploy userebbe.

const D1_PRODUZIONE = "85145457-e78e-41bb-b069-41269321db1c";
const D1_STAGING = "02829757-def3-4f6e-9593-b985e01f92f6";
const ROTTA = "api.moxtracker.app";
const MODI = new Set(["off", "drain", "on"]);
const SEGRETI = ["RESEARCH_HMAC_KEYS", "RESEARCH_MISURE_TOKEN"];
const ISTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export const RESEARCH_ATTESI = Object.freeze({
  RESEARCH_AMBIENTE: "produzione",
  RESEARCH_DEPLOYMENT: "research-produzione-r3",
  RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST: "33",
  RESEARCH_MAX_D1_QUERIES_PER_REQUEST: "1000",
});

export const LIMITATORI_ATTESI = Object.freeze({
  RESEARCH_RATE_LIMITER_INGRESSO: Object.freeze({ limit: 30, period: 60 }),
  RESEARCH_RATE_LIMITER_CICLO: Object.freeze({ limit: 60, period: 60 }),
});

function togliCommento(riga) {
  let virgolette = null;
  for (let i = 0; i < riga.length; i += 1) {
    const c = riga[i];
    if (virgolette) {
      if (c === "\\" && virgolette === "\"") i += 1;
      else if (c === virgolette) virgolette = null;
    } else if (c === "\"" || c === "'") virgolette = c;
    else if (c === "#") return riga.slice(0, i);
  }
  return riga;
}

function valore(testo, numero) {
  if (testo.startsWith("\"")) return JSON.parse(testo);
  if (testo.startsWith("'") && testo.endsWith("'") && testo.length >= 2) return testo.slice(1, -1);
  if (testo === "true" || testo === "false") return testo === "true";
  if (/^-?\d+$/.test(testo)) return Number(testo);
  if (testo.startsWith("[")) {
    const lista = JSON.parse(testo);
    if (Array.isArray(lista) && lista.every((v) => typeof v === "string")) return lista;
  }
  throw new Error(`riga ${numero}: valore che non so leggere`);
}

// Un lettore del sottoinsieme di TOML che usano i nostri due file: chiavi
// semplici, tabelle, array di tabelle con le loro sottotabelle, stringhe fra
// virgolette doppie o singole, interi, booleani e array di stringhe. Tutto il
// resto e' un errore, non un valore indovinato.
export function leggiToml(testo) {
  const radice = {};
  let corrente = radice;
  let ultimo = null;
  for (const [indice, grezza] of testo.split(/\r?\n/).entries()) {
    const riga = togliCommento(grezza).trim();
    if (!riga) continue;
    let m;
    if ((m = riga.match(/^\[\[([A-Za-z0-9_]+)\]\]$/))) {
      radice[m[1]] ||= [];
      const elemento = {};
      radice[m[1]].push(elemento);
      corrente = elemento;
      ultimo = { nome: m[1], elemento };
    } else if ((m = riga.match(/^\[([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\]$/))) {
      if (!ultimo || ultimo.nome !== m[1]) {
        throw new Error(`riga ${indice + 1}: sottotabella senza la sua tabella`);
      }
      ultimo.elemento[m[2]] = {};
      corrente = ultimo.elemento[m[2]];
    } else if ((m = riga.match(/^\[([A-Za-z0-9_]+)\]$/))) {
      radice[m[1]] ||= {};
      corrente = radice[m[1]];
      ultimo = null;
    } else if ((m = riga.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/))) {
      corrente[m[1]] = valore(m[2].trim(), indice + 1);
    } else {
      throw new Error(`riga ${indice + 1}: non la so leggere`);
    }
  }
  return radice;
}

export function descriviDeploy(config) {
  const variabili = config.vars || {};
  return {
    worker: config.name,
    rotte: (config.routes || []).map((r) => r.pattern),
    d1: Object.fromEntries((config.d1_databases || []).map((d) => [d.binding, d.database_id])),
    research: Object.fromEntries(Object.entries(variabili)
      .filter(([chiave]) => chiave.startsWith("RESEARCH_"))),
    limitatori: Object.fromEntries((config.ratelimits || []).map((r) => [r.name,
      { namespace_id: r.namespace_id, limit: r.simple?.limit, period: r.simple?.period }])),
  };
}

// La qualification di runtime di produzione: nasce al deploy, con una
// scadenza, dagli stessi valori del file. Non si scrive a mano.
export function qualificationProduzione(variabili, validaFino, id = "q-produzione") {
  if (typeof validaFino !== "string" || !ISTANTE.test(validaFino) ||
      Number.isNaN(Date.parse(validaFino))) {
    throw new Error("valida_fino vuole un istante UTC come 2026-10-15T00:00:00Z");
  }
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(id)) throw new Error("id di qualification non valido");
  return JSON.stringify({ versione: 1, id, deployment: variabili.RESEARCH_DEPLOYMENT,
    max_contributions_per_request: Number(variabili.RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST),
    max_d1_queries_per_request: Number(variabili.RESEARCH_MAX_D1_QUERIES_PER_REQUEST),
    valida_fino: validaFino });
}

// Quello che non torna nel file di produzione, confrontato con lo staging.
// Una lista vuota vuol dire: si puo' fare il deploy.
export function controllaProduzione(produzione, staging) {
  const guai = [];
  const d = descriviDeploy(produzione);
  const variabili = produzione.vars || {};
  if (d.worker !== "moxtracker") guai.push(`Worker ${d.worker}, atteso moxtracker`);
  if (JSON.stringify(d.rotte) !== JSON.stringify([ROTTA]) ||
      produzione.routes?.[0]?.custom_domain !== true) {
    guai.push(`rotte ${JSON.stringify(d.rotte)}, attesa solo ${ROTTA} come custom domain`);
  }
  if (d.d1.DB !== D1_PRODUZIONE) guai.push(`D1 DB ${d.d1.DB}, atteso ${D1_PRODUZIONE}`);
  if (Object.values(d.d1).includes(D1_STAGING)) guai.push("il D1 di staging e' nel file di produzione");
  if (!MODI.has(variabili.RESEARCH_MODE)) guai.push(`RESEARCH_MODE ${variabili.RESEARCH_MODE}, attesa off, drain o on`);
  for (const [chiave, atteso] of Object.entries(RESEARCH_ATTESI)) {
    if (variabili[chiave] !== atteso) guai.push(`${chiave} ${variabili[chiave]}, atteso ${atteso}`);
  }
  for (const segreto of SEGRETI) {
    if (segreto in variabili) guai.push(`${segreto} non puo' stare nel file: e' un secret`);
  }
  if (variabili.RESEARCH_MODE === "on") {
    let q = null;
    try { q = JSON.parse(variabili.RESEARCH_RUNTIME_QUALIFICATION ?? "null"); } catch { q = null; }
    if (!q || q.deployment !== RESEARCH_ATTESI.RESEARCH_DEPLOYMENT ||
        q.max_contributions_per_request !== 33 || q.max_d1_queries_per_request !== 1000) {
      guai.push("RESEARCH_MODE on senza una qualification coerente con deployment e cap");
    }
  }
  const namespace = (produzione.ratelimits || []).map((r) => r.namespace_id);
  if (new Set(namespace).size !== namespace.length) guai.push("due limitatori con lo stesso namespace_id");
  for (const [nome, atteso] of Object.entries(LIMITATORI_ATTESI)) {
    const trovato = d.limitatori[nome];
    if (!trovato) guai.push(`manca il limitatore ${nome}`);
    else if (trovato.limit !== atteso.limit || trovato.period !== atteso.period) {
      guai.push(`${nome} ${trovato.limit}/${trovato.period}s, atteso ${atteso.limit}/${atteso.period}s`);
    }
  }
  for (const r of produzione.ratelimits || []) {
    if (![10, 60].includes(r.simple?.period)) guai.push(`${r.name}: il periodo puo' essere solo 10 o 60`);
  }
  const s = descriviDeploy(staging);
  if (s.worker === d.worker) guai.push("staging e produzione hanno lo stesso Worker");
  if (s.rotte.length) guai.push("lo staging ha delle rotte");
  if (s.d1.DB === d.d1.DB) guai.push("staging e produzione usano lo stesso D1");
  return guai;
}
