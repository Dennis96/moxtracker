// Il benchmark di capacita' Research contro il Worker di STAGING.
//
//   MOX_STAGING_TOKEN=<token misure> node strumenti/research-staging/capacita.mjs \
//     --url https://moxtracker-research-staging.<sottodominio>.workers.dev \
//     --budget-righe <righe scritte> [--forme tipica,p95] [--senza-batch] [--limite 50] [--out capacita.json]
//
// Per ogni forma di contribution (tipica, p95, grande, worst-case legale) e
// per alcuni batch rappresentativi misura, sul D1 reale: query riservate,
// letture e statement arrivati al binding, rows_read e rows_written di D1,
// durata SQL, crescita del database (`size_after`) e latenza vista dal
// client. La CPU si legge a parte da `wrangler tail`. Dati solo sintetici.
//
// `--budget-righe` e' obbligatorio contro lo staging: la quota D1 gratuita e'
// dell'account intero (R3-OP-01). Prima di partire la run stima le righe
// scritte e, se supera il tetto, non manda niente; durante la run si ferma
// prima della richiesta che lo supererebbe. Le forme stanno in `forme.mjs`.

import { writeFileSync } from "node:fs";

import { BudgetRighe, RIGHE_CONSENSO, RigheOltreBudget, fermaSeOltre, righeMisurate, stimaRigheRichiesta,
  tettoDaArgomenti } from "./budget-righe.mjs";
import { FORME, GOLDEN, contribution, copia, esa } from "./forme.mjs";

const argomenti = process.argv.slice(2);
const opzione = (nome, ripiego = null) => {
  const i = argomenti.indexOf(`--${nome}`); return i >= 0 ? argomenti[i + 1] : ripiego;
};
const BASE = opzione("url");
const LIMITE = Number(opzione("limite", "50"));
const RIPETIZIONI = Number(opzione("ripetizioni", "6"));
const USCITA = opzione("out");
const TOKEN = process.env.MOX_STAGING_TOKEN;
const LOCALE = argomenti.includes("--locale") && /^http:\/\/127\.0\.0\.1:\d+$/.test(BASE || "");
if (!LOCALE && (!BASE || !/^https:\/\/moxtracker-research-staging\.[a-z0-9-]+\.workers\.dev$/.test(BASE))) {
  console.error("serve --url dello staging workers.dev"); process.exit(2);
}
if (!TOKEN) { console.error("manca MOX_STAGING_TOKEN"); process.exit(2); }
const TETTO = tettoDaArgomenti(argomenti, LOCALE);
const SCELTE = (opzione("forme") || Object.keys(FORME).join(",")).split(",");
if (SCELTE.some((nome) => !FORME[nome])) {
  console.error(`--forme fra: ${Object.keys(FORME).join(",")}`); process.exit(2);
}

// Il piano: ogni forma da sola, poi (senza `--senza-batch`) alcuni batch
// rappresentativi, che sono la parte che scrive di piu'.
const PIANO = [
  ...Object.keys(FORME).map((nome) => ({ nome, n: 1, ripetizioni: nome === "worst-case legale" ? 2 : RIPETIZIONI })),
  ...(argomenti.includes("--senza-batch") ? []
    : [["tipica", 5], ["tipica", 10], ["tipica", 33], ["p95", 10]].map(([nome, n]) => ({ nome, n, ripetizioni: 3 }))),
].filter((passo) => SCELTE.includes(passo.nome));

// Ogni richiesta porta contribution nuove: niente aggiornamenti da stimare.
const stimaUpload = (nome, n) => n * stimaRigheRichiesta([contribution(FORME[nome])]);
const STIMA = PIANO.reduce((totale, p) => totale + RIGHE_CONSENSO + p.ripetizioni * stimaUpload(p.nome, p.n), 0);
fermaSeOltre(STIMA, TETTO);
const budget = new BudgetRighe(TETTO);

const PAUSA_MS = Number(opzione("pausa", "0"));
let ETICHETTA = "";

// La forma viaggia nella query string: il Worker la ignora, ma `wrangler
// tail` la riporta, e cosi' la CPU si attribuisce alla forma giusta anche
// quando il tail perde qualche evento. La stima si prenota prima di mandare.
async function applica(percorso, corpo, { token, config } = {}, stima) {
  budget.prenota(stima, `${percorso} (${ETICHETTA})`);
  if (PAUSA_MS) await new Promise((r) => setTimeout(r, PAUSA_MS));
  const inizio = performance.now();
  let dati;
  try {
    const r = await fetch(`${BASE}/__misure/applica?${ETICHETTA}`, { method: "POST",
      headers: { "content-type": "application/json", "x-mox-misure": TOKEN },
      body: JSON.stringify({ percorso, corpo, config,
        headers: token ? { authorization: `Bearer ${token}` } : {} }) });
    dati = await r.json();
  } catch (guasto) {
    // Senza risposta la richiesta puo' aver scritto lo stesso: vale la stima.
    budget.registra(null, stima);
    throw guasto;
  }
  budget.registra(righeMisurate(dati.strumento), stima);
  return { ...dati, ms: Math.round(performance.now() - inizio) };
}

