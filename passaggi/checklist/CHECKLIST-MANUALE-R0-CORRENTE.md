# Checklist manuale R0 — preview Mox

Target: <https://preview.moxtracker.pages.dev>. R0-SITO resta `READY WITH
MANUAL CHECKS`: questa checklist registra soltanto prove reali, non sostituisce
la suite automatica. Usare esclusivamente account di prova e non condividere
token, link segreti, export o dati personali negli screenshot.

## Preparazione

- Account di prova normale, account di prova con ruolo amministratore e accesso
  Cloudflare D1 in sola lettura per la verifica audit.
- Installazione Mox di prova collegabile all'account e consenso all'invio
  partite attivo solo per il test di revoca.
- Per ogni esito annotare data e ora, browser, dispositivo e account di prova
  usato. La cancellazione è sempre l'ultima prova.

## Controlli

| # | URL e azione | Atteso |
| --- | --- | --- |
| 1 | Chrome desktop: aprire `/`, `/en/`, `/draft`, `/account` e `/download`. | Navigazione, testi, focus e layout leggibili; nessun errore console evidente. |
| 2 | Edge desktop: ripetere il percorso essenziale Home, Draft, Account e Download. | Nessun blocco, errore visibile o overflow. |
| 3 | Firefox desktop: ripetere il percorso essenziale Home, Draft, Account e Download. | Nessun blocco, errore visibile o overflow. |
| 4 | Telefono reale: menu, Meta, Draft, Account e tap/chiusura preview carte. | Menu e controlli usabili; nessuno scorrimento orizzontale. |
| 5 | Sistema con reduced motion reale: navigare Home e pagine con carte. | Nessuna animazione non essenziale o fastidiosa. |
| 6 | `/download`: usare il pulsante Download e verificare il nome/provenienza dello ZIP GitHub Latest. | Viene proposto uno ZIP della release Windows corrente. |
| 7 | In finestra anonima, `/supporto.html`: compilare ticket di prova, superare Turnstile, inviare e salvare il link segreto. | Ticket creato; link segreto apre esclusivamente quel ticket. |
| 8 | Con ruolo amministratore, `/admin.html`: aprire lo stesso ticket, cambiare stato, inserire risposta e scegliere “Salva e rispondi”. | Stato e risposta sono visibili; prima operazione audit registrata. |
| 9 | Sul ticket ancora aperto, scegliere “Chiudi ticket”; poi eseguire in D1 sola lettura `SELECT azione, dettaglio, creato FROM ticket_audit WHERE ticket_id = '<id-ticket>' ORDER BY creato`. | Due righe `ticket_aggiornato`: prima con risposta `true` e nuovo stato; seconda con stato `chiuso` e risposta `false`. |
| 10 | Aprire il link segreto anonimo e inviare una risposta. | Il ticket chiuso si riapre in stato `ricevuto`. |
| 11 | In `/account.html`, generare codice, collegare Mox, revocare il dispositivo e tentare un invio reale dal client con l'invio ancora attivo. | Il dispositivo sparisce; il nuovo invio non appare più nell'account revocato. Il contributo può restare accettato come anonimo/non associato. |
| 12 | In `/account.html`, scegliere “Esporta tutto” e ispezionare il JSON localmente. | Solo dati e mittenti dell'account di prova. |
| 13 | Ultimo test: in `/account.html`, “Elimina dati e account”, confermare e ripetere accesso/richiesta. | Account e dati non sono più recuperabili; seconda richiesta negativa. |

## Segnalazione FAIL

`data/ora — browser/dispositivo — URL — azione — atteso — osservato — riproducibile sì/no`

Allegare uno screenshot solo se chiarisce il problema, oscurando identificativi,
token, URL segreti e dati dell'account. Un audit separato per cambio stato e
risposta nello stesso salvataggio è fuori da R0: qui vale un record per ogni
operazione UI distinta.

## Esiti registrati

| # | Esito | Data | Evidenza sintetica |
| --- | --- | --- | --- |
| 7 | PASS | 02/09/2026 | Ticket anonimo creato dopo Turnstile; il link segreto riapre esclusivamente il ticket; conferma e aggiornamento email ricevuti. |
| 8 | PASS | 02/09/2026 | L'amministratore ha aperto il ticket, cambiato stato e salvato una risposta visibile. |
| 9 | PASS | 02/09/2026 | In D1, due audit `ticket_aggiornato`: risposta e passaggio a `in_lavorazione`; poi chiusura senza risposta. |
| 10 | PASS | 02/09/2026 | Una risposta dal link segreto ha riaperto il ticket in stato `ricevuto`, visibile anche all'amministratore. |
| 11 | PASS — criterio corretto | 02/09/2026 | Revoca riuscita: dispositivo rimosso e nuove partite assenti dall'account. Con invio client attivo, il contributo può continuare come anonimo/non associato. |
| 12 | PASS | 02/09/2026 | Export controllato: un solo account e dispositivo, nessun mittente estraneo né credenziale o dato sensibile. |
| 13 | PASS | 02/09/2026 | Eliminazione su account sacrificabile: dati e ticket non recuperabili; nuovo accesso riparte pulito. |

## Correzione registrata

| Data | Problema | Correzione | Verifica |
| --- | --- | --- | --- |
| 02/09/2026 | Dopo `Esci` la dashboard restava visibile fino a F5. | Il gestore logout ora invoca `eliminaSessioneAccountPreview()` prima di ricaricare. | Regressione frontend automatica; prova OAuth/manuale da ripetere sulla prossima preview. |
