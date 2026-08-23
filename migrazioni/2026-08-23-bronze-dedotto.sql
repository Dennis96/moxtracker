-- Le partite con il livello ma senza classe sono Bronze.
--
-- Arena omette la classe quando vale il primo gradino: nello stesso oggetto
-- sparisce anche il numero di vittorie quando e' zero, ed e' il comportamento
-- di un serializzatore che non scrive i valori di default. La prova sui dati
-- ricevuti: la classe «Bronze» non compare mai, ne' nel costruito ne' nel
-- limitato, mentre Silver, Gold e Platinum ci sono; e il giocatore di quelle
-- partite e' Bronze davvero.
--
-- Il pacchetto originale in `dato` non viene toccato: si corregge solo la
-- proiezione indicizzata, e `rank_stato = 'dedotto'` dice che quel valore
-- l'abbiamo messo noi e non Arena.
UPDATE partite
   SET rank_classe = 'Bronze', rank_stato = 'dedotto'
 WHERE rank_classe IS NULL
   AND rank_livello IS NOT NULL
   AND rank_stato = 'parziale';
