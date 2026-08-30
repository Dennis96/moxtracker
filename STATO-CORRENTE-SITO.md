# Stato corrente — sito Mox

Aggiornato: 30 agosto 2026, dopo riconciliazione con la cronologia Git.

## Regola operativa obbligatoria

Dopo ogni modifica conclusa e **dopo ogni deploy preview riuscito**, aggiornare
subito questo file, nella stessa sessione di lavoro. Registrare commit, URL,
modifiche effettivamente pubblicate, test eseguiti e ciò che **non** è stato
modificato. La chat successiva legge questo file prima di proporre o eseguire
nuovo lavoro. Non creare handoff alternativi: questo è l'unico stato operativo
del sito.

## Ultima preview pubblicata

- Data: 30 agosto 2026.
- Commit sito: `149675b` — `Rafforza home, immagini e traduzioni beta`.
- URL alias: <https://preview.moxtracker.pages.dev>.
- URL immutabile: <https://f26f82de.moxtracker.pages.dev>.
- Build: `a96049cdb7bbeeae`, 62 file.
- Verifica: `npm run prove` — 187/187; `npm run sito:build` riuscito;
  smoke test HTTP 200 su `/`, `/draft`, `/account`, `/supporto`, `/privacy`,
  `/en/`.
- Verifica visiva: Home e Download desktop/360 px, menu mobile con Escape,
  reflow senza overflow a 640 CSS px (equivalente operativo del 200% su
  desktop), focus visibile, `prefers-reduced-motion` e miniature Scryfall
  caricate soltanto entrando in viewport.

## Modifiche presenti in preview

- Carte: miniature orizzontali in elenco; anteprima carta completa solo su
  hover, focus tastiera o tap.
- Dettaglio variante: curva mana a barre, colori come simboli mana, tipi e
  terre speciali/fixing.
- Download: il pulsante interroga la release GitHub **Latest** al clic e segue
  direttamente il suo asset `.zip`; non fissa una versione e non usa
  l'installer dell'autoupdate. La CSP consente la sola chiamata a
  `https://api.github.com` necessaria a risolverlo.
- Home e Download: il messaggio parte da tracker, Draft e statistiche locali;
  la contribuzione anonima è secondaria e revocabile. La pagina Download
  mostra anche la release Latest già risolta, senza fissare una versione.
- Research: copy e layout di un teaser sono pronti ma nascosti; nessuna
  promessa o funzione Research è pubblicata finché R1 non congela il contratto
  dati. Il campo `apertura` non è stato rinominato né reinterpretato.
- Carte: in assenza di `IntersectionObserver`, ad esempio in un browser
  embedded, il fallback avvia le richieste solo vicino alla viewport e le
  distanzia a massimo circa nove al secondo.
- Account: rimosso il comando `Esporta .txt`; resta `Copia per Arena`.
- Collaudi manuali: ZIP diagnostico Mox già superato; Ticket anonimo/Turnstile,
  revoca dispositivo, export JSON e cancellazione restano regressioni da
  ripetere. Cambio stato, risposta e `ticket_audit` nell'amministrazione sono
  la priorità, perché non ancora confermati manualmente dopo la correzione.

## Cronologia delle modifiche di questa sessione

- `595d5b2` — nuovo profilo del mazzo (curva e simboli mana), download ZIP
  dinamico e riordino della documentazione attiva/storica.
- `4e7549e` — corretto un errore del renderer che lasciava il profilo bloccato
  su “Calcolo curva…”.
- `f705ff3` — aggiunta `https://api.github.com` alla CSP: senza questa origine
  autorizzata il pulsante Download non poteva risolvere lo ZIP Latest.
- `02db6c9` — aggiunto questo file di stato e la regola di aggiornarlo dopo
  ogni preview.
- `99326d3` — rimossi `QUESTIONARIO-SITO-MOX.html`,
  `COLLEGA-CLOUDFLARE.bat` e il file locale ignorato
  `mazzo-419fdf15.json`; nessuno dei tre era usato dal sito.
- `149675b` — Home/Download orientati al valore personale, pagina Download
  IT/EN, traduzioni Supporto dinamiche, fallback immagini in viewport e
  checklist manuali riconciliate. Preview `f26f82de` verificata.

## Confini non modificati

- Nessun deploy produzione.
- Nessun deploy Worker.
- Nessuna migrazione D1 e nessuna modifica ai dati di produzione.

## Prossimo lavoro

1. Collaudo manuale amministrazione: ticket, cambio stato, risposta e due
   eventi in `ticket_audit`.
2. Ripetere sull'account di prova Ticket anonimo/Turnstile, revoca, export e
   cancellazione; lo ZIP Mox è soltanto un controllo rapido.
3. Eventuali implicazioni R1 vanno annotate come bozza, senza implementare
   schema, ingestion o backend prima di `MOX-RESEARCH-DATA-CONTRACT`.
