// Un D1 finto costruito su un database SQLite vero.
//
// Serve a provare il Worker per intero - controlli, SQL, risposte - senza
// accendere Cloudflare e senza rete. Non e' un simulatore: lo schema e le
// query girano davvero, su `node:sqlite` che Node porta con se'. Un finto che
// si limitasse a dire di si' proverebbe soltanto che il codice non esplode.
//
// Copre la parte di API D1 che il Worker usa: `prepare().bind()`, `first()` e
// `batch()`. Se un giorno il Worker ne usasse di piu', va aggiunta qui, e la
// prova fallira' finche' non lo si fa - che e' il modo giusto di accorgersene.

import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

export function creaFintoD1(percorsoSchema) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(percorsoSchema, "utf8"));

  function comando(sql, argomenti) {
    return {
      sql,
      argomenti,
      bind: (...altri) => comando(sql, altri),
      first() {
        const statement = sqlite.prepare(sql);
        return statement.get(...argomenti) ?? null;
      },
      esegui() {
        const statement = sqlite.prepare(sql);
        const esito = statement.run(...argomenti);
        return { meta: { changes: Number(esito.changes) } };
      },
    };
  }

  return {
    prepare: (sql) => comando(sql, []),
    async batch(comandi) {
      // D1 esegue il gruppo come un blocco: qui lo si imita con una
      // transazione, cosi' un errore a meta' non lascia mezze partite.
      sqlite.exec("BEGIN");
      try {
        const esiti = comandi.map((c) => c.esegui());
        sqlite.exec("COMMIT");
        return esiti;
      } catch (guasto) {
        sqlite.exec("ROLLBACK");
        throw guasto;
      }
    },
    // Solo per le prove: guardare dentro senza passare dal Worker.
    conta(tabella) {
      return Number(sqlite.prepare(`SELECT COUNT(*) AS n FROM ${tabella}`).get().n);
    },
    tutte(sql) {
      return sqlite.prepare(sql).all();
    },
  };
}
