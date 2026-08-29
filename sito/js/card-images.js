const SCRYFALL_API = "https://api.scryfall.com";
const CACHE_KEY = "mox-scryfall-card-cache-v7";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MISSING_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 750;
// Scryfall suggerisce di non martellare l'API. La vecchia coda, pero',
// aspettava ogni richiesta prima di iniziare la successiva: una pagina con
// molte carte poteva richiedere minuti. Avviamo poche richieste in parallelo,
// ma continuiamo a distanziarne l'inizio.
const REQUEST_GAP_MS = 95;
const REQUEST_CONCURRENCY = 4;

const memoryCache = new Map();
const pending = new Map();
let persistentLoaded = false;
const requestQueue = [];
let richiesteAttive = 0;
let lastRequestAt = 0;
let previewNode = null;
let previewImage = null;
let previewTitle = null;
let previewMeta = null;
let activePreviewAnchor = null;
let previewRequestId = 0;
const previewWarmCache = new Set();
const previewWarmQueue = [];
let previewWarmActive = 0;
const PREVIEW_WARM_CONCURRENCY = 2;

function cleanName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function linguaCarte() {
  return document.documentElement.lang === "it" ? "it" : "en";
}

function positiveArenaId(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function normalizeCardSpec(card = {}) {
  return {
    arenaId: positiveArenaId(card.arena_id ?? card.arenaId),
    name: cleanName(card.nome ?? card.name),
    setCode: cleanName(card.set ?? card.set_code ?? card.setCode).toLocaleLowerCase("en-US"),
    collectorNumber: cleanName(card.numero ?? card.collector_number ?? card.collectorNumber),
    copies: Number.isFinite(Number(card.copie ?? card.copies))
      ? Number(card.copie ?? card.copies)
      : null,
  };
}

export function cardLookupKey(card = {}) {
  const spec = normalizeCardSpec(card);
  const parti = [];
  if (spec.arenaId) parti.push(`arena:${spec.arenaId}`);
  if (spec.setCode && spec.collectorNumber) {
    parti.push(`print:${spec.setCode}/${spec.collectorNumber.toLocaleLowerCase("en-US")}`);
  }
  if (spec.name) parti.push(`name:${spec.name.toLocaleLowerCase("en-US")}`);
  return parti.join("|") || null;
}

export function cardLookupUrls(card = {}) {
  const spec = normalizeCardSpec(card);
  const urls = [];
  // Il nome inglese che arriva da Mox e' il percorso piu' affidabile e quasi
  // sempre risponde al primo colpo. Arena e set restano fallback per carte
  // nuove o non ancora indicizzate dalla ricerca nominale.
  if (spec.name) {
    const params = new URLSearchParams({ exact: spec.name });
    urls.push(`${SCRYFALL_API}/cards/named?${params}`);
  }
  if (spec.setCode && spec.collectorNumber) {
    urls.push(`${SCRYFALL_API}/cards/${encodeURIComponent(spec.setCode)}/${encodeURIComponent(spec.collectorNumber)}`);
  }
  if (spec.arenaId) urls.push(`${SCRYFALL_API}/cards/arena/${spec.arenaId}`);
  return urls;
}

export function cardLookupItalianUrls(card = {}) {
  const spec = normalizeCardSpec(card);
  const urls = [];
  // Set e numero sono la stampa esatta: Scryfall può restituire direttamente
  // quella italiana, evitando la più lenta ricerca testuale per ogni carta.
  if (spec.setCode && spec.collectorNumber) {
    urls.push(`${SCRYFALL_API}/cards/${encodeURIComponent(spec.setCode)}/${encodeURIComponent(spec.collectorNumber)}/it`);
  }
  if (spec.name) {
    const nome = spec.name.replace(/[\\"]/g, "\\$&");
    const query = new URLSearchParams({
      order: "released", unique: "prints", q: `!\"${nome}\" lang:it`,
    });
    urls.push(`${SCRYFALL_API}/cards/search?${query}`);
  }
  return urls;
}

export function parseReferenceLine(line) {
  const text = cleanName(line);
  const match = text.match(/^(\d+)\s*[x×]?\s+(.+)$/i);
  if (!match) return { copie: null, nome: text };
  return { copie: Number(match[1]), nome: cleanName(match[2]) };
}

export function extractCardMedia(card, fetchedAt = Date.now()) {
  if (!card || typeof card !== "object") return null;
  let face = null;
  let uris = card.image_uris || null;
  if (!uris && Array.isArray(card.card_faces)) {
    face = card.card_faces.find(item => item?.image_uris) || null;
    uris = face?.image_uris || null;
  }
  if (!uris) return null;

  const small = uris.small || uris.normal || uris.large || uris.png || null;
  const artCrop = uris.art_crop || small;
  const normal = uris.normal || uris.large || uris.png || small;
  if (!small || !normal) return null;

  return {
    missing: false,
    name: cleanName(card.printed_name || face?.printed_name || card.name || face?.name),
    oracleId: cleanName(card.oracle_id),
    arenaId: positiveArenaId(card.arena_id),
    artCrop,
    small,
    normal,
    artist: cleanName(card.artist || face?.artist) || null,
    manaValue: Number.isFinite(Number(card.cmc)) ? Number(card.cmc) : null,
    typeLine: cleanName(card.type_line || face?.type_line) || null,
    colors: Array.isArray(card.color_identity) ? card.color_identity : [],
    producedMana: Array.isArray(card.produced_mana) ? card.produced_mana : [],
    oracleText: cleanName(card.oracle_text || face?.oracle_text) || null,
    fetchedAt,
  };
}

function loadPersistentCache() {
  if (persistentLoaded) return;
  persistentLoaded = true;
  if (typeof localStorage === "undefined") return;
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    if (!raw || typeof raw !== "object") return;
    const now = Date.now();
    for (const [key, value] of Object.entries(raw)) {
      if (!value || typeof value !== "object") continue;
      const ttl = value.missing ? MISSING_TTL_MS : CACHE_TTL_MS;
      if (!Number.isFinite(value.fetchedAt) || now - value.fetchedAt > ttl) continue;
      memoryCache.set(key, value);
    }
  } catch {
    // Cache opzionale: un localStorage corrotto non deve rompere il sito.
  }
}

function savePersistentCache() {
  if (typeof localStorage === "undefined") return;
  try {
    const entries = [...memoryCache.entries()]
      .filter(([, value]) => value && typeof value === "object")
      .sort((a, b) => Number(b[1].fetchedAt || 0) - Number(a[1].fetchedAt || 0))
      .slice(0, MAX_CACHE_ENTRIES);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Quota o privacy mode: la cache in memoria continua a funzionare.
  }
}

function cached(key) {
  if (!key) return null;
  loadPersistentCache();
  const value = memoryCache.get(key);
  if (!value) return null;
  const ttl = value.missing ? MISSING_TTL_MS : CACHE_TTL_MS;
  if (Date.now() - Number(value.fetchedAt || 0) > ttl) {
    memoryCache.delete(key);
    return null;
  }
  return value;
}

function remember(keys, value) {
  for (const key of keys.filter(Boolean)) memoryCache.set(key, value);
  savePersistentCache();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function avviaRichiesteInCoda() {
  while (richiesteAttive < REQUEST_CONCURRENCY && requestQueue.length) {
    const prossima = requestQueue.shift();
    richiesteAttive += 1;
    const ora = Date.now();
    const inizio = Math.max(ora, lastRequestAt + REQUEST_GAP_MS);
    lastRequestAt = inizio;
    void (async () => {
      try {
        const attesa = Math.max(0, inizio - Date.now());
        if (attesa) await sleep(attesa);
        const response = await fetch(prossima.url, {
          headers: { accept: "application/json;q=0.9,*/*;q=0.8" },
        });
        if (response.status === 404) {
          prossima.resolve({ found: false, data: null });
        } else if (!response.ok) {
          const error = new Error(`Scryfall ${response.status}`);
          error.status = response.status;
          prossima.reject(error);
        } else {
          prossima.resolve({ found: true, data: await response.json() });
        }
      } catch (error) {
        prossima.reject(error);
      } finally {
        richiesteAttive -= 1;
        avviaRichiesteInCoda();
      }
    })();
  }
}

function queuedFetch(url) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ url, resolve, reject });
    avviaRichiesteInCoda();
  });
}

