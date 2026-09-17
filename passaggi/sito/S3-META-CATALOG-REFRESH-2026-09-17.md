# S3 — META-CATALOG-REFRESH — 17 settembre 2026

**Stato review:** `PROPOSED_FOR_REVIEW`  
**Esito tecnico della run:** `FAIL / BLOCKER — INPUT CANDIDATI REALI NON DISPONIBILE`

Questa run si e' fermata alla stop condition dati prevista dal mandato, prima
di qualsiasi modifica a `mox-core/meta/standard.json`. Il blocco non dimostra
che non esistano Brew Standard pubblici: dimostra soltanto che, in questa
sessione, non e' stato possibile ottenere il corpus reale autorizzato necessario
a prendere decisioni S3.

## 1. Baseline verificate live

### mox-core

- repository: `Dennis96/mox-core`
- `main`: `c8079dc40c1325c1314d9f283226ab3be10db21d`
- branch S3: `chatgpt/s3-meta-catalog-refresh-2026-09-17`
- base branch S3: lo stesso SHA di `main`
- `meta/standard.json`: Git blob `259bbeba19bb4b4af9515604bf3e60e715fb6387`
- intestazione catalogo: formato `Standard`, `aggiornato = 2026-08-17`
- la nota canonica dichiara 26 liste di riferimento: 17 BO1 e 9 BO3.

### moxtracker

- repository: `Dennis96/moxtracker`
- `main`: `75bcac460b13e0556a48d8ccb44dde431e3241fd`
- base S3: `claude/s2-brew-frontend-2026-09-16`
- HEAD base S3: `d7437da62e7351dcd9d99260c3d3685452dab496`
- branch S3: `chatgpt/s3-meta-catalog-refresh-2026-09-17`
- `src/catalogo-archetipi-generato.js`: Git blob
  `5f47548824671347c0697f8d924964c38ae23ef5`

Catena S1/S2 verificata:

- `17a3ca0 -> 8a3cfe7`: solo report di review indipendente S1;
- `8a3cfe7 -> d7437da`: solo frontend/test/documentazione S2;
- nessuna sorpresa nel backend S1 lungo questo delta.

## 2. Parametri congelati

- formato: `Standard`
- cutoff fonti: `2026-09-17`
- soglia decklist: quella pubblica vigente, 30 partite
- clustering: `main-multiset-radius-v1`
- k: `4`
- stato decisioni: `PROPOSED_FOR_REVIEW`
- frequenza: run manuale una tantum
- nessuna modifica a soglie/classificatore/contratto S1/S2

## 3. Baseline catalogo e strumenti

Il classificatore server usa:

- variante quasi identica: somiglianza lista `>= 0.90`, con margine `0.03`;
- archetipo da core: `core_soglia = 0.60`, almeno 5 carte, margine `0.20`.

Il generatore canonico e' `strumenti/genera_catalogo_archetipi.py` e produce
`src/catalogo-archetipi-generato.js` a partire da `mox-core/meta/standard.json`
piu' il database carte locale di MTG Arena.

La rigenerazione baseline **non e' stata eseguita** in questa sessione: il
runner disponibile non possiede il checkout locale completo con il database
carte Arena richiesto dal generatore. Non viene quindi dichiarata una prova di
determinismo che non e' stata realmente eseguita.

## 4. Canale candidati e stop condition

Ordine provato:

1. **API pubblica read-only MOX** prevista dal mandato:
   `GET /meta?formato=Standard&periodo=totale`, seguita soltanto dai dettagli
   legacy delle impronte gia' pubblicate.
2. **Export autorizzato locale/Project/Library**: ricerca mirata di export Brew,
   manifest S3 e corpus sanitizzati.

Esito:

- il runtime web di questa sessione non consente di aprire direttamente
  `api.moxtracker.app` se l'URL non proviene da un risultato web indicizzato;
  il dominio/API non e' indicizzato dal motore usabile qui;
- nessun export candidato sanitizzato e autorizzato e' risultato disponibile
  nei file della conversazione/Project/Library;
- i dati reali S1 del 15/09 documentano un caso storico reale, ma non includono
  qui un corpus S3 completo e congelato riutilizzabile al cutoff 17/09;
- nessun D1 remoto, endpoint admin, enumerazione sotto soglia o workaround e'
  stato tentato.

Conseguenza: **stop tecnico prima di modificare il catalogo**, come richiesto.

## 5. Tool locale preparato

Aggiunto:

`strumenti/s3_candidati_pubblici.mjs`

Scopo:

1. esegue solo GET pubbliche su `api.moxtracker.app`;
2. legge solo le impronte gia' presenti in `varianti_brew` e con almeno 30
   partite;
3. richiede il dettaglio pubblico solo per quelle impronte;
4. costruisce le firme con `firmaMain()` del modulo S1;
5. raggruppa con `pianificaGruppi()` del modulo S1 e k=4, senza duplicare o
   approssimare l'algoritmo;
6. esegue la diagnostica del classificatore corrente;
7. congela SHA-256 delle risposte pubbliche;
8. salva manifest e report reali fuori dal repository;
9. rifiuta esplicitamente una `--output-dir` interna al repository;
10. non assegna automaticamente A/B/C/D: lascia la decisione alla fase fonti.

Comando previsto, da un ambiente che possa raggiungere l'API pubblica:

```powershell
node strumenti/s3_candidati_pubblici.mjs
```

Output privato di default nella directory temporanea del sistema:

- `S3-MANIFEST-PRIVATO-2026-09-17.json`
- `S3-CANDIDATI-PRIVATO-2026-09-17.json`
- `S3-CANDIDATI-PRIVATO-2026-09-17.md`

