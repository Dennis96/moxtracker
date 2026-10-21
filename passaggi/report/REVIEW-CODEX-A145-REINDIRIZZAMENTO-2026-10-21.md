# Review Codex A145 — reindirizzamento degli installer

**Esito: FAIL — giro 1 di massimo 2, 21/10/2026.** Un MAJOR aperto.
Il codice del rimando e il client verificabile sono corretti; manca la policy
di durata della cache per gli installer che saranno caricati dopo il cambio.

## Perimetro e riferimenti

- PR: [#49](https://github.com/Dennis96/moxtracker/pull/49), branch
  `claude/a145-reindirizzamento-2026-10-21`.
- SHA rivisto: **`42b2f60283c1bd2073033c80373c97c269b42b2d`**.
- Commit di solo stato: `2ac62cb22fbf693f890ac61e8625554d25f2c969`;
  base verificata: `88d7fede1d4e25f67cda08df51e8477634689bc4`.
- Client letto: mox-core `d6b57cbb23066d56e0a0ef5b63b87998f69e9aa9`,
  con controllo delle otto revisioni di `strumenti/aggiornamenti.py` su main.
- Letti prima della review gli AGENTS dei due repository, il ciclo di lavoro,
  la policy della workspace, lo stato e i documenti pertinenti.
- Review indipendente del lavoro di Claude; nessuna modifica a codice o prove.

## Rilievi

**BLOCKER:** nessuno.

### MAJOR-1 — il TTL annuale scompare dai nuovi riempimenti della cache

Riferimenti: `src/index.js:270-292`, `wrangler.toml:27-30`,
`STATO-CORRENTE-SITO.md:34-37` e `:60-72`.

La #48 forzava un anno sui 200 con `cf.cacheTtlByStatus`; la #49 elimina
quella richiesta dal Worker. Non risulta una Cache Rule sul dominio, come
specificato nel mandato. Un nuovo GET diretto segue quindi la policy della
zona e gli header dell'origine: EXE è già cacheabile, ma, senza una scadenza
fornita dall'origine, il TTL edge predefinito di un 200 è **120 minuti**.
Le copie già riempite dal vecchio Worker non dimostrano la durata delle nuove.
Il `cache-control: max-age=14400` osservato dal client non prova un TTL edge
di quattro ore: la policy browser può aggiungere quell'header.

Conseguenza: il GET completo prima del manifesto scalda la copia, ma non
conserva per un anno la freschezza dei futuri installer. Alla scadenza può
essere necessaria una lettura/revalidazione dall'origine; in caso di MISS
ritorna il percorso freddo, documentato qui a 18–70 KB/s da ZRH. Il rischio
di ricaduta di A145 dopo il preriscaldamento è concreto. Non ho forzato né
misurato una scadenza in produzione.

**Correzione richiesta:** predisporre e documentare, prima del deploy del
rimando, una policy limitata a `releases.moxtracker.app` e agli installer
immutabili: TTL edge di un anno sui 200 ed esclusione dalla cache degli
errori, in particolare 404. Una Cache Rule è la soluzione coerente con il
dominio diretto; non serve a rendere cacheabile EXE, serve a conservare la
durata e la gestione degli errori della soluzione precedente. Aggiornare
STATO e il requisito di preriscaldamento distinguendo vecchie e nuove copie.
L'applicazione della regola richiede l'autorizzazione separata di Dennis;
questa review non la esegue. Anche con la regola la conservazione fisica
della copia non è garantita: resta possibile un'espulsione anticipata.

Fonti ufficiali verificate il 21/10/2026:
[comportamento predefinito](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/),
[TTL edge e browser](https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/),
[freschezza e conservazione](https://developers.cloudflare.com/cache/concepts/retention-vs-freshness/).

### MINOR-1 — il secondo blocco A145 descrive ancora la #48 come non deployata

Riferimento: `STATO-CORRENTE-SITO.md:74-87`.

Il primo blocco registra correttamente il deploy `6f3d3fed`; il secondo dice
ancora «branch claude/a145-cache-installer-2026-10-21, non deployato» e
«La misura vera si fa dopo il deploy». È uno stato precedente, presentato
come corrente nella stessa pagina. Marcarlo esplicitamente come precedente
al deploy oppure sostituirlo con il riferimento al deploy già registrato.
Nessun errore negli UUID di deploy e rollback riportati in cima.

## Worker e contratto del rimando

Verificato in `src/index.js` e nelle prove:

- `PERCORSO_INSTALLER` accetta soltanto versione a tre numeri, SHA-256
  esadecimale minuscolo di 64 caratteri e nome fisso dell'installer.
  `chiaveInstaller` ricostruisce la chiave; host, query e destinazioni
  fornite dal richiedente non entrano in `location`. Nessun open redirect.
- Per una chiave valida e origine configurata: `302`, corpo nullo,
  `location = MOX_RELEASES_CACHE_ORIGIN/<chiave>`, `no-store`,
  `x-mox-installer: cache`, nessun `content-type`; tutte le intestazioni
  CORS precedenti restano presenti. L'origine è configurazione fidata.
- `head` uguale a `null`: 404 senza rimando. **Accetto il rimando quando
  `head` rigetta:** evita di dipendere dal binding per un download che il
  dominio può servire dallo stesso bucket; eventuali byte errati non
  superano la verifica del client. Una 404 eventualmente già in cache sul
  dominio resta però possibile: rientra nella gestione della cache sopra.
- Nessun `fetch` dell'installer e nessun `get` del corpo nel percorso 302.
  `/mox/download.exe` e l'assenza della variabile mantengono il binding,
  le intestazioni del download e il comportamento precedente. Binding
  assente: 503; metodi diversi da GET: comportamento precedente.
- Il contratto cambia intenzionalmente da 200 con corpo a 302 per gli URL
  immutabili. `x-mox-installer: cache` indica il percorso, non un HIT.

## Client, versioni precedenti e integrità

`strumenti/assistente.py:1358-1359` chiama
`scarica(release, avanzamento=avanzamento)` senza `apri`.
`scarica` lo lascia a `None`; `_scarica_verificato:362` usa quindi
`urllib.request.urlopen`, il cui opener predefinito comprende il gestore
dei rimandi. Un 302 GET HTTPS verso HTTPS su host diverso è accettato,
verificato anche invocando il gestore Python con quei due schemi.

La firma RS256 viene verificata sul manifesto da `_valida_manifesto`, anche
all'ingresso di `scarica`; il manifesto firmato vincola dimensione e SHA-256.
Il ciclo di lettura conta e calcola l'impronta dei **byte finali**, rifiuta
eccesso, troncamento e SHA errato prima del rename del temporaneo. Non è una
firma Authenticode dell'EXE e non richiede che l'URL finale coincida con
quello firmato. Il rimando non indebolisce questa catena.

Le otto revisioni Git dell'updater su main, da `3f618cb` a `703465f`, usano
tutte `apri or urllib.request.urlopen`; nessun downloader che rifiuti il 302
è stato trovato in queste revisioni. I gestori restrittivi di altri
sottosistemi (`aggiorna_meta`, dati Draft) non sono installati globalmente
e non governano il download dell'installer.

**Limite per minima 2.9.5:** la storia Git verificabile introduce questo
file con la 2.9.12. Gli archivi di stato 2.9.7/2.9.8 parlano di aggiornamento
da 2.9.5 e di una simulazione del client, ma non provano quale downloader
contenesse ciascun binario 2.9.5–2.9.11. Non erano disponibili qui gli
artefatti di quelle versioni. Non affermo quindi che ogni vecchio binario
supportato sia stato certificato: per chiudere questo punto occorre il
codice o un artefatto verificabile del client più vecchio effettivamente
distribuito. Non è emerso un caso concreto incompatibile.

La risposta finale del dominio non aveva `access-control-allow-origin`;
questo non ostacola urllib. Il sito scarica invece lo ZIP GitHub tramite
navigazione (`sito/js/config.js`, `download.js`), quindi non introduce qui
un fetch browser dell'installer che richieda CORS sul dominio finale.

## Purge e registro operativo

Il purge dell'**URL esatto del dominio releases**, già annotato nello STATO,
è sufficiente a invalidare quella copia CDN con la chiave standard attuale,
anche con cache a livelli. Non occorre un purge del 302 del Worker, che è
`no-store`. Non risolve MAJOR-1 e non invalida copie nei browser.

La regola corretta resta non riscrivere una chiave con hash: byte diversi
richiedono nuova chiave e nuovo manifesto firmato. Il purge serve anche a
recuperare una copia errata o una precedente 404; dopo il purge va ripetuta
la verifica completa di dimensione e SHA prima di esporre il manifesto.
[Consistenza R2 e cache](https://developers.cloudflare.com/r2/reference/consistency/),
[purge per URL](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-single-file/).

Il registro riporta correttamente Worker
`6f3d3fed-75b8-4adb-b4fd-9cd9f3642bee` e rollback
`d01d1afd-1e98-400b-9726-481722049de8`, coerenti con il mandato e la PR.
Non ho interrogato la configurazione privata di Cloudflare per certificarne
lo stato live. La misura diretta indipendente sotto è coerente con la
diagnosi del passaggio del corpo dal Worker; non dimostra una causa interna
di Cloudflare né la lentezza universale di ogni possibile corpo.
Restano dichiarati i limiti di `/mox/download.exe` e dei dati Draft.
Nelle due sezioni A145 non ho trovato dati privati: solo riferimenti
operativi, chiavi degli installer pubblici e misure aggregate.

## Prove e output essenziale

Ambiente: Node `v24.19.0`, npm `11.17.0`, Wrangler da lockfile `4.123.0`,
Python della prova facoltativa `3.12.14`.

```text
npm ci
added 34 packages, and audited 35 packages
exit 0; 4 high severity vulnerabilities segnalate da npm

npm run prove
tests 634; pass 634; fail 0; cancelled 0; skipped 0
duration_ms 11701.8476; exit 0

node --test --test-name-pattern='A145:' prove/server.test.js
tests 3; pass 3; fail 0

npx wrangler deploy --dry-run --outdir .dist/worker-dry-run
Total Upload: 1738.64 KiB / gzip: 471.74 KiB
--dry-run: exiting now; exit 0

git diff 88d7fed origin/claude/a145-reindirizzamento-2026-10-21 -- src wrangler.toml package.json package-lock.json
src/index.js: +27/-53; wrangler.toml: +2/-2
package.json e package-lock.json: nessuna differenza

git diff --check 88d7fed HEAD
exit 0
```

La prima suite nella sandbox aveva dato 633/634: la prova preesistente
`raccolta: un redirect HTTP non esce dalla whitelist degli endpoint` non
raggiungeva il loopback. Isolata fuori sandbox passa, così come la suite
completa ripetuta con accesso al loopback. Non è stata cambiata né saltata.
Il primo dry-run aveva un errore di scrittura del log fuori workspace;
ripetuto con log locale nell'area delle evidenze e telemetria disabilitata
passa senza quell'errore. Nessuna variabile di produzione modificata.
Le dipendenze sono identiche alla base; l'avviso npm non nasce dalla PR e
non è stato applicato alcun aggiornamento automatico.

Le tre prove A145 sostituiscono quelle della #48 ormai legate al proxy del
corpo. `senzaFetch` registra ogni tentativo e lancia: anche un errore
inghiottito dal codice farebbe fallire il conteggio finale. Ripristina
`globalThis.fetch` in `finally`, anche se il corpo della prova fallisce.

Prova facoltativa: server HTTP soltanto su loopback, 302 verso l'URL HTTPS
2.11.10 indicato nel mandato, `urllib.request.urlopen` predefinito con
User-Agent Mox. **Un solo download completo**, nessun installer eseguito:

```text
URL finale corretto: True; stato: 200
content-length: 67335053; cf-cache-status: HIT; age: 5693
cache-control: max-age=14400; centro: ZRH
byte: 67335053
SHA-256: 7ee602069ad7b0c94af2edd9ad6b162089ab3326953b1192a4b70bb943388a97
secondi: 1.921; MB/s decimali: 35.05
```

Una precedente sola lettura del manifesto pubblico aveva ricevuto HTTP 403
prima di iniziare un download; non certifico da quella chiamata il manifesto
live o la sua minima. La firma è stata controllata nel codice, non mediante
la prova reale del manifesto in questa sessione. La prova loopback copre
HTTP verso HTTPS; HTTPS verso HTTPS è stato verificato separatamente sul
gestore della libreria, senza un secondo download.

## Consegna e controllo workspace

Unico file tracciato prodotto: questo report sul branch della PR. Log locali
nelle evidenze private; dipendenze e bundle del dry-run ignorati da Git.
Nessun nuovo elemento nella root parent; primari core e sito puliti;
registri worktree leggibili e tutti i percorsi registrati presenti.
La worktree di questa review è sotto `worktrees/` e resta per il secondo
giro. Esiste una worktree core preesistente fuori da quella directory:
eccezione non creata né modificata qui; nessun riordino o pruning autorizzato.
Nessun inventario privato è incluso nel report. Nessuno spostamento manuale,
nessun deploy, dev remoto, secret, modifica di variabili remote, rollback,
merge, scrittura R2/D1 o modifica della zona/dominio.

Prossimo passo: Claude corregge MAJOR-1 e MINOR-1 sullo stesso branch e
fornisce l'evidenza disponibile sui client più vecchi; Codex verifica il
delta al giro 2. Nessuna correzione applicata dal reviewer perché il punto
principale riguarda la policy di rete e un'operazione di infrastruttura.
