import { deckLabel, formatDate, formatInteger, formatPercent, sampleSufficient, shortFingerprint, winRateClass } from "./format.js";
import { classificationSummary, deckColors, deckDetailUrl, deckIsClassified, deckMode, deckStrategy, filterMetaDecks, strategyLabel } from "./meta-model.js";
import { createCoreStrip } from "./card-images.js";

const INGLESE = document.documentElement.lang === "en";
// Nelle schede mobili il numero di partite va nella lingua della pagina.
const partiteBreve = (partite) => (INGLESE ? (Number(partite) === 1 ? "match" : "matches") : "pt.");

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

// «Altro (Brew)» con liste sotto soglia: sottraendo i Brew pubblici dal record
// del gruppo si ricaverebbe quello delle liste sotto soglia, quindi non esce.
function cellaRecordRiservato() {
  const cella = el("td", "meta-below");
  cella.append(el("strong", "", INGLESE ? "Not published" : "Non pubblicato"),
    el("small", "", INGLESE ? "while some lists are below threshold" : "finché ci sono liste sotto soglia"));
  return cella;
}

// «Altro (Brew)» resta una riga aggregata; il pulsante apre le liste reali che
// la compongono. Lo stato sopravvive ai ridisegni (ordinamento, filtri locali).
let brewAperto = false;

// Una per una solo le liste arrivate alla soglia, con la loro impronta.
function variantiBrew(deck) {
  return (Array.isArray(deck?.varianti_brew) ? deck.varianti_brew : [])
    .filter((variante) => typeof variante?.impronta === "string" && variante.impronta.trim() &&
      sampleSufficient(variante));
}

// Le liste sotto soglia arrivano solo come conteggio: una voce, senza link.
function sottoSogliaBrew(deck) {
  const liste = Number(deck?.brew_sotto_soglia?.liste) || 0;
  return liste > 0 ? { liste, partite: Number(deck.brew_sotto_soglia.partite) || 0 } : null;
}

function testiRestoBrew(sotto, soglia) {
  const una = sotto.liste === 1;
  const quante = formatInteger(sotto.liste);
  const limite = formatInteger(Number(soglia) || 30);
  if (INGLESE) {
    return {
      titolo: `${quante} ${una ? "list" : "lists"} below threshold`,
      nota: una ? `It doesn't have ${limite} matches yet: it appears here on its own once it gets there.`
        : `None has ${limite} matches yet: each appears here on its own once it gets there.`,
      breve: una ? `It appears on its own from ${limite} matches.` : `Each appears on its own from ${limite} matches.`,
      riservati: "Data and decklists not published",
    };
  }
  return {
    titolo: `${quante} ${una ? "lista" : "liste"} sotto soglia`,
    nota: una ? `Non ha ancora ${limite} partite: compare qui da sola quando ci arriva.`
      : `Nessuna ha ancora ${limite} partite: compaiono qui una per una quando ci arrivano.`,
    breve: una ? `Compare da sola da ${limite} partite.` : `Compaiono una per una da ${limite} partite.`,
    riservati: "Dati e decklist non pubblicati",
  };
}

function rigaRestoBrew(sotto, soglia) {
  const testi = testiRestoBrew(sotto, soglia);
  const tr = el("tr", "brew-child brew-rest");
  const nome = el("td", "brew-child-name");
  nome.append(el("strong", "", testi.titolo), el("small", "", testi.nota));
  const stato = el("td", "brew-rest-state", testi.riservati);
  stato.colSpan = 2;
  tr.append(nome, metaCell(formatInteger(sotto.partite)), metaCell("—"), metaCell("—"), stato, el("td", "open-cell"));
  return tr;
}

function schedaRestoBrew(sotto, soglia) {
  const testi = testiRestoBrew(sotto, soglia);
  const scheda = el("div", "mobile-brew-child brew-rest");
  const testa = el("div", "mobile-brew-child-head");
  testa.append(el("strong", "", testi.titolo),
    el("span", "", `${formatInteger(sotto.partite)} ${partiteBreve(sotto.partite)}`));
  const valori = el("div", "mobile-brew-child-meta");
  valori.append(el("span", "", testi.breve));
  scheda.append(testa, valori);
  return scheda;
}

