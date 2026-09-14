# Stato corrente — sito Mox

Aggiornato il 14 settembre 2026: `moxtracker.app` pubblica il frontend stabile
pre-redesign (`f897a943`, build `61a708af281eea70`); `main` integra redesign e
policy Brew/privacy; la preview pubblica il redesign e `api.moxtracker.app` usa
il Worker nuovo con la policy Brew/privacy attiva (sezioni sotto). Fino al 13 settembre la preview
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

## Preview del 14 settembre 2026 dal `main` integrato — redesign

- `preview.moxtracker.pages.dev` → redesign, commit sorgente `main`
  `1c3f09cf94c4b46b0a798aa4d94b43eb854150c5` (merge), build
  `4ee3d62ce501aba7`, 91 file.
- Pubblicata con il gate canonico `npm run sito:release -- --environment=preview
  --deploy`: deployment `ae78372e` (<https://ae78372e.moxtracker.pages.dev>),
  record `preview-1c3f09cf94c4-ae78372e.json`, prove del gate 228/228, smoke
  del gate 6/6 HTTP 200.
- `smoke_beta.mjs --site https://preview.moxtracker.pages.dev`: 14/14 OK
  (pagine IT/EN, Meta, API salute/Meta/Draft, gate Account 401, CORS Account
  204, GitHub Latest).
- Browser: build e commit serviti corrispondenti; nuova Home, Meta separato,
  Draft, Account a cinque schede, pagine IT/EN HTTP 200, `/en/#meta` →
  `/en/meta`; nessun errore JS.
- Prima dell'aggiornamento del Worker il gruppo «Altro (Brew)» resta come
  prima (nessun pulsante): è atteso.

## Chiusura della fase — 14 settembre 2026

- **Account da `moxtracker.app`:** in `wrangler.toml` `SITE_ORIGIN` torna a
  `https://moxtracker.app` e `PREVIEW_ORIGIN` resta la preview (commit
  `f37cea8`). Worker ripubblicato: versione
  `3e26ca1c-4cb9-4e80-afcf-0e8228d52d94` al posto di
  `33069c30-4601-4605-8ca4-1918c5b244df` (rollback preparato, non servito).
  CORS Account 204 da `moxtracker.app` e dalla preview, 403 da un'origine
  estranea; il login da `moxtracker.app` torna a `moxtracker.app/account.html`,
  quello dalla preview alla preview. Effetto voluto: i link nelle email dei
  ticket aprono ora il sito ufficiale.
- **Smoke:** `smoke_beta.mjs` legge il `build-manifest` e salta «meta» e «meta
  inglese» sui siti che non pubblicano `meta.html`. Su `moxtracker.app` è ora
  tutto OK (quei due controlli risultano SALTATI); sulla preview 14/14.
- **Privacy Brew dopo il nuovo deploy:** verificata di nuovo sull'API reale,
  invariata (Altro senza V/S con liste sotto soglia, Brew singoli solo da 30
  partite, 404 identico per le impronte, `/gioco-risposta` senza vittorie).
- **Limite accettato dall'utente:** nel frontend pre-redesign di
  `moxtracker.app` la riga resta «Altro (Brew)» anche in inglese; si risolve
  portando il redesign sull'ufficiale.
- **Pulizia:** dopo questo commit viene rimossa la worktree di lavoro
  `claude-promozione-main-2026-09-14` (staccando prima la giunzione
  `node_modules`) insieme al branch locale già confluito
  `claude/chiusura-fase-sito-2026-09-14`. I record `.release/` della
  promozione sono copiati in
  `worktrees/claude-site-home-exploration-2026-09-13/.release/`.
- Prove 230/230. Nessuna modifica D1, schema, migrazioni, Research o R3.

## Worker del 14 settembre 2026 — policy Brew/privacy attiva

- `api.moxtracker.app`: deploy con `npm run pubblica` (`wrangler deploy`) dal
  `main` `0c638a8`. Versione precedente `59e455d0-0b05-4090-8466-5981499f0d5d`
  (10/09, 100%), nuova `33069c30-4601-4605-8ca4-1918c5b244df` (100%). Rollback
  preparato con `wrangler rollback 59e455d0-0b05-4090-8466-5981499f0d5d`: non è
  servito.
- Delta Worker rispetto a `f897a943`: solo `src/lettura.js` e
  `src/dettaglio-archetipo.js`; `wrangler.toml`, binding e variabili invariati
  (prova a vuoto); nessuna migrazione, schema, D1, Research o R3.
- Smoke privacy sull'API reale: `/meta` su 30 e 7 giorni e sul totale — Altro
  senza V/S e con win rate nullo quando ci sono liste sotto soglia
  (`record_pubblico: false`), Brew singoli solo da 30 partite, nessuna impronta
  oltre quelle dei Brew pubblici; `/archetipo` con impronte inventate: 404
  identico; `/gioco-risposta` senza vittorie né win rate. Regressioni: `/salute`
  vivo, archetipo riconosciuto 200, API Meta e Draft OK, CORS pubblico `*` da
  preview e da `moxtracker.app`, CORS Account 204 dalla preview.
- Brew reali (30 giorni, API pubblica): 3 da 30 partite in su (35, 34 e 31
  partite; dettaglio 200 con decklist pubblicabile), 6 liste sotto soglia per
  60 partite. Sui 7 giorni: 1 e 4.
- Preview (redesign + Worker nuovo): «9 liste» apre Brew #1–#3 con «Apri» e «6
  liste sotto soglia — 60 — Dati e decklist non pubblicati»; la riga Altro
  mostra «— — Non pubblicato»; nessuna impronta visibile; dettaglio Brew e
  ritorno al Meta con i filtri; mobile EN a 375 px senza overflow; smoke 14/14;
  nessun errore JS.
- `moxtracker.app` (frontend pre-redesign) con il Worker nuovo: compatibile.
  Altro mostra «160 · — · — · Dati insufficienti / Insufficient data · 51,78%»
  (è la quota, non il win rate) e nessun link Brew; Home, Meta, Draft,
  Supporto, Download e IT/EN senza errori JS. Limiti preesistenti, non causati
  dal Worker: l'Account da `moxtracker.app` è bloccato dal CORS (403,
  `SITE_ORIGIN` = preview) con errori CORS in console e il pannello di accesso
  visibile; lo smoke di `main` segna «meta inglese» su `moxtracker.app` perché
  il frontend pre-redesign non ha la pagina `/en/meta`. Tutti e due risolti
  nella chiusura della fase (sezione sopra).

