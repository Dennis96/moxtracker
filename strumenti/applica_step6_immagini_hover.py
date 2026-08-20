#!/usr/bin/env python3
from __future__ import annotations

import subprocess
from pathlib import Path

EXPECTED_HEAD = "69440cdefea9349efc909657841b129ec397b290"
EXPECTED_BRANCH = "frontend-v1"

EXPECTED_HASHES = {
    "sito/js/archetype.js": "b64dc6ccb84f1b513efce244642adc0fd7d74c5c",
    "sito/js/render.js": "5bd26e38d5b53cb73a5a85f2daeff07efa19e05a",
    "sito/index.html": "88c971f7baee71443b7ea97c2da25e9ffb495daf",
    "sito/archetipo.html": "5649f4e906bb62d6ae30e5b88ef6f0b31ca21735",
    "sito/_headers": "5b0d32bec1e27839b24efde661cfe6b92d20a822",
    "src/archetipi.js": "6376ccb2fce3fe7a6dc128aaf30bfa5a544311f0",
    "prove/archetipi.test.js": "c48a58a66af14860e09c84e9541307a7bb9203aa",
}

NEW_FILES = {
    "sito/js/card-images.js": 'const SCRYFALL_API = "https://api.scryfall.com";\nconst CACHE_KEY = "mox-scryfall-card-cache-v1";\nconst CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;\nconst MISSING_TTL_MS = 24 * 60 * 60 * 1000;\nconst MAX_CACHE_ENTRIES = 500;\nconst REQUEST_GAP_MS = 140;\n\nconst memoryCache = new Map();\nconst pending = new Map();\nlet persistentLoaded = false;\nlet requestQueue = Promise.resolve();\nlet lastRequestAt = 0;\nlet previewNode = null;\nlet previewImage = null;\nlet previewTitle = null;\nlet previewMeta = null;\nlet activePreviewAnchor = null;\n\nfunction cleanName(value) {\n  return String(value || "").trim().replace(/\\s+/g, " ");\n}\n\nfunction positiveArenaId(value) {\n  const number = Number(value);\n  return Number.isInteger(number) && number > 0 ? number : null;\n}\n\nexport function normalizeCardSpec(card = {}) {\n  return {\n    arenaId: positiveArenaId(card.arena_id ?? card.arenaId),\n    name: cleanName(card.nome ?? card.name),\n    copies: Number.isFinite(Number(card.copie ?? card.copies))\n      ? Number(card.copie ?? card.copies)\n      : null,\n  };\n}\n\nexport function cardLookupKey(card = {}) {\n  const spec = normalizeCardSpec(card);\n  if (spec.arenaId) return `arena:${spec.arenaId}`;\n  if (spec.name) return `name:${spec.name.toLocaleLowerCase("en-US")}`;\n  return null;\n}\n\nexport function parseReferenceLine(line) {\n  const text = cleanName(line);\n  const match = text.match(/^(\\d+)\\s*[x×]?\\s+(.+)$/i);\n  if (!match) return { copie: null, nome: text };\n  return { copie: Number(match[1]), nome: cleanName(match[2]) };\n}\n\nexport function extractCardMedia(card, fetchedAt = Date.now()) {\n  if (!card || typeof card !== "object") return null;\n  let face = null;\n  let uris = card.image_uris || null;\n  if (!uris && Array.isArray(card.card_faces)) {\n    face = card.card_faces.find(item => item?.image_uris) || null;\n    uris = face?.image_uris || null;\n  }\n  if (!uris) return null;\n\n  const small = uris.small || uris.normal || uris.large || uris.png || null;\n  const normal = uris.normal || uris.large || uris.png || small;\n  if (!small || !normal) return null;\n\n  return {\n    missing: false,\n    name: cleanName(card.name || face?.name),\n    arenaId: positiveArenaId(card.arena_id),\n    small,\n    normal,\n    artist: cleanName(card.artist || face?.artist) || null,\n    fetchedAt,\n  };\n}\n\nfunction loadPersistentCache() {\n  if (persistentLoaded) return;\n  persistentLoaded = true;\n  if (typeof localStorage === "undefined") return;\n  try {\n    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");\n    if (!raw || typeof raw !== "object") return;\n    const now = Date.now();\n    for (const [key, value] of Object.entries(raw)) {\n      if (!value || typeof value !== "object") continue;\n      const ttl = value.missing ? MISSING_TTL_MS : CACHE_TTL_MS;\n      if (!Number.isFinite(value.fetchedAt) || now - value.fetchedAt > ttl) continue;\n      memoryCache.set(key, value);\n    }\n  } catch {\n    // Cache opzionale: un localStorage corrotto non deve rompere il sito.\n  }\n}\n\nfunction savePersistentCache() {\n  if (typeof localStorage === "undefined") return;\n  try {\n    const entries = [...memoryCache.entries()]\n      .filter(([, value]) => value && typeof value === "object")\n      .sort((a, b) => Number(b[1].fetchedAt || 0) - Number(a[1].fetchedAt || 0))\n      .slice(0, MAX_CACHE_ENTRIES);\n    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));\n  } catch {\n    // Quota o privacy mode: la cache in memoria continua a funzionare.\n  }\n}\n\nfunction cached(key) {\n  if (!key) return null;\n  loadPersistentCache();\n  const value = memoryCache.get(key);\n  if (!value) return null;\n  const ttl = value.missing ? MISSING_TTL_MS : CACHE_TTL_MS;\n  if (Date.now() - Number(value.fetchedAt || 0) > ttl) {\n    memoryCache.delete(key);\n    return null;\n  }\n  return value;\n}\n\nfunction remember(keys, value) {\n  for (const key of keys.filter(Boolean)) memoryCache.set(key, value);\n  savePersistentCache();\n}\n\nfunction sleep(ms) {\n  return new Promise(resolve => setTimeout(resolve, ms));\n}\n\nfunction queuedFetch(url) {\n  const run = async () => {\n    const wait = Math.max(0, REQUEST_GAP_MS - (Date.now() - lastRequestAt));\n    if (wait) await sleep(wait);\n    lastRequestAt = Date.now();\n\n    const response = await fetch(url, {\n      headers: { accept: "application/json;q=0.9,*/*;q=0.8" },\n    });\n    if (response.status === 404) return { found: false, data: null };\n    if (!response.ok) {\n      const error = new Error(`Scryfall ${response.status}`);\n      error.status = response.status;\n      throw error;\n    }\n    return { found: true, data: await response.json() };\n  };\n\n  const task = requestQueue.then(run, run);\n  requestQueue = task.catch(() => {});\n  return task;\n}\n\nasync function lookupNetwork(spec) {\n  if (spec.arenaId) {\n    const result = await queuedFetch(`${SCRYFALL_API}/cards/arena/${spec.arenaId}`);\n    if (result.found) return result.data;\n  }\n\n  if (spec.name) {\n    const params = new URLSearchParams({ exact: spec.name });\n    const result = await queuedFetch(`${SCRYFALL_API}/cards/named?${params}`);\n    if (result.found) return result.data;\n  }\n\n  return null;\n}\n\nexport async function resolveCard(card = {}) {\n  const spec = normalizeCardSpec(card);\n  const primaryKey = cardLookupKey(spec);\n  if (!primaryKey) return null;\n\n  const hit = cached(primaryKey);\n  if (hit) return hit.missing ? null : hit;\n\n  if (pending.has(primaryKey)) return pending.get(primaryKey);\n\n  const promise = (async () => {\n    try {\n      const data = await lookupNetwork(spec);\n      if (!data) {\n        const missing = { missing: true, fetchedAt: Date.now() };\n        remember([primaryKey], missing);\n        return null;\n      }\n\n      const media = extractCardMedia(data);\n      if (!media) {\n        const missing = { missing: true, fetchedAt: Date.now() };\n        remember([primaryKey], missing);\n        return null;\n      }\n\n      const keys = [\n        primaryKey,\n        media.arenaId ? `arena:${media.arenaId}` : null,\n        media.name ? `name:${media.name.toLocaleLowerCase("en-US")}` : null,\n      ];\n      remember(keys, media);\n      return media;\n    } catch {\n      // Errori di rete / 429 non diventano "carta assente":\n      // al refresh successivo il sito puo\' riprovare.\n      return null;\n    } finally {\n      pending.delete(primaryKey);\n    }\n  })();\n\n  pending.set(primaryKey, promise);\n  return promise;\n}\n\nfunction supportsHover() {\n  return typeof window !== "undefined" &&\n    typeof window.matchMedia === "function" &&\n    window.matchMedia("(hover: hover) and (pointer: fine)").matches;\n}\n\nfunction ensurePreview() {\n  if (previewNode || typeof document === "undefined") return previewNode;\n\n  previewNode = document.createElement("aside");\n  previewNode.className = "card-hover-preview";\n  previewNode.hidden = true;\n  previewNode.setAttribute("aria-hidden", "true");\n\n  previewImage = document.createElement("img");\n  previewImage.alt = "";\n  previewImage.decoding = "async";\n\n  const copy = document.createElement("div");\n  copy.className = "card-hover-copy";\n  previewTitle = document.createElement("strong");\n  previewMeta = document.createElement("span");\n  copy.append(previewTitle, previewMeta);\n  previewNode.append(previewImage, copy);\n  document.body.append(previewNode);\n  return previewNode;\n}\n\nfunction positionPreview(anchor) {\n  if (!previewNode || !anchor || typeof window === "undefined") return;\n  const rect = anchor.getBoundingClientRect();\n  const width = 278;\n  const gutter = 12;\n  let left = rect.right + gutter;\n  if (left + width > window.innerWidth - gutter) left = rect.left - width - gutter;\n  left = Math.max(gutter, Math.min(left, window.innerWidth - width - gutter));\n  const top = Math.max(gutter, Math.min(rect.top, window.innerHeight - 440));\n  previewNode.style.left = `${Math.round(left)}px`;\n  previewNode.style.top = `${Math.round(top)}px`;\n}\n\nfunction showPreview(anchor, media, spec) {\n  if (!supportsHover() || !media?.normal) return;\n  ensurePreview();\n  if (!previewNode) return;\n\n  activePreviewAnchor = anchor;\n  previewImage.src = media.normal;\n  previewImage.alt = media.name || spec.name || "Carta Magic";\n  previewTitle.textContent = media.name || spec.name || "Carta Magic";\n\n  const details = [];\n  if (spec.copies !== null && spec.copies > 0) details.push(`${spec.copies}x`);\n  if (media.artist) details.push(`Art: ${media.artist}`);\n  details.push("Scryfall");\n  previewMeta.textContent = details.join(" • ");\n\n  previewNode.hidden = false;\n  positionPreview(anchor);\n}\n\nfunction hidePreview(anchor = null) {\n  if (!previewNode) return;\n  if (anchor && activePreviewAnchor && anchor !== activePreviewAnchor) return;\n  previewNode.hidden = true;\n  activePreviewAnchor = null;\n  if (previewImage) previewImage.removeAttribute("src");\n}\n\nfunction scheduleResolution(node, spec, image, placeholder) {\n  let started = false;\n  const start = async () => {\n    if (started) return;\n    started = true;\n    const media = await resolveCard(spec);\n    node._moxCardMedia = media;\n    if (!media?.small) {\n      node.classList.add("is-missing");\n      placeholder.textContent = "?";\n      return;\n    }\n\n    image.addEventListener("load", () => node.classList.add("is-loaded"), { once: true });\n    image.addEventListener("error", () => {\n      node.classList.remove("is-loaded");\n      node.classList.add("is-missing");\n      placeholder.textContent = "?";\n    }, { once: true });\n    image.src = media.small;\n    image.alt = media.name || spec.name || "Carta Magic";\n    node.title = media.name || spec.name || "";\n  };\n\n  if (typeof IntersectionObserver === "undefined") {\n    start();\n    return;\n  }\n\n  const observer = new IntersectionObserver(entries => {\n    if (!entries.some(entry => entry.isIntersecting)) return;\n    observer.disconnect();\n    start();\n  }, { rootMargin: "220px" });\n  observer.observe(node);\n}\n\nexport function createCardThumbnail(card = {}, { compact = false } = {}) {\n  if (typeof document === "undefined") {\n    throw new Error("createCardThumbnail richiede un browser");\n  }\n\n  const spec = normalizeCardSpec(card);\n  const node = document.createElement("span");\n  node.className = `card-thumb${compact ? " card-thumb-compact" : ""}`;\n  node.dataset.cardKey = cardLookupKey(spec) || "";\n  node.title = spec.name || (spec.arenaId ? `Carta Arena #${spec.arenaId}` : "Carta non identificata");\n\n  const placeholder = document.createElement("span");\n  placeholder.className = "card-thumb-placeholder";\n  placeholder.textContent = "MOX";\n  placeholder.setAttribute("aria-hidden", "true");\n\n  const image = document.createElement("img");\n  image.loading = "lazy";\n  image.decoding = "async";\n  image.alt = "";\n\n  node.append(placeholder, image);\n  scheduleResolution(node, spec, image, placeholder);\n\n  if (supportsHover()) {\n    node.addEventListener("mouseenter", () => {\n      if (node._moxCardMedia) showPreview(node, node._moxCardMedia, spec);\n    });\n    node.addEventListener("mouseleave", () => hidePreview(node));\n  }\n\n  return node;\n}\n\nexport function createCardListItem(card = {}) {\n  if (typeof document === "undefined") {\n    throw new Error("createCardListItem richiede un browser");\n  }\n  const spec = normalizeCardSpec(card);\n  const row = document.createElement("li");\n  row.className = "card-list-row";\n\n  const thumb = createCardThumbnail(spec, { compact: true });\n  const count = document.createElement("strong");\n  count.className = "card-quantity";\n  count.textContent = spec.copies !== null && spec.copies > 0 ? `${spec.copies}x` : "";\n\n  const name = document.createElement("span");\n  name.className = "card-name";\n  name.textContent = spec.name || (spec.arenaId ? `Carta Arena #${spec.arenaId}` : "Carta non identificata");\n  if (!spec.name) name.classList.add("unknown-card");\n\n  row.append(thumb, count, name);\n  return row;\n}\n\nexport function createCoreStrip(cards = []) {\n  if (typeof document === "undefined") {\n    throw new Error("createCoreStrip richiede un browser");\n  }\n  const strip = document.createElement("span");\n  strip.className = "core-cards";\n  strip.setAttribute("aria-label", "Carte chiave dell\'archetipo");\n\n  const seen = new Set();\n  for (const entry of Array.isArray(cards) ? cards : []) {\n    const spec = typeof entry === "string" ? { nome: entry } : entry;\n    const key = cardLookupKey(spec);\n    if (!key || seen.has(key)) continue;\n    seen.add(key);\n    strip.append(createCardThumbnail(spec));\n    if (seen.size >= 8) break;\n  }\n  return strip;\n}\n\nif (typeof window !== "undefined") {\n  window.addEventListener("scroll", () => hidePreview(), { passive: true });\n  window.addEventListener("resize", () => {\n    if (activePreviewAnchor) positionPreview(activePreviewAnchor);\n  });\n}\n',
    "sito/css/card-images.css": '.core-cards {\n  display: flex;\n  flex-wrap: nowrap;\n  align-items: center;\n  gap: 5px;\n  min-height: 50px;\n  margin-top: 5px;\n  overflow: hidden;\n}\n.card-thumb {\n  position: relative;\n  flex: 0 0 auto;\n  width: 36px;\n  aspect-ratio: 488 / 680;\n  overflow: hidden;\n  border: 1px solid var(--line-strong);\n  border-radius: 5px;\n  background:\n    radial-gradient(circle at 50% 30%, rgba(156, 67, 255, .20), transparent 55%),\n    var(--surface-3);\n  box-shadow: inset 0 1px rgba(255,255,255,.06);\n  cursor: default;\n}\n.card-thumb-compact { width: 34px; }\n.card-thumb img {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  opacity: 0;\n  transition: opacity .16s ease;\n}\n.card-thumb.is-loaded img { opacity: 1; }\n.card-thumb.is-loaded .card-thumb-placeholder { opacity: 0; }\n.card-thumb-placeholder {\n  position: absolute;\n  inset: 0;\n  display: grid;\n  place-items: center;\n  color: #b96dff;\n  font-size: .47rem;\n  font-weight: 950;\n  letter-spacing: .04em;\n  transition: opacity .16s ease;\n}\n.card-thumb.is-missing .card-thumb-placeholder {\n  color: var(--muted);\n  font-size: .72rem;\n}\n@media (hover: hover) and (pointer: fine) {\n  .card-thumb:hover {\n    border-color: #b95cff;\n    box-shadow: 0 0 0 1px rgba(185,92,255,.32), 0 0 16px rgba(150,54,255,.24);\n  }\n}\n.card-list-row {\n  display: grid !important;\n  grid-template-columns: 34px 38px minmax(0, 1fr);\n  align-items: center;\n  gap: 8px !important;\n  min-width: 0;\n  min-height: 52px;\n  padding: 5px 8px !important;\n  border-radius: 8px;\n  background: rgba(124,44,255,.035);\n  break-inside: avoid;\n}\n.card-quantity {\n  color: #c879ff;\n  font-variant-numeric: tabular-nums;\n  white-space: nowrap;\n}\n.card-name {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.reference-decklist {\n  columns: auto;\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 7px 14px;\n  padding: 2px 16px 16px;\n  color: var(--text);\n  font-size: .82rem;\n}\n.reference-decklist li { margin: 0; }\n.card-hover-preview {\n  position: fixed;\n  z-index: 1000;\n  width: 278px;\n  max-height: calc(100vh - 24px);\n  overflow: hidden;\n  pointer-events: none;\n  border: 1px solid rgba(190,94,255,.58);\n  border-radius: 12px;\n  background: color-mix(in srgb, var(--surface) 94%, #160923 6%);\n  box-shadow:\n    0 18px 52px rgba(0,0,0,.55),\n    0 0 30px rgba(137,48,255,.23),\n    inset 0 1px rgba(255,255,255,.06);\n}\n.card-hover-preview[hidden] { display: none; }\n.card-hover-preview > img {\n  display: block;\n  width: 100%;\n  height: auto;\n  max-height: calc(100vh - 94px);\n  object-fit: contain;\n  background: #05050a;\n}\n.card-hover-copy {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  padding: 10px 12px 11px;\n}\n.card-hover-copy strong {\n  color: var(--text);\n  font-size: .86rem;\n  line-height: 1.25;\n}\n.card-hover-copy span {\n  color: var(--muted);\n  font-size: .68rem;\n  line-height: 1.35;\n}\n@media (max-width: 980px) {\n  .reference-decklist { grid-template-columns: 1fr; }\n}\n@media (max-width: 720px) {\n  .core-cards { min-height: 46px; gap: 4px; }\n  .core-cards .card-thumb { width: 32px; }\n  .core-cards .card-thumb:nth-child(n+6) { display: none; }\n  .card-list-row {\n    grid-template-columns: 32px 34px minmax(0, 1fr);\n    min-height: 48px;\n  }\n  .card-thumb-compact { width: 32px; }\n  .card-hover-preview { display: none; }\n}\n',
    "prove/card-images.test.js": 'import { strict as assert } from "node:assert";\nimport { test } from "node:test";\nimport {\n  cardLookupKey,\n  extractCardMedia,\n  normalizeCardSpec,\n  parseReferenceLine,\n} from "../sito/js/card-images.js";\n\ntest("parser lista riferimento gestisce copie con e senza x", () => {\n  assert.deepEqual(parseReferenceLine("4 Optimistic Scavenger"), {\n    copie: 4, nome: "Optimistic Scavenger",\n  });\n  assert.deepEqual(parseReferenceLine("2x Ethereal Armor"), {\n    copie: 2, nome: "Ethereal Armor",\n  });\n  assert.deepEqual(parseReferenceLine("1× Plains"), {\n    copie: 1, nome: "Plains",\n  });\n});\n\ntest("lookup immagini preferisce Arena ID e usa il nome come fallback", () => {\n  assert.equal(cardLookupKey({ arena_id: 1234, nome: "Carta" }), "arena:1234");\n  assert.equal(cardLookupKey({ nome: "  Ethereal   Armor " }), "name:ethereal armor");\n  assert.equal(cardLookupKey({}), null);\n});\n\ntest("normalizzazione mantiene copie e scarta Arena ID non validi", () => {\n  assert.deepEqual(normalizeCardSpec({\n    arena_id: "42", nome: "  Skyward Spider ", copie: "4",\n  }), {\n    arenaId: 42, name: "Skyward Spider", copies: 4,\n  });\n  assert.equal(normalizeCardSpec({ arena_id: 0 }).arenaId, null);\n});\n\ntest("media Scryfall usa small per thumbnail e normal per hover", () => {\n  const media = extractCardMedia({\n    name: "Ethereal Armor",\n    arena_id: 987,\n    artist: "Artist",\n    image_uris: {\n      small: "https://cards.scryfall.io/small/a.jpg",\n      normal: "https://cards.scryfall.io/normal/a.jpg",\n    },\n  }, 123);\n  assert.deepEqual(media, {\n    missing: false,\n    name: "Ethereal Armor",\n    arenaId: 987,\n    small: "https://cards.scryfall.io/small/a.jpg",\n    normal: "https://cards.scryfall.io/normal/a.jpg",\n    artist: "Artist",\n    fetchedAt: 123,\n  });\n});\n\ntest("media Scryfall supporta carte bifronte senza image_uris principale", () => {\n  const media = extractCardMedia({\n    name: "Front // Back",\n    card_faces: [{\n      name: "Front",\n      artist: "Face Artist",\n      image_uris: {\n        small: "https://cards.scryfall.io/small/front.jpg",\n        normal: "https://cards.scryfall.io/normal/front.jpg",\n      },\n    }],\n  }, 456);\n  assert.equal(media?.small, "https://cards.scryfall.io/small/front.jpg");\n  assert.equal(media?.normal, "https://cards.scryfall.io/normal/front.jpg");\n  assert.equal(media?.artist, "Face Artist");\n});\n',
    "STEP6-IMMAGINI-CARTE-HOVER.md": "# STEP 6 — Immagini reali carte + hover preview\n\nData: 2026-08-19\n\n## Baseline\n\nBranch: `frontend-v1`\n\nCommit di partenza:\n\n`69440cdefea9349efc909657841b129ec397b290`\n\n`Completa pulizia frontend step 5.3.2`\n\n## Obiettivo\n\nAggiungere al frontend pubblico:\n\n- 6–8 miniature delle carte core nel Meta Explorer;\n- miniature + quantità + nome nella Lista di riferimento;\n- miniature + quantità + nome nelle Varianti osservate;\n- preview grande al passaggio del mouse su desktop;\n- comportamento non invasivo su touch/mobile;\n- fallback se Scryfall non restituisce una carta.\n\n## Fonte immagini\n\nScryfall, coerente con MOX desktop.\n\nStrategia:\n\n- lookup primario tramite Arena ID quando disponibile;\n- fallback tramite nome esatto;\n- `small` per le miniature;\n- `normal` per la preview;\n- cache memoria + localStorage;\n- richieste serializzate con intervallo minimo di 140 ms;\n- nessuna richiesta API aggiuntiva generata dall'hover;\n- immagini risolte solo quando vicine al viewport;\n- 404 memorizzati temporaneamente, errori di rete/429 no.\n\n## Archetype Engine\n\nLe regole NON vengono cambiate.\n\nLa sola estensione server-side è l'esposizione in `/meta` del campo:\n\n`carte_core`\n\nIl valore proviene dal `core` già generato e già usato dal classificatore.\nNon viene ricalcolato nel frontend e non modifica:\n\n- soglia variante 0.90;\n- core threshold 0.60;\n- minimo 5 carte core;\n- margine core 0.20.\n\n## File\n\nNuovi:\n\n- `sito/js/card-images.js`\n- `sito/css/card-images.css`\n- `prove/card-images.test.js`\n- `STEP6-IMMAGINI-CARTE-HOVER.md`\n\nModificati:\n\n- `src/archetipi.js`\n- `prove/archetipi.test.js`\n- `sito/js/render.js`\n- `sito/js/archetype.js`\n- `sito/index.html`\n- `sito/archetipo.html`\n- `sito/_headers`\n\n## Verifica\n\nDa root repository:\n\n```bat\nnpm run prove\ngit status --short\ngit diff --stat\n```\n\nFrontend locale:\n\n```bat\ncd sito\npython -m http.server 8790\n```\n\nAprire:\n\n`http://127.0.0.1:8790`\n\nPoi `Ctrl + F5`.\n\nControllare:\n\n1. Meta Explorer: massimo 8 core desktop, 5 mobile.\n2. Hover desktop: preview grande; chiusura all'uscita del mouse.\n3. Lista di riferimento: thumbnail + quantità + nome.\n4. Variante osservata: thumbnail + quantità + nome.\n5. Carta non trovata: placeholder, nessun layout rotto.\n6. Nessuna regressione filtri/routing/soglie statistiche.\n\nNon fare deploy o merge in `master` prima della revisione del diff e dei test.\n",
}


