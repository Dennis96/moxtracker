import assert from "node:assert/strict";
import test from "node:test";
import { aggiungiBeaconAnalytics, TOKEN_ANALYTICS_PREVIEW,
  TOKEN_ANALYTICS_PRODUZIONE } from "../strumenti/analytics_sito.mjs";

const TOKEN = "0123456789abcdef0123456789abcdef";

test("il sito aggiunge un solo beacon ufficiale prima di body", () => {
  const html = aggiungiBeaconAnalytics("<html><body><main>MOX</main></body></html>", TOKEN);
  assert.match(html, /<script type='module' src='https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js'/);
  assert.match(html, new RegExp(`data-cf-beacon='\\{"token": "${TOKEN}"\\}'`));
  assert.equal((html.match(/beacon\.min\.js/g) || []).length, 1);
  assert.match(html, /<\/script><!-- End Cloudflare Web Analytics -->\n<\/body><\/html>$/);
});

test("il sito rifiuta token errati, HTML incompleto e beacon doppi", () => {
  assert.notEqual(TOKEN_ANALYTICS_PREVIEW, TOKEN_ANALYTICS_PRODUZIONE);
  assert.throws(() => aggiungiBeaconAnalytics("<body></body>", "errato"), /token/);
  assert.throws(() => aggiungiBeaconAnalytics("<main>MOX</main>", TOKEN), /body/);
  assert.throws(() => aggiungiBeaconAnalytics(
    '<body><script src="https://static.cloudflareinsights.com/beacon.min.js"></script></body>', TOKEN),
  /già presente/);
});
