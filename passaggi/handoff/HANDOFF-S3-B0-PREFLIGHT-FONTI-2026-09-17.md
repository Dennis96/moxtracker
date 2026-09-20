# HANDOFF — S3-B0 PREFLIGHT FONTI — 17 settembre 2026

**Stato:** `S3-B0 COMPLETATO`  
**Prossimo scope:** S3-B1/B2/B3, analisi dei candidati soltanto con fonti autorizzate.

## Baseline

- `Dennis96/moxtracker`
- branch `chatgpt/s3-meta-catalog-refresh-2026-09-17`
- HEAD remoto iniziale B0: `bd3670f5f8b4509c52cff4cec905fb0bc2283490`
- `Dennis96/mox-core` invariato a `c8079dc40c1325c1314d9f283226ab3be10db21d`

## Esito preflight

| Fonte | Stato |
| --- | --- |
| `magic.wizards.com` | `CONSENTITA CON LIMITI` |
| `mtgaassistant.net` | `NON UTILIZZABILE` |
| `aetherhub.com` | `NON UTILIZZABILE` |
| `mtgdecks.net` | `NON UTILIZZABILE` |

Dettagli e motivazioni: `passaggi/sito/S3-B0-PREFLIGHT-FONTI-2026-09-17.md`.

## Vincolo per S3-B1/B2/B3

Usare soltanto `magic.wizards.com` in modalita' puntuale, senza crawling, enumerazione, scraping, estrazione massiva o script. I General Terms Wizards vietano data mining/scraping tramite agenti, robot, script o spider non autorizzati; il robots.txt di `magic.wizards.com` non contiene `Disallow` per `User-agent: *`, ma le Terms prevalgono come vincolo operativo piu' restrittivo.

`mtgaassistant.net`, `aetherhub.com` e `mtgdecks.net` restano esclusi perche' in questo runtime il loro robots.txt non e' verificabile direttamente senza ricorrere a canali alternativi; per la regola conservativa del mandato il dubbio equivale a non utilizzabile. Non usare mirror, cache, proxy, cambio User-Agent o altre vie alternative.

Se l'evidenza Wizards non basta a supportare A/B/C/D per un candidato, lasciare la decisione aperta e fermarsi: non ampliare autonomamente la whitelist.

## Scope non eseguito in B0

- nessuna analisi individuale dei 3 candidati Brew;
- nessuna decklist raccolta;
- nessuna ricerca Meta generale;
- nessuna decisione A/B/C/D;
- nessuna modifica a `mox-core/meta/standard.json`;
- nessun merge, deploy, D1 remoto o modifica produzione.
