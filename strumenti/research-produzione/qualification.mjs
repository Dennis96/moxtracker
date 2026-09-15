// La qualification di runtime di produzione, generata dai valori di
// `wrangler.toml` invece che scritta a mano. Si usa al deploy che porta
// RESEARCH_MODE a on (runbook R3, passo 5):
//
//   node strumenti/research-produzione/qualification.mjs --valida-fino 2026-10-15T00:00:00Z
//
// Stampa il JSON da mettere in RESEARCH_RUNTIME_QUALIFICATION. Non e' un
// segreto, ma scade: alla scadenza l'ingresso si chiude da solo (fail-closed)
// e revoca e cancellazione restano aperte.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { leggiToml, qualificationProduzione } from "./config-produzione.mjs";

const argomenti = process.argv.slice(2);
const opzione = (nome) => { const i = argomenti.indexOf(`--${nome}`); return i >= 0 ? argomenti[i + 1] : null; };
const RADICE = fileURLToPath(new URL("../../", import.meta.url));
const produzione = leggiToml(readFileSync(RADICE + "wrangler.toml", "utf8"));
try {
  console.log(qualificationProduzione(produzione.vars, opzione("valida-fino"),
    opzione("id") || "q-produzione"));
} catch (errore) {
  console.error(errore.message);
  process.exit(2);
}
