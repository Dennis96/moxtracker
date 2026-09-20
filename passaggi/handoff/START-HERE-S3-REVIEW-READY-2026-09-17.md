# START HERE — S3 REVIEW READY — 17 settembre 2026

Questo documento supersede, per lo stato operativo finale, `START-HERE-S3-META-CATALOG-REFRESH-2026-09-17.md`. Non rifare discovery generale, S3-A/B/C o raccolta candidati.

## Stato

- macro-task: `S3-META-CATALOG-REFRESH`
- stato decisioni: `PROPOSED_FOR_REVIEW`
- gate statico: `PASS`
- gate dinamico moxtracker: `PASS`
- gate dinamico mox-core: `PASS`
- merge: `NO`
- deploy: `NO`
- D1 remoto: `NO`
- produzione: `NO`
- prossimo passo unico: review indipendente Claude/Codex

S3 non viene promosso unilateralmente a `PASS CANDIDATE`: tale esito resta subordinato alla review indipendente prevista dal mandato.

## Repository e HEAD tecnici

### mox-core

- repository: `Dennis96/mox-core`
- branch: `chatgpt/s3-meta-catalog-refresh-2026-09-17`
- baseline iniziale: `c8079dc40c1325c1314d9f283226ab3be10db21d`
- HEAD tecnico S3: `20f3a09a6560884f0ac95bd7c93fe90163104960`
- `meta/standard.json`: invariato
- delta S3: decision log documentale

### moxtracker

- repository: `Dennis96/moxtracker`
- branch: `chatgpt/s3-meta-catalog-refresh-2026-09-17`
- base S3/S2: `d7437da62e7351dcd9d99260c3d3685452dab496`
- HEAD precedente al presente checkpoint: `b8cbaa2760029348d3a1757892cf4376d2c50a31`
- il commit che aggiunge questo file diventa il nuovo HEAD documentale del branch

## Decisioni S3

Corpus canonico privato: SHA-256 `afe964cee29bfcf27795698f97436b6b797dece77d363ab6fd0b3933e1015b87`.

- C001: 81 partite / 2 varianti -> `A — EVIDENZA_INSUFFICIENTE`
- C002: 37 partite / 1 variante -> `A — EVIDENZA_INSUFFICIENTE`
- C003: 31 partite / 1 variante -> `A — EVIDENZA_INSUFFICIENTE`
- B `CATALOGO_VECCHIO`: 0
- C `VARIANTE_NOTA`: 0
- D `NUOVO_ARCHETIPO`: 0

Conclusione: nessuna modifica supportata a `mox-core/meta/standard.json`; nessun nuovo nome canonico introdotto.

## Gate dinamico moxtracker — PASS

Eseguito sul worktree locale S3 completo.

Risultati:

- `node --test prove/s3-candidati-pubblici.test.js`: `3/3 PASS`
- suite Brew mirata: `53/53 PASS`
- `npm.cmd run prove`: `427/427 PASS`, `0 FAIL`
- `npm.cmd run sito:build`: `PASS`
- build sito: hash `54ae1e62b7792f95`, 91 file
- worktree ripristinato pulito dopo la prova di rigenerazione

### Rigenerazione catalogo

Il primo criterio byte-per-byte contro il file versionato era improprio perché il generatore include:

- `generato_il = date.today()`;
- `id_a_nome`, `id_a_stampa` e `basi_ids` derivati dall'intero database Arena locale.

Il database Arena locale del 17/09/2026 non coincide con quello usato il 22/08/2026 per il file versionato.

Doppia rigenerazione a input immutato:

- Gen #1 SHA-256: `2728C08AA4F5F86A10B6465EE58925D1D154B1BBC208A7B2239785AEDE8B5CBF`
- Gen #2 SHA-256: `2728C08AA4F5F86A10B6465EE58925D1D154B1BBC208A7B2239785AEDE8B5CBF`

Quindi il generatore è deterministico a input/ambiente immutati.

Confronto semantico baseline vs rigenerato:

- `versione`: IDENTICO
- `formato`: IDENTICO
- `aggiornato`: IDENTICO
- `nomi_arena_completi`: IDENTICO
- `liste`: IDENTICO

Differenze ambientali attese:

- `generato_il`: `2026-08-22` -> `2026-09-17`
- `id_a_nome`: 25292 -> 25299
- `id_a_stampa`: 25292 -> 25299
- `basi_ids`: 1126 -> 1126

Il file generato locale è stato ripristinato alla versione Git; nessun catalogo rigenerato è stato committato.

Documenti correlati:

- `passaggi/sito/S3-D-NOTA-GATE-RIGENERAZIONE-2026-09-17.md`
- `passaggi/sito/S3-D-DYNAMIC-GATE-TRACKER-2026-09-17.md`

## Gate dinamico mox-core — PASS

Eseguito sul worktree locale S3 usando il runtime canonico MOX:

`%LOCALAPPDATA%\Mox\Python\python.exe strumenti\prove.py`

Risultato finale riportato dalla suite:

- `Tutte le prove sono passate.`
- `2 saltate`
- attestazione scritta in `build\attestazione-prove.json`
- attestazione riferita a HEAD abbreviato `20f3a09a`
- beta `2.11.0`
- `git status --short`: pulito dopo la suite

Le prove più lente riportate nel finale includevano rilettura, unita-fuori-draft, grafiche, ranking-draft, mazzi, gestore, contatore-misure e contatore-reale.

I due skip non sono trattati come conferma positiva delle prove saltate. Il reviewer indipendente deve controllare l'attestazione o il log completo se la natura degli skip è materiale per la review; il tail fornito al coordinatore non riportava i loro nomi.

## Regola PowerShell della workstation

PowerShell blocca `npm.ps1` per Execution Policy. Non cambiare l'Execution Policy.

Usare sempre:

```text
npm.cmd ci
npm.cmd run prove
npm.cmd run sito:build
npm.cmd run genera-archetipi -- ...
```

oppure, se necessario, `cmd /c npm ...`.

## Review indipendente — scope

La review deve essere in nuova chat / contesto pulito e non deve assumere corrette le conclusioni sopra.

Verificare autonomamente:

1. HEAD/baseline e diff dei due repository;
2. corpus privato canonico `afe964...`;
3. clustering S1 `main-multiset-radius-v1`, k=4;
4. decisioni C001/C002/C003;
5. fonti/robots/termini prima di eventuale nuova consultazione;
6. assenza di fingerprint, decklist private o mapping privati nel diff Git;
7. collector S3 e regressioni plausibili;
8. significato dei 2 test core saltati se rilevante;
9. criterio corretto di rigenerazione: determinismo a input immutato + invarianti semantici, non byte equality fra database Arena di date diverse;
10. problema UX residuo dei tre gruppi con etichetta neutra `Gruppo Brew`.

Non riaprire S1/S2/R3/Draft/Research salvo regressione concreta.

Esiti ammessi della review: `PASS CANDIDATE`, `PASS WITH CONDITIONS`, `FAIL BLOCKER`.

## Stop condition

Nessun merge, deploy, D1 remoto, migrazione o produzione senza nuova autorizzazione esplicita dell'utente.

Il branch temporaneo `chatgpt/s3-meta-catalog-refresh-2026-09-17-b2-temp` resta da ignorare/eliminare come housekeeping e non deve essere usato per review o merge.
