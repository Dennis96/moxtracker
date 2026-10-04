// Ricezione e lettura dei Draft. Le tracce complete restano nel bucket R2
// privato; D1 conserva soltanto indici e fatti aggregabili.

import { eliminaResearchMittente } from "./research/account-research.js";
import { comandiPuliziaBrew } from "./brew-gruppi.js";

export const VERSIONI_DRAFT_ACCETTATE = [1];

export const LIMITI_DRAFT = {
  perRichiesta: 4,
  byteRichiesta: 512 * 1024,
  perMittenteGiorno: 30,
  globaliGiorno: 2_000,
  oggettiMese: 150_000,
  byteConservati: 8 * 1024 * 1024 * 1024,
  scrittureMese: 800_000,
  lettureMese: 8_000_000,
  pickMassimi: 45,
  offerteMassime: 20,
  // Il mazzo montato arriva in piu' versioni: Arena riscrive `CourseDeck` a
  // ogni cambio, anche fra una partita e l'altra. Trenta versioni sono molte
  // piu' di quante se ne vedano in un evento vero, e tengono la scrittura D1
  // dentro i limiti del piano gratuito.
  versioniMazzoMassime: 30,
  carteMazzoMassime: 120,
  copieMassime: 40,
};

const ESADECIMALE = /^[0-9a-f]+$/;
const FORMATI = new Set(["PremierDraft", "QuickDraft", "TradDraft", "PickTwoDraft"]);
const CAMPI_VIETATI = new Set([
  "nome", "username", "displayname", "account", "accountid", "draftid",
  "arenaid", "avversario", "opponent", "screenname",
]);

function stringaHex(valore, lunghezza) {
  return typeof valore === "string" && valore.length === lunghezza &&
    ESADECIMALE.test(valore.toLowerCase());
}

function interoTra(valore, minimo, massimo) {
  return Number.isInteger(valore) && valore >= minimo && valore <= massimo;
}

function elencoCarte(valore, massimo = LIMITI_DRAFT.offerteMassime) {
  return Array.isArray(valore) && valore.length <= massimo &&
    valore.every((carta) => interoTra(carta, 1, 9_999_999));
}

function contieneCampoVietato(valore, profondita = 0) {
  if (profondita > 12 || valore === null) return false;
  if (Array.isArray(valore)) {
    // `some` risponde true/false, e il nome del campo si perdeva per strada:
    // chi riceveva il rifiuto leggeva «campo vietato: true». Trovato il
    // 26/08/2026 dai casi condivisi con Mox, dove il nome usciva giusto.
    for (const dentro of valore) {
      const trovato = contieneCampoVietato(dentro, profondita + 1);
      if (trovato) return trovato;
    }
    return false;
  }
  if (typeof valore !== "object") return false;
  for (const [chiave, dentro] of Object.entries(valore)) {
    if (CAMPI_VIETATI.has(chiave.toLowerCase())) return chiave;
    const trovato = contieneCampoVietato(dentro, profondita + 1);
    if (trovato) return trovato;
  }
  return false;
}

function elencoQuantita(valore, massimo = LIMITI_DRAFT.carteMazzoMassime) {
  if (!Array.isArray(valore) || valore.length > massimo) return false;
  const viste = new Set();
  for (const voce of valore) {
    if (!Array.isArray(voce) || voce.length !== 2) return false;
    const [carta, quante] = voce;
    if (!interoTra(carta, 1, 9_999_999)) return false;
    if (!interoTra(quante, 1, LIMITI_DRAFT.copieMassime)) return false;
    if (viste.has(carta)) return false;
    viste.add(carta);
  }
  return true;
}

// Il mazzo montato non decide niente e non entra in nessuna percentuale: si
// conserva. Ma quello che si conserva si valida lo stesso, se no il primo
// pacchetto malformato porta dentro l'indice una lista che nessuno sa leggere.
function controllaMazzoGiocato(valore) {
  if (!Array.isArray(valore)) return "mazzo giocato non valido";
  if (valore.length > LIMITI_DRAFT.versioniMazzoMassime) {
    return "troppe versioni del mazzo giocato";
  }
  for (const versione of valore) {
    if (!versione || typeof versione !== "object" || Array.isArray(versione)) {
      return "versione del mazzo non valida";
    }
    if (!elencoQuantita(versione.mazzo) || versione.mazzo.length === 0) {
      return "carte del mazzo giocato non valide";
    }
    if ("riserva" in versione && versione.riserva !== null &&
        !elencoQuantita(versione.riserva)) {
      return "riserva del mazzo giocato non valida";
    }
    if ("quando" in versione && versione.quando !== null &&
        (typeof versione.quando !== "string" || versione.quando.length > 40)) {
      return "ora del mazzo giocato non valida";
    }
  }
  return null;
}

// Un pacchetto di Arena e' un elenco di copie fisiche, non un insieme: la
// stessa carta puo' starci due volte. E' successo nel primo Draft vero di
// Reality Fracture, il 30/09/2026, e il controllo di allora - carte tutte
// diverse - avrebbe rifiutato il Draft intero. La regola e' per molteplicita':
// due copie offerte si possono scegliere, consigliare e candidare due volte,
// non tre. Gemello di `_entro_le_copie` in `pacchetto_draft.py`.
function copie(carte) {
  const conto = new Map();
  for (const carta of carte) conto.set(carta, (conto.get(carta) || 0) + 1);
  return conto;
}

function entroLeCopie(carte, offerte) {
  const disponibili = copie(offerte);
  for (const [carta, quante] of copie(carte)) {
    if (quante > (disponibili.get(carta) || 0)) return false;
  }
  return true;
}

/** Scelte e consigli abbinati copia per copia: `[{ seguito, consiglio }]`.
 *
 * Ogni copia consigliata vale per una scelta sola: con `[A, B]` consigliate e
 * `[A, A]` scelte la prima A e' seguita, la seconda no. `includes` le avrebbe
 * contate tutte e due. A una scelta che non segue il consiglio si abbina, in
 * ordine, un consiglio rimasto senza scelta - mai uno gia' seguito, che e' il
 * solo modo di non scrivere una riga con consiglio e scelta uguali e
 * `seguito` a zero.
 */
export function abbinaScelte(scelte, consigli) {
  const liberi = [...consigli];
  const esiti = scelte.map((scelta) => {
    const posto = liberi.indexOf(scelta);
    if (posto === -1) return { seguito: false, consiglio: null };
    liberi.splice(posto, 1);
    return { seguito: true, consiglio: scelta };
  });
  for (const esito of esiti) {
    if (!esito.seguito) esito.consiglio = liberi.shift() ?? consigli[0];
  }
  return esiti;
}

function stessoPool(a, b) {
  return a.length === b.length && a.every((carta, indice) => carta === b[indice]);
}

