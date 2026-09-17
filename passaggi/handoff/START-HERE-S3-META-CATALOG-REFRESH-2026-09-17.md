# START HERE — S3-META-CATALOG-REFRESH — 17 settembre 2026

Questo documento e' il punto di ingresso canonico per riprendere S3 senza rifare discovery, baseline, raccolta candidati o ricostruzione manuale della cronologia.

## 1. Stato operativo

- macro-task: `S3-META-CATALOG-REFRESH`
- stato: `PROPOSED_FOR_REVIEW`
- esito corrente: `PASS WITH CONDITIONS`
- merge: NO
- deploy: NO
- D1 remoto: NO
- produzione: NO
- modifica catalogo Standard: NO
- modifica catalogo generato tracker: NO
- prossimo passo: review indipendente Claude/Codex + gate dinamico in checkout completo

Non riaprire S1, S2, R3, Draft o Research salvo regressione concreta trovata dai test.

## 2. Repository, branch e baseline

### mox-core

- repository: `Dennis96/mox-core`
- branch: `chatgpt/s3-meta-catalog-refresh-2026-09-17`
- baseline iniziale S3: `c8079dc40c1325c1314d9f283226ab3be10db21d`
- HEAD S3 consolidato: `20f3a09a6560884f0ac95bd7c93fe90163104960`
- delta rispetto alla baseline: solo `passaggi/meta/S3-META-CATALOG-DECISION-LOG-2026-09-17.md`
- `meta/standard.json`: invariato

### moxtracker

- repository: `Dennis96/moxtracker`
- branch: `chatgpt/s3-meta-catalog-refresh-2026-09-17`
- base S3: S2 HEAD `d7437da62e7351dcd9d99260c3d3685452dab496`
- HEAD S3 prima di questo START-HERE: `99d2950544150254bae293ac160f02d59b59d722`
- il commit che aggiunge questo file e' soltanto documentale e diventa il nuovo HEAD remoto del branch

## 3. Perche' S3 e' stato eseguito

S3 era il refresh manuale controllato del catalogo Meta Standard successivo a S1/S2 Brew.

Obiettivo: distinguere ogni candidato reale osservato da MOX in una delle classi previste:

- A — vero Brew / evidenza insufficiente;
- B — catalogo vecchio;
- C — variante nota;
- D — nuovo archetipo.

Vincoli mantenuti:

- nessuna promozione automatica Brew -> archetipo;
- niente classificazione basata sul win rate;
- niente naming automatico da carte, ID o fingerprint;
- niente scraping o bypass di robots/termini;
- niente modifica soglie S1;
- niente scheduler;
- niente deploy o D1 remoto.

## 4. Input reale autorizzato

Il collector S3 ha usato esclusivamente l'API pubblica read-only MOX e dettagli legacy gia' pubblici.

Artefatti privati canonici validati:

- `S3-MANIFEST-PRIVATO-2026-09-17.json`
- `S3-CANDIDATI-PRIVATO-2026-09-17.json`
- `S3-CANDIDATI-PRIVATO-2026-09-17.md`

Corpus SHA-256 canonico:

`afe964cee29bfcf27795698f97436b6b797dece77d363ab6fd0b3933e1015b87`

IMPORTANTE: nel Project/Library esiste anche uno snapshot precedente della stessa giornata con C002 a 36 partite. Non usarlo. Lo snapshot canonico S3 e' quello con hash corpus `afe964...` e C002 a 37 partite.

Gli artefatti privati non devono essere committati.

## 5. Parametri congelati

- formato: Standard
- periodo: totale
- cutoff fonti: 2026-09-17
- soglia pubblicazione: 30 partite
- clustering: `main-multiset-radius-v1`
- distanza massima k: 4
- soglia lista classificatore: 0.90
- margine lista: 0.03
- soglia core: 0.60
- minimo carte core: 5
- margine core: 0.20
- stato decisioni: `PROPOSED_FOR_REVIEW`

## 6. S3-A — corpus e diagnostica

Esito:

- 4 varianti Brew pubblicabili;
- 149 partite aggregate;
- 3 gruppi candidati dopo clustering S1;
- C001 = 81 partite / 2 varianti;
- C002 = 37 partite / 1 variante;
- C003 = 31 partite / 1 variante.

C001 unisce le varianti da 47 e 34 partite a distanza S1 esattamente 4. C002 e C003 restano singleton.

Validatore mirato S3-A: `17/17 PASS` su:

- manifest/hash;
- conteggi;
- soglia pubblicazione;
- 60 carte per lista;
- clustering S1 k=4;
- classificazioni correnti nulle;
- soglie lista/core/minimo carte;
- determinismo del Markdown.

Diagnostica classificatore:

- C001: massimo core 1/8; massima somiglianza lista circa 7,7%;
- C002: massimo core 1/8; massima somiglianza lista circa 7,7%;
- C003: massimo core 2/8; massima somiglianza lista circa 17,0%.

Nessun candidato e' vicino alle soglie correnti.

Documenti principali:

- `passaggi/sito/S3-META-CATALOG-REFRESH-2026-09-17.md`
- `passaggi/handoff/HANDOFF-S3-META-CATALOG-REFRESH-2026-09-17.md`

## 7. S3-B0 — preflight fonti

Whitelist originale:

- `magic.wizards.com`
- `mtgaassistant.net`
- `aetherhub.com`
- `mtgdecks.net`

Esito conservativo del runtime usato:

- Wizards: `CONSENTITA CON LIMITI` per consultazione puntuale pubblica;
- MTGA Assistant: `NON UTILIZZABILE` nel runtime;
- AetherHub: `NON UTILIZZABILE` nel runtime;
- MTGDecks: `NON UTILIZZABILE` nel runtime.

Nessun workaround, spoofing User-Agent, crawling o scraping.

Documenti:

- `passaggi/sito/S3-B0-PREFLIGHT-FONTI-2026-09-17.md`
- `passaggi/handoff/HANDOFF-S3-B0-PREFLIGHT-FONTI-2026-09-17.md`

## 8. S3-B1 — C001

Corpus pubblico sicuro: 81 partite / 2 varianti.

Nucleo strategico: red-white Dwarves + Equipment.

Wizards attesta chiaramente `Red-White Dwarves` e la coerenza Nani/Equipment, ma le evidenze trovate sono soprattutto design del set, Limited, regole e Brawl. Non e' stata trovata presenza Standard ufficiale ripetuta sufficiente per il gate D.

Decisione proposta:

`A — EVIDENZA_INSUFFICIENTE`

B/C non supportati: Boros Prowess/Boros Aggro correnti sono tecnicamente troppo distanti.

Documento:

`passaggi/sito/S3-B1-C001-DECISIONE-2026-09-17.md`

Commit tracker B1:

`2b2e785ea2e7c99028c67e4ba04f152686c6f198`

## 9. S3-B2 — C002

Corpus pubblico sicuro: 37 partite / 1 variante.

Nucleo strategico: Orzhov sacrifice/death/recursion a basso costo con `Sephiroth, Fabled SOLDIER`, `Raise the Past`, `Vengeful Bloodwitch`, `Infestation Sage`, `Snarling Gorehound`, recruit e payoff associati.

Wizards conferma la coerenza meccanica dei pezzi ma non una presenza Standard ufficiale ripetuta con naming attestato.

Decisione proposta:

`A — EVIDENZA_INSUFFICIENTE`

Documento:

`passaggi/sito/S3-B2-C002-DECISIONE-2026-09-17.md`

Commit tracker B2:

`23dbd278af4499c9329a0688c70ebcc6a1574d8f`

## 10. S3-B3 — C003

Corpus pubblico sicuro: 31 partite / 1 variante.

Nucleo strategico: Orzhov sacrifice/death/recursion affine a C002 ma con payoff di morte piu' densi, inclusi `Arnyn, Deathbloom Botanist` e `Syr Vondam, Sunstar Exemplar`.

C002 e C003 sono strategicamente affini ma non sono quasi-copie S1. S3 non introduce un livello famiglia e non li fonde artificialmente.

Decisione proposta:

`A — EVIDENZA_INSUFFICIENTE`

Documento:

`passaggi/sito/S3-B3-C003-DECISIONE-2026-09-17.md`

Commit tracker B3:

`1c749263f637f00ae0ce6ae619307becad9eb2d9`

## 11. S3-C — consolidamento decisioni

Consolidato:

- `A — EVIDENZA_INSUFFICIENTE`: 3
- `A — VERO_BREW`: 0
- B — CATALOGO_VECCHIO: 0
- C — VARIANTE_NOTA: 0
- D — NUOVO_ARCHETIPO: 0

Conclusione operativa: non esiste evidenza sufficiente per modificare il catalogo Standard.

Quindi:

- `mox-core/meta/standard.json`: invariato;
- `moxtracker/src/catalogo-archetipi-generato.js`: invariato;
- nessun nuovo nome canonico introdotto.

