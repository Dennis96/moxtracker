# Stato corrente — sito Mox

Aggiornato: 31 agosto 2026, release candidate locale in preparazione, senza preview.

## Regola operativa obbligatoria

Dopo ogni modifica conclusa e **dopo ogni deploy preview riuscito**, aggiornare
subito questo file, nella stessa sessione di lavoro. Registrare commit, URL,
modifiche effettivamente pubblicate, test eseguiti e ciò che **non** è stato
modificato. La chat successiva legge questo file prima di proporre o eseguire
nuovo lavoro. Non creare handoff alternativi: questo è l'unico stato operativo
del sito.

## Ultima preview pubblicata

- Data: 30 agosto 2026.
- Commit sito: `5ad5b38` — `Corregge storico e pool Draft account`.
- URL alias: <https://preview.moxtracker.pages.dev>.
- URL immutabile: <https://73002141.moxtracker.pages.dev>.
- Build: `6d537962ffff0887`, 63 file.
- Verifica: `npm run prove` — 189/189; `npm run sito:build` riuscito;
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
- Account → Draft: le tracce e gli storici Limited sono ordinati per la data
  reale della fonte. Una partita con `draft_link` compare solo nella traccia
  esatta; i log senza link sono dichiarati come raggruppamento cronologico,
  non come risultato di un singolo Draft. Il pool finale aggrega le copie per
  Arena ID senza alterare i Draft salvati.
- Collaudi manuali: ZIP diagnostico Mox già superato; Ticket anonimo/Turnstile,
  revoca dispositivo, export JSON e cancellazione restano regressioni da
  ripetere. Cambio stato, risposta e `ticket_audit` nell'amministrazione sono
  la priorità, perché non ancora confermati manualmente dopo la correzione.

## M6 e R3-PREP — locali, non pubblicati

Il branch locale contiene commit non spinti oltre `origin/main`, una sola
worktree e nessun push o deploy, nemmeno preview. L'ultima preview elencata
sopra non contiene questa release candidate.

- **M6 verificato localmente:** Account mostra «Ultima mano osservata» /
  «Last observed hand», conteggio delle carte e nota esplicita che il dato
  legacy non è la mano d'apertura. Campo assente: nessuna sezione inventata.
- Descrizione cronologia, Privacy e Cosa invia Mox aggiornate in IT/EN;
  documentazione API chiarita. `apertura` conserva nome tecnico e contenuto,
  anche negli export. Cambia soltanto il testo dell'errore di validazione:
  «campo legacy apertura non valido»; versioni e limiti invariati.
- **R3-PREP consegnato come proposta:**
  [schema logico e opzioni di storage](R3-PREP-SCHEMA-STORAGE.md), senza SQL
  eseguibile. D1/Cloudflare R2 ed eventuale payload privato restano scelte
  aperte fino all'output reale R2 e al golden packet concordato. L'arrivo
  degli artefatti non autorizza automaticamente ingestion o rilascio.
- Verifiche: `npm run prove` **189/189**, `npm run sito:build` riuscito,
  build locale **`433a5bbaedee7770`**, 63 file. Confronto del validatore con
  HEAD su **36 casi**: stesso esito salvo il testo legacy, stessi input e
  righe serializzate. Worker con SQLite solo in memoria: v1/v2 HTTP 200,
  v3 HTTP 400; apertura non valida HTTP 400 col messaggio corretto e nessun
  record inserito. Nessuna esecuzione su D1 locale o remoto.
- Browser locale, dati sintetici: Account IT/EN con `apertura` presente
  (2 copie + 1 copia, titolo con totale 3) e assente; carte e nota corrette,
  assenza senza mano vuota. Verifica visiva desktop e testo Privacy EN.
  Il banco temporaneo `.dist/m6-collaudo.mjs` è ignorato da Git e fuori
  dalla build del sito; non è un output Research o una fixture R2.
- I quattro WIP Account/Draft sono stati revisionati e raccolti nel commit
  `e2689a5`: nessun reset o stash. Client, contratto R1, dati storici, schemi,
  configurazione cloud e consensi non modificati. Nessuna ingestion v3.

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
- `5ad5b38` — corretto Account → Draft e pubblicata la preview `73002141`.
  Verifiche: `npm run prove` 189/189, build di 63 file e smoke HTTP 200 su
  `/`, `/draft`, `/account`, `/supporto`, `/privacy`, `/en/`.
- `e2689a5` — esclusi dall'Account gli indici Draft difettosi con `0 pick`,
  senza nascondere le partite storiche collegate.
- `3e8451a` — chiarito il campo legacy `apertura` come ultima mano osservata,
  senza modificare il contratto v1/v2.
- `6414c57` — corrette route di anteprima, link amministratore inglese e
  smoke del download GitHub Latest; report R0 aggiunto.
- Locale, non pubblicato — un indice Draft con `0 pick` e' difettoso anche se
  una vecchia fonte lo marca come completo: viene escluso dal frontend e dalle
  risposte Account. L'eventuale partita collegata resta nello storico senza
  traccia, per non nascondere dati reali. Verifiche: `npm run prove` 189/189 e
  `npm run sito:build` (build `5f8c9def5df0aa09`, 63 file).

## Confini non modificati

- Nessun deploy produzione.
- Nessun deploy Worker.
- Nessuna migrazione D1 e nessuna modifica ai dati di produzione.

## Prossimo lavoro

1. Collaudo manuale amministrazione: ticket, cambio stato, risposta e due
   eventi in `ticket_audit`.
2. Ripetere sull'account di prova Ticket anonimo/Turnstile, revoca, export e
   cancellazione; lo ZIP Mox è soltanto un controllo rapido.
3. R3-PREP resta una proposta: attendere modello locale R2, golden packet
   concordato e dimensioni reali prima di riesaminare schema e storage.
   Nessuna modifica D1, ingestion v3 o produzione; successivi interventi e
   rilasci richiedono decisioni separate, non il solo arrivo degli artefatti.
4. Da verificare prima di ogni intervento su `draft_link`: un match viene
   collegato solo con la stessa impronta Draft esatta. Esaminare i casi in cui
   match e traccia arrivano in ordine inverso, i pacchetti v1 o privi di
   impronta e le impronte non coincidenti. Non dedurre collegamenti da data,
   set o formato; un'eventuale riconciliazione dovra' usare soltanto
   l'impronta esatta e richiedera' autorizzazione separata per il Worker.