export function controllaDraft(dato) {
  if (!dato || typeof dato !== "object" || Array.isArray(dato)) {
    return "non e' un pacchetto Draft";
  }
  if (!VERSIONI_DRAFT_ACCETTATE.includes(dato.versione)) {
    return `versione Draft ${JSON.stringify(dato.versione)} sconosciuta`;
  }
  if (!stringaHex(dato.draft, 32)) return "identificativo Draft non valido";
  if (!stringaHex(dato.mittente, 32)) return "mittente non valido";
  if (!stringaHex(dato.segreto_cancellazione, 64)) {
    return "segreto di cancellazione non valido";
  }
  if ("impronta_arena" in dato && !stringaHex(dato.impronta_arena, 64)) {
    return "collegamento Arena non valido";
  }
  const vietato = contieneCampoVietato(dato);
  if (vietato) return `campo vietato: ${vietato}`;
  if (typeof dato.set !== "string" || !/^[A-Z0-9]{3,6}$/.test(dato.set)) {
    return "set non valido";
  }
  if (!FORMATI.has(dato.formato)) return "formato Draft non valido";
  if (typeof dato.completo !== "boolean") return "completezza non valida";
  if (!Array.isArray(dato.pick) || dato.pick.length > LIMITI_DRAFT.pickMassimi) {
    return "elenco dei pick non valido";
  }
  if (!elencoCarte(dato.pool_finale, LIMITI_DRAFT.pickMassimi)) {
    return "pool finale non valido";
  }
  if ("mazzo_giocato" in dato && dato.mazzo_giocato !== null) {
    const guaio = controllaMazzoGiocato(dato.mazzo_giocato);
    if (guaio) return guaio;
  }

  let numeroPrecedente = null;
  let poolAtteso = null;
  for (const voce of dato.pick) {
    if (!voce || typeof voce !== "object") return "pick non valido";
    if (!interoTra(voce.numero, 1, LIMITI_DRAFT.pickMassimi)) return "numero pick non valido";
    if (numeroPrecedente !== null && voce.numero !== numeroPrecedente + 1) {
      return "sequenza dei pick non continua";
    }
    numeroPrecedente = voce.numero;
    if (!elencoCarte(voce.offerte) || voce.offerte.length === 0) {
      return "carte offerte non valide";
    }
    if (!elencoCarte(voce.pool_prima, LIMITI_DRAFT.pickMassimi)) {
      return "pool prima del pick non valido";
    }
    if (poolAtteso && !stessoPool(voce.pool_prima, poolAtteso)) {
      return "pool e sequenza delle scelte non coincidono";
    }
    if (!voce.offerte.includes(voce.consiglio_mox)) {
      return "il consiglio Mox non e' fra le carte offerte";
    }
    const quante = dato.formato === "PickTwoDraft" ? 2 : 1;
    const consigli = voce.consigli_mox ?? [voce.consiglio_mox];
    if (!elencoCarte(consigli, quante) || consigli.length !== quante ||
        !entroLeCopie(consigli, voce.offerte) ||
        consigli[0] !== voce.consiglio_mox) {
      return "consiglio Mox multiplo non valido";
    }
    if (typeof voce.politica !== "string" || voce.politica.length < 1 ||
        voce.politica.length > 80) return "politica non valida";
    if (!Array.isArray(voce.candidati) || voce.candidati.length === 0 ||
        voce.candidati.length > voce.offerte.length) return "candidati non validi";
    // Un candidato per copia offerta, non uno per carta.
    const copieLibere = copie(voce.offerte);
    const datiPerCarta = new Map();
    const ranghi = new Set();
    for (const candidato of voce.candidati) {
      if (!candidato || !interoTra(candidato.carta, 1, 9_999_999) ||
          !((copieLibere.get(candidato.carta) || 0) >= 1)) {
        return "candidato non offerto o duplicato";
      }
      copieLibere.set(candidato.carta, copieLibere.get(candidato.carta) - 1);
      if (!interoTra(candidato.rango_mox, 1, voce.offerte.length)) {
        return "rango Mox non valido";
      }
      // A121: due copie allo stesso rango rendono `vicina` dipendente
      // dall'ordine dell'array, perche' `salvaUno` consuma le candidate per
      // rango. Il client normale da' ranghi 1..n; il contratto lo impone.
      if (ranghi.has(candidato.rango_mox)) return "rango Mox duplicato";
      ranghi.add(candidato.rango_mox);
      if (!interoTra(candidato.campione, 0, 100_000_000)) return "campione non valido";
      if (candidato.fonte_17lands != null && typeof candidato.fonte_17lands !== "string") {
        return "fonte 17lands non valida";
      }
      if ("valore_17lands" in candidato &&
          (typeof candidato.valore_17lands !== "number" ||
           candidato.valore_17lands < 0 || candidato.valore_17lands > 1)) {
        return "valore 17lands non valido";
      }
      if ("intervallo_95" in candidato &&
          (!Array.isArray(candidato.intervallo_95) || candidato.intervallo_95.length !== 2 ||
           candidato.intervallo_95.some((n) => typeof n !== "number" || n < 0 || n > 1) ||
           candidato.intervallo_95[0] > candidato.intervallo_95[1])) {
        return "intervallo non valido";
      }
      // Dati della carta identici; rango e vicina restano per singola copia.
      const dati = JSON.stringify([candidato.campione, candidato.fonte_17lands ?? null,
        candidato.valore_17lands ?? null, candidato.intervallo_95 ?? null]);
      if (datiPerCarta.has(candidato.carta) && datiPerCarta.get(candidato.carta) !== dati) {
        return "dati discordanti fra copie della stessa carta";
      }
      datiPerCarta.set(candidato.carta, dati);
    }
    if (voce.scelta !== undefined && quante !== 1) return "scelta singola nel formato Prendi Due";
    if (voce.scelte !== undefined && quante !== 2) return "scelte multiple nel formato normale";
    const scelte = voce.scelte ?? (voce.scelta !== undefined ? [voce.scelta] : []);
    if (scelte.length && (!elencoCarte(scelte, quante) || scelte.length !== quante ||
        !entroLeCopie(scelte, voce.offerte))) {
      return "scelta: le carte non sono fra quelle offerte";
    }
    poolAtteso = [...voce.pool_prima];
    if (scelte.length) poolAtteso.push(...scelte);
    else poolAtteso = null;
    if (voce.posizione !== undefined &&
        (!Array.isArray(voce.posizione) || voce.posizione.length !== 2 ||
         !interoTra(voce.posizione[0], 1, 3) || !interoTra(voce.posizione[1], 1, 20))) {
      return "posizione del pick non valida";
    }
  }
  if (dato.completo && poolAtteso && !stessoPool(dato.pool_finale, poolAtteso)) {
    return "pool finale e scelte non coincidono";
  }
  return null;
}

/** Perche' questa traccia non e' un campione buono per la policy, o `null`.
 *
 * Non e' una validazione: il pacchetto resta accettato e conservato. E' una
 * marcatura, perche' il 25/08/2026 il server ha ricevuto un Premier segnato
 * `completo` con nove scelte, sei minuti prima che Arena finisse davvero il
 * Draft. Il server aveva fatto il suo - conserva quello che riceve - ma senza
 * un segno quella riga sarebbe finita nella calibrazione come se fosse un
 * Draft intero.
 *
 * I motivi sono in italiano perche' li legge chi guarda le statistiche.
 */
export function sospettoDraft(dato) {
  const scelte = (dato.pick || []).reduce((totale, voce) => totale +
    (voce.scelte?.length ?? (voce.scelta !== undefined ? 1 : 0)), 0);
  if (!dato.completo) return null;
  const pacchetti = (dato.pick || [])
    .filter((voce) => Array.isArray(voce.posizione))
    .map((voce) => voce.posizione[0]);
  if (pacchetti.length) {
    const ultimo = Math.max(...pacchetti);
    // Arena da' tre pacchetti, ed e' gia' scritto nel controllo delle
    // posizioni qui sopra: un Draft che si dichiara finito senza aver mai
    // visto il terzo non e' finito.
    if (ultimo < 3) return `dichiarato completo al pacchetto ${ultimo}`;
  }
  const pool = (dato.pool_finale || []).length;
  if (pool > scelte) {
    // Legittimo - Mox aperto a meta' Draft non ha visto le prime scelte - ma
    // non e' un campione completo della policy, e non deve sembrarlo.
    return `pool di ${pool} carte con ${scelte} scelte registrate`;
  }
  return null;
}

