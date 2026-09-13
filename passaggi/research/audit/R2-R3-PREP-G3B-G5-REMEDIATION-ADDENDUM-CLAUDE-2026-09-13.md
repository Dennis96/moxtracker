# R2 → R3-PREP — Addendum G3B dopo G5 (remediation)

Data: 13/09/2026

Autore: Claude, stessa sessione della review G5.

Stato: **proposta di requisiti server**, da sottoporre alla verifica
indipendente mirata G5b. Nessun endpoint, schema eseguibile, migrazione o
deploy. R3 non è aperto.

Base: `codex/r2-r3-g3b-g4-server-fitgap-2026-09-12` a
`95e579f48cd772edc144d3b6606e22a20aa63629`.

Questo addendum traduce in requisiti server l'addendum G3A dopo G5, che sta
in `mox-core` sul branch `claude/r2-r3-g5-remediation-2026-09-13`
(`passaggi/research/proposte/R2-R3-PREP-G3A-G5-REMEDIATION-ADDENDUM-CLAUDE-2026-09-13.md`).
**Non riscrive** il report G3B: dove le due cose divergono vale questo
addendum, per i paragrafi indicati; il resto di G3B resta valido. Le misure
citate vengono dal corpus reale in sola lettura
(`passaggi/research/audit/R2-R3-PREP-G4-G5-REMEDIATION-DELTA-MEASUREMENTS-CLAUDE-2026-09-13.md`
in `mox-core`).

## 1. Esito in breve

| tema | sostituisce | stato |
|---|---|---|
| join v2 | G3B §7 | DESIGN CLOSED |
| conflitti nello storage | G3B §8, `research_field_conflict` | DESIGN CLOSED |
| M1 concorrenza | nuovo | DESIGN CLOSED + MANDATORY R3 ACCEPTANCE CRITERION (D1 remoto) |
| M2 prova del consenso | G3B §9.1 | DESIGN CLOSED |
| M3 anti-resurrezione | G3B §9.3 | DESIGN CLOSED (decisione di prodotto dichiarata) |
| M4 delete/export | G3B §8-§9 | DESIGN CLOSED + censimento obbligatorio in R3 |
| M5 validator e abuso | G3B §4.2, §5 | DESIGN CLOSED |
| M6 più mittenti | G3B §7 ultima voce | DESIGN CLOSED (semantica dichiarata) |
| M7 conflitto recuperabile | G3B §8 | DESIGN CLOSED |
| M8 budget D1 | G3B §4.2 | budget statico qui; misura remota = MANDATORY R3 ACCEPTANCE CRITERION |
| semantica del batch | G3B §5-§6 | DESIGN CLOSED |

## 2. Join v2 (sostituisce G3B §7)

Il server **non** unisce campo per campo. Per ogni contribution
`(mittente, id_pubblico)` conserva la snapshot con la revisione massima
`(modello, osservazioni)` e l'insieme delle varianti canoniche a quella
revisione (addendum G3A §5.1).

| arrivo | esito | scrittura |
|---|---|---|
| prima snapshot valida | `accepted_new` | snapshot + proiezioni |
| revisione minore della conservata | `stale` | nessuna |
| revisione maggiore, stesso `modello`, classi rispettate | `updated` | sostituzione atomica |
| revisione maggiore, stesso `modello`, classe violata | `rejected` (`regressione_non_dichiarata`) | nessuna |
| revisione maggiore, `modello` maggiore | `updated` | sostituzione atomica, nessun controllo di classe |
| stessa revisione, stesso `J` | `unchanged` | nessuna |
| stessa revisione, `J` diverso | `conflict` | variante aggiunta; niente proiezioni finché una revisione maggiore non risolve |

- Le classi di monotonia per campo sono quelle dell'addendum G3A §5.2. Sono
  transitive, quindi basta confrontare la nuova snapshot con quella conservata.
- Due elementi dello stesso batch con la stessa identità si trattano come due
  arrivi: vince la revisione maggiore, e a parità con contenuto diverso nasce il
  conflitto. Sostituisce "raggruppati e uniti commutativamente" di G3B §5.
