import assert from "node:assert/strict";
import test from "node:test";

import { ordinaVociDraft, raggruppaCartePool } from "../sito/js/account-draft.js";

test("il flusso Account Draft ordina insieme tracce e gruppi storici dalla data fonte", () => {
  const ordinate = ordinaVociDraft(
    [{ id: "storico", finita: "2026-08-25T10:00:00Z" }],
    [{ id: "traccia-recente", ricevuto: "2026-08-27T10:00:00Z" },
      { id: "traccia-vecchia", ricevuto: "2026-08-24T10:00:00Z" }],
  );
  assert.deepEqual(ordinate.map((voce) => `${voce.tipo}:${voce.valore.id}`), [
    "draft:traccia-recente", "sessione:storico", "draft:traccia-vecchia",
  ]);
});

test("il pool Draft somma solo copie con lo stesso Arena ID", () => {
  const carte = raggruppaCartePool([103441, 103441, 102, "103441"], {
    "103441": "Front Porch Sentries", "102": "Carta distinta",
  }, { "103441": { set: "hob", numero: "67" } });
  assert.deepEqual(carte, [
    { arena_id: 103441, copie: 3, nome: "Front Porch Sentries", set: "hob", numero: "67" },
    { arena_id: 102, copie: 1, nome: "Carta distinta" },
  ]);
  assert.equal(carte.reduce((totale, carta) => totale + carta.copie, 0), 4,
    "il totale resta quello della sequenza originale");
});
