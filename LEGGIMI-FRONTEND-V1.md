# MOXTRACKER Frontend v1 — prima build

Questa cartella contiene **solo file nuovi frontend** e un test frontend.
Non sostituisce né modifica `src/`, `schema.sql` o `wrangler.toml`.

## Copia nel repository locale

Copia le cartelle:

- `sito/` -> nella root di `moxtracker`
- `prove/frontend-format.test.js` -> `moxtracker/prove/`

Poi esegui dalla root del repository:

```bat
npm run prove
```

Per vedere il frontend localmente, dalla cartella `sito` usa un server statico semplice:

```bat
cd sito
python -m http.server 8790
```

Se `python` non viene riconosciuto:

```bat
py -m http.server 8790
```

Poi apri `http://127.0.0.1:8790`. In locale non usare `wrangler pages dev` dalla root del repository: leggerebbe la configurazione del Worker backend e i suoi binding D1.

## Download MOX

Il pulsante `Scarica MOX` è intenzionalmente disabilitato finché non viene definito un URL reale.
Quando sarà disponibile, modificare solamente:

```text
sito/js/config.js
```

impostando `DOWNLOAD_URL`.

## Backend

Il frontend usa esclusivamente:

- `https://api.moxtracker.app/meta`
- `https://api.moxtracker.app/gioco-risposta`
- `https://api.moxtracker.app/scontri`

Non modifica il Worker.

## STEP 5 — Archetype Engine

La STEP 5 aggiunge il primo classificatore server-side conservativo. Prima di pubblicare il Worker eseguire:

```bat
npm run genera-archetipi
npm run prove
```

Vedi `STEP5-ARCHETYPE-ENGINE.md` per architettura, soglie e procedura.
