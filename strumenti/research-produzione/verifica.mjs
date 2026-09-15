// Il controllo prima di un deploy di produzione con Research: stampa cosa il
// deploy userebbe (Worker, rotte, D1, variabili Research, limitatori) e si
// ferma con codice 1 se qualcosa non torna. Non legge segreti e non parla con
// Cloudflare: e' il "dry-run" verificabile del blocker B4.
//
//   node strumenti/research-produzione/verifica.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { controllaProduzione, descriviDeploy, leggiToml } from "./config-produzione.mjs";

const RADICE = fileURLToPath(new URL("../../", import.meta.url));
const produzione = leggiToml(readFileSync(RADICE + "wrangler.toml", "utf8"));
const staging = leggiToml(readFileSync(RADICE + "wrangler.research-staging.toml", "utf8"));
const d = descriviDeploy(produzione);

console.log(`Worker: ${d.worker}`);
console.log(`Rotte: ${d.rotte.join(", ") || "nessuna"}`);
for (const [binding, id] of Object.entries(d.d1)) console.log(`D1 ${binding}: ${id}`);
for (const [chiave, valore] of Object.entries(d.research)) console.log(`${chiave} = ${valore}`);
for (const [nome, l] of Object.entries(d.limitatori)) {
  console.log(`Limitatore ${nome}: namespace ${l.namespace_id}, ${l.limit} ogni ${l.period} s`);
}
console.log("Segreti richiesti (fuori da Git): RESEARCH_HMAC_KEYS");
const guai = controllaProduzione(produzione, staging);
for (const guaio of guai) console.error(`NO: ${guaio}`);
console.log(guai.length ? "verifica: da correggere" : "verifica: ok");
process.exit(guai.length ? 1 : 0);
