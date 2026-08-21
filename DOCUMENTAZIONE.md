# moxtracker — indice della documentazione

> Aggiornato il **20/08/2026**. Questo file distingue lo stato corrente dai
> passaggi storici; le istruzioni contenute nei vecchi handoff non prevalgono
> sul codice e sul [LEGGIMI.md](LEGGIMI.md).

## Da leggere adesso

1. [LEGGIMI.md](LEGGIMI.md) — stato verificato, struttura, test e percorso di
   pubblicazione.
2. [STEP8-PRELANCIO-SITO.md](STEP8-PRELANCIO-SITO.md) — correzioni della beta
   pubblica, Privacy, navigazione mobile e anteprima con dati reali.
3. [STEP7-DRAFT-DATI-ONLINE.md](STEP7-DRAFT-DATI-ONLINE.md) — contratto Draft,
   R2/D1, privacy, tetti e stato Cloudflare.

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
