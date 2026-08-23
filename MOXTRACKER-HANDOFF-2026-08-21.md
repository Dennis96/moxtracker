# MOXTRACKER — Handoff completo 21/08/2026

## Scopo di questo documento

Questo handoff riassume tutto il lavoro svolto oggi sul repository `Dennis96/moxtracker`, lo stato finale pubblicato e il nuovo problema da far verificare a Codex:

> **Oggi è stata giocata almeno una normale partita Ladder, ma non è entrata nel database pubblico come le altre. La causa non è ancora stata diagnosticata.**

La priorità del prossimo controllo deve essere capire **dove si interrompe la catena partita Ladder → MOX locale → coda/invio → API → D1**, senza modificare a caso la logica dell'Archetype Engine.

---

# 1. Stato Git finale

Repository locale:

```text
C:\Users\santi\Documents\Progetto Magic\moxtracker
```

Branch di sviluppo usato durante il lavoro:

```text
s1-s2-privacy-archetypes
```

Commit creato oggi su quel branch:

```text
8c0f7fd — Aggiunge vista varianti e rifinisce frontend beta
```

Il branch è stato poi integrato in:

```text
frontend-v1
```

Merge commit finale:

```text
1c268e8 — Integra privacy e vista varianti
```

`frontend-v1` è stato pushato correttamente su GitHub.

Stato remoto verificato:

```text
frontend-v1 -> 1c268e8fb5d267003da19514d1a1877a616a4164
s1-s2-privacy-archetypes -> 8c0f7fd36ab427ae6156bd1722573339f8d99cb0
```

---

# 2. Test finali

Prima del commit e dopo il merge sono stati eseguiti:

```bat
npm run prove
```

Risultato finale:

```text
tests 88
pass 88
fail 0
```

Sono apparsi durante i test alcuni stack trace con messaggi tipo:

```text
R2 put guasto
D1 batch guasto
R2 delete guasto
R2 temporaneamente guasto
tabella segreta_interna non esiste
```

Questi sono **fault-injection test intenzionali** già coperti dalla suite e non indicano un guasto reale: tutti i test associati sono passati.

È stato eseguito anche:

```bat
git diff --check
```

senza output.

Sono stati inoltre controllati:

```bat
git diff -- src/archetipi.js
git diff -- sito/js/card-images.js
```

senza modifiche indesiderate.

---

# 3. Privacy pubblica delle decklist — stato finale

La policy definitiva introdotta oggi resta:

- una decklist osservata precisa diventa pubblicabile a **30 partite della stessa variante**;
- non esiste più una soglia minima di installazioni/contributori;
- `mittente` e identità dell'installazione non vengono mai esposti pubblicamente;
- sotto soglia:
  - niente carte;
  - niente Arena ID;
  - niente nomi carte;
  - niente quantità;
  - niente dati derivati che ricostruiscano la lista precisa;
- percentuali generali:
  - soglia `30`;
- matchup:
  - soglia `100`.

Il catalogo pubblico `mox-meta` resta separato dalle decklist realmente osservate dagli utenti MOX.

File principali coinvolti:

```text
src/privacy-pubblica.js
src/dettaglio-archetipo.js
src/lettura.js
sito/js/meta-model.js
sito/js/archetype.js
sito/privacy.html
prove/privacy-pubblica.test.js
prove/dettaglio-archetipo.test.js
prove/frontend-privacy.test.js
```

---

# 4. Vista statistica della singola variante

È stata aggiunta una vera vista dedicata alla singola variante osservata.

## Comportamento

Dalla pagina di un archetipo, se esiste una variante osservata, viene mostrato un riepilogo compatto con:

- nome `Variante osservata #N`;
- ID tecnico corto;
- numero partite;
- record V/S;
- stato dati sufficienti/insufficienti;
- stato decklist;
- pulsante:

```text
Apri variante →
```

L'URL usa un parametro `variante`.

La vista variante è volutamente distinta dalla panoramica archetipo.

## Nella vista variante vengono mostrati

- titolo variante;
- archetipo padre;
- ID tecnico corto;
- rank corrente;
- Win rate;
- record V/S;
- partite;
- quota meta;
- decklist della variante quando pubblicabile;
- box `Decklist non pubblicata` sotto soglia;
- area `Statistiche avanzate` per:
  - Al gioco / alla risposta;
  - Matchup della variante;
  - Andamento nel tempo.

