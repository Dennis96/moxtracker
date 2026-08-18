# moxtracker — il server delle partite di Mox

Riceve le partite che [Mox](https://github.com/Dennis96) registra da MTG Arena
e le conserva, per costruirci sopra le statistiche del meta: quanto vince ogni
archetipo, in che fascia di rank, e chi batte chi.

Gira su Cloudflare Workers con un database D1 accanto. Il sito che mostrerà i
numeri è il lavoro successivo; qui c'è la parte che riceve.

**È in linea dal 18/08/2026**, per ora all'indirizzo provvisorio
`https://moxtracker.scdennis96.workers.dev` — `/salute` dice se è vivo. Quello
definitivo sarà `moxtracker.app`: l'indirizzo va deciso **prima** che Mox
cominci a spedire, perché finisce dentro il programma e resta nelle copie già
distribuite.

## Quello che non fa, per scelta

- **Non tiene nomi.** Né di chi manda né dell'avversario. La partita è
  identificata da un'impronta calcolata sul computer di chi gioca.
- **Non tiene indirizzi IP e non mette cookie.**
- **Non riceve la mano né la libreria dell'avversario**, solo le carte che il
  log di Arena ha già rivelato durante la partita — e se un client provasse a
  mandarle, il server rifiuta il pacchetto invece di conservarle.
- **Non riceve il nome che dai al mazzo in Arena**: è testo libero e può
  contenere qualsiasi cosa. Arrivano le carte, che dicono molto di più.
- **Non deduce niente al posto di chi manda.** Gli archetipi si calcolano qui,
  dalle carte, così quando il catalogo migliora si rifanno anche sulle partite
  vecchie.

Chi manda è un numero generato a caso da Mox al primo avvio e conservato sul
computer di chi gioca: serve a mettere un tetto a quante partite si possono
spedire in un giorno, e a ritrovare le proprie partite se un domani ci si
registra sul sito. Si può cancellare in qualsiasi momento.

## Com'è fatto

| File | Cosa contiene |
|---|---|
| `src/controlli.js` | che cosa si accetta e cosa si rifiuta, e perché |
| `src/index.js` | il Worker: `/salute` e `POST /partite` |
| `schema.sql` | le tabelle: `partite`, `carte_mazzo`, `carte_avversario` |
| `prove/` | le prove dei controlli, senza rete e senza database |

Ogni partita entra **una volta sola**: la chiave è l'identificativo del match,
e un pacchetto che arriva due volte non conta due volte. Il pacchetto originale
si conserva intero accanto alle colonne, così i conti si possono rifare domani
con regole migliori invece di restare quelli di oggi.

## Provarlo sul proprio computer

Serve [Node.js](https://nodejs.org) (versione LTS).

```
npm install
npm run prove              # i controlli: nessuna rete, mezzo secondo
npm run database-locale    # crea le tabelle in un SQLite locale
npm run locale             # avvia il server su http://localhost:8787
```

Con il server acceso:

```
curl http://localhost:8787/salute
curl -X POST http://localhost:8787/partite -H "content-type: application/json" -d @prove/partita-esempio.json
```

## Metterlo online

Serve un account Cloudflare (gratuito).

**Il modo facile, su Windows:** doppio clic su **`COLLEGA-CLOUDFLARE.bat`**.
Fa i due comandi qui sotto uno dopo l'altro, spiegando cosa sta succedendo, e
lascia il risultato in `id-database.txt`.

**A mano**, se preferisci il terminale:

```
npx wrangler login                 # apre il browser e chiede di autorizzare
npx wrangler d1 create moxtracker  # stampa l'id del database
```

L'id va incollato in `wrangler.toml`, alla voce `database_id`. Poi:

```
npm run database-vero              # crea le tabelle sul database vero
npm run pubblica
```

## Licenza

Da decidere prima di accettare contributi.
