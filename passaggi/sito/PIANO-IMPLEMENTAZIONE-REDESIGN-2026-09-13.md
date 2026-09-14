# Redesign sito MOX — piano di implementazione

> **Per chi esegue:** skill richiesta `superpowers:executing-plans` (esecuzione
> in linea, in questa sessione). I passi usano le caselle `- [ ]`.

**Obiettivo:** portare nel sito reale `sito/**` il redesign congelato, senza
perdere nessuna funzione esistente.

**Architettura:** HTML statico più moduli ES già esistenti. La struttura della
testata e gli `id` usati dal JavaScript restano; cambiano il markup delle
pagine, un nuovo foglio `redesign.css` caricato dopo quelli attuali e piccole
modifiche mirate ai moduli (`main.js`, `render.js`, `archetype.js`,
`deck-profile.js`, `account.js`, `site-shell.js`). Meta diventa `meta.html`;
`index.html` diventa la Home di presentazione.

**Stack:** HTML, CSS, JavaScript ES modules nel browser; build Node
(`strumenti/build_sito.mjs`) con traduzione EN per corrispondenza di testo
(`sito/i18n/en.json`); test `node --test prove/*.test.js`.

**Specifica:** `passaggi/sito/SPEC-SITO-MOX-REDESIGN-2026-09-13.md` (prevale),
render `passaggi/sito/mockups/2026-09-13/claude-home-exploration/plugin/*-final.png`,
markup e CSS di riferimento nella stessa cartella (`index.html`, `meta*.html`,
`draft.html`, `account.html`, `style.css`, `pages.css`).

## Vincoli globali

- Branch `claude/site-redesign-implementation-2026-09-13` da `fe29cc6`; nessun
  merge, nessun deploy Pages, Worker o produzione.
- Non toccare `src/**`, `schema*.sql`, `migrazioni/**`, Worker, D1, Research,
  `mox-core`. Nessun cambio di API o contratti.
- Home e Meta sono pagine separate. Navigazione: Home, Meta, Draft, Account,
  Supporto, IT/EN, più `Scarica MOX`.
- H1 della Home: «Tracker, Assistente al Draft, mazzi e statistiche per MTG
  Arena.»; riga tecnica «Windows · Beta pubblica · Download da GitHub».
- Soglie: percentuali e decklist variante da 30 partite; matchup da 100 per
  coppia. Sotto soglia: «N partite su 30: ne mancano M».
- Stati visivi: pubblicato (verde), sotto soglia (contorno), in arrivo
  (tratteggio lilla).
- Profilo: «Copie per tipo di carta», «Copie per colore d'identità» (per
  esteso, mai «60 W»), «Curva di mana», «Terre speciali e fixing».
- Dati: API reale, stato vuoto o caricamento; mai numeri dimostrativi nel sito.
- Il download risolve sempre la GitHub Release Latest (`download.js`); nessuna
  versione fissa.
- Ogni nuovo testo statico ha la sua chiave in `sito/i18n/en.json`; i testi
  dinamici hanno una traduzione o uno schema in `sito/js/translate.js`.
- Punti di rottura: 1100 px e 760 px; nessuno scorrimento orizzontale della
  pagina.
- I test esistenti che fissano copy cambiato dalla specifica si aggiornano nello
  stesso commit che cambia il copy, citando la sezione della specifica.

## Mappa dei file

