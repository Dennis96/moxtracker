-- S1 Brew: gruppi di liste non classificate quasi uguali (contratto B1,
-- passaggi/sito/S1-BREW-CONTRATTO-B1-2026-09-15.md).
--
-- NON applicare a un database remoto senza un'autorizzazione esplicita: la
-- migrazione e' additiva ed e' stata provata soltanto in locale. Lo stesso
-- blocco sta in `schema.sql`, prima di Research, e una prova pretende che i
-- due coincidano.
--
-- Principi:
--
-- 1. un gruppo e' una stella: rappresentante e soglia si fissano alla nascita
--    e non cambiano piu'. Un algoritmo diverso crea gruppi nuovi con un altro
--    nome, non riscrive questi: i trigger rifiutano ogni UPDATE. Il DELETE
--    resta possibile di proposito: la cancellazione dei contributi toglie i
--    membri senza piu' partite e smonta il gruppo che perde il rappresentante;
-- 2. `id` e `variante_id` sono casuali (128 bit) e generati dal server:
--    nessuno dei due si ricava dall'impronta;
-- 3. un'impronta appartiene a un solo gruppo per formato e algoritmo: la
--    chiave primaria rende il backfill ripetibile senza doppioni;
-- 4. qui non ci sono carte, partite, mittenti o record, soltanto impronte e
--    distanze: le statistiche si ricalcolano sempre dalle partite.

CREATE TABLE IF NOT EXISTS brew_gruppo (
  id               TEXT PRIMARY KEY CHECK (length(id) = 35 AND substr(id, 1, 3) = 'bg_'
                     AND NOT substr(id, 4) GLOB '*[^0-9a-f]*'),
  formato          TEXT NOT NULL,
  algoritmo        TEXT NOT NULL,
  soglia_distanza  INTEGER NOT NULL CHECK (soglia_distanza >= 0),
  ordine           INTEGER NOT NULL CHECK (ordine >= 1),
  rappresentante   TEXT NOT NULL CHECK (length(rappresentante) = 64
                     AND NOT rappresentante GLOB '*[^0-9a-f]*'),
  creato           TEXT NOT NULL,
  UNIQUE (id, formato, algoritmo),
  UNIQUE (formato, algoritmo, ordine),
  UNIQUE (formato, algoritmo, rappresentante)
);

CREATE TABLE IF NOT EXISTS brew_membro (
  formato      TEXT NOT NULL,
  algoritmo    TEXT NOT NULL,
  impronta     TEXT NOT NULL CHECK (length(impronta) = 64
                 AND NOT impronta GLOB '*[^0-9a-f]*'),
  gruppo_id    TEXT NOT NULL,
  variante_id  TEXT NOT NULL UNIQUE CHECK (length(variante_id) = 35
                 AND substr(variante_id, 1, 3) = 'bv_'
                 AND NOT substr(variante_id, 4) GLOB '*[^0-9a-f]*'),
  distanza     INTEGER NOT NULL CHECK (distanza >= 0),
  assegnato    TEXT NOT NULL,
  PRIMARY KEY (formato, algoritmo, impronta),
  FOREIGN KEY (gruppo_id, formato, algoritmo)
    REFERENCES brew_gruppo (id, formato, algoritmo)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS brew_membro_gruppo ON brew_membro (gruppo_id);

CREATE TRIGGER IF NOT EXISTS brew_gruppo_congelato BEFORE UPDATE ON brew_gruppo
BEGIN
  SELECT RAISE(ABORT, 'brew_gruppo congelato');
END;

CREATE TRIGGER IF NOT EXISTS brew_membro_congelato BEFORE UPDATE ON brew_membro
BEGIN
  SELECT RAISE(ABORT, 'brew_membro congelato');
END;
