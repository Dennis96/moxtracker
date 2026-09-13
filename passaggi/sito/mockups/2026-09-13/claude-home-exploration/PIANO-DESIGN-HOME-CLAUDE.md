# Home MOX — piano di design dell'esplorazione Claude

Data: 13/09/2026. Base: V2 sul branch `codex/site-mockups-redesign-2026-09-13`
(`84c6af9`). La V3 non è usata. `sito/**` non viene toccato.

Metodo seguito, su richiesta dell'utente: il flusso proposto su Reddit da
DasBlueEyedDevil. Cookbook *prompting for frontend aesthetics* letto; wireframe
A/B/C in `wireframes/`; brainstorming una domanda alla volta (skill Superpowers
`brainstorming`); poi le due passate della skill `frontend-design` (piano con
token, revisione contro il brief, costruzione, autocritica con screenshot). I
due plugin non erano installati nella sessione del 13/09: i passi 1–5 sono
stati fatti applicando a mano i testi ufficiali delle skill.

**Il passo 6 è sospeso per scelta dell'utente**: va eseguito con il plugin vero
(`/frontend-design:frontend-design`) in una sessione nuova, a partire da
questo piano e da `wireframes/hero-wireframes.png`. `index.html` in questa
cartella è una bozza manuale incompleta (senza `style.css`): non è l'output
del plugin e non va usata come base. I ritagli reali pronti sono in
`assets/`.

## Decisioni dell'utente

1. **Struttura A — il tavolo di lavoro.** Client Home protagonista, i tre
   strumenti sotto.
2. **Il titolo deve spiegare che cos'è MOX.** Né «Gioca meglio. Capisci di
   più.» né «Il tuo tavolo di lavoro per MTG Arena».

## Soggetto, pubblico, compito

- Soggetto: MOX, programma per Windows che affianca MTG Arena leggendo i log,
  più il sito moxtracker.
- Pubblico: giocatori di Arena, Constructed e Draft, che conoscono già tracker
  e strumenti Draft.
- Compito della Hero: in cinque secondi far capire che cos'è, che fa tre cose
  diverse, che esiste davvero; poi farlo scaricare.

## Copy della Hero

Titolo:

> MOX è un assistente per MTG Arena che lavora sul tuo PC, accanto al gioco.

Sottotitolo:

> Mentre giochi conta le carte che restano nel tuo mazzo. Nel Draft ti
> suggerisce la scelta e ti propone il mazzo finale. Dopo, conserva i tuoi
> mazzi e le statistiche delle partite. Sul web trovi il Meta, i dati Draft e
> il tuo account.

CTA: `Scarica MOX` (primaria), `Esplora il Meta` (secondaria).
Riga sotto le CTA: `Per Windows · beta pubblica · download da GitHub`.

Ogni frase corrisponde a una funzione presente oggi: Contatore («Le carte che
restano nel mazzo, mentre giochi», testo del client), Assistente al draft
(propone la scelta e costruisce il mazzo), I tuoi mazzi (elenchi, statistiche,
partite), sito (Meta, Draft, Account). Parole evitate: «companion» (troppo
vicino a «MTG Companion», vietato in `mox-core/CLAUDE.md`), «il migliore»,
«IA», «gratis» (il modello premium non è deciso).

## Token

Colore — i valori del sito attuale (`sito/css/tokens.css`), per tenere il 50%
di identità:

| Nome | Hex | Ruolo |
|---|---|---|
| Inchiostro | `#07080d` | fondo pagina |
| Tavolo | `#14131d` | superfici, cornici degli screenshot |
| Viola MOX | `#7c2cff` | CTA primaria, focus, filo delle cornici |
| Lilla | `#c9a2ff` | link e dettagli su fondo scuro |
| Verde contatore | `#61dd79` | solo il segno «reale»: lo stesso verde dei conteggi nel tracker |
| Testo / grigio | `#f7f5fb` / `#a7a6b2` | testo e testo secondario |

Tipografia:

- **Spectral** 600/700 per titoli: una serif da schermo che richiama il testo
  delle carte senza fare fantasy. Il titolo è una frase che spiega, e in serif
  si legge come una frase, non come uno slogan.