async function lookupNetwork(spec) {
  for (const url of cardLookupUrls(spec)) {
    const result = await queuedFetch(url);
    if (result.found) return result.data;
  }
  return null;
}

async function lookupItalian(spec) {
  for (const url of cardLookupItalianUrls(spec)) {
    const result = await queuedFetch(url);
    if (!result.found) continue;
    return result.data?.data?.[0] || result.data || null;
  }
  return null;
}

export async function resolveCard(card = {}) {
  const spec = normalizeCardSpec(card);
  const key = cardLookupKey(spec);
  if (!key) return null;
  if (linguaCarte() !== "it") return resolveBaseCard(spec);
  const primaryKey = `${key}|lang:it`;

  const hit = cached(primaryKey);
  if (hit) return hit.missing ? null : hit;

  if (pending.has(primaryKey)) return pending.get(primaryKey);

  const promise = (async () => {
    try {
      const italiana = await lookupItalian(spec);
      const media = extractCardMedia(italiana) || await resolveBaseCard(spec);
      if (!media) return null;
      remember([primaryKey], media);
      return media;
    } catch {
      // Errori di rete / 429 non diventano "carta assente":
      // al refresh successivo il sito puo' riprovare.
      return null;
    } finally {
      pending.delete(primaryKey);
    }
  })();

  pending.set(primaryKey, promise);
  return promise;
}

