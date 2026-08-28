import { DEFAULT_FORMAT, DOWNLOAD_URL, FORMATS, RANKS } from "./config.js?v=20260822-3";
import { fetchMeta, fetchScontri, fetchStatisticheDraft } from "./api.js";
import { availableStrategies, classificationAvailable, deckColors, filterMetaDecks, strategyLabel } from "./meta-model.js";
import { renderMeta, renderMetaError, renderMetaLoading, renderScontri, renderScontriError, renderScontriLoading } from "./render.js";
import { traduciDocumento } from "./translate.js";

const state = {
  apiFilters: { formato: DEFAULT_FORMAT, rank: "", periodo: "30", modalita: "" },
  localFilters: { search: "", colors: [], strategy: "" },
  meta: null,
  sort: { key: "partite", direction: "desc" },
  controllers: new Map(),
};
const LOCALE = document.documentElement.lang === "en" ? "en-US" : "it-IT";
const ASSET_BASE = document.documentElement.lang === "en" ? "../assets" : "./assets";

function controllerFor(key) {
  state.controllers.get(key)?.abort();
  const controller = new AbortController();
  state.controllers.set(key, controller);
  return controller;
}

function setupApiFilters() {
  const format = document.querySelector("#format-filter");
  const period = document.querySelector("#period-filter");
  const mode = document.querySelector("#mode-filter");
  for (const value of FORMATS) {
    const option = document.createElement("option");
    option.value = value; option.textContent = value; format.append(option);
  }
  format.value = DEFAULT_FORMAT;

  // Il rank e' un intervallo, non una voce di menu: la domanda vera e' «da
  // che rank a che rank», e con un menu si poteva chiedere una classe sola.
  const classi = RANKS.filter(Boolean);
  const minimo = document.querySelector("#rank-min");
  const massimo = document.querySelector("#rank-max");
  const etichetta = document.querySelector("#rank-label");
  const evidenza = document.querySelector("#rank-selected");
  minimo.max = String(classi.length - 1);
  massimo.max = String(classi.length - 1);
  massimo.value = String(classi.length - 1);

  // Le insegne sopra il binario: si accendono quelle dentro l'intervallo.
  const tacche = document.querySelector("#rank-ticks");
  for (const classe of classi) {
    const voce = document.createElement("li");
    const icona = document.createElement("img");
    icona.src = `${ASSET_BASE}/rank/${classe.toLowerCase()}.webp`;
    // Niente lazy: sono sei icone da tre chilobyte in cima alla pagina, e
    // rimandarle significa solo mostrare sei buchi al primo sguardo.
    icona.alt = ""; icona.width = 24; icona.height = 24; icona.decoding = "async";
    voce.append(icona); voce.title = classe; tacche.append(voce);
  }

  const scelti = () => {
    const da = Math.min(Number(minimo.value), Number(massimo.value));
    const a = Math.max(Number(minimo.value), Number(massimo.value));
    return classi.slice(da, a + 1);
  };

  const disegna = () => {
    const da = Math.min(Number(minimo.value), Number(massimo.value));
    const a = Math.max(Number(minimo.value), Number(massimo.value));
    const passo = 100 / (classi.length - 1);
    evidenza.style.left = `${da * passo}%`;
    evidenza.style.width = `${(a - da) * passo}%`;
    const elenco = scelti();
    etichetta.textContent = elenco.length === classi.length ? "Tutti i rank"
      : elenco.length === 1 ? `Solo ${elenco[0]}`
        : `Da ${elenco[0]} a ${elenco[elenco.length - 1]}`;
    for (const [indice, voce] of [...tacche.children].entries()) {
      voce.classList.toggle("attivo", indice >= da && indice <= a);
    }
  };

  const cambiato = () => {
    const elenco = scelti();
    // Tutte le classi equivale a nessun filtro: cosi' restano dentro anche le
    // partite che il rank non ce l'hanno.
    state.apiFilters = { ...state.apiFilters, formato: format.value,
      rank: elenco.length === classi.length ? "" : elenco.join(",") };
    disegna();
    loadAll();
  };
  format.addEventListener("change", cambiato);
  for (const select of [period, mode]) {
    select.addEventListener("change", () => {
      state.apiFilters = { ...state.apiFilters, periodo: period.value, modalita: mode.value };
      loadAll();
    });
  }
  for (const cursore of [minimo, massimo]) {
    cursore.addEventListener("input", disegna);
    cursore.addEventListener("change", cambiato);
  }
  disegna();
}

function renderCurrentMeta() {
  if (state.meta) {
    renderMeta(state.meta, state.sort, state.localFilters, state.apiFilters);
    traduciDocumento();
  }
}

function setupLocalFilters() {
  const search = document.querySelector("#archetype-search");
  const strategy = document.querySelector("#strategy-filter");
  const clear = document.querySelector("#clear-local-filters");

  search.addEventListener("input", () => {
    state.localFilters.search = search.value;
    renderCurrentMeta();
  });
  strategy.addEventListener("change", () => {
    state.localFilters.strategy = strategy.value;
    renderCurrentMeta();
  });

  document.querySelectorAll("[data-color]").forEach(button => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      const color = button.dataset.color;
      const selected = new Set(state.localFilters.colors);
      if (selected.has(color)) selected.delete(color); else selected.add(color);
      state.localFilters.colors = [...selected];
      button.setAttribute("aria-pressed", String(selected.has(color)));
      renderCurrentMeta();
    });
  });

  clear.addEventListener("click", () => {
    state.localFilters = { search: "", colors: [], strategy: "" };
    state.apiFilters = { formato: DEFAULT_FORMAT, rank: "", periodo: "30", modalita: "" };
    search.value = "";
    strategy.value = "";
    document.querySelector("#format-filter").value = DEFAULT_FORMAT;
    document.querySelector("#period-filter").value = "30";
    document.querySelector("#mode-filter").value = "";
    document.querySelector("#rank-min").value = "0";
    document.querySelector("#rank-max").value = "5";
    document.querySelector("#rank-min").dispatchEvent(new Event("input"));
    document.querySelectorAll("[data-color]").forEach(button => button.setAttribute("aria-pressed", "false"));
    loadAll();
  });
}

