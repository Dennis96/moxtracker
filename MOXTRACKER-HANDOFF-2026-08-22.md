# MOXTRACKER — Handoff completo 22/08/2026

## Scopo di questo documento

Questo handoff fotografa lo stato reale del repository `Dennis96/moxtracker` alla fine del lavoro del **22/08/2026**.

Serve come punto di partenza per il prossimo intervento di Codex/Claude e, soprattutto, per **committare e pubblicare su GitHub in modo ordinato tutte le modifiche locali che sono già state collaudate e in larga parte già pubblicate su Cloudflare**.

Non usare vecchi handoff come stato corrente se contrastano con questo documento, `LEGGIMI.md`, `DOCUMENTAZIONE.md`, `ACCOUNT-E-TICKET.md` o `S2-CHIUSURA-2026-08-22.md`.

---

# 1. Stato Git da preservare

Repository locale:

```text
C:\Users\santi\Documents\Progetto Magic\moxtracker
```

Branch corrente:

```text
frontend-v1
```

HEAD integrato da cui è partito il lavoro del 22/08:

```text
1c268e8 — Integra privacy e vista varianti
```

Le modifiche del 22/08 sono ancora in larga parte **locali/non committate**, anche se molte sono già state pubblicate su Worker, D1 e Cloudflare Pages.

Quindi:

> **NON fare pull/reset/checkout distruttivi e NON scartare modifiche locali prima di averle riesaminate e committate.**

Stato Git rilevato sulla copia completa del progetto, dopo l'applicazione del fix download finale:

```text
 M DOCUMENTAZIONE.md
 M LEGGIMI.md
 M STEP8-PRELANCIO-SITO.md
 M prove/archetipi.test.js
 M prove/card-images.test.js
 M prove/controlli.test.js
 M prove/prelancio-sito.test.js
 M prove/server.test.js
 M schema.sql
 M sito/_headers
 M sito/css/card-images.css
 M sito/draft.html
 M sito/index.html
 M sito/js/card-images.js
 M sito/js/config.js
 M sito/js/main.js
 M sito/privacy.html
 M src/archetipi.js
 M src/catalogo-archetipi-generato.js
 M src/controlli.js
 M src/draft.js
 M src/index.js
 M strumenti/genera_catalogo_archetipi.py
 M wrangler.toml
?? ACCOUNT-E-TICKET.md
?? MOXTRACKER-HANDOFF-2026-08-21.md
?? S2-CHIUSURA-2026-08-22.md
?? migrazioni/
?? prove/account-ticket-frontend.test.js
?? prove/account-ticket.test.js
?? sito/account.html
?? sito/admin.html
?? sito/css/account-support.css
?? sito/js/account.js
?? sito/js/admin.js
?? sito/js/supporto.js
?? sito/supporto.html
?? src/account.js
?? src/ticket.js
```

`git diff --check` è stato eseguito sullo stato ricostruito con il fix download finale:

```text
EXIT: 0
```

L'unico messaggio visto è un warning CRLF/LF relativo a `.gitignore`; non è un errore del diff.

---

# 2. Test finali

Dopo aver applicato anche il fix finale del download del sito, è stata eseguita:

```bat
npm run prove
```

Risultato:

```text
tests 110
pass 110
fail 0
```

Quindi lo stato finale verificato è:

> **110/110 test verdi.**

Durante la suite compaiono stack trace di fault injection intenzionali, per esempio errori D1/R2 o una tabella interna inesistente. Sono test che verificano il comportamento in caso di guasto e non rappresentano errori reali del servizio.

---

# 3. S2 — regressione eventi con mazzo fornito CHIUSA

S2 è stata riallineata al difetto reale.

Il problema non era cercare nuovi archetipi sulle vecchie impronte, ma una regressione introdotta in Mox 2.9.2:

```text
CourseDeckSummary.Format
```

poteva assegnare `Standard` anche a eventi che usavano un mazzo fornito dal gioco.

Sono stati quindi protetti gli eventi:

```text
DualColorPrecons
WelcomeDeckDuels
jump_in
jumpin
```

Queste partite:

- possono entrare nella cronologia privata;
- restano con `formato: null`;
- non entrano nel meta pubblico Standard.

