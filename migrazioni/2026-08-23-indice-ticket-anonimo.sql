-- Un ticket anonimo si ritrova soltanto dal suo token segreto, che in
-- database esiste solo come hash. La ricerca però non aveva un indice:
-- funziona finché i ticket sono pochi, e peggiora con ognuno che si aggiunge.
--
-- L'indice è parziale: i ticket autenticati non hanno accesso_hash e non
-- devono occupare spazio qui.
CREATE INDEX IF NOT EXISTS ticket_accesso
  ON ticket (accesso_hash) WHERE accesso_hash IS NOT NULL;
