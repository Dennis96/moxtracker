# MOX — Launch & Early Beta Operations

Preparato il 25 settembre 2026 dopo il [closeout production PASS](../sito/PRE-LAUNCH-CLOSEOUT-2026-09-25.md). **Nessun post esterno è stato pubblicato.** Tutti i testi qui sotto sono bozze pronte per l'ultimo controllo e click di Dennis.

## Baseline iniziale

Snapshot alle **18:43 UTC / 20:43 CEST del 25 settembre 2026**. Sono conteggi osservati, non obiettivi né stime di utenti attivi. Il numero di download GitHub può aggiornarsi con ritardo.

| Segnale | Valore iniziale e fonte |
| --- | --- |
| Sorgente production | `1e117acaa5405bbc12702d9ed5b3b9b8c2821a08`; Pages `61de5e86-e767-4668-85da-925e070bc312`; Worker `9baa7bbf-f5c1-4364-a199-277e49c7bc99` |
| Release | [GitHub Latest 2.11.2](https://github.com/Dennis96/moxtracker/releases/tag/mox-v2-beta2.11.2), asset unico `MOX-2.11.2.zip`, **1 download** secondo GitHub API; manifesto updater `win-x64/stable` 2.11.2 |
| API e Research | `/salute` HTTP 200, `research.enabled=true`, `modo=on`, lifecycle attivo; 62 contributi Research conservati in D1 (solo COUNT) |
| Brew | `BREW_GRUPPI=on`; 3 gruppi in D1 (solo COUNT), gruppi pubblici presenti in `/meta` Standard 30 giorni |
| Meta | 729 righe Partite conservate in D1; vista pubblica Standard ultimi 30 giorni: **316 partite** e 3 voci principali; non equivalgono a 729 utenti o partite recenti in tutti i formati |
| Draft | 38 Draft e 1185 pick conservati nell'indice D1 (solo COUNT); vista pubblica ultimi 30 giorni: **22 Draft e 924 pick** |
| Account e ticket | 5 account e 10 ticket in D1 (solo COUNT; nessuna riga personale estratta) |
| Matchup | soglie 30 pubblicabile / 100 campione più solido; matrice pubblica ora `disponibile=false` perché non è noto l'archetipo avversario |
| Errori | 0 HTTP 5xx nelle richieste di smoke, 0 warning/error browser rilevanti nel campione; volume/tasso complessivo di errori production **non misurabile con gli strumenti attuali** |

Per la retention, vedere il closeout. I COUNT D1 sono state sole query `SELECT`, `rows_written=0`; non è stata creata alcuna raccolta nuova.

## Calendario e scelta del momento

[Wizards conferma](https://magic.wizards.com/en/news/mtg-arena/announcements-september-21-2026) **Reality Fracture su MTG Arena il 29 settembre 2026**. Il [calendario ufficiale](https://magic.wizards.com/en/news/mtg-arena/reality-fracture-event-schedule) prevede Premier, Traditional e Pick-Two Draft dal 29 settembre; Quick Draft del set dall'8 ottobre. La data tabletop è il 2 ottobre, distinta da quella Arena.

**Slot operativo consigliato: mercoledì 30 settembre alle 19:00 CEST (17:00 UTC)** per il post principale in inglese, dopo un giorno per osservare release, updater, API e dati Draft. È una scelta operativa, non una previsione verificata di massima visibilità. Pubblicare solo se 2.11.2 è ancora Latest, il sito e l'API sono verdi, il testo resta vero e l'account Reddit rispetta le regole; altrimenti rimandare di 24 ore. Non promettere che i giudizi Draft per Reality Fracture siano già disponibili finché set e dati 17Lands non sono stati verificati nel client.

## Dove pubblicare e quali regole applicare

Regole lette il 25 settembre 2026 dalle pagine ufficiali delle community. Ricontrollarle nel momento del post: moderatori e thread fissati possono cambiare. [Reddit scoraggia link ripetuti e autopromozione prevalente](https://support.reddithelp.com/hc/en-us/articles/360043504051-Spam); non è una licenza per cross-postare lo stesso annuncio.

| Destinazione | Decisione e limiti verificati |
| --- | --- |
| [r/MagicArena](https://www.reddit.com/r/MagicArena/about/rules/) | Prima scelta per un annuncio **in inglese** pertinente ad Arena. Regola 8: almeno **10 commenti significativi di partecipazione per ogni post promozionale**; regole 4–5: contributo originale con discussione concreta, evitare ripetizioni e usare uno sticky pertinente se presente. Nessun requisito numerico di età account/karma o flair è dichiarato nella pagina regole letta: verificare UI e messaggi moderatori al momento del click. Se l'account non soddisfa la regola 8, prima chiedere ai moderatori via modmail; non fabbricare commenti di riempimento. |
| [r/lrcast](https://www.reddit.com/r/lrcast/about/rules/) | Community Limited: eventuale intervento successivo **solo** su un problema Draft concreto, con esempio e feedback richiesto. Le regole visibili non autorizzano esplicitamente l'autopromozione; chiedere ai moderatori prima di un annuncio con link. Non postare lì la copia generica del lancio. |
| [r/magicTCG](https://www.reddit.com/r/magicTCG/about/rules/) | **Non usare questo pacchetto per un post lì.** Regola 10 rimanda alle linee guida creator e vieta autopromozione nei commenti altrui; regola 9 richiede flair; regola 13 vieta testo generato da AI e richiede una dichiarazione sull'uso di AI per app/progetti di codice. Chi vuole proporre MOX lì deve prima leggere le linee guida, scrivere personalmente il testo e dichiarare l'uso di AI nel codice in modo conforme; chiedere ai mod in caso di dubbio. |
| [r/italygames](https://www.reddit.com/r/italygames/about/rules/) | Regola 2: **approvazione preventiva dei moderatori** per qualsiasi post promozionale. Regola 6: la condivisione di progetti va nel megathread GAMING ROOM. La versione italiana qui sotto è per una collocazione approvata, non per un post autonomo immediato. |
| [Clepshydra.it — MTG Arena Italia](https://discord.com/servers/512182451502710799) | Server Discord italiano pertinente, con tornei e serate community secondo la scheda pubblica. Regole su link e promozione non accessibili pubblicamente: chiedere ai moderatori il canale/permesso prima di inviare il testo. |
| [Forum Metagame.it — MTG Arena](https://www.metagame.it/forum/) | Community italiana pertinente; non è stata verificata una regola generale aggiornata sull'autopromozione. Chiedere ai moderatori se e dove è ammessa una presentazione del tool. |

Nelle regole lette non è emersa un'autorizzazione generale al cross-post simultaneo né una soglia universale di età account. Usare un solo annuncio principale; adattare altri interventi al contesto e al permesso della singola community.

## Post principale pronto — r/MagicArena, inglese

**Title:** I built MOX, a free Windows beta companion for MTG Arena — looking for feedback on the tracker, Draft and deck stats

**Body:**

Hi r/MagicArena, I'm Dennis, the person building MOX. It's a free Windows beta that runs alongside Arena. I'm sharing it now because I'd like feedback from people who actually play with a tracker or draft regularly.

During a match, MOX shows the cards left in your deck, land counts and draw odds, plus cards the opponent has revealed. For Draft, it orders the pack using win-rate data from 17Lands where available, calls out close alternatives, and suggests a 40-card build from your pool at the end. It also keeps your Arena decks and their match stats on your PC.

The website has an early public Meta view and Draft data, plus an optional private account area. The public sample is still small, so I wouldn't use it as a definitive metagame report. MOX works without an account. Sharing Matches/Meta, Draft, Research and private deck sync are separate choices and are off by default; the [privacy page](https://moxtracker.app/privacy) explains what can become public and how to delete contributions.

These are actual screenshots of the current beta: [match tracker](https://moxtracker.app/assets/home/story-partita.webp), [Draft assistant](https://moxtracker.app/assets/home/story-draft.webp), [deck stats](https://moxtracker.app/assets/home/story-statistiche.webp). The [site and Windows download are here](https://moxtracker.app/).

If you try it, I'd especially like to know: are the in-game counts clear at a glance, is the Draft pick order useful, and what feels confusing or missing? Bug reports can go through [Support](https://moxtracker.app/supporto). MOX is an independent fan project and is not endorsed by Wizards of the Coast.

*Preflight before click:* verificare regola 8 dell'account Reddit, il flair disponibile, Latest/sito/API, e che le schermate e ogni frase rappresentino ancora il prodotto. Non aggiungere claim su supporto Reality Fracture non verificato.

### Variante breve EN

**Title:** MOX: a free Windows beta tracker and Draft companion for MTG Arena — feedback welcome

Hi, I'm Dennis and I'm building [MOX](https://moxtracker.app/), a free Windows beta for Arena. It counts cards left and draw odds during games, orders Draft picks with 17Lands data where available, suggests a deck after the Draft, and keeps your deck stats locally. The site has early Meta/Draft views; the account and every data-sharing option are optional and off by default. [Real screenshots](https://moxtracker.app/) and the [privacy details](https://moxtracker.app/privacy) are on the site. What would you test first, and what feels unclear? I'm looking for concrete beta feedback.

### Variante IT per collocazione autorizzata

**Titolo:** MOX: beta gratuita per Windows accanto a MTG Arena, cerco feedback su tracker e Draft

Ciao, sono Dennis e sto sviluppando [MOX](https://moxtracker.app/), un programma gratuito in beta per Windows. Durante la partita conta le carte rimaste e le probabilità di pesca; nel Draft ordina le carte della busta usando i dati 17Lands quando disponibili e, alla fine, propone un mazzo dal pool. Tiene anche i mazzi di Arena e le loro statistiche sul PC. Sul sito ci sono Meta e dati Draft ancora con campioni piccoli. Account e condivisioni sono facoltativi e spenti all'inizio: la [Privacy](https://moxtracker.app/privacy) spiega dati pubblici e cancellazione. Le [schermate sono reali](https://moxtracker.app/). Mi interessa sapere cosa è poco chiaro o non funziona nella vostra esperienza.

### Testo Discord/forum IT, solo nel canale consentito

Ciao, sono Dennis. Sto cercando feedback su MOX, una beta gratuita per Windows da usare accanto a MTG Arena. Ha un contatore in partita, un assistente al Draft e statistiche dei mazzi; sul sito trovate schermate reali e una spiegazione delle condivisioni facoltative: https://moxtracker.app/. Se qui è consentito parlare di strumenti della community, mi interessano soprattutto problemi riproducibili e punti poco chiari. Posso spostare la diagnostica su https://moxtracker.app/supporto.

## FAQ pronta per risposte brevi

| Domanda | Risposta consigliata |
| --- | --- |
| Cos'è MOX? | Un companion indipendente per MTG Arena su Windows, in beta pubblica: contatore in partita, assistente al Draft, mazzi e statistiche locali, più viste Meta/Draft sul web. |
| È gratuito? | Sì, la beta pubblica e lo ZIP Windows sono gratuiti. Non promettere modelli di prezzo futuri. |
| Windows only? | Il client distribuito ora è per Windows `win-x64`. Il sito si apre anche da altri dispositivi; non annunciare port Mac/Linux non pianificati. |
| Serve un account? | No. Il client funziona senza account. Google/Discord servono solo per l'area personale facoltativa; collegarlo non attiva gli invii. |
| Che dati raccoglie? | Le funzioni locali leggono i registri dettagliati di Arena quando disponibili. Partite/Meta, Draft, Research e sincronizzazione privata dei mazzi hanno scelte separate, spente inizialmente. I contributi online sono pseudonimizzati; per i dettagli vedere [Privacy](https://moxtracker.app/privacy) e [Cosa invia MOX](https://moxtracker.app/cosa-invia-mox). |
| È open source? | Il [repository server/sito è pubblico](https://github.com/Dennis96/moxtracker), ma non contiene una licenza software dichiarata. Non presentare l'intero progetto come open source; il client Windows distribuito non è descritto come tale. |
| SmartScreen blocca l'EXE? | Seguire [le istruzioni ufficiali del download MOX](https://moxtracker.app/download): se `Mox.exe` non parte, usare una volta `INSTALLA-MOX.bat` dal pacchetto e poi `MOX.bat`. Non disattivare Defender. Se persiste, aprire un ticket. |
| L'antivirus lo segnala? | Non aggirare la protezione. Verificare che lo ZIP provenga dalla [release GitHub Latest](https://github.com/Dennis96/moxtracker/releases/latest), conservare nome/versione del prodotto antivirus e segnalazione, poi aprire un [ticket](https://moxtracker.app/supporto). |
| Differenza da Untapped.gg? | C'è sovrapposizione su tracker, Draft e statistiche. [Untapped.gg](https://mtga.untapped.gg/companion) è un companion maturo con più funzioni; MOX è una beta indipendente con le funzioni descritte sul suo sito. Non rivendicare superiorità o dati migliori. |
| Differenza da 17Lands? | [17Lands](https://www.17lands.com/) offre dati e analisi approfonditi del Limited. MOX usa statistiche 17Lands dove disponibili per ordinare le carte durante il Draft e proporre una build locale; non sostituisce le analisi dettagliate di 17Lands. |
| Come funziona il Draft? | Aprire l'Assistente prima del Draft; mostra una scelta principale e alternative vicine, poi propone un mazzo dal pool. Le percentuali dipendono da set/evento e disponibilità dei dati. Condividere i propri Draft è una scelta separata. |
| Cos'è il Meta? | Una vista dei contributi MOX disponibili, filtrabile. Percentuali e decklist esatte sono pubblicate da 30 partite della stessa variante, anche se da una sola installazione; da 100 il campione è più solido. Il campione attuale è piccolo. |
| Cos'è Research? | Una partecipazione facoltativa, separata e spenta di default. Contributi delle partite chiuse dopo il consenso possono aiutare analisi future; risultati e suggerimenti Research sono ancora in sviluppo. Revoca e cancellazione sono comandi distinti. |
| Come segnalo un bug? | [Supporto MOX](https://moxtracker.app/supporto) accetta ticket anche senza account; descrivere versione, passaggi, risultato atteso/ottenuto e, solo se scelto, screenshot o diagnostica. Non pubblicare log completi o segreti in commenti/issue pubbliche. |
| Come disinstallo e cancello i dati? | Chiudere MOX e rimuovere la cartella estratta del programma. Questo non equivale alla cancellazione dei dati online: usare **Opzioni → Dati e privacy** per Partite/Draft e i comandi separati Research; nell'account si possono esportare/cancellare sezioni o account. Per dati locali residui e richieste riservate, contattare [privacy@moxtracker.app](mailto:privacy@moxtracker.app). |

## Runbook: primi sette giorni dopo il post

**Prima del click (giorno 0):** registrare ora/URL del post e valori della baseline, controllare release Latest, manifesto updater, `/salute`, Home/Privacy/Download/Supporto, Meta, Draft, Research/Brew, screenshot e mod rules. Pubblicare una sola volta nel luogo consentito; essere disponibili a rispondere per almeno la prima ora senza copiare risposte identiche.

| Giorno | Controllo essenziale | Esito da registrare |
| --- | --- | --- |
| 1 | Dopo 1 ora e a fine giornata: download ZIP, updater, HTTP 5xx osservabili, ticket, crash/antivirus, commenti e FAQ nuove; `/salute`, Meta/Draft/Research/Brew. | Nuovi problemi distinti, priorità e proprietario. |
| 2 | Ripetere baseline; verificare installazione su macchina pulita se disponibile, dettagli SmartScreen, ticket senza account e link segreto; controllare cron retention senza cancellare dati per prova. | Trend download/ticket, blocchi di onboarding. |
| 3 | Controllare campioni Meta/Draft, set/eventi effettivamente supportati, commenti sul Draft e conteggi pubblici; confrontare errori con giorno 1. | Discrepanze riproducibili e limiti dei campioni. |
| 4 | Controllare Research: `on`, nuovi contributi, revoca/delete da test mirati solo in ambiente non production; osservare eventuali warning di backlog cron tramite strumenti operativi esistenti. | Nessuna regressione privacy, backlog annotato se osservabile. |
| 5 | Triage ticket e issue confermate; controllare updater, crash ricorrenti e problemi visivi frequenti. Rispondere ai thread attivi senza nuovi post promozionali. | P0/P1 risolti o con workaround; P2 nel backlog. |
| 6 | Ripetere SEO/social image, API, Meta/Brew/Draft, release Latest e download. Verificare che le risposte FAQ siano ancora vere. | Eventuali regressioni e loro fonte. |
| 7 | Confrontare baseline e giorno 7: download, ticket, crash, API, Research, Draft, Meta/Brew e feedback community. Preparare nota di stato con dati misurati, limiti e prossime due priorità. | Decisione informata su hotfix, patch o attesa. |

Ogni giorno annotare UTC, finestra temporale e fonte. Download GitHub non sono installazioni né utenti unici; conteggi Partite/Draft/Research non sono utenti. Non creare tracciamenti personali per colmare metriche mancanti.

### Priorità

- **P0 — hotfix immediata:** installazione/updater rotto, perdita dati, crash diffuso, privacy/revoca/cancellazione compromesse, API down, release sbagliata. Congelare promozione, riprodurre e applicare fix/rollback appropriato con verifica.
- **P1 — triage rapido e fix se confermato:** funzione principale inutilizzabile, dati pubblici errati, regressione Draft/Meta, bug che colpisce molti utenti.
- **P2 — backlog:** copy, piccoli problemi visuali, richieste feature, miglioramenti UX. Nessuna release impulsiva per P2.

## Workflow supporto unico

Commento/community → risposta breve pubblica se generale → [ticket MOX](https://moxtracker.app/supporto) quando servono diagnostica o dati privati → una issue interna se il bug è confermato → P0/P1/P2 → fix → verifica → note di versione → risposta nel ticket/thread originale. Tenere un solo riferimento canonico al bug e collegare gli altri segnali; non duplicarlo in più sistemi. Per privacy personale usare [privacy@moxtracker.app](mailto:privacy@moxtracker.app), non issue pubbliche.

### Risposte modello (IT / EN)

| Situazione | IT | EN |
| --- | --- | --- |
| Log/screenshot | «Puoi aprire un ticket con versione MOX, passaggi e ora approssimativa? Se vuoi, allega il pacchetto diagnostico creato da MOX o uno screenshot; non pubblicare log o dati personali qui.» | “Could you open a support ticket with your MOX version, steps and approximate time? You can attach MOX's diagnostic package or a screenshot if you choose; please don't post logs or personal data here.” |
| Bug confermato | «Grazie, l'abbiamo riprodotto nella versione [X]. È registrato come [ID/priorità]; aggiorneremo il ticket quando avremo una correzione verificata.» | “Thanks, we reproduced this in version [X]. It's tracked as [ID/priority]; we'll update the ticket after a verified fix.” |
| Workaround | «In attesa della correzione, puoi provare [passo preciso]. Non disattivare protezioni o condividere dati aggiuntivi. Facci sapere se cambia il risultato.» | “Until the fix, please try [specific step]. Don't disable security protections or share extra data. Let us know whether the result changes.” |
| Risolto | «Il problema è corretto in [versione]. Abbiamo verificato [caso]; qui ci sono le [note di versione](https://moxtracker.app/note-versione). Confermi se ora funziona?» | “This is fixed in [version]. We verified [case]; see the [release notes](https://moxtracker.app/note-versione). Could you confirm it works for you?” |
| Feature request | «Grazie per la proposta. L'abbiamo registrata con il caso d'uso [X]. È nel backlog, senza una data promessa.» | “Thanks for the suggestion. We logged it with use case [X]. It's in the backlog, with no promised date.” |
| Non riproducibile | «Con i dati disponibili non siamo riusciti a riprodurlo. Puoi indicarci versione, passaggi precisi e risultato atteso/ottenuto in un ticket? Evita dati sensibili nei commenti.» | “We couldn't reproduce it with the available details. Could you send your version, exact steps and expected/actual result in a ticket? Please keep sensitive data out of comments.” |

## Ultimo click, a carico dell'utente

1. Il 30 settembre (o quando tutte le condizioni sono vere), ricontrollare le [regole r/MagicArena](https://www.reddit.com/r/MagicArena/about/rules/) e che l'account soddisfi la regola degli almeno 10 commenti significativi per post promozionale; altrimenti inviare modmail e attendere. Verificare eventuale flair/sticky/limite applicato dall'interfaccia.
2. Verificare release Latest, sito/API e che le tre schermate rappresentino ancora la versione disponibile. Non rivendicare supporto specifico Reality Fracture senza prova.
3. Copiare titolo e corpo del post principale, fare un'ultima lettura personale, scegliere il flair pertinente e premere **Post** manualmente. Salvare URL e ora nel runbook.
4. Usare varianti IT/Discord/forum solo dopo l'autorizzazione o nel megathread consentito; non cross-postare la stessa copia in serie. Non usare il testo generato per r/magicTCG.
