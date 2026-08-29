#!/usr/bin/env node
// Genera SQL locale da uno snapshot 17Lands gia' scaricato manualmente dopo
// l'embargo. Non effettua rete, scraping o scritture D1 remote.
import { readFile, writeFile } from "node:fs/promises";

function argomento(nome) {
  const indice = process.argv.indexOf(nome);
  return indice >= 0 ? process.argv[indice + 1] : null;
}
function sql(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function errore(messaggio) { throw new Error(`importa_17lands: ${messaggio}`); }

const input = argomento("--input");
const output = argomento("--output");
if (!input || !output || process.argv.includes("--help")) {
  console.log("Uso: node strumenti/importa_17lands.mjs --input snapshot.json --output import.sql");
  process.exit(process.argv.includes("--help") ? 0 : 2);
}
const snapshot = JSON.parse(await readFile(input, "utf8"));
const set = String(snapshot?.set || "").toUpperCase();
const formato = String(snapshot?.formato || "");
const aggiornato = String(snapshot?.dataset_aggiornato || "");
if (!/^[A-Z0-9]{3,6}$/.test(set) || !formato || !aggiornato || !Array.isArray(snapshot?.carte)) {
  errore("snapshot richiede set, formato, dataset_aggiornato e carte[]");
}
const viste = new Set();
const righe = [];
for (const carta of snapshot.carte) {
  const arenaId = Number(carta?.arena_id);
  const nome = String(carta?.nome || "").trim();
  const colori = Array.isArray(carta?.colori) ? carta.colori.filter(c => /^[WUBRG]$/.test(c)) : [];
  const vittorie = Number(carta?.gih_vittorie);
  const campione = Number(carta?.gih_campione);
  if (!Number.isInteger(arenaId) || arenaId < 1 || !nome || !Number.isInteger(vittorie) ||
      !Number.isInteger(campione) || vittorie < 0 || campione < vittorie || viste.has(arenaId)) {
    errore(`carta non valida o duplicata: ${arenaId || "?"}`);
  }
  viste.add(arenaId);
  righe.push(`(${sql("17Lands")}, ${sql(set)}, ${sql(formato)}, ${arenaId}, ${sql(nome)}, ` +
    `${sql(JSON.stringify(colori))}, ${sql("gih_win_rate")}, ${vittorie}, ${campione}, ${sql(aggiornato)}, datetime('now'))`);
}
const testo = [
  "-- Snapshot 17Lands generato localmente; verificare attribuzione ed embargo prima dell'applicazione.",
  "DELETE FROM draft_stat_esterna WHERE fonte = '17Lands' AND set_code = " + sql(set) +
    " AND formato = " + sql(formato) + " AND metrica = 'gih_win_rate';",
  righe.length ? "INSERT INTO draft_stat_esterna (fonte, set_code, formato, arena_id, nome, colori, metrica, vittorie, campione, dataset_aggiornato, importato) VALUES\n" + righe.join(",\n") + ";" : "",
  "",
].filter(Boolean).join("\n");
await writeFile(output, testo, "utf8");
console.log(`Generato ${output}: ${righe.length} carte ${set}/${formato}. Nessun database e nessuna rete sono stati toccati.`);
