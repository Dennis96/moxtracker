# R3 — G5C-03 su staging e capacità, lato server

Data: 14–15/09/2026 · Autore: Claude · **G5C-03 PASS su D1 reale (36/36
sullo schema originale, 36/36 sullo schema compattato); R3 implementata e
provata, non fusa e non in produzione**

Il report completo, con la decisione D1-only contro D1+R2, la compattazione e
l'incidente, sta in `mox-core`:
`passaggi/research/audit/R3-G5C03-STAGING-E-CAPACITA-CLAUDE-2026-09-14.md`.

## Risorse di staging

- D1 `moxtracker-research-staging` (`02829757-def3-4f6e-9593-b985e01f92f6`),
  sola `migrazioni/2026-09-14-research-r3.sql` (compattata, riapplicata il
  15/09 dopo `strumenti/research-staging/reset-schema-staging.sql`);
- Worker `moxtracker-research-staging` su workers.dev, configurazione
  `wrangler.research-staging.toml`: nessuna route, nessun cron, un solo
  binding (`DB` → staging). Il Worker e' `strumenti/research-staging/worker.mjs`:
  il Worker vero piu' le sonde G5C-03 dietro token. Versione del 15/09:
  `3dca2ee5-e8b3-4531-bb29-8831896cef3f`, dal commit `aa11a7d`;
- segreti di staging: `RESEARCH_HMAC_KEYS`, `RESEARCH_MISURE_TOKEN`.

Codice, configurazione, dominio, Pages e preview della produzione non sono
stati toccati. **Ma la quota D1 e' dell'account**, e il 14/09 lo staging l'ha
esaurita: vedi R3-OP-01 qui sotto.

## Piano dell'account

Il 14/09 l'account era Workers **Free**; dal **15/09/2026 e' Workers Paid**
(5 $/mese). Limiti documentati del Paid: 1.000 query per invocazione, 30 s di
CPU predefiniti, 50 M righe scritte al mese incluse, 10 GB per database.

## Misure principali, prima e dopo la compattazione (stesso D1)

| punto | schema originale (14/09) | schema compattato (15/09) |
|---|---|---|
| acceptance G5C-03 | 36/36 | **36/36** |
| rollback in `batch()` | `CHECK`, `UNIQUE`, `FOREIGN KEY` annullano tutto | uguale, e ora col messaggio del vincolo atteso |
| tipica | 14 query, 163 righe scritte, ~26 KB, 7 ms CPU | 13 query, **56** righe, ~8 KB, **4** ms |
| p95 | 17 query, 417 righe, ~63 KB, 6 ms | 16 query, **141** righe, ~15 KB, 4 ms |
| grande | 30 query, 1.310 righe, ~180 KB, 9 ms | 29 query, **439** righe, ~42 KB, 6 ms |
| worst-case legale | 221 query, 13.521 righe, ~2 MB, 46 ms | 220 query, **4.510** righe, ~494 KB, 37 ms |
| 33 tipiche | 334 query, 5.379 righe, 81 ms, ~2,3 s | 301 query, **1.848** righe, 51 ms, ~1,6 s |
| 33 × 500 righe di mazzo | 49.929 righe, 3,2 s | **16.698** righe, 1,8 s |

Le righe **lette** salgono un poco (tipica da 24 a 30): ogni inserimento
risolve la chiave interna con una sottoquery. Le letture non sono mai state il
limite. Nessuna eccezione nel tail.

Cap proposti sul Paid: **33 contribution e 1.000 query per richiesta**. Anche
il worst-case legale (220 query) entra.

## Rilievi della revisione del codice (15/09)

- `src/research/servizio.js`: con la tabella legacy `contributori` assente,
  il TOFU del consenso trattava l'errore come «nessun verificatore» in
  qualunque ambiente, cioe' si apriva. Ora vale solo per `staging` e
  `prova_locale`; altrove il consenso si chiude. Prova:
  `research-servizio.test.js` («fuori da staging e prova locale una tabella
  legacy assente chiude il consenso»), RED visto prima della correzione;
- strumenti di staging: dopo un arresto del budget, il resoconto riporta anche
  le righe prenotate dalle richieste ancora in volo (`in_volo`).

Suite server: **331/331**.

## Finding operativo R3-OP-01

Il 14/09/2026 le misure sullo staging hanno superato le 100.000 righe
scritte al giorno del piano D1 gratuito (250.903 nelle 24 ore, da `wrangler
d1 info`). Il limite e' **per account**: dopo le 20:51 UTC (ultima partita
scritta; ultimo Draft alle 20:19) e fino alle 00:00 UTC del 15/09, D1 ha
rifiutato anche le scritture del database di produzione `moxtracker` («Your
account has exceeded D1's free tier daily row write limit»). Causa: piano
dedotto da misure parziali (Paid, sbagliato), staging che non isola le quote,
strumenti senza tetto.

Verifica del 15/09, 05:06 UTC, in sola lettura: `/salute` risponde `vivo`, i
due D1 di produzione si leggono, nessuna scrittura dopo il reset (nessun
client attivo di notte). La prima scrittura dopo il reset, sullo staging, e'
passata: il limite dell'account e' tolto.

Rimedio, in `strumenti/research-staging/budget-righe.mjs`, obbligatorio anche
sul Paid:

- contro lo staging remoto `--budget-righe` e' obbligatorio (codice 2 se manca);
- stima preventiva dell'intera run prima della prima richiesta: oltre il tetto,
  codice 3 e nessuna richiesta;
- ogni richiesta prenota la sua stima prima di partire, e la run si ferma prima
  di quella che supererebbe il tetto;
- conta `meta.rows_written`; se manca (il Worker lo segnala con
  `meta_senza_righe`) conta la stima.

Run del 15/09 con il tetto: acceptance 36.462 righe su 109.718 stimate (tetto
150.000), capacità 25.178 su 75.048 (tetto 100.000); nessuna richiesta oltre
la stima.

## Strumenti

- `strumenti/research-staging/accettazione.mjs`: acceptance (rifiuta URL non
  staging; `--budget-righe`, `--fasi`);
- `strumenti/research-staging/capacita.mjs`: benchmark per forma e batch
  (`--budget-righe`, `--forme`, `--senza-batch`);
- `strumenti/research-staging/budget-righe.mjs` e `forme.mjs`: tetto di righe
  scritte e forme sintetiche;
- `prove/research-staging-worker.test.js` e
  `prove/research-staging-budget.test.js`: sonde e budget provati in locale.
