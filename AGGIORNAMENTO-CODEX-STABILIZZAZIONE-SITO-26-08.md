# Aggiornamento Codex — stabilizzazione sito Mox (26/08/2026)

Questo file descrive le modifiche locali fatte da Codex dopo il Draft reale
2.9.23 riuscito. Claude ha poi incorporato `src/draft.js` e le relative prove
nel commit `2f3c216`; il seguito è descritto in
`PASSAGGIO-A-CODEX-DOPO-A109-2026-08-26.md`. **Al momento di questo passaggio
non era stato pubblicato, migrato o modificato alcun dato di produzione.**

Ramo locale: `codex/draft-recupero-2920`. Le modifiche elencate sotto erano
inizialmente locali e non committate; controllare Git e il passaggio successivo
prima di intervenire sugli stessi file.

## Punti che possono sovrapporsi al lavoro Draft di Claude

### Flag `sospetto`

File modificato: `src/draft.js`.

In `sospettoDraft(dato)` è stata corretta questa condizione:

```js
if (pool > scelte) {
```

Prima richiedeva erroneamente anche `pool` e `scelte` truthy. Ora un Draft
segnato come completo, con pool finale non vuoto e zero scelte registrate,
viene conservato ma marcato come sospetto. Una traccia esplicitamente
incompleta continua a non essere marcata.

Regressioni aggiunte in `prove/draft.test.js`:

- completo + pool + zero scelte → sospetto;
- incompleto + pool + zero scelte → non sospetto.

Se la correzione di Claude cambia le regole Draft, mantenere questi due casi o
sostituirli con una regola più precisa e testata. Non trasformare questa
marcatura in rifiuto/cancellazione del dato grezzo: la decisione di prodotto è
conservare le tracce private ed escludere quelle sospette dagli aggregati.

### Schema e migrazione

File modificato: `schema-draft.sql`.

Il bootstrap ora include anche l'indice già presente nella migrazione
`migrazioni/2026-08-25-draft-sospetto.sql`:

```sql
CREATE INDEX IF NOT EXISTS draft_sospetto ON draft (sospetto)
  WHERE sospetto IS NOT NULL;
```

Nuovo test: `prove/schema-draft.test.js`, che confronta il campo/indice
ottenuti da bootstrap e migrazione. Non eseguire la migrazione in produzione
senza autorizzazione esplicita.

### Backfill R2 → D1 preparato, non eseguito

Nuovo file: `strumenti/ricalcola_sospetti_draft.mjs`.

Lo script rilegge gli indici D1 e le tracce R2 private, ricalcola
`sospettoDraft()` e confronta il risultato con D1. Non stampa payload, chiavi
o identificativi. Per protezione:

- perfino la sola lettura richiede
  `--conferma-lettura=LEGGI-TRACCE-DRAFT-PRIVATE`;
- la scrittura richiede in più `--apply` e
  `--conferma=AGGIORNA-DRAFT-SOSPETTI`;
- gli `UPDATE` sono condizionati al valore D1 precedente e vengono riletti e
  verificati dopo l'applicazione.

Non lanciare lo script come test ordinario. L'help locale è:

```powershell
npm run draft:sospetti:help
```

Se Claude modifica `sospettoDraft()`, questo script deve restare allineato
perché importa direttamente quella funzione.

## Correzione account indipendente dal Draft

File modificato: `src/account.js`.

`Access-Control-Allow-Methods` ora include `PUT`, necessario per:

`PUT /account/decks/:fingerprint/name`

È stato aggiunto un test OPTIONS realistico con origine
`https://moxtracker.app` in `prove/account-ticket.test.js`.

## Preview, cache e release Pages

Nuovi file:

- `strumenti/build_sito.mjs`;
- `strumenti/release_sito.mjs`;
- `release-sito.config.json`;
- `prove/build-sito.test.js`.

`npm run sito:build` crea `.dist/sito` da distribuire. La build assegna un
unico `?v=<hash-build>` a tutti i riferimenti locali JS/CSS/asset, inclusi gli
import ES e `url()` CSS; genera `build-manifest.json`; serve HTML con
`Cache-Control: no-store` e asset con cache immutabile. Non aggiornare più a
mano i vecchi suffissi `?v=` nei sorgenti.

`npm run sito-locale` costruisce prima l'artefatto e poi lo serve. Il gate
`npm run sito:release` non pubblica da solo: rifiuta tree sporca, commit non
sincronizzato, ramo sorgente errato e, in produzione, preview non equivalente,
smoke test, screenshot e conferma esplicita. Non è stato eseguito alcun deploy
Pages.

## Verifiche già eseguite

- `npm run prove`: **152/152** verdi dopo l'integrazione dei casi condivisi con Mox;
- `npm audit --omit=dev`: 0 vulnerabilità;
- `npx wrangler deploy --dry-run`: riuscito;
- build sito riproducibile su due esecuzioni;
- le sette pagine locali servite dalla build rispondono 200.

Il proxy locale `/api` non ha potuto raggiungere la produzione dalla sandbox;
non è stato interpretato come difetto applicativo e non sono stati inviati
dati.
