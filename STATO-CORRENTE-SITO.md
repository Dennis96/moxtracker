# Stato corrente — sito Mox

Aggiornato: 29 agosto 2026, dopo il deploy preview.

## Regola operativa obbligatoria

Dopo ogni modifica conclusa e **dopo ogni deploy preview riuscito**, aggiornare
subito questo file, nella stessa sessione di lavoro. Registrare commit, URL,
modifiche effettivamente pubblicate, test eseguiti e ciò che **non** è stato
modificato. La chat successiva legge questo file prima di proporre o eseguire
nuovo lavoro. Non creare handoff alternativi: questo è l'unico stato operativo
del sito.

## Ultima preview pubblicata

- Data: 29 agosto 2026.
- Commit sito: `f705ff3` — `Consente download ZIP GitHub dal sito`.
- URL: <https://preview.moxtracker.pages.dev>.
- Test: `npm run prove` — 187/187 superati.

## Modifiche presenti in preview

- Carte: miniature orizzontali in elenco; anteprima carta completa solo su
  hover, focus tastiera o tap.
- Dettaglio variante: curva mana a barre, colori come simboli mana, tipi e
  terre speciali/fixing.
- Download: il pulsante interroga la release GitHub **Latest** al clic e segue
  direttamente il suo asset `.zip`; non fissa una versione e non usa
  l'installer dell'autoupdate. La CSP consente la sola chiamata a
  `https://api.github.com` necessaria a risolverlo.
- Account: rimosso il comando `Esporta .txt`; resta `Copia per Arena`.
- Documentazione: i passaggi superati sono in
  `archivio/2026-08-passaggi-e-piani-superati/`.

## Confini non modificati

- Nessun deploy produzione.
- Nessun deploy Worker.
- Nessuna migrazione D1 e nessuna modifica ai dati di produzione.

## Prossimo lavoro

Seguire le priorità approvate in
[RISPOSTE-PROSSIMA-CHAT-SITO-MOX.md](RISPOSTE-PROSSIMA-CHAT-SITO-MOX.md),
partendo da A1/A2 soltanto dopo verifica visiva della preview corrente.