### Fotografia al 14 settembre 2026

- **Main:** il commit di chiusura che contiene la sezione «Chiusura della
  fase», sopra `f37cea8` (merge `1c3f09c`).
- **Pages production (`moxtracker.app`):** frontend pre-redesign, commit
  `f897a943`, build `61a708af281eea70`, deployment `c30921d1`.
- **Pages preview:** redesign, commit `1c3f09c`, build `4ee3d62ce501aba7`,
  deployment `ae78372e`.
- **Worker:** versione `3e26ca1c`, policy Brew/privacy attiva, Account da
  `moxtracker.app` e dalla preview.
- **Database, schema, migrazioni:** nessuna modifica.
- **Research/R3:** nessuna modifica.
- **Merge:** eseguito. **Housekeeping:** non eseguito.

## Redesign e policy Brew/privacy: integrati in `main`, non in produzione

Implementati sul branch `claude/site-redesign-implementation-2026-09-13` il
13–14 settembre e integrati in `main` con un merge normale il 14 settembre.
Su `moxtracker.app` resta il frontend pre-redesign della sezione sopra.

- Branch `claude/site-redesign-implementation-2026-09-13`, creato dalla
  baseline `fe29cc6d25de8f8e0e1aef34db5137e9491e3833`. Fonte canonica:
  [specifica congelata](passaggi/sito/SPEC-SITO-MOX-REDESIGN-2026-09-13.md);
  [piano di implementazione](passaggi/sito/PIANO-IMPLEMENTAZIONE-REDESIGN-2026-09-13.md).
- Commit: `d6273fb` implementazione, `8bc4822` correzioni della code review,
  `15720c4` correzioni della review finale (ultimo commit di codice). Questo
  file è aggiornato nel commit successivo.
- **Home e Meta separati.** `index.html` è la Home (titolo descrittivo, Cosa fa
  MOX, MOX sul web, In sviluppo, Pianificato). Il Meta Explorer vive in
  `meta.html`, pubblicato anche come `en/meta.html`; navigazione, footer e
  pagine di servizio puntano lì.