| File | Responsabilità |
|---|---|
| `sito/css/tokens.css` | token della specifica (colori, font) con i nomi di variabile esistenti |
| `sito/css/redesign.css` (nuovo) | testata, piede, componenti comuni, stati, layout di Home, Meta, archetipo, variante, Draft, Account |
| `sito/assets/home/*` (nuovo) | screenshot reali della Home e anteprime delle pagine web |
| `sito/assets/fonts/*` (nuovo, se autorizzato) | Spectral 600 e Hanken Grotesk 400/600/800 in WOFF2 |
| `sito/index.html` | Home di presentazione (sezioni della specifica 5) |
| `sito/js/home.js` (nuovo) | solo `preparaDownloadLatest()` per la Home |
| `sito/js/meta-legacy.js` (nuovo) | reindirizza `#meta`, `#matchup`, `#metodo` della Home a `meta.html` |
| `sito/meta.html` (nuovo) | Meta Explorer, matchup, metodo |
| `sito/js/main.js` | modulo del Meta: tolte le statistiche Home, segmenti Periodo/Modalità |
| `sito/js/render.js` | stato sotto soglia con partite mancanti, colonna Apri, niente monogramma |
| `sito/archetipo.html` | ordine della specifica: percorso, intestazione, metriche, varianti, profilo, catalogo, in arrivo; vista variante |
| `sito/js/archetype.js` | percorso, riga filtri, barra di ripartizione varianti, link al Meta |
| `sito/js/deck-profile.js` | etichette e definizioni del profilo |
| `sito/draft.html` | ordine prodotto → dati → metodo |
| `sito/account.html` | cinque schede con gli stessi `id` |
| `sito/js/account-tabs.js` (nuovo) | schede accessibili, hash e `mostraScheda()` |
| `sito/js/account.js` | riepiloghi Panoramica, apertura della scheda Partite dai mazzi |
| `sito/js/site-shell.js` | percorso Meta, voce attiva |
| altre pagine HTML | CTA in testata, link Meta aggiornati, `redesign.css` |
| `sito/i18n/en.json`, `sito/js/translate.js` | traduzioni nuove |
| `strumenti/build_sito.mjs` | `meta.html` fra le pagine pubbliche |
| `strumenti/anteprima_sito.mjs` | banco sintetico facoltativo per l'Account (`MOX_BANCO_SINTETICO`) |
| `strumenti/smoke_beta.mjs` | route `/meta` e `/en/meta` |
| `prove/redesign-sito.test.js` (nuovo) | regressioni del redesign |
| `prove/*.test.js` esistenti | aggiornati solo dove la specifica cambia copy o struttura |
| `prove/fixtures/account-sintetico.json` (nuovo) | dati inventati per il banco locale, fuori dalla build |

---

### Task 1: Meta come pagina pubblica nella build e compatibilità `#meta`

**File:**
- Crea: `sito/js/meta-legacy.js`, `prove/redesign-sito.test.js`
- Modifica: `strumenti/build_sito.mjs:10-13`, `sito/js/site-shell.js:6-13`,
  `prove/build-sito.test.js:42,63`

**Interfacce:**
- Produce: `destinazioneMetaLegacy(hash, search) → string | null` esposta come
  `globalThis.destinazioneMetaLegacy` (lo script è classico, eseguito subito in
  `<head>`).

- [ ] **Passo 1: test che falliscono**

```js
// prove/redesign-sito.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const QUI = new URL("../sito/", import.meta.url);
const leggi = (nome) => readFileSync(new URL(nome, QUI), "utf8");

function eseguiLegacy(hash, search = "") {
  const chiamate = [];
  const contesto = { location: { hash, search, replace: (url) => chiamate.push(url) } };
  contesto.globalThis = contesto;
  vm.runInNewContext(leggi("js/meta-legacy.js"), contesto);
  return chiamate;
}

test("i vecchi ingressi al Meta della Home portano a meta.html", () => {
  assert.deepEqual(eseguiLegacy("#meta"), ["./meta.html"]);
  assert.deepEqual(eseguiLegacy("#matchup", "?x=1"), ["./meta.html?x=1#matchup"]);
  assert.deepEqual(eseguiLegacy("#metodo"), ["./meta.html#metodo"]);
  assert.deepEqual(eseguiLegacy(""), []);
  assert.deepEqual(eseguiLegacy("#scarica"), []);
});

test("la build pubblica meta.html anche in inglese", () => {
  const build = leggi("../strumenti/build_sito.mjs");
  assert.match(build, /"meta\.html"/);
  assert.match(leggi("js/site-shell.js"), /meta: "\.\/meta\.html"/);
});
```

- [ ] **Passo 2:** `node --test prove/redesign-sito.test.js` → FAIL (file
  `meta-legacy.js` assente, `meta.html` non nella build).
- [ ] **Passo 3: implementazione minima**

