// Il gateway budgetizzato D1 di Research (addendum finale M8, G5C-01).
//
// Un'invariante sola, verificata a ogni evento e non solo alla fine:
//
//     attempted_cost_prefix <= charged <= max_d1_queries_per_request
//
// Per mantenerla questo modulo e' l'**unico** posto del codice Research che
// tocca i binding D1. Route, planner, writer, retry, consenso e delete
// ricevono il context, mai `env.DB`: la prova di censimento lo pretende.
//
// Tre regole, e il perche':
//
// - la reservation fa controllo e incremento nello stesso tratto sincrono,
//   prima di creare la Promise D1. In JavaScript non c'e' un punto in cui due
//   chiamate concorrenti possano leggere lo stesso saldo;
// - `charged` non scende mai: una call fallita, in timeout o dall'esito
//   incerto e' comunque stata tentata, e un rimborso ottimistico e'
//   esattamente come il budget si supera;
// - un batch parte solo con un token monouso emesso per quei descriptor, e
//   solo se `token.cost == descriptors.length == prepared.length`. Il writer
//   non puo' rechunkare, aggiungere o togliere statement dopo la reservation.

export class BudgetEsaurito extends Error {
  constructor(richiesto, residuo) {
    super(`budget D1 esaurito: richiesti ${richiesto}, residui ${residuo}`);
    this.name = "BudgetEsaurito";
  }
}

export class TokenNonValido extends Error {
  constructor(motivo) {
    super(`token di batch non valido: ${motivo}`);
    this.name = "TokenNonValido";
  }
}

const DATABASE = new Set(["DB", "DRAFT_DB"]);
// Solo i descriptor nati da `descrittore()` si possono eseguire: un oggetto
// costruito a mano con la stessa forma non passa.
const DESCRITTORI = new WeakSet();
const TOKEN = new WeakMap();

function parametro(valore) {
  return valore === null || typeof valore === "string" ||
    (typeof valore === "number" && Number.isFinite(valore));
}

export function descrittore(kind, sql, params = [], db = "DB") {
  if (!DATABASE.has(db)) throw new TypeError(`database ${db} non previsto`);
  if (typeof kind !== "string" || typeof sql !== "string" || !Array.isArray(params) ||
      !params.every(parametro)) {
    throw new TypeError("descrittore non valido");
  }
  const fuori = Object.freeze({ kind, sql, params: Object.freeze([...params]), db });
  DESCRITTORI.add(fuori);
  return fuori;
}

function impronta(descrittori) {
  return JSON.stringify(descrittori.map((d) => [d.db, d.kind, d.sql, d.params]));
}

function controllaBatch(descrittori) {
  if (!Array.isArray(descrittori) || descrittori.length === 0 ||
      !descrittori.every((d) => DESCRITTORI.has(d))) {
    throw new TypeError("un batch e' una lista non vuota di descrittori congelati");
  }
  const db = descrittori[0].db;
  if (!descrittori.every((d) => d.db === db)) {
    throw new TypeError("un batch D1 vive in un database solo");
  }
  return db;
}

export class ResearchD1BudgetContext {
  #bindings;
  #max;
  #charged = 0;

  constructor({ bindings, max }) {
    if (!Number.isSafeInteger(max) || max < 1) {
      throw new RangeError("il budget D1 per richiesta e' un intero positivo");
    }
    this.#bindings = bindings;
    this.#max = max;
  }

  #letture = 0;
  #statement = 0;

  get charged() { return this.#charged; }
  get max() { return this.#max; }
  get residuo() { return this.#max - this.#charged; }
  // Quante letture e quanti statement sono stati davvero tentati: numeri
  // diagnostici, non autorizzano niente.
  get lettureTentate() { return this.#letture; }
  get statementTentati() { return this.#statement; }

  /** Dice se un database e' configurato, senza consegnarne il binding. */
  disponibile(db) { return Boolean(this.#bindings?.[db]); }

  #riserva(costo) {
    if (this.#charged + costo > this.#max) throw new BudgetEsaurito(costo, this.residuo);
    this.#charged += costo;
  }

  #binding(db) {
    const binding = this.#bindings?.[db];
    if (!binding) throw new TypeError(`binding ${db} non disponibile`);
    return binding;
  }

  #lettura(d, metodo) {
    if (!DESCRITTORI.has(d)) return Promise.reject(new TypeError("descrittore non registrato"));
    try {
      this.#riserva(1);
    } catch (errore) {
      return Promise.reject(errore);
    }
    this.#letture += 1;
    return (async () => this.#binding(d.db).prepare(d.sql).bind(...d.params)[metodo]())();
  }

  first(d) { return this.#lettura(d, "first"); }
  all(d) { return this.#lettura(d, "all"); }

  /**
   * Riserva in un colpo solo tutti i batch del piano iniziale. Se il totale
   * non entra, il ledger non cambia e non esce nessun token.
   */
  reserveInitialWritePlan(batches) {
    if (!Array.isArray(batches) || batches.length === 0) {
      throw new TypeError("il piano e' una lista non vuota di batch");
    }
    batches.forEach(controllaBatch);
    const totale = batches.reduce((n, b) => n + b.length, 0);
    this.#riserva(totale);
    return batches.map((b) => {
      const token = Object.freeze({});
      TOKEN.set(token, { contesto: this, costo: b.length, impronta: impronta(b), usato: false });
      return token;
    });
  }

  invokeReservedBatch(token, descrittori) {
    const dati = token && typeof token === "object" ? TOKEN.get(token) : undefined;
    if (!dati || dati.contesto !== this) {
      return Promise.reject(new TokenNonValido("sconosciuto o di un'altra richiesta"));
    }
    if (dati.usato) return Promise.reject(new TokenNonValido("gia' consumato"));
    // Presentato una volta, bruciato: anche se i descriptor non tornano.
    dati.usato = true;
    let db;
    try {
      db = controllaBatch(descrittori);
    } catch (errore) {
      return Promise.reject(new TokenNonValido(errore.message));
    }
    if (descrittori.length !== dati.costo) {
      return Promise.reject(new TokenNonValido("numero di statement diverso dal riservato"));
    }
    if (impronta(descrittori) !== dati.impronta) {
      return Promise.reject(new TokenNonValido("descrittori diversi da quelli riservati"));
    }
    const binding = this.#binding(db);
    const preparati = descrittori.map((d) => binding.prepare(d.sql).bind(...d.params));
    if (preparati.length !== dati.costo) {
      return Promise.reject(new TokenNonValido("statement preparati diversi dal riservato"));
    }
    this.#statement += preparati.length;
    return (async () => binding.batch(preparati))();
  }

  budgetedBatch(descrittori) {
    let token;
    try {
      [token] = this.reserveInitialWritePlan([descrittori]);
    } catch (errore) {
      return Promise.reject(errore);
    }
    return this.invokeReservedBatch(token, descrittori);
  }
}

/** Il solo punto in cui l'ambiente del Worker consegna i binding a Research. */
export function contestoResearch(ambiente, max) {
  return new ResearchD1BudgetContext({
    bindings: { DB: ambiente.DB, DRAFT_DB: ambiente.DRAFT_DB }, max,
  });
}