function fase(numero) {
  if (numero <= 4) return "apertura";
  if (numero <= 17) return "direzione";
  if (numero <= 27) return "struttura";
  return "chiusura";
}

export async function sha256(testo) {
  const bytes = new TextEncoder().encode(testo);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, "0")).join("");
}

function inizioGiorno() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

function inizioMese() {
  const ora = new Date();
  return new Date(Date.UTC(ora.getUTCFullYear(), ora.getUTCMonth(), 1)).toISOString();
}

async function numero(db, sql, ...argomenti) {
  const riga = await db.prepare(sql).bind(...argomenti).first();
  return Number((riga && (riga.n ?? riga.quante)) || 0);
}

async function controllaTetti(db, mittente, byteNuovi, quanti) {
  const giorno = inizioGiorno();
  const mese = inizioMese();
  const perMittente = await numero(db,
    "SELECT COUNT(*) AS n FROM draft WHERE mittente = ? AND ricevuto >= ?", mittente, giorno);
  if (perMittente + quanti > LIMITI_DRAFT.perMittenteGiorno) return "tetto giornaliero del contributore";
  const globali = await numero(db, "SELECT COUNT(*) AS n FROM draft WHERE ricevuto >= ?", giorno);
  if (globali + quanti > LIMITI_DRAFT.globaliGiorno) return "tetto giornaliero globale";
  const oggetti = await numero(db, "SELECT COUNT(*) AS n FROM draft WHERE ricevuto >= ?", mese);
  if (oggetti + quanti > LIMITI_DRAFT.oggettiMese) return "tetto mensile degli oggetti R2";
  if (oggetti + quanti > LIMITI_DRAFT.scrittureMese) return "tetto mensile delle scritture R2";
  const byte = await numero(db, "SELECT COALESCE(SUM(byte), 0) AS n FROM draft");
  if (byte + byteNuovi > LIMITI_DRAFT.byteConservati) return "tetto di spazio R2";
  return null;
}

// Un salvataggio fermato da un guasto del momento, di D1 o di R2: il client
// deve ritentarlo e sul server non resta niente di indicizzato a meta'.
// `fase` dice dove si e' fermato, ed e' la prima cosa che serve nel log: fino
// al 04/10/2026 i 500 sui Draft registravano soltanto la pila di D1, senza il
// messaggio, e la causa non si poteva ricostruire (P1).
class GuastoTemporaneo extends Error {
  constructor(fase, causa) {
    super(`guasto temporaneo in ${fase}`);
    this.name = "GuastoTemporaneo";
    this.fase = fase;
    this.causa = causa;
  }
}

async function passo(fase, lavoro) {
  try {
    return await lavoro();
  } catch (guasto) {
    if (guasto instanceof GuastoTemporaneo) throw guasto;
    throw new GuastoTemporaneo(fase, guasto);
  }
}

// Tipo e messaggio di un guasto, mai il pacchetto: il messaggio di D1 dice il
// vincolo o il limite violato, non i valori.
function descriviGuasto(guasto) {
  return {
    tipo: String(guasto?.name || typeof guasto).slice(0, 60),
    messaggio: String(guasto?.message ?? guasto).slice(0, 300),
  };
}

// JSON con le chiavi in ordine: due client possono serializzare lo stesso
// Draft con le chiavi in un ordine diverso, e non e' un Draft diverso.
function canonico(valore) {
  if (Array.isArray(valore)) return `[${valore.map(canonico).join(",")}]`;
  if (valore && typeof valore === "object") {
    return `{${Object.keys(valore).sort()
      .map((chiave) => `${JSON.stringify(chiave)}:${canonico(valore[chiave])}`)
      .join(",")}}`;
  }
  return JSON.stringify(valore ?? null);
}

// La storia di un Draft sono i suoi fatti: chi, cosa, quando, che cosa e'
// stato offerto e scelto, e il pool. Non ci sono la versione di Mox, l'ora di
// chiusura o il mazzo montato (che cresce dopo il Draft, P2). I fatti dei
// consigli gia' persistiti restano immutabili; campi futuri aggiuntivi nei
// candidati non trasformano il reinvio col mazzo in un conflitto.
function storiaDraft(dato) {
  return canonico({
    versione: dato.versione, draft: dato.draft, mittente: dato.mittente,
    set: dato.set, formato: dato.formato, iniziato: dato.iniziato ?? null,
    completo: dato.completo, impronta_arena: dato.impronta_arena ?? null,
    pool_finale: dato.pool_finale,
    pick: (Array.isArray(dato.pick) ? dato.pick : []).map((voce) => ({
      numero: voce.numero, offerte: voce.offerte, pool_prima: voce.pool_prima,
      scelte: voce.scelte ?? (voce.scelta !== undefined ? [voce.scelta] : []),
      posizione: voce.posizione ?? null,
      consigli: voce.consigli_mox ?? [voce.consiglio_mox],
      politica: voce.politica,
      candidati: [...(voce.candidati || [])].sort((a, b) => a.rango_mox - b.rango_mox)
        .map((c) => ({ carta: c.carta, rango_mox: c.rango_mox,
          campione: c.campione, vicina: Boolean(c.vicina),
          fonte_17lands: c.fonte_17lands ?? null,
          valore_17lands: c.valore_17lands ?? null,
          intervallo_95: c.intervallo_95 ?? null })),
    })),
  });
}

function numeroPick(dato) {
  return dato.pick.reduce((totale, voce) => totale +
    (voce.scelte?.length ?? (voce.scelta !== undefined ? 1 : 0)), 0);
}

// Le versioni del mazzo come le scrive `draft_mazzo`: e' la forma in cui si
// confrontano quelle gia' registrate con quelle appena arrivate.
function versioniMazzo(dato) {
  return (Array.isArray(dato.mazzo_giocato) ? dato.mazzo_giocato : []).map((versione) => ({
    quando: versione.quando ?? null,
    lista: JSON.stringify(versione.mazzo),
    riserva: versione.riserva ? JSON.stringify(versione.riserva) : null,
  }));
}

function stessaVersione(a, b) {
  return a.quando === b.quando && a.lista === b.lista && a.riserva === b.riserva;
}

// Il mazzo davvero montato, versione per versione. Sette campi per riga: otto
// righe per statement stanno dentro i 100 parametri di D1 Free, e trenta
// versioni al massimo fanno quattro statement.
function comandiMazzo(db, draftId, versioni, gia, atteso = null) {
  const comandi = [];
  for (let i = 0; i < versioni.length; i += 8) {
    const blocco = versioni.slice(i, i + 8);
    const argomenti = [];
    for (let scarto = 0; scarto < blocco.length; scarto += 1) {
      const versione = blocco[scarto];
      const mazzo = JSON.parse(versione.lista);
      const carte = mazzo.reduce((totale, [, quante]) => totale + quante, 0);
      argomenti.push(
        draftId, gia + i + scarto + 1, versione.quando, carte,
        mazzo.length, versione.lista, versione.riserva,
      );
      if (atteso !== null) argomenti.push(draftId, atteso);
    }
    const valori = blocco.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");
    const selezioni = blocco.map(() => `SELECT ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM draft WHERE id = ? AND oggetto_r2 = ?)`)
      .join(" UNION ALL ");
    comandi.push(db.prepare(`INSERT INTO draft_mazzo
      (draft_id, versione, quando, carte, distinte, lista, riserva)
      ${atteso === null ? `VALUES ${valori}` : selezioni}`).bind(...argomenti));
  }
  return comandi;
}

