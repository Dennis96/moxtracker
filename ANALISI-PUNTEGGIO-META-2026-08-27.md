# Analisi del punteggio Meta — 27 agosto 2026

## Esito

Il punteggio combinato **non è stato pubblicato**. Il campione pubblico reale
letto dall'API il 27/08/2026 contiene 80 partite: 55 Mono White Auras, 13 Thor
Capstone e 12 Izzet Spellementals. Soltanto il primo gruppo supera la soglia di
30 partite. Con un solo archetipo eleggibile non esiste ancora un ordinamento
reale sul quale confrontare o calibrare una formula.

Le metriche originali (partite, vittorie, sconfitte, win rate e quota meta)
restano quindi la rappresentazione corretta per la beta iniziale.

## Candidato da verificare quando il campione cresce

Lo script `strumenti/analizza_punteggio_meta.mjs` confronta una prima formula
conservativa senza inserirla nell'API o nel sito:

- qualità: limite inferiore Wilson al 95% del win rate, così un campione piccolo
  non viene premiato come uno grande con la stessa percentuale;
- popolarità: percentile di `log(1 + partite)` fra gli archetipi nello stesso
  formato, periodo, rank e modalità;
- candidato esplorativo: 70% qualità e 30% popolarità, visualizzato come indice
  e mai come percentuale.

Il peso 70/30 è deliberatamente marcato come **ipotesi**, non decisione. Prima
della pubblicazione servono almeno più archetipi sopra soglia in due o più
finestre temporali, un confronto di stabilità delle classifiche e
l'approvazione esplicita dell'utente. Anche dopo l'approvazione, win rate,
campione e quota meta devono restare accanto all'indice.
