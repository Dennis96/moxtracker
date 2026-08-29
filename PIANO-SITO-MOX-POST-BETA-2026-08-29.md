# Piano sito Mox — stato dopo la beta del 29 agosto 2026

## Direzione confermata

Il sito deve far scaricare Mox, aumentare i contributi consensuali e rendere
utili e trasparenti Meta, Draft e dati personali. Il Meta pubblico resta un
effetto della playerbase Mox, non il prodotto che giustifica una raccolta dati
aggiuntiva.

La beta è aperta. Italiano e inglese sono le due lingue iniziali. Ogni rilascio
passa dalla preview; la produzione Pages, le migrazioni D1 e le modifiche ai
dati di produzione richiedono autorizzazione separata.

## Fatto in preview

- Home orientata al download, con due schermate reali e spiegazione di tracker,
  Draft, archivio mazzi e contributo anonimo al Meta.
- Meta con filtri, archetipi, varianti, lista di riferimento, copia per Arena,
  profilo deck e soglie dichiarate.
- Draft pubblico aggregato per set, evento e periodo.
- Account con OAuth, collegamento Mox, dispositivi, consensi, mazzi, partite,
  Draft, rinomina, export, revoca e cancellazione per sezione.
- Ticket autenticati e anonimi, Turnstile, ZIP diagnostico Mox con consenso,
  amministrazione e chiusura/riapertura dei ticket.
- Traduzione IT/EN; il 29/08 sono state corrette e verificate Meta e Account
  inglesi, che ora caricano correttamente.
- Carte localizzate quando disponibili, immagine condivisibile del mazzo e
  preview carte con caricamento anticipato delle immagini visibili.

## Da confermare manualmente nella preview

1. Dopo `Ctrl+F5`, le preview carte devono apparire subito intere in italiano e
   inglese, senza riquadri vuoti o attese lunghe.
2. Cambio IT/EN da Home, Meta, Draft e Account: pagina e dati devono restare
   funzionanti; in inglese Account deve arrivare a “Sign in” e Meta alla tabella.
3. PNG di condivisione: deve vedersi nel popup prima di copia, download o menu
   di condivisione del sistema.
4. Ticket: ZIP Mox strutturato fino a 10 MB, chiusura admin e riapertura dopo
   replica dell’utente.
5. Draft reali prodotti da Mox 2.9.27: set/evento, separazione sessioni e
   assenza di rifiuti.

## Lavoro in pausa

- Email per i ticket: Resend e dominio sono in configurazione. Il flusso scelto
  usa un indirizzo facoltativo, consenso esplicito, conferma via link e avvisi
  senza testo del ticket o allegati. Richiede una migrazione D1 additiva prima
  della pubblicazione del Worker.

## Prossima fase da decidere

Il questionario `QUESTIONARIO-PROSSIMA-CHAT-SITO-MOX.html` contiene 96 scelte
su crescita, homepage, prestazioni, Meta, Draft, account/condivisione, ticket,
amministrazione, contenuti, mobile, privacy e roadmap. Le risposte esportate
sono il punto di ingresso consigliato per la prossima chat.
