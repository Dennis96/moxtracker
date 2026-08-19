import { DEFAULT_FORMAT } from "./config.js";
import { fetchMeta } from "./api.js";
import { deckLabel, formatInteger, formatPercent, sampleSufficient } from "./format.js";
import { classificationSummary, deckArchetypeId, deckColors, deckMode, deckStrategy, strategyLabel } from "./meta-model.js";

function setupTheme() {
  const root = document.documentElement;
  const button = document.querySelector("#theme-toggle");
  const saved = localStorage.getItem("mox-theme");
  if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  else root.dataset.theme = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  button.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("mox-theme", root.dataset.theme);
  });
}

function tag(text, className = "") {
  const node = document.createElement("span"); node.className = className; node.textContent = text; return node;
}

function setText(selector, value) { document.querySelector(selector).textContent = value; }

function renderDeck(deck, params) {
  const title = deckLabel(deck);
  document.title = `${title} — MOX Arena Assistant`;
  document.querySelector("#detail-heading h1").textContent = title;
  const tags = document.querySelector("#detail-tags"); tags.replaceChildren();
  const colors = deckColors(deck);
  for (const color of colors) tags.append(tag(color, `detail-tag color-tag tag-${color.toLowerCase()}`));
  const strategy = deckStrategy(deck);
  if (strategy) tags.append(tag(strategyLabel(strategy), "detail-tag"));
  const mode = deckMode(deck);
  if (mode) tags.append(tag(mode, "detail-tag"));
  if (deckArchetypeId(deck)) tags.append(tag(deckArchetypeId(deck), "detail-tag muted-tag"));
  if (!colors.length && !strategy && !deckArchetypeId(deck)) tags.append(tag(classificationSummary(deck), "detail-tag pending-tag"));

  const sufficient = sampleSufficient(deck);
  setText("#detail-winrate", sufficient ? (formatPercent(deck.win_rate) || "—") : "Dati insufficienti");
  setText("#detail-winrate-note", sufficient ? "Campione sopra soglia" : "Pubblicato da 30 partite");
  setText("#detail-share", sufficient ? (formatPercent(deck.quota_meta) || "—") : "Dati insufficienti");
  setText("#detail-share-note", sufficient ? "Quota nel filtro corrente" : "Pubblicata da 30 partite");
  setText("#detail-games", formatInteger(deck.partite));
  setText("#detail-record", `${formatInteger(deck.vittorie)} V / ${formatInteger(deck.sconfitte)} S`);
  setText("#detail-rank", params.rank || "Tutti");
}

function renderError(message) {
  const node = document.querySelector("#detail-error"); node.hidden = false; node.textContent = message;
  document.querySelector("#detail-summary").classList.add("muted-content");
  document.querySelector("#detail-heading h1").textContent = "Dettaglio non disponibile";
}

async function load() {
  const params = new URLSearchParams(location.search);
  const formato = params.get("formato") || DEFAULT_FORMAT;
  const rank = params.get("rank") || "";
  const impronta = params.get("impronta");
  const id = params.get("id");
  const mode = params.get("modalita");

  const back = new URL("./index.html", location.href);
  back.hash = "meta";
  document.querySelector("#back-to-meta").href = back.href;

  try {
    const data = await fetchMeta({ formato, rank });
    const decks = Array.isArray(data.mazzi) ? data.mazzi : [];
    const deck = decks.find(item =>
      (id && deckArchetypeId(item) === id && (!mode || deckMode(item) === mode)) ||
      (impronta && item.impronta === impronta)
    );
    if (!deck) { renderError("Questo gruppo non è presente nei dati del filtro corrente."); return; }
    renderDeck(deck, { formato, rank });
  } catch (error) {
    renderError(error.message || "Impossibile leggere i dati del meta.");
  }
}

setupTheme();
load();
