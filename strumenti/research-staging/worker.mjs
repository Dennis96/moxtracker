// Il Worker di STAGING per l'acceptance G5C-03. Mai in produzione.
//
// E' il Worker vero (`src/index.js`) avvolto da due cose sole, entrambe
// dietro `RESEARCH_MISURE = "attive"` e un token segreto dello staging:
//
// - `/__misure/*`: sonde dirette sul D1 reale (limite di query per
//   invocazione, conteggio degli statement di `batch()`, rollback su CHECK,
//   UNIQUE e FOREIGN KEY, funzioni SQL usate dal planner) e letture di stato
//   per mittente;
// - `/__misure/applica`: una richiesta alle route Research vere, con la
//   configurazione indicata dal chiamante e il binding D1 strumentato. La
//   risposta porta, accanto a quella del Worker, quante letture e quanti
//   statement hanno raggiunto davvero D1 e il `meta` che D1 restituisce.
//
// Senza token (o con le misure spente) tutto `/__misure/*` risponde 404 e il
// resto va al Worker vero senza modifiche.

import server from "../../src/index.js";

const TABELLE = ["research_contribution", "research_contribution_variante",
  "research_snapshot_storia", "research_revisione_server", "research_game_contribution",
  "research_event", "research_deck_card", "research_sideboard_delta",
  "research_consent_generation"];

