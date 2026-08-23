# moxtracker — server, meta e sito di Mox

> Stato verificato il **23/08/2026**. L'indice dei documenti è in
> [DOCUMENTAZIONE.md](DOCUMENTAZIONE.md).

moxtracker è la parte online di Mox. Riceve, solo con consenso, le partite che
il programma locale legge da MTG Arena; le conserva in Cloudflare D1, riconosce
gli archetipi dalle carte e offre dati aggregati al sito.

È un repository Git separato da `..\Codice`. Il ramo di sviluppo corrente è
`frontend-v1`. Il 23/08/2026 tutto il lavoro del 22/08, che era rimasto solo
sul disco pur essendo già pubblicato su Cloudflare, è stato consolidato in tre
commit locali: S2/rank/archetipi/immagini HOB, account e ticket, download
manuale e documentazione. Il remoto è `github.com/Dennis96/moxtracker`.

## Stato corrente

- **API pubblica:** `https://api.moxtracker.app`.
- **Database:** Cloudflare D1.
- **Ricezione:** `POST /partite`.
- **Draft online:** `POST /draft`, `GET /draft/statistiche`,
  `POST /contributi/elimina`; D1 separato e R2 privato con lifecycle a 730 giorni.
- **Lettura pubblica:** `GET /salute`, `/meta`, `/archetipo`,
  `/gioco-risposta`, `/scontri`.
- **Release Mox:** `GET /mox/release`; senza manifesto firmato risponde
  `disponibile: false`.
- **Account e ticket:** OAuth Google/Discord, collegamento Mox, ticket,
  amministrazione con audit, Turnstile, D1/R2 privato e retention sono
  configurati e pubblicati. Il **collaudo reale è in corso**: accesso Google e
  Discord sullo stesso account e collegamento del Mox locale sono verificati
  dal 23/08/2026; le altre sette prove sono elencate una per una in
  `ACCOUNT-E-TICKET.md`. La dashboard privata mostra panoramica W/L,
  prestazioni per decklist esatta, cronologia filtrabile e cliccabile,
  decklist, andamento delle partite, sessioni Limited e pool dei Draft.
  Vedi `ACCOUNT-E-TICKET.md`.
- **Correzioni pubblicate il 22/08:** le Bo1 usano l'impronta della decklist
  iniziale Arena; il catalogo riconosce `Thor Capstone`. Il rank con livello
  senza classe è conservato come `parziale`; migrazione rank e le due
  migrazioni Thor Capstone (5 + 2 righe) sono state applicate. L'API restituisce
  il gruppo Thor Capstone con 7 partite.
- **Sito:** `https://moxtracker.app`; la beta Pages resta disponibile per i
  collaudi separati.
- **Step 6.1.1:** immagini `art_crop` e correzione della cache sono online
  sulla beta Pages e funzionano nel Meta Explorer.
- **Step 7:** Worker, D1 Draft, R2, lifecycle e cancellazione sono online e
  collaudati; resta da impostare dal pannello l'avviso spesa a 1 dollaro.
- **Privacy e varianti:** decklist osservata pubblicabile solo da 30 partite
  della stessa variante, senza mittente; pagina variante separata, con
  decklist nascosta sotto soglia. Percentuali a 30 e matchup a 100 partite.
- **Pre-lancio sito:** banner beta, Privacy, Draft raggiungibile da mobile,
  Matchup compatto senza dati e anteprima locale con aggregati reali completati.
  Navbar semplificata e light mode corretta. Il download punta all'asset
  stabile della release GitHub più recente.

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
| `src/account.js` | OAuth, sessioni, dashboard, dispositivi, export e cancellazione account |
| `src/ticket.js` | ticket anonimi/autenticati, messaggi, allegati e stati |
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

Ultima esecuzione del 23/08: **112/112** verdi.

**Lavoro del 23/08 non ancora pubblicato.** Sono nel repository e verdi in
locale, ma il servizio online ha ancora la versione precedente: la CSP che
consente Turnstile (senza la quale i ticket anonimi non funzionano), il testo
dei messaggi che non resta più attaccato al nome di chi scrive, e la frase su
Discord tolta dal riquadro «Prima di inviare»; il menu «Evento» della
cronologia che elenca tutti gli eventi e non i soli Draft; e i mazzi veri di
Arena sincronizzati nell'account (`POST /mox/account/decks`, tabella
`account_mazzo`).

Per pubblicare servono, in quest'ordine: la migrazione
`migrazioni/2026-08-23-account-mazzo.sql` sul D1 remoto, il deploy del Worker,
il deploy Pages, e la verifica su `moxtracker.app`. Gli stack
trace da fault injection R2/D1 durante quei test sono attesi e coperti.

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
5. per account/ticket seguire tutti i prerequisiti di `ACCOUNT-E-TICKET.md`;
6. pubblicare prima il Worker se il frontend dipende da nuovi campi;
7. verificare sia `moxtracker.app` sia la beta Pages dopo ogni deploy;
8. verificare che l'asset stabile `Mox-Windows-beta.zip` appartenga alla release
   GitHub più recente;
9. controllare desktop, mobile, privacy, soglie e assenza di numeri finti.

Il pulsante di download è stato attivato per la beta controllata dopo il primo
Draft reale Prendi Due e il fix 2.9.1; il dominio principale è online.

Non eseguire `npm run database-vero` o `npm run pubblica` come semplice prova:
scrivono sul servizio Cloudflare reale.
