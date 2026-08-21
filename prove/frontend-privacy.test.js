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
  assert.match(detail, /decklist precisa vengono pubblicate quando la stessa variante raggiunge almeno 30 partite/);
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
