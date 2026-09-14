// L'acceptance G5C-03 contro il Worker di STAGING. Mai contro produzione.
//
//   MOX_STAGING_TOKEN=<token misure> node strumenti/research-staging/accettazione.mjs \
//     --url https://moxtracker-research-staging.<sottodominio>.workers.dev \
//     --budget-righe <righe scritte> [--fasi rollback,flusso] [--out evidenze.json]
//
// Il token non viene mai stampato. Tutti i dati sono sintetici: mittenti e
// segreti casuali per ogni esecuzione, contribution derivate dalla golden rev2.
// Rifiuta di partire se l'URL non e' uno staging workers.dev.
//
// `--budget-righe` e' obbligatorio contro lo staging: la quota D1 gratuita e'
// dell'account intero (R3-OP-01). La run gira due volte: prima in
// simulazione, senza rete, per sommare le prenotazioni di tutte le richieste
// (la stima preventiva, che se supera il tetto ferma tutto); poi per davvero,
// prenotando ogni richiesta prima di mandarla.

import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { BudgetRighe, RIGHE_CONSENSO, RIGHE_REVOCA, RIGHE_SONDA, RigheOltreBudget, fermaSeOltre,
  righeMisurate, stimaRigheContribution, tettoDaArgomenti } from "./budget-righe.mjs";

const argomenti = process.argv.slice(2);
const opzione = (nome) => { const i = argomenti.indexOf(`--${nome}`); return i >= 0 ? argomenti[i + 1] : null; };
const BASE = opzione("url");
const USCITA = opzione("out");
const TOKEN = process.env.MOX_STAGING_TOKEN;
const LOCALE = argomenti.includes("--locale") && /^http:\/\/127\.0\.0\.1:\d+$/.test(BASE || "");
if (!LOCALE && (!BASE || !/^https:\/\/moxtracker-research-staging\.[a-z0-9-]+\.workers\.dev$/.test(BASE))) {
  console.error("serve --url https://moxtracker-research-staging.<sottodominio>.workers.dev");
  process.exit(2);
}
if (!TOKEN) { console.error("manca MOX_STAGING_TOKEN"); process.exit(2); }
const TETTO = tettoDaArgomenti(argomenti, LOCALE);
const TUTTE_LE_FASI = ["limiti", "rollback", "qualification", "flusso", "budget", "payload", "corse"];
const FASI = (opzione("fasi") || TUTTE_LE_FASI.join(",")).split(",");
if (FASI.some((f) => !TUTTE_LE_FASI.includes(f))) {
  console.error(`--fasi fra: ${TUTTE_LE_FASI.join(",")}`); process.exit(2);
}

const QUI = fileURLToPath(new URL(".", import.meta.url));
const GOLDEN = JSON.parse(readFileSync(QUI + "../../prove/fixtures/research-golden-rev2.json", "utf8"));
const copia = (x) => JSON.parse(JSON.stringify(x));
const esa = (byte) => randomBytes(byte).toString("hex");
const evidenze = { url: BASE, iniziata: new Date().toISOString(), fasi: {} };
const verdetti = [];

// ------------------------------------------------------------ budget

let SIMULAZIONE = false;
let stimaPreventiva = 0;
let budget = null;
const inviate = new Map();       // mittente -> id_pubblico gia' mandati
const righeLineage = new Map();  // mittente -> righe stimate ancora nel D1

function stimaSonda(nome, corpo) {
  if (nome === "rollback") return RIGHE_SONDA;
  if (nome !== "applica") return 0;
  const { percorso, corpo: dentro = {} } = corpo;
  const mittente = dentro.mittente;
  if (percorso === "/research/consenso") return RIGHE_CONSENSO;
  if (percorso === "/research/consenso/revoca") return RIGHE_REVOCA;
  // Il delete cancella tutto cio' che la lineage ha scritto: le stesse righe.
  if (percorso === "/research/elimina") return (righeLineage.get(mittente) || 0) + RIGHE_CONSENSO;
  if (percorso === "/research/partite") {
    const visti = inviate.get(mittente) || new Set();
    inviate.set(mittente, visti);
    let stima = 0;
    for (const c of dentro.partite || []) {
      const righe = stimaRigheContribution(c);
      // Un id gia' mandato puo' diventare un aggiornamento: cancella e riscrive.
      stima += visti.has(c.id_pubblico) ? 2 * righe : righe;
      visti.add(c.id_pubblico);
    }
    righeLineage.set(mittente, (righeLineage.get(mittente) || 0) + stima);
    return stima;
  }
  return RIGHE_SONDA;
}