const percentile = (valori, p) => {
  const ordinati = [...valori].sort((a, b) => a - b);
  return ordinati[Math.min(ordinati.length - 1, Math.floor((p / 100) * ordinati.length))];
};

async function misura(nome, crea, n, ripetizioni) {
  const chi = { mittente: esa(16), segreto: esa(32) };
  const config = { RESEARCH_MAX_D1_QUERIES_PER_REQUEST: String(LIMITE), RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST: "33" };
  ETICHETTA = `fase=consenso&forma=${encodeURIComponent(nome)}&n=${n}`;
  const consenso = await applica("/research/consenso", { mittente: chi.mittente,
    segreto_cancellazione: chi.segreto, versione_consenso: 1 }, { config }, RIGHE_CONSENSO);
  const token = consenso.corpo?.generation;
  const campioni = [];
  let dimensionePrima = consenso.strumento?.dimensione_db_dopo ?? null;
  ETICHETTA = `fase=upload&forma=${encodeURIComponent(nome)}&n=${n}`;
  for (let i = 0; i < ripetizioni; i += 1) {
    const partite = Array.from({ length: n }, crea);
    const corpo = { ...copia(GOLDEN.richiesta), mittente: chi.mittente, segreto_cancellazione: chi.segreto, partite };
    const byte = Buffer.byteLength(JSON.stringify(corpo));
    const r = await applica("/research/partite", corpo, { token, config }, stimaRigheRichiesta(partite));
    const dopo = r.strumento?.dimensione_db_dopo ?? null;
    campioni.push({ byte, stato: r.stato, errore: r.corpo?.errore ?? null,
      charged: r.corpo?.diagnostica?.charged ?? null, letture: r.strumento?.letture,
      statement: r.strumento?.statement, righe_lette: r.strumento?.righe_lette,
      righe_scritte: r.strumento?.righe_scritte, durata_sql_ms: r.strumento?.durata_sql_ms,
      crescita_db: dopo !== null && dimensionePrima !== null ? dopo - dimensionePrima : null,
      ms_client: r.ms });
    if (dopo !== null) dimensionePrima = dopo;
  }
  const ok = campioni.filter((c) => c.stato === 200);
  const media = (k) => (ok.length ? Math.round(ok.reduce((a, c) => a + (c[k] || 0), 0) / ok.length) : null);
  const riga = { nome, contribution_per_richiesta: n, richieste: ripetizioni, accettate: ok.length,
    esiti: [...new Set(campioni.map((c) => c.errore || c.stato))],
    byte_richiesta: media("byte"), query_riservate: media("charged"), letture: media("letture"),
    statement: media("statement"), rows_read: media("righe_lette"), rows_written: media("righe_scritte"),
    durata_sql_ms: media("durata_sql_ms"), crescita_db_byte: media("crescita_db"),
    latenza_p50_ms: ok.length ? percentile(ok.map((c) => c.ms_client), 50) : null,
    latenza_p95_ms: ok.length ? percentile(ok.map((c) => c.ms_client), 95) : null,
    per_contribution: ok.length ? { rows_written: Math.round(media("righe_scritte") / n),
      rows_read: Math.round(media("righe_lette") / n), query: Math.round(media("charged") / n),
      crescita_db_byte: media("crescita_db") === null ? null : Math.round(media("crescita_db") / n) } : null,
    campioni };
  console.log(`# ${nome} x${n}: ${riga.accettate}/${ripetizioni} ok · query ${riga.query_riservate} · `
    + `rows_written ${riga.rows_written} · rows_read ${riga.rows_read} · +${riga.crescita_db_byte} B · `
    + `p50 ${riga.latenza_p50_ms} ms · esiti ${riga.esiti.join(",")}`);
  return riga;
}

const risultati = [];
let fermata = null;
try {
  for (const passo of PIANO) {
    risultati.push(await misura(passo.nome, () => contribution(FORME[passo.nome]), passo.n, passo.ripetizioni));
  }
} catch (errore) {
  if (!(errore instanceof RigheOltreBudget)) throw errore;
  fermata = errore.message;
  console.error(`fermata dal budget prima della richiesta: ${fermata}`);
}
const uscita = { url: BASE, limite_query: LIMITE, misurato: new Date().toISOString(),
  budget_righe: { tetto: TETTO, stima_preventiva: STIMA, consumate: budget.consumate,
    oltre_stima: budget.oltre_stima, fermata }, risultati };
if (USCITA) writeFileSync(USCITA, JSON.stringify(uscita, null, 1));
console.log(`righe scritte: ${budget.consumate} su un tetto di ${TETTO} (stima preventiva ${STIMA})`);
console.log(fermata ? "capacita': run fermata dal budget" : "capacita': misure concluse");
process.exit(fermata ? 3 : 0);
