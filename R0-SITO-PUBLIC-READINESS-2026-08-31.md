# R0-SITO / Public Readiness — 31 agosto 2026

## Verdetto

`R0-SITO READY WITH MANUAL CHECKS`

Questo verdetto riguarda soltanto `moxtracker/site`. Non chiude R0 nel suo
complesso e non copre il filone client/Draft.

## Perimetro e stato Git iniziale

- Repository controllata esclusivamente: `moxtracker`; nessun file in `Codice/`
  è stato aperto o modificato.
- Branch iniziale: `main`, HEAD `39d56da645af7538a57ed3e32b90244f2f61556c`.
- Upstream: `origin/main`; branch avanti di due commit locali non pubblicati:
  `fb6cb3e Registra preview Draft account` e `39d56da Registra verifica draft link`.
- Worktree: una sola, `C:/Users/santi/Documents/Progetto Magic/moxtracker`.
- Stato iniziale sporco: modifiche locali M6/R3-PREP e Account/Draft già
  presenti, più `R3-PREP-SCHEMA-STORAGE.md` non tracciato. Non sono stati usati
  `reset`, `stash`, `clean`, migrazioni D1, deploy Worker o deploy Pages.

I quattro WIP richiesti erano modificati all'inizio e lo sono ancora alla fine;
gli SHA-256 sono identici.

| File WIP | SHA-256 prima e dopo |
| --- | --- |
| `prove/account-draft-ui.test.js` | `8AD7283C840E848E9AC2C0678875B2685741C2D5506802BD14F595E0D262DC05` |
| `prove/account-ticket.test.js` | `703694D34FFE7DF456F3D33879AA42BE63185780DB913712171B8A2C38F5ADAA` |
| `sito/js/account-draft.js` | `DA2CB5523636033D1DDD0475B26312DE77BE39FE2AEF2D9957768B2133F5A5AE` |
| `src/account.js` | `A91650C0B75ADCE0EFDEAE8E58E0BE625D40F19E9CA1A8494DC1D98A52A4C22A` |

## Già pronto

- Sito IT/EN, Meta, Draft pubblico, Account, Supporto, Privacy e download
  dinamico da GitHub Latest sono implementati.
- Ticket: Turnstile, link segreto, risposte, riapertura, rate limit,
  amministrazione OAuth e audit sono coperti da fixture.
- Revoca dispositivo, export JSON, cancellazione account e ZIP diagnostico
  strutturato sono coperti da test; il loro collaudo reale resta distinto.
- La preview già esistente supera lo smoke HTTP/API/CORS in sola lettura.

## Verifiche e test eseguiti

- `npm run prove`: **190/190** passati. Le righe di log sui guasti R2/D1 sono
  casi negativi attesi dai test, non fallimenti della suite.
- `npm run sito:build`: riuscito, build `bb55e75aba7f7718`, 63 file.
- Fixture Account/Ticket: passati i casi per ticket anonimo con link segreto e
  risposte, Turnstile/rate limiter, amministratore OAuth con ogni modifica
  registrata, e riapertura dopo replica anonima. Passati anche export senza
  credenziali, revoca/cancellazione dati e ZIP Mox strutturato.
- Anteprima locale: route `/`, `/en/`, `/download`, `/draft`, `/account`,
  `/supporto`, `/privacy`, `/cosa-invia-mox` e `/note-versione` HTTP 200.
- Controllo statico locale: 37 risorse referenziate da tutte le pagine HTML
  costruite, nessuna rotta o asset locale rotto.
- Browser locale: pagine sopra elencate controllate a desktop, 375 px e 640
  CSS px. Nessun overflow orizzontale, immagine rotta o errore/warning JS
  catturato. Menu mobile apre/chiude con Escape e il focus del pulsante Menu è
  visibile. Il CSS contiene due regole `prefers-reduced-motion`.
- `npm run sito:smoke` contro la preview già pubblicata: home, Draft, Account,
  Supporto, Privacy, inglese, salute API, Meta API e Draft API HTTP 200; gate
  Account HTTP 401 atteso; CORS Account HTTP 204 atteso; GitHub Latest HTTP 200
  con asset ZIP rilevato. Nessun download è stato avviato.

## Controlli manuali eseguiti

- Navigazione e reflow locale delle pagine pubbliche a desktop/mobile.
- Menu mobile ed Escape, focus visibile sul controllo Menu.
- Smoke read-only della preview e delle API pubbliche.

## Controlli manuali ancora necessari

Non sono PASS automatici o simulati. Usare un account di prova e lasciare la
cancellazione per ultima.

1. Amministrazione: creare/aprire un ticket, cambiare stato, inviare risposta
   e verificare i **due** eventi corretti in `ticket_audit`.
2. Ticket anonimo: Turnstile reale, invio, ricezione/apertura del link segreto
   e riapertura tramite risposta.
