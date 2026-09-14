# R2 → R3-PREP — G3B addendum dopo G5c remediation

Data: 14/09/2026

Stato: **server-design candidato per final targeted independent recheck;
nessuna implementazione R3**

Questo documento traduce nel server le correzioni G5C-01, G5C-02 e G5C-04.
Sostituisce soltanto budget M8, guardia finale upload/delete e formato HMAC
dell'addendum G3B/G5b. Non contiene SQL eseguibile, migration o modifiche
`src/**`.

## 1. Esito candidato

| finding | requisito server | stato design |
|---|---|---|
| G5C-01 / M8 | execution planner unico + query budget preflight | CLOSED |
| G5C-02 | gate atomico nella transazione upload | CLOSED AT DESIGN |
| G5C-03 | accounting/rollback/CPU/latency/piano reali | MANDATORY R3 CONDITION |
| G5C-04 | encoding e vettori HMAC byte-esatti | CLOSED |

## 2. Execution planner unico

### 2.1 Piano reale, non stima

R3 deve costruire, dopo validazione e lettura dello stato, oggetti immutabili:

```text
ContributionExecutionPlan {
  outcome,
  atomic_write_batch: [operation_descriptor...]
}

ResearchExecutionPlan {
  request_read_operations,
  contribution_plans
}
```

`planContribution(validated_contribution, current_state)` decide gli stessi
operation descriptor che il writer eseguirà: guardia/CAS, snapshot, storia,
delete/insert/update delle proiezioni, omissione delle famiglie vuote e
confini dei chunk. Un descrittore produce esattamente un prepared statement.

Il writer non possiede un secondo chunker e non sintetizza statement. Riceve
il piano, prepara i descrittori nello stesso ordine e li passa a D1. I test
strumentati devono confrontare identità/numero di descrittori pianificati e
statement consegnati al binding.

### 2.2 Query cost

```text
Q_plan(request) =
    count(request_read_operations)
  + sum(count(c.atomic_write_batch) for c in contribution_plans)
```

Le read operation comprendono quelle realmente costruite per auth, quota,
lineage/suppression e pre-join. Non sono una costante `4 + N`. Ogni statement
batch conta conservativamente come una query finché la qualifica D1 remota
non congela l'accounting effettivo.

Il server completa le read necessarie e costruisce tutti i piani iniziali
prima di eseguire la prima write. Se `Q_plan` supera il budget, non scrive
nessuna contribution della request.

### 2.3 Ritiro dei numeri storici

`B_i <= 17`, `Q_worst = 4 + 18*N` e 598 non sono hard bound. `10..17` e 524
restano misure del corpus; 537 era già ritirato. Nessuno di questi valori può
comparire nel validator, planner, preflight, config o `/salute` come capacità.

Regression obbligatoria:

| request valida | byte | statement batch | query plan |
|---|---:|---:|---:|
| N=1, 141 eventi | 14.844 | 20 | 25 |
| N=33, 500 deck row ciascuna | 205.836 | 40 ciascuna | 1.357 |
| N=33 precedente + 551 eventi distribuiti | 262.068 | dal piano | 1.397 |

Il planner deve ottenere questi costi dalla lista di operation descriptor, non
da una formula dedicata al test.

## 3. Preflight e runtime policy

La configurazione Research è un unico oggetto validato, condiviso da route,
planner/preflight e `/salute`:

```text
research: {
  enabled,
  transport: 4,
  models: [1],
  max_body_bytes: 262144,
  client_payload_upper_bound: 33,
  max_contributions_per_request,
  max_d1_queries_per_request,
  runtime_qualification
}
```

Binding/config equivalenti richiesti:

```text
RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST = integer 1..33
RESEARCH_MAX_D1_QUERIES_PER_REQUEST = integer > 0
runtime_qualification = evidenza/id del binding, piano e deploy qualificati
```

Assenza, zero, negativo, booleano, stringa, non intero, count >33 o
qualification non corrispondente disabilitano le route Research. Non esiste
default permissivo.