async function resolveBaseCard(card = {}) {
  const spec = normalizeCardSpec(card);
  const key = cardLookupKey(spec);
  if (!key) return null;
  const primaryKey = `${key}|lang:base`;
  const hit = cached(primaryKey);
  if (hit) return hit.missing ? null : hit;
  if (pending.has(primaryKey)) return pending.get(primaryKey);

  const promise = (async () => {
    try {
      const data = await lookupNetwork(spec);
      const media = extractCardMedia(data);
      if (!media) {
        const missing = { missing: true, fetchedAt: Date.now() };
        remember([primaryKey], missing);
        return null;
      }
      remember([primaryKey], media);
      return media;
    } catch {
      // Errori di rete / 429 non diventano "carta assente": al refresh il
      // sito puo' sempre riprovare.
      return null;
    } finally {
      pending.delete(primaryKey);
    }
  })();
  pending.set(primaryKey, promise);
  return promise;
}

function supportsHover() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function ensurePreview() {
  if (previewNode || typeof document === "undefined") return previewNode;

  previewNode = document.createElement("aside");
  previewNode.className = "card-hover-preview";
  previewNode.setAttribute("popover", "manual");
  previewNode.hidden = true;
  previewNode.setAttribute("aria-hidden", "true");

  previewImage = document.createElement("img");
  previewImage.alt = "";
  previewImage.decoding = "async";

  const copy = document.createElement("div");
  copy.className = "card-hover-copy";
  previewTitle = document.createElement("strong");
  previewMeta = document.createElement("span");
  copy.append(previewTitle, previewMeta);
  previewNode.append(previewImage, copy);
  document.body.append(previewNode);
  return previewNode;
}

function positionPreview(anchor) {
  if (!previewNode || !anchor || typeof window === "undefined") return;
  const rect = anchor.getBoundingClientRect();
  const width = 278;
  const gutter = 12;
  let left = rect.right + gutter;
  if (left + width > window.innerWidth - gutter) left = rect.left - width - gutter;
  left = Math.max(gutter, Math.min(left, window.innerWidth - width - gutter));
  const top = Math.max(gutter, Math.min(rect.top, window.innerHeight - 440));
  previewNode.style.left = `${Math.round(left)}px`;
  previewNode.style.top = `${Math.round(top)}px`;
}