/** Un oggetto immutabile di proprieta' di questo solo tentativo.
 *
 * Fino al 04/10/2026 la chiave era `mese/draft.json`. Un batch D1 fallito
 * cancellava l'oggetto per compensazione: se un'altra richiesta dello stesso
 * Draft l'aveva gia' indicizzato, si cancellava l'oggetto vivo; se la
 * cancellazione falliva, restava un orfano. Il 02 e il 03/10 l'orfano c'era
 * (D1 41 righe, R2 42 oggetti) ed e' quello che ha reso «incompleta» la
 * manutenzione notturna (P5). La review ha riprodotto una race anche con le
 * chiavi per contenuto: adesso ogni tentativo ha una chiave propria, mai
 * riutilizzata da un concorrente. Il puntatore vivo e' `draft.oggetto_r2`.
 */
async function preparaOggetto(dato, ricevuto) {
  const pulito = structuredClone(dato);
  delete pulito.segreto_cancellazione;
  const grezzo = JSON.stringify(pulito);
  // Due richieste identiche non condividono l'oggetto da compensare: D1 e
  // R2 non offrono un delete condizionato atomico fra i due servizi.
  const impronta = (await sha256(grezzo + "\0" + crypto.randomUUID())).slice(0, 16);
  return {
    grezzo,
    byte: new TextEncoder().encode(grezzo).byteLength,
    chiave: `${ricevuto.slice(0, 7)}/${dato.draft}-${impronta}.json`,
  };
}

async function scriviOggetto(r2, oggetto) {
  await passo("r2_scrittura", () => r2.put(oggetto.chiave, oggetto.grezzo,
    { httpMetadata: { contentType: "application/json" } }));
}

/** Toglie un oggetto R2 che non e' (o non e' piu') quello indicizzato.
 *
 * Un secondo tentativo, poi un log che dice quale chiave e' rimasta: il
 * controllo giornaliero la conta e `riconciliaStorageDraft` la elenca.
 */
async function togliOggetto(r2, chiave, contesto) {
  let ultimo = null;
  for (let giro = 0; giro < 2; giro += 1) {
    try {
      await r2.delete(chiave);
      return true;
    } catch (guasto) {
      ultimo = guasto;
    }
  }
  console.error(JSON.stringify({ evento: "draft_oggetto_orfano", ...contesto,
    oggetto_r2: chiave, ...descriviGuasto(ultimo) }));
  return false;
}

// Rilegge la riga dopo un batch fallito. `undefined` vuol dire «non lo so»:
// allora non si cancella niente, perche' l'oggetto potrebbe essere vivo.
async function rileggiRiga(db, id) {
  try {
    return await db.prepare("SELECT ricevuto, oggetto_r2 FROM draft WHERE id = ?")
      .bind(id).first();
  } catch {
    return undefined;
  }
}

/** Salva un Draft e dice com'e' andata: `{ esito, motivo? }`.
 *
 * `nuovo`, `gia`, `aggiornato` e `rifiutato` sono definitivi; un guasto del
 * momento esce come `GuastoTemporaneo`. D1 e R2 non hanno una transazione in
 * comune: l'oggetto R2 si scrive prima, il batch D1 lo rende vivo, e dopo un
 * batch fallito si rilegge D1 prima di decidere se togliere l'oggetto.
 */
async function salvaUno(db, r2, dato, ricevuto, giro = 0) {
  const segretoHash = await sha256(dato.segreto_cancellazione);
  const [riga, contributore] = await passo("lettura", () => Promise.all([
    db.prepare(`SELECT id, mittente, ricevuto, set_code, formato, completo, pick,
      versione, iniziato, byte, oggetto_r2 FROM draft WHERE id = ?`).bind(dato.draft).first(),
    db.prepare("SELECT cancellazione_hash FROM contributori WHERE mittente = ?")
      .bind(dato.mittente).first(),
  ]));
  if (contributore && contributore.cancellazione_hash !== segretoHash) {
    return { esito: "rifiutato", motivo: "segreto del contributore non coerente" };
  }
  if (riga) return aggiornaEsistente(db, r2, dato, riga, ricevuto, giro);
  return inserisciNuovo(db, r2, dato, ricevuto, segretoHash, giro);
}

function pickIndicizzati(dato) {
  const righe = [];
  for (const voce of dato.pick) {
    const scelte = voce.scelte ?? (voce.scelta !== undefined ? [voce.scelta] : []);
    const consigli = voce.consigli_mox ?? [voce.consiglio_mox];
    const abbinate = abbinaScelte(scelte, consigli);
    // Una candidata per copia: stessa convenzione dell'inserimento originale.
    const liberi = [...voce.candidati].sort((a, b) => a.rango_mox - b.rango_mox);
    for (let indice = 0; indice < scelte.length; indice += 1) {
      const { seguito, consiglio } = abbinate[indice];
      const posto = liberi.findIndex((c) => c.carta === scelte[indice]);
      const candidato = posto < 0 ? null : liberi.splice(posto, 1)[0];
      const numero = voce.pool_prima.length + indice + 1;
      righe.push({ numero, fase: fase(numero), consiglio, scelta: scelte[indice],
        seguito: seguito ? 1 : 0, vicina: candidato?.vicina ? 1 : 0,
        campione: Number(candidato?.campione || 0),
        fonte: candidato?.fonte_17lands ?? null, politica: voce.politica });
    }
  }
  return righe.sort((a, b) => a.numero - b.numero);
}