Ordine:

1. misura stream e valida envelope/contribution;
2. verifica body e count cap;
3. costruisce ed esegue le sole read operation necessarie;
4. costruisce l'execution plan reale;
5. verifica `Q_plan <= max_d1_queries_per_request`;
6. solo allora esegue i batch pianificati.

Una request procede solo se body, count, query budget e qualification passano
tutti. Il body cap non implica query capacity; il count cap non implica query
capacity; il query budget non autorizza un body/count fuori limite.

Non viene introdotto ora un cap per-contribution: il request budget rende
bounded anche una contribution pesante, mentre quota/rate limit coprono
fairness e abuso. Un cap futuro richiede qualifica reale e non può derivare
dal corpus.

## 4. Ledger, CAS e retry

Il server mantiene per ogni request un ledger conservativo di query
consumate/riservate. Prima di inviare un batch riserva il costo completo del
piano. Un CAS perso annulla il piano: il Worker deve rileggere, riservando la
read, e chiamare di nuovo il planner sul nuovo stato.

Prima del nuovo batch verifica il costo del nuovo piano sul budget residuo.
Se insufficiente, non scrive la contribution e restituisce
`retryable: budget_d1_retry_esaurito`. Fino alla misura G5C-03, una chiamata
batch tentata consuma nel ledger il numero completo dei suoi statement anche
se fallisce presto.

Il ledger impedisce che retry o replan facciano superare il budget runtime.
Non sostituisce il CAS né il rollback transazionale.

## 5. Risposte e split client

| condizione | HTTP/esito | write |
|---|---|---|
| stream > body cap | `413 body_troppo_grande` | nessuna |
| count > cap | `413 troppi_contributi` | nessuna |
| piano iniziale > query budget | `413 budget_d1_superato` | nessuna |
| collisione CAS senza budget residuo | `200` misto, elemento `retryable: budget_d1_retry_esaurito` | nessuna per quell'elemento |
| config/qualification invalida | Research disabled in `/salute`; route fail-closed | nessuna |

Su un `413` di count/query budget il client divide il batch in metà contigue
e stabili, senza mutare contribution. `429` resta rate/quota. Una contribution
singola ancora sopra budget resta in coda con diagnostica e non viene scartata
o ritentata in loop.

`client_payload_upper_bound = 33` è soltanto composizione client. Nessun piano
Free/Paid e nessun cap 2/33 viene inferito dal repository.

## 6. G5C-02 — gate atomico upload/delete

Il precheck di generation/lineage/tombstone non autorizza il commit. Il primo
gate del batch atomico finale verifica nello stato D1 corrente:

```text
lineage.state == active
generation == active/current per lineage, consent version e verifier
suppression assente per (lineage_tag,id_pubblico)
CAS/revision == expected
```

Il gate deve fallire con un errore SQL/constraint che abortisce l'intera
transazione quando una condizione è falsa. Una lettura falsa o un update a
zero righe seguito dagli altri statement non è conforme. Gate/CAS, snapshot,
storia e tutte le proiezioni stanno nello stesso `atomic_write_batch`.

Lineage state, generation, suppression, CAS e contribution/proiezioni devono
risiedere nello stesso database/binding transazionale D1. Suddividerli fra
binding senza una primitiva atomica equivalente viola il contratto.

La transazione di mark delete cambia lineage `active -> deleting` e revoca le
generation prima del censimento. Per serializzazione:

- batch upload prima del mark: il delete lo vede nel censimento successivo;
- mark prima del batch upload: la guardia upload abortisce;
- upload che ha superato un vecchio precheck ma arriva dopo il mark: abort;
- upload CAS perdente: rilegge, ripianifica e ripassa la guardia;
- chunk delete fallito: tombstone e cancellazione rollbackano insieme;
  `deleting` continua a chiudere upload/generation.

