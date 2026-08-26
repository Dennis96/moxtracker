import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { sospettoDraft } from "../src/draft.js";

// Usare il binding del wrangler.toml: con Wrangler 4.123 il nome del database
// viene elencato correttamente ma `d1 execute <nome> --remote` puo' rispondere
// 7403; il binding risolve lo stesso UUID e funziona in modo affidabile.
const DATABASE = "DRAFT_DB";
const BUCKET = "moxtracker-draft-raw";
const CONFERMA_LETTURA = "LEGGI-TRACCE-DRAFT-PRIVATE";
const CONFERMA_RICHIESTA = "AGGIORNA-DRAFT-SOSPETTI";
const WRANGLER_CLI = fileURLToPath(
  new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));

function wrangler(argomenti, opzioni = {}) {
  try {
    return execFileSync(process.execPath, [WRANGLER_CLI, ...argomenti], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error(opzioni.privato
      ? "lettura R2 fallita; dettagli privati non mostrati"
      : "comando Wrangler fallito");
  }
}

function valoreSql(valore) {
  if (valore === null) return "NULL";
  return `'${String(valore).replaceAll("'", "''")}'`;
}

function leggiRigheD1() {
  const uscita = wrangler([
    "d1", "execute", DATABASE, "--remote", "--json",
    "--command", "SELECT id, oggetto_r2, sospetto FROM draft ORDER BY id",
  ]);
  const risposta = JSON.parse(uscita);
  const blocco = Array.isArray(risposta) ? risposta[0] : risposta;
  return blocco?.results || blocco?.result?.[0]?.results || [];
}

function leggiTraccia(chiave) {
  if (typeof chiave !== "string" ||
      !/^[0-9]{4}-[0-9]{2}\/[0-9a-f]{32}\.json$/.test(chiave)) {
    throw new Error("chiave R2 non valida nell'indice Draft");
  }
  const corpo = wrangler([
    "r2", "object", "get", `${BUCKET}/${chiave}`, "--remote", "--pipe",
  ], { privato: true });
  return JSON.parse(corpo);
}

function preparaAggiornamenti(righe) {
  const aggiornamenti = [];
  const riepilogo = { analizzate: 0, invariate: 0, da_marcare: 0, da_smarcare: 0,
    motivo_cambiato: 0 };
  for (const riga of righe) {
    if (!/^[0-9a-f]{32}$/.test(String(riga.id || ""))) {
      throw new Error("id Draft non valido nell'indice D1");
    }
    const calcolato = sospettoDraft(leggiTraccia(riga.oggetto_r2));
    const attuale = riga.sospetto ?? null;
    riepilogo.analizzate += 1;
    if (calcolato === attuale) riepilogo.invariate += 1;
    else if (attuale === null) riepilogo.da_marcare += 1;
    else if (calcolato === null) riepilogo.da_smarcare += 1;
    else riepilogo.motivo_cambiato += 1;
    if (calcolato !== attuale) aggiornamenti.push({
      id: riga.id, attuale, calcolato,
    });
  }
  return { aggiornamenti, riepilogo };
}

function sqlAggiornamenti(aggiornamenti) {
  const comandi = aggiornamenti.map(({ id, attuale, calcolato }) => {
    const confronto = attuale === null
      ? "sospetto IS NULL"
      : `sospetto = ${valoreSql(attuale)}`;
    return `UPDATE draft SET sospetto = ${valoreSql(calcolato)} ` +
      `WHERE id = '${id}' AND ${confronto};`;
  });
  return ["BEGIN IMMEDIATE;", ...comandi, "COMMIT;"].join("\n");
}

function argomento(nome) {
  const prefisso = `--${nome}=`;
  return process.argv.find((voce) => voce.startsWith(prefisso))?.slice(prefisso.length);
}

if (process.argv.includes("--help")) {
  console.log(`Uso:\n  node strumenti/ricalcola_sospetti_draft.mjs ` +
    `--conferma-lettura=${CONFERMA_LETTURA}\n\n` +
    `Per applicare, solo dopo autorizzazione esplicita:\n  node ` +
    `strumenti/ricalcola_sospetti_draft.mjs --conferma-lettura=${CONFERMA_LETTURA} ` +
    `--apply --conferma=${CONFERMA_RICHIESTA}`);
  process.exit(0);
}

const applica = process.argv.includes("--apply");
if (argomento("conferma-lettura") !== CONFERMA_LETTURA) {
  throw new Error(`la lettura privata richiede --conferma-lettura=${CONFERMA_LETTURA}`);
}
if (applica && argomento("conferma") !== CONFERMA_RICHIESTA) {
  throw new Error(`per applicare serve --conferma=${CONFERMA_RICHIESTA}`);
}

console.error("Lettura privata R2→D1: non vengono stampati payload, chiavi o identificativi.");
const { aggiornamenti, riepilogo } = preparaAggiornamenti(leggiRigheD1());
console.log(JSON.stringify({ modalita: applica ? "applica" : "analisi", ...riepilogo }, null, 2));

if (!applica) {
  console.error("Nessun dato modificato. Per applicare serve autorizzazione esplicita e il flag di conferma.");
  process.exit(aggiornamenti.length ? 2 : 0);
}

if (aggiornamenti.length) {
  wrangler([
    "d1", "execute", DATABASE, "--remote", "--yes", "--command",
    sqlAggiornamenti(aggiornamenti),
  ]);
}
const dopo = new Map(leggiRigheD1().map((riga) => [riga.id, riga.sospetto ?? null]));
if (aggiornamenti.some((riga) => dopo.get(riga.id) !== riga.calcolato)) {
  throw new Error("verifica D1 fallita dopo l'aggiornamento");
}
console.error(`Aggiornamento verificato: ${aggiornamenti.length} righe candidate.`);
