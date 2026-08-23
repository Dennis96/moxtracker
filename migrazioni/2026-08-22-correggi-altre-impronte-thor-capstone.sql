-- Corregge altre due partite storiche dello stesso mittente.
-- Da eseguire nel pannello D1 senza BEGIN/COMMIT: il pannello non accetta
-- transazioni SQL esplicite. Il payload originale in `partite.dato` resta intatto.

-- A. Controllo: devono uscire esattamente le due righe indicate.
SELECT id, mittente, quando, evento, formato, esito, impronta_mazzo
FROM partite
WHERE mittente = '17b93463b6e0416d8bb9804152470df1'
  AND id IN ('9fa8e8f723', '2a1ec6d8fa')
ORDER BY quando;

-- B1. Correzione impronta: eseguire da sola.
UPDATE partite
SET impronta_mazzo = 'bf0ffcd6003e85d43dff95d8b92d4edbc511237c06f9bd765c2061889edbd187'
WHERE mittente = '17b93463b6e0416d8bb9804152470df1'
  AND id IN ('9fa8e8f723', '2a1ec6d8fa');

-- B2. Elimina le vecchie carte: eseguire da sola.
DELETE FROM carte_mazzo
WHERE partita IN ('9fa8e8f723', '2a1ec6d8fa');

-- B3. Inserisce le 60 carte canoniche: eseguire da sola.
-- L'elenco esplicito evita che una riga duplicata in `partite` possa generare
-- due volte la stessa chiave primaria `carte_mazzo(partita, carta)`.
WITH partite_corrette(partita) AS (
  VALUES ('9fa8e8f723'), ('2a1ec6d8fa')
), carte(carta, copie) AS (
  VALUES
    (58449, 18), (69407, 1), (82853, 1), (86958, 4), (86983, 1),
    (87279, 1), (93901, 1), (93905, 2), (95516, 1), (96166, 2),
    (96832, 3), (97426, 3), (97430, 3), (102574, 1), (102579, 3),
    (102591, 4), (102793, 1), (103472, 3), (105019, 2), (105022, 3),
    (105051, 2)
)
INSERT INTO carte_mazzo (partita, carta, copie)
SELECT partite_corrette.partita, carte.carta, carte.copie
FROM partite_corrette CROSS JOIN carte;

-- C. Verifica: una riga con 2 partite; poi due righe, ognuna con 60 carte.
SELECT impronta_mazzo, COUNT(*) AS partite
FROM partite
WHERE id IN ('9fa8e8f723', '2a1ec6d8fa')
GROUP BY impronta_mazzo;

SELECT partita, SUM(copie) AS carte
FROM carte_mazzo
WHERE partita IN ('9fa8e8f723', '2a1ec6d8fa')
GROUP BY partita
ORDER BY partita;
