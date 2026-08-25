-- Le tracce che non possono essere un campione completo della policy.
--
-- Il 25/08/2026 il server ha ricevuto un Premier segnato `completo = 1` con
-- nove scelte, mentre l'Arena log dello stesso giocatore completava le 42
-- carte sei minuti piu' tardi: il client aveva lo stato sbagliato e ha chiuso
-- una bozza viva. Il server non poteva accorgersene, e non deve nemmeno
-- buttare via il contributo: lo tiene e lo marca.
--
-- `sospetto` e' il motivo, in italiano, oppure NULL per le tracce buone. Le
-- statistiche misurano solo quelle con NULL e contano le altre a parte.
ALTER TABLE draft ADD COLUMN sospetto TEXT;

-- Serve a contarle senza scorrere tutto.
CREATE INDEX IF NOT EXISTS draft_sospetto ON draft (sospetto)
  WHERE sospetto IS NOT NULL;
