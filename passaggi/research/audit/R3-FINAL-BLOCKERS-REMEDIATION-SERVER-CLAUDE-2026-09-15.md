# R3 — remediation dei blocker, lato server

Data: 15/09/2026 · Autore: Claude · Stato: **READY FOR NEW INDEPENDENT REVIEW**

Il report completo, con la fault matrix mappata sulle prove, sta in
`mox-core`: `passaggi/research/audit/R3-FINAL-BLOCKERS-REMEDIATION-CLAUDE-2026-09-15.md`.
Base: `claude/r3-release-candidate-2026-09-15` @ `7cc9399`; branch
`claude/r3-final-blockers-remediation-2026-09-15`.

## Cosa cambia

- **B1**: revoca e cancellazione rispondono sempre con `operazione`
  (`conOperazione`), così il client distingue una conferma R3 da un 404
  generico di un Worker senza le route Research.
- **B4, modalità**: `RESEARCH_MODE` off/drain/on al posto di
  `RESEARCH_ENABLED` (che non si legge più: una configurazione vecchia resta
  chiusa). In `drain` consenso nuovo e upload rispondono 503 `research_drain`,
  revoca e cancellazione funzionano, anche con le continuation `202`, e senza
  bisogno della qualification. `/salute` pubblica `modo` e `lifecycle`.
- **B4, limitatori**: `RESEARCH_RATE_LIMITER_INGRESSO` (29021, 30/60 s,
  obbligatorio in produzione con `on`) e `RESEARCH_RATE_LIMITER_CICLO` (29022,
  60/60 s, separato, non blocca mai se manca).
- **B4, configurazione di produzione**: `wrangler.toml` con `RESEARCH_MODE =
  "off"`, cap 33/1000, deployment `research-produzione-r3`, i due limitatori,
  nessuna chiave; `strumenti/research-produzione/verifica.mjs` (controllo
  pre-deploy), `qualification.mjs` (qualification generata), dry-run di
  wrangler verde.
- **Runbook**: `passaggi/research/RUNBOOK-R3-PRODUZIONE.md` — dopo la 2.11.0
  il rollback è `drain`, mai un Worker pre-R3.
- `strumenti/research_server_locale.mjs --modo drain` per l'end-to-end del
  client contro il Worker vero in drain.

## Prove

`npm run prove` **351/351**: nuove `prove/research-modi.test.js` (modalità,
drain, continuation, `/salute`, limitatori, operazione, qualification, legacy)
e `prove/research-produzione-config.test.js` (lettore TOML, produzione attesa,
niente segreti, staging separato, off → drain → on, controllo pre-deploy);
prove esistenti passate a `RESEARCH_MODE`. End-to-end del client contro questo
Worker: 20/20, con la fase drain → on.
