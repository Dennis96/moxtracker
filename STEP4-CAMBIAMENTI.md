# MOXTRACKER Frontend v1 — STEP 4

Data: 2026-08-19

## Obiettivo

Riorganizzare la homepage attorno al vero valore del sito: Meta Explorer e matchup tra archetipi.

## Modifiche

- rimosso "Gioco vs risposta" dalla homepage: il dato globale mescola archetipi e matchup diversi ed e' poco utile;
- Meta Explorer ora occupa tutta la larghezza;
- aggiunti filtri locali per ricerca, colori W/U/B/R/G e strategia;
- colori e strategia si abilitano solo quando l'API restituisce davvero metadati di classificazione;
- nessun archetipo viene inventato: con l'API attuale resta visibile `Mazzo <impronta>`;
- righe/carte del Meta Explorer sono cliccabili;
- nuova pagina `archetipo.html`, gia' navigabile anche per l'attuale gruppo a impronta;
- pagina dettaglio predisposta per Win rate, quota meta, rank, gioco/risposta, matchup, decklist/carte e andamento temporale;
- le sezioni non supportate dall'API restano esplicitamente bloccate e spiegano quale dato manca;
- Matchup diventa una sezione principale a tutta larghezza e chiarisce che il confronto futuro sara' archetipo A vs archetipo B con soglia 100+;
- integrato branding ufficiale fornito dall'utente: marchio MOX e sfondi del MOX locale;
- aggiunto `meta-model.js` con logica testabile per metadati, colori, strategia, filtri e URL dettaglio;
- ampliati i test frontend.

## mox-meta

`Dennis96/mox-meta` viene considerato un catalogo/tassonomia: nomi, `archetipo_id`, `strategia`, `colori`, modalita' e liste di riferimento.

Non viene usato come fonte delle percentuali pubbliche di MOXTRACKER. Win rate, partite e quota meta devono continuare a derivare dalle partite raccolte da MOXTRACKER.

## Backend

Nessun file backend e' stato modificato.

Con l'API attuale `/meta` raggruppa ancora per `impronta_mazzo`, quindi colori e strategia rimangono disabilitati. Quando l'Archetype Engine aggiungera' metadati ai gruppi, la STEP 4 e' gia' predisposta a leggere:

- `archetipo` o `nome`;
- `archetipo_id`;
- `colori` (array W/U/B/R/G);
- `strategia`.

## Sviluppi successivi

Per completare la pagina dettaglio servono endpoint/serie aggregate per singolo archetipo:

- gioco vs risposta per archetipo;
- distribuzione per rank;
- matchup per coppia;
- carte/decklist osservate;
- andamento temporale.
