# R2 → R3-PREP — G3B server fit-gap

Data: 12/09/2026

Stato: **PASS WITH CONDITIONS**

Classificazione B3: **READY FOR R3 IMPLEMENTATION**

Classificazione B4: **READY FOR R3 IMPLEMENTATION**

Ambito: verifica e design documentale lato `moxtracker`. Nessun endpoint,
validator, schema, migrazione, consenso runtime o deploy è stato implementato.
R3 non è aperto.

## 1. Esito

G3A resta valido. L'attuale percorso `/partite` non può ricevere il wire
Research, ma i gap B3 e B4 hanno una soluzione server coerente senza cambiare
identità, semantica dell'unknown, eventi, deck o sideboard definiti in G3A.

Il candidato è un percorso separato `POST /research/partite`, con validator
ricorsivamente chiuso, join monotono/commutativo e storage D1 separato per
match, prospettiva, game ed evento. Il consenso viene provato da una generazione
opaca server-issued fuori dal payload; il marker
`consenso_research.versione` non crea né dimostra consenso. Il delete conserva
soltanto l'hash della generazione in una barriera minimizzata, così un retry
della vecchia coda non può ricreare dati.

G4 ha confermato il candidato su dati reali nel commit
`ec3ad696a97bac942d1646dd8d6ca09a23cf7f7a`, branch
`codex/r2-r3-g3b-g4-evidence-2026-09-12`: 471 contribution, 508 game e 9.689
eventi wire. Il limite candidato Research diventa **33 contribution** e
**256 KiB effettivi** per richiesta.

## 2. Baseline e fonti

Preflight live prima delle scritture:

| repository/ref | atteso | GitHub | locale |
|---|---|---|---|
| `mox-core/main` | `f80367f05b028c378739e2e8e93d49a2010c33a6` | stesso | stesso, pulito |
| G3A | `3730a11e3eca9cbeefbffb9ea01a1c1ca5946d04` | stesso | figlio singolo del main, due soli file |
| `moxtracker/main` | `f897a9431cc2d9eaede62a7fdbcbb4a9870282bb` | stesso | stesso, pulito |

I branch macro non esistevano localmente né sul remoto e `LAVORI.md` non
conteneva lavori Research concorrenti. La worktree G3B nasce direttamente da
`moxtracker/main` sul branch
`codex/r2-r3-g3b-g4-server-fitgap-2026-09-12`.

Fonti lette o verificate:

- contratto e golden G3A, integralmente;
- `src/controlli.js`, `src/index.js`, `src/account.js`, `src/draft.js`;
- `schema.sql`, lifecycle export/delete/revoca e test server/account/Draft;
- report G4 e misure temporanee riproducibili.

Le proposte precedenti restano contesto, non fonte normativa. G3B non modifica
i due artefatti G3A.

## 3. Difetti correnti riprodotti

Un harness transitorio ha usato il Worker reale e SQLite in-memory tramite il
finto D1 della suite. Il file non viene committato.

| caso | osservato sulla baseline | impatto Research |
|---|---|---|
| due mittenti, stesso match | prima richiesta accettata; seconda `gia_presenti`; 1 riga match ma 2 righe contributor | la seconda prospettiva scompare; identità match e contribution confuse |
| retry byte-identico | seconda richiesta ignorata da `INSERT OR IGNORE` | idempotenza solo accidentale e senza classificazione per elemento |
| incompleto → completo | seconda richiesta `gia_presenti`; `turni` resta unknown nel JSON e nella riga | nessuna late completion monotona |
| JSON/proiezioni | JSON conserva il deck vecchio; la tabella carte aggiunge una carta nuova ma conserva le vecchie copie | stato impossibile, JSON vecchio e proiezioni nuove |
| consenso corrente `false` | `/partite` accetta ugualmente | il consenso account non è un gate di upload |
| delete → retry | delete porta le righe a zero; lo stesso pacchetto viene poi accettato come nuovo | resurrezione della coda tardiva |
| segreto raw | assente dal JSON persistito; presente solo il suo SHA-256 | comportamento esistente riusabile |

