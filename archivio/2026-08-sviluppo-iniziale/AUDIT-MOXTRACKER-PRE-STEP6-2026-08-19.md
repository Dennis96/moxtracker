# MOXTRACKER — Audit completo pre-STEP 6

Data: 2026-08-19

## Scopo

Audit della cartella completa `moxtracker` prima di applicare lo STEP 6
(immagini reali delle carte + hover preview).

Questo documento serve come riferimento per ChatGPT Codex / Claude Code
prima di controllare o integrare lo step.

## Stato Git verificato

- Branch: `frontend-v1`
- HEAD: `69440cdefea9349efc909657841b129ec397b290`
- Commit: `Completa pulizia frontend step 5.3.2`
- Working tree del pacchetto analizzato:
  - nessun file tracciato modificato;
  - unico file non tracciato: `strumenti/applica_step6_immagini_hover.py`.

Lo STEP 5.3.2 è quindi correttamente salvato come baseline separata.

## Convenzione cartelle confermata

I file Python del progetto appartengono a:

`strumenti/`

Situazione corrente:

- `strumenti/genera_catalogo_archetipi.py`
- `strumenti/applica_step532.py`
- `strumenti/applica_step6_immagini_hover.py`

Non ci sono file `.py` nella root del repository.

Quindi il patcher STEP 6 deve rimanere in:

`strumenti/applica_step6_immagini_hover.py`

La precedente indicazione di copiarlo nella root era errata.

I documenti di avanzamento STEP, invece, sono correttamente nella root:

- `STEP5-ARCHETYPE-ENGINE.md`
- `STEP5.1-FIX-CARTE-BIFRONTE.md`
- `STEP5.2-ARCHETIPI-VARIANTI.md`
- `STEP5.3-NOMI-CANONICI-VARIANTI.md`
- `STEP5.3.1-FIX-NOMI-CARTE-VARIANTI.md`
- `STEP5.3.2-PULIZIA-FRONTEND.md`

Lo STEP 6 seguirà la stessa convenzione:

`STEP6-IMMAGINI-CARTE-HOVER.md`

## Struttura del repository

### `src/` — Worker / backend

- `src/index.js`
  - routing pubblico;
  - ricezione partite;
  - collegamento agli endpoint di lettura.
- `src/controlli.js`
  - validazione dei pacchetti provenienti da MOX.
- `src/lettura.js`
  - `/meta`;
  - `/gioco-risposta`;
  - `/scontri`;
  - soglie statistiche.
- `src/archetipi.js`
  - Archetype Engine;
  - firme;
  - core;
  - classificazione;
  - aggregazione meta.
- `src/dettaglio-archetipo.js`
  - endpoint `/archetipo`;
  - liste di riferimento;
  - varianti osservate.
- `src/catalogo-archetipi-generato.js`
  - catalogo generato;
  - non va modificato manualmente.

### `sito/` — frontend pubblico

HTML:

- `sito/index.html`
- `sito/archetipo.html`

JavaScript:

- `sito/js/main.js`
  - stato pagina;
  - filtri;
  - caricamento API.
- `sito/js/render.js`
  - rendering Meta Explorer e matchup.
- `sito/js/archetype.js`
  - rendering pagina dettaglio archetipo.
- `sito/js/api.js`
  - chiamate verso `api.moxtracker.app`.
- `sito/js/meta-model.js`
  - modello frontend per classificazioni, colori, strategie.
- `sito/js/format.js`
  - formattazione numeri/date/percentuali.
- `sito/js/config.js`
  - configurazione frontend.

CSS:

- `sito/css/tokens.css`
- `sito/css/site.css`
- `sito/css/step53.css`

Asset:

- branding MOX;
- mascot;
- background;
- icone/favicon.

### `prove/` — test automatici

Coprono:

- validazione dati;
- lettura e aggregazioni;
- Archetype Engine;
- dettaglio archetipo;
- frontend helper;
- routing Worker;
- limiti e sicurezza.

### `strumenti/` — script di sviluppo/manutenzione

- generatori Python;
- patcher Python degli step;
- diagnostica `.mjs`.

Questa è la posizione corretta anche per il patcher STEP 6.

## File locali/generati presenti ma ignorati

Il pacchetto contiene anche elementi locali che non fanno parte del codice da committare:

- `node_modules/`
- `.wrangler/`
- `sito/.wrangler/`
- `id-database.txt`
- `mazzo-419fdf15.json`