Test R3 obbligatori: U-before-D, D-before-U, U-precheck/D-complete/U-commit,
due upload più delete, CAS retry, due delete, crash a ogni statement e
risultato incerto. Vanno eseguiti su D1 remoto; il modello locale non li
sostituisce.

## 7. G5C-04 — HMAC byte format

### 7.1 Encoding

```text
lineage_preimage =
  UTF8("mox-research-lineage-v1") || 0x00 || UTF8(mittente_lowerhex)

credential_preimage =
  UTF8("mox-research-lineage-credential-v1") || 0x00 ||
  UTF8(mittente_lowerhex) || 0x00 || HEXDECODE(segreto_lowerhex)

deleted_contribution_preimage =
  UTF8("mox-research-deleted-contribution-v1") || 0x00 ||
  RAW32(lineage_tag) || 0x00 || HEXDECODE(id_pubblico_lowerhex)
```

Regole:

- `mittente` resta 32 byte ASCII lowerhex; secret e ID diventano 32 byte raw;
- il lineage tag annidato è raw32, mai il lowerhex ASCII;
- nessun trim, case-fold o normalizzazione Unicode;
- forme wire non lowerhex canoniche vengono rifiutate;
- HMAC-SHA-256 produce raw32 internamente e lowerhex 64 in storage;
- `key_version` seleziona la key ed è salvata col tag, ma non entra nella
  preimage; `-v1` è la derivation version.

Le key version precedenti restano read/verify. La risoluzione lineage prova le
versioni supportate e conserva il record canonico; credential usa la versione
registrata; tombstone lookup copre tutte le versioni verificabili e la
rotazione usa dual-write.

### 7.2 Vettore fixture pubblico

Chiavi sintetiche, **mai produzione**:

```text
K_lineage v7 =
000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f
K_tombstone v9 =
202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f
mittente UTF8 = 0123456789abcdef0123456789abcdef
secret raw =
ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100
id_pubblico raw =
0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

Preimage e output attesi:

```text
lineage_preimage =
6d6f782d72657365617263682d6c696e656167652d7631003031323334353637383961626364656630313233343536373839616263646566
lineage_tag =
9ab646339fe5f2c0990f7639f5d3b9d1d0b915170d2af50946322a6330bd521f

credential_preimage =
6d6f782d72657365617263682d6c696e656167652d63726564656e7469616c2d763100303132333435363738396162636465663031323334353637383961626364656600ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100
credential_tag =
7e1c758c11772217592e1c8c1d8bf9771e1baed5f285bc2622b4eeeb3853ef35

deleted_contribution_preimage =
6d6f782d72657365617263682d64656c657465642d636f6e747269627574696f6e2d7631009ab646339fe5f2c0990f7639f5d3b9d1d0b915170d2af50946322a6330bd521f000123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
deleted_contribution_tag =
ea7395b97480752f2384ea3bd7d2ea5a0bf54894c416c20d6394d12c4ae8fdb0
```

R3 deve includere questi vettori e negativi raw/hex, NUL, case e key version.

## 8. G5C-03 — remote acceptance invariata

Research non viene abilitato finché R3 non ha:

1. verificato piano e binding effettivi;
2. misurato accounting reale di query/statement e `batch()`;
3. provato rollback, CAS e race upload/delete su D1 remoto;
4. misurato CPU e latenza su payload massimali e piani costosi;
5. scelto e registrato count/query budget qualificati;
6. verificato che `/salute` e route restino fail-closed su qualification
   assente, stale o divergente.

Le cifre Cloudflare ufficiali sono limiti esterni, non configurazione del
progetto. Nessun harness locale vale come prova di questi sei punti.

## 9. Invarianti e prossimo gate

Restano invariati M3 threat model, suppression permanente, key retention,
allowlist model, top-3/overflow, B1, B3, golden rev2, validator semantico,
body cap, count cap, CAS e batch per contribution.

R3 non è aperto. Il prossimo passo candidato è un final targeted independent
recheck limitato ai delta planner/preflight, gate atomico e vettori HMAC.
