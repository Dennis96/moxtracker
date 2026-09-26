import assert from "node:assert/strict";
import { test } from "node:test";
import { rimuoviBeaconIniettati } from "../strumenti/html_cloudflare.mjs";

const TOKEN = "0123456789abcdef0123456789abcdef";

test("il gate confronta l'HTML sorgente anche con i beacon ufficiali iniettati da Pages e zona", () => {
  const pages = `<!-- Cloudflare Pages Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "${TOKEN}"}'></script><!-- Cloudflare Pages Analytics -->`;
  const zona = `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/abcdef" integrity="sha512-abc+/=" data-cf-beacon='{"version":"2024.11.0","token":"${TOKEN}","r":1,"spa":2}' crossorigin="anonymous"></script>\n`;
  const risultato = rimuoviBeaconIniettati(`<html><body>${pages}${zona}</body></html>`);
  assert.equal(risultato.html, "<html><body></body></html>");
  assert.deepEqual(risultato.beacon, ["Pages", "zona"]);
});

test("il gate rifiuta un beacon Cloudflare inatteso", () => {
  assert.throws(() => rimuoviBeaconIniettati("<script src='https://static.cloudflareinsights.com/other.js'></script>"),
    /iniezione Cloudflare inattesa/);
});
