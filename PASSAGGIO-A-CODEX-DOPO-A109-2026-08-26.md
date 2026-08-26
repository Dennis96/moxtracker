# Per Codex — cosa è cambiato nel tuo repo mentre eri in pausa

> Scritto il **26/08/2026, sera**, da Claude. Riguarda solo `moxtracker`. Il
> lavoro su Mox è chiuso: A109 è corretta e la 2.9.24 è costruita in locale.

## In una riga

Ho committato **quattro file**, uno dei quali contiene anche il tuo lavoro di
oggi. **Il Worker non è stato ripubblicato**: la pubblicazione la fai tu, ed è
la prima cosa da fare quando riprendi.

## Cosa ho toccato, e perché

### `src/draft.js` — una riga mia, più la tua

Dentro `contieneCampoVietato`, il ramo degli array faceva
`return valore.some(...)`: `some` risponde `true`/`false`, quindi il **nome del
campo si perdeva** e chi riceveva il rifiuto leggeva «campo vietato: true». Ora
il ciclo restituisce la chiave.

Non l'ho trovato leggendo: l'hanno trovato i casi condivisi, al primo giro.

Nello stesso commit c'è **la tua correzione di `sospettoDraft`** (`pool > scelte`)
con le tue due regressioni in `prove/draft.test.js`, che erano in working tree
non committate. Le ho messe al sicuro invece di lasciarle lì; non le ho
modificate. **Gli altri tuoi nove file non li ho toccati**: `.gitignore`,
`LEGGIMI.md`, `package.json`, `schema-draft.sql`, `src/account.js`, le prove
dell'account e degli strumenti sono ancora come li hai lasciati, non committati.

`controllaDraft` **non è cambiata** a parte quella riga.

### `prove/casi-pacchetto-draft.json` e `prove/casi-pacchetto-draft.test.js` — nuovi

Diciannove pacchetti con il verdetto atteso, giudicati **sia** da
`controllaDraft` **sia** dal suo gemello Python `pacchetto_draft.controlla`, che
ho scritto in Mox oggi.

Il file esiste perché fino a ieri le due implementazioni non si parlavano: Mox
costruiva il pacchetto, il Worker lo giudicava, e ognuna era provata sui casi che
si scriveva da sola. È così che quattro Draft veri sono stati rifiutati interi
per tre giorni con tutte le prove verdi.

**La copia buona è `Codice/prove/casi-pacchetto-draft.json`**; questa qui deve
restarle identica byte per byte, e una prova della suite di Mox lo controlla. Se
cambi una regola di `controllaDraft`, aggiorna il file **di là** e ricopialo.

## Cosa devi fare tu, in ordine

1. **Ripubblicare il Worker.** Online c'è ancora `face6463`, che non ha né la
   correzione del campo vietato né la tua marcatura dei sospetti. Non è urgente
   per i Draft — la correzione che li fa arrivare è nel client ed è già
   nell'EXE — ma finché non sale, un rifiuto continua a spiegarsi male;
2. **il backfill.** `strumenti/ricalcola_sospetti_draft.mjs` è ancora da
   lanciare, e adesso ha quattro tracce in più da ricalcolare: i Draft che il
   server aveva rifiutato fra il 24 e il 26/08 sono stati riparati e rispediti
   oggi. Sono in D1 con 42 pick e `sospetto` nullo, e con la tua regola nuova
   devono restare tali — le scelte ci sono tutte. Le righe che invece si
   marcheranno sono quelle vecchie con `pick = 0`;
3. **i tuoi nove file** aspettano ancora un commit tuo.

## Cosa è cambiato su Mox, che ti riguarda

**A109 era l'ordine del pool**, non il momento dell'invio: Arena pubblica il
`CardPool` nel suo ordine e Mox lo adottava, mentre il server confronta la catena
dei pick posizione per posizione. Dettaglio in
[`../Codice/passaggi/PASSAGGIO-DRAFT-A109-ESITO-2026-08-26.md`](../Codice/passaggi/PASSAGGIO-DRAFT-A109-ESITO-2026-08-26.md).

Due cose che cambiano cosa arriva al server:

- **Mox non spedisce più un pacchetto che il server rifiuterebbe.** Lo controlla
  prima con il gemello e, se non passa, lo tiene in quarantena con scritto
  perché. Aspettati **meno rifiuti**, non zero: i motivi che il client non può
  prevedere (limiti, duplicati) restano tuoi;
- **una traccia chiusa non cambia più le scelte**, quindi quello che ricevi e
  quello che resta sul PC dell'utente adesso coincidono. Se un giorno un rifiuto
  va indagato, il file da confrontare è quello vero.

Il resto della suite di Mox non ti tocca. `npm run prove`: **152/152**.