- **Compatibilità `#meta`.** `sito/js/meta-legacy.js`, caricato solo dalla Home,
  porta `/#meta`, `/en/#meta` e `/index.html#meta` (e i vecchi `#matchup`,
  `#metodo`) su `meta.html` della stessa lingua con `location.replace`,
  conservando la query. `meta.html` non lo carica: nessun ciclo. Vale anche
  con la Home già aperta, tramite `hashchange`.
- **Archetipo → varianti → dettaglio variante.** Contratto URL invariato
  (`formato`, `periodo`, `rank`, `modalita`, `impronta`, `id`, `variante`).
  «Cambia filtri» e il percorso tornano al Meta con gli stessi filtri, che
  `main.js` riapplica solo se validi.
- **Draft**: prima il prodotto, poi i dati Limited, poi il metodo. **Account**:
  cinque schede (Panoramica, Mazzi, Partite, Draft, Account) con tutte le
  funzioni precedenti: login Google/Discord, mazzi, partite, Draft, rank,
  avversari, dettagli, paginazione, collegamento Mox, dispositivi, ticket,
  ticket amministratore, export, logout, cancellazioni, consensi.
- **Shell comune**: font locali Spectral e Hanken Grotesk con licenza OFL in
  `sito/assets/fonts/`, CTA «Scarica MOX», menu mobile, footer unico,
  breakpoint 1100/760, `prefers-reduced-motion`.
- **Nessun numero di esempio nel sito reale**: solo dati API, stato vuoto o
  caricamento. Le schermate in `sito/assets/home/` sono prese dalle pagine
  reali; quella dell'Account viene dal banco sintetico ed è dichiarata «Dati di
  esempio».
- **Meta su telefono**: sotto 760 px restano le schede per archetipo del sito
  attuale (sezione 6 della specifica, «prevale il sito attuale») invece della
  tabella a scorrimento orizzontale descritta nella sezione 9. Scelta
  confermata dall'utente il 13/09.
- **Banco sintetico per l'Account in locale**: con
  `MOX_BANCO_SINTETICO=prove/fixtures/account-sintetico.json`,
  `strumenti/anteprima_sito.mjs` risponde con dati inventati ai soli
  `/account/*`. Non entra nella build.
- **Verifiche su `15720c4`**: `npm run prove` 205/205; `npm run sito:build`
  build `79a117d1ca69f748`, 91 file; smoke
  `node strumenti/smoke_beta.mjs --site http://localhost:8790` 13/13 OK.
- **Browser locale**: su `d6273fb` sono state verificate le route IT/EN HTTP
  200, l'assenza di immagini rotte e di overflow a 375 px su Home, Meta e
  Account, il menu mobile (Escape e ritorno del focus), le schede Account da
  tastiera, `/en/#meta` → `/en/meta.html` e `/index.html#matchup` →
  `/meta.html#matchup`. Dopo le correzioni sono stati ricontrollati: i filtri
  Archetipo ↔ Meta, i rank in italiano, i conteggi delle schede Account e i
  testi inglesi delle schede del Meta su telefono. Dopo la review finale: il
  riquadro «Other variants» e il titolo della scheda di una variante in
  inglese, e la query di `meta.html` che segue rank, modalità e reset.
- **Code review**: nessun finding critico. I due importanti sono risolti (Meta
  su telefono: decisione registrata sopra e una sola voce «Sotto soglia»;
  questo file aggiornato). I minori M1–M9 sono risolti. M10 non è applicato:
  il pulsante della Home conserva `href="#download"` perché `download.js` lo
  sostituisce con lo ZIP Latest e la prova di pre-lancio lo richiede.
- **Review finale su `e4318d3`**: nessun finding critico. Risolti in
  `15720c4` i due importanti (frasi italiane nel riquadro «Altre varianti» e
  nel titolo della variante in inglese) e due minori («Apri partita» in
  inglese, query del Meta allineata ai filtri). Resta un minore: le prove di
  M1/M2 controllano il testo del sorgente e non il comportamento, come il
  resto della suite per i moduli che toccano il DOM all'avvio.
- **Limiti noti**: miniature delle carte da Scryfall non verificate in
  headless; i file di licenza OFL conservano gli spazi finali dell'originale;
  la configurazione `.claude/launch.json` delle preview locali è fuori dal
  repository.
