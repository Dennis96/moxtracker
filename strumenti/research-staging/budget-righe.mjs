// Il tetto di righe scritte di una run degli strumenti di staging.
//
// La quota D1 gratuita (100.000 righe scritte al giorno) vale per l'account
// intero, non per il singolo database: il 14/09/2026 i benchmark sullo staging
// l'hanno esaurita e hanno bloccato le scritture anche in produzione fino alla
// mezzanotte UTC (incidente R3-OP-01). Da allora ogni run remota:
//   1. dichiara un tetto esplicito (`--budget-righe`), senza il quale non parte;
//   2. stima il consumo prima di partire e, se supera il tetto, non manda niente;
//   3. prenota la stima di ogni richiesta prima di mandarla e si ferma prima di
//      quella che porterebbe il totale oltre il tetto.

// Stima per contribution, tarata sulle misure del D1 reale con lo schema di
// prima della compattazione (163, 417, 1.310 e 13.521 righe scritte per le
// quattro forme del benchmark): 12 righe fisse (contribution, revisione,
// variante, storia e i loro indici) piu' 3 per ogni riga di proiezione (game,
// evento, voce di mazzo, delta di sideboard: la riga e i suoi indici). Lo
// schema compattato scrive meno righe, quindi la stima resta un tetto.
export const RIGHE_FISSE = 12;
export const RIGHE_PER_PROIEZIONE = 3;
// Consenso, revoca e sonde scrivono poche righe (lineage, generation,
// tombstone): valori larghi.
export const RIGHE_CONSENSO = 30;
export const RIGHE_REVOCA = 10;
export const RIGHE_SONDA = 10;

export function stimaRigheContribution(c) {
  let proiezioni = 0;
  for (const g of c.games || []) {
    proiezioni += 1;
    for (const tipo of ["draws", "casts", "lands"]) proiezioni += (g[tipo] || []).length;
    proiezioni += Object.keys(g.deck?.main || {}).length + Object.keys(g.deck?.sideboard || {}).length;
    // Le copie ripetute diventano una riga sola: contarle tutte e' per eccesso.
    proiezioni += (g.sideboard_in || []).length + (g.sideboard_out || []).length;
  }
  return RIGHE_FISSE + RIGHE_PER_PROIEZIONE * proiezioni;
}

export function stimaRigheRichiesta(partite) {
  return partite.reduce((totale, c) => totale + stimaRigheContribution(c), 0);
}

// Le righe scritte misurate dal binding strumentato del Worker di staging, o
// null quando la misura manca e deve valere la stima. Manca se un meta non
// porta `rows_written` (il finto D1 locale), se il Worker non ha ancora il
// contatore, o se ci sono state chiamate senza meta: zero righe misurate non
// sono zero righe scritte.
export function righeMisurate(strumento) {
  if (!strumento) return null;
  if (!strumento.letture && !strumento.statement) return 0;
  if (strumento.meta_senza_righe === 0 && strumento.meta_visti > 0 && Number.isFinite(strumento.righe_scritte)) {
    return strumento.righe_scritte;
  }
  return null;
}

export class RigheOltreBudget extends Error {
  constructor(messaggio, dettaglio) {
    super(messaggio);
    this.name = "RigheOltreBudget";
    this.dettaglio = dettaglio;
  }
}

export class BudgetRighe {
  #pendenti = [];

  constructor(tetto) {
    if (!Number.isSafeInteger(tetto) || tetto <= 0) {
      throw new RangeError("il budget di righe scritte deve essere un intero positivo");
    }
    this.tetto = tetto;
    this.consumate = 0;
    // Le richieste che hanno scritto piu' della stima: la stima va rivista.
    this.oltre_stima = [];
  }

  get prenotate() {
    return this.#pendenti.reduce((totale, p) => totale + p.stima, 0);
  }

  get residue() {
    return this.tetto - this.consumate - this.prenotate;
  }

  // Sincrona: va chiamata prima di mandare la richiesta, anche quando piu'
  // richieste partono insieme, cosi' le prenotazioni in volo contano tutte.
  prenota(stima, etichetta) {
    if (!Number.isFinite(stima) || stima < 0) throw new RangeError(`stima non valida per ${etichetta}`);
    if (stima > this.residue) {
      throw new RigheOltreBudget(`${etichetta}: servirebbero fino a ${stima} righe scritte, `
        + `ne restano ${this.residue} su un tetto di ${this.tetto}`,
      { etichetta, stima, consumate: this.consumate, prenotate: this.prenotate, tetto: this.tetto });
    }
    this.#pendenti.push({ stima, etichetta });
    return stima;
  }

  // Chiude una prenotazione con le righe misurate da D1 (`meta.rows_written`)
  // o, se la misura manca, con la stima.
  registra(misurate, stima) {
    const indice = stima === undefined ? 0 : this.#pendenti.findIndex((p) => p.stima === stima);
    const [prenotazione] = indice >= 0 ? this.#pendenti.splice(indice, 1) : [];
    const usate = Number.isFinite(misurate) ? misurate : (prenotazione?.stima ?? stima ?? 0);
    if (prenotazione && usate > prenotazione.stima) {
      this.oltre_stima.push({ etichetta: prenotazione.etichetta, stima: prenotazione.stima, misurate: usate });
    }
    this.consumate += usate;
    return usate;
  }
}

// `--budget-righe <n>`: obbligatorio contro lo staging remoto; in locale
// (SQLite su file) la quota non esiste e il tetto e' solo nominale.
export function tettoDaArgomenti(argomenti, locale) {
  const i = argomenti.indexOf("--budget-righe");
  const valore = i >= 0 ? argomenti[i + 1] : null;
  if (valore === null || valore === undefined) {
    if (locale) return Number.MAX_SAFE_INTEGER;
    console.error("serve --budget-righe <righe scritte>: la quota D1 gratuita e' dell'account "
      + "intero e una run di staging la consuma anche per la produzione (R3-OP-01)");
    process.exit(2);
  }
  if (!/^[1-9][0-9]*$/.test(valore) || !Number.isSafeInteger(Number(valore))) {
    console.error("--budget-righe vuole un intero positivo");
    process.exit(2);
  }
  return Number(valore);
}

// Il controllo prima della prima richiesta.
export function fermaSeOltre(stima, tetto) {
  if (stima > tetto) {
    console.error(`stima preventiva: ${stima} righe scritte, oltre il tetto --budget-righe ${tetto}. `
      + "Nessuna richiesta inviata.");
    process.exit(3);
  }
  console.log(`stima preventiva: ${stima} righe scritte su un tetto di ${tetto}`);
}
