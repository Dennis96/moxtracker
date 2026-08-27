const locale = typeof document !== "undefined" && document.documentElement.lang === "en"
  ? "en-US" : "it-IT";
const nf = new Intl.NumberFormat(locale, { useGrouping: "always" });
const df = new Intl.DateTimeFormat(locale, {
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit",
});

export const UNCLASSIFIED_DECK_NAME = "Mazzo non classificato";

export function formatInteger(value) {
  const n = Number(value);
  return Number.isFinite(n) ? nf.format(n) : "—";
}

export function formatPercent(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${nf.format(n)}%`;
}

export function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return df.format(date);
}

export function shortFingerprint(value, length = 8) {
  if (typeof value !== "string" || !value.trim()) return "non identificato";
  return value.trim().slice(0, length);
}

export function deckLabel(deck) {
  const archetype = typeof deck?.archetipo === "string" ? deck.archetipo.trim() : "";
  if (archetype && archetype !== UNCLASSIFIED_DECK_NAME) return archetype;
  const name = typeof deck?.nome === "string" ? deck.nome.trim() : "";
  if (name && name !== UNCLASSIFIED_DECK_NAME) return name;
  return UNCLASSIFIED_DECK_NAME;
}

export function sampleSufficient(item) {
  return item?.dati_sufficienti === true;
}

export function winRateClass(value) {
  if (value === null || value === undefined) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (n >= 50) return "positive";
  return "negative";
}
