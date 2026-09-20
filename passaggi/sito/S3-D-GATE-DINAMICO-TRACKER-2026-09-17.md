# S3-D — GATE DINAMICO MOXTRACKER — 17 settembre 2026

**Stato:** `PASS`

Questo documento registra il gate dinamico eseguito su workstation Windows sul worktree congelato di `Dennis96/moxtracker` per S3.

## Baseline del checkout

- branch remoto S3: `chatgpt/s3-meta-catalog-refresh-2026-09-17`
- worktree locale inizialmente congelato al checkpoint documentale `7d963b7c8cd7d73edbf437002b35e7edd2c7d232`
- mox-core associato: `20f3a09a6560884f0ac95bd7c93fe90163104960`
- PowerShell: usare `npm.cmd`, non `npm`, per evitare il blocco di `npm.ps1` imposto dalla Execution Policy della workstation.

## Test eseguiti

### Collector S3

Comando:

`node --test prove/s3-candidati-pubblici.test.js`

Esito: **3/3 PASS**.

Copertura principale:

- solo varianti Brew gia' pubbliche;
- clustering S1 `k=4`;
- divieto di scrivere gli artefatti reali nel repository.

### Brew mirati S1/S2

Comando:

`node --test prove/brew-clustering.test.js prove/brew-gruppi.test.js prove/brew-meta.test.js prove/brew-cancellazione.test.js`

Esito: **53/53 PASS**.

### Suite completa moxtracker

Comando:

`npm.cmd run prove`

Esito: **427/427 PASS**, 0 fail, 0 skipped.

I messaggi di errore simulati relativi a R2/D1/database durante la suite sono fixture intenzionali di resilienza e risultano coperti da test PASS.

### Build sito

Comando:

`npm.cmd run sito:build`

Esito: **PASS**.

Build hash: `54ae1e62b7792f95`.

File pubblicati nella build locale: 91.

## Rigenerazione catalogo archetipi

Comando eseguito due volte a input immutato:

`npm.cmd run genera-archetipi -- --mox <worktree-mox-core-s3>`

Entrambe le generazioni hanno prodotto lo stesso SHA-256:

`2728C08AA4F5F86A10B6465EE58925D1D154B1BBC208A7B2239785AEDE8B5CBF`

Esito: **determinismo PASS**.

Il file versionato prima della rigenerazione aveva SHA-256:

`D37DA9452D50451E26BFB13A200E8E46D40615030E862BC88017FAEA5E45F1A1`

La differenza byte-per-byte non e' un errore S3. Il generatore dipende dall'ambiente locale:

- salva `generato_il = date.today()`;
- ricostruisce `id_a_nome`, `id_a_stampa` e `basi_ids` dall'intero database locale di MTG Arena.

Il database Arena locale usato il 17/09/2026 contiene quindi dati ambientali piu' recenti rispetto al file versionato generato il 22/08/2026.

## Confronto semantico corretto

Dopo aver conservato temporaneamente la rigenerazione e ripristinato il file versionato con `git restore`, sono stati confrontati gli invarianti S3.

Esito:

- `versione`: IDENTICO;
- `formato`: IDENTICO;
- `aggiornato`: IDENTICO;
- `nomi_arena_completi`: IDENTICO;
- `liste`: IDENTICO.

Campi ambientali attesi diversi:

- `generato_il`: `2026-08-22` -> `2026-09-17`;
- `id_a_nome`: `25292` -> `25299`;
- `id_a_stampa`: `25292` -> `25299`;
- `basi_ids`: `1126` -> `1126`.

Esito confronto semantico: **PASS**.

Il worktree tracker e' stato ripristinato pulito dopo il confronto; il file rigenerato non e' stato committato.

## Nota dipendenze

`npm ci` ha riportato 3 vulnerabilita' `high severity` e warning `allow-scripts` per `esbuild`/`workerd`. Non e' stato eseguito `npm audit fix`, perche' aggiornare dipendenze durante il gate S3 sarebbe fuori scope e potrebbe introdurre modifiche non correlate. Questo resta housekeeping separato.

## Esito del checkpoint

`MOXTRACKER DYNAMIC GATE: PASS`

Nessun merge, deploy, D1 remoto o modifica produzione eseguiti.
