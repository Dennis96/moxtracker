import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  SOGLIA_DECKLIST_PARTITE,
  decklistPubblicabile,
} from "../src/privacy-pubblica.js";

test("policy decklist: bastano 30 partite della stessa variante", () => {
  assert.equal(SOGLIA_DECKLIST_PARTITE, 30);
  assert.equal(decklistPubblicabile(29), false);
  assert.equal(decklistPubblicabile(30), true);
  assert.equal(decklistPubblicabile(60), true);
});