async function inserisciNuovo(db, r2, dato, ricevuto, segretoHash, giro) {
  const impronta = dato.impronta_arena ?? null;
  const oggetto = await preparaOggetto(dato, ricevuto);
  // Il preflight del blocco non riserva spazio: un append precedente o due
  // voci dello stesso ID possono avere cambiato i byte davvero da salvare.
  if (await numero(db, "SELECT COALESCE(SUM(byte), 0) AS n FROM draft") +
      oggetto.byte > LIMITI_DRAFT.byteConservati) {
    throw new GuastoTemporaneo("quota", new Error("tetto di spazio R2"));
  }
  await scriviOggetto(r2, oggetto);
  const politica = dato.pick[0] ? dato.pick[0].politica : "nessuna";
  const sospetto = sospettoDraft(dato);
  const comandi = [
    db.prepare(`INSERT OR IGNORE INTO contributori
      (mittente, cancellazione_hash, creato) VALUES (?, ?, ?)`).bind(
        dato.mittente, segretoHash, ricevuto),
    ...(impronta ? [
      db.prepare(`UPDATE draft SET impronta_arena = 'ambigua:' || ? || ':' || id
        WHERE impronta_arena = ?`).bind(impronta, impronta),
      db.prepare(`DELETE FROM draft_link WHERE draft_id IN
        (SELECT id FROM draft WHERE substr(impronta_arena, 1, 73) = ?)`)
        .bind(`ambigua:${impronta}:`),
    ] : []),
    db.prepare(`INSERT INTO draft
      (id, mittente, ricevuto, iniziato, set_code, formato, completo, pick,
       politica, mox, impronta_arena, oggetto_r2, byte, versione, sospetto)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ${impronta ? `CASE WHEN EXISTS (SELECT 1 FROM draft WHERE substr(impronta_arena, 1, 73) = ?)
          THEN ? ELSE ? END` : "?"}, ?, ?, ?, ?)`).bind(
        dato.draft, dato.mittente, ricevuto, dato.iniziato ?? null, dato.set,
        dato.formato, dato.completo ? 1 : 0, numeroPick(dato), politica,
        String(dato.mox || "").slice(0, 40),
        ...(impronta ? [`ambigua:${impronta}:`, `ambigua:${impronta}:${dato.draft}`, impronta] : [null]),
        oggetto.chiave, oggetto.byte, dato.versione, sospetto),
  ];
  const pickScelti = pickIndicizzati(dato);
  // D1 Free consente 50 query per invocazione e 100 parametri per query.
  // Dieci pick da dieci campi riempiono esattamente un solo statement.
  for (let i = 0; i < pickScelti.length; i += 10) {
    const blocco = pickScelti.slice(i, i + 10);
    const argomenti = [];
    for (const elemento of blocco) {
      const { numero, fase: fasePick, consiglio, scelta, seguito, vicina,
        campione, fonte, politica } = elemento;
      argomenti.push(dato.draft, numero, fasePick, consiglio, scelta, seguito,
        vicina, campione, fonte, politica);
    }
    const valori = blocco.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    comandi.push(db.prepare(`INSERT INTO draft_pick
      (draft_id, numero, fase, consiglio, scelta, seguito, vicina, campione,
       fonte, politica) VALUES ${valori}`).bind(...argomenti));
  }
  comandi.push(...comandiMazzo(db, dato.draft, versioniMazzo(dato), 0));
  try {
    await db.batch(comandi);
  } catch (guasto) {
    const dopo = await rileggiRiga(db, dato.draft);
    if (dopo === undefined) throw new GuastoTemporaneo("d1_batch", guasto);
    // Stesso contenuto gia' vivo: o il nostro batch e' passato e si e' persa
    // la risposta, o un'altra richiesta identica e' arrivata prima.
    if (dopo && dopo.oggetto_r2 === oggetto.chiave) {
      return { esito: dopo.ricevuto === ricevuto ? "nuovo" : "gia" };
    }
    await togliOggetto(r2, oggetto.chiave, { draft: dato.draft, fase: "d1_batch" });
    // Un'altra richiesta ha salvato lo stesso Draft con un contenuto diverso:
    // questo invio diventa un aggiornamento, una volta sola.
    if (dopo && giro === 0) return salvaUno(db, r2, dato, ricevuto, giro + 1);
    throw new GuastoTemporaneo("d1_batch", guasto);
  }
  return { esito: "nuovo" };
}

function stessaRiga(riga, dato) {
  return riga.set_code === dato.set && riga.formato === dato.formato &&
    Boolean(riga.completo) === dato.completo && riga.versione === dato.versione &&
    Number(riga.pick) === numeroPick(dato);
}

/** Lo stesso Draft arrivato di nuovo: no-op, mazzo nuovo o conflitto (P2).
 *
 * Mox spedisce la traccia all'ultima scelta, prima che il mazzo esista; il
 * mazzo arriva dopo, e fino al 04/10/2026 ogni invio successivo era scartato
 * come «gia' presente»: nessuno dei Draft 2.11.x aveva il mazzo sul server.
 * Adesso le versioni del mazzo crescono, e solo loro: pick, pool e
 * identificativi devono essere gli stessi, una versione gia' registrata non
 * cambia e un invio piu' vecchio non toglie niente. Il conflitto vero si
 * rifiuta con il suo motivo, invece di vincere l'ultimo che scrive.
 */
async function aggiornaEsistente(db, r2, dato, riga, ricevuto, giro) {
  const conflitto = (motivo) => {
    console.warn(JSON.stringify({ evento: "draft_conflitto", draft: dato.draft, motivo }));
    return { esito: "rifiutato", motivo };
  };
  if (riga.mittente !== dato.mittente) {
    return conflitto("Draft gia' presente con contenuto diverso");
  }
  const noti = ((await passo("lettura", () => db.prepare(`SELECT versione, quando, carte, distinte, lista, riserva
    FROM draft_mazzo WHERE draft_id = ? ORDER BY versione`).bind(dato.draft).all()))
    .results || []).map((v) => ({ ...v, quando: v.quando ?? null,
      riserva: v.riserva ?? null }));
  const letto = await passo("r2_lettura", async () => {
    const trovato = await r2.get(riga.oggetto_r2);
    return trovato ? trovato.text() : null;
  });
  let registrato = null;
  try { registrato = letto === null ? null : JSON.parse(letto); } catch { registrato = null; }
  // L'indice non conserva offerte e pool completi: senza raw non si puo'
  // certificare la storia. Un guasto di archivio non e' un rifiuto definitivo.
  if (!registrato || controllaDraft({ ...registrato,
      segreto_cancellazione: dato.segreto_cancellazione }) ||
      registrato.draft !== riga.id || registrato.mittente !== riga.mittente ||
      !stessaRiga(riga, registrato) ||
      (riga.iniziato ?? null) !== (registrato.iniziato ?? null)) {
    throw new GuastoTemporaneo("r2_integrita", new Error("storia Draft non verificabile"));
  }
  // Un raw valido in forma puo' comunque descrivere scelte diverse dai
  // fatti gia' indicizzati. Non autorizza append o repair in quel caso.
  const pickNoti = (await passo("lettura", () => db.prepare(`SELECT numero, fase,
    consiglio, scelta, seguito, vicina, campione, fonte, politica
    FROM draft_pick WHERE draft_id = ? ORDER BY numero`).bind(dato.draft).all()))
    .results || [];
  if (canonico(pickNoti) !== canonico(pickIndicizzati(registrato))) {
    throw new GuastoTemporaneo("r2_integrita", new Error("storia raw e fatti D1 discordanti"));
  }
  if (storiaDraft(registrato) !== storiaDraft(dato)) {
    return conflitto("Draft gia' presente con contenuto diverso");
  }

  const arrivate = versioniMazzo(dato);
  const vive = versioniMazzo(registrato);
  if (noti.some((v) => !Number.isInteger(v.versione) || v.versione < 1 ||
      v.versione > vive.length || !stessaVersione(v, vive[v.versione - 1]))) {
    throw new GuastoTemporaneo("d1_integrita", new Error("versioni D1 non verificabili dal raw"));
  }
  const comune = Math.min(vive.length, arrivate.length);
  for (let i = 0; i < comune; i += 1) {
    if (!stessaVersione(vive[i], arrivate[i])) {
      return conflitto("Draft gia' presente con un mazzo giocato diverso");
    }
  }
  const nuove = arrivate.slice(vive.length);
  const indiceCoerente = noti.length === vive.length && noti.every((v, i) => {
    const carte = JSON.parse(vive[i].lista);
    return v.versione === i + 1 && stessaVersione(v, vive[i]) &&
      v.carte === carte.reduce((n, [, q]) => n + q, 0) && v.distinte === carte.length;
  });
  if (!nuove.length && indiceCoerente) return { esito: "gia" };
  // Solo il mazzo puo' crescere. Il raw mantiene i fatti gia' approvati.
  const aggiornato = structuredClone(registrato);
  if (nuove.length) aggiornato.mazzo_giocato = structuredClone(dato.mazzo_giocato);
  const versioni = versioniMazzo(aggiornato);
  const oggetto = nuove.length ? await preparaOggetto(aggiornato, ricevuto)
    : { chiave: riga.oggetto_r2, byte: new TextEncoder().encode(letto).byteLength };
  const stessoOggetto = oggetto.chiave === riga.oggetto_r2;
  const crescita = Math.max(0, oggetto.byte - Number(riga.byte));
  if (crescita && await numero(db, "SELECT COALESCE(SUM(byte), 0) AS n FROM draft") +
      crescita > LIMITI_DRAFT.byteConservati) {
    throw new GuastoTemporaneo("quota", new Error("tetto di spazio R2"));
  }
  if (!stessoOggetto) await scriviOggetto(r2, oggetto);
  try {
    const esiti = await db.batch([
      db.prepare(`DELETE FROM draft_mazzo WHERE draft_id = ? AND EXISTS
        (SELECT 1 FROM draft WHERE id = ? AND oggetto_r2 = ?)`)
        .bind(dato.draft, dato.draft, riga.oggetto_r2),
      ...comandiMazzo(db, dato.draft, versioni, 0, riga.oggetto_r2),
      db.prepare("UPDATE draft SET oggetto_r2 = ?, byte = ? WHERE id = ? AND oggetto_r2 = ?")
        .bind(oggetto.chiave, oggetto.byte, dato.draft, riga.oggetto_r2),
    ]);
    if (Number(esiti.at(-1)?.meta?.changes) !== 1) {
      throw new Error("puntatore Draft cambiato durante l'aggiornamento");
    }
  } catch (guasto) {
    if (stessoOggetto) throw new GuastoTemporaneo("d1_batch", guasto);
    const dopo = await rileggiRiga(db, dato.draft);
    if (dopo === undefined) throw new GuastoTemporaneo("d1_batch", guasto);
    if (!(dopo && dopo.oggetto_r2 === oggetto.chiave)) {
      await togliOggetto(r2, oggetto.chiave, { draft: dato.draft, fase: "d1_batch" });
      // Un altro aggiornamento e' passato nel frattempo: si rivaluta una
      // volta contro il suo stato, che puo' rendere questo invio un no-op.
      if (dopo && dopo.oggetto_r2 !== riga.oggetto_r2 && giro === 0) {
        return salvaUno(db, r2, dato, ricevuto, giro + 1);
      }
      throw new GuastoTemporaneo("d1_batch", guasto);
    }
  }
  if (!stessoOggetto) {
    await togliOggetto(r2, riga.oggetto_r2, { draft: dato.draft, fase: "r2_pulizia" });
  }
  return { esito: "aggiornato" };
}

