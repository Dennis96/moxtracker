# R2 → R3-PREP — G3B addendum dopo G5b remediation

Data: 13/09/2026

Stato: **server-design candidato per G5c; nessuna implementazione R3**

Questo documento traduce nel server le decisioni del G5b remediation addendum
core. Sostituisce soltanto anti-resurrezione M3, allowlist B2, overflow M7 e
budget M8 dell'addendum G3B/G5 Claude. Non contiene SQL eseguibile, migration o
modifiche `src/**`.

## 1. Esito

| area | requisito server | stato design |
|---|---|---|
| M3 | lineage server-tagged e tombstone per contribution; nessuna decisione su `quando` | CLOSED |
| B2 | allowlist transport/model prima del join | CLOSED |
| M7 | summary top-3 canonico + overflow | CLOSED |
| M8 | cap runtime obbligatorio e budget `4 + 18*N` | CLOSED |

## 2. Registro transport/model

Il server possiede un registro normativo, versionato insieme al validator:

```text
transport 4 -> supported models {1}
```

La validazione avviene nell'ordine:

1. forma e versione dell'envelope;
2. forma della contribution;
3. presenza di `revisione.modello` nell'insieme esatto del transport;
4. consent/lineage/tombstone;
5. lettura e join;
6. CAS e scrittura.

Esiti:

| input | esito |
|---|---|
| `modello <= 0`, non intero o booleano | `rejected: modello_non_valido` |
| `modello: 1000` o altro valore non registrato | `rejected: modello_non_supportato` |
| modello corrente 1 | procede |
| modello futuro 2 prima del deploy coordinato | `rejected: modello_non_supportato` |
| modello 2 dopo registro esplicito `{1,2}` | bump supportato, sostituzione intera |
| modello 1 dopo stato modello 2 | `stale` |

Un modello supportato maggiore può ignorare le classi del modello precedente
solo perché il deploy server ne ha approvato esplicitamente la semantica. Non
esiste un range implicito. `/salute` espone `{transport: 4, models: [1]}` dalla
stessa sorgente del validator, non da una costante duplicata.

## 3. M3 — lineage e anti-resurrezione

### 3.1 Lineage riconoscibile

Il server non identifica persone. La sola lineage verificabile è il
`mittente` pseudonimo, autenticato dal segreto Research. Con secret server
versionati:

```text
lineage_tag = HMAC-SHA-256(K_lineage,
  "mox-research-lineage-v1" || 0x00 || UTF-8(mittente))

credential_tag = HMAC-SHA-256(K_lineage,
  "mox-research-lineage-credential-v1" || 0x00 ||
  UTF-8(mittente) || 0x00 || bytes(segreto_cancellazione))
```

Il raw del segreto viene usato solo in memoria per calcolare il tag; il
confronto fra tag avviene a tempo costante e il raw non entra in
storage/log/response. La generation conserva il
`lineage_tag` e deve coincidere con mittente, consent version e verifier.

Se un `lineage_tag` già visto ricompare dopo delete:

- stesso `credential_tag`: può ottenere una nuova generation;
- credential diversa: `403 lineage_credential_mismatch`;
- fase delete incompleta: `409 lineage_delete_in_progress`, ritentabile dopo
  completamento, senza emettere generation.

Una nuova coppia con `mittente` indipendente è una nuova lineage e non viene
correlata. Non esiste una deduplica “stessa persona” nascosta.

### 3.2 Storage logico minimo

Oltre alle tabelle già inventariate, il design richiede due famiglie logiche:

| famiglia | chiave/contenuto opaco | export | delete ordinario | scopo |
|---|---|---|---|---|
| lineage suppression | `lineage_tag`, `credential_tag`, key version, stato delete, date server | no | resta | riconoscere stessa lineage e rendere il delete ripetibile |
| deleted contribution suppression | key version, `deleted_contribution_tag`, data/motivo | no | resta | bloccare lo stesso id cancellato nella lineage |

Il tag di contribution è:

```text
HMAC-SHA-256(K_tombstone,
  "mox-research-deleted-contribution-v1" || 0x00 ||
  lineage_tag || 0x00 || id_pubblico)
```

Non si conservano in queste famiglie `mittente`, `id_pubblico`, raw match ID,
segreto, snapshot, carte o GRE. I tag sono una suppression list permanente per
la vita del namespace Research, eccezione dichiarata a export/delete. Key
version e procedure di rotazione seguono l'addendum core; la rimozione di una
vecchia chiave richiede una decisione che dichiari la perdita della garanzia.

