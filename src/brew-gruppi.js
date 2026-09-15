// Persistenza dei gruppi Brew (S1): candidati, piano, applicazione, e la
// lettura dei membri per le GET pubbliche.
//
// Tre regole:
// - nessuna scrittura parte da una GET. Il piano si applica soltanto dallo
//   strumento locale (`strumenti/brew_gruppi.mjs`) o dal cron, e il cron resta
//   spento finche' `BREW_GRUPPI` non vale "on";
// - e' candidata soltanto una lista non classificata che ha gia' 30 partite nel
//   formato, sommando periodi, modalita' e rank: la stessa soglia che rende
//   pubblica la sua decklist. Una lista sotto soglia non entra in nessun
//   gruppo, cosi' la struttura dei gruppi non dice niente di lei;
// - il piano e' deterministico e l'applicazione e' un batch solo: se si
//   interrompe non resta niente a meta', e rilanciarlo non crea doppioni. Un
//   secondo processo che corre insieme viene fermato dai vincoli UNIQUE.

import {
  ALGORITMO_BREW, SOGLIA_DISTANZA_BREW, FirmaNonValida, firmaMain, nuovoIdOpaco,
  ordinaCandidati, pianificaGruppi, statistichePiano,
} from "./brew-clustering.js";
import { classificaImpronte } from "./archetipi.js";
import { CATALOGO_ARCHETIPI } from "./catalogo-archetipi-generato.js";
import { SOGLIA_DECKLIST_PARTITE } from "./privacy-pubblica.js";

export const LIMITE_CANDIDATI = 200;
export const LIMITE_CANDIDATI_MASSIMO = 2000;
export const LIMITE_CANDIDATI_CRON = 50;

// Prima della migrazione le tabelle non esistono: le letture pubbliche
// continuano come prima invece di rompersi.
export function tabelleBrewAssenti(guasto) {
  return /no such table:\s*(main\.)?brew_/i.test(String(guasto?.message ?? guasto));
}

function formatoValido(formato) {
  return typeof formato === "string" && formato.trim() === formato &&
    formato.length > 0 && formato.length <= 40;
}

async function leggiStato(db, formato) {
  const liste = await db.prepare(
    `SELECT impronta_mazzo AS impronta, COUNT(*) AS partite
     FROM partite WHERE formato = ? AND impronta_mazzo IS NOT NULL
     GROUP BY impronta_mazzo HAVING COUNT(*) >= ?`
  ).bind(formato, SOGLIA_DECKLIST_PARTITE).all();
  const gruppi = await db.prepare(
    `SELECT id, ordine, rappresentante FROM brew_gruppo
     WHERE formato = ? AND algoritmo = ? ORDER BY ordine`
  ).bind(formato, ALGORITMO_BREW).all();
  const membri = await db.prepare(
    "SELECT impronta FROM brew_membro WHERE formato = ? AND algoritmo = ?"
  ).bind(formato, ALGORITMO_BREW).all();
  // Le carte servono soltanto alle liste non ancora assegnate e ai
  // rappresentanti, che restano il centro del loro gruppo anche quando
  // scendono sotto soglia: i membri gia' assegnati non si rileggono, cosi' il
  // costo di un giro non cresce con lo storico.
  const carte = await db.prepare(
    `SELECT p.impronta_mazzo AS impronta, cm.carta AS carta, MAX(cm.copie) AS copie
     FROM partite p JOIN carte_mazzo cm ON cm.partita = p.id
     WHERE p.formato = ? AND p.impronta_mazzo IN (
       SELECT impronta FROM (
         SELECT impronta_mazzo AS impronta FROM partite
         WHERE formato = ? AND impronta_mazzo IS NOT NULL
         GROUP BY impronta_mazzo HAVING COUNT(*) >= ?
         EXCEPT SELECT impronta FROM brew_membro WHERE formato = ? AND algoritmo = ?)
       UNION SELECT rappresentante FROM brew_gruppo WHERE formato = ? AND algoritmo = ?)
     GROUP BY p.impronta_mazzo, cm.carta
     ORDER BY p.impronta_mazzo, cm.carta`
  ).bind(formato, formato, SOGLIA_DECKLIST_PARTITE, formato, ALGORITMO_BREW,
    formato, ALGORITMO_BREW).all();
  return {
    liste: liste.results || [],
    gruppi: gruppi.results || [],
    membri: new Set((membri.results || []).map((riga) => String(riga.impronta))),
    carte: carte.results || [],
  };
}

