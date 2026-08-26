# Passaggio alla nuova chat — audit completo del sito Mox

Data dell'audit: **26 agosto 2026**
Repository: `C:\Users\santi\Documents\Progetto Magic\moxtracker`

## Testo da dare a Codex nella nuova chat

> Leggi integralmente `PASSAGGIO-NUOVA-CHAT-SITO-26-08.md` e `DECISIONI-PRODOTTO-SITO-26-08.md`, poi usa entrambi come punto di partenza. Prima di modificare il sito chiedimi l'esito del Draft reale con Mox 2.9.23: è il cancello deciso per il lavoro sul sito. Se il Draft è andato bene, prepara prima un piano e affronta nell'ordine i rilievi bloccanti descritti qui. Non pubblicare, non migrare dati e non eseguire prove distruttive sugli account senza una mia autorizzazione esplicita.

## Verdetto

Il sito è online e le pagine principali funzionano sia su desktop sia su mobile. API, database e bucket sono coerenti e la suite automatica passa **142/142**. Non è però ancora pronto per il lancio pubblico.

Principio di prodotto confermato il 26/08/2026: la raccolta di partite e Draft serve innanzitutto a migliorare Mox, con particolare attenzione alla qualità dei consigli Draft e del deck builder. Le statistiche pubbliche sono una rappresentazione aggregata e trasparente di quei dati, non lo scopo primario della raccolta.

I blocchi reali sono:

1. manca il Draft reale dell'utente con Mox 2.9.23, che resta il cancello concordato;
2. una vecchia traccia Draft difettosa è ancora inclusa nelle statistiche pubbliche, benché esista il nuovo campo `sospetto`;
3. la rinomina dei mazzi dall'account è bloccata dal CORS del Worker perché `PUT` non è fra i metodi permessi;
4. restano prove reali non distruttive e distruttive su account e ticket;
5. la pubblicazione Pages non è riproducibile né collegata in modo affidabile al commit effettivamente online;
6. la strategia manuale dei suffissi `?v=` non copre tutti gli asset e può riprodurre cache miste.

Decisioni di prodotto successive all'audit: beta iniziale aperta; notifiche email solo con consenso esplicito; diagnostica normale in JSON anonimizzato e Player.log soltanto con consenso separato/canale privato.

## Cancello prima di iniziare

La 2.9.23 è già stata pubblicata prima del Draft reale per decisione esplicita dell'utente. **Cancello superato il 26/08/2026:** l'utente ha confermato che il Draft reale 2.9.23 ha funzionato perfettamente. Il lavoro sul sito può iniziare.

Il riscontro richiesto era che il Draft:

- riconosciuto subito set e formato;
- azzerato correttamente lo stato del Draft precedente;
- mostrato dati 17lands e consigli durante tutti i pick;
- costruito un mazzo finale credibile, comprese terre speciali e doppie;
- continuato a funzionare dopo chiusura e riapertura di Mox/Arena.

Se il Draft fosse fallito, si sarebbe dovuti tornare prima sul client. Non esiste un flag per aggirare questo cancello.

## Metodo e limiti dell'audit

Sono stati controllati:

- tutto il codice Worker e frontend;
- schema, tabelle, viste, indici e conteggi dei due D1 di produzione;
- inventario e politiche dei tre bucket R2;
- binding e configurazione Cloudflare;
- route pubbliche e private senza effettuare scritture;
- tutte le pagine su desktop e mobile tramite browser reale;
- suite automatica, dipendenze e compilazione Worker a secco;
- rami Git locali e remoti e stato delle pubblicazioni.

Non sono stati aperti i contenuti privati delle tracce Draft R2, degli allegati o dei dati personali. Non sono state eseguite migrazioni, pubblicazioni, cancellazioni, risposte ai ticket o modifiche agli account.

## Stato Git e pubblicazioni

### Repository del sito

- ramo corrente: `codex/draft-recupero-2920`;
- HEAD locale al momento dell'audit: `e121c92`;
- il ramo locale è avanti di due commit documentali rispetto a `origin/codex/draft-recupero-2920` (`b5011f1`);
- `frontend-v1` locale e remoto non coincidono;
- `master` è molto indietro rispetto al codice pubblicato;
- `s1-s2-privacy-archetypes` è sincronizzato;
- la working tree era pulita prima di aggiungere questo passaggio.

Non iniziare nuovo lavoro da `master`. Prima va scelto e consolidato un ramo sorgente unico che rappresenti ciò che è davvero online.

### Worker di produzione

