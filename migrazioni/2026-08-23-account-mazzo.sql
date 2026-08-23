-- I mazzi costruiti in Arena, sincronizzati dal Mox collegato all'account.
--
-- Restano privati, nome compreso: il nome che l'utente dà a un mazzo è testo
-- libero e non entra mai nelle aggregazioni pubbliche del meta. Qui serve a
-- una cosa sola, cioè far vedere a chi ha fatto il mazzo il nome che gli ha
-- dato lui, invece di quattro righe uguali chiamate come l'archetipo dedotto.
--
-- L'impronta è la stessa SHA-256 delle carte che Mox calcola per le partite:
-- è ciò che permette di unire il mazzo reale alle statistiche già ricevute,
-- senza indovinare niente.
CREATE TABLE IF NOT EXISTS account_mazzo (
  account_id     TEXT NOT NULL,
  impronta       TEXT NOT NULL,
  nome           TEXT NOT NULL,
  carte          TEXT NOT NULL,
  sideboard      TEXT,
  principali     INTEGER NOT NULL,
  laterale       INTEGER NOT NULL DEFAULT 0,
  colori         TEXT,
  aggiornato     TEXT,
  sincronizzato  TEXT NOT NULL,
  PRIMARY KEY (account_id, impronta)
);

CREATE INDEX IF NOT EXISTS account_mazzo_account
  ON account_mazzo (account_id, sincronizzato);
