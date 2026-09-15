# S1 — Brew quasi uguali: contratto B1 e report

Scritto il 15 settembre 2026 sul branch `claude/s1-brew-backend-2026-09-15`,
dalla baseline `main` `75bcac4`. **Solo codice, prove e migrazione locale:**
nessun merge, nessun deploy Worker o Pages, nessuna migrazione o query D1
remota, nessun cambiamento a `mox-core`, Research o `sito/**`. Il frontend
resta quello di prima: `npm run sito:build` produce la stessa build della
preview (`346ce2023c50e91c`, 91 file).

Implementa B1 di [PROSSIMI-SVILUPPI-SITO-2026-09-14.md](PROSSIMI-SVILUPPI-SITO-2026-09-14.md).
F1/S2 (il sito che mostra i gruppi) resta un lavoro separato.

## 1. Cosa c'era prima (caratterizzazione)

- `impronta_mazzo` la calcola Mox (`statistiche_partite.py`): SHA-256 di
  `ArenaId:copie` del **solo main deck**. Il pacchetto legacy manda soltanto
  il main deck, quindi il sideboard **non esiste** nei dati del server legacy
  (`carte_mazzo` ha una riga per carta del main). La stessa lista con stampe
  diverse, per esempio terre base con un'altra illustrazione, ha ArenaId e
  quindi impronta diversi.
- Formato: colonna `partite.formato`, confrontata esattamente.
- BO1/BO3 non sono una proprieta' della lista ma della partita: `modalita=BO3`
  filtra gli eventi `%traditional%`. La stessa impronta puo' avere partite in
  entrambe. Senza `modalita` le partite si sommano per impronta.
- Pubblicabile: una lista con almeno 30 partite **nel filtro corrente**
  (`SOGLIA_META`, `decklistPubblicabile`).
- Classificazione: per impronta, dalle carte, con il catalogo del formato. Un
  formato senza catalogo manda tutto in «Altro (Brew)».
- Ogni impronta non classificata era un Brew separato. Nel Meta pubblico del
  15/09 i Brew #1 e #3 (45 e 34 partite in totale) condividono 56 carte su
  60.

## 2. La decisione dell'utente (15/09)

Prima di implementare l'utente ha chiesto se 4 carte non siano poche, con due
Brew dello stesso nucleo Orzhov (Brew #2 e #4). Misura: 32 carte di distanza
per ArenaId, 25 per nome, 12 sulle sole magie. Le differenze sono soprattutto
nella base di mana (doppie contro base e Guildgate) e in una decina di magie.

**Scelta: S1 raggruppa le quasi-copie (varianti); le famiglie restano al
catalogo.** Due mazzi come questi sono un archetipo nel modello del progetto
(nucleo di carte caratteristiche) e si uniscono quando quel nucleo entra nel
catalogo con il refresh curato della
[roadmap](META-CATALOG-REFRESH-ROADMAP-2026-09-13.md), mai per promozione
automatica. Alzare k sulla lista intera fino a ~25 unirebbe anche mazzi
diversi che condividono le terre.

## 3. Distanza

Firma: il main deck come multinsieme **nome carta → copie**
(`CATALOGO_ARCHETIPI.id_a_nome`; una carta senza nome resta `#ArenaId`).
Stampe diverse della stessa carta sono la stessa carta. Le terre restano
dentro, base comprese.

```text
d(A,B) = max( Σ max(0, A_i − B_i), Σ max(0, B_i − A_i) )
```

59/60 in comune → 1; 56/60 → 4. E' una metrica (vale la disuguaglianza
triangolare), quindi un gruppo di raggio k ha diametro al massimo 2k. Input
non valido (righe vuote, ArenaId o copie non interi positivi, piu' di 250
carte) → `FirmaNonValida`: la lista resta fuori dai gruppi, mai nel gruppo
sbagliato.

Modulo: `src/brew-clustering.js` (puro, senza database).

## 4. Gruppi a raggio (stella)

- Ogni membro sta entro k dal **rappresentante**, scelto alla nascita del
  gruppo e mai piu' cambiato (i trigger rifiutano ogni UPDATE).
