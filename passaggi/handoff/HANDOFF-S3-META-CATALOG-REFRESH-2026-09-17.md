# HANDOFF — S3-META-CATALOG-REFRESH — 17 settembre 2026

**Stato:** `PROPOSED_FOR_REVIEW`  
**Esito corrente:** `FAIL / BLOCKER — manca il corpus candidato reale autorizzato`

## Repository e branch

### Dennis96/mox-core

- baseline: `c8079dc40c1325c1314d9f283226ab3be10db21d`
- branch: `chatgpt/s3-meta-catalog-refresh-2026-09-17`
- catalogo Standard: non modificato
- il branch resta alla baseline finche' non esiste una decisione S3 supportata.

### Dennis96/moxtracker

- `main`: `75bcac460b13e0556a48d8ccb44dde431e3241fd`
- base S3/S2: `d7437da62e7351dcd9d99260c3d3685452dab496`
- branch: `chatgpt/s3-meta-catalog-refresh-2026-09-17`
- HEAD finale: vedere il commit S3 del branch.

## Cosa e' stato verificato

- baseline live dei due repository;
- catena `17a3ca0 -> 8a3cfe7 -> d7437da`;
- contratto S1, frontend S2 e roadmap refresh;
- classificatore `src/archetipi.js`;
- clustering S1 `src/brew-clustering.js`;
- generatore `strumenti/genera_catalogo_archetipi.py`;
- catalogo Standard corrente: `aggiornato = 2026-08-17`, 26 riferimenti
  dichiarati dalla nota canonica;
- assenza nel contesto disponibile di un export Brew S3 sanitizzato.

## Blocker

Il mandato consente decisioni catalogo soltanto dopo aver costruito candidati
reali da:

1. API pubblica MOX read-only; oppure
2. export sanitizzato autorizzato.

In questa sessione il runtime non puo' aprire direttamente l'API pubblica
MOX, e non e' disponibile il secondo input. Lo storico S1 del 15/09 e' reale
ma non e' un manifest S3 completo al cutoff 17/09.

Per questo non sono state consultate le fonti whitelist per decidere archetipi
e `mox-core/meta/standard.json` non e' stato toccato.

## Tool da revisionare

`strumenti/s3_candidati_pubblici.mjs`

Deve essere verificato soprattutto per questi punti:

- solo GET su `/meta` e `/archetipo`;
- nessuna enumerazione di impronte non gia' pubblicate;
- soglia 30 invariata;
- import e uso di `firmaMain()` / `pianificaGruppi()` reali;
- `main-multiset-radius-v1`, k=4;
- nessuna classificazione A/B/C/D automatica;
- manifest SHA-256;
- output privato fuori repository;
- rifiuto di `--output-dir` interna al repository.

Test sintetico:

`prove/s3-candidati-pubblici.test.js`

La fixture sintetica verifica il caso 56/60 -> distanza 4 -> un solo gruppo.
Questa fixture prova il tool, **non** e' evidenza per decisioni Meta reali.

## Come produrre gli artefatti privati

Da un checkout del branch tracker con rete verso l'API pubblica:

```powershell
node strumenti/s3_candidati_pubblici.mjs
```

Non usare `--output-dir` dentro il repository.

Output:

- `S3-MANIFEST-PRIVATO-2026-09-17.json`
- `S3-CANDIDATI-PRIVATO-2026-09-17.json`
- `S3-CANDIDATI-PRIVATO-2026-09-17.md`

Non committare questi file.

## Come riprendere S3 dopo lo sblocco

1. verificare hash/manifest privato;
2. ordinare i gruppi per partite aggregate solo come priorita';
3. eseguire diagnostica corrente per ciascun gruppo;
4. preflight robots/termini delle sole fonti whitelist da consultare;
5. raccogliere evidenza pertinente per ciascun candidato;
6. assegnare A/B/C/D in modo conservativo;
7. creare il decision log pubblico privo di identificativi privati;
8. modificare solo le entry supportate di `mox-core/meta/standard.json`;
9. `npm run genera-archetipi -- --mox <mox-core>`;
10. ripetere la generazione a input immutato e confrontare hash;
11. produrre diff classificazioni prima/dopo;
12. verificare parita' client/server e falsi positivi;
13. eseguire suite complete;
14. self-review avversariale;
15. commit/push separati, nessun merge.

## Test da rieseguire prima di poter dichiarare PASS CANDIDATE

### mox-core

- `python strumenti/valida_meta.py`
- test mirati Meta/classificatore realmente presenti nel repository
- suite canonica completa, con eventuali skip dichiarati

### moxtracker

- `node --test prove/s3-candidati-pubblici.test.js`
- suite catalogo/classificatore
- quattro suite Brew S1
- suite frontend S2
- `npm run prove`
- `npm run sito:build`
- generazione catalogo due volte con hash identico

## Artefatti privati

Nessun artefatto candidato reale e' stato prodotto in questa run perche' il
canale dati e' il blocker stesso. Quando prodotti, devono restare fuori Git.

## Punti di review indipendente

1. Il blocker dati e' reale o esiste nel contesto un export autorizzato che la
   run non ha trovato?
2. Il collector rispetta davvero il perimetro read-only/pubblico?
3. Il parser del payload produzione coincide col contratto legacy attuale?
4. Il clustering usa esattamente S1 e non cambia semanticamente k=4?
5. L'output privato contiene il minimo necessario e non rischia commit?
6. Nessuna conclusione A/B/C/D e' stata anticipata senza fonti?
7. Nessun file Meta e' cambiato dietro al blocker?

## Stato operazioni vietate

- merge: **NO**
- deploy: **NO**
- D1 remoto: **NO**
- produzione: **NO**
- dati candidato privati committati: **NO**
