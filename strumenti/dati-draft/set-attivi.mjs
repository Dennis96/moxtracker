#!/usr/bin/env node
// L'elenco dei set di cui il cron raccoglie le statistiche API (14/10/2026).
//
// Scrive `config/set-attivi.json` nel bucket dei dati Draft: niente deploy per
// un set nuovo. Mostra per ogni set quando finisce l'embargo di 17Lands.
// **Predefinito: `--dry-run`**; scrive solo con `--esegui --conferma-produzione`.
//
//   node strumenti/dati-draft/set-attivi.mjs --set FRA:2026-09-23:PremierDraft,QuickDraft,TradDraft
//   node strumenti/dati-draft/set-attivi.mjs --set CUB:2026-10-01:PremierDraft:speciale --esegui --conferma-produzione
//
// Un `--set` per set: SIGLA:AAAA-MM-GG(uscita su Arena):formati separati da virgola[:speciale].

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { CHIAVE_SET_ATTIVI, fineEmbargo, validaSetAttivi } from "../../src/set-attivi.js";
import { BUCKET } from "./pubblica.mjs";

export function interpreta(voci) {
  return { schema: 1, set: voci.map((testo) => {
    const [set, uscita, formati, speciale] = String(testo).split(":");
    return { set, uscita, formati: (formati ?? "").split(",").filter(Boolean),
      speciale: speciale === "speciale" };
  }) };
}

export function main(argv = process.argv.slice(2), lancia = null) {
  const voci = [];
  let esegui = false, conferma = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--set") voci.push(argv[++i]);
    else if (argv[i] === "--esegui") esegui = true;
    else if (argv[i] === "--conferma-produzione") conferma = true;
    else if (argv[i] !== "--dry-run") throw new Error(`argomento sconosciuto: ${argv[i]}`);
  }
  const dato = interpreta(voci);
  const esito = validaSetAttivi(dato);
  console.log(JSON.stringify({ ...esito, set: dato.set.map((v) => ({ ...v,
    embargo_fino_al: esito.ok ? new Date(fineEmbargo(v)).toISOString().slice(0, 10) : null })) }, null, 1));
  if (!esito.ok) return 2;
  if (!esegui) { console.log("dry-run: elenco non scritto"); return 0; }
  if (!conferma) { console.error("serve anche --conferma-produzione"); return 3; }
  const file = join(mkdtempSync(join(tmpdir(), "mox-set-attivi-")), "set-attivi.json");
  writeFileSync(file, JSON.stringify(dato));
  const scrivi = lancia ?? ((argomenti) => spawnSync("npx", ["wrangler", ...argomenti],
    { stdio: "inherit", shell: process.platform === "win32" }).status);
  return scrivi(["r2", "object", "put", `${BUCKET}/${CHIAVE_SET_ATTIVI}`, "--file", file,
    "--content-type", "application/json", "--remote"]) === 0 ? 0 : 4;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = main();