function etichettaBrew(variante, indice) {
  return variante.etichetta || `Brew #${indice + 1}`;
}

function aggiornaBrew() {
  for (const bottone of document.querySelectorAll(".brew-toggle")) {
    bottone.setAttribute("aria-expanded", String(brewAperto));
  }
  for (const gruppo of document.querySelectorAll(".brew-children")) gruppo.hidden = !brewAperto;
}

function bottoneBrew(quante, idGruppo) {
  const liste = INGLESE
    ? `${formatInteger(quante)} ${quante === 1 ? "list" : "lists"}`
    : `${formatInteger(quante)} ${quante === 1 ? "lista" : "liste"}`;
  const bottone = el("button", "brew-toggle", liste);
  bottone.type = "button";
  bottone.setAttribute("aria-controls", idGruppo);
  bottone.setAttribute("aria-expanded", String(brewAperto));
  bottone.setAttribute("aria-label", INGLESE ? `${liste} in Other (Brew)` : `${liste} di Altro (Brew)`);
  const freccia = el("span", "brew-chevron", "⌄");
  freccia.setAttribute("aria-hidden", "true");
  bottone.append(freccia);
  bottone.addEventListener("click", () => { brewAperto = !brewAperto; aggiornaBrew(); });
  return bottone;
}

function gruppoBrew(tag, id, classe = "") {
  const gruppo = el(tag, classe ? `brew-children ${classe}` : "brew-children");
  gruppo.id = id;
  gruppo.hidden = !brewAperto;
  return gruppo;
}

// Una lista di Altro nella tabella: nome neutro, numeri reali, win rate solo
// sopra soglia e il dettaglio per impronta. L'impronta sta solo nel link.
function rigaBrew(variante, indice, apiFilters, soglia) {
  const nome = etichettaBrew(variante, indice);
  const tr = el("tr", "brew-child");
  const tdNome = el("td", "brew-child-name");
  tdNome.append(el("strong", "", nome), el("small", "", INGLESE ? "Unclassified list" : "Lista non classificata"));
  tr.append(tdNome, metaCell(formatInteger(variante.partite)), metaCell(formatInteger(variante.vittorie)),
    metaCell(formatInteger(variante.sconfitte)));
  if (sampleSufficient(variante)) {
    const wr = formatPercent(variante.win_rate);
    tr.append(metaCell(wr || "—", wr ? winRateClass(variante.win_rate) : ""),
      metaCell(formatPercent(variante.quota_meta) || "—"));
  } else {
    tr.append(cellaSottoSoglia(variante, soglia));
  }
  const tdApri = el("td", "open-cell");
  const url = deckDetailUrl({ impronta: variante.impronta }, apiFilters);
  if (url) {
    const apri = el("a", "text-link", "Apri");
    apri.href = url;
    apri.setAttribute("aria-label", INGLESE ? `Open ${nome}` : `Apri ${nome}`);
    tdApri.append(apri);
  }
  tr.append(tdApri);
  return tr;
}