La causa è strutturale:

- `partite.id` è primary key globale del match legacy, non della contribution;
- `salva()` usa `INSERT OR IGNORE` separatamente per JSON e proiezioni;
- non esiste un join dei campi né uno stato di conflitto assorbente;
- il validator accetta solo v1/v2, non è chiuso agli extra field e usa la sola
  dichiarazione `Content-Length` per il limite byte;
- la risposta aggrega conteggi, non restituisce un esito per contribution;
- `account_dispositivo` conserva soltanto i booleani correnti
  `consenso_partite` e `consenso_draft`;
- la cancellazione elimina anche il contributor/verificatore e non lascia una
  barriera per le vecchie richieste.

Questi sono gap del server legacy. Non sono una divergenza degli input
semantici G3A e non costituiscono `BLOCKER G3A`.

## 4. Route e limiti candidati

### 4.1 Separazione dal legacy

Il candidato è:

```text
POST /research/partite
Content-Type: application/json
X-Mox-Research-Consent-Generation: <token opaco raw>
```

La route `/partite` continua ad accettare e interpretare soltanto v1/v2 con la
semantica corrente durante la transizione. Nessun campo v3 viene ignorato o
tradotto nel legacy; nessun downgrade v3→v2 è ammesso. La policy di eventuale
deprecazione resta separata.

Il nuovo header richiede un aggiornamento CORS esplicito. Il token raw della
generazione non entra in log, storage, risposta o export: il server conserva
soltanto SHA-256.

### 4.2 Limiti dopo G4

- massimo **33 contribution** per richiesta Research;
- massimo **262.144 byte** del body effettivamente letto;
- rifiuto `413` al superamento di uno dei due limiti;
- quote per mittente/generazione con `429`, separate dal limite legacy;
- `Content-Length` è un fast reject, non la prova della dimensione: body senza
  header o con header falso viene comunque contato durante la lettura.

G4 ha misurato nel worst case osservato 44 elementi / 260.933 byte sotto il
tetto rigido e 33 / 206.803 byte sotto l'80%. Cinquanta contribution grandi
pesano 289.436 byte e 200 arrivano a 863.826 byte. Il vecchio massimo 200 non è
quindi compatibile col nuovo payload.

## 5. Validator Research chiuso

Il validator v3 è nuovo e ricorsivamente closed: a ogni livello l'insieme delle
chiavi ammesse è esatto. `null`, proprietà sconosciute, tipi errati, liste
vuote non autorizzate e campi GRE/locali producono rifiuto; non vengono
silenziosamente eliminati.

Regole server necessarie oltre ai tipi G3A:

- un envelope, un `mittente`, una generazione di consenso e almeno una
  contribution;
- `versione === 3`, `mittente` 32 hex, deletion secret 64 hex e marker consenso
  con il solo intero `versione >= 1`;
- `games` non vuoto, `game_number` univoco e strettamente ordinabile dentro la
  contribution;
- `opening_hand_size === len(opening_hand_kept)`;
- `sideboard_in` e `sideboard_out` presenti insieme; `compared_to_game` è il
  game immediatamente precedente e compare solo per `sideboard_submission`;
- `event_id` 64 hex, univoco nella prospettiva di game e coerente col tipo del
  contenitore; la formula viene ricalcolata solo se il server riceve un proof
  preimage, che G3A vieta. Il server quindi tratta l'id come chiave opaca e
  rileva collisioni dal payload incompatibile; la responsabilità di derivarlo
  resta al client verificato;
- nessun `_copertura`, `_eventi_provenienza`, raw match ID, annotation,
  fingerprint archivio, nome/id avversario o testo libero non previsto;
- `segreto_cancellazione` viene tolto dall'oggetto prima di qualunque
  serializzazione, log o storage.

Un errore di envelope è `400`. In un envelope valido, una contribution non
conforme produce `rejected` per quell'elemento e non impedisce le altre.
Contribution duplicate della stessa identità nello stesso batch vengono
raggruppate e unite commutativamente prima della transazione; la risposta
riporta gli indici input coinvolti, così il risultato non dipende dal loro
ordine o raggruppamento.