- Nessuna catena: A~B e B~C non uniscono A e C, a meno che entrambi siano
  entro k dallo stesso rappresentante.
- Ordine di elaborazione fisso, indipendente dall'input: partite totali
  decrescenti, poi impronta. Il primo candidato che non sta in nessun gruppo
  ne fonda uno e ne diventa il rappresentante.
- Un candidato nuovo va nel gruppo col rappresentante piu' vicino; a parita'
  di distanza, nel gruppo nato prima (`ordine`). Nessun gruppo entro k → un
  gruppo nuovo.
- Il primo backfill e' lo stesso algoritmo con zero gruppi esistenti.
- Nome dell'algoritmo: `main-multiset-radius-v1`, k = 4. Cambiare distanza,
  k o rappresentante vuol dire un nome nuovo e gruppi nuovi: i gruppi v1 non
  si riscrivono.
- Un refresh del catalogo che riconosce un membro lo toglie dall'output Brew
  al momento della lettura; la sua appartenenza resta.
- I trigger congelano gli UPDATE, non i DELETE: la cancellazione dei
  contributi deve poter togliere i dati (§8, «Cancellazione»).
- Se il rappresentante perde l'ultima partita per una cancellazione, il
  gruppo si smonta. Non si sceglie un altro centro sul posto, perche' romperebbe
  il raggio e la storia del gruppo. Se le sue carte mancano per altre vie, il
  piano non lo usa come centro (`gruppi_orfani` nel report).

## 5. k = 4: report e motivazione

Fixture sintetiche (`prove/fixtures/brew-sintetici.js`, ArenaId inventati):

