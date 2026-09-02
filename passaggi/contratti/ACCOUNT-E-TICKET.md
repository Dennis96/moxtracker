# Account, dashboard e ticket — stato del 02/09/2026

La fase è implementata, configurata e **pubblicata** su `moxtracker.app` e
`api.moxtracker.app`.

Lo stato di rilascio e i collaudi correnti sono in
[STATO-CORRENTE-SITO.md](../../STATO-CORRENTE-SITO.md). Nell'Account il campo
legacy `apertura` è descritto come «Ultima mano osservata», con la nota che non
è la mano d'apertura.

Il **collaudo reale R0 7–13 è superato** il 02/09/2026: ticket anonimo,
amministrazione e audit, riapertura, revoca, export e cancellazione sono stati
provati sul campo. La checklist corrente conserva le evidenze sintetiche.
Accesso OAuth, collegamento Mox e isolamento del secondo account erano già
stati superati. Lo ZIP diagnostico strutturato creato da Mox è già collaudato.

L'esito operativo è nella tabella «Collaudo reale — stato per singola prova»:
qui si distingue fra superato, da riverificare e mai confermato manualmente.

## Account

- OAuth Authorization Code con Google o Discord; Mox non conserva password
  e non richiede lo scope email;
- stato OAuth monouso legato a cookie `HttpOnly`, `Secure`, `SameSite=Lax`;
- sessioni casuali di 30 giorni, conservate in D1 soltanto come SHA-256;
- CORS con credenziali limitato esattamente a `SITE_ORIGIN`, mai `*`;
- dashboard privata con W/L, win rate, play/draw, durata media e forma recente;
- soli mazzi costruiti dall'utente, raggruppati per impronta esatta, con
  record, dettaglio carte e nome personalizzato salvato nell'account; Draft e
  mazzi precostruiti restano fuori da questa sezione;
- andamento del rank nel tempo e statistiche contro gli archetipi avversari;
  le partite senza abbastanza carte rivelate restano dichiarate non
  classificabili invece di ricevere un archetipo inventato;
- cronologia completa filtrabile per mazzo, esito ed evento; ogni partita apre
  esito per game, turni, durata, mulligan, decklist, ultima mano osservata e carte
  avversarie effettivamente rivelate;
- sessioni Limited ricostruite dalle partite ricevute, con decklist mostrata
  una sola volta nella sessione, e tracce Draft separate con pool finale
  privato e avviso esplicito quando i vecchi pick sono parziali;
- per le carte HOB l'API aggiunge il nome dal catalogo Arena: se Scryfall non
  possiede ancora l'immagine, il sito mostra il nome vero e non il solo ID;
- codice Mox monouso di 9 caratteri e durata 10 minuti;
- collegamento desktop autorizzato anche dal segreto locale già usato per la
  cancellazione: il codice da solo non può collegare l'installazione altrui;
- account e telemetria sono indipendenti: un'installazione si collega anche
  senza aver mai inviato partite o Draft; se esistono contributi precedenti,
  il loro hash deve coincidere prima che vengano associati;
- revoca dispositivo, export JSON e cancellazione completa di account,
  contributi, ticket e allegati;
- **i mazzi che l'utente ha davvero in Arena** — collaudato sul campo il
  23/08/2026: consenso acceso in Mox, sincronizzazione riuscita, mazzi
  visibili nell'account con i nomi veri — mandati dal Mox collegato su
  `POST /mox/account/decks` con mittente e segreto locale. Consenso separato e
  spento di partenza; il nome del mazzo resta nell'account e non entra mai
  nelle aggregazioni pubbliche; ogni invio sostituisce il precedente, quindi
  ciò che l'utente toglie da Arena sparisce anche qui. I mazzi giocati e poi
  cancellati restano visibili come storico, e senza nessuna sincronizzazione
  il sito non scrive etichette che non può sapere;
