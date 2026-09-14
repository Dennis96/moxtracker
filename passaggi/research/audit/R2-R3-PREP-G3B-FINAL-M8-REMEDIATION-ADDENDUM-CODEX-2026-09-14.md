# R2 → R3-PREP — G3B final M8 remediation addendum

Data: 14/09/2026

Stato: **server-design candidato per ultimo recheck indipendente delta-only;
nessuna implementazione R3**

Questo documento traduce lato server la chiusura di `G5C-01 / M8`. Non
modifica `src/**`, `sito/**`, schema, SQL, migration, binding o deploy. Restano
invariati `G5C-02` chiuso a design, `G5C-04` chiuso e `G5C-03` come mandatory
condition R3 remota.

## 1. Difetto rimosso

L'ordine del precedente addendum costruiva il piano completo dopo avere già
eseguito le read iniziali. Il successivo confronto col query budget impediva
write parziali, ma non impediva alle read di oltrepassare il cap. Con budget 4
e cinque read richieste D1 poteva essere invocato cinque volte.

Il gate tardivo non è più autorizzante. Il budget diventa attivo prima della
prima operazione D1 Research.

## 2. Gateway server unico

Ogni ingresso in una route Research deve:

1. misurare/validare body e count senza D1;
2. validare in memoria configurazione e qualification del deployment;
3. fallire senza D1 se la policy è assente, invalida, stale o divergente;
4. creare un solo `ResearchD1BudgetContext` con `charged = 0`;
5. passare ai servizi Research esclusivamente il wrapper D1 del context.

Il binding raw `env.DB` non deve entrare nel grafo delle dipendenze di route,
validator di stato, planner, writer, retry, consent o delete Research. Il
context è l'unico componente autorizzato a invocarlo.

API concettuale, non implementazione prescritta:

```text
budgetedRead(descriptor)
budgetedFirst(descriptor)
budgetedAll(descriptor)
reserveInitialWritePlan(immutable_batches)
invokeReservedBatch(token, immutable_descriptors)
budgetedBatch(immutable_descriptors)
```

Ogni token è opaco, monouso e vincolato a kind, costo e descriptor. Il binding
strumentato R3 deve rifiutare prima della call token assente, già consumato o
non corrispondente.

## 3. Ledger e concorrenza

Invariante per ogni prefisso:

```text
attempted_cost_prefix <= charged <= max_d1_queries_per_request
```

La reservation esegue senza `await` e come operazione atomica:

```text
if charged + cost > max:
    deny; non invocare D1
else:
    charged += cost
    emetti token
```

`charged` non diminuisce. Una reservation autorizzata resta charged se la
call fallisce, va in timeout, ha esito incerto o non viene più invocata. Non
esiste refund ottimistico.

Due callback/Promise concorrenti non possono fare entrambe check sullo stesso
saldo e caricarlo dopo: check+increment precedono scheduling/invocazione e
sono indivisibili. Con un solo credito residuo, due reservation concorrenti da
1 producono una authorization e un deny.

## 4. Charging D1 conservativo

Prima della qualifica G5C-03:

- una read/call singola riserva 1 prima dell'invocazione;
- un `batch()` riserva il numero degli statement derivati dai descriptor
  immutabili prima della call;
- un tentativo conserva l'intero costo riservato anche se fallisce al primo
  statement.

Il writer riceve descriptor congelati e token. Prima di raggiungere il
binding deve valere:

```text
token.cost
  == operation_descriptors.length
  == prepared_statements.length
```

Il writer non rechunka, non aggiunge statement e non usa un secondo
calcolatore. `Q_plan` resta al massimo una diagnostica derivata dagli stessi
descriptor e dalle read charged; non autorizza retroattivamente call e non è
un ledger parallelo.

## 5. Read iniziali e condizionali

Tutte le read iniziali passano dal gateway: auth, quota, lineage, generation,
suppression, pre-join e read dipendenti da risultati precedenti. La route non
conosce un numero fisso `4+N` e non introduce un minimo di budget.

Garanzia lazy obbligatoria:

```text
reserve(1)
→ solo se autorizzata, invoca la read
→ altrimenti termina senza la call
```

Un `InitialReadPlan` deterministico può offrire fail-fast, ma non sostituisce
il token per ogni invocation.

Caso normativo:

```text
budget 4; cinque read necessarie
read invocate 4; quinta non invocata; charged 4; write 0
```

## 6. Piano write iniziale

Dopo le read autorizzate, il planner costruisce dagli stati correnti gli
stessi `ContributionExecutionPlan` immutabili già definiti: guardia/CAS,
snapshot, history, projection delete/insert/update, omissioni e chunk.

Prima della prima write della request il gateway tenta una reservation
atomica per la somma delle cardinalità di tutti i batch iniziali. Il costo è
quello dei descriptor reali. Se il totale non entra nel residuo:

- nessuna reservation parziale;
- nessun token batch;
- nessuna write invocata;
- `413 budget_d1_superato`.

Se entra, il context carica l'intero piano e produce un token per ogni batch.
L'invocazione col token non carica di nuovo. Un batch riservato ma non
raggiunto resta charged.

Boundary server obbligatori:

| caso | budget | read invocate | statement write invocati | esito |
|---|---:|---:|---:|---|
| blocker | 4 | 4 | 0 | quinta read non invocata |
| A | 24 | 5 | 0 | piano 20 non entra nei 19 residui |
| A | 25 | 5 | 20 | esattamente a budget |
| B | 1.356 | 37 | 0 | piano 1.320 non entra nei 1.319 residui |
| B | 1.357 | 37 | 1.320 | esattamente a budget |

## 7. CAS, retry e replan

Un batch CAS tentato resta charged. Il piano stale viene scartato. La re-read
richiede una nuova reservation da 1 prima della call; il replan è puro e non
possiede il binding. Ogni ulteriore dipendenza D1 passa dal gateway.

Il nuovo batch viene congelato e può partire soltanto dopo la reservation del
suo costo completo. Se il residuo non basta:

- deny sulla re-read: nessuna nuova D1 call;
- read autorizzata ma nuovo batch non caricabile: la read resta charged e
  nessuna nuova write parte;
- esito `retryable: budget_d1_retry_esaurito` o equivalente.

Nessun piano stale, refund o retry fuori context è conforme.

## 8. Scope di `max_d1_queries_per_request`

Il cap è comune a ogni singola request di tutte le route Research: upload,
consent, delete e salute/qualification quando interrogano D1. Ogni request
crea un context separato prima della sua prima call.

Un delete lungo può proseguire su più request/chunk. Ogni segmento è bounded;
se il budget finisce dopo il mark o fra chunk, la route restituisce un esito
retryable/continuation `budget_d1_retry_esaurito`, non invoca il chunk
successivo e lascia `deleting` fail-closed. Non cambia il lifecycle M3.

Le operazioni solo in memoria non consumano D1. Una qualification che richiede
una probe D1 viene eseguita dopo la validazione della policy e tramite il
context; il match di configurazione che abilita la route resta verificabile
senza D1.

## 9. Error semantics

| fase | risposta minima |
|---|---|
| config/qualification invalida | Research disabled/fail-closed, zero D1 Research |
| budget finito durante read iniziali | `413 budget_d1_superato`, zero write |
| piano write iniziale non caricabile | `413 budget_d1_superato`, zero write |
| retry upload esaurito | elemento `retryable: budget_d1_retry_esaurito` |
| consent/delete prima della prima mutazione | `413 budget_d1_superato`, zero mutazioni |
| delete già avviato, budget finito fra chunk | retryable/continuation; stato `deleting` |

Il budget strutturale non usa `429`.

## 10. Self-red-team richiesto in R3

Il test deve censire ogni accesso D1 Research e dimostrare che il solo path al
binding è il gateway:

| area | requisito |
|---|---|
| auth/quota | read con token |
| health/qualification D1 | call con token |
| lineage/generation/suppression/pre-join | read con token |
| CAS/guardia, snapshot, history | descriptor congelati + token batch |
| projection delete/insert/update | descriptor congelati + token batch |
| retry read e dipendenze del replan | stesso context e nuova charge |
| consent/delete lifecycle | stesso gateway per mark, census, tombstone, delete e completion |

Prove negative obbligatorie:

- direct raw binding/no-charge;
- double-use o double-charge del token;
- refund dopo errore/timeout/esito incerto;
- batch rechunked dopo reservation;
- writer-added o writer-omitted statement;
- due reservation async che tentano overbooking;
- accesso D1 aggiunto in futuro senza dipendenza dal wrapper.

## 11. G5C-03 e sostituzioni

Questa garanzia è conservativa rispetto al modello corrente. Restano
`MANDATORY R3 CONDITION`: accounting reale di statement e `batch()`, binding
e piano effettivi, rollback, race reali, CPU, latenza, payload massimali e
qualifica dei cap sul deployment.

Il presente documento sostituisce nel precedente addendum server G5c:

- §2.1-§2.2 soltanto per l'autorizzazione delle read e il ruolo di `Q_plan`;
- §3 per l'ordine route/preflight;
- §4 con il ledger pre-prima-call e gateway unico;
- §5 per l'esaurimento durante le read iniziali;
- integra tutte le route Research nello scope del cap.

Planner write, guardia upload/delete G5C-02, HMAC G5C-04, G5C-03 e invarianti
B1/B2/B3/M3/M7 restano invariati.
