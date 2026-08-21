# MOXTRACKER — STEP 5.3.2 — Pulizia frontend Meta e Varianti

Data: 2026-08-19

## Scopo

Piccola rifinitura esclusivamente frontend successiva alla STEP 5.3.1.
Non modifica Worker, API, database, soglie o Archetype Engine.

## Modifiche

1. Meta Explorer: rimosso il doppione `W • Aggro` + badge `W` / `Aggro`.
   Restano soltanto i badge, piu leggibili.
2. Sigla dell'archetipo: deriva dal nome pubblico. `Mono White Auras` mostra `MW` invece di `AM` derivato dall'ID tecnico `aure-mono-bianco`.
3. Filtri colore: un colore semplicemente disponibile non sembra piu selezionato. Il bordo/glow pieno compare solo dopo un click reale (`aria-pressed=true`).
4. Variante osservata: titolo umano `Variante osservata #1`; l'hash diventa informazione secondaria `ID ...`.
5. Metriche variante: `1 partita` / `N partite`; sotto soglia viene mostrato `Dati insufficienti` invece di `WR sotto soglia`.
6. Lista di riferimento: titolo singolare/plurale dinamico e nome canonico (`Mono White Auras • Bo1`) invece del nome interno della lista.

## Applicazione

Estrarre questo pacchetto nella root di `moxtracker`, poi eseguire:

```bat
python strumenti\applica_step532.py
npm run prove
```

Il patcher e idempotente per i blocchi gia applicati e si ferma se trova una versione inattesa dei file, evitando sostituzioni silenziose.

## File frontend interessati

- `sito/js/render.js`
- `sito/js/archetype.js`
- `sito/css/site.css`
- `sito/archetipo.html`

## Non modificati

- `src/`
- API pubbliche
- D1/schema
- Archetype Engine
- catalogo generato
- soglie 30/100