- **stato corrente dei consensi Mox** — il client collegato invia una
  fotografia esplicita con `POST /mox/account/consents` e corpo JSON
  `{ "mittente": "…", "segreto": "…", "partite": true, "draft": false }`.
  `partite` e `draft` devono essere booleani reali; mittente e segreto devono
  appartenere a un dispositivo già collegato. Il Worker non deduce mai il
  consenso dalla presenza di upload: finché Mox non ha sincronizzato lo stato,
  la dashboard mostra correttamente uno stato sconosciuto. Dopo il
  collegamento Mox deve chiamare l'endpoint una prima volta e ripeterlo dopo
  ogni cambio dei due interruttori;
- contributo anonimo ancora possibile senza account.

### Campo legacy nelle API e negli export

`GET /account/matches/:id` restituisce ancora `partita.apertura`, quando
presente, come mappa grpId→copie: è l'ultima mano osservata nel log, non una
opening hand. La chiave resta per compatibilità e gli export mantengono il
dato originario. Non esiste un alias `opening_hand_kept` del dato legacy.
L'assenza non dimostra una mano vuota e non viene convertita in zero carte.
La validazione dei pacchetti v1/v2 resta invariata, compreso il limite legacy;
cambia soltanto l'errore in «campo legacy apertura non valido». Nessun dato
storico è corretto, riclassificato o cancellato.

## Ticket

- categorie `bug`, `sviluppo`, `dati`;
- stati `ricevuto`, `da_verificare`, `pianificato`, `in_lavorazione`,
  `risolto`, `chiuso`;
- ticket autenticati nella cronologia account;
- ticket anonimi accessibili soltanto tramite token/link segreto, il cui hash
  è l'unica copia conservata in D1;
- risposte successive del proprietario e del supporto;
- PNG, JPEG e WebP fino a 10 MB, massimo 5 allegati, in R2 privato; è
  accettato anche il solo ZIP diagnostico strutturato creato da Mox (con
  `rapporto.json`, `LEGGIMI.txt` e, solo con consenso esplicito, `arena/Player.log`);
  gli archivi generici restano rifiutati;
- controllo della firma reale del file, download autenticato e policy
  `no-referrer` per non propagare il token del link segreto;
- ticket anonimi protetti da Turnstile con validazione server e rate limiter
  Cloudflare per creazione, risposte e allegati;
- amministrazione protetta dalla sessione OAuth e dal ruolo nel database;
  ogni cambio stato o risposta entra in `ticket_audit`;
- pulizia giornaliera: allegati chiusi dopo 90 giorni, ticket chiusi dopo 365.

Frontend: `sito/account.html` e `sito/supporto.html`.

## Configurazione pubblicata

1. creare il bucket `moxtracker-ticket-files` e mantenerlo privato;
2. applicare `schema.sql` al D1 principale;
3. configurare `SITE_ORIGIN=https://moxtracker.app`;
4. creare applicazioni OAuth e redirect esatti:
   - `https://api.moxtracker.app/auth/google/callback`;
   - `https://api.moxtracker.app/auth/discord/callback`;