```js
// sito/js/meta-legacy.js — script classico, caricato in <head> della Home.
// Il Meta vive in meta.html: i vecchi link /#meta, /index.html#meta e le
// sezioni #matchup e #metodo portano alla nuova pagina senza rompersi.
(function (radice) {
  const SEZIONI = { "#meta": "", "#matchup": "#matchup", "#metodo": "#metodo" };
  radice.destinazioneMetaLegacy = function (hash, search) {
    if (!Object.prototype.hasOwnProperty.call(SEZIONI, hash)) return null;
    return `./meta.html${search || ""}${SEZIONI[hash]}`;
  };
  const destinazione = radice.destinazioneMetaLegacy(location.hash, location.search);
  if (destinazione) location.replace(destinazione);
})(globalThis);
```

  In `build_sito.mjs` aggiungere `"meta.html"` a `PAGINE_PUBBLICHE`; in
  `site-shell.js` `meta: "./meta.html"`. In `prove/build-sito.test.js`
  aggiungere `"meta.html"` alle due liste di pagine. Il link relativo
  `./meta.html` vale sia in `/` sia in `/en/`: la lingua si conserva da sola.
- [ ] **Passo 4:** test del passo 1 → PASS (il test di build passerà dopo il
  Task 3, quando `meta.html` esiste).
- [ ] **Passo 5:** commit insieme al Task 3.

### Task 2: token, font e `redesign.css` di base (testata, piede, componenti)

**File:**
- Modifica: `sito/css/tokens.css`, tutte le pagine HTML (`<link>` a
  `redesign.css`, CTA `Scarica MOX` in `.nav`, link Meta nel piede)
- Crea: `sito/css/redesign.css`, `sito/assets/fonts/*.woff2` (se autorizzato)

- [ ] **Passo 1: test che fallisce**

```js
test("ogni pagina carica redesign.css e ha la CTA di download in testata", () => {
  for (const pagina of ["index.html", "meta.html", "draft.html", "download.html", "archetipo.html",
    "account.html", "supporto.html", "privacy.html", "cosa-invia-mox.html", "note-versione.html", "admin.html"]) {
    const html = leggi(pagina);
    assert.match(html, /css\/redesign\.css/, pagina);
    assert.match(html, /class="nav-download"[^>]*>Scarica MOX</, pagina);
    assert.doesNotMatch(html, /index\.html#meta/, `${pagina}: link Meta vecchio`);
  }
});
```

- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3:** `tokens.css` con i valori della specifica, sezione 4 (conservando
  i nomi `--bg`, `--surface*`, `--line*`, `--text`, `--muted*`, `--violet*`,
  `--green`, `--red`, `--warning` usati dai CSS esistenti; aggiunte `--ink`,
  `--panel`, `--table`, `--lilac`, `--dash`, `--serif`, `--sans`). `redesign.css`
  porta da `plugin/style.css` e `plugin/pages.css`: testata (brand con marchio,
  voce attiva sottolineata, `.nav-download`, menu mobile esistente
  `#nav-toggle`/`.nav-links[data-open]`), piede, pulsanti, pannelli, fascia di
  metriche, chip, pallini, stati `state-ok`/`state-below`/`state-soon`,
  `real-note`, `soon-box`, `text-link`, focus, `prefers-reduced-motion`.
  In ogni pagina: `<link rel="stylesheet" href="./css/redesign.css">` dopo gli
  altri fogli, `<a class="nav-download" href="./download.html">Scarica MOX</a>`
  dentro `.nav` dopo `#primary-nav` (fuori dal menu, sempre visibile),
  `index.html#meta` → `meta.html`.
  Font: `@font-face` locali se autorizzati; altrimenti le pile di ripiego della
  specifica (`Georgia` / `Segoe UI`), senza aprire la CSP a domini esterni.
- [ ] **Passo 4:** PASS; `npm run prove` completo.
- [ ] **Passo 5:** commit `feat(site): shell e token del redesign`.

### Task 3: pagina Meta autonoma

**File:**
- Crea: `sito/meta.html`
- Modifica: `sito/js/main.js`, `sito/js/render.js`, `sito/js/translate.js`,
  `sito/i18n/en.json`

