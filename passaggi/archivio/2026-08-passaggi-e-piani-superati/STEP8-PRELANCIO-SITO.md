# Step 8 — pre-lancio del sito

> **Documento storico.** Fotografa il 21–22/08/2026: da allora il dominio
> principale `moxtracker.app` è stato collegato, account e ticket sono stati
> pubblicati e la suite è passata a 110/110. Per lo stato corrente vale
> `LEGGIMI.md`.

Pubblicato come beta controllata e aggiornato il 21/08/2026 su
`https://beta.moxtracker.pages.dev`. Il dominio principale non è stato
collegato.

Aggiornamento locale 22/08: aggiunte pagine Account e Supporto, non ancora
pubblicate perché richiedono dominio, OAuth, schema D1 e bucket dedicato. S2 è
chiusa nel codice con la regressione end-to-end descritta in
`S2-CHIUSURA-2026-08-22.md`.

## Correzioni completate

- banner “Beta pubblica” sulla home e pagina “Come Mox migliora il Draft”;
- pagina Draft riposizionata: il visitatore vede il percorso dai contributi
  anonimi alla verifica delle politiche, non una falsa dashboard personale;
- nuova pagina `privacy.html`, collegata da tutti i footer;
- link “Draft” visibile nella navigazione mobile della home;
- sezione Matchup compatta quando l'API dichiara che i dati non sono ancora
  pubblicabili;
- anteprima `npm run sito-locale`, che inoltra in sola lettura le richieste
  `/api` all'API pubblica senza inviare partite o Draft;
- pulsanti “Scarica MOX” collegati alla release GitHub più recente, con un nome
  asset stabile che non cambia a ogni beta;
- quattro prove permanenti dedicate al pre-lancio.
- privacy pubblica delle decklist: 30 partite della stessa variante, mittente
  mai esposto; vista variante dedicata e decklist nascosta sotto soglia;
- light mode, Metodo Draft e navbar `Meta / Metodo Draft` corretti.

## Verifiche

- `npm run prove`: 101/101 nello stato locale del 22/08; il deploy pubblico
  resta al set di prove precedente finché non vengono pubblicate le correzioni
  Bo1/rank/archetipo;
- home desktop 1280×900 con 5 partite Standard reali e nessuna percentuale
  sotto soglia;
- home mobile 390×844: Meta e Draft raggiungibili, nessun overflow;
- Privacy mobile: sei sezioni, nessun overflow;
- Metodo Draft desktop: API raggiungibile, 0 pick e stato vuoto corretto,
  nessun errore di rete o numero inventato;
- due pulsanti download attivi verso `Mox-Windows-beta.zip` nella release
  GitHub indicata come più recente.

## Prima del dominio principale

1. aggiungere un contatto privacy dedicato;
2. completare Draft reali Premier/Quick/Prendi Due;
3. pubblicare ogni nuova beta nello stesso asset stabile GitHub;
4. raccogliere e correggere i feedback della beta;
5. riesaminare le modifiche e collegare infine `moxtracker.app`.

Il deploy Pages è manuale (Direct Upload), non automatico da GitHub. L'ultimo
alias beta punta al deploy del commit `frontend-v1` `1c268e8`.