// Controllo amministrativo, intenzionalmente non collegato a una rotta HTTP.
// Confronta l'indice D1 con gli oggetti realmente presenti nel bucket privato
// e permette di riparare offline i rarissimi guasti doppi (batch D1 fallito e
// cancellazione compensativa R2 fallita) senza esporre i JSON grezzi al sito.
export async function riconciliaStorageDraft(db, r2) {
  const esito = await db.prepare(
    "SELECT id, oggetto_r2, byte FROM draft ORDER BY oggetto_r2"
  ).all();
  const righe = esito.results || [];
  const indice = new Map(righe.map((riga) => [riga.oggetto_r2, riga]));
  const oggetti = new Map();
  let cursore;
  do {
    const pagina = await r2.list({ limit: 1000, ...(cursore ? { cursor: cursore } : {}) });
    for (const oggetto of pagina.objects || []) {
      oggetti.set(oggetto.key, Number(oggetto.size));
    }
    cursore = pagina.truncated ? pagina.cursor : undefined;
  } while (cursore);

  const senzaOggetto = righe
    .filter((riga) => !oggetti.has(riga.oggetto_r2))
    .map((riga) => ({ draft: riga.id, oggetto_r2: riga.oggetto_r2,
      byte_attesi: Number(riga.byte) }));
  const orfaniR2 = [...oggetti.keys()]
    .filter((chiave) => !indice.has(chiave)).sort();
  const dimensioniIncoerenti = righe
    .filter((riga) => oggetti.has(riga.oggetto_r2)
      && oggetti.get(riga.oggetto_r2) !== Number(riga.byte))
    .map((riga) => ({ draft: riga.id, oggetto_r2: riga.oggetto_r2,
      byte_attesi: Number(riga.byte), byte_r2: oggetti.get(riga.oggetto_r2) }));
  return {
    righe_d1: righe.length,
    oggetti_r2: oggetti.size,
    senza_oggetto: senzaOggetto,
    orfani_r2: orfaniR2,
    dimensioni_incoerenti: dimensioniIncoerenti,
    coerente: !senzaOggetto.length && !orfaniR2.length && !dimensioniIncoerenti.length,
  };
}

export async function riceviDraft(richiesta, ambiente, risposta) {
  const lunghezza = Number(richiesta.headers.get("content-length") || 0);
  if (lunghezza > LIMITI_DRAFT.byteRichiesta) return risposta({ errore: "richiesta troppo grande" }, 413);
  let corpo;
  try { corpo = await richiesta.json(); } catch { return risposta({ errore: "corpo non leggibile" }, 400); }
  const arrivate = Array.isArray(corpo?.draft) ? corpo.draft : Array.isArray(corpo) ? corpo : [corpo];
  if (!arrivate.length || arrivate.length > LIMITI_DRAFT.perRichiesta) {
    return risposta({ errore: "numero di Draft non valido" }, 413);
  }
  // Un esito per ogni Draft arrivato, nello stesso ordine (P1). Fino al
  // 04/10/2026 un guasto al quarto Draft di un blocco rispondeva 500 per tutta
  // la richiesta, con i primi tre gia' salvati: il client non poteva sapere
  // quali togliere dalla coda e li rispediva tutti.
  const esiti = arrivate.map((dato, indice) => ({
    indice,
    draft: typeof dato?.draft === "string" ? dato.draft.slice(0, 32) : null,
  }));
  const buoni = [];
  const rifiutati = [];
  arrivate.forEach((dato, indice) => {
    const motivo = controllaDraft(dato);
    if (motivo) {
      rifiutati.push({ draft: dato?.draft, motivo });
      Object.assign(esiti[indice], { esito: "rifiutato", motivo });
    } else buoni.push(indice);
  });
  if (!buoni.length) {
    return risposta({ accettati: 0, gia_presenti: 0, aggiornati: 0, rifiutati, esiti }, 400);
  }
  const mittente = arrivate[buoni[0]].mittente;
  if (buoni.some((i) => arrivate[i].mittente !== mittente)) return risposta({ errore: "una richiesta, un mittente solo" }, 400);
  const distinti = [...new Map(buoni.map((i) => [arrivate[i].draft, arrivate[i]])).values()];
  const presenti = await ambiente.DRAFT_DB.prepare(`SELECT id FROM draft WHERE id IN
    (${distinti.map(() => "?").join(",")})`).bind(...distinti.map((d) => d.draft)).all();
  const noti = new Set((presenti.results || []).map((d) => d.id));
  const nuovi = distinti.filter((d) => !noti.has(d.draft));
  const byte = nuovi.reduce((n, d) => {
    const pulito = structuredClone(d); delete pulito.segreto_cancellazione;
    return n + new TextEncoder().encode(JSON.stringify(pulito)).byteLength;
  }, 0);
  const tetto = nuovi.length ? await controllaTetti(ambiente.DRAFT_DB, mittente, byte, nuovi.length) : null;
  if (tetto) return risposta({ errore: tetto, rimanda: buoni.map((i) => arrivate[i].draft) }, 429);
  const conti = { nuovo: 0, gia: 0, aggiornato: 0, rifiutato: 0, temporaneo: 0 };
  const ricevuto = new Date().toISOString();
  for (const indice of buoni) {
    const dato = arrivate[indice];
    try {
      const esito = await salvaUno(ambiente.DRAFT_DB, ambiente.DRAFT_RAW, dato, ricevuto);
      Object.assign(esiti[indice], esito);
      if (esito.esito === "rifiutato") rifiutati.push({ draft: dato.draft, motivo: esito.motivo });
    } catch (guasto) {
      // Qualunque guasto qui e' da ritentare: il Draft non e' stato reso
      // vivo, e un ritento identico e' idempotente.
      const temporaneo = guasto instanceof GuastoTemporaneo ? guasto
        : new GuastoTemporaneo("sconosciuta", guasto);
      esiti[indice].esito = "temporaneo";
      console.error(JSON.stringify({ evento: "draft_salvataggio_fallito",
        fase: temporaneo.fase, ...descriviGuasto(temporaneo.causa),
        draft: dato.draft, indice, totale: arrivate.length }));
    }
  }
  for (const esito of esiti) if (esito.esito) conti[esito.esito] += 1;
  const daRitentare = esiti.filter((e) => e.esito === "temporaneo").map((e) => e.draft);
  console.log(JSON.stringify({ evento: "draft_ricevuti", totale: arrivate.length, ...conti }));
  // 503, non 200, se qualcosa va ritentato: un client di prima del 04/10
  // toglie dalla coda tutto il blocco a ogni 200, e perderebbe il Draft
  // rimasto indietro. Con 503 lo tiene, e al ritento gli altri sono «gia'».
  return risposta({
    accettati: conti.nuovo,
    gia_presenti: conti.gia,
    aggiornati: conti.aggiornato,
    rifiutati,
    esiti,
    da_ritentare: daRitentare,
  }, daRitentare.length ? 503 : 200);
}