**Interfacce:**
- Consuma: `renderMeta(data, sort, localFilters, apiFilters)` (firma invariata).
- Produce: `valoreSegmento(nome) → string` in `main.js` (legge il radio
  selezionato del gruppo `name`).

- [ ] **Passo 1: test che falliscono**

```js
test("l'Explorer vive in meta.html e non nella Home", () => {
  const meta = leggi("meta.html");
  for (const id of ["format-filter", "rank-min", "rank-max", "archetype-search", "strategy-filter",
    "clear-local-filters", "meta-body", "meta-count", "meta-updated", "meta-threshold", "meta-visible",
    "matchup-state", "classification-help"]) assert.match(meta, new RegExp(`id="${id}"`), id);
  assert.match(meta, /name="periodo"[^>]*value="30"[^>]*checked/);
  assert.match(meta, /name="modalita"[^>]*value=""[^>]*checked/);
  assert.match(meta, /data-color="W"/);
  assert.match(meta, /js\/main\.js/);
  assert.match(meta, /data-page="meta"/);
  const home = leggi("index.html");
  assert.doesNotMatch(home, /id="meta-body"|js\/main\.js|id="format-filter"/);
  assert.match(home, /href="\.\/meta\.html"/);
});

test("sotto soglia la tabella dice quante partite mancano", () => {
  const render = leggi("js/render.js");
  assert.match(render, /function partiteMancanti\(/);
  assert.match(render, /ne mancano/);
  assert.doesNotMatch(render, /deck-mark/);
  assert.match(leggi("js/translate.js"), /ne mancano/);
});
```

- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3:** `meta.html` con la testata comune, barra beta, intestazione
  (H1 «Meta Explorer», frase del percorso, `#meta-count`, `#meta-updated`),
  filtri (Formato select `#format-filter`; Periodo e Modalità come gruppi radio
  `name="periodo"` e `name="modalita"` con `role="radiogroup"`; rank a doppio
  cursore esistente; ricerca; strategia; colori; Azzera; `#classification-help`),
  `#meta-body`, note, pannello matchup (`#matchup-state`), «Come funzionano i
  dati». `main.js`: rimuovere `loadDraftSummary`, `aggiornaDataHome`, gli accessi
  a `#home-*`, l'import di `download.js` e `fetchStatisticheDraft`; periodo e
  modalità da `valoreSegmento()`; Azzera ricontrolla i radio predefiniti.
  `render.js`:

```js
export function partiteMancanti(deck, soglia) {
  const servono = Math.max(0, Number(soglia || 30) - Number(deck.partite || 0));
  return { soglia: Number(soglia || 30), mancano: servono };
}
```

  Righe sotto soglia: una cella `colspan="2"` con «Sotto soglia», barretta
  (`partite / soglia`) e testo `${partite} partite su ${soglia}: ne mancano ${mancano}`;
  colonna finale «Apri» con link quando `deckDetailUrl` esiste; niente
  monogramma; `aria-sort` sulla colonna ordinata. Nuovo schema in
  `translate.js`: `/^(\d[\d.,]*) partite su (\d+): ne mancano (\d+)$/` →
  `$1 matches of $2: $3 to go`; chiavi in `en.json` per i nuovi testi.
- [ ] **Passo 4:** PASS; `npm run prove`.
- [ ] **Passo 5:** commit `feat(site): pagina Meta autonoma` (con Task 1).

### Task 4: Home di presentazione

**File:**
- Modifica: `sito/index.html`, `prove/prelancio-sito.test.js:94-103`
- Crea: `sito/js/home.js`, `sito/assets/home/*`

- [ ] **Passo 1: test che fallisce**

