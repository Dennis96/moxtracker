# MOX Site Redesign — Specifica approvata

Stato: **approvata e congelata il 13/09/2026**. È la fonte principale per
implementare il redesign del sito pubblico `moxtracker` (`sito/**`).

Precedenza, in caso di conflitto:

1. questa specifica;
2. i render finali elencati nella sezione 15;
3. i file HTML/CSS dei mockup nella stessa cartella.

Il testo prevale sui dettagli accidentali di un mockup quando descrive
esplicitamente un comportamento. I mockup precedenti (V2, esplorazioni,
`*-claude.png`, `*-claude-v2.png`) sono storia e non valgono come riferimento.

Mockup canonici: `passaggi/sito/mockups/2026-09-13/claude-home-exploration/plugin/`
(HTML statico, nessuna API; i CSS `style.css` e `pages.css` sono la
traduzione di riferimento dei token e dei componenti).

---

## 1. Obiettivo

Il sito deve far capire in pochi secondi che MOX è un programma reale per MTG
Arena che fa tre cose (Contatore in partita, Assistente al Draft, mazzi e
statistiche), che ha una parte web (Meta, Draft, Il mio MOX) e che si scarica
per Windows. Il software reale è il protagonista; il sito non inventa funzioni,
numeri o interfacce.

Identità: circa metà identità MOX attuale (tema scuro, viola MOX, marchio con
la mascotte), metà modernizzazione orientata ai dati. Niente look e-sport,
niente sito corporate generico, niente dashboard inventate.

## 2. Architettura del sito

**Decisione congelata: Home e Meta sono due pagine separate.** La Home
presenta MOX e rimanda alle aree web; il Meta vive nella propria pagina.

| Area | Ruolo | Mockup | Fonte attuale da conservare |
|---|---|---|---|
| Home | Spiega MOX, cosa fa il client, cosa offre sul web, cosa è in sviluppo e pianificato | `index.html` | `sito/index.html` (solo le parti non Meta) |
| Meta Explorer | Ricerca e confronto degli archetipi | `meta.html` | sezioni `#meta`, `#matchup`, `#metodo` di `sito/index.html`, `sito/js/main.js`, `render.js`, `meta-model.js` |
| Archetipo | Dettaglio di un archetipo e sue varianti | `meta-archetipo.html` | `sito/archetipo.html`, `sito/js/archetype.js`, `deck-profile.js` |
| Dettaglio variante | Una variante osservata, con decklist | `meta-variante.html` | stato `?variante=` di `sito/archetipo.html` |
| Draft | Assistente al Draft, dati Limited, metodo | `draft.html` | `sito/draft.html`, `sito/js/draft.js` |
| Il mio MOX | Archivio privato e gestione dell'account | `account.html` | `sito/account.html`, `sito/js/account.js` |
| Supporto e pagine di servizio | Non ridisegnate qui | — | adottano testata, piede e token di questa specifica |

Il percorso del Meta è parte del design e non si semplifica:

```text
Meta Explorer → Archetipo → Varianti osservate → Dettaglio variante
```

Il contratto dei parametri attuali della pagina archetipo resta valido
(`formato`, `periodo`, `rank`, `modalita`, `impronta`, `id`, `variante`): il
dettaglio variante può restare uno stato della stessa pagina, ma deve
presentarsi come vista a sé (titolo, percorso, pulsante di ritorno), come nel
mockup.

## 3. Navigazione

Testata, su tutte le pagine:

```text
[marchio MOX] MOX    Home  Meta  Draft  Account  Supporto    IT / EN   [Scarica MOX]
```

- Marchio reale `sito/assets/branding/mox-marchio.webp` a 32 px, seguito dal
  nome «MOX». Non inventare un altro logo. Altezza della testata 72 px.
- La voce della pagina corrente ha `aria-current="page"` e una sottolineatura
  viola di 2 px.
- `Scarica MOX` è sempre visibile, anche su mobile, come pulsante primario.
- Sotto i 760 px le voci passano in un menu (`Menu`) con gli stessi link; nel
  mockup è un `<details>` senza JavaScript, l'implementazione può usare il
  pulsante menu esistente purché accessibile da tastiera.
