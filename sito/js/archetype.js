import { DEFAULT_FORMAT, nomeRank } from "./config.js";
import { fetchArchetipo } from "./api.js";
import { deckLabel, formatInteger, formatPercent, sampleSufficient } from "./format.js";
import { brewVariantDistance, brewVariantLabel, canonicalBrewUrl, classificationSummary, deckColors, deckIsClassified, deckMode, deckStrategy, detailIdentifier, ID_GRUPPO_BREW, observedDecklistCards, strategyLabel, validVariantId } from "./meta-model.js";
import { createCardListItem, parseReferenceLine } from "./card-images.js";
import { renderProfiloMazzo } from "./deck-profile.js";
import { traduciDocumento } from "./translate.js";

const INGLESE = document.documentElement.lang === "en";

function tag(text, className = "") {
  const node = document.createElement("span"); node.className = className; node.textContent = text; return node;
}
function setText(selector, value) { document.querySelector(selector).textContent = value; }
function titleCase(value) {
  return String(value || "").replace(/(^|[\s'-])([a-zà-öø-ÿ])/g, (_, a, b) => a + b.toUpperCase());
}

// Una variante si seleziona con il vecchio id a 12 caratteri (archetipi e liste
// per impronta) o con l'id opaco `bv_` di un gruppo Brew. Deve essere presente
// nella risposta del filtro corrente: niente richieste laterali per cercarla.
function selectedVariant(data, variantId) {
  if (!validVariantId(variantId)) return null;
  const variants = Array.isArray(data?.varianti) ? data.varianti : [];
  const index = variants.findIndex(variant =>
    String(variant?.variante_id || "").toLowerCase() === variantId.toLowerCase()
  );
  return index >= 0 ? { variant: variants[index], index } : null;
}

function overviewUrl() {
  const url = new URL(location.href);
  url.searchParams.delete("variante");
  url.hash = "";
  return url.href;
}

function variantViewUrl(variant) {
  const url = new URL(location.href);
  url.searchParams.set("variante", String(variant?.variante_id || ""));
  url.hash = "";
  return url.href;
}

// Il Meta vive in meta.html: il percorso e «Cambia filtri» portano lì con gli
// stessi filtri, che main.js riapplica.
function metaUrl() {
  const url = new URL("./meta.html", location.href);
  const attuali = new URLSearchParams(location.search);
  for (const nome of ["formato", "periodo", "modalita", "rank"]) {
    const valore = attuali.get(nome);
    if (valore) url.searchParams.set(nome, valore);
  }
  return url.href;
}

function nomiRank(rank) {
  return String(rank).split(",").map((classe) => nomeRank(classe, INGLESE)).join(", ");
}

// Riga dei filtri attivi, sotto il titolo: formato, periodo, modalità, rank.
export function rigaFiltri({ formato, periodo, modalita, rank }) {
  const tempo = periodo === "totale"
    ? (INGLESE ? "all time" : "tutto il periodo")
    : (INGLESE ? `last ${periodo} days` : `ultimi ${periodo} giorni`);
  const livelli = rank ? `rank ${nomiRank(rank)}` : (INGLESE ? "all ranks" : "tutti i rank");
  return [formato, tempo, modalita || "BO1 + BO3", livelli].join(", ");
}

// Quante partite dell'archetipo stanno in varianti con decklist pubblicata e
// quante in liste ancora sotto soglia: è la barra sopra l'elenco delle varianti.
export function ripartizioneVarianti(data) {
  const varianti = Array.isArray(data?.varianti) ? data.varianti : [];
  const pubblicate = varianti.filter((variante) => variante?.decklist_pubblicabile === true);
  const nonPubblicate = varianti.filter((variante) => variante?.decklist_pubblicabile !== true);
  const somma = (elenco) => elenco.reduce((totale, variante) => totale + (Number(variante?.partite) || 0), 0);
  const altre = data?.altre_varianti || {};
  const partitePubblicate = somma(pubblicate);
  const sottoSoglia = somma(nonPubblicate) + (Number(altre.partite) || 0);
  return {
    pubblicate: partitePubblicate,
    variantiPubblicate: pubblicate.length,
    sottoSoglia,
    liste: nonPubblicate.length + (Number(altre.varianti) || 0),
    totale: partitePubblicate + sottoSoglia,
  };
}

function renderRipartizione(data) {
  const box = document.querySelector("#variants-split");
  // Un gruppo Brew pubblica solo le sue varianti sopra soglia: la barra
  // direbbe «0 liste sotto soglia», un dato che il server non espone.
  if (data?.tipo_dettaglio === "brew_group") {
    box.hidden = true;
    return;
  }
  const r = ripartizioneVarianti(data);
  box.hidden = !r.totale;
  if (!r.totale) return;
  const quota = Math.round((r.pubblicate / r.totale) * 1000) / 10;
  box.querySelector(".split-pub").style.width = `${quota}%`;
  box.querySelector(".split-rest").style.width = `${Math.max(0, 100 - quota)}%`;
  const [totale, pubblicate, sotto, liste] = [r.totale, r.pubblicate, r.sottoSoglia, r.liste].map(formatInteger);
  // La frase parla delle partite delle varianti, non del totale dell'archetipo:
  // se l'API non elencasse ogni variante, i due numeri potrebbero non coincidere.
  setText("#variants-split-note", INGLESE
    ? `Across ${totale} matches in observed variants: ${pubblicate} in ${r.variantiPubblicate === 1 ? "the published variant" : "published variants"}, ${sotto} in ${liste} ${r.liste === 1 ? "list" : "lists"} still below the threshold.`
    : `Sulle ${totale} partite delle varianti osservate: ${pubblicate} ${r.variantiPubblicate === 1 ? "nella variante pubblicata" : "nelle varianti pubblicate"}, ${sotto} in ${liste} ${r.liste === 1 ? "lista" : "liste"} ancora sotto soglia.`);
}

function recordTesto(dati) {
  return INGLESE
    ? `${formatInteger(dati.vittorie)} W / ${formatInteger(dati.sconfitte)} L`
    : `${formatInteger(dati.vittorie)} V / ${formatInteger(dati.sconfitte)} S`;
}

function vocePercorso(testo, href = null) {
  const voce = document.createElement("li");
  if (href) {
    const link = document.createElement("a"); link.href = href; link.textContent = testo; voce.append(link);
  } else {
    voce.textContent = testo;
    voce.setAttribute("aria-current", "page");
  }
  return voce;
}

function renderPercorso(parentTitle, selection) {
  const lista = document.querySelector("#detail-path ol");
  const explorer = vocePercorso("Meta Explorer", metaUrl());
  if (!selection) {
    lista.replaceChildren(explorer, vocePercorso(parentTitle));
    return;
  }
  lista.replaceChildren(explorer, vocePercorso(parentTitle, overviewUrl()),
    vocePercorso("Varianti osservate", `${overviewUrl()}#variants-panel`),
    vocePercorso(`Variante osservata #${selection.index + 1}`));
}

function variantMetaShare(variant) {
  if (!sampleSufficient(variant)) return null;
  const share = Number(variant?.quota_meta);
  return Number.isFinite(share) ? share : null;
}

function renderDeck(deck, params, selection) {
  const brewGroup = deck?.tipo_dettaglio === "brew_group";
  const parentTitle = brewGroup ? (INGLESE ? "Brew group" : "Gruppo Brew") : deckLabel(deck);
  const classified = deckIsClassified(deck);
  const variant = selection?.variant || null;
  const stats = variant || deck;
  // Il titolo della scheda del browser non passa dalla traduzione a runtime:
  // lo scriviamo già nella lingua della pagina.
  const displayTitle = selection
    ? (INGLESE ? `Observed variant #${selection.index + 1}` : `Variante osservata #${selection.index + 1}`)
    : parentTitle;
  document.body.classList.toggle("variant-mode", Boolean(selection));
  document.title = selection ? `${displayTitle} — ${parentTitle} — MOX Arena Assistant` : `${parentTitle} — MOX Arena Assistant`;
  document.querySelector("#detail-heading h1").textContent = displayTitle;
  renderPercorso(parentTitle, selection);
  setText("#detail-filters", rigaFiltri(params));

  const tags = document.querySelector("#detail-tags"); tags.replaceChildren();
  if (selection) tags.append(tag(parentTitle, "detail-tag parent-archetype-tag"));
  if (classified) {
    const colors = deckColors(deck);
    for (const color of colors) tags.append(tag(color, `detail-tag color-tag tag-${color.toLowerCase()}`));
    const strategy = deckStrategy(deck);
    if (strategy) tags.append(tag(strategyLabel(strategy), "detail-tag"));
    const mode = deckMode(deck);
    if (mode) tags.append(tag(mode, "detail-tag"));
    if (!colors.length && !strategy) tags.append(tag(classificationSummary(deck), "detail-tag"));
  } else {
    // Una lista non classificata non ha nome: l'impronta resta tecnica e
    // serve solo al collegamento, non si mostra.
    tags.append(tag("Archetipo non ancora confermato", "detail-tag pending-tag"));
    if (brewGroup) tags.append(tag(INGLESE ? "Similar lists grouped" : "Liste simili raggruppate", "detail-tag"));
  }
  if (selection && classified) tags.append(tag(`ID ${String(variant.variante_id || "").slice(0, 8)}`, "detail-tag variant-tag"));

  if (!selection) {
    const sufficient = sampleSufficient(stats);
    setText("#detail-winrate", sufficient ? (formatPercent(stats.win_rate) || "—") : "Dati insufficienti");
    setText("#detail-winrate-note", sufficient ? "Campione sopra soglia" : "Pubblicato da 30 partite");
    setText("#detail-share", sufficient ? (formatPercent(deck.quota_meta) || "—") : "Dati insufficienti");
    setText("#detail-share-note", sufficient ? "Quota nel filtro corrente" : "Pubblicata da 30 partite");
    setText("#detail-games", formatInteger(stats.partite));
    setText("#detail-record", recordTesto(stats));
    setText("#detail-rank", params.rank ? nomiRank(params.rank) : "Tutti");
  }
}

function cardLine(card) {
  return createCardListItem({
    arena_id: card.arena_id,
    copie: card.copie,
    nome: card.nome ? titleCase(card.nome) : "",
  });
}

function protectedDecklistBlock() {
  const box = document.createElement("div"); box.className = "locked-feature variant-decklist-locked";
  const title = document.createElement("strong"); title.textContent = "Decklist non pubblicata";
  const note = document.createElement("p");
  note.textContent = "La variante non ha ancora raggiunto le 30 partite necessarie per pubblicare la decklist osservata.";
  box.append(title, note);
  return box;
}

function nomeArena(nome) {
  return String(nome || "").replace(/[\r\n]+/g, " ").trim().slice(0, 80);
}

function testoArena(cards, nome = "") {
  const righe = cards.filter(card => card.nome && Number(card.copie) > 0)
    .map(card => `${Number(card.copie)} ${titleCase(card.nome)}`);
  return righe.length ? `${nomeArena(nome) ? `About\nName ${nomeArena(nome)}\n\n` : ""}Deck\n${righe.join("\n")}\n` : "";
}

function testoArenaRiferimento(riferimento) {
  const lista = (riferimento.lista || []).map(String).map((riga) => riga.trim()).filter(Boolean);
  const sideboard = (riferimento.sideboard || []).map(String).map((riga) => riga.trim()).filter(Boolean);
  if (!lista.length) return "";
  const nome = nomeArena(riferimento.nome_pubblico || riferimento.nome);
  return `${nome ? `About\nName ${nome}\n\n` : ""}Deck\n${lista.join("\n")}${sideboard.length ? `\n\nSideboard\n${sideboard.join("\n")}` : ""}\n`;
}

function preparaCopiaArena(bottone, testo) {
  bottone.hidden = !testo;
  bottone.onclick = testo ? async (evento) => {
    evento.preventDefault();
    try {
      await navigator.clipboard.writeText(testo);
      bottone.textContent = "Copiato";
      setTimeout(() => { bottone.textContent = "Copia per Arena"; }, 1600);
    } catch {
      bottone.textContent = "Copia non riuscita";
      setTimeout(() => { bottone.textContent = "Copia per Arena"; }, 1600);
    }
  } : null;
}

function preparaAzioniDecklist(cards, nome = "") {
  const copia = document.querySelector("#copy-variant-deck");
  const testo = testoArena(cards, nome);
  preparaCopiaArena(copia, testo);
}

function renderVariantDecklist(variant) {
  const host = document.querySelector("#variant-focus-decklist");
  host.replaceChildren();
  const badge = document.querySelector("#variant-focus-decklist-state");
  const cards = observedDecklistCards(variant);

  if (variant.decklist_pubblicabile !== true) {
    badge.textContent = "Non pubblicata";
    badge.className = "variant-state-badge is-locked";
    host.append(protectedDecklistBlock());
    preparaAzioniDecklist([]);
    document.querySelector("#variant-focus-profile").replaceChildren();
    return;
  }

  badge.textContent = "Pubblicata";
  badge.className = "variant-state-badge is-public";
  const list = document.createElement("ul");
  list.className = "decklist-cards variant-focus-card-list";
  for (const card of cards) list.append(cardLine(card));
  host.append(list);
  preparaAzioniDecklist(cards, variant.nome || "Variante osservata");
  renderProfiloMazzo(document.querySelector("#variant-focus-profile"), cards,
    { campione: `Lista osservata in ${formatInteger(variant.partite)} partite.` });

  const unknown = cards.filter(card => !card.nome).length;
  if (unknown) {
    const note = document.createElement("p"); note.className = "variant-note";
    note.textContent = `${unknown} carte hanno un Arena ID valido ma il catalogo nomi compatto del Worker non le conosce ancora.`;
    host.append(note);
  }
}

function toggleOverview(selection) {
  const overviewIds = ["detail-summary", "detail-grid", "variants-panel", "trend-panel"];
  for (const id of overviewIds) document.querySelector(`#${id}`).hidden = Boolean(selection);
  document.querySelector("#variant-focus").hidden = !selection;
}

function renderVariantFocus(deck, selection, params) {
  toggleOverview(selection);
  if (!selection) return;

  const variant = selection.variant;
  const parentTitle = deckLabel(deck);
  const sufficient = sampleSufficient(variant);
  const share = variantMetaShare(variant);

  // Archetipo, ID e rank sono già nelle etichette e nella riga filtri sotto il
  // titolo: la vista variante non li ripete.
  setText("#variant-focus-title", `Variante osservata #${selection.index + 1}`);

  // Il nome dell'archetipo va nello span sotto «Torna all'archetipo»: prima il
  // primo span del pulsante era la freccia e veniva sovrascritto dal nome.
  const back = document.querySelector("#variant-focus-back");
  back.href = overviewUrl();
  back.querySelector("strong").textContent = "Torna all'archetipo";
  back.querySelector(".back-parent").textContent = parentTitle;

  setText("#variant-focus-winrate", sufficient ? (formatPercent(variant.win_rate) || "—") : "Dati insufficienti");
  setText("#variant-focus-record", `${formatInteger(variant.vittorie)} V / ${formatInteger(variant.sconfitte)} S`);
  setText("#variant-focus-games", formatInteger(variant.partite));
  setText("#variant-focus-share", sufficient ? (formatPercent(share) || "—") : "Dati insufficienti");
  setText("#variant-focus-threshold", sufficient ? "Campione sopra soglia" : "Percentuali da 30 partite");

  renderVariantDecklist(variant);
}

function aggiornaVarianteNellUrl(variant, aperta) {
  const url = new URL(location.href);
  const id = String(variant?.variante_id || "");
  if (aperta) url.searchParams.set("variante", id);
  else if (url.searchParams.get("variante") === id) url.searchParams.delete("variante");
  history.replaceState(null, "", url);
}

function renderObservedDecklistInline(article, variant, index, { recognized = false, brewGroup = false, selected = false } = {}) {
  const cards = observedDecklistCards(variant);
  if (variant.decklist_pubblicabile !== true) {
    article.append(protectedDecklistBlock());
    return;
  }
  const details = document.createElement("details"); details.className = "variant-details";
  details.open = selected;
  const summary = document.createElement("summary"); summary.textContent = "Mostra decklist osservata";
  const introduzione = document.createElement("div"); introduzione.className = "brew-decklist-intro";
  const descrizione = document.createElement("p"); descrizione.className = "variant-note";
  descrizione.textContent = recognized
    ? (INGLESE
      ? `Variant observed in ${formatInteger(variant.partite)} matches of this archetype.`
      : `Variante osservata in ${formatInteger(variant.partite)} partite di questo archetipo.`)
    : brewGroup ? (INGLESE
      ? `Variant observed in ${formatInteger(variant.partite)} matches. It belongs to a group of similar lists, not to a confirmed archetype.`
      : `Variante osservata in ${formatInteger(variant.partite)} partite. Fa parte di un gruppo di liste simili, non di un archetipo confermato.`)
    : (INGLESE
      ? `List observed in ${formatInteger(variant.partite)} matches. It is not a confirmed archetype: it is published as a Brew after reaching the required threshold.`
      : `Lista effettivamente osservata in ${formatInteger(variant.partite)} partite. Non è un archetipo confermato: viene pubblicata come Brew dopo la soglia prevista.`);
  const copia = document.createElement("button"); copia.type = "button";
  copia.className = "button button-primary button-small"; copia.textContent = "Copia per Arena";
  // Il nome del mazzo copiato in Arena non porta ne' indici ne' identificativi.
  preparaCopiaArena(copia, testoArena(cards, recognized ? `Variante osservata #${index + 1}` : "Brew MOX"));
  introduzione.append(descrizione, copia);
  const list = document.createElement("ul"); list.className = "decklist-cards";
  for (const card of cards) list.append(cardLine(card));
  const profilo = document.createElement("section"); profilo.className = "deck-profile brew-deck-profile";
  details.append(summary, introduzione, list, profilo);
  article.append(details);
  let profiloCaricato = false;
  const caricaProfilo = () => {
    if (!details.open || profiloCaricato) return;
    profiloCaricato = true;
    renderProfiloMazzo(profilo, cards, { campione: INGLESE
      ? `${recognized ? "Variant" : "Brew"} observed in ${formatInteger(variant.partite)} matches.`
      : `${recognized ? "Variante" : "Brew"} osservata in ${formatInteger(variant.partite)} partite.` });
  };
  details.addEventListener("toggle", () => {
    if (recognized || brewGroup) aggiornaVarianteNellUrl(variant, details.open);
    caricaProfilo();
  });
  caricaProfilo();
}

// La nota del contratto S1 detta in parole semplici: quanto si somigliano le
// liste del gruppo e perche' ne compaiono solo alcune.
function introGruppoBrew(data) {
  const carte = Number(data?.soglia_distanza);
  const soglia = formatInteger(Number(data?.soglia_percentuali) || 30);
  const somiglianza = Number.isInteger(carte) && carte > 0
    ? (INGLESE
      ? `Distinct lists observed on MOX that differ by at most ${formatInteger(carte)} main-deck ${carte === 1 ? "card" : "cards"} from the representative variant.`
      : `Liste distinte osservate su MOX che differiscono al massimo di ${formatInteger(carte)} ${carte === 1 ? "carta" : "carte"} del mazzo principale dalla variante rappresentativa.`)
    : (INGLESE ? "Distinct lists observed on MOX, similar to the representative variant."
      : "Liste distinte osservate su MOX, simili alla variante rappresentativa.");
  return INGLESE
    ? `${somiglianza} Only variants with at least ${soglia} matches in the selected filter appear here: the others are not attributed to the group.`
    : `${somiglianza} Qui compaiono solo le varianti con almeno ${soglia} partite nel filtro scelto: le altre non vengono attribuite al gruppo.`;
}

function renderVariants(data, selection = null) {
  const host = document.querySelector("#variants-list");
  host.replaceChildren();
  const variants = Array.isArray(data.varianti) ? data.varianti : [];
  const totale = Number(data.varianti_osservate || variants.length);
  setText("#variants-count", `${totale} ${totale === 1 ? "variante osservata" : "varianti osservate"}`);
  renderRipartizione(data);
  if (!variants.length && !data.altre_varianti) {
    const empty = document.createElement("p"); empty.className = "variants-empty";
    empty.textContent = "Nessuna variante osservata nel filtro corrente.";
    host.append(empty);
    return;
  }

  const brewGroup = data.tipo_dettaglio === "brew_group";
  const recognized = !brewGroup && data.tipo_dettaglio !== "non_classificato";
  if (brewGroup) {
    const intro = document.querySelector("#variants-panel .panel-head p");
    if (intro) intro.textContent = introGruppoBrew(data);
  }
  for (const [index, variant] of variants.entries()) {
    const article = document.createElement("article"); article.className = "variant-card variant-summary-card";
    const head = document.createElement("div"); head.className = "variant-head";
    const identity = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = brewGroup ? brewVariantLabel(variant, INGLESE)
      : (index === 0 ? "Lista più rappresentativa" : `Variante osservata #${index + 1}`);
    const sub = document.createElement("small"); sub.textContent = `ID ${String(variant.variante_id || "").slice(0, 8) || "n.d."}`;
    // Nel gruppo Brew nessun ID: al posto suo, se il server la pubblica, la
    // distanza dalla variante rappresentativa.
    const distanza = brewGroup ? brewVariantDistance(variant, INGLESE) : null;
    const nota = document.createElement("small"); nota.textContent = distanza || "";
    identity.append(title, ...(recognized ? [sub] : []), ...(distanza ? [nota] : []));

    const right = document.createElement("div"); right.className = "variant-head-right";
    const metrics = document.createElement("div"); metrics.className = "variant-metrics";
    // Numeri e parole insieme: il testo nasce gia' nella lingua della pagina,
    // la traduzione a runtime non riconoscerebbe «45 partite» o «27 V / 18 S».
    const unaPartita = Number(variant.partite) === 1;
    const partiteLabel = INGLESE ? (unaPartita ? "match" : "matches") : (unaPartita ? "partita" : "partite");
    const wrLabel = variant.dati_sufficienti ? (formatPercent(variant.win_rate) || "—")
      : (INGLESE ? "Insufficient data" : "Dati insufficienti");
    const recordLabel = recordTesto(variant);
    metrics.innerHTML = `<span><b>${formatInteger(variant.partite)}</b> ${partiteLabel}</span><span>${recordLabel}</span><span>${wrLabel}</span>`;

    const status = document.createElement("span");
    status.className = `variant-summary-status ${variant.decklist_pubblicabile === true ? "is-public" : "is-locked"}`;
    status.textContent = variant.decklist_pubblicabile === true ? "Decklist pubblicata" : "Decklist da 30 partite";

    right.append(metrics, status);
    head.append(identity, right);
    article.append(head);

    renderObservedDecklistInline(article, variant, index, {
      recognized,
      brewGroup,
      selected: selection?.index === index,
    });
    host.append(article);
  }
  if (data.altre_varianti) {
    const altre = document.createElement("article");
    altre.className = "variant-card variant-summary-card other-variants";
    const quante = Number(data.altre_varianti.varianti || 0);
    const partite = Number(data.altre_varianti.partite || 0);
    // Numero e parola stanno nello stesso nodo di testo: la traduzione esatta
    // non li riconoscerebbe, quindi il testo nasce già nella lingua della pagina.
    const testa = document.createElement("div"); testa.className = "variant-head";
    const identita = document.createElement("div");
    const titolo = document.createElement("strong"); titolo.textContent = INGLESE ? "Other variants" : "Altre varianti";
    const liste = document.createElement("small");
    liste.textContent = INGLESE
      ? `${quante} ${quante === 1 ? "list" : "lists"} below threshold`
      : `${quante} ${quante === 1 ? "lista sotto soglia" : "liste sotto soglia"}`;
    identita.append(titolo, liste);
    const metriche = document.createElement("div"); metriche.className = "variant-metrics";
    const aggregate = document.createElement("span");
    const numero = document.createElement("b"); numero.textContent = formatInteger(partite);
    aggregate.append(numero, INGLESE
      ? ` aggregated ${partite === 1 ? "match" : "matches"}`
      : ` ${partite === 1 ? "partita aggregata" : "partite aggregate"}`);
    const riservati = document.createElement("span");
    riservati.textContent = INGLESE ? "Data and decklists not published" : "Dati e decklist non pubblicati";
    metriche.append(aggregate, riservati);
    testa.append(identita, metriche);
    altre.append(testa);
    host.append(altre);
  }
}

function renderReferences(data) {
  const host = document.querySelector("#reference-lists"); host.replaceChildren();
  const refs = (Array.isArray(data.liste_riferimento) ? data.liste_riferimento : [])
    .filter(ref => !ref?.origine || ref.origine === "catalogo_reference");
  const titleLabel = document.querySelector("#reference-title-label");
  if (titleLabel) titleLabel.textContent = refs.length === 1 ? "Lista di riferimento del catalogo" : "Liste di riferimento del catalogo";
  if (!refs.length) {
    host.innerHTML = "<strong>Nessuna lista di riferimento</strong><p>Il catalogo non espone una lista per questo archetipo.</p>";
    return;
  }
  for (const ref of refs) {
    const details = document.createElement("details"); details.className = "reference-details";
    const summary = document.createElement("summary");
    summary.textContent = [ref.nome_pubblico || ref.nome, ref.modalita].filter(Boolean).join(" • ");
    const copia = document.createElement("button"); copia.type = "button"; copia.className = "variant-action reference-copy";
    copia.textContent = "Copia per Arena";
    preparaCopiaArena(copia, testoArenaRiferimento(ref));
    const list = document.createElement("ul"); list.className = "reference-decklist";
    for (const line of ref.lista || []) list.append(createCardListItem(parseReferenceLine(line)));
    details.append(summary, copia, list);
    if ((ref.sideboard || []).length) {
      const sideTitle = document.createElement("strong"); sideTitle.className = "sideboard-title"; sideTitle.textContent = "Sideboard";
      const side = document.createElement("ul"); side.className = "reference-decklist";
      for (const line of ref.sideboard) side.append(createCardListItem(parseReferenceLine(line)));
      details.append(sideTitle, side);
    }
    const meta = document.createElement("p"); meta.className = "reference-meta";
    meta.textContent = ["Lista pubblica del catalogo mox-meta", ref.data ? `Riferimento ${ref.data}` : null, ref.fonte ? "Fonte catalogo mox-meta" : null].filter(Boolean).join(" • ");
    details.append(meta);
    host.append(details);
  }
}

function renderRepresentativeProfile(data) {
  const osservata = (Array.isArray(data.varianti) ? data.varianti : [])
    .find((variante) => variante.decklist_pubblicabile === true);
  if (osservata) {
    renderProfiloMazzo(document.querySelector("#deck-profile"), observedDecklistCards(osservata),
      { campione: `Lista rappresentativa osservata in ${formatInteger(osservata.partite)} partite.` });
    return;
  }
  const riferimento = (data.liste_riferimento || []).find((ref) => Array.isArray(ref.lista));
  const carte = (riferimento?.lista || []).map(parseReferenceLine);
  renderProfiloMazzo(document.querySelector("#deck-profile"), carte,
    { campione: "Lista di catalogo: non è un campione osservato degli utenti MOX." });
}

function renderError(message) {
  const node = document.querySelector("#detail-error"); node.hidden = false; node.textContent = message;
  document.querySelector("#detail-summary").classList.add("muted-content");
  document.querySelector("#detail-heading h1").textContent = "Dettaglio non disponibile";
}

// Un vecchio link per impronta di una lista che ora sta in un gruppo Brew: si
// carica il gruppo e l'indirizzo diventa quello canonico, con replaceState e
// senza una voce di cronologia in piu'. Se il gruppo non risponde, o non
// contiene quella lista, resta il percorso vecchio.
async function gruppoCanonico(legacy, filtri) {
  if (legacy?.tipo_dettaglio !== "non_classificato" ||
      !ID_GRUPPO_BREW.test(String(legacy?.gruppo_brew_id || ""))) return null;
  try {
    const gruppo = await fetchArchetipo({ ...filtri, id_brew: legacy.gruppo_brew_id });
    const url = canonicalBrewUrl(location.href, legacy, gruppo);
    return url ? { url, gruppo } : null;
  } catch {
    return null;
  }
}

async function load() {
  const params = new URLSearchParams(location.search);
  const formato = params.get("formato") || DEFAULT_FORMAT;
  const rank = params.get("rank") || "";
  const periodo = params.get("periodo") || "30";
  const modalita = params.get("modalita") || "";
  let variantId = params.get("variante") || "";

  document.querySelector("#back-to-meta").href = metaUrl();
  document.querySelector("#detail-change-filters").href = metaUrl();

  try {
    const identificativo = detailIdentifier(params);
    if (identificativo.errore) {
      renderError(identificativo.errore);
      traduciDocumento();
      return;
    }
    const filtri = { formato, rank, periodo, modalita };
    let data = await fetchArchetipo({ ...filtri, ...identificativo });
    if (identificativo.impronta) {
      const canonico = await gruppoCanonico(data, filtri);
      if (canonico) {
        history.replaceState(null, "", canonico.url);
        data = canonico.gruppo;
        variantId = new URL(canonico.url).searchParams.get("variante") || "";
      }
    }
    const selection = variantId ? selectedVariant(data, variantId) : null;
    if (variantId && !selection) {
      renderError("La variante selezionata non è presente nei dati del filtro corrente.");
      return;
    }

    // Anche un URL condiviso con ?variante= resta nella panoramica e apre
    // direttamente l'accordion corrispondente.
    renderDeck(data, filtri, null);

    // Liste per impronta e gruppi Brew non hanno liste del catalogo.
    const senzaCatalogo = data.tipo_dettaglio === "non_classificato" || data.tipo_dettaglio === "brew_group";
    renderVariants(data, selection);
    const haProfiloInline = (data.varianti || []).some((variant) => variant.decklist_pubblicabile === true);
    document.querySelector("#deck-profile-panel").hidden = haProfiloInline;
    document.querySelector("#reference-panel").hidden = senzaCatalogo;
    if (!senzaCatalogo) renderReferences(data);
    if (!haProfiloInline) renderRepresentativeProfile(data);
    traduciDocumento();
  } catch (error) {
    renderError(error.message || "Impossibile leggere i dati del meta.");
    traduciDocumento();
  }
}

load();