- Le proiezioni derivano soltanto dalla snapshot effettiva e si riscrivono per
  intero nella stessa transazione: nessuno stato con snapshot e proiezioni di
  revisioni diverse.

## 3. Conflitti nello storage

- I marcatori `conflicted_fields`, `conflicted_event_ids` e `campi_contesi`
  vivono dentro la snapshot. `research_field_conflict` di G3B non serve più per
  i conflitti di campo.
- Le proiezioni escludono i gruppi e le occorrenze contese; l'unknown resta
  distinto dal conteso anche nelle interrogazioni, perché il marcatore c'è.
- L'export mostra "conteso" per gruppo o `event_id`; nessun valore candidato
  arriva al server.

## 4. Concorrenza ottimistica (M1)

1. Lettura: snapshot conservata, revisione, versione server corrente `v`.
2. Decisione dell'esito (§2) calcolata nel Worker.
3. Batch D1, **primo statement**: inserimento di `(mittente, id_pubblico, v+1)`
   in una tabella con chiave primaria su tutti e tre i campi. Seguono upsert
   della snapshot, storia (M7) e proiezioni.
4. Se un altro Worker ha già scritto `v+1`, l'inserimento viola la chiave e
   `batch()` annulla l'intera sequenza (documentazione D1: i batch sono
   transazioni SQL con rollback dell'intera sequenza).
5. Rilettura e ricalcolo: la snapshot perdente diventa `stale`, `updated` o
   `conflict` secondo §2. Al massimo 3 tentativi, poi `retryable`.

Evidenza: H3 (G5) e H8 riproducono la perdita senza CAS e l'esito corretto con
CAS (una snapshot `(1,2)` scritta dopo una `(1,3)` diventa `stale`, non
sovrascrive). **MANDATORY R3 ACCEPTANCE CRITERION**: prova su D1 remoto che la
violazione della chiave dentro `batch()` annulla anche gli statement
precedenti; prova con interlacciamento forzato di due richieste.

## 5. Prova del consenso (M2, sostituisce G3B §9.1)

| route | corpo | prova | effetto |
|---|---|---|---|
| `POST /research/consenso` | `mittente`, `segreto_cancellazione`, `versione_consenso` | possesso del segreto | emette una generation; il token raw torna **una sola volta**, il server conserva SHA-256 |
| `POST /research/consenso/revoca` | `mittente`, `segreto_cancellazione` | possesso del segreto | generation `revocata`; dati conservati |
| `POST /research/elimina` | `mittente`, `segreto_cancellazione` | possesso del segreto | tombstone, poi delete (§7) |

- **Verificatore Research proprio** (`research_verificatore`: mittente, SHA-256
  del segreto, data), con un ciclo di vita suo: il delete della sezione partite
  o Draft non lo tocca. Quando si emette:
  - se esiste, confronto a tempo costante;
  - se manca e il mittente ha verificatori legacy (`contributori` nei due
    database), devono coincidere tutti, come fa oggi `collegaMox`;
  - se non ne esiste nessuno, il primo segreto valido si lega (**TOFU**
    dichiarato).
- **Upload**: `Authorization: Bearer <generation>`, al posto dell'header custom
  di G3B §4.1 (G5-m6). Devono coincidere generation attiva, mittente, versione
  del consenso e verificatore.
- Nessun CORS sulle route Research: il client è desktop.
- Rate limit sull'emissione: per origine di rete e per mittente.
- **Criterio client obbligatorio**: la generation si chiede solo dopo il sì
  esplicito dell'utente; un `403` non provoca mai una richiesta automatica di
  generation.

## 6. Anti-resurrezione (M3, sostituisce G3B §9.3 per la parte "nuova adesione")

**Decisione**: una generation copre soltanto i match con
`quando >= creata − 10 minuti`, dove `creata` è l'istante server di emissione e
10 minuti è la tolleranza per l'orologio del client. Di conseguenza `quando`
diventa **obbligatorio** per le contribution Research: senza, la contribution
viene rifiutata (`senza_quando`).

