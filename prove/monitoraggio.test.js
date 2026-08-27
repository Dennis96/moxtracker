import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { controllaStorageGiornaliero } from "../src/monitoraggio.js";
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
