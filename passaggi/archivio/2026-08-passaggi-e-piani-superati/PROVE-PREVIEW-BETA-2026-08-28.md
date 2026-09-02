# Prove manuali della preview Mox

Ambiente da provare: `https://preview.moxtracker.pages.dev`.

La produzione del sito non fa parte di queste prove. Usa un account di test: non usare l'account personale per revoca consenso o eliminazione account.

## Da riprovare adesso, in quest'ordine

Queste sono le prove che coprono le correzioni appena pubblicate. Le altre
sezioni restano come controllo completo della beta.

1. **Inglese nel Meta:** apri `https://preview.moxtracker.pages.dev/en/#meta`.
   I campi devono dire “Archetype / deck”, “All ranks” e “All strategies”, non
   restare in italiano dopo il caricamento dei dati.
2. **Filtro Set nei Draft:** apri Draft. Il campo Set è un menu, non una casella
   da compilare: scegli `HOB`, poi torna a “Tutti i set” e verifica che i dati
   cambino senza errori.
3. **Lista di riferimento:** nel dettaglio di un archetipo apri la lista del
   catalogo, premi “Copia per Arena” e incolla il testo in Blocco note o in
   Arena. Deve contenere `Deck` e, se presente, `Sideboard`.
4. **Ticket anonimo:** apri Supporto senza avere effettuato l'accesso. Il
   riquadro Turnstile deve caricarsi senza “Impossibile connettersi al sito
   web”; completa la verifica e invia un solo ticket di prova.
5. **Accesso Google:** da Account, scegli Google. Dopo la scelta deve tornare
   alla preview già autenticato, non fermarsi con la pagina di login visibile.
6. **Account dopo l'accesso:** solo dopo il punto 5, esegui rinomina deck,
   export, revoca e cancellazione descritti nella sezione 3, sempre e solo con
   l'account di test.
7. **Download:** il pulsante deve aprire lo ZIP Mox 2.9.27. Non serve
   installarlo: controlla nome e versione del file proposto.

## 1. Lingua e navigazione

1. Apri la home in italiano e premi `EN`: deve aprirsi la home inglese.
2. Dalla home inglese premi `IT`: deve tornare alla home italiana. Questa è la correzione di questa consegna.
3. Ripeti da Draft e Account: la pagina deve restare la stessa; filtri e ancora nell'URL non devono sparire.
4. Su telefono o finestra stretta, apri il menu e ripeti il cambio lingua.

## 2. Pagine pubbliche

1. Home: verifica testo, immagini e pulsante Download. Il download deve proporre il pacchetto Windows 2.9.27; non è necessario installarlo di nuovo.
2. Meta: cambia formato, periodo, rango e modalita; cerca una carta; apri almeno un archetipo e una sua variante. I filtri devono aggiornare dati e URL senza errori.
3. Draft: cambia set, evento e periodo. Devono comparire solo dati aggregati, senza nomi, identificativi di dispositivo, singole partite o diagnostica personale.
4. Support: controlla che le istruzioni sulla privacy siano coerenti con l'open beta.

## 3. Account e consensi

1. Accedi con l'account di test e collega Mox seguendo il flusso previsto dall'app 2.9.27.
2. Verifica che lo stato dei due consensi (partite e Draft) sia comprensibile e che una modifica nell'app si rifletta nell'account dopo la sincronizzazione.
3. Rinomina un deck dall'account, aggiorna la pagina e verifica che il nuovo nome resti salvato.
4. Esporta i dati dell'account e verifica che il file contenga solo dati dell'account di test.
5. Prova revoca consenso e, solo alla fine con l'account di test, l'eventuale eliminazione account. Non farlo con un account reale.

## 4. Ticket di supporto

1. Da utente autenticato invia un ticket con un `rapporto.json` anonimizzato.
2. Allegato consentito: PNG, JPEG o WebP entro 10 MB. Un file ZIP deve essere rifiutato.
3. Da utente non autenticato, invia un ticket completando Turnstile e conserva il link segreto ricevuto.
4. Se hai accesso amministrativo, cambia lo stato e rispondi: verifica che il mittente possa vedere l'aggiornamento tramite il suo link.

## Come riportare un problema

Per ogni prova che non riesce, invia: pagina o URL, dispositivo e browser, passi esatti, risultato atteso, risultato ottenuto e uno screenshot. Non allegare `Player.log`, ZIP o dati personali: per la diagnostica usa solo `rapporto.json` anonimizzato.
