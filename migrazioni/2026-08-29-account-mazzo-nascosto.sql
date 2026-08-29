-- Additiva; applicare prima in preview e soltanto con autorizzazione esplicita.
CREATE TABLE IF NOT EXISTS account_mazzo_nascosto (
  account_id TEXT NOT NULL, impronta TEXT NOT NULL, aggiornato TEXT NOT NULL,
  PRIMARY KEY (account_id, impronta)
);
CREATE INDEX IF NOT EXISTS account_mazzo_nascosto_account
  ON account_mazzo_nascosto (account_id, aggiornato);