| tentativo dopo delete + nuovo sì | esito |
|---|---|
| ritento con la generation cancellata | `403` (tombstone) |
| vecchia coda con la generation nuova | `rejected: fuori_consenso` |
| rilettura dello storico locale | `rejected: fuori_consenso` |
| late completion di un match cancellato | `rejected: fuori_consenso` |
| secondo mittente con lo stesso storico | `rejected: fuori_consenso` |
| match giocato dopo il nuovo sì | `accepted_new` |

- **Invarianti client**:
  - revoca e delete svuotano la coda Research;
  - ogni elemento in coda porta la generation attiva a fine match e non viene
    mai rietichettato;
  - nessun recupero dello storico precedente al consenso.
- **Privacy**: nessun dato nuovo, perché `creata` serve comunque e `quando` è
  già nel payload. Il tombstone resta minimo (hash, data, motivo) e senza
  mittente.
- **Costo dichiarato**: la late completion di un match giocato sotto una
  generation revocata non passa più dopo un nuovo consenso.
- Match del corpus reale senza `quando`: **0 su 473** (G4 delta §5): la
  regola non fa perdere nessun dato osservato.

## 7. Delete ed export (M4)

Tabelle logiche (nessuno schema eseguibile):

| tabella | chiave | contenuto | export | delete sezione/account/`/contributi/elimina` | revoca |
|---|---|---|---|---|---|
| `research_contribution` | mittente, id_pubblico | snapshot effettiva, revisione, stato conflitto, hash generation, ricevuta, `mox` | snapshot | sì | conservata |
| `research_snapshot_storia` | mittente, id_pubblico, revisione, hash | fino a 2 snapshot superate e 3 varianti in conflitto (M7) | sì | sì | conservata |
| `research_revisione_server` | mittente, id_pubblico, versione | righe CAS (M1) | no | sì | conservata |
| `research_game_contribution` | mittente, id_pubblico, game_number | proiezione | via snapshot | sì | conservata |
| `research_event` | mittente, id_pubblico, game_number, event_id | proiezione | via snapshot | sì | conservata |
| `research_deck_card` | mittente, id_pubblico, game_number, sezione, carta | proiezione | via snapshot | sì | conservata |
| `research_sideboard_delta` | mittente, id_pubblico, game_number, direzione, carta | proiezione con copie | via snapshot | sì | conservata |
| `research_consent_generation` | hash | mittente, versione, stato, creata, revocata | versione e date, **senza hash** | dopo il tombstone | stato `revocata` |
| `research_consent_tombstone` | hash | data, motivo | no | resta (eccezione dichiarata) | — |
| `research_verificatore` | mittente | hash del segreto, data | no | per ultimo | conservato |
| contatori di quota | mittente o generation | conteggi | no | sì | conservati |

- **Tolte rispetto a G3B**: `research_match` e `research_game`. Non portavano
  fatti, e i denominatori match-level sono `COUNT(DISTINCT id_pubblico)` sulle
  contribution. Così non ci sono righe condivise e non restano orfani.
- **Ordine del delete**: tombstone, proiezioni, storia, contribution, righe
  CAS, generation, verificatore per ultimo. Le credenziali escono per ultime,
  come in `eliminaMittente`, così un guasto a metà resta ripetibile.
- Delete account, sezione e `/contributi/elimina` includono Research.
- **Censimento obbligatorio in R3**: una prova che rilegge lo schema e pretende
  che ogni tabella `research_*`, o con colonna `mittente`, sia nell'elenco di
  cancellazione Research, con l'unica eccezione del tombstone. Il censimento
  attuale guarda solo `account_id`.
- **Backup e Time Travel D1**: un ripristino riporta dati cancellati. Serve una
  procedura prima del deploy che, dopo un ripristino, riapplichi i delete
  successivi al punto ripristinato.

## 8. Validator e abuso (M5, sostituisce G3B §4.2 e §5)