- dominio: `https://api.moxtracker.app`;
- ultimo deployment di codice rilevato: `face6463-912c-452e-a1c3-29aa8bf44e96`, 26/08/2026 07:13 UTC;
- due versioni immediatamente successive sono modifiche ai secret, non nuovo codice;
- la compilazione locale `wrangler deploy --dry-run` riesce;
- bundle: circa 1,53 MB, gzip circa 420 kB. Il catalogo generato pesa circa 1,28 MB: non è un blocco, ma va monitorato.

### Pages di produzione

- progetto: `moxtracker`;
- domini: `moxtracker.app` e `moxtracker.pages.dev`;
- modalità: Direct Upload, senza provider Git;
- il pannello attribuisce l'ultimo deployment al commit `74fe3de`, ma i file online contengono modifiche successive.

Questa provenienza è inaffidabile: il sito online funziona, ma dal pannello non si può ricostruire con certezza quale commit e quale cartella siano stati pubblicati.

## Architettura

### Worker

| File | Responsabilità |
|---|---|
| `src/index.js` | router principale, ingestione partite, letture pubbliche, release/autoupdate, cron |
| `src/controlli.js` | validazione e normalizzazione dei payload partita |
| `src/draft.js` | ingestione Draft, D1/R2, recupero inverso, collegamento account, cancellazione, statistiche |
| `src/account.js` | OAuth Google/Discord, sessioni, dispositivi, dashboard, mazzi Arena, export e cancellazione |
| `src/ticket.js` | ticket, allegati privati, amministrazione, audit e retention |
| `src/lettura.js` | meta, play/draw e matrice degli scontri |
| `src/archetipi.js` | classificazione archetipi |
| `src/dettaglio-archetipo.js` | dettaglio, varianti e soglie privacy degli archetipi |
| `src/privacy-pubblica.js` | soglie per mostrare decklist osservate |
| `src/catalogo-carte-generato.js` | catalogo Arena generato, usato per nomi e metadati |

### Route effettive

Pubbliche in lettura:

- `GET /salute`
- `GET /meta`
- `GET /archetipo`
- `GET /gioco-risposta`
- `GET /scontri`
- `GET /draft/statistiche`
- `GET /mox/release`
- `GET /mox/download.exe`

Ingestione e cancellazione contributi:

- `POST /partite`
- `POST /draft`
- `POST /draft/recupera`
- `POST /contributi/elimina`

Account e collegamento Mox:

- `GET /auth/google`, `GET /auth/discord` e relativi callback;
- `POST /mox/account/link`;
- `POST /mox/account/decks`;
- `GET /account/me`;
- `GET /account/dashboard`;
- `GET /account/stats`;
- `GET /account/matches` e `GET /account/matches/:id`;
- `GET /account/drafts/:id`;
- `GET /account/export`;
- `PUT /account/decks/:fingerprint/name`;
- `POST /account/link-code`;
- `POST /account/logout`;
- `POST /account/delete`;
- `DELETE /account/devices/:sender`.

Ticket e amministrazione:

- `GET /ticket/config`;
- `POST /ticket`;
- `GET /ticket/:id`;
- `POST /ticket/:id/messages`;
- `POST /ticket/:id/attachments`;
- `GET /ticket/:id/attachments/:attachment`;
- `GET /account/tickets`;
- `GET /admin/tickets`;
- `GET /admin/ticket/:id`;
- `POST /admin/ticket/:id`.

Cron giornaliero: `17 3 * * *`, per credenziali scadute e retention dei ticket.

### Pagine

| Pagina | Stato verificato |
|---|---|
| `/` | meta Standard renderizzato, filtri e blocco matrice coerenti |
| `/draft` | 93 decisioni e 9 fasi renderizzate; dati però contaminati dal rilievo Draft sotto |
| `/archetipo?formato=Standard&id=aure-mono-bianco` | dettaglio e 5 varianti funzionanti |
| `/account` | sessione reale, dashboard, mazzi, partite, Draft, dispositivo e ticket caricati |
| `/supporto` | form e Turnstile caricati correttamente |
| `/admin` | coda autorizzata caricata; nessuna azione eseguita |
| `/privacy` | pagina leggibile e responsive |

Sono stati aperti in sola lettura anche il dettaglio di un mazzo, di una partita e di un Draft. Nessun errore console e nessun overflow orizzontale a 1440×900 e 390×844. Le immagini Scryfall effettivamente valorizzate risultano caricate.

Frontend rilevante:

- `sito/js/main.js`: pagina meta;
- `sito/js/draft.js`: statistiche Draft;
- `sito/js/archetype.js`: dettaglio archetipo;
- `sito/js/account.js`: dashboard e azioni account;
- `sito/js/supporto.js`: ticket e Turnstile;
- `sito/js/admin.js`: coda supporto;
- `sito/js/api.js`, `config.js`, `render.js`, `card-images.js`, `meta-model.js`, `privacy.js`: servizi condivisi.

## Database di produzione

### D1 principale `moxtracker`

Binding `DB`, ID `85145457-e78e-41bb-b069-41269321db1c`.

Tabelle applicative controllate:

- telemetria: `partite`, `carte_mazzo`, `carte_avversario`, `contributori`;
- account: `account`, `account_identita`, `account_sessione`, `account_oauth_stato`, `account_codice_mox`, `account_dispositivo`, `account_mazzo_nome`, `account_mazzo`;
- supporto: `ticket`, `ticket_messaggio`, `ticket_allegato`, `ticket_audit`.

Conteggi al 26/08/2026:

| Dato | Conteggio |
|---|---:|
| Partite | 144 |
| Carte nei mazzi | 2.699 |
| Carte avversarie viste | 1.388 |
| Mittenti contributori | 4 |
| Account | 3 |
| Identità OAuth | 4: 3 Google, 1 Discord |
| Sessioni attive | 6 |
| Dispositivi collegati | 2 |
| Mazzi Arena correnti | 5 |
| Nomi personalizzati | 0 |
| Ticket | 1, stato `ricevuto` |
| Messaggi ticket | 1 |
| Allegati ticket | 1 |
| Righe audit | 0 |

Dettagli utili:

- 16 partite protocollo v1 e 128 v2;
- 125 rank completi e 19 dedotti;
- 69 partite Standard;
- 75 senza formato normalizzato: 53 Limited/Draft e 22 precostruite;
- 4 mittenti partita, 2 collegati ad account;
- 104 partite visibili negli account;
- nessuna credenziale scaduta ancora presente.

Tutti i controlli aggregati di integrità hanno restituito zero: nessuna carta orfana, identità/sessione/dispositivo/mazzo senza account, messaggio/allegato/audit senza ticket. Dimensione D1 circa 696 kB.

### D1 Draft `moxtracker-draft-index`

Binding `DRAFT_DB`, ID `1cbe16b6-b776-4ba7-ba7c-72522535e712`.

Tabelle e vista:

- `draft`;
- `draft_pick`;
- `draft_mazzo`;
- `draft_link`;
- `contributori`;
- vista `draft_aggregati`.

Conteggi:

| Dato | Conteggio |
|---|---:|
| Draft | 11 |
| Draft completi | 9 |
| Draft incompleti | 2 |
| Premier | 4, di cui 2 completi |
| Quick | 4, tutti completi |
| PickTwo | 3, tutti completi |
| Pick registrati | 93 |
| Snapshot mazzo giocato | 4 |
| Collegamenti account | 1 |
| Mittenti | 4 |

Nessun orfano, duplicato di collegamento o incoerenza referenziale. Dimensione D1 circa 102 kB.

## Bucket R2

| Binding | Bucket | Stato |
|---|---|---|
| `DRAFT_RAW` | `moxtracker-draft-raw` | 11 oggetti, circa 137 kB; retention 730 giorni |
| `TICKET_FILES` | `moxtracker-ticket-files` | 1 oggetto, circa 75 kB; retention applicata dal cron Worker |
| `MOX_RELEASES` | `moxtracker-releases` | 1 oggetto, circa 55,5 MB |

Le 11 chiavi Draft in R2 coincidono numericamente con le 11 righe D1. Il contenuto privato non è stato aperto.

## Configurazione Cloudflare

- rate limiter `TICKET_RATE_LIMITER`, namespace 29011, 10 richieste ogni 60 secondi;
- `SITE_ORIGIN=https://moxtracker.app`;
- Turnstile configurato;
- route Worker su `api.moxtracker.app`;
- osservabilità attiva;
- recupero updater con ritardo 1.500 ms;
- gli header CSP sono coerenti con Turnstile e Scryfall.

## Rilievi da risolvere

### P1 — Le statistiche Draft includono ancora una traccia già nota come guasta

Produzione contiene una traccia completa Premier della 2.9.22 con soli 9 pick. È il caso difettoso descritto nei documenti precedenti, ma `draft.sospetto` è `NULL` per tutte le 11 righe. `/draft/statistiche` restituisce quindi quei 9 pick e dichiara `tracce_marcate: 0`.