function schedaBrew(variante, indice, apiFilters) {
  const nome = etichettaBrew(variante, indice);
  const url = deckDetailUrl({ impronta: variante.impronta }, apiFilters);
  const scheda = el(url ? "a" : "div", "mobile-brew-child");
  if (url) scheda.href = url;
  const testa = el("div", "mobile-brew-child-head");
  testa.append(el("strong", "", nome), el("span", "", `${formatInteger(variante.partite)} ${partiteBreve(variante.partite)}${url ? " ›" : ""}`));
  const valori = el("div", "mobile-brew-child-meta");
  valori.append(el("span", "", "V / S"),
    el("strong", "", `${formatInteger(variante.vittorie)} / ${formatInteger(variante.sconfitte)}`),
    el("strong", "", sampleSufficient(variante) ? (formatPercent(variante.win_rate) || "—") : "Sotto soglia"));
  scheda.append(testa, valori);
  return scheda;
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
  let tbody = document.createElement("tbody");
  for (const deck of decks) {
    const varianti = variantiBrew(deck);
    const sotto = sottoSogliaBrew(deck);
    const liste = varianti.length + (sotto?.liste || 0);
    const tr = document.createElement("tr");
    const tdDeck = document.createElement("td"); tdDeck.append(renderDeckIdentity(deck, apiFilters));
    if (liste) tdDeck.append(bottoneBrew(liste, "meta-brew-righe"));
    tr.append(tdDeck);
    const riservato = deck?.record_pubblico === false;
    tr.append(metaCell(formatInteger(deck.partite)), metaCell(riservato ? "—" : formatInteger(deck.vittorie)),
      metaCell(riservato ? "—" : formatInteger(deck.sconfitte)));
    if (sampleSufficient(deck)) {
      const wr = formatPercent(deck.win_rate);
      tr.append(riservato ? cellaRecordRiservato() : metaCell(wr || "—", wr ? winRateClass(deck.win_rate) : ""));
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
      apri.setAttribute("aria-label", INGLESE ? `Open ${deckLabel(deck)}` : `Apri ${deckLabel(deck)}`);
      tdApri.append(apri);
    }
    tr.append(tdApri);
    tbody.append(tr);
    if (liste) {
      // Le liste di Altro stanno in un tbody proprio, subito sotto la riga
      // aggregata: e' il contenitore che il pulsante apre e chiude.
      const figli = gruppoBrew("tbody", "meta-brew-righe");
      varianti.forEach((variante, indice) =>
        figli.append(rigaBrew(variante, indice, apiFilters, data.soglia_percentuali)));
      if (sotto) figli.append(rigaRestoBrew(sotto, data.soglia_percentuali));
      table.append(tbody, figli);
      tbody = document.createElement("tbody");
    }
  }
  if (tbody.childNodes.length) table.append(tbody);
  desktop.append(table); body.append(desktop);

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
    head.append(title, el("span", "", `${formatInteger(deck.partite)} ${partiteBreve(deck.partite)}${url ? " ›" : ""}`)); card.append(head);
    if (classified) {
      const core = createCoreStrip(deck.carte_core || []);
      if (core.childNodes.length) card.append(core);
    }
    const grid = el("div", "mobile-deck-grid");
    // Sotto soglia una sola voce, non due «Sotto soglia» uguali (specifica, sezione 6).
    const riservato = deck?.record_pubblico === false;
    const values = [
      ["V / S", riservato ? "—" : `${formatInteger(deck.vittorie)} / ${formatInteger(deck.sconfitte)}`],
      ...(sufficiente
        ? [["Win rate", riservato ? (INGLESE ? "Not published" : "Non pubblicato") : formatPercent(deck.win_rate)],
          ["Quota meta", formatPercent(deck.quota_meta)]]
        : [["Win rate e quota meta", "Sotto soglia"]]),
      [deck.impronta && !classified ? "ID tecnico" : "Modalità", deck.impronta && !classified ? shortFingerprint(deck.impronta) : (deckMode(deck) || "—")],
    ];
    for (const [label, value] of values) { const metric = el("div", "mobile-metric"); metric.append(el("span", "", label), el("strong", "", value)); grid.append(metric); }
    card.append(grid);
    if (!sufficiente) card.append(el("p", "mobile-below", testoSottoSoglia(deck, data.soglia_percentuali)));
    // Il pulsante non puo' stare dentro una scheda che e' gia' un link.
    const varianti = variantiBrew(deck);
    const sotto = sottoSogliaBrew(deck);
    const liste = varianti.length + (sotto?.liste || 0);
    const bottone = liste ? bottoneBrew(liste, "meta-brew-schede") : null;
    if (bottone && !url) card.append(bottone);
    mobile.append(card);
    if (bottone && url) mobile.append(bottone);
    if (bottone) {
      const figli = gruppoBrew("div", "meta-brew-schede", "mobile-brew-children");
      varianti.forEach((variante, indice) => figli.append(schedaBrew(variante, indice, apiFilters)));
      if (sotto) figli.append(schedaRestoBrew(sotto, data.soglia_percentuali));
      mobile.append(figli);
    }
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