| livello | regola | esito |
|---|---|---|
| body | byte **letti** ≤ 262.144, contati sullo stream; `Content-Length` solo per il rifiuto rapido | `413` |
| busta | chiavi esatte; `versione = 4`; `mox` `^[0-9A-Za-z .+_-]{1,40}$`; `mittente` 32 hex; segreto 64 hex; `consenso_research = {versione ≥ 1}` | `400` |
| busta | `partite` da 1 al massimo di §11 | `400` / `413` |
| contribution | chiavi esatte a ogni livello; nessun `null`; interi JavaScript sicuri | `rejected` |
| contribution | `games` 1..5, `game_number` 1..5 strettamente crescente | `rejected` |
| game | eventi per tipo ≤ 200, per game ≤ 400; `turno` 1..500; `card_id` 1..9.999.999; `event_id` 64 hex unico nel game | `rejected` |
| game | mano 0..7 e `opening_hand_size = len(kept)`; mulligan e bottom 0..7 | `rejected` |
| game | `deck.main` 1..250 voci, copie 1..250, somma ≤ 250; `deck.sideboard` 0..250 | `rejected` |
| game | delta in coppia, ordinati, coerenti con i due `main` adiacenti; `compared_to_game` adiacente | `rejected` |
| game | marcatori ordinati, non vuoti, nessun membro presente se conteso | `rejected` |
| match | `avversario.carte` 1..200, ordinate; `rank` sezioni non vuote e interi 0..100.000 | `rejected` |
| stringhe | `evento` `^[A-Za-z0-9_.:-]{1,80}$`, `formato` `^[A-Za-z0-9_ -]{1,40}$`, `arena` `^[0-9A-Za-z._-]{1,40}$`, `mulligan_type` `^[A-Za-z_]{1,40}$`, `rank.classe` `^[A-Za-z]{1,20}$`; nessuna stringa con forma di UUID | `rejected` |

- **Abuso**: il limite di count non è la difesa. Servono un rate limit per
  origine di rete (binding Cloudflare, come quello dei ticket), una quota
  giornaliera per mittente (300 contribution, come il legacy) e una quota per
  generation. Mittente e segreto nascono gratis sul client, quindi la quota per
  mittente da sola non basta.
- Massimi osservati nel corpus reale (G4 delta §9), tutti sotto i limiti:
  - 3 game per contribution e 63 eventi per game (al massimo 27 pescate, 23
    lanci, 13 terre);
  - turno 43;
  - 77 voci e 99 copie nel main, 19 copie nel sideboard;
  - 27 carte avversarie;
  - mano 7, che coincide con la regola di Arena e non è un valore preso dal
    corpus.

## 9. Più mittenti, stessa persona (M6)

- **Unità statistica**: la contribution. Non c'è una deduplica "per persona"
  senza un'identità affidabile, e non si finge di averla.
- Vista account: le contribution dei mittenti collegati si raggruppano; se due
  mittenti collegati hanno lo stesso `id_pubblico`, nella vista account quel
  match conta una volta e porta un avviso.
- Metriche globali: dichiarano l'unità e riportano come indicatore di qualità
  il numero di `id_pubblico` con più contribution dalla stessa prospettiva,
  cioè stesso `result` su tutti i game noti.
- La regola di §6 impedisce di ricaricare lo storico con un mittente nuovo:
  resta solo il caso raro di due installazioni attive nello stesso momento.

## 10. Conflitto recuperabile (M7)

- Si conservano la snapshot effettiva, fino a 2 snapshot superate e, in un
  conflitto di revisione, fino a 3 varianti. Ognuna porta revisione, `mox` e
  data di ricezione, con lo stesso ciclo di vita di export e delete. Niente GRE
  grezzo.
- **Ricalcolo dopo un bug client**: il client corretto alza `modello`, rilegge
  gli archivi e reinvia; il server sostituisce senza controllo di classe. La
  storia permette la diagnosi e un eventuale ripristino manuale documentato.

## 11. Budget D1 (M8)

Conteggio statico per contribution:

- 1 lettura;
- nel batch: 1 CAS, 1 upsert della snapshot, 1 riga di storia e 4 cancellazioni
  di proiezioni;
- INSERT multi-riga entro 100 parametri per statement: 16 righe game, 14
  eventi, 16 voci di mazzo e 16 righe di delta per statement.

