# HANDOFF — MOXTRACKER frontend v1 + Archetype Engine STEP 5

**Data:** 19/08/2026

## Stato

La homepage STEP 4 e funzionante con le API live. La STEP 5 prepara il passaggio dal raggruppamento per impronta al raggruppamento per archetipo senza alterare i dati originali e senza cambiare il protocollo MOX beta 2.8.

## Decisioni confermate

- Meta pubblico: una riga deve rappresentare un archetipo aggregato quando riconosciuto.
- Fallback: se il riconoscimento non e affidabile, resta `Mazzo <impronta>`.
- Colore e Strategia derivano dall'archetipo riconosciuto, non vengono dedotti per dare un nome al mazzo.
- Gioco/Risposta globale non viene mostrato in homepage; restera utile nel dettaglio di un archetipo quando esistera l'endpoint specifico.
- Matchup = archetipo A contro archetipo B; resta bloccato finche l'avversario non e classificabile in modo affidabile.
- `mox-meta` e catalogo/tassonomia e lista di riferimento; MOXTRACKER resta la fonte delle statistiche nuove.

## Architettura STEP 5

Il tracker riceve Arena ID numerici; mox-meta usa nomi di carte. Non si cambia il protocollo. Si genera invece un catalogo statico server-side sul PC che ha Arena:

```text
mox-meta Standard
        +
database locale MTG Arena (Arena ID <-> nome inglese)
        |
        v
src/catalogo-archetipi-generato.js
        |
        v
src/archetipi.js
        |
        v
GET /meta
```

Il riconoscimento usa la lista completa del mazzo MOX. Le carte sconosciute non vengono ignorate: penalizzano la somiglianza.

## Soglie iniziali

- somiglianza minima: 0,90
- margine minimo dal miglior archetipo diverso: 0,03
- terre base escluse dal confronto
- due varianti dello stesso archetipo non sono considerate ambigue

Le soglie sono del classificatore e non devono essere mostrate come win rate.

## File nuovi/modificati

```text
src/archetipi.js
src/catalogo-archetipi-generato.js
src/lettura.js
strumenti/genera_catalogo_archetipi.py
prove/archetipi.test.js
package.json
sito/archetipo.html
sito/css/site.css
sito/js/archetype.js
sito/js/main.js
sito/js/meta-model.js
sito/js/render.js
prove/frontend-format.test.js
STEP5-ARCHETYPE-ENGINE.md
```

## Prima del deploy

Dalla root `moxtracker`:

```bat
npm run genera-archetipi
npm run prove
```

Il generatore deve produrre `src/catalogo-archetipi-generato.js` con `generato: true`.

Poi verificare il diff:

```bat
git status
git diff
```

Non pubblicare il Worker finche i test non sono verdi e non e stato controllato almeno un mazzo reale.

## Frontend

Il grafico finto di “Andamento nel tempo” e stato eliminato. Finche non esiste una serie temporale reale viene mostrato solo uno stato vuoto.

Le URL dettaglio conservano anche `modalita` (Bo1/Bo3), per evitare di confondere due versioni dello stesso archetipo.

## Non ancora fatto

- classificazione avversario;
- matrice matchup;
- serie temporale;
- statistiche Gioco/Risposta per singolo archetipo;
- lista di riferimento caricata nella pagina dettaglio;
- account e statistiche personali.
