-- Notifiche email facoltative per ticket. Migrazione additiva: non modifica
-- ticket esistenti e non inserisce alcun indirizzo retroattivamente.

CREATE TABLE IF NOT EXISTS ticket_notifica_email (
  ticket_id       TEXT PRIMARY KEY,
  email           TEXT NOT NULL,
  consenso        TEXT NOT NULL,
  verificata      TEXT,
  disiscritta     TEXT,
  creato          TEXT NOT NULL,
  aggiornato      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_notifica_accesso (
  hash            TEXT PRIMARY KEY,
  ticket_id       TEXT NOT NULL,
  creato          TEXT NOT NULL,
  scade           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ticket_notifica_accesso_ticket
  ON ticket_notifica_accesso (ticket_id, scade);