Cause:

1. la migrazione `2026-08-25-draft-sospetto.sql` aggiunge colonna e indice ma non riclassifica le tracce già presenti;
2. `sospettoDraft()` controlla `pool > scelte` soltanto quando entrambe le quantità sono truthy; un Draft completo con pool non vuoto e zero pick non viene marcato;
3. il controllo dei pacchetti parte soltanto se `pacchetti.length` è già maggiore di zero.

In produzione ci sono anche sei Draft completi con zero pick. Non aumentano il conteggio dei pick, ma possono influenzare altri aggregati e non sono campioni validi per misurare la politica.

Correzione consigliata:

- rendere esplicita la regola per `completo && pool > scelte`, compreso `scelte === 0`;
- aggiungere test per traccia completa con pool e zero pick, e per traccia parziale legittima;
- scrivere uno script amministrativo una tantum che legga le 11 tracce private da R2, ricalcoli `sospettoDraft()` e aggiorni soltanto la colonna D1;
- non inferire alla cieca il flag dalla sola quantità D1: il payload R2 contiene il contesto necessario;
- rieseguire `/draft/statistiche` e verificare che almeno la traccia da 9 pick sia esclusa e che `tracce_marcate` sia coerente.

`tracce_marcate` è un indicatore tecnico di qualità del client: non mostrarlo nella pagina pubblica. Può stare in diagnostica o amministrazione.

### P1 — La rinomina dei mazzi è bloccata dal CORS

Il frontend usa:

`PUT /account/decks/:fingerprint/name`

Il preflight reale risponde 204, ma `Access-Control-Allow-Methods` contiene soltanto:

`GET, POST, DELETE, OPTIONS`

Manca `PUT`, quindi il browser blocca la richiesta prima che arrivi alla route. Il difetto è in `headersPrivati()` di `src/account.js`. I test backend diretti non lo vedono.

Correzione e prova obbligatoria:

- aggiungere `PUT` ai metodi consentiti;
- aggiungere un test OPTIONS che richieda davvero `PUT` con origine `https://moxtracker.app`;
- provare dal browser la rinomina e il ripristino del nome su un mazzo di prova.

### P1 — La pubblicazione Pages non è riproducibile

Pages è in Direct Upload e mostra `74fe3de` come sorgente, mentre i file online sono più recenti. In parallelo, `master` non rappresenta la produzione e più rami divergono.

Serve un solo flusso:

1. consolidare il ramo che contiene il codice pubblicato;
2. definire il ramo principale reale;
3. creare uno script di deploy che rifiuti working tree sporca e sorgente non corrispondente;
4. registrare commit SHA, hash dei file e deployment ID;
5. verificare dopo il deploy almeno home, Draft, account, supporto e download.

### P2 — Versionamento cache incompleto

La regola documentata dice di cambiare `?v=` per ogni JS/CSS modificato, ma molti riferimenti sono senza versione: fra gli altri `ui-fixes.css`, `card-images.css`, `draft.css`, `draft.js`, `step53.css`, `archetype.js`, `privacy.js` e quasi tutti gli import interni dei moduli ES.

Gli asset statici sono memorizzabili per quattro ore. Il sito attuale funziona, ma un deploy può mescolare HTML nuovo e moduli vecchi.

Soluzione consigliata: manifest generato con hash del contenuto oppure una singola versione di build applicata automaticamente a tutti gli asset. Evitare aggiornamenti manuali sparsi.

### P2 — Schema Draft non perfettamente riproducibile

L'indice `draft_sospetto` esiste in produzione e nella migrazione, ma non nello schema completo `schema-draft.sql`. Un database creato da zero non replica esattamente produzione.

Allineare lo schema completo e aggiungere un test che confronti gli oggetti attesi dopo bootstrap e dopo migrazioni.

### P2 — Documentazione contraddittoria

- `LEGGIMI.md` e `DOCUMENTAZIONE.md` contengono conteggi test e stati più vecchi nelle sezioni iniziali;
- `C:\Users\santi\Documents\Progetto Magic\LEGGIMI-PROGETTO-MAGIC.txt` cita ancora Mox 2.9.13 fra i prossimi lavori;
- `Codice\LAVORI.md` descrive la 2.9.23 come non pubblicata, mentre `MOX-2.9.23-STATO.md` e la release la dichiarano pubblicata.

Normalizzare i documenti dopo aver fissato il ramo sorgente. Lo stato verificato e le API devono essere la fonte primaria, non vecchi riepiloghi copiati.

## API pubbliche: fotografia attuale