| Caso | Distanza | k=3 | k=4 | k=5 |
|---|---:|---|---|---|
| 59/60 | 1 | unito | unito | unito |
| 56/60 (il caso del collaudo) | 4 | separato | **unito** | unito |
| 55/60 | 5 | separato | separato | unito |
| 61 carte contro 60 (una copia in piu') | 1 | unito | unito | unito |
| 40 carte contro 60 | 20 | separato | separato | separato |
| Stesso colore, nucleo diverso | 36 | separato | separato | separato |
| 24 terre e 8 magie generiche in comune | 28 | separato | separato | separato |
| Stessa lista, stampe diverse delle base | 0 (20 per ArenaId) | unito | unito | unito |
| Catena A–B = 4, B–C = 4, A–C = 8, centro A | — | C fuori | C fuori | C fuori |
| Stessa impronta in BO1 e BO3 | — | un solo membro | un solo membro | un solo membro |

Corpus pubblico Standard del 15/09, letto in sola lettura da `/meta` e
`/archetipo` di `api.moxtracker.app`: le 4 liste Brew pubbliche e la variante
pubblica di Mono White Auras, ricostruite in un SQLite temporaneo fuori dal
repository e passate a `strumenti/brew_gruppi.mjs --report`. Nel repository
non c'e' nessuna di queste liste.

| | k=3 | k=4 | k=5 |
|---|---:|---:|---:|
| Candidati (Brew da 30 partite) | 4 | 4 | 4 |
| Liste riconosciute escluse | 1 | 1 | 1 |
| Gruppi | 4 | 3 | 3 |
| Singleton | 4 | 2 | 2 |
| Dimensioni | 4×1 | 1×2 + 2×1 | 1×2 + 2×1 |
| Liste che cambiano gruppo | — | 2 (da k=3) | 0 (da k=4) |

Distanze per nome fra le 4 liste: 4, 25, 51, 51, 57, 57. **Prima:** 4 Brew
separati (45, 36, 34, 31 partite). **Dopo, k=4:** 3 gruppi (79 = Brew #1 +
#3, poi 36 e 31). Le partite di «Altro (Brew)» restano 187: 146 nei gruppi e
41 nelle 5 liste sotto soglia.

**Perche' 4.** E' il k minimo che unisce il caso noto, non produce falsi
raggruppamenti nelle fixture, e sul corpus reale k=5 non cambia niente,
perche' dopo il 4 la distanza successiva e' 25. E' coerente con il livello
«variante» del classificatore (90% di carte in comune, cioe' 4–6 differenze
su 40–60 carte non base). Il corpus pubblico e' piccolo: la scelta e' la piu'
conservativa compatibile con fixture e caso noto, non un'evidenza statistica
forte.

## 6. BO1, BO3 e vista senza `modalita`

**Identita' per `(formato, algoritmo, impronta)`, conteggi per filtro.** La
modalita' e' un filtro sulle partite, come rank e periodo: non entra
nell'identita'.

1. Nessun conteggio mescola BO1 e BO3: in `modalita=BO1` un gruppo somma solo
   partite BO1.
2. Nessun doppio conteggio: un'impronta appartiene a un solo gruppo.
3. Nella vista combinata un'impronta compare una volta sola, con le partite
   delle due modalita' sommate, come prima.
4. Lo stesso gruppo ha lo stesso id in ogni filtro: l'identita' non dipende
   dal filtro.
5. La vista senza `modalita` e' provata (`brew-meta.test.js`).
6. Il frontend attuale legge solo i campi di prima.

Due main deck BO1 e BO3 a distanza ≤ 4 finiscono nello stesso gruppo: sono
la stessa lista entro quattro carte, e i conteggi restano separati per
modalita'. E' lo stesso comportamento degli archetipi riconosciuti.

## 7. Identificativi

- `gruppo_brew_id` = `bg_` + 32 esadecimali casuali (128 bit,
  `crypto.getRandomValues`), `variante_id` = `bv_` + 32. Generati dal server,
  salvati, mai ricavati dall'impronta: lo stesso backfill su due database
  produce identificativi tutti diversi.
- Generatore iniettabile nelle prove.
- Vincoli nel database: PK del gruppo, `variante_id` UNIQUE,
  `PRIMARY KEY (formato, algoritmo, impronta)` per il membro,
  `UNIQUE (formato, algoritmo, ordine)` e `UNIQUE (formato, algoritmo,
  rappresentante)` per il gruppo, chiave esterna composta sullo stesso
  formato e algoritmo, CHECK sul formato degli id, trigger contro gli UPDATE
  (il DELETE resta ammesso di proposito).
- **Stabilita' degli id durante il normale funzionamento; la cancellazione dei
  dati e' un'eccezione privacy che puo' invalidare un gruppo.** Se una
  cancellazione toglie l'ultima partita del rappresentante, `bg_` e i `bv_`
  del gruppo spariscono; i membri superstiti ricevono id nuovi al giro
  successivo del cron.
- Il vecchio `variante_id` del percorso `?impronta=` (primi 12 caratteri
  dell'impronta) resta com'era. I nuovi id stanno nei campi nuovi
  (`variante_id` dentro `gruppi_brew` e `?id_brew=`, `variante_brew_id` nel
  percorso legacy).

## 8. Privacy: threat model

Baseline invariata: decklist, impronta, V/S e win rate di una lista escono
solo da 30 partite nel filtro. «Altro (Brew)» non pubblica il record finche'
c'e' una lista sotto soglia, e `/gioco-risposta` non ha vittorie.

Il rischio nuovo di S1: «questa lista sotto soglia somiglia a quella
pubblica». Per il gruppo, sapere che una lista con 12 partite e' entro 4 carte
da una lista pubblica vuol dire conoscerne quasi tutta la decklist.

**Fallback conservativo, adottato:**

1. **Candidata ai gruppi e' solo una lista che ha gia' 30 partite nel
   formato**, sommando periodi, modalita' e rank: la stessa soglia che rende
   pubblica la sua decklist nella vista `periodo=totale`. Una lista sotto
   soglia non entra in nessun gruppo, e la struttura dei gruppi non dice
   niente di lei.
2. **Un gruppo pubblica soltanto le varianti che arrivano a 30 partite nel
   filtro corrente.** Partite e record del gruppo sono la somma di quelle
   varianti, gia' pubbliche una per una. Le liste sotto soglia restano nel
   solo `brew_sotto_soglia` globale di prima: nessun `brew_sotto_soglia` per
   gruppo.
3. La distanza dal rappresentante esce solo se anche il rappresentante e'
   pubblico nella stessa risposta.
4. Un gruppo senza varianti pubblicabili nel filtro non esiste per l'API:
   `?id_brew=` risponde con lo stesso 404 di un id mai creato, identico anche
   via HTTP.

| Caso | Esito (provato) |
|---|---|
| 29 + 1 | nessun gruppo; `brew_sotto_soglia` {2, 30}; nessuna impronta nuova |
| 20 + 20 | nessun gruppo; {2, 40}; record di Altro non pubblico |
| 30 + 29 | gruppo con la sola lista da 30; la 29 non e' membro e non compare |
| Gruppo tutto sotto soglia nel filtro | assente da `/meta`; `?id_brew=` 404 indistinguibile |
| Gruppo misto | solo le varianti pubbliche; nessuna distanza verso un centro nascosto |
| Gruppo tutto pubblico | record del gruppo = somma delle sue varianti |
| Sottrazioni | gruppo − varianti = 0; Altro − gruppi = `brew_sotto_soglia` (come prima) |
| Filtri rank, periodo, modalita' | una variante sotto soglia nel filtro non porta fuori impronta ne' id |
| `/gioco-risposta` | invariato, senza vittorie |
| `?impronta=` sotto soglia | 404 identico all'impronta inesistente, come prima |

Residui accettati e documentati:

- Due varianti pubbliche nello stesso gruppo con il rappresentante nascosto
  nel filtro dicono che esiste una terza lista vicina a entrambe. Quella lista
  ha 30 partite in totale, quindi e' pubblica nella vista `periodo=totale`.
- Una lista scesa sotto 30 partite dopo una cancellazione, ma che ne ha
  ancora qualcuna, resta membro. Esce da ogni risposta come ogni lista sotto
  soglia.
- Le «Altre varianti» degli archetipi riconosciuti restano come prima
  (decisione separata, roadmap).

**Cancellazione dei contributi** (delta del 15/09). La pagina privacy promette
che «Cancella dal sito partite e Draft» toglie i contributi dai database: dopo
una cancellazione completata non resta stato Brew senza partite dietro.

- Si toccano i due percorsi che cancellano partite: `eliminaMittente`
  (`/contributi/elimina` e cancellazione dell'account) e la sezione «partite»
  dell'account.
- Nello **stesso batch atomico** delle DELETE delle partite, e prima delle
  credenziali, tre DELETE basate sullo stato vero dopo la cancellazione:
  1. i membri la cui `(formato, impronta)` non ha piu' partite;
  2. le membership dei gruppi il cui rappresentante non ha piu' partite;
  3. quei gruppi.
- **Membro cancellato:** sparisce; il gruppo e il suo id restano.
- **Rappresentante cancellato:** il gruppo si smonta. Le partite dei membri
  superstiti restano, e il prossimo giro del cron le raggruppa di nuovo con id
  nuovi. Nella cancellazione non si rifa' nessun clustering.
- **Impronta condivisa:** finche' un altro mittente ha partite della stessa
  `(formato, impronta)`, membership e gruppo restano.
- **Retry:** il batch e' atomico, quindi un guasto annulla tutto, credenziali
  comprese, e la richiesta si ripete. Se la risposta si perde dopo il commit,
  le credenziali ci sono ancora e il retry chiude senza doppioni. La pulizia
  non dipende dalla lista delle partite del mittente: un retry trova e toglie
  gli orfani anche se le partite erano gia' sparite. Le credenziali cadono
  solo dopo.
- Il cron ripassa la stessa pulizia prima di assegnare, e ogni apply (cron o
  strumento) la ripete in coda al proprio batch. Cosi' una cancellazione che
  arriva fra la lettura del piano e il batch non lascia orfani: D1 esegue i
  batch uno alla volta. Con le tabelle Brew assenti la cancellazione resta
  quella di prima.
- Dopo la cancellazione, il vecchio `?id_brew=` e la vecchia `?impronta=`
  rispondono come se non fossero mai esistiti.

## 9. Contratto API (additivo)

### `/meta`

La riga «Altro (Brew)» conserva **tutti** i campi di prima (`varianti_brew`,
`brew_sotto_soglia`, `record_pubblico`, `impronte_raggruppate`, …), identici
byte per byte in ogni filtro con o senza gruppi. In piu' (valori dello
scenario di `brew-meta.test.js`, 179 partite nel filtro):

```json
"raggruppamento_brew": { "algoritmo": "main-multiset-radius-v1", "soglia_distanza": 4, "disponibile": true },
"gruppi_brew": [
  {
    "etichetta": "Brew #1",
    "tipo_dettaglio": "brew_group",
    "gruppo_brew_id": "bg_…",
    "in_attesa_di_raggruppamento": false,
    "algoritmo": "main-multiset-radius-v1",
    "soglia_distanza": 4,
    "partite": 79, "vittorie": 47, "sconfitte": 32,
    "record_pubblico": true, "dati_sufficienti": true,
    "win_rate": 59.49, "quota_meta": 44.13,
    "varianti_brew": [
      { "variante_id": "bv_…", "impronta": "…", "partite": 45, "vittorie": 27, "sconfitte": 18,
        "dati_sufficienti": true, "win_rate": 60, "quota_meta": 25.14,
        "decklist_pubblicabile": true, "rappresentante": true, "distanza_rappresentante": 0 }
    ]
  }
]
```

- Una lista pubblica non ancora assegnata (cron spento o non ancora passato)
  e' un gruppo a se' con `gruppo_brew_id: null`,
  `in_attesa_di_raggruppamento: true` e `variante_id: null`.
- `disponibile: false` vuol dire tabelle assenti (Worker deployato prima della
  migrazione): i campi legacy restano identici.
- Somme garantite: Σ `gruppi_brew[].partite` + `brew_sotto_soglia.partite` =
  `partite` di Altro; le liste in `gruppi_brew` sono esattamente quelle di
  `varianti_brew`.
- `etichetta` numera i gruppi e puo' non coincidere con le etichette delle
  varianti legacy: la presentazione la decide S2.

### `/archetipo?id_brew=bg_…`

- Stessi filtri di sempre (`formato`, `rank`, `periodo`, `modalita`).
- Risposta con `tipo_dettaglio: "brew_group"`, `gruppo_brew_id`, `algoritmo`,
  `soglia_distanza`, e le sole varianti pubblicabili nel filtro, ognuna con
  decklist, `variante_id` opaco, `rappresentante` e
  `distanza_rappresentante`.
- `varianti_osservate` conta solo quelle; `altre_varianti` e' null.
- Errori:
  - id malformato o combinato con `id`/`impronta` → 400;
  - gruppo inesistente o senza varianti pubblicabili → 404 identico;
  - formato senza catalogo → 409, come il percorso `?impronta=`.
- Nessun redirect lato API.

### `/archetipo?impronta=` (legacy, da mantenere almeno una release)

Invariato. Per una lista non classificata pubblicabile aggiunge
`gruppo_brew_id` e `variante_brew_id` (null se non ancora assegnata), cosi'
S2 puo' portare i vecchi link a `id_brew` lato sito. `?id=` degli archetipi
riconosciuti non cambia di un campo.

## 10. Persistenza e operazioni

- Migrazione additiva `migrazioni/2026-09-15-brew-gruppi.sql`: due tabelle,
  un indice e due trigger. Lo stesso blocco sta in `schema.sql`, prima di
  Research; una prova pretende che coincidano e che la migrazione sia
  ripetibile.
- Provata su SQLite (`node:sqlite`) e su **D1 locale di Wrangler 4.123**
  (`--local --persist-to` in una cartella temporanea): schema della baseline,
  poi migrazione due volte, oggetti creati e UPDATE rifiutato con
  `SQLITE_CONSTRAINT_TRIGGER`. Mai `--remote`.
- Backfill e assegnazione (`src/brew-gruppi.js`) separano cinque passi:
  motore puro, lettura candidati, piano (dry-run), apply in un batch unico,
  assegnazione dei nuovi membri. Nessuna scrittura parte da una GET (provato
  intercettando ogni SQL delle GET).
- Strumento locale `strumenti/brew_gruppi.mjs`: apre solo un file SQLite
  locale, in sola lettura senza `--apply`. Per applicare servono
  `--apply --conferma=APPLICA-GRUPPI-BREW-LOCALI` e solo k=4. Con `--report`
  confronta k=3/4/5. Non stampa impronte e non chiama mai Wrangler.
- Nuovi membri in produzione: il cron giornaliero chiama
  `assegnaBrewProgrammato`, **spento** finche' la variabile `BREW_GRUPPI` non
  vale `"on"` (non e' in `wrangler.toml`). Tetto: 50 candidati per giro in
  tutto, cioe' al massimo circa 100 righe scritte e un batch per formato. Con
  tabelle assenti non fa niente.
- Limiti D1 verificati sulla documentazione Cloudflare: 100 parametri per
  query (le query S1 usano sottoquery, mai liste di parametri), 1000 query
  per invocazione su Workers Paid, batch atomico con rollback dell'intera
  sequenza.

Ordine per la produzione, ognuno con il suo mandato:

1. migrazione remota additiva;
2. deploy del Worker (legge i gruppi; senza tabelle risponde come prima);
3. `BREW_GRUPPI = "on"`: il primo giro del cron fa il backfill, i successivi
   assegnano le liste che arrivano a 30 partite;
4. S2 sul sito.

Rollback: togliere `BREW_GRUPPI`; le tabelle possono restare, perche' le
letture le usano solo per i campi nuovi.

## 11. Condizioni aperte (non bloccanti)

- **Trigger su D1 remoto:** la pagina ufficiale delle istruzioni SQL di D1
  elenca `PRAGMA recursive_triggers`, quindi i trigger fanno parte del motore;
  su D1 locale la migrazione passa, l'UPDATE viene rifiutato e le DELETE di
  pulizia funzionano. La prova sul database remoto resta nel mandato della
  migrazione. Il codice non fa mai UPDATE: i trigger sono una difesa in piu',
  non la base della correttezza.
- **Nomi delle carte:** vengono da `id_a_nome` del catalogo generato. Una
  carta che il catalogo non nomina resta `#ArenaId`, quindi le sue stampe
  diverse non si unificano: in quel caso il raggruppamento e' piu' prudente,
  non meno. Nei formati senza catalogo `?id_brew=` risponde 409, come
  `?impronta=`, anche se `/meta` mostra i gruppi.
- **S2/F1:** il sito legge ancora solo i campi legacy.
- **Famiglie Brew:** le gestisce il refresh del catalogo, non S1.

## 12. Prove

- `prove/brew-clustering.test.js`: 17 prove sul motore puro.
- `prove/brew-gruppi.test.js`: 13 prove su schema, vincoli, backfill,
  idempotenza, retry, concorrenza, nuovi membri, catalogo, limite, costo di
  lettura di un giro, cron e strumento.
- `prove/brew-cancellazione.test.js`: 11 prove sulla cancellazione, compresa
  una che arriva fra il piano e il batch del cron:
  - membro;
  - rappresentante e nuovo raggruppamento;
  - impronta condivisa;
  - retry con guasto, commit senza risposta e partite gia' sparite;
  - `?id_brew=` e `?impronta=` dopo la cancellazione;
  - sezione «partite» dell'account;
  - tabelle assenti;
  - cron;
  - DELETE ammesso e UPDATE congelato.
- `prove/brew-meta.test.js`: 12 prove sulle letture pubbliche: compatibilita',
  conteggi in 12 filtri, BO1/BO3, `?id_brew=`, legacy, privacy, nessuna
  scrittura nelle GET, tabelle assenti e frontend attuale.
- `npm run prove`: tutta la suite verde, esito nel file di stato.
- `npm run sito:build`: build `346ce2023c50e91c`, identica alla preview.
