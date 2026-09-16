# S1-BREW-BACKEND — review indipendente ChatGPT — 2026-09-16

## Esito

**PASS WITH CONDITIONS**

Non ho trovato blocker di codice, privacy, compatibilità API, schema/migrazione, clustering, cancellazione o race nello scope S1-BREW-BACKEND. Le condizioni riguardano esclusivamente i limiti dell'evidenza indipendente disponibile in questa sessione: i comandi di test obbligatori non sono stati ri-eseguiti dal reviewer perché l'ambiente di esecuzione non può clonare GitHub e l'HEAD non ha CI associata; inoltre il piccolo corpus pubblico usato per motivare `k = 4` non è conservato nel repository, quindi il dato reale 56/60 e il report corpus k=3/4/5 sono verificabili qui soltanto come documentazione, non riproducibili dai soli artefatti versionati. Prima del merge è raccomandata una riesecuzione dei comandi indicati sotto in un checkout dell'HEAD esatto.

Nessun merge, deploy o accesso D1 remoto è stato eseguito.

## Stato verificato

- Repository: `Dennis96/moxtracker`
- Baseline: `75bcac460b13e0556a48d8ccb44dde431e3241fd`
- Branch revisionato: `claude/s1-brew-backend-2026-09-15`
- HEAD revisionato: `17a3ca0498e965db05e7eecd96a23c47ad757c87`
- Compare GitHub: `ahead`, 4 commit avanti, 0 indietro; merge-base esattamente sulla baseline dichiarata.
- Branch del solo report: `chatgpt/review-s1-brew-backend-2026-09-16`, creato direttamente dall'HEAD revisionato.

## File esaminati

Letti integralmente o nelle sezioni necessarie alla verifica:

- `passaggi/handoff/HANDOFF-S1-BREW-BACKEND-REVIEW-2026-09-15.md`
- `passaggi/sito/S1-BREW-CONTRATTO-B1-2026-09-15.md`
- `src/brew-clustering.js`
- `src/brew-gruppi.js`
- `src/lettura.js`
- `src/dettaglio-archetipo.js`
- `src/index.js`
- `src/draft.js`, percorso `eliminaMittente`
- `src/account.js`, cancellazione della sezione `partite`
- `schema.sql`, blocco Brew
- `migrazioni/2026-09-15-brew-gruppi.sql`
- `strumenti/brew_gruppi.mjs`
- `prove/brew-clustering.test.js`
- `prove/brew-gruppi.test.js`
- `prove/brew-cancellazione.test.js`
- fixture e coperture richiamate dai test Brew; per `brew-meta.test.js` sono state verificate le proprietà implementate direttamente nelle letture pubbliche e la documentazione del relativo set di casi, ma non è stato possibile rieseguire la suite.

È stato inoltre ispezionato il diff completo baseline→HEAD e verificato che il delta tocchi solo i file S1/documentazione correlati elencati dal compare.

## Findings per severità

### Blocker

Nessuno trovato.

### Issue non bloccanti

1. **Evidenza test non rieseguita dal reviewer.** L'ambiente locale della sessione non risolve `github.com`, quindi non è stato possibile ottenere un checkout eseguibile. L'HEAD non espone status CI da usare come sostituto indipendente. I test presenti sono stati letti e confrontati con il codice, ma non vanno descritti come rieseguiti da questa review.
2. **Evidenza empirica di `k = 4` non completamente riproducibile dal repository.** Le fixture sintetiche versionate verificano 59/60, 56/60, 55/60, falsi amici e catena; il documento riporta anche un corpus pubblico reale del 15/09 e le distanze 4/25/51/57, ma quelle liste non sono versionate. La scelta resta tecnicamente conservativa e coerente con lo scope “quasi-copie”, ma la parte corpus reale non è indipendentemente riproducibile dai soli artefatti finali.

### Osservazioni

- `applicaPiano` restituisce i conteggi pianificati anche se la pulizia finale, nello stesso batch, rimuove una membership diventata orfana per una cancellazione concorrente. Questo può consumare una quota del limite cron nel giro corrente, ma non altera lo stato persistente né crea orfani; non è una regressione materiale nello scope.

## Clustering e identità persistente

**PASS.**

