# Decisioni di prodotto del sito Mox — 26 agosto 2026

Fonte: `RISPOSTE-QUESTIONARIO-SITO-MOX (1).md`, compilato dall'utente il 26/08/2026.

Questo documento traduce le risposte in indicazioni attuabili. Prevale sulle proposte precedenti quando sono in contrasto; non autorizza pubblicazioni, migrazioni o raccolta di nuovi dati personali.

## Sintesi direzione

Il sito è il **compagno pubblico di Mox**, non un concorrente citato di 17lands o MTGA Draft Tool. Deve invitare prima a scaricare Mox, poi rendere leggibili meta, Draft e dati personali. I dati raccolti servono prima di tutto a migliorare Mox — soprattutto la valutazione, la politica dei colori e il deck builder del Draft — non a costruire un portale statistico fine a sé stesso. Il sito rende quel lavoro trasparente e utile agli utenti, senza esporre diagnostica privata.

Partite e Draft contribuiscono al miglioramento soltanto nei limiti dei consensi espliciti già previsti. Le statistiche pubbliche sono un prodotto secondario: devono essere chiare, aggregate e mai guidare la raccolta oltre ciò che serve al funzionamento e allo sviluppo di Mox.

Aspetto: un ibrido fra identità Mox e dashboard moderna. Tema scuro, viola e compatto quando serve; nessuno sfondo animato. Su mobile le tabelle diventano schede.

## Ordine delle fasi

1. **Completato il 26/08/2026:** il Draft reale Mox 2.9.23 è stato confermato perfetto dall'utente.
2. Stabilizzare Worker, dati Draft, CORS rinomina mazzi, ambiente anteprima, controlli e deploy riproducibile.
3. Rifare homepage e navigazione.
4. Meta e archetipi.
5. Draft pubblico e pagina Draft personale semplificata.
6. Account, ticket e funzioni successive.

Ogni pubblicazione richiede review, screenshot desktop/mobile, test, smoke test, working tree pulita e approvazione esplicita dell'utente.

## Homepage e navigazione

- Hero: spiegazione breve di Mox, pulsante download principale e **due schermate reali di Mox**.
- Le due schermate consigliate sono: (1) assistente Draft durante una scelta reale, con carte e spiegazioni; (2) risultato del Draft/deck builder finale. Non usare immagini di 17lands o MTGA Draft Tool.
- Mostrare conteggi pubblici di partite e Draft, con data/ora dell'ultimo aggiornamento.
- Non citare né confrontare pubblicamente 17lands o MTGA Draft Tool.
- Menu iniziale: Home, Meta, Draft, Account, Supporto.
- Aggiungere una pagina di note di versione breve e aggiornata.
- Beta iniziale **aperta**: pagine, download, account e invio dati non richiedono una lista di tester. L'assenza di pubblicità è una scelta di diffusione, non una misura di sicurezza; rate limit, consenso, validazione e controlli restano obbligatori anche con pochi utenti.

## Meta Constructed

- Formato predefinito: Standard.
- Metrica in evidenza: **punteggio combinato** di qualità e popolarità, non solo win rate.
- Il punteggio deve essere spiegabile: pubblicare o tooltip con i suoi componenti (win rate, numero di partite, quota di gioco e affidabilità del campione); non farlo sembrare una percentuale.
- Gli archetipi sotto soglia restano visibili con etichetta di campione piccolo.
- Filtri al lancio: formato, periodo, rank, BO1/BO3. Conservare l'impostazione grafica attuale, aggiungendo il periodo.
- Periodi: 7, 14, 30 giorni, totale.
- Grafico temporale solo per archetipi con dati sufficienti.
- Mazzi non riconosciuti: raggruppati come **Altro**, con linguaggio coerente al concetto di “Brew”.

## Pagina archetipo

- La lista principale è quella più rappresentativa per frequenza.
- Mostrare tutte le varianti che superano soglia privacy e soglia minima di dati; indicare in modo leggibile le differenze. Le varianti troppo piccole confluiscono in “Altre varianti”, così non si pubblicano dati non affidabili né identificabili.
- Azioni: copia e importazione in Arena.
- Informazioni: curva, tipi, colori e dimensione del campione.
- Immagine carta su passaggio/click.
- Matchup non maturi: bloccati con soglia dichiarata.

## Draft pubblico

La pagina pubblica non deve essere una diagnostica né un confronto con altri programmi. Deve spiegare in modo semplice che i Draft condivisi aiutano a migliorare Mox, quindi organizzarsi per **espansione e evento Arena** (per esempio HOB, Marvel, successivi set/eventi) e raccontare brevemente come Mox decide.

Per ogni set/evento, quando il campione lo consente:

- mostrare le migliori combinazioni di colore (es. nero/rosso con win rate);
- rendere cliccabile ogni combinazione;
- mostrare le carte migliori in quei colori, con campione e affidabilità;
- mantenere set, formato evento e periodo separati per non mescolare segnali diversi.

