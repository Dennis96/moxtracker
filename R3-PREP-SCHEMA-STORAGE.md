# R3-PREP — schema logico e opzioni di storage

> **Proposta non implementabile prima dell’output R2 concordato.**
> 30 agosto 2026. Solo progettazione, successiva alla correzione locale M6.
> Nessuna scelta di storage è definitiva, compresa la conservazione di un
> payload privato. Nessun SQL eseguibile, migrazione o codice di ingestion.

## Autorità e confine operativo

La fonte normativa è il [contratto R1 congelato](../Codice/MOX-RESEARCH-DATA-CONTRACT.md);
l'[audit R1](../Codice/RESEARCH-TELEMETRY-AUDIT-2026-08-30.md) ne documenta
l'evidenza. Questo documento non modifica né estende quel contratto.
Il [passaggio R2](../Codice/passaggi/PASSAGGIO-R2-TELEMETRIA-LOCALE.md) chiede
`games[]` in memoria e su disco locale, senza invio. La fase client R2 non va
confusa con il servizio di storage Cloudflare R2 citato più avanti.

Base server ispezionata: `main` a `39d56da`, pacchetti accettati v1/v2,
`partite.id` come identità persistita e JSON in `partite.dato`, dal quale il
ricevitore elimina il segreto di cancellazione prima del salvataggio.
Il contratto usa invece il nome logico `id_pubblico`: non si assume che il
futuro trasporto ne mantenga nome o rappresentazione. Il raccordo con
`partita`/`partite.id` va verificato sull'output R2, non inventato qui.

Il modello R2 e il golden packet concordato non sono allegati a questa
proposta e non vengono simulati. Fino al loro confronto restano vietati
modifiche D1 anche locali, migrazioni, ingestion v3, nuovi endpoint, bucket,
binding e modifiche alla produzione. Il loro arrivo consente una revisione
del progetto, **non autorizza automaticamente implementazione o rilascio**.
Anche in seguito consenso, Worker, migrazioni e deploy restano passi distinti.

## Entità logiche e mappatura del contratto

Un match contiene i game osservati; ogni game appartiene a quel match e può
avere una dichiarazione del proprio mazzo e sequenze di eventi propri.
È una relazione logica, non una scelta di tabelle o chiavi fisiche. Un BO3
non genera automaticamente tre record: non si inventano game mancanti.

### Match — cornice esistente

| Campo del contratto | Tipo / nullabile | Significato e provenienza |
|---|---|---|
| `id_pubblico` | stringa / no | Identità anonima del match, DERIVED dal match id tramite SHA-256; raccordo col trasporto da concordare. |
| `quando` | stringa UTC / sì | OBSERVED dal timestamp del log. |
| `durata` | intero, secondi / sì | DERIVED dal primo e ultimo istante osservato, approssimata. |
| `turni` | intero / sì | OBSERVED da `turnInfo.turnNumber`, a livello match. |
| `evento`, `formato` | stringhe / sì | OBSERVED dal contesto dichiarato. |
| `rank` | oggetto / sì | OBSERVED; le derivazioni storiche del server non diventano osservazioni Research. |
| `mazzo` | mappa grpId→copie / sì | OBSERVED dalla lista dichiarata; non sostituisce i mazzi dei singoli game. |
| `avversario.carte` | lista grpId / sì | OBSERVED, soltanto carte già rivelate. |
| `esito` | stringa / sì | OBSERVED dal risultato del match, distinto dai risultati dei game. |
| `arena` | stringa / sì | OBSERVED dalla versione GRE. |
| `apertura` | mappa grpId→copie / sì | Legacy: ultima mano osservata; nessuna conversione in mano tenuta. |
| `games[]` | lista / sì | Relazione con i game effettivamente osservati, struttura nuova del contratto. |

Questa tabella descrive il contratto logico: non rende facoltativi i campi
oggi obbligatori nei pacchetti v1/v2 e non ne modifica la validazione.

### Game, mazzo e cambi di sideboard

