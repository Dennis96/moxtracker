# Pre-lancio MOX — guida, privacy, IP e gate

Data: 22 settembre 2026  
Perimetro: sito MoxTracker e verifica documentale del client MOX.  
Stato del candidato: **READY FOR PREVIEW; NOT READY FOR PRODUCTION**.

## Baseline e A114

- `moxtracker/main` verificato inizialmente a `d7aa9e1f4220b1a3898e5bb8b57606afcca2bf7b`.
- `mox-core/main` verificato inizialmente a `c540f5a03310362bf06d464fff2f367ef8926983`.
- A114 verificato nel commit `faea835`: modifica solo `ARRETRATI.md`, nessun runtime. Unito separatamente con PR mox-core #7; `mox-core/main` risultante `5e87accd6ed7dcc2c651a6a0ef93c16fce973faf`.
- Nessuna modifica a eseguibile, versione client, feature flag, Worker, D1 o dati di produzione.

## Guida e inventario client

La pagina Download è ora una guida IT/EN con indice interno per Primi passi, tre strumenti, Collezione, I tuoi mazzi, Sviluppo mazzo, Opzioni, Account e sito, Privacy, Problemi e supporto.

L'inventario è stato ricavato dal codice corrente del client, inclusi `assistente.py`, `finestra_mazzi.py`, `MTGA_Collezione.py`, `mazzi_account.py`, `account_mox.py`, i moduli di invio, diagnostica, aggiornamenti, traduzione e costo mazzo. Sono documentati tutti i controlli visibili, la separazione dei consensi, i prerequisiti della sincronizzazione mazzi, la coda/retry Research, la cache asincrona dei mazzi e il confronto collezione nei progetti.

## Informativa privacy

L'informativa è stata completata secondo gli elementi dell'art. 13 GDPR:

- finalità e basi giuridiche distinte per consenso, servizio richiesto e legittimo interesse di sicurezza;
- destinatari e fornitori: Cloudflare, Google, Discord, Resend, Scryfall e GitHub;
- trasferimenti extra SEE e garanzie applicabili;
- retention, diritti, revoca, reclamo, natura facoltativa/necessaria dei dati;
- assenza di decisioni esclusivamente automatizzate con effetti significativi e di profilazione pubblicitaria.

Unico dato non disponibile: identità esatta del titolare. La preview mostra il segnaposto richiesto e il release gate rifiuta tecnicamente la produzione finché è presente `data-legal-todo="controller"`.

## Disclaimer Wizards e audit IP leggero

Tutte le pagine pubbliche espongono il disclaimer richiesto, in italiano e inglese, con link alla Fan Content Policy ufficiale.

Esito dell'audit leggero:

- il marchio MOX usa una mascotte propria e non un logo Wizards come identità;
- non sono emersi marchi Wizards usati come branding MOX;
- le schermate di Arena e le immagini carte sono presentate come materiale del gioco nel contesto della guida/prodotto, senza rimozione deliberata di avvisi;
- le immagini carte continuano a passare dal flusso Scryfall già dichiarato;
- non risultano video o audio Wizards negli asset pubblici;
- i font inclusi hanno le rispettive licenze OFL.

Non è emersa un'incompatibilità evidente con la Fan Content Policy. Questo è un controllo tecnico leggero, non un parere legale.

## Gate tecnici

- `node --test prove/*.test.js`: 466/466 PASS, nessuna prova saltata.
- build riproducibile: verificata dal test dedicato con due build consecutive equivalenti.
- `git diff --check`: PASS.
- disclaimer, guida, traduzioni, privacy e blocco produzione hanno regressioni dedicate.

## Gate ancora aperti

1. Pubblicare una nuova preview dall'esatto `main` fuso e ripetere QA desktop/mobile IT/EN, reduced motion, tastiera, console/rete e download Latest.
2. Inserire l'identità esatta del titolare e ripetere test/preview.
3. Attendere la review indipendente e il release gate del client finale, probabilmente MOX Beta 2.11.1.
4. Il deploy Pages production è esplicitamente escluso dal mandato corrente.

## Rollback

Il cambiamento è solo statico/documentale e può essere annullato revertendo il merge del candidato. Nessun rollback D1, Worker o client è necessario.
