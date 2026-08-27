import { deckLabel, UNCLASSIFIED_DECK_NAME } from "./format.js";

export const COLORS = ["W", "U", "B", "R", "G"];

export function deckArchetypeId(deck) {
  const value = deck?.archetipo_id ?? deck?.id_archetipo ?? null;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function deckColors(deck) {
  const value = Array.isArray(deck?.colori) ? deck.colori : Array.isArray(deck?.colors) ? deck.colors : [];
  return [...new Set(value.map(v => String(v).trim().toUpperCase()).filter(v => COLORS.includes(v)))];
}

export function deckMode(deck) {
  const value = deck?.modalita ?? deck?.mode ?? null;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function deckStrategy(deck) {
  const value = deck?.strategia ?? deck?.strategy ?? null;
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

export function strategyLabel(value) {
  if (!value) return "—";
  const cleaned = String(value).trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : "—";
}

export function deckIsClassified(deck) {
  if (deck?.tipo_dettaglio === "non_classificato") return false;
  if (deck?.nome === UNCLASSIFIED_DECK_NAME || deck?.archetipo === UNCLASSIFIED_DECK_NAME) {
    return Boolean(deckArchetypeId(deck));
  }
  return Boolean(deckArchetypeId(deck) || deck?.tipo_dettaglio === "riconosciuto");
}

export function classificationSummary(deck) {
  if (deck?.tipo_dettaglio === "altro") {
    const gruppi = Number(deck.impronte_raggruppate || 0);
    return gruppi ? `${gruppi} liste non riconosciute raggruppate` : "Liste non riconosciute raggruppate";
  }
  if (!deckIsClassified(deck)) return "Archetipo non ancora confermato";
  const bits = [];
  const colors = deckColors(deck);
  const strategy = deckStrategy(deck);
  const mode = deckMode(deck);
  if (colors.length) bits.push(colors.join("/"));
  if (strategy) bits.push(strategyLabel(strategy));
  if (mode) bits.push(mode);
  return bits.join(" • ") || "Archetipo riconosciuto";
}

export function observedDecklistCards(item) {
  if (item?.origine !== "osservazione_mox") return [];
  if (item?.decklist_pubblicabile !== true) return [];
  return Array.isArray(item?.carte) ? item.carte : [];
}

export function availableStrategies(decks) {
  return [...new Set((Array.isArray(decks) ? decks : []).map(deckStrategy).filter(Boolean))].sort((a, b) => strategyLabel(a).localeCompare(strategyLabel(b), "it"));
}

export function classificationAvailable(decks) {
  return (Array.isArray(decks) ? decks : []).some(deckIsClassified);
}

export function filterMetaDecks(decks, filters = {}) {
  const search = String(filters.search || "").trim().toLocaleLowerCase("it");
  const selectedColors = Array.isArray(filters.colors) ? filters.colors : [];
  const strategy = String(filters.strategy || "").trim().toLowerCase();

  return (Array.isArray(decks) ? decks : []).filter(deck => {
    if (search) {
      const haystack = [
        deckLabel(deck),
        deck?.archetipo,
        deckArchetypeId(deck),
        deckStrategy(deck),
        deckMode(deck),
        deckColors(deck).join(" "),
        deck?.impronta,
      ].filter(Boolean).join(" ").toLocaleLowerCase("it");
      if (!haystack.includes(search)) return false;
    }

    if (selectedColors.length) {
      const colors = deckColors(deck);
      if (!colors.length || !selectedColors.every(color => colors.includes(color))) return false;
    }

    if (strategy && deckStrategy(deck) !== strategy) return false;
    return true;
  });
}

export function deckDetailUrl(deck, apiFilters = {}) {
  const params = new URLSearchParams();
  if (apiFilters.formato) params.set("formato", apiFilters.formato);
  if (apiFilters.rank) params.set("rank", apiFilters.rank);
  if (apiFilters.periodo) params.set("periodo", apiFilters.periodo);
  const id = deckArchetypeId(deck);
  if (id) {
    params.set("id", id);
  } else if (typeof deck?.impronta === "string" && deck.impronta.trim()) {
    params.set("impronta", deck.impronta.trim());
  }
  const mode = apiFilters.modalita || deckMode(deck);
  if (mode) params.set("modalita", mode);
  if (!params.has("id") && !params.has("impronta")) return null;
  return `./archetipo.html?${params.toString()}`;
}
