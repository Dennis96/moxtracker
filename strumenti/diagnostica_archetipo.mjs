import fs from "node:fs";
import { CATALOGO_ARCHETIPI } from "../src/catalogo-archetipi-generato.js";
import {
  classificaFirma, firmaDaCarte, somiglianza, somiglianzaCore,
} from "../src/archetipi.js";

const file = process.argv[2];
if (!file) {
  console.error("Uso: npm run diagnostica-archetipo -- <file-json-d1>");
  process.exit(2);
}

const raw = JSON.parse(fs.readFileSync(file, "utf8"));
let righe = raw;
if (Array.isArray(raw) && raw[0] && Array.isArray(raw[0].results)) righe = raw[0].results;
else if (raw && Array.isArray(raw.results)) righe = raw.results;
if (!Array.isArray(righe)) throw new Error("Il JSON non contiene una lista di carte D1 leggibile.");

const firma = firmaDaCarte(righe, CATALOGO_ARCHETIPI);
const risultato = classificaFirma(firma, CATALOGO_ARCHETIPI);

const candidati = (CATALOGO_ARCHETIPI.liste || []).map(lista => {
  const core = somiglianzaCore(firma, lista.core || []);
  return {
    id: lista.id,
    archetipo_id: lista.archetipo_id,
    archetipo: lista.archetipo || lista.nome,
    lista: lista.nome,
    somiglianza: somiglianza(firma, lista.firma || {}),
    core: core.punteggio,
    core_carte: `${core.carte}/${core.totale}`,
  };
}).sort((a, b) => b.core - a.core || b.somiglianza - a.somiglianza);

console.log("\nClassificazione:");
console.log(risultato ? JSON.stringify(risultato, null, 2) : "NON CLASSIFICATO");
console.log("\nMigliori candidati:");
for (const c of candidati.slice(0, 8)) {
  console.log(
    `- ${c.archetipo} [${c.id}] | core ${(c.core * 100).toFixed(1)}% (${c.core_carte}) | lista ${(c.somiglianza * 100).toFixed(1)}%`
  );
}