- `/salute`: 200, protocolli partite `[1,2]`, Draft `[1]`;
- `/meta?formato=Standard`: 69 partite; Mono White Auras 50 partite, 58% win rate e 72,46% quota; gli altri archetipi restano sotto soglia;
- `/scontri?formato=Standard`: correttamente non disponibile, soglia 100 coppie;
- `/gioco-risposta?formato=Standard`: 29 on the play, quindi nascosto sotto soglia; 40 on the draw, 52,5%;
- `/draft/statistiche`: 93 pick, 3 versioni di politica, 1 risultato collegato, 4 snapshot mazzo, ma contiene la traccia sospetta;
- stable e canary con client 2.9.23: nessun aggiornamento disponibile;
- asset download stabile raggiungibile e scaricabile; risposta GitHub circa 109,4 MB.

Le letture pubbliche consentono CORS `*`. Le route private accettano soltanto l'origine del sito e usano cookie/sessione con risposta `no-store`.

## Prove reali account e ticket ancora aperte

La suite non sostituisce queste prove sul campo:

1. rifiuto di un allegato ZIP;
2. ticket anonimo dopo la correzione CSP di Turnstile;
3. cambio stato e risposta amministratore con riga in `ticket_audit`;
4. revoca del dispositivo e verifica che Mox non possa più sincronizzare;
5. export JSON dopo la revoca;
6. cancellazione completa, esclusivamente sull'account di prova e per ultima;
7. prima esecuzione reale del cron/retention, se non ancora verificata dalla console.

La cancellazione è distruttiva: non eseguirla mai sull'account principale. Richiedere autorizzazione esplicita anche per azioni di amministrazione o per modificare ticket reali.

## Decisioni di prodotto già prese

- il sito va completato prima del lancio pubblico;
- nell'account si mostrano i mazzi correnti realmente presenti in Arena, non la collezione;
- la sincronizzazione dei mazzi richiede consenso separato ed esplicito, come il Draft;
- la matrice degli scontri compare soltanto quando il campione raggiunge la soglia dichiarata;
- `tracce_marcate` non è un dato pubblico utile;
- i log grezzi, le tracce R2 e i dati personali restano privati;
- la divergenza P1P1 Montagna/Dori nel Draft non ha ancora una spiegazione dimostrata; l'ipotesi “campione troppo piccolo” è stata misurata e scartata;
- non riaprire queste decisioni senza nuovi dati o una richiesta esplicita dell'utente.

## Piano consigliato per la nuova chat

1. Ottenere dall'utente il risultato del Draft reale 2.9.23.
2. Se positivo, fissare il ramo sorgente e lo stato pubblicato prima di scrivere altro codice.
3. Correggere CORS `PUT` e aggiungere il test di preflight browser-realistic.
4. Correggere `sospettoDraft()`, aggiungere regressioni e preparare il ricalcolo R2→D1; mostrare il piano dati prima di applicarlo.
5. Allineare `schema-draft.sql`.
6. Eseguire suite completa, audit dipendenze, dry-run Worker e smoke test browser desktop/mobile.
7. Rendere deterministico il deploy Pages e il versionamento degli asset.
8. Completare le prove reali account/ticket non distruttive; tenere revoca/export/cancellazione nell'ordine documentato.
9. Solo a questo punto iniziare nuove funzioni e rifiniture del sito.
10. Prima di ogni pubblicazione: schermate, review completa, autorizzazione dell'utente e verifica post-deploy.

## Comandi di controllo

Da `C:\Users\santi\Documents\Progetto Magic\moxtracker`:

```powershell
npm run prove
npm audit --omit=dev
npx wrangler deploy --dry-run
git status --short
git branch -vv
```

Per avviare il sito locale usare il comando documentato dal repository e controllare almeno le sette pagine sopra. Per produzione preferire query D1 aggregate e inventari R2; non stampare righe private o contenuti grezzi nella chat.

## Criteri per considerare il sito pronto

- Draft reale 2.9.23 superato;
- 142 test attuali più le nuove regressioni tutti verdi;
- traccia difettosa esclusa dalle statistiche dopo ricalcolo verificato;
- rinomina mazzo riuscita in un browser reale;
- schema nuovo e database migrato equivalenti;
- Pages pubblicato da commit identificabile e working tree pulita;
- nessuna cache mista dopo deploy;
- prove account/ticket residue concluse, con cancellazione solo sull'account di prova;
- smoke test desktop/mobile senza errori console;
- nessuna pubblicazione o migrazione eseguita senza approvazione esplicita.