Il censimento M4 deve trattare queste due famiglie come le sole nuove eccezioni
esplicite oltre al tombstone generation. Time Travel/restore deve riapplicare
anche suppression lineage e contribution successive al punto ripristinato.

### 3.3 Delete two-phase e race

Il delete della lineage è idempotente e fail-closed:

1. autenticare il segreto;
2. marcare server-side la lineage `deleting`, revocare tutte le generation e
   rendere impossibili upload/nuove generation;
3. enumerare gli `id_pubblico` effettivamente conservati e creare i relativi
   tag di suppression, in chunk bounded;
4. eliminare proiezioni, varianti/storia, snapshot, CAS, generation, quota e
   verifier secondo l'inventario;
5. marcare la lineage `deleted`; soltanto ora un nuovo consenso con la stessa
   credential può emettere una generation.

Ogni chunk di tombstone precede il chunk di dati che copre nella stessa unità
atomica D1. Un crash lascia `deleting`: gli upload restano chiusi e un retry
riprende dal censimento. Non esiste una finestra in cui il dato è sparito ma il
tag non è ancora visibile.

### 3.4 Regola upload

Dopo consent e prima del join il Worker calcola il tag per
`(lineage_tag,id_pubblico)` e consulta la suppression list:

- presente: `rejected: deleted_contribution`, nessuna lettura snapshot/CAS;
- assente: procede normalmente;
- errore/risultato incerto: `retryable`/`503`, mai fail-open.

La verifica non legge `quando`. Il campo torna opzionale, conserva la semantica
analitica del wire e non influenza consenso, quota o anti-resurrezione. Vengono
ritirati `senza_quando`, la soglia `creata - 10 minuti` e ogni claim su clock
skew.

### 3.5 Matrice lifecycle

| caso | risultato |
|---|---|
| delete → retry vecchia generation | `403 generation_inactive` |
| delete → nuovo consenso stessa lineage → stesso id | `rejected: deleted_contribution` |
| stesso id, body/model/`quando` cambiati | stesso rifiuto |
| vecchia coda con token originale | `403 generation_inactive` |
| late completion di id cancellato | `rejected: deleted_contribution` |
| revoca → nuovo consenso, senza delete | nuova generation; join sui dati conservati |
| reinstallazione con sender+secret ripristinati | stessa lineage |
| stesso sender, secret diverso | `403 lineage_credential_mismatch` |
| timestamp futuro/passato/falsificato | nessun effetto sulla decisione lifecycle |
| nuovo sender indipendente | nuova lineage, non correlabile per definizione |

Una contribution mai ricevuta non può essere tombstonata per id. Il client
onesto non rietichetta la coda; una nuova identità mai vista presentata con
generation nuova è indistinguibile da dati nuovi. Questo limite deve comparire
in threat model e informativa tecnica.

## 4. B2/M7 — stato bounded delle varianti

### 4.1 Summary canonico

Per la revisione massima il server conserva al massimo tre body canonici con
hash domain-separated SHA-256 e un booleano `overflow`. I tre body sono quelli
con hash lessicograficamente minore fra tutte le varianti osservate.

Il merge di due summary alla stessa revisione:

1. unisce le coppie `(hash, body)` note;
2. verifica che lo stesso hash non abbia body diversi;
3. ordina per hash e conserva le prime tre;
4. applica `left.overflow OR right.overflow OR distinct_known > 3`.

Il summary è composable: due Worker possono calcolarne parti e il CAS può
serializzarle senza introdurre dipendenza dall'ordine. Retry e duplicati non
cambiano stato.

### 4.2 Stato effettivo, response ed export

| stato dopo join | proiezioni | esito elemento |
|---|---|---|
| una variante, no overflow | dalla snapshot | `accepted_new`/`updated`/`unchanged` |
| 2–3 varianti | nessuna | `conflict` |
| almeno 4 varianti | nessuna | `conflict_overflow` |
| hash noto/scartato ritentato dopo overflow | nessuna | `conflict_overflow`, stato idempotente |

L'overflow non elegge un vincitore. Export include revisione, fino a tre body e
hash, `overflow=true` e il testo “almeno quattro varianti”; non include un
conteggio fittizio. Delete rimuove body, hash e summary.