- Il selettore lingua resta `IT / EN` e usa la traduzione esistente.
- Piede: marchio, gli stessi cinque link e una riga di servizio. Le pagine di
  servizio attuali (Cosa invia MOX, Note di versione, Privacy, GitHub) restano
  raggiungibili dal piede.

Barre di stato sotto la testata (solo dove servono):

- Meta, archetipo, variante: «Beta pubblica.» con la frase sulle soglie.
- Draft: «Metodo Draft in beta.» con la frase sui contributi anonimi.
- Il mio MOX nel mockup: barra «Dati di esempio» (vedi sezione 11).

## 4. Identità visiva

### Token

| Nome | Valore | Uso |
|---|---|---|
| `--ink` | `#07080d` | fondo pagina |
| `--ink-2` | `#0c0d15` | fasce alternate (MOX sul web), fondo delle righe variante |
| `--panel` | `#0f1018` | pannelli e fasce di metriche |
| `--table` | `#14131d` | campi, cornici degli screenshot |
| `--violet` | `#7c2cff` | pulsante primario, voce di navigazione attiva |
| `--violet-hi` | `#a644ff` | barre di quota, grafici |
| `--lilac` | `#c9a2ff` | link, chip, stato «in arrivo» |
| `--green` | `#61dd79` | solo «reale / pubblicato» e valori positivi |
| `--red` | `#ff6b71` | valori negativi, azioni di cancellazione |
| `--text` / `--text-2` | `#f7f5fb` / `#d4d2dc` | testo, testo lungo |
| `--muted` / `--muted-2` | `#a7a6b2` / `#777785` | testo secondario |
| `--line` / `--line-strong` | viola al 16% / 42% | bordi, cornici degli screenshot |
| `--dash` | lilla al 45% | tratteggi del futuro, bordo dei pulsanti secondari |

I colori derivano da `sito/css/tokens.css`; i valori sopra sono quelli dei
mockup e vanno riportati in `tokens.css` durante l'implementazione.

### Tipografia

- **Spectral 600** per H1, H2, H3 e nomi di archetipi. Il titolo è una frase
  che informa, tutta dello stesso colore: niente parole evidenziate.
- **Hanken Grotesk** 400/500/600/700/800 per testo, dati, pulsanti; cifre
  tabellari (`font-variant-numeric: tabular-nums`).
- Scala indicativa: H1 Home 46–50 px, H1 pagine 37–51 px, H2 32–42 px,
  H3 20–28 px, testo 16–18 px, note 13–14 px. Righe di testo sotto i 75
  caratteri.
- Niente etichette tutte maiuscole sopra i titoli.

### Codici degli stati (uguali su tutto il sito)

| Stato | Segno | Dove |
|---|---|---|
| Reale / pubblicato | pallino verde pieno (`state-ok`, didascalie `real-note`) | screenshot reali, decklist pubblicata, collegato |
| Sotto soglia | contorno grigio (`state-below`) e barretta di avanzamento | righe del Meta, varianti non pubblicate |
| In arrivo / futuro / proposta | tratteggio lilla (`state-soon`, `soon-box`, `proposal-note`) | statistiche non ancora calcolate, In sviluppo, anteprime di pagine proposte |

### Componenti

- **Pulsanti**: primario viola pieno; secondario con bordo lilla; distruttivo
  con bordo rosso. Il testo dice cosa succede («Scarica MOX», «Apri
  variante», «Copia per Arena»). Niente frecce aggiunte al testo.
- **Pannelli**: bordo `--line`, raggio 16 px, fondo `--panel`.
- **Fascia di metriche**: una sola fascia con divisori verticali (4 o 6
  metriche), non quattro carte separate. Etichetta, valore grande, nota.
- **Cornici degli screenshot**: bordo `--line-strong`, raggio 12–14 px, ombra
  profonda. Mai ingrandire uno screenshot oltre la risoluzione nativa.
- **Chip** per strategie; **pallini colore** W U B R G per i colori.
- **Movimento**: solo l'ingresso della Hero (client, poi le tre preview in
  ordine); nessuna animazione con `prefers-reduced-motion: reduce`.

## 5. Home

