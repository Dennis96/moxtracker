# Runbook R3 — Research in produzione

Aggiornato: 15/09/2026 (FASE B: Research accesa in produzione).

## Stato di produzione — 15/09/2026

- **Research: `on`** dal Worker `d4c12c58-6197-4ccf-ab55-e6c8805ecce8`
  (configurazione di `main` `46cb6da`); `/salute`: `enabled: true`, transport 4,
  modello 1, cap 33/1000, qualification `q-produzione-2026-09-15` **valida fino
  al 2026-10-15T00:00:00Z**, da rinnovare prima.
- **`VERSIONE_R3_MINIMA = 86cded53-c0b2-4b11-85e0-c061a7dc7f95`** (primo deploy
  R3, in `off`).
- **Rollback rapido a drain:** `npx wrangler rollback
  c06c8632-5976-4735-b7d4-ffc985ecadaa` rimette in un colpo solo R3 in `drain`
  con chiavi, qualification e manifesti 2.11.0 (è la versione del collaudo in
  drain di questa FASE B). La strada normale resta `RESEARCH_MODE = "drain"`,
  commit e deploy.
- **Attenzione:** una versione del Worker porta con sé i secret del momento in
  cui è nata. Le versioni prima di `2fef7b3c` hanno i manifesti della 2.10.0
  (e prima di `98721501` nemmeno le chiavi HMAC): un rollback lì riporterebbe
  indietro anche l'aggiornamento automatico dei client.
- Versioni della giornata: `3e26ca1c` (pre-R3) → `98721501` (chiavi HMAC) →
  `86cded53` (R3 `off`) → `e7615b2f`, `2fef7b3c` (manifesti 2.11.0 canary e
  stable) → `0429f6c3` (`on`) → `c06c8632` (`drain`, collaudo) → `d4c12c58`
  (`on`).
- Smoke di produzione: legacy identico prima e dopo (26 controlli in `off`,
  23 in `on`, nessuna differenza); Research on 12/12 (consenso, upload,
  retry `unchanged`, revoca, vecchia generation 403, nuovo consenso, delete,
  403 dopo il delete); drain 6/6; nessuna lineage in `deleting`, nessuna
  generation orfana, nessun dato sintetico rimasto.

## La regola che non si tocca

> **Dopo che esiste almeno un client R3 distribuito (Mox 2.11.0), NON è un
> rollback sicuro tornare a un Worker pre-R3 che non espone revoca e
> cancellazione.**

Un Worker senza le route `/research/*` risponde 404 a revoca e cancellazione.
Il client lo tratta come «non confermato» e ripete da solo, quindi l'intento
non si perde; ma finché quel Worker resta in piedi nessuna revoca e nessuna
cancellazione arriva. Il rollback normale è quindi:

```text
RESEARCH_MODE -> drain
-> niente consensi nuovi, niente upload
-> revoca e cancellazione aperte
-> stabilizza
-> correggi e ridistribuisci
```

## Le tre modalità

| `RESEARCH_MODE` | consenso nuovo | upload | revoca | cancellazione |
|---|---|---|---|---|
| `off` (anche assente o scritta male) | no | no | no | no |
| `drain` | no | no | sì | sì, anche a pezzi (`202`) |
| `on` | sì | sì | sì | sì |

`drain` non chiede la qualification: funziona anche se è scaduta. `on`
chiede qualification valida e il limitatore d'ingresso.

La modalità sta in `wrangler.toml`, `[vars]`. Si cambia con un commit e un
deploy del Worker; prima di ogni deploy:

```bash
node strumenti/research-produzione/verifica.mjs
npx wrangler deploy --dry-run --outdir .dist/worker-dry-run
```

`verifica.mjs` deve dire `verifica: ok`; il dry-run deve mostrare `DB
(moxtracker)`, i due limitatori Research e la modalità attesa.

## Primo deploy (fatto il 15/09/2026)

1. **Prima** la migrazione R3 sul D1 `moxtracker` (solo aggiunte): anche in
   `off` la cancellazione dell'account dal sito cancella pure i dati Research,
   quindi un Worker R3 senza le tabelle la farebbe fallire. Lo schema resta
   anche se Research viene spenta: non si fanno `DROP`.
