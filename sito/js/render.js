import { deckLabel, formatDate, formatInteger, formatPercent, sampleSufficient, shortFingerprint, winRateClass } from "./format.js";
import { classificationSummary, deckArchetypeId, deckColors, deckDetailUrl, deckIsClassified, deckMode, deckStrategy, filterMetaDecks, strategyLabel } from "./meta-model.js";
import { createCoreStrip } from "./card-images.js";

function clear(node) { while (node.firstChild) node.firstChild.remove(); }
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}
function stateBlock(title, message, retry) {
  const box = el("div", "state");
  box.append(el("strong", "", title), el("div", "", message));
  if (retry) {
    const button = el("button", "retry", "Riprova");
    button.type = "button"; button.dataset.retry = retry; box.append(button);
  }
  return box;
}

export function renderMetaLoading() {
  const body = document.querySelector("#meta-body");
  clear(body); body.append(el("div", "skeleton"));
  document.querySelector("#meta-count").textContent = "Caricamento…";
  document.querySelector("#meta-updated").textContent = "";
  document.querySelector("#meta-visible").textContent = "";
}

function metaCell(text, className = "") { return el("td", className, text); }

function renderDeckIdentity(deck, apiFilters) {
  const url = deckDetailUrl(deck, apiFilters);
  const link = el(url ? "a" : "div", "deck-link");
  if (url) link.href = url;
  const wrap = el("div", "deck");
  const archetypeId = deckArchetypeId(deck);
  const classified = deckIsClassified(deck);
  const publicLabel = deckLabel(deck);
  const publicWords = publicLabel.split(/[-_\s]+/).filter(Boolean);
  const markText = classified
    ? publicWords.slice(0, 2).map(x => x[0]).join("").toUpperCase()
    : "NC";
  const mark = el("span", "deck-mark", markText || "AR");
  mark.title = classified ? (archetypeId || "Archetipo riconosciuto") : "Mazzo non classificato";
  const text = el("span", "deck-copy");
  text.append(el("strong", "deck-name", publicLabel));
  if (!classified) {
    text.append(el("small", "", classificationSummary(deck)));
    if (deck.impronta) text.append(el("small", "", `ID tecnico ${shortFingerprint(deck.impronta)}`));
  }
  const meta = el("span", "deck-tags");
  if (classified) {
    for (const color of deckColors(deck)) meta.append(el("span", `mini-color mini-${color.toLowerCase()}`, color));
    const strategy = deckStrategy(deck);
    if (strategy) meta.append(el("span", "strategy-chip", strategyLabel(strategy)));
  }
  if (meta.childNodes.length) text.append(meta);
  if (classified) {
    const core = createCoreStrip(deck.carte_core || []);
    if (core.childNodes.length) text.append(core);
  }
  wrap.append(mark, text, el("span", "row-chevron", url ? "›" : ""));
  link.append(wrap);
  return link;
}

