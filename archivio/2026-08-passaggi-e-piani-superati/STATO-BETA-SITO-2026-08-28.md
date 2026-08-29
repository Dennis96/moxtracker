# Stato beta sito Mox — 28 agosto 2026

Questo documento fotografa il lavoro locale successivo alla pubblicazione di
Mox 2.9.26. Il perimetro è solo `moxtracker`: nessun file in `../Codice` è
stato modificato.

## Pronto in locale

`main` contiene quattro commit non ancora pubblicati oltre a `origin/main`:

- `e137c92` — consensi correnti dell'account, CORS ristretto per la preview,
  Draft personali e build che ignora la cache operativa di Wrangler;
- `a45e73c` — test privacy Draft reso stabile: controlla la forma pubblica
  della risposta invece di confondere un ID carta con una cifra del timestamp;
- `612eb5b` — collegamento download aggiornato allo ZIP Mox 2.9.26 realmente
  pubblicato e smoke test che usa l'URL configurato, anche con `--site`;
- questo documento — stato e autorizzazioni ancora necessarie.

Verifiche eseguite sullo stato locale finale:

- `npm run prove`: **172/172**;
- `npm audit --omit=dev`: nessuna vulnerabilità nota;
- build statica deterministica: `832f806d34654a34`, 55 file;
- `npx wrangler deploy --dry-run`: Worker valido, nessun deploy effettuato.

## Stato remoto osservato (sola lettura)

La preview attuale `https://preview.moxtracker.pages.dev` risponde `200` per
Home, Draft, Account, Supporto, Privacy e inglese; anche l'API pubblica è
raggiungibile. Il pacchetto GitHub 2.9.26 risponde `200`, ma il link nella
preview già pubblicata resta quello vecchio e viene corretto dal commit
`612eb5b`.

Il preflight CORS della preview verso `/account/me` risponde ancora `403`:
il Worker remoto è al commit `3302a8c` e non contiene la allowlist della
preview. Le pagine pubbliche sono quindi verificabili, ma login, account e
ticket dalla preview non vanno promossi al collaudo finché non sale il Worker
locale.

## Azioni ancora soggette ad autorizzazione esplicita

1. Pubblicare i quattro commit locali e aggiornare soltanto la preview Pages,
   mai la produzione.
2. Applicare `migrazioni/2026-08-27-account-consensi.sql` al D1 principale:
   aggiunge solo tre colonne nullable di stato consenso; non modifica righe
   esistenti. Poi distribuire il Worker corrispondente, senza backfill né altre
   operazioni sui dati.
3. Dopo preview aggiornata, eseguire OAuth e ticket con un account di prova;
   cancellazione e revoca solo su quell'account, mai sull'account principale.
4. Eseguire la checklist in `CHECKLIST-BETA-SITO-2026-08-27.md` con 3–5 tester.

Non serve alcuna modifica al client Mox per far funzionare il sito pubblico.
Per mostrare lo stato consensi nella dashboard, il client collegato deve però
inviare `POST /mox/account/consents` dopo il collegamento e dopo ogni modifica
dei due consensi; fino a quel momento la dashboard dichiara correttamente lo
stato come non sincronizzato.
