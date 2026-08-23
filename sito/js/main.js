import { DEFAULT_FORMAT, DOWNLOAD_URL, FORMATS, RANKS } from "./config.js?v=20260822-3";
import { fetchMeta, fetchScontri } from "./api.js";
import { availableStrategies, classificationAvailable, deckColors, filterMetaDecks, strategyLabel } from "./meta-model.js";
import { renderMeta, renderMetaError, renderMetaLoading, renderScontri, renderScontriError, renderScontriLoading } from "./render.js";

const state = {
  apiFilters: { formato: DEFAULT_FORMAT, rank: "" },
  localFilters: { search: "", colors: [], strategy: "" },
  meta: null,
  sort: { key: "partite", direction: "desc" },
  controllers: new Map(),
};

function controllerFor(key) {
  state.controllers.get(key)?.abort();
  const controller = new AbortController();
  state.controllers.set(key, controller);
  return controller;
}

function setupApiFilters() {
  const format = document.querySelector("#format-filter");
  for (const value of FORMATS) {
    const option = document.createElement("option");
    option.value = value; option.textContent = value; format.append(option);
  }
  format.value = DEFAULT_FORMAT;

  const rank = document.querySelector("#rank-filter");
  for (const value of RANKS) {
    const option = document.createElement("option");
    option.value = value; option.textContent = value || "Tutti i rank"; rank.append(option);
  }

  const changed = () => {
    state.apiFilters = { formato: format.value, rank: rank.value };
    loadAll();
  };
  format.addEventListener("change", changed);
  rank.addEventListener("change", changed);
}

function renderCurrentMeta() {
  if (state.meta) renderMeta(state.meta, state.sort, state.localFilters, state.apiFilters);
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
    search.value = "";
    strategy.value = "";
    document.querySelectorAll("[data-color]").forEach(button => button.setAttribute("aria-pressed", "false"));
    renderCurrentMeta();
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

function setupTheme() {
  const root = document.documentElement;
  const button = document.querySelector("#theme-toggle");
  const saved = localStorage.getItem("mox-theme");
  if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  else root.dataset.theme = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  const sync = () => button.setAttribute("aria-label", `Tema ${root.dataset.theme}. Cambia tema`);
  sync();
  button.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("mox-theme", root.dataset.theme); sync();
  });
}

async function loadMeta() {
  renderMetaLoading();
  const controller = controllerFor("meta");
  try {
    state.meta = await fetchMeta(state.apiFilters, { signal: controller.signal });
    syncClassificationControls(state.meta.mazzi, state.meta.catalogo_archetipi);
    renderMeta(state.meta, state.sort, state.localFilters, state.apiFilters);
  } catch (error) {
    if (error.name !== "AbortError") renderMetaError(error);
  }
}

async function loadScontri() {
  renderScontriLoading();
  const controller = controllerFor("scontri");
  try { renderScontri(await fetchScontri(state.apiFilters, { signal: controller.signal })); }
  catch (error) { if (error.name !== "AbortError") renderScontriError(error); }
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

setupTheme();
setupApiFilters();
setupLocalFilters();
setupDownload();
loadAll();
