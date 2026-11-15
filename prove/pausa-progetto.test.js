import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import worker, { MESSAGGIO_META_IN_PAUSA, metaInPausa } from "../src/index.js";
import { fileURLToPath } from "node:url";
import { creaFintoD1 } from "./finto-d1.js";

const SCHEMA = fileURLToPath(new URL("../schema.sql", import.meta.url));

// Pausa del progetto (15/11/2026): /meta e /archetipo non leggono D1 finché
// `META_IN_PAUSA` vale "on"; con qualunque altro valore tornano quelle di prima.

function d1CheNonSiTocca() {
  return new Proxy({}, { get() { throw new Error("D1 letto durante la pausa"); } });
}

for (const percorso of ["/meta?formato=Standard", "/archetipo?formato=Standard&id=x",
  "/gioco-risposta?formato=Standard", "/scontri?formato=Standard"]) {
  test(`pausa: ${percorso.split("?")[0]} risponde 503 senza leggere D1`, async () => {
    const env = { META_IN_PAUSA: "on", DB: d1CheNonSiTocca() };
    const r = await worker.fetch(new Request(`https://api.moxtracker.app${percorso}`), env);
    assert.equal(r.status, 503);
    assert.equal(r.headers.get("cache-control"), null);
    assert.equal(r.headers.get("access-control-allow-origin"), "*");
    assert.deepEqual(await r.json(), { errore: MESSAGGIO_META_IN_PAUSA });
  });
}

test("pausa: il metodo sbagliato resta 405 anche in pausa", async () => {
  const env = { META_IN_PAUSA: "on", DB: d1CheNonSiTocca() };
  const r = await worker.fetch(new Request("https://api.moxtracker.app/meta", { method: "POST" }), env);
  assert.equal(r.status, 405);
});

test("pausa: solo \"on\" la accende", () => {
  assert.equal(metaInPausa({ META_IN_PAUSA: "on" }), true);
  for (const valore of [undefined, "", "off", "ON", "true", "1"]) {
    assert.equal(metaInPausa({ META_IN_PAUSA: valore }), false, String(valore));
  }
  assert.equal(metaInPausa(undefined), false);
});

test("senza pausa /meta legge D1 come prima", async () => {
  const r = await worker.fetch(new Request("https://api.moxtracker.app/meta?formato=Standard"),
    { DB: creaFintoD1(SCHEMA) });
  assert.equal(r.status, 200);
});

test("wrangler.toml: la pausa del 15/11/2026 è scritta tutta", () => {
  const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  assert.match(toml, /^META_IN_PAUSA = "on"$/m);
  assert.match(toml, /^RESEARCH_MODE = "drain"$/m);
  assert.match(toml, /^BREW_GRUPPI = "off"$/m);
  assert.match(toml, /^MOX_17LANDS_RACCOLTA = "off"$/m);
  assert.match(toml, /^MOX_DRAFT_API_DISTRIBUTION = "off"$/m);
});
