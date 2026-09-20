# S3 — META-CATALOG-REFRESH — 17 settembre 2026

**Stato:** `COMPLETATO PER REVIEW`  
**Decisioni:** `PROPOSED_FOR_REVIEW`  
**Esito tecnico:** `PASS WITH CONDITIONS`  
**Condizione residua:** gate dinamico suite/generazione da rieseguire in un checkout completo

S3 ha completato la prima run controllata Standard senza promuovere automaticamente alcun Brew. Il risultato decisionale e' intenzionalmente conservativo: i tre gruppi reali osservati hanno identita' meccaniche coerenti, ma l'evidenza esterna consentita non supporta B/C/D con il livello richiesto dal mandato. Il catalogo resta quindi invariato.

## 1. Baseline e HEAD finali del checkpoint

### mox-core

- repository: `Dennis96/mox-core`
- baseline: `c8079dc40c1325c1314d9f283226ab3be10db21d`
- branch: `chatgpt/s3-meta-catalog-refresh-2026-09-17`
- HEAD dopo S3-C: `20f3a09a6560884f0ac95bd7c93fe90163104960`
- delta dalla baseline: un solo decision log pubblico S3

### moxtracker

- repository: `Dennis96/moxtracker`
- base S3/S2: `d7437da62e7351dcd9d99260c3d3685452dab496`
- branch: `chatgpt/s3-meta-catalog-refresh-2026-09-17`
- HEAD prima dell'handoff finale: `d4f364198198d310d1a7047020b853d7644b1e3b`

## 2. Parametri congelati

- formato: `Standard`
- periodo: `totale`
- cutoff fonti: `2026-09-17`
- soglia pubblicazione vigente: 30 partite
- clustering: `main-multiset-radius-v1`
- k: `4`
- classificatore: lista `0.90`, margine `0.03`; core `0.60`, almeno 5 carte, margine `0.20`
- nessuna modifica a soglie, algoritmo o contratti S1/S2

## 3. Corpus reale autorizzato

Il collector pubblico S3 ha prodotto tre artefatti privati, successivamente validati in S3-A:

- manifest JSON;
- report candidati JSON;
- report candidati Markdown.

Lo snapshot canonico della run e' quello validato con corpus SHA-256:

`afe964cee29bfcf27795698f97436b6b797dece77d363ab6fd0b3933e1015b87`

Esito S3-A:

- 4 varianti Brew pubblicabili;
- 149 partite aggregate;
- 3 gruppi dopo clustering S1 k=4;
- distribuzione: 81/2 varianti, 37/1, 31/1;
- gruppo 81 = varianti 47 + 34 a distanza canonica 4;
- nessuna anomalia sostanziale del corpus/clustering;
- validatore mirato S3-A: **17/17 PASS**.

Esisteva nel Project/Library anche uno snapshot precedente raccolto nello stesso giorno, non usato per le decisioni finali. La run canonica e' quella identificata dall'hash sopra.

Gli artefatti privati, fingerprint e decklist complete non sono stati committati.

## 4. Preflight fonti S3-B0

Esito conservativo:

- `magic.wizards.com`: `CONSENTITA CON LIMITI` — consultazione puntuale di pagine pubbliche, niente crawling/scraping/data mining automatizzato;
- `mtgaassistant.net`: `NON UTILIZZABILE` nel runner corrente;
- `aetherhub.com`: `NON UTILIZZABILE` nel runner corrente;
- `mtgdecks.net`: `NON UTILIZZABILE` nel runner corrente.

Nessun workaround, mirror o bypass e' stato usato.

## 5. Decisioni candidate

| Candidato | Dati aggregati | Nucleo sicuro | Decisione proposta | Modifica catalogo |
|---|---:|---|---|---|
| C001 | 81 partite / 2 varianti | Red-white Dwarves + Equipment | `A — EVIDENZA_INSUFFICIENTE` | Nessuna |
| C002 | 37 partite / 1 variante | Orzhov sacrifice/death/recursion | `A — EVIDENZA_INSUFFICIENTE` | Nessuna |
| C003 | 31 partite / 1 variante | Orzhov sacrifice/death/recursion, payoff morte piu' densi | `A — EVIDENZA_INSUFFICIENTE` | Nessuna |

Conteggi:

- A — `EVIDENZA_INSUFFICIENTE`: **3**;
- A — `VERO_BREW`: **0**;
- B — `CATALOGO_VECCHIO`: **0**;
- C — `VARIANTE_NOTA`: **0**;
- D — `NUOVO_ARCHETIPO`: **0**.

### C001