Questi file **non devono essere aggiunti a Git**.

## 6. Schema esatto del report candidato privato

Per ogni gruppo S1:

```json
{
  "candidato_id": "C001",
  "gruppo_temporaneo": "bg_<id solo temporaneo>",
  "partite_aggregate": 0,
  "varianti_pubbliche": 0,
  "colori_osservati": null,
  "rappresentante": {
    "impronta": "<privata/non versionata>",
    "partite": 0,
    "main_deck": [
      { "arena_id": 0, "copie": 0, "nome": "..." }
    ],
    "riferimenti_catalogo_vicini": [
      {
        "id": "...",
        "archetipo_id": "...",
        "nome": "...",
        "somiglianza_lista": 0.0,
        "core_punteggio": 0.0,
        "core_carte": 0,
        "core_totale": 0
      }
    ],
    "classificazione_corrente": null
  },
  "membri": [
    {
      "impronta": "<privata/non versionata>",
      "partite": 0,
      "distanza_rappresentante": 0
    }
  ],
  "motivo_tecnico_corrente": "NON_CLASSIFICATO_DAL_CATALOGO_CORRENTE",
  "classe_s3": null,
  "decisione_s3": "DA_REVISIONARE_CON_FONTI"
}
```

Il manifest privato conserva le risposte pubbliche necessarie alla
ripetibilita' e gli SHA-256 di meta, dettagli e corpus.

## 7. Fonti esterne

Nessuna delle fonti whitelist e' stata usata come evidenza decisionale in
questa run:

- `magic.wizards.com`: non consultata;
- `mtgaassistant.net`: non consultata;
- `aetherhub.com`: non consultata;
- `mtgdecks.net`: non consultata.

Motivo: la stop condition candidati scatta **prima** della ricerca per
candidato. Fare ricerca meta senza candidati avrebbe invertito il processo
canonico e rischiato di trasformare S3 in un refresh generale non richiesto.

Di conseguenza non esiste alcuna decisione A/B/C/D da supportare con fonti.

## 8. Decisioni e modifiche catalogo

Candidati reali esaminati: **0 per mancanza input**, non "0 candidati esistenti".

Conteggi decisioni:

- A — vero Brew: 0
- B — catalogo vecchio: 0
- C — variante nota: 0
- D — nuovo archetipo: 0

`mox-core/meta/standard.json`: **nessuna modifica**.

`moxtracker/src/catalogo-archetipi-generato.js`: **nessuna rigenerazione e
nessuna modifica**.

Non esiste quindi un diff classificazioni prima/dopo da interpretare. Il Git
blob del catalogo generato resta quello della baseline perche' il file non e'
stato toccato, non perche' sia stata eseguita una rigenerazione deterministica.

## 9. Parita' client/server

Caratterizzata la catena tecnica:

- sorgente curata: `mox-core/meta/standard.json`;
- generatore server: `strumenti/genera_catalogo_archetipi.py`;
- classificatore server: `src/archetipi.js`;
- clustering candidato: `src/brew-clustering.js`.

La parita' su candidati reali **non e' stata eseguita**, perche' il manifest
reale manca. Non viene dichiarato PASS.

## 10. Brew residui e naming

Non misurati:

- gruppi Brew Standard residui;
- gruppi assorbibili dal refresh;
- contemporanea presenza di piu' veri Brew.

Nessun naming automatico e' stato introdotto. `Gruppo Brew` resta invariato.

## 11. Test eseguiti in questa sessione

Eseguiti sul nuovo codice preparato localmente prima del commit:

```text
node --check strumenti/s3_candidati_pubblici.mjs   -> PASS sintassi
node --check prove/s3-candidati-pubblici.test.js  -> PASS sintassi
```

Non eseguiti, quindi non dichiarati verdi:

- `npm run prove`;
- `npm run sito:build`;
- suite completa `mox-core`;
- rigenerazione doppia del catalogo;
- test del collector contro l'API reale.

Il limite e' del runner corrente: non dispone di un checkout locale eseguibile
completo dei due repository e del DB carte Arena. I risultati storici S1/S2
non vengono riutilizzati come se fossero test di questa run.

## 12. File pubblici S3

Modifiche previste solo in `moxtracker`:

- `strumenti/s3_candidati_pubblici.mjs`
- `prove/s3-candidati-pubblici.test.js`
- `passaggi/sito/S3-META-CATALOG-REFRESH-2026-09-17.md`
- `passaggi/handoff/HANDOFF-S3-META-CATALOG-REFRESH-2026-09-17.md`

Nessun artefatto candidato reale e nessuna impronta reale sono versionati.

## 13. Ripresa corretta

Per sbloccare S3 basta **uno** dei due input autorizzati:

1. eseguire il collector da un ambiente che raggiunga l'API pubblica e fornire
   i tre artefatti privati alla sessione di lavoro; oppure
2. fornire un export sanitizzato equivalente, read-only, con manifest/hash.

Da quel punto si riparte dalla Fase 2/3: candidati -> fonti whitelist ->
decisioni A/B/C/D -> eventuale `standard.json` -> rigenerazione -> diff ->
parita' -> suite -> self-review.

Non serve rifare baseline, discovery S1/S2 o ricerca generale se branch e
baseline non cambiano.

## 14. Vincoli rispettati

- nessun merge;
- nessun deploy Worker/Pages;
- nessun D1 remoto;
- nessuna query admin;
- nessuna modifica produzione;
- nessun nuovo endpoint;
- nessun cambio di k/soglie/algoritmo;
- nessun dato candidato privato committato;
- nessuna fixture usata come prova di un archetipo reale.
