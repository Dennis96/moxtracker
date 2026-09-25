# MOX — closeout production pre-lancio

**Stato: PRE-LAUNCH CLOSED · 25 settembre 2026, 18:43 UTC.**

Il PASS visivo umano sul candidato è stato dato prima della production. PR [#22](https://github.com/Dennis96/moxtracker/pull/22) mergiata senza altri cambi concorrenti: baseline `4868934a4f3b41e28302d95937050a27f7aff124`, candidato `214eb4d6639fbe7070768efaf3587479615e9491`, commit sorgente dei deploy `main` **`1e117acaa5405bbc12702d9ed5b3b9b8c2821a08`**. La documentazione successiva al deploy non cambia il prodotto distribuito.

## Deploy e rollback

| Componente | Stato production | Versione precedente registrata |
| --- | --- | --- |
| Pages | `61de5e86-e767-4668-85da-925e070bc312`, build `2adced80e08498f3`, [moxtracker.app](https://moxtracker.app) | `9abb4ade-14d6-4b27-992d-762cc79963b1` |
| Worker | deployment `76cfc95e-b158-46f5-9d15-3a79d145d920`, versione `9baa7bbf-f5c1-4364-a199-277e49c7bc99`, [api.moxtracker.app](https://api.moxtracker.app/salute) | versione `4cbb6c88-9c3a-4b8f-ba3e-dc6848bde671` |

**Rollback non eseguito.** Un primo smoke Pages ha rilevato una risposta HTML obsoleta servita dalla CDN per la social image. L'asset era già corretto su deployment nuovo e precedente; l'utente ha eseguito un purge mirato del solo URL `https://moxtracker.app/assets/social/mox-social-card.png`. La verifica successiva, senza query string, ha restituito `200 image/png`, 228093 byte, `CF-Cache-Status: MISS`. Un tentativo di rollback Worker era stato respinto dall'auto-review perché non avrebbe corretto la cache Pages; nessuna versione è stata cambiata. Dopo il purge è stato ripetuto l'intero smoke pertinente, con esito PASS.

## Verifiche

- Suite completa sul candidato runtime precedente ai tre soli micro-fix copy: `npm run prove` **476/476 PASS**. Sul candidato finale: **69/69 test mirati PASS**, inclusi copy IT/EN, retention Research con race/revoca/delete e retention Partite/Draft; `git diff --check` PASS. Nessuna suite completa ripetuta per i tre micro-fix.
- Pages: 20 URL IT/EN, tra cui Home, Privacy, Draft, Il mio MOX senza accesso, Meta, archetipo reale `aure-mono-bianco`, Cosa invia MOX, Download, Note di versione e Supporto: tutti HTTP 200, lingua corretta e nessun `noindex`. `robots.txt` consente l'indicizzazione; sitemap 16 URL; canonical, hreflang, Open Graph, Twitter Card, favicon, schermate reali e social image corretti. Manifest remoto: `commit_git` uguale al commit sorgente; console browser senza warning/error rilevanti, nessun overflow orizzontale o asset con `src` fallito nelle pagine campionate. Account logged-out mostra login e spiega che l'account è facoltativo. La CTA download risolve l'unico ZIP della GitHub Release Latest al click.
- Worker: `/salute`, `/meta`, `/archetipo`, `/scontri`, `/draft/statistiche` HTTP 200. `/account/me` senza sessione risponde 401; GET sulle quattro route Research risponde 405, quindi le route lifecycle restano presenti. Research `enabled: true`, `modo: on`, `lifecycle: true`; Brew `on` e gruppi visibili nella risposta pubblica Meta. Soglie matchup 30/100; matrice attualmente indisponibile per mancanza dell'archetipo avversario, come dichiarato dall'API. Nessun 5xx nelle richieste di smoke o errore console rilevante osservato; un tasso 5xx complessivo non è misurabile con queste letture.
- Release: [GitHub Latest 2.11.2](https://github.com/Dennis96/moxtracker/releases/tag/mox-v2-beta2.11.2), unico ZIP `MOX-2.11.2.zip`; il manifesto updater production riporta `2 beta 2.11.2`, canale stable, `win-x64`.
- Nessuna migration D1, modifica schema, binding, secret, route o flag. Cron production `17 3 * * *`, `RESEARCH_MODE=on`, `BREW_GRUPPI=on`.

## Retention attiva

Partite/Meta e Draft scadono alla soglia di 730 giorni dalla ricezione server; Research usa la **prima** ricezione server e gli aggiornamenti non rinnovano il periodo. La manutenzione programmata elimina i contributi scaduti; un arretrato può richiedere più cicli. Research conserva la soppressione dell'ID scaduto contro il reinvio, senza revocare il consenso o bloccare contributi nuovi. Il cron Research elabora al massimo 75 contribution per esecuzione; monitorare l'eventuale backlog. Il lifecycle R2 Draft a 730 giorni era già attivo. Nessun dato production è stato cancellato come prova di smoke.

Il closeout è concluso. Non aprire un nuovo audit generale senza regressione concreta. Il pacchetto operativo è in [LAUNCH-EARLY-BETA-OPERATIONS-2026-09-25.md](../launch/LAUNCH-EARLY-BETA-OPERATIONS-2026-09-25.md); nessun post esterno è stato pubblicato.
