# Documentazione operativa e storica

Leggere prima [`STATO-CORRENTE-SITO.md`](../STATO-CORRENTE-SITO.md): è l'unica fonte operativa del sito e del backend pubblico, inclusi commit, preview, produzione, Research R3, verifiche e confini.

Questo indice serve soltanto a trovare i documenti attivi e a distinguere le fonti correnti dallo storico.

## Documenti attivi — 19/09/2026

1. [`STATO-CORRENTE-SITO.md`](../STATO-CORRENTE-SITO.md) — stato operativo canonico di sito, preview, Worker, D1 e release client collegata.
2. [`RUNBOOK-R3-PRODUZIONE.md`](research/RUNBOOK-R3-PRODUZIONE.md) — gestione operativa Research R3 in produzione, inclusi modalità, qualification e rollback.
3. [`ACCOUNT-E-TICKET.md`](contratti/ACCOUNT-E-TICKET.md) — comportamento tecnico di OAuth, account e supporto; lo stato di rilascio resta nel file di stato operativo.
4. [`MOX-LAUNCH-GATE-CANONICO-2026-09-17.md`](sito/MOX-LAUNCH-GATE-CANONICO-2026-09-17.md) — gate unico da chiudere prima della promozione ampia di MOX.
5. [`MOX-PROJECT-MOX-GOAL-PUBBLICI-2026-09-17.md`](sito/MOX-PROJECT-MOX-GOAL-PUBBLICI-2026-09-17.md) — obiettivi pubblici e gerarchia della sezione “Il progetto MOX / Project MOX”.
6. [`MOX-LAUNCH-BLOCCO-RESEARCH-2.11-PRIVACY-RELEASE-NOTES-2026-09-17.md`](sito/MOX-LAUNCH-BLOCCO-RESEARCH-2.11-PRIVACY-RELEASE-NOTES-2026-09-17.md) — allineamento necessario tra sito, Research 2.11.0, Privacy, “Cosa invia MOX”, Download e note di versione.
7. [`MOX-LAUNCH-BLOCCO-SEO-SOCIAL-INDEXING-2026-09-17.md`](sito/MOX-LAUNCH-BLOCCO-SEO-SOCIAL-INDEXING-2026-09-17.md) — canonical, hreflang, sitemap, Open Graph/Twitter e separazione indicizzazione produzione/preview; il branch di implementazione non equivale a deploy.
8. [`META-CATALOG-REFRESH-ROADMAP-2026-09-13.md`](sito/META-CATALOG-REFRESH-ROADMAP-2026-09-13.md) — roadmap tecnica del catalogo Meta; lo stato effettivo dei task successivi resta nei relativi branch/report.
9. [`S1-BREW-CONTRATTO-B1-2026-09-15.md`](sito/S1-BREW-CONTRATTO-B1-2026-09-15.md) — contratto backend dei gruppi Brew: distanza, `k=4`, identificativi, privacy e API.
10. [`S2-BREW-FRONTEND-2026-09-16.md`](sito/S2-BREW-FRONTEND-2026-09-16.md) — frontend dei gruppi Brew, dettaglio `id_brew`, fallback legacy e URL canonici.
11. [`S3-META-CATALOG-REFRESH-2026-09-17.md`](sito/S3-META-CATALOG-REFRESH-2026-09-17.md) — raccolta e decisioni S3; la review indipendente e il consolidamento restano sul branch dedicato fino alla PR.

## Research — stato corrente e storico

**Research R3 è in produzione dal 15/09/2026.** Le precedenti proposte R3-PREP, implementazioni locali e prove di staging restano fonti storiche del percorso e non devono essere lette come stato corrente.

La vecchia [`R3-PREP-SCHEMA-STORAGE.md`](research/proposte/R3-PREP-SCHEMA-STORAGE.md) resta quindi una **proposta storica pre-produzione**, non un documento attivo.

## Sito e launch

I documenti `passaggi/sito/` datati 13–14 settembre su redesign, mockup e prossimi sviluppi restano utili come specifiche o storia del redesign. Per decidere cosa è realmente live oggi, usare sempre `STATO-CORRENTE-SITO.md`.

I documenti launch del 17/09 sopra elencati sono specifiche o implementazioni su branch di preparazione: **non attestano da soli che il launch gate sia PASS e non autorizzano deploy o pubblicazione**.

## Storico

- [`CHECKLIST-MANUALE-R0-CORRENTE.md`](checklist/CHECKLIST-MANUALE-R0-CORRENTE.md) e [`R0-SITO-PUBLIC-READINESS-2026-08-31.md`](report/R0-SITO-PUBLIC-READINESS-2026-08-31.md) descrivono il ciclo R0 precedente; non sono lo stato launch corrente del 17/09.
- `research/proposte/` conserva anche proposte pre-R3 che non equivalgono allo stato di produzione.
- `archivio/` conserva passaggi, piani, checklist e stati superati.
- `handoff/archivio/` e `prompt/archivio/` conservano consegne e prompt eseguiti: non sono istruzioni operative.
- `riferimenti-grafici/` contiene mockup, non dati o schermate affidabili del prodotto reale.

## Regola di housekeeping

Quando un macro-task cambia lo stato globale di sito/backend/release:

1. aggiornare `STATO-CORRENTE-SITO.md` nello stesso lavoro;
2. aggiornare questo indice se cambia la porta d'ingresso o la classificazione attivo/storico;
3. non riscrivere report datati che erano corretti al momento della loro emissione;
4. non creare un secondo file di “stato corrente” concorrente.
