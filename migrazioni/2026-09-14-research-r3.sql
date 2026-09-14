-- Research R3: tabelle separate dal legacy `partite`.
--
-- NON applicare a un database di produzione senza un'autorizzazione esplicita:
-- la migrazione e' stata provata su SQLite locale e sul D1 di staging
-- `moxtracker-research-staging`. Lo stesso blocco sta in fondo a
-- `schema.sql`, e una prova pretende che i due coincidano.
--
-- Principi (addendum G3B/G5 §7, G5b §3, G5c §5):
--
-- 1. una contribution e' la prospettiva `(mittente, id_pubblico)`: due
--    mittenti nello stesso match sono due righe, mai un overwrite, e non
--    esistono righe condivise fra mittenti;
-- 2. la snapshot effettiva e le sue proiezioni cambiano nella stessa
--    transazione, aperta da uno statement di guardia che abortisce tutto se
--    lineage, generation, soppressione o CAS non tornano;
-- 3. lineage, tombstone e soppressioni contengono soltanto tag opachi: niente
--    mittente, niente id_pubblico, niente segreti. Sono le sole eccezioni al
--    delete ordinario, e non si esportano.
--
-- Compattazione D1 (14/09/2026, dopo il benchmark sullo staging): su D1 ogni
-- indice e' una riga scritta in piu' e ogni chiave TEXT ripetuta e' spazio.
-- Quindi: le proiezioni puntano alla chiave interna intera della
-- contribution invece di ripetere `mittente` + `id_pubblico`; le tabelle con
-- chiave composta sono `WITHOUT ROWID`, cosi' la chiave primaria e' la tabella
-- stessa; il corpo di una snapshot effettiva sta solo nella contribution (le
-- varianti servono ai conflitti); gli indici analitici arrivano con R4.