- Firma costruita dal solo main deck (`carte_mazzo`) come multinsieme nome carta→copie; le terre restano incluse e il sideboard non entra.
- Le stampe note dello stesso nome vengono unificate; una carta non mappata resta `#ArenaId`, comportamento più conservativo.
- Distanza implementata come `max(eccesso A, eccesso B)`, coerente con sostituzioni e deck size diverse.
- `SOGLIA_DISTANZA_BREW = 4` e algoritmo versionato `main-multiset-radius-v1`.
- Piano a stella/raggio rispetto al rappresentante: non esiste single-linkage transitivo.
- Candidati ordinati deterministicamente per partite decrescenti e impronta; il limite prende un prefisso di tale ordine e i test sorgente confrontano i giri successivi con il piano completo.
- Una impronta può appartenere a un solo gruppo per `(formato, algoritmo)`.
- `bg_` e `bv_` sono 128 bit casuali, persistiti e non derivati dall'impronta.
- Nessun UPDATE applicativo delle tabelle Brew; trigger DB congelano gli UPDATE. La cancellazione privacy usa DELETE come eccezione esplicita e documentata.

## Privacy

**PASS sulla logica esaminata.**

- Una lista entra nella persistenza Brew solo dopo 30 partite complessive nel formato.
- `/meta` inserisce nei `gruppi_brew` solo liste che raggiungono 30 partite nel filtro corrente.
- Il record del gruppo è la somma di sole varianti già pubblicabili; le liste sotto soglia restano soltanto nel conteggio globale `brew_sotto_soglia`.
- La distanza dal rappresentante è esposta solo quando il rappresentante è pubblico nello stesso filtro.
- `/archetipo?id_brew=` ritorna 404 se il gruppo non ha alcuna variante pubblicabile; la risposta usa lo stesso percorso `nonTrovato()` del caso inesistente.
- Il legacy `?impronta=` non conferma una lista non classificata sotto soglia e aggiunge gli ID Brew soltanto dopo che la lista è pubblicabile.
- BO1/BO3, periodo e rank agiscono sui conteggi/filtro, non sull'identità persistente.
- La logica evita la sottrazione di win/loss sotto soglia: `Altro (Brew)` sopprime V/S quando esistono liste Brew sotto soglia; il gruppo non incorpora quelle liste.

Gli scenari 29+1, 20+20, 30+29, rappresentante non pubblico, gruppo misto, sottrazione di aggregati e “mai esistita vs sotto soglia” sono coerenti con il codice e con i casi presenti/documentati nei test Brew.

## Cancellazione, retry e race

**PASS.**

La pulizia Brew costruisce tre DELETE, eseguiti nello stesso batch dopo la DELETE delle partite:

1. elimina membership senza più partite per `(formato, impronta)`;
2. elimina tutte le membership dei gruppi il cui rappresentante non ha più partite;
3. elimina tali gruppi.

Verifiche:

- membro non rappresentante: viene rimosso senza mutare il gruppo;
- rappresentante: il gruppo viene smontato, senza promuovere un nuovo centro; le partite superstiti restano e un giro successivo può generare nuovi ID;
- impronta condivisa da due mittenti: la membership resta finché esistono partite della stessa impronta/formato;
- retry prima del commit: l'atomicità del batch impedisce stato parziale;
- commit riuscito ma risposta persa: il retry è idempotente e le credenziali sono cancellate solo al termine;
- stato già parzialmente cancellato: la pulizia usa lo stato vero del DB e rimuove gli orfani anche senza la lista originaria delle partite;
- cancellazione contributi/account e cancellazione della sola sezione `partite` includono `comandiPuliziaBrew` prima delle credenziali;
- tabelle Brew assenti: la pulizia degrada a lista vuota e mantiene il comportamento legacy;
- race piano→cancellazione→apply: `applicaPiano` accoda la stessa pulizia al batch di INSERT; se la cancellazione passa prima, gli INSERT orfani vengono eliminati nello stesso batch, se l'apply passa prima la cancellazione successiva li rimuove;
- due apply concorrenti: PK/UNIQUE fanno fallire interamente il secondo batch invece di creare doppioni o gruppi parziali.

Non è emerso dal codice esaminato un ulteriore percorso S1 di cancellazione partite privo di pulizia Brew. I due percorsi documentati e modificati sono `eliminaMittente` e la sezione account `partite`.

## BO1 / BO3 / combined

**PASS.**

L'identità Brew è `(formato, algoritmo, impronta)`. La modalità è applicata alle query di conteggio come filtro. Una stessa impronta non viene duplicata nella vista combinata e il gruppo persistente resta lo stesso fra filtri. Che due main deck osservati in BO1 e BO3 entro raggio 4 condividano il gruppo è coerente con il contratto S1: il raggruppamento identifica la lista/quasi-lista, non il tipo di coda; i risultati restano separabili dai filtri.

## API e compatibilità

**PASS.**

