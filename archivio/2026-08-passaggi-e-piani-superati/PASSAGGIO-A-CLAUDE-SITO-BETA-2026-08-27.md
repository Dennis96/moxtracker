# Passaggio a Claude — sito Mox verso la beta

Data: **27 agosto 2026**.

Questo documento descrive il lavoro svolto da Codex dopo il passaggio
`PASSAGGIO-CODEX-RIPRENDE-IL-SITO-2026-08-26.md`. Il commit `3302a8c` è stato
pubblicato su GitHub, il relativo Worker è stato distribuito e la stessa build
del sito è online soltanto come preview. Non sono state eseguite migrazioni
remote, modifiche ai dati reali o pubblicazioni Pages in produzione.

## Stato verificato

- Worker e sito sono stati provati insieme in locale con D1 e R2 locali.
- La suite completa locale passa: **172 test**, compresi il contratto dei
  consensi correnti, la coerenza fra schema bootstrap e migrazione e il CORS
  ristretto della preview.
- Il commit pubblico `3302a8c` è stato ricontrollato separatamente prima della
  preview: **168/168 test**.
- `npm audit --omit=dev`: **0 vulnerabilità note**.
- La build del sito è riproducibile e genera un manifesto con hash di tutti i
  file.
- Browser QA completata su desktop e a 390×844: nessun overflow orizzontale,
  menu mobile funzionante, pagine italiane e inglesi controllate.
- Il monitor schedulato locale ha rilevato correttamente un vecchio oggetto R2
  di test orfano; l'oggetto è stato identificato e rimosso soltanto dallo
  storage locale. Il controllo successivo è passato.

## Worker e API

### Draft pubblico

`GET /draft/statistiche` espone ora soltanto una risposta pubblica semplice:

- filtri separati per set, formato/evento e periodo;
- totali di Draft e pick;
- gruppi evento/set;
- risultati collegati soltanto sopra soglia;
- nessuna politica interna, traccia completa, diagnostica o mazzo privato.

Le righe con `sospetto IS NOT NULL` sono escluse dagli aggregati pubblici. Un
periodo non valido restituisce `400`, non un errore generico del server. La
regola concordata con Claude resta invariata: una traccia sospetta si conserva
in privato e non viene trasformata in rifiuto o cancellazione.

Il controllo pubblico del 27/08 mostra **9 Draft validi**: 4 Pick Two, 3 Quick
Draft e 2 Premier Draft, ma nessun risultato collegato pubblicabile. Per questo
`approfondimenti.disponibili` resta correttamente `false`: colori e carte non
devono comparire con questo campione. L'attivazione futura richiederà anche una
mappatura affidabile dei colori delle carte/deck finali; non va ricavata per
approssimazione dai soli pick e non blocca la beta iniziale.

### Meta e archetipi

- `/meta` applica filtri formato, periodo, rank e BO1/BO3.
- Le liste Brew sotto soglia confluiscono in `Altro (Brew)`; percentuali e
  decklist restano protette dalle soglie.
- `/archetipo` raggruppa le varianti minori in `Altre varianti` e conserva
  separati catalogo pubblico e liste osservate.
- Trend e matchup restano intenzionalmente chiusi finché i dati non bastano.
- È stato preparato un candidato di punteggio con Wilson e popolarità in
  `ANALISI-PUNTEGGIO-META-2026-08-27.md`, ma **non è pubblicato**: gli 80 match
  reali disponibili producono un solo archetipo sopra soglia e non consentono
  un confronto serio. La formula richiede approvazione di prodotto.

### Account e supporto

- CORS consente il `PUT` usato per rinominare i mazzi.
- La correzione locale successiva consente anche l'origine esatta
  `https://preview.moxtracker.pages.dev`, mantiene rifiutate le altre origini e
  usa una sessione `SameSite=None; Secure` per l'account nella preview. Questa
  parte non è nel Worker `3302a8c` già online.
- La dashboard distingue mazzi correnti e storici, mostra ultimo invio,
  dispositivi, versioni Draft e differenze fra liste.
- I Draft personali mostrano già nell'elenco l'eventuale record collegato; nel
  dettaglio aggiungono un riepilogo Mox delle scelte e avvisi su traccia o
  mazzo mancanti, senza introdurre il pick-by-pick escluso dalla prima beta.
