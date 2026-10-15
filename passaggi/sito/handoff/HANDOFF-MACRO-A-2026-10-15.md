# Macro A — News, Guide, Privacy e canonici, 15/10/2026

**Candidata di sviluppo Codex, non pubblicata.** Report unico della consegna;
registro cross-repo nel branch core, collegato sotto. Review indipendente in
nuova chat e approvazione del titolare ancora pendenti. Nessun merge, preview
remota, deploy Pages/Worker, release, migrazione, secret o dato produzione.

## Baseline e perimetro verificato

| Repository | Base origin/main riconfermata dopo fetch | Branch |
|---|---|---|
| tracker | `a08ee510152044b544ecdec014dd0876fd3920b0` | `claude/mox-site-news-guides-privacy-2026-10-14` |
| core | `67c683e36e5ee82beeb85e21effc6677991028c2` | `claude/mox-canonics-audit-draft-omen-2026-10-14` |
| meta | `7057c8d418e331e19f45fc6b1711ee9aaf934e28` da verifica remota iniziale/audit | generated-only, nessuna modifica |

Primari tracker/core inizialmente puliti; nessuna PR aperta concorrente al
preflight. Nessuno stash/reset/pull/force push, nessun checkout primario usato
per sviluppo. Worktree proprie sotto `Progetto Magic/worktrees/`:
`macro-a-site-2026-10-15` e `macro-a-core-2026-10-15`; registrazione temporanea
in LAVORI core, da togliere alla consegna. Non riusate worktree di altri.

Letti gli ingressi canonici richiesti, policy workspace, procedura release
§§12–15, fonti dati e Privacy pertinenti. Audit originale recuperato via
`git show 9e76015cbe9f88b24da9dc3eb88544912a8add91:passaggi/sito/audit/AUDIT-DRAFT-OMEN-VS-MOX-PRIVACY-DOCS-NEWS-2026-10-14.md`,
incluso §13. Nessuna nuova esplorazione del repository concorrente.

## Risultato implementato

News: CLI Node senza dipendenze aggiuntive → snapshot JSON last-valid → HTML
statico IT/EN. Lista numerata fino a pagina vuota, Latest indipendente,
normalizzazione ID/tag/versione/URL/data/asset/digest, controlli biunivoci e
ritiri confermati anche per ID. Cache ETag/304 verificata; tre tentativi con
Retry-After/rate reset limitati. Scrittura atomica solo dopo validazione.
Nessun token richiesto, polling o GitHub fetch per il lettore della cronologia.

Snapshot aggiornato: **27 pubblicazioni, zero tombstone**,
`2026-10-15T19:03:04.940Z`. Ultima pubblicazione GitHub 2.11.8.
Fonti distribuzione verificate alle `2026-10-15T19:03:05.918Z`: firme RS256
Stable **2.11.8** e Canary **2.11.9** valide. Il canale richiesto governa la
classificazione; il campo interno `canale=stable` della Canary non promuove.
Gli ZIP non sono stati riscaricati: digest è metadata GitHub, non ricalcolo
locale del pacchetto. Installer non eseguito; nessun field test client nuovo.

Le 27 legacy sono esplicite. 2.9.12: nota mancante dichiarata; 2.9.28: escape
letterali preservati; cornice EN con originale italiano identificato. Nessuna
riscrittura GitHub o traduzione storica inventata. Commit client solo se
attestato nel body; target/main del tracker non usato come provenienza core.
Le future pubblicazioni prive di ricevuta restano «promozione non verificata».

Renderer Markdown minimale: testo/titoli/liste/codice/link HTTPS verificati,
HTML e immagini inerti, nessuna dipendenza nuova. Dettagli con slug del tag a
trattini per evitare ambiguità di estensione nel server locale. Vecchi
`/note-versione`, `/note-versione.html` e varianti EN conservati; canonical,
hreflang IT/EN/x-default, OG, sitemap e date UTC esplicite.

Download: mantiene resolver ZIP GitHub; corregge il caso concreto di rollback.
Ogni click riverifica Latest e Stable, con condivisione delle sole richieste
in corso e `cache:no-store`; divergenza o fonte non verificabile blocca il
download con messaggio. Nessun endpoint/manifesto remoto modificato. Le
richieste del piccolo riepilogo esistente possono condividere la stessa promise.

Menu unico: Home, Meta, Draft, Guide, Aggiornamenti, Il mio MOX, Supporto,
lingua; Scarica separato. Menu mobile fino a 1100 px. Home con «Inizia con MOX»
e Aggiornamenti a un clic e Stable verificata datata. Nessun redesign generale.

