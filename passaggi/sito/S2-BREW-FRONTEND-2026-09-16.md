# S2 — presentazione frontend dei gruppi Brew (F1)

Scritto il 16 settembre 2026 sul branch `claude/s2-brew-frontend-2026-09-16`,
creato da `8a3cfe7`: S1 finale `17a3ca0` più il solo report della review
indipendente.

**Cosa tocca e cosa no.** Il lavoro riguarda soltanto sito, prove, documenti e
il banco sintetico dell'anteprima. Non tocca `src/`, lo schema, le migrazioni,
il clustering o k. Nessun merge, deploy Worker o Pages, D1 remoto o accensione
di `BREW_GRUPPI`. S3 non è iniziato.

Contratto consumato:
[S1-BREW-CONTRATTO-B1-2026-09-15.md](S1-BREW-CONTRATTO-B1-2026-09-15.md).

## 1. Preflight S1, sull'HEAD esatto `8a3cfe7`

- `8a3cfe7` ha come genitore `17a3ca0`. Il delta fra i due è il solo
  `passaggi/sito/audit/S1-BREW-BACKEND-INDEPENDENT-REVIEW-CODEX-2026-09-16.md`.
- Worktree nuova e pulita; la cartella `moxtracker` resta su `main`.
- Le quattro suite Brew (`brew-clustering`, `brew-gruppi`, `brew-meta`,
  `brew-cancellazione`) passano **53/53**.
- `npm run prove` passa **405/405**: 0 falliti, 0 saltati, 0 cancellati.
- `npm run sito:build` produce la build `346ce2023c50e91c`, di 91 file.
- `node strumenti/brew_gruppi.mjs --help` stampa l'uso ed esce con codice 0.

La prima condizione della review S1 (rieseguire i test in un checkout
affidabile) è chiusa. La seconda, cioè che il corpus reale usato per k=4 non è
versionato, resta un limite documentale e non blocca S2.

## 2. Il frontend prima di S2

Riporto solo quello che ha deciso l'implementazione.

