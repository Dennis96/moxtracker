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
  richiedono l'autorizzazione esplicita dell'utente; il sito passa sempre da
  preview. Un hook chiede conferma prima di ogni push, deploy o scrittura
  remota.
- **Staging e produzione condividono le quote D1 dell'account**: un benchmark
  su staging può fermare la produzione. Ogni prova che scrive righe ha un
  tetto.
- **`prove/casi-pacchetto-draft.json` è una copia identica** di quello in
  `mox-core/prove/`: si cambiano insieme, nello stesso lavoro, e la suite di
  Mox controlla che coincidano byte per byte.
- **Fine riga**: tutto LF, `.bat` CRLF, come dice `.gitattributes`.
- Si scrive in italiano, anche nel codice e nei commenti.
