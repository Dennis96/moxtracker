# HANDOFF — S3-META-CATALOG-REFRESH — 17 settembre 2026

**Stato:** `PROPOSED_FOR_REVIEW`  
**Esito corrente:** `PASS WITH CONDITIONS`  
**Condizione:** gate dinamico suite/generazione da rieseguire in un checkout completo prima di poter dichiarare `PASS CANDIDATE`.

## 1. Repository, branch e baseline

### Dennis96/mox-core

- baseline: `c8079dc40c1325c1314d9f283226ab3be10db21d`
- branch: `chatgpt/s3-meta-catalog-refresh-2026-09-17`
- HEAD S3 corrente prima dell'handoff finale tracker: `20f3a09a6560884f0ac95bd7c93fe90163104960`
- delta: solo `passaggi/meta/S3-META-CATALOG-DECISION-LOG-2026-09-17.md`
- `meta/standard.json`: invariato rispetto alla baseline

### Dennis96/moxtracker

- base S3/S2: `d7437da62e7351dcd9d99260c3d3685452dab496`
- branch: `chatgpt/s3-meta-catalog-refresh-2026-09-17`
- HEAD prima dei due commit di finalizzazione documentale: `d4f364198198d310d1a7047020b853d7644b1e3b`
- il nuovo HEAD finale deve essere verificato dopo questo commit

Nessun merge e' stato eseguito.

## 2. Input reale autorizzato

Artefatti privati canonici validati in S3-A:

- `S3-MANIFEST-PRIVATO-2026-09-17.json`;
- `S3-CANDIDATI-PRIVATO-2026-09-17.json`;
- `S3-CANDIDATI-PRIVATO-2026-09-17.md`.

Corpus SHA-256 canonico:

`afe964cee29bfcf27795698f97436b6b797dece77d363ab6fd0b3933e1015b87`

Gli artefatti privati non sono versionati e non devono esserlo durante la review.

Nel Project/Library esiste anche uno snapshot precedente raccolto nello stesso giorno: non usarlo. La run S3 canonica e' quella identificata dall'hash sopra.

## 3. Corpus e clustering

- formato: Standard
- periodo: totale
- soglia pubblicazione: 30
- algoritmo: `main-multiset-radius-v1`
- k: 4
- 4 varianti pubblicabili
- 149 partite aggregate
- 3 gruppi:
  - C001: 81 partite / 2 varianti;
  - C002: 37 partite / 1 variante;
  - C003: 31 partite / 1 variante.

C001 unisce due varianti da 47 e 34 partite a distanza esattamente 4. C002 e C003 restano singleton.

S3-A ha verificato manifest/hash/conteggi/60 carte/clustering/diagnostica e determinismo del Markdown con validatore mirato **17/17 PASS**.

## 4. Preflight fonti

S3-B0:

- `magic.wizards.com`: `CONSENTITA CON LIMITI`;
- `mtgaassistant.net`: `NON UTILIZZABILE` nel runner corrente;
- `aetherhub.com`: `NON UTILIZZABILE` nel runner corrente;
- `mtgdecks.net`: `NON UTILIZZABILE` nel runner corrente.

La ricerca B1/B2/B3 ha usato esclusivamente consultazione puntuale di Wizards. Nessun crawling, scraping, workaround o ampliamento della whitelist.

## 5. Decisioni da verificare indipendentemente

### C001 — 81 / 2

Nucleo: red-white Dwarves + Equipment.

Decisione proposta: `A — EVIDENZA_INSUFFICIENTE`.

Wizards attesta `Red-White Dwarves` e le sinergie Nani/Equipment, ma l'evidenza trovata e' soprattutto design/Limited/regole/Brawl e non soddisfa il gate di presenza Standard ripetuta richiesto per D. I Boros MOX correnti sono tecnicamente molto distanti.

Documento:

`passaggi/sito/S3-B1-C001-DECISIONE-2026-09-17.md`

### C002 — 37 / 1

Nucleo: Orzhov sacrifice/death/recursion a creature economiche.

Decisione proposta: `A — EVIDENZA_INSUFFICIENTE`.

Wizards conferma le sinergie di `Sephiroth, Fabled SOLDIER`, `Raise the Past`, `Vengeful Bloodwitch`, recruit e altri pezzi del motore, ma non emerge un archetipo Standard ufficiale ripetutamente documentato. Gli archetipi Orzhov MOX esistenti sono troppo distanti per B/C.

Documento:

`passaggi/sito/S3-B2-C002-DECISIONE-2026-09-17.md`

### C003 — 31 / 1

Nucleo: Orzhov sacrifice/death/recursion con payoff di morte piu' densi, inclusi `Arnyn, Deathbloom Botanist` e `Syr Vondam, Sunstar Exemplar`.

