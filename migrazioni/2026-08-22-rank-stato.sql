-- D1 gia' in produzione: eseguire una sola volta prima del Worker aggiornato.
-- `rank_classe` puo' restare NULL quando Arena manda soltanto il livello.
ALTER TABLE partite ADD COLUMN rank_stato TEXT NOT NULL DEFAULT 'assente';

UPDATE partite
SET rank_stato = CASE
  WHEN rank_classe IS NOT NULL AND rank_livello IS NOT NULL THEN 'completo'
  WHEN rank_classe IS NOT NULL OR rank_livello IS NOT NULL THEN 'parziale'
  ELSE 'assente'
END;