function json(corpo, stato = 200) {
  return new Response(JSON.stringify(corpo), {
    status: stato, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function stessoToken(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length || a.length < 32) {
    return false;
  }
  let d = 0;
  for (let i = 0; i < a.length; i += 1) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function autorizzata(richiesta, ambiente) {
  return ambiente.RESEARCH_MISURE === "attive" &&
    stessoToken(richiesta.headers.get("x-mox-misure"), ambiente.RESEARCH_MISURE_TOKEN);
}

// Il binding strumentato: conta cio' che raggiunge D1 e somma il meta.
export function strumenta(db) {
  const conti = { letture: 0, statement: 0, batch: [], righe_lette: 0, righe_scritte: 0,
    durata_sql_ms: 0, meta_visti: 0 };
  const somma = (meta) => {
    if (!meta) return;
    conti.meta_visti += 1;
    conti.righe_lette += meta.rows_read || 0;
    conti.righe_scritte += meta.rows_written || 0;
    conti.durata_sql_ms += meta.duration || 0;
  };
  const avvolgi = (stmt) => ({
    interno: stmt,
    bind: (...a) => avvolgi(stmt.bind(...a)),
    async first(...x) { conti.letture += 1; return stmt.first(...x); },
    async all() { conti.letture += 1; const r = await stmt.all(); somma(r.meta); return r; },
    async run() { conti.letture += 1; const r = await stmt.run(); somma(r.meta); return r; },
  });
  return {
    conti,
    binding: {
      prepare: (sql) => avvolgi(db.prepare(sql)),
      async batch(stmts) {
        conti.batch.push(stmts.length);
        conti.statement += stmts.length;
        const risultati = await db.batch(stmts.map((s) => s.interno));
        for (const r of risultati || []) somma(r.meta);
        return risultati;
      },
    },
  };
}

function qualificazione(config, tipo) {
  const base = { versione: 1, id: "g5c03-applica", deployment: config.RESEARCH_DEPLOYMENT,
    max_contributions_per_request: Number(config.RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST),
    max_d1_queries_per_request: Number(config.RESEARCH_MAX_D1_QUERIES_PER_REQUEST),
    valida_fino: new Date(Date.now() + 3600000).toISOString().replace(/\.\d{3}Z$/, "Z") };
  if (tipo === "assente") return undefined;
  if (tipo === "stale") return JSON.stringify({ ...base, valida_fino: "2026-01-01T00:00:00Z" });
  if (tipo === "divergente") return JSON.stringify({ ...base, deployment: "altro-deploy" });
  if (tipo === "invalida") return "{";
  return JSON.stringify(base);
}

async function limite(db, { modo, n = 1, k = 1 }) {
  let completate = 0;
  try {
    if (modo === "letture") {
      for (let i = 0; i < n; i += 1) { await db.prepare("SELECT ?1 AS n").bind(i).first(); completate += 1; }
    } else if (modo === "batch" || modo === "batchmulti") {
      for (let j = 0; j < (modo === "batch" ? 1 : k); j += 1) {
        await db.batch(Array.from({ length: n }, (_, i) => db.prepare("SELECT ?1 AS n").bind(i)));
        completate += n;
      }
    } else if (modo === "misto") {
      for (let i = 0; i < n; i += 1) { await db.prepare("SELECT 1").first(); completate += 1; }
      await db.batch(Array.from({ length: k }, () => db.prepare("SELECT 1")));
      completate += k;
    }
    return { ok: true, completate };
  } catch (errore) {
    return { ok: false, completate, errore: String(errore?.message || errore).slice(0, 300) };
  }
}

async function rollback(db, { caso }) {
  const h = (n) => `ff${String(n).padStart(62, "0")}`;
  const marca = { check: h(1), unique: h(2), fk: h(3), ok: h(4) }[caso];
  if (!marca) return { errore: "caso sconosciuto" };
  const primo = db.prepare(`INSERT INTO research_consent_tombstone (hash, creato, motivo)
    VALUES (?1, 'g5c03', 'delete')`).bind(marca);
  const secondo = {
    check: db.prepare("INSERT INTO research_guardia (ok) VALUES (0)"),
    unique: db.prepare(`INSERT INTO research_consent_tombstone (hash, creato, motivo)
      VALUES (?1, 'g5c03', 'delete')`).bind(marca),
    fk: db.prepare(`INSERT INTO research_event (mittente, id_pubblico, game_number, event_type,
      event_id, turno, card_id) VALUES ('m', 'i', 1, 'draw', 'e', 1, 1)`),
    ok: db.prepare("SELECT 1"),
  }[caso];
  let errore = null;
  try { await db.batch([primo, secondo]); } catch (e) { errore = String(e?.message || e).slice(0, 300); }
  const rimaste = await db.prepare(`SELECT COUNT(*) AS n FROM research_consent_tombstone
    WHERE hash = ?1`).bind(marca).first();
  await db.prepare("DELETE FROM research_consent_tombstone WHERE hash = ?1").bind(marca).run();
  return { caso, errore, righe_dopo: rimaste.n };
}

async function funzioniSql(db) {
  const json = await db.prepare("SELECT COUNT(*) AS n FROM json_each(?1)").bind('["a","b","c"]').first();
  const riga = await db.prepare(`SELECT COUNT(*) AS n FROM (SELECT 1 AS a, 2 AS b UNION ALL SELECT 1, 3)
    WHERE (a, b) NOT IN (SELECT 1, 3)`).first();
  const chiavi = await db.prepare("PRAGMA foreign_keys").first();
  return { json_each: json.n, row_value_not_in: riga.n, foreign_keys: chiavi };
}

async function stato(db, { mittente }) {
  const fuori = {};
  for (const tabella of TABELLE) {
    fuori[tabella] = (await db.prepare(`SELECT COUNT(*) AS n FROM ${tabella} WHERE mittente = ?1`)
      .bind(mittente).first()).n;
  }
  for (const tabella of ["research_deleted_contribution", "research_consent_tombstone", "research_lineage"]) {
    fuori[tabella] = (await db.prepare(`SELECT COUNT(*) AS n FROM ${tabella}`).first()).n;
  }
  fuori.revisioni = (await db.prepare(`SELECT id_pubblico, revisione_osservazioni AS o, stato
    FROM research_contribution WHERE mittente = ?1 ORDER BY id_pubblico`).bind(mittente).all()).results;
  return fuori;
}

async function applica(ambiente, corpo) {
  const config = { ...ambiente, ...(corpo.config || {}) };
  config.RESEARCH_RUNTIME_QUALIFICATION = qualificazione(config, corpo.qualification || "valida");
  if (config.RESEARCH_RUNTIME_QUALIFICATION === undefined) delete config.RESEARCH_RUNTIME_QUALIFICATION;
  const s = strumenta(ambiente.DB);
  const headers = { "content-type": "application/json", ...(corpo.headers || {}) };
  const richiesta = new Request(`https://staging.invalid${corpo.percorso}`, {
    method: corpo.metodo || "POST", headers,
    body: corpo.metodo === "GET" ? undefined : JSON.stringify(corpo.corpo),
  });
  const risposta = await server.fetch(richiesta, { ...config, DB: s.binding });
  const testo = await risposta.text();
  let dati = null;
  try { dati = JSON.parse(testo); } catch { dati = { testo: testo.slice(0, 200) }; }
  return { stato: risposta.status, corpo: dati, strumento: s.conti };
}

export default {
  async fetch(richiesta, ambiente, contesto) {
    const indirizzo = new URL(richiesta.url);
    if (!indirizzo.pathname.startsWith("/__misure/")) return server.fetch(richiesta, ambiente, contesto);
    if (!autorizzata(richiesta, ambiente) || richiesta.method !== "POST") {
      return json({ errore: "non c'e' niente qui" }, 404);
    }
    const corpo = await richiesta.json().catch(() => ({}));
    const db = ambiente.DB;
    switch (indirizzo.pathname) {
      case "/__misure/limite": return json(await limite(db, corpo));
      case "/__misure/rollback": return json(await rollback(db, corpo));
      case "/__misure/sql": return json(await funzioniSql(db));
      case "/__misure/stato": return json(await stato(db, corpo));
      case "/__misure/applica": return json(await applica(ambiente, corpo));
      default: return json({ errore: "sonda sconosciuta" }, 404);
    }
  },
};
