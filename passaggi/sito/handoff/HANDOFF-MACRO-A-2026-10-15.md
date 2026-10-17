# Macro A — News, Guide, Privacy e canonici

Aggiornamento del 16/10/2026. Candidata di sviluppo, non pubblicata.
La scelta esplicita dell’utente prevale sul mandato e sulle soluzioni intermedie:
home identica salvo numero di versione; nessuna Canary nel sito pubblico;
News con scheda aperta dell’ultima versione e precedenti compatte; Guide
separate con tre schede, approvate in chat, e Draft concentrata sul prodotto.
La revisione indipendente in nuova chat e l’approvazione Privacy restano pendenti.

## Basi, sorgenti e Git

| Repository | Base origin/main riconfermata il 16/10 | Branch / PR draft |
|---|---|---|
| tracker | a08ee510152044b544ecdec014dd0876fd3920b0 | claude/mox-site-news-guides-privacy-2026-10-14 · [#42](https://github.com/Dennis96/moxtracker/pull/42) |
| core | 67c683e36e5ee82beeb85e21effc6677991028c2 | claude/mox-canonics-audit-draft-omen-2026-10-14 · [#41](https://github.com/Dennis96/mox-core/pull/41) |
| meta | 7057c8d418e331e19f45fc6b1711ee9aaf934e28, verificato il 15/10 | generated-only, nessuna modifica |

Codice tracker finale: **634445dc8da9739eb9e8a28e75dac6c858cd5f42**.
Guide/Draft finali: 632fb3c6fdf0028ec4d4f0d3ea34dc551a244d6e;
il commit seguente aggiorna soltanto la data della Privacy candidata IT/EN e la prova.
Chiusura documentale core, incluso addendum del 17/10: **f248af90ecdaa06c41e014a30e74b90f4fa8fb3a**. Lo SHA della presente chiusura
tracker è fornito nel permalink finale e nella PR, evitando autoriferimenti.

Letti gli ingressi canonici dei due repository e la policy workspace.
Audit originale letto integralmente, incluso §13, da
[9e76015cbe9f88b24da9dc3eb88544912a8add91](https://github.com/Dennis96/moxtracker/blob/9e76015cbe9f88b24da9dc3eb88544912a8add91/passaggi/sito/audit/AUDIT-DRAFT-OMEN-VS-MOX-PRIVACY-DOCS-NEWS-2026-10-14.md).
Nessuna nuova esplorazione del repository concorrente. Per lo stile News del
16/10 è stata osservata la [pagina indicata dall’utente](https://www.draftomen.com/news/).
Testi e CSS MOX originali, nessun asset o testo delle sue release copiato.

## Risultato consegnato

Home: testi, immagini e due CTA conservati rispetto alla base. Unica aggiunta
nel hero: MOX 2.11.8 nella fineprint. Menu unico con Home, Meta, Draft, Guide,
Aggiornamenti, Il mio MOX, Supporto e lingua; Scarica separato.

News: cronologia a schede con ultima versione aperta. Dettagli statici IT/EN,
fonte originale, data UTC e metadati richiudibili. Markdown sicuro, incluse le
enfasi; HTML/immagini raw inerti. Titolo e commit non duplicati nel testo:
restano intestazione e dettagli fonte. Nessuna riscrittura delle GitHub Releases.

Acquisizione Node senza nuove dipendenze: pagine fino a una pagina vuota,
Latest indipendente, ID/tag/versione/date/asset/digest validati, ETag/304
integri, ritiri confermati per ID, retry limitati e scrittura atomica last-valid.
Il corpus completo interno resta distinto dal corpus pubblico ammesso:
legacy verificate, ricevute Stable o versione attestata dal manifesto firmato.
Una pubblicazione non attestata resta interna anche se non contiene la parola
Canary. Body pubblici riservati ai tester bloccano la generazione; controllo
globale sul bundle per impedire menzioni in testi, titoli o metadati.

Snapshot: 27 pubblicazioni, zero tombstone, acquisizione 15/10 alle
19:03:04.940Z. Distribuzione verificata alle 19:03:05.918Z: Stable 2.11.8;
verifica interna separata dell’altro canale. Il campo interno del manifesto
non è usato per dedurre una promozione. 2.9.12: assenza note esplicita;
2.9.28: escape letterali preservati. Originali IT identificati in cornice EN,
senza traduzioni storiche inventate. Snapshot vecchi schema 1 ancora leggibili.

Download: ogni nuovo click verifica Latest e Stable con cache:no-store;
condivide soltanto le richieste in corso. Divergenza, rollback o fonte non
verificabile bloccano lo ZIP con messaggio riusato. La cronologia non fa fetch
GitHub per ogni lettore. Nessun manifesto o endpoint remoto cambiato.

Guide: una pagina per lingua, tre schede **Inizia con MOX**, **Usa il Draft**,
**Dati e privacy**, otto risposte espandibili. Installazione estesa resta in
Download. Draft conserva schermate e due spiegazioni brevi, poi rimanda al
percorso pertinente. Nessun indice puntato o otto pagine duplicate.
Score 0–110 distinto da WR, GIH/GP ricentrato/ATA/prior/campioni/Wilson,
ibridi/segnali, coppie e limiti del simulatore dichiarati. Nessun ML attivo,
superiorità scientifica o correzione S5 anticipata. Metadati editoriali fissi:
MOX 2.11.8, contenuti verificati il 15/10; il refresh fonti non li aggiorna da sé.

Privacy/Cosa invia: matrice dei flussi e richieste tecniche separate dai
contributi, fonti dipendenti dalla versione senza esporre il percorso tester.
Revisione precedente 26/09, disclosure A141 pubblicata 06/10, candidata
aggiornata 16/10. Nessun consenso/durata/categoria aggiunti.
**OWNER APPROVAL REQUIRED** su copy e data finale prima della pubblicazione.

Dati pubblici: manifesto SHA-256
56b39389e8af106567bcf6d2d0b649732d390c683aa88ad0f49fc17a99dc3fec;
44 entry ECL/SOS/TLA/TMT PremierDraft, globale + 10 coppie per set, generato
14/10 alle 17:46:58.860Z. Date sorgente e CC BY 4.0 dichiarate; nessun
endorsement 17Lands. Catalogo ≠ disponibilità statistica. Nessuna copertura API
o metrica per carta inventata. A5 live completa dipende da fonte autorizzata.

Core: testa corrente Draft/A141 e STATUS/ARRETRATI riconciliati, addendum
editoriale della procedura release e registro unico di 28 righe. Storia,
ranking e contratti congelati conservati. Worker: solo un commento binding.

## Matrice dei 12 acceptance News (§6.6)

| # | Prova | Esito candidato |
|---|---|---|
| 1 | A01: corpus 27, fixture 205 su quattro pagine, tag/date/asset | PASS |
| 2 | A02/R06: canale sintetico con campo stable, prerelease/draft, ricevuta; 27 legacy + 1 non attestata | PASS, tester e non attestate esclusi dal pubblico |
| 3 | A03/R03: vuoto, escape, IT/EN CRLF e source commit | PASS, originali e hash preservati |
| 4 | A04/build: dettagli, fonti, UTC, cornice EN | PASS |
| 5 | A05/R02/R04/R05/R07: 403/429/500, rete/JSON/pagine, 304/cache/ritiri | PASS, last-valid preservato |
| 6 | A06: workflow read-only e build offline senza deploy | PASS |
| 7 | A07/build: vecchi ingressi News, link/ancore, canonical/hreflang/sitemap | PASS locale |
| 8 | A08/browser: menu/home, 56 viewport/pagina e sei percorsi tastiera | PASS locale; zoom reale 200% CONDITIONAL |
| 9 | A09/R01–R08: duplicati, tombstone, schema, XSS, credenziali e contenuti tester | PASS offline; CI finale da leggere nella PR |
| 10 | A10/R01: Latest divergente, rollback, fonti non verificabili e click successivi | PASS, CTA bloccata e storia conservata |
| 11 | A11: body IT/EN, ricevuta e checklist fonti/Privacy | PASS procedura; approvazione titolare CONDITIONAL |
| 12 | A12: nessun deploy/polling o ampliamento permessi | PASS, gate Pages separato |

## Prove e review

Suite canonica: **626 PASS, 0 FAIL, 0 skip**, incluse **28 prove News**.
Build production: **5 PASS + 1 skip** riservato alla preview.
Preview locale simulata: **6/6 PASS**, inclusi HTML/header/robots noindex.
Build finali: production **04f41dad9acb21f7**, preview **d5e79d2837642fe2**,
147 file e 77 HTML. Determinismo verificato dalla suite, intero grafo statico
versionato. CI GitHub success precedente ff129; CI del nuovo push nella PR.
I commit documentali cambiano commit_git nel manifest, non gli hash degli asset.

Browser locale: Home, News, dettaglio, Draft, Guide, Privacy e Cosa invia in
IT/EN × 375/390/768/1440 = **56/56**, un H1, nessun overflow esterno o testo
tester. Menu: sei percorsi IT/EN a 375/390/768, Tab porta a Home, Escape
chiude e ripristina focus. Otto risposte aperte da tastiera a 375 in entrambe
le lingue, senza overflow. Zoom reale 200% non attestato; niente claim WCAG/CWV.
Nessun login, ticket, invio, cancellazione o field test client eseguito.

Procedura locale /code-review applicata con revisori Codex News, UI/build e
copy/prove. Corretti R01–R08 e nel delta del 16/10: filtro corpus pubblico,
compatibilità snapshot, fingerprint dei contenuti generati, metadati editoriali
fissi e attese dei test variabili. Ultima review del delta Guide: PASS senza
rilievi. Non sostituisce la review indipendente in nuova chat.

Nessuna nuova dipendenza; lockfile invariato. Le quattro vulnerabilità high
dev segnalate da npm sul lock esistente restano fuori scope, nessun audit fix.
Costi/minuti effettivi Actions n.d.; nessun nuovo servizio o piano introdotto.

## Checkpoint unico e residui

1. Titolare: approvazione Privacy IT/EN e data effettiva. Log/backup provider e
   cancellazione reale non verificati; nessuna durata o conformità inventata.
2. Review indipendente in nuova chat prima di merge. Nessun merge/deploy o
   pubblicazione autorizzati; il candidato resta nelle PR draft.
3. Zoom reale 200% da collaudare; test su telefono reale e campo client distinti.
4. A5 API live completa dipendente da metadati autorizzati; G-ADV-01 metodo
   avanzato, G-ADV-02 catture/replay e G-ADV-03 troubleshooting avanzato
   registrati nel coverage core. Macro B–F non svolte.

## Proposta futura — immagini nelle Guide, 17/10/2026

L’utente ha rinviato a un lavoro successivo l’aggiunta di immagini e ha chiesto
di conservarne la proposta per il coordinatore, nel backlog G-ADV-02:

- **Inizia con MOX:** schermata di Arena che mostra dove attivare Detailed Logs.
- **Usa il Draft:** una busta con piccoli richiami a punteggio, percentuale e fonte dei dati.
- **Dati e privacy:** pannello delle condivisioni, con le scelte separate visibili.

Inserimento previsto dentro le risposte espandibili, con didascalie brevi e
leggibili anche su telefono; le tre schede iniziali restano pulite. Usare
schermate reali della versione pubblica allora corrente, con eventuali dati
personali oscurati. Selezione/cattura, sanitizzazione e verifica sono attività
del prossimo lavoro: **nessuna immagine acquisita o inserita in questa consegna**.

Questo addendum modifica soltanto i documenti. Codice, asset, prove già riportate
e gate della candidata restano quelli della consegna precedente; G-ADV-02 non
è chiuso e non viene autorizzata alcuna pubblicazione.

## ROOT HYGIENE CHECK

PASS sul delta: nessuna nuova voce parent o file loose; due worktree proprie
sotto worktrees, mantenute per PR aperte e anteprima locale. Nessun primario
modificato, spostamento manuale o pruning. Script/log/evidenze sotto
Non pubblicare; .dist e node_modules ignorati. Nessun raw Arena o segreto in Git.
Le altre worktree, l’eccezione Temp e .claude/.wrangler preesistenti non sono
state riordinate: non si dichiara conforme l’intero patrimonio precedente.

[Registro unico core](https://github.com/Dennis96/mox-core/blob/f248af90ecdaa06c41e014a30e74b90f4fa8fb3a/passaggi/coordinamento/REGISTRO-COPERTURA-MOX-AUDIT-DRAFT-OMEN-2026-10-14.md) ·
[Procedura News](../NEWS-SNAPSHOT-E-GATE.md).
**MERGE=NO · PAGES/WORKER DEPLOY=NO · GITHUB RELEASE=NO.**

## File del diff consegnato

Tracker: 41 file.

~~~text
.github/workflows/news-verifica.yml
STATO-CORRENTE-SITO.md
config/news-fonti.json
config/news-releases.json
config/news-stable-receipts.json
config/news-update-public-key.json
passaggi/INDICE.md
passaggi/sito/NEWS-SNAPSHOT-E-GATE.md
passaggi/sito/handoff/HANDOFF-MACRO-A-2026-10-15.md
prove/build-sito.test.js
prove/draft-frontend.test.js
prove/frontend-privacy.test.js
prove/news-build.check.mjs
prove/news.test.js
prove/prelancio-sito.test.js
prove/redesign-sito.test.js
sito/account.html
sito/admin.html
sito/archetipo.html
sito/cosa-invia-mox.html
sito/css/redesign.css
sito/download.html
sito/draft.html
sito/i18n/en.json
sito/index.html
sito/js/download.js
sito/js/language-link.js
sito/js/release-note.js
sito/js/site-shell.js
sito/js/translate.js
sito/meta.html
sito/note-versione.html
sito/privacy.html
sito/supporto.html
src/dati-draft.js
strumenti/build_sito.mjs
strumenti/news/aggiorna.mjs
strumenti/news/fonti.mjs
strumenti/news/guide.mjs
strumenti/news/modello.mjs
strumenti/news/pagine.mjs
~~~

Core: sei Markdown; nessun client o contratto congelato modificato.
