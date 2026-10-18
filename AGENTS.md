# moxtracker — istruzioni per gli agenti

Valgono identiche per ogni strumento, Codex compreso; `CLAUDE.md` rimanda qui.
La fonte sullo stato è [STATO-CORRENTE-SITO.md](STATO-CORRENTE-SITO.md), la
mappa dei documenti è [LEGGIMI.md](LEGGIMI.md): si legge una volta, all'inizio
di ogni lavoro su moxtracker. Il codice, la cronologia Git e `npm run prove`
prevalgono su qualunque documento.

## Il ciclo di un lavoro

È quello di tutto Mox, scritto una volta sola in
[mox-core, AGENTS.md — il ciclo di un lavoro](https://github.com/Dennis96/mox-core/blob/main/AGENTS.md#il-ciclo-di-un-lavoro):
un lavoro alla volta su tutto Mox (core e sito dello stesso lavoro contano come
uno), un branch e una PR draft per lavoro, review dell'altro agente in un solo
file sul branch della PR, al massimo due giri, merge autorizzato da Dennis con
la chiusura compresa. Il registro dei lavori è
[mox-core/LAVORI.md](https://github.com/Dennis96/mox-core/blob/main/LAVORI.md).

## Regole permanenti

- **Si lavora su un branch o un worktree proprio creato da `main`**, mai su
  `main`. Il worktree vive in `Progetto Magic/worktrees/sito-<tema>-<data>`.
- **Il repository è pubblico.** Niente dati privati: log, nomi e identificativi
  di account, dump del database, materiale di `..\Non pubblicare`.
- **Produzione, Worker, migrazioni D1 e segreti sono passaggi separati** e
  richiedono l'autorizzazione esplicita del macro-task; il sito passa sempre da
  preview. Se il mandato non li autorizza, ci si ferma e si presentano
  operazione, target, prove e rollback.
- **Staging e produzione condividono le quote D1 dell'account**: un benchmark
  su staging può fermare la produzione. Ogni prova che scrive righe ha un
  tetto.
- **`prove/casi-pacchetto-draft.json` è una copia identica** di quello in
  `mox-core/prove/`: si cambiano insieme, nello stesso lavoro, e la suite di
  Mox controlla che coincidano byte per byte.
- **Fine riga**: tutto LF, `.bat` CRLF, come dice `.gitattributes`.
- Si scrive in italiano, anche nel codice e nei commenti.

## Le prove

```powershell
npm run prove
npm run sito:build
```

Ogni PR verso `main` le esegue anche su GitHub (workflow `prove.yml`, meno di
un minuto). Un controllo verde su GitHub non sostituisce le prove mirate del
lavoro né il collaudo in preview. `STATO-CORRENTE-SITO.md` si aggiorna dopo
ogni deploy riuscito, in poche righe: stato, prossimo passo, decisioni attese.