- Export separato per partite, Draft e mazzi.
- Cancellazione selettiva per partite, Draft e mazzi, con conferme diverse. La
  prova Draft verifica anche la rimozione dell'oggetto R2 privato.
- I ticket accettano `rapporto.json` strutturato fino a 256 KiB e immagini;
  Player.log non viene accettato dal flusso normale e richiede un consenso
  separato in Mox.

## Frontend

- Tema scuro unico, navigazione condivisa e menu mobile accessibile.
- Homepage nuova con download stabile, due schermate reali di Mox, conteggi
  aggregati e pagine `Cosa invia Mox` e `Note di versione`.
- Meta Explorer con filtri completi; il pulsante `Azzera filtri` ripristina ora
  anche periodo, BO1/BO3 e rank.
- Corretto il layout a 1280 px: i filtri colore non vengono più tagliati.
- Vista Draft pubblica ridotta agli aggregati utili.
- Dettaglio archetipo/variante con decklist protetta, copia/esportazione Arena,
  curva di mana, tipi, identità colore, terre speciali e fixing.
- Versione inglese generata sotto `/en/`, comprese privacy, supporto, account,
  Draft, pagine informative e messaggi dinamici principali.

## Build, preview e monitoraggio

- `npm run sito:build` produce `.dist/sito` con asset versionati, HTML
  `no-store`, asset immutabili e `build-manifest.json`.
- La build ignora esplicitamente `sito/.wrangler`: una cache operativa locale
  aveva aggiunto un file alla build senza comparire in Git. Una prova crea la
  cache durante la suite e verifica che manifesto e build ID non cambino.
- `npm run sito:release` rifiuta working tree sporca, commit non allineato al
  remoto e produzione senza record preview, screenshot e conferma esplicita.
- Il ramo Pages configurato è `preview`. Cloudflare assegna quindi l'alias
  leggibile `https://preview.moxtracker.pages.dev`, oltre all'URL immutabile con
  hash del deployment.
- Preview verificata del commit `3302a8c`: build `37a2f2f0447c2bc7`, URL
  immutabile `https://7e312688.moxtracker.pages.dev`, sei smoke test su sei con
  risposta `200`.
- Worker del commit `3302a8c` distribuito come versione
  `db01bb23-80eb-4f03-a0d0-b1bc7937c3c2`; `/salute` risponde `200` e il
  preflight account espone anche `PUT`.
- Limite noto della preview attuale: i contenuti pubblici funzionano, ma il
  Worker `3302a8c` risponde `403` al preflight proveniente dall'alias Pages.
  Account e ticket autenticati diventano collaudabili dalla preview soltanto
  dopo la successiva correzione Worker già pronta in locale.
- `strumenti/smoke_beta.mjs` e il workflow giornaliero controllano pagine, API,
  download e gate account senza modificare dati.
- Il workflow locale aggiornato punta esplicitamente alla preview e lo smoke
  verifica anche CORS e cookie credenziali dell'account; non è ancora nel
  commit pubblico `3302a8c`.
- `src/monitoraggio.js` confronta quotidianamente conteggi D1/R2 senza leggere
  i payload privati e segnala eventuali divergenze.

## Cose che richiedono ancora autorizzazione o dati esterni

1. Pubblicare la correzione CORS preview insieme al contratto consensi. Prima
   servono la migrazione remota dei tre campi nullable e la modifica client Mox
   descritta al punto 5.
2. Provare OAuth e ticket con un account dedicato, senza prove distruttive
   sull'account principale.
3. Far eseguire la checklist a 3–5 tester.
4. Approvare o scartare la formula del punteggio Meta dopo un campione con più
   archetipi pubblicabili.
5. Far chiamare a Mox `POST /mox/account/consents` dopo il collegamento e a ogni
   cambio dei due interruttori, con JSON `{ mittente, segreto, partite, draft }`
   e booleani reali. Worker, schema, migrazione locale, dashboard e prove sono
   già preparati; finché il client non chiama l'endpoint il sito mostra
   correttamente “non ancora sincronizzato”. La migrazione remota resta da
   autorizzare ed eseguire prima di pubblicare questa parte del Worker.
6. Pubblicare il sito in produzione, soltanto dopo preview equivalente e nuova
   conferma esplicita.

Il primo Draft reale con Mox 2.9.24 resta utile per assestare i numeri ma, come
stabilito nel piano, non blocca lo sviluppo o la preview del sito.