def run(root: Path, *args: str) -> str:
    done = subprocess.run(
        list(args), cwd=root, text=True, capture_output=True,
        encoding="utf-8", errors="replace",
    )
    if done.returncode != 0:
        detail = (done.stderr or done.stdout).strip()
        raise SystemExit(f"Comando fallito: {' '.join(args)}\n{detail}")
    return done.stdout.strip()


def find_root() -> Path:
    candidates = [
        Path.cwd(),
        Path(__file__).resolve().parent,
        Path(__file__).resolve().parent.parent,
    ]
    for candidate in candidates:
        if (candidate / ".git").exists() and (candidate / "package.json").is_file():
            return candidate.resolve()
    raise SystemExit(
        "Repository moxtracker non trovato. Apri il prompt nella root del repository "
        "e rilancia questo script."
    )


def read(root: Path, relative: str) -> str:
    path = root / relative
    if not path.is_file():
        raise SystemExit(f"File atteso non trovato: {relative}")
    return path.read_text(encoding="utf-8")


def replace_once(text: str, old: str, new: str, relative: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"Patch annullata: in {relative} il blocco atteso compare {count} volte "
            "(atteso: 1). Nessun file e' stato scritto."
        )
    return text.replace(old, new, 1)


def main() -> None:
    root = find_root()

    branch = run(root, "git", "branch", "--show-current")
    head = run(root, "git", "rev-parse", "HEAD")
    if branch != EXPECTED_BRANCH:
        raise SystemExit(
            f"Patch annullata: branch corrente {branch!r}, atteso {EXPECTED_BRANCH!r}."
        )
    if head != EXPECTED_HEAD:
        raise SystemExit(
            "Patch annullata: HEAD diverso dalla baseline verificata.\n"
            f"Attuale: {head}\nAtteso:  {EXPECTED_HEAD}"
        )

    for relative, expected in EXPECTED_HASHES.items():
        committed = run(root, "git", "rev-parse", f"HEAD:{relative}")
        if committed != expected:
            raise SystemExit(
                "Patch annullata: il file nel commit non corrisponde alla baseline.\n"
                f"File: {relative}\nBlob attuale: {committed}\nBlob atteso:  {expected}"
            )
        diff = subprocess.run(
            ["git", "diff", "--quiet", "HEAD", "--", relative], cwd=root
        )
        if diff.returncode != 0:
            raise SystemExit(
                "Patch annullata per proteggere modifiche locali non committate.\n"
                f"File modificato: {relative}"
            )

    for relative in NEW_FILES:
        if (root / relative).exists():
            raise SystemExit(
                f"Patch annullata: il nuovo file esiste gia': {relative}"
            )

    changed = {relative: read(root, relative) for relative in EXPECTED_HASHES}

    changed["sito/index.html"] = replace_once(
        changed["sito/index.html"],
        '  <link rel="stylesheet" href="./css/site.css">\n  <script type="module" src="./js/main.js"></script>',
        '  <link rel="stylesheet" href="./css/site.css">\n  <link rel="stylesheet" href="./css/card-images.css">\n  <script type="module" src="./js/main.js"></script>',
        "sito/index.html",
    )

    changed["sito/archetipo.html"] = replace_once(
        changed["sito/archetipo.html"],
        '  <link rel="stylesheet" href="./css/site.css">\n  <link rel="stylesheet" href="./css/step53.css">\n  <script type="module" src="./js/archetype.js"></script>',
        '  <link rel="stylesheet" href="./css/site.css">\n  <link rel="stylesheet" href="./css/step53.css">\n  <link rel="stylesheet" href="./css/card-images.css">\n  <script type="module" src="./js/archetype.js"></script>',
        "sito/archetipo.html",
    )

    changed["sito/_headers"] = replace_once(
        changed["sito/_headers"],
        "Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src https://api.moxtracker.app; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
        "Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://*.scryfall.io; connect-src https://api.moxtracker.app https://api.scryfall.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
        "sito/_headers",
    )

    changed["sito/js/render.js"] = replace_once(
        changed["sito/js/render.js"],
        'import { classificationSummary, deckArchetypeId, deckColors, deckDetailUrl, deckIsClassified, deckMode, deckStrategy, filterMetaDecks, strategyLabel } from "./meta-model.js";',
        'import { classificationSummary, deckArchetypeId, deckColors, deckDetailUrl, deckIsClassified, deckMode, deckStrategy, filterMetaDecks, strategyLabel } from "./meta-model.js";\nimport { createCoreStrip } from "./card-images.js";',
        "sito/js/render.js",
    )
    changed["sito/js/render.js"] = replace_once(
        changed["sito/js/render.js"],
        '  if (meta.childNodes.length) text.append(meta);\n  wrap.append(mark, text, el("span", "row-chevron", "›"));',
        '  if (meta.childNodes.length) text.append(meta);\n  const core = createCoreStrip(deck.carte_core || []);\n  if (core.childNodes.length) text.append(core);\n  wrap.append(mark, text, el("span", "row-chevron", "›"));',
        "sito/js/render.js",
    )
    changed["sito/js/render.js"] = replace_once(
        changed["sito/js/render.js"],
        '    head.append(title, el("span", "", `${formatInteger(deck.partite)} pt. ›`)); card.append(head);\n    const grid = el("div", "mobile-deck-grid");',
        '    head.append(title, el("span", "", `${formatInteger(deck.partite)} pt. ›`)); card.append(head);\n    const core = createCoreStrip(deck.carte_core || []);\n    if (core.childNodes.length) card.append(core);\n    const grid = el("div", "mobile-deck-grid");',
        "sito/js/render.js",
    )

    changed["sito/js/archetype.js"] = replace_once(
        changed["sito/js/archetype.js"],
        'import { classificationSummary, deckArchetypeId, deckColors, deckMode, deckStrategy, strategyLabel } from "./meta-model.js";',
        'import { classificationSummary, deckArchetypeId, deckColors, deckMode, deckStrategy, strategyLabel } from "./meta-model.js";\nimport { createCardListItem, parseReferenceLine } from "./card-images.js";',
        "sito/js/archetype.js",
    )

    old_card_line = '''function cardLine(card) {
  const row = document.createElement("li");
  const count = document.createElement("strong");
  count.textContent = `${formatInteger(card.copie)}×`;
  const name = document.createElement("span");
  name.textContent = card.nome ? titleCase(card.nome) : `Carta Arena #${card.arena_id}`;
  if (!card.nome) name.classList.add("unknown-card");
  row.append(count, name);
  return row;
}'''
    new_card_line = '''function cardLine(card) {
  return createCardListItem({
    arena_id: card.arena_id,
    copie: card.copie,
    nome: card.nome ? titleCase(card.nome) : "",
  });
}'''
    changed["sito/js/archetype.js"] = replace_once(
        changed["sito/js/archetype.js"], old_card_line, new_card_line,
        "sito/js/archetype.js",
    )
    changed["sito/js/archetype.js"] = replace_once(
        changed["sito/js/archetype.js"],
        '    for (const line of ref.lista || []) { const li = document.createElement("li"); li.textContent = line; list.append(li); }',
        '    for (const line of ref.lista || []) list.append(createCardListItem(parseReferenceLine(line)));',
        "sito/js/archetype.js",
    )
    changed["sito/js/archetype.js"] = replace_once(
        changed["sito/js/archetype.js"],
        '      for (const line of ref.sideboard) { const li = document.createElement("li"); li.textContent = line; side.append(li); }',
        '      for (const line of ref.sideboard) side.append(createCardListItem(parseReferenceLine(line)));',
        "sito/js/archetype.js",
    )

    old_percent = '''function percentuale(parte, totale) {
  if (!totale) return null;
  return Math.round((parte * 10000) / totale) / 100;
}

export function aggregaMeta'''
    new_percent = '''function percentuale(parte, totale) {
  if (!totale) return null;
  return Math.round((parte * 10000) / totale) / 100;
}

function carteCoreArchetipo(archetipoId, catalogo) {
  if (!archetipoId) return [];
  const lista = (catalogo?.liste || []).find(item =>
    item?.archetipo_id === archetipoId &&
    Array.isArray(item.core) &&
    item.core.length
  );
  return lista ? [...lista.core] : [];
}

export function aggregaMeta'''
    changed["src/archetipi.js"] = replace_once(
        changed["src/archetipi.js"], old_percent, new_percent, "src/archetipi.js"
    )
    changed["src/archetipi.js"] = replace_once(
        changed["src/archetipi.js"],
        '        colori: c ? c.colori : [],\n        modalita: null,',
        '        colori: c ? c.colori : [],\n        carte_core: c ? carteCoreArchetipo(c.archetipo_id, catalogo) : [],\n        modalita: null,',
        "src/archetipi.js",
    )
    changed["src/archetipi.js"] = replace_once(
        changed["src/archetipi.js"],
        '      colori: gruppo.colori,\n      modalita: gruppo.modalita,',
        '      colori: gruppo.colori,\n      carte_core: gruppo.carte_core,\n      modalita: gruppo.modalita,',
        "src/archetipi.js",
    )

    changed["prove/archetipi.test.js"] = replace_once(
        changed["prove/archetipi.test.js"],
        '  assert.equal(gruppi[0].varianti_rilevate, 2);\n});',
        '  assert.equal(gruppi[0].varianti_rilevate, 2);\n  assert.deepEqual(gruppi[0].carte_core, catalogo.liste[0].core);\n});',
        "prove/archetipi.test.js",
    )

    # Nessuna scrittura prima di questo punto: se una verifica fallisce,
    # la working tree resta intatta.
    for relative, content in changed.items():
        (root / relative).write_text(content, encoding="utf-8", newline="\n")
    for relative, content in NEW_FILES.items():
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8", newline="\n")

    print("STEP 6 applicato senza commit/push.")
    print("\nFile modificati:")
    for relative in sorted(changed):
        print(f"  M {relative}")
    print("\nFile nuovi:")
    for relative in sorted(NEW_FILES):
        print(f"  ?? {relative}")
    print("\nProssimi comandi:")
    print("  npm run prove")
    print("  git status --short")
    print("  git diff --stat")
    print("\nPoi test frontend:")
    print("  cd sito")
    print("  python -m http.server 8790")
    print("  apri http://127.0.0.1:8790 e fai Ctrl+F5")


if __name__ == "__main__":
    main()
