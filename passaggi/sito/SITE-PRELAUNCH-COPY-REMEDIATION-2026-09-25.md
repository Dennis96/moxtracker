# MOX — remediation copy pre-lancio (checkpoint bloccato)

## Perimetro e baseline

- Baseline: `moxtracker/main` `4868934a4f3b41e28302d95937050a27f7aff124`, checkout pulito.
- Branch: `codex/site-prelaunch-copy-remediation-2026-09-25`.
- Solo sito, traduzioni e test del sito. Nessuna modifica a client, Worker, D1 o API.
- La review indipendente del 25 settembre è stata letta integralmente; il prompt operativo allegato è stato seguito nei limiti dei due stop di policy sotto.

## Fatto nel branch

- Privacy: primo livello con risposte su invii, pubblicazione, controlli e cancellazione; informativa completa conservata. I contributi con identificatore stabile sono descritti come pseudonimizzati. La pubblicazione della decklist esatta da una sola installazione è dichiarata senza promettere anonimato assoluto.
- Draft: valore e schermata reale prima del metodo; rimosso il riferimento a raccolta dati e algoritmo dal primo schermo.
- Il mio MOX: menu rinominato; stato prima del login con beneficio, account facoltativo e accesso esplicito. La dashboard con `0` e `—` resta nascosta fino all'accesso.
- Meta: rimossi termini interni dagli stati visibili. Matchup: 30 partite per pubblicare, 100 per indicare un campione più solido, come in `src/lettura.js`.
- Archetipo: ridotti i moduli futuri a una sola sezione contestuale.
- Cosa invia MOX: sintesi per tutti, dati per funzione, dettagli tecnici più in basso.
- Download: prima schermata con versione, Windows, CTA, estrazione e avvio rapidi; indice presentato come guida completa.
- Brand e traduzioni: `MOX` uniforme nel copy, eccetto il nome reale del file `Mox.exe`; nuovi testi italiani coperti da `sito/i18n/en.json`.

## Stop di policy

1. **Decklist esatte:** `src/privacy-pubblica.js` usa solo `SOGLIA_DECKLIST_PARTITE = 30`; `src/dettaglio-archetipo.js` la applica alla variante senza soglia di installazioni indipendenti. La lista esatta può quindi essere pubblicata da una sola installazione. Una regola diversa richiede decisione privacy/statistica e modifica effettiva del comportamento server. Nessuna soglia numerica è stata inventata.
2. **Conservazione:** il lifecycle R2 delle tracce Draft a 730 giorni risulta documentato come attivo in `passaggi/archivio/2026-08-passaggi-e-piani-superati/STEP7-DRAFT-DATI-ONLINE.md`; ticket chiusi e allegati hanno pulizia nel cron (`src/ticket.js`). Per indici Draft e partite, il cron in `src/index.js` non applica una scadenza e non è stata trovata una durata massima definita. La Privacy del branch dichiara il comportamento attuale. Definire un limite e applicarlo richiede una decisione e un cambiamento di comportamento separato.

Il branch **non è pronto per merge, preview o produzione** finché questi due punti non sono decisi e risolti. Nessun deploy è stato eseguito.

## Verifiche

- Test mirati del copy e del frontend: 40/40 PASS; dopo la suite, altri 25/25 PASS sui test che fissavano il vecchio copy.
- `npm run prove` completo eseguito **una volta**: due test falliti perché attendevano letteralmente il vecchio `Mox`, la data Privacy del 24 settembre e la vecchia sezione Research. Le aspettative sono state aggiornate e i test coinvolti passano mirati. La suite completa non è stata ripetuta.
- `git diff --check`: PASS.
- `npm run sito:build` due volte: stessa build `31a1cc3ecd5cf33a`, 91 file.
- QA visiva 1440/390/360, tastiera, console, preview e checkpoint umano: non avviati per lo stop di policy.

## Prossimo passo necessario

Decidere la regola di pubblicazione delle decklist osservate esatte e il periodo di conservazione per indici Draft e partite; implementare e verificare i cambi reali in un lavoro separato. Poi riesaminare la Privacy, rifare il gate finale e procedere a merge e preview per il checkpoint visivo unico.
