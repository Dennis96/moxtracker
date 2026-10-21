# Review indipendente Codex — A145, installer dalla cache

**Esito: FAIL — giro 1 di massimo 2.** 0 BLOCKER, **1 MAJOR**, 1 MINOR.
Il MAJOR richiede una modifica al Worker: corregge Claude, poi Codex verifica
il delta aggiornando questo stesso file. Nessun fix applicato dal reviewer.

- Data: 21/10/2026, Europe/Rome.
- PR: [moxtracker #48](https://github.com/Dennis96/moxtracker/pull/48).
- Branch: `claude/a145-cache-installer-2026-10-21`.
- SHA rivisto: **`c24df91f3aafa64a9b08b0eb67797a88b9517899`**.
- Base: `main`, **`58cfeb6a76a90cb89a3aa72aa51095d2acce4b00`**.
- Requisito A145: `mox-core/ARRETRATI.md` sul branch
  `claude/registra-canary-2.11.10-2026-10-21`, SHA
  `975ce4aadd405c3045a557a326704f8b4501328b`, verificato anche sul remoto.
  **Premessa aggiornata rispetto al briefing:** quel branch risulta già
  integrato in `mox-core/main`, merge della PR #53
  `d6b57cbb23066d56e0a0ef5b63b87998f69e9aa9`; verificata l'ascendenza Git.
  Il requisito A145 letto resta lo stesso; il perimetro della review non cambia.
- Letti prima della review: `mox-core/AGENTS.md`, incluso «Il ciclo di un
  lavoro», policy della workspace, `STATUS.md`, `LAVORI.md`, A145;
  `moxtracker/AGENTS.md`, `LEGGIMI.md` e prima sezione dello stato sito.
- Worktree propria: `worktrees/sito-a145-review-codex-2026-10-21`, creata
  dal branch della PR con HEAD staccato: il branch era già aperto da Claude.
  Nessun branch aggiuntivo. Unico file tracciato scritto: questo report.

## Finding

### MAJOR-1 — La cache sospesa impedisce anche il ripiego e il 404

**Riferimento:** `src/index.js:283–295`, `installerDallaCache`.

`Promise.all` attende sia `head()` sia `fetch()`. La `.catch()` copre un
rigetto, ma non una sottorichiesta che resta in attesa delle intestazioni.
Non esistono un termine di attesa o un segnale di annullamento. Se la cache
rimane sospesa, un `head()` già fallito non provoca `get()` e un `head()`
già concluso con `null` non produce il 404. Anche con metadati validi il
ripiego sul binding aspetta indefinitamente, nel codice, la cache opzionale.
Il timeout eventuale della rete/piattaforma non è un ripiego controllato
dal Worker e può arrivare dopo quello del client che si aggiorna.

**Riproduzione sintetica sullo SHA rivisto, senza rete:** `fetch` restituisce
una Promise differita; `head` restituisce subito un errore, `null` o metadati
validi; `get` può servire subito due byte. Dopo una finestra di osservazione
di 150 ms, poi sbloccando manualmente la cache con un 503:

```text
head-errore: osservato=PENDING, get=0; dopo sblocco: 200, get=1
head-assente: osservato=PENDING, get=0; dopo sblocco: 404, get=0
head-valido: osservato=PENDING, get=0; dopo sblocco: 200, get=1
Prove rosse: 2/2; fetch ripristinato: true; exit 1
```

Le due asserzioni rosse chiedono che l'esito già deciso da `head` non
dipenda dallo sblocco della cache. I 150 ms servono soltanto a osservare
la dipendenza; non sono un timeout di produzione proposto. Il terzo caso
mostra la mancanza di un limite esplicito all'attesa della cache.

Riproduzione minima dei primi due casi, da eseguire nella worktree con Node:

```javascript
import server from './src/index.js';
const originale = globalThis.fetch;
try {
  for (const caso of ['errore', 'assente']) {
    let sblocca, letture = 0;
    globalThis.fetch = () => new Promise(r => { sblocca = r; });
    const bucket = {
      async head() {
        if (caso === 'errore') throw new Error('R2');
        return null;
      },
      async get() {
        letture++;
        return { size: 2, body: new Blob(['ok']).stream() };
      },
    };
    const url = `https://test.invalid/mox/installer/2.12.0/${'a'.repeat(64)}/Mox-Installer-win-x64.exe`;
    const attesa = server.fetch(new Request(url), {
      MOX_RELEASES: bucket, MOX_RELEASES_CACHE_ORIGIN: 'https://cache.invalid',
    });
    const osservato = await Promise.race([
      attesa.then(r => r.status),
      new Promise(r => setTimeout(() => r('PENDING'), 150)),
    ]);
    console.log(caso, osservato, letture);
    sblocca(new Response(null, { status: 503 }));
    const esito = await attesa;
    await esito.text();
  }
} finally { globalThis.fetch = originale; }
```

**Correzione richiesta:** rendere limitata e annullabile l'attesa della
cache; non attendere una copia ormai inutile quando `head` fallisce o
dichiara l'assenza. Annullare/chiudere la richiesta e un'eventuale risposta
tardiva, senza lasciare rigetti non gestiti. Conservare il 404 senza `get()`
quando l'oggetto manca, e il ripiego su `get()` negli altri casi. La scelta
del limite deve considerare la latenza misurata, senza imporre un timeout
breve all'intero trasferimento dell'installer a cache fredda. Aggiungere
prove deterministiche per attesa, annullamento e risposte tardive.

### MINOR-1 — Preriscaldamento e limiti della cache da rendere canonici

**Riferimenti:** `STATO-CORRENTE-SITO.md:15–23`, `src/index.js:269–275`;
`mox-core/passaggi/release/PROCEDURA-CANONICA-RELEASE-MOX.md`, §10.

Il preriscaldamento è descritto soltanto nello stato del sito. Va inserito
nella procedura canonica di release di mox-core, dopo l'upload nella chiave
immutabile e prima di esporre il manifesto ai client. Serve un GET completo
dell'URL esatto, concluso con successo e controllato contro dimensione e
SHA-256 dell'installer. Una HEAD o un trasferimento interrotto non certificano
il riempimento. Registrare il controllo nel normale handoff della release.

Il commento «la prima richiesta la riempie per tutti i centri» è troppo
assoluto: Smart Tiered Cache condivide un livello superiore, non popola
preventivamente tutti i livelli inferiori. Inoltre un anno è la freschezza,
non una garanzia di permanenza: Cloudflare può espellere l'oggetto prima.
Il primo accesso dopo espulsione può tornare lento. [Documentazione R2/Tiered
Cache](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/),
[retention e TTL](https://developers.cloudflare.com/cache/concepts/retention-vs-freshness/).

Non occorre introdurre ora altri servizi o download periodici. Dopo un
eventuale deploy autorizzato resta necessario un collaudo GET della route
reale, con byte verificati e misure da ZRH/MUC: il preriscaldamento da solo
non dimostra le prestazioni del Worker. L'attribuzione della lentezza al
percorso Worker→R2 è coerente con le misure riportate; la causa interna a
Cloudflare resta un'inferenza, non una diagnosi confermata.

## Codice, stream e copertura

La regex `PERCORSO_INSTALLER` ammette soltanto versione numerica a tre
componenti, SHA-256 esadecimale minuscolo di 64 caratteri e nome esatto.
La chiave usata nel fetch deriva da quella regex; l'origine è configurata
in `wrangler.toml`, non arriva dal client. Non emerge un SSRF controllabile
dalla richiesta. `/mox/download.exe` salta sia cache sia `head`; con origine
assente resta la lettura precedente dal binding.

La copia è accettata soltanto con status 200, body presente, `content-length`
esattamente uguale a `String(head.size)` ed ETag esattamente uguale a
`head.httpEtag`. Una copia divergente non viene servita. Con Promise concluse,
errori della cache o di `head` ripiegano correttamente; `head === null`
restituisce 404 senza leggere byte dal binding. Resta MAJOR-1 sull'attesa.

Matrice supplementare locale **16/16 PASS**: copia valida; dimensione/ETag
divergenti; intestazioni mancanti; status 201, 206, 302, 304, 404, 500;
body assente; rigetto del fetch; rigetto di head; oggetto assente;
rigetto di `cancel()`. Gli stream scartati con corpo sono stati annullati
una volta, senza invocare `pull`; il rigetto di cancel è gestito. Nessun
buffer dell'intero installer e nessuna eccezione nuova emersa in tali casi.

Confrontate programmaticamente tutte le intestazioni di successo con la
funzione estratta dalla base `58cfeb6`: identiche su cache e binding, con
la sola aggiunta `x-mox-installer`. `set-cookie`, `location` e altre
intestazioni della sottorisposta non vengono inoltrate. Il valore `cache`
identifica il percorso via dominio, **non certifica un HIT**: può essere MISS.

Le quattro prove A145 coprono il percorso valido, sei guasti della copia,
errore di head, storico, percorso invalido e assenza dell'oggetto. Il fetch
finto è ripristinato in `finally`, anche con eccezioni/asserzioni fallite.
Mancano attesa senza conclusione e annullamento tardivo: aggiungerli con il fix.
Il positivo distingue intenzionalmente il corpo finto dalla copia nel bucket;
verifica il ramo scelto, non una verifica crittografica dei byte. Il Worker
si fida dell'identità ETag/dimensione di R2; SHA-256 e firma restano verifiche
del client. Non ho ripetuto il download integrale reale riportato da Claude.

## Contratto Cloudflare e sicurezza del dominio

Verifica documentale del 21/10/2026, su fonti ufficiali:

- `fetch()` attraversa cache CDN e Tiered Cache, se abilitata;
  `caches.default` non avrebbe questa proprietà. [Workers e cache](https://developers.cloudflare.com/cache/interaction-cloudflare-products/workers/).
- Se l'URL non appartiene a una zona diversa, `fetch` usa la cache della
  propria zona, con la chiave dell'hostname della sottorichiesta. Il Worker
  su Custom Domain può chiamare dipendenze con `fetch`; non si applica qui
  il divieto di invocare un altro Worker su una semplice Route della stessa
  zona. [Funzionamento della cache](https://developers.cloudflare.com/workers/reference/how-the-cache-works/),
  [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).
- `cacheEverything: true` abilita anche i tipi non normalmente memorizzati;
  `cacheTtlByStatus` prevale sulle istruzioni dell'origine per gli status
  specificati. `200: 31536000` equivale a 365 giorni; **qualsiasi valore
  negativo, quindi -1, significa non memorizzare**, mentre zero significa
  scadenza immediata. `201-599: -1` è corretto. [Request, proprietà cf](https://developers.cloudflare.com/workers/runtime-apis/request/).

La configurazione è dunque compatibile con il percorso desiderato. Non è
una misura della sottorichiesta in produzione: A145 non è stato deployato.

Un Custom Domain rende accessibili tutti gli oggetti del bucket, anche
chiavi che la regex del Worker non ammetterebbe. L'assenza di listing non è
un controllo di accesso. Assumendo l'inventario di **9 oggetti pubblicabili**
fornito nel mandato, non emerge un blocco di sicurezza per gli oggetti
attuali. Raccomando una regola WAF limitata a `releases.moxtracker.app` che
ammetta soltanto GET/HEAD sotto `/installer/` (meglio la forma esatta delle
chiavi): difesa per i caricamenti futuri, senza coinvolgere lo storico
servito dal binding. Non l'ho configurata. Se il bucket dovesse contenere
materiale non pubblico, il limite d'accesso diventerebbe un prerequisito.
[Bucket pubblici, listing, WAF e r2.dev](https://developers.cloudflare.com/r2/buckets/public-buckets/).

Non ho rieseguito un inventario R2, né letto la configurazione Smart Tiered
Cache o il flag r2.dev: il numero di oggetti e questi due stati sono premesse
del mandato, non fatti verificati indipendentemente con `domain list`.

## Prove eseguite

Ambiente: Node **v24.19.0**, npm **11.17.0**, Wrangler **4.123.0** da lockfile.

| Comando / controllo | Esito essenziale |
|---|---|
| `npm ci` | exit 0; 34 pacchetti installati, 35 analizzati. Segnalate 4 vulnerabilità high; lockfile invariato, nessun aggiornamento applicato. |
| `npm run prove`, dopo installazione | **635 test, 635 pass, 0 fail, 0 skipped, 0 cancelled**, exit 0; circa 9,84 s. |
| `npx wrangler deploy --dry-run --outdir .dist/worker-dry-run` | exit 0; bundle generato; `--dry-run: exiting now.`; nessun deploy. Avviso EPERM sulla sola scrittura del log globale di Wrangler nel sandbox. |
| `npm run sito:build` | exit 0; build `9e1ec740558c9168`, 147 file. |
| `git diff 58cfeb6 origin/claude/a145-cache-installer-2026-10-21 -- src wrangler.toml package.json package-lock.json` | Solo funzioni di download installer in `src/index.js` e nuova `MOX_RELEASES_CACHE_ORIGIN`; `package.json` e lockfile identici alla base. |
| `git diff --check 58cfeb6 HEAD` | exit 0. |
| Matrice supplementare e confronto intestazioni | 16/16 e confronto con la base PASS; storico/origine assente senza fetch/head PASS. |
| Riproduzione MAJOR-1 | Due asserzioni rosse, exit 1; dettagli sopra. |

Il diff completo originale contiene soltanto `src/index.js`, `wrangler.toml`,
`prove/server.test.js` e le 34 righe iniziali aggiunte allo stato sito.
Nessuna modifica a D1, manifesti o altri download.

Limiti iniziali dell'ambiente: il primo `npm ci` nel sandbox ha fallito per
DNS; una prima suite avviata prima che l'installazione riuscisse ha dato
633/635 (Wrangler assente e fetch loopback non riuscito). Installazione
completata, la suite richiesta è stata rieseguita con accesso al server
loopback sintetico e ha dato 635/635. Nessun endpoint Research reale chiamato
per riprodurre il redirect della prova.

## Produzione: sole letture richieste

Due sole richieste `curl.exe -sI`, con limiti di connessione/tempo, sullo stesso
installer **2.11.10**, SHA nella chiave
`7ee602069ad7b0c94af2edd9ad6b162089ab3326953b1192a4b70bb943388a97`.
Ora delle risposte: **21/10/2026, 17:35:25 CEST**.

```text
https://releases.moxtracker.app/installer/2.11.10/<sha>/Mox-Installer-win-x64.exe
HTTP 200
Content-Length: 67335053
ETag: "916dac2714aea0c442a621a7b0f854eb"
cf-cache-status: DYNAMIC
centro: ZRH

