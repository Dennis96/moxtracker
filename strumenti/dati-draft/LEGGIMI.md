# Dati Draft centralizzati — strumenti (14/10/2026)

**Implementato, non attivo.** Nessun bucket, binding, secret o deploy è stato
creato o cambiato. Decisione del proprietario del 14/10/2026: `central_api`
attivo dall'inizio, con l'embargo di 17Lands; si applica con i gate del runbook. Contratto e runbook stanno in mox-core:
`passaggi/draft/contratti/CONTRATTO-DATI-DRAFT-CENTRALIZZATI-2026-10-14.md` e
`passaggi/coordinamento/RUNBOOK-DATI-DRAFT-CENTRALIZZATI-2026-10-14.md`.

| File | A che cosa serve | Scrive in produzione? |
|---|---|---|
| `politica.mjs` | sceglie il canale (`central_api`, `public_only`, `off`) e mostra l'effetto su ogni famiglia di client | solo con `--esegui --conferma-produzione` (`wrangler secret put`) |
| `pubblica.mjs` | valida l'uscita della pipeline, costruisce la revisione del manifesto e il piano R2 (payload, verifica, archivio, manifesto per ultimo); `--rollback` | solo con `--esegui --conferma-produzione`, verso un bucket che oggi non esiste |
| `set-attivi.mjs` | l'elenco dei set raccolti dal cron (`config/set-attivi.json` nel bucket) e la fine del loro embargo | solo con `--esegui --conferma-produzione` |
| `contratto.mjs` | il contratto `mox.draft-stats/1` lato publisher, chiavi individuali vietate | no |
| `scenari-costi.mjs` | costi a 100/1.000/10.000 utenti insieme all'uso esistente | no |
| `wrangler-dati-draft.frammento.toml` | binding e variabili da copiare in `wrangler.toml` **dopo** il gate del proprietario | wrangler non lo legge |

Nel Worker: `src/dati-draft.js` (rotte `/mox/draft-data/v1/`, 503 senza
binding), `src/raccolta-17lands.js` (raccolta API centrale, lanciata dal cron orario
`23 * * * *` solo se policy e variabile la aprono), `src/set-attivi.js`
(elenco dei set ed embargo),
`src/politica-dati-esterni.js` (campo `channel` additivo). Prove:
`prove/dati-draft.test.js`, fixture condivisa con mox-core
`prove/casi-politica-canale.json` (identica byte per byte, si cambiano
insieme).
