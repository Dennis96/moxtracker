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
  assert.match(source, /Apri variante →/);
  assert.match(source, /Decklist pubblicata/);
  assert.match(source, /Decklist da 30 partite/);
  assert.match(source, /if \(!recognized\) renderObservedDecklistInline\(article, variant\)/);
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

test("tema chiaro mantiene leggibili hero dettaglio e ritorno dalla variante", () => {
  const css = leggi("../sito/css/step53.css");
  assert.match(css, /html\[data-theme="light"\] \.detail-hero \.detail-heading h1/);
  assert.match(css, /html\[data-theme="light"\] \.detail-hero \.back-link/);
  assert.match(css, /html\[data-theme="light"\] \.variant-focus-back/);
  assert.match(css, /html\[data-theme="light"\] \.variant-focus-heading \.eyebrow/);
  assert.match(css, /html\[data-theme="light"\] \.variant-metric-card > strong/);
});

test("navigazione primaria distingue Meta e Metodo Draft e il light mode resta leggibile", () => {
  for (const page of ["index.html", "draft.html", "archetipo.html", "privacy.html"]) {
    const html = leggi(`../sito/${page}`);
    const nav = html.match(/<div class="nav-links">([\s\S]*?)<\/div>/)?.[1] || "";
    assert.match(nav, />Meta</);
    assert.match(nav, /Metodo Draft/);
    assert.doesNotMatch(nav, />Matchup</);
    assert.doesNotMatch(nav, />Metodo</);
    assert.match(html, /css\/ui-fixes\.css/);
  }

  const css = leggi("../sito/css/ui-fixes.css");
  assert.match(css, /html\[data-theme="light"\] \.final-cta/);
  assert.match(css, /html\[data-theme="light"\] \.draft-hero h1/);
  assert.match(css, /html\[data-theme="light"\] \.draft-flow/);
  assert.match(css, /html\[data-theme="light"\] \.draft-flow \.flow-card/);
});
