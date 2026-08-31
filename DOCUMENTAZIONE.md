# moxtracker — documentazione attiva

Aggiornato il 30 agosto 2026. Questa è la porta d'ingresso della repository:
non usare handoff, piani o checklist datati come istruzioni operative.

## Da leggere ora

1. [LEGGIMI.md](LEGGIMI.md) — struttura, comandi e regola di rilascio.
2. [STATO-CORRENTE-SITO.md](STATO-CORRENTE-SITO.md) — ultimo deploy preview,
   verifiche e confini non modificati; va aggiornato subito dopo ogni preview.
3. [RISPOSTE-PROSSIMA-CHAT-SITO-MOX.md](RISPOSTE-PROSSIMA-CHAT-SITO-MOX.md)
   — decisioni di prodotto e prossime fasi approvate.
4. [ACCOUNT-E-TICKET.md](ACCOUNT-E-TICKET.md) — contratto tecnico di OAuth,
   account e ticket.
5. [CHECKLIST-BETA-SITO-2026-08-27.md](CHECKLIST-BETA-SITO-2026-08-27.md) —
   collaudo manuale beta; va aggiornata insieme alle funzioni che cambiano.
6. [R3-PREP-SCHEMA-STORAGE.md](R3-PREP-SCHEMA-STORAGE.md) — sola proposta di
   schema e storage, non implementabile prima dell'output R2 concordato;
   nessuna scelta definitiva di storage e nessuna autorizzazione al rilascio.

## Regole di precedenza

- Il codice e i test sono la fonte tecnica primaria.
- `main` e le release Cloudflare si verificano con Git e con la checklist,
  non con un vecchio documento di passaggio.
- Preview, produzione, Worker e migrazioni D1 restano operazioni distinte.

## Archivio

I passaggi, gli handoff, gli stati e i piani superati di agosto sono in
[archivio/2026-08-passaggi-e-piani-superati](archivio/2026-08-passaggi-e-piani-superati/).
Raccontano il contesto storico, ma non autorizzano modifiche né definiscono il
lavoro successivo.

L'archivio iniziale delle fasi 1–6 resta in
[archivio/2026-08-sviluppo-iniziale](archivio/2026-08-sviluppo-iniziale/).

## Riferimenti grafici

[immagini esempio](immagini%20esempio/LEGGIMI.md) contiene solo mockup per
confrontare identità visiva e densità dell'interfaccia: non sono dati del
prodotto.