Guide: `/guide` e `/en/guide`, slug identici nelle due lingue per coerenza con
la build esistente; otto capitoli sostanziali in entrambe le lingue. Un’unica
sorgente editoriale `strumenti/news/guide.mjs`; installazione estesa resta in
Download, collegata. Score 0–110 distinto da WR, GIH/GP ricentrato/ATA/prior
0,54/campioni/Wilson, ibridi/segnali, coppie e limiti mana espliciti. Nessun ML
attivo o superiorità scientifica promessa; nessuna correzione S5 anticipata.

Privacy/Cosa invia: candidata IT/EN, contenuti giuridici esistenti mantenuti,
revisioni 26/09 → disclosure A141 pubblicata 06/10 → candidata 15/10 distinte.
Indice con quattro percorsi e matrice locale/remoto/scelta/durata/revoca.
Rete tecnica separata da contributi, Stable legacy e Canary via MOX distinti.
Nessun consenso, durata o categoria introdotti. **OWNER APPROVAL REQUIRED**.

Disponibilità dati: manifesto pubblico SHA-256
`56b39389e8af106567bcf6d2d0b649732d390c683aa88ad0f49fc17a99dc3fec`,
44 entry: ECL/SOS/TLA/TMT PremierDraft, globale + 10 coppie per set; generato
`2026-10-14T17:46:58.860Z`, date dei dataset mostrate. CC BY 4.0 e attribuzione
17Lands, nessun endorsement. Metriche per carta non esposte = non inventate;
catalogo distinto da statistiche; nessun badge live API FRA da manifesto pubblico.
A5 estensione dipendente da ulteriore fonte autorizzata, nessun nuovo endpoint.

Core: testa corrente Draft/A141 riconciliata senza riscrivere storia/freeze,
STATUS/ARRETRATI A141 e addendum delle note future; registro 28 righe preservato.
Tracker: stato/indice aggiornati e solo commento binding R2 in `src/dati-draft.js`.

## Matrice 12 acceptance News (§6.6)

| # | Input e prova | Risultato candidato |
|---|---|---|
| 1 | A01: 27 reali; fixture 205 su 4 pagine; ID/tag/date/asset | PASS, 27/27 |
| 2 | A02: Canary sintetica firmata con campo stable; prerelease/draft; branch assente | PASS, nessuna Stable inventata |
| 3 | A03/R03: body vuoto, escape, IT/EN CRLF, target_commitish | PASS, nessun testo/source inventato |
| 4 | A04 + news-build: dettagli/fonti/date UTC, cornice EN | PASS |
| 5 | A05/R02/R04/R05/R07: 403/429/500, rete/JSON/pagina mancante, 304, cache/ritiri | PASS, last-valid preservato |
| 6 | A06: workflow read-only, acquisizione/build senza deploy | PASS, gate separati |
| 7 | A07 + news-build: vecchi ingressi, link/ancore, canonical/hreflang/sitemap | PASS locale |
| 8 | A08 + browser: 56 viewport/pagina, 6 percorsi Tab/Escape/focus | PASS locale; zoom reale 200% CONDITIONAL |
| 9 | A09/R01–R07: Latest, duplicati, tombstone, schema, XSS, token | PASS offline; CI remota da leggere sulla PR |
| 10 | A10/R01: Latest divergente, rollback, fonte non verificabile, richieste successive | PASS, storia distinta e CTA bloccata |
| 11 | A11: body unico IT/EN, provenance/ricevuta e checklist fonti/Privacy | PASS procedura candidata; approvazione titolare CONDITIONAL |
| 12 | A12: nessuna automazione deploy/polling o ampliamento permessi | PASS, Pages richiede mandato separato |

## Matrice pagine IT/EN e prove browser

| Percorso | IT | EN | Verifica |
|---|---|---|---|
| Home / cronologia / dettaglio | PASS | PASS | viewport 375/390/768/1440 |
| Indice Guide / dati Draft / mazzo finale | PASS | PASS | viewport 375/390/768/1440 |
| Privacy / Cosa invia | PASS candidata | PASS candidata | viewport 375/390/768/1440 |
| Tutti gli 8 capitoli e 27 dettagli | PASS | PASS | link/ancore/H1/SEO statici |
| Menu, Supporto, Account e Download | PASS ingressi | PASS ingressi | 6 percorsi tastiera, route conservate; nessun login/invio |

