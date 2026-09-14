import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

// Un D1 finto su SQLite vero. `batch()` e' una transazione con rollback
// dell'intera sequenza, come documentato per D1; le chiavi esterne sono
// attive come su D1.
//
// Per le prove Research porta tre cose in piu', tutte spente di partenza:
// - `registro`: letture e statement davvero consegnati al binding, per
//   confrontarli con il piano e con il ledger;
// - `guasti`: un guasto allo statement k del prossimo batch (rollback), o
//   dopo il commit (l'esito che il Worker non conosce);
// - `primaDelBatch`: una funzione chiamata una volta prima del prossimo
//   batch, per forzare un interlacciamento fra due richieste.
export function creaFintoD1(percorsoSchema, { file = ":memory:" } = {}) {
  const sqlite = new DatabaseSync(file);
  sqlite.exec("PRAGMA foreign_keys = ON");
  sqlite.exec(readFileSync(percorsoSchema, "utf8"));
  const registro = { letture: 0, batch: [], statement: 0 };

  function comando(sql, argomenti) {
    return {
      sql,
      argomenti,
      bind: (...altri) => comando(sql, altri),
      first() {
        registro.letture += 1;
        const statement = sqlite.prepare(sql);
        return statement.get(...argomenti) ?? null;
      },
      all() {
        registro.letture += 1;
        const statement = sqlite.prepare(sql);
        return { results: statement.all(...argomenti) };
      },
      esegui() {
        const statement = sqlite.prepare(sql);
        const esito = statement.run(...argomenti);
        return { meta: { changes: Number(esito.changes) } };
      },
    };
  }

  const db = {
    registro,
    // `saltaBatch`: quanti batch lasciar passare prima di quello che si guasta.
    guasti: { statement: null, saltaBatch: 0, dopoCommit: false },
    primaDelBatch: null,
    prepare: (sql) => comando(sql, []),
    async batch(comandi) {
      if (db.primaDelBatch) {
        const prima = db.primaDelBatch;
        db.primaDelBatch = null;
        await prima(comandi);
      }
      registro.batch.push(comandi.length);
      registro.statement += comandi.length;
      let guastoAl = null;
      if (db.guasti.statement !== null) {
        if (db.guasti.saltaBatch > 0) {
          db.guasti.saltaBatch -= 1;
        } else {
          guastoAl = db.guasti.statement;
          db.guasti.statement = null;
        }
      }
      sqlite.exec("BEGIN");
      try {
        const esiti = comandi.map((c, i) => {
          // D1 riporta gli errori di statement con questo prefisso, dopo il
          // rollback: il Worker sa che la transazione non e' passata.
          if (guastoAl === i) throw new Error(`D1_ERROR: guasto simulato allo statement ${i}`);
          return c.esegui();
        });
        sqlite.exec("COMMIT");
        if (db.guasti.dopoCommit) {
          db.guasti.dopoCommit = false;
          throw new Error("rete caduta dopo il commit");
        }
        return esiti;
      } catch (guasto) {
        if (sqlite.isTransaction) sqlite.exec("ROLLBACK");
        throw guasto;
      }
    },
    conta(tabella) {
      return Number(sqlite.prepare(`SELECT COUNT(*) AS n FROM ${tabella}`).get().n);
    },
    tutte(sql, ...argomenti) {
      return sqlite.prepare(sql).all(...argomenti);
    },
    chiudi() {
      sqlite.close();
    },
  };
  return db;
}