const FINTE = {
  applica: { stato: 200, corpo: { stato: 200, corpo: { stato: "deleted" }, strumento: { letture: 0, statement: 0 } }, ms: 0 },
  sonda: { stato: 200, corpo: { ok: true }, ms: 0 },
};

const verifica = (nome, ok, dettaglio) => {
  if (SIMULAZIONE) return;
  verdetti.push({ nome, ok: Boolean(ok), ...(ok ? {} : { dettaglio }) });
  console.log(`[${ok ? "OK " : "NO "}] ${nome}`);
};

async function chiama(percorso, { metodo = "POST", corpo, intestazioni = {} } = {}) {
  const inizio = performance.now();
  const r = await fetch(BASE + percorso, { method: metodo,
    headers: { "content-type": "application/json", ...intestazioni },
    body: metodo === "POST" ? JSON.stringify(corpo) : undefined });
  const testo = await r.text();
  let dati;
  try { dati = JSON.parse(testo); } catch { dati = { testo: testo.slice(0, 200) }; }
  return { stato: r.status, corpo: dati, ms: Math.round(performance.now() - inizio) };
}

// Ogni scrittura passa di qui. La prenotazione e' sincrona, prima del primo
// `await`: anche le richieste lanciate insieme contano tutte.
async function sonda(nome, corpo) {
  const stima = stimaSonda(nome, corpo);
  const elimina = corpo?.percorso === "/research/elimina" ? corpo.corpo.mittente : null;
  if (SIMULAZIONE) {
    stimaPreventiva += stima;
    if (elimina) righeLineage.set(elimina, 0);
    return copia(nome === "applica" ? FINTE.applica : FINTE.sonda);
  }
  budget.prenota(stima, nome === "applica" ? corpo.percorso : `sonda ${nome}`);
  let r;
  try {
    r = await chiama(`/__misure/${nome}`, { corpo, intestazioni: { "x-mox-misure": TOKEN } });
  } catch (guasto) {
    // Senza risposta la richiesta puo' aver scritto lo stesso: vale la stima.
    budget.registra(null, stima);
    throw guasto;
  }
  const misurate = budget.registra(righeMisurate(r.corpo?.strumento), stima);
  if (elimina) {
    righeLineage.set(elimina, r.corpo?.corpo?.stato === "deleted" ? 0
      : Math.max(0, (righeLineage.get(elimina) || 0) - misurate));
  }
  return r;
}

