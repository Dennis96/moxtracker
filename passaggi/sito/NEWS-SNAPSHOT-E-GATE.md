# News: sorgente, snapshot e gate editoriale

GitHub Release pubblicata è la fonte editoriale; `config/news-releases.json` è
una derivazione last-valid. La build non usa rete. Le 27 pubblicazioni iniziali
sono legacy verificate, senza ricevute inventate. Release nuove senza ricevuta
restano nel corpus interno con promozione non verificata. Il renderer pubblico
ammette soltanto legacy verificate, ricevute Stable o la versione corrente
attestata dal manifesto Stable firmato. La sola pubblicazione non è sufficiente.

## Preparazione riproducibile

Su branch proprio, con checkout pulita: `node strumenti/news/aggiorna.mjs` e
`node strumenti/news/fonti.mjs`; poi `npm run prove` e `npm run sito:build`.
Il secondo comando verifica RS256 con la chiave pubblica del client, copiata
da core `67c683e36e5ee82beeb85e21effc6677991028c2`; non è una chiave segreta.
Controllare il diff dei JSON, corpo, numero, date, hash, Latest e ritiri.
L'acquisitore enumera pagine numerate fino a una pagina vuota e conferma ogni
ritiro anche con GET dell'ID (404/410). Fallimenti conservano lo snapshot.
304 richiede cache integra di quella pagina e inventario precedente valido.
Non ripetere `--importa-legacy`: è solo il bootstrap iniziale revisionato.

La CLI non richiede token né un nuovo PAT. Al massimo tre tentativi per GET;
Retry-After/rate reset oltre 60 secondi interrompe il refresh per riprenderlo
dopo la finestra. Le pagine conservano la data dell'ultimo fetch valido.

Il workflow manuale/PR verifica fixture e build con `contents: read`: non
crea PR automaticamente. Nessun polling permanente o trigger Release che
scriva branch. Permessi per PR automatiche non assunti; comando manuale sopra
con diff revisionato è il percorso candidato. GitHub Actions usa runner del
piano esistente: nessun nuovo piano/costo autorizzato, minuti effettivi n.d.

## Un solo body bilingue per le pubblicazioni future

Preparare prima della pubblicazione, con approvazione editoriale:

```text
<!-- mox-user-notes-it:start -->
Note utente italiane approvate
<!-- mox-user-notes-it:end -->
<!-- mox-user-notes-en:start -->
Approved English user notes
<!-- mox-user-notes-en:end -->
mox-core source commit = <FINAL_RELEASE_HEAD completo>
```

La ricevuta candidata in `config/news-stable-receipts.json` dichiara `version`,
`source_commit`, `verified_at` UTC dopo il gate Stable. Non deriva da tag/main
del repo distributivo, numero di versione o campo interno `canale`. La sua
verifica editoriale deve collegare handoff Stable e prova pubblica; il codice
controlla forma e corrispondenza, non sostituisce l'approvazione del referente.
Nessun requisito retroattivo sulle Stable già pubblicate.

Checklist prima di approvare il body: rete/fonti, dati inviati, consensi,
retention, provider, canale, metodo e limiti. Rileggere Guide, Privacy e Cosa
invia MOX quando il comportamento cambia; nessuna Privacy generata dai commit.
Privacy candidata: **OWNER APPROVAL REQUIRED**, inclusa data finale effettiva.

## Gate e limiti

Pubblicazione GitHub, distribuzione Stable e deploy Pages sono distinti.
Se Latest diverge dallo Stable, la storia resta leggibile; il resolver ZIP
blocca il click con avviso. Non modifica release/manifesti e non propone
automaticamente un vecchio ZIP. La cronologia non fa fetch GitHub per lettore;
solo il click download risolve Latest e confronta Stable, con promise condivise.
Il sito pubblico non nomina Canary né distribuisce istruzioni per tester. Un
body utente che la menzioni blocca la generazione per revisione editoriale;
i test della build controllano tutti gli HTML/JS/JSON/CSS per impedirne la
pubblicazione anche in titoli o metadati. Il corpo originale resta nel corpus
interno, senza modifica delle Releases. Titolo duplicato e commit sorgente
vengono collocati rispettivamente nella scheda e nei dettagli fonte.
IT/EN legacy: originale italiano identificato, nessuna traduzione inventata.
2.9.12: assenza esplicita; 2.9.28: escape conservati. Nessuna Release modificata.

Guide: pagina unica IT/EN con tre schede e otto risposte espandibili. Versione
e data editoriale sono esplicite nel modulo dei contenuti: il refresh dei
manifesti non attesta automaticamente i testi per una nuova versione.

Nuova candidata → review indipendente → approvazione testi titolare → gate
separato merge → preview remota approvata e noindex → separata autorizzazione
Pages. Questo task non autorizza nessuno dei passaggi di pubblicazione.
Rollback Pages segue la procedura esistente; nessuna automazione di deploy.

Fonte API consultata: [paginazione GitHub](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api),
[pratiche REST](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api).
