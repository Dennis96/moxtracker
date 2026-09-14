-- Research R3: tabelle separate dal legacy `partite`.
--
-- NON applicare a un database remoto senza l'autorizzazione del checkpoint
-- R3: la migrazione nasce provata soltanto su SQLite locale. Lo stesso blocco
-- sta in fondo a `schema.sql`, e una prova pretende che i due coincidano.
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

CREATE TABLE IF NOT EXISTS research_lineage (
  lineage_tag            TEXT PRIMARY KEY,
  lineage_key_version    INTEGER NOT NULL,
  credential_tag         TEXT NOT NULL,
  credential_key_version INTEGER NOT NULL,
  stato                  TEXT NOT NULL CHECK (stato IN ('active', 'deleting', 'deleted')),
  creata                 TEXT NOT NULL,
  aggiornata             TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS research_consent_generation (
  hash               TEXT PRIMARY KEY,
  mittente           TEXT NOT NULL,
  lineage_tag        TEXT NOT NULL,
  credential_tag     TEXT NOT NULL,
  versione_consenso  INTEGER NOT NULL CHECK (versione_consenso >= 1),
  stato              TEXT NOT NULL CHECK (stato IN ('active', 'revoked')),
  creata             TEXT NOT NULL,
  revocata           TEXT
);
CREATE INDEX IF NOT EXISTS research_generation_lineage
  ON research_consent_generation (lineage_tag, stato);
CREATE INDEX IF NOT EXISTS research_generation_mittente
  ON research_consent_generation (mittente, stato);

CREATE TABLE IF NOT EXISTS research_consent_tombstone (
  hash    TEXT PRIMARY KEY,
  creato  TEXT NOT NULL,
  motivo  TEXT NOT NULL CHECK (motivo IN ('delete'))
);

CREATE TABLE IF NOT EXISTS research_deleted_contribution (
  tag          TEXT PRIMARY KEY,
  key_version  INTEGER NOT NULL,
  creato       TEXT NOT NULL,
  motivo       TEXT NOT NULL CHECK (motivo IN ('delete'))
);

CREATE TABLE IF NOT EXISTS research_contribution (
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
  PRIMARY KEY (mittente, id_pubblico),
  CHECK ((stato = 'effettiva') = (snapshot IS NOT NULL AND variant_hash IS NOT NULL)),
  CHECK (stato = 'effettiva' OR (quando IS NULL AND evento IS NULL AND formato IS NULL
    AND esito IS NULL AND turni IS NULL))
);
CREATE INDEX IF NOT EXISTS research_contribution_mittente
  ON research_contribution (mittente, aggiornata);
CREATE INDEX IF NOT EXISTS research_contribution_match
  ON research_contribution (id_pubblico);
CREATE INDEX IF NOT EXISTS research_contribution_formato
  ON research_contribution (formato, quando);

CREATE TABLE IF NOT EXISTS research_contribution_variante (
  mittente      TEXT NOT NULL,
  id_pubblico   TEXT NOT NULL,
  variant_hash  TEXT NOT NULL,
  body          TEXT NOT NULL,
  ricevuta      TEXT NOT NULL,
  PRIMARY KEY (mittente, id_pubblico, variant_hash),
  FOREIGN KEY (mittente, id_pubblico) REFERENCES research_contribution (mittente, id_pubblico)
);

CREATE TABLE IF NOT EXISTS research_snapshot_storia (
  mittente                TEXT NOT NULL,
  id_pubblico             TEXT NOT NULL,
  revisione_modello       INTEGER NOT NULL,
  revisione_osservazioni  INTEGER NOT NULL,
  variant_hash            TEXT NOT NULL,
  overflow                INTEGER NOT NULL CHECK (overflow IN (0, 1)),
  body                    TEXT NOT NULL,
  archiviata              TEXT NOT NULL,
  PRIMARY KEY (mittente, id_pubblico, revisione_modello, revisione_osservazioni, variant_hash),
  FOREIGN KEY (mittente, id_pubblico) REFERENCES research_contribution (mittente, id_pubblico)
);

-- CAS e guardia atomica: il primo statement di ogni batch upload inserisce
-- la versione successiva. Se un altro Worker l'ha gia' scritta, la PK
-- abortisce il batch; se lineage, generation, soppressione o versione attesa
-- non tornano, `guardia` vale 0 e il CHECK abortisce il batch.
CREATE TABLE IF NOT EXISTS research_revisione_server (
  mittente         TEXT NOT NULL,
  id_pubblico      TEXT NOT NULL,
  versione         INTEGER NOT NULL,
  generation_hash  TEXT NOT NULL,
  creata           TEXT NOT NULL,
  guardia          INTEGER NOT NULL CHECK (guardia = 1),
  PRIMARY KEY (mittente, id_pubblico, versione)
);
CREATE INDEX IF NOT EXISTS research_revisione_quota_mittente
  ON research_revisione_server (mittente, creata);
CREATE INDEX IF NOT EXISTS research_revisione_quota_generation
  ON research_revisione_server (generation_hash, creata);

CREATE TABLE IF NOT EXISTS research_game_contribution (
  mittente              TEXT NOT NULL,
  id_pubblico           TEXT NOT NULL,
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
  PRIMARY KEY (mittente, id_pubblico, game_number),
  FOREIGN KEY (mittente, id_pubblico) REFERENCES research_contribution (mittente, id_pubblico)
);

CREATE TABLE IF NOT EXISTS research_event (
  mittente     TEXT NOT NULL,
  id_pubblico  TEXT NOT NULL,
  game_number  INTEGER NOT NULL,
  event_type   TEXT NOT NULL CHECK (event_type IN ('draw', 'cast', 'land')),
  event_id     TEXT NOT NULL,
  turno        INTEGER NOT NULL,
  card_id      INTEGER NOT NULL,
  PRIMARY KEY (mittente, id_pubblico, game_number, event_id),
  FOREIGN KEY (mittente, id_pubblico, game_number)
    REFERENCES research_game_contribution (mittente, id_pubblico, game_number)
);
CREATE INDEX IF NOT EXISTS research_event_carta ON research_event (event_type, card_id);

CREATE TABLE IF NOT EXISTS research_deck_card (
  mittente     TEXT NOT NULL,
  id_pubblico  TEXT NOT NULL,
  game_number  INTEGER NOT NULL,
  sezione      TEXT NOT NULL CHECK (sezione IN ('main', 'sideboard')),
  card_id      INTEGER NOT NULL,
  copie        INTEGER NOT NULL CHECK (copie >= 1),
  PRIMARY KEY (mittente, id_pubblico, game_number, sezione, card_id),
  FOREIGN KEY (mittente, id_pubblico, game_number)
    REFERENCES research_game_contribution (mittente, id_pubblico, game_number)
);
CREATE INDEX IF NOT EXISTS research_deck_card_carta ON research_deck_card (sezione, card_id);

CREATE TABLE IF NOT EXISTS research_sideboard_delta (
  mittente     TEXT NOT NULL,
  id_pubblico  TEXT NOT NULL,
  game_number  INTEGER NOT NULL,
  direzione    TEXT NOT NULL CHECK (direzione IN ('in', 'out')),
  card_id      INTEGER NOT NULL,
  copie        INTEGER NOT NULL CHECK (copie >= 1),
  PRIMARY KEY (mittente, id_pubblico, game_number, direzione, card_id),
  FOREIGN KEY (mittente, id_pubblico, game_number)
    REFERENCES research_game_contribution (mittente, id_pubblico, game_number)
);

-- Guardia dei batch di lifecycle (delete e consenso): una riga entra con
-- CHECK (ok = 1) e l'ultimo statement dello stesso batch la toglie. Resta
-- sempre vuota; se la condizione e' falsa il CHECK abortisce il batch intero.
CREATE TABLE IF NOT EXISTS research_guardia (
  id  INTEGER PRIMARY KEY,
  ok  INTEGER NOT NULL CHECK (ok = 1)
);
