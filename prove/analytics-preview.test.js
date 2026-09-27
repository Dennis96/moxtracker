import assert from "node:assert/strict";
import test from "node:test";
import { aggiungiBeaconPreview } from "../strumenti/analytics_preview.mjs";

const TOKEN = "0123456789abcdef0123456789abcdef";

test("la preview aggiunge un solo beacon ufficiale prima di body", () => {
  const html = aggiungiBeaconPreview("<html><body><main>MOX</main></body></html>", TOKEN);
  assert.match(html, /<script type='module' src='https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js'/);
  assert.match(html, new RegExp(`data-cf-beacon='\\{"token": "${TOKEN}"\\}'`));
  assert.equal((html.match(/beacon\.min\.js/g) || []).length, 1);
  assert.match(html, /<\/script><!-- End Cloudflare Web Analytics -->\n<\/body><\/html>$/);
});

test("la preview rifiuta token errati, HTML incompleto e beacon doppi", () => {
  assert.throws(() => aggiungiBeaconPreview("<body></body>", "errato"), /token/);
  assert.throws(() => aggiungiBeaconPreview("<main>MOX</main>", TOKEN), /body/);
  assert.throws(() => aggiungiBeaconPreview(
    '<body><script src="https://static.cloudflareinsights.com/beacon.min.js"></script></body>', TOKEN),
  /gia' presente/);
});