- **Meta, «Altro (Brew)» espandibile** (delta successivo a `e64c1b4`): la riga
  resta aggregata e un pulsante apre le liste arrivate a 30 partite («Brew #N»,
  nome neutro), ognuna con il dettaglio per impronta e i filtri del Meta; le
  altre restano una sola voce «N liste sotto soglia», senza link, impronte né
  V/S. Finché c'è almeno una lista sotto soglia la riga Altro non pubblica
  V/S né win rate (solo partite, quota e numero di liste) e `/gioco-risposta`
  pubblica soltanto le partite al gioco e alla risposta, così il record delle
  liste sotto soglia non si ricava per sottrazione; il dettaglio per impronta
  di una lista non classificata sotto 30 partite risponde come un'impronta mai
  vista (404, stessa risposta). Restano aperti, come decisioni separate, lo
  stesso limite per le «Altre varianti» degli archetipi riconosciuti e, come
  per ogni aggregato, la fetta di una lista già pubblica ricavabile con filtri
  complementari (BO1 + BO3, intervalli di rank). Tocca `src/lettura.js` e `src/dettaglio-archetipo.js` (campi
  nuovi `varianti_brew`, `brew_sotto_soglia`, `record_pubblico`, retrocompatibili):
  attivo dal deploy Worker del 14 settembre (versione `33069c30`).
  Sviluppo futuro, non implementato:
  [roadmap aggiornamento catalogo archetipi](passaggi/sito/META-CATALOG-REFRESH-ROADMAP-2026-09-13.md).
- **Confini del lavoro sul branch**: nessun deploy Worker e nessun deploy di
  produzione del redesign; il merge in `main` è del 14 settembre. Il redesign
  non ha modificato `src/**`; il delta
  Brew tocca soltanto `src/lettura.js` e `src/dettaglio-archetipo.js`. Non modificati `schema.sql`,
  `schema-draft.sql`, `migrazioni/**`, Worker, D1, Cloudflare, storage, packet,
  Research, R3, mox-core.

## Preview del 14 settembre 2026 dal branch — redesign (superata)

- Superata nella stessa giornata: durante la promozione la preview è tornata
  alla build pre-redesign `61a708af281eea70` (deployment `62141e1b`) e viene
  ripubblicata con il redesign dal `main` integrato.
- Pubblicata soltanto la Pages del branch
  `claude/site-redesign-implementation-2026-09-13`, commit `5ec157d`, build
  `4ee3d62ce501aba7` (91 file), con
  `wrangler pages deploy .dist/sito --project-name moxtracker --branch preview`.
- URL alias: <https://preview.moxtracker.pages.dev>.
- URL immutabile: <https://360112e1.moxtracker.pages.dev>.
- Worker **non** pubblicato: la preview usa l'API di produzione
  `api.moxtracker.app` con il codice di prima. Il gruppo «Altro (Brew)» resta
  quindi come prima (riga aggregata con V/S, nessun pulsante) e la policy Brew
  non è ancora attiva; il sito nuovo è compatibile con il Worker attuale.
- Smoke `node strumenti/smoke_beta.mjs --site https://preview.moxtracker.pages.dev`:
  14/14 OK (pagine IT/EN, API salute/Meta/Draft, gate Account 401, CORS
  Account 204, GitHub Latest).
- Browser sulla preview: build servita `4ee3d62ce501aba7`; `/#meta` →
  `/meta` e `/en/#meta` → `/en/meta`; nessun errore in console.
- Piano dell'utente: qualche giorno di prove sulla preview, poi sito
  ufficiale e merge. Nessun deploy Worker, nessun deploy produzione, nessun
  merge.

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

0. Redesign: integrato in `main` il 14 settembre, non su `moxtracker.app`.
   Prima qualche giorno di prove sulla preview Pages
   <https://preview.moxtracker.pages.dev>, poi, solo con un nuovo mandato
   esplicito, il redesign sul sito ufficiale <https://moxtracker.app>. La policy Brew/privacy
   è attiva dal deploy Worker del 14 settembre (oggi `3e26ca1c`; versioni
   precedenti `33069c30` e `59e455d0`). A ogni deploy successivo ripetere i controlli privacy: Altro
   senza `vittorie` in `/meta` quando ci sono liste sotto soglia, `/archetipo`
   con un'impronta inventata in 404, `/gioco-risposta` senza vittorie né win
   rate. Nessun housekeeping prima.
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
