import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// Lo smoke controlla il Meta separato solo sui siti che lo pubblicano: il
// frontend pre-redesign non ha meta.html e non deve risultare guasto.
const QUI = fileURLToPath(new URL(".", import.meta.url));
const smoke = readFileSync(QUI + "../strumenti/smoke_beta.mjs", "utf8");

test("lo smoke legge il build-manifest e salta il Meta separato dove non esiste", () => {
  assert.match(smoke, /\$\{base\}\/build-manifest\.json/);
  assert.match(smoke, /"meta\.html"/);
  assert.match(smoke, /SALTATO/);
  // I controlli restano: sulla preview con il redesign valgono ancora.
  assert.match(smoke, /\$\{base\}\/meta`/);
  assert.match(smoke, /\$\{base\}\/en\/meta`/);
});
