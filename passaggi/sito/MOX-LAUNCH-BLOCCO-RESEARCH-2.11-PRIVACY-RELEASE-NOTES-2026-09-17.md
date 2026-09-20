# MOX — LAUNCH BLOCK: RESEARCH 2.11, PRIVACY, COSA INVIA MOX, RELEASE NOTES
Data: 2026-09-17
Stato: SPECIFICA DI COORDINAMENTO
Scope: sito/launch readiness. Nessun merge, deploy o modifica produzione autorizzati.

## Scopo

Allineare il sito candidato al lancio alla realtà di MOX 2 beta 2.11.0 e di Research R3 già in produzione.

Questa attività viene prima della promozione su Reddit/forum/community.

Non è un redesign generale.

---

# Stato verificato

## Client / Research

`mox-core/main` ha chiuso il 15/09/2026:

- MOX 2 beta 2.11.0 pubblicata;
- Research R3 in produzione;
- Research facoltativa;
- spenta di default;
- consenso esplicito separato;
- revoca disponibile;
- cancellazione dei dati Research;
- comportamento fail-closed se il servizio non è qualificato/pronto.

Fonte pubblica utente già presente nel repository:
`mox-core/passaggi/release/NOTE-MOX-2.11.0.md`.

La nota utente stabilisce in particolare:

- partono soltanto fatti delle partite chiuse dopo il consenso Research;
- non partono nomi, nome mazzo, ID partita, mano/grimorio avversario;
- revoca e cancellazione sono supportate;
- se il servizio non è pronto, MOX non invia e conserva localmente;
- invio partite storico, Draft e account restano separati.

## Sito redesign verificato

La preview/redesign attuale è ancora incoerente con 2.11.0:

### Privacy

`privacy.html`:

- è datata 30 agosto 2026;
- descrive soltanto consensi Partite e Draft;
- non descrive Research R3;
- dichiara ancora:
  `Prima del lancio ufficiale verrà aggiunto un contatto privacy dedicato.`

### Cosa invia MOX

`cosa-invia-mox.html`:

- dice che Partite e Draft sono i flussi condivisi;
- non contiene una sezione Research;
- quindi oggi non spiega cosa viene inviato con il nuovo opt-in Research.

### Note di versione

`note-versione.html`:

- recupera dinamicamente la release corrente per il download;
- l'ultimo changelog editoriale visibile è però ancora 2.9.24 / 26 agosto 2026;
- manca una voce leggibile per 2.11.0 e Research.

### Home

La Home corrente mette `MOX Research` sotto `In sviluppo` con una frase generale che dichiara che nessuna di quelle parti è disponibile oggi.

Questo è ormai impreciso.

La formulazione corretta deve distinguere:

- partecipazione/raccolta Research = disponibile in beta;
- analisi, Tuner, Lab e risultati Research = ancora in sviluppo.

---

# OBIETTIVO B1 — HOME / PROJECT MOX

Usare come specifica di prodotto:

`MOX-PROJECT-MOX-GOAL-PUBBLICI-2026-09-17.md`

La Home deve evitare la frase assoluta:

`Nessuna di queste parti è disponibile oggi`

se nella stessa sezione è presente MOX Research.

## Stato Research da mostrare

### Disponibile in beta

`Partecipazione a MOX Research`

Copy semplice candidato:

> Puoi scegliere di contribuire a MOX Research dalle Opzioni. È facoltativo, spento di default e puoi uscire quando vuoi.

### In sviluppo

`Analisi e suggerimenti MOX Research`

Copy candidato:

> Vogliamo usare i dati delle partite per trovare modifiche interessanti da provare sui mazzi. MOX può suggerire un'ipotesi; le partite reali su Arena devono confermare se funziona davvero.

Non presentare come disponibili:
- Deck Tuner;
- MOX Lab;
- simulatore che determina il deck migliore;
- suggerimenti personalizzati Research;
- win rate simulati.

---

# OBIETTIVO B2 — PRIVACY.HTML

La Privacy deve essere aggiornata alla release candidata e sottoposta a review privacy dedicata prima del lancio ampio.

Questa specifica non sostituisce una revisione legale.

## Modifiche minime

### Data

Aggiornare la data soltanto nel commit che introduce effettivamente la nuova informativa.

### Consensi

La frase che oggi tratta soltanto Partite e Draft va estesa distinguendo tre flussi separati quando applicabile:

- contributi Partite esistenti;
- contributi Draft;
- partecipazione Research.

Research deve risultare:

- facoltativa;
- spenta di default;
- attivata soltanto da consenso esplicito;
- non retroattiva;
- revocabile.

### Nuova sezione Research

Titolo candidato:

`Research`

Copy di base:

> MOX Research è facoltativa e separata dagli altri contributi. Se scegli di partecipare, MOX può inviare i fatti osservabili delle partite chiuse dopo il consenso per studiare il comportamento di carte, mazzi e configurazioni. Le partite precedenti al consenso non vengono incluse.

Specificare sulla base del contratto/release reale almeno:

Può includere:
- formato;
- evento;
- esito;
- rank quando disponibile;
- turni;
- play/draw;
- mulligan;
- propria decklist e sideboard;
- carte pescate;
- carte giocate/castate;
- terre/eventi Research previsti dal contratto corrente.