## 6. Risposta batch congelata

Forma candidata:

```json
{
  "versione": 1,
  "risultati": [
    {
      "id_pubblico": "<64 hex>",
      "input_indices": [0],
      "stato": "accepted_new"
    }
  ]
}
```

`stato` ammette esattamente:

- `accepted_new`: prima contribution per `(mittente, id_pubblico)`;
- `unchanged`: join identico allo stato già conservato;
- `enriched`: aggiunge fatti noti o massimi/OR senza conflitti;
- `conflict`: introduce o conferma un conflitto assorbente; nessun winner per
  ordine di arrivo;
- `rejected`: errore permanente della singola contribution;
- `retryable`: guasto transitorio isolato alla transazione dell'elemento.

`motivo_codice` può comparire per `conflict`, `rejected` e `retryable`, da un
catalogo chiuso; nessun errore interno o valore privato viene restituito.

Una richiesta con envelope valido restituisce HTTP `200` anche con risultati
misti. Gli errori fuori dal singolo elemento sono:

| HTTP | significato |
|---:|---|
| 400 | JSON/envelope/header strutturalmente non leggibile o chiavi envelope extra |
| 403 | deletion secret incoerente, consenso assente/revocato/versione errata o generazione tombstoned |
| 413 | oltre 33 contribution o 256 KiB effettivi |
| 429 | quota/rate limit |
| 500 | guasto server non classificato |
| 503 | dipendenza/storage temporaneamente indisponibile; nessuna assunzione sul commit |

Se l'infrastruttura fallisce prima che siano noti gli esiti delle transazioni,
si usa `503`, non una lista inventata di `retryable`. Ogni transaction outcome
deve essere noto prima di rispondere.

## 7. Join B3

Il join è applicato per `(mittente, id_pubblico)` e poi per
`(mittente, id_pubblico, game_number)`:

| stato prima | osservazione | stato dopo |
|---|---|---|
| assente | noto | noto, `enriched` o `accepted_new` |
| noto | assente | noto invariato |
| noto | stesso noto | noto invariato |
| noto | noto incompatibile | campo omesso dall'effettivo + conflitto assorbente |
| conflitto | qualunque | conflitto; nessuna riabilitazione per arrivo successivo |

Eccezioni monotone decise in G3A:

- `turni = max`;
- `state_reset_observed` e `state_gap_observed` usano OR;
- eventi in unione per `event_id`;
- stesso `event_id` e payload uguale è idempotente;
- stesso `event_id` e tipo/turno/carta incompatibile è conflitto;
- deck, sideboard, opening hand e delta sono unità atomiche: non si compongono
  liste mai osservate;
- due mittenti sullo stesso `id_pubblico` restano due contribution. Le metriche
  match-level deduplicano su `research_match`; le metriche player-level
  dichiarano esplicitamente l'unità contribution/player-game.

L'esito del join deve essere lo stesso per tutte le permutazioni e per batch
diversi. L'implementazione R3 dovrà aggiungere property test/permutation test,
non soltanto esempi ordinati.

## 8. Storage candidato, non eseguibile

Il payload canonico e tutte le proiezioni di una contribution devono diventare
visibili nella **stessa transazione D1**. Schema logico candidato:

| tabella | identità / contenuto |
|---|---|
| `research_match` | PK `id_pubblico`; una riga per denominatore match-level |
| `research_contribution` | PK `(mittente,id_pubblico)`; payload effettivo canonico, hash, generazione consenso, stato conflitto |
| `research_game` | PK `(id_pubblico,game_number)`; sola identità del game match-level |
| `research_game_contribution` | PK `(mittente,id_pubblico,game_number)`; fatti scalari della prospettiva |
| `research_event` | PK `(mittente,id_pubblico,game_number,event_type,event_id)`; turno e carta |
| `research_deck_card` | PK `(mittente,id_pubblico,game_number,sezione,card_id)`; copie positive |
| `research_sideboard_delta` | PK `(mittente,id_pubblico,game_number,direzione,card_id)`; copie, senza perdere molteplicità |
| `research_field_conflict` | PK prospettiva/game/path; hash ordinato dei candidati, mai winner per arrival order |
| `research_consent_generation` | PK hash generazione; mittente, versione, stato e date; raw assente |
| `research_consent_tombstone` | PK hash generazione; data/motivo minimizzati, nessun match o payload |

