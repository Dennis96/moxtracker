# Stato corrente — sito Mox

Aggiornato il 14 settembre 2026: `moxtracker.app` pubblica il frontend stabile
pre-redesign (`f897a943`, build `61a708af281eea70`, sezione sotto); il redesign
non è in produzione. Stato verificato il 10 settembre 2026: la preview
funzionale pubblicata era `cf2f45e`, build Pages `61a708af281eea70`; il fix logout è confermato
manualmente e i collaudi R0 7–13 sono conclusi. `origin/main` prima di questo
housekeeping è `39dc8a6`, commit esclusivamente documentale: dopo la preview non
è avvenuto alcun nuovo deploy Pages, Worker o sito.

La GitHub Release Latest del client è `mox-v2-beta2.10.0`, non prerelease, con
il solo asset `Mox-v2-beta2.10.0-con-python.zip`. Questa distribuzione del
client non modifica il codice attualmente pubblicato su Pages o Worker.

## Regola operativa obbligatoria

Dopo ogni modifica conclusa e **dopo ogni deploy preview riuscito**, aggiornare
subito questo file, nella stessa sessione di lavoro. Registrare commit, URL,
modifiche effettivamente pubblicate, test eseguiti e ciò che **non** è stato
modificato. La chat successiva legge questo file prima di proporre o eseguire
nuovo lavoro. Non creare handoff alternativi: questo è l'unico stato operativo
del sito.

## Produzione Pages del 14 settembre 2026 — frontend stabile pre-redesign

- `moxtracker.app` → frontend **pre-redesign**, commit sorgente
  `f897a9431cc2d9eaede62a7fdbcbb4a9870282bb` (stesso contenuto `sito/` e `src/`
  di `cf2f45e`), build `61a708af281eea70`, 63 file.