export function renderMeta(data, sort, localFilters = {}, apiFilters = {}) {
  const body = document.querySelector("#meta-body");
  clear(body);
  document.querySelector("#meta-count").textContent = `${formatInteger(data.partite_totali)} ${Number(data.partite_totali) === 1 ? "partita" : "partite"}`;
  const updated = formatDate(data.aggiornato);
  document.querySelector("#meta-updated").textContent = updated ? `Ultimo dato ricevuto: ${updated}` : "Nessun dato ricevuto";
  document.querySelector("#meta-threshold").textContent = `Percentuali pubblicate da ${formatInteger(data.soglia_percentuali)} partite.`;
  // Con un filtro di rank attivo un archetipo puo' sparire perche' le sue
  // partite non portano la classe: Arena a volte manda solo il livello. Senza
  // questa riga sembra che il mazzo non esista, e non e' vero.
  const senzaRank = Number(data.partite_senza_rank || 0);
  const nota = document.querySelector("#meta-threshold");
  if (senzaRank > 0) {
    nota.textContent += ` ${formatInteger(senzaRank)} ${senzaRank === 1
      ? "partita non ha il rank completo e resta fuori da questo filtro."
      : "partite non hanno il rank completo e restano fuori da questo filtro."}`;
  }
  if (data.meta_score?.disponibile === false && data.meta_score?.motivo) {
    nota.textContent += ` Meta score: ${data.meta_score.motivo}`;
  }

  let decks = filterMetaDecks(Array.isArray(data.mazzi) ? data.mazzi : [], localFilters);
  document.querySelector("#meta-visible").textContent = `${formatInteger(decks.length)} ${decks.length === 1 ? "gruppo mostrato" : "gruppi mostrati"}`;
  if (!decks.length) {
    body.append(stateBlock("Nessun risultato", "Nessun mazzo corrisponde ai filtri selezionati.")); return;
  }

  const dir = sort.direction === "asc" ? 1 : -1;
  decks = [...decks].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key];
    const an = av === null || av === undefined; const bn = bv === null || bv === undefined;
    if (an && !bn) return 1; if (!an && bn) return -1;
    if (sort.key === "nome") return deckLabel(a).localeCompare(deckLabel(b), "it") * dir;
    return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
  });

  const desktop = el("div", "desktop-table table-wrap");
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const row = document.createElement("tr");
  const heads = [["nome", "Archetipo / mazzo"], ["partite", "Partite"], ["vittorie", "V"], ["sconfitte", "S"], ["win_rate", "Win rate"], ["quota_meta", "Quota meta"]];
  for (const [key, label] of heads) {
    const th = document.createElement("th");
    const button = el("button", "", `${label}${sort.key === key ? (sort.direction === "asc" ? " ↑" : " ↓") : ""}`);
    button.type = "button"; button.dataset.sort = key; th.append(button); row.append(th);
  }
  thead.append(row); table.append(thead);
  const tbody = document.createElement("tbody");
  for (const deck of decks) {
    const tr = document.createElement("tr");
    const tdDeck = document.createElement("td"); tdDeck.append(renderDeckIdentity(deck, apiFilters)); tr.append(tdDeck);
    tr.append(metaCell(formatInteger(deck.partite)), metaCell(formatInteger(deck.vittorie)), metaCell(formatInteger(deck.sconfitte)));
    const wr = sampleSufficient(deck) ? formatPercent(deck.win_rate) : null;
    tr.append(metaCell(wr || "Dati insufficienti", wr ? winRateClass(deck.win_rate) : "insufficient"));
    const share = sampleSufficient(deck) ? formatPercent(deck.quota_meta) : null;
    const tdShare = document.createElement("td");
    if (share) {
      const cell = el("div", "share-cell"); cell.append(el("span", "", share));
      const bar = el("span", "share-bar"); const fill = el("span");
      fill.style.width = `${Math.min(100, Math.max(2, Number(deck.quota_meta) || 0))}%`; bar.append(fill); cell.append(bar); tdShare.append(cell);
    } else tdShare.append(el("span", "insufficient", "Dati insufficienti"));
    tr.append(tdShare); tbody.append(tr);
  }
  table.append(tbody); desktop.append(table); body.append(desktop);

  const mobile = el("div", "mobile-meta");
  for (const deck of decks) {
    const classified = deckIsClassified(deck);
    const url = deckDetailUrl(deck, apiFilters);
    const card = el(url ? "a" : "div", "mobile-deck");
    if (url) card.href = url;
    const head = el("div", "mobile-deck-head");
    const title = el("div");
    title.append(el("strong", "", deckLabel(deck)), el("small", "", classificationSummary(deck)));
    if (!classified && deck.impronta) title.append(el("small", "", `ID tecnico ${shortFingerprint(deck.impronta)}`));
    head.append(title, el("span", "", `${formatInteger(deck.partite)} pt.${url ? " ›" : ""}`)); card.append(head);
    if (classified) {
      const core = createCoreStrip(deck.carte_core || []);
      if (core.childNodes.length) card.append(core);
    }
    const grid = el("div", "mobile-deck-grid");
    const values = [
      ["V / S", `${formatInteger(deck.vittorie)} / ${formatInteger(deck.sconfitte)}`],
      ["Win rate", sampleSufficient(deck) ? formatPercent(deck.win_rate) : "Dati insufficienti"],
      ["Quota meta", sampleSufficient(deck) ? formatPercent(deck.quota_meta) : "Dati insufficienti"],
      [deck.impronta && !classified ? "ID tecnico" : "Modalità", deck.impronta && !classified ? shortFingerprint(deck.impronta) : (deckMode(deck) || "—")],
    ];
    for (const [label, value] of values) { const metric = el("div", "mobile-metric"); metric.append(el("span", "", label), el("strong", "", value)); grid.append(metric); }
    card.append(grid); mobile.append(card);
  }
  body.append(mobile);
}

export function renderMetaError(error) {
  const body = document.querySelector("#meta-body"); clear(body); body.append(stateBlock("Meta non disponibile", error.message || "Errore di rete", "meta"));
  document.querySelector("#meta-count").textContent = "Errore";
  document.querySelector("#meta-updated").textContent = "";
  document.querySelector("#meta-visible").textContent = "";
}

export function renderScontri(data) {
  const root = document.querySelector("#matchup-state"); clear(root);
  root.closest(".matchup-panel")?.classList.toggle("is-unavailable", data.disponibile === false);
  if (data.disponibile === false) {
    const lock = el("div", "lock", "🔒");
    const text = el("div");
    text.append(
      el("h3", "", "Matchup non ancora pubblicabili"),
      el("p", "", data.motivo || "I matchup saranno mostrati quando i dati saranno sufficientemente affidabili."),
      el("p", "matchup-context", "Quando disponibili, ogni valore si riferirà a un archetipo specifico contro un altro archetipo specifico.")
    );
    root.append(lock, text); return;
  }
  const count = Array.isArray(data.scontri) ? data.scontri.length : 0;
  root.append(stateBlock("Matchup disponibili", `${formatInteger(count)} confronti pronti. La matrice verrà renderizzata qui.`));
}
export function renderScontriLoading() {
  const root = document.querySelector("#matchup-state"); clear(root); root.closest(".matchup-panel")?.classList.remove("is-unavailable"); root.append(stateBlock("Caricamento matchup", "Verifica disponibilità in corso…"));
}
export function renderScontriError(error) {
  const root = document.querySelector("#matchup-state"); clear(root); root.closest(".matchup-panel")?.classList.add("is-unavailable"); root.append(stateBlock("Matchup non raggiungibili", error.message || "Errore di rete", "scontri"));
}