| Campo | Tipo / nullabile | Provenienza e vincolo da conservare |
|---|---|---|
| `game_number` | intero / no | OBSERVED da `gameInfo.gameNumber`; distingue i game all'interno del match. |
| `on_play` | booleano / sì | DERIVED dal giocatore attivo al turno 1 e dal proprio seat; non dedotto dall'esito. |
| `mulligans` | intero / sì | OBSERVED da `mulliganCount`: mulligan presi, non carte perse. |
| `free_mulligans` | intero / sì | OBSERVED da `freeMulliganCount`; omissione non trasformata in zero osservato. |
| `mulligan_type` | stringa / sì | OBSERVED, contesto della regola. |
| `opening_hand_kept` | lista grpId / sì | OBSERVED al confine provato; conserva tutte le copie, non un insieme di ID unici. |
| `opening_hand_size` | intero / sì | OBSERVED allo stesso confine; nessuna formula basata su sette carte. |
| `cards_bottomed` | intero / sì | OBSERVED, trasferimenti propri mano→libreria nella finestra di preparazione provata. |
| `result` | stringa / sì | OBSERVED dal risultato con scope game; distinto da `esito` del match. |
| `turni` | intero / sì | OBSERVED per questo game. |
| `deck` | mappa grpId→copie / sì | OBSERVED da `connectResp` per G1 e `submitDeckResp` per i successivi, correlati al game giusto. |
| `sideboard_in[]`, `sideboard_out[]` | liste grpId / sì | DERIVED dalla differenza fra dichiarazione precedente e corrente; conservano le copie. |
| `deck_source` | oggetto / sì | OBSERVED, riferimenti alle dichiarazioni usate; forma precisa da verificare con R2. |
| `state_reset_observed` | booleano / sì | OBSERVED, ripubblicazione dello stato; non prova automaticamente un reconnect. |
| `state_gap_observed` | booleano / sì | OBSERVED dalla catena degli stati; non presume che tutti gli altri campi siano completi. |

La mano tenuta resta assente se non reggono le prove indispensabili del
contratto: preparazione osservata e dichiarata, continuità fino al confine,
ordine certo, primo Play al turno 1, grpId risolti e coerenza delle carte
messe in fondo. L'ottavo controllo sui mulligan si applica solo col contesto
richiesto: «non applicabile» non significa «superato».
La finestra del bottom comprende il primo stato di gioco; i trasferimenti
successivi non sono bottom di preparazione. Il server non ricostruisce queste
prove a partire dalla sola dimensione della mano.

### Eventi propri

| Campo | Tipo / nullabile | Origine OBSERVED |
|---|---|---|
| `draws[]` | lista di `{turno, card_id}` / sì | Trasferimenti propri con categoria `Draw`; ingressi in mano `Put`/`Seek` non diventano pescate. |
| `casts[]` | lista di `{turno, card_id}` / sì | Categoria `CastSpell`, passaggio mano→stack. |
| `lands[]` | lista di `{turno, card_id}` / sì | Categoria `PlayLand`, passaggio mano→campo e tipo terra. |

`turno` e `card_id` sono rispettivamente il numero di turno e il grpId
osservati; la forma e la gestione di eventuali eventi incompleti vanno
confrontate con l'output R2. Non si aggiungono identificativi Arena grezzi al
trasporto per risolvere la deduplicazione. Si preservano ordine e molteplicità
di ciascuna lista, senza inventare un ordine globale fra liste diverse.
Una chiave composta da game, turno, tipo e carta **non basta**: eventi distinti
della stessa carta nello stesso turno non devono essere fusi. L'identità di
una riemissione va concordata con R2; la posizione in lista da sola non prova
l'identità fra due invii diversi.

## Assenze, provenienza e carte

- Campo omesso o `null`: dato sconosciuto, mai normalizzato in `0`, `false`,
  mappa o lista vuota. Una lista vuota esplicitamente dimostrata deve restare
  distinguibile da una lista non osservata. La rappresentazione fisica di
  questa distinzione dipende dal modello reale.
- Il fallimento della prova di un campo non rende inutilizzabili gli altri
  campi dimostrati del game. Nessun riempimento plausibile o fallback dal
  legacy, nemmeno quando `apertura` ha sette carte.
- OBSERVED e DERIVED restano separati; ogni derivazione conserva le fonti.
  Un eventuale zero derivato da `mulligan_type` non sovrascrive un valore
  OBSERVED assente. Nessuna stima ADJUSTED entra in queste entità.
- Mazzo e sideboard vengono dalle dichiarazioni, non dalle carte giocate.
  Il confronto di G3 usa G2, non sempre G1. Ambiguità nella dichiarazione
  significa dato sconosciuto, non selezione arbitraria di una lista.
- grpId e copie originali rimangono recuperabili. Qualunque identità
  normalizzata è separata e riporta fonte e versione del mapping; un mapping
  non risolto resta sconosciuto. Non si assume una rimappatura interna al
  match non dimostrata dall'audit.
- Nessuna mano, libreria, pescata o evento privato dell'avversario. Il suo
  contributo resta limitato a `avversario.carte` già rivelate.

## Opzioni di storage — nessuna scelta definitiva

| Opzione da valutare | Vantaggio progettuale | Cosa misurare o risolvere prima della scelta |
|---|---|---|
| D1: entità per game/evento e possibile JSON privato | Collegamenti e query nello stesso archivio; possibile ricostruzione dal payload conservato. | Dimensioni reali, righe/eventi per match, indici utili, duplicazione fra JSON e proiezioni, costo delle query e cancellazione. |
| D1: indice/proiezioni; possibile payload in Cloudflare R2 privato | Separazione fra ricerca e conservazione dei payload. | Volume e frequenza degli accessi, coerenza fra oggetto e indice, scritture parziali, retry, oggetti orfani, export e cancellazione su entrambi. |

