import { DEFAULT_FORMAT } from "./config.js";
import { fetchArchetipo } from "./api.js";
import { deckLabel, formatInteger, formatPercent, sampleSufficient, shortFingerprint } from "./format.js";
import { classificationSummary, deckArchetypeId, deckColors, deckIsClassified, deckMode, deckStrategy, observedDecklistCards, strategyLabel } from "./meta-model.js";
import { createCardListItem, parseReferenceLine } from "./card-images.js";
import { renderProfiloMazzo } from "./deck-profile.js";
import { traduciDocumento } from "./translate.js";

function tag(text, className = "") {
  const node = document.createElement("span"); node.className = className; node.textContent = text; return node;
}
function setText(selector, value) { document.querySelector(selector).textContent = value; }
function titleCase(value) {
  return String(value || "").replace(/(^|[\s'-])([a-zà-öø-ÿ])/g, (_, a, b) => a + b.toUpperCase());
}

function selectedVariant(data, variantId) {
  if (!variantId || !/^[0-9a-f]{12}$/i.test(variantId)) return null;
  const variants = Array.isArray(data?.varianti) ? data.varianti : [];
  const index = variants.findIndex(variant =>
    String(variant?.variante_id || "").toLowerCase() === variantId.toLowerCase()
  );
  return index >= 0 ? { variant: variants[index], index } : null;
}

function overviewUrl() {
  const url = new URL(location.href);
  url.searchParams.delete("variante");
  return url.href;
}

function variantViewUrl(variant) {
  const url = new URL(location.href);
  url.searchParams.set("variante", String(variant?.variante_id || ""));
  return url.href;
}

function variantMetaShare(variant) {
  if (!sampleSufficient(variant)) return null;
  const share = Number(variant?.quota_meta);
  return Number.isFinite(share) ? share : null;
}

function renderDeck(deck, params, selection) {
  const parentTitle = deckLabel(deck);
  const classified = deckIsClassified(deck);
  const variant = selection?.variant || null;
  const stats = variant || deck;
  const displayTitle = selection ? `Variante osservata #${selection.index + 1}` : parentTitle;
  document.body.classList.toggle("variant-mode", Boolean(selection));
  document.title = `${displayTitle} — ${parentTitle} — MOX Arena Assistant`;
  document.querySelector("#detail-heading h1").textContent = displayTitle;
  setText("#detail-eyebrow", selection ? "Vista variante" : "Dettaglio meta");

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
    tags.append(tag("Archetipo non ancora confermato", "detail-tag pending-tag"));
    const fingerprint = deck?.varianti?.[0]?.impronta;
    if (fingerprint) tags.append(tag(`ID tecnico ${shortFingerprint(fingerprint)}`, "detail-tag"));
  }
  if (selection) tags.append(tag(`ID ${String(variant.variante_id || "").slice(0, 8)}`, "detail-tag variant-tag"));

  if (!selection) {
    const sufficient = sampleSufficient(stats);
    setText("#detail-winrate", sufficient ? (formatPercent(stats.win_rate) || "—") : "Dati insufficienti");
    setText("#detail-winrate-note", sufficient ? "Campione sopra soglia" : "Pubblicato da 30 partite");
    setText("#detail-share", sufficient ? (formatPercent(deck.quota_meta) || "—") : "Dati insufficienti");
    setText("#detail-share-note", sufficient ? "Quota nel filtro corrente" : "Pubblicata da 30 partite");
    setText("#detail-games", formatInteger(stats.partite));
    setText("#detail-record", `${formatInteger(stats.vittorie)} V / ${formatInteger(stats.sconfitte)} S`);
    setText("#detail-rank", params.rank || "Tutti");
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
  const scarica = document.querySelector("#download-variant-deck");
  const testo = testoArena(cards, nome);
  preparaCopiaArena(copia, testo);
  scarica.hidden = !testo;
  scarica.onclick = testo ? () => {
    const url = URL.createObjectURL(new Blob([testo], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "mox-deck-arena.txt";
    link.click();
    URL.revokeObjectURL(url);
  } : null;
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
  const shortId = String(variant.variante_id || "").slice(0, 8) || "n.d.";

  setText("#variant-focus-title", `Variante osservata #${selection.index + 1}`);
  setText("#variant-focus-parent", parentTitle);
  setText("#variant-focus-id", `ID ${shortId}`);
  setText("#variant-focus-rank", params.rank || "Tutti i rank");

  const back = document.querySelector("#variant-focus-back");
  back.href = overviewUrl();
  back.querySelector("strong").textContent = "Torna all'archetipo";
  back.querySelector("span").textContent = parentTitle;

  setText("#variant-focus-winrate", sufficient ? (formatPercent(variant.win_rate) || "—") : "Dati insufficienti");
  setText("#variant-focus-record", `${formatInteger(variant.vittorie)} V / ${formatInteger(variant.sconfitte)} S`);
  setText("#variant-focus-games", formatInteger(variant.partite));
  setText("#variant-focus-share", sufficient ? (formatPercent(share) || "—") : "Dati insufficienti");
  setText("#variant-focus-threshold", sufficient ? "Campione sopra soglia" : "Percentuali da 30 partite");

  renderVariantDecklist(variant);
}

function renderObservedDecklistInline(article, variant) {
  const cards = observedDecklistCards(variant);
  if (variant.decklist_pubblicabile !== true) {
    article.append(protectedDecklistBlock());
    return;
  }
  const details = document.createElement("details"); details.className = "variant-details";
  const summary = document.createElement("summary"); summary.textContent = "Mostra decklist osservata";
  const list = document.createElement("ul"); list.className = "decklist-cards";
  for (const card of cards) list.append(cardLine(card));
  details.append(summary, list);
  article.append(details);
}

function renderVariants(data) {
  const host = document.querySelector("#variants-list");
  host.replaceChildren();
  const variants = Array.isArray(data.varianti) ? data.varianti : [];
  const totale = Number(data.varianti_osservate || variants.length);
  setText("#variants-count", `${totale} ${totale === 1 ? "variante osservata" : "varianti osservate"}`);
  if (!variants.length && !data.altre_varianti) {
    const empty = document.createElement("p"); empty.className = "variants-empty";
    empty.textContent = "Nessuna variante osservata nel filtro corrente.";
    host.append(empty);
    return;
  }

  const recognized = data.tipo_dettaglio !== "non_classificato";
  for (const [index, variant] of variants.entries()) {
    const article = document.createElement("article"); article.className = "variant-card variant-summary-card";
    const head = document.createElement("div"); head.className = "variant-head";
    const identity = document.createElement("div");
    const title = document.createElement("strong"); title.textContent = index === 0
      ? "Lista più rappresentativa" : `Variante osservata #${index + 1}`;
    const sub = document.createElement("small"); sub.textContent = `ID ${String(variant.variante_id || "").slice(0, 8) || "n.d."}`;
    identity.append(title, sub);

    const right = document.createElement("div"); right.className = "variant-head-right";
    const metrics = document.createElement("div"); metrics.className = "variant-metrics";
    const partiteLabel = Number(variant.partite) === 1 ? "partita" : "partite";
    const wrLabel = variant.dati_sufficienti ? (formatPercent(variant.win_rate) || "—") : "Dati insufficienti";
    const recordLabel = `${formatInteger(variant.vittorie)} V / ${formatInteger(variant.sconfitte)} S`;
    metrics.innerHTML = `<span><b>${formatInteger(variant.partite)}</b> ${partiteLabel}</span><span>${recordLabel}</span><span>${wrLabel}</span>`;

    const status = document.createElement("span");
    status.className = `variant-summary-status ${variant.decklist_pubblicabile === true ? "is-public" : "is-locked"}`;
    status.textContent = variant.decklist_pubblicabile === true ? "Decklist pubblicata" : "Decklist da 30 partite";

    if (recognized) {
      const open = document.createElement("a");
      open.className = "variant-open";
      open.href = variantViewUrl(variant);
      open.textContent = "Apri variante →";
      right.append(metrics, status, open);
    } else {
      right.append(metrics, status);
    }
    head.append(identity, right);
    article.append(head);

    // Un mazzo non classificato non ha una panoramica archetipo separata:
    // qui conserviamo la decklist inline quando la soglia la rende pubblica.
    if (!recognized) renderObservedDecklistInline(article, variant);
    host.append(article);
  }
  if (data.altre_varianti) {
    const altre = document.createElement("article");
    altre.className = "variant-card variant-summary-card other-variants";
    const quante = Number(data.altre_varianti.varianti || 0);
    const partite = Number(data.altre_varianti.partite || 0);
    altre.innerHTML = `<div class="variant-head"><div><strong>Altre varianti</strong><small>${quante} ${quante === 1 ? "lista sotto soglia" : "liste sotto soglia"}</small></div><div class="variant-metrics"><span><b>${formatInteger(partite)}</b> partite aggregate</span><span>Dati e decklist non pubblicati</span></div></div>`;
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

async function load() {
  const params = new URLSearchParams(location.search);
  const formato = params.get("formato") || DEFAULT_FORMAT;
  const rank = params.get("rank") || "";
  const periodo = params.get("periodo") || "30";
  const modalita = params.get("modalita") || "";
  const impronta = params.get("impronta");
  const id = params.get("id");
  const variantId = params.get("variante") || "";

  const back = new URL("./index.html", location.href); back.hash = "meta";
  document.querySelector("#back-to-meta").href = back.href;

  try {
    if (!id && !impronta) {
      renderError("Manca l'identificativo dell'archetipo o del mazzo.");
      return;
    }
    const filtri = { formato, rank, periodo, modalita };
    const data = await fetchArchetipo(id ? { ...filtri, id } : { ...filtri, impronta });
    const selection = variantId ? selectedVariant(data, variantId) : null;
    if (variantId && !selection) {
      renderError("La variante selezionata non è presente nei dati del filtro corrente.");
      return;
    }

    renderDeck(data, filtri, selection);
    renderVariantFocus(data, selection, filtri);

    const unclassified = data.tipo_dettaglio === "non_classificato";
    if (!selection) {
      renderVariants(data);
      document.querySelector("#reference-panel").hidden = unclassified;
      if (!unclassified) renderReferences(data);
      renderRepresentativeProfile(data);
    }
    traduciDocumento();
  } catch (error) {
    renderError(error.message || "Impossibile leggere i dati del meta.");
    traduciDocumento();
  }
}

load();
