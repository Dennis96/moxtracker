# moxtracker — tutto il necessario per costruire il sito

> **Specifica storica del 18/08/2026.** È il brief con cui ChatGPT Chat ha
> costruito la prima versione del sito. Le sezioni che dicono che endpoint e
> pagine «mancano» descrivono quel momento e oggi non sono più vere. Per lo
> stato corrente usare [LEGGIMI.md](../../LEGGIMI.md) e
> [DOCUMENTAZIONE.md](../../DOCUMENTAZIONE.md). Regole su privacy, soglie e dati
> restano valide finché un documento corrente non le modifica esplicitamente.

## Cos'è moxtracker, in una frase

Un tracker per **MTG Arena**, come Untapped o 17lands ma costruito sulle
partite di chi usa il programma **Mox**. Mox gira sul PC, registra le partite e
— se l'utente accende l'invio — le manda al server. Il **sito** è la faccia
pubblica: mostra il meta (quanto vince ogni archetipo, chi batte chi), e porta
la gente a scaricare Mox.

**Cosa esiste già (18/08/2026):**
- il server **riceve** partite: `POST https://api.moxtracker.app/partite`, in
  linea, con database D1 (SQLite gestito da Cloudflare);
- Mox **sa spedire**, spento di partenza, col consenso dell'utente;
- **manca tutta la parte di lettura**: nessun endpoint mostra il meta, e non
  c'è nessuna pagina. È questo il lavoro.

## Le tre regole del progetto — valgono anche per il sito

Il progetto è nato da un tool che mostrava numeri falsi. Da lì, tre regole che
**non si negoziano**, e che il sito deve rispettare:

1. **Non inventare numeri.** Ogni percentuale ha accanto **su quante partite**
   è calcolata e **la data**. Sotto soglia non si mostra la percentuale: si
   mostra il conteggio grezzo e «dati insufficienti». Le soglie sono decise:
   **30 partite** per la percentuale di una cella (archetipo × fascia di
   rank), **100 partite** per una coppia della matrice degli scontri.
2. **Niente dati personali in vista.** Il server non ha nomi, non ha IP, non ha
   cookie di tracciamento. Il sito non deve introdurne. L'unico dato personale
   che *esisterà* è l'email di chi fa login con Google/Discord (fase 2), e
   serve solo a legare le partite a un account — non si mostra mai in pubblico.
3. **Un dato dedotto non si spaccia per letto.** Gli archetipi sono **calcolati
   dalle carte**, non dichiarati dagli utenti. Dove le carte non bastano,
   l'archetipo è «non identificato», non un'ipotesi.

Tono: pulito, onesto, niente numeri gonfiati. Il valore è la fiducia.

## Lo schema del database

Tre tabelle. La riga di ogni partita porta le colonne per cercare in fretta,
**più il pacchetto JSON originale intero** in `dato`: così i conti si possono
rifare con regole migliori senza aver buttato via niente.

```sql
CREATE TABLE partite (
  id              TEXT PRIMARY KEY,  -- impronta del match, 10 hex
  mittente        TEXT NOT NULL,     -- numero a caso per installazione, 32 hex
  ricevuta        TEXT NOT NULL,     -- ISO 8601 UTC, quando è arrivata
  quando          TEXT,              -- ISO 8601 UTC, quando è stata giocata
  evento          TEXT,              -- es. "Ladder", "PremierDraft_HOB_..."
  formato         TEXT,              -- "Standard", "Historic"... o NULL (draft)
  esito           TEXT NOT NULL,     -- "vinta" | "persa"
  su_gioco        INTEGER,           -- 1 al gioco, 0 alla risposta, NULL ignoto
  mulligan        INTEGER,
  turni           INTEGER,
  durata          INTEGER,           -- secondi
  giochi          INTEGER,           -- quanti game (Bo3)
  rank_classe     TEXT,              -- "Bronze".."Mythic" o NULL
  rank_livello    INTEGER,
  impronta_mazzo  TEXT,              -- 64 hex: stessa impronta = stesso mazzo
  mox             TEXT,              -- versione di Mox
  arena           TEXT,              -- versione motore di Arena
  versione        INTEGER NOT NULL,  -- versione del formato pacchetto
  dato            TEXT NOT NULL      -- il pacchetto JSON completo
);
CREATE INDEX partite_per_formato ON partite (formato, quando);
CREATE INDEX partite_per_mazzo   ON partite (impronta_mazzo);

CREATE TABLE carte_mazzo (        -- il MIO mazzo, con le copie
  partita TEXT, carta INTEGER, copie INTEGER,
  PRIMARY KEY (partita, carta)
);
CREATE TABLE carte_avversario (   -- solo le carte che l'avversario ha mostrato
  partita TEXT, carta INTEGER,
  PRIMARY KEY (partita, carta)
);
CREATE INDEX carte_mazzo_per_carta       ON carte_mazzo (carta);
CREATE INDEX carte_avversario_per_carta  ON carte_avversario (carta);
```

