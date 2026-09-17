# MOX — PROJECT MOX / IL PROGETTO MOX
Data: 2026-09-17
Stato: PROPOSTA APPROVATA PER DIREZIONE E COPY
Nessuna implementazione o deploy autorizzati da questo documento.

## Decisioni approvate

Nome sezione italiano:

**Il progetto MOX**

Nome sezione inglese:

**Project MOX**

Goal pubblici principali:

1. MOX Research — focus principale
2. Draft Assistant Next Gen — focus principale
3. Nuova UI desktop / Tauri
4. Meta e Brew più evoluti
5. Collection gap / Wildcards / Buildable Decks

`Deck sharing` resta secondario e non occupa uno dei cinque slot principali.

Non mostrare numeri tecnici, fasi interne, threshold, nomi branch o sigle operative come S1/S2/S3/D5/R7.

---

# Obiettivo della sezione

Questa sezione deve spiegare in modo semplice:

- perché MOX non vuole fermarsi a essere un tracker;
- quali sono i due sviluppi più importanti su cui vogliamo costruire il futuro;
- quali altre aree arriveranno dopo;
- cosa è già disponibile e cosa invece è ancora in sviluppo.

Non deve sembrare una promessa di feature già pronte.

---

# Struttura consigliata

## Titolo

**Il progetto MOX**

## Sottotitolo italiano

> MOX parte da quello che succede nelle tue partite e vuole trasformarlo in strumenti sempre più utili: capire meglio i tuoi mazzi, migliorare il Draft e collegare gioco, statistiche personali e Meta in un unico percorso.

## English

**Project MOX**

> MOX starts from what happens in your matches and aims to turn it into increasingly useful tools: better understanding your decks, improving Draft, and connecting gameplay, personal statistics and the Meta in one place.

---

# I due focus principali

## 1. MOX Research

### Stato pubblico

**In sviluppo**

Se la partecipazione opt-in Research è già disponibile nella release candidata, distinguere:

**Partecipazione Research: disponibile in beta**  
**Analisi e suggerimenti Research: in sviluppo**

### Testo italiano consigliato

> **MOX Research**
>
> Vogliamo usare i dati delle partite per aiutarti a capire quali modifiche al tuo mazzo vale la pena provare.
>
> MOX potrà confrontare versioni diverse di un deck, numero di copie, terre e possibili sostituzioni. Simulazioni e modelli serviranno a trovare idee interessanti da testare, ma non verranno presentati come risultati reali.
>
> Il principio è semplice: **MOX può suggerire un'ipotesi. Le partite vere su Arena devono confermarla.**

### Versione inglese

> **MOX Research**
>
> We want to use match data to help you understand which changes to your deck are worth testing.
>
> MOX may compare different deck versions, card counts, land counts and possible replacements. Simulations and models can help find promising ideas to test, but they will never be presented as real match results.
>
> The principle is simple: **MOX can suggest a hypothesis. Real Arena matches have to confirm it.**

### Cosa comunica senza entrare nei dettagli tecnici

In futuro Research vuole aiutare con domande come:

- “Questa carta mi conviene davvero?”
- “Meglio 3 o 4 copie?”
- “Posso cambiare una carta senza peggiorare il mazzo?”
- “Quante terre sembrano funzionare meglio?”
- “Quale modifica vale la pena provare con le wildcard che ho?”

Non mostrare in Home formule statistiche, intervalli, effective sample size, stati interni o dettagli metodologici.

### Regola di verità

Non scrivere:

- “MOX simula il mazzo e ti dice qual è la versione migliore”;
- “MOX calcola il win rate futuro”;
- “MOX sa quale carta devi cambiare”.

Scrivere invece:

- “MOX cerca modifiche promettenti da testare”;
- “i risultati vengono confermati con partite reali”;
- “quando i dati non bastano, MOX deve dirlo”.

---

## 2. Draft Assistant Next Gen

### Stato pubblico

**In sviluppo**

Il Draft Assistant attuale esiste già; questa voce descrive il suo futuro motore, non una feature disponibile oggi.

### Testo italiano consigliato

> **Draft Assistant Next Gen**
>
> Il Draft di MOX oggi ordina le carte e ti aiuta a costruire il mazzo finale. Il passo successivo è renderlo più consapevole di quello che stai davvero costruendo.
>
> Vogliamo un motore che tenga meglio conto del tuo pool, dei colori che si stanno aprendo, della struttura del mazzo, della curva e delle sinergie tra le carte.
>
> L'obiettivo non è semplicemente assegnare un voto più alto a una carta: è aiutarti a capire **perché una scelta ha più senso nel tuo Draft** e accompagnarti dalla prima pick fino al mazzo finale.

### Versione inglese

> **Draft Assistant Next Gen**
>
> MOX Draft already ranks cards and helps you build the final deck. The next step is making it more aware of what you are actually building.
>
> We want an engine that better understands your pool, the colors that are opening up, deck structure, curve and card synergies.
>
> The goal is not simply to give a card a higher score: it is to help explain **why a pick makes more sense in your Draft** and guide you from the first pick to the final deck.