È presente una regressione end-to-end permanente in:

```text
prove/server.test.js
```

che verifica:

1. ricezione del pacchetto;
2. inserimento D1;
3. lettura del meta Standard;
4. `partite_totali: 0`;
5. nessun mazzo pubblicato nel meta Standard.

Documento autorevole:

```text
S2-CHIUSURA-2026-08-22.md
```

S2 non va riaperta alla cieca.

---

# 4. Bug distinto: impronta Bo1 instabile

Il 22/08 è stato trovato un secondo problema, separato da S2.

In alcune partite Bo1 Mox poteva alterare la decklist osservata durante la partita aggiungendo carte viste/ottenute durante il game, producendo fotografie da 61–64 carte invece della decklist iniziale da 60.

Questo generava impronte diverse per lo stesso mazzo.

La correzione è stata fatta nel parser Mox:

> per le Bo1 viene mantenuta l'impronta della **decklist iniziale ricevuta da Arena**.

Sul lato moxtracker sono state predisposte/applicate le correzioni dati storiche e il catalogo è stato aggiornato.

Migrazioni presenti:

```text
migrazioni/2026-08-22-correggi-impronta-thor-capstone.sql
migrazioni/2026-08-22-correggi-altre-impronte-thor-capstone.sql
```

Il risultato documentato dopo le correzioni è:

```text
Thor Capstone — 7 partite ricondotte allo stesso gruppo
```

Il payload originale `partite.dato` resta conservato; le migrazioni correggono le colonne/righe derivate usate dal sito.

---

# 5. Nuovo archetipo Thor Capstone

È stato aggiunto al catalogo:

```text
thor-capstone
```

Nome pubblico:

```text
Thor Capstone
```

File coinvolti:

```text
strumenti/genera_catalogo_archetipi.py
src/catalogo-archetipi-generato.js
src/archetipi.js
prove/archetipi.test.js
```

È presente una regressione che usa la decklist reale anonimizzata della diagnostica e verifica che venga ricondotta a `thor-capstone`.

Il generatore ora separa inoltre:

- `core` dell'archetipo;
- `budget_policy`;

evitando di fingere che ogni archetipo con un core conosciuto abbia anche sostituzioni budget affidabili.

---

# 6. Rank parziale

È stato corretto il caso in cui Arena invia il livello del rank ma non la classe.

Prima il dato poteva sembrare semplicemente incompleto/perso.

Ora viene salvato:

```text
rank_stato
```

con tre valori:

```text
completo
parziale
assente
```

Regola:

- classe + livello -> `completo`;
- solo uno dei due -> `parziale`;
- nessuno -> `assente`.

File:

```text
src/controlli.js
src/index.js
schema.sql
prove/controlli.test.js
```

Migrazione:

```text
migrazioni/2026-08-22-rank-stato.sql
```

La migrazione è stata applicata sul D1 remoto prima del Worker aggiornato.

---

# 7. Immagini carte HOB e fallback Scryfall

Il catalogo generato ora conserva, oltre al nome della carta:

```text
id_a_nome
```

anche la stampa Arena:

```text
id_a_stampa
```

nel formato:

```text
[set, collector_number]
```

Questo serve soprattutto per le carte HOB che Scryfall può non trovare tramite `arena_id`.

Il frontend prova ora in ordine:

1. Arena ID;
2. set + collector number;
3. nome esatto.

File principali:

```text
strumenti/genera_catalogo_archetipi.py
src/archetipi.js
src/catalogo-archetipi-generato.js
sito/js/card-images.js
sito/css/card-images.css
prove/archetipi.test.js
prove/card-images.test.js
```

La cache Scryfall è stata portata a:

```text
mox-scryfall-card-cache-v3
```

È stato inoltre migliorato l'hover preview usando il Popover API quando disponibile, mantenendo il fallback fixed per browser che non la supportano completamente.

---

# 8. Account MOX

È stata implementata e pubblicata l'area privata account.

Backend:

```text
src/account.js
```

Frontend:

```text
sito/account.html
sito/js/account.js
sito/css/account-support.css
```

Funzioni principali:

- OAuth Authorization Code con Google;
- OAuth Authorization Code con Discord;
- nessuna password conservata da MOX;
- nessuno scope email richiesto;
- stato OAuth monouso;
- cookie `HttpOnly`, `Secure`, `SameSite=Lax`;
- sessioni casuali di 30 giorni;
- nel D1 viene conservato soltanto SHA-256 della sessione;
- collegamento di più provider allo stesso account;
- codice Mox monouso di 9 caratteri;
- scadenza codice 10 minuti;
- collegamento desktop protetto anche dal segreto dell'installazione;
- possibilità di collegare Mox anche prima di avere inviato telemetria;
- dispositivi revocabili;
- export JSON;
- logout;
- eliminazione completa account/dati;
- contributo anonimo ancora disponibile anche senza account.

---

# 9. Dashboard privata

La dashboard account mostra soltanto dati dell'utente autenticato.

Include:

- partite totali;
- vittorie/sconfitte;
- win rate;
- play/draw;
- durata media;
- forma delle ultime partite;
- mazzi personali;
- statistiche per decklist esatta;
- nomi privati personalizzati per i propri mazzi;
- andamento rank;
- statistiche contro archetipi avversari quando classificabili;
- cronologia completa filtrabile;
- dettaglio di ogni partita;
- game, turni, durata e mulligan;
- decklist;
- mano iniziale;
- sole carte dell'avversario realmente rivelate;
- sessioni Limited;
- pool finale Draft quando disponibile.

I mazzi precostruiti e le sessioni Draft non vengono spacciati per mazzi costruiti personali.

Nuova tabella:

```text
account_mazzo_nome
```

Migrazione dedicata:

```text
migrazioni/2026-08-22-account-mazzo-nome.sql
```

---

# 10. Ticket e supporto

È stato implementato un sistema ticket integrato.

Backend:

```text
src/ticket.js
```

Frontend:

```text
sito/supporto.html
sito/js/supporto.js
sito/admin.html
sito/js/admin.js
sito/css/account-support.css
```

Categorie:

```text
bug
sviluppo
dati
```

Stati:

```text
ricevuto
da_verificare
pianificato
in_lavorazione
risolto
chiuso
```

Ticket autenticati:

- compaiono nell'account;
- restano legati alla sessione OAuth.

Ticket anonimi:

- restituiscono un token/link segreto;
- nel D1 viene conservato soltanto l'hash;
- il token è l'unico modo per riaprire il ticket anonimo.

Allegati:

- PNG;
- JPEG;
- WebP;
- massimo 10 MB;
- massimo 5 allegati;
- R2 privato;
- verifica della firma reale del file;
- download solo autorizzato.

Gli ZIP non vengono accettati finché non esiste una scansione automatica affidabile.

Protezione spam/abusi:

- Cloudflare Turnstile;
- rate limiter;
- validazione server;
- comportamento fail-closed se la configurazione manca.

Amministrazione:

- richiede account OAuth;
- richiede ruolo `amministratore` nel DB;
- ogni cambio stato/risposta viene scritto in `ticket_audit`.

Retention automatica:

- allegati di ticket chiusi: 90 giorni;
- ticket chiusi: 365 giorni;
- cron giornaliero.

Documento autorevole:

```text
ACCOUNT-E-TICKET.md
```

---

# 11. Schema D1 Account/Ticket

`schema.sql` è stato esteso con:

```text
account
account_identita
account_sessione
account_oauth_stato
account_codice_mox
account_dispositivo
account_mazzo_nome
ticket
ticket_messaggio
ticket_allegato
ticket_audit
```

Migrazioni additive:

```text
migrazioni/2026-08-22-account-ticket.sql
migrazioni/2026-08-22-account-mazzo-nome.sql
```

Queste modifiche non devono cancellare o ricreare le tabelle storiche di partite/Draft.

---

# 12. Configurazione Cloudflare Account/Ticket

In `wrangler.toml` sono stati aggiunti/configurati:

```text
SITE_ORIGIN = https://moxtracker.app
TURNSTILE_SITE_KEY
```

Cron:

```text
17 3 * * *
```

Rate limiter ticket:

```text
TICKET_RATE_LIMITER
limit = 10
period = 60
```