`carta` è l'**identificativo Arena** della carta (un numero, es. `95861`). Per
il nome e i colori serve una fonte esterna: **Scryfall** (`api.scryfall.com`),
che ha un endpoint per identificatori Arena. Le carte del *mio* mazzo hanno le
copie; dell'avversario c'è solo l'elenco di quelle rivelate.

## Il formato di una partita (il campo `dato`)

Esempio reale di cosa arriva e si conserva:

```json
{
  "versione": 1,
  "partita": "d8e352c369",
  "mittente": "ffffffffffffffffffffffffffffffff",
  "evento": "Ladder",
  "formato": "Standard",
  "mazzo": { "impronta": "a1b2...(64 hex)", "carte": { "95861": 4, "12345": 2 } },
  "avversario": { "carte": [201, 202] },
  "andamento": { "esito": "vinta", "mulligan": 1, "su_gioco": true,
                 "giochi": ["vinta", "persa", "vinta"] },
  "quando": "2026-08-17T18:24:00Z",
  "durata": 517, "turni": 18,
  "rank": { "costruito": { "classe": "Gold", "livello": 3 } },
  "mox": "2 beta 2.7", "arena": "2026.62.1"
}
```

Le chiavi che il log non aveva **mancano** invece di valere zero.

## Come si riconosce un archetipo (il cuore del meta)

Un archetipo è un gruppo di mazzi che giocano le stesse carte. Due strade,
entrambe da fare **sul server** perché servono le carte:

1. **Catalogo noto**: Mox ha un catalogo di archetipi (Standard, Historic...)
   in un altro repository pubblico, `github.com/Dennis96/mox-meta`: ogni voce è
   una lista di carte con un nome. Un mazzo si etichetta contando quante sue
   carte compaiono in una lista. Con le liste **complete** dei mazzi inviati il
   riconoscimento è molto migliore che dalle poche carte viste in partita.
2. **Raggruppamento dal basso** (più avanti): con centinaia di liste complete
   si possono raggruppare i mazzi che si somigliano anche senza catalogo. È
   così che nasce una tier list vera, non copiata.

Per la **prima versione del sito basta la strada 1**, o anche solo mostrare i
mazzi per `impronta_mazzo` con il loro win rate, senza ancora nominare gli
archetipi. Meglio poco e vero che molto e inventato.

## Cosa costruire, in ordine

### Passo A — endpoint di lettura nel Worker (JSON)

Il Worker esiste già (`src/index.js`): aggiunge le rotte GET. Vanno tutte in
sola lettura, con la cache di Cloudflare davanti (il meta cambia lentamente).

- `GET /meta?formato=Standard` → per ogni mazzo/archetipo con **≥30 partite**:
  nome (o impronta se senza nome), partite, vittorie, win rate, quota nel meta.
  Sotto 30: conteggio senza percentuale. Sempre con la data della rilevazione.
- `GET /scontri?formato=Standard` → la matrice: per ogni coppia con **≥100
  partite**, chi vince. Sotto soglia, cella vuota.
- `GET /gioco-risposta?formato=Standard` → win rate al gioco contro alla
  risposta (il dato che Mox già calcola, prezioso e semplice).

Ogni risposta include `{ "partite_totali": N, "aggiornato": "ISO" }` in testa.

### Passo B — la pagina pubblica

Statica, servita da **Cloudflare Pages** (stesso account). Legge i JSON del
passo A. Deve funzionare **senza account**: la tabella del meta è pubblica per
tutti — è la pubblicità del programma.

- una tabella del meta ordinabile, con filtro per **formato** e per **fascia
  di rank**;
- accanto a ogni numero: su quante partite, e la data;
- un invito chiaro a **scaricare Mox** per contribuire;
- design responsive, tema chiaro/scuro. Riferimento visivo: Untapped, ma più
  sobrio.

### Passo C (dopo) — login e dettaglio

Google/Discord per entrare; il filtro fascia di rank, la matrice completa e le
proprie statistiche si sbloccano per chi ha contribuito. Questo introduce
l'**email** come primo dato personale: serve un'informativa privacy vera e la
cancellazione dell'account su richiesta. Non partire da qui.

## Vincoli tecnici

- **Tutto sullo stesso account Cloudflare, piani gratuiti.** Worker + D1 +
  Pages. Nessun costo fisso oltre il dominio.
- **L'indirizzo del server non si tocca**: `api.moxtracker.app` è scritto
  dentro le copie di Mox già distribuite. Il sito sta su `moxtracker.app` (il
  dominio nudo), separato, così si può rifare quando si vuole.
- Le chiavi/segreti stanno nei *secret* di Cloudflare, **mai nei file** del
  repository (che è pubblico).
- CORS è già aperto sul Worker per le GET.

## Come consegnare il lavoro fatto con ChatGPT

ChatGPT produrrà codice (JS per gli endpoint, HTML/CSS/JS per la pagina). Quel
codice va messo nel repository `moxtracker` e provato con le prove che già ci
sono (`npm run prove`) prima di pubblicare. Poi lo rivede Codex, che ha accesso
ai file. **Non pubblicare niente senza le prove verdi**: è la regola da cui è
nato tutto il progetto.
