# Step 7 — raccolta Draft online e Laboratorio Draft

> **Documento di contratto, con numeri del suo giorno.** Il contratto Draft,
> R2/D1, privacy e tetti restano validi; i conteggi di prove e le frasi sullo
> stato Cloudflare vanno letti come storici. Stato corrente in `LEGGIMI.md`.

Implementato e pubblicato sul Worker il 20/08/2026. Il sito beta è stato poi
pubblicato su Pages; la copia locale può restare non committata fino al
riesame e al commit deliberati.

## Contratto

- `POST /draft`: Draft v1, massimo 4 per richiesta. I pick sono inseriti in
  blocchi da dieci per restare sotto le 50 query per invocazione di D1 Free.
- `PickTwoDraft`: R2 conserva una decisione con due consigli e due scelte;
  D1 la indicizza come due righe carta con numerazione e fase progressive.
- `GET /draft/statistiche`: soli aggregati; 100 pick per percentuale e 30
  match collegati per risultati.
- `POST /contributi/elimina`: elimina partite, Draft e oggetti R2 del
  mittente dopo verifica dello stesso segreto nei due D1; sul server esiste
  solo il suo SHA-256.
- `/salute`: dichiara partite v1/v2 e Draft v1.

Il grezzo compatto va nel binding privato `DRAFT_RAW`, bucket previsto
`moxtracker-draft-raw`. Indici, dimensione, politica, pick e collegamenti alle
partite vanno nel D1 separato `DRAFT_DB`, schema `schema-draft.sql`.

Il Worker rifiuta sequenze incoerenti, carte scelte non offerte, candidati
duplicati, pool impossibili, numeri fuori limite e campi identificativi
vietati. Non espone alcun endpoint R2 pubblico.

## Tetti applicativi

- 30 Draft al giorno per contributore;
- 2.000 al giorno globali;
- 150.000 oggetti e 800.000 scritture al mese;
- 8 GiB conservati; limite dichiarato di 8 milioni di letture R2.

Il raggiungimento di un tetto risponde 429: il client conserva la voce nella
coda. Non esiste attivazione automatica di un piano Cloudflare a pagamento.

## Verifiche locali

- `npm run prove`: **71/71**, compreso Prendi Due, cancellazione coordinata
  dai due D1 e da R2, riconciliazione D1/R2 e guasti parziali simulati senza
  conservare il segreto nei JSON.
- Worker avviato con D1 e R2 simulati: inserimento, lettura aggregati e
  deduplica verificati.
- Gli schemi sono stati applicati anche ai due D1 locali Wrangler: quattro
  tabelle applicative per database, quattro indici Draft e una vista.
- Laboratorio Draft verificato a 1440×1000 e 390×844, senza scorrimento
  orizzontale.
- Tracce grezze non raggiungibili da alcun endpoint pubblico.

## Stato Cloudflare

- D1 partite `moxtracker` migrato senza perdere le 16 partite esistenti;
- D1 `moxtracker-draft-index` creato e inizializzato;
- bucket privato `moxtracker-draft-raw` creato;
- lifecycle `conservazione-24-mesi` attivo a 730 giorni;
- Worker pubblicato su `api.moxtracker.app`, versione
  `995f1c59-8431-44d8-b509-d238643ac7d4`;
- collaudo remoto partita v2 + Draft v1 riuscito e dati sintetici cancellati;
- `/draft/raw` restituisce 404; verifica finale con zero residui D1/R2.

Resta da configurare dal pannello Cloudflare l'avviso di spesa a 1 dollaro.
Commit, push e pubblicazione del sito/Pages restano esclusi.

## Controlli obbligatori prima del deploy

I due D1 sono domini separati: `draft_link` non puo' avere una foreign key
verso `partite`. Il Worker lo crea soltanto dopo la verifica dell'HMAC Arena e
con `INSERT OR IGNORE`, quindi non usa euristiche e non duplica i link.

La cancellazione e' ripetibile: rimuove prima gli oggetti R2, poi le righe
Draft e partite, e toglie gli hash delle credenziali soltanto alla fine. Se un
passo fallisce, la stessa richiesta con lo stesso segreto puo' riprendere il
lavoro. `riconciliaStorageDraft()` confronta metadati D1 e lista R2 senza
leggere o pubblicare i JSON e segnala oggetti orfani, righe senza oggetto e
dimensioni incoerenti. Le prove forzano separatamente `put` R2, batch D1,
cancellazione compensativa, cancellazione utente, HMAC errato e duplicati.

Prima di aumentare la distribuzione restano il primo Draft reale completo e
una riconciliazione amministrativa periodica fra indice D1 e lista R2. Privacy,
lifecycle, invio e cancellazione sintetici sono già stati verificati online.

Il pacchetto Draft ha gia' la versione esplicita `versione: 1`; nuove forme
dei JSON richiederanno una nuova versione accettata dal Worker, senza cambiare
silenziosamente il significato dei campi esistenti.

## Frontend

`sito/draft.html` è il Laboratorio Draft desktop/mobile. Mostra accordo con
Mox, alternative vicine, quattro fasi, politica e aggiornamento. Se il
campione è sotto soglia mostra conteggi e “Dati insufficienti”, mai zero o una
percentuale inventata.