function syncClassificationControls(decks, catalogInfo = null) {
  const enabled = classificationAvailable(decks);
  const engineReady = catalogInfo?.disponibile === true;
  const strategies = availableStrategies(decks);
  const strategy = document.querySelector("#strategy-filter");
  const previous = state.localFilters.strategy;
  strategy.replaceChildren();
  const all = document.createElement("option"); all.value = ""; all.textContent = "Tutte le strategie"; strategy.append(all);
  for (const value of strategies) {
    const option = document.createElement("option"); option.value = value; option.textContent = strategyLabel(value); strategy.append(option);
  }
  strategy.disabled = !enabled || !strategies.length;
  if (strategies.includes(previous)) strategy.value = previous;
  else { strategy.value = ""; state.localFilters.strategy = ""; }

  const knownColors = new Set((Array.isArray(decks) ? decks : []).flatMap(deckColors));
  document.querySelectorAll("[data-color]").forEach(button => {
    button.disabled = !enabled || !knownColors.has(button.dataset.color);
    if (button.disabled) {
      button.setAttribute("aria-pressed", "false");
      state.localFilters.colors = state.localFilters.colors.filter(color => color !== button.dataset.color);
    }
  });

  const help = document.querySelector("#classification-help");
  help.textContent = enabled
    ? "Colori e Strategia filtrano gli archetipi riconosciuti dalla lista completa; i colori selezionati devono essere tutti presenti."
    : engineReady
      ? "Catalogo archetipi attivo: nel filtro corrente nessun gruppo supera ancora la soglia di riconoscimento."
      : "Colori e strategia si attiveranno dopo la generazione del catalogo archetipi server.";
  help.classList.toggle("ready", enabled);
}

function setupDownload() {
  document.querySelectorAll("[data-download]").forEach(link => {
    if (DOWNLOAD_URL) {
      link.href = DOWNLOAD_URL; link.removeAttribute("aria-disabled");
      link.title = "Scarica l'ultima beta MOX per Windows (ZIP)";
    } else {
      link.href = "#"; link.setAttribute("aria-disabled", "true");
      link.title = "Il link di download verrà collegato quando sarà disponibile";
      link.addEventListener("click", event => event.preventDefault());
    }
  });
}

async function loadMeta() {
  renderMetaLoading();
  const controller = controllerFor("meta");
  try {
    state.meta = await fetchMeta(state.apiFilters, { signal: controller.signal });
    document.querySelector("#home-games").textContent = new Intl.NumberFormat(LOCALE).format(state.meta.partite_totali || 0);
    aggiornaDataHome(state.meta.aggiornato);
    syncClassificationControls(state.meta.mazzi, state.meta.catalogo_archetipi);
    renderMeta(state.meta, state.sort, state.localFilters, state.apiFilters);
    traduciDocumento();
  } catch (error) {
    if (error.name !== "AbortError") { renderMetaError(error); traduciDocumento(); }
  }
}

function aggiornaDataHome(valore) {
  if (!valore) return;
  const elemento = document.querySelector("#home-updated");
  const nuova = new Date(valore);
  const corrente = elemento.dataset.iso ? new Date(elemento.dataset.iso) : null;
  if (!corrente || nuova > corrente) {
    elemento.dataset.iso = nuova.toISOString();
    elemento.textContent = nuova.toLocaleDateString(LOCALE, { day: "2-digit", month: "short", year: "numeric" });
  }
}

async function loadDraftSummary() {
  try {
    const dati = await fetchStatisticheDraft();
    document.querySelector("#home-drafts").textContent = new Intl.NumberFormat(LOCALE).format(dati.totali?.draft || 0);
    aggiornaDataHome(dati.totali?.aggiornato || dati.aggiornato);
  } catch {
    document.querySelector("#home-drafts").textContent = "In raccolta";
  }
}

async function loadScontri() {
  renderScontriLoading();
  const controller = controllerFor("scontri");
  try { renderScontri(await fetchScontri(state.apiFilters, { signal: controller.signal })); traduciDocumento(); }
  catch (error) { if (error.name !== "AbortError") { renderScontriError(error); traduciDocumento(); } }
}

function loadAll() { loadMeta(); loadScontri(); }

document.addEventListener("click", event => {
  const sort = event.target.closest("[data-sort]");
  if (sort && state.meta) {
    const key = sort.dataset.sort;
    if (state.sort.key === key) state.sort.direction = state.sort.direction === "asc" ? "desc" : "asc";
    else state.sort = { key, direction: key === "nome" ? "asc" : "desc" };
    renderCurrentMeta(); return;
  }
  const retry = event.target.closest("[data-retry]");
  if (retry) {
    if (retry.dataset.retry === "meta") loadMeta();
    if (retry.dataset.retry === "scontri") loadScontri();
  }
});

setupApiFilters();
setupLocalFilters();
setupDownload();
loadAll();
loadDraftSummary();
