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

-- Soli contatori aggregati. `richieste_download` misura richieste servite,
-- non persone né installazioni, e non conserva IP, user-agent o identificativi.
CREATE TABLE IF NOT EXISTS metrica_pubblica (
  chiave TEXT PRIMARY KEY,
  valore INTEGER NOT NULL DEFAULT 0,
  aggiornato TEXT NOT NULL
);

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

-- Nascondere e' una preferenza reversibile, non una cancellazione: Mox puo'
-- continuare a sincronizzare il mazzo senza farlo ricomparire nell'archivio.
CREATE TABLE IF NOT EXISTS account_mazzo_nascosto (
  account_id TEXT NOT NULL,
  impronta   TEXT NOT NULL,
  aggiornato TEXT NOT NULL,
  PRIMARY KEY (account_id, impronta)
);
CREATE INDEX IF NOT EXISTS account_mazzo_nascosto_account
  ON account_mazzo_nascosto (account_id, aggiornato);

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
