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