### Concetti semplici da comunicare

Il futuro Draft Assistant dovrebbe capire sempre meglio:

- che colori stai davvero giocando;
- se un colore sembra più aperto;
- cosa manca al mazzo;
- curva e struttura;
- sinergie fra le carte;
- come passare dal Draft al deck finale;
- come collegare poi quel deck alle partite e ai risultati.

### Regola di verità

Non presentare come disponibile oggi:

- un Need Detector;
- un motore di sinergia avanzato;
- un ranking nuovo già validato;
- un nuovo builder già integrato.

La ricerca Draft corrente contiene risultati descrittivi e diversi filoni ancora non aperti o non adottati nel prodotto. La sezione pubblica deve quindi parlare di **direzione**, non di capacità già presenti.

---

# Gli altri tre goal

Questi tre goal devono essere visibili ma con meno spazio dei due focus principali.

## 3. Nuova esperienza desktop

> **Nuova esperienza desktop**
>
> Una nuova interfaccia più moderna e chiara, costruita sopra lo stesso motore MOX invece di riscriverne la logica.

English:

> **New desktop experience**
>
> A more modern and clearer interface built on top of the same MOX engine instead of rewriting its core logic.

---

## 4. Meta e Brew più evoluti

> **Meta e Brew più evoluti**
>
> Continuare a migliorare come MOX riconosce archetipi, varianti e deck fuori dal catalogo, mostrando sempre quando il campione è sufficiente e quando invece non lo è.

English:

> **Better Meta and Brew analysis**
>
> Keep improving how MOX recognizes archetypes, variants and decks outside the catalog, while always showing when the available sample is sufficient — and when it is not.

---

## 5. Collection, Wildcards e Buildable Decks

> **Collection, Wildcards e Buildable Decks**
>
> Collegare la tua collezione al Meta per capire quali mazzi puoi già costruire, cosa ti manca e dove potrebbe avere più senso spendere le wildcard.

English:

> **Collection, Wildcards and Buildable Decks**
>
> Connect your collection to the Meta so you can see which decks you can already build, what you are missing and where your wildcards may be most useful.

---

# Gerarchia visiva consigliata

La sezione non deve mostrare cinque card tutte uguali.

## Riga 1 — due card grandi

- MOX Research
- Draft Assistant Next Gen

Devono occupare circa il doppio dello spazio delle altre.

## Riga 2 — tre card secondarie

- Nuova esperienza desktop
- Meta e Brew più evoluti
- Collection / Wildcards / Buildable Decks

Questo comunica chiaramente quali sono i due progetti strategici principali.

---

# Badge di stato

Usare badge semplici:

- `Disponibile`
- `Beta`
- `In sviluppo`
- `Pianificato`

Per i due focus:

### MOX Research
Se la raccolta opt-in è realmente disponibile:
- `Beta` sulla partecipazione
- `In sviluppo` sugli strumenti Research

### Draft Assistant Next Gen
- `In sviluppo`

Non usare percentuali di completamento.

---

# Collegamento con gli aggiornamenti

Subito dopo `Il progetto MOX`:

## Ultimo aggiornamento

Mostrare soltanto:

- versione corrente;
- data;
- 2–3 novità;
- link `Leggi le note di versione`.

Esempio:

> **MOX 2.11.0**
>
> Research opt-in, nuovi controlli sui dati e miglioramenti al Meta.
>
> `Leggi le note di versione`

Il testo effettivo deve essere derivato dalle release notes reali della release candidata.

---

# Cosa NON esporre

Non mettere sul sito pubblico:

- R1–R10;
- D0–D6;
- S1–S3;
- threshold numeriche;
- campioni tecnici;
- SHA;
- nomi branch;
- dettagli Cloudflare/D1;
- nomi degli agenti;
- risultati scientifici interni non ancora pubblicabili;
- promesse su date di consegna.

---

# Principio pubblico di MOX Research

Forma breve consigliata:

> **MOX può suggerire cosa vale la pena provare. Arena deve confermare se funziona davvero.**

English:

> **MOX can suggest what is worth testing. Arena has to confirm whether it actually works.**

Questa frase può diventare uno dei messaggi distintivi principali del progetto.

---

# Principio pubblico del Draft Next Gen

Forma breve consigliata:

> **Non solo quale carta scegliere, ma perché ha senso nel Draft che stai costruendo.**

English:

> **Not just which card to pick, but why it makes sense in the Draft you are building.**

---

# Stato della proposta

Direzione approvata:

- nome sezione: `Il progetto MOX / Project MOX`;
- cinque goal principali;
- focus maggiore su Research e Draft Assistant Next Gen;
- comunicazione semplice;
- niente numeri tecnici in Home;
- niente claim di funzioni non ancora disponibili;
- distinzione esplicita fra ciò che MOX può suggerire e ciò che le partite reali devono confermare.
