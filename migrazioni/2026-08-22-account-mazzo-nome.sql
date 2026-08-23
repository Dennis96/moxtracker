-- Nomi privati delle decklist costruite nella dashboard account.
CREATE TABLE IF NOT EXISTS account_mazzo_nome (
  account_id     TEXT NOT NULL,
  formato        TEXT NOT NULL,
  impronta       TEXT NOT NULL,
  nome           TEXT NOT NULL,
  aggiornato     TEXT NOT NULL,
  PRIMARY KEY (account_id, formato, impronta)
);
CREATE INDEX IF NOT EXISTS account_mazzo_nome_account
  ON account_mazzo_nome (account_id, aggiornato);
