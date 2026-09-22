# Stato corrente — sito Mox

## Candidato legale/guida — 22 settembre 2026

È pronto per una nuova preview il candidato che completa guida IT/EN, informativa privacy, disclaimer Wizards e gate tecnico di produzione. Test: **466/466 PASS**, build riproducibile e `git diff --check` pulito. Audit e limiti sono registrati in [MOX-PRELAUNCH-LEGAL-GUIDA-IP-QA-2026-09-22.md](passaggi/sito/MOX-PRELAUNCH-LEGAL-GUIDA-IP-QA-2026-09-22.md).

La produzione resta **bloccata** per due ragioni esplicite: manca l'identità esatta del titolare del trattamento e il client finale deve ancora superare review indipendente/release gate. Il release script rifiuta la produzione finché il segnaposto legale è presente. Nessun deploy Pages production, Worker, D1, versione client o feature flag è autorizzato da questo stato.

Aggiornato il 21 settembre 2026. **Distinzione che regge tutto questo
documento: il codice è su `main`, il sito pubblico no.**

**Codice.** `main` è `3a5dc569d4acb217e7afad823d229aea5fd26061`: sopra il
candidato pre-release ci sono i nomi pubblici dei gruppi Brew (PR #4),
l'accensione di `BREW_GRUPPI` (PR #5) e il cleanup UX pre-launch (PR #7).

**Backend Brew: in produzione dal 20/09 sera.** `api.moxtracker.app` usa il
Worker `a04d93f9`, che porta i nomi Brew e ha `BREW_GRUPPI = "on"`; il D1
`moxtracker` ha le tabelle `brew_gruppo`, `brew_membro` e `brew_nome`, e il
primo backfill ha creato **3 gruppi con 4 varianti pubbliche**, tutti e tre
**nominati**. Research resta accesa e invariata.

**Il sito ufficiale no.** `moxtracker.app` pubblica ancora il frontend stabile
pre-redesign (`f897a943`, build `61a708af281eea70`), **non ridistribuito**, ed
è compatibile col Worker nuovo. La preview pubblica ora il `main` corrente
(`3a5dc56`, build `aa78fe9692ee3348`, deployment `ac1cc5f3`). Il deploy Pages
di produzione resta un mandato separato, e il suo gate è la QA manuale
completa.

**Attenzione al Worker.** `SOGLIA_SCONTRI` è passata da 100 a 30 su `main`, ma
il Worker in produzione è ancora `a04d93f9`, che porta il vecchio 100. Il
campo non è usato da niente di visibile (`/scontri` risponde `disponibile:
false`), quindi non c'è fretta: si allinea al prossimo deploy del Worker.

La GitHub Release Latest del client è `mox-v2-beta2.11.0`, non prerelease, con
il solo asset `Mox-v2-beta2.11.0-con-python.zip`; la 2.10.0 resta. Dettagli
nella sezione sotto e nel
[runbook R3](passaggi/research/RUNBOOK-R3-PRODUZIONE.md).

> **Come leggere le sezioni datate qui sotto.** Sono un diario: ognuna descrive
> lo stato al giorno in cui è stata scritta. Quelle marcate «fuso in `main` il
> 20/09/2026» erano su branch quando sono state scritte e ora non lo sono più;
> il «non deployato» che contengono resta invece vero.

## Cleanup UX pre-launch — 21 settembre 2026

Sei correzioni nate dalla QA manuale, sul solo frontend tranne una soglia del
contratto API. **Branch:** `claude/pre-launch-ux-cleanup-2026-09-21`,
[PR #7](https://github.com/Dennis96/moxtracker/pull/7) → `3a5dc56`.

- **Le tre card del Download** erano alte 256/232/232 a 1440px. Due difetti
  insieme: `min-height: 210px` non uniformava niente, e `.panel + .panel` — la
  regola che distanzia i pannelli **impilati** — spingeva la seconda e la terza
  24px più in basso. Ora la griglia è `stretch`, le card sono colonne flex e il
  margine è azzerato fra le colonne, come già si fa per `.detail-grid`.
  Misurate sulla preview: **232/232/232** in italiano, 207/207/207 in inglese,
  stesso inizio e stessa fine. A 375px si impilano da sole.
- **Nome pubblico della release.** Il sito mostrava il tag tecnico
  `mox-v2-beta2.11.0` e il campo del manifesto «2 beta 2.11.0». Ora
  `nomeReleasePubblico()` tiene solo il numero e scrive `MOX Beta 2.11.0`.
  Nessun tag GitHub rinominato, nessun asset toccato, updater intatto: cambia
  soltanto la presentazione.
- **Pagina Draft.** Tolti filtri, contatori, «Espansioni ed eventi» e «Colori e
  carte»: promettevano una vista dati che non esiste. Restano il prodotto e il
  metodo, e arriva **«Il futuro del Draft»** — filtri, carte, rendimento col
  campione accanto, definizioni in chiaro — con scritto che non ha una data. La
  pagina non chiede più le statistiche: `sito/js/draft.js` e
  `fetchStatisticheDraft` spariscono, l'endpoint `/draft/statistiche` del
  Worker resta dov'è.
- **Account senza «Contro gli archetipi».** Aggregava tutti i mazzi insieme e
  il riquadro stesso doveva dichiarare che non sapeva separarli. Il server
  continua a calcolarlo: torna quando la catena sarà intera (mazzo scelto →
  archetipo avversario → campione → matchup).
- **Account Draft senza doppioni.** Nel tab restano le sole tracce vere; le
  card «Partite Limited senza traccia» non compaiono più accanto ai Draft,
  perché erano spesso lo stesso evento visto due volte. I risultati escono solo
  dai collegamenti esatti, e quando mancano lo si dice.
- **Matchup: 30 pubblicabile, 100 solido.** `SOGLIA_SCONTRI` passa a 30 e nasce
  `SOGLIA_SCONTRI_SOLIDA = 100`, esposta come `soglia_coppia_solida`. Con 100
  come minimo la matrice resterebbe vuota per tutta la beta. Dal sito sparisce
  il badge «100+ per coppia».

**Audit del collegamento Draft (Fase A): nessuna modifica a `mox-core`.** Il
server ha già il meccanismo esatto — `collegaPartiteDraft` cerca
`draft WHERE impronta_arena = partita.draft` e scrive `draft_link` — e
`pacchetto()` accetta `draft=`. Ma `pacchetti_da_archivio()` non lo passa mai,
**e soprattutto** la classe `Partita`, costruita dal log, non contiene nessun
`draftId`: il parser legge `InternalEventName`, cioè il nome dell'evento, non
l'identificativo di sessione del draft. Senza quell'id il collegamento
deterministico non è disponibile al momento della partita, e costruirlo
vorrebbe dire capire se e dove Arena lo scrive negli eventi di match ed
estendere il parser: una decisione architetturale nuova, che il mandato mette
in STOP. Nessuna euristica, nessuna modifica retroattiva.

**Verificato lo stesso giorno, e la risposta è no.** Sul corpus locale delle
registrazioni: **111 archivi contengono sia un `draftId` vero sia almeno un
match, e in 0 su 111 quell'id ricompare negli eventi di match** — cercato come
sottostringa nell'intero JSON degli oggetti di match, quindi anche sotto
qualunque altro nome di chiave. L'unica chiave affine presente nei match è
`eventId`, che però non identifica un draft: in un `Player.log` un solo valore
copriva 16 match e 4 `InternalEventName` diversi.

Quindi non manca il codice, manca il dato: Arena non scrive l'identificativo
del draft nelle partite, e non c'è niente da estrarre. Registrato come **A116**
in `mox-core/ARRETRATI.md` (PR #5, `11dea577`), aperto e non risolvibile dal log
com'è oggi. Si riapre solo se Arena comincia a scrivere quell'id negli eventi di
match, o se si trova un canale diverso e altrettanto esatto. Niente euristiche:
orario, evento, set o mazzo unirebbero draft diversi dello stesso evento.

- **Verifiche:** `npm run prove` **461/461**, nessuna saltata, con il nuovo
  `prove/prelancio-ux.test.js` (12 prove). Due build consecutive
  `aa78fe9692ee3348`, 92 file (uno in meno: `draft.js` rimosso). Code-review
  prima del merge: tre difetti trovati e corretti — una pagina che sarebbe
  rimasta sul messaggio di caricamento, una nota che si incolonnava come card
  vuota, e uno `align-items` che restringeva i figli delle card.
- **QA sulla preview**, desktop 1440 e mobile 375, IT ed EN: card uniformi,
  `MOX Beta 2.11.0` al posto del tag, Draft senza dati e con il futuro
  tradotto, Account senza il blocco archetipi e con le cinque schede intatte,
  Meta con «In sviluppo» e «30+ matchup». Nessun overflow orizzontale. In
  console restano i soli 401 dell'Account non autenticato, che sono il gate
  previsto.
- **Non toccati:** D1, Worker, `mox-core`, Research, produzione Pages.

## Brew in produzione e nuova preview — 20 settembre 2026

Il mandato che ha portato S1/S2/S3 dal solo `main` a uno stato verificabile
end-to-end: `D1 Brew -> Worker Brew -> nomi pubblici -> frontend -> preview`.

- **`main`:** da `881e886` a `5072daf`, con due PR fuse con merge commit —
  [#4](https://github.com/Dennis96/moxtracker/pull/4) (nomi pubblici,
  `2a62fb2`) e [#5](https://github.com/Dennis96/moxtracker/pull/5)
  (`BREW_GRUPPI = "on"`, `5072daf`).
- **D1 remoto.** Bookmark di ripristino prima di toccare niente:
  `0000045e-00000000-000050ec-fd401cdb2cf147489fdd587a02eecb83`. Applicate in
  ordine `migrazioni/2026-09-15-brew-gruppi.sql` e
  `migrazioni/2026-09-20-brew-nome-pubblico.sql`. Le tabelle passano da 32 a
  35; `partite` resta a 679 righe e `carte_mazzo` a 13.580, identiche alla
  baseline. Il trigger di immutabilità è stato provato sul database vero: un
  `UPDATE` su `brew_gruppo` torna «brew_gruppo congelato».
- **Worker, in due passi.** Prima `1caff306` dal `main` `2a62fb2` con il flag
  ancora spento: `/salute` identica byte per byte, `/meta` sul periodo totale
  con le stesse 360 partite e gli stessi mazzi, privacy Brew invariata
  (impronta e `id_brew` inventati 404), smoke del sito pubblico tutto OK. Poi
  `a04d93f9` con `BREW_GRUPPI = "on"`. **Rollback:** `wrangler rollback
  1caff306-6a3e-4e1b-bcb0-35a89c61969c` (flag spento) oppure `d4c12c58` (il
  Worker del 15/09). Il deploy porta in produzione anche il catalogo
  archetipi rigenerato il 19/09: sul periodo totale classifica esattamente
  come quello di agosto.
- **Backfill.** Eseguito col cron vero, non con un endpoint nuovo:
  `wrangler dev --remote --test-scheduled` e una richiesta a
  `/__scheduled`, che gira lo stesso `scheduled()` del Worker sui binding
  remoti. Primo giro: **3 gruppi, 4 membri**, `k = 4`. Secondo giro: nessun
  doppione, stesse righe e stesso `creato` — idempotente.
- **Nomi pubblici assegnati**, dalla sola decklist rappresentativa che l'API
  già pubblica:

  | Gruppo | Nome | Perché |
  |---|---|---|
  | `bg_d143b62…` | **Boros Dwarves** | Plains/Mountain e Sacred Foundry; otto carte di nani (Dáin's Company ×4, Dwarven Mauler ×4, Kíli, Dwalin, Thorin) con equipaggiamenti |
  | `bg_6e73e93…` | **Orzhov Sacrifice** | manabase Orzhov economica; Infestation Sage ×4, Forsaken Miner, Bartolomé del Presidio, Raise the Past ×3, Vengeful Bloodwitch ×4 |
  | `bg_f5a4def…` | **Orzhov Sacrifice (Syr Vondam)** | stessa famiglia della riga sopra, ma manabase premium e Syr Vondam più Arnyn, che l'altra lista non ha |

  Nessuno dei tre coincide con un archetipo del catalogo: lo strumento
  rifiuta la coincidenza. I nomi sono **etichette editoriali**: clustering,
  `k = 4`, soglia 30 e classificatore restano quelli di prima.
- **Preview.** `npm run sito:release -- --environment=preview --deploy` dal
  `main` `5072daf`: build `6a36644a19c64de9`, 93 file, deployment `917c6fea`
  (<https://917c6fea.moxtracker.pages.dev>, alias
  <https://preview.moxtracker.pages.dev>), record
  `preview-5072dafb4a80-917c6fea.json`, prove del gate 448/448, smoke 14/14.
  `X-Robots-Tag: noindex, nofollow, noarchive` su tutte le pagine,
  `robots.txt` con `Disallow: /`, canonical e hreflang verso la produzione e
  mai verso la preview, sitemap con i soli URL di produzione, social card
  1200×630.
- **QA Brew mirata, sulla preview.** Nel Meta i tre gruppi si presentano col
  nome — «Boros Dwarves», «Orzhov Sacrifice», «Orzhov Sacrifice (Syr
  Vondam)» — e non più come «Gruppo Brew»; le 6 liste sotto soglia restano un
  riepilogo unico senza V/S né percentuali. Dettaglio: titolo col nome, badge
  «Archetipo non ancora confermato» e «Liste simili raggruppate», due
  varianti con distanza, decklist pubblicate, copia per Arena che scrive
  `Name Boros Dwarves`. `aria-label` «Apri Boros Dwarves da 81 partite».
  Nessun `bg_`, `bv_` o impronta nel testo o negli attributi: gli id restano
  solo nell'URL canonico. Reload diretto su `?id_brew=` e ritorno al Meta
  funzionano. In inglese i nomi sono gli stessi e non compare «Brew group». A
  375 px nessun overflow (`scrollWidth` 375), e anche il nome più lungo sta
  nella scheda.
- **Non fatto, di proposito:** nessun deploy Pages di produzione, nessuna
  release client, nessun bump di versione, nessuna modifica a `mox-core` o a
  Research.
- **Limite noto, non causato da questo lavoro:** la `og:image` della preview
  punta a `moxtracker.app/assets/social/mox-social-card.png`, che oggi dà 403
  perché quell'asset esiste solo nel redesign. Si risolve da sé quando la
  produzione verrà ridistribuita; sulla preview il file c'è ed è 1200×630.

## Nomi pubblici dei gruppi Brew — 20 settembre 2026 (il codice)

- **Branch:** `claude/brew-production-preview-2026-09-20`, da `main`
  `881e886`. Commit `38098ca` (migrazione, API, sito, strumento, prove) e
  `bc358a3` (correzioni del code-review).
- **Problema:** dopo S2 ogni gruppo Brew si presentava come «Gruppo Brew». Era
  un fallback neutro, non la UX del lancio: due gruppi diversi avevano lo
  stesso titolo e la ricerca non poteva trovarli.
- **Cosa:** un nome pubblico per gruppo, **curato a mano**, in una tabella
  sidecar `brew_nome` (migrazione additiva
  `migrazioni/2026-09-20-brew-nome-pubblico.sql`). Sidecar e non colonna di
  `brew_gruppo` perche' quella tabella e' congelata da un trigger che rifiuta
  ogni UPDATE: un nome si corregge, un rappresentante no, e quel trigger non
  si indebolisce per comodita' di redazione. Il nome e' **solo un'etichetta**:
  non tocca clustering, `k=4`, soglia 30, classificatore, `mox-core/meta`, e
  non promuove il gruppo ad archetipo.
- **API additiva:** `nome_pubblico` su ogni `gruppi_brew[]` di `/meta` e sul
  dettaglio `/archetipo?id_brew=`. Senza nome vale `null`; tolto il campo
  nuovo, il payload e' identico a prima.
- **Sito:** il titolo e' il nome pubblico nel Meta (riga e scheda), nel
  dettaglio, nell'`aria-label` e nella ricerca. Senza nome resta `Brew`,
  uguale in italiano e in inglese; `Gruppo Brew` non e' piu' un titolo
  pubblico. La copia per Arena usa il nome, o il fallback `Brew MOX`.
- **Strumento:** `strumenti/brew_nomi.mjs` — elenco dei soli gruppi pubblici
  letti **dall'API pubblica** (mai dal database, quindi mai sotto soglia),
  dry-run e applicazione con conferma `APPLICA-NOMI-BREW` sulla sola tabella
  dei nomi. Nessun endpoint amministrativo.
- **Cancellazione:** il nome segue il gruppo che si smonta per privacy, per
  chiave esterna a cascata e, in piu', con una DELETE esplicita nella pulizia
  Brew, che vale anche dove le FK non fossero applicate.
- **Verifiche:** `npm run prove` 448/448, nessuna saltata. Due build
  consecutive `6a36644a19c64de9`, 93 file. Code-review: tre difetti trovati e
  corretti, il piu' grave un esecutore Wrangler che su Windows non sarebbe mai
  partito.
- **Non toccati:** `mox-core`, Research, Account, Draft, clustering S1.

## Candidato pre-release consolidato — 19 settembre 2026 (fuso in `main` il 20/09/2026)

- **Branch:** `codex/pre-release-consolidation-2026-09-19`, creato dall'HEAD
  S3 verificato `f9e4f5f`, con merge semantico del launch
  `f646057`. `launch-prep` era gia' antenato; il branch temporaneo S3 `b2-temp`
  non e' stato integrato.
- **Review S3 indipendente:** `PASS WITH CONDITIONS`, senza blocker. Soglia
  30, `k=4`, `main-multiset-radius-v1`, esclusione del sideboard, privacy e
  separazione catalogo/telemetria restano invariati. C001/C002/C003 restano
  `A — EVIDENZA_INSUFFICIENTE` dopo il refresh Standard.
- **Catalogo:** `src/catalogo-archetipi-generato.js` rigenerato dal catalogo
  canonico di `mox-core`: 27 liste, 25.762 ID Arena; due run hanno prodotto
  lo stesso SHA-256 `1dcb283254c9155e9960c4f280e36963f6f819afd5d61b638acd921cbae1e935`.
- **Sito:** preservati SEO, canonical/hreflang, sitemap, social card 1200x630,
  crop Home, produzione indicizzabile e preview `noindex`. Privacy separa i
  consensi Partite, Draft e Research, espone `privacy@moxtracker.app` e
  descrive revoca/cancellazione fail-closed. Download e note versione
  rappresentano correttamente MOX 2.11.0 e Research opt-in senza promettere
  analisi ancora in roadmap.
- **Verifiche:** installazione pulita con `npm ci`; `npm run prove` 428/428,
  nessuna prova saltata; target Privacy/Account/Research/build 34/34; target
  dettaglio/lettura 24/24. Due build consecutive: 93 file, ID
  `185cb0e6bb7908a0`.
- **Non eseguiti al 19/09:** nessun merge in `main`, deploy Pages/Worker, D1
  remoto, migrazione, release o cancellazione branch. **Aggiornamento 20/09:**
  il merge in `main` e la cancellazione dei rami integrati sono stati fatti;
  deploy, D1 remoto, migrazione e release **restano non eseguiti**, e sito,
  API, database e release pubblica sono quelli descritti in testa.

## S2 Brew frontend — 16 settembre 2026 (fuso in `main` il 20/09/2026, non deployato)

- **Branch:** `claude/s2-brew-frontend-2026-09-16`, creato da `8a3cfe7` (S1
  `17a3ca0` più la review indipendente); commit `b099e1b` più questo
  aggiornamento di stato. Allora **non fuso**; dal 20/09/2026 e' in `main`.
  **Non deployato**: `moxtracker.app` e la preview non cambiano.
- **Preflight S1** sull'HEAD esatto: quattro suite Brew 53/53,
  `npm run prove` 405/405 senza prove saltate, build `346ce2023c50e91c`,
  strumento Brew ok. La prima condizione della review S1 è chiusa.
- **Cosa:**
  - nel Meta, una riga o scheda per gruppo Brew con numeri del server e un
    solo riepilogo sotto soglia;
  - link `archetipo.html?…&id_brew=bg_…` con tutti i filtri;
  - dettaglio `brew_group` con varianti «rappresentativa» e «simile»;
  - vecchi `?impronta=` portati all'URL canonico con `replaceState`;
  - fallback identico al Meta di prima quando il Worker non espone i gruppi;
  - nessuna impronta o id tecnico visibile.
- **Verifiche:**
  - `npm run prove`: 424/424, nessuna saltata;
  - `npm run sito:build`: build `54ae1e62b7792f95`;
  - nel browser, sull'anteprima locale con banco sintetico: link canonico,
    reload, «indietro», inglese a 375 px;
  - screenshot sintetici in `passaggi/sito/mockups/2026-09-16/s2-brew-frontend/`.
- **Non toccati:** backend S1 (`src/`, schema, migrazioni), Worker, Pages, D1
  remoto, `mox-core`. **S3 non è iniziato.**
- **Documenti:** [S2 frontend](passaggi/sito/S2-BREW-FRONTEND-2026-09-16.md) e
  l'[handoff](passaggi/handoff/HANDOFF-S2-BREW-FRONTEND-2026-09-16.md).

## S1 Brew backend — 15 settembre 2026 (fuso in `main` il 20/09/2026, non deployato)

- **Branch:** `claude/s1-brew-backend-2026-09-15` da `main` `75bcac4`;
  commit `b6c940d` (codice, prove, migrazione e contratto) e `0bc7816`
  (delta cancellazione, 16/09), piu' gli aggiornamenti di stato.
- **Cosa:** gruppi Brew a raggio. La distanza si misura sul main deck per
  nome carta, k = 4, algoritmo `main-multiset-radius-v1`. Identificativi
  opachi persistenti `bg_`/`bv_`. `/meta` aggiunge `gruppi_brew` e
  `raggruppamento_brew`, e i campi legacy restano identici. Nuovo
  `/archetipo?id_brew=`; il percorso `?impronta=` dice a quale gruppo
  appartiene la lista.
- **Persistenza:** migrazione additiva
  `migrazioni/2026-09-15-brew-gruppi.sql`; strumento locale
  `strumenti/brew_gruppi.mjs` (analisi, report k=3/4/5, apply); cron spento
  finche' `BREW_GRUPPI` non vale `"on"`.
- **Decisione dell'utente:** in S1 solo le quasi-copie. Le famiglie con lo
  stesso nucleo passano dal refresh curato del catalogo.
- **Privacy:** entrano nei gruppi solo liste con 30 partite totali. Un gruppo
  mostra solo le varianti pubbliche nel filtro, e le liste sotto soglia
  restano nel conteggio globale di prima.
- **Cancellazione (delta 16/09):** dopo `Cancella dal sito partite e
  Draft`, e dopo la sezione «partite» dell'account, non resta stato Brew
  senza partite. La pulizia sta nello stesso batch delle partite, prima delle
  credenziali, ed e' ripetibile. Un gruppo che perde il rappresentante si
  smonta: e' l'eccezione privacy alla stabilita' degli id. I trigger
  congelano gli UPDATE, non i DELETE.
- **Verifiche:** `npm run prove` 405/405, nessuna saltata. `npm run
  sito:build` produce `346ce2023c50e91c`, identica alla preview. La
  migrazione e' provata su SQLite e su D1 locale di Wrangler (`--local`,
  cartella temporanea).
- **Non toccati:** `main`, Worker, Pages, D1 remoto, `mox-core`, Research,
  `sito/**`.
- **Documenti:** il [contratto B1 e i report](passaggi/sito/S1-BREW-CONTRATTO-B1-2026-09-15.md)
  e l'[handoff della review](passaggi/handoff/HANDOFF-S1-BREW-BACKEND-REVIEW-2026-09-15.md).
- **Prossimi passi**, ognuno con il suo mandato. Fatti: review indipendente
  (20/09, PASS), merge in `main` (20/09), S2/F1 sul sito (16/09, in `main`).
  Restano: migrazione remota con verifica dei trigger, deploy del Worker,
  `BREW_GRUPPI = "on"`.

## R3 in produzione e preview — 15 settembre 2026

- **Merge:** `main` `12fb5c4` → `b2b3732` (fast-forward del branch approvato
  `claude/r3-final-blockers-remediation-2026-09-15`: R3 server, compattazione
  D1, remediation B1–B4, frontend di Codex già integrato: `ccf3d7c`, `c8e904c`,
  `23ca180`, verificati antenati), poi `46cb6da` (Research `on`). Prove
  351/351 su `b2b3732`, 352/352 su `46cb6da`.
- **Preview:** `npm run sito:release -- --environment=preview --deploy` da
  `main` `b2b3732`: build `346ce2023c50e91c`, 91 file, deployment `bf867206`
  (<https://bf867206.moxtracker.pages.dev>), record
  `preview-b2b373212fd0-bf867206.json`, smoke del gate 6/6;
  `smoke_beta.mjs --site https://preview.moxtracker.pages.dev` 14/14.
- **Sito ufficiale:** invariato. `moxtracker.app` serve la build
  `61a708af281eea70` di `f897a943` prima e dopo; `smoke_beta.mjs` tutto OK
  (Meta separato saltato, come previsto sul frontend pre-redesign). Il
  redesign sul sito ufficiale resta un mandato separato.
- **D1 `moxtracker`** (`85145457-…`): migrazione
  `migrazioni/2026-09-14-research-r3.sql`, 13 tabelle e 4 indici Research; le
  19 tabelle legacy intatte (conteggi prima/dopo coerenti col solo traffico
  vero). Bookmark di Time Travel prima della migrazione:
  `00000402-00000000-000050e7-a3d286346c31627d07901d3aeaf7afae`.
- **Worker:** chiavi HMAC di produzione nuove (secret, separate dallo
  staging); R3 prima in `off` (`86cded53`, `VERSIONE_R3_MINIMA`), smoke legacy
  identico al Worker precedente `3e26ca1c`; poi `on` (`d4c12c58`) con la
  qualification generata, valida fino al 15/10/2026. Collaudo in `drain`
  (`c06c8632`) e ritorno a `on`. Account Workers Paid dal 15/09/2026.
- **Research, smoke di produzione:** on 12/12, drain 6/6, nessun dato
  sintetico rimasto; privacy Brew invariata (`/meta` senza vittorie sotto
  soglia, `/archetipo` con impronta inventata respinto come prima,
  `/gioco-risposta` senza vittorie).
- **Release client 2.11.0:** manifesto su canary, canary reale 2.10.0 →
  2.11.0, poi gli stessi byte su stable; installer su R2 servito da
  `/mox/download.exe` con lo SHA atteso.
- **Rollback:** dopo la 2.11.0 il rollback è `drain`, mai un Worker senza le
  route Research: comandi e versioni nel runbook.
- Lo staging Research resta com'era; l'incidente R3-OP-01 è conservato nella
  sezione del 14 settembre.

## Housekeeping Research pre-R3 — 14 settembre 2026

`main` include i cinque addendum Research/server G3B → Final M8, integrati
come soli documenti in un housekeeping successivo alla chiusura sito. La linea
consolidata ha **FINAL DELTA VERIFICATION: PASS WITH CONDITIONS** e
**R3 IMPLEMENTATION GATE: OPEN WITH MANDATORY CONDITIONS**; R3 non è avviata
né implementata. Nessun file `src/**` o `sito/**`, schema, migration,
configurazione Pages/Worker, deploy o dato operativo è stato modificato. Le
condizioni obbligatorie restano interne al futuro task R3 sul runtime reale.

## Research R3 locale — 14 settembre 2026 (fuso in `main`, poi in produzione dal 15/09)

Sul branch `claude/r3-research-implementation-server-2026-09-14` il Worker ha
le route Research separate (`/research/partite`, `/research/consenso`,
`/research/consenso/revoca`, `/research/elimina`), il gateway D1
budgetizzato, lo schema Research in coda a `schema.sql` e la migrazione
`migrazioni/2026-09-14-research-r3.sql`. **Niente di questo e' pubblicato**:
nessun deploy Worker o Pages, nessuna migration D1 remota, nessun merge in
`main`. Research resta spenta e fail-closed finche' la configurazione e la
qualification del runtime reale non esistono; `/salute` lo dichiara. Il sito
non cambia (build identica). Report:
[R3-LOCAL-IMPLEMENTATION-SERVER-CLAUDE-2026-09-14.md](passaggi/research/audit/R3-LOCAL-IMPLEMENTATION-SERVER-CLAUDE-2026-09-14.md).

**Staging Research G5C-03 (14/09/2026, autorizzato):** creati il D1
`moxtracker-research-staging` (`02829757-…`, sola migration R3) e il Worker
`moxtracker-research-staging` su workers.dev, senza route ne' dominio, da
`wrangler.research-staging.toml` (branch server, commit `28c0395`→`1de1c28`;
versioni `1da20383`, `5ea787f1` e successive con i soli segreti di staging).
Dati solo sintetici. **Non toccati:** D1 `moxtracker`, Worker di produzione,
`api.moxtracker.app`, Pages, preview, `main`. Acceptance 36/36 e benchmark nel
report [R3-G5C03-STAGING-SERVER-CLAUDE-2026-09-14.md](passaggi/research/audit/R3-G5C03-STAGING-SERVER-CLAUDE-2026-09-14.md).
La qualification di misura scade il 16/09/2026: poi lo staging torna chiuso.

**Incidente operativo R3-OP-01 (14/09/2026, dopo le 20:51 UTC → reset 00:00 UTC):**
i benchmark sullo staging hanno superato le 100.000 righe scritte al giorno
del **piano D1 gratuito**, che vale per l'account intero (250.903 righe nelle
24 ore sullo staging, da `wrangler d1 info`). Dall'arresto fino al reset anche
il D1 di produzione `moxtracker` ha rifiutato le scritture («Your account has
exceeded D1's free tier daily row write limit»): invii di partite e Draft
rimasti nelle code dei client, login, sincronizzazioni e ticket possibili in
errore; letture, sito e download non toccati. L'ultima partita scritta e'
delle 20:51:14 UTC, l'ultimo Draft delle 20:19:03 UTC: l'orario «~18:40»
scritto in un primo momento era sbagliato. Allora l'account era **Workers
Free**, non Paid come scritto in un primo momento. Rimedio: budget preventivo
di righe scritte obbligatorio negli strumenti di staging (`--budget-righe`,
stima prima della run, arresto prima della richiesta che lo supererebbe).

Verifica del 15/09/2026, 05:06 UTC, in sola lettura: `/salute` risponde
`vivo`, i due D1 di produzione si leggono, nessuna partita ne' Draft dopo il
reset (nessun client attivo di notte). La prima scrittura dopo il reset,
sullo staging, e' passata: il limite dell'account e' tolto. Dal **15/09/2026
l'account e' Workers Paid** (5 $/mese: 50 M righe scritte al mese incluse,
1.000 query per invocazione, 10 GB per database); il tetto di righe negli
strumenti di staging resta obbligatorio.

**Remediation dei blocker R3 (15/09/2026, branch
`claude/r3-final-blockers-remediation-2026-09-15`, poi fuso; il ramo non
esiste piu' dopo l'housekeeping del 20/09).**
Research ha tre modalità (`RESEARCH_MODE` off/drain/on); `wrangler.toml` di
produzione parte da `off`, con cap 33/1000, deployment
`research-produzione-r3` e due limitatori Research (ingresso 29021, ciclo di
vita 29022). Dopo la 2.11.0 il rollback è `drain`, mai un Worker senza le route
Research: [runbook](passaggi/research/RUNBOOK-R3-PRODUZIONE.md),
[report](passaggi/research/audit/R3-FINAL-BLOCKERS-REMEDIATION-SERVER-CLAUDE-2026-09-15.md).
Sito di produzione e preview non toccati.

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

Il backlog separato per gli interventi frontend e backend emersi dal collaudo
è in
[Prossimi sviluppi del sito — frontend e backend](passaggi/sito/PROSSIMI-SVILUPPI-SITO-2026-09-14.md).
La sua presenza non autorizza Worker, API, D1, schema, migrazioni, merge o
deploy: ogni voce va avviata con un mandato separato.

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