2. Poi il Worker con `RESEARCH_MODE = "off"`: si comporta come prima per tutto
   il resto. Smoke legacy: `/salute`, `/partite`, Draft, account, ticket.
3. Registrata qui la versione appena pubblicata:
   `VERSIONE_R3_MINIMA = 86cded53-c0b2-4b11-85e0-c061a7dc7f95`. Da qui in avanti
   è la versione più vecchia verso cui è lecito un rollback di codice.

## Accendere Research (off o drain → on)

1. Segreto HMAC di produzione, nuovo e diverso dallo staging, con
   `npx.cmd wrangler secret bulk <file> --config wrangler.toml` (il valore non
   entra mai in Git né nei messaggi).
2. Qualification generata, non scritta a mano:
   `node strumenti/research-produzione/qualification.mjs --valida-fino <istante UTC>`
   e il JSON in `RESEARCH_RUNTIME_QUALIFICATION` (`[vars]`).
3. `RESEARCH_MODE = "on"`, `verifica.mjs`, dry-run, deploy.
4. `/salute` → `research.enabled: true`, `modo: "on"`, transport 4, modello 1,
   cap 33/1000, qualification `valida`, nessun segreto.

## Spegnimento immediato (on → drain)

1. `RESEARCH_MODE = "drain"`, deploy.
2. `/salute` → `enabled: false`, `modo: "drain"`, `lifecycle: true`.
3. I client smettono da soli di chiedere consensi e di mandare partite (leggono
   `/salute` prima di ogni invio) e tengono la coda sul PC. Revoche e
   cancellazioni continuano ad arrivare.

## Rollback di codice

Solo verso una versione R3 che abbia le route di revoca e cancellazione
(`VERSIONE_R3_MINIMA` o successiva), con `npx wrangler rollback <version-id>`.
Un Worker pre-R3 è **solo per emergenza** (per esempio un guasto che rompe il
legacy), e va sostituito il prima possibile da una versione R3 in `drain`.

## Se il server risponde 404 generico

Vuol dire che sta girando un Worker senza le route Research. I client non
perdono niente: i pendenti restano e vengono ripetuti all'avvio (dopo 20
secondi, poi da 15 minuti fino a 4 ore) e dopo ogni salvataggio. Si rimette su
una versione R3 in `drain`, poi si verifica come sotto.

## Verifica degli intenti in sospeso (lato server, sola lettura)

```sql
SELECT stato, COUNT(*) FROM research_lineage GROUP BY stato;
SELECT COUNT(*) FROM research_consent_generation g
  JOIN research_lineage l ON l.lineage_tag = g.lineage_tag
  WHERE g.stato = 'active' AND l.stato <> 'active';
```

A regime nessuna lineage resta in `deleting` a lungo e il secondo conteggio è
zero. Una lineage ferma in `deleting` si completa con una nuova cancellazione
dal client (o da quello stesso utente dal sito, cancellando l'account).

## Riaccendere (drain → on)

Se la qualification è scaduta se ne genera una nuova; poi `RESEARCH_MODE =
"on"`, `verifica.mjs`, deploy, `/salute`. I client ripartono da soli al giro
dopo.

## Limitatori

- `RESEARCH_RATE_LIMITER_INGRESSO` (namespace 29021, 30 richieste ogni 60 s),
  consenso e upload, per origine e per mittente. Obbligatorio con `on`.
- `RESEARCH_RATE_LIMITER_CICLO` (namespace 29022, 60 ogni 60 s), revoca e
  cancellazione, solo per mittente, binding separato: l'abuso dell'ingresso non
  blocca le cancellazioni. Se manca, revoca e cancellazione passano lo stesso.

I limitatori Cloudflare contano per località e sono eventualmente consistenti:
proteggono dagli abusi, non sono un contatore esatto. Un 429 sul ciclo di vita
non chiude niente sul client: ripete al giro dopo.

## Staging

Il Worker `moxtracker-research-staging` e il D1 `moxtracker-research-staging`
non fanno parte della produzione: file di configurazione separato, nessuna
rotta, qualification di misura scaduta il 16/09/2026. Non si cancellano senza
un'autorizzazione.
