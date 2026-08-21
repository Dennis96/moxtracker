# moxtracker — server, meta e sito di Mox

> Stato verificato il **21/08/2026**. L'indice dei documenti è in
> [DOCUMENTAZIONE.md](DOCUMENTAZIONE.md).

moxtracker è la parte online di Mox. Riceve, solo con consenso, le partite che
il programma locale legge da MTG Arena; le conserva in Cloudflare D1, riconosce
gli archetipi dalle carte e offre dati aggregati al sito.

È un repository Git separato da `..\Codice`. Il ramo di sviluppo corrente è
`frontend-v1`.

## Stato corrente

- **API pubblica:** `https://api.moxtracker.app`.
- **Database:** Cloudflare D1.
- **Ricezione:** `POST /partite`.
- **Draft online:** `POST /draft`, `GET /draft/statistiche`,
  `POST /contributi/elimina`; D1 separato e R2 privato con lifecycle a 730 giorni.
- **Lettura pubblica:** `GET /salute`, `/meta`, `/archetipo`,
  `/gioco-risposta`, `/scontri`.
- **Sito beta:** `https://beta.moxtracker.pages.dev`, separato dal dominio
  principale e pensato per i feedback iniziali.
- **Dominio:** `moxtracker.app` è stato comprato, ma al 20/08/2026 non è ancora
  collegato al frontend.
- **Step 6.1.1:** immagini `art_crop` e correzione della cache sono online
  sulla beta Pages e funzionano nel Meta Explorer. Le modifiche possono restare
  non committate nella copia locale: lo stato Git e la pubblicazione della beta
  sono due cose distinte.
- **Step 7:** Worker, D1 Draft, R2, lifecycle e cancellazione sono online e
  collaudati; resta da impostare dal pannello l'avviso spesa a 1 dollaro.
- **Pre-lancio sito:** banner beta, Privacy, Draft raggiungibile da mobile,
  Matchup compatto senza dati e anteprima locale con aggregati reali completati.
  Il download punta all'asset stabile della release GitHub più recente.

Il Worker pubblico restituisce anche `carte_core`; il frontend può quindi
mostrare colori, strategia e immagini degli archetipi riconosciuti.

## Regole sui dati

- Nessun nome del giocatore, nome dell'avversario o nome libero del mazzo.
- Nessun dato nascosto del mazzo avversario: solo carte rivelate nel log.
- Il mittente è un identificativo casuale per installazione, non l'impronta del
  computer.
- L'invio parte spento e richiede consenso esplicito in Mox.
- Partite e Draft hanno consensi separati. La revoca Draft svuota soltanto la
  coda online e conserva i dati personali locali.
- Gli archetipi sono dedotti sul server; se le carte non bastano, il risultato
  è «non identificato».
- Ogni percentuale deve restare legata a campione e aggiornamento. Sotto 30
  partite non si mostra una percentuale; per una coppia della matrice degli
  scontri la soglia è 100.

## Struttura

| Percorso | Contenuto |
|---|---|
| `src/index.js` | instradamento HTTP del Worker |
| `src/controlli.js` | validazione dei pacchetti in ingresso |
| `src/draft.js` | validazione, R2/D1, tetti, aggregati e cancellazione coordinata di partite e Draft |
| `src/lettura.js` | aggregazioni pubbliche |
| `src/archetipi.js` | classificazione di archetipi e varianti |
| `src/dettaglio-archetipo.js` | pagina dati di un singolo archetipo |
| `src/catalogo-archetipi-generato.js` | catalogo generato dai dati pubblicabili di Mox |
| `schema.sql` | schema D1 |
| `schema-draft.sql` | schema del secondo D1 dedicato ai Draft |
| `sito/` | frontend statico per Cloudflare Pages |
| `prove/` | test Node senza dipendenza dal database reale |
| `strumenti/` | generatori, diagnostica e applicatori storici degli Step |

## Prove locali

Serve Node.js con le dipendenze già installate.

```powershell
npm run prove
```

Il conteggio aggiornato va preso dall'ultima esecuzione di `npm run prove`, non
copiato in questo file durante lo sviluppo.

Per avviare il Worker locale:

```powershell
npm run database-locale
npm run database-draft-locale
npm run locale
```

Per vedere il sito con gli aggregati dell'API pubblica:

```powershell
npm run sito-locale
```

Poi aprire `http://127.0.0.1:8790`. L'anteprima inoltra in sola lettura le
richieste `/api` all'API pubblica, senza inviare partite o Draft.

## Prima di pubblicare

1. terminare lo Step corrente e riesaminare le modifiche locali;
2. eseguire `npm run genera-archetipi` se è cambiato il catalogo sorgente;
3. eseguire `npm run prove`;
4. committare e inviare il ramo soltanto quando la consegna è pronta;
5. pubblicare prima il Worker se il frontend dipende da nuovi campi;
6. verificare la beta Pages e collegare `moxtracker.app` solo dopo i feedback;
7. verificare che l'asset stabile `Mox-Windows-beta.zip` appartenga alla release
   GitHub più recente;
8. controllare desktop, mobile, privacy, soglie e assenza di numeri finti.

Il pulsante di download è stato attivato per la beta controllata dopo il primo
Draft reale Prendi Due e il fix 2.9.1; il dominio principale resta separato.

Non eseguire `npm run database-vero` o `npm run pubblica` come semplice prova:
scrivono sul servizio Cloudflare reale.
