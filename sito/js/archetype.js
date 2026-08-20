import { DEFAULT_FORMAT } from "./config.js";
import { fetchArchetipo, fetchMeta } from "./api.js";
import { deckLabel, formatInteger, formatPercent, sampleSufficient } from "./format.js";
import { classificationSummary, deckArchetypeId, deckColors, deckMode, deckStrategy, strategyLabel } from "./meta-model.js";
import { createCardListItem, parseReferenceLine } from "./card-images.js";

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
function titleCase(value) {
  return String(value || "").replace(/(^|[\s'-])([a-zà-öø-ÿ])/g, (_, a, b) => a + b.toUpperCase());
}

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

function cardLine(card) {
  return createCardListItem({
    arena_id: card.arena_id,
    copie: card.copie,
    nome: card.nome ? titleCase(card.nome) : "",
  });
}

function renderVariants(data) {
  const host = document.querySelector("#variants-list");
  host.replaceChildren();
  const variants = Array.isArray(data.varianti) ? data.varianti : [];
  setText("#variants-count", `${variants.length} ${variants.length === 1 ? "variante osservata" : "varianti osservate"}`);
  if (!variants.length) {
    const empty = document.createElement("p"); empty.className = "variants-empty"; empty.textContent = "Nessuna variante osservata nel filtro corrente."; host.append(empty); return;
  }

  for (const [index, variant] of variants.entries()) {
    const article = document.createElement("article"); article.className = "variant-card";
    const head = document.createElement("div"); head.className = "variant-head";
    const identity = document.createElement("div");
    const title = document.createElement("strong"); title.textContent = `Variante osservata #${index + 1}`;
    const sub = document.createElement("small"); sub.textContent = `ID ${variant.variante_id}`;
    identity.append(title, sub);
    const metrics = document.createElement("div"); metrics.className = "variant-metrics";
    const partiteLabel = Number(variant.partite) === 1 ? "partita" : "partite";
    const wrLabel = variant.dati_sufficienti ? (formatPercent(variant.win_rate) || "—") : "Dati insufficienti";
    metrics.innerHTML = `<span><b>${formatInteger(variant.partite)}</b> ${partiteLabel}</span><span>${wrLabel}</span>`;
    head.append(identity, metrics);

    const details = document.createElement("details"); details.className = "variant-details";
    const summary = document.createElement("summary"); summary.textContent = "Mostra decklist osservata";
    const list = document.createElement("ul"); list.className = "decklist-cards";
    for (const card of variant.carte || []) list.append(cardLine(card));
    const unknown = (variant.carte || []).filter(card => !card.nome).length;
    details.append(summary, list);
    if (unknown) {
      const note = document.createElement("p"); note.className = "variant-note";
      note.textContent = `${unknown} carte sono salvate correttamente con Arena ID ma il catalogo nomi compatto del Worker non le conosce ancora.`;
      details.append(note);
    }
    article.append(head, details);
    host.append(article);
  }
}

function renderReferences(data) {
  const host = document.querySelector("#reference-lists"); host.replaceChildren();
  const refs = Array.isArray(data.liste_riferimento) ? data.liste_riferimento : [];
  const titleLabel = document.querySelector("#reference-title-label");
  if (titleLabel) titleLabel.textContent = refs.length === 1 ? "Lista di riferimento" : "Liste di riferimento";
  if (!refs.length) {
    host.innerHTML = "<strong>Nessuna lista di riferimento</strong><p>Il catalogo non espone una lista per questo archetipo.</p>";
    return;
  }
  for (const ref of refs) {
    const details = document.createElement("details"); details.className = "reference-details";
    const summary = document.createElement("summary");
    summary.textContent = [ref.nome_pubblico || ref.nome, ref.modalita].filter(Boolean).join(" • ");
    const list = document.createElement("ul"); list.className = "reference-decklist";
    for (const line of ref.lista || []) list.append(createCardListItem(parseReferenceLine(line)));
    details.append(summary, list);
    if ((ref.sideboard || []).length) {
      const sideTitle = document.createElement("strong"); sideTitle.className = "sideboard-title"; sideTitle.textContent = "Sideboard";
      const side = document.createElement("ul"); side.className = "reference-decklist";
      for (const line of ref.sideboard) side.append(createCardListItem(parseReferenceLine(line)));
      details.append(sideTitle, side);
    }
    const meta = document.createElement("p"); meta.className = "reference-meta";
    meta.textContent = [ref.data ? `Riferimento ${ref.data}` : null, ref.fonte ? "Fonte catalogo mox-meta" : null].filter(Boolean).join(" • ");
    details.append(meta);
    host.append(details);
  }
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

  const back = new URL("./index.html", location.href); back.hash = "meta";
  document.querySelector("#back-to-meta").href = back.href;

  try {
    if (id) {
      const data = await fetchArchetipo({ formato, rank, id });
      renderDeck(data, { formato, rank });
      renderVariants(data);
      renderReferences(data);
      return;
    }

    // Compatibilita' con vecchi link a una impronta ancora non classificata.
    const data = await fetchMeta({ formato, rank });
    const decks = Array.isArray(data.mazzi) ? data.mazzi : [];
    const deck = decks.find(item =>
      (impronta && item.impronta === impronta) ||
      (id && deckArchetypeId(item) === id && (!mode || deckMode(item) === mode))
    );
    if (!deck) { renderError("Questo gruppo non è presente nei dati del filtro corrente."); return; }
    renderDeck(deck, { formato, rank });
    document.querySelector("#variants-panel").hidden = true;
    document.querySelector("#reference-panel").hidden = true;
  } catch (error) {
    renderError(error.message || "Impossibile leggere i dati del meta.");
  }
}

setupTheme();
load();
