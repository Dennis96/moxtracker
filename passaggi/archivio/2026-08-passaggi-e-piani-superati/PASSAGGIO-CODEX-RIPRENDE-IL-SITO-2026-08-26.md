# Per Codex — riprendere il sito, dopo A109 e la 2.9.24

> Scritto la sera del **26/08/2026** da Claude. Sostituisce
> `PASSAGGIO-A-CODEX-DOPO-A109-2026-08-26.md`, che copriva solo il repo.
> Da leggere insieme ai tuoi due:
> [PASSAGGIO-NUOVA-CHAT-SITO-26-08.md](PASSAGGIO-NUOVA-CHAT-SITO-26-08.md) e
> [DECISIONI-PRODOTTO-SITO-26-08.md](DECISIONI-PRODOTTO-SITO-26-08.md), che
> restano validi tranne dove questo dice il contrario.

## In tre righe

Mentre eri in pausa è stata chiusa **A109** — i Draft che il server rifiutava —
ed è stata **pubblicata la 2.9.24** su entrambi i canali. Ho committato
**quattro file** nel tuo repository, uno dei quali contiene anche il tuo lavoro
di oggi. **Il Worker non è stato ridistribuito**: online c'è ancora il codice di
ieri, ed è la prima cosa che devi fare.

## Cosa è cambiato dal lato Mox, e perché ti riguarda

**A109 non era il momento dell'invio: era l'ordine del pool.** Arena pubblica
ogni tanto il `CardPool` intero nel proprio ordine, che non è quello in cui le
carte sono state scelte; Mox lo adottava, e `controllaDraft` confronta il pool di
ogni pick con quello del pick prima più la sua scelta **carta per carta e in
posizione**. Nella traccia del 26/08 le rotture erano 22 su 42 pick. Quattro
Draft veri rifiutati interi fra il 24 e il 26/08, con dentro tutte le carte
giuste. Il racconto completo, comprese le strade sbagliate, è in
[`../Codice/passaggi/PASSAGGIO-DRAFT-A109-ESITO-2026-08-26.md`](../Codice/passaggi/PASSAGGIO-DRAFT-A109-ESITO-2026-08-26.md).

Tre conseguenze che cambiano quello che arriva al server:

1. **arriveranno più Draft, e meno rifiuti.** Mox non spedisce più un pacchetto
   che il server rifiuterebbe: lo controlla prima con `pacchetto_draft.controlla`
   — il gemello Python di `controllaDraft` — e se non passa lo tiene in
   quarantena con scritto perché. Aspettati meno rifiuti, non zero: i motivi che
   il client non può prevedere (limiti, duplicati, versioni) restano tuoi;
2. **i quattro Draft rifiutati sono stati recuperati e rispediti.** La catena dei
   pool è stata ricostruita dalle scelte registrate, senza inventare nulla, e
   sono passati: tre accettati, uno già presente. In D1 hanno 42 pick e
   `sospetto` nullo, quindi entrano nella misura della policy — sono i primi
   campioni completi veri che abbiamo;
3. **una traccia chiusa non cambia più le scelte** sul PC dell'utente. Quello che
   ricevi e quello che gli resta adesso coincidono: se un rifiuto va indagato, il
   file da confrontare è quello vero.

## Cosa ho toccato nel tuo repository

Quattro file, in tre commit: `2f3c216`, `677884c`, `e52f784`.

| file | cosa |
|---|---|
| `src/draft.js` | **una riga mia**, in `contieneCampoVietato`: il ramo degli array faceva `return valore.some(...)`, e `some` risponde `true`/`false` — il nome del campo si perdeva e chi riceveva il rifiuto leggeva «campo vietato: true». `controllaDraft` per il resto **non è cambiata** |
| `prove/draft.test.js` | non l'ho modificato: contiene **le tue due regressioni** su `sospettoDraft`, che erano in working tree |
| `prove/casi-pacchetto-draft.json` | **nuovo**: 19 pacchetti col verdetto atteso |
| `prove/casi-pacchetto-draft.test.js` | **nuovo**: li fa giudicare a `controllaDraft` |

Nello stesso commit di `src/draft.js` c'è **la tua correzione di `sospettoDraft`**
(`pool > scelte`): era in working tree non committata, l'ho messa al sicuro
invece di lasciarla lì, e non l'ho modificata.

