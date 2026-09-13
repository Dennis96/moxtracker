import { deckLabel, formatDate, formatInteger, formatPercent, sampleSufficient, shortFingerprint, winRateClass } from "./format.js";
import { classificationSummary, deckColors, deckDetailUrl, deckIsClassified, deckMode, deckStrategy, filterMetaDecks, strategyLabel } from "./meta-model.js";
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

// Sotto soglia non pubblichiamo percentuali: diciamo quante partite ci sono e
// quante ne mancano, invece di ripetere due volte «Dati insufficienti».
export function partiteMancanti(deck, soglia) {
  const limite = Math.max(1, Number(soglia) || 30);
  return { soglia: limite, mancano: Math.max(0, limite - (Number(deck?.partite) || 0)) };
}

function testoSottoSoglia(deck, soglia) {
  const { soglia: limite, mancano } = partiteMancanti(deck, soglia);
  return mancano > 0
    ? `${formatInteger(deck.partite)} partite su ${formatInteger(limite)}: ne mancano ${formatInteger(mancano)}`
    : "Campione non ancora affidabile";
}

function cellaSottoSoglia(deck, soglia) {
  const cella = el("td", "meta-below");
  cella.colSpan = 2;
  const { soglia: limite } = partiteMancanti(deck, soglia);
  const barra = el("span", "below-meter");
  barra.setAttribute("aria-hidden", "true");
  const riempimento = el("span");
  riempimento.style.width = `${Math.min(100, Math.round(((Number(deck.partite) || 0) / limite) * 100))}%`;
  barra.append(riempimento);
  cella.append(el("strong", "", "Sotto soglia"), barra, el("small", "", testoSottoSoglia(deck, soglia)));
  return cella;
}

function renderDeckIdentity(deck, apiFilters) {
  const url = deckDetailUrl(deck, apiFilters);
  const link = el(url ? "a" : "div", "deck-link");
  if (url) link.href = url;
  const classified = deckIsClassified(deck);
  const text = el("span", "deck-copy");
  text.append(el("strong", "deck-name", deckLabel(deck)));
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
  link.append(text);
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
  table.append(el("caption", "visually-hidden", "Archetipi del Meta, ordinabili per colonna"));
  const thead = document.createElement("thead");
  const row = document.createElement("tr");
  const heads = [["nome", "Archetipo / mazzo"], ["partite", "Partite"], ["vittorie", "V"], ["sconfitte", "S"], ["win_rate", "Win rate"], ["quota_meta", "Quota meta"]];
  for (const [key, label] of heads) {
    const th = document.createElement("th");
    th.scope = "col";
    const attivo = sort.key === key;
    if (attivo) th.setAttribute("aria-sort", sort.direction === "asc" ? "ascending" : "descending");
    const button = el("button", "", label);
    if (attivo) {
      const freccia = el("span", "sort-arrow", sort.direction === "asc" ? "↑" : "↓");
      freccia.setAttribute("aria-hidden", "true");
      button.append(freccia);
    }
    button.type = "button"; button.dataset.sort = key; th.append(button); row.append(th);
  }
  const thApri = document.createElement("th");
  thApri.scope = "col";
  thApri.append(el("span", "visually-hidden", "Dettaglio"));
  row.append(thApri);
  thead.append(row); table.append(thead);
  const tbody = document.createElement("tbody");
  for (const deck of decks) {
    const tr = document.createElement("tr");
    const tdDeck = document.createElement("td"); tdDeck.append(renderDeckIdentity(deck, apiFilters)); tr.append(tdDeck);
    tr.append(metaCell(formatInteger(deck.partite)), metaCell(formatInteger(deck.vittorie)), metaCell(formatInteger(deck.sconfitte)));
    if (sampleSufficient(deck)) {
      const wr = formatPercent(deck.win_rate);
      tr.append(metaCell(wr || "—", wr ? winRateClass(deck.win_rate) : ""));
      const share = formatPercent(deck.quota_meta);
      const tdShare = document.createElement("td");
      const cell = el("div", "share-cell"); cell.append(el("span", "", share || "—"));
      const bar = el("span", "share-bar"); const fill = el("span");
      fill.style.width = `${Math.min(100, Math.max(2, Number(deck.quota_meta) || 0))}%`; bar.append(fill); cell.append(bar); tdShare.append(cell);
      tr.append(tdShare);
    } else {
      tr.append(cellaSottoSoglia(deck, data.soglia_percentuali));
    }
    const tdApri = el("td", "open-cell");
    const url = deckDetailUrl(deck, apiFilters);
    if (url) {
      const apri = el("a", "text-link", "Apri");
      apri.href = url;
      apri.setAttribute("aria-label", `Apri ${deckLabel(deck)}`);
      tdApri.append(apri);
    }
    tr.append(tdApri);
    tbody.append(tr);
  }
  table.append(tbody); desktop.append(table); body.append(desktop);

  const mobile = el("div", "mobile-meta");
  for (const deck of decks) {
    const classified = deckIsClassified(deck);
    const sufficiente = sampleSufficient(deck);
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
      ["Win rate", sufficiente ? formatPercent(deck.win_rate) : "Sotto soglia"],
      ["Quota meta", sufficiente ? formatPercent(deck.quota_meta) : "Sotto soglia"],
      [deck.impronta && !classified ? "ID tecnico" : "Modalità", deck.impronta && !classified ? shortFingerprint(deck.impronta) : (deckMode(deck) || "—")],
    ];
    for (const [label, value] of values) { const metric = el("div", "mobile-metric"); metric.append(el("span", "", label), el("strong", "", value)); grid.append(metric); }
    card.append(grid);
    if (!sufficiente) card.append(el("p", "mobile-below", testoSottoSoglia(deck, data.soglia_percentuali)));
    mobile.append(card);
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
    const text = el("div");
    text.append(
      el("h3", "", "Matchup non ancora pubblicabili"),
      el("p", "", data.motivo || "I matchup saranno mostrati quando i dati saranno sufficientemente affidabili."),
      el("p", "matchup-context", "Quando disponibili, ogni valore si riferirà a un archetipo specifico contro un altro archetipo specifico.")
    );
    root.append(text); return;
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
