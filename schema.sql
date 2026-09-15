-- Lo schema del database delle partite.
--
-- Due principi, e il resto viene da soli:
--
-- 1. le colonne servono a CERCARE in fretta, il JSON in `dato` serve a poter
--    RIFARE i conti domani con regole migliori. Buttare via il pacchetto
--    originale vorrebbe dire che una deduzione sbagliata resta sbagliata per
--    sempre;
-- 2. una partita entra UNA VOLTA. La chiave primaria e' l'identificativo che
--    Mox calcola dal match: se lo stesso pacchetto arriva due volte - rete
--    ballerina, doppio invio, due installazioni - la seconda non conta.

CREATE TABLE IF NOT EXISTS partite (
  id              TEXT PRIMARY KEY,
  mittente        TEXT NOT NULL,
  ricevuta        TEXT NOT NULL,   -- quando e' arrivata al server, UTC
  quando          TEXT,            -- quando e' stata giocata, UTC
  evento          TEXT,
  formato         TEXT,
  esito           TEXT NOT NULL,
  su_gioco        INTEGER,         -- 1 al gioco, 0 alla risposta, NULL non si sa
  mulligan        INTEGER,
  turni           INTEGER,
  durata          INTEGER,
  giochi          INTEGER,         -- quanti game nel match (Bo3)
  rank_classe     TEXT,
  rank_livello    INTEGER,
  rank_stato      TEXT NOT NULL DEFAULT 'assente', -- completo, parziale o assente
  impronta_mazzo  TEXT,
  mox             TEXT,
  arena           TEXT,
  versione        INTEGER NOT NULL,
  dato            TEXT NOT NULL
);

-- Il tetto giornaliero per mittente si legge da qui.
CREATE INDEX IF NOT EXISTS partite_per_mittente ON partite (mittente, ricevuta);

-- Le domande del sito: il meta di un formato in un periodo, e le partite di
-- uno stesso mazzo.
CREATE INDEX IF NOT EXISTS partite_per_formato ON partite (formato, quando);
CREATE INDEX IF NOT EXISTS partite_per_mazzo ON partite (impronta_mazzo);

-- Le carte stanno in tabelle a parte, non dentro il JSON, perche' e' su
-- queste che si fara' il riconoscimento degli archetipi: «quante carte di
-- questa lista compaiono in quel mazzo» e' una domanda che a un database si
-- fa in un colpo, e a un JSON no.
CREATE TABLE IF NOT EXISTS carte_mazzo (
  partita  TEXT NOT NULL,
  carta    INTEGER NOT NULL,
  copie    INTEGER NOT NULL,
  PRIMARY KEY (partita, carta)
);

CREATE TABLE IF NOT EXISTS carte_avversario (
  partita  TEXT NOT NULL,
  carta    INTEGER NOT NULL,
  PRIMARY KEY (partita, carta)
);

CREATE INDEX IF NOT EXISTS carte_mazzo_per_carta ON carte_mazzo (carta);
CREATE INDEX IF NOT EXISTS carte_avversario_per_carta ON carte_avversario (carta);

-- Il segreto non viene mai conservato: questa impronta autorizza la
-- cancellazione di tutte le partite inviate dalla stessa installazione.
CREATE TABLE IF NOT EXISTS contributori (
  mittente             TEXT PRIMARY KEY,
  cancellazione_hash   TEXT NOT NULL,
  creato               TEXT NOT NULL
);

