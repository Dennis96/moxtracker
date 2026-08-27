-- Stato corrente dei consensi per ogni installazione Mox collegata.
--
-- I campi restano NULL finche' il client non usa il nuovo endpoint: in questo
-- modo il sito dichiara "non sincronizzato" e non deduce il consenso dalla
-- presenza o assenza di contributi storici.
ALTER TABLE account_dispositivo ADD COLUMN consenso_partite INTEGER
  CHECK (consenso_partite IS NULL OR consenso_partite IN (0, 1));
ALTER TABLE account_dispositivo ADD COLUMN consenso_draft INTEGER
  CHECK (consenso_draft IS NULL OR consenso_draft IN (0, 1));
ALTER TABLE account_dispositivo ADD COLUMN consensi_aggiornati TEXT;