export async function recuperaDraft(richiesta, ambiente, risposta) {
  const lunghezza = Number(richiesta.headers.get("content-length") || 0);
  if (lunghezza > 4096) return risposta({ errore: "richiesta troppo grande" }, 413);
  let corpo;
  try { corpo = await richiesta.json(); } catch {
    return risposta({ errore: "corpo non leggibile" }, 400);
  }
  const set = typeof corpo?.set === "string" ? corpo.set.toUpperCase() : "";
  const formato = corpo?.formato;
  if (!stringaHex(corpo?.mittente, 32) || !stringaHex(corpo?.segreto, 64) ||
      !/^[A-Z0-9]{3,6}$/.test(set) || !FORMATI.has(formato) ||
      !elencoQuantita(corpo?.mazzo) || corpo.mazzo.length === 0 ||
      !elencoQuantita(corpo?.riserva ?? [])) {
    return risposta({ errore: "richiesta di recupero non valida" }, 400);
  }

  // Il client chiede una sola volta per apertura, ma il costo va protetto sul
  // server: una chiave distinta per mittente evita interferenze coi ticket e
  // ferma la richiesta prima della query D1 e delle letture R2.
  if (ambiente.TICKET_RATE_LIMITER) {
    const limite = await ambiente.TICKET_RATE_LIMITER.limit({
      key: `draft-recupera:${corpo.mittente}`,
    });
    if (!limite?.success) {
      return risposta({ errore: "troppe richieste di recupero; riprova fra poco" }, 429);
    }
  }

  const contributore = await ambiente.DRAFT_DB.prepare(
    "SELECT cancellazione_hash FROM contributori WHERE mittente = ?"
  ).bind(corpo.mittente).first();
  const hash = await sha256(corpo.segreto);
  if (!contributore || contributore.cancellazione_hash !== hash) {
    return risposta({ errore: "segreto non riconosciuto" }, 403);
  }

  // Set e formato sono obbligatori: se il log sa soltanto che c'e' un evento
  // Draft, non deve mai ricevere per errore il pool di un evento differente.
  // Si provano piu' righe per tollerare un oggetto R2 mancante o corrotto senza
  // trasformare un guasto di archivio in una schermata vuota sul client.
  const lista = JSON.stringify(corpo.mazzo);
  const riserva = JSON.stringify(corpo.riserva ?? []);
  const esito = await ambiente.DRAFT_DB.prepare(`SELECT id, iniziato,
      set_code, formato, completo, oggetto_r2
    FROM draft WHERE mittente = ? AND set_code = ? AND formato = ?
      AND EXISTS (SELECT 1 FROM draft_mazzo m WHERE m.draft_id = draft.id
        AND m.lista = ? AND COALESCE(m.riserva, '[]') = ?)
    ORDER BY ricevuto DESC LIMIT 10`).bind(
      corpo.mittente, set, formato, lista, riserva).all();
  for (const riga of esito.results || []) {
    const oggetto = await ambiente.DRAFT_RAW.get(riga.oggetto_r2);
    if (!oggetto) continue;
    let grezzo;
    try { grezzo = JSON.parse(await oggetto.text()); } catch { continue; }
    if (!grezzo || grezzo.draft !== riga.id || grezzo.mittente !== corpo.mittente ||
        grezzo.set !== set || grezzo.formato !== formato ||
        !elencoCarte(grezzo.pool_finale, LIMITI_DRAFT.pickMassimi) ||
        grezzo.pool_finale.length === 0) continue;

    let mazzoGiocato = null;
    const versioni = grezzo.mazzo_giocato;
    if (Array.isArray(versioni) && versioni.length) {
      const ultimo = versioni[versioni.length - 1];
      if (!controllaMazzoGiocato([ultimo])) mazzoGiocato = ultimo;
    }
    return risposta({
      versione: 1,
      recupero: {
        set,
        formato,
        completo: Boolean(riga.completo),
        iniziato: typeof riga.iniziato === "string" ? riga.iniziato : null,
        pool_finale: grezzo.pool_finale,
        mazzo_giocato: mazzoGiocato,
      },
    });
  }
  return risposta({ versione: 1, recupero: null });
}

function wilson(successi, n) {
  if (!n) return null;
  const z = 1.959963984540054;
  const p = successi / n;
  const d = 1 + z * z / n;
  const centro = (p + z * z / (2 * n)) / d;
  const raggio = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [Math.max(0, centro - raggio), Math.min(1, centro + raggio)];
}

export async function statisticheDraft(db, indirizzo) {
  const set = indirizzo.searchParams.get("set");
  const formato = indirizzo.searchParams.get("formato");
  const periodo = indirizzo.searchParams.get("periodo") || "30";
  if (!["7", "14", "30", "totale"].includes(periodo)) {
    return { errore: "periodo Draft non valido", stato: 400 };
  }
  const condizioni = [];
  const argomenti = [];
  if (set) { condizioni.push("d.set_code = ?"); argomenti.push(set.toUpperCase()); }
  if (formato) { condizioni.push("d.formato = ?"); argomenti.push(formato); }
  if (periodo !== "totale") {
    condizioni.push("d.ricevuto >= ?");
    argomenti.push(new Date(Date.now() - Number(periodo) * 86400000).toISOString());
  }
  // L'endpoint e' pubblico: entrano solo tracce affidabili. Politiche,
  // marcature, confronti interni e versioni del mazzo restano strumenti di
  // sviluppo e non vengono serializzati nella risposta.
  condizioni.push("d.sospetto IS NULL");
  const dove = `WHERE ${condizioni.join(" AND ")}`;
  const totali = await db.prepare(`SELECT COUNT(*) AS draft,
      COALESCE(SUM(d.pick), 0) AS pick, MAX(d.ricevuto) AS aggiornato
    FROM draft d ${dove}`).bind(...argomenti).first();
  const gruppi = await db.prepare(`SELECT d.set_code AS set_code,
      d.formato AS formato, COUNT(*) AS draft, COALESCE(SUM(d.pick), 0) AS pick,
      MAX(d.ricevuto) AS aggiornato
    FROM draft d ${dove}
    GROUP BY d.set_code, d.formato
    ORDER BY draft DESC, d.set_code ASC, d.formato ASC`).bind(...argomenti).all();
  const collegati = await db.prepare(`SELECT COUNT(*) AS partite,
      SUM(CASE WHEN l.esito = 'vinta' THEN 1 ELSE 0 END) AS vittorie
    FROM draft_link l JOIN draft d ON d.id = l.draft_id ${dove}`).bind(...argomenti).first();
  const partite = Number(collegati?.partite || 0);
  const vittorie = Number(collegati?.vittorie || 0);
  return {
    versione: 2,
    filtri: { set, formato, periodo },
    totali: {
      draft: Number(totali?.draft || 0),
      pick: Number(totali?.pick || 0),
      aggiornato: totali?.aggiornato || null,
    },
    eventi: (gruppi.results || []).map((riga) => ({
      set: riga.set_code,
      formato: riga.formato,
      draft: Number(riga.draft || 0),
      pick: Number(riga.pick || 0),
      aggiornato: riga.aggiornato || null,
    })),
    risultati: { campione: partite, win_rate: partite >= 30 ? vittorie / partite : null,
      intervallo_95: partite >= 30 ? wilson(vittorie, partite) : null },
    approfondimenti: { colori: [], carte: [], disponibili: false },
    aggiornato: new Date().toISOString(),
  };
}

