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
CREATE INDEX IF NOT EXISTS draft_sospetto ON draft (sospetto)
  WHERE sospetto IS NOT NULL;
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

-- Indice normalizzato delle carte nei mazzi Draft. E' additivo e sostituisce
-- la lettura dei JSON R2 nelle statistiche pubbliche; una cancellazione del
-- contributore rimuove anche queste righe.
CREATE TABLE IF NOT EXISTS draft_mazzo_carta (
  draft_id   TEXT NOT NULL,
  versione   INTEGER NOT NULL,
  arena_id   INTEGER NOT NULL,
  copie      INTEGER NOT NULL,
  PRIMARY KEY (draft_id, versione, arena_id)
);
CREATE INDEX IF NOT EXISTS draft_mazzo_carta_arena ON draft_mazzo_carta (arena_id);

-- Metadati verificati da un import offline: non sono inviati dai giocatori.
CREATE TABLE IF NOT EXISTS draft_catalogo_carta (
  set_code   TEXT NOT NULL,
  arena_id   INTEGER NOT NULL,
  nome       TEXT NOT NULL,
  colori     TEXT NOT NULL,
  aggiornato TEXT NOT NULL,
  PRIMARY KEY (set_code, arena_id)
);

-- Snapshot esterni, separati da Mox. Nessuna statistica dei due campioni si
-- somma mai; ogni riga dichiara origine e versione del dataset.
CREATE TABLE IF NOT EXISTS draft_stat_esterna (
  fonte              TEXT NOT NULL,
  set_code           TEXT NOT NULL,
  formato            TEXT NOT NULL,
  arena_id           INTEGER NOT NULL,
  nome               TEXT NOT NULL,
  colori             TEXT NOT NULL,
  metrica            TEXT NOT NULL,
  vittorie           INTEGER NOT NULL,
  campione           INTEGER NOT NULL,
  dataset_aggiornato TEXT NOT NULL,
  importato          TEXT NOT NULL,
  PRIMARY KEY (fonte, set_code, formato, arena_id, metrica)
);
CREATE INDEX IF NOT EXISTS draft_stat_esterna_lookup
  ON draft_stat_esterna (fonte, set_code, formato, metrica);

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