https://api.moxtracker.app/mox/installer/2.11.10/<sha>/Mox-Installer-win-x64.exe
HTTP 405
Content-Type: application/json; charset=utf-8
nessun ETag, Content-Length o cf-cache-status
centro: MUC
```

Il 405 è coerente con il codice preesistente: la route accetta GET, non HEAD.
Non è una regressione A145. Le HEAD non permettono qui di confrontare
ETag/dimensione fra API e dominio, misurare throughput o confermare un HIT
sui GET. `DYNAMIC` è l'esito osservato della HEAD: non lo trasformo in una
conclusione sui GET. Nessun download integrale o in ciclo aggiunto.

`npx wrangler r2 bucket domain list moxtracker-releases`: exit 0:

```text
domain: releases.moxtracker.app
enabled: Yes
ownership_status: active
ssl_status: active
min_tls_version: 1.2
zone_name: moxtracker.app
```

## Stato sito, rollback e chiusura

La prima sezione distingue correttamente infrastruttura già modificata,
codice non deployato e prova remota precedente di Claude. Le velocità sono
misure riportate da Claude, non ripetute in questa review. Vanno applicate
le precisazioni MINOR-1 e non esteso il testo del ripiego al caso sospeso
ancora difettoso. La sezione non introduce dati privati, log di giocatori,
segreti o identificativi di account; dominio, bucket, hash e misure tecniche
sono condivisibili nel repository pubblico.

Sintassi del rollback verificata con il solo help locale di Wrangler:

```text
wrangler r2 bucket domain remove moxtracker-releases --domain releases.moxtracker.app
```

Riportare Smart Tiered Cache a `off` corrisponde al precedente stato
dichiarato; il suo ambito è l'intera zona, non solo questo hostname. Sono
istruzioni di ritorno, **non eseguite**. Nessun deploy, `dev --remote`, cambio
di secret/variabili remote, rollback, merge, scrittura R2/D1 o configurazione
di zona/dominio effettuato durante la review.

**ROOT HYGIENE CHECK: PASS per gli artefatti introdotti dal task, con limite
preesistente esplicito.** Root parent identica all'inizio; nessun nuovo file
loose o top-level; worktree propria sotto `worktrees/`; prove grezze e script
sintetico sotto `Non pubblicare/evidenze/2026-10-21/review-codex-a145-cache-installer/`.
`node_modules/` e `.dist/` sono output ignorati previsti. Registri dei tre
repository verificati: 11 worktree registrate, nessuna directory mancante;
primari clean e non modificati. Esiste una worktree di verifica preesistente
registrata fuori `worktrees/`: non spostata né rimossa, fuori perimetro.
Nessun inventario privato incluso in Git. La worktree di review resta per la
delta review del lavoro aperto; nessun mandato di pruning o merge ricevuto.

**Prossimo passo:** Claude corregge MAJOR-1, aggiunge le prove e precisa il
preriscaldamento; Codex controlla il delta in questo stesso file. Nessun PASS
al merge con MAJOR-1 aperto. Lo SHA e il link del commit di consegna sono
forniti nel commento della PR dopo il push verificato.
