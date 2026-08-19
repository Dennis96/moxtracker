# MOXTRACKER STEP 5.3 — Nomi canonici e varianti osservate

Data: 2026-08-19

## Obiettivi

1. Separare il nome tecnico/interno dell'archetipo dal nome pubblico mostrato sul sito.
2. Usare nomi riconoscibili dalla community, per esempio `Mono White Auras` invece di `Aure aggressive`.
3. Esporre il dettaglio delle decklist realmente osservate dentro uno stesso archetipo.
4. Tenere distinte le varianti MOXTRACKER dalle liste curate di riferimento presenti in `mox-meta`.

## Nuovo contratto

`GET /archetipo?formato=Standard&id=aure-mono-bianco`

Restituisce:

- identita' canonica dell'archetipo;
- colori e strategia;
- statistiche aggregate dell'archetipo, sempre soggette alla soglia di 30 partite;
- `varianti`: una voce per ogni impronta/decklist distinta realmente osservata;
- carte della variante (Arena ID e nome quando presente nel catalogo compatto);
- `liste_riferimento`: decklist curate provenienti da `mox-meta`, chiaramente separate dai dati osservati.

Nessun mittente, cronologia personale o dato dell'avversario viene pubblicato nell'endpoint.

## Significato di variante

Una variante osservata e' una diversa `impronta_mazzo` classificata nello stesso `archetipo_id`.
Non significa automaticamente che la lista coincida con una lista di riferimento di `mox-meta`.

Il livello di classificazione continua a distinguere:

- `variante`: somiglianza completa >= 90% a una lista di riferimento;
- `archetipo`: core riconosciuto, ma decklist non abbastanza vicina da assegnare una variante di catalogo.

## Nomi pubblici

Il generatore aggiunge `nome_pubblico`. Per gli archetipi principali viene usata una mappa di nomi canonici, ad esempio:

- `aure-mono-bianco` -> `Mono White Auras`
- `rakdos-aggro` -> `Rakdos Aggro`
- `mono-red` -> `Mono Red`
- `golgari` -> `Golgari Midrange`
- `azorius-flash` -> `Azorius Flash`

L'ID tecnico non cambia.

## Frontend

La pagina `archetipo.html` usa ora l'endpoint dedicato e mostra:

- riepilogo archetipo;
- liste di riferimento mox-meta;
- varianti osservate su MOX;
- decklist osservata espandibile per ogni variante.

Se una carta osservata non ha ancora un nome nel mapping compatto del Worker, viene mostrato il suo Arena ID invece di inventare un nome.

## Procedura locale

Dopo aver estratto lo ZIP nella root di `moxtracker`:

1. `npm run genera-archetipi`
2. `npm run prove`
3. avviare il frontend: `cd sito` e `python -m http.server 8790`
4. verificare prima localmente la pagina `Mono White Auras`.

Non eseguire il deploy prima di aver controllato i test e il JSON locale/live dell'endpoint `/archetipo`.
