// Il kill switch dei dati esterni di Mox: `GET /mox/external-data-policy`.
//
// Le prove passano dal `fetch` vero del Worker, con il secret nell'ambiente
// come lo metterebbe Cloudflare.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import server from "../src/index.js";

const PERCORSO = "/mox/external-data-policy";

function politica(modo, altro = {}) {
  return JSON.stringify({
    schema: 1,
    providers: { "17lands": { mode: modo, reason: "prova", updated_at: "2026-09-28T00:00:00Z", ...altro } },
  });
}

async function chiedi(ambiente = {}, metodo = "GET") {
  const risposta = await server.fetch(
    new Request("https://esempio.invalid" + PERCORSO, { method: metodo }), ambiente);
  const testo = await risposta.text();
  return { stato: risposta.status, testo, corpo: testo ? JSON.parse(testo) : null,
    headers: risposta.headers };
}

function controllaIntestazioni(headers) {
  assert.match(headers.get("content-type"), /^application\/json/);
  assert.equal(headers.get("cache-control"), "no-store");
}

for (const modo of ["enabled", "cache_only", "disabled"]) {
  test(`policy ${modo} passa com'e', normalizzata`, async () => {
    const { stato, corpo, headers } = await chiedi({ MOX_EXTERNAL_DATA_POLICY: politica(modo) });
    assert.equal(stato, 200);
    controllaIntestazioni(headers);
    assert.deepEqual(corpo, {
      schema: 1,
      providers: { "17lands": { mode: modo, reason: "prova", updated_at: "2026-09-28T00:00:00Z" } },
      configurata: true,
    });
  });
}

test("secret assente: enabled, come Mox fino alla 2.11.3", async () => {
  for (const ambiente of [{}, { MOX_EXTERNAL_DATA_POLICY: "" }]) {
    const { stato, corpo, headers } = await chiedi(ambiente);
    assert.equal(stato, 200);
    controllaIntestazioni(headers);
    assert.equal(corpo.providers["17lands"].mode, "enabled");
    assert.equal(corpo.configurata, false);
  }
});

test("JSON corrotto: 503 senza modo inventato", async () => {
  const { stato, corpo, headers } = await chiedi({ MOX_EXTERNAL_DATA_POLICY: "{disabled" });
  assert.equal(stato, 503);
  controllaIntestazioni(headers);
  assert.deepEqual(corpo, { errore: "policy dati esterni non valida" });
});

test("schema non supportato: 503", async () => {
  const grezzo = JSON.stringify({ schema: 2, providers: { "17lands": { mode: "enabled" } } });
  const { stato } = await chiedi({ MOX_EXTERNAL_DATA_POLICY: grezzo });
  assert.equal(stato, 503);
});

test("modo sconosciuto o mancante: 503", async () => {
  for (const grezzo of [politica("on"), politica("ENABLED"), politica(""),
    JSON.stringify({ schema: 1, providers: {} }), JSON.stringify({ schema: 1 }),
    JSON.stringify({ schema: 1, providers: { "17lands": "enabled" } }), "null", "[]"]) {
    const { stato } = await chiedi({ MOX_EXTERNAL_DATA_POLICY: grezzo });
    assert.equal(stato, 503, grezzo);
  }
});

test("metodo non GET: 405 senza cache", async () => {
  for (const metodo of ["POST", "PUT", "DELETE", "OPTIONS", "PATCH"]) {
    const { stato, headers } = await chiedi({ MOX_EXTERNAL_DATA_POLICY: politica("disabled") }, metodo);
    assert.equal(stato, 405, metodo);
    assert.equal(headers.get("cache-control"), "no-store");
  }
});

test("nessun leakage del secret, nemmeno quando e' rotto", async () => {
  const marcatore = "SEGRETO-DA-NON-RIPETERE-7f3a";
  const casi = [
    `{"schema":1,"providers":{"17lands":{"mode":"${marcatore}"}}}`,
    `{"schema":1,"nota":"${marcatore}","providers":{"17lands":{"mode":"disabled"}}}`,
    `{${marcatore}`,
  ];
  for (const grezzo of casi) {
    const { testo } = await chiedi({ MOX_EXTERNAL_DATA_POLICY: grezzo });
    assert.doesNotMatch(testo, new RegExp(marcatore));
  }
});

test("motivo e data troncati, campi in piu' ignorati", async () => {
  const { corpo } = await chiedi({ MOX_EXTERNAL_DATA_POLICY: politica("disabled", {
    reason: "x".repeat(500), updated_at: "y".repeat(90), altro: "no" }) });
  const voce = corpo.providers["17lands"];
  assert.equal(voce.reason.length, 200);
  assert.equal(voce.updated_at.length, 40);
  assert.deepEqual(Object.keys(voce).sort(), ["mode", "reason", "updated_at"]);
});