## Nella vista variante NON vengono mostrati

- Lista di riferimento del catalogo;
- seconda copia della panoramica archetipo;
- seconda sezione varianti;
- blocchi aggregati dell'archetipo.

La `Lista di riferimento del catalogo` rimane soltanto nella pagina principale dell'archetipo.

---

# 5. Quota meta della variante

Il backend `src/dettaglio-archetipo.js` è stato esteso per esporre anche:

```text
quota_meta
```

per la singola variante.

La quota resta soggetta alla stessa soglia privacy/statistica prevista per le percentuali.

Sono stati aggiunti test specifici.

---

# 6. Redesign pagina variante

La vista iniziale sembrava troppo simile alla pagina archetipo.

È stata quindi ridisegnata come pagina focus:

- hero dedicata;
- banner principale della variante;
- pulsante molto evidente:

```text
Torna all'archetipo
```

- 4 metriche principali;
- decklist centrale;
- colonna statistiche avanzate;
- nessun catalogo nella variante.

È stato corretto anche un bug CSS per cui i blocchi della panoramica archetipo rimanevano visibili sotto la vista variante nonostante l'attributo `hidden`.

La correzione forza correttamente:

```css
display: none !important
```

sui blocchi della panoramica quando la vista variante è attiva.

---

# 7. Tema chiaro

Sono stati sistemati diversi problemi di contrasto.

## Pagina archetipo / variante

Correzioni per:

- titolo hero;
- link `Torna al Meta Explorer`;
- badge;
- metriche;
- pulsante `Torna all'archetipo`;
- viola troppo chiari;
- contrasto generale su sfondo chiaro.

## Home

È stata corretta la CTA finale:

```text
Aiuta a rendere il meta più preciso.
Scarica MOX per Windows
```

che in tema chiaro risultava poco leggibile.

## Metodo Draft

Il tema chiaro era fortemente rotto perché `draft.css` conteneva diversi sfondi scuri fissi mentre il testo ereditava colori da light mode.

Sono stati corretti:

- hero Draft;
- titolo;
- testo descrittivo;
- pannello `Il percorso dei dati`;
- flow card;
- note;
- contrasto generale.

È stato aggiunto:

```text
sito/css/ui-fixes.css
```

caricato per ultimo sulle pagine interessate.

---

# 8. Navigazione principale

La navbar precedente mostrava:

```text
Meta
Metodo Draft
Matchup
Metodo
```

ma `Matchup` e `Metodo` erano solo anchor interni della stessa pagina Meta.

È stata semplificata in:

```text
Meta
Metodo Draft
[tema]
```

Questa gerarchia è ora uniforme su:

```text
sito/index.html
sito/draft.html
sito/archetipo.html
sito/privacy.html
```

Le sezioni Matchup e Metodo restano nella home, ma non sono più trattate come pagine principali nella navbar.

---

# 9. File modificati nel commit grafico/finale di oggi

Il commit:

```text
8c0f7fd — Aggiunge vista varianti e rifinisce frontend beta
```

ha modificato:

```text
prove/dettaglio-archetipo.test.js
prove/frontend-privacy.test.js
sito/archetipo.html
sito/css/step53.css
sito/css/ui-fixes.css
sito/draft.html
sito/index.html
sito/js/archetype.js
sito/privacy.html
src/dettaglio-archetipo.js
```

Il merge in `frontend-v1` ha inoltre integrato l'intero lavoro privacy precedente, tra cui:

```text
prove/frontend-format.test.js
prove/lettura.test.js
prove/privacy-pubblica.test.js
sito/js/api.js
sito/js/format.js
sito/js/meta-model.js
sito/js/render.js
src/lettura.js
src/privacy-pubblica.js
```

---

# 10. Worker/API pubblicato

Dopo il commit è stato eseguito:

```bat
npm run pubblica
```

che corrisponde a:

```text
wrangler deploy
```

Deploy riuscito.

Worker:

```text
api.moxtracker.app
```

Versione pubblicata:

```text
dd1f46ca-affc-4539-a3b2-cdec833e21f8
```

Binding confermati:

```text
DB         -> moxtracker
DRAFT_DB   -> moxtracker-draft-index
DRAFT_RAW  -> moxtracker-draft-raw
```

Non è stato eseguito `npm run database-vero` perché non servivano modifiche allo schema D1.

---

# 11. Cloudflare Pages — problema e soluzione

Inizialmente il sito:

```text
https://beta.moxtracker.pages.dev/
```

non si aggiornava nonostante `frontend-v1` fosse stato pushato.

È stato verificato con:

```bat
npx wrangler pages project list
```

Risultato:

```text
Project Name: moxtracker
Project Domains: moxtracker.pages.dev
Git Provider: No
```

Quindi Pages è configurato come **Direct Upload**, non collegato automaticamente a GitHub.

È stato poi verificato:

```bat
npx wrangler pages deployment list --project-name moxtracker
```

I deployment precedenti risultavano:

```text
Environment: Preview
Branch: beta
```

Per pubblicare manualmente il nuovo frontend è stato eseguito:

```bat
npx wrangler pages deploy sito --project-name moxtracker --branch beta --commit-hash 1c268e8 --commit-message "Integra privacy e vista varianti"
```

Deploy riuscito.

Nuovo deployment URL:

```text
https://5ec20264.moxtracker.pages.dev
```

Alias aggiornato:

```text
https://beta.moxtracker.pages.dev
```

Il warning:

```text
Pages now has wrangler.toml support
```

non ha bloccato il deploy: Wrangler ha ignorato il `wrangler.toml` del Worker per Pages e ha pubblicato correttamente la cartella `sito`.

---

# 12. Stato finale online

Alla fine della sessione risultano aggiornati:

```text
GitHub frontend-v1
Worker API
Cloudflare Pages beta
```

Riferimenti:

```text
Frontend beta:
https://beta.moxtracker.pages.dev

API:
https://api.moxtracker.app
```

Il dominio principale `moxtracker.app` non è stato collegato al frontend in questa sessione.

---

# 13. IMPORTANTE — nuovo problema da controllare con Codex

## Sintomo

Oggi è stata giocata una normale partita **Ladder**, come già fatto altre volte.

La partita però:

> **non è comparsa nel database / nel meta pubblico.**

Non è ancora chiaro se:

1. MOX non l'ha riconosciuta;
2. l'ha riconosciuta ma non l'ha salvata localmente;
3. l'ha salvata ma non l'ha messa nella coda online;
4. l'ha messa in coda ma l'invio è fallito;
5. l'API l'ha ricevuta ma l'ha rifiutata;
6. l'API l'ha accettata ma D1 non l'ha salvata;
7. è nel database ma viene esclusa dalle query pubbliche per formato/evento/impronta.

### Da NON assumere

Non assumere che sia lo stesso vecchio bug dei mazzi forniti (`DualColorPrecons`).

Quel bug precedente riguardava eventi provided-deck erroneamente etichettati `Standard`; questa volta l'utente riferisce una **partita Ladder normale**.

Serve una verifica end-to-end.

---

# 14. Checklist richiesta a Codex per la partita Ladder mancante

## A. Prima: fotografia dello stato

Prima di modificare codice:

```bat
git status --short
git branch --show-current
git rev-parse --short HEAD
```

Lo stato atteso del branch corrente dovrebbe essere:

```text
frontend-v1
HEAD 1c268e8
```

Non fare reset/pull distruttivi se la working tree contiene modifiche locali non previste.

---

## B. Verificare il client MOX che produce la partita

Controllare nel progetto MOX locale il percorso che:

1. intercetta il match Arena;
2. identifica:
   - evento;
   - formato;
   - ladder/ranked;
   - esito;
   - impronta mazzo;
3. costruisce il payload;
4. salva la statistica locale;
5. accoda l'invio online.

In particolare verificare il codice che in passato aveva coinvolto:

```text
strumenti/statistiche_partite.py
```

o l'equivalente attuale se nel frattempo è stato spostato/rinominato.

Cercare:
- filtri su `eventName`;
- riconoscimento Ladder;
- mapping formato Standard;
- condizioni che possono scartare un match;
- deduplicazione;
- versione cache;
- consenso invio partite;
- coda online.

---

## C. Cercare la partita nei log/local data

Prima di cambiare codice cercare evidenze reali della partita:

- log Arena;
- log MOX;
- database/statistiche locali MOX;
- coda online;
- eventuale file JSON/payload generato.

Obiettivo:

> capire se MOX ha visto la partita e fino a quale punto è arrivata.

Annotare:
- data/ora;
- evento;
- formato;
- rank;
- deck/fingerprint;
- eventuale ID partita;
- eventuale errore di rete/API.

---

## D. Verificare l'API

Controllare se il payload sarebbe accettato da:

```text
src/controlli.js
src/index.js
```

Verificare in particolare:
- versione pacchetto;
- formato;
- evento;
- ID;
- data UTC;
- deck size;
- campi vietati;
- mittente;
- deduplicazione;
- tetto giornaliero.

Non modificare le validazioni solo per far passare il caso: prima dimostrare quale controllo lo blocca e perché.

---

## E. Verificare D1 in sola lettura

Controllare il database reale senza scrivere nulla.

Cercare la partita per:
- intervallo orario;
- mittente/installazione se disponibile localmente;
- impronta mazzo;
- evento;
- formato;
- versione MOX;
- rank.

Verificare anche se esiste ma ha:

```text
formato = NULL
```

oppure un evento inatteso.

Non eseguire:

```bat
npm run database-vero
```

e non fare UPDATE/DELETE finché la causa non è chiara.

---

## F. Verificare se è solo un problema di lettura/meta

Se la riga è presente in `partite`, controllare:

```text
src/lettura.js
src/archetipi.js
src/dettaglio-archetipo.js
```

per capire se viene esclusa dalla visualizzazione.

Distinguere chiaramente:

```text
partita non ricevuta
partita ricevuta ma non salvata
partita salvata ma non aggregata
partita aggregata ma non mostrata
```

---

# 15. Regola di lavoro per Codex

Per questo bug:

1. **non modificare subito codice**;
2. prima tracciare la singola partita attraverso l'intera pipeline;
3. mostrare esattamente dove scompare;
4. solo dopo proporre il fix minimo;
5. aggiungere un test di regressione realistico;
6. eseguire l'intera suite `npm run prove`;
7. non modificare le regole dell'Archetype Engine se il problema è a monte;
8. non toccare D1 reale con scritture finché il problema non è stato identificato.

---

# 16. Comandi utili nel repository moxtracker

Test:

```bat
npm run prove
```

Anteprima sito locale con API pubblica:

```bat
npm run sito-locale
```

Worker locale:

```bat
npm run locale
```

Deploy Worker reale:

```bat
npm run pubblica
```

**Attenzione:** questo aggiorna il Worker reale.

Deploy Pages beta manuale:

```bat
npx wrangler pages deploy sito --project-name moxtracker --branch beta
```

Elenco deployment Pages:

```bat
npx wrangler pages deployment list --project-name moxtracker
```

---

# 17. Stato da preservare

Non perdere/regredire:

- privacy decklist a 30 partite;
- separazione catalogo pubblico / osservazioni MOX;
- nessuna esposizione di `mittente`;
- vista variante dedicata;
- `Torna all'archetipo`;
- decklist variante separata;
- light mode corretto;
- navbar `Meta / Metodo Draft`;
- immagini carte e hover;
- compatibilità con API catalogo pre-S1-A;
- soglia 30 per percentuali;
- soglia 100 per matchup;
- nessun numero inventato sotto soglia.

Non modificare `src/archetipi.js` senza una motivazione specifica e un test che dimostri che il problema è realmente nell'Archetype Engine.

---

# 18. Punto di partenza consigliato nella prossima sessione

Messaggio da dare a Codex:

> Leggi integralmente questo handoff prima di toccare codice. Lo stato pubblicato è `frontend-v1` commit `1c268e8`. Oggi una normale partita Ladder giocata dall'utente non è entrata nel database/meta. Prima di modificare qualsiasi file, traccia la partita end-to-end: log Arena → parser MOX → statistica locale → coda online → payload → API → D1 → aggregazione pubblica. Dimmi prima dove si interrompe la pipeline, quali file sono coinvolti e quali prove lo dimostrano. Non cambiare l'Archetype Engine né il database reale finché la causa non è identificata. Dopo la diagnosi proponi il fix minimo con test di regressione.