- **Meta.** «Altro (Brew)» ha un pulsante che apre righe e schede figlie: una
  per ogni `varianti_brew` («Brew #N», con link per impronta) più il
  riepilogo sotto soglia. Con i gruppi di S1, due liste dello stesso gruppo
  sarebbero rimaste due Brew separati.
- **Impronta visibile.** Il codice del Meta stampava «ID tecnico» con 8
  caratteri dell'impronta per le righe non classificate. Con l'API attuale non
  scattava, ma violava la regola.
- **Dettaglio.** Tutto ciò che non era `non_classificato` veniva trattato come
  archetipo riconosciuto: un `brew_group` avrebbe mostrato catalogo, «ID»
  delle varianti e una barra «0 liste sotto soglia».
- **Etichette per indice.** Il dettaglio usava etichette come «Variante
  osservata #N», e la copia per Arena di un Brew usava «Brew #N».
- **Selezione della variante.** `?variante=` accettava solo 12 caratteri
  esadecimali.
- **Inglese.** Nella pagina inglese le metriche delle varianti («45 partite»,
  «27 V / 18 S») e il record in cima restavano in italiano, anche per gli
  archetipi. Mancava anche la traduzione di «Quota nel filtro corrente».

## 3. Contratto consumato e fallback

- **Gruppi del server.** Il sito li usa solo se
  `raggruppamento_brew.disponibile === true` e `gruppi_brew` è un array
  (`brewGroups` in `sito/js/meta-model.js`).
- **Fallback.** In ogni altro caso il sito torna alle vecchie `varianti_brew`,
  identiche a prima. Worker e sito si promuovono o si riportano indietro
  separatamente.
- **Campi letti dai gruppi:**
  - `gruppo_brew_id` e `in_attesa_di_raggruppamento`;
  - `partite`, `vittorie`, `sconfitte`, `win_rate`, `quota_meta`,
    `record_pubblico` e `dati_sufficienti`;
  - il numero di `varianti_brew`, e la loro `impronta` solo per il link legacy
    di un gruppo in attesa;
  - `brew_sotto_soglia`.
- **Campi letti dal dettaglio:**
  - `tipo_dettaglio: "brew_group"`, `soglia_distanza` e `soglia_percentuali`;
  - per ogni variante: `variante_id`, `rappresentante`,
    `distanza_rappresentante`, `decklist_pubblicabile` e `carte`.
- **Campi letti dalla risposta legacy:** `gruppo_brew_id` e
  `variante_brew_id`.
- **Niente clustering nel browser.** Nessuna distanza, confronto di decklist,
  unione o divisione di gruppi. Una prova controlla che il codice del sito non
  contenga logica del genere.
- **Contratto S1 sufficiente.** Non è servita nessuna modifica al backend.

## 4. Meta

- **Una riga per gruppo** (desktop) e **una scheda per gruppo** (mobile), dentro
  l'apertura di «Altro (Brew)» di sempre:
  - nome «Gruppo Brew»;
  - sotto, «N varianti pubblicate», oppure «Lista pubblicata, non ancora
    raggruppata» per un gruppo in attesa;
  - partite, V/S, win rate e quota presi dal server, senza ricalcoli.
- **Varianti subordinate.** Le varianti di un gruppo stanno nel dettaglio del
  gruppo: nel Meta non compaiono accanto come Brew separati.
- **Link.** «Apri» porta a `archetipo.html?formato&rank&periodo&id_brew&modalita`.
  Un gruppo in attesa, senza id, usa il vecchio link per impronta.
- **Un solo riepilogo** «N liste sotto soglia», con «Dati e decklist non
  pubblicati» e la nota che le liste sotto soglia non vengono attribuite ai
  gruppi. Niente link, percentuali, id o impronte.
- **Pulsante.** Mostra «N gruppi», oppure «N liste» se ci sono solo liste
  sotto soglia. L'etichetta accessibile dice tutto, per esempio «2 gruppi e 5
  liste sotto soglia di Altro (Brew)».
- **«ID tecnico» tolto** dal Meta.
- **Etichette.** Nessun «Brew #N» come nome, perché cambierebbe con filtri e
  ordine. Tutti i gruppi si chiamano «Gruppo Brew»: un nome distintivo e
  stabile richiederebbe un campo server che S1 non espone (§11). A distinguerli
  per chi usa uno screen reader ci pensa l'etichetta del link, «Apri gruppo
  Brew da 79 partite».

## 5. Dettaglio del gruppo (`?id_brew=`)

- **Testata.** Titolo «Gruppo Brew», con i tag «Archetipo non ancora
  confermato» e «Liste simili raggruppate».
- **Metriche e nota.** Le metriche sono quelle del gruppo. La nota di S1 è
  scritta in parole semplici: liste che differiscono al massimo di k carte del
  mazzo principale dalla rappresentativa, e compaiono solo quelle da 30
  partite nel filtro.
- **Varianti.** Si chiamano «Variante rappresentativa» se
  `rappresentante === true`, altrimenti «Variante simile». La distanza («4
  carte diverse dalla rappresentativa») compare solo se il server la
  pubblica. Nessun ID.
- **Decklist.** Decklist, «Copia per Arena» e profilo compaiono solo con
  `decklist_pubblicabile === true`. Il nome copiato in Arena è «Brew MOX»,
  senza indici.
- **Pannelli esclusi.** Niente pannello catalogo e niente barra di
  ripartizione, che affermerebbe un «0 sotto soglia» non pubblicato.
- **Selezione della variante.** `?variante=bv_…` apre quella variante;
  aprirne o chiuderne una aggiorna l'URL con `replaceState`. Una variante non
  presente nel filtro corrente dà il messaggio di sempre, senza richieste
  laterali.
- **Altri percorsi.** Archetipi riconosciuti e dettaglio legacy restano quelli
  di prima. Cambiano solo le metriche inglesi, ora in inglese, e il nome
  copiato in Arena per la lista legacy, ora senza indice.

## 6. URL canonici

- **`fetchArchetipo`** accetta `id`, `id_brew` o `impronta`, uno solo;
  `detailIdentifier` fa lo stesso controllo sull'URL della pagina.
- **Vecchio `?impronta=`.** Se la risposta pubblicabile porta un
  `gruppo_brew_id` valido, il sito chiede il gruppo con gli stessi filtri.
  `canonicalBrewUrl` costruisce l'URL canonico: toglie `impronta`, aggiunge
  `id_brew` e `variante=bv_…` se quella lista è nel gruppo, e tiene tutti i
  filtri. Poi `history.replaceState` e il render del gruppo. Se manca
  qualcosa, o il gruppo non risponde, resta il percorso legacy senza errori.
- **Nessun `pushState`.** «Indietro» torna alla pagina precedente, non al
  vecchio URL. Ricaricare l'URL canonico mostra lo stesso contenuto. Entrambe
  le cose sono verificate nel browser.

## 7. Privacy frontend

- **Niente identificativi visibili.** Impronte, `bg_`, `bv_` e «Brew #N» non
  compaiono in testo, `aria-label` o `title`. Lo verificano le prove e un
  controllo automatico durante gli screenshot. Gli id stanno solo negli `href`.
- **Nessun ricalcolo.** Una prova usa un win rate di gruppo volutamente
  incoerente con V/S e pretende che il sito mostri quello del server.
- **Nessuna inferenza sotto soglia.** Nessuna sottrazione, nessun conteggio di
  varianti nascoste per gruppo, nessun link a dati sotto soglia.
- **Copia per Arena** senza id né impronte.

## 8. Accessibilità, mobile, i18n

- **Controlli.**
  - Pulsanti separati dai link, e nessun link o pulsante dentro un altro:
    lo controlla una prova.
  - `aria-expanded` e `aria-controls` restano coerenti su desktop e mobile.
  - Il focus resta sul pulsante dopo l'apertura: verificato nel browser.
- **375 px.** Nessun overflow orizzontale su Meta e dettaglio, in italiano e in
  inglese: verificato nel browser e misurato a ogni screenshot.
- **Inglese.** I testi con numeri nascono già nella lingua della pagina, con
  il singolare e il plurale corretti. Le chiavi nuove in `en.json` coprono il
  nuovo errore di identificativi multipli e «Quota nel filtro corrente».
- **Stati di caricamento, vuoto ed errore** restano quelli di prima e sono
  provati.

## 9. Prove

- **Suite nuova.** `prove/brew-frontend.test.js` ha 19 prove:
  - A: una riga per gruppo, link `id_brew` con filtri, riepilogo unico,
    apertura e chiusura, ARIA e nessun controllo annidato;
  - B: tutto pubblico; C: tutto sotto soglia; D: gruppo in attesa con link
    legacy; E: payload vecchio;
  - inglese e singolare; stati vuoto ed errore;
  - contratto senza clustering; URL di dettaglio; id delle varianti;
    identificativo unico;
  - canonicalizzazione reload-safe; etichette e distanza;
  - `fetchArchetipo`; testi inglesi del dettaglio; collegamenti del dettaglio.
- **Prove aggiornate** perché controllavano con una regex il codice vecchio:
  - `meta-brew-ui`: ID solo per gli archetipi riconosciuti, e il nome copiato
    in Arena senza indice;
  - `frontend-privacy`: «ID tecnico» ora deve mancare;
  - `redesign-sito`: gli identificativi si leggono in `meta-model.js`, con
    `id_brew` in più.
- **Prova S1 riconvertita.** In `brew-meta.test.js` la prova sul frontend ora
  disegna il payload vero di S1 con il sito S2. Cambiano solo le attese, non
  il backend.
- **Esiti:**
  - quattro suite Brew backend: 53/53;
  - mirate S2: 55/55;
  - `npm run prove`: 424/424, 0 saltati;
  - `npm run sito:build`: build `54ae1e62b7792f95`, 91 file.
- **Browser.** Sull'anteprima locale con il banco sintetico, con la console
  pulita:
  - il vecchio link per impronta diventa canonico;
  - il reload mostra lo stesso contenuto;
  - «indietro» torna al Meta;
  - Meta e dettaglio funzionano in inglese a 375 px.

## 10. Screenshot sintetici

In `passaggi/sito/mockups/2026-09-16/s2-brew-frontend/`:

1. `01-meta-desktop-gruppi-brew-aperti.png`: due gruppi, il primo con due
   varianti, e il riepilogo di 5 liste sotto soglia;
2. `02-meta-mobile-375-gruppi-brew-aperti.png`;
3. `03-dettaglio-gruppo-brew-desktop.png`: variante simile aperta, con
   decklist, copia e profilo;
4. `04-dettaglio-gruppo-brew-mobile-375-en.png`;
5. `05-meta-desktop-en-riepilogo-sotto-soglia.png`.

Il banco usato è `banco-sintetico.json`, nella stessa cartella. Contiene solo
dati inventati. Le carte delle decklist sono nomi e ArenaId pubblici del
catalogo, usati per disegnare la pagina: non sono liste osservate. Per ogni
scatto sono stati misurati overflow, identificativi visibili e testo italiano
nelle pagine inglesi, sempre con esito zero.

Come rifarli:

```powershell
npm run sito:build
$env:MOX_BANCO_SINTETICO = "passaggi/sito/mockups/2026-09-16/s2-brew-frontend/banco-sintetico.json"
$env:MOX_API_ORIGIN = "http://127.0.0.1:9"
node strumenti/anteprima_sito.mjs
```

`MOX_API_ORIGIN` punta a un indirizzo morto: nessuna risposta arriva dall'API
vera. Nel banco, `strumenti/anteprima_sito.mjs` ora accetta anche chiavi con la
query, e servono a provare il passaggio legacy → canonico. Gli screenshot li ha
presi Edge headless via DevTools, con uno script locale fuori dal repository.

## 11. Limiti e residui

- **Nomi dei gruppi.** Tutti i gruppi si chiamano «Gruppo Brew». Un nome
  distintivo e stabile (colori o carte chiave) richiederebbe un campo server
  nuovo: è un tema per S3 o per il backend, non un'invenzione del sito.
- **Formati senza catalogo.** `?id_brew=` risponde 409, come `?impronta=`
  (contratto S1): il sito mostra l'errore del server.
- **Messaggi d'errore del server.** Restano in italiano anche nella pagina
  inglese, come già prima.
- **Metriche su 375 px.** Nel mobile inglese le metriche delle varianti vanno a
  capo su due righe. È un aspetto già presente, non un overflow.
- **Condizione S1.** Il corpus reale usato per k=4 non è versionato; resta un
  limite documentale.
