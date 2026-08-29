-- Da applicare soltanto dopo approvazione esplicita e prima in preview.
-- Non legge R2 e non ricostruisce dati storici: le nuove righe iniziano con
-- gli invii successivi alla migrazione o con un import esterno verificato.
CREATE TABLE IF NOT EXISTS draft_mazzo_carta (
  draft_id TEXT NOT NULL, versione INTEGER NOT NULL, arena_id INTEGER NOT NULL,
  copie INTEGER NOT NULL, PRIMARY KEY (draft_id, versione, arena_id)
);
CREATE INDEX IF NOT EXISTS draft_mazzo_carta_arena ON draft_mazzo_carta (arena_id);

CREATE TABLE IF NOT EXISTS draft_catalogo_carta (
  set_code TEXT NOT NULL, arena_id INTEGER NOT NULL, nome TEXT NOT NULL,
  colori TEXT NOT NULL, aggiornato TEXT NOT NULL, PRIMARY KEY (set_code, arena_id)
);

CREATE TABLE IF NOT EXISTS draft_stat_esterna (
  fonte TEXT NOT NULL, set_code TEXT NOT NULL, formato TEXT NOT NULL,
  arena_id INTEGER NOT NULL, nome TEXT NOT NULL, colori TEXT NOT NULL,
  metrica TEXT NOT NULL, vittorie INTEGER NOT NULL, campione INTEGER NOT NULL,
  dataset_aggiornato TEXT NOT NULL, importato TEXT NOT NULL,
  PRIMARY KEY (fonte, set_code, formato, arena_id, metrica)
);
CREATE INDEX IF NOT EXISTS draft_stat_esterna_lookup
  ON draft_stat_esterna (fonte, set_code, formato, metrica);
