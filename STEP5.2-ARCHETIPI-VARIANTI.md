# MOXTRACKER STEP 5.2 — Archetipi e varianti

Data: 2026-08-19

## Obiettivo

Separare definitivamente due concetti che nella STEP 5 erano sovrapposti:

- **Archetipo**: famiglia strategica del mazzo, riconoscibile da un nucleo di carte caratteristiche.
- **Variante**: decklist molto vicina a una lista di riferimento specifica.

La soglia del 90% non viene abbassata. Da questa STEP significa **variante quasi identica**. Un mazzo puo' appartenere allo stesso archetipo anche con diversi slot cambiati.

## Regole server

### Variante

- somiglianza lista completa >= 90%;
- margine >= 3 punti percentuali dal miglior archetipo diverso;
- restituisce `livello_classificazione: "variante"` e `lista_id`.

### Archetipo

Fallback quando la variante non raggiunge il 90%:

- il generatore crea un `core` di massimo 8 carte per lista;
- usa prima eventuale `budget_policy.core` di mox-meta;
- completa con carte giocate soprattutto in 3-4 copie e discriminanti tra archetipi;
- il runtime confronta la presenza, non il numero esatto di copie;
- servono almeno 5 carte core presenti;
- deve essere presente almeno il 60% del core;
- il miglior archetipo deve staccare il secondo archetipo diverso di almeno 20 punti percentuali.

Se questi criteri non sono rispettati, il mazzo resta per impronta. Nessun nome viene inventato.

## Aggregazione meta

Tutte le impronte riconosciute con lo stesso `archetipo_id` vengono aggregate nello stesso archetipo, anche se sono varianti diverse.

La risposta `/meta` aggiunge:

- `varianti_rilevate`: numero di impronte diverse aggregate;
- `livelli_classificazione`: indica se nel gruppo sono presenti riconoscimenti `archetipo`, `variante` o entrambi.

Questo prepara la futura pagina dettaglio a mostrare tutte le varianti realmente osservate su MOXTRACKER senza confonderle con la lista di riferimento di mox-meta.

## Caso che ha motivato la modifica

Il mazzo di test `419fdf15...` contiene molte carte cardine di Mono White Auras ma diversi slot sono differenti dalla lista `mono-white-ladder`. Confrontarlo al 90% come lista esatta lo lasciava anonimo; come archetipo deve invece essere riconosciuto quando il core e' sufficientemente chiaro.

## Procedura dopo l'estrazione

1. Rigenerare il catalogo:

   `npm run genera-archetipi`

2. Eseguire tutti i test:

   `npm run prove`

3. Diagnosticare il mazzo reale gia' esportato:

   `npm run diagnostica-archetipo -- mazzo-419fdf15.json`

4. Solo dopo controllare `git diff`, commit e deploy.
