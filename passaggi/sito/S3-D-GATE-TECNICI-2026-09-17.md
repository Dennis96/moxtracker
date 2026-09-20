# S3-D — GATE TECNICI — 17 settembre 2026

**Stato:** `STATIC GATE PASS · DYNAMIC GATE PENDING`  
**Stato decisioni S3:** `PROPOSED_FOR_REVIEW`

Questo checkpoint verifica tutto cio' che puo' essere dimostrato direttamente dallo stato Git remoto dopo S3-C e registra senza sovrastimare i test che il runner corrente non puo' eseguire.

## 1. HEAD verificati

### mox-core

- branch: `chatgpt/s3-meta-catalog-refresh-2026-09-17`
- HEAD S3-C: `20f3a09a6560884f0ac95bd7c93fe90163104960`
- base: `c8079dc40c1325c1314d9f283226ab3be10db21d`
- delta: un solo file documentale, `passaggi/meta/S3-META-CATALOG-DECISION-LOG-2026-09-17.md`

### moxtracker

- branch: `chatgpt/s3-meta-catalog-refresh-2026-09-17`
- HEAD S3-B3: `1c749263f637f00ae0ce6ae619307becad9eb2d9`
- base S3/S2: `d7437da62e7351dcd9d99260c3d3685452dab496`
- delta S3: collector/test S3 + documentazione/handoff/decisioni; nessuna modifica a `src/` o al catalogo generato.

## 2. Integrita' del catalogo curato

`mox-core/meta/standard.json` sul branch S3 ha Git blob:

`259bbeba19bb4b4af9515604bf3e60e715fb6387`

E' lo stesso blob della baseline S3 caratterizzata prima delle decisioni.

Esito:

- nessuna entry Standard modificata;
- nessun archetipo aggiunto;
- nessuna lista di riferimento aggiunta;
- nessun nome cambiato;
- nessuna soglia o policy cambiata.

Questo e' coerente con il gate S3-C: tutti e tre i candidati sono `A — EVIDENZA_INSUFFICIENTE`.

## 3. Integrita' del catalogo generato tracker

`moxtracker/src/catalogo-archetipi-generato.js` sul branch S3 ha Git blob:

`5f47548824671347c0697f8d924964c38ae23ef5`

E' lo stesso blob della baseline S3.

Quindi non esiste un diff catalogo server da attribuire a S3 e non e' stato effettuato alcun hand-edit del file generato.

## 4. Diff remoto verificato

### mox-core

Confronto baseline -> S3-C:

- ahead di 1 commit;
- merge base esattamente la baseline;
- unico file aggiunto: decision log S3.

### moxtracker

Confronto S2 -> S3-B3:

- ahead di 8 commit;
- merge base esattamente S2;
- file S3 limitati a:
  - collector pubblico read-only;
  - test sintetico del collector;
  - documentazione S3;
  - preflight fonti;
  - decisioni C001/C002/C003;
  - handoff S3.

Non risultano modifiche a:

- `src/archetipi.js`;
- `src/brew-clustering.js`;
- `src/catalogo-archetipi-generato.js`;
- schema/D1;
- frontend S1/S2;
- `mox-core/meta/standard.json`.

## 5. CI remoto

Gli HEAD S3 dei due repository non espongono status/check CI associati tramite GitHub. L'assenza di status non viene interpretata come PASS o FAIL.

## 6. Tentativo di esecuzione locale del runner ChatGPT

Il runner dispone di:

- Node.js `v22.16.0`;
- npm `10.9.2`;
- Python `3.13.5`.

Il tentativo di clonare i due repository via HTTPS e' stato bloccato dal DNS del runner (`Could not resolve host: github.com`). Di conseguenza non esiste in questa sessione un checkout completo su cui eseguire le suite.

Non vengono riutilizzati risultati storici come se fossero test S3-D appena eseguiti.

## 7. Gate dinamici ancora da eseguire

Prima di poter dichiarare `PASS CANDIDATE` devono essere eseguiti in un checkout completo gli stessi gate del mandato S3.

### moxtracker

Almeno:

```text
node --test prove/s3-candidati-pubblici.test.js
node --test prove/brew-clustering.test.js prove/brew-gruppi.test.js prove/brew-meta.test.js prove/brew-cancellazione.test.js
npm run prove
npm run sito:build
npm run genera-archetipi -- --mox <path-mox-core>
```

La generazione va ripetuta a input immutato e il risultato deve essere byte-identico/hash-identico. Poiche' `standard.json` non e' cambiato, il file generato atteso deve restare equivalente alla baseline; ogni differenza richiede spiegazione e blocca il PASS.

### mox-core

Eseguire le suite canoniche realmente presenti per Meta/classificatore/formati e la suite completa prevista dal repository. Non inventare comandi non verificati dal checkout corrente.

## 8. Parita' e regressione attese

Dato che nessun input catalogo e nessun classificatore e' stato modificato:

- l'output di classificazione atteso prima/dopo e' invariato;
- client/server non devono cambiare assegnazione per nessun riferimento esistente;
- C001/C002/C003 devono restare Brew col catalogo corrente;
- nessun nuovo falso positivo deve apparire.

Queste sono aspettative da verificare nel gate dinamico, non risultati dichiarati senza esecuzione.

## 9. Esito S3-D

### `STATIC GATE PASS`

Perche':

- catalogo curato invariato al blob baseline;
- catalogo generato invariato al blob baseline;
- diff remoto interamente spiegato;
- nessuna modifica inattesa a classificatore, D1, frontend o contratti S1/S2;
- nessun dato candidato privato nel diff noto.

### `DYNAMIC GATE PENDING`

Perche' il runner corrente non puo' ottenere un checkout eseguibile. Finche' le suite/generazione non vengono eseguite, S3 non deve essere etichettato `PASS CANDIDATE`.

Nessun merge, deploy, D1 remoto o modifica produzione e' stato eseguito.