Ordine delle sezioni, da non cambiare: Hero → Cosa fa MOX → MOX sul web → In
sviluppo + Pianificato → CTA finale → Piede. La Home **non** contiene il Meta
Explorer reale né suoi dati live.

### Hero

- H1: **«Tracker, Assistente al Draft, mazzi e statistiche per MTG Arena.»**
- Sottotitolo: «Durante la partita conta le carte che restano nel tuo mazzo.
  Nel Draft mette in ordine ogni busta e ti propone il mazzo finale. Dopo,
  conserva i tuoi mazzi e le loro statistiche. Sul web trovi il Meta, i dati
  Draft e il tuo account.»
- CTA: `Scarica MOX` (primaria, download) e `Esplora il Meta` (secondaria,
  pagina Meta).
- Riga tecnica: `Windows · Beta pubblica · Download da GitHub`.
- Composizione: testo a sinistra (metà griglia, allineato in alto), a destra
  lo screenshot reale della Home del client (`client-home.webp`, al massimo
  620 px, mai ingrandito) con dietro la sua testata sfocata
  (`header-glow.jpg`).
- Sotto, una fascia di **tre preview a tutta larghezza** (rapporto 7:5, circa
  437 px ciascuna a 1440 px) che sale sulla fascia vuota in fondo al client
  senza coprire dati: Contatore in partita, Assistente al draft, I tuoi mazzi
  di Arena, ognuna con l'icona vera dello strumento e il suo nome come nel
  client.
- A 1440×900 titolo, CTA, riga tecnica, client e nomi delle preview stanno
  tutti nella prima schermata.

Non reinterpretare: niente slogan, niente «assistente» da solo nel titolo,
niente IA, niente «gioca meglio»; niente laptop o browser finti attorno agli
screenshot.

### Cosa fa MOX

Linea del tempo verticale con quattro momenti, ciascuno con testo a sinistra
(titolo, strumento con icona, descrizione) e screenshot reale grande a destra
con didascalia «Schermata reale…» e pallino verde:

1. **Durante la partita** — Contatore in partita. Include la frase «Non ti
   dice cosa giocare: tiene il conto al posto tuo.» Screenshot
   `story-partita.webp` con il riquadro `story-avversario.webp`.
2. **Durante il Draft** — Assistente al draft, dati 17lands, giudizi «carta
   forte, buona nei tuoi colori, riempimento». `story-draft.webp`.
3. **Dopo il Draft** — mazzo proposto dal pool, tre combinazioni, terre da 16
   a 18. `story-mazzo-draft.webp`.
4. **Dopo le partite** — I tuoi mazzi di Arena, statistiche per versione,
   confronto con la collezione, copia e salvataggio. `story-statistiche.webp`
   (nomi dei mazzi sostituiti, dichiarato in didascalia).

### MOX sul web

- Fascia con fondo `--ink-2`. Griglia 1,55 : 1.
- Colonna principale: **Meta**, con anteprima grande dell'Explorer e sotto
  due anteprime affiancate (archetipo con varianti, dettaglio variante), poi
  la nota «Proposta di pagina…», titolo, testo e link `Esplora il Meta`.
- Colonna secondaria, impilata: **Draft** e **Il mio MOX**, ciascuno con
  anteprima, nota, titolo, testo e link.
- Le anteprime sono immagini delle pagine redesign. Finché una pagina
  mostrata non è quella pubblicata, la nota usa il segno tratteggiato
  («Proposta di pagina»), mai il pallino verde. Quando le pagine saranno
  implementate, le anteprime vanno rigenerate dal sito vero e l'anteprima di
  Il mio MOX resta con dati di esempio dichiarati o senza numeri.

### In sviluppo

Riquadri tratteggiati, senza date, senza UI simulata:

- **MOX Research** — «Un modo più profondo per leggere i dati reali delle
  partite, quando metodo e campione saranno pronti.»
- **Draft Assistant Next Gen** — «Un percorso più chiaro fra la scelta, il
  pool e la costruzione del mazzo finale.»
- **Nuova interfaccia** — «Una nuova esperienza desktop più moderna, chiara e
  coerente con il resto di MOX.» Il nome del framework (Tauri) non compare
  nella pagina pubblica.

### Pianificato

