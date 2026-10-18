# moxtracker — adattatore per Claude Code

Le regole di lavoro, per qualunque agente, sono in [AGENTS.md](AGENTS.md): si
leggono una volta all'inizio di ogni lavoro su moxtracker, insieme a
[STATO-CORRENTE-SITO.md](STATO-CORRENTE-SITO.md). Qui c'è solo ciò che vale
per Claude Code.

- Nelle sessioni aperte da Progetto Magic l'hook **guardia-branch** blocca le
  modifiche ai file su `main`, e **blocco-distruttivo** nega le sole
  operazioni distruttive (force push o push diretto su un branch protetto,
  cancellazioni remote non verificate). Dal 20/09/2026 nessun hook chiede
  conferma per push, deploy o scritture remote: vale il mandato.
- Il gate `~/.claude/hooks/code-review-gate.py` nega un `git commit` che
  contiene file non `.md` senza lo stamp di un `/code-review` del diff staged.
- Nel terminale dell'utente `npm` si chiama `npm.cmd`.