// L'artwork della miniatura e' gia' nella cache del browser quando si passa il
// mouse sulla carta. Lo usiamo subito, poi sostituiamo l'immagine con la carta
// completa: il popup non resta vuoto mentre Scryfall consegna il file normal.
export function cardPreviewSources(media = {}) {
  // small e' una carta completa, ma molto piu' leggera di normal: e' la fonte
  // giusta per rendere istantaneo il primo fotogramma dell'hover.
  return [...new Set([media.small, media.artCrop, media.normal].filter(Boolean))];
}

function runPreviewWarmQueue() {
  while (previewWarmActive < PREVIEW_WARM_CONCURRENCY && previewWarmQueue.length > 0) {
    const source = previewWarmQueue.shift();
    previewWarmActive += 1;
    const image = new Image();
    const finished = () => {
      previewWarmActive -= 1;
      runPreviewWarmQueue();
    };
    image.onload = finished;
    image.onerror = finished;
    image.decoding = "async";
    image.src = source;
  }
}

function warmPreviewImage(media) {
  if (typeof Image === "undefined") return;
  const source = media?.small || media?.normal;
  if (!source || previewWarmCache.has(source)) return;
  previewWarmCache.add(source);
  previewWarmQueue.push(source);
  runPreviewWarmQueue();
}

function loadPreviewImage(media) {
  const sources = cardPreviewSources(media);
  if (!previewImage || sources.length === 0) return;

  const requestId = ++previewRequestId;
  const immediate = sources[0];
  const fullCard = media.normal || media.small || immediate;
  previewImage.loading = "eager";
  previewImage.fetchPriority = "high";
  previewImage.src = immediate;

  if (fullCard === immediate || typeof Image === "undefined") return;

  const preload = new Image();
  preload.decoding = "async";
  preload.onload = () => {
    if (requestId === previewRequestId && activePreviewAnchor) {
      previewImage.src = fullCard;
    }
  };
  preload.src = fullCard;
}

function showPreview(anchor, media, spec) {
  if (!supportsHover() || !media) return;
  ensurePreview();
  if (!previewNode) return;

  activePreviewAnchor = anchor;
  loadPreviewImage(media);
  previewImage.alt = media.name || spec.name || "Carta Magic";
  previewTitle.textContent = media.name || spec.name || "Carta Magic";

  const details = [];
  if (spec.copies !== null && spec.copies > 0) details.push(`${spec.copies}x`);
  if (media.artist) details.push(`Art: ${media.artist}`);
  details.push("Scryfall");
  previewMeta.textContent = details.join(" • ");

  previewNode.hidden = false;
  if (typeof previewNode.showPopover === "function") {
    try {
      if (!previewNode.matches(":popover-open")) previewNode.showPopover();
    } catch {
      // Browser senza Popover completo: resta il normale elemento fixed.
    }
  }
  positionPreview(anchor);
}

function hidePreview(anchor = null) {
  if (!previewNode) return;
  if (anchor && activePreviewAnchor && anchor !== activePreviewAnchor) return;
  if (typeof previewNode.hidePopover === "function") {
    try {
      if (previewNode.matches(":popover-open")) previewNode.hidePopover();
    } catch {
      // Il fallback fixed non richiede nessuna chiusura speciale.
    }
  }
  previewNode.hidden = true;
  activePreviewAnchor = null;
  previewRequestId += 1;
  if (previewImage) previewImage.removeAttribute("src");
}

