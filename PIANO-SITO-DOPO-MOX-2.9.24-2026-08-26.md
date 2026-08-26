# Piano del sito Mox dopo la 2.9.24

Data di aggiornamento: **26 agosto 2026**.

Fonti:

- `PASSAGGIO-NUOVA-CHAT-SITO-26-08.md`;
- `DECISIONI-PRODOTTO-SITO-26-08.md`;
- `PASSAGGIO-CODEX-RIPRENDE-IL-SITO-2026-08-26.md`.

Questo documento aggiorna l'ordine operativo alla situazione effettiva del
repository. Il passaggio di Claude descrive correttamente la chiusura di A109 e
la pubblicazione di Mox 2.9.24, ma le sue prime tre consegne per Codex sono già
state completate dopo che il documento è stato scritto.

## Baseline già conclusa

- Draft reale con Mox 2.9.23 riuscito: il cancello originario resta superato.
- Worker pubblicato con versione
  `612d316c-5695-4484-9ce9-082ba3f6f1da`.
- CORS privato verificato dal vivo con `PUT` consentito.
- `sospettoDraft()` corretto e casi condivisi Mox/Worker identici byte per byte.
- Backfill R2 → D1 concluso: 16 tracce analizzate, 7 marcate, 9 valide; i Draft
  recuperati da A109 hanno 42 pick e non sono stati marcati.
- Seconda analisi del backfill: 16 invariate e nessuna modifica residua.
- Schema Draft allineato.
- Build statica deterministica, cache busting automatico e gate release pronti.
- Suite server: 153/153.

La 2.9.24 aggiunge un controllo client gemello del Worker e rende immutabili le
scelte dopo la chiusura della traccia. Il primo Draft reale con questa versione
è una verifica utile, ma **non blocca lo sviluppo del sito**. Fino a quel test i
numeri Draft nuovi vanno trattati come ancora in assestamento e non usati per
fissare soglie o conclusioni di prodotto.

## Fase 1 — sorgente canonica e anteprima verificabile

1. Conservare `codex/draft-recupero-2920` e gli altri rami storici senza
   riscriverli o eliminarli.
2. Creare `main` dalla baseline verificata e usarlo come unica sorgente delle
   release future.
3. Allineare `release-sito.config.json` a `main`.
4. Registrare in Git il piano e la baseline soltanto dopo review dei documenti
   destinati al remoto.
5. Eseguire in locale:
   - suite completa;
   - `npm audit --omit=dev`;
   - build riproducibile;
   - piano release senza `--deploy`;
   - verifica browser delle pagine principali a larghezza desktop e mobile.
6. Preparare le evidenze: commit, build ID, manifest, esito test e schermate.
7. Fermarsi prima di qualunque deploy Pages. La preview remota richiede una
   nuova autorizzazione esplicita.
8. Dopo l'autorizzazione, pubblicare la preview dello stesso commit, eseguire gli
   smoke test e conservare il record generato in `.release`.

### Criteri di uscita della fase 1

- `main` locale punta alla baseline completa e la working tree è pulita;
- la copia remota e il ramo predefinito vengono aggiornati solo dopo
  autorizzazione sul contenuto da pubblicare in Git;
- 153 test o più tutti verdi e audit dipendenze senza vulnerabilità note;
- due build consecutive producono lo stesso `build_id` e gli stessi hash;
- home, Draft, account, supporto e privacy rispondono dalla build;
- controllo browser desktop/mobile senza errori bloccanti;
- nessun deploy Pages di produzione.

## Fasi successive

### 2. Fondazioni condivise

Navigazione Home/Meta/Draft/Account/Supporto, italiano sulle URL correnti e
inglese sotto `/en/`, design scuro senza sfondo animato, componenti comuni,
tabelle mobile a schede e requisiti minimi di accessibilità.

### 3. Homepage

Hero con download principale e due schermate reali di Mox, conteggi pubblici
aggregati con ultimo aggiornamento, beta aperta, pagina Note di versione e
pagina Cosa invia Mox.

### 4. Meta Constructed

Audit della distinzione BO1/BO3, filtri formato/periodo/rank/BO1-BO3, Standard
predefinito, archetipi sotto soglia visibili e Brew raggruppati in Altro. La
formula del punteggio combinato va confrontata sui dati reali e approvata prima
della pubblicazione; le metriche originali restano sempre visibili.

### 5. Archetipi

Lista rappresentativa per frequenza, varianti sopra soglia, differenze fra
liste, copia/esportazione Arena, curva, tipi, colori e campione. Trend e matchup
restano bloccati finché i dati non bastano.

### 6. Draft pubblico

Sostituire la diagnostica attuale con una vista semplice per set, evento e
periodo. Pubblicare combinazioni di colore e carte solo con campione affidabile.
Politiche, `tracce_marcate`, confronti esterni, deck builder e tracce incomplete
restano privati. Questa fase resta volutamente più piccola di Homepage e Meta:
i Draft servono innanzitutto a migliorare Mox.

### 7. Account e supporto

Dashboard semplificata, mazzi correnti e storici separati, versioni, ultimo
invio, dispositivi, consensi, export per sezioni e Draft personali con fixing e
terre speciali. Diagnostica normale tramite `rapporto.json`; Player.log ed email
richiedono flussi e consensi separati.

### 8. Beta aperta

Prove reali account/ticket autorizzate, preview finale, checklist comune per
3–5 tester, monitoraggio delle funzioni principali e richiesta separata prima
del deploy di produzione.

## Confini invariati

- Nessuna pubblicazione Pages senza autorizzazione esplicita.
- Nessuna migrazione o modifica di dati di produzione implicita.
- Nessuna prova distruttiva sull'account principale.
- Le tracce Draft sospette o incomplete si conservano private: non si
  cancellano e non entrano negli aggregati pubblici.
- Ogni modifica alle regole del pacchetto Draft parte dalla copia canonica
  `../Codice/prove/casi-pacchetto-draft.json` e mantiene identiche le due suite.
