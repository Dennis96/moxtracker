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
4. [STEP6.1.1-FIX-CACHE-ART-CROP.md](STEP6.1.1-FIX-CACHE-ART-CROP.md) — ultimo
   intervento locale sulle immagini delle carte.
5. [STEP6.1-ART-CROP-THUMBNAIL.md](STEP6.1-ART-CROP-THUMBNAIL.md) — decisione
   grafica sulle miniature `art_crop`.
6. [STEP6-IMMAGINI-CARTE-HOVER.md](STEP6-IMMAGINI-CARTE-HOVER.md) — base del
   caricamento immagini e dell'anteprima.

Gli Step 6 sono lavoro locale intenzionalmente non pubblicato. Non vanno
confusi con lo stato del Worker attualmente in linea.

## Architettura già integrata

- [STEP5-ARCHETYPE-ENGINE.md](STEP5-ARCHETYPE-ENGINE.md) — motore archetipi.
- [STEP5.1-FIX-CARTE-BIFRONTE.md](STEP5.1-FIX-CARTE-BIFRONTE.md) — carte a due
  facce.
- [STEP5.2-ARCHETIPI-VARIANTI.md](STEP5.2-ARCHETIPI-VARIANTI.md) — varianti.
- [STEP5.3-NOMI-CANONICI-VARIANTI.md](STEP5.3-NOMI-CANONICI-VARIANTI.md),
  [STEP5.3.1-FIX-NOMI-CARTE-VARIANTI.md](STEP5.3.1-FIX-NOMI-CARTE-VARIANTI.md)
  e [STEP5.3.2-PULIZIA-FRONTEND.md](STEP5.3.2-PULIZIA-FRONTEND.md) — nomi
  canonici e pulizia del frontend.

## Passaggi storici

Questi documenti spiegano come si è arrivati allo stato attuale. Le frasi
«manca il sito», «prossimo lavoro» o simili fotografano la loro data, non il
20/08/2026.

- [PER-COSTRUIRE-IL-SITO.md](PER-COSTRUIRE-IL-SITO.md) — specifica iniziale
  consegnata a ChatGPT Chat.
- [LEGGIMI-FRONTEND-V1.md](LEGGIMI-FRONTEND-V1.md) — istruzioni della prima
  consegna frontend, ormai già integrate nel repository.
- [STEP2-CAMBIAMENTI.md](STEP2-CAMBIAMENTI.md),
  [STEP3-CAMBIAMENTI.md](STEP3-CAMBIAMENTI.md) e
  [STEP4-CAMBIAMENTI.md](STEP4-CAMBIAMENTI.md) — evoluzione iniziale del sito.
- [HANDOFF-MOXTRACKER-STEP5-2026-08-19.md](HANDOFF-MOXTRACKER-STEP5-2026-08-19.md)
  — consegna a fine Step 5.
- [AUDIT-MOXTRACKER-PRE-STEP6-2026-08-19.md](AUDIT-MOXTRACKER-PRE-STEP6-2026-08-19.md)
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