Decision log core:

`passaggi/meta/S3-META-CATALOG-DECISION-LOG-2026-09-17.md`

Commit core:

`20f3a09a6560884f0ac95bd7c93fe90163104960`

## 12. S3-D — gate tecnico statico

Verificato via GitHub:

- blob `mox-core/meta/standard.json`: `259bbeba19bb4b4af9515604bf3e60e715fb6387`, identico alla baseline;
- blob `moxtracker/src/catalogo-archetipi-generato.js`: `5f47548824671347c0697f8d924964c38ae23ef5`, identico alla baseline;
- nessun cambio a classificatore, clustering S1, schema D1 o frontend;
- delta core: solo decision log;
- delta tracker: collector/test/documentazione S3.

Esito statico: `PASS`.

Il runner ChatGPT non ha potuto eseguire il gate dinamico completo perche' il clone GitHub dal runner falliva per DNS. Le suite complete NON sono dichiarate verdi.

Documento:

`passaggi/sito/S3-D-GATE-TECNICI-2026-09-17.md`

Commit tracker gate:

`d4f364198198d310d1a7047020b853d7644b1e3b`

## 13. S3-E — handoff finale

Lo stato finale del lavoro prima di questo START-HERE e':

`PASS WITH CONDITIONS · PROPOSED_FOR_REVIEW`

Condizione residua: dynamic gate + review indipendente.

Documenti finali:

- `passaggi/sito/S3-META-CATALOG-REFRESH-2026-09-17.md`
- `passaggi/handoff/HANDOFF-S3-META-CATALOG-REFRESH-2026-09-17.md`
- questo `START-HERE-S3-META-CATALOG-REFRESH-2026-09-17.md`

## 14. Gate dinamico obbligatorio per Claude/Codex

Non rifare discovery generale. Partire dagli HEAD indicati e rieseguire soltanto il gate dinamico e la review indipendente.

### moxtracker

Eseguire almeno:

```text
node --test prove/s3-candidati-pubblici.test.js
node --test prove/brew-clustering.test.js prove/brew-gruppi.test.js prove/brew-meta.test.js prove/brew-cancellazione.test.js
npm run prove
npm run sito:build
npm run genera-archetipi -- --mox <path-mox-core>
```

Ripetere la generazione a input immutato e confrontare byte/hash. Con `standard.json` invariato, il catalogo generato atteso deve restare equivalente alla baseline.

### mox-core

Individuare nel checkout i test canonici Meta/classificatore/formati realmente presenti ed eseguire quelli pertinenti piu' la suite completa canonica del repository.

Non inventare comandi sulla base di documenti storici: verificare i runner reali nel checkout.

## 15. Review indipendente

Claude/Codex devono verificare autonomamente:

1. che il corpus privato canonico sia quello con hash `afe964...`;
2. clustering S1 k=4 sui 4 input pubblicabili;
3. decisioni C001/C002/C003 senza assumere corrette le conclusioni precedenti;
4. robots/termini aggiornati prima di eventuale nuova consultazione;
5. assenza di fingerprint/decklist private nel Git diff;
6. dynamic gate completo;
7. determinismo della rigenerazione;
8. invarianti `standard.json` e catalogo generato;
9. regressioni plausibili del collector S3;
10. problema UX residuo dei tre `Gruppo Brew` contemporanei.

Esito review ammesso: `PASS CANDIDATE`, `PASS WITH CONDITIONS` oppure `FAIL BLOCKER`.

## 16. Problema UX residuo noto

S3 non ha risolto il naming dei gruppi Brew perche' il mandato vietava naming automatico non supportato.

Il risultato corretto oggi e' che piu' gruppi reali possono restare contemporaneamente con nome neutro `Gruppo Brew`.

Questo va trattato come follow-up UX separato, non aggirato assegnando nomi inventati o archetipi non dimostrati.

## 17. Branch temporaneo da non usare

Durante B2 e' stato creato accidentalmente:

`chatgpt/s3-meta-catalog-refresh-2026-09-17-b2-temp`

E' rimasto al vecchio checkpoint B1, non contiene B2/B3 e non deve essere usato per review o merge. Puo' essere eliminato come housekeeping.

## 18. Stop condition

Non procedere a merge, deploy, migrazione D1 o produzione senza nuova autorizzazione esplicita.

Se review e dynamic gate danno PASS, riportare:

- repo;
- branch;
- full SHA;
- test eseguiti;
- eventuali differenze;
- stato merge ancora NO.
