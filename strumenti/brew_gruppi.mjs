// Gruppi Brew (S1) su un database SQLite LOCALE: analisi (dry-run) di
// default, report k=3/4/5, apply idempotente solo con conferma esplicita.
//
// Non chiama Wrangler e non conosce D1 remoto: apre soltanto un file SQLite
// sul disco, per esempio un database temporaneo o la copia locale che Wrangler
// tiene in `.wrangler/state`. In produzione la stessa assegnazione la fa il
// cron con `BREW_GRUPPI = "on"`, e accenderlo e' un mandato separato.
// L'uscita non contiene impronte, carte o identificativi: solo conteggi.

import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

import { SOGLIA_DISTANZA_BREW } from "../src/brew-clustering.js";
import {
  LIMITE_CANDIDATI, applicaPiano, pianificaAssegnazione, tabelleBrewAssenti,
} from "../src/brew-gruppi.js";

export const CONFERMA = "APPLICA-GRUPPI-BREW-LOCALI";
const MIGRAZIONE = "migrazioni/2026-09-15-brew-gruppi.sql";

const USO = `Uso (solo database SQLite locali):
  node strumenti/brew_gruppi.mjs --database=<file.sqlite> --formato=Standard [--limite=${LIMITE_CANDIDATI}]
  node strumenti/brew_gruppi.mjs --database=<file.sqlite> --formato=Standard --report
  node strumenti/brew_gruppi.mjs --database=<file.sqlite> --formato=Standard --apply --conferma=${CONFERMA}

Senza --apply non scrive niente (il file si apre in sola lettura). --report
confronta k=3, 4 e 5; si applica soltanto k=${SOGLIA_DISTANZA_BREW}, la soglia dell'algoritmo.`;

// Lo stesso contratto minimo di D1 che usano src/ e le prove.
function comeD1(sqlite) {
  const comando = (sql, argomenti = []) => ({
    bind: (...altri) => comando(sql, altri),
    first: async () => sqlite.prepare(sql).get(...argomenti) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...argomenti) }),
    esegui: () => ({ meta: { changes: Number(sqlite.prepare(sql).run(...argomenti).changes) } }),
  });
  return {
    prepare: (sql) => comando(sql),
    async batch(comandi) {
      sqlite.exec("BEGIN");
      try {
        const esiti = comandi.map((c) => c.esegui());
        sqlite.exec("COMMIT");
        return esiti;
      } catch (guasto) {
        if (sqlite.isTransaction) sqlite.exec("ROLLBACK");
        throw guasto;
      }
    },
  };
}

function argomento(argv, nome) {
  const prefisso = `--${nome}=`;
  return argv.find((voce) => voce.startsWith(prefisso))?.slice(prefisso.length);
}

// Per ogni candidato, con chi sta nel gruppo: serve a contare le liste che
// cambiano compagni passando da un k all'altro.
function compagni(piano) {
  const perGruppo = new Map();
  for (const membro of piano.membri) {
    if (!perGruppo.has(membro.gruppo_id)) perGruppo.set(membro.gruppo_id, []);
    perGruppo.get(membro.gruppo_id).push(membro.impronta);
  }
  const fuori = new Map();
  for (const impronte of perGruppo.values()) {
    const chiave = [...impronte].sort().join(",");
    for (const impronta of impronte) fuori.set(impronta, chiave);
  }
  return fuori;
}

function cambiati(prima, dopo) {
  let n = 0;
  for (const [impronta, chiave] of prima) if (dopo.get(impronta) !== chiave) n += 1;
  return n;
}

export async function esegui(argv, { stampa = console.log } = {}) {
  if (argv.includes("--help")) {
    stampa(USO);
    return 0;
  }
  const percorso = argomento(argv, "database");
  const formato = argomento(argv, "formato");
  if (!percorso || /^[a-z][a-z0-9+.-]*:\/\//i.test(percorso) || !existsSync(percorso)) {
    throw new Error("serve --database=<file SQLite locale esistente>");
  }
  if (!formato) throw new Error("serve --formato=<formato>");
  const applica = argv.includes("--apply");
  const report = argv.includes("--report");
  const limite = Number(argomento(argv, "limite") ?? LIMITE_CANDIDATI);
  const k = Number(argomento(argv, "k") ?? SOGLIA_DISTANZA_BREW);
  if (applica && report) throw new Error("--report e --apply non vanno insieme");
  if (applica && argomento(argv, "conferma") !== CONFERMA) {
    throw new Error(`per applicare serve --conferma=${CONFERMA}`);
  }
  if (applica && k !== SOGLIA_DISTANZA_BREW) {
    throw new Error(`si applica soltanto k=${SOGLIA_DISTANZA_BREW}`);
  }

  const sqlite = new DatabaseSync(percorso, { readOnly: !applica });
  try {
    if (applica) sqlite.exec("PRAGMA foreign_keys = ON");
    const db = comeD1(sqlite);
    if (report) {
      const piani = {};
      for (const soglia of [3, 4, 5]) {
        piani[soglia] = await pianificaAssegnazione(db, formato, { soglia, limite });
      }
      const [tre, quattro, cinque] = [3, 4, 5].map((soglia) => compagni(piani[soglia].piano));
      stampa(JSON.stringify({
        modalita: "report",
        formato,
        per_k: Object.fromEntries([3, 4, 5].map((soglia) => [soglia, piani[soglia].riepilogo])),
        liste_che_cambiano_gruppo: { "3->4": cambiati(tre, quattro), "4->5": cambiati(quattro, cinque) },
      }, null, 2));
      return 0;
    }
    const pianificato = await pianificaAssegnazione(db, formato, { soglia: k, limite });
    if (!applica) {
      stampa(JSON.stringify({ modalita: "analisi", formato, soglia: k, ...pianificato.riepilogo }, null, 2));
      stampa("Nessun dato modificato. Per applicare serve --apply e la conferma.");
      return 0;
    }
    const esito = await applicaPiano(db, pianificato);
    stampa(JSON.stringify({ modalita: "applica", formato, soglia: k, ...pianificato.riepilogo,
      ...esito }, null, 2));
    return 0;
  } catch (guasto) {
    if (tabelleBrewAssenti(guasto)) {
      throw new Error(`tabelle Brew assenti: applicare prima ${MIGRAZIONE} al database locale`);
    }
    throw guasto;
  } finally {
    sqlite.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  esegui(process.argv.slice(2)).then((codice) => process.exit(codice), (guasto) => {
    console.error(guasto.message);
    process.exit(1);
  });
}
