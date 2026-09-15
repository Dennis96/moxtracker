// Il Worker vero su SQLite locale, per la prova end-to-end di Research.
//
// NON e' un deploy e non parla con Cloudflare: gira su 127.0.0.1, con un
// database SQLite su file (cosi' sopravvive a un riavvio) e con le chiavi HMAC
// pubbliche dei vettori G5C-04, che il Worker accetta solo con
// RESEARCH_AMBIENTE=prova_locale. Lo lancia `mox-core/strumenti/prove_research_e2e.py`.
//
//   node strumenti/research_server_locale.mjs --db <file> [--porta 0] [--cap 5] [--query 500]
//
// Quando e' pronto scrive una riga sola: `PRONTO http://127.0.0.1:<porta>`.

import { createServer } from "node:http";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import { creaFintoD1 } from "../prove/finto-d1.js";

const argomenti = process.argv.slice(2);
function opzione(nome, ripiego) {
  const indice = argomenti.indexOf(`--${nome}`);
  return indice >= 0 ? argomenti[indice + 1] : ripiego;
}

const file = opzione("db", null);
if (!file) {
  console.error("serve --db <file>");
  process.exit(2);
}
// `--staging`: il Worker di staging G5C-03 (con le sonde) invece di quello
// nudo, per provare in locale lo script di acceptance prima di andare su D1.
const staging = argomenti.includes("--staging");
const server = (await import(staging ? "./research-staging/worker.mjs" : "../src/index.js")).default;
const cap = Number(opzione("cap", "5"));
const query = Number(opzione("query", "500"));
const schema = fileURLToPath(new URL("../schema.sql", import.meta.url));
const db = creaFintoD1(schema, { file });

const ambiente = {
  DB: db,
  ...(staging ? { RESEARCH_MISURE: "attive", RESEARCH_MISURE_TOKEN: process.env.MOX_STAGING_TOKEN } : {}),
  RESEARCH_ENABLED: "true",
  RESEARCH_AMBIENTE: "prova_locale",
  RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST: String(cap),
  RESEARCH_MAX_D1_QUERIES_PER_REQUEST: String(query),
  RESEARCH_DEPLOYMENT: "e2e-locale",
  RESEARCH_RUNTIME_QUALIFICATION: JSON.stringify({ versione: 1, id: "q-e2e-locale",
    deployment: "e2e-locale", max_contributions_per_request: cap,
    max_d1_queries_per_request: query, valida_fino: "2099-01-01T00:00:00Z" }),
  RESEARCH_HMAC_KEYS: JSON.stringify({
    lineage: { corrente: 7, versioni: {
      7: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f" } },
    tombstone: { corrente: 9, versioni: {
      9: "202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f" } },
  }),
};

const http = createServer(async (entrata, uscita) => {
  try {
    const indirizzo = `http://127.0.0.1${entrata.url}`;
    const conCorpo = entrata.method !== "GET" && entrata.method !== "HEAD";
    const richiesta = new Request(indirizzo, {
      method: entrata.method,
      headers: entrata.headers,
      body: conCorpo ? Readable.toWeb(entrata) : undefined,
      duplex: conCorpo ? "half" : undefined,
    });
    const risposta = await server.fetch(richiesta, ambiente);
    uscita.writeHead(risposta.status, Object.fromEntries(risposta.headers));
    uscita.end(Buffer.from(await risposta.arrayBuffer()));
  } catch (guasto) {
    console.error("server locale: guasto", guasto?.name || "errore");
    uscita.writeHead(500, { "content-type": "application/json" });
    uscita.end(JSON.stringify({ errore: "guasto_del_server_locale" }));
  }
});

http.listen(Number(opzione("porta", "0")), "127.0.0.1", () => {
  console.log(`PRONTO http://127.0.0.1:${http.address().port}`);
});

for (const segnale of ["SIGINT", "SIGTERM"]) {
  process.on(segnale, () => { http.close(); db.chiudi(); process.exit(0); });
}
