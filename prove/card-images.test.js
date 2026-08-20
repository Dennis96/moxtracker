import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  cardLookupKey,
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
  assert.equal(cardLookupKey({ arena_id: 1234, nome: "Carta" }), "arena:1234");
  assert.equal(cardLookupKey({ nome: "  Ethereal   Armor " }), "name:ethereal armor");
  assert.equal(cardLookupKey({}), null);
});

test("normalizzazione mantiene copie e scarta Arena ID non validi", () => {
  assert.deepEqual(normalizeCardSpec({
    arena_id: "42", nome: "  Skyward Spider ", copie: "4",
  }), {
    arenaId: 42, name: "Skyward Spider", copies: 4,
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
    fetchedAt: 123,
  });
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
