import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// L'Account funziona da tutte e due le origini del sito: quella ufficiale e la
// preview. SITE_ORIGIN e' anche la base dei link nelle email dei ticket.
const QUI = fileURLToPath(new URL(".", import.meta.url));
const wrangler = readFileSync(QUI + "../wrangler.toml", "utf8");
const variabile = (nome) => wrangler.match(new RegExp(`^${nome}\\s*=\\s*"([^"]+)"`, "m"))?.[1];

test("il Worker accetta l'Account dal sito ufficiale e dalla preview", () => {
  assert.equal(variabile("SITE_ORIGIN"), "https://moxtracker.app");
  assert.equal(variabile("PREVIEW_ORIGIN"), "https://preview.moxtracker.pages.dev");
});
