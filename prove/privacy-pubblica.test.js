import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  SOGLIA_DECKLIST_CONTRIBUTORI,
  SOGLIA_DECKLIST_PARTITE,
  decklistPubblicabile,
} from "../src/privacy-pubblica.js";

test("policy decklist: servono entrambe le soglie", () => {
  assert.equal(SOGLIA_DECKLIST_PARTITE, 30);
  assert.equal(SOGLIA_DECKLIST_CONTRIBUTORI, 5);
  assert.equal(decklistPubblicabile(60, 1), false);
  assert.equal(decklistPubblicabile(29, 10), false);
  assert.equal(decklistPubblicabile(30, 5), true);
});