Sono coerenti con `.gitignore`.

## Test baseline

Eseguito prima di applicare lo STEP 6:

`npm run prove`

Risultato:

- test: 51
- pass: 51
- fail: 0

La baseline `69440cd` è quindi verde.

## Simulazione completa STEP 6

Lo STEP 6 è stato applicato su una COPIA separata della cartella caricata,
non sulla baseline originale.

Dopo l'applicazione è stato eseguito nuovamente:

`npm run prove`

Risultato:

- test: 56
- pass: 56
- fail: 0

Sono stati aggiunti 5 test specifici per il resolver immagini Scryfall.

## Architettura STEP 6 verificata

### Nuovo helper frontend

`site/js/card-images.js` non viene usato: il percorso corretto è:

`sito/js/card-images.js`

Responsabilità:

- lookup Scryfall;
- Arena ID come lookup primario;
- nome esatto come fallback;
- `small` per thumbnail;
- `normal` per hover preview;
- supporto carte bifronte;
- cache memoria;
- cache `localStorage`;
- deduplicazione richieste;
- rate limiting client;
- lazy resolution con `IntersectionObserver`;
- fallback grafico.

### Nuovo CSS

`sito/css/card-images.css`

Contiene esclusivamente presentazione di:

- miniature;
- strip delle carte core;
- righe decklist;
- preview hover;
- responsive mobile.

### Meta Explorer

`src/archetipi.js` espone un nuovo campo:

`carte_core`

Il campo copia il `core` già presente nel catalogo e già usato dal motore.

Non viene cambiata nessuna regola di classificazione.

`render.js` usa `carte_core` per mostrare fino a 8 miniature.

### Dettaglio archetipo

`archetype.js` usa il nuovo helper per:

- lista di riferimento;
- sideboard;
- varianti osservate.

Per le varianti viene preferito l'Arena ID già presente nell'API.

### CSP

`sito/_headers` deve autorizzare:

- immagini `https://*.scryfall.io`
- connessioni `https://api.scryfall.com`

Senza questa modifica il browser bloccherebbe le immagini/API in produzione.

## Archetype Engine — invarianti da non cambiare

Lo STEP 6 NON deve modificare:

- `POLICY_ARCHETIPI.soglia = 0.90`
- `POLICY_ARCHETIPI.margine = 0.03`
- `POLICY_ARCHETIPI.core_soglia = 0.60`
- `POLICY_ARCHETIPI.core_min_carte = 5`
- `POLICY_ARCHETIPI.core_margine = 0.20`

Le carte core vengono soltanto esposte per il rendering.

## Regola documentazione da questo punto in poi

Ogni STEP di sviluppo deve produrre un file `.md` nella root del repository.

Il documento deve contenere almeno:

1. baseline Git di partenza;
2. obiettivo;
3. file creati;
4. file modificati;
5. file esplicitamente non modificati;
6. scelte architetturali;
7. eventuali API/fonti esterne;
8. test eseguiti e risultati;
9. verifica manuale richiesta;
10. commit finale dello step.

In questo modo Codex/Claude possono ricostruire ogni modifica senza dipendere
dalla cronologia della chat.

## Procedura corretta per lo STEP 6

Dalla root di `moxtracker`:

```bat
python strumenti\applica_step6_immagini_hover.py
npm run prove
git status --short
git diff --stat
```

Non fare ancora commit/push finché il frontend non è stato controllato visivamente.

Per il frontend:

```bat
cd sito
python -m http.server 8790
```

Aprire:

`http://127.0.0.1:8790`

e fare `Ctrl + F5`.

## Nota per la revisione Codex

Prima di integrare lo STEP 6, Codex deve leggere almeno:

1. `HANDOFF-MOXTRACKER-STEP5-2026-08-19.md`
2. `STEP5-ARCHETYPE-ENGINE.md`
3. `STEP5.2-ARCHETIPI-VARIANTI.md`
4. `STEP5.3-NOMI-CANONICI-VARIANTI.md`
5. `STEP5.3.1-FIX-NOMI-CARTE-VARIANTI.md`
6. `STEP5.3.2-PULIZIA-FRONTEND.md`
7. `AUDIT-MOXTRACKER-PRE-STEP6-2026-08-19.md`
8. `STEP6-IMMAGINI-CARTE-HOVER.md`

Poi deve controllare il diff effettivo e rieseguire l'intera suite.
