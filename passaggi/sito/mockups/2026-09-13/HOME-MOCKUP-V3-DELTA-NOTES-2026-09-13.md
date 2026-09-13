# Home mockup V3 — delta

## Versione finale da aprire

- Prototipo: `home-v3.html`
- Export desktop: `home-full-v3.png`, `home-hero-v3.png`, `home-features-v3.png`
- Viewport di riferimento: 1440 px

## Screenshot reali usati

Le copie originali fornite per questa iterazione sono archiviate in `references/` con nomi descrittivi. La Home usa in particolare:

- tracker in partita: `mox-tracker-ingame-wide.png`;
- Draft Assistant durante un pick: `mox-draft-pick-live-wide.png`;
- schermata principale del client: `mox-client-home-tools.png`;
- mazzi locali e sviluppo: `mox-local-decks-development.png`;
- statistiche dei mazzi: `mox-local-decks-statistics.png`;
- collezione e risorse: `mox-dashboard-status-resources.png`;
- opzioni, consensi e collegamenti: `mox-options-consents-and-links.png`.

Per le superfici pubblicabili è stata aggiunta `references/usable/`: contiene una copia pronta all'uso di ogni screenshot fornito, con gli identificativi visibili oscurati quando presenti. I crop `mox-tracker-hero-ready.png`, `mox-tracker-story-ready.png` e `mox-draft-pick-story-ready.png` sono ottimizzati per le proporzioni effettive delle card della Home: preservano il tracker o il Draft Assistant ed eliminano le barre profilo. Le sorgenti restano invariate in `references/`.

## Cosa racconta meglio questa versione

- Il tracker è ora la schermata dominante della Hero, con preview reali di Draft, mazzi locali e client.
- “Durante la partita” unisce tracker live e archivio locale: mazzi, risultati e cronologia restano sul PC; non vengono promessi consigli di gioco.
- Draft e fase successiva distinguono chiaramente lista/curva/sviluppo copia disponibili oggi da un futuro editor più profondo.
- Collezione aggiornata, risorse, mazzi locali, carte, partite e statistiche hanno una sezione dedicata.
- Opzioni chiarisce preferenze, consensi separati, diagnostica e il collegamento facoltativo fra client, account e sito.
- “MOX sul web” esplicita che il client resta utilizzabile senza account e che le aree personali web dipendono dal collegamento scelto.

## Confine reale / futuro

Le card in `IN SVILUPPO` e `PIANIFICATO` restano concept. In particolare MOX Research non è aperto né disponibile: G5 è `FAIL/BLOCKED` e R3 è `NON APERTO`. Non sono presenti claim su ingestion, analytics pubbliche o Personal Optimizer.

## Approvazione

Non restano blocker di contenuto o layout per la revisione della Home. Il passo successivo è la review finale: approvazione, ultimi ritocchi oppure autorizzazione separata a implementare il redesign in `sito/**`.
