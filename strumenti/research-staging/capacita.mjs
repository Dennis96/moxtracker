// Il benchmark di capacita' Research contro il Worker di STAGING.
//
//   MOX_STAGING_TOKEN=<token misure> node strumenti/research-staging/capacita.mjs \
//     --url https://moxtracker-research-staging.<sottodominio>.workers.dev --limite 50 --out capacita.json
//
// Per ogni forma di contribution (tipica, p95, grande, worst-case legale) e
// per alcuni batch rappresentativi misura, sul D1 reale: query riservate,
// letture e statement arrivati al binding, rows_read e rows_written di D1,
// durata SQL, crescita del database (`size_after`) e latenza vista dal
// client. La CPU si legge a parte da `wrangler tail`. Dati solo sintetici.
//
// Le forme sono sintetiche ma dimensionate sulle misure del corpus reale
// (G4: contribution media 3.332 byte, p95 5.379, massimo 7.983; al massimo 3
// game, 63 eventi per game, 77 voci di main e 19 copie di sideboard). Il
// worst-case legale e' il massimo che il validator ammette.

import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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

const QUI = fileURLToPath(new URL(".", import.meta.url));
const GOLDEN = JSON.parse(readFileSync(QUI + "../../prove/fixtures/research-golden-rev2.json", "utf8"));
const copia = (x) => JSON.parse(JSON.stringify(x));
const esa = (n) => randomBytes(n).toString("hex");

async function applica(percorso, corpo, { token, config } = {}) {
  const inizio = performance.now();
  const r = await fetch(`${BASE}/__misure/applica`, { method: "POST",
    headers: { "content-type": "application/json", "x-mox-misure": TOKEN },
    body: JSON.stringify({ percorso, corpo, config,
      headers: token ? { authorization: `Bearer ${token}` } : {} }) });
  const dati = await r.json();
  return { ...dati, ms: Math.round(performance.now() - inizio) };
}

// Un game con `eventi` eventi propri, `main` voci di mazzo e `side` voci di
// sideboard. Le carte sono grpId sintetici; gli event_id sono casuali.
function game(numero, { eventi, main, side }) {
  const g = { game_number: numero, on_play: numero % 2 === 1, mulligans: 0, free_mulligans: 0,
    mulligan_type: "MulliganType_London", result: "vinta", turni: 9,
    state_reset_observed: false, state_gap_observed: false,
    deck: { main: Object.fromEntries(Array.from({ length: main }, (_, i) => [String(70000 + i), i < 20 ? 3 : 1])),
      sideboard: Object.fromEntries(Array.from({ length: side }, (_, i) => [String(90000 + i), 1])) },
    deck_source: { kind: "initial_declaration" } };
  const somma = Object.values(g.deck.main).reduce((a, b) => a + b, 0);
  if (somma > 250) g.deck.main = Object.fromEntries(Object.keys(g.deck.main).map((k) => [k, 1]));
  const tipi = ["draws", "casts", "lands"];
  const quanti = [Math.ceil(eventi * 0.45), Math.ceil(eventi * 0.35), 0];
  quanti[2] = Math.max(0, eventi - quanti[0] - quanti[1]);
  if (eventi > 400) throw new Error("oltre il validator");
  // Oltre 200 per tipo si sposta sugli altri tipi (limite del validator).
  for (let i = 0; i < 3; i += 1) {
    if (quanti[i] > 200) { const avanzo = quanti[i] - 200; quanti[i] = 200; quanti[(i + 1) % 3] += avanzo; }
  }
  tipi.forEach((t, i) => {
    if (quanti[i]) g[t] = Array.from({ length: quanti[i] }, (_, j) => ({ event_id: esa(32), turno: 1 + (j % 40), card_id: 70000 + (j % 20) }));
  });
  return g;
}

function contribution(forma) {
  const base = copia(GOLDEN.richiesta.partite[0]);
  const games = forma.games.map((g, i) => game(i + 1, g));
  return { id_pubblico: esa(32), revisione: { modello: 1, osservazioni: 1 },
    quando: base.quando, fuso: base.fuso, turni: 12, evento: "SyntheticBench", esito: "vinta",
    arena: base.arena, avversario: { carte: Array.from({ length: forma.avversario }, (_, i) => 80000 + i) },
    games };
}

const FORME = {
  tipica: { games: [{ eventi: 20, main: 30, side: 0 }], avversario: 8 },
  p95: { games: [{ eventi: 25, main: 32, side: 10 }, { eventi: 25, main: 32, side: 10 }], avversario: 14 },
  grande: { games: [{ eventi: 63, main: 77, side: 19 }, { eventi: 40, main: 77, side: 19 },
    { eventi: 40, main: 77, side: 19 }], avversario: 27 },
  "worst-case legale": { games: Array.from({ length: 5 }, () => ({ eventi: 400, main: 250, side: 250 })),
    avversario: 200 },
};

const percentile = (valori, p) => {
  const ordinati = [...valori].sort((a, b) => a - b);
  return ordinati[Math.min(ordinati.length - 1, Math.floor((p / 100) * ordinati.length))];
};

async function misura(nome, crea, n, ripetizioni) {
  const chi = { mittente: esa(16), segreto: esa(32) };
  const config = { RESEARCH_MAX_D1_QUERIES_PER_REQUEST: String(LIMITE), RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST: "33" };
  const consenso = await applica("/research/consenso", { mittente: chi.mittente,
    segreto_cancellazione: chi.segreto, versione_consenso: 1 }, { config });
  const token = consenso.corpo?.generation;
  const campioni = [];
  let dimensionePrima = consenso.strumento?.dimensione_db_dopo ?? null;
  for (let i = 0; i < ripetizioni; i += 1) {
    const partite = Array.from({ length: n }, crea);
    const corpo = { ...copia(GOLDEN.richiesta), mittente: chi.mittente, segreto_cancellazione: chi.segreto, partite };
    const byte = Buffer.byteLength(JSON.stringify(corpo));
    const r = await applica("/research/partite", corpo, { token, config });
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
for (const [nome, forma] of Object.entries(FORME)) {
  risultati.push(await misura(nome, () => contribution(forma), 1, nome === "worst-case legale" ? 2 : RIPETIZIONI));
}
for (const [nome, n] of [["tipica", 5], ["tipica", 10], ["tipica", 33], ["p95", 10]]) {
  risultati.push(await misura(nome, () => contribution(FORME[nome]), n, 3));
}
const uscita = { url: BASE, limite_query: LIMITE, misurato: new Date().toISOString(), risultati };
if (USCITA) writeFileSync(USCITA, JSON.stringify(uscita, null, 1));
console.log("capacita': misure concluse");
