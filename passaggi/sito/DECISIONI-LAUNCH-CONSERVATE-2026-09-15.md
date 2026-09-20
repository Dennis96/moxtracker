# Decisioni di lancio conservate — 15 settembre 2026

> **Conservato sotto Git il 20/09/2026, senza riscriverlo.** Viene dal piano
> operativo `PIANO-MOX-SITO-CLIENT-LAUNCH-2026-09-15.md`, che viveva nella root
> del workspace fuori da Git ed e' ora uno snapshot in
> `Non pubblicare\Archivio\documenti-root-snapshot-2026-09-20\`.
>
> L'audit documentale del 20/09 ha verificato tutto il piano: S1, S2, S3 e il
> gate preview sono stati eseguiti e sono in `main`; S4, S5 e S9 erano gia'
> coperti da [PROSSIMI-SVILUPPI-SITO-2026-09-14.md](PROSSIMI-SVILUPPI-SITO-2026-09-14.md)
> come B2, B3, B4, F2 e F3; S6 e' stato portato in `mox-core` sotto
> `passaggi/integrazione-sito/`, perche' la sua base vive nel client. **Quello
> che segue non era coperto da nessun documento Git**, ed e' ancora valido.
>
> **Non e' un'autorizzazione.** E' una pianificazione del 15/09/2026: le
> baseline che cita sono di quella data, e ogni intervento richiede il suo
> mandato. In particolare S10 si pubblica solo dopo che la produzione e'
> stabile, e il sito pubblico **non e' ancora stato ridistribuito**.

## Decisioni di sequenza

1. B1/F1 Brew viene prima del refresh: altrimenti i candidati continuano a
   essere frammentati per impronta esatta.
2. Il refresh è manuale e revisionato; discovery, decisione e rigenerazione
   restano tre fasi distinte.
3. La UX matchup può essere preparata ora, ma il sito non deve mostrare
   percentuali finché non esiste una dimensione avversario affidabile.
4. Nomi Account e fondamenta Collection sono P1: devono avere contratti
   stabili, ma la UI Collection completa non blocca il lancio.
5. Il redesign arriva in produzione solo dopo un gate unico su `main` pulito.
6. Dopo il lancio: B3 duplicati Draft, sviluppo Draft, poi Research avanzata
   quando il corpus sarà sufficiente.

## S10 — launch pack e misurazione post-launch

**ID:** `S10-LAUNCH-PACK`

**Obiettivo:** comunicare il prodotto e misurare il funnel senza dark pattern
o raccolte non autorizzate.

**Perché prima del lancio / dopo:** materiali preparati dopo S7; pubblicazione
dopo S8 stabile.

**Repo:** `moxtracker` per asset/pagine approvati; materiali community fuori
repo se opportuno.

**Dipendenze:** sito production stabile; screenshot sintetici; decisione
analytics/privacy.

**Contratti/API:** funnel desiderato `visita → download → primo avvio → prima
partita → ritorno`. Ogni passaggio deve dichiarare fonte, base giuridica/
consenso, retention e aggregazione. Senza autorizzazione, misurare solo segnali
server aggregati già disponibili e non collegarli fra loro per fingerprinting.

**Implementazione:** messaggio organico per Reddit/Discord/community/social;
screenshot/GIF/video brevi; pagina “cosa invia”; link UTM solo se autorizzati;
dashboard aggregata minima; piano feedback/supporto.

**Test:** link, accessibilità media, redazione dati, messaggi coerenti con la
release, download pulito su macchina di prova.

**Privacy:** niente nomi/ID/deck reali; analytics opt-in o strettamente
necessari solo dopo review; no ad-tech, session replay o profili cross-site.

**PASS:** pack approvato, asset privi di dati reali, funnel misurabile in modo
documentato oppure esplicitamente parziale.

**FAIL/BLOCKER:** claim non dimostrati, screenshot personali, tracking senza
autorizzazione, lancio prima della stabilità S8.

**Output:** copy, asset, calendario community, metriche e checkpoint a 24h/7d.

## Cosa MOX deve prendere / non copiare da altre realtà

Verifica funzionale del 15/09/2026 su fonti pubbliche ufficiali:
[Untapped.gg Companion](https://mtga.untapped.gg/companion),
[MTGA Assistant](https://mtgaassistant.net/Download),
[MTGGoldfish/SuperBrew](https://www.mtggoldfish.com/articles/magic-arena-metagame-collection-and-superbrew),
[17Lands](https://www.17lands.com/) e
[linee d'uso dati 17Lands](https://www.17lands.com/usage_guidelines).

| Realtà | Da prendere come principio | Gap/opportunità MOX | Da non copiare ora |
|---|---|---|---|
| Untapped.gg | percorso chiaro stats personali → collezione → deck costruibili; overlay e Draft leggibili | MOX ha già tracker, Account, Meta e Draft; può distinguersi con privacy esplicita, N visibile e craftability trasparente | ampiezza “tutto in uno”, feature premium o metriche senza campione |
| MTGA Assistant | confronto deck/collezione, wildcard mancanti, opponent summary e auto-update | riusare il motore locale reale e spiegare unknown/reprint/formato meglio | classificare l'avversario dalle sole carte viste senza validazione; feed/content creator prima del core |
| MTGGoldfish/SuperBrew | idea semplice: collezione + metagame → cosa posso costruire | filtri `subito/con wildcard/quasi` dentro un Account privato | pricing/premium, finanza paper e inserimento manuale come centro del prodotto |
| 17Lands | definizioni pubbliche, caveat, dataset/licenze e replay/pick utili al miglioramento | MOX può applicare la stessa trasparenza a N, provenienza e limiti, poi tornare al Draft | inseguire ora scala/dataset/replay completi; usare API curate contro le loro linee guida |

Già presente in MOX: overlay/tracker, statistiche personali, rank, Meta,
Account privato, deck reali sincronizzati, Draft contestuale, download/updater,
consensi separati e Research revocabile. Gap prioritari: pulizia Brew, catalogo
fresco, campioni espliciti, nomi storici e Collection/craftability Account.
Opportunità distintiva: un prodotto più piccolo ma verificabile, con unknown
onesto, privacy per costruzione e percorso client→sito spiegato. Non fare ora:
abbonamenti, social profile pubblici, AI generativa per nomi/archetipi, opponent
prediction non calibrata, automazione totale catalogo, analytics invasivi.