3. Revocare un dispositivo e confermare che Mox non riesca più a scrivere.
4. Esportare JSON e controllare che contenga soltanto i dati dell'account di
   prova.
5. Cancellare l'account di prova e verificare anche la seconda richiesta
   negativa.
6. ZIP diagnostico Mox: controllo rapido di regressione; il flusso è già
   collaudato ma non è stato reinviato in questa sessione.
7. Con browser/dispositivi reali: Chrome, Edge e Firefox aggiornati, telefono
   reale e sistema con riduzione movimento attiva. Il controllo locale ha
   verificato la regola CSS, non la preferenza OS effettiva.
8. Checklist con 3–5 tester prima di promuovere qualunque preview a produzione.

## Bug trovati e fix locali

1. `strumenti/anteprima_sito.mjs` serviva `/en/` come `en.html` e restituiva
   404. Ora risolve ogni percorso con slash finale come `index.html`, incluso
   `/en/`.
2. Nell'Account inglese il link amministratore avrebbe aperto `/en/admin.html`,
   pagina inesistente. Ora punta a `/admin.html`; aggiunta regressione.
3. Lo smoke controllava il manifesto dell'auto-update (`download.exe`) contro
   il pulsante pubblico GitHub Latest, producendo un errore falso. Ora verifica
   l'API GitHub Latest e che esista un asset ZIP con URL di download.

I tre fix sono locali e non pubblicati. La preview smoke-testata non li
contiene necessariamente; non è stata creata una nuova preview.

## Arretrati pubblici classificati

| Classe | Elemento | Stato |
| --- | --- | --- |
| **BLOCKER PUBLIC BETA** | Regressioni reali Account/Ticket elencate sopra | Codice/fixture verdi, ma prova sul campo ancora obbligatoria. |
| **BLOCKER PUBLIC BETA** | Inserire i tre fix locali in una preview e ripetere smoke/controllo visivo | Richiede autorizzazione separata alla preview; nessuna produzione. |
| **IMPORTANT BEFORE LAUNCH** | Contatto privacy dedicato | Esplicitamente indicato in Privacy come requisito prima del lancio ufficiale. |
| **IMPORTANT BEFORE LAUNCH** | Checklist completa multi-tester e browser/dispositivi reali | La checklist stessa richiede 3–5 persone; la suite non la sostituisce. |
| **CAN WAIT** | Verifiche future su `draft_link` (arrivo inverso, v1/senza impronta, impronte non coincidenti) | Fuori da questo audit, Account/Draft separato; non dedurre collegamenti. |
| **CAN WAIT** | R3-PREP, storage e qualsiasi ingestion/migrazione correlata | Proposta separata e fuori perimetro R0-SITE. Nessuna azione fatta. |
| **CAN WAIT** | Idee di roadmap contenuti/community e funzioni successive riportate nelle risposte di prodotto | Non risultano ticket tecnici attivi per la beta pubblica corrente. |
| **SUPERATO / STORICO** | Handoff, piani e questionari di agosto in archivio | La documentazione corrente li dichiara non operativi; non riaperti. |

Non sono emersi marcatori letterali `TODO`/`FIXME` attivi nel codice pubblico.

## Blocker

### Per beta pubblica

Non è emerso un blocker tecnico riproducibile dopo i fix locali. Restano i
collaudi reali Account/Ticket sopra elencati e, per pubblicare questi fix,
un'anteprima autorizzata separatamente.

### Per lancio/pubblicità

- Tutti i controlli manuali beta Account/Ticket e multi-browser devono essere
  registrati con esito reale.
- Serve il contatto privacy dedicato promesso dalla pagina Privacy.
- Servono preview del set di fix, verifica della preview e autorizzazione
  esplicita distinta per qualunque produzione/pubblicità.

## File modificati in questa sessione

- `strumenti/anteprima_sito.mjs`
- `strumenti/smoke_beta.mjs`
- `sito/account.html` — solo link amministratore; il file aveva già una
  modifica M6 preesistente, lasciata intatta.
- `prove/prelancio-sito.test.js`
- `R0-SITO-PUBLIC-READINESS-2026-08-31.md`

## Commit e deploy

Nessun commit, push, preview deploy, deploy produzione, deploy Worker o
migrazione D1 eseguiti.

## Prossimo step consigliato

Revisionare i quattro file funzionali R0, quindi autorizzare eventualmente una
preview contenente **solo** `strumenti/anteprima_sito.mjs`,
`strumenti/smoke_beta.mjs`, `sito/account.html` e
`prove/prelancio-sito.test.js` (più questo report, se desiderato). Dopo la
preview, eseguire nell'ordine il collaudo amministrazione/ticket anonimo,
revoca, export e cancellazione sull'account di prova; nessuna promozione a
produzione senza risultati manuali registrati e autorizzazione esplicita.
