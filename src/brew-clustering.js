// Raggruppamento dei Brew quasi uguali (S1, contratto B1).
//
// Qui non c'e' database ne' Cloudflare: firma, distanza e piano di
// assegnazione sono funzioni pure, provate da prove/brew-clustering.test.js.
// Le regole, e il perche', stanno nel contratto
// passaggi/sito/S1-BREW-CONTRATTO-B1-2026-09-15.md:
//
// - si misura solo il main deck (`carte_mazzo`), come multinsieme
//   «nome carta -> copie». Stampe diverse della stessa carta, le terre base
//   soprattutto, hanno ArenaId diversi ma sono la stessa carta; le terre
//   restano dentro, altrimenti due basi di mana diverse sembrerebbero uguali;
// - d(A,B) = max(copie che solo A ha in piu', copie che solo B ha in piu');
// - gruppi a raggio: ogni membro dista al massimo `soglia` dal rappresentante,
//   scelto una volta e mai cambiato. Non ci sono catene: A~B e B~C non
//   uniscono A e C, a meno che entrambi stiano entro la soglia dallo stesso
//   rappresentante.

import { CATALOGO_ARCHETIPI } from "./catalogo-archetipi-generato.js";
import { LIMITI } from "./controlli.js";

// Una modifica a distanza, soglia o scelta del rappresentante e' un algoritmo
// nuovo, con un nome nuovo: i gruppi esistenti non si riscrivono mai.
export const ALGORITMO_BREW = "main-multiset-radius-v1";
export const SOGLIA_DISTANZA_BREW = 4;

const IMPRONTA = /^[0-9a-f]{64}$/;
const ID_OPACO = /^(bg|bv)_[0-9a-f]{32}$/;
const ARENA_ID_MASSIMO = 9999999;

export class FirmaNonValida extends Error {}

function interoTra(valore, minimo, massimo) {
  return Number.isInteger(valore) && valore >= minimo && valore <= massimo;
}

// Le righe arrivano da `carte_mazzo` (una per carta). Una riga storta non si
// aggiusta: la lista resta fuori dai gruppi invece di finire nel gruppo
// sbagliato.
export function firmaMain(righe, catalogo = CATALOGO_ARCHETIPI) {
  if (!Array.isArray(righe) || !righe.length) throw new FirmaNonValida("mazzo vuoto");
  const nomi = catalogo?.id_a_nome || {};
  const firma = new Map();
  let totale = 0;
  for (const riga of righe) {
    if (!interoTra(riga?.carta, 1, ARENA_ID_MASSIMO)) throw new FirmaNonValida("carta non valida");
    if (!interoTra(riga?.copie, 1, LIMITI.carteInMazzo)) throw new FirmaNonValida("copie non valide");
    const nome = typeof nomi[String(riga.carta)] === "string" && nomi[String(riga.carta)].trim()
      ? nomi[String(riga.carta)].trim()
      : `#${riga.carta}`;
    firma.set(nome, (firma.get(nome) || 0) + riga.copie);
    totale += riga.copie;
  }
  if (totale > LIMITI.carteInMazzo) throw new FirmaNonValida("troppe carte");
  return firma;
}

function controllaFirma(firma) {
  if (!(firma instanceof Map) || !firma.size) throw new FirmaNonValida("firma non valida");
  for (const [nome, copie] of firma) {
    if (typeof nome !== "string" || !nome || !interoTra(copie, 1, LIMITI.carteInMazzo)) {
      throw new FirmaNonValida("firma non valida");
    }
  }
}

export function distanza(prima, seconda) {
  controllaFirma(prima);
  controllaFirma(seconda);
  let soloPrima = 0;
  let soloSeconda = 0;
  for (const [nome, copie] of prima) soloPrima += Math.max(0, copie - (seconda.get(nome) || 0));
  for (const [nome, copie] of seconda) soloSeconda += Math.max(0, copie - (prima.get(nome) || 0));
  return Math.max(soloPrima, soloSeconda);
}