-- Account facoltativi. Le identita' OAuth restano private e non vengono mai
-- usate nelle letture pubbliche del meta.
CREATE TABLE IF NOT EXISTS account (
  id             TEXT PRIMARY KEY,
  nome           TEXT NOT NULL,
  avatar         TEXT,
  ruolo          TEXT NOT NULL DEFAULT 'utente',
  creato         TEXT NOT NULL,
  aggiornato     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_identita (
  provider       TEXT NOT NULL,
  soggetto       TEXT NOT NULL,
  account_id     TEXT NOT NULL,
  PRIMARY KEY (provider, soggetto)
);
CREATE INDEX IF NOT EXISTS account_identita_account
  ON account_identita (account_id);

-- Cookie e stati OAuth sono credenziali: nel database entra soltanto SHA-256.
CREATE TABLE IF NOT EXISTS account_sessione (
  hash           TEXT PRIMARY KEY,
  account_id     TEXT NOT NULL,
  creato         TEXT NOT NULL,
  scade          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS account_sessione_account
  ON account_sessione (account_id, scade);

CREATE TABLE IF NOT EXISTS account_oauth_stato (
  hash           TEXT PRIMARY KEY,
  provider       TEXT NOT NULL,
  ritorno        TEXT NOT NULL,
  creato         TEXT NOT NULL,
  scade          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_codice_mox (
  hash           TEXT PRIMARY KEY,
  account_id     TEXT NOT NULL,
  creato         TEXT NOT NULL,
  scade          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_dispositivo (
  mittente       TEXT PRIMARY KEY,
  account_id     TEXT NOT NULL,
  nome           TEXT NOT NULL,
  segreto_hash   TEXT NOT NULL,
  collegato      TEXT NOT NULL,
  -- Stato corrente dichiarato da Mox. NULL significa che questa versione del
  -- client non lo ha ancora sincronizzato: il sito non deve dedurlo dagli invii.
  consenso_partite INTEGER CHECK (consenso_partite IS NULL OR consenso_partite IN (0, 1)),
  consenso_draft   INTEGER CHECK (consenso_draft IS NULL OR consenso_draft IN (0, 1)),
  consensi_aggiornati TEXT
);
CREATE INDEX IF NOT EXISTS account_dispositivo_account
  ON account_dispositivo (account_id, collegato);

-- Etichette private scelte dall'utente per le proprie decklist costruite.
-- L'impronta resta l'identificativo tecnico stabile; il nome non entra mai
-- nelle aggregazioni pubbliche del meta.
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

-- Ticket e messaggi. Un ticket anonimo e' accessibile soltanto tramite il
-- token segreto restituito alla creazione, anch'esso salvato come hash.
CREATE TABLE IF NOT EXISTS ticket (
  id             TEXT PRIMARY KEY,
  account_id     TEXT,
  accesso_hash   TEXT,
  categoria      TEXT NOT NULL,
  titolo         TEXT NOT NULL,
  stato          TEXT NOT NULL,
  versione_mox   TEXT,
  diagnostica_id TEXT,
  creato         TEXT NOT NULL,
  aggiornato     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ticket_account ON ticket (account_id, aggiornato);
-- Un ticket anonimo si ritrova solo dal suo token segreto: la ricerca per
-- hash deve avere il suo indice. Parziale, perche' i ticket autenticati non
-- hanno accesso_hash.
CREATE INDEX IF NOT EXISTS ticket_accesso
  ON ticket (accesso_hash) WHERE accesso_hash IS NOT NULL;

-- L'indirizzo e' facoltativo: serve soltanto alle notifiche esplicitamente
-- richieste per questo ticket e non viene usato per login o profilazione.
CREATE TABLE IF NOT EXISTS ticket_notifica_email (
  ticket_id       TEXT PRIMARY KEY,
  email           TEXT NOT NULL,
  consenso        TEXT NOT NULL,
  verificata      TEXT,
  disiscritta     TEXT,
  creato          TEXT NOT NULL,
  aggiornato      TEXT NOT NULL
);

-- I link nelle email sono token casuali salvati solo come hash. Ogni avviso
-- puo' avere un link proprio, valido al massimo quanto il ticket.
CREATE TABLE IF NOT EXISTS ticket_notifica_accesso (
  hash            TEXT PRIMARY KEY,
  ticket_id       TEXT NOT NULL,
  creato          TEXT NOT NULL,
  scade           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ticket_notifica_accesso_ticket
  ON ticket_notifica_accesso (ticket_id, scade);

CREATE TABLE IF NOT EXISTS ticket_messaggio (
  id             TEXT PRIMARY KEY,
  ticket_id      TEXT NOT NULL,
  autore         TEXT NOT NULL,
  testo          TEXT NOT NULL,
  creato         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ticket_messaggio_ticket
  ON ticket_messaggio (ticket_id, creato);

CREATE TABLE IF NOT EXISTS ticket_allegato (
  id             TEXT PRIMARY KEY,
  ticket_id      TEXT NOT NULL,
  nome           TEXT NOT NULL,
  tipo           TEXT NOT NULL,
  byte           INTEGER NOT NULL,
  oggetto_r2     TEXT NOT NULL UNIQUE,
  creato         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ticket_allegato_ticket
  ON ticket_allegato (ticket_id, creato);

-- Ogni operazione di supporto resta attribuita all'account amministratore.
-- Non contiene token, cookie, IP o altri segreti.
CREATE TABLE IF NOT EXISTS ticket_audit (
  id             TEXT PRIMARY KEY,
  account_id     TEXT NOT NULL,
  ticket_id      TEXT NOT NULL,
  azione         TEXT NOT NULL,
  dettaglio      TEXT,
  creato         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ticket_audit_ticket
  ON ticket_audit (ticket_id, creato);

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
--    nome, non riscrive questi: i trigger rifiutano ogni UPDATE;
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