La conservazione integrale del payload è essa stessa da motivare: servono
scopo, minimizzazione, contenuto ammesso, accessi e retention concordati.
Un eventuale payload deve escludere segreti e dati proibiti, come già avviene
per il segreto di cancellazione; «privato» non autorizza a conservare tutto.
Non vengono stabiliti database dedicati, nomi di tabelle, bucket o binding.

Prima della decisione misurare gli output reali BO1/BO3: byte serializzati per
match e batch, numero di game/eventi, proiezioni e indici ipotizzati. Il limite
attuale è 256 KiB per richiesta e 200 partite per batch; qui non viene alzato.
La stima R1 di circa 536 byte per game **non è una misura del futuro packet**
e non consente di scegliere storage o limiti. Nessun costo viene inventato;
eventuali stime successive dovranno dichiarare volumi, tariffe verificate e
data. Non si riusano per Research i bucket Draft, ticket o release esistenti.

## Requisiti per una futura implementazione

- Compatibilità: v1/v2 e dati storici restano leggibili e invariati; nessun
  `games[]` sintetico e nessun alias del legacy. La futura versione del
  trasporto e il trattamento di match già presenti richiedono un accordo;
  l'attuale `INSERT OR IGNORE` non dimostra una politica di aggiornamento.
- Idempotenza: retry dello stesso invio senza doppio conteggio; eventi reali
  ripetuti conservati. Conflitti, output parziali e completamenti successivi
  non si risolvono sommando o sovrascrivendo in modo implicito.
- Accesso: autorizzazione per match e dispositivo/account applicata anche a
  game, eventi ed eventuali payload; nessuna nuova esposizione pubblica.
- Export e cancellazione: copertura di tutte le rappresentazioni, incluse
  copie, proiezioni ed eventuali oggetti; cancellazione ripetibile senza
  ricreare dati da retry tardivi. La revoca del consenso non va confusa con
  la cancellazione dei contributi o con la revoca del dispositivo.
- Retention: finalità e durate da concordare per ogni rappresentazione, senza
  ereditare automaticamente i 730 giorni del Draft o le policy dei ticket.
- Consenso: nessun dato nuovo inviato con il consenso vecchio implicito;
  versione e schermata esplicita prima dell'invio, secondo il contratto.
  Nessuna modifica alla schermata o al protocollo in questa attività.

## Matrice di verifica futura e gate

Questi sono scenari da confrontare con R2, **non test di ingestion già scritti
o superati**. Distinguere sempre golden output da log reali e controesempi
sintetici; una fixture costruita a mano non dimostra un evento Arena.

| Scenario | Criterio da verificare dopo R2 |
|---|---|
| BO1 completo e BO3 di due/tre game | Confini corretti, esiti match/game distinti, nessun game inventato. |
| Sideboard G2 e G3, stampe diverse | Liste dichiarate corrette, differenze rispetto al game precedente, copie e grpId preservati. |
| Mulligan gratuiti o contesto assente | Nessuna formula `7 - mulligans`; controlli non applicabili distinti dai superati. |
| Log iniziato tardi, salto di stato, ordine incerto | Mano tenuta/bottom sconosciuti quando non provati; altri dati conservati. |
| Reset e riavvio del lettore | Nessuna inferenza automatica di reconnect; verifica dell'identità del game su output reale. |
| Riemissione e due eventi uguali ma distinti | Retry non moltiplicati; eventi reali non fusi, anche nello stesso turno. |
| Assente, `null`, zero/false/vuoto espliciti | Distinzioni conservate attraverso storage, lettura ed export. |
| Legacy presente, assente o di sette carte | Nessuna conversione in `opening_hand_kept`; v1/v2 invariati. |
| Account diversi, export e cancellazione | Nessuna lettura incrociata; copertura di dati e payload, se previsti. |
| Batch grandi e guasti parziali | Limiti derivati da misure, retry sicuri, nessun oggetto o record orfano. |

Per riesaminare questa proposta servono: output reale del modello locale R2,
golden fixture e golden packet concordato (forma, origine e versione
esplicite, senza pretendere invio v3 da R2), esiti delle verifiche e dimensioni
misurate. Restano da decidere identificativi, rappresentazione delle assenze e
della provenienza, identità degli eventi, storage, eventuale payload,
retention, consenso e versione futura del trasporto. Un disaccordo col
contratto si espone e si risolve con la sua procedura di revisione, non si
corregge silenziosamente nel server.

La chiusura di R3-PREP attesta soltanto questa consegna documentale. Lo stato
operativo e le verifiche locali M6 restano in
[STATO-CORRENTE-SITO.md](STATO-CORRENTE-SITO.md), unica fonte operativa del sito.