- **Hanken Grotesk** 400/600 per testo, CTA, didascalie, con cifre tabellari.
- Scala: 60 / 40 / 28 / 20 / 16 / 13 px. Righe di testo sotto i 70 caratteri.

## Layout

```
+------------------------------------------------------------------+
| MOX  Home Meta Draft Account Supporto  IT/EN        [Scarica MOX] |
+------------------------------------------------------------------+
|                          +-------------------------------------+ |
| MOX è un assistente      |  CLIENT MOX HOME (screenshot reale)  | |
| per MTG Arena che        |  marchio, mascotte, stato, strumenti | |
| lavora sul tuo PC,       |                                      | |
| accanto al gioco.        |  ....parte bassa vuota del client....| |
|                          +--+--------+--+--------+--+--------+--+ |
| sottotitolo (4 righe)       |CONTATORE|  | DRAFT  |  | MAZZI  |    |
|                             | 63:88   |  | 63:88  |  | 63:88  |    |
| [Scarica MOX] [Meta]        |         |  |        |  |        |    |
| Windows · beta · GitHub     +---------+  +--------+  +--------+    |
|                             icona+nome   icona+nome  icona+nome     |
+------------------------------------------------------------------+
```

- Testo allineato a sinistra, colonna 5/12; visual 7/12.
- Il client è mostrato alla sua risoluzione o sotto (928 px nativi), mai
  ingrandito.
- Le tre carte si sovrappongono solo alla fascia bassa vuota del client: non
  coprono nessun dato. Ritagli:
  - Contatore: `mox-tracker-ingame-narrow-a.png`, pannello «MOX - MAZZO» con
    «Restano 31 carte su 40 · 14 terre · turno 4»;
  - Assistente al draft: `mox-draft-pick-live-narrow-a.png`, intestazione e
    prime scelte con percentuale;
  - I tuoi mazzi: `mox-local-decks-development.png`, lista confrontata con la
    collezione.
- Sotto ogni carta: l'icona vera dello strumento, ritagliata dal client, e il
  suo nome come compare nel client.
- Atmosfera: dietro il client, la sua stessa illustrazione di testata, sfocata
  e a bassa opacità. Nessuna immagine estranea al prodotto.
- Movimento: un solo momento al caricamento — il client, poi le tre carte una
  dopo l'altra, nell'ordine degli strumenti. Rispetta `prefers-reduced-motion`.

## Sotto la Hero

Stessa struttura approvata, stessi token, meno peso:

1. Cosa fa MOX — quattro momenti, ognuno con uno screenshot reale grande e
   testo breve (copy della chat di coordinamento per «Durante la partita»).
2. MOX sul web — Meta, Draft, Il mio MOX, con le schermate reali del sito.
3. In sviluppo — MOX Research, Draft Assistant Next Gen, nuova UI Tauri; senza
   date, bordo tratteggiato, etichetta «In sviluppo», nessuna UI simulata.
4. Pianificato — i cinque punti, solo testo, etichetta «Pianificato».
5. CTA finale e footer.

## Revisione contro il «default generico»

Cosa avrei prodotto per qualunque sito di un tracker, e cosa cambia qui:

- titolo sans nerissimo con una parola colorata → frase che spiega, in serif,
  tutta dello stesso colore;
- screenshot circondato da schede satellite sparse → tre carte allineate che
  sono gli strumenti del client, con le icone del client;
- etichetta ALL-CAPS sopra il titolo → riga utile sotto le CTA (sistema,
  stato beta, provenienza del download);
- pulsanti con gradiente e freccia → pulsante viola pieno che dice che cosa
  fa;
- card identiche con ombra uguale → cornici diverse per gerarchia: il client
  ha la cornice forte, le carte una leggera, il futuro solo il tratteggio.

## Principi

1. Il software parla per primo: niente è più luminoso degli screenshot.
2. Una sola audacia: le tre carte che escono dal client.
3. Parole semplici: dire che cos'è e che cosa fa, nessuno slogan.
4. Reale e futuro sempre distinguibili a colpo d'occhio.
