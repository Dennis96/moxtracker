import assert from "node:assert/strict";
import test from "node:test";

import { linkLinguaAlternativa } from "../sito/js/language-link.js";

test("il selettore lingua torna davvero all'italiano dalla home inglese", () => {
  assert.equal(linkLinguaAlternativa("/en/", true), "../index.html");
  assert.equal(linkLinguaAlternativa("/en/draft.html", true, "?periodo=30", "#metodo"),
    "../draft.html?periodo=30#metodo");
});

test("il selettore lingua conserva pagina, filtri e ancora passando all'inglese", () => {
  assert.equal(linkLinguaAlternativa("/", false), "./en/index.html");
  assert.equal(linkLinguaAlternativa("/account.html", false, "?tab=draft", "#dettaglio"),
    "./en/account.html?tab=draft#dettaglio");
});