56/56 combinazioni senza overflow, un H1. Scroll/client mobili 360/360 a 375,
375/375 a 390; tablet generalmente 753/753 a 768; desktop 1425/1425 o
1440/1440 secondo scrollbar. Tab → Home, Escape chiude e riporta focus al
toggle, aria-current Guide presente su pagina annidata. Focus visibile osservato.
Zoom 200% tentato con shortcut del browser: dimensioni/DPR invariati, quindi
**non attestato**, resta prova manuale; nessuna certificazione WCAG/CWV.

## Code-review e stato delle prove

Applicata la procedura locale `/code-review` con revisori Codex sulle tre aree
News/fonti, UI/build/download e copy/test/canonici, adattata all’ambiente senza
modelli Claude. Rilievi trovati e corretti: cache dopo rollback; tombstone
ricomparsa solo prerelease; delimitatori CRLF; confronto completo/biunivoco
cache; validazione fonte prima di rename; test vincolati al bootstrap; riuso
messaggi download. Regressioni R01–R07. La review locale non sostituisce il
gate indipendente in nuova chat richiesto dopo questa consegna.

Prove finora: suite canonica 615/615 prima del delta review; News 24/24 dopo
regressioni. Build di produzione offline e controllo link/SEO passati; prove
finali su HEAD di consegna e SHA/push/PR registrati nell’appendice di chiusura.
Il primo tentativo nel sandbox falliva sul test loopback preesistente: esecuzione
fuori sandbox 615/615. Nessun Worker cambiato per mascherare un errore di ambiente.

Nessuna dipendenza aggiunta e lockfile invariato. Installazione isolata con
`npm ci --ignore-scripts` del lock esistente: npm segnala 4 vulnerabilità high
nelle dipendenze dev preesistenti; aggiornamento fuori scope, nessun audit fix.
Il renderer nuovo non dipende da quei pacchetti. Nessun costo cloud nuovo;
traffico misurato refresh = 3 GET GitHub + 3 fonti pubbliche per giro; costo
monetario effettivo e minuti Actions n.d. Non dichiarata gratuità complessiva.

## Checkpoint unico proprietario e residui

1. Approvare copy Privacy IT/EN, matrice/rete/fonti e data effettiva al futuro
   gate di pubblicazione. Backup/log provider e cancellazione reale non provati:
   il titolare conferma i dati, nessuna durata inventata o compliance certificata.
2. Menu candidato scelto e provato; eventuale preferenza editoriale resta
   reversibile. Traduzioni storiche non necessarie al candidato: originali IT
   identificati; un lotto di traduzione richiede approvazione separata.
3. Refresh manuale riproducibile + workflow di sola verifica è la politica
   consegnata. Non assunti permessi per creare PR automaticamente, niente PAT.
4. Review indipendente nuova chat prima di merge. Preview remota, merge e
   produzione non autorizzati; preview remota solo se e quando il proprietario
   la richiederà. Zoom reale 200% da collaudare manualmente.
5. A5 API live completa dipendente da fonte autorizzata. G-ADV-01 metodo
   avanzato, G-ADV-02 screenshot/replay e G-ADV-03 troubleshooting autonomo
   registrati nel coverage core, senza pagine vuote. Macro B–F non svolte.

**MERGE=NO · PAGES DEPLOY=NO · WORKER/RELEASE=NO.**

## ROOT HYGIENE CHECK

PASS sul delta, con limiti preesistenti: nessun file loose o cartella nuova
nella root parent; due worktree valide sotto `worktrees/`, senza mosse manuali.
Evidenze/script sotto `Non pubblicare/`; output `.dist` e node_modules ignorati.
Nessun raw Arena, credenziale, codice tester o materiale privato in Git.
Primari preservati. L’eccezione core detached preesistente in Temp e le altre
worktree non sono state riordinate o inventariate integralmente: non si dichiara
conforme l’intero patrimonio precedente. `.claude`/`.wrangler` preesistenti
lasciate intatte. Nessun pruning autorizzato; worktree candidate mantenute per
review delle PR e prove locali, poi proponibili al cleanup con mandato separato.

## Riferimenti

- [Audit originale immutabile](https://github.com/Dennis96/moxtracker/blob/9e76015cbe9f88b24da9dc3eb88544912a8add91/passaggi/sito/audit/AUDIT-DRAFT-OMEN-VS-MOX-PRIVACY-DOCS-NEWS-2026-10-14.md).
- [Procedura News e gate](../NEWS-SNAPSHOT-E-GATE.md).
- [Registro unico A–F candidato core](https://github.com/Dennis96/mox-core/blob/claude/mox-canonics-audit-draft-omen-2026-10-14/passaggi/coordinamento/REGISTRO-COPERTURA-MOX-AUDIT-DRAFT-OMEN-2026-10-14.md).
