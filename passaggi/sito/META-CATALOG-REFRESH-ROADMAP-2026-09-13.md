# Roadmap tecnica — aggiornamento del catalogo archetipi del Meta

**Stato: sviluppo futuro, non implementato.** Scritto il 13 settembre 2026
insieme ad «Altro (Brew)» espandibile, sul branch
`claude/site-redesign-implementation-2026-09-13`. Questo documento non
autorizza da solo alcuna modifica a catalogo, classificatore, `mox-meta`,
Worker, D1 o fonti: ogni passo richiede un mandato separato.

## Da dove si parte oggi

- Il classificatore (`src/archetipi.js`) riconosce soltanto ciò che esiste nel
  catalogo generato, `src/catalogo-archetipi-generato.js`, prodotto da
  `npm run genera-archetipi` (`strumenti/genera_catalogo_archetipi.py`).
  Per esaminare un caso singolo esiste già `npm run diagnostica-archetipo`.
- Ciò che il catalogo non riconosce finisce in «Altro (Brew)». Dal 13/09 il
  gruppo si apre sul sito: le liste arrivate a 30 partite compaiono una per
  una («Brew #N»), ognuna con il proprio dettaglio per impronta; le altre
  restano un conteggio («N liste sotto soglia»). Nessuna di queste liste viene
  nominata, colorata o promossa ad archetipo.
- Il modello resta questo:
  - **archetipo** = famiglia strategica, riconosciuta da un nucleo di carte
    caratteristiche;
  - **variante** = lista molto simile a un riferimento del catalogo;
  - **brew** = lista non confermata.

## Il problema

Una lista che il catalogo non riconosce può essere:

- un vero Brew personale;
- un archetipo reale del meta che MOX non conosce ancora;
- una nuova variante di un archetipo già presente;
- un archetipo emerso dopo l'ultima generazione del catalogo.

Oggi questi quattro casi sono indistinguibili: il classificatore può solo dire
«non è nel catalogo».

## Obiettivo: un processo controllato

```text
fonti meta consentite e curate
        ↓
candidati nuovi archetipi o varianti
        ↓
normalizzazione (nomi carte, Arena ID, formato)
        ↓
confronto con il catalogo esistente
        ↓
test sul corpus MOX
        ↓
review e criterio di accettazione
        ↓
aggiornamento di mox-meta
        ↓
npm run genera-archetipi
        ↓
test di regressione
        ↓
nuovo catalogo pubblicato
```

## Principi obbligatori

### A. Mai promuovere un Brew perché vince

Win rate e vittorie possono essere segnali diagnostici, non la prova che una
lista sia un archetipo. Un mazzo che vince molto non diventa mai
automaticamente un archetipo.

### B. Il volume serve a scoprire, non a decidere

Le impronte non classificate osservate molte volte possono entrare in una coda
di revisione. Il volume dice «questo gruppo merita di essere controllato», mai
«questo è un nuovo archetipo». La soglia di ingresso in coda (partite e, se
appropriato, installazioni distinte) va decisa prima di iniziare.

### C. Fonti curate e consentite

Il catalogo continua ad avere fonti identificabili e compatibili con le regole
del progetto. Non si aggirano `robots.txt`, restrizioni d'uso o fonti vietate.
Ogni voce del catalogo conserva la propria fonte e la data.

### D. Distinguere archetipo e variante

Un refresh non deve confondere i livelli: una nuova lista vicina a un
riferimento esistente è una variante, non un archetipo nuovo. Il nucleo di
carte caratteristiche resta il criterio dell'archetipo.

### E. Test prima della pubblicazione

Ogni refresh del catalogo si prova sul corpus MOX prima di pubblicarlo, e
controlla almeno:

- nuovi riconoscimenti;
- falsi positivi;
- archetipi esistenti che cambiano classificazione;
- Brew assorbiti per errore da un archetipo;
- stabilità delle soglie (somiglianza, nucleo, margine).

Il risultato è un diff leggibile «prima → dopo» per impronta e per archetipo.

### F. Diagnostica dei candidati

Uno strumento o report futuro, interno e mai pubblicato sul sito, elenca per
ogni candidato almeno:

- impronta o gruppo tecnico;
- numero di partite;
- numero di installazioni distinte, solo come conteggio aggregato e solo se
  appropriato: mai identificativi;
- colori osservati;
- carte più caratteristiche;
- somiglianza con gli archetipi noti;
- motivo del mancato riconoscimento.

Il report resta interno: non espone identificativi tecnici agli utenti del
sito.

### G. Aggiornamento non necessariamente automatico

Le tre fasi restano separate:

1. **discovery automatico dei candidati**: può girare da solo e produce
   soltanto un elenco da esaminare;
2. **validazione e approvazione del catalogo**: decisione umana, con criterio
   di accettazione scritto;
3. **rigenerazione tecnica**: `npm run genera-archetipi`, test di regressione
   e pubblicazione.

L'obiettivo non è un sistema completamente automatico.

### H. Possibile automazione futura

Evoluzioni possibili, tutte da autorizzare a parte:

- un job schedulato che segnala i candidati;
- un refresh periodico delle sole fonti consentite;
- un diff automatico del catalogo;
- una suite di regressione sul corpus;
- un'approvazione esplicita prima di ogni pubblicazione.

## Esclusi, anche in futuro, salvo decisione esplicita

- promozione automatica di un Brew ad archetipo;
- machine learning per classificare o nominare;
- nomi automatici costruiti dalle carte;
- scraping di fonti non consentite;
- modifica delle soglie del classificatore senza review e regressione;
- nuovi claim di meta-archetipo sul sito.

## Da decidere prima di iniziare

- l'elenco delle fonti consentite e chi lo mantiene;
- la soglia di ingresso nella coda dei candidati;
- chi approva un refresh e con quale criterio scritto;
- dove vive il report dei candidati (fuori dal sito pubblico);
- la frequenza dei refresh.
