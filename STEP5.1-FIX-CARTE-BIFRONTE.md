# STEP 5.1 — fix carte bifronte nel catalogo archetipi

Il generatore STEP 5 richiedeva una corrispondenza esatta tra il nome scritto
nelle decklist di `mox-meta` e il nome inglese presente nel database locale di
MTG Arena.

Alcune decklist rappresentano le carte trasformabili come:

`Aclazotz, Deepest Betrayal // Temple of the Dead`

mentre Arena puo' indicizzare la carta inseribile nel mazzo soltanto come:

`Aclazotz, Deepest Betrayal`

La correzione applica questa regola:

1. prova sempre prima il nome completo;
2. soltanto se il nome contiene `//`, prova la faccia anteriore;
3. se neppure la faccia anteriore esiste nel DB Arena, la generazione continua
   a fallire: nessuna carta realmente sconosciuta viene ignorata.

Dopo aver sovrascritto il file eseguire dalla root di `moxtracker`:

```bat
npm run genera-archetipi
```

Se termina con `catalogo archetipi: OK`, eseguire:

```bat
npm run prove
```

Non fare ancora deploy del Worker prima di aver verificato entrambi i comandi.
