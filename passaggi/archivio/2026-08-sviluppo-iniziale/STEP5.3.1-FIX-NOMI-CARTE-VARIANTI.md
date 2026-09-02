# MOXTRACKER STEP 5.3.1 — Fix nomi carte nelle varianti

Data: 2026-08-19

## Problema

La STEP 5.3 mostrava correttamente gli Arena ID delle carte osservate, ma per le carte non presenti nelle decklist di riferimento di `mox-meta` l'API restituiva `nome: null`. Il frontend visualizzava quindi `Carta Arena #104893`, ecc.

Il dato della partita era corretto: il limite era nel catalogo generato dal Worker, che conteneva nomi soltanto per le carte usate dal classificatore e per le terre base.

## Correzione

`strumenti/genera_catalogo_archetipi.py` ora genera `id_a_nome` usando tutti gli Arena ID con nome inglese presenti nel database locale di MTG Arena.

Questo dizionario completo serve esclusivamente a risolvere i nomi delle carte osservate. Non cambia:

- soglia variante 90%;
- core degli archetipi;
- soglia core 60%;
- minimo 5 carte core;
- margine core 20%;
- aggregazione delle statistiche.

Il catalogo generato passa a `versione: 4` e dichiara `nomi_arena_completi: true`.

## Verifica

Dopo aver estratto il fix:

1. `npm run genera-archetipi`
2. controllare che `Arena ID nominati` sia molto più alto del vecchio catalogo compatto;
3. `npm run prove`
4. solo dopo commit/push/deploy.

Dopo il deploy, `/archetipo?formato=Standard&id=aure-mono-bianco` deve restituire un nome anche per gli ID 104893, 104900, 104901, 104918 e 104921 se presenti nel DB locale Arena usato per la generazione.
