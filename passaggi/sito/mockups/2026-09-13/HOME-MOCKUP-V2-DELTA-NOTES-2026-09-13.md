# Home mockup V2 — delta

## Asset reali riutilizzati

- `sito/assets/mox-draft-scelta.png`: Draft Assistant durante la scelta.
- `sito/assets/mox-draft-mazzo.png`: deck builder finale con lista, colori, curve e fonti.
- `source-home-current-full.png`: Home corrente renderizzata localmente; la preview Meta usa il suo Meta Explorer reale.
- `source-draft-web-current-real.png`: pagina Draft corrente renderizzata localmente.
- `source-account-current-real.png`: pagina Account corrente renderizzata localmente, nello stato pubblico di accesso.

Tutti gli screenshot locali provengono dalla preview del frontend esistente; non contengono dati personali e non sono modifiche a `sito/**`.

## Asset mancanti e placeholder

- Non è presente nel repository una schermata reale, pulita e riutilizzabile del tracker/client in partita o dell’overlay. La Home usa quindi il placeholder etichettato `SCREEN REALE DA SOSTITUIRE`; serve uno screenshot del client durante una partita, privo di identificativi personali.
- Non è disponibile una schermata autenticata reale di Account con cronologia, rank e risultati. La Home mostra lo stato Account reale corrente e dichiara il limite nella didascalia.
- Non sono emersi prototipi o screenshot Tauri riutilizzabili. Il relativo riquadro è un `CONCEPT · IN SVILUPPO`.

## Stato delle funzioni rappresentate

- **Reale ora:** tracker/archivio locale di partite e mazzi, Draft Assistant, proposta deck building finale, Meta Explorer con filtri e soglie, Draft sul web, Account.
- **In sviluppo:** MOX Research, Draft Assistant Next Gen, nuova interfaccia Tauri. Le card sono marcate come tali e non mostrano output spacciati per reali.
- **Pianificato:** collection/wildcards, verifica costruibilità del mazzo, condivisione mazzi. I dati wildcard sono sintetici e ogni card è marcata `PIANIFICATO · CONCEPT`.

## Modifiche alla proposta Home

La variante A resta la base: titolo e CTA a sinistra, software al centro della composizione a destra. La UI sintetica con consigli di gameplay è stata rimossa. La pagina è ora una singola landing verticale: hero, prodotto, web, sviluppo, pianificato, CTA finale e footer.
