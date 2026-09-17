# HANDOFF — S3-META-CATALOG-REFRESH — 17 settembre 2026

**Stato:** `S3-A COMPLETATO · S3-B PENDENTE`  
**Decisioni:** `PROPOSED_FOR_REVIEW`

## Repository e branch

### Dennis96/mox-core

- baseline/HEAD S3: `c8079dc40c1325c1314d9f283226ab3be10db21d`
- branch: `chatgpt/s3-meta-catalog-refresh-2026-09-17`
- `meta/standard.json`: non modificato

### Dennis96/moxtracker

- base S3/S2: `d7437da62e7351dcd9d99260c3d3685452dab496`
- HEAD remoto iniziale di S3-A: `6064a63c17f325601cff2482047a235e2deee026`
- branch: `chatgpt/s3-meta-catalog-refresh-2026-09-17`
- il collector S3 era gia' presente sull'HEAD iniziale e non e' stato rieseguito.

## Input privati validati

S3-A ha ricevuto e validato:

- `S3-MANIFEST-PRIVATO-2026-09-17.json`;
- `S3-CANDIDATI-PRIVATO-2026-09-17.json`;
- `S3-CANDIDATI-PRIVATO-2026-09-17.md`.

Questi file restano privati e non sono versionati.

Controlli integrita':

- parametri manifest/report coerenti;
- hash canonico Meta coerente;
- tutti i quattro hash dettaglio coerenti;
- hash canonico corpus coerente;
- quattro liste complete da 60 carte;
- Markdown riproducibile dal report;
- nessuna impronta/decklist privata aggiunta al repository.

L'hash esatto del corpus resta nel manifest privato e nel report della chat del checkpoint.

## Risultato corpus e clustering

Input S3 pubblicabile:

- 4 varianti;
- 149 partite aggregate;
- clustering `main-multiset-radius-v1`, k=4;
- 3 gruppi finali.

Distribuzione aggregata:

- 81 partite / 2 varianti;
- 37 partite / 1 variante;
- 31 partite / 1 variante.

Il gruppo da 81 partite unisce le varianti da 47 e 34 partite a distanza S1 esattamente 4. Le altre due restano singleton. Il risultato riproduce esattamente il report privato quando si usa la distanza S1 canonica (`max` delle eccedenze nei due versi).

Sono presenti inoltre 6 Brew sotto soglia, 49 partite complessive, esclusi correttamente dalla coda S3.

## Diagnostica classificatore corrente

Policy corrente:

- lista: soglia `0.90`, margine `0.03`;
- core: soglia `0.60`, minimo 5 carte, margine `0.20`.

### Gruppo 81 / 2

- primo riferimento nell'ordinamento del collector: Boros Prowess;
- core massimo: 1/8 = 12,5%;
- massima somiglianza lista fra i riferimenti riportati: circa 7,7% (Boros Aggro);
- esito corrente: non classificato / Brew.

### Gruppo 37 / 1

- riferimento principale: Boros Aggro;
- core massimo: 1/8 = 12,5%;
- somiglianza lista massima: circa 7,7%;
- esito corrente: non classificato / Brew.

### Gruppo 31 / 1

- riferimento principale: Orzhov Auras;
- core: 2/8 = 25,0%;
- somiglianza lista: circa 17,0%;
- secondo segnale: Orzhov Skeletons, core 2/8 e lista circa 12,7%;
- esito corrente: non classificato / Brew.

Motivo tecnico comune: nessun candidato raggiunge la soglia lista, la soglia core o il minimo di 5 carte core. Il margine fra archetipi non e' la causa del mancato riconoscimento.

Questo dato non decide A/B/C/D: serve evidenza esterna aggiornata.

## Test S3-A

Validatore mirato sugli artefatti privati: **17/17 PASS**.

Verificati:

- hash/manifest;
- conteggi e soglia;
- 60 carte per lista;
- clustering S1 k=4 esatto;
- classificazioni correnti nulle;
- soglie lista/core/minimo carte;
- determinismo del report Markdown.

Nessun problema reale del collector/classificatore e' emerso, quindi S3-A non ha modificato tool o test.

## S3-B — mandato successivo

Usare gli stessi artefatti privati gia' validati. Non rifare il collector salvo cambiamento esplicito del corpus.

Ordine:

1. preflight robots/termini per `magic.wizards.com`, `mtgaassistant.net`, `aetherhub.com`, `mtgdecks.net` prima di consultare ciascuna fonte;
2. usare solo fonti/canali consentiti dal mandato;
3. ricercare evidenza pertinente separatamente per i 3 gruppi;
4. confrontare strategia/nucleo/lista con il catalogo corrente e con le fonti;
5. proporre A/B/C/D in modo conservativo, senza usare win rate o volume come prova;
6. creare un decision log pubblico sicuro, senza fingerprint, decklist private o mapping tecnico.

La modifica di `mox-core/meta/standard.json`, la rigenerazione del catalogo tracker e il diff classificazioni devono avvenire soltanto dopo che le decisioni sono supportate dalle fonti, in un checkpoint successivo.

## Stop e vincoli

- nessuna ricerca web Meta e' stata eseguita in S3-A;
- nessuna decisione A/B/C/D e' stata assegnata;
- `mox-core/meta/standard.json` non e' stato modificato;
- nessun merge;
- nessun deploy;
- nessun D1 remoto;
- nessuna modifica produzione;
- nessun dato candidato privato committato.
