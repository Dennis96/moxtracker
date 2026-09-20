# moxtracker — istruzioni per chi ci lavora

La fonte canonica è [LEGGIMI.md](LEGGIMI.md). Si legge **una volta, all'inizio
di ogni lavoro su moxtracker**, e da lì si segue l'ordine dei documenti che
indica. Qui non c'è stato: versioni, URL, conteggi e lavori aperti stanno solo
là, e il codice, la cronologia Git e `npm run prove` prevalgono su qualunque
documento.

Regole permanenti:

- **Si lavora su un branch o un worktree proprio creato da `main`**, mai su
  `main`. Nelle sessioni aperte da Progetto Magic un hook blocca le modifiche
  ai file su `main`.
- **Il repository è pubblico.** Niente dati privati: log, nomi e identificativi
  di account, dump del database, materiale di `..\Non pubblicare`.
- **Produzione, Worker, migrazioni D1 e segreti sono passaggi separati** e
  richiedono l'autorizzazione esplicita del macro-task; il sito passa sempre da
  preview. Dal 20/09/2026 nessun hook chiede più conferma per push, deploy o
  scritture remote: un hook **nega** le sole operazioni distruttive (force push
  o push diretto su un branch protetto, cancellazioni remote), e per il resto
  vale il mandato — se non le autorizza esplicitamente, Claude si ferma e
  presenta operazione, target, test e rollback.
- **Staging e produzione condividono le quote D1 dell'account**: un benchmark
  su staging può fermare la produzione. Ogni prova che scrive righe ha un
  tetto.
- **`prove/casi-pacchetto-draft.json` è una copia identica** di quello in
  `mox-core/prove/`: si cambiano insieme, nello stesso lavoro, e la suite di
  Mox controlla che coincidano byte per byte.
- **Fine riga**: tutto LF, `.bat` CRLF, come dice `.gitattributes`.
- Si scrive in italiano, anche nel codice e nei commenti.
