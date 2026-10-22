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
- Il gate `~/.claude/hooks/code-review-gate.py` (dal 22/10/2026) non controlla
  i commit: blocca il merge di una PR che contiene codice quando manca lo
  stamp di un `/code-review` della sua ultima versione; i soli `.md` e `.txt`
  sono documenti. Lo stamp si registra con `code-review-gate.py stamp-pr
  <numero> Dennis96/moxtracker`; la regola completa (un solo `/code-review`
  per PR, livello proporzionato al rischio) è in
  [mox-core, AGENTS.md — il ciclo di un lavoro](https://github.com/Dennis96/mox-core/blob/main/AGENTS.md#il-ciclo-di-un-lavoro).
- Nel terminale dell'utente `npm` si chiama `npm.cmd`.
