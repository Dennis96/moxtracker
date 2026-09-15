# R3 — implementazione locale, lato server (moxtracker)

Data: 14/09/2026 · Autore: Claude · Stato: **LOCAL PASS WITH REMOTE CONDITIONS — R3 non chiusa**

Il report gemello lato client, con il quadro completo, il self-red-team e il
piano G5C-03, sta in `mox-core`:
`passaggi/research/audit/R3-LOCAL-IMPLEMENTATION-CLAUDE-2026-09-14.md`
(branch `claude/r3-research-implementation-2026-09-14`).

## 1. Baseline e confini

| | |
|---|---|
| base | `main` `12fb5c49f21539102fb1cb6b85e1a316f886a11f` (verificata identica su GitHub) |
| branch | `claude/r3-research-implementation-server-2026-09-14`, worktree `worktrees/claude-r3-research-implementation-server-2026-09-14` |
| checkout operativa | `moxtracker/` su `codex/site-mockups-redesign-2026-09-13` con modifiche utente in `passaggi/sito/**`: **non toccata** |
| remoto | nessuna migration D1, nessun deploy Worker/Pages, nessuna modifica a binding, secret o `wrangler.toml`, nessun merge |

## 2. Che cosa c'e'

`src/research/` (tutto nuovo; il legacy `/partite` v1/v2 non cambia):

| file | ruolo |
|---|---|
| `registro.js` | `SUPPORTED_RESEARCH_MODELS = {4: [1]}` congelato, versioni consenso `[1]`, catalogo chiuso di esiti e motivi |
| `config.js` | configurazione unica fail-closed: `RESEARCH_ENABLED="true"`, `RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST` 1..33, `RESEARCH_MAX_D1_QUERIES_PER_REQUEST` > 0, `RESEARCH_DEPLOYMENT`, `RESEARCH_RUNTIME_QUALIFICATION` (JSON: versione, id, deployment, i due cap, `valida_fino`) → `valida/assente/stale/divergente/invalida`, `RESEARCH_HMAC_KEYS` versionate; le chiavi fixture G5C-04 sono rifiutate fuori da `RESEARCH_AMBIENTE=prova_locale`. `/salute` legge lo stesso oggetto |
| `canonico.js` | `J` (chiavi per punto di codice = Python), SHA-256, `variant_hash`, i tre HMAC byte-esatti, confronto a tempo costante |
| `validatore.js` | wire rev2 chiuso a ogni livello, byte contati sullo stream |
| `budget.js` | `ResearchD1BudgetContext`, unico possessore dei binding; reservation sincrona, token monouso, `token.cost == descriptors == prepared` prima del binding, nessun refund |
| `join.js` | snapshot revisionata, classi di monotonia, summary top-3 + overflow |
| `planner.js` | piano puro a descriptor congelati (guardia+CAS, contribution, varianti, storia, proiezioni a chunk ≤ 100 parametri) e piani di lifecycle |
| `servizio.js` | route: gate in memoria → context → letture → piano → reservation → batch → retry/replan sullo stesso ledger |
| `account-research.js` | export e delete Research per l'account |
| `rotte.js` | `/research/partite` (Bearer generation), `/research/consenso`, `/research/consenso/revoca`, `/research/elimina`; niente CORS |

Integrazioni: `index.js` (instradamento e blocco `research` in `/salute`),
`account.js` (export; delete account e sezione `partite` passano prima da
Research, `409 cancellazione_research_in_corso` se la lineage non si chiude),
`draft.js` (`/contributi/elimina` idem; la risposta legacy resta identica se
non c'era niente di Research).

## 3. Schema

`schema.sql` porta in coda **esattamente** `migrazioni/2026-09-14-research-r3.sql`
(una prova lo pretende). Tabelle: `research_lineage`,
`research_consent_generation`, `research_consent_tombstone`,
`research_deleted_contribution`, `research_contribution`,
`research_contribution_variante`, `research_snapshot_storia`,
`research_revisione_server`, `research_game_contribution`, `research_event`,
`research_deck_card`, `research_sideboard_delta`, `research_guardia`.

- La guardia atomica G5C-02 e' il primo statement del batch: un `INSERT` in
  `research_revisione_server` con `CHECK (guardia = 1)` e PK
  `(mittente, id_pubblico, versione)`. Lineage non attiva, generation non
  attiva/corrente, id soppresso o versione cambiata → `CHECK` fallito; CAS
  perso → `UNIQUE` fallito. Entrambi abortiscono l'intero `batch()`.
- Lineage, tombstone e soppressioni contengono solo tag opachi; sono le sole
  eccezioni al delete ordinario e non si esportano.
- Nessuna riga condivisa fra mittenti: le metriche match-level si calcolano
  con `COUNT(DISTINCT id_pubblico)`.

## 4. Prove

`npm run prove`: **317/317**, 0 falliti, 0 saltati (baseline 191; +126 prove
Research), eseguito nella worktree del branch con Node 24.19.0.
`npm run sito:build`: build `4ee3d62ce501aba7`, **identica** a quella del
redesign gia' registrata in questo file: il sito non cambia.

| file | copre |
|---|---|
| `research-canonico` | golden SHA, `J` vs Python, `variant_hash`, tre vettori HMAC e negativi |
| `research-config` | fail-closed di ogni parametro, qualification, chiavi fixture, `/salute` |
| `research-validatore` | golden valida; chiave estranea e `null` su **ogni** nodo della golden; gruppi, delta, marcatori, eventi, limiti, busta, byte sullo stream |
| `research-budget` | budget4/read5, A24/A25, B1356/B1357, budget 1, niente refund, token, rechunk, statement aggiunti/omessi, descriptor mutati, reservation concorrenti |
| `research-join` | tabella esiti, bump/downgrade, 15 regressioni e 12 transizioni ammesse, top-3/overflow, collisione, permutazioni |
| `research-proprieta` | 40.320 permutazioni su **6 worker_threads**, aggregazione deterministica |
| `research-planner` | composizione dei piani, chunk ≤ 100 parametri, lifecycle |
| `research-servizio` | flusso completo, conflitti, due mittenti, batch misto, revoca, TOFU, delete, budget, planner==writer, CAS forzato, upload/delete interlacciati, guasto a ciascuno degli 11 statement del chunk delete, continuation, esito incerto, CORS, log |
| `research-account` | export, delete account/sezione/`/contributi/elimina`, budget account, DB senza tabelle Research, censimento tabelle |
| `research-gateway-censimento` | spia runtime: ogni statement `research_` arriva da `budget.js`; censimento del sorgente |
| `research-schema` | bootstrap == legacy + migrazione (due volte), vincoli |
| `research-regressioni-g5c` | le tre forme G5c ricostruite dentro body/count: costo dal piano (19, 895, 928), `413` a costo−1, accettazione a costo esatto |

## 5. Limiti dichiarati

- Tutto e' provato su SQLite locale: accounting, rollback reale, race,
  CPU e latenza del D1 remoto sono G5C-03 e restano da provare.
- `research_server_locale.mjs` serve solo all'end-to-end del client.
- Il budget delle operazioni Research dentro il lifecycle account, quando la
  configurazione Research non ha un budget valido, e' fisso a 100 per
  request: va qualificato insieme agli altri cap.
- Il rate limit per origine usa un binding opzionale `RESEARCH_RATE_LIMITER`
  che non esiste ancora: senza, restano le quote per mittente e generation.
