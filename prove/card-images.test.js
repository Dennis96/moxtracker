import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  cardLookupKey,
  cardLookupItalianUrls,
  cardLookupUrls,
  cardPreviewSources,
  extractCardMedia,
  normalizeCardSpec,
  parseReferenceLine,
  withLocalizedCardName,
} from "../sito/js/card-images.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const leggiSito = (file) => readFileSync(QUI + `../sito/${file}`, "utf8");

test("parser lista riferimento gestisce copie con e senza x", () => {
  assert.deepEqual(parseReferenceLine("4 Optimistic Scavenger"), {
    copie: 4, nome: "Optimistic Scavenger",
  });
  assert.deepEqual(parseReferenceLine("2x Ethereal Armor"), {
    copie: 2, nome: "Ethereal Armor",
  });
  assert.deepEqual(parseReferenceLine("1× Plains"), {
    copie: 1, nome: "Plains",
  });
});

test("lookup immagini preferisce Arena ID e usa il nome come fallback", () => {
  assert.equal(cardLookupKey({ arena_id: 1234, nome: "Carta" }),
    "arena:1234|name:carta");
  assert.equal(cardLookupKey({ nome: "  Ethereal   Armor " }), "name:ethereal armor");
  assert.equal(cardLookupKey({}), null);
});

test("lookup immagini usa la stampa esatta e conserva il nome come fallback", () => {
  const carta = { arena_id: 103441, nome: "Front Porch Sentries", set: "HOB", numero: "67" };
  assert.deepEqual(cardLookupUrls(carta), [
    "https://api.scryfall.com/cards/hob/67",
    "https://api.scryfall.com/cards/arena/103441",
    "https://api.scryfall.com/cards/named?exact=Front+Porch+Sentries",
  ]);
  assert.equal(cardLookupKey(carta),
    "arena:103441|print:hob/67|name:front porch sentries");
});

test("il fallback italiano cambia il nome ma conserva l'immagine inglese esatta", () => {
  const inglese = {
    name: "Lightning Bolt",
    small: "https://cards.scryfall.io/small/exact-en.jpg",
    normal: "https://cards.scryfall.io/normal/exact-en.jpg",
  };
  const localizzata = withLocalizedCardName(inglese, { printed_name: "Fulmine" });
  assert.equal(localizzata.name, "Fulmine");
  assert.equal(localizzata.small, inglese.small);
  assert.equal(localizzata.normal, inglese.normal);
  assert.notEqual(localizzata, inglese);
});

test("preview carte accessibile da touch e tastiera con chiusura esplicita", () => {
  const javascript = leggiSito("js/card-images.js");
  const account = leggiSito("js/account.js");
  const css = leggiSito("css/card-images.css");
  assert.match(javascript, /document\.createElement\(interactive \? "button" : "span"\)/);
  assert.match(javascript, /aria-haspopup", "dialog"/);
  assert.match(javascript, /event\.key === "Escape"/);
  assert.match(javascript, /card-preview-close/);
  assert.match(javascript, /createCardThumbnail\(spec, \{ interactive: false \}\)/,
    "le miniature dentro i link Meta non devono creare pulsanti annidati");
  assert.match(account, /createCardThumbnail\(carta, \{ interactive: false \}\)/,
    "le miniature dentro le righe Account non devono creare pulsanti annidati");
  assert.doesNotMatch(css, /\.card-hover-preview\s*\{\s*display:\s*none;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("in italiano la stampa esatta per set e numero evita una ricerca testuale lenta", () => {
  assert.deepEqual(cardLookupItalianUrls({
    nome: "Front Porch Sentries", set: "HOB", numero: "67",
  }), [
    "https://api.scryfall.com/cards/hob/67/it",
    "https://api.scryfall.com/cards/search?order=released&unique=prints&q=%21%22Front+Porch+Sentries%22+lang%3Ait",
  ]);
});

test("normalizzazione mantiene copie e scarta Arena ID non validi", () => {
  assert.deepEqual(normalizeCardSpec({
    arena_id: "42", nome: "  Skyward Spider ", copie: "4",
  }), {
    arenaId: 42, name: "Skyward Spider", setCode: "", collectorNumber: "", copies: 4,
  });
  assert.equal(normalizeCardSpec({ arena_id: 0 }).arenaId, null);
});

test("media Scryfall usa small per thumbnail e normal per hover", () => {
  const media = extractCardMedia({
    name: "Ethereal Armor",
    arena_id: 987,
    artist: "Artist",
    image_uris: {
      art_crop: "https://cards.scryfall.io/art_crop/a.jpg",
      small: "https://cards.scryfall.io/small/a.jpg",
      normal: "https://cards.scryfall.io/normal/a.jpg",
    },
  }, 123);
  assert.deepEqual(media, {
    missing: false,
    name: "Ethereal Armor",
    oracleId: "",
    arenaId: 987,
    artCrop: "https://cards.scryfall.io/art_crop/a.jpg",
    small: "https://cards.scryfall.io/small/a.jpg",
    normal: "https://cards.scryfall.io/normal/a.jpg",
    artist: "Artist",
    manaValue: null,
    typeLine: null,
    colors: [],
    producedMana: [],
    oracleText: null,
    fetchedAt: 123,
  });
});

test("anteprima mostra subito una fonte disponibile e poi puo caricare la carta completa", () => {
  assert.deepEqual(cardPreviewSources({
    artCrop: "art", small: "small", normal: "normal",
  }), ["small", "art", "normal"]);
  assert.deepEqual(cardPreviewSources({ small: "small", normal: "small" }), ["small"]);
});

test("media Scryfall conserva i metadati per curva, tipi e fixing", () => {
  const media = extractCardMedia({
    name: "Dual Land", cmc: 0, type_line: "Land", color_identity: ["W", "U"],
    produced_mana: ["W", "U"], oracle_text: "{T}: Add {W} or {U}.",
    image_uris: { small: "small", normal: "normal" },
  });
  assert.equal(media.manaValue, 0);
  assert.equal(media.typeLine, "Land");
  assert.deepEqual(media.colors, ["W", "U"]);
  assert.deepEqual(media.producedMana, ["W", "U"]);
});

test("media Scryfall supporta carte bifronte senza image_uris principale", () => {
  const media = extractCardMedia({
    name: "Front // Back",
    card_faces: [{
      name: "Front",
      artist: "Face Artist",
      image_uris: {
        art_crop: "https://cards.scryfall.io/art_crop/front.jpg",
        small: "https://cards.scryfall.io/small/front.jpg",
        normal: "https://cards.scryfall.io/normal/front.jpg",
      },
    }],
  }, 456);
  assert.equal(media?.artCrop, "https://cards.scryfall.io/art_crop/front.jpg");
  assert.equal(media?.small, "https://cards.scryfall.io/small/front.jpg");
  assert.equal(media?.normal, "https://cards.scryfall.io/normal/front.jpg");
  assert.equal(media?.artist, "Face Artist");
});
