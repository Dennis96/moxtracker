# S3 — META-CATALOG-REFRESH — 17 settembre 2026

**Stato:** `S3-A COMPLETATO · S3-B PENDENTE`  
**Stato decisioni:** `PROPOSED_FOR_REVIEW`

Questo documento registra soltanto il checkpoint tecnico S3-A: validazione del corpus privato, clustering S1 e diagnostica del classificatore corrente. Non contiene decisioni A/B/C/D e non anticipa la ricerca sulle fonti Meta.

## 1. Baseline e branch

### mox-core

- repository: `Dennis96/mox-core`
- baseline/HEAD S3 al checkpoint: `c8079dc40c1325c1314d9f283226ab3be10db21d`
- branch: `chatgpt/s3-meta-catalog-refresh-2026-09-17`
- `meta/standard.json`: **non modificato**

### moxtracker

- repository: `Dennis96/moxtracker`
- base S3/S2: `d7437da62e7351dcd9d99260c3d3685452dab496`
- HEAD remoto iniziale di S3-A: `6064a63c17f325601cff2482047a235e2deee026`
- branch: `chatgpt/s3-meta-catalog-refresh-2026-09-17`

Il commit `6064a63c17f325601cff2482047a235e2deee026` contiene gia' il collector S3 e la relativa documentazione/test; S3-A non ha ripetuto la raccolta.

## 2. Parametri congelati

- formato: `Standard`
- periodo: `totale`
- cutoff fonti: `2026-09-17`
- soglia pubblicazione vigente: 30 partite
- clustering: `main-multiset-radius-v1`
- k: `4`
- classificatore: lista `0.90`, margine `0.03`; core `0.60`, almeno 5 carte, margine `0.20`
- nessuna modifica a soglie, algoritmo o contratto S1/S2

## 3. Integrita' del corpus privato

Sono stati verificati i tre artefatti privati prodotti dal collector:

- manifest JSON;
- report candidati JSON;
- report candidati Markdown.

Esito:

- parametri manifest/report coerenti;
- SHA-256 canonico della risposta Meta coerente col manifest;
- SHA-256 canonici di tutti i quattro dettagli coerenti col manifest;
- SHA-256 canonico del corpus coerente col manifest;
- quattro decklist pubblicabili complete da 60 carte;
- Markdown riproducibile deterministicamente dal report JSON e dal manifest.

Gli SHA e gli identificativi reali restano negli artefatti privati e non vengono versionati nel repository pubblico.

## 4. Corpus e clustering S1 k=4

La coda S3 contiene:

- **4 varianti Brew pubblicabili**;
- **149 partite aggregate**;
- **3 gruppi candidati** dopo clustering S1 k=4.

Distribuzione aggregata sicura:

| Partite gruppo | Varianti pubbliche |
| ---: | ---: |
| 81 | 2 |
| 37 | 1 |
| 31 | 1 |

Il gruppo da 81 partite e' formato dalle varianti da 47 e 34 partite, a distanza S1 esattamente `4` dal rappresentante. Le altre due varianti restano singleton. Le altre distanze fra rappresentanti/varianti sono superiori a k e non producono fusioni.

Il payload Meta contiene inoltre 6 Brew sotto soglia per 49 partite: non entrano nella coda S3, come previsto dal contratto.

## 5. Diagnostica del classificatore corrente

Tutte le quattro varianti della coda risultano non classificate dal catalogo corrente. La diagnostica dei tre rappresentanti di gruppo e' la seguente.

### Gruppo 81 partite / 2 varianti

- primo riferimento nell'ordinamento diagnostico: **Boros Prowess**;
- core: `1/8 = 12,5%`;
- somiglianza lista di quel riferimento: circa `3,8%`;
- massima somiglianza lista fra i riferimenti riportati: circa `7,7%` (**Boros Aggro**);
- classificazione corrente: `null` / Brew.

### Gruppo 37 partite / 1 variante

- riferimento piu' vicino: **Boros Aggro**;
- core: `1/8 = 12,5%`;
- somiglianza lista: circa `7,7%`;
- classificazione corrente: `null` / Brew.

### Gruppo 31 partite / 1 variante

- riferimento piu' vicino: **Orzhov Auras**;
- core: `2/8 = 25,0%`;
- somiglianza lista: circa `17,0%`;
- secondo segnale vicino: **Orzhov Skeletons**, core `2/8 = 25,0%`, lista circa `12,7%`;
- classificazione corrente: `null` / Brew.

### Motivo tecnico

I candidati restano Brew per un motivo tecnico netto, non per il margine fra due archetipi:

- nessun riferimento raggiunge la soglia lista `0.90`;
- nessun core raggiunge `0.60`;
- i migliori core contengono soltanto 1 o 2 carte su 8, quindi restano anche sotto il minimo di 5 carte.

Questa diagnosi **non** stabilisce se il catalogo sia vecchio, se si tratti di variante nota, nuovo archetipo o vero Brew. Tale decisione richiede S3-B e le fonti esterne consentite.

## 6. Anomalie

Nessuna anomalia del corpus o del clustering S1 e' emersa.

Nota tecnica: l'ordinamento dei `riferimenti_catalogo_vicini` del collector privilegia prima il punteggio core e poi la somiglianza lista. Per questo il primo riferimento mostrato non e' necessariamente quello con la massima somiglianza dell'intera lista. Il comportamento e' coerente con il tool corrente e non altera la classificazione.

## 7. Test mirati S3-A

Validatore locale sugli artefatti privati: **17/17 PASS**.

Copertura del checkpoint:

- parametri manifest/report;
- hash Meta, quattro dettagli e corpus;
- conteggi e soglia di pubblicazione;
- completezza 60 carte delle quattro liste;
- riproduzione esatta del clustering `main-multiset-radius-v1`, k=4;
- classificazione `null` dei rappresentanti;
- verifica che lista/core/minimo carte restino sotto le soglie correnti;
- riproducibilita' del report Markdown.

Non e' stata eseguita ricerca web Meta e non sono stati modificati codice, soglie o catalogo; non e' quindi necessaria una regressione applicativa piu ampia per questo checkpoint documentale.

## 8. Privacy e modifiche

Restano fuori Git:

- fingerprint reali;
- decklist reali;
- manifest privato;
- report candidati JSON/Markdown privati;
- mapping tecnico dei gruppi.

Nessun dato candidato privato e' stato committato.

## 9. S3-B

Il prossimo checkpoint deve partire dagli artefatti privati gia' validati, senza rifare il collector salvo cambio del corpus.

S3-B deve:

1. eseguire il preflight robots/termini delle sole fonti whitelist previste dal mandato;
2. consultare soltanto i canali consentiti;
3. confrontare ciascuno dei 3 gruppi con evidenze Meta aggiornate al cutoff;
4. motivare una proposta conservativa A/B/C/D per ciascun gruppo;
5. produrre un decision log pubblico privo di fingerprint/decklist/dati utente.

S3-B non deve usare volume o win rate come prova di classificazione. Le modifiche a `mox-core/meta/standard.json`, la rigenerazione e il diff prima/dopo restano una fase successiva alla decisione supportata da fonti.

## 10. Operazioni non eseguite

- merge: **NO**
- deploy: **NO**
- D1 remoto: **NO**
- produzione: **NO**
- ricerca fonti Meta: **NO**
- decisioni A/B/C/D: **NO**
- modifica `mox-core/meta/standard.json`: **NO**
