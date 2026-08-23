# Account, dashboard e ticket — stato del 22/08/2026

La fase è implementata, configurata e pubblicata su `moxtracker.app` e
`api.moxtracker.app`. Il collaudo reale Google/Discord, collegamento Mox,
amministrazione e dashboard privata è stato completato il 22/08/2026.

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
  esito per game, turni, durata, mulligan, decklist, mano iniziale e carte
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
- contributo anonimo ancora possibile senza account.

## Ticket

- categorie `bug`, `sviluppo`, `dati`;
- stati `ricevuto`, `da_verificare`, `pianificato`, `in_lavorazione`,
  `risolto`, `chiuso`;
- ticket autenticati nella cronologia account;
- ticket anonimi accessibili soltanto tramite token/link segreto, il cui hash
  è l'unica copia conservata in D1;
- risposte successive del proprietario e del supporto;
- PNG, JPEG e WebP fino a 10 MB, massimo 5 allegati, in R2 privato; gli ZIP
  restano esclusi finché non esiste una scansione automatica affidabile;
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
   account di prova prima di aprire la funzione agli utenti.
10. Turnstile e rate limiter sono attivi; il backend continua a fallire in modo
    sicuro se una futura configurazione dovesse mancare.

## Test

`prove/account-ticket.test.js` copre OAuth senza email, hash sessione,
collegamento con o senza contributi, Turnstile, rate limiter, ruolo
amministratore, audit, retention, ticket anonimo, link segreto, risposte e
cronologia autenticata.
`prove/account-ticket-frontend.test.js` blocca regressioni nelle pagine, nella
dashboard responsive, nel caricamento degli stili e nell'informativa Privacy.
La suite complessiva è **109/109**.