Non include:
- nome giocatore;
- nome avversario;
- nome libero del mazzo;
- ID originale della partita;
- mano/grimorio non rivelato dell'avversario;
- password/email come parte del flusso Research.

Non inventare campi: l'implementatore deve riconciliare il copy finale con il contratto Research e con il payload R3 reale.

### Revoca e cancellazione

Esplicitare che:

- spegnere Research interrompe i nuovi invii;
- la cancellazione Research segue il flusso realmente implementato;
- se la richiesta non viene confermata subito, il client può ritentare secondo il comportamento certificato della 2.11.0.

### Fail-closed

Spiegazione semplice:

> Se il servizio Research non è pronto o non è qualificato a ricevere i dati, MOX non li invia.

Non esporre dettagli interni su qualification token, cap, D1 o Worker.

### Contatto privacy

La frase:

`Prima del lancio ufficiale verrà aggiunto un contatto privacy dedicato`

è un blocker launch.

Prima del lancio deve diventare un contatto reale oppure essere sostituita da una soluzione approvata equivalente.

Non inventare indirizzi email.

---

# OBIETTIVO B3 — COSA INVIA MOX

Questa pagina deve essere la spiegazione breve e comprensibile, non la duplicazione integrale della Privacy.

## Struttura consigliata

1. Resta sul tuo PC
2. Se condividi le partite
3. Se condividi i Draft
4. Se partecipi a Research
5. Supporto e diagnostica
6. Il tuo controllo

## Nuovo blocco candidato

### Se partecipi a Research

> Research è separata dagli altri contributi ed è spenta di default. Se scegli di partecipare, MOX può condividere i fatti osservabili delle nuove partite necessari alla ricerca: per esempio decklist, risultato, rank quando disponibile, mulligan e carte pescate o giocate.
>
> MOX non usa Research per inviare il tuo nome, il nome dell'avversario, il nome che hai dato al mazzo o informazioni nascoste dell'avversario.
>
> Puoi ritirare il consenso e richiedere la cancellazione dei dati Research. Se il servizio non è pronto a riceverli, MOX non li invia.

Il testo finale deve essere verificato campo-per-campo contro payload/contratto.

---

# OBIETTIVO B4 — NOTE DI VERSIONE

Aggiungere una vera voce editoriale 2.11.0.

## Voce candidata

Data:
`15 settembre 2026`

Versione:
`2.11.0`

Titolo candidato:
`Arriva MOX Research`

Contenuto utente:

- Research è facoltativa e spenta di default;
- si attiva soltanto con consenso esplicito;
- raccoglie soltanto le nuove partite Research dopo il consenso;
- puoi revocare e richiedere cancellazione;
- se il servizio non è pronto, MOX non invia;
- Partite, Draft e Account continuano ad avere i propri controlli separati.

Non copiare nella Home l'intera release note.

---

# OBIETTIVO B5 — DOWNLOAD

Verificare `download.html`.

Deve:

- mostrare la release corretta;
- non descrivere MOX come se Research non esistesse, se elenca le funzioni della 2.11.0;
- evitare di sovraccaricare il percorso di download con dettagli Research.

Aggiunta massima raccomandata:

`MOX Research è facoltativa e spenta di default.`

Link eventuale:
`Scopri cosa invia MOX`.

---

# OBIETTIVO B6 — IT/EN

Ogni modifica sopra deve avere la corrispondente versione inglese se il sito launch candidate pubblica entrambe le lingue.

Non fare traduzioni letterali cieche.

Terminologia stabile consigliata:

IT:
- Il progetto MOX
- Partecipazione Research
- In sviluppo
- Cosa invia MOX

EN:
- Project MOX
- Research participation
- In development
- What MOX sends / Data sharing

Il naming inglese finale delle pagine segue la convenzione i18n già presente nel sito.

---

# GATE DI VERIFICA

PASS se:

- Home non dice più che Research è interamente indisponibile;
- partecipazione Research e futuri risultati Research sono distinti;
- Privacy descrive Research;
- Cosa invia MOX descrive Research;
- release note 2.11.0 è visibile;
- Download non è contraddittorio;
- IT/EN sono coerenti;
- campi descritti corrispondono al contratto/payload reale;
- contatto privacy launch-ready è presente;
- test sito passano;
- nessun deploy è stato effettuato senza autorizzazione.

FAIL se:

- vengono promessi Tuner/Lab/suggerimenti non disponibili;
- la Privacy resta al solo modello Partite + Draft;
- si inventano campi Research;
- il contatto privacy promesso resta assente al launch gate;
- IT e EN descrivono comportamenti diversi.

---

# FONTI TECNICHE DA LEGGERE DURANTE L'IMPLEMENTAZIONE

In `mox-core`:

- `passaggi/release/NOTE-MOX-2.11.0.md`
- stato release 2.11.0
- contratto Research congelato vigente
- documenti finali R3 necessari a conoscere payload, consenso, revoca e cancellazione

In `moxtracker`:

- implementazione server R3 corrente;
- frontend redesign launch candidate;
- Privacy;
- Cosa invia MOX;
- Note di versione;
- Download;
- i18n.

Non ricostruire Research da documenti pre-R3 se esistono fonti finali post-release.
