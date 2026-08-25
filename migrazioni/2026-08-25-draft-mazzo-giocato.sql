-- Il mazzo che il giocatore ha davvero montato dopo il Draft, e i cambi fatti
-- fra una partita e l'altra. Arriva da Mox dal 24/08/2026 dentro la traccia
-- (`mazzo_giocato`) e finiva soltanto nell'oggetto R2: senza indice non si
-- poteva rispondere alla domanda che conta, cioe' **cosa l'utente cambia del
-- mazzo che Mox gli consiglia**.
--
-- Le liste stanno qui come JSON compatto, nella stessa forma che manda il
-- client: [[carta, quantita], ...]. La riserva puo' mancare.
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

-- L'ultima versione di un Draft e' quella che conta di piu': e' il mazzo con
-- cui ha davvero finito di giocare.
CREATE INDEX IF NOT EXISTS draft_mazzo_ultima ON draft_mazzo (draft_id, versione DESC);