function scheduleResolution(node, spec, image, placeholder) {
  let started = false;
  const start = async () => {
    if (started) return;
    started = true;
    const mostraMiniatura = (media) => {
      node._moxCardMedia = media;
      const thumbnail = media?.artCrop || media?.small;
      if (!thumbnail) {
        node.classList.add("is-missing");
        placeholder.textContent = "?";
        return;
      }
      image.onload = () => {
        node.classList.add("is-loaded");
        // Precarica la carta completa leggera solo per le miniature che l'utente
        // sta davvero guardando; due download alla volta non saturano la pagina.
        warmPreviewImage(media);
      };
      image.onerror = () => {
        node.classList.remove("is-loaded");
        node.classList.add("is-missing");
        placeholder.textContent = "?";
      };
      image.src = thumbnail;
      image.alt = media.name || spec.name || "Carta Magic";
      node.title = media.name || spec.name || "";
    };

    // Si chiede subito la lingua scelta. Se una stampa italiana non esiste,
    // il resolver usa l'inglese senza mai far vedere il passaggio intermedio.
    const media = await resolveCard(spec);
    mostraMiniatura(media);
  };

  if (typeof IntersectionObserver === "undefined") {
    start();
    return;
  }

  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    start();
  }, { rootMargin: "220px" });
  observer.observe(node);
}

export function createCardThumbnail(card = {}, { compact = false } = {}) {
  if (typeof document === "undefined") {
    throw new Error("createCardThumbnail richiede un browser");
  }

  const spec = normalizeCardSpec(card);
  const node = document.createElement("span");
  node.className = `card-thumb${compact ? " card-thumb-compact" : ""}`;
  node.dataset.cardKey = cardLookupKey(spec) || "";
  node.title = spec.name || (spec.arenaId ? `Carta Arena #${spec.arenaId}` : "Carta non identificata");

  const placeholder = document.createElement("span");
  placeholder.className = "card-thumb-placeholder";
  placeholder.textContent = "MOX";
  placeholder.setAttribute("aria-hidden", "true");

  const image = document.createElement("img");
  image.loading = "lazy";
  image.decoding = "async";
  image.alt = "";

  node.append(placeholder, image);
  scheduleResolution(node, spec, image, placeholder);

  if (supportsHover()) {
    node.addEventListener("mouseenter", () => {
      const mostra = (media) => {
        if (node.matches(":hover")) showPreview(node, media, spec);
      };
      if (node._moxCardMedia) mostra(node._moxCardMedia);
      else resolveBaseCard(spec).then(mostra);
    });
    node.addEventListener("mouseleave", () => hidePreview(node));
  }

  return node;
}

export function createCardListItem(card = {}) {
  if (typeof document === "undefined") {
    throw new Error("createCardListItem richiede un browser");
  }
  const spec = normalizeCardSpec(card);
  const row = document.createElement("li");
  row.className = "card-list-row";

  const thumb = createCardThumbnail(spec, { compact: true });
  const count = document.createElement("strong");
  count.className = "card-quantity";
  count.textContent = spec.copies !== null && spec.copies > 0 ? `${spec.copies}x` : "";

  const name = document.createElement("span");
  name.className = "card-name";
  name.textContent = spec.name || (spec.arenaId ? `Carta Arena #${spec.arenaId}` : "Carta non identificata");
  if (!spec.name) name.classList.add("unknown-card");

  resolveCard(spec).then((media) => {
    if (!media?.name) return;
    name.textContent = media.name;
    name.classList.remove("unknown-card");
  });

  row.append(thumb, count, name);
  return row;
}

export function createCoreStrip(cards = []) {
  if (typeof document === "undefined") {
    throw new Error("createCoreStrip richiede un browser");
  }
  const strip = document.createElement("span");
  strip.className = "core-cards";
  strip.setAttribute("aria-label", "Carte chiave dell'archetipo");

  const seen = new Set();
  for (const entry of Array.isArray(cards) ? cards : []) {
    const spec = typeof entry === "string" ? { nome: entry } : entry;
    const key = cardLookupKey(spec);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    strip.append(createCardThumbnail(spec));
    if (seen.size >= 8) break;
  }
  return strip;
}

if (typeof window !== "undefined") {
  window.addEventListener("scroll", () => hidePreview(), { passive: true });
  window.addEventListener("resize", () => {
    if (activePreviewAnchor) positionPreview(activePreviewAnchor);
  });
}