Solo testo, colore attenuato, separatori tratteggiati, senza date:
collezione e wildcard mancanti; «Posso costruire questo mazzo?»; editor dei
mazzi più completo; ricerca carte e costruzione senza Arena; condivisione dei
mazzi.

### CTA finale / Footer

«Prova MOX alla prossima partita.» con la frase su Windows, beta pubblica e
GitHub, e i due pulsanti della Hero. Sfondo: la testata del client sfocata.
Poi il piede della sezione 3.

## 6. Meta

Principio: **il Meta attuale evoluto, non sostituito**. Nessuna funzione del
Meta attuale va persa; se un dettaglio del mockup è più povero del sito
attuale, prevale il sito attuale.

### Explorer

Ordine: barra beta → intestazione → filtri → tabella → note → Matchup →
Come funzionano i dati.

- **Intestazione**: H1 «Meta Explorer», frase che spiega il percorso
  (archetipo → varianti → variante pubblicata); a destra partite totali della
  vista e «Ultimo dato ricevuto».
- **Filtri** in un unico pannello:
  - Formato (select, valori dall'API);
  - Periodo (segmentato: 7 giorni, 14 giorni, 30 giorni, Tutto);
  - Modalità (segmentato: BO1 + BO3, BO1, BO3);
  - Rank (intervallo sui sei livelli Bronzo, Argento, Oro, Platino, Diamante,
    Mitico; la resa grafica può restare il doppio cursore attuale con le icone
    dei rank);
  - Cerca (archetipo o lista);
  - Strategia (select, valori dall'API);
  - Colori (cinque pallini W U B R G premibili);
  - Azzera filtri, con la frase «Colori e strategia filtrano gli archetipi
    riconosciuti dalla lista completa; i colori selezionati devono essere
    tutti presenti.» e l'avviso attuale quando classificazione e colori non
    sono ancora disponibili.
- **Tabella** (tabella vera, ordinabile, ordine iniziale per partite):
  Archetipo o mazzo | Partite | V | S | Win rate | Quota meta | Apri.
  - Nome in Spectral, pallini colore e chip strategia sotto il nome.
  - La **striscia di carte principali** attuale (`createCoreStrip` in
    `sito/js/card-images.js`, con anteprima della carta) resta nelle righe; il
    mockup non la riproduce solo perché le immagini arrivano da fonti
    esterne.
  - Quota meta con numero e barra.
  - «Altro (Brew)» resta come riga di gruppo («N liste non riconosciute
    raggruppate»), senza link.
- **Note sotto la tabella**: «Percentuali pubblicate da 30 partite.» e il
  numero di gruppi mostrati.
- **Matchup tra archetipi**: pannello con soglia «100+ partite per coppia»; se
  non pubblicabili, riquadro tratteggiato con la spiegazione attuale. Mai una
  matrice dedotta dalle sole carte rivelate.
- **Come funzionano i dati**: quattro punti (percentuali da 30 partite,
  matchup da 100, dati anonimi, nessun numero inventato).

### Soglie e stati

- Win rate e quota di archetipo e variante: pubblicati da **30 partite**.
- Matchup: da **100 partite affidabili per coppia**.
- Decklist precisa di una variante: quando la stessa variante raggiunge **30
  partite**.
- Win rate = vittorie / partite. Quota meta = partite dell'archetipo (o della
  variante) / partite totali nella vista filtrata.
- Una riga sotto soglia non mostra percentuali: nelle due colonne unite
  mostra «Sotto soglia», una barretta di avanzamento e **«N partite su 30:
  ne mancano M»**. Niente doppio «Dati insufficienti».
- Stati visivi della sezione 4: pubblicato, sotto soglia, in arrivo.

### Archetipo

Ordine, da non cambiare:

1. percorso `Meta Explorer › Nome archetipo`;
2. H1 con nome, pallini colore, chip strategia, riga dei filtri attivi
   («Standard, ultimi 30 giorni, BO1 + BO3, tutti i rank») e link «Cambia
   filtri»;
3. fascia di quattro metriche: Win rate (con «Campione sopra soglia» o la
   soglia), Quota meta, Partite (V / S), Filtro rank;
4. **Varianti osservate su MOX** subito dopo il riepilogo (vedi sotto);
5. due colonne: a sinistra **Profilo della lista rappresentativa**; a
   destra **Lista di riferimento del catalogo** e sotto **Ancora in arrivo**.

Profilo della lista rappresentativa (calcolato da `deck-profile.js` sulla
prima lista osservata pubblicabile, altrimenti sulla lista del catalogo; dirlo
nella nota):

- **Copie per tipo di carta** — somma delle copie per tipo; il totale è la
  dimensione del mazzo («Ogni copia conta una volta: 60 carte in totale»).
- **Copie per colore d'identità** — per ogni colore, le copie delle carte che
  hanno quel colore nell'identità, terre comprese; una carta multicolore conta
  per ciascun colore, quindi i numeri non si sommano alla dimensione del mazzo.
  Etichetta obbligatoria per esteso («60 copie con il bianco»), mai «60 W».
- **Curva di mana** — copie per valore di mana (0 solo se presente, poi 1…5,
  6+). Nessuna barra senza dati; nel mockup i valori non sono riprodotti.
- **Terre speciali e fixing** — elenco con copie.
- Nota di provenienza: «Lista rappresentativa osservata in N partite» oppure
  «Lista di catalogo: non è un campione osservato degli utenti MOX».

Lista di riferimento del catalogo: decklist curate di mox-meta, dichiarate
come riferimenti pubblici e non osservazioni MOX, in elementi apribili.

Ancora in arrivo (righe con stato tratteggiato): distribuzione per rank, al
gioco / alla risposta (solo il dato dell'archetipo), matchup, andamento nel
tempo. Nessun grafico disegnato senza serie reale.

### Varianti osservate

- Intestazione con conteggio («10 varianti osservate») e la regola delle 30
  partite.
- **Barra di ripartizione** delle partite dell'archetipo: parte verde per le
  varianti pubblicate, parte tratteggiata per le liste sotto soglia, con la
  frase «Le N partite dell'archetipo: X nella variante pubblicata, Y in Z
  liste ancora sotto soglia.»
- Una riga per ogni variante pubblicata: titolo («Lista più rappresentativa»
  per la prima), «Variante osservata #n, ID xxxxxxxx», partite, record, win
  rate, stato «Decklist pubblicata», pulsante `Apri variante`.
- Una riga di gruppo «Altre varianti»: numero di liste sotto soglia, partite
  aggregate, stato «Dati e decklist non pubblicati». Nessun link.

### Dettaglio variante

1. percorso `Meta Explorer › Archetipo › Varianti osservate › Variante #n`;
2. H1 «Variante osservata #n», riga con colori, strategia, archetipo, ID e
   rank; pulsante `Torna all'archetipo`;
3. fascia di quattro metriche: Win rate, Record, Partite (osservate su MOX),
   Quota meta (nel filtro corrente);
4. due colonne: **Decklist della variante** (stato «Pubblicata», pulsante
   `Copia per Arena`, gruppi «Magie e creature» e «Terre» con i totali) e, a
   destra, **Profilo della lista** (stesse definizioni dell'archetipo) e
   **Statistiche avanzate** con tre righe «In arrivo»: al gioco / alla
   risposta, matchup della variante, andamento nel tempo;
5. nota: la pagina contiene solo dati della variante; le liste del catalogo
   restano nella pagina dell'archetipo.

Se la variante non è pubblicabile, la decklist è sostituita da uno stato
«sotto soglia» con le partite mancanti; mai una lista parziale.

### Compatibilità vecchio #meta

Oggi il Meta è raggiungibile come `/#meta` sulla Home e da link interni
(`./index.html#meta`). Requisito: **i vecchi ingressi al Meta non devono
rompersi senza una strategia esplicita di compatibilità o reindirizzamento**,
da decidere nell'implementazione. Questa specifica non definisce il routing.

## 7. Draft

Gerarchia congelata: **prima l'utilità concreta, poi i dati, poi il metodo.**

1. **Intestazione** a due colonne: H1 «Assistente al Draft e dati Limited»,
   frase su programma e sito, CTA `Scarica MOX` e `Vedi i dati Draft`, riga
   tecnica; a destra lo screenshot reale della finestra dell'Assistente
   (`preview-draft.webp`) con didascalia reale.
2. **Nel programma**: due momenti affiancati con screenshot reali: Durante il
   Draft (`story-draft.webp`) e A draft finito (`story-mazzo-draft.webp`).
3. **Dati Limited sul sito**: filtri Set, Evento Arena (Premier, Quick,
   Traditional, Pick-Two), Periodo e `Aggiorna`; data di aggiornamento; fascia
   di quattro metriche (Draft completi, Scelte registrate, Partite collegate,
   Win rate con soglia di 30 partite collegate); **Espansioni ed eventi** a
   schede (evento, set, draft, scelte, «Filtra questo gruppo»); **Colori e
   carte** con stato «In raccolta» e riquadro «Nessun numero prematuro».
4. **Il metodo**: percorso dei dati in quattro passi numerati (Draft con MOX,
   Consenso separato, Campioni separati, Aggiornamento verificato); «Sul tuo
   PC» / «Sul sito»; **Le garanzie del metodo** in quattro punti.

Non reinterpretare: la pagina non apre con la metodologia; Next Gen non è
presentato come disponibile; nessuna percentuale sotto soglia.

## 8. Il mio MOX / Account

H1 «Il mio MOX», frase «Mazzi, partite e draft associati ai tuoi dispositivi.
Li vedi solo tu.», a destra il riepilogo del collegamento (provider, numero di
dispositivi, ultimo invio ricevuto).

**Cinque schede**, in quest'ordine, con il conteggio accanto dove utile:

| Scheda | Contenuto |
|---|---|
| Panoramica | fascia di sei metriche (Partite, Vittorie / sconfitte, Win rate, Al gioco / risposta, Durata media, Draft registrati); ultime dieci partite; nota sui consensi (si modificano nelle Opzioni di MOX, per dispositivo); I miei mazzi (primi tre) accanto ad Andamento del rank; Partite recenti (le ultime, a tutta larghezza) |
| Mazzi | tutti i mazzi: nome, formato e modalità, ultima partita, win rate, partite, V / S; ogni riga apre carte e statistiche |
| Partite | filtri Mazzo, Esito, Evento, Azzera filtri; elenco con esito, mazzo, avversario, evento, data, turni, durata; paginazione attuale; **Contro gli archetipi** (classificazione prudente basata solo sulle carte rivelate) |
| Draft | sessioni con set, evento, data, record, partite; distinzione fra «traccia Draft completa» e «partite Limited senza traccia»; parti mancanti dichiarate |
| Account | Collega MOX (codice monouso, scade in 10 minuti); Dispositivi (con stato del contributo anonimo, in sola lettura); Ticket e «Apri un ticket» (più il link di amministrazione per chi ne ha diritto); Accessi Google / Discord; I tuoi dati: esportazioni (tutto, partite, Draft, mazzi) ed Esci; zona Cancellazione separata (partite, Draft, mazzi, elimina dati e account), con conferma |

- La separazione è netta: le prime quattro schede sono **uso e statistiche
  personali**; la scheda Account è **gestione** di collegamento, dispositivi,
  ticket, accessi, esportazioni e cancellazioni.
- Il dettaglio di una partita o di un draft resta la finestra di dettaglio
  attuale (decklist, ultima mano osservata quando disponibile, andamento, carte
  rivelate dall'avversario).
- Stati da implementare anche se il mockup non li mostra: caricamento, non
  autenticato (accesso con Google o Discord; MOX non gestisce password; il
  contributo anonimo funziona anche senza login), archivio vuoto.
- La Panoramica non deve crescere oltre quanto descritto: niente grafici
  aggiuntivi.

## 9. Responsive

Punti di rottura dei mockup: **1100 px** e **760 px**.

- Sopra 1100 px: griglie a due colonne come nei render desktop.
- Fino a 1100 px: Hero su una colonna (testo, client fino a 720 px, preview
  sotto senza sovrapposizione); linea del tempo con screenshot sotto il testo;
  MOX sul web su una colonna; pagine con colonne impilate; fasce di metriche a
  due colonne; filtri a due colonne.
- Fino a 760 px: margini laterali 20 px; menu al posto della navigazione;
  preview della Hero una sotto l'altra a tutta larghezza; filtri, form e
  griglie a una colonna; la tabella del Meta scorre in orizzontale **dentro**
  il suo contenitore, mai la pagina; le schede di Il mio MOX scorrono in
  orizzontale.
- Verifica minima: 1440 px e 390–520 px su Home, Meta e Il mio MOX; nessuno
  scorrimento orizzontale della pagina.

## 10. Accessibilità

- Link «Vai al contenuto» come primo elemento.
- Focus visibile su ogni elemento interattivo (contorno lilla 2 px).
- `aria-current` sulla pagina attiva; `aria-pressed` su segmenti e pallini
  colore; gruppi di filtri con etichetta.
- Tabella del Meta con `caption`, `th scope`, `aria-sort` sulla colonna
  ordinata.
- Schede di Il mio MOX raggiungibili e attivabili da tastiera; la scheda
  attiva è annunciata.
- Testi alternativi che descrivono cosa mostra ogni screenshot; immagini
  decorative con `alt=""`; grafici con etichetta testuale equivalente.
- Contrasto: testo su fondo scuro almeno AA; il colore non è mai l'unico
  segnale (stati sempre anche a parole: «Sotto soglia», «In arrivo»,
  «Pubblicata»; esiti V / S con lettera).
- `prefers-reduced-motion` rispettato.
- `lang="it"` o `lang="en"` coerente con la lingua scelta.

## 11. Dati reali vs placeholder

Regola per l'implementazione reale:

```text
dato reale dall'API
oppure stato vuoto
oppure skeleton / caricamento
```

**Mai dati dimostrativi presentati come reali.**

- Sotto soglia si mostrano i conteggi reali e quante partite mancano, mai una
  percentuale.
- Nessun grafico (curva, rank, trend, matchup) viene disegnato senza la serie
  reale.
- Nei mockup: i numeri di Meta, archetipo, variante e Draft sono copiati dal
  preview pubblico del 13/09/2026; i numeri e i nomi di Il mio MOX sono
  inventati e la pagina lo dichiara in una barra «Dati di esempio» sempre
  visibile. Questa barra esiste solo nel mockup.

## 12. Asset reali

Cartella: `passaggi/sito/mockups/2026-09-13/claude-home-exploration/assets/`,
ritagli degli screenshot puliti di
`passaggi/sito/mockups/2026-09-13/references/hero-inventory/clean/`.

| File | Fonte | Uso |
|---|---|---|
| `mox-marchio-96.webp` | `sito/assets/branding/mox-marchio.webp`, solo ridimensionato | marchio in testata e piede |
| `client-home.webp` | `mox-client-home-tools-no-windows.png` | Hero |
| `header-glow.jpg` | testata del client, sfocata | luce dietro il client, CTA finale |
| `icon-contatore.png`, `icon-draft.png`, `icon-mazzi.png` | icone del client | nomi degli strumenti |
| `preview-contatore.webp` | `mox-tracker-ingame-narrow-a.png` | preview Hero |
| `preview-draft.webp` | `mox-draft-pick-live-narrow-a.png` | preview Hero, intestazione Draft |
| `preview-mazzi.webp` | `mox-local-decks-statistics.png`, nomi dei mazzi sostituiti | preview Hero |
| `story-partita.webp`, `story-avversario.webp` | `mox-tracker-ingame-wide.png` | Cosa fa MOX |
| `story-draft.webp` | `mox-draft-pick-live-wide.png` | Cosa fa MOX, Draft |
| `story-mazzo-draft.webp` | `mox-draft-summary-b.png` | Cosa fa MOX, Draft |
| `story-statistiche.webp` | `mox-local-decks-statistics.png`, nomi dei mazzi sostituiti | Cosa fa MOX |

Regole:

- solo screenshot reali; ritaglio, ridimensionamento (mai ingrandimento),
  cornice e ombra sono ammessi; nessun controllo o dato aggiunto;
- i nomi personali dei mazzi sono sostituiti con nomi di archetipi pubblici
  scritti con il font del client, e la didascalia lo dice;
- `story-risorse.webp` è disponibile ma non usato.

## 13. Funzioni in sviluppo / pianificate

| Funzione | Stato | Come appare |
|---|---|---|
| MOX Research | In sviluppo | riquadro tratteggiato in Home; nessun dato |
| Draft Assistant Next Gen | In sviluppo | riquadro tratteggiato; mai come disponibile |
| Nuova interfaccia desktop | In sviluppo | riquadro tratteggiato; senza nome del framework |
| Collezione e wildcard mancanti | Pianificato | solo testo |
| «Posso costruire questo mazzo?» | Pianificato | solo testo |
| Editor dei mazzi più completo | Pianificato | solo testo |
| Ricerca carte e costruzione senza Arena | Pianificato | solo testo |
| Condivisione dei mazzi | Pianificato | solo testo |
| Rank, al gioco / risposta, matchup, trend di archetipo e variante | In arrivo | righe «In arrivo» tratteggiate |
| Colori e carte nei dati Draft | In raccolta | stato «In raccolta» |

Nessuna data. Nessuna UI simulata per queste funzioni.

## 14. Cose esplicitamente vietate

- fake UI: schermate ricostruite o generate che sembrano il prodotto;
- numeri inventati, anche «di esempio», nel sito reale;
- funzioni future presentate come disponibili;
- presentare il Contatore come coach o suggeritore di mosse;
- dichiarare un'IA nativa di MOX, «il miglior meta» o «il miglior Draft
  Assistant»;
- «companion» come descrizione di MOX; «gratis»; superlativi;
- rimettere il Meta Explorer dentro la Home;
- togliere o nascondere varianti osservate e dettaglio variante;
- grafici disegnati senza serie reale;
- stile e-sport, immagini stock, laptop o browser finti.

## 15. Mockup canonici di riferimento

Cartella `passaggi/sito/mockups/2026-09-13/claude-home-exploration/plugin/`:

| Render | Pagina |
|---|---|
| `home-final.png` | Home intera, 1440 px |
| `home-hero-final.png` | prima schermata della Home, 1440×900 |
| `home-mobile-final.png` | Home a 520 px |
| `meta-final.png` | Meta Explorer |
| `meta-mobile-final.png` | Meta Explorer a 520 px |
| `meta-archetype-final.png` | Archetipo con varianti |
| `meta-variant-final.png` | Dettaglio variante |
| `draft-final.png` | Draft |
| `account-final.png` | Il mio MOX, Panoramica |
| `account-settings-final.png` | Il mio MOX, scheda Account |
| `account-mobile-final.png` | Il mio MOX a 520 px |

Sorgenti: `index.html`, `meta.html`, `meta-archetipo.html`,
`meta-variante.html`, `draft.html`, `account.html`, `style.css`, `pages.css`;
anteprime della Home in `web/`.

## 16. Criteri di accettazione dell'implementazione futura

L'implementazione è accettata se:

1. Home, Meta, Draft e Il mio MOX sono pagine distinte con la navigazione
   della sezione 3 e il marchio reale;
2. la Home segue sezioni, copy e composizione della sezione 5 e non contiene
   il Meta Explorer;
3. il Meta conserva tutti i filtri, la tabella, «Altro (Brew)», la striscia
   di carte, matchup e metodo, e il percorso Explorer → archetipo → varianti →
   dettaglio variante funziona con i parametri attuali;
4. soglie e stati seguono la sezione 6, compresa la frase «N partite su 30: ne
   mancano M»;
5. le metriche del profilo usano le etichette e le definizioni della sezione
   6;
6. il Draft rispetta l'ordine prodotto → dati → metodo;
7. Il mio MOX ha le cinque schede con i contenuti della sezione 8 e gli stati
   caricamento, non autenticato e vuoto;
8. nessun dato dimostrativo nel sito reale; ogni valore viene dall'API o c'è
   uno stato vuoto o di caricamento;
9. i vecchi link `/#meta` hanno una strategia di compatibilità dichiarata;
10. responsive e accessibilità rispettano le sezioni 9 e 10, senza
    scorrimento orizzontale della pagina;
11. nessun elemento della sezione 14;
12. il confronto visivo con i render della sezione 15 non mostra differenze di
    struttura, gerarchia o codice degli stati.
