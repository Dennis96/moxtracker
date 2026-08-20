# STEP 6.1 — Thumbnail artwork delle carte

Data: 2026-08-19

## Contesto

Lo STEP 6 ha introdotto immagini reali Scryfall e hover preview.

La prima verifica visiva ha mostrato che usare l'immagine completa della carta anche come miniatura rende le carte troppo piccole e poco leggibili.

La preview hover della carta completa, invece, è stata approvata.

## Decisione UI

Nelle viste compatte MOXTRACKER mostra soltanto l'illustrazione:

- Meta Explorer: artwork crop;
- Lista di riferimento: artwork crop;
- Varianti osservate: artwork crop;
- mobile: artwork crop.

L'hover desktop continua a mostrare la carta completa.

## Implementazione

Scryfall `image_uris.art_crop` viene usato come thumbnail.

Fallback: `art_crop -> small`.

La carta completa dell'hover continua a usare `normal`.

Non vengono aggiunte nuove richieste API.

## Modifiche visive

- thumbnail standard: 48 px, formato 4:3;
- thumbnail decklist: 46 px;
- mobile: 42 px;
- massimo 8 carte core desktop;
- massimo 5 carte core mobile.

## File modificati

- `sito/js/card-images.js`
- `sito/css/card-images.css`
- `prove/card-images.test.js`

## File creati

- `STEP6.1-ART-CROP-THUMBNAIL.md`
- `strumenti/applica_step61_art_crop.py`

## Archetype Engine

Nessuna modifica.

Restano invariati:

- soglia variante 0.90;
- margine variante 0.03;
- core threshold 0.60;
- minimo core 5;
- margine core 0.20.

## Nota Meta Explorer

La mancanza delle immagini core nel test locale non dipende da Scryfall.

Il frontend locale continua a interrogare `https://api.moxtracker.app`, mentre il campo `carte_core` esiste per ora soltanto nel backend STEP 6 locale non ancora pubblicato.

La verifica Meta Explorer va quindi ripetuta dopo l'aggiornamento del Worker o contro un backend locale equivalente.

## Test

Dopo l'applicazione:

```bat
npm run prove
git status --short
git diff --stat
```

Non fare ancora commit/push.
