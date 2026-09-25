# MOX — remediation copy pre-lancio e retention (candidato preview)

## Perimetro e baseline

- Baseline: `moxtracker/main` `4868934a4f3b41e28302d95937050a27f7aff124`, checkout pulito.
- Branch: `codex/site-prelaunch-copy-remediation-2026-09-25`.
- La review indipendente del 25 settembre è stata letta integralmente. Il delta di policy successivo ha fissato la soglia decklist a 30 partite anche da una sola installazione e la retention Partite/Draft a 730 giorni.
- Nessuna modifica al client, alla soglia 30 o allo schema D1. Il delta finale aggiunge la retention Research alla manutenzione programmata.

## Fatto nel branch

- Privacy: primo livello con risposte su invii, pubblicazione, controlli e cancellazione; informativa completa conservata. I contributi con identificatore stabile sono descritti come pseudonimizzati. La pubblicazione della decklist esatta da una sola installazione è dichiarata senza promettere anonimato assoluto.
- Draft: valore e schermata reale prima del metodo; rimosso il riferimento a raccolta dati e algoritmo dal primo schermo.
- Il mio MOX: menu rinominato; stato prima del login con beneficio, account facoltativo e accesso esplicito. La dashboard con `0` e `—` resta nascosta fino all'accesso.
- Meta: rimossi termini interni dagli stati visibili. Matchup: 30 partite per pubblicare, 100 per indicare un campione più solido, come in `src/lettura.js`.
- Archetipo: ridotti i moduli futuri a una sola sezione contestuale.
- Cosa invia MOX: sintesi per tutti, dati per funzione, dettagli tecnici più in basso.
- Download: prima schermata con versione, Windows, CTA, estrazione e avvio rapidi; indice presentato come guida completa.
- Brand e traduzioni: `MOX` uniforme nel copy, eccetto il nome reale del file `Mox.exe`; nuovi testi italiani coperti da `sito/i18n/en.json`.

## Decisioni di policy applicate

1. **Decklist esatte:** `src/privacy-pubblica.js` resta a 30 partite senza soglia contributor. La Privacy dichiara espressamente la possibilità che tutte le partite provengano da una installazione e che una lista riconoscibile consenta un collegamento indiretto. Non rivendica anonimato assoluto.
2. **Conservazione:** `src/retention.js` usa solo `partite.ricevuta` e `draft.ricevuto`, con cutoff UTC stretto `< now - 730 giorni`; il record esattamente sulla soglia resta fino al giro successivo. Il cron elimina figli e righe Partite nello stesso batch D1, poi pulisce Brew con l'helper canonico. Per Draft elimina prima gli oggetti R2 censiti dall'indice e poi figli e righe D1 in batch atomico. Un errore R2 lascia l'indice intatto; un errore D1 dopo R2 è recuperabile al giro successivo. Gli aggregati pubblici si ricalcolano dalle righe rimaste.
3. **Research:** `src/research/retention.js` scade le contribution a `ricevuta <= now - 730 giorni` (cutoff incluso), senza usare `aggiornata`. Il cron giornaliero processa al massimo 75 contribution per esecuzione, in pagine di 25 e nel budget D1 Research; segnala l'eventuale backlog per il giro successivo. Il batch atomico inserisce i tag di soppressione e poi elimina eventi, carte, sideboard, game, varianti, storia, revisioni e contribution. Usa `research_deleted_contribution.motivo = 'delete'` gia' previsto dallo schema: e' una cancellazione automatica per scadenza, non una revoca. Lineage e generation restano intatte, gli ID scaduti non possono essere reinviati e gli ID nuovi continuano a essere accettati. Nessuna migrazione D1.
4. **Altre categorie:** la pulizia Research non tocca account, ticket, Brew o dati Partite/Draft. La retention Partite/Draft gia' presente resta separata.

Il 25 settembre il comando remoto `wrangler r2 bucket lifecycle list moxtracker-draft-raw` ha confermato `conservazione-24-mesi`, attiva su tutti i prefissi, con scadenza degli oggetti dopo 730 giorni. L'eliminazione esplicita degli oggetti indicizzati usa lo stesso limite e il timestamp server dell'indice; non introduce una durata diversa. Eventuali oggetti orfani preesistenti sono coperti dal lifecycle e individuabili anche dal controllo amministrativo `riconciliaStorageDraft` già presente.

## Criterio editoriale della review visiva

Semplificare senza infantilizzare: testi comprensibili a chi non è tecnico, con tono adulto, naturale e professionale. Nella Privacy usare direttamente i termini giuridici necessari; spiegazioni didascaliche come «la legge chiama questo ruolo» sono state rimosse. La sezione sul titolare ora nomina direttamente Dennis Santinelli e il contatto privacy.

## Verifiche

- Prima del delta: test mirati copy e frontend PASS; una suite completa con due aspettative editoriali ormai stale, poi corrette e verificate in modo mirato.
- Delta retention: test mirati su 729, 730 e oltre 730 giorni, timestamp server, figli, Meta/Brew, Draft/R2, idempotenza, guasti recuperabili e isolamento Research/account/ticket PASS.
- Delta Research: test mirati su cutoff incluso, 729 giorni, figli e storia, revisioni, lineage/generation intatte, nuovo upload, reinvio soppresso, revoca/delete, race upload-retention, ripartenza dopo failure parziale PASS. Una prima suite completa ha trovato un'aspettativa editoriale inglese stale nel test della build; corretta e verificata in modo mirato. La suite completa sul candidato corretto: **476/476 PASS**; `git diff --check` PASS.
- Gate finale del candidato: `npm run prove` **una sola volta**, 472/472 PASS; `git diff --check` PASS; due `npm run sito:build` con build ID identico `3b42223a764f591a` (91 file).
- Revisione del testo sul titolare richiesta al checkpoint visivo: 15/15 test mirati PASS, `npm run prove` eseguito una volta sul candidato rivisto con 472/472 PASS, `git diff --check` PASS, due build identiche `ec9deebd57ad991e` (91 file). Worker e schema invariati rispetto alla prima preview.
- QA della preview precedente: 1440/390/360 px, IT/EN, Privacy, Draft, Il mio MOX logged-out, Meta, Cosa invia MOX e Download; nessun overflow orizzontale, immagine rotta o warning/error di console. Il dettaglio archetipo con un ID pubblico valido resta nel QA della preview finale.
- Prima preview reale del candidato `93b6c8b29c15602fc9bdfc6868975e784368867c`: alias `https://preview.moxtracker.pages.dev`, deployment immutabile `e97bdfc8`; noindex, robots, canonical delle pagine pubbliche, IT/EN, asset, console e layout 1440/390/360 verificati. Il feedback umano successivo ha chiesto una correzione del tono nella sezione «Chi gestisce i tuoi dati».

## Checkpoint corrente

Il candidato finale richiede suite completa una volta, due build riproducibili, commit, push e deploy sull'alias preview senza merge in `main` e senza deploy Pages/Worker production. Dopo il QA della preview il lavoro si ferma per il PASS visivo umano. Il Worker production sarà necessario dopo il PASS per attivare la retention Research runtime; rollback previsto al precedente Worker mantenendo schema D1 invariato. Il limite operativo di 75 scadenze Research per cron richiede osservare l'eventuale backlog in produzione.
