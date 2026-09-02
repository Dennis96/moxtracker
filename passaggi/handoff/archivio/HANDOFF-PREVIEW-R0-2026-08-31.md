# Handoff — preview R0 `moxtracker`

Data: 31 agosto 2026
Stato: **preview R0 pubblicata, nessuna promozione autorizzata**

## 1. Baseline

- Branch: `main`; commit RC pubblicato: `5fa3d34`.
- RC avanti di sei commit rispetto a `origin/main`: `fb6cb3e..5fa3d34`.
- Build: `bb55e75aba7f7718`, 63 file.
- Preview alias: <https://preview.moxtracker.pages.dev>.
- Preview immutabile: <https://ad60ff7a.moxtracker.pages.dev>.

## 2. Modifiche

In questo blocco non è stato modificato codice applicativo. È stata eseguita
una sola pubblicazione Pages dell'artefatto già costruito dalla RC e sono stati
aggiornati lo stato operativo e la checklist tester.

Il perimetro pubblicato corrisponde ai sei commit RC: correzione indici Draft
con `pick=0`, chiarimento M6 di `apertura`, route/link/smoke della preview e
documentazione R3-PREP senza alcuna implementazione.

## 3. Test

- `npm run prove`: **190/190** passati.
- `npm run sito:build`: riuscito, build `bb55e75aba7f7718`.
- Route locali: `/`, `/en/`, `/download`, `/draft`, `/account`, `/supporto`,
  `/privacy`, `/cosa-invia-mox`, `/note-versione`: HTTP 200.
- Smoke post-deploy sull'alias: Home, Draft, Account, Supporto, Privacy, EN,
  API salute/Meta/Draft e GitHub Latest HTTP 200; gate Account HTTP 401 e CORS
  Account HTTP 204, entrambi attesi.
- Verifica browser: Home, Download, Meta, Draft, Account, Supporto, Privacy e
  IT/EN; nessun errore/warning JS rilevato e nessun overflow orizzontale a
  desktop, 375 px o 640 px. Menu mobile apribile e richiudibile con Escape,
  focus restituito con outline visibile.

## 4. Controlli manuali

Restano **MANUALI**, non PASS:

- Chrome, Edge e Firefox aggiornati, telefono reale e preferenza OS di
  movimento ridotto;
- ticket amministratore: cambio stato, risposta e i due eventi `ticket_audit`;
- ticket anonimo/Turnstile/link segreto/riapertura;
- revoca dispositivo, export isolato e cancellazione idempotente su account
  di prova.

La checklist pronta per 3–5 tester è
[CHECKLIST-TESTER-R0-PREVIEW-2026-08-31.md](CHECKLIST-TESTER-R0-PREVIEW-2026-08-31.md).

## 5. Esiti

La preview Pages della RC è disponibile e il suo smoke sull'alias previsto è
verde. L'URL immutabile serve il frontend, ma la richiesta CORS a
`api.moxtracker.app` da quell'origine ottiene HTTP 403: `SITE_ORIGIN`
autorizza esplicitamente l'alias `preview.moxtracker.pages.dev`. Nessuna
modifica Worker è stata effettuata per alterare tale vincolo.

## 6. Rischi

La preview non certifica le funzioni che dipendono da sessioni, Turnstile,
OAuth, D1 o un dispositivo Mox reale. La promozione a produzione resta
bloccata finché non saranno registrati i collaudi manuali e non arriverà una
nuova autorizzazione esplicita.

## 7. Commit

- Pubblicato: `5fa3d34` — `Documenta proposta R3-PREP senza attivarla`.
- Nessun commit, push o deploy Worker/D1/produzione creato in questo blocco.

## 8. Stato R0

**R0 lato sito: preview pronta per beta tester, non chiuso.**

## 9. Prossimo passo proposto

Distribuire la checklist a 3–5 tester e raccogliere gli esiti. Prima di avviare
i collaudi Account/Ticket reali, decidere separatamente quale contesto
Worker/API usare e con quale account di prova.