Bucket ticket:

```text
binding = TICKET_FILES
bucket_name = moxtracker-ticket-files
```

Bucket release Mox:

```text
binding = MOX_RELEASES
bucket_name = moxtracker-releases
```

OAuth callback pubblici:

```text
https://api.moxtracker.app/auth/google/callback
https://api.moxtracker.app/auth/discord/callback
```

Secret Worker previsti/configurati:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
TURNSTILE_SECRET
```

Il dominio frontend definitivo usato per i cookie è:

```text
https://moxtracker.app
```

---

# 13. Release/autoupdate Mox via Worker e R2

È stato introdotto un canale separato per l'autoupdate futuro del programma.

Route:

```text
GET /mox/release
GET /mox/download.exe
```

`/mox/release`:

- accetta `piattaforma=win-x64`;
- accetta `canale=stable`;
- confronta la versione corrente;
- senza manifesto firmato risponde `disponibile: false`;
- non deve inventare una release.

`/mox/download.exe`:

- legge l'installer dal bucket privato `MOX_RELEASES`;
- lo espone tramite Worker solo quando realmente presente/configurato.

Questo sistema è per l'**autoupdate firmato**, non per il download manuale dal sito.

---

# 14. Fix finale del download manuale del sito

Durante il lavoro del 22/08 è stato trovato un errore importante:

il pulsante pubblico **Scarica MOX** era stato fatto puntare a:

```text
https://api.moxtracker.app/mox/download.exe
```

Quella route appartiene invece al canale autoupdate e non deve essere usata come download manuale pubblico finché l'installer firmato non è operativo.

La correzione finale mantiene quindi separati i due canali.

## Download manuale del sito

Il sito punta ora a:

```text
https://github.com/Dennis96/moxtracker/releases/latest/download/Mox-Windows-beta.zip
```

File modificati:

```text
sito/index.html
sito/js/config.js
sito/js/main.js
prove/prelancio-sito.test.js
```

Sono stati corretti entrambi i pulsanti della home.

In `config.js` è stato documentato esplicitamente:

> il download manuale usa GitHub Releases; `/mox/release` e `/mox/download.exe` restano separati per l'autoupdate.

È stato aggiunto/aggiornato anche il cache-buster:

```text
20260822-3
```

per impedire ai browser di mantenere una vecchia `config.js`.

La regressione `prove/prelancio-sito.test.js` verifica ora esplicitamente che il sito usi lo ZIP stabile GitHub.

---

# 15. Release GitHub 2.9.12

È stata pubblicata una nuova Release GitHub e marcata **Latest**.

Titolo finale:

```text
MOX beta v2.9.12
```

Tag:

```text
mox-v2-beta2.9.12
```

Asset stabile:

```text
Mox-Windows-beta.zip
```

Dimensione indicativa:

```text
104 MB
```

SHA-256 del file caricato:

```text
4bf206e4c3e01a3c01c7c46070ac745d37664eef7d821f8588208c3557e7a612
```

Il nome dell'asset deve restare stabile anche nelle beta future:

```text
Mox-Windows-beta.zip
```

In questo modo il sito può usare sempre `/releases/latest/download/...` senza cambiare URL a ogni versione.

Il titolo/tag della Release invece può cambiare normalmente:

```text
MOX beta v2.9.13
MOX beta v2.9.14
...
```

---

# 16. Cloudflare Pages — chiarito Production vs Preview

Il progetto Pages è:

```text
moxtracker
```

`wrangler pages project list --json` ha mostrato:

```text
Project Name: moxtracker
Project Domains: moxtracker.pages.dev, moxtracker.app
Git Provider: NO
```

Quindi Pages usa:

> **Direct Upload manuale**, non deploy automatico GitHub.

La lista deployment ha chiarito che Cloudflare considera:

```text
Production branch: main
```

mentre:

```text
frontend-v1
beta
```

sono Preview.

Questo è importante perché il comando:

```bat
npx wrangler pages deploy sito --project-name moxtracker
```

eseguito mentre Git è su `frontend-v1` ha creato correttamente un **Preview deployment**, non ha aggiornato il dominio principale.

Il preview generato durante il controllo era:

```text
https://d5ce2d17.moxtracker.pages.dev
```

con alias:

```text
https://frontend-v1.moxtracker.pages.dev
```

---

# 17. Deploy Production corretto

Per pubblicare realmente `moxtracker.app` nel progetto Direct Upload corrente è stato usato:

```bat
npx wrangler pages deploy sito --project-name moxtracker --branch main --commit-dirty=true
```

Il flag:

```text
--commit-dirty=true
```

non committa nulla: serve soltanto a consentire il deploy da una working tree con modifiche locali.

Deployment finale mostrato da Wrangler:

```text
https://825e9d9d.moxtracker.pages.dev
```

Il sito principale è stato quindi aggiornato correttamente.

Il warning:

```text
Pages now has wrangler.toml support
...
missing "pages_build_output_dir"
Ignoring configuration file for now, and proceeding with project deploy.
```

non ha bloccato il deploy.

Non modificare `wrangler.toml` alla cieca solo per eliminare questo warning: attualmente contiene anche la configurazione del Worker e il deploy Pages Direct Upload sta procedendo correttamente ignorando quel file.

---

# 18. Regola da ricordare per i prossimi deploy Pages

Finché la configurazione resta questa:

## Preview del branch corrente

```bat
npx wrangler pages deploy sito --project-name moxtracker
```

da `frontend-v1` crea un Preview.

## Produzione moxtracker.app

```bat
npx wrangler pages deploy sito --project-name moxtracker --branch main --commit-dirty=true
```

Controllo:

```bat
npx wrangler pages deployment list --project-name moxtracker
```

Il deployment desiderato deve apparire come:

```text
Environment: Production
Branch: main
```

---

# 19. Privacy pubblica e vista varianti — invarianti da non rompere

Restano valide tutte le regole integrate il 21/08.

Decklist osservata:

- pubblicabile solo da **30 partite della stessa variante**;
- non richiede un numero minimo di installazioni;
- `mittente` non viene mai esposto;
- sotto soglia non si espongono carte, Arena ID, nomi o quantità ricostruibili.

Percentuali pubbliche:

```text
30 partite
```

Matchup:

```text
100 partite
```

Catalogo `mox-meta` e osservazioni reali MOX restano due concetti distinti.

La pagina variante osservata resta separata dalla panoramica archetipo.

Queste regole non devono essere cambiate durante il commit/pulizia del lavoro del 22/08.

---

# 20. Documentazione aggiornata

Documenti correnti da considerare autorevoli:

```text
ACCOUNT-E-TICKET.md
S2-CHIUSURA-2026-08-22.md
MOXTRACKER-HANDOFF-2026-08-22.md
LEGGIMI.md
DOCUMENTAZIONE.md
STEP8-PRELANCIO-SITO.md
STEP7-DRAFT-DATI-ONLINE.md
```

`MOXTRACKER-HANDOFF-2026-08-21.md` resta utile come storico del lavoro precedente, ma non prevale sullo stato del 22/08.

---

# 21. Cosa è già online

Alla chiusura del 22/08 risultano pubblicati/configurati:

- API `https://api.moxtracker.app`;
- frontend `https://moxtracker.app`;
- Cloudflare D1;
- Draft D1/R2;
- Account OAuth Google/Discord;
- dashboard privata;
- collegamento Mox;
- Ticket;
- amministrazione Ticket;
- Turnstile;
- rate limiter;
- cron retention;
- bucket ticket privato;
- rank parziale;
- fix eventi con mazzo fornito;
- fix dati Thor Capstone;
- catalogo Thor Capstone;
- fallback immagini HOB;
- release endpoint per futuro autoupdate;
- download manuale GitHub ZIP;
- Release GitHub `MOX beta v2.9.12`;
- asset `Mox-Windows-beta.zip`.

