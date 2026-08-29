-- Additiva; applicare prima in preview e soltanto con autorizzazione esplicita.
CREATE TABLE IF NOT EXISTS metrica_pubblica (
  chiave TEXT PRIMARY KEY, valore INTEGER NOT NULL DEFAULT 0, aggiornato TEXT NOT NULL
);