export async function eliminaContributi(richiesta, ambiente, risposta) {
  let corpo;
  try { corpo = await richiesta.json(); } catch { return risposta({ errore: "corpo non leggibile" }, 400); }
  if (!stringaHex(corpo?.mittente, 32) || !stringaHex(corpo?.segreto, 64)) {
    return risposta({ errore: "credenziali di cancellazione non valide" }, 400);
  }
  const contributoreDraft = ambiente.DRAFT_DB ? await ambiente.DRAFT_DB.prepare(
    "SELECT cancellazione_hash FROM contributori WHERE mittente = ?"
  ).bind(corpo.mittente).first() : null;
  const contributorePartite = ambiente.DB ? await ambiente.DB.prepare(
    "SELECT cancellazione_hash FROM contributori WHERE mittente = ?"
  ).bind(corpo.mittente).first() : null;
  const hash = await sha256(corpo.segreto);
  const registrati = [contributoreDraft, contributorePartite].filter(Boolean);
  if (!registrati.length || registrati.some((c) => c.cancellazione_hash !== hash)) {
    return risposta({ errore: "segreto non riconosciuto" }, 403);
  }
  // Research prima del legacy: se la lineage non si chiude del tutto le
  // credenziali legacy restano e la stessa richiesta si puo' ripetere.
  const research = await eliminaResearchMittente(ambiente, corpo.mittente);
  if (research.stato !== "deleted") {
    return risposta({ errore: "cancellazione_research_in_corso", retryable: true }, 409);
  }
  // La forma della risposta legacy resta quella di prima; il conteggio
  // Research compare solo quando c'era qualcosa da cancellare.
  return risposta({ eliminati: { ...await eliminaMittente(ambiente, corpo.mittente),
    ...(research.eliminate ? { research: research.eliminate } : {}) } });
}

// Usata dall'account solo dopo che l'installazione e' stata collegata provando
// il suo segreto. Non e' una route pubblica e non sostituisce quella sopra.
export async function eliminaMittente(ambiente, mittente) {
  const contributoreDraft = ambiente.DRAFT_DB ? await ambiente.DRAFT_DB.prepare(
    "SELECT cancellazione_hash FROM contributori WHERE mittente = ?"
  ).bind(mittente).first() : null;
  const contributorePartite = ambiente.DB ? await ambiente.DB.prepare(
    "SELECT cancellazione_hash FROM contributori WHERE mittente = ?"
  ).bind(mittente).first() : null;
  let righe = { results: [] };
  if (contributoreDraft) {
    righe = await ambiente.DRAFT_DB.prepare(
      "SELECT id, oggetto_r2 FROM draft WHERE mittente = ?"
    ).bind(mittente).all();
  }
  const oggetti = (righe.results || []).map((r) => r.oggetto_r2);
  // L'API Workers di R2 accetta al massimo 1000 chiavi per delete.
  for (let i = 0; i < oggetti.length; i += 1000) {
    await ambiente.DRAFT_RAW.delete(oggetti.slice(i, i + 1000));
  }
  // Il mazzo montato si cancella **insieme al resto**: e' una lista di carte
  // di quella persona, e lasciarla indietro renderebbe falsa la promessa
  // «cancelli e sparisce tutto». Va prima di `draft`, perche' dopo non ci
  // sarebbe piu' il modo di risalire ai suoi id.
  if (contributoreDraft) await ambiente.DRAFT_DB.batch([
    ambiente.DRAFT_DB.prepare("DELETE FROM draft_link WHERE draft_id IN (SELECT id FROM draft WHERE mittente = ?)").bind(mittente),
    ambiente.DRAFT_DB.prepare("DELETE FROM draft_mazzo WHERE draft_id IN (SELECT id FROM draft WHERE mittente = ?)").bind(mittente),
    ambiente.DRAFT_DB.prepare("DELETE FROM draft_pick WHERE draft_id IN (SELECT id FROM draft WHERE mittente = ?)").bind(mittente),
    ambiente.DRAFT_DB.prepare("DELETE FROM draft WHERE mittente = ?").bind(mittente),
  ]);
  let righePartite = { results: [] };
  if (contributorePartite) {
    righePartite = await ambiente.DB.prepare(
      "SELECT id FROM partite WHERE mittente = ?").bind(mittente).all();
  }
  if (contributorePartite) await ambiente.DB.batch([
    ambiente.DB.prepare("DELETE FROM carte_mazzo WHERE partita IN (SELECT id FROM partite WHERE mittente = ?)").bind(mittente),
    ambiente.DB.prepare("DELETE FROM carte_avversario WHERE partita IN (SELECT id FROM partite WHERE mittente = ?)").bind(mittente),
    ambiente.DB.prepare("DELETE FROM partite WHERE mittente = ?").bind(mittente),
    // Nello stesso batch: nessun gruppo Brew resta senza le partite che lo
    // reggevano (vedi comandiPuliziaBrew).
    ...await comandiPuliziaBrew(ambiente.DB),
  ]);
  // Le credenziali si tolgono per ultime: un guasto intermedio resta
  // ripetibile con lo stesso segreto, invece di lasciare dati irraggiungibili.
  if (contributorePartite) {
    await ambiente.DB.batch([ambiente.DB.prepare(
      "DELETE FROM contributori WHERE mittente = ?").bind(mittente)]);
  }
  if (contributoreDraft) {
    await ambiente.DRAFT_DB.batch([ambiente.DRAFT_DB.prepare(
      "DELETE FROM contributori WHERE mittente = ?").bind(mittente)]);
  }
  return {
    draft: oggetti.length, partite: (righePartite.results || []).length,
  };
}

export async function collegaPartiteDraft(db, partite) {
  if (!db) return;
  const comandi = [];
  for (const partita of partite) {
    if (partita.versione !== 2 || !stringaHex(partita.draft, 64)) continue;
    // La ricerca e il link stanno nello stesso statement: una collisione
    // scoperta prima del batch non puo' lasciare un link verso il primo ID.
    comandi.push(db.prepare(`INSERT OR IGNORE INTO draft_link
      (draft_id, partita, esito) SELECT id, ?, ? FROM draft WHERE impronta_arena = ?`)
      .bind(partita.partita, partita.andamento.esito, partita.draft));
  }
  if (comandi.length) await db.batch(comandi);
}