**Gli altri tuoi nove file sono ancora come li hai lasciati, non committati**:
`.gitignore`, `LEGGIMI.md`, `package.json`, `schema-draft.sql`,
`src/account.js`, `prove/account-ticket.test.js`,
`prove/account-ticket-frontend.test.js`, `strumenti/anteprima_sito.mjs`, più i
tuoi file non tracciati (`build_sito.mjs`, `release_sito.mjs`,
`ricalcola_sospetti_draft.mjs`, `release-sito.config.json`, le prove nuove e i
documenti). Aspettano un commit tuo.

### I casi condivisi, e la regola che li tiene fermi

`prove/casi-pacchetto-draft.json` esiste perché fino a ieri le due
implementazioni non si parlavano: Mox costruiva il pacchetto, il Worker lo
giudicava, e ognuna era provata sui casi che si scriveva da sola. È così che
quattro Draft veri sono stati rifiutati per tre giorni **con tutte le prove
verdi**.

**La copia buona è `../Codice/prove/casi-pacchetto-draft.json`**, e quella qui
deve restarle identica byte per byte: una prova della suite di Mox lo controlla.
Se cambi una regola di `controllaDraft`, aggiorna il file **di là** e ricopialo
qui.

Al primo giro hanno già ripagato: la divergenza del campo vietato l'hanno trovata
loro, non una lettura del codice. E dopo, un secondo caso — `set` con una cifra
non ASCII, che `isdigit()` in Python accetta e il tuo regex no.

## Cosa devi fare, in ordine

1. **Ripubblicare il Worker.** Online c'è ancora `face6463`: non ha né la
   correzione del campo vietato né la tua marcatura dei sospetti. Non è urgente
   per la raccolta — i Draft arrivano lo stesso, la correzione che conta è nel
   client — ma finché non sale, un rifiuto continua a spiegarsi male;
2. **il backfill.** `strumenti/ricalcola_sospetti_draft.mjs` è ancora da
   lanciare, e adesso ha quattro tracce in più da ricalcolare. Attenzione: i
   quattro Draft recuperati **non devono risultare sospetti** (42 scelte su 42
   carte di pool, tutti e tre i pacchetti visti). Quelle che si marcheranno sono
   le righe vecchie con `pick = 0`. È anche il rimedio al **blocco 2** del tuo
   audit — la vecchia traccia difettosa ancora dentro le statistiche pubbliche;
3. **committare i tuoi nove file**, che contengono le correzioni ai **blocchi 3,
   5 e 6** (CORS `PUT` per la rinomina dei mazzi, build riproducibile del sito
   con `?v=` automatico, gate di release Pages). Sono fatte ma vivono solo nella
   working tree: finché restano lì, il sito online non le ha;
4. poi il resto dell'audit: **blocco 4**, le prove reali su account e ticket.

## Il cancello, aggiornato

Il tuo documento dice che il cancello era il Draft reale con la 2.9.23, e che è
stato superato il 26/08. Resta superato. Da stasera c'è però una **2.9.24
pubblicata**, e con lei una cosa che manca: **il Draft vero con la build nuova**.

Non blocca il sito — il lato client è a posto e verificato — ma è la conferma che
il giro completo funziona, e finché non arriva conviene non dare per assestati i
numeri sui Draft. Se l'utente ne gioca uno, deve arrivare **al primo colpo**,
senza righe nuove in `rifiuti_invio_draft.jsonl`.

## Due cose da non fare

- **non trasformare la marcatura in un rifiuto.** La decisione di prodotto è
  conservare le tracce private ed escluderle dagli aggregati, non cancellarle. Le
  tue due regressioni su `sospettoDraft` restano;
- **non toccare `controllaDraft` senza aggiornare i casi condivisi.** Una regola
  cambiata da una parte sola è esattamente il difetto che è costato quattro
  Draft.

## Stato della 2.9.24, per riferimento

Pubblicata su entrambi i canali e verificata riscaricandola: l'installer sceso
dal canale pubblico ha lo stesso SHA-256 di quello costruito in locale, e l'asset
GitHub coincide con lo ZIP. Release
[`mox-v2-beta2.9.24`](https://github.com/Dennis96/moxtracker/releases/tag/mox-v2-beta2.9.24).
Dettagli in [`../Codice/MOX-2.9.24-STATO.md`](../Codice/MOX-2.9.24-STATO.md).

Suite Mox completa verde (174 prove Draft), suite del server **152/152**.
