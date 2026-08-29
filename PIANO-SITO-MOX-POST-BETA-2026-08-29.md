# Piano sito Mox — baseline ripristinata e ripartenza

## Baseline verificata

La preview pubblica e `main` sono tornati al contenuto precedente al tentativo
del 29 agosto. Il revert resta nella cronologia Git: non altera il sito attuale
e permette di ricostruire con precisione cosa è successo.

Stato realmente disponibile nella baseline:

- Home beta con download Windows, due screenshot reali e conteggi aggregati.
- Meta Explorer con filtri, soglie, archetipi, varianti e decklist pubblicabili.
- Draft pubblico limitato agli aggregati già sicuri per set, evento e periodo.
- Account con OAuth, collegamento Mox, mazzi, partite, Draft, export e
  cancellazione per sezione.
- Ticket con Resend già implementato e collaudato: consenso esplicito,
  conferma tramite link e notifiche senza testo o allegati del ticket.
- Build riproducibile, preview obbligatoria e 183 test nella baseline.

Non sono ancora disponibili:

- pagina Download e contenuti guida/FAQ completi;
- Meta score pubblico o trend temporali;
- classifiche Draft per colori/carte e importazione 17Lands;
- preferenza reversibile per nascondere un mazzo storico;
- nuove metriche aggregate di conversione.

## Ripartenza: blocchi piccoli

Ogni blocco deve avere un obiettivo verificabile, test mirati e build locale.
Preview Pages, Worker e migrazioni restano passaggi distinti.

### A1 — Carte e localizzazione tecnica

- Usare la stampa esatta identificata da set e numero.
- Se la stampa italiana esatta non esiste, mantenere l'immagine inglese esatta
  e usare il nome italiano quando Scryfall ne conosce uno.
- Miniatura visibile subito, carta completa leggera precaricata solo per gli
  elementi a schermo e qualità normale caricata all'apertura.
- Hover su desktop; focus da tastiera; tap su touch con chiusura esplicita ed
  Escape; rispetto di `prefers-reduced-motion`.
- Test automatico delle chiavi inglesi statiche di Home/Meta, Draft e Account.

### A2 — Verifica manuale IT/EN

Controllare Home/Meta, Draft e Account in italiano e inglese, includendo dati
generati dopo il caricamento. Verificare desktop, viewport mobile stretto,
tastiera e zoom 200%. Correggere soltanto difetti osservati.

### B — Homepage e conversione

Solo dopo A1/A2: hero breve “Scarica Mox e contribuisci al Meta”, beneficio
personale/comunitario, contatore in game, archivio mazzi, pagina Download,
versione stabile e metriche aggregate definite con precisione.

### C — Meta score

Calcolo separato e testato lato Worker, ma non visibile finché il gate dati non
è confermato. Worker e qualsiasi migrazione richiedono autorizzazione separata.

### D — Draft

Prima progettare schema aggregato, privacy, soglie e ricalcolo. Solo dopo:
colori, carte associate ai risultati e import offline dei dataset pubblici
17Lands, mantenendo sempre le due fonti separate.

### E — Account, contenuti e collaudo

Nascondi/ripristina mazzo storico, guida, FAQ, changelog, pagina “Meta
spiegato”, poi checklist con più tester prima della produzione.

## Regole operative

- Nessuna migrazione o modifica dati di produzione senza autorizzazione
  esplicita.
- Nessun deploy Worker implicito in un deploy Pages.
- Nessuna promozione in produzione senza preview verificata e autorizzazione
  separata.
- I dati grezzi Draft in R2 non diventano una sorgente pubblica.
- Il file `RISPOSTE-PROSSIMA-CHAT-SITO-MOX.md` è la fonte delle decisioni di
  prodotto; questo documento descrive solo ordine e stato tecnico.