CREATE TABLE IF NOT EXISTS research_lineage (
  lineage_tag            TEXT PRIMARY KEY,
  lineage_key_version    INTEGER NOT NULL,
  credential_tag         TEXT NOT NULL,
  credential_key_version INTEGER NOT NULL,
  stato                  TEXT NOT NULL CHECK (stato IN ('active', 'deleting', 'deleted')),
  creata                 TEXT NOT NULL,
  aggiornata             TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS research_consent_generation (
  hash               TEXT PRIMARY KEY,
  mittente           TEXT NOT NULL,
  lineage_tag        TEXT NOT NULL,
  credential_tag     TEXT NOT NULL,
  versione_consenso  INTEGER NOT NULL CHECK (versione_consenso >= 1),
  stato              TEXT NOT NULL CHECK (stato IN ('active', 'revoked')),
  creata             TEXT NOT NULL,
  revocata           TEXT
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS research_generation_lineage
  ON research_consent_generation (lineage_tag, stato);
CREATE INDEX IF NOT EXISTS research_generation_mittente
  ON research_consent_generation (mittente, stato);

CREATE TABLE IF NOT EXISTS research_consent_tombstone (
  hash    TEXT PRIMARY KEY,
  creato  TEXT NOT NULL,
  motivo  TEXT NOT NULL CHECK (motivo IN ('delete'))
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS research_deleted_contribution (
  tag          TEXT PRIMARY KEY,
  key_version  INTEGER NOT NULL,
  creato       TEXT NOT NULL,
  motivo       TEXT NOT NULL CHECK (motivo IN ('delete'))
) WITHOUT ROWID;

-- `id` e' la chiave interna, mai esposta: le proiezioni la usano al posto di
-- `(mittente, id_pubblico)`. L'upsert conserva lo stesso `id` per sempre.
CREATE TABLE IF NOT EXISTS research_contribution (
  id                      INTEGER PRIMARY KEY,
  mittente                TEXT NOT NULL,
  id_pubblico             TEXT NOT NULL,
  versione_server         INTEGER NOT NULL CHECK (versione_server >= 1),
  revisione_modello       INTEGER NOT NULL,
  revisione_osservazioni  INTEGER NOT NULL,
  stato                   TEXT NOT NULL CHECK (stato IN ('effettiva', 'conflitto')),
  overflow                INTEGER NOT NULL CHECK (overflow IN (0, 1)),
  snapshot                TEXT,
  variant_hash            TEXT,
  generation_hash         TEXT NOT NULL,
  mox                     TEXT NOT NULL,
  -- proiezioni match-level, soltanto dalla snapshot effettiva
  quando                  TEXT,
  evento                  TEXT,
  formato                 TEXT,
  esito                   TEXT,
  turni                   INTEGER,
  ricevuta                TEXT NOT NULL,
  aggiornata              TEXT NOT NULL,
  UNIQUE (mittente, id_pubblico),
  CHECK ((stato = 'effettiva') = (snapshot IS NOT NULL AND variant_hash IS NOT NULL)),
  CHECK (stato = 'effettiva' OR (quando IS NULL AND evento IS NULL AND formato IS NULL
    AND esito IS NULL AND turni IS NULL))
);

-- Solo per le contribution in conflitto: le fino a tre varianti trattenute.
CREATE TABLE IF NOT EXISTS research_contribution_variante (
  contribution_id  INTEGER NOT NULL REFERENCES research_contribution (id),
  variant_hash     TEXT NOT NULL,
  body             TEXT NOT NULL,
  ricevuta         TEXT NOT NULL,
  PRIMARY KEY (contribution_id, variant_hash)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS research_snapshot_storia (
  contribution_id         INTEGER NOT NULL REFERENCES research_contribution (id),
  revisione_modello       INTEGER NOT NULL,
  revisione_osservazioni  INTEGER NOT NULL,
  variant_hash            TEXT NOT NULL,
  overflow                INTEGER NOT NULL CHECK (overflow IN (0, 1)),
  body                    TEXT NOT NULL,
  archiviata              TEXT NOT NULL,
  PRIMARY KEY (contribution_id, revisione_modello, revisione_osservazioni, variant_hash)
) WITHOUT ROWID;

-- CAS e guardia atomica: il primo statement di ogni batch upload inserisce
-- la versione successiva. Se un altro Worker l'ha gia' scritta, la PK
-- abortisce il batch; se lineage, generation, soppressione o versione attesa
-- non tornano, `guardia` vale 0 e il CHECK abortisce il batch. Resta a chiave
-- `(mittente, id_pubblico)`: per una contribution nuova la riga nasce prima
-- della contribution stessa.
CREATE TABLE IF NOT EXISTS research_revisione_server (
  mittente         TEXT NOT NULL,
  id_pubblico      TEXT NOT NULL,
  versione         INTEGER NOT NULL,
  generation_hash  TEXT NOT NULL,
  creata           TEXT NOT NULL,
  guardia          INTEGER NOT NULL CHECK (guardia = 1),
  PRIMARY KEY (mittente, id_pubblico, versione)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS research_revisione_quota_mittente
  ON research_revisione_server (mittente, creata);
CREATE INDEX IF NOT EXISTS research_revisione_quota_generation
  ON research_revisione_server (generation_hash, creata);

CREATE TABLE IF NOT EXISTS research_game_contribution (
  contribution_id       INTEGER NOT NULL REFERENCES research_contribution (id),
  game_number           INTEGER NOT NULL CHECK (game_number BETWEEN 1 AND 5),
  on_play               INTEGER CHECK (on_play IS NULL OR on_play IN (0, 1)),
  mulligans             INTEGER,
  free_mulligans        INTEGER,
  mulligan_type         TEXT,
  opening_hand_size     INTEGER,
  cards_bottomed        INTEGER,
  result                TEXT CHECK (result IS NULL OR result IN ('vinta', 'persa')),
  turni                 INTEGER,
  state_reset_observed  INTEGER CHECK (state_reset_observed IS NULL OR state_reset_observed IN (0, 1)),
  state_gap_observed    INTEGER CHECK (state_gap_observed IS NULL OR state_gap_observed IN (0, 1)),
  PRIMARY KEY (contribution_id, game_number)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS research_event (
  contribution_id  INTEGER NOT NULL,
  game_number      INTEGER NOT NULL,
  event_type       TEXT NOT NULL CHECK (event_type IN ('draw', 'cast', 'land')),
  event_id         TEXT NOT NULL,
  turno            INTEGER NOT NULL,
  card_id          INTEGER NOT NULL,
  PRIMARY KEY (contribution_id, game_number, event_id),
  FOREIGN KEY (contribution_id, game_number)
    REFERENCES research_game_contribution (contribution_id, game_number)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS research_deck_card (
  contribution_id  INTEGER NOT NULL,
  game_number      INTEGER NOT NULL,
  sezione          TEXT NOT NULL CHECK (sezione IN ('main', 'sideboard')),
  card_id          INTEGER NOT NULL,
  copie            INTEGER NOT NULL CHECK (copie >= 1),
  PRIMARY KEY (contribution_id, game_number, sezione, card_id),
  FOREIGN KEY (contribution_id, game_number)
    REFERENCES research_game_contribution (contribution_id, game_number)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS research_sideboard_delta (
  contribution_id  INTEGER NOT NULL,
  game_number      INTEGER NOT NULL,
  direzione        TEXT NOT NULL CHECK (direzione IN ('in', 'out')),
  card_id          INTEGER NOT NULL,
  copie            INTEGER NOT NULL CHECK (copie >= 1),
  PRIMARY KEY (contribution_id, game_number, direzione, card_id),
  FOREIGN KEY (contribution_id, game_number)
    REFERENCES research_game_contribution (contribution_id, game_number)
) WITHOUT ROWID;

-- Guardia dei batch di lifecycle (delete e consenso): una riga entra con
-- CHECK (ok = 1) e l'ultimo statement dello stesso batch la toglie. Resta
-- sempre vuota; se la condizione e' falsa il CHECK abortisce il batch intero.
CREATE TABLE IF NOT EXISTS research_guardia (
  id  INTEGER PRIMARY KEY,
  ok  INTEGER NOT NULL CHECK (ok = 1)
);