Per richiesta si aggiungono circa 4 query di autenticazione e quota.

| misura sul corpus reale (G4 delta §8) | valore |
|---|---:|
| statement per contribution, min / media / p95 / max | 10 / 11,93 / 14,4 / 17 |
| richiesta peggiore da 33: statement, letture e autenticazione | 537 |
| la stessa richiesta se ogni `batch()` conta come una sola query | 70 |

- **Workers Paid**: con 33 contribution la richiesta peggiore usa il 54% del
  budget di 1.000 query, anche se ogni statement contasse come query. **Limite
  raccomandato: 33 contribution e 256 KiB di byte letti.**
- **Workers Free** (50 query), se ogni batch conta come una query: al massimo
  23 contribution per richiesta, cioè (50 − 4) / 2.
- Batch peggiore del corpus: 207.163 byte per 33 contribution (G4 delta §7).

Limiti documentati (Cloudflare, 13/09/2026): 1.000 query per invocazione su
Workers Paid, 50 su Free; 100 parametri e 100 KB per statement; 30 s per query;
10 GB per database. Il piano del progetto è **n.d.** dal repository.

**MANDATORY R3 ACCEPTANCE CRITERION**: misura su runtime Workers reale di
query, CPU e latenza con il batch peggiore; pubblicazione dei limiti effettivi
in `/salute` (`research: {max_contribution, max_byte}`); client che compone i
batch per byte stimati **e** per count.

## 12. Semantica del batch

- Una transazione per contribution; esiti per elemento; HTTP `200` con esiti
  misti.
- Errori fuori dal singolo elemento, come G3B §6: `400`, `403`, `413`, `429`,
  `503`. Il `503` si usa quando l'esito di un commit non è noto; il ritento è
  idempotente.

| esito | significato | client |
|---|---|---|
| `accepted_new`, `updated`, `unchanged`, `stale` | il server ha la snapshot o una più recente | toglie dalla coda |
| `conflict` | due varianti alla stessa revisione | toglie dalla coda e registra la diagnostica: è un difetto del client |
| `rejected` | permanente: `motivo_codice` da catalogo chiuso (`regressione_non_dichiarata`, `fuori_consenso`, `senza_quando`, validator) | toglie dalla coda e conserva il motivo |
| `retryable` | guasto transitorio isolato | ritenta con backoff |

## 13. Che cosa resta di G3B

Resta tutto quello che non è sostituito sopra: la route separata dal legacy;
il legacy invariato; la generation opaca con conservazione del solo hash; il
tombstone per generation; il segreto raw write-only; revoca e delete
distinti; esiti per elemento; `503` quando il commit non è noto.

## 14. Criteri di accettazione R3

1. Property test del join v2: permutazioni, raggruppamenti, idempotenza;
   ogni stato è una snapshot valida.
2. Classi di monotonia: nessun falso rifiuto sulle sequenze reali (G4 delta)
   e rifiuto delle regressioni sintetiche.
3. CAS su D1 remoto e interlacciamento forzato (§4).
4. Emissione, revoca e delete con segreto giusto e sbagliato; TOFU;
   verificatore indipendente dai delete legacy; nessuna emissione automatica.
5. Resurrezione: tutti i tentativi di §6 con esito atteso.
6. Censimento delle tabelle e prova end-to-end di export e delete tabella per
   tabella.
7. Validator: ogni riga di §8 con un caso che passa e uno che fallisce;
   payload ai massimali; corpo senza `Content-Length` o con valore falso.
8. Nessun token, segreto o corpo nei log (spia sui log reali).
9. Budget D1 misurato (§11).
10. Vettori della golden rev2 riprodotti dal client.

## 15. Verifiche eseguite in questo addendum

- `npm run prove` su questa worktree (Node 24.19.0): **191/191**, 0 falliti,
  0 saltati. Il diff di questo branch contiene soltanto questo documento.
- Nessun file `src/**` modificato; nessun SQL eseguibile; harness temporanei
  non committati (H3 per il CAS in G5; H8 per il modello rev2, CAS e
  anti-resurrezione, 40/40).