Wizards attesta l'identita' ufficiale `Red-White Dwarves` e le sinergie Nani/Equipment del set Hobbit. Le evidenze disponibili sono pero' soprattutto design/Limited/regole/Brawl, non una presenza Standard ripetuta sufficiente al gate D. I Boros MOX esistenti sono tecnicamente molto distanti.

### C002

Wizards conferma la coerenza di un piano a creature economiche con sacrificio, death triggers, `Raise the Past`, `Sephiroth, Fabled SOLDIER`, `Vengeful Bloodwitch` e recruit. Non emergono tuttavia risultati Standard ufficiali ripetuti o naming attestato sufficienti a B/C/D.

### C003

C003 rafforza lo stesso asse generale con ulteriori payoff di morte come `Arnyn, Deathbloom Botanist` e `Syr Vondam, Sunstar Exemplar`. E' strategicamente affine a C002 ma non e' una quasi-copia S1 e S3 non introduce famiglie: `Varianti ora, famiglie dopo` resta invariato. Anche qui manca evidenza Standard sufficiente a B/C/D.

L'assenza di evidenza sufficiente non viene trasformata in `VERO_BREW`.

## 6. Decision log canonico S3

In `mox-core`:

`passaggi/meta/S3-META-CATALOG-DECISION-LOG-2026-09-17.md`

Il log consolida le tre decisioni e congela il gate catalogo:

- nessun nuovo archetipo;
- nessuna nuova lista di riferimento;
- nessun cambio nome;
- nessun cambio soglia/core/algoritmo;
- `meta/standard.json` invariato.

## 7. Gate statico S3-D

### Catalogo curato

`mox-core/meta/standard.json` sul branch S3 conserva il blob baseline:

`259bbeba19bb4b4af9515604bf3e60e715fb6387`

### Catalogo generato

`moxtracker/src/catalogo-archetipi-generato.js` conserva il blob baseline:

`5f47548824671347c0697f8d924964c38ae23ef5`

### Diff

`mox-core` e' ahead di un solo commit documentale rispetto alla baseline.

Il delta S3 tracker rispetto a S2 contiene esclusivamente:

- collector pubblico read-only S3;
- test sintetico del collector;
- report/handoff S3;
- preflight fonti;
- decisioni C001/C002/C003;
- gate tecnico.

Nessuna modifica a classificatore, clustering S1, catalogo generato, schema/D1 o frontend S1/S2.

Esito: **STATIC GATE PASS**.

## 8. Gate dinamico pendente

Il runner ChatGPT dispone di Node/npm/Python ma non riesce a risolvere `github.com` via DNS, quindi non puo' creare un checkout completo dei repository. Non vengono dichiarati verdi test non eseguiti e non vengono riutilizzati risultati storici come test S3-D.

Prima di `PASS CANDIDATE` vanno rieseguiti in un checkout completo almeno:

```text
node --test prove/s3-candidati-pubblici.test.js
node --test prove/brew-clustering.test.js prove/brew-gruppi.test.js prove/brew-meta.test.js prove/brew-cancellazione.test.js
npm run prove
npm run sito:build
npm run genera-archetipi -- --mox <path-mox-core>
```

La generazione deve essere ripetuta a input immutato e risultare deterministica. Poiche' `standard.json` non cambia, il catalogo generato atteso deve restare equivalente alla baseline.

Per `mox-core` vanno eseguite le suite Meta/classificatore/formati realmente presenti nel checkout e la suite canonica completa prevista dal repository.

Gli HEAD S3 non espongono status/check CI remoti; l'assenza di status non e' considerata PASS o FAIL.

## 9. Brew residui e naming

Dopo la decisione S3, tutti i 3 gruppi pubblici candidati restano correttamente Brew perche' nessuna modifica catalogo e' supportata.

Il problema UX segnalato dall'utente resta quindi reale: piu' gruppi possono essere mostrati contemporaneamente con il nome neutro `Gruppo Brew`.

S3 non introduce naming automatico da carte, fingerprint, ID tecnici o `Brew #N`. C001 possiede un descrittore Wizards correlato (`Red-White Dwarves`), ma non viene promosso a nome Standard MOX. C002/C003 mostrano una possibile relazione di famiglia, che resta esplicitamente fuori scope.

## 10. Esito

### `PASS WITH CONDITIONS`

La parte decisionale e il gate statico S3 sono completi e coerenti. La sola condizione residua e' l'esecuzione del gate dinamico in un ambiente con checkout completo.

Non e' ancora `PASS CANDIDATE` e non esiste autorizzazione al merge.

Operazioni vietate rispettate:

- merge: **NO**;
- deploy: **NO**;
- D1 remoto: **NO**;
- produzione: **NO**;
- dati candidato privati committati: **NO**;
- modifica catalogo: **NO**.