Il body di varianti oltre il top-3 e il conteggio esatto sono deliberatamente
persi per mantenere storage bounded. Un bump a modello maggiore supportato
sostituisce atomicamente il conflitto con una snapshot singola, ricrea le
proiezioni e conserva soltanto il summary precedente entro il limite storico.
Arrivi del modello precedente sono stale.

Il batch CAS deve aggiornare summary, retained rows e proiezioni nella stessa
transazione. Una collisione hash/body produce errore chiuso e allarme; non
viene trattata come retry identico.

## 5. M8 — policy runtime e budget

### 5.1 Configurazione fail-closed

Il server richiede `RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST` intero `1..33`.
Il valore non ha default permissivo: se manca, è invalido o non è stato
qualificato sul binding/piano reale, le route Research restano disabilitate e
`/salute` lo dichiara.

Limiti distinti:

- `max_body_bytes = 262144`, contato sullo stream;
- `client_payload_upper_bound = 33`, non capacità D1;
- `max_contributions_per_request = configurazione qualificata`;
- rate/quota per origine, lineage e generation separati.

Un body entro 256 KiB ma oltre il count runtime riceve `413
troppi_contributi` con il cap corrente. Il client divide in ordine stabile e
ritenta; un `429` non viene usato per il count strutturale.

`/salute` espone da un'unica configurazione:

```text
research: {
  enabled,
  transport: 4,
  models: [1],
  max_body_bytes: 262144,
  max_contributions_per_request
}
```

### 5.2 Formula unica

Per contribution gli statement batch sono:

```text
B_i = 7 fixed
    + ceil(game_rows/16)  se non vuoto
    + ceil(event_rows/14) se non vuoto
    + ceil(deck_rows/16)  se non vuoto
    + ceil(delta_rows/16) se non vuoto
```

`B_i` osservato è 10..17 e non include la lettura pre-join. Con quattro query
auth/quota per request:

```text
Q_worst(N) = 4 + N + 17*N = 4 + 18*N
```

| N | statement batch min..max | reads | auth/quota | totale worst-case | byte |
|---:|---:|---:|---:|---:|---:|
| 1 | 10..17 | 1 | 4 | 22 | ≤ 8.168, bound osservato |
| 2 | 20..34 | 2 | 4 | 40 | ≤ 16.105, bound osservato |
| 3 | 30..51 | 3 | 4 | 58 | ≤ 24.042, bound osservato |
| 33 | 330..561 | 33 | 4 | 598 | 207.163, top-33 osservato |

Il numero realizzato 524 resta una misura del corpus con insert vuoti omessi;
537 viene ritirato perché non derivabile dal modello documentato. 598 è il
solo bound hard per N=33. L'ipotesi “batch = una query” e il cap 23 Free sono
ritirati.

Cloudflare documenta 1.000 query per invocazione Paid e 50 Free e applica i
limiti individuali agli statement dei batch:
[D1 limits](https://developers.cloudflare.com/d1/platform/limits/). Il fallback
conservativo per un budget verificato `L` è
`min(33, floor((L-4)/18))`: 2 se `L=50`, 33 se `L=1000`. Sono esempi
condizionali, non configurazione del progetto.

Prima di abilitare R3: confermare piano/binding, misurare conteggio reale,
rollback, CPU e latenza sui payload massimali, scegliere il cap e provarlo.
Ogni modifica al numero di query auth o agli statement richiede il ricalcolo
della stessa formula.

## 6. Test di accettazione R3

Obbligatori, senza sostituire il recheck G5c:

1. M3: delete/reconsent, old token, stesso id con body e timestamp modificati,
   late completion, delete interrotto a ogni fase, stessa/nuova lineage e
   restore;
2. model: 0, 1, 1000, future model non supportato, bump coordinato, client
   vecchio e downgrade;
3. variant summary: 4–8 varianti in ordini/permutazioni, duplicati, due CAS
   concorrenti, overflow, export/delete e model bump;
4. M8: N=1/2/3/33, famiglie vuote/piene, body chunked e `Content-Length`
   falso, cap che scende, query/CPU/latency sul runtime reale;
5. key management: confronto constant-time, domain separation, versione,
   rotazione e nessun tag/raw in log o risposta.

## 7. Invarianti non toccati

Restano invariati B1, B3/event ID v2, golden rev2, `id_pubblico`, durata
rimossa, gruppi atomici, snapshot intera, CAS, M2 generation, M4 inventory,
M5 validator strutturale, M6 unità statistica e packet legacy.
