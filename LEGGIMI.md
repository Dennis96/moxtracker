# moxtracker — API e sito di Mox

`moxtracker` è la parte online di Mox: riceve contributi solo con consenso,
calcola aggregati pubblici e serve il sito. Il client desktop vive nel progetto
fratello `..\Codice`.

## Struttura

- `src/` — Worker Cloudflare, API, aggregati Meta e Draft.
- `sito/` — frontend statico IT/EN.
- `prove/` — suite automatica.
- `migrazioni/` — sole migrazioni D1 addittive.
- `strumenti/` — build, preview, smoke test e controlli di rilascio.

## Comandi utili

```powershell
npm run prove
npm run sito:build
npm run sito-locale
```

Il rilascio del sito passa sempre da preview. Produzione, Worker e migrazioni
D1 sono passaggi separati e richiedono autorizzazione esplicita.

## Stato e documenti attivi

Per riprendere il lavoro leggere nell'ordine:

1. [DOCUMENTAZIONE.md](DOCUMENTAZIONE.md)
2. [STATO-CORRENTE-SITO.md](STATO-CORRENTE-SITO.md), sempre prima di nuovo lavoro.
3. [RISPOSTE-PROSSIMA-CHAT-SITO-MOX.md](RISPOSTE-PROSSIMA-CHAT-SITO-MOX.md)
4. [ACCOUNT-E-TICKET.md](ACCOUNT-E-TICKET.md), solo per account e supporto.
5. [CHECKLIST-BETA-SITO-2026-08-27.md](CHECKLIST-BETA-SITO-2026-08-27.md), prima di un collaudo beta.

Il codice, la cronologia Git e `npm run prove` prevalgono sempre sui documenti
storici.

Dopo ogni deploy preview riuscito aggiornare subito
[STATO-CORRENTE-SITO.md](STATO-CORRENTE-SITO.md): commit, URL, modifiche,
verifiche e confini non toccati. Non creare un secondo handoff per lo stesso
scopo.