/**
 * Il piano, senza scrivere niente: e' anche il dry-run.
 *
 * `soglia` diversa da quella dell'algoritmo serve soltanto al report k=3/4/5:
 * `applicaPiano` la rifiuta.
 */
export async function pianificaAssegnazione(db, formato, {
  soglia = SOGLIA_DISTANZA_BREW, limite = LIMITE_CANDIDATI, generaId = nuovoIdOpaco,
  catalogo = CATALOGO_ARCHETIPI,
} = {}) {
  if (!formatoValido(formato)) throw new Error("formato non valido");
  if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_CANDIDATI_MASSIMO) {
    throw new Error("limite non valido");
  }
  const stato = await leggiStato(db, formato);

  const perImpronta = new Map();
  for (const riga of stato.carte) {
    const impronta = String(riga.impronta || "");
    if (!perImpronta.has(impronta)) perImpronta.set(impronta, []);
    perImpronta.get(impronta).push({ carta: riga.carta, copie: riga.copie });
  }
  const firme = new Map();
  for (const [impronta, righe] of perImpronta) {
    try {
      firme.set(impronta, firmaMain(righe, catalogo));
    } catch (guasto) {
      if (!(guasto instanceof FirmaNonValida)) throw guasto;
    }
  }
  const classificate = classificaImpronte(stato.carte, formato, catalogo);

  const conteggi = { gia_assegnate: 0, classificate: 0, firme_non_valide: 0 };
  const candidati = [];
  for (const riga of stato.liste) {
    const impronta = String(riga.impronta || "");
    if (stato.membri.has(impronta)) conteggi.gia_assegnate += 1;
    else if (classificate.has(impronta)) conteggi.classificate += 1;
    else if (!firme.has(impronta)) conteggi.firme_non_valide += 1;
    else candidati.push({ impronta, partite: Number(riga.partite), firma: firme.get(impronta) });
  }
  const ordinati = ordinaCandidati(candidati);
  const scelti = ordinati.slice(0, limite);
  const gruppi = stato.gruppi.map((gruppo) => ({
    id: gruppo.id,
    ordine: Number(gruppo.ordine),
    firma: firme.get(String(gruppo.rappresentante)) || null,
  }));
  const piano = pianificaGruppi({ gruppi, candidati: scelti, soglia, generaId });
  return {
    formato,
    algoritmo: ALGORITMO_BREW,
    soglia,
    piano,
    riepilogo: {
      liste_pubblicabili: stato.liste.length,
      ...conteggi,
      gruppi_esistenti: gruppi.length,
      gruppi_orfani: gruppi.filter((gruppo) => !gruppo.firma).length,
      limite,
      rimasti: ordinati.length - scelti.length,
      ...statistichePiano(piano),
    },
  };
}