```js
test("la Home segue la specifica e scarica la Latest", () => {
  const home = leggi("index.html");
  assert.match(home, /<h1[^>]*>Tracker, Assistente al Draft, mazzi e statistiche per MTG Arena\.<\/h1>/);
  assert.match(home, /Windows · Beta pubblica · Download da GitHub/);
  assert.match(home, /data-download[^>]*>Scarica MOX</);
  assert.match(home, /js\/meta-legacy\.js/);
  assert.match(home, /js\/home\.js/);
  for (const sezione of ["Cosa fa MOX", "MOX sul web", "In sviluppo", "Pianificato"]) assert.match(home, new RegExp(sezione));
  for (const momento of ["Durante la partita", "Durante il Draft", "Dopo il Draft", "Dopo le partite"]) assert.match(home, new RegExp(momento));
  assert.doesNotMatch(home, /Tauri|Proposta di pagina|Gioca meglio/);
  assert.match(leggi("js/home.js"), /preparaDownloadLatest\(\)/);
});
```

- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3:** portare il markup di `plugin/index.html` (Hero, Cosa fa MOX,
  MOX sul web, In sviluppo, Pianificato, CTA finale) dentro la testata e il
  piede reali; asset in `./assets/home/` (glow convertito in WebP); CTA della
  Hero e finale con `data-download href="#download"`; `home.js` importa
  `preparaDownloadLatest` da `./download.js`. Tolti: statistiche pubbliche,
  intro «Dentro Mox», teaser Research nascosto (sostituito dalla voce «MOX
  Research» di «In sviluppo», specifica 5); le anteprime di «MOX sul web» senza
  «Proposta di pagina» (Task 10 le rigenera dalle pagine vere). In
  `prelancio-sito.test.js` il controllo `research-teaser … hidden` diventa:
  Research compare solo nella lista `dev-list`, senza date e senza link.
- [ ] **Passo 4:** PASS; `npm run prove`.
- [ ] **Passo 5:** commit `feat(site): Home di presentazione`.

### Task 5: archetipo, varianti e dettaglio variante

**File:**
- Modifica: `sito/archetipo.html`, `sito/js/archetype.js`,
  `sito/js/deck-profile.js`, `prove/frontend-privacy.test.js:46`,
  `prove/deck-profile-ui.test.js:17`

**Interfacce:**
- Produce in `archetype.js`: `rigaFiltri(params) → string`,
  `ripartizioneVarianti(data) → { pubblicate, sottoSoglia, liste, totale }`,
  `renderPercorso(deck, selection)`.

- [ ] **Passo 1: test che falliscono**

```js
test("archetipo: ordine della specifica e contratto URL invariato", () => {
  const html = leggi("archetipo.html");
  const ordine = ["detail-path", "detail-summary", "variants-panel", "detail-grid"].map((id) => html.indexOf(`id="${id}"`));
  assert.ok(ordine.every((i) => i > 0));
  assert.deepEqual([...ordine].sort((a, b) => a - b), ordine);
  const js = leggi("js/archetype.js");
  for (const p of ["formato", "rank", "periodo", "modalita", "impronta", "id", "variante"]) assert.match(js, new RegExp(`params\\.get\\("${p}"\\)`));
  assert.match(js, /function ripartizioneVarianti\(/);
  assert.match(js, /new URL\("\.\/meta\.html"/);
  assert.doesNotMatch(js, /Apri variante →/);
});

test("profilo con etichette per esteso", () => {
  const js = leggi("js/deck-profile.js");
  assert.match(js, /"Copie per tipo di carta"/);
  assert.match(js, /"Copie per colore d'identità"/);
  assert.match(js, /copie con il/);
});
```

- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3:** `archetipo.html`: percorso `#detail-path`, intestazione senza
  mascotte (H1, `#detail-tags`, `#detail-filters` con link «Cambia filtri» a
  `meta.html`), `#detail-summary` come fascia di metriche (stessi id),
  `#variants-panel` con `#variants-split`, poi `#detail-grid` con profilo a
  sinistra e, a destra, `#reference-panel` e il pannello «Ancora in arrivo»
  `id="trend-panel"` (righe rank, al gioco/risposta, matchup, andamento con i
  testi e gli id attuali). Vista variante: `#variant-focus` con la riga
  archetipo/ID/rank e `#variant-focus-back`, metriche, decklist a sinistra,
  `#variant-focus-profile` spostato nella colonna destra sopra «Statistiche
  avanzate». `archetype.js`: percorso, riga filtri, barra di ripartizione, link
  al Meta, «Apri variante» senza freccia. `deck-profile.js`: etichette e testo
  «N copie con il bianco/blu/nero/rosso/verde/incolore», nota «Ogni copia conta
  una volta: N carte in totale» e nota sull'identità colore. Aggiornare i due
  test esistenti (specifica 6, «Profilo» e «Componenti»).
