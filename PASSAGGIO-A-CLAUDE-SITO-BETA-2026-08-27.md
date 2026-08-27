# Passaggio a Claude — sito Mox verso la beta

Data: **27 agosto 2026**.

Questo documento descrive il lavoro locale svolto da Codex dopo il passaggio
`PASSAGGIO-CODEX-RIPRENDE-IL-SITO-2026-08-26.md`. Non sono stati eseguiti
deploy di produzione, migrazioni remote o modifiche ai dati reali.

## Stato verificato

- Worker e sito sono stati provati insieme in locale con D1 e R2 locali.
- La suite completa passa: **168 test** dopo l'estensione della prova di
  cancellazione selettiva Draft.
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
- La dashboard distingue mazzi correnti e storici, mostra ultimo invio,
  dispositivi, versioni Draft e differenze fra liste.
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
- `npm run sito:release` rifiuta working tree sporca, commit non allineato al
  remoto e produzione senza record preview, screenshot e conferma esplicita.
- Il ramo Pages configurato è `preview`. Cloudflare assegna quindi l'alias
  leggibile `https://preview.moxtracker.pages.dev`, oltre all'URL immutabile con
  hash del deployment.
- `strumenti/smoke_beta.mjs` e il workflow giornaliero controllano pagine, API,
  download e gate account senza modificare dati.
- `src/monitoraggio.js` confronta quotidianamente conteggi D1/R2 senza leggere
  i payload privati e segnala eventuali divergenze.

## Cose che richiedono ancora autorizzazione o dati esterni

1. Pubblicare i commit sul repository GitHub pubblico.
2. Ripubblicare il Worker con queste API e il monitor schedulato.
3. Creare la preview Pages remota e conservarne il record smoke.
4. Provare OAuth e ticket con un account dedicato, senza prove distruttive
   sull'account principale.
5. Far eseguire la checklist a 3–5 tester.
6. Approvare o scartare la formula del punteggio Meta dopo un campione con più
   archetipi pubblicabili.
7. Sincronizzare lo stato corrente dei due consensi da Mox al Worker. Oggi il
   protocollo non invia quel dato e il sito, per non dedurlo in modo falso,
   rimanda esplicitamente alle Opzioni di Mox. Per soddisfare alla lettera la
   decisione di prodotto “mostrare i consensi attivi” serve un intervento
   coordinato client + API/schema, con migrazione remota autorizzata in seguito.
8. Pubblicare il sito in produzione, soltanto dopo preview equivalente e nuova
   conferma esplicita.

Il primo Draft reale con Mox 2.9.24 resta utile per assestare i numeri ma, come
stabilito nel piano, non blocca lo sviluppo o la preview del sito.
