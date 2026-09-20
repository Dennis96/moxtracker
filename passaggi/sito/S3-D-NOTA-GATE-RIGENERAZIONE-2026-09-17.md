# S3-D — NOTA GATE RIGENERAZIONE — 17 settembre 2026

## Correzione del criterio

Il primo gate dinamico locale ha mostrato che il confronto byte-per-byte tra `src/catalogo-archetipi-generato.js` versionato e una nuova rigenerazione non e' un criterio valido se il database locale MTG Arena o la data di esecuzione sono cambiati.

Il generatore:

- imposta `generato_il` alla data corrente;
- ricostruisce `id_a_nome` dall'intero database Arena locale;
- ricostruisce `id_a_stampa` dall'intero database Arena locale;
- ricostruisce `basi_ids` dal database Arena locale.

Quindi una rigenerazione del 17/09/2026 con un DB Arena aggiornato puo' differire legittimamente dal file versionato generato in precedenza anche se `meta/standard.json`, le liste curate e i core del classificatore sono invariati.

## Esito osservato

- hash file versionato prima della rigenerazione: `D37DA9452D50451E26BFB13A200E8E46D40615030E862BC88017FAEA5E45F1A1`;
- hash generazione #1: `2728C08AA4F5F86A10B6465EE58925D1D154B1BBC208A7B2239785AEDE8B5CBF`;
- hash generazione #2: `2728C08AA4F5F86A10B6465EE58925D1D154B1BBC208A7B2239785AEDE8B5CBF`.

Le due generazioni consecutive sono quindi deterministiche a input e ambiente immutati.

La rigenerazione ha usato il DB Arena locale corrente e ha prodotto 27 liste e 27 core.

## Gate corretto

Per S3 il confronto con la baseline deve verificare almeno l'identita' dei campi semanticamente rilevanti per il catalogo curato/classificatore:

- `versione`;
- `formato`;
- `aggiornato`;
- `nomi_arena_completi`;
- `liste` (incluse firme e core generati).

Differenze limitate a `generato_il`, `id_a_nome`, `id_a_stampa` e `basi_ids` possono dipendere dalla data e dal DB Arena locale e non costituiscono da sole una regressione S3.

Non committare automaticamente il catalogo rigenerato durante questo gate. Dopo il confronto semantico ripristinare il file versionato.

## Stato

Il determinismo stessa-data/stesso-DB e' PASS. Il confronto semantico con la baseline resta da completare prima di chiudere il dynamic gate tracker.