// Identificativi pubblici: casuali, lato server, mai ricavati dall'impronta.
export function nuovoIdOpaco(prefisso) {
  const byte = crypto.getRandomValues(new Uint8Array(16));
  return `${prefisso}_${[...byte].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

// Ordine fisso, che non dipende da come arrivano i candidati: prima le liste
// piu' giocate, poi l'impronta. Il primo candidato di un gruppo nuovo ne
// diventa il rappresentante.
function confrontaCandidati(a, b) {
  return b.partite - a.partite || (a.impronta < b.impronta ? -1 : a.impronta > b.impronta ? 1 : 0);
}

export function ordinaCandidati(candidati) {
  return [...candidati].sort(confrontaCandidati);
}

/**
 * Il piano di assegnazione: quali gruppi nascono e dove va ogni candidato.
 *
 * `gruppi` sono quelli gia' salvati, congelati: `firma` e' quella del loro
 * rappresentante (null se le sue carte non ci sono piu': il gruppo resta, ma
 * non accoglie nessuno). `candidati` sono liste non ancora assegnate. Il primo
 * backfill e' lo stesso piano con `gruppi` vuoto.
 */
export function pianificaGruppi({ gruppi = [], candidati = [], soglia = SOGLIA_DISTANZA_BREW,
  generaId = nuovoIdOpaco } = {}) {
  if (!interoTra(soglia, 0, LIMITI.carteInMazzo)) throw new Error("soglia non valida");
  const usati = new Set();
  const attivi = gruppi.map((gruppo) => {
    if (!ID_OPACO.test(String(gruppo?.id)) || !interoTra(gruppo?.ordine, 1, Number.MAX_SAFE_INTEGER)) {
      throw new Error("gruppo esistente non valido");
    }
    if (gruppo.firma !== null) controllaFirma(gruppo.firma);
    usati.add(gruppo.id);
    return { id: gruppo.id, ordine: gruppo.ordine, firma: gruppo.firma };
  });
  const visti = new Set();
  for (const candidato of candidati) {
    if (!IMPRONTA.test(String(candidato?.impronta)) || !interoTra(candidato?.partite, 0, Number.MAX_SAFE_INTEGER)) {
      throw new Error("candidato non valido");
    }
    if (visti.has(candidato.impronta)) throw new Error("candidato duplicato");
    visti.add(candidato.impronta);
    controllaFirma(candidato.firma);
  }
  const nuovoId = (prefisso) => {
    const id = generaId(prefisso);
    if (!ID_OPACO.test(String(id)) || !id.startsWith(`${prefisso}_`) || usati.has(id)) {
      throw new Error("identificativo opaco non valido o ripetuto");
    }
    usati.add(id);
    return id;
  };

  let ordine = attivi.reduce((massimo, gruppo) => Math.max(massimo, gruppo.ordine), 0);
  const nuoviGruppi = [];
  const membri = [];
  for (const candidato of ordinaCandidati(candidati)) {
    // Distanza minima dal rappresentante; a pari distanza il gruppo nato prima.
    let scelto = null;
    let migliore = Infinity;
    for (const gruppo of attivi) {
      if (!gruppo.firma) continue;
      const d = distanza(candidato.firma, gruppo.firma);
      if (d <= soglia && (d < migliore || (d === migliore && gruppo.ordine < scelto.ordine))) {
        scelto = gruppo;
        migliore = d;
      }
    }
    if (!scelto) {
      ordine += 1;
      scelto = { id: nuovoId("bg"), ordine, firma: candidato.firma };
      attivi.push(scelto);
      nuoviGruppi.push({ id: scelto.id, ordine, rappresentante: candidato.impronta });
      migliore = 0;
    }
    membri.push({ impronta: candidato.impronta, gruppo_id: scelto.id,
      variante_id: nuovoId("bv"), distanza: migliore });
  }
  return { gruppi: nuoviGruppi, membri };
}

// Riepilogo di un piano per il report: niente impronte, solo conteggi.
export function statistichePiano(piano) {
  const dimensioni = new Map();
  for (const membro of piano.membri) {
    dimensioni.set(membro.gruppo_id, (dimensioni.get(membro.gruppo_id) || 0) + 1);
  }
  const distribuzione = {};
  for (const n of dimensioni.values()) distribuzione[n] = (distribuzione[n] || 0) + 1;
  return {
    candidati: piano.membri.length,
    gruppi_toccati: dimensioni.size,
    gruppi_nuovi: piano.gruppi.length,
    singleton: [...dimensioni.values()].filter((n) => n === 1).length,
    distribuzione_dimensioni: distribuzione,
  };
}
