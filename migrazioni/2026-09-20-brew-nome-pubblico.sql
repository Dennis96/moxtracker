-- Nomi pubblici dei gruppi Brew: una tabella sidecar, separata da
-- `brew_gruppo` (S1, migrazione 2026-09-15).
--
-- NON applicare a un database remoto senza un'autorizzazione esplicita: la
-- migrazione e' additiva. Lo stesso blocco sta in `schema.sql`, subito dopo i
-- trigger Brew, e una prova pretende che i due coincidano.
--
-- Perche' una tabella a parte e non una colonna di `brew_gruppo`:
--
-- 1. `brew_gruppo` e' congelato da un trigger che rifiuta ogni UPDATE, perche'
--    rappresentante e soglia non devono cambiare dopo la nascita del gruppo.
--    Un nome, al contrario, e' una correzione editoriale che deve poter essere
--    rifatta: indebolire quel trigger per farci stare il nome scambierebbe una
--    garanzia forte del clustering con una comodita' di redazione;
-- 2. il nome e' soltanto un'etichetta pubblica. Non entra nel clustering, non
--    cambia k, la soglia delle 30 partite o il classificatore, e non promuove
--    il gruppo ad archetipo: resta accompagnato dallo stato «Brew /
--    archetipo non ancora confermato»;
-- 3. qui non ci sono carte, partite, mittenti o impronte: solo l'id opaco del
--    gruppo e il testo che il sito mostra.
--
-- La cancellazione e' coerente in due modi, di proposito ridondanti: la FK
-- cancella a cascata quando `brew_gruppo` si smonta per privacy, e la pulizia
-- Brew toglie comunque i nomi rimasti senza gruppo, anche dove le chiavi
-- esterne non fossero applicate.

CREATE TABLE IF NOT EXISTS brew_nome (
  gruppo_id   TEXT PRIMARY KEY CHECK (length(gruppo_id) = 35
                AND substr(gruppo_id, 1, 3) = 'bg_'
                AND NOT substr(gruppo_id, 4) GLOB '*[^0-9a-f]*'),
  formato     TEXT NOT NULL,
  algoritmo   TEXT NOT NULL,
  -- ASCII stampabile, senza apici, virgolette, punto e virgola, barra
  -- rovesciata ne' trattini doppi: il testo passa anche da riga di comando e
  -- non deve poter chiudere una stringa SQL.
  nome        TEXT NOT NULL CHECK (length(nome) >= 2 AND length(nome) <= 60
                AND trim(nome) = nome
                AND NOT nome GLOB '*[^ -~]*'
                AND NOT nome GLOB '*[";\]*'
                AND NOT nome GLOB '*''*'
                AND NOT nome LIKE '%--%'),
  origine     TEXT NOT NULL CHECK (origine IN ('curato')),
  aggiornato  TEXT NOT NULL,
  UNIQUE (formato, algoritmo, nome),
  FOREIGN KEY (gruppo_id, formato, algoritmo)
    REFERENCES brew_gruppo (id, formato, algoritmo) ON DELETE CASCADE
);
