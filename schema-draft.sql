-- Database D1 separato delle tracce Draft. Gli oggetti completi sono in R2.
CREATE TABLE IF NOT EXISTS contributori (
  mittente             TEXT PRIMARY KEY,
  cancellazione_hash   TEXT NOT NULL,
  creato               TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS draft (
  id               TEXT PRIMARY KEY,
  mittente         TEXT NOT NULL,
  ricevuto         TEXT NOT NULL,
  iniziato         TEXT,
  set_code         TEXT NOT NULL,
  formato          TEXT NOT NULL,
  completo         INTEGER NOT NULL,
  pick             INTEGER NOT NULL,
  politica         TEXT NOT NULL,
  mox              TEXT,
  impronta_arena   TEXT,
  oggetto_r2       TEXT NOT NULL UNIQUE,
  byte             INTEGER NOT NULL,
  versione         INTEGER NOT NULL,
  -- Perche' questa traccia non e' un campione buono per la policy. NULL vuol
  -- dire «nessun sospetto»: si conserva tutto, si misura solo il resto.
  sospetto         TEXT
);

CREATE INDEX IF NOT EXISTS draft_mittente_data ON draft (mittente, ricevuto);
CREATE INDEX IF NOT EXISTS draft_set_formato ON draft (set_code, formato, ricevuto);
CREATE UNIQUE INDEX IF NOT EXISTS draft_impronta_arena
  ON draft (impronta_arena) WHERE impronta_arena IS NOT NULL;

CREATE TABLE IF NOT EXISTS draft_pick (
  draft_id     TEXT NOT NULL,
  numero       INTEGER NOT NULL,
  fase         TEXT NOT NULL,
  consiglio    INTEGER NOT NULL,
  scelta       INTEGER NOT NULL,
  seguito      INTEGER NOT NULL,
  vicina       INTEGER NOT NULL,
  campione     INTEGER NOT NULL,
  fonte        TEXT,
  politica     TEXT NOT NULL,
  PRIMARY KEY (draft_id, numero)
);

CREATE INDEX IF NOT EXISTS draft_pick_aggregati
  ON draft_pick (politica, fase, seguito, vicina);

-- Il mazzo che il giocatore ha davvero montato, e i cambi fra una partita e
-- l'altra: Arena riscrive `CourseDeck` ogni volta che tocchi il mazzo, e Mox
-- le manda tutte con l'ora. Serve a rispondere a «cosa cambia l'utente del
-- mazzo che gli abbiamo consigliato», che senza queste versioni non si sa.
-- Le liste sono JSON compatto nella forma del client: [[carta, quantita], ...].
CREATE TABLE IF NOT EXISTS draft_mazzo (
  draft_id   TEXT NOT NULL,
  versione   INTEGER NOT NULL,
  quando     TEXT,
  carte      INTEGER NOT NULL,
  distinte   INTEGER NOT NULL,
  lista      TEXT NOT NULL,
  riserva    TEXT,
  PRIMARY KEY (draft_id, versione)
);

CREATE INDEX IF NOT EXISTS draft_mazzo_ultima ON draft_mazzo (draft_id, versione DESC);

CREATE TABLE IF NOT EXISTS draft_link (
  draft_id  TEXT NOT NULL,
  partita   TEXT NOT NULL,
  esito     TEXT NOT NULL,
  PRIMARY KEY (draft_id, partita)
);

-- L'aggregato resta sempre ricalcolabile e la cancellazione di un contributo
-- lo corregge automaticamente, senza conservare percentuali stantie.
CREATE VIEW IF NOT EXISTS draft_aggregati AS
SELECT politica, fase, COUNT(*) AS pick, SUM(seguito) AS seguiti,
       SUM(vicina) AS vicine,
       SUM(CASE WHEN campione < 100 THEN 1 ELSE 0 END) AS pochi_dati
FROM draft_pick GROUP BY politica, fase;