- [ ] **Passo 4:** PASS; `npm run prove`.
- [ ] **Passo 5:** commit `feat(site): archetipo e varianti del redesign`.

### Task 6: Draft

**File:** `sito/draft.html`, `sito/css/draft.css` (se serve),
`prove/draft-frontend.test.js:12`, `sito/i18n/en.json`

- [ ] **Passo 1: test che fallisce**

```js
test("Draft: prodotto, poi dati, poi metodo", () => {
  const html = leggi("draft.html");
  const i = (t) => html.indexOf(t);
  assert.match(html, /<h1[^>]*>Assistente al Draft e dati Limited<\/h1>/);
  assert.ok(i("Nel programma") < i("Dati Limited sul sito"));
  assert.ok(i("Dati Limited sul sito") < i("Il metodo"));
  assert.ok(i("Il metodo") < i("Le garanzie del metodo"));
  assert.doesNotMatch(html, /Next Gen/);
});
```

- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3:** markup da `plugin/draft.html` con gli id attuali
  (`draft-filters`, `draft-set`, `draft-format`, `draft-period` resta select,
  `draft-updated`, `draft-count`, `draft-picks`, `draft-matches`,
  `draft-winrate`, `draft-match-note`, `draft-events`, `draft-error`), immagini
  reali in `./assets/home/`. Il test esistente sul vecchio H1 passa al nuovo.
- [ ] **Passo 4:** PASS; `npm run prove`.
- [ ] **Passo 5:** commit `feat(site): pagina Draft del redesign`.

### Task 7: Il mio MOX a cinque schede

**File:**
- Crea: `sito/js/account-tabs.js`
- Modifica: `sito/account.html`, `sito/js/account.js`, `sito/i18n/en.json`

**Interfacce:**
- Produce: `mostraScheda(id: "panoramica"|"mazzi"|"partite"|"draft"|"account")`
  in `account-tabs.js`.
- Consuma in `account.js`: `mostraScheda("partite")` prima di
  `scrollIntoView` in `apriMazzo`.

- [ ] **Passo 1: test che fallisce**

```js
test("Account: cinque schede accessibili e nessuna funzione persa", () => {
  const html = leggi("account.html");
  const schede = [...html.matchAll(/role="tab"[^>]*aria-controls="scheda-([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(schede, ["panoramica", "mazzi", "partite", "draft", "account"]);
  for (const id of ["account-loading", "account-login", "account-dashboard", "total-matches", "recent-form", "last-send",
    "decks", "rank-chart", "opponent-stats", "draft-sessions", "matches", "filter-deck", "create-link", "devices",
    "tickets", "admin-link", "logout", "delete-account", "detail-dialog", "overview-decks", "overview-matches"]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  const tabs = leggi("js/account-tabs.js");
  assert.match(tabs, /ArrowRight/);
  assert.match(tabs, /aria-selected/);
  assert.match(tabs, /export function mostraScheda/);
  assert.match(leggi("js/account.js"), /mostraScheda\("partite"\)/);
});
```

- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3:** markup da `plugin/account.html` senza la barra «Dati di
  esempio» e senza numeri statici: tutti i valori restano quelli riempiti da
  `account.js` (`0`, `—`, stati vuoti). Pannelli: Panoramica (metriche,
  forma, consensi, `#overview-decks` accanto a `#rank-chart`,
  `#overview-matches`), Mazzi (`#decks`), Partite (filtri, `#matches`,
  controlli, `#opponent-stats`), Draft (`#draft-sessions`), Account (collega,
  dispositivi, ticket, accessi, dati, cancellazione). `account-tabs.js`:
  `role="tablist"`, frecce sinistra/destra, Home/End, `aria-selected`,
  `hidden` sui pannelli, hash `#scheda-…`. `account.js`: dopo
  `mostraPanoramica()` riempire `#overview-decks` con i primi tre mazzi
  (`creaRigaMazzo`) e, dopo `caricaPartite()`, `#overview-matches` con le prime
  quattro righe; `apriMazzo` chiama `mostraScheda("partite")`.
