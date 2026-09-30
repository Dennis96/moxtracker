# FRA-02 — remediation Codex dopo review indipendente

Base `730c33443a0c8d92ac91239a22e0e835578edf90`, branch
`codex/remediate-fra-real-draft-2026-09-30`. La review originale sul core
`5274790` e tracker `730c334` è FAIL, 0 BLOCKER/3 MAJOR: report core commit
`1f5f966ff6127844bb52dde138cb42c2be57cb72`, branch report-only immutato.

Qui viene corretto **M-02**, pertinente alla nuova accettazione di candidati
duplicati: la prima copia forniva campione/fonte a entrambe le scelte, mentre
`.some()` propagava `vicina` da una copia all'altra. Ora campione/fonte/valore
17Lands/intervallo devono coincidere tra copie della stessa carta; fonte è
testo o nulla/assente. Il validatore Python gemello applica lo stesso contratto.
Rango, vicina, motivi/modifica restano copy-level. Una candidata viene consumata
per scelta, a partire dal rango migliore; `vicina` è quella della candidata
consumata. Il log non distingue la copia fisica Arena: questo ordine è una
convenzione deterministica. Se una scelta non ha candidata, i metadati restano
assenti/zero come per una scelta non rappresentata dal payload.

`abbinaScelte` rimane invariata: seguito uguale all'intersezione multiset,
consiglio non seguito ancora libero, nessun falso seguito. **API v1 e schemi
D1 invariati**, niente migrazioni. Corpus condiviso **51** casi identici al
core, incluso il contratto numerico JSON (`302.0`), fonti invalide e copie
discordanti. Queste ultime vengono rifiutate prima dello storage.

Test mirati prima del freeze **32/32 PASS**: route vera/SQLite, array candidati
invertito ancora `vicina=[0,1]`, metadati discordanti senza scritture, 324
combinazioni/permutazioni per il seguito. Self-review del delta: nessuna
modifica a endpoint policy, schema, ranking scientifico o componenti fuori
scope. Suite canonica ed E2E con Worker locale/storage isolato sono eseguiti
successivamente sugli HEAD puliti; evidenze definitive locali fuori Git.

Core corregge M-01/M-03 e i due MINOR nel branch omonimo; il suo handoff è
`passaggi/release/handoff/HANDOFF-CODEX-FRA-REAL-DRAFT-REMEDIATION-2026-09-30.md`.
**FIXED / AWAITING INDEPENDENT CLAUDE REVIEW** alla consegna dopo i controlli.
Nessun merge, deploy, secret modificato o release. Production resta precedente
a FRA-02: il deploy Worker, dopo nuova review e mandato, precede il client.