5. inserire come secret Worker `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `TURNSTILE_SECRET`; impostare
   `TURNSTILE_SITE_KEY` come variabile pubblica del Worker;
6. collegare il dominio frontend. `beta.moxtracker.pages.dev` è cross-site
   rispetto all'API e non è il posto giusto per collaudare cookie di sessione
   destinati al dominio definitivo;
7. il cron e la retention sono dichiarati in `wrangler.toml`; verificarne la
   prima esecuzione nella console Cloudflare;
8. accedere una prima volta e promuovere esplicitamente il solo account del
   responsabile al ruolo `amministratore` in D1;
9. collaudare OAuth reale, revoca, export, cancellazione e allegati su un
   account di prova prima di aprire la funzione agli utenti — vedi «Collaudo
   reale — stato per singola prova», qui sotto.
10. Turnstile e rate limiter sono attivi; il backend continua a fallire in modo
    sicuro se una futura configurazione dovesse mancare.

## Test

`prove/account-ticket.test.js` copre OAuth senza email, hash sessione,
collegamento con o senza contributi, Turnstile, rate limiter, ruolo
amministratore, audit, retention, ticket anonimo, link segreto, risposte e
cronologia autenticata.
`prove/account-ticket-frontend.test.js` blocca regressioni nelle pagine, nella
dashboard responsive, nel caricamento degli stili e nell'informativa Privacy.
Il conteggio della suite si prende da `npm run prove`, non da questa riga:
copiato qui invecchia in un giorno. Le prove aggiunte il 23/08/2026 coprono la
CSP di Turnstile, la leggibilità dei messaggi, il filtro degli eventi, i mazzi
sincronizzati, la loro cancellazione con l'account e la pulizia notturna delle
credenziali scadute.

## Collaudo reale — stato per singola prova

Sono prove sul campo, non test automatici: la suite verde non le sostituisce.
Questa tabella è l'unico posto dove il loro esito viene dichiarato.

| # | Prova | Come si considera superata | Esito |
|---|---|---|---|
| 1 | Accesso con Google e con Discord | entrambi arrivano allo stesso account, senza chiedere lo scope email | **superata** il 23/08/2026: l'account dell'utente è collegato a entrambi i provider |
| 2 | Collegamento di Mox | codice monouso di 9 caratteri, il dispositivo compare fra quelli collegati | **superata** il 23/08/2026: il Mox locale dell'utente è collegato all'account |
| 3 | Revoca del dispositivo | il dispositivo sparisce e le nuove partite non compaiono più nell'account; con invio attivo possono restare contributi anonimi/non associati | **superata** il 02/09/2026 su account di prova |
| 4 | Export JSON | il file scaricato contiene le partite dell'account e nulla di altri mittenti | **superata** il 02/09/2026 su account di prova |
| 5 | Cancellazione dell'account | spariscono account, contributi, ticket e allegati R2; una seconda richiesta non trova più nulla | **superata** il 02/09/2026 soltanto su account di prova |
| 6 | Ticket con allegato | PNG/JPEG/WebP o ZIP diagnostico Mox fino a 10 MB, download solo autenticato | **superata**: accettato lo ZIP strutturato creato da Mox; controllo rapido soltanto in regressione. Gli ZIP generici restano rifiutati |
| 7 | Ticket anonimo | raggiungibile solo dal link segreto, protetto da Turnstile | **superata** il 02/09/2026 |
| 8 | Amministrazione | cambio stato e risposta finiscono in `ticket_audit` | **superata** il 02/09/2026: due operazioni UI distinte e due record audit verificati in D1 |
| 9 | Secondo account reale | non vede né i dati né i ticket del primo | **superata** il 23/08/2026 |

Due avvertenze sull'ordine, imparate leggendo cosa fanno queste prove.

**La 5 va per ultima, e non sull'account principale.** La cancellazione
rimuove davvero account, contributi, ticket e allegati: eseguita sull'account
dell'utente, porterebbe via anche le partite già inviate. Va fatta
sull'account di prova della riga 9.

**La revoca non spegne automaticamente l'invio generale di Mox.** Rimuove
l'associazione account/dispositivo; se l'invio resta attivo, un contributo può
essere ancora accettato come anonimo/non associato. La prova di revoca verifica
che le nuove partite non ricompaiano nell'account revocato.

Le prove manuali amministrazione (8), ticket anonimo/Turnstile (7), revoca
(3), export (4) e cancellazione (5) sono superate; la cancellazione è stata
eseguita esclusivamente sull'account di prova. Lo ZIP diagnostico Mox (6)
resta un controllo rapido già collaudato.

Il 23/08/2026, analizzando il database, sono emersi due difetti che proprio la
prova 5 avrebbe trovato: la cancellazione dell'account **non** portava via i
mazzi sincronizzati, e l'export **non** li conteneva. Corretti e pubblicati,
con due regressioni permanenti.
