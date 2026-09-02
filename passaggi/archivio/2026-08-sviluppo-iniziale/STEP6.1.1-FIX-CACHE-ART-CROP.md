# STEP 6.1.1 — Fix cache artwork thumbnail

Data: 2026-08-19

## Problema osservato

Dopo lo STEP 6.1 le thumbnail continuavano a mostrare porzioni della carta completa
invece dell'illustrazione Scryfall `art_crop`.

La causa non era il crop di Scryfall.

Lo STEP 6 aveva già salvato in `localStorage` una cache con chiave:

`mox-scryfall-card-cache-v1`

Gli oggetti della cache v1 contengono `small` e `normal`, ma non il nuovo campo
`artCrop` introdotto nello STEP 6.1.

Di conseguenza il codice STEP 6.1 riceveva un oggetto cache vecchio e usava:

`artCrop || small`

quindi ricadeva su `small`, cioè la carta intera, dentro un contenitore
orizzontale. Il risultato era un ritaglio errato della carta completa.

## Correzione

La cache immagini viene versionata a:

`mox-scryfall-card-cache-v2`

Questo forza una nuova risoluzione Scryfall una sola volta e salva anche
`artCrop`.

Inoltre il contenitore artwork passa dalla proporzione generica `4 / 3` alla
proporzione Scryfall dell'art crop:

`626 / 457`

## Risultato atteso

Nelle liste:

- solo artwork della carta;
- niente bordo/testo della carta rimpicciolito;
- artwork leggibile;
- quantità e nome restano separati.

Hover desktop:

- continua a mostrare la carta completa `normal`;
- nessuna nuova chiamata generata dal semplice hover.

## File modificati

- `sito/js/card-images.js`
- `sito/css/card-images.css`

## File creati

- `STEP6.1.1-FIX-CACHE-ART-CROP.md`
- `strumenti/applica_step611_cache_art_crop.py`

## File non modificati

Nessuna modifica a:

- Archetype Engine;
- `src/archetipi.js`;
- soglie;
- classificazione;
- API;
- database;
- statistiche.

## Test

Dopo l'applicazione:

```bat
npm run prove
git status --short
git diff --stat
```

Poi sul browser locale:

`Ctrl + F5`

Non fare ancora commit/push prima della verifica visiva finale.