export async function applicaPiano(db, pianificato, { ora = () => new Date().toISOString() } = {}) {
  if (pianificato?.algoritmo !== ALGORITMO_BREW || pianificato.soglia !== SOGLIA_DISTANZA_BREW) {
    throw new Error("si applica soltanto l'algoritmo corrente con la sua soglia");
  }
  const { formato, piano } = pianificato;
  if (!formatoValido(formato)) throw new Error("formato non valido");
  if (!piano.membri.length) return { gruppi_creati: 0, membri_assegnati: 0 };
  const quando = ora();
  const comandi = [];
  // INSERT semplici, non OR IGNORE: un conflitto annulla l'intero batch invece
  // di lasciare un gruppo senza rappresentante o un membro in due gruppi.
  for (const gruppo of piano.gruppi) {
    comandi.push(db.prepare(
      `INSERT INTO brew_gruppo
       (id, formato, algoritmo, soglia_distanza, ordine, rappresentante, creato)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(gruppo.id, formato, ALGORITMO_BREW, SOGLIA_DISTANZA_BREW, gruppo.ordine,
      gruppo.rappresentante, quando));
  }
  for (const membro of piano.membri) {
    comandi.push(db.prepare(
      `INSERT INTO brew_membro
       (formato, algoritmo, impronta, gruppo_id, variante_id, distanza, assegnato)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(formato, ALGORITMO_BREW, membro.impronta, membro.gruppo_id, membro.variante_id,
      membro.distanza, quando));
  }
  // In coda la stessa pulizia della cancellazione: se un mittente e' stato
  // cancellato fra la lettura del piano e questo batch, quello che il piano
  // gli attribuiva sparisce nella stessa transazione invece di restare orfano.
  comandi.push(...await comandiPuliziaBrew(db));
  await db.batch(comandi);
  return { gruppi_creati: piano.gruppi.length, membri_assegnati: piano.membri.length };
}

export async function assegnaBrew(db, formato, opzioni = {}) {
  const pianificato = await pianificaAssegnazione(db, formato, opzioni);
  const esito = await applicaPiano(db, pianificato, opzioni);
  return { riepilogo: pianificato.riepilogo, ...esito };
}

// Dopo una cancellazione dei contributi non deve restare niente di Brew senza
// partite dietro: la pagina privacy promette che i contributi spariscono dai
// database. La pulizia guarda lo stato vero dopo le DELETE, non la lista del
// mittente, cosi' un retry la completa anche quando le partite non ci sono
// gia' piu'. Va nello stesso batch che cancella le partite, prima delle
// credenziali, e fa tre passi:
// 1. toglie i membri la cui impronta non ha piu' partite nel loro formato;
// 2. toglie i membri dei gruppi il cui rappresentante non ha piu' partite;
// 3. toglie quei gruppi. E' l'unica eccezione alla stabilita' degli id, e la
//    decide la privacy: i membri superstiti restano liberi, con le loro
//    partite, e il prossimo giro del cron li raggruppa di nuovo.
// Qui non si rifa' nessun clustering. Con le tabelle Brew assenti (Worker
// deployato prima della migrazione) non aggiunge niente, e la cancellazione
// resta quella di prima.
const senzaPartite = (formato, impronta) =>
  `NOT EXISTS (SELECT 1 FROM partite p WHERE p.formato = ${formato} AND p.impronta_mazzo = ${impronta})`;

export async function comandiPuliziaBrew(db) {
  try {
    await db.prepare("SELECT 1 FROM brew_membro LIMIT 1").first();
  } catch (guasto) {
    if (tabelleBrewAssenti(guasto)) return [];
    throw guasto;
  }
  return [
    db.prepare(`DELETE FROM brew_membro
      WHERE ${senzaPartite("brew_membro.formato", "brew_membro.impronta")}`),
    db.prepare(`DELETE FROM brew_membro WHERE gruppo_id IN (SELECT g.id FROM brew_gruppo g
      WHERE ${senzaPartite("g.formato", "g.rappresentante")})`),
    db.prepare(`DELETE FROM brew_gruppo
      WHERE ${senzaPartite("brew_gruppo.formato", "brew_gruppo.rappresentante")}`),
  ];
}

// L'assegnazione dei nuovi membri, fuori dalle GET: gira nel cron solo se
// `BREW_GRUPPI = "on"` e con un tetto di candidati per giro. Prima ripassa la
// pulizia: se una cancellazione fosse arrivata da una strada che non la fa, il
// piano non vede mai un gruppo senza partite.
export async function assegnaBrewProgrammato(ambiente, { limite = LIMITE_CANDIDATI_CRON } = {}) {
  if (ambiente?.BREW_GRUPPI !== "on" || !ambiente.DB) return null;
  try {
    const pulizia = await comandiPuliziaBrew(ambiente.DB);
    if (pulizia.length) await ambiente.DB.batch(pulizia);
    const formati = await ambiente.DB.prepare(
      `SELECT DISTINCT formato FROM partite
       WHERE formato IS NOT NULL AND impronta_mazzo IS NOT NULL ORDER BY formato`
    ).all();
    let resto = limite;
    const esiti = [];
    for (const { formato } of formati.results || []) {
      if (resto <= 0) break;
      if (!formatoValido(formato)) continue;
      const esito = await assegnaBrew(ambiente.DB, formato, { limite: resto });
      resto -= esito.membri_assegnati;
      esiti.push({ formato, gruppi_creati: esito.gruppi_creati, membri_assegnati: esito.membri_assegnati });
    }
    return esiti;
  } catch (guasto) {
    if (tabelleBrewAssenti(guasto)) return null;
    console.error("guasto assegnando i gruppi Brew", String(guasto?.message || guasto));
    return null;
  }
}

// I membri delle sole liste che nel filtro corrente arrivano alla soglia: sono
// le uniche che una risposta pubblica puo' nominare. null = tabelle assenti.
export async function leggiMembriPubblicabili(db, filtro, soglia) {
  try {
    const esito = await db.prepare(
      `SELECT m.impronta AS impronta, m.gruppo_id AS gruppo_id, m.variante_id AS variante_id,
              m.distanza AS distanza, g.rappresentante AS rappresentante,
              g.soglia_distanza AS soglia_distanza
       FROM brew_membro m JOIN brew_gruppo g ON g.id = m.gruppo_id
       WHERE m.formato = ? AND m.algoritmo = ? AND m.impronta IN (
         SELECT impronta_mazzo FROM partite ${filtro.where}
         GROUP BY impronta_mazzo HAVING COUNT(*) >= ?)`
    ).bind(filtro.formato, ALGORITMO_BREW, ...filtro.argomenti, soglia).all();
    return new Map((esito.results || []).map((riga) => [String(riga.impronta), {
      gruppo_id: riga.gruppo_id,
      variante_id: riga.variante_id,
      distanza: Number(riga.distanza),
      rappresentante: String(riga.rappresentante),
      soglia_distanza: Number(riga.soglia_distanza),
    }]));
  } catch (guasto) {
    if (tabelleBrewAssenti(guasto)) return null;
    throw guasto;
  }
}

export async function leggiGruppo(db, id, formato) {
  try {
    const gruppo = await db.prepare(
      `SELECT id, soglia_distanza, rappresentante FROM brew_gruppo
       WHERE id = ? AND formato = ? AND algoritmo = ?`
    ).bind(id, formato, ALGORITMO_BREW).first();
    if (!gruppo) return null;
    const membri = await db.prepare(
      `SELECT impronta, variante_id, distanza FROM brew_membro
       WHERE gruppo_id = ? AND formato = ? AND algoritmo = ?`
    ).bind(id, formato, ALGORITMO_BREW).all();
    return {
      id: gruppo.id,
      soglia_distanza: Number(gruppo.soglia_distanza),
      rappresentante: String(gruppo.rappresentante),
      membri: new Map((membri.results || []).map((riga) => [String(riga.impronta), {
        variante_id: riga.variante_id, distanza: Number(riga.distanza),
      }])),
    };
  } catch (guasto) {
    if (tabelleBrewAssenti(guasto)) return null;
    throw guasto;
  }
}

export async function leggiMembro(db, formato, impronta) {
  try {
    return await db.prepare(
      `SELECT gruppo_id, variante_id FROM brew_membro
       WHERE formato = ? AND algoritmo = ? AND impronta = ?`
    ).bind(formato, ALGORITMO_BREW, impronta).first();
  } catch (guasto) {
    if (tabelleBrewAssenti(guasto)) return null;
    throw guasto;
  }
}
