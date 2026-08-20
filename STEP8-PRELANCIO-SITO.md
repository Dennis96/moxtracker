# Step 8 — pre-lancio del sito

Implementato localmente il 20/08/2026. Non committato e non pubblicato su
Cloudflare Pages.

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
- pulsanti “Scarica MOX” ancora disattivati per decisione dell'utente;
- quattro prove permanenti dedicate al pre-lancio.

## Verifiche

- `npm run prove`: 75/75;
- home desktop 1280×900 con 5 partite Standard reali e nessuna percentuale
  sotto soglia;
- home mobile 390×844: Meta e Draft raggiungibili, nessun overflow;
- Privacy mobile: sei sezioni, nessun overflow;
- Metodo Draft desktop: API raggiungibile, 0 pick e stato vuoto corretto,
  nessun errore di rete o numero inventato;
- due pulsanti download ancora `aria-disabled=true` e `DOWNLOAD_URL=null`.

## Prima della pubblicazione

1. aggiungere un contatto privacy dedicato;
2. completare Draft reali Premier/Quick/Prendi Due;
3. decidere e creare la release pubblica soltanto quando la beta è pronta;
4. impostare allora `DOWNLOAD_URL`;
5. riesaminare diff, commit e push;
6. pubblicare prima un'anteprima Pages e infine collegare `moxtracker.app`.
