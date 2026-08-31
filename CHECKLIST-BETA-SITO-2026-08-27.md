# Checklist beta aperta del sito Mox

Usare la stessa checklist con **3–5 persone**. Ogni tester annota browser,
dispositivo, ora, risultato e allega una schermata soltanto se qualcosa non
funziona. Non usare l'account principale per prove di cancellazione.

## Percorso comune

1. Aprire homepage e versione inglese; verificare menu, leggibilità e assenza
   di scorrimento orizzontale su desktop e telefono.
2. Premere il download e verificare che inizi il download della beta Windows.
3. In Meta cambiare periodo, rank e BO1/BO3; aprire un archetipo, una variante
   pubblicabile e provare Copia per Arena.
4. In Draft cambiare set, evento e periodo; confermare che compaiano solo
   aggregati e nessuna traccia o diagnostica privata.
5. Accedere con un **account di prova** Google o Discord; controllare mazzi
   correnti/storici, ultimo invio, dispositivi, partite, Draft ed export per
   sezione. Collegare Mox soltanto se autorizzato dal proprietario del PC.
6. Aprire un ticket autenticato oppure anonimo. Per la diagnostica usare lo ZIP
   strutturato creato da Mox (fino a 10 MB): contiene sempre `rapporto.json` e
   include `arena/Player.log` solo se il consenso esplicito è stato scelto in
   Mox. Non usare ZIP generici.
7. Segnalare il risultato nel ticket con: passo, risultato atteso, risultato
   ottenuto, browser/dispositivo e schermata se utile.

## Esito del tester

- [ ] Download raggiungibile
- [ ] Navigazione italiana e inglese coerente
- [ ] Meta e Draft leggibili e filtrabili
- [ ] Account di prova utilizzabile
- [ ] Ticket creato e riaperto correttamente
- [ ] Nessun dato personale apparso nelle pagine pubbliche
- [ ] Nessun blocco su mobile o tastiera

## Regressioni Account e Ticket

- [ ] Ticket anonimo: Turnstile, invio, link segreto e riapertura.
- [ ] Amministrazione: cambio stato, risposta e presenza dei due eventi in
  `ticket_audit` (**priorità: non ancora confermata manualmente dopo la correzione**).
- [ ] Revoca dispositivo: Mox non riesce più a scrivere sull'account.
- [ ] Export JSON: contiene solo i dati dell'account di prova.
- [ ] Cancellazione: solo sull'account di prova, con seconda richiesta negativa.
- [ ] ZIP diagnostico Mox: controllo rapido; flusso già collaudato.

Le cinque prove sopra, eccetto lo ZIP, erano state superate in una chat
precedente ma vanno ripetute come regressione. L'amministrazione resta invece
la sola prova senza conferma manuale completa dopo la correzione.

La preview può essere promossa soltanto dopo suite, smoke test, schermate
desktop/mobile e approvazione esplicita della produzione.

## M6 — collaudo locale del 30/08/2026

Queste verifiche usano soltanto fixture sintetiche locali, senza account
reale o D1. Non attestano un aggiornamento della preview o della produzione.

- [x] Account IT/EN: ultima mano osservata con conteggio e nota che esclude
  la mano d'apertura; copie inalterate (2 + 1, totale 3).
- [x] Campo `apertura` assente: nessuna sezione e nessuna mano vuota dedotta.
- [x] Testi pubblici M6 tradotti, suite 189/189 e build locale riuscita.
- [x] API v1/v2 invariate, v3 rifiutata; errore legacy corretto, verificato
  sul Worker con SQLite esclusivamente in memoria.
