# moxtracker — indice della documentazione

> Aggiornato il **22/08/2026**. Questo file distingue lo stato corrente dai
> passaggi storici; le istruzioni contenute nei vecchi handoff non prevalgono
> sul codice e sul [LEGGIMI.md](LEGGIMI.md).

## Da leggere adesso

1. [ACCOUNT-E-TICKET.md](ACCOUNT-E-TICKET.md) — account OAuth, dashboard
   personale, collegamento Mox, ticket e configurazione pubblicata.
2. [S2-CHIUSURA-2026-08-22.md](S2-CHIUSURA-2026-08-22.md) — perimetro corretto
   di S2 e regressione permanente sui mazzi precostruiti.

3. [MOXTRACKER-HANDOFF-2026-08-21.md](MOXTRACKER-HANDOFF-2026-08-21.md) — stato
   integrato `frontend-v1` `1c268e8`, privacy pubblica, vista varianti,
   deploy Worker/Pages e verifica richiesta sulle partite Ladder.
4. [LEGGIMI.md](LEGGIMI.md) — stato verificato, struttura, test e percorso di
   pubblicazione.
5. [STEP8-PRELANCIO-SITO.md](STEP8-PRELANCIO-SITO.md) — correzioni della beta
   pubblica, Privacy, navigazione mobile e anteprima con dati reali.
6. [STEP7-DRAFT-DATI-ONLINE.md](STEP7-DRAFT-DATI-ONLINE.md) — contratto Draft,
   R2/D1, privacy, tetti e stato Cloudflare.

## Stato pubblico e lavoro locale

Il ramo di provenienza resta `frontend-v1` al commit integrato `1c268e8`; le
modifiche locali autorizzate del 22/08 sono pubblicate sul Worker e su Pages.
Il dominio principale è `https://moxtracker.app` e la beta separata è
`https://beta.moxtracker.pages.dev`. Lo stato verificato è **110/110** prove.
Le decklist osservate sono pubblicabili solo dopo 30 partite della stessa
variante, senza mai esporre il mittente; la vista variante è separata dalla
pagina archetipo. S2 è stata riallineata al difetto reale e chiusa nel codice:
gli eventi con mazzo fornito entrano nella cronologia privata ma non nel meta
Standard. Impronta Bo1 stabile, Thor Capstone e rank parziale sono stati
pubblicati il 22/08 dopo le migrazioni D1. Account e ticket sono configurati e
pubblici; cronologia, decklist e dettagli restano privati alla sessione OAuth.

I documenti di Step precedenti sono in
[`archivio/2026-08-sviluppo-iniziale`](archivio/2026-08-sviluppo-iniziale/):
spiegano decisioni tecniche già integrate, non l'ordine del lavoro attuale.

## Architettura già integrata

- [STEP5-ARCHETYPE-ENGINE.md](archivio/2026-08-sviluppo-iniziale/STEP5-ARCHETYPE-ENGINE.md) — motore archetipi.
- [STEP5.1-FIX-CARTE-BIFRONTE.md](archivio/2026-08-sviluppo-iniziale/STEP5.1-FIX-CARTE-BIFRONTE.md) — carte a due
  facce.
- [STEP5.2-ARCHETIPI-VARIANTI.md](archivio/2026-08-sviluppo-iniziale/STEP5.2-ARCHETIPI-VARIANTI.md) — varianti.
- [STEP5.3-NOMI-CANONICI-VARIANTI.md](archivio/2026-08-sviluppo-iniziale/STEP5.3-NOMI-CANONICI-VARIANTI.md),
  [STEP5.3.1-FIX-NOMI-CARTE-VARIANTI.md](archivio/2026-08-sviluppo-iniziale/STEP5.3.1-FIX-NOMI-CARTE-VARIANTI.md)
  e [STEP5.3.2-PULIZIA-FRONTEND.md](archivio/2026-08-sviluppo-iniziale/STEP5.3.2-PULIZIA-FRONTEND.md) — nomi
  canonici e pulizia del frontend.

## Passaggi storici

Questi documenti spiegano come si è arrivati allo stato attuale. Le frasi
«manca il sito», «prossimo lavoro» o simili fotografano la loro data, non il
20/08/2026.

- [PER-COSTRUIRE-IL-SITO.md](archivio/2026-08-sviluppo-iniziale/PER-COSTRUIRE-IL-SITO.md) — specifica iniziale
  consegnata a ChatGPT Chat.
- [LEGGIMI-FRONTEND-V1.md](archivio/2026-08-sviluppo-iniziale/LEGGIMI-FRONTEND-V1.md) — istruzioni della prima
  consegna frontend, ormai già integrate nel repository.
- [STEP2-CAMBIAMENTI.md](archivio/2026-08-sviluppo-iniziale/STEP2-CAMBIAMENTI.md),
  [STEP3-CAMBIAMENTI.md](archivio/2026-08-sviluppo-iniziale/STEP3-CAMBIAMENTI.md) e
  [STEP4-CAMBIAMENTI.md](archivio/2026-08-sviluppo-iniziale/STEP4-CAMBIAMENTI.md) — evoluzione iniziale del sito.
- [HANDOFF-MOXTRACKER-STEP5-2026-08-19.md](archivio/2026-08-sviluppo-iniziale/HANDOFF-MOXTRACKER-STEP5-2026-08-19.md)
  — consegna a fine Step 5.
- [AUDIT-MOXTRACKER-PRE-STEP6-2026-08-19.md](archivio/2026-08-sviluppo-iniziale/AUDIT-MOXTRACKER-PRE-STEP6-2026-08-19.md)
  — fotografia tecnica prima delle immagini.

## Riferimenti grafici

La cartella [immagini esempio](immagini%20esempio/LEGGIMI.md) contiene mockup.
Servono per stile e gerarchia visiva; percentuali, volumi, classifiche e
funzioni rappresentate non sono dati del prodotto e non possono essere copiati
nel sito come contenuto reale.

## Script di passaggio

Gli script `strumenti/applica_step532.py`,
`strumenti/applica_step6_immagini_hover.py`,
`strumenti/applica_step61_art_crop.py` e
`strumenti/applica_step611_cache_art_crop.py` documentano e automatizzano le
rispettive trasformazioni. Non vanno rilanciati alla cieca su file già
modificati: prima si legge lo Step corrispondente e si controlla il diff.