---

# 22. Cosa NON va fatto nel prossimo intervento

Non:

1. fare `git reset --hard`;
2. fare pull sovrascrivendo lo stato locale;
3. cancellare i nuovi file Account/Ticket perché non presenti in `1c268e8`;
4. riportare il pulsante pubblico a `/mox/download.exe`;
5. eliminare `/mox/release` o `MOX_RELEASES`: servono all'autoupdate;
6. rilanciare alla cieca le migrazioni Thor già applicate;
7. riaprire S2 come ricerca generica di archetipi;
8. cambiare le soglie privacy 30/100;
9. pubblicare Pages pensando che il branch Git locale `frontend-v1` equivalga alla Production Pages;
10. eseguire `npm run database-vero` o altre scritture D1 solo come prova.

---

# 23. Prossima procedura consigliata: mettere ordine su GitHub

Prima di scrivere nuovo codice:

```bat
git status --short
git diff --stat
git diff --check
git branch --show-current
git rev-parse --short HEAD
npm run prove
```

Risultato test atteso:

```text
110 pass
0 fail
```

Poi riesaminare almeno questi gruppi separatamente:

## A. S2 / Rank / Archetipi

```text
src/controlli.js
src/archetipi.js
src/catalogo-archetipi-generato.js
strumenti/genera_catalogo_archetipi.py
schema.sql
migrazioni/2026-08-22-rank-stato.sql
migrazioni/2026-08-22-correggi-impronta-thor-capstone.sql
migrazioni/2026-08-22-correggi-altre-impronte-thor-capstone.sql
prove/controlli.test.js
prove/archetipi.test.js
prove/server.test.js
S2-CHIUSURA-2026-08-22.md
```

