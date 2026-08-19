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
      all() {
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

  return {
    prepare: (sql) => comando(sql, []),
    async batch(comandi) {
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
    conta(tabella) {
      return Number(sqlite.prepare(`SELECT COUNT(*) AS n FROM ${tabella}`).get().n);
    },
    tutte(sql) {
      return sqlite.prepare(sql).all();
    },
  };
}
