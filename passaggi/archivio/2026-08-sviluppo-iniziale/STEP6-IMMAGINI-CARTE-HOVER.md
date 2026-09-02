# STEP 6 — Immagini reali carte + hover preview

Data: 2026-08-19

## Baseline

Branch: `frontend-v1`

Commit di partenza:

`69440cdefea9349efc909657841b129ec397b290`

`Completa pulizia frontend step 5.3.2`

## Obiettivo

Aggiungere al frontend pubblico:

- 6–8 miniature delle carte core nel Meta Explorer;
- miniature + quantità + nome nella Lista di riferimento;
- miniature + quantità + nome nelle Varianti osservate;
- preview grande al passaggio del mouse su desktop;
- comportamento non invasivo su touch/mobile;
- fallback se Scryfall non restituisce una carta.

## Fonte immagini

Scryfall, coerente con MOX desktop.

Strategia:

- lookup primario tramite Arena ID quando disponibile;
- fallback tramite nome esatto;
- `small` per le miniature;
- `normal` per la preview;
- cache memoria + localStorage;
- richieste serializzate con intervallo minimo di 140 ms;
- nessuna richiesta API aggiuntiva generata dall'hover;
- immagini risolte solo quando vicine al viewport;
- 404 memorizzati temporaneamente, errori di rete/429 no.

## Archetype Engine

Le regole NON vengono cambiate.

La sola estensione server-side è l'esposizione in `/meta` del campo:

`carte_core`

Il valore proviene dal `core` già generato e già usato dal classificatore.
Non viene ricalcolato nel frontend e non modifica:

- soglia variante 0.90;
- core threshold 0.60;
- minimo 5 carte core;
- margine core 0.20.

## File

Nuovi:

- `sito/js/card-images.js`
- `sito/css/card-images.css`
- `prove/card-images.test.js`
- `STEP6-IMMAGINI-CARTE-HOVER.md`

Modificati:

- `src/archetipi.js`
- `prove/archetipi.test.js`
- `sito/js/render.js`
- `sito/js/archetype.js`
- `sito/index.html`
- `sito/archetipo.html`
- `sito/_headers`

## Verifica

Da root repository:

```bat
npm run prove
git status --short
git diff --stat
```

Frontend locale:

```bat
cd sito
python -m http.server 8790
```

Aprire:

`http://127.0.0.1:8790`

Poi `Ctrl + F5`.

Controllare:

1. Meta Explorer: massimo 8 core desktop, 5 mobile.
2. Hover desktop: preview grande; chiusura all'uscita del mouse.
3. Lista di riferimento: thumbnail + quantità + nome.
4. Variante osservata: thumbnail + quantità + nome.
5. Carta non trovata: placeholder, nessun layout rotto.
6. Nessuna regressione filtri/routing/soglie statistiche.

Non fare deploy o merge in `master` prima della revisione del diff e dei test.