- I campi legacy di `Altro (Brew)` restano costruiti separatamente e i nuovi `gruppi_brew` / `raggruppamento_brew` sono additivi.
- `?id_brew=` è un nuovo percorso; `?impronta=` resta compatibile e aggiunge solo i nuovi riferimenti Brew quando pubblicabile.
- Formati senza catalogo continuano a produrre 409 sul dettaglio.
- Le GET di Meta/dettaglio usano letture Brew e non chiamano l'apply; la scrittura è confinata a cron/strumento locale.
- Il cron è gated da `BREW_GRUPPI === "on"`.

## Schema e migrazione

**PASS.**

Il blocco Brew di `schema.sql` coincide semanticamente con `migrazioni/2026-09-15-brew-gruppi.sql`: due tabelle, indice e due trigger, tutti `IF NOT EXISTS`.

I vincoli coprono:

- formato sintattico `bg_`/`bv_`;
- PK di gruppo;
- `variante_id` UNIQUE;
- PK `(formato, algoritmo, impronta)` del membro;
- UNIQUE su `(formato, algoritmo, ordine)` e rappresentante;
- FK composta membro→gruppo nello stesso formato/algoritmo;
- CHECK su distanza/ordine/impronte;
- UPDATE rifiutati dai trigger;
- DELETE intenzionalmente consentiti.

La migrazione è additiva e non contiene operazioni distruttive. Nessun D1 remoto è necessario per la logica locale.

## k = 4

**PASS WITH EVIDENCE LIMITATION.**

Le fixture versionate verificano direttamente:

- 59/60 → distanza 1;
- 56/60 → distanza 4;
- 55/60 → distanza 5;
- stesso colore/nucleo diverso → 36;
- molte terre e magie generiche in comune → 28;
- catena A–B=4, B–C=4, A–C=8 senza transitività;
- differenze qualitative k=3/4/5.

`k=4` è quindi il minimo delle tre soglie considerate che include il caso 56/60 ma esclude il 55/60, coerente con lo scopo di quasi-copia e non di famiglia. Il corpus reale citato dal contratto non è versionato e non è stato ricostruito in questa review.

## Test

Comandi richiesti dal mandato:

```text
node --test prove/brew-clustering.test.js prove/brew-gruppi.test.js prove/brew-meta.test.js prove/brew-cancellazione.test.js
npm run prove
npm run sito:build
node strumenti/brew_gruppi.mjs --help
```

**Esito della review indipendente:** non rieseguiti. Il runner disponibile in questa sessione non riesce a risolvere `github.com`, quindi il repository non è clonabile nel filesystem locale; GitHub non espone status CI sull'HEAD. Ho letto i test sorgente e confrontato le asserzioni con l'implementazione, ma non attribuisco a questa review i risultati verdi riportati dall'autore del branch.

La migrazione D1 remota non è stata toccata. Nessun comando `--remote` è stato eseguito.

## Self-review / controprove cercate

- Cercata la possibilità che una membership sotto soglia trapeli da `gruppi_brew`, `id_brew`, distanza o legacy `impronta`: le letture riapplicano la soglia nel filtro e non pubblicano il membro nascosto.
- Cercata una race in cui un piano vecchio inserisca stato dopo una cancellazione: la pulizia accodata al batch dell'apply copre l'ordine cancellazione→apply; l'ordine opposto è coperto dalla pulizia nel batch di cancellazione.
- Cercata una promozione implicita del rappresentante alla sua cancellazione: non avviene; il gruppo viene eliminato.
- Cercato single-linkage/transitività: il motore confronta ogni candidato solo con le firme dei rappresentanti attivi.
- Cercata una dipendenza dell'identità da BO1/BO3: non esiste nelle chiavi persistenti.
- Cercato un UPDATE applicativo Brew: il percorso normale usa INSERT/DELETE; i trigger impediscono UPDATE accidentali.

## Condizioni prima della proposta di merge

1. Rieseguire sull'HEAD esatto `17a3ca0498e965db05e7eecd96a23c47ad757c87` i quattro comandi della sezione Test in un checkout affidabile e registrare gli esiti. Un fallimento materiale cambia l'esito della review.
2. Se si vuole elevare la motivazione empirica di `k=4` da “conservativa ma su corpus piccolo” a completamente riproducibile, conservare in futuro un artefatto anonimizzato/manifest del corpus usato per il report k=3/4/5. Non è necessario per la correttezza del codice S1 attuale.

## Conclusione

Il branch rispetta il contratto S1 per clustering a raggio, stabilità ordinaria degli ID, privacy, cancellazione, race, BO1/BO3, compatibilità API e migrazione additiva. Non emerge una modifica richiesta al codice prima del merge. L'esito resta **PASS WITH CONDITIONS** per i limiti di evidenza sopra indicati, in particolare la mancata riesecuzione indipendente della suite in questa sessione.