- [ ] **Passo 4:** PASS; `npm run prove`.
- [ ] **Passo 5:** commit `feat(site): Il mio MOX a schede`.

### Task 8: pagine di servizio e testata comune

**File:** `sito/supporto.html`, `download.html`, `privacy.html`,
`cosa-invia-mox.html`, `note-versione.html`, `admin.html`

- [ ] Verificare con il test del Task 2; controllare a vista che i fogli attuali
  delle pagine di servizio restino leggibili con i nuovi token.
- [ ] Commit con il Task 2 se non cambia altro.

### Task 9: traduzioni complete

**File:** `sito/i18n/en.json`, `sito/js/translate.js`

- [ ] **Passo 1: test che fallisce**

```js
test("ogni testo statico delle pagine ridisegnate ha la traduzione", () => {
  const en = JSON.parse(leggi("i18n/en.json"));
  const neutri = new Set(["MOX", "Meta", "Draft", "Account", "IT / EN", "W", "U", "B", "R", "G", "BO1", "BO3", "BO1 + BO3",
    "—", "0", "×", "Home", "Privacy", "GitHub", "HOB", "SOS"]);
  for (const pagina of ["index.html", "meta.html", "archetipo.html", "draft.html", "account.html"]) {
    const html = leggi(pagina).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
    const testi = [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1].trim())
      .filter((t) => t && /[a-zà-ù]/i.test(t) && !neutri.has(t));
    const attributi = [...html.matchAll(/\b(?:aria-label|title|placeholder|alt)="([^"]+)"/g)].map((m) => m[1]).filter((t) => !neutri.has(t));
    const mancanti = [...new Set([...testi, ...attributi])].filter((t) => !en[t]);
    assert.deepEqual(mancanti, [], pagina);
  }
});
```

- [ ] **Passo 2:** FAIL con l'elenco delle chiavi mancanti.
- [ ] **Passo 3:** aggiungere le chiavi; nuovi schemi dinamici in
  `translate.js`.
- [ ] **Passo 4:** PASS; `npm run sito:build`; controllo che `en/meta.html`
  esista.
- [ ] **Passo 5:** commit `feat(site): traduzioni del redesign`.

### Task 10: banco sintetico, anteprime web, smoke e verifica browser

**File:** `strumenti/anteprima_sito.mjs`, `prove/fixtures/account-sintetico.json`,
`strumenti/smoke_beta.mjs`, `sito/assets/home/web-*.webp`

- [ ] `anteprima_sito.mjs`: con `MOX_BANCO_SINTETICO=<file.json>` risponde alle
  sole route `/api/account/*` presenti nel file, tutto il resto invariato; senza
  variabile il comportamento non cambia. Test: il file resta fuori da `sito/`.
- [ ] `smoke_beta.mjs`: aggiungere `/meta` e `/en/meta` alle route attese.
- [ ] Anteprime «MOX sul web» dalle pagine vere servite in locale (Meta con API
  pubblica, Account con il banco sintetico e nota «Dati di esempio»).
- [ ] Verifica browser locale: Home, Meta, archetipo, variante, Draft, Account
  (non autenticato e con banco), Supporto, Download, IT/EN, menu mobile, focus,
  `/#meta` e `/en/#meta`, 1440 / 520 / 390 px, nessun overflow.

### Task 11: chiusura

- [ ] `npm run prove` completo e `npm run sito:build` (annotare build ID).
- [ ] `superpowers:verification-before-completion`.
- [ ] Commit candidato, poi `superpowers:requesting-code-review`; correggere i
  finding, rieseguire prove e verifica.
- [ ] Aggiornare `STATO-CORRENTE-SITO.md` (branch, HEAD, test, build ID,
  browser, `#meta`, limiti, confini non toccati, nessun deploy e nessun merge).
- [ ] `git diff --check`, controllo perimetro, commit finale, push.