Non mostrare pubblicamente:

- confronto con 17lands;
- politiche Draft vecchie;
- casi controversi;
- statistiche del deck builder;
- confronto fra mazzo consigliato e mazzo giocato;
- dettagli di tracce incomplete.

I confronti completi fra politiche, tracce anomale, divergenze e risultati di calibrazione restano strumenti interni di sviluppo: servono a correggere Mox, non a rendere il sito più rumoroso.

Le tracce incomplete non vanno **cancellate dai dati grezzi**: devono restare private per diagnostica e retention, ma essere escluse da statistiche, pagine pubbliche e campioni di politica. Cancellarle davvero contraddirebbe sia la retention scelta sia la possibilità di correggere i bug.

## Account e Draft personali

Dashboard iniziale: riepilogo con partite, win rate, formati e ultimi Draft.

- Mazzi non più presenti in Arena: restano nello storico, separati dai correnti.
- Versioni dello stesso mazzo: mostrare differenze fra liste.
- Rinomina manuale: vale solo nel proprio account, non addestra il classificatore pubblico.
- Mostrare ultimo invio, dispositivi e consensi attivi.
- Avvisare dopo alcuni giorni senza invii.
- Export completo e anche per sezioni.

La pagina dei Draft personali deve partire semplice:

- resoconto di come è andato il Draft;
- statistiche personali Draft (numero Draft, vittorie, andamento);
- elenco cliccabile dei Draft;
- dettaglio del deck e note/avvisi lasciati da Mox.

Il pick-by-pick completo, timeline colori e confronto con 17lands restano fuori dal primo lancio, salvo richiesta specifica successiva.

Terre speciali e fixing devono avere una sezione propria nel dettaglio del deck: è necessaria sia per spiegare le fonti colore, sia per intercettare regressioni come quelle già segnalate.

## Supporto, privacy e ruoli

- Ticket anonimi: consentiti con Turnstile e link segreto.
- Categorie: bug, Draft, dati, account, installazione, suggerimenti.
- Notifiche email: previste come opzione facoltativa. Richiedono consenso distinto, raccolta dell'indirizzo in modo esplicito e possibilità di revoca. Non ampliare gli scope OAuth in silenzio; la dashboard continua a essere il canale disponibile anche senza email.
- Diagnostica ticket: il percorso normale è un `rapporto.json` strutturato, già anonimizzato da Mox, con dimensione massima ridotta e validazione server. Il sito non accetta ZIP generici.
- Player.log: può essere inviato soltanto attraverso un'azione separata di Mox, con consenso specifico ripetuto, avviso chiaro che è un log completo Arena, bucket R2 privato e retention ticket. Non va incluso automaticamente nel report JSON né reso scaricabile pubblicamente.
- Stati ticket: mantenere quelli attuali.
- Al lancio c'è un solo amministratore; predisporre in seguito un flusso auditabile per assegnare/rimuovere il ruolo.
- Creare pagina semplice “Cosa invia Mox”, con esempi concreti.
- Cancellazione selettiva di partite, Draft e mazzi; cancellazione account immediata dopo doppia conferma.
- Retention tracce Draft grezze: 730 giorni.
- Mostrare stato attuale dei consensi, non lo storico.
- Dati sospetti: privati ed esclusi dagli aggregati.

## Grafica, lingue e accessibilità

- Design ibrido Mox + dashboard moderna.
- Densità equilibrata e modalità compatta.
- Tema chiaro rinviato.
- Rimuovere lo sfondo animato.
- Tabelle mobile convertite in schede.
- Lancio: italiano e inglese; altre lingue dopo.
- Se manca il nome locale della carta, usare inglese.

Accessibilità avanzata può essere una fase successiva, ma contrasto sufficiente, tastiera, focus visibile e assenza di informazioni affidate solo al colore restano requisiti minimi del primo lancio.

## Qualità e operatività

- Ambiente di anteprima obbligatorio prima della produzione.
- Gate deploy: test, build, smoke test, working tree pulita.
- Screenshot desktop e mobile a ogni release.
- Controllo giornaliero D1/R2 e tracce sospette.
- Monitoraggio API, login, download e pagine principali.
- Beta test con 3–5 persone e checklist.
- Canale principale feedback: ticket del sito.

La checklist per ogni tester è una lista breve di azioni identiche da provare: aprire homepage/download, navigare Meta/Draft, creare o usare account di prova, collegare Mox se autorizzato, provare il ticket e riportare schermata/risultato. Serve a confrontare i feedback e non dipendere dalla memoria di ciascuno.

## Decisione ancora necessaria

### Formula del punteggio meta

Il punteggio combinato deve essere progettato e testato con i dati disponibili prima di pubblicarlo. Non usare una media arbitraria di win rate e popolarità. La formula deve compensare campioni piccoli e mostrare sempre le metriche originali accanto al punteggio.
