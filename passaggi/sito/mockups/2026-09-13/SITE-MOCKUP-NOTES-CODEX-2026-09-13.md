# MOX Site Mockup — note di design

## Direzione

La proposta mantiene il linguaggio esistente: dark mode, viola MOX, superfici dense, tipografia ad alto contrasto e mascotte usata come elemento di marca. Il cambiamento è nella gerarchia: il software, le decisioni e i dati diventano il soggetto principale; gli elementi decorativi restano secondari.

Il prototipo è statico, offline e utilizza esclusivamente dati sintetici. Non importa o chiama API, non modifica le pagine sotto `sito/` e non rappresenta logica di prodotto già realizzata.

## Home: confronto hero

- **A — consigliata:** una finestra MOX ampia è il focus immediato. I dati di sessione e del mazzo sono elementi satelliti. È la soluzione più chiara per presentare MOX prima come software.
- **B:** un insieme coordinato di dashboard, Draft, Meta e deck builder racconta l'ampiezza della suite. È più editoriale e utile come alternativa da valutare, ma riduce la forza del singolo messaggio iniziale.

La parte sottostante introduce quattro momenti d'uso, il web come estensione del client e due blocchi roadmap. “In sviluppo” e “Pianificato” sono separati, senza date e senza CTA che sembrino funzionalità disponibili.

## Cosa viene conservato e raffinato

- **Meta:** filtri, elenco archetipi, soglie e dettaglio deck continuano a essere centrali. Il mockup migliora la scansione con una lista a sinistra e il dettaglio aperto a destra.
- **Draft:** l'attuale trasparenza del metodo viene mantenuta ma spostata dopo assistenza alla scelta, direzione del pool, deck building e dati web.
- **Account:** KPI, cronologia, mazzi, partite, Draft e impostazioni restano tutti presenti, ma sono divisi in tab interne anziché accumulati verticalmente.
- **Supporto:** il ticket rimane disponibile, preceduto da percorsi rapidi per installazione, problemi, dati/account e FAQ.

## Parti future / placeholder

Il pannello **“Collection & wildcard”** della pagina Meta è contrassegnato in modo permanente `FEATURE FUTURA — MOCKUP` e `Accesso simulato`. I badge di craft e le wildcard sono dati fittizi: non esiste sincronizzazione della collezione, valutazione di craftability o autenticazione nel prototipo.

Le voci MOX Research, aggiornamento Draft, interfaccia Tauri, collection/wildcard gap, “Posso costruirlo?” e condivisione mazzi sono roadmap visive: non sono vendute come prodotto disponibile.

## Artefatti

- `mockup.html?view=home-a` — Home, hero A
- `mockup.html?view=home-b` — Home, hero B
- `mockup.html?view=home-sections` — sezioni Home
- `mockup.html?view=meta` — Meta espanso + futuro collection-aware
- `mockup.html?view=draft` — Draft utility-first
- `mockup.html?view=account` — Account con tab
- `mockup.html?view=support` — Supporto

Gli export PNG corrispondono alle stesse viste a 1440 px di larghezza.
