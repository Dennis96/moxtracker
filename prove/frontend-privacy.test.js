import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const leggi = (relative) => readFileSync(QUI + relative, "utf8");

test("dettaglio frontend non legge direttamente variant.carte e non usa fallback meta", () => {
  const source = leggi("../sito/js/archetype.js");
  assert.equal(source.includes("variant.carte"), false);
  assert.equal(source.includes("fetchMeta"), false);
  assert.match(source, /observedDecklistCards\(variant\)/);
  assert.match(source, /Decklist non pubblicata/);
});

test("meta explorer non mostra l'impronta, nemmeno abbreviata, e protegge le core strip", () => {
  const source = leggi("../sito/js/render.js");
  assert.equal(source.includes("mark.title = deck.impronta"), false);
  // Dal S2 anche l'«ID tecnico» abbreviato non esce piu' (prima era ammesso).
  assert.doesNotMatch(source, /ID tecnico|shortFingerprint/);
  assert.match(source, /if \(classified\) \{[\s\S]*?createCoreStrip/);
});

test("testi pubblici separano catalogo e osservazioni e descrivono la soglia a 30 partite", () => {
  const detail = leggi("../sito/archetipo.html");
  const privacy = leggi("../sito/privacy.html");
  assert.match(detail, /riferimenti pubblici del catalogo/);
  assert.match(detail, /almeno 30 partite/);
  assert.match(detail, /Percentuali e decklist precisa vengono pubblicate quando la stessa variante raggiunge almeno 30 partite/);
  assert.match(privacy, /almeno 30 partite/);
  assert.match(privacy, /anche se il campione proviene da una sola installazione/);
  assert.doesNotMatch(privacy, /5 installazioni/);
  assert.doesNotMatch(detail, /installazioni distinte/);
  assert.match(privacy, /catalogo pubblico curato separatamente/);
  assert.match(privacy, /decklist osservata protetta non genera richieste immagine o hover/);
});

test("liste di riferimento restano compatibili con API pre-S1-A", () => {
  const source = leggi("../sito/js/archetype.js");
  assert.match(source, /!ref\?\.origine \|\| ref\.origine === "catalogo_reference"/);
});

test("la panoramica archetipo apre inline le varianti riconosciute e i Brew", () => {
  const source = leggi("../sito/js/archetype.js");
  const detail = leggi("../sito/archetipo.html");
  assert.match(source, /Lista più rappresentativa/);
  assert.match(source, /Altre varianti/);
  assert.match(source, /navigator\.clipboard\.writeText/);
  assert.match(source, /function testoArenaRiferimento/);
  assert.match(source, /Copia per Arena/);
  assert.match(source, /Sideboard\\n/);
  assert.doesNotMatch(source, /mox-deck-arena\.txt/);
  assert.match(source, /Decklist pubblicata/);
  assert.match(source, /Decklist da 30 partite/);
  assert.match(source, /renderObservedDecklistInline\(article, variant, index, \{/);
  assert.match(source, /recognized,/);
  assert.match(source, /selected: selection\?\.index === index/);
  assert.match(source, /renderRepresentativeProfile/);
  assert.match(source, /renderProfiloMazzo/);
  assert.match(detail, /Profilo della lista rappresentativa/);
  assert.match(detail, /terre speciali e fixing/i);
});

test("un URL variante apre lo stesso accordion senza nascondere la panoramica", () => {
  const source = leggi("../sito/js/archetype.js");

  assert.match(source, /searchParams\.set\("variante"/);
  assert.match(source, /function selectedVariant/);
  assert.match(source, /details\.open = selected/);
  assert.match(source, /history\.replaceState\(null, "", url\)/);
  assert.match(source, /renderDeck\(data, filtri, null\)/);
  assert.match(source, /renderVariants\(data, selection\)/);
  assert.doesNotMatch(source, /renderVariantFocus\(data, selection, filtri\)/);
});

test("il sito usa un solo tema scuro senza preferenze locali residue", () => {
  for (const file of ["tokens.css", "site.css", "step53.css"]) {
    const css = leggi(`../sito/css/${file}`);
    assert.doesNotMatch(css, /data-theme=["']light["']/);
    assert.doesNotMatch(css, /theme-toggle/);
  }
  for (const file of ["main.js", "archetype.js", "account.js", "supporto.js", "admin.js"]) {
    const source = leggi(`../sito/js/${file}`);
    assert.doesNotMatch(source, /mox-theme|setupTheme|function tema/);
  }
});

test("navigazione primaria e menu mobile sono uniformi in tutte le pagine", () => {
  const pagine = ["index.html", "draft.html", "archetipo.html", "account.html", "supporto.html", "privacy.html", "admin.html"];
  for (const page of pagine) {
    const html = leggi(`../sito/${page}`);
    const nav = html.match(/<div id="primary-nav" class="nav-links">([\s\S]*?)<\/div>/)?.[1] || "";
    assert.match(html, /<body[^>]*data-page="[^"]+"[^>]*>/);
    assert.match(html, /id="nav-toggle"[^>]+aria-controls="primary-nav"[^>]+aria-expanded="false"/);
    assert.equal((nav.match(/data-route=/g) || []).length, 5);
    assert.match(nav, />Home</);
    assert.match(nav, />Meta</);
    assert.match(nav, />Draft</);
    assert.match(nav, />Il mio MOX</);
    assert.match(nav, />Supporto</);
    assert.match(html, /js\/site-shell\.js/);
    assert.doesNotMatch(html, /theme-toggle|css\/ui-fixes\.css/);
  }

  const css = leggi("../sito/css/site.css");
  const shell = leggi("../sito/js/site-shell.js");
  assert.match(css, /\.nav-links\[data-open\] \{ display: flex; \}/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /nav-links a:nth-child/);
  assert.match(shell, /aria-expanded/);
  assert.match(shell, /evento\.key === "Escape"/);
});
