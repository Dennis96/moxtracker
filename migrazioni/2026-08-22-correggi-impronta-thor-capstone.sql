-- Correzione dati una tantum — 22/08/2026
--
-- Il Player.log diagnostico ha confermato che queste sei Ladder Standard sono
-- lo stesso mazzo da 60 carte. Le versioni precedenti di Mox salvavano invece
-- una fotografia variabile da 61--64 carte e generavano impronte diverse.
--
-- Da eseguire UNA SOLA VOLTA sul D1 remoto `moxtracker`, dopo avere controllato
-- il risultato della sezione A. Non tocca `dato`: quel JSON e' il pacchetto
-- originale ricevuto; qui si correggono le colonne e le righe derivate usate
-- dal sito.

-- A. CONTROLLO: devono comparire esattamente queste sei righe, tutte dello
-- stesso mittente e tutte Ladder/Standard.
SELECT id, mittente, quando, evento, formato, esito, impronta_mazzo
FROM partite
WHERE id IN (
  '93fa0020ea', '3c47f63848', 'f2487e25ef',
  '2a1ecd68fa', '8845a67d92', 'db48856767'
)
ORDER BY quando;

-- B. CORREZIONE: eseguire questa transazione solo dopo il controllo A.
BEGIN IMMEDIATE;

UPDATE partite
SET impronta_mazzo = 'bf0ffcd6003e85d43dff95d8b92d4edbc511237c06f9bd765c2061889edbd187'
WHERE mittente = '17b93463b6e0416d8bb9804152470df1'
  AND id IN (
    '93fa0020ea', '3c47f63848', 'f2487e25ef',
    '2a1ecd68fa', '8845a67d92', 'db48856767'
  );

DELETE FROM carte_mazzo
WHERE partita IN (
  '93fa0020ea', '3c47f63848', 'f2487e25ef',
  '2a1ecd68fa', '8845a67d92', 'db48856767'
);

WITH carte(carta, copie) AS (
  VALUES
    (58449, 18), (69407, 1), (82853, 1), (86958, 4), (86983, 1),
    (87279, 1), (93901, 1), (93905, 2), (95516, 1), (96166, 2),
    (96832, 3), (97426, 3), (97430, 3), (102574, 1), (102579, 3),
    (102591, 4), (102793, 1), (103472, 3), (105019, 2), (105022, 3),
    (105051, 2)
)
INSERT INTO carte_mazzo (partita, carta, copie)
SELECT partite.id, carte.carta, carte.copie
FROM partite CROSS JOIN carte
WHERE partite.mittente = '17b93463b6e0416d8bb9804152470df1'
  AND partite.id IN (
    '93fa0020ea', '3c47f63848', 'f2487e25ef',
    '2a1ecd68fa', '8845a67d92', 'db48856767'
  );

COMMIT;

-- C. VERIFICA: una sola impronta, 6 partite, 60 carte per partita.
SELECT impronta_mazzo, COUNT(*) AS partite
FROM partite
WHERE id IN (
  '93fa0020ea', '3c47f63848', 'f2487e25ef',
  '2a1ecd68fa', '8845a67d92', 'db48856767'
)
GROUP BY impronta_mazzo;

SELECT partita, SUM(copie) AS carte
FROM carte_mazzo
WHERE partita IN (
  '93fa0020ea', '3c47f63848', 'f2487e25ef',
  '2a1ecd68fa', '8845a67d92', 'db48856767'
)
GROUP BY partita
ORDER BY partita;
