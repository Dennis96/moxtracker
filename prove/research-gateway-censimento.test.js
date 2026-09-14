// Il gateway e' davvero l'unica strada verso D1 per Research?
//
// Due prove indipendenti. La prima e' a runtime: un binding spia registra
// ogni statement che tocca una tabella `research_` e pretende che la chiamata
// arrivi da `budget.js`; un percorso che ci arrivasse direttamente fallirebbe
// qui anche se nessuno lo ha mai dichiarato. La seconda guarda il sorgente,
// per un accesso aggiunto domani in un file nuovo che nessuna prova percorre.

import { strict as assert } from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import server from "../src/index.js";
import { creaFintoD1 } from "./finto-d1.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const SRC = join(QUI, "..", "src");
const GOLDEN = JSON.parse(readFileSync(join(QUI, "fixtures", "research-golden-rev2.json"), "utf8"));
const CHIAVI = JSON.stringify({
  lineage: { corrente: 7, versioni: {
    7: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f" } },
  tombstone: { corrente: 9, versioni: {
    9: "202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f" } },
});

function spia(db) {
  const violazioni = [];
  let viste = 0;
  const controlla = (sql) => {
    if (!/research_/.test(sql)) return;
    viste += 1;
    const pila = new Error().stack || "";
    if (!/research[\\/]budget\.js/.test(pila)) violazioni.push(sql.slice(0, 60));
  };
  return {
    violazioni, viste: () => viste,
    binding: {
      prepare(sql) { controlla(sql); return db.prepare(sql); },
      batch(comandi) { return db.batch(comandi); },
    },
  };
}

test("a runtime ogni statement Research passa da budget.js", async () => {
  const db = creaFintoD1(join(QUI, "..", "schema.sql"));
  const s = spia(db);
  const amb = {
    DB: s.binding, RESEARCH_ENABLED: "true", RESEARCH_AMBIENTE: "prova_locale",
    RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST: "5", RESEARCH_MAX_D1_QUERIES_PER_REQUEST: "500",
    RESEARCH_DEPLOYMENT: "prova-locale", RESEARCH_HMAC_KEYS: CHIAVI,
    RESEARCH_RUNTIME_QUALIFICATION: JSON.stringify({ versione: 1, id: "q",
      deployment: "prova-locale", max_contributions_per_request: 5,
      max_d1_queries_per_request: 500, valida_fino: "2099-01-01T00:00:00Z" }),
  };
  const post = async (percorso, corpo, token) => {
    const headers = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    const r = await server.fetch(new Request(`https://e.invalid${percorso}`,
      { method: "POST", headers, body: JSON.stringify(corpo) }), amb);
    return r.json();
  };
  const { mittente, segreto_cancellazione: segreto } = GOLDEN.richiesta;
  const { generation } = await post("/research/consenso",
    { mittente, segreto_cancellazione: segreto, versione_consenso: 1 });
  await post("/research/partite", GOLDEN.richiesta, generation);
  await post("/research/consenso/revoca", { mittente, segreto_cancellazione: segreto });
  await post("/research/elimina", { mittente, segreto_cancellazione: segreto });
  assert.ok(s.viste() > 20, "la spia deve aver visto il flusso intero");
  assert.deepEqual(s.violazioni, []);
});

function sorgenti(cartella) {
  return readdirSync(cartella, { withFileTypes: true }).flatMap((voce) =>
    voce.isDirectory() ? sorgenti(join(cartella, voce.name))
      : voce.name.endsWith(".js") ? [join(cartella, voce.name)] : []);
}

test("nel sorgente solo budget.js tocca i binding D1, e solo src/research nomina le tabelle", () => {
  for (const file of sorgenti(join(SRC, "research"))) {
    if (file.endsWith("budget.js")) continue;
    const testo = readFileSync(file, "utf8");
    assert.ok(!/\b(ambiente|env)\s*(\.|\[\s*["'])\s*(DB|DRAFT_DB)\b/.test(testo), `${file}: binding diretto`);
    assert.ok(!/\.(prepare|batch)\s*\(/.test(testo), `${file}: prepare/batch fuori dal gateway`);
  }
  for (const file of sorgenti(SRC).filter((f) => !/[\\/]research[\\/]/.test(f))) {
    // Una tabella Research usata in SQL fuori da src/research salterebbe il
    // gateway; i codici di errore con «research_» nel nome non sono tabelle.
    assert.ok(!/\b(FROM|INTO|UPDATE|JOIN|TABLE)\s+research_/i.test(readFileSync(file, "utf8")),
      `${file}: tabella Research fuori da src/research`);
  }
});
