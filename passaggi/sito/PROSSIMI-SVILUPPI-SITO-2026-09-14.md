# Prossimi sviluppi del sito — frontend e backend

Aggiornato il 14 settembre 2026. Questo documento raccoglie gli interventi
emersi durante il collaudo locale del branch
`codex/site-preview-fixes-2026-09-14` che non possono essere completati
correttamente con il solo frontend attuale.

Non è un'autorizzazione a modificare Worker, API, database, schema o
migrazioni e non autorizza merge o deploy. Ogni intervento backend richiede un
mandato separato e deve conservare le soglie di pubblicazione e privacy già
attive.

## Già risolto nel frontend del branch

- Le varianti degli archetipi riconosciuti e le liste Brew usano lo stesso
  pannello espandibile, con decklist, copia per Arena e profilo. I vecchi URL
  con `?variante=` restano validi e aprono il pannello corrispondente.
- Il profilo chiarisce che l'identità di colore non rappresenta costi o fonti
  di mana.
- Il grafico rank dell'Account espone i valori anche con hover e tastiera.
- Un mazzo senza nome usa un'etichetta leggibile e non mostra l'impronta.
- Supporto contiene le nuove FAQ.
- Il Meta dichiara che il filtro matchup per singolo mazzo non è disponibile.

Questi punti non fanno parte del backlog, salvo le dipendenze API indicate
sotto.

## Prossimi sviluppi backend/API

### B1 — Raggruppare i Brew simili in varianti

**Implementato il 15/09/2026 sul branch `claude/s1-brew-backend-2026-09-15`,
non fuso e non deployato**: vedi il
[contratto B1](S1-BREW-CONTRATTO-B1-2026-09-15.md). Le famiglie di Brew con lo
stesso nucleo restano al refresh del catalogo, per decisione dell'utente.

Oggi ogni impronta esatta viene esposta come un Brew distinto. Nel campione
pubblico del collaudo, Brew #2 e Brew #3 hanno 34 partite ciascuno, condividono
56 copie su 60 e differiscono per quattro sostituzioni, ma risultano due liste
principali separate.

Il backend dovrà:

- applicare un clustering conservativo alle liste non classificate, senza
  confondere mazzi diversi che condividono terre o carte generiche;
- assegnare un identificativo pubblico stabile al gruppo Brew;
- restituire le impronte ammesse come varianti interne del gruppo;
- calcolare partite e statistiche senza doppi conteggi;
- applicare le soglie privacy sia al gruppo sia alle singole varianti, senza
  rendere ricavabili per sottrazione i record delle liste sotto soglia.

Il criterio di somiglianza, la gestione della distanza transitiva e la
stabilità del gruppo nel tempo devono essere coperti da test prima di esporre
il nuovo contratto API.

### B2 — Nomi reali dei mazzi nello storico Account

Il fallback frontend evita di mostrare un hash, ma non può ricostruire un nome
mai ricevuto. L'API Account dovrà collegare in modo affidabile partite e
versioni sincronizzate del mazzo e restituire il nome Arena quando disponibile.
Il nome deve restare privato e non deve entrare nel Meta pubblico.

### B3 — Duplicati Draft

Il frontend non dispone di identificatori o prove sufficienti per stabilire
se due Draft apparentemente uguali siano duplicati. La deduplicazione o la
marcatura deve avvenire sul backend usando identificatori affidabili. Non
dedurre l'uguaglianza soltanto da data, set, formato o vicinanza temporale.

### B4 — Matchup per singolo mazzo dell'utente

L'API attuale non espone la dimensione necessaria per filtrare i matchup in
base a uno specifico mazzo dell'Account. Servono aggregati autorizzati e un
contratto API che mantenga separate le informazioni private dell'utente dal
Meta pubblico e rispetti le soglie previste per ogni coppia.

### B5 — Statistiche avanzate per singola variante

Una futura vista dedicata alla variante ha senso soltanto quando l'API espone
dati reali specifici per quella variante: distribuzione per rank, gioco e
risposta, matchup e andamento temporale. Non usare statistiche globali
dell'archetipo come sostituto.

## Prossimi sviluppi frontend

### F1 — Presentazione dei gruppi Brew

Dopo B1, il Meta dovrà mostrare un solo gruppo per Brew simili e, al suo
interno, le varianti pubblicabili. Il dettaglio dovrà usare l'identificativo
stabile del gruppo, preservare per quanto possibile i vecchi collegamenti per
impronta e mantenere indistinguibili le varianti sotto soglia.

### F2 — Account e Draft dopo i nuovi contratti

Dopo B2 e B3, aggiornare le viste Account per mostrare il nome restituito
dall'API e l'eventuale stato di duplicato del Draft. In assenza dei nuovi
campi, conservare gli attuali fallback senza deduzioni locali.

### F3 — Filtro matchup per mazzo

Dopo B4, aggiungere nell'Account la scelta del mazzo e gli stati vuoto,
sotto-soglia ed errore. Il controllo non deve comparire nel Meta pubblico come
se fosse già disponibile.

### F4 — Eventuale vista dedicata alla variante

Dopo B5, valutare nuovamente una pagina focus. Finché esistono soltanto
riepilogo e decklist, mantenere l'accordion inline introdotto nel branch:
evita una navigazione aggiuntiva che non offre informazioni ulteriori.

## Ordine consigliato

1. Definire e testare B1, inclusi privacy e stabilità degli identificativi.
2. Implementare F1 sul nuovo contratto Brew.
3. Affrontare separatamente B2/F2 e B3/F2.
4. Progettare B4 e B5 prima delle rispettive interfacce F3 e F4.

Roadmap collegata per l'aggiornamento del catalogo:
[META-CATALOG-REFRESH-ROADMAP-2026-09-13.md](META-CATALOG-REFRESH-ROADMAP-2026-09-13.md).
