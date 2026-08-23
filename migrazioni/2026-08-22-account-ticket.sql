-- Account OAuth e ticket. Migrazione additiva: non modifica partite, Draft o
-- contributori gia' online e puo' essere rilanciata senza duplicare nulla.

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  avatar TEXT,
  ruolo TEXT NOT NULL DEFAULT 'utente',
  creato TEXT NOT NULL,
  aggiornato TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_identita (
  provider TEXT NOT NULL,
  soggetto TEXT NOT NULL,
  account_id TEXT NOT NULL,
  PRIMARY KEY (provider, soggetto)
);
CREATE INDEX IF NOT EXISTS account_identita_account
  ON account_identita (account_id);

CREATE TABLE IF NOT EXISTS account_sessione (
  hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  creato TEXT NOT NULL,
  scade TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS account_sessione_account
  ON account_sessione (account_id, scade);

CREATE TABLE IF NOT EXISTS account_oauth_stato (
  hash TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  ritorno TEXT NOT NULL,
  creato TEXT NOT NULL,
  scade TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_codice_mox (
  hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  creato TEXT NOT NULL,
  scade TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_dispositivo (
  mittente TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  segreto_hash TEXT NOT NULL,
  collegato TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS account_dispositivo_account
  ON account_dispositivo (account_id, collegato);

CREATE TABLE IF NOT EXISTS ticket (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  accesso_hash TEXT,
  categoria TEXT NOT NULL,
  titolo TEXT NOT NULL,
  stato TEXT NOT NULL,
  versione_mox TEXT,
  diagnostica_id TEXT,
  creato TEXT NOT NULL,
  aggiornato TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ticket_account ON ticket (account_id, aggiornato);

CREATE TABLE IF NOT EXISTS ticket_messaggio (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  autore TEXT NOT NULL,
  testo TEXT NOT NULL,
  creato TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ticket_messaggio_ticket
  ON ticket_messaggio (ticket_id, creato);

CREATE TABLE IF NOT EXISTS ticket_allegato (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  byte INTEGER NOT NULL,
  oggetto_r2 TEXT NOT NULL UNIQUE,
  creato TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ticket_allegato_ticket
  ON ticket_allegato (ticket_id, creato);

CREATE TABLE IF NOT EXISTS ticket_audit (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  ticket_id TEXT NOT NULL,
  azione TEXT NOT NULL,
  dettaglio TEXT,
  creato TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ticket_audit_ticket
  ON ticket_audit (ticket_id, creato);