Le foreign key logiche devono impedire eventi/deck senza la rispettiva
prospettiva. Indici minimi: contribution per mittente/data; match per periodo e
formato quando noti; evento per tipo/carta; deck card per sezione/carta. Gli
indici analitici non devono trasformare le contribution di due utenti in due
match.

Il conflitto è distinto dall'unknown: il payload effettivo omette il valore
conteso, mentre `research_field_conflict` conserva soltanto impronte canoniche
ordinate sufficienti a rendere il conflitto assorbente. Export e diagnostica
espongono lo stato semantico, non i digest interni.

### 8.1 Riscontro G4

Sul corpus corrente:

- contribution media 3.332 byte, p95 5.379, max 7.983;
- game medio 2.628 byte, max 7.291;
- 9.689 righe evento, 11.511 deck-card, 508 game e 471 contribution;
- stima logica corrente: 1.635.018 byte per le righe contribution con payload,
  2.602.038 per eventi e 2.177.219 per deck-card;
- estrapolazione a un milione di contribution: circa 48,15 milioni di righe e
  14,18 GB di JSON logico non compresso, esclusi indici/WAL.

Il massimo per singola contribution sostiene D1 per l'atomicità iniziale; non
emerge un motivo dimensionale per spezzare subito payload e proiezioni fra D1
e R2. L'estrapolazione a grande scala impone però una verifica di capacità,
retention e indici prima del deploy. R2 object storage resta alternativa solo
con commit marker/riconciliazione che non renda mai visibili JSON e proiezioni
di versioni diverse.

## 9. B4 — consenso, segreti e non-resurrezione

### 9.1 Generazione del consenso

Il consenso Research è separato dai booleani legacy. Dopo un sì esplicito nel
client, una route dedicata registra versione e mittente e restituisce una
generazione opaca ad alta entropia. Il server conserva solo
`SHA-256(generazione)`; il raw resta al client e attraversa l'header di upload.

Per accettare una richiesta devono coincidere:

1. hash della generazione attiva;
2. `mittente` associato;
3. `consenso_research.versione` del payload;
4. verificatore del deletion secret della stessa installazione.

Il payload di upload non crea consenso. Un account è facoltativo: se presente,
il binding al dispositivo viene conservato, ma l'identità Research primaria
resta il mittente pseudonimo. Una nuova adesione esplicita dopo revoca/delete
riceve una generazione nuova.

### 9.2 Segreto di cancellazione

Si riusa il comportamento esistente per un segreto raw di 256 bit:

- raw ammesso nella richiesta come credenziale write-only;
- rimozione prima di qualunque copia del payload;
- solo SHA-256/verificatore server, confronto costante e binding al mittente;
- raw vietato in log, storage, risposta, export, errori e tracing.

Il verificatore non è il segreto raw. Un KDF da password non aggiunge valore a
un token casuale di questa entropia; la condizione è che la generazione client
resti crittograficamente casuale e non derivata da nome/account.

### 9.3 Revoca, delete e tombstone

- revoca consenso: blocca nuovi upload e conserva i dati già raccolti;
- delete sezione/contributi/account: dentro il lifecycle coordinato crea prima
  il tombstone per ogni generazione, poi elimina payload, proiezioni, conflitti,
  indici e binding;
- retry con vecchia generazione: `403`, nessuna scrittura;
- nuova adesione esplicita: nuova generazione, quindi può creare nuovi dati;
- semplice scollegamento del dispositivo dall'account: non equivale né a
  revoca consenso né a delete.

