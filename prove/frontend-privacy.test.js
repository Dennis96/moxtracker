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

test("meta explorer non mette l'impronta completa nei tooltip e protegge le core strip", () => {
  const source = leggi("../sito/js/render.js");
  assert.equal(source.includes("mark.title = deck.impronta"), false);
  assert.match(source, /ID tecnico/);
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

test("la panoramica archetipo mostra solo il riepilogo delle varianti riconosciute", () => {
  const source = leggi("../sito/js/archetype.js");
  const detail = leggi("../sito/archetipo.html");
  assert.match(source, /Apri variante →/);
  assert.match(source, /Lista più rappresentativa/);
  assert.match(source, /Altre varianti/);
  assert.match(source, /navigator\.clipboard\.writeText/);
  assert.match(source, /mox-deck-arena\.txt/);
  assert.match(source, /Decklist pubblicata/);
  assert.match(source, /Decklist da 30 partite/);
  assert.match(source, /if \(!recognized\) renderObservedDecklistInline\(article, variant\)/);
  assert.match(source, /renderRepresentativeProfile/);
  assert.match(source, /renderProfiloMazzo/);
  assert.match(detail, /Profilo della lista rappresentativa/);
  assert.match(detail, /terre speciali e fixing/i);
});

test("la vista variante e una pagina focus distinta e non replica la panoramica archetipo", () => {
  const source = leggi("../sito/js/archetype.js");
  const detail = leggi("../sito/archetipo.html");
  const css = leggi("../sito/css/step53.css");

  assert.match(source, /searchParams\.set\("variante"/);
  assert.match(source, /function selectedVariant/);
  assert.match(source, /function renderVariantFocus/);
  assert.match(source, /overviewIds = \["detail-summary", "detail-grid", "variants-panel", "trend-panel"\]/);
  assert.match(source, /renderVariantDecklist\(variant\)/);
  assert.match(source, /if \(!selection\) \{[\s\S]*?renderReferences\(data\)/);

  assert.match(detail, /id="variant-focus"/);
  assert.match(detail, /id="variant-focus-back"/);
  assert.match(detail, /Statistiche avanzate/);
  assert.match(detail, /Decklist della variante/);
  assert.match(detail, /Le liste di riferimento del catalogo restano nella panoramica dell'archetipo/);
  assert.doesNotMatch(detail, /id="variant-view-banner"/);

  assert.match(css, /\.variant-focus-header/);
  assert.match(css, /\.variant-focus-back/);
  assert.match(css, /\.variant-focus-body/);
  assert.match(css, /#detail-summary\[hidden\][\s\S]*?#detail-grid\[hidden\][\s\S]*?display:none !important/);
  assert.match(css, /\.detail-page\.variant-mode \.detail-hero/);
});

test("il sito usa un solo tema scuro senza preferenze locali residue", () => {
  for (const file of ["tokens.css", "site.css", "step53.css"]) {
    const css = leggi(`../sito/css/${file}`);
    assert.doesNotMatch(css, /data-theme=["']light["']/);
    assert.doesNotMatch(css, /theme-toggle/);
  }
  for (const file of ["main.js", "draft.js", "archetype.js", "account.js", "supporto.js", "admin.js"]) {
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
    assert.match(nav, />Account</);
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
