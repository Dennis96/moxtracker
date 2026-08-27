import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  cardLookupKey,
  cardLookupUrls,
  extractCardMedia,
  normalizeCardSpec,
  parseReferenceLine,
} from "../sito/js/card-images.js";

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

test("lookup HOB ripiega sulla stampa Arena quando Scryfall non indicizza arena_id", () => {
  const carta = { arena_id: 103441, nome: "Front Porch Sentries", set: "HOB", numero: "67" };
  assert.deepEqual(cardLookupUrls(carta), [
    "https://api.scryfall.com/cards/arena/103441",
    "https://api.scryfall.com/cards/hob/67",
    "https://api.scryfall.com/cards/named?exact=Front+Porch+Sentries",
  ]);
  assert.equal(cardLookupKey(carta),
    "arena:103441|print:hob/67|name:front porch sentries");
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