async function applica(percorso, corpo, { token, config, qualification } = {}) {
  const r = await sonda("applica", { percorso, corpo, config, qualification,
    headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { ...r.corpo, ms: r.ms };
}

function identita() { return { mittente: esa(16), segreto: esa(32) }; }
function busta(chi, partite) {
  return { ...copia(GOLDEN.richiesta), mittente: chi.mittente, segreto_cancellazione: chi.segreto,
    partite: copia(partite) };
}
async function consenso(chi, opzioni) {
  const r = await applica("/research/consenso", { mittente: chi.mittente,
    segreto_cancellazione: chi.segreto, versione_consenso: 1 }, opzioni);
  return r.corpo?.generation;
}
function conId(c, id) { const x = copia(c); x.id_pubblico = id; return x; }
const bo1 = () => copia(GOLDEN.richiesta.partite[0]);
const bo3 = () => copia(GOLDEN.richiesta.partite[1]);

function forma(indice, { eventi = 0, righeMazzo = 1 }) {
  const c = bo1();
  c.id_pubblico = esa(32);
  const g = c.games[0];
  for (const k of ["conflicted_event_ids", "incomplete_event_types", "casts", "lands", "draws"]) delete g[k];
  const evento = (i) => ({ event_id: esa(32), turno: 1 + (i % 40), card_id: 11 });
  if (eventi) g.draws = Array.from({ length: Math.min(eventi, 200) }, (_, i) => evento(i));
  if (eventi > 200) g.casts = Array.from({ length: eventi - 200 }, (_, i) => evento(200 + i));
  const principali = Math.min(righeMazzo, 250);
  g.deck.main = Object.fromEntries(Array.from({ length: principali }, (_, i) => [String(100000 + i), 1]));
  g.deck.sideboard = Object.fromEntries(Array.from({ length: righeMazzo - principali },
    (_, i) => [String(200000 + i), 1]));
  return c;
}

// ------------------------------------------------------------ fasi

async function faseLimiti() {
  const prove = [];
  for (const [modo, n, k] of [["letture", 49, 1], ["letture", 50, 1], ["letture", 51, 1],
    ["letture", 999, 1], ["letture", 1000, 1], ["letture", 1001, 1],
    ["batch", 51, 1], ["batch", 1000, 1], ["batch", 1001, 1], ["batch", 2000, 1],
    ["batchmulti", 400, 3], ["misto", 45, 10], ["misto", 990, 20]]) {
    const r = await sonda("limite", { modo, n, k });
    prove.push({ modo, n, k, stato: r.stato, ...r.corpo, ms: r.ms });
  }
  evidenze.fasi.limiti = prove;
  const letture = prove.filter((p) => p.modo === "letture");
  const massimo = Math.max(...letture.filter((p) => p.ok).map((p) => p.n), 0);
  const primoNo = letture.find((p) => !p.ok);
  evidenze.fasi.limite_letture = { massimo_ok: massimo, primo_fallito: primoNo?.n ?? null,
    completate_al_fallimento: primoNo?.completate ?? null, errore: primoNo?.errore ?? null };
  verifica("limiti · il limite di query per invocazione e' misurato", massimo > 0, prove);
}

async function faseRollback() {
  const casi = {};
  for (const caso of ["check", "unique", "fk", "ok"]) casi[caso] = (await sonda("rollback", { caso })).corpo;
  evidenze.fasi.rollback = casi;
  // Deve scattare proprio il vincolo del caso, non un errore qualsiasi.
  const atteso = { check: /CHECK constraint/i, unique: /UNIQUE constraint/i, fk: /FOREIGN KEY constraint/i };
  for (const caso of ["check", "unique", "fk"]) {
    verifica(`rollback · ${caso} dentro batch() annulla anche lo statement precedente`,
      atteso[caso].test(casi[caso].errore || "") && casi[caso].righe_dopo === 0, casi[caso]);
  }
  verifica("rollback · batch() riuscito lascia la riga", casi.ok.errore === null && casi.ok.righe_dopo === 1, casi.ok);
  const sql = (await sonda("sql", {})).corpo;
  evidenze.fasi.funzioni_sql = sql;
  verifica("sql · json_each e row value NOT IN disponibili", sql.json_each === 3 && sql.row_value_not_in === 1, sql);
}

function uguaglianze(nome, r) {
  const d = r.corpo?.diagnostica;
  if (!d) return;
  verifica(`${nome} · letture al binding = ledger`, r.strumento.letture === d.letture, { d, s: r.strumento });
  verifica(`${nome} · statement al binding = tentati = pianificati`,
    r.strumento.statement === d.statement_tentati && d.statement_tentati === d.statement_pianificati,
    { d, s: r.strumento });
  verifica(`${nome} · charged = letture + statement`, d.charged === d.letture + d.statement_tentati, d);
}

async function faseFlusso(budget) {
  const config = { RESEARCH_MAX_D1_QUERIES_PER_REQUEST: String(budget), RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST: "5" };
  const chi = identita();
  const passi = {};
  const token = await consenso(chi, { config });
  verifica("flusso · consenso e generation", /^[0-9a-f]{64}$/.test(token || ""), token ? "ok" : "manca");
  const ids = [esa(32), esa(32)];
  const partite = [conId(bo1(), ids[0]), conId(bo3(), ids[1])];
  passi.upload = await applica("/research/partite", busta(chi, partite), { token, config });
  verifica("flusso · upload: due accepted_new", passi.upload.corpo?.risultati?.every((r) => r.stato === "accepted_new"), passi.upload.corpo);
  uguaglianze("flusso upload", passi.upload);
  passi.retry = await applica("/research/partite", busta(chi, partite), { token, config });
  verifica("flusso · retry identico: unchanged e zero statement",
    passi.retry.corpo?.risultati?.every((r) => r.stato === "unchanged") && passi.retry.strumento.statement === 0, passi.retry.corpo);
  const piu = conId(bo1(), ids[0]); piu.revisione.osservazioni = 3; piu.turni = 7;
  passi.update = await applica("/research/partite", busta(chi, [piu]), { token, config });
  verifica("flusso · revisione maggiore: updated", passi.update.corpo?.risultati?.[0]?.stato === "updated", passi.update.corpo);
  uguaglianze("flusso update", passi.update);
  const esiti = [];
  for (const turni of [8, 9, 10, 11]) {
    const v = conId(bo1(), ids[0]); v.revisione.osservazioni = 3; v.turni = turni;
    const r = await applica("/research/partite", busta(chi, [v]), { token, config });
    esiti.push(r.corpo?.risultati?.[0]?.stato);
  }
  passi.varianti = esiti;
  verifica("flusso · conflitto e overflow su D1 reale",
    JSON.stringify(esiti) === JSON.stringify(["conflict", "conflict", "conflict_overflow", "conflict_overflow"]), esiti);
  passi.revoca = await applica("/research/consenso/revoca", { mittente: chi.mittente, segreto_cancellazione: chi.segreto }, { config });
  passi.dopo_revoca = await applica("/research/partite", busta(chi, partite), { token, config });
  verifica("flusso · dopo la revoca 403 generation_inactive", passi.dopo_revoca.stato === 403, passi.dopo_revoca.corpo);
  const nuovo = await consenso(chi, { config });
  passi.elimina = await applica("/research/elimina", { mittente: chi.mittente, segreto_cancellazione: chi.segreto }, { config });
  let giri = 0;
  while (passi.elimina.corpo?.stato === "deleting" && giri < 20) {
    passi.elimina = await applica("/research/elimina", { mittente: chi.mittente, segreto_cancellazione: chi.segreto }, { config });
    giri += 1;
  }
  verifica("flusso · delete completato", passi.elimina.corpo?.stato === "deleted", passi.elimina.corpo);
  const stato = (await sonda("stato", { mittente: chi.mittente })).corpo;
  passi.stato_dopo_delete = stato;
  verifica("flusso · nessuna riga della lineage dopo il delete",
    ["research_contribution", "research_event", "research_deck_card", "research_revisione_server",
      "research_consent_generation"].every((t) => stato[t] === 0), stato);
  passi.vecchio_token = await applica("/research/partite", busta(chi, partite), { token: nuovo, config });
  verifica("flusso · vecchia coda dopo il delete: 403", passi.vecchio_token.stato === 403, passi.vecchio_token.corpo);
  const terzo = await consenso(chi, { config });
  passi.replay = await applica("/research/partite", busta(chi, partite), { token: terzo, config });
  verifica("flusso · stesso id dopo delete e nuovo consenso: deleted_contribution",
    passi.replay.corpo?.risultati?.every((r) => r.motivo_codice === "deleted_contribution"), passi.replay.corpo);
  evidenze.fasi.flusso = passi;
}

async function faseBudget(limite) {
  const esiti = {};
  const chi = identita();
  const largo = { RESEARCH_MAX_D1_QUERIES_PER_REQUEST: String(limite), RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST: "33" };
  const token = await consenso(chi, { config: largo });
  const quattro = await applica("/research/partite", busta(chi, [conId(bo1(), esa(32)), conId(bo3(), esa(32))]),
    { token, config: { ...largo, RESEARCH_MAX_D1_QUERIES_PER_REQUEST: "4" } });
  esiti.budget4 = quattro;
  verifica("budget · budget 4: quattro letture al binding, nessuno statement, 413",
    quattro.stato === 413 && quattro.strumento.letture === 4 && quattro.strumento.statement === 0, quattro);
  const shape = [forma(0, { eventi: 141, righeMazzo: 1 })];
  const misura = await applica("/research/partite", busta(chi, shape), { token, config: largo });
  const costo = misura.corpo?.diagnostica?.charged;
  esiti.misura_n1 = misura;
  uguaglianze("budget N=1 141 eventi", misura);
  const altro = [forma(1, { eventi: 141, righeMazzo: 1 })];
  const sotto = await applica("/research/partite", busta(chi, altro),
    { token, config: { ...largo, RESEARCH_MAX_D1_QUERIES_PER_REQUEST: String(costo - 1) } });
  esiti.costo_meno_uno = sotto;
  verifica(`budget · costo-1 (${costo - 1}): 413 senza statement`, sotto.stato === 413 && sotto.strumento.statement === 0, sotto);
  const esatto = await applica("/research/partite", busta(chi, altro),
    { token, config: { ...largo, RESEARCH_MAX_D1_QUERIES_PER_REQUEST: String(costo) } });
  esiti.costo_esatto = esatto;
  verifica(`budget · costo esatto (${costo}): accettato con charged = costo`,
    esatto.stato === 200 && esatto.corpo?.diagnostica?.charged === costo, esatto);
  evidenze.fasi.budget = { costo_n1: costo, ...esiti };
}

async function fasePayload(limite) {
  const righe = [];
  const forme = {
    "golden N=2": () => [bo1(), bo3()].map((c) => conId(c, esa(32))),
    "N=1 141 eventi": () => [forma(0, { eventi: 141, righeMazzo: 1 })],
    "N=33 x 500 righe di mazzo": () => Array.from({ length: 33 }, (_, i) => forma(i, { righeMazzo: 500 })),
    "N=33 x 500 righe + 551 eventi": () => Array.from({ length: 33 }, (_, i) =>
      forma(i, { righeMazzo: 500, eventi: i < 23 ? 17 : 16 })),
  };
  for (const [nome, crea] of Object.entries(forme)) {
    const chi = identita();
    const config = { RESEARCH_MAX_D1_QUERIES_PER_REQUEST: String(limite), RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST: "33" };
    const token = await consenso(chi, { config });
    const partite = crea();
    const byte = Buffer.byteLength(JSON.stringify(busta(chi, partite)));
    const r = await applica("/research/partite", busta(chi, partite), { token, config });
    righe.push({ forma: nome, byte, stato: r.stato, errore: r.corpo?.errore ?? null,
      charged: r.corpo?.diagnostica?.charged ?? null, statement: r.strumento?.statement,
      letture: r.strumento?.letture, righe_scritte: r.strumento?.righe_scritte,
      righe_lette: r.strumento?.righe_lette, durata_sql_ms: r.strumento?.durata_sql_ms,
      ms_client: r.ms });
  }
  evidenze.fasi.payload = righe;
  verifica("payload · ogni forma accettata o fermata dal budget prima di D1",
    righe.every((r) => r.stato === 200 || (r.stato === 413 && r.statement === 0)), righe);
}

async function faseCorse(limite) {
  const config = { RESEARCH_MAX_D1_QUERIES_PER_REQUEST: String(limite), RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST: "5" };
  const chi = identita();
  const token = await consenso(chi, { config });
  const id = esa(32);
  const invii = Array.from({ length: 12 }, (_, i) => {
    const c = conId(bo1(), id); c.revisione.osservazioni = i + 1; return c;
  });
  const risposte = await Promise.all(invii.map((c) => applica("/research/partite", busta(chi, [c]), { token, config })));
  const esiti = risposte.map((r) => r.corpo?.risultati?.[0]?.stato ?? `HTTP ${r.stato}`);
  const stato = (await sonda("stato", { mittente: chi.mittente })).corpo;
  const finale = stato.revisioni?.[0]?.o;
  const scritte = invii.filter((_, i) => ["accepted_new", "updated"].includes(esiti[i]))
    .map((c) => c.revisione.osservazioni);
  evidenze.fasi.corsa_cas = { esiti, revisione_finale: finale, scritte };
  verifica("corse · 12 upload concorrenti: resta la revisione maggiore fra quelle scritte",
    finale === Math.max(...scritte) && !esiti.some((e) => /HTTP 5/.test(e)), { esiti, finale });

  const chi2 = identita();
  const token2 = await consenso(chi2, { config });
  const iniziali = Array.from({ length: 5 }, () => conId(bo1(), esa(32)));
  await applica("/research/partite", busta(chi2, iniziali), { token: token2, config });
  const volo = Array.from({ length: 5 }, () => conId(bo1(), esa(32)));
  const [del, ...up] = await Promise.all([
    applica("/research/elimina", { mittente: chi2.mittente, segreto_cancellazione: chi2.segreto }, { config }),
    ...volo.map((c) => applica("/research/partite", busta(chi2, [c]), { token: token2, config })),
  ]);
  let fine = del;
  for (let giri = 0; fine.corpo?.stato !== "deleted" && giri < 20; giri += 1) {
    fine = await applica("/research/elimina", { mittente: chi2.mittente, segreto_cancellazione: chi2.segreto }, { config });
  }
  const dopo = (await sonda("stato", { mittente: chi2.mittente })).corpo;
  evidenze.fasi.corsa_delete = { delete: del.corpo, upload: up.map((u) => u.corpo?.risultati?.[0] ?? u.corpo), finale: fine.corpo, stato: dopo };
  verifica("corse · delete in corsa con 5 upload: lineage vuota a delete concluso",
    fine.corpo?.stato === "deleted" && dopo.research_contribution === 0 && dopo.research_revisione_server === 0, evidenze.fasi.corsa_delete);
}

async function faseQualification() {
  const chi = identita();
  const casi = {};
  for (const tipo of ["assente", "stale", "divergente", "invalida"]) {
    const r = await applica("/research/partite", busta(chi, [bo1()]), { token: "a".repeat(64), qualification: tipo });
    casi[tipo] = { stato: r.stato, errore: r.corpo?.errore, motivo: r.corpo?.motivo,
      d1: r.strumento.letture + r.strumento.statement };
    verifica(`qualification · ${tipo}: 503 senza nessuna chiamata D1`, r.stato === 503 && casi[tipo].d1 === 0, casi[tipo]);
  }
  evidenze.fasi.qualification = casi;
}

// ------------------------------------------------------------ main

async function esegui() {
  if (!SIMULAZIONE) {
    const salute = await chiama("/salute", { metodo: "GET" });
    evidenze.fasi.salute = salute.corpo?.research;
    verifica("salute · il Worker di staging risponde", salute.stato === 200, salute);
  }
  const scelte = new Set(FASI);
  if (scelte.has("limiti")) await faseLimiti();
  // Senza la fase dei limiti vale il limite gia' misurato sullo staging (1.000).
  const limite = Math.min(Math.max(1, evidenze.fasi.limite_letture?.massimo_ok ?? 1000), 1000);
  if (scelte.has("rollback")) await faseRollback();
  if (scelte.has("qualification")) await faseQualification();
  if (scelte.has("flusso")) await faseFlusso(limite);
  if (scelte.has("budget")) await faseBudget(limite);
  if (scelte.has("payload")) await fasePayload(limite);
  if (scelte.has("corse")) await faseCorse(limite);
}

SIMULAZIONE = true;
await esegui();
SIMULAZIONE = false;
fermaSeOltre(stimaPreventiva, TETTO);
evidenze.fasi = {};
inviate.clear();
righeLineage.clear();
budget = new BudgetRighe(TETTO);
let fermata = null;
try {
  await esegui();
} catch (errore) {
  if (!(errore instanceof RigheOltreBudget)) throw errore;
  fermata = errore.message;
  console.error(`fermata dal budget prima della richiesta: ${fermata}`);
}
evidenze.finita = new Date().toISOString();
evidenze.budget_righe = { tetto: TETTO, stima_preventiva: stimaPreventiva, fasi: FASI,
  consumate: budget.consumate, oltre_stima: budget.oltre_stima, fermata };
evidenze.verdetti = verdetti;
if (USCITA) writeFileSync(USCITA, JSON.stringify(evidenze, null, 1));
const passate = verdetti.filter((v) => v.ok).length;
console.log(`righe scritte: ${budget.consumate} su un tetto di ${TETTO} (stima preventiva ${stimaPreventiva})`);
console.log(`acceptance G5C-03: ${passate}/${verdetti.length} verifiche passate`);
process.exit(fermata ? 3 : passate === verdetti.length ? 0 : 1);
