import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const RADICE = fileURLToPath(new URL("..", import.meta.url));
const BUILD = join(RADICE, ".dist", "sito");

function genera() {
  execFileSync(process.execPath, ["strumenti/build_sito.mjs"], {
    cwd: RADICE, stdio: "pipe",
  });
  return readFileSync(join(BUILD, "build-manifest.json"), "utf8");
}

test("la build del sito e' riproducibile e versiona l'intero grafo statico", () => {
  const prima = genera();
  const seconda = genera();
  assert.equal(seconda, prima, "stesse sorgenti devono produrre lo stesso manifesto");

  const manifesto = JSON.parse(prima);
  assert.match(manifesto.build_id, /^[0-9a-f]{16}$/);
  for (const [percorso, hash] of Object.entries(manifesto.file)) {
    const corpo = readFileSync(join(BUILD, percorso));
    assert.equal(createHash("sha256").update(corpo).digest("hex"), hash, percorso);
  }

  for (const pagina of ["index.html", "draft.html", "archetipo.html", "account.html",
    "supporto.html", "admin.html", "privacy.html"]) {
    const html = readFileSync(join(BUILD, pagina), "utf8");
    for (const riferimento of html.matchAll(/(?:src|href)=["'](\.{1,2}\/[^"']+\.(?:js|css|ico|svg|webp|png)(?:\?[^"']*)?)["']/gi)) {
      assert.match(riferimento[1], new RegExp(`[?&]v=${manifesto.build_id}(?:&|$)`),
        `${pagina}: ${riferimento[1]}`);
    }
  }

  for (const percorso of Object.keys(manifesto.file).filter((nome) => nome.endsWith(".js"))) {
    const js = readFileSync(join(BUILD, percorso), "utf8");
    for (const riferimento of js.matchAll(/from\s+["'](\.{1,2}\/[^"']+\.js(?:\?[^"']*)?)["']/g)) {
      assert.match(riferimento[1], new RegExp(`[?&]v=${manifesto.build_id}(?:&|$)`),
        `${percorso}: ${riferimento[1]}`);
    }
  }

  const headers = readFileSync(join(BUILD, "_headers"), "utf8");
  assert.match(headers, /\/draft\n  Cache-Control: no-store/);
  assert.match(headers, /\/js\/\*\n  Cache-Control: public, max-age=31556952, immutable/);
});

test("il gate release richiede tree pulita, preview equivalente e conferma produzione", () => {
  const script = readFileSync(join(RADICE, "strumenti", "release_sito.mjs"), "utf8");
  const configurazione = JSON.parse(readFileSync(
    join(RADICE, "release-sito.config.json"), "utf8"));
  assert.match(script, /status", "--porcelain", "--untracked-files=all/);
  assert.match(script, /rev-parse", "@\{u\}"/);
  assert.match(script, /PUBBLICA-SITO-PRODUZIONE/);
  assert.match(script, /preview-record/);
  assert.match(script, /--commit-hash=/);
  assert.match(script, /smokeTest/);
  assert.match(script, /node_modules\/wrangler\/bin\/wrangler\.js/);
  assert.match(script, /CONFIG\.preview_branch/);
  assert.equal(configurazione.preview_branch, "preview");
});