Decisione proposta: `A — EVIDENZA_INSUFFICIENTE`.

C003 e' strategicamente affine a C002 ma non e' una quasi-copia S1; S3 non introduce un livello famiglia. Anche qui manca evidenza Standard ufficiale ripetuta sufficiente a D.

Documento:

`passaggi/sito/S3-B3-C003-DECISIONE-2026-09-17.md`

### Consolidato

- A `EVIDENZA_INSUFFICIENTE`: 3
- A `VERO_BREW`: 0
- B `CATALOGO_VECCHIO`: 0
- C `VARIANTE_NOTA`: 0
- D `NUOVO_ARCHETIPO`: 0

Decision log core:

`passaggi/meta/S3-META-CATALOG-DECISION-LOG-2026-09-17.md`

## 6. Catalogo e generazione

### mox-core

`meta/standard.json` Git blob S3:

`259bbeba19bb4b4af9515604bf3e60e715fb6387`

E' identico alla baseline.

### moxtracker

`src/catalogo-archetipi-generato.js` Git blob S3:

`5f47548824671347c0697f8d924964c38ae23ef5`

E' identico alla baseline.

Non esiste quindi un diff catalogo da approvare. Nessun file generato e' stato editato a mano.

## 7. Gate tecnico statico

Documento:

`passaggi/sito/S3-D-GATE-TECNICI-2026-09-17.md`

Esito: `STATIC GATE PASS`.

Verificato via GitHub:

- core baseline -> S3: un solo commit documentale;
- tracker S2 -> S3: solo collector/test/documentazione S3;
- nessun cambio a classificatore, clustering S1, catalogo generato, schema/D1 o frontend S1/S2;
- catalogo core e catalogo generato hanno gli stessi blob della baseline;
- nessun status/check CI remoto disponibile sugli HEAD S3.

## 8. Gate dinamico obbligatorio per review

Il runner ChatGPT dispone di Node/npm/Python ma il tentativo di clonare GitHub e' fallito per DNS (`Could not resolve host: github.com`). Le suite non vengono quindi dichiarate verdi.

### moxtracker

Eseguire almeno:

```text
node --test prove/s3-candidati-pubblici.test.js
node --test prove/brew-clustering.test.js prove/brew-gruppi.test.js prove/brew-meta.test.js prove/brew-cancellazione.test.js
npm run prove
npm run sito:build
npm run genera-archetipi -- --mox <path-mox-core>
```

Ripetere la generazione a input immutato e confrontare hash/byte. Con `standard.json` invariato, il risultato atteso e' equivalente alla baseline.

### mox-core

Eseguire le suite Meta/classificatore/formati realmente presenti nel checkout e la suite completa canonica del repository. Non assumere valido un comando soltanto perche' citato in documenti precedenti: verificarlo nel checkout.

## 9. Punti di review indipendente Claude/Codex

1. Verificare che il corpus privato usato sia quello con hash `afe964...` e non lo snapshot precedente.
2. Rieseguire il clustering S1 k=4 sui quattro input pubblicabili.
3. Riesaminare senza essere guidati dalle conclusioni precedenti se C001/C002/C003 meritino davvero `EVIDENZA_INSUFFICIENTE` invece di B/C/D.
4. Verificare fonti/robots/termini alla data della review prima di qualsiasi nuova consultazione.
5. Verificare che nessun dato candidato privato sia finito nel Git diff.
6. Rieseguire il gate dinamico completo.
7. Verificare che `standard.json` e il catalogo generato restino invariati dopo la rigenerazione.
8. Controllare regressioni plausibili del collector S3 aggiunto al tracker.
9. Verificare il problema UX residuo: tre gruppi Brew pubblici possono restare contemporaneamente con nome neutro `Gruppo Brew`.
10. Non riaprire S1/S2 salvo regressione concreta rilevata dai test.

## 10. Nota branch temporaneo

Durante S3-B2 e' stato creato accidentalmente e non utilizzato il branch tracker:

`chatgpt/s3-meta-catalog-refresh-2026-09-17-b2-temp`

Punta al vecchio checkpoint B1 e non contiene lavoro B2/B3. Il connettore disponibile non espone cancellazione branch; va eliminato come housekeeping dalla CLI/GitHub quando possibile. Non usarlo per review o merge.

## 11. Stato finale operativo

- merge: **NO**
- deploy: **NO**
- D1 remoto: **NO**
- produzione: **NO**
- modifica `meta/standard.json`: **NO**
- modifica catalogo generato: **NO**
- dati candidato privati committati: **NO**

Il branch S3 resta `PROPOSED_FOR_REVIEW`. Il passaggio corretto e' review indipendente + gate dinamico; soltanto dopo un esito positivo si puo' discutere l'eventuale merge.
