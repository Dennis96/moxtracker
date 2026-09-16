# Handoff — S2-BREW-FRONTEND

Per il coordinatore e per S3.

- **Branch:** `claude/s2-brew-frontend-2026-09-16`, creato da `8a3cfe7` (S1
  `17a3ca0` più la review indipendente).
- **HEAD:** vedi `git log` del branch e lo stato corrente.
- **Non fuso, non deployato**, D1 remoto non toccato. **S3 non è iniziato.**

Dettagli in [S2-BREW-FRONTEND-2026-09-16.md](../sito/S2-BREW-FRONTEND-2026-09-16.md).

## Cosa è cambiato

- `sito/js/meta-model.js` contiene le funzioni pure: gruppi del server,
  link `id_brew` o legacy, etichette e distanza, id delle varianti,
  identificativo unico e URL canonico.
- `sito/js/render.js` disegna nel Meta una riga o scheda per gruppo e un solo
  riepilogo sotto soglia, senza «ID tecnico». Senza gruppi resta il fallback
  legacy.
- `sito/js/archetype.js` gestisce:
  - il dettaglio `brew_group`;
  - la selezione `bv_`;
  - la canonicalizzazione dei vecchi `?impronta=`;
  - le metriche inglesi.
- `sito/js/api.js`: `fetchArchetipo` accetta anche `id_brew`, uno solo.
- `sito/i18n/en.json` ha due chiavi nuove.
- `strumenti/anteprima_sito.mjs`: nel banco sintetico si possono usare chiavi
  con la query.
- Prove:
  - `prove/brew-frontend.test.js` è nuova (19 prove);
  - aggiornate con motivazione: `meta-brew-ui`, `frontend-privacy`,
    `redesign-sito`, e la prova frontend di `brew-meta`.
- Screenshot e banco sintetico in `passaggi/sito/mockups/2026-09-16/s2-brew-frontend/`.

## Cosa è invariato

- Backend S1: `src/`, `schema.sql`, migrazioni, clustering e k.
- Payload vecchio: il Meta legacy resta identico quando il Worker non espone
  i gruppi.
- Archetipi riconosciuti e dettaglio legacy, salvo i testi inglesi delle
  metriche e il nome copiato in Arena per le liste legacy.

## Come provare la UI

```powershell
npm run sito:build
$env:MOX_BANCO_SINTETICO = "passaggi/sito/mockups/2026-09-16/s2-brew-frontend/banco-sintetico.json"
$env:MOX_API_ORIGIN = "http://127.0.0.1:9"
node strumenti/anteprima_sito.mjs
```

Poi apri, sulla porta indicata (8790 di default):

- `meta.html` e `en/meta.html`: apri «Altro (Brew)»;
- `archetipo.html?formato=Standard&periodo=30&id_brew=bg_5a1c0e9d3b7f42a6c8e1d0f9b2a4c6e8`;
- il vecchio link
  `archetipo.html?formato=Standard&periodo=30&impronta=` seguito da 64 `b`:
  deve diventare `id_brew` con `variante=bv_…`, e con il reload deve mostrare
  lo stesso contenuto.

## Screenshot da guardare

`01` Meta desktop, `02` Meta mobile a 375 px, `03` dettaglio desktop, `04`
dettaglio mobile inglese, `05` Meta inglese con il riepilogo sotto soglia.

## Test eseguiti

- **Preflight S1 su `8a3cfe7`:**
  - quattro suite Brew: 53/53;
  - `npm run prove`: 405/405, 0 saltati;
  - `sito:build`: `346ce2023c50e91c`;
  - `brew_gruppi.mjs --help`: esce con codice 0.
- **Dopo S2:**
  - quattro suite Brew: 53/53;
  - mirate S2: 55/55;
  - `npm run prove`: 424/424, 0 saltati;
  - `sito:build`: `54ae1e62b7792f95`.
- **Browser.** Verificati: passaggio al link canonico, reload, «indietro»,
  inglese a 375 px, focus sul pulsante, console pulita.

## Condizioni

- Tutti i gruppi si chiamano «Gruppo Brew»: un nome distintivo richiede un
  campo server (S3 o backend).
- Nei formati senza catalogo `?id_brew=` risponde 409, come nel contratto S1.
- Il corpus k=4 non è versionato (condizione S1, solo documentale).