- Pubblicato con il gate canonico `npm run sito:release`:
  - preview dello stesso commit: deployment `62141e1b`
    (<https://62141e1b.moxtracker.pages.dev>), record
    `preview-f897a9431cc2-62141e1b.json`, smoke 6/6 HTTP 200;
  - produzione: deployment `c30921d1` (<https://c30921d1.moxtracker.pages.dev>),
    record `production-f897a9431cc2-c30921d1.json`, conferma
    `PUBBLICA-SITO-PRODUZIONE`, prove visive desktop `84019c1d…` e mobile
    `88dfd878…` (screenshot della preview stabile), smoke 6/6 HTTP 200.
    Prove del gate 191/191.
- Verifiche su `moxtracker.app`: build e commit serviti corrispondenti; Home,
  Draft, Account, Supporto, Privacy, Download, Cosa invia Mox, Note di versione
  e pagine EN HTTP 200; Meta attuale nella Home; nessun errore JS.
  `smoke_beta.mjs --site https://moxtracker.app`: tutto OK tranne CORS Account
  HTTP 403, limite preesistente: il Worker autorizza come origine con
  credenziali soltanto `preview.moxtracker.pages.dev` (`SITE_ORIGIN`), quindi
  il login Account da `moxtracker.app` non funziona. Worker non modificato per
  aggirarlo.
- Per pochi minuti la preview è tornata alla stessa build pre-redesign, come
  prevede la procedura; il redesign vi torna nella fase successiva.
- Il redesign **non** è pubblicato su `moxtracker.app`. Nessun deploy Worker,
  nessuna modifica D1/schema/migrazioni, Research o R3.

## Preview del 31 agosto 2026 (superata)

- Data: 31 agosto 2026.
- Commit sito: `5fa3d34` — RC locale con Account/Draft, M6 e readiness R0.
- URL alias: <https://preview.moxtracker.pages.dev>.
- URL immutabile: <https://ad60ff7a.moxtracker.pages.dev>.
- Build: `bb55e75aba7f7718`, 63 file.
- Perimetro pubblicato: i sei commit `fb6cb3e..5fa3d34`, ora anche su
  `origin/main`; nessun
  deploy Worker, D1, produzione, R3, ingestion Research o packet v3.
- Verifiche prima del deploy: `npm run prove` — 190/190; `npm run sito:build`
  riuscito; route locali previste HTTP 200.
- Smoke post-deploy sull'alias: HTTP 200 per `/`, `/draft`, `/account`,
  `/supporto`, `/privacy`, `/en/`, API salute/Meta/Draft e GitHub Latest;
  Account HTTP 401 e CORS HTTP 204 attesi.
- Verifica browser locale: Home, Download, Meta, Draft, Account, Supporto,
  Privacy e IT/EN senza overflow desktop, 375 px o 640 px; menu mobile apre e
  chiude con Escape restituendo il focus visibile al pulsante. La regola CSS
  `prefers-reduced-motion` è presente; la preferenza OS reale non era attiva.
- L'URL immutabile serve correttamente il frontend ma riceve CORS HTTP 403 da
  `api.moxtracker.app`: è atteso perché `SITE_ORIGIN` autorizza l'alias
  `preview.moxtracker.pages.dev`, non ogni deployment URL. Non è stato
  modificato il Worker per aggirarlo.

## Modifiche presenti in preview

- Carte: miniature orizzontali in elenco; anteprima carta completa solo su
  hover, focus tastiera o tap.
- Dettaglio variante: curva mana a barre, colori come simboli mana, tipi e
  terre speciali/fixing.
- Download: il pulsante interroga la release GitHub **Latest** al clic e segue
  direttamente il suo asset `.zip`; non fissa una versione e non usa
  l'installer dell'autoupdate. La CSP consente la sola chiamata a
  `https://api.github.com` necessaria a risolverlo.
- Home e Download: il messaggio parte da tracker, Draft e statistiche locali;
  la contribuzione anonima è secondaria e revocabile. La pagina Download
  mostra anche la release Latest già risolta, senza fissare una versione.
- Research: copy e layout di un teaser sono pronti ma nascosti. R1 e R2 sono
  chiusi, ma R3 non è aperto: nessuna promessa o funzione Research è
  pubblicata. Il campo `apertura` non è stato rinominato né reinterpretato.
- Carte: in assenza di `IntersectionObserver`, ad esempio in un browser
  embedded, il fallback avvia le richieste solo vicino alla viewport e le
  distanzia a massimo circa nove al secondo.
- Account: rimosso il comando `Esporta .txt`; resta `Copia per Arena`.
- Account → Draft: le tracce e gli storici Limited sono ordinati per la data
  reale della fonte. Una partita con `draft_link` compare solo nella traccia
  esatta; i log senza link sono dichiarati come raggruppamento cronologico,
  non come risultato di un singolo Draft. Il pool finale aggrega le copie per
  Arena ID senza alterare i Draft salvati.
- Collaudi manuali R0 7–13: tutti PASS il 02/09/2026. Ticket anonimo e
  Turnstile, risposta e stato amministratore, i due record `ticket_audit`,
  riapertura dal link segreto, revoca, export isolato e cancellazione sono
  stati verificati sul campo. Per la revoca, l'invio Mox può proseguire come
  contributo anonimo/non associato: il controllo è che non ricompaia
  nell'account revocato. Dettaglio nella checklist corrente.
- Logout Account: rilevato che `Esci` lasciava la dashboard visibile fino a
  F5. Corretto il nome della funzione che elimina la sessione preview;
  regressione automatica aggiunta e PASS manuale sulla preview `cf2f45e`:
  dopo `Esci` ritorno immediato al login Account, senza F5.

## M6 pubblicato; R3-PREP solo documentazione

La preview Pages corrente è `cf2f45e` (build `61a708af281eea70`), pubblicata
sull'alias `preview.moxtracker.pages.dev`. `origin/main` ha ricevuto sopra quel
codice il solo commit documentale `39dc8a6`; la build pubblicata resta quindi
quella di `cf2f45e`. Non è stato eseguito alcun nuovo deploy Pages, Worker o di
produzione.

- **M6 verificato localmente:** Account mostra «Ultima mano osservata» /
  «Last observed hand», conteggio delle carte e nota esplicita che il dato
  legacy non è la mano d'apertura. Campo assente: nessuna sezione inventata.
- Descrizione cronologia, Privacy e Cosa invia Mox aggiornate in IT/EN;
  documentazione API chiarita. `apertura` conserva nome tecnico e contenuto,
  anche negli export. Cambia soltanto il testo dell'errore di validazione:
  «campo legacy apertura non valido»; versioni e limiti invariati.
- **R3-PREP consegnato come proposta:**
  [schema logico e opzioni di storage](passaggi/research/proposte/R3-PREP-SCHEMA-STORAGE.md), senza SQL
  eseguibile. D1/Cloudflare R2 ed eventuale payload privato restano scelte
  aperte fino all'output reale R2 e al golden packet concordato. L'arrivo
  degli artefatti non autorizza automaticamente ingestion o rilascio.
- Verifiche: `npm run prove` **189/189**, `npm run sito:build` riuscito,
  build locale **`433a5bbaedee7770`**, 63 file. Confronto del validatore con
  HEAD su **36 casi**: stesso esito salvo il testo legacy, stessi input e
  righe serializzate. Worker con SQLite solo in memoria: v1/v2 HTTP 200,
  v3 HTTP 400; apertura non valida HTTP 400 col messaggio corretto e nessun
  record inserito. Nessuna esecuzione su D1 locale o remoto.
- Browser locale, dati sintetici: Account IT/EN con `apertura` presente
  (2 copie + 1 copia, titolo con totale 3) e assente; carte e nota corrette,
  assenza senza mano vuota. Verifica visiva desktop e testo Privacy EN.
  Il banco temporaneo `.dist/m6-collaudo.mjs` è ignorato da Git e fuori
  dalla build del sito; non è un output Research o una fixture R2.
- I quattro WIP Account/Draft sono stati revisionati e raccolti nel commit
  `e2689a5`: nessun reset o stash. Client, contratto R1, dati storici, schemi,
  configurazione cloud e consensi non modificati. Nessuna ingestion v3.

## Cronologia delle modifiche di questa sessione

- `595d5b2` — nuovo profilo del mazzo (curva e simboli mana), download ZIP
  dinamico e riordino della documentazione attiva/storica.
- `4e7549e` — corretto un errore del renderer che lasciava il profilo bloccato
  su “Calcolo curva…”.
- `f705ff3` — aggiunta `https://api.github.com` alla CSP: senza questa origine
  autorizzata il pulsante Download non poteva risolvere lo ZIP Latest.
- `02db6c9` — aggiunto questo file di stato e la regola di aggiornarlo dopo
  ogni preview.
- `99326d3` — rimossi `QUESTIONARIO-SITO-MOX.html`,
  `COLLEGA-CLOUDFLARE.bat` e il file locale ignorato
  `mazzo-419fdf15.json`; nessuno dei tre era usato dal sito.
- `149675b` — Home/Download orientati al valore personale, pagina Download
  IT/EN, traduzioni Supporto dinamiche, fallback immagini in viewport e
  checklist manuali riconciliate. Preview `f26f82de` verificata.
- `5ad5b38` — corretto Account → Draft e pubblicata la preview `73002141`.
  Verifiche: `npm run prove` 189/189, build di 63 file e smoke HTTP 200 su
  `/`, `/draft`, `/account`, `/supporto`, `/privacy`, `/en/`.
- `e2689a5` — esclusi dall'Account gli indici Draft difettosi con `0 pick`,
  senza nascondere le partite storiche collegate.
- `3e8451a` — chiarito il campo legacy `apertura` come ultima mano osservata,
  senza modificare il contratto v1/v2.
- `6414c57` — corrette route di anteprima, link amministratore inglese e
  smoke del download GitHub Latest; report R0 aggiunto.
- `5fa3d34` — pubblicata una sola preview Pages della RC `5fa3d34`, build
  `bb55e75aba7f7718`, URL immutabile `ad60ff7a`; nessun Worker, D1,
  produzione o Research è stato modificato o distribuito. Smoke sull'alias
  completamente verde e verifica browser locale completata; il CORS dall'URL
  immutabile resta fuori dal perimetro autorizzato del Worker.
- Push fast-forward: `origin/main` avanzato da `5ad5b38` a `5fa3d34`; GitHub
  verificato sullo stesso SHA. Nessun altro commit o deploy incluso.
- Locale, non pubblicato — un indice Draft con `0 pick` e' difettoso anche se
  una vecchia fonte lo marca come completo: viene escluso dal frontend e dalle
  risposte Account. L'eventuale partita collegata resta nello storico senza
  traccia, per non nascondere dati reali. Verifiche: `npm run prove` 189/189 e
  `npm run sito:build` (build `5f8c9def5df0aa09`, 63 file).

## Confini non modificati

- Nessun deploy produzione.
- Nessun deploy Worker.
- Nessuna migrazione D1 e nessuna modifica ai dati di produzione.

## Prossimo lavoro

1. Completare i collaudi manuali R0 1–6 (browser desktop, telefono, reduced
   motion e download GitHub Latest).
2. R3-PREP resta una proposta: attendere modello locale R2, golden packet
   concordato e dimensioni reali prima di riesaminare schema e storage.
   Nessuna modifica D1, ingestion v3 o produzione; successivi interventi e
   rilasci richiedono decisioni separate, non il solo arrivo degli artefatti.
3. Da verificare prima di ogni intervento su `draft_link`: un match viene
   collegato solo con la stessa impronta Draft esatta. Esaminare i casi in cui
   match e traccia arrivano in ordine inverso, i pacchetti v1 o privi di
   impronta e le impronte non coincidenti. Non dedurre collegamenti da data,
   set o formato; un'eventuale riconciliazione dovra' usare soltanto
   l'impronta esatta e richiedera' autorizzazione separata per il Worker.
