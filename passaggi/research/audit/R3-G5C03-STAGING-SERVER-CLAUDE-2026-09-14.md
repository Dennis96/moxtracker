# R3 — G5C-03 su staging e capacità, lato server

Data: 14/09/2026 · Autore: Claude · **G5C-03 PASS (36/36) su D1 reale; R3 non
chiusa** · corretto la sera del 14/09/2026 dopo l'incidente R3-OP-01

Il report completo, con la decisione D1-only contro D1+R2 e l'incidente, sta
in `mox-core`:
`passaggi/research/audit/R3-G5C03-STAGING-E-CAPACITA-CLAUDE-2026-09-14.md`.

## Risorse di staging

- D1 `moxtracker-research-staging` (`02829757-def3-4f6e-9593-b985e01f92f6`),
  sola `migrazioni/2026-09-14-research-r3.sql`;
- Worker `moxtracker-research-staging` su workers.dev, configurazione
  `wrangler.research-staging.toml`: nessuna route, nessun cron, un solo
  binding (`DB` → staging). Il Worker e' `strumenti/research-staging/worker.mjs`:
  il Worker vero piu' le sonde G5C-03 dietro token;
- segreti di staging: `RESEARCH_HMAC_KEYS`, `RESEARCH_MISURE_TOKEN`.

Codice, configurazione, dominio, Pages e preview della produzione non sono
stati toccati. **Ma la quota D1 e' dell'account**, e lo staging l'ha esaurita:
vedi R3-OP-01 qui sotto.

## Misure principali

| punto | risultato |
|---|---|
| piano | account Workers **Free**. Osservate 1.000 query per invocazione (la 1.001ª fallisce) e CPU fino a ~390 ms: sono sopra i limiti documentati del Free (50 query, 10 ms), quindi non ci si appoggia |
| `batch()` | conta **una** query verso il limite per invocazione (batch da 2.000 statement passa); ledger R3 conservativo invariato |
| rollback | `CHECK`, `UNIQUE`, `FOREIGN KEY` dentro `batch()` annullano tutto (`D1_ERROR:`) |
| gateway, token, descriptor | binding strumentato = ledger su ogni upload; statement tentati = pianificati |
| budget | budget 4 → 4 letture, `413`; costo 19 → `413` a 18, accettato a 19 |
| corse | CAS con 12 upload concorrenti e delete in corsa: invarianti rispettati |
| qualification | assente/stale/divergente/invalida → `503` senza D1 |
| tipica | 14 query, 163 righe scritte, 24 lette, ~26 KB, 7 ms CPU |
| worst-case legale | 221 query, 13.521 righe scritte, ~2 MB, 46 ms CPU |
| 33 tipiche | 334 query, 5.379 righe scritte, 81 ms CPU, ~2,3 s |

Cap proposti sul Free (limiti documentati): **1 contribution e 50 query per
richiesta**. Col ledger dopo la compattazione (misura locale) la tipica costa
13 query, la p95 16, la grande 29, il worst-case legale 220: sopra 50 una
contribution resta nella coda del client e sul Free non entra. Sul Paid i cap
sarebbero 33 e 1.000.

La sonda `FOREIGN KEY` dopo la compattazione scriveva nelle colonne vecchie e
in locale passava per il motivo sbagliato («no such column»): corretta, e ora
le prove pretendono il messaggio del vincolo atteso. Il PASS su D1 reale era
sullo schema originale e resta valido.

## Finding operativo R3-OP-01

Il 14/09/2026, verso le 18:40 UTC, le misure sullo staging hanno superato le
100.000 righe scritte al giorno del piano D1 gratuito. Il limite e' **per
account**: fino alle 00:00 UTC del 15/09 D1 ha rifiutato anche le scritture
del database di produzione `moxtracker` («Your account has exceeded D1's free
tier daily row write limit»). Causa: piano dedotto da misure parziali (Paid,
sbagliato), staging che non isola le quote, strumenti senza tetto.

Rimedio, in `strumenti/research-staging/budget-righe.mjs`:

- contro lo staging remoto `--budget-righe` e' obbligatorio (codice 2 se manca);
- stima preventiva dell'intera run prima della prima richiesta: oltre il tetto,
  codice 3 e nessuna richiesta;
- ogni richiesta prenota la sua stima prima di partire, e la run si ferma prima
  di quella che supererebbe il tetto;
- conta `meta.rows_written`; se manca (il Worker lo segnala con
  `meta_senza_righe`) conta la stima.

Stime preventive: capacità intera 75.048 righe, acceptance intera 109.718 (da
sola oltre la quota), acceptance senza `payload` 7.319, capacità
`--forme tipica,p95,grande --senza-batch` 11.484.

Dopo il reset: prima una verifica in sola lettura della produzione, poi nuove
scritture sullo staging solo col via esplicito e con un tetto dichiarato.

## Strumenti

- `strumenti/research-staging/accettazione.mjs`: acceptance (rifiuta URL non
  staging; `--budget-righe`, `--fasi`);
- `strumenti/research-staging/capacita.mjs`: benchmark per forma e batch
  (`--budget-righe`, `--forme`, `--senza-batch`);
- `strumenti/research-staging/budget-righe.mjs` e `forme.mjs`: tetto di righe
  scritte e forme sintetiche;
- `prove/research-staging-worker.test.js` e
  `prove/research-staging-budget.test.js`: sonde e budget provati in locale.