La chiave concreta del tombstone G3B è l'hash della generazione consenso, non
`id_pubblico`, non il mittente e non il deletion secret. La riga conserva solo
hash, data e motivo tecnico. Resta senza scadenza finché non esiste un TTL
massimo vincolante della coda client: cancellarla prima riaprirebbe la
resurrezione arbitrariamente tardiva. Questa retention minimizzata deve essere
esplicitata nella valutazione privacy prima del deploy.

Export account deve includere payload Research effettivo e conflitti/incomplete
semantici per tutte le generazioni associate, ma escludere deletion secret,
verificatori, token/hash consenso e tombstone. Delete sezione e delete account
devono essere protetti dalla stessa prova anti-regressione che oggi censisce le
tabelle account.

## 10. Self-red-team del design

| caso | esito richiesto |
|---|---|
| retry byte-identico | `unchanged`, zero righe nuove |
| incompleto → completo | `enriched`, stessa contribution/game |
| completo → incompleto tardivo | known preservato |
| due noti incompatibili | `conflict` assorbente, nessun winner |
| due eventi stessa carta/turno | entrambi, perché `event_id` distinto |
| stesso evento riemesso | una sola riga |
| stesso `event_id`, payload diverso | conflitto, evento conteso fuori dalle proiezioni |
| duplicate identity nello stesso batch | join commutativo, un risultato con tutti gli indici input |
| due mittenti stesso match | un match, due contribution, nessun overwrite |
| batch misto valido/rotto | HTTP 200 con esiti per elemento |
| body senza/falso `Content-Length` | conteggio byte reale e `413` |
| extra field annidato | `rejected`, mai ignorato |
| revoca consenso | `403`, dati esistenti invariati |
| delete seguito da retry | tombstone → `403`, zero resurrezione |
| nuova adesione dopo delete | nuova generazione; nuovi dati consentiti esplicitamente |
| raw secret/token | assente da DB, log, export e risposta |
| guasto prima dell'outcome | `503`, nessun esito inventato |
| v1/v2 | route e semantica legacy invariati durante la transizione |

## 11. Classificazione B3/B4 e condizioni

### B3 — idempotenza, late completion, conflitti e atomicità

**READY FOR R3 IMPLEMENTATION.** Identità, join, risultato batch, tabelle,
vincoli e confini transazionali sono definiti. Le condizioni di implementazione
sono:

- provare proprietà commutativa, associativa e idempotente su permutazioni;
- provare atomicità reale D1 e rollback di payload/proiezioni;
- misurare numero di statement e indici col batch 33;
- verificare capacità/retention prima di una scala incompatibile con D1.

### B4 — consenso e lifecycle

**READY FOR R3 IMPLEMENTATION.** Generazione, binding, raw/verificatori,
revoca, delete, re-consenso e tombstone sono distinti. Le condizioni sono:

- definire e provare la route separata che emette/revoca la generazione dopo il
  consenso esplicito del client;
- threat model del token/header e confronto costante;
- prova end-to-end che export/delete/account coprano ogni nuova tabella;
- approvazione privacy della retention senza scadenza del solo hash tombstone,
  oppure introduzione futura di un TTL coda realmente vincolante.

Nessuna di queste condizioni cambia il wire G3A; sono gate dell'implementazione
e del deploy.

## 12. Verifiche e verdetto finale

- harness B3/B4 SQLite in-memory: **PASS**, con tutti i difetti legacy attesi
  riprodotti e nessun dato reale;
- suite completa `moxtracker` con `npm run prove`: **191/191 PASS**;
- G4 reale: **PASS WITH CONDITIONS**, commit
  `ec3ad696a97bac942d1646dd8d6ca09a23cf7f7a`;
- G4: 157/157 regressioni telemetria, packet legacy 690 byte/versione 2,
  proiezione 2/2 deterministica;
- nessuna modifica funzionale, SQL, migrazione, golden, packet o deploy.

**Verdetto G3B: PASS WITH CONDITIONS.**

**Verdetto macro G3B+G4: READY FOR G5 independent adversarial review.**

G5 e R3 non vengono avviati. L'implementazione R3 resta vietata finché la
review indipendente non chiude le condizioni sopra.
