import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { controllaStorageGiornaliero, eseguiManutenzione } from "../src/monitoraggio.js";
import { compitiManutenzione } from "../src/index.js";
import { creaFintoD1 } from "./finto-d1.js";

const qui = fileURLToPath(new URL(".", import.meta.url));

test("il controllo giornaliero confronta D1 e R2 senza leggere gli oggetti", async () => {
  const DB = creaFintoD1(join(qui, "..", "schema.sql"));
  const DRAFT_DB = creaFintoD1(join(qui, "..", "schema-draft.sql"));
  let liste = 0;
  const rapporto = await controllaStorageGiornaliero({ DB, DRAFT_DB, DRAFT_RAW: {
    async list(opzioni) { liste += 1; assert.equal(opzioni.limit, 1000); return { objects: [], truncated: false }; },
  } });
  assert.equal(liste, 1);
  assert.equal(rapporto.coerente, true);
  assert.equal(rapporto.draft, 0);
  assert.equal(rapporto.oggetti_r2, 0);
});

test("il controllo giornaliero fallisce se l'indice e il bucket divergono", async () => {
  const DB = creaFintoD1(join(qui, "..", "schema.sql"));
  const DRAFT_DB = creaFintoD1(join(qui, "..", "schema-draft.sql"));
  await DRAFT_DB.batch([DRAFT_DB.prepare(`INSERT INTO draft
    (id, mittente, ricevuto, set_code, formato, completo, pick, politica,
     oggetto_r2, byte, versione) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind("1".repeat(32), "2".repeat(32), "2026-08-27T00:00:00Z", "HOB",
      "PremierDraft", 1, 42, "mox", "draft/uno.json", 100, 1)]);
  await assert.rejects(() => controllaStorageGiornaliero({ DB, DRAFT_DB, DRAFT_RAW: {
    async list() { return { objects: [], truncated: false }; },
  } }), /storage Draft incoerente/);
});

async function silenzia(lavoro) {
  const righe = [];
  const [errore, registro, avviso] = [console.error, console.log, console.warn];
  console.error = (...a) => righe.push(a.join(" "));
  console.log = (...a) => righe.push(a.join(" "));
  console.warn = (...a) => righe.push(a.join(" "));
  try {
    return { esito: await lavoro(), righe };
  } catch (guasto) {
    return { guasto, righe };
  } finally {
    [console.error, console.log, console.warn] = [errore, registro, avviso];
  }
}

test("P5: la manutenzione dice quale compito e' fallito, e resta un fallimento", async () => {
  const { guasto, righe } = await silenzia(() => eseguiManutenzione([
    ["retention_contributi", Promise.resolve()],
    ["storage", Promise.reject(new Error("storage Draft incoerente: D1=41, R2=42"))],
    ["ticket", Promise.resolve()],
  ]));
  assert.ok(guasto instanceof AggregateError);
  assert.equal(guasto.message, "manutenzione programmata incompleta: storage");
  const riga = JSON.parse(righe.find((r) => r.includes("manutenzione_compito_fallito")));
  assert.deepEqual(riga, { evento: "manutenzione_compito_fallito", compito: "storage",
    tipo: "Error", messaggio: "storage Draft incoerente: D1=41, R2=42" });
  const riepilogo = JSON.parse(righe.find((r) => r.includes("\"manutenzione_programmata\"")));
  assert.deepEqual(riepilogo.falliti, ["storage"]);
});

test("P5: senza fallimenti la manutenzione passa e lo scrive", async () => {
  const { esito, guasto } = await silenzia(() => eseguiManutenzione([
    ["research", Promise.resolve()], ["credenziali", Promise.resolve()],
  ]));
  assert.equal(guasto, undefined);
  assert.deepEqual(esito, { compiti: 2, falliti: [] });
});

test("P5: i sei compiti hanno un nome, e Brew risulta saltato se la retention fallisce", async () => {
  const { guasto, righe } = await silenzia(() => eseguiManutenzione(compitiManutenzione({})));
  assert.ok(guasto instanceof AggregateError);
  const falliti = righe.filter((r) => r.includes("manutenzione_compito_fallito"))
    .map((r) => JSON.parse(r));
  const riepilogo = JSON.parse(righe.find((r) => r.includes("\"manutenzione_programmata\"")));
  assert.deepEqual(riepilogo.compiti,
    ["retention_contributi", "brew", "research", "ticket", "credenziali", "storage"]);
  // Senza binding Research e' spento e non fallisce; tutti gli altri si'.
  assert.deepEqual(falliti.map((f) => f.compito),
    ["retention_contributi", "brew", "ticket", "credenziali", "storage"]);
  assert.deepEqual(riepilogo.falliti, falliti.map((f) => f.compito));
  assert.match(falliti[1].messaggio, /^saltato: la retention dei contributi/);
});
