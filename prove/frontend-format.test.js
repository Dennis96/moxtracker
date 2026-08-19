import { strict as assert } from "node:assert";
import { test } from "node:test";
import { deckLabel, formatDate, formatInteger, formatPercent, shortFingerprint, sampleSufficient, winRateClass } from "../sito/js/format.js";
import { availableStrategies, classificationAvailable, deckColors, deckDetailUrl, deckIsClassified, deckMode, deckStrategy, filterMetaDecks } from "../sito/js/meta-model.js";

test("frontend non trasforma null in zero percento", () => {
  assert.equal(formatPercent(null), null);
  assert.equal(formatPercent(undefined), null);
});

test("frontend formatta percentuali e numeri in italiano", () => {
  assert.equal(formatPercent(50.85), "50,85%");
  assert.equal(formatInteger(1284), "1.284");
});

test("frontend mostra archetipo, nome o impronta corta senza inventare", () => {
  assert.equal(deckLabel({ archetipo: "Dimir Midrange", nome: "Lista 1", impronta: "abcdef012345" }), "Dimir Midrange");
  assert.equal(deckLabel({ nome: "Dimir", impronta: "abcdef012345" }), "Dimir");
  assert.equal(deckLabel({ nome: null, impronta: "abcdef012345" }), "Mazzo abcdef01");
  assert.equal(shortFingerprint(null), "non identificato");
});

test("frontend considera sufficienti solo i dati dichiarati tali dal server", () => {
  assert.equal(sampleSufficient({ dati_sufficienti: true }), true);
  assert.equal(sampleSufficient({ dati_sufficienti: false }), false);
  assert.equal(sampleSufficient({}), false);
});

test("classe winrate e data sono robuste", () => {
  assert.equal(winRateClass(50), "positive");
  assert.equal(winRateClass(49.9), "negative");
  assert.equal(winRateClass(null), "");
  assert.equal(formatDate(null), null);
  assert.equal(formatDate("non-data"), null);
});

test("metadati archetipo accettano i campi previsti da mox-meta", () => {
  const deck = { archetipo_id: "dimir", archetipo: "Dimir", strategia: "control", colori: ["U", "B"] };
  assert.equal(deckIsClassified(deck), true);
  assert.deepEqual(deckColors(deck), ["U", "B"]);
  assert.equal(deckStrategy(deck), "control");
  assert.equal(deckMode({ modalita: "Bo3" }), "Bo3");
  assert.equal(classificationAvailable([deck]), true);
  assert.deepEqual(availableStrategies([deck, { strategia: "aggro" }]), ["aggro", "control"]);
});

test("filtri locali colore strategia e ricerca non inventano classificazioni", () => {
  const decks = [
    { archetipo: "Dimir Midrange", archetipo_id: "dimir", colori: ["U", "B"], strategia: "midrange" },
    { archetipo: "Mono Red", archetipo_id: "mono-red", colori: ["R"], strategia: "aggro" },
    { nome: null, impronta: "abcdef012345", colori: [], strategia: null },
  ];
  assert.equal(filterMetaDecks(decks, { search: "dimir" }).length, 1);
  assert.equal(filterMetaDecks(decks, { colors: ["U", "B"] }).length, 1);
  assert.equal(filterMetaDecks(decks, { strategy: "aggro" }).length, 1);
  assert.equal(filterMetaDecks(decks, { colors: ["G"] }).length, 0);
});

test("url dettaglio conserva formato rank e impronta", () => {
  const url = deckDetailUrl({ archetipo_id: "dimir", modalita: "Bo3", impronta: "abc" }, { formato: "Standard", rank: "Gold" });
  assert.match(url, /archetipo\.html\?/);
  assert.match(url, /formato=Standard/);
  assert.match(url, /rank=Gold/);
  assert.match(url, /id=dimir/);
  assert.match(url, /modalita=Bo3/);
  assert.match(url, /impronta=abc/);
});