## B. Account / Ticket

```text
src/account.js
src/ticket.js
src/draft.js
src/index.js
schema.sql
wrangler.toml
migrazioni/2026-08-22-account-ticket.sql
migrazioni/2026-08-22-account-mazzo-nome.sql
sito/account.html
sito/admin.html
sito/supporto.html
sito/css/account-support.css
sito/js/account.js
sito/js/admin.js
sito/js/supporto.js
sito/privacy.html
prove/account-ticket.test.js
prove/account-ticket-frontend.test.js
ACCOUNT-E-TICKET.md
```

## C. Immagini HOB

```text
src/archetipi.js
src/catalogo-archetipi-generato.js
strumenti/genera_catalogo_archetipi.py
sito/js/card-images.js
sito/css/card-images.css
prove/card-images.test.js
prove/archetipi.test.js
```

## D. Release / download sito

```text
src/index.js
wrangler.toml
sito/index.html
sito/js/config.js
sito/js/main.js
prove/prelancio-sito.test.js
```

Dopo il riesame, fare uno o più commit coerenti oppure un commit unico di chiusura giornata, ma **non lasciare fuori file che fanno parte dello stesso schema/API/frontend**.

---

# 24. Commit suggerito

Se dopo il riesame `npm run prove` resta 110/110 e il diff è coerente, un messaggio possibile è:

```text
Completa account, ticket e correzioni MOX del 22 agosto
```

Descrizione sintetica:

```text
- chiude S2 sugli eventi con mazzo fornito
- conserva rank parziali
- stabilizza Thor Capstone e catalogo
- migliora fallback immagini HOB
- aggiunge account OAuth e dashboard privata
- aggiunge ticket, allegati, amministrazione e retention
- prepara il canale autoupdate firmato
- ripristina il download manuale tramite GitHub Releases
- aggiorna documentazione e regressioni
```

Prima del push:

```bat
npm run prove
git diff --check
git status --short
```

Poi commit/push soltanto dopo aver verificato che nessuna modifica locale autorizzata sia rimasta esclusa.

---

# 25. Stato finale sintetico

Alla fine del 22/08/2026:

```text
Branch locale: frontend-v1
HEAD base: 1c268e8
Working tree: modificata, da committare
Test: 110/110
API: online
D1/R2: online
Account/Ticket: online
S2: chiusa
Thor Capstone: corretto e riconosciuto
Rank parziale: pubblicato
moxtracker.app: Production aggiornata
Pages: Direct Upload
Production branch Pages: main
Release GitHub: MOX beta v2.9.12 — Latest
Asset download manuale: Mox-Windows-beta.zip
Autoupdate: separato via /mox/release + /mox/download.exe
```

La priorità immediata non è aggiungere nuove funzioni:

> **prima consolidare su GitHub lo stato locale del 22/08 senza perdere o sovrascrivere le modifiche già pubblicate.**
