# Review indipendente — Pages News 2.11.10

**Esito: PASS dopo correzione di solo testo.** Codex, 21/10/2026, giro unico
leggero sulla PR [#53](https://github.com/Dennis96/moxtracker/pull/53), con
verifica retrospettiva dello snapshot della
[#52](https://github.com/Dennis96/moxtracker/pull/52). Nessun rilievo bloccante
aperto. Il PASS riguarda il registro corretto e le verifiche sotto, non
autorizza merge o operazioni di produzione.

## SHA e perimetro

- #53, HEAD rivisto: `82a58f4e332ccfa952f5037483f87e298437d543`;
  diff originale: solo `STATO-CORRENTE-SITO.md`.
- Base #53, merge #52 e sorgente Pages:
  `2dd1fceca32159bb4ba651c95ea08e9a31cd4265`.
- #52: HEAD `a31f34d885eb91925c9e1506156aca77c3f50f95`, base
  `b4434373b37de08158d453a709f9c9a88f24efca`; modificati soltanto
  `config/news-releases.json` e `config/news-fonti.json`.
- Sorgente client dichiarata dalla ricevuta e dalla Release:
  `de882f61c7e9153b8163cf1cae3da17c4f601cc5`.

Worktree indipendente: `worktrees/sito-review-pages-news-2.11.10-2026-10-21`.
Letti `AGENTS.md`, `LEGGIMI.md`, `passaggi/sito/NEWS-SNAPSHOT-E-GATE.md` e
`strumenti/release_sito.mjs`. Controlli remoti del 21/10, circa 19:42–19:48 UTC
(21:42–21:48 in Italia): sole GET e OPTIONS dello smoke. Nessun merge, deploy,
rollback, accesso a secret o scrittura R2/D1 eseguito. Le scritture riguardano
solo la worktree, le dipendenze locali e la consegna Git/PR richiesta.

## Rilievi numerati e verifiche

1. **MAJOR corretto — comando di rollback inesistente.** La versione originale
   del registro proponeva `npx wrangler pages deployment rollback`. L'help
   locale di Wrangler **4.123.0** (`pages deployment --help`) elenca list,
   create, tail e delete, senza rollback; anche la
   [documentazione dei comandi Pages](https://developers.cloudflare.com/workers/wrangler/commands/pages/)
   non lo prevede. Corretto soltanto il paragrafo del registro: dashboard
   Cloudflare → Workers & Pages → moxtracker → Deployments → All deployments
   → menu di `87e32483-11e6-4fd0-943d-f44c8b7f1921` → «Rollback to this deployment».
   Procedura confermata dalla
   [documentazione rollback Pages](https://developers.cloudflare.com/pages/configuration/rollbacks/).
   Il target è una produzione precedente riuscita, non una preview:
   `dfbe64f43f8bb239e96cd5dcc456791ddbb35dec`, build `9e1ec740558c9168`.
   Il suo manifesto e l'elenco News sono ancora raggiungibili: Latest 2.11.8,
   senza 2.11.10. Resta necessaria l'autorizzazione separata di produzione;
   nessun rollback provato o eseguito.

2. **PASS — derivazione della #52 riprodotta.** Eseguiti nella worktree
   `node strumenti/news/aggiorna.mjs` e `node strumenti/news/fonti.mjs`.
   Ripetuto anche `aggiorna.mjs` partendo dal JSON precedente alla #52, preso
   da `b443437`: **28 release, 0 ritiri, 3 GET**, risultato identico alla #52
   salvo `fetched_at`. Nessuna differenza nei 27 elementi storici, nei corpi,
   nelle date di pubblicazione, negli asset o negli ETag. Latest è
   `2.11.10`, ID `419915656`, provenienza `stable_receipt`; `source_commit`
   e ricevuta coincidono con `de882f61…601cc5` completo sopra. Anche le fonti
   coincidono salvo le date di acquisizione/verifica. Ricontrollate RS256
   sia sulle fonti committate sia su quelle appena acquisite: entrambe valide.
   Le due route richieste restituiscono 2.11.10 e gli stessi byte firmati;
   il campo interno `canale: stable` non costituisce da solo prova di promozione.
   SHA-256 manifesto dati pubblici invariato:
   `56b39389e8af106567bcf6d2d0b649732d390c683aa88ad0f49fc17a99dc3fec`.
   I JSON rigenerati sono stati ripristinati: non entrano nel commit di review.

3. **PASS — numeri Pages e record.** L'elenco ottenuto con Wrangler, equivalente
   a `npx wrangler pages deployment list --project-name moxtracker`, conferma
   produzione `db372cc6-2ff8-44ae-aadf-faf0804622b5` su `main` `2dd1fce`,
   preview `2c4096b6-1b3e-433b-ab40-8de64c61fe1d` sullo stesso SHA e produzione
   precedente `87e32483-11e6-4fd0-943d-f44c8b7f1921` su `dfbe64f`.
   Letti dal checkout primario i record locali produzione/preview: esito
   `verificato`, smoke **6/6**, build rispettivamente `0cabb1f1c5e538c4` e
   `1ae5d163b0adab38`, indicizzazione produzione `index`, preview `noindex`.
   Il record richiesto è `.release/production-2dd1fceca321-db372cc6.json`.
   Manifesto online: commit completo `2dd1fce…4265`, build `0cabb1f1c5e538c4`.
   Ricontrollati 6/6 percorsi per entrambi gli ambienti, robots Allow+sitemap
   in produzione, noindex+Disallow sulla preview.

4. **PASS — pagine e prove.** Le quattro route `/note-versione`,
   `/en/note-versione`, `/note-versione/mox-v2-beta2-11-10` e
   `/en/note-versione/mox-v2-beta2-11-10` rispondono 200 con le note 2.11.10
   nella lingua prevista. `node strumenti/smoke_beta.mjs --site
   https://moxtracker.app`: **14/14**, comprese le risposte attese 401 e 204.
   `npm run prove`: **634/634** dopo installazione delle dipendenze del lockfile;
   i tentativi preliminari con dipendenze mancanti/loopback limitato dalla
   sandbox non sono contati come PASS. Build successiva alla suite, in sequenza:
   **149 file**, build `0cabb1f1c5e538c4`, tutti i 149 hash identici al record
   di produzione. `node prove/news-build.check.mjs`: **5 PASS, 1 SKIP**
   esplicito per il controllo riservato alla build preview; noindex remoto
   verificato separatamente al punto 3.

5. **PASS con limite dichiarato — prova telefono.** Esaminate tutte e tre le
   immagini in `.release/screenshots/stable-2.11.10/` del checkout primario.
   `mobile-edge-headless-taglia.png` mostra effettivamente testo e pulsante
   tagliati a destra; `mobile-375-emulato.jpg` mostra una vista stretta leggibile
   a 375 px. La descrizione dichiara correttamente emulazione, non telefono
   fisico. Gli hash delle due immagini selezionate coincidono con il record:
   desktop `0074d76f7820ff78547aa7034f12ce67bb31f5e8bb1326c3b026321c252df92e`,
   mobile `c86462e6cb53fbb6cc4eb3e5de446cb7cae87409ed901f8ebcaf7b3965bfd335`.
   Controllo indipendente del sito IT/EN nel browser integrato a viewport
   375×812: nessun overflow orizzontale (`clientWidth = scrollWidth = 360`,
   `innerWidth = 375`, barra verticale presente). Il valore storico
   `scrollWidth = 375` resta una misura riportata dall'autore, coerente con la
   schermata senza barra; non è il valore rimisurato qui. Le immagini attestano
   il taglio nella cattura Edge, non ne isolano la causa tecnica. Nessuna
   certificazione di dispositivo fisico o di ogni larghezza.

6. **PASS — contenuti pubblici e riservatezza nel perimetro.** Confrontati con
   gli hash del record **113 asset testuali online** HTML/JS/JSON/CSS/TXT/XML:
   nessuna menzione di Canary o tester. Per le due Privacy la comparazione
   ripristina soltanto l'indirizzo pubblico offuscato da Cloudflare e rimuove
   il relativo script automatico; dopo questa normalizzazione gli hash
   coincidono. Nessuna modifica ai testi Privacy. Controllati diff #52/#53,
   note nuove, bundle e schermate: nessun dato privato rilevato. Le fonti e i
   corpi tecnici restano nei JSON interni e non sono inclusi nella build.
   Record, schermate, log e materiale di prova locale restano fuori Git.

## Correzioni e limiti della consegna

Unica modifica al lavoro di Claude: il testo del rollback Pages in
`STATO-CORRENTE-SITO.md` (rilievo 1), più questo unico file di audit. Nessun
cambiamento a codice, snapshot, note pubbliche o configurazione. L'autorizzazione
storica di Dennis e l'approvazione editoriale della #51 sono premesse esplicite
del mandato; questa review non ricertifica il client o la promozione Stable.
