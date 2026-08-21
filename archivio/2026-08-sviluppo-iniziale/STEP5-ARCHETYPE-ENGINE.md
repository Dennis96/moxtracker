# MOXTRACKER STEP 5 — Archetype Engine conservativo

Data: 2026-08-19

## Obiettivo

Collegare il meta pubblico agli archetipi senza cambiare il protocollo inviato da MOX e senza inventare classificazioni.

Il server continua a ricevere gli ID numerici di Arena. Un generatore locale usa il database carte gia installato con MTG Arena per convertire le liste curate di `mox-meta` in un catalogo server-side confrontabile con quegli ID.

## Cosa cambia

- `src/archetipi.js`: motore puro di confronto e aggregazione.
- `src/catalogo-archetipi-generato.js`: placeholder sicuro; viene rigenerato sul PC con Arena.
- `src/lettura.js`: `/meta` aggrega per archetipo soltanto se il catalogo e disponibile; altrimenti conserva il vecchio raggruppamento per impronta.
- `strumenti/genera_catalogo_archetipi.py`: genera il catalogo Standard da `mox-meta`/meta locale + database Arena.
- `prove/archetipi.test.js`: test del motore.
- frontend: rimosso il grafico finto dello storico; aggiunto supporto a `modalita` nel dettaglio.

## Regola di riconoscimento iniziale

Il criterio riprende la misura di somiglianza gia usata dal Consigliere MOX:

- terre base escluse;
- copie delle carte confrontate come multinsieme;
- somiglianza = carte in comune / dimensione maggiore;
- classificazione solo da **0,90** in su;
- se un archetipo diverso e troppo vicino (margine sotto **0,03**) il mazzo resta non identificato;
- varianti dello stesso archetipo non creano una falsa ambiguita.

Questi numeri sono soglie del classificatore, NON percentuali di vittoria e non vengono presentati come statistiche del meta.

## Perche il catalogo viene generato localmente

`mox-meta` usa nomi inglesi delle carte, mentre MOXTRACKER conserva gli Arena ID numerici. Il database locale di MTG Arena conosce entrambi e permette di creare una mappa deterministica senza:

- cambiare il pacchetto inviato da MOX;
- chiamare Scryfall durante ogni richiesta del sito;
- salvare nomi utente;
- dedurre un archetipo dai soli colori.

Il file generato contiene soltanto dati pubblici sulle carte e sulle liste del catalogo.

## Generazione

Dalla root `moxtracker`:

```bat
npm run genera-archetipi
```

Il comando cerca automaticamente una cartella sorella `Codice` con il progetto MOX.

Se non la trova:

```bat
python strumenti\genera_catalogo_archetipi.py --mox "C:\percorso\Codice"
```

Output atteso:

```text
catalogo archetipi: OK
  database Arena: ...
  meta:           ...\meta\standard.json
  liste:          26
  nomi carte:     ...
  Arena ID mappati: ...
  scritto:        ...\moxtracker\src\catalogo-archetipi-generato.js
```

Se una carta del catalogo non esiste nel database Arena locale, il generatore FALLISCE invece di produrre un catalogo incompleto.

## Test prima di qualunque deploy

```bat
npm run genera-archetipi
npm run prove
```

Non pubblicare se un test fallisce.

## Comportamento API

Senza catalogo generato:

```text
raggruppamento = impronta_mazzo
```

Con catalogo generato:

```text
raggruppamento = archetipo_con_fallback_impronta
```

Un gruppo riconosciuto puo esporre:

```json
{
  "nome": "Aggro rosso",
  "archetipo": "Aggro rosso",
  "archetipo_id": "mono-red",
  "strategia": "aggro",
  "colori": ["R"],
  "modalita": "Bo1",
  "classificazione": "catalogo_mox_meta",
  "impronta": null,
  "impronte_raggruppate": 3
}
```

Un mazzo non riconosciuto resta invece con la sua `impronta` e campi archetipo null.

## Cosa NON cambia ancora

- `/scontri` resta non disponibile: non si classifica l'avversario dalle sole carte rivelate.
- `Gioco vs Risposta` globale resta nell'API per compatibilita ma non torna in homepage.
- account e dati personali restano fuori dalla v1.
- andamento temporale non viene inventato: ora la pagina mostra un vero stato vuoto.

## Aggiornamento futuro di mox-meta

Quando cambiano le liste di `mox-meta`, rigenerare il catalogo e rieseguire i test. In questo modo anche le vecchie partite vengono riclassificate al momento della lettura senza riscrivere il pacchetto originale.
