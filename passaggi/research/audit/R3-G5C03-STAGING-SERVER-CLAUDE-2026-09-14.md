# R3 — G5C-03 su staging e capacità, lato server

Data: 14/09/2026 · Autore: Claude · **G5C-03 PASS (36/36) su D1 reale; R3 non chiusa**

Il report completo, con la decisione D1-only contro D1+R2, sta in `mox-core`:
`passaggi/research/audit/R3-G5C03-STAGING-E-CAPACITA-CLAUDE-2026-09-14.md`.

## Risorse di staging

- D1 `moxtracker-research-staging` (`02829757-def3-4f6e-9593-b985e01f92f6`),
  sola `migrazioni/2026-09-14-research-r3.sql`;
- Worker `moxtracker-research-staging` su workers.dev, configurazione
  `wrangler.research-staging.toml`: nessuna route, nessun cron, un solo
  binding (`DB` → staging). Il Worker e' `strumenti/research-staging/worker.mjs`:
  il Worker vero piu' le sonde G5C-03 dietro token;
- segreti di staging: `RESEARCH_HMAC_KEYS`, `RESEARCH_MISURE_TOKEN`.

Produzione intatta (D1 `moxtracker`, Worker, dominio, Pages, preview).

## Misure principali

| punto | risultato |
|---|---|
| piano | Workers **Paid**: 1.000 query per invocazione (la 1.001ª fallisce) |
| `batch()` | conta **una** query verso il limite per invocazione (batch da 2.000 statement passa); ledger R3 conservativo invariato |
| rollback | `CHECK`, `UNIQUE`, `FOREIGN KEY` dentro `batch()` annullano tutto (`D1_ERROR:`) |
| gateway, token, descriptor | binding strumentato = ledger su ogni upload; statement tentati = pianificati |
| budget | budget 4 → 4 letture, `413`; costo 19 → `413` a 18, accettato a 19 |
| corse | CAS con 12 upload concorrenti e delete in corsa: invarianti rispettati |
| qualification | assente/stale/divergente/invalida → `503` senza D1 |
| tipica | 14 query, 163 righe scritte, 24 lette, ~26 KB, 7 ms CPU |
| worst-case legale | 221 query, 13.521 righe scritte, ~2 MB, 46 ms CPU |
| 33 tipiche | 334 query, 5.379 righe scritte, 81 ms CPU, ~2,3 s |

Cap proposti per il piano Paid: 33 contribution e 1.000 query per richiesta.

## Strumenti

- `strumenti/research-staging/accettazione.mjs`: acceptance (rifiuta URL non staging);
- `strumenti/research-staging/capacita.mjs`: benchmark per forma e batch;
- `prove/research-staging-worker.test.js`: le sonde provate in locale.
