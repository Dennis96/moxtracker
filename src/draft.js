// Ricezione e lettura dei Draft. Le tracce complete restano nel bucket R2
// privato; D1 conserva soltanto indici e fatti aggregabili.

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
    return valore.some((dentro) => contieneCampoVietato(dentro, profondita + 1));
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
    if (!elencoCarte(voce.offerte) || voce.offerte.length === 0 ||
        new Set(voce.offerte).size !== voce.offerte.length) {
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
        new Set(consigli).size !== consigli.length ||
        consigli.some((carta) => !voce.offerte.includes(carta)) ||
        consigli[0] !== voce.consiglio_mox) {
      return "consiglio Mox multiplo non valido";
    }
    if (typeof voce.politica !== "string" || voce.politica.length < 1 ||
        voce.politica.length > 80) return "politica non valida";
    if (!Array.isArray(voce.candidati) || voce.candidati.length === 0 ||
        voce.candidati.length > voce.offerte.length) return "candidati non validi";
    const carteCandidate = new Set();
    for (const candidato of voce.candidati) {
      if (!candidato || !voce.offerte.includes(candidato.carta) ||
          carteCandidate.has(candidato.carta)) return "candidato non offerto o duplicato";
      carteCandidate.add(candidato.carta);
      if (!interoTra(candidato.rango_mox, 1, voce.offerte.length)) {
        return "rango Mox non valido";
      }
      if (!interoTra(candidato.campione, 0, 100_000_000)) return "campione non valido";
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
    }
    if (voce.scelta !== undefined && quante !== 1) return "scelta singola nel formato Prendi Due";
    if (voce.scelte !== undefined && quante !== 2) return "scelte multiple nel formato normale";
    const scelte = voce.scelte ?? (voce.scelta !== undefined ? [voce.scelta] : []);
    if (scelte.length && (!elencoCarte(scelte, quante) || scelte.length !== quante ||
        new Set(scelte).size !== scelte.length ||
        scelte.some((carta) => !voce.offerte.includes(carta)))) {
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

async function salvaUno(db, r2, dato, ricevuto) {
  const gia = await db.prepare("SELECT id FROM draft WHERE id = ?").bind(dato.draft).first();
  if (gia) return "gia";
  const segretoHash = await sha256(dato.segreto_cancellazione);
  const contributore = await db.prepare(
    "SELECT cancellazione_hash FROM contributori WHERE mittente = ?"
  ).bind(dato.mittente).first();
  if (contributore && contributore.cancellazione_hash !== segretoHash) {
    throw new Error("segreto del contributore non coerente");
  }
  const pulito = structuredClone(dato);
  delete pulito.segreto_cancellazione;
  const grezzo = JSON.stringify(pulito);
  const byte = new TextEncoder().encode(grezzo).byteLength;
  const mese = ricevuto.slice(0, 7);
  const chiave = `${mese}/${dato.draft}.json`;
  await r2.put(chiave, grezzo, { httpMetadata: { contentType: "application/json" } });
  const politica = dato.pick[0] ? dato.pick[0].politica : "nessuna";
  const numeroPick = dato.pick.reduce((totale, voce) => totale +
    (voce.scelte?.length ?? (voce.scelta !== undefined ? 1 : 0)), 0);
  const comandi = [
    db.prepare(`INSERT OR IGNORE INTO contributori
      (mittente, cancellazione_hash, creato) VALUES (?, ?, ?)`).bind(
        dato.mittente, segretoHash, ricevuto),
    db.prepare(`INSERT INTO draft
      (id, mittente, ricevuto, iniziato, set_code, formato, completo, pick,
       politica, mox, impronta_arena, oggetto_r2, byte, versione)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        dato.draft, dato.mittente, ricevuto, dato.iniziato ?? null, dato.set,
        dato.formato, dato.completo ? 1 : 0, numeroPick, politica,
        String(dato.mox || "").slice(0, 40), dato.impronta_arena ?? null,
        chiave, byte, dato.versione),
  ];
  const pickScelti = [];
  for (const voce of dato.pick) {
    const scelte = voce.scelte ?? (voce.scelta !== undefined ? [voce.scelta] : []);
    const consigli = voce.consigli_mox ?? [voce.consiglio_mox];
    for (let indice = 0; indice < scelte.length; indice += 1) {
      const scelta = scelte[indice];
      const consiglio = consigli.includes(scelta) ? scelta : (consigli[indice] ?? consigli[0]);
      pickScelti.push({ voce, scelta, consiglio,
        numero: voce.pool_prima.length + indice + 1 });
    }
  }
  // D1 Free consente 50 query per invocazione e 100 parametri per query.
  // Dieci pick da dieci campi riempiono esattamente un solo statement.
  for (let i = 0; i < pickScelti.length; i += 10) {
    const blocco = pickScelti.slice(i, i + 10);
    const argomenti = [];
    for (const elemento of blocco) {
      const { voce, scelta, consiglio, numero } = elemento;
      const candidatoScelto = voce.candidati.find((c) => c.carta === scelta);
      const vicina = voce.candidati.some((c) => c.carta === scelta && c.vicina);
      argomenti.push(
        dato.draft, numero, fase(numero), consiglio,
        scelta, (voce.consigli_mox ?? [voce.consiglio_mox]).includes(scelta) ? 1 : 0,
        vicina ? 1 : 0, Number(candidatoScelto?.campione || 0),
        candidatoScelto?.fonte_17lands ?? null, voce.politica,
      );
    }
    const valori = blocco.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    comandi.push(db.prepare(`INSERT INTO draft_pick
      (draft_id, numero, fase, consiglio, scelta, seguito, vicina, campione,
       fonte, politica) VALUES ${valori}`).bind(...argomenti));
  }
  // Il mazzo davvero montato, versione per versione. Sei campi per riga: otto
  // righe per statement stanno dentro i 100 parametri di D1 Free, e trenta
  // versioni al massimo fanno quattro statement.
  const versioni = Array.isArray(dato.mazzo_giocato) ? dato.mazzo_giocato : [];
  for (let i = 0; i < versioni.length; i += 8) {
    const blocco = versioni.slice(i, i + 8);
    const argomenti = [];
    for (let scarto = 0; scarto < blocco.length; scarto += 1) {
      const versione = blocco[scarto];
      const carte = versione.mazzo.reduce((totale, [, quante]) => totale + quante, 0);
      argomenti.push(
        dato.draft, i + scarto + 1, versione.quando ?? null, carte,
        versione.mazzo.length, JSON.stringify(versione.mazzo),
        versione.riserva ? JSON.stringify(versione.riserva) : null,
      );
    }
    const valori = blocco.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");
    comandi.push(db.prepare(`INSERT INTO draft_mazzo
      (draft_id, versione, quando, carte, distinte, lista, riserva)
      VALUES ${valori}`).bind(...argomenti));
  }
  try {
    await db.batch(comandi);
  } catch (guasto) {
    await r2.delete(chiave);
    throw guasto;
  }
  return "nuovo";
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
  const buoni = [];
  const rifiutati = [];
  for (const dato of arrivate) {
    const motivo = controllaDraft(dato);
    if (motivo) rifiutati.push({ draft: dato?.draft, motivo }); else buoni.push(dato);
  }
  if (!buoni.length) return risposta({ accettati: 0, gia_presenti: 0, rifiutati }, 400);
  const mittente = buoni[0].mittente;
  if (buoni.some((d) => d.mittente !== mittente)) return risposta({ errore: "una richiesta, un mittente solo" }, 400);
  const byte = buoni.reduce((n, d) => n + new TextEncoder().encode(JSON.stringify(d)).byteLength, 0);
  const tetto = await controllaTetti(ambiente.DRAFT_DB, mittente, byte, buoni.length);
  if (tetto) return risposta({ errore: tetto, rimanda: buoni.map((d) => d.draft) }, 429);
  let accettati = 0;
  let giaPresenti = 0;
  const ricevuto = new Date().toISOString();
  for (const dato of buoni) {
    try {
      const esito = await salvaUno(ambiente.DRAFT_DB, ambiente.DRAFT_RAW, dato, ricevuto);
      if (esito === "gia") giaPresenti += 1; else accettati += 1;
    } catch (guasto) {
      if (String(guasto).includes("segreto del contributore")) {
        rifiutati.push({ draft: dato.draft, motivo: "segreto del contributore non coerente" });
      } else throw guasto;
    }
  }
  return risposta({ accettati, gia_presenti: giaPresenti, rifiutati });
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
  const condizioni = [];
  const argomenti = [];
  if (set) { condizioni.push("d.set_code = ?"); argomenti.push(set.toUpperCase()); }
  if (formato) { condizioni.push("d.formato = ?"); argomenti.push(formato); }
  const dove = condizioni.length ? `WHERE ${condizioni.join(" AND ")}` : "";
  const esito = await db.prepare(`SELECT p.fase, p.politica,
      COUNT(*) AS pick, SUM(p.seguito) AS seguiti, SUM(p.vicina) AS vicine,
      SUM(CASE WHEN p.campione < 100 THEN 1 ELSE 0 END) AS pochi_dati
    FROM draft_pick p JOIN draft d ON d.id = p.draft_id ${dove}
    GROUP BY p.fase, p.politica ORDER BY p.politica, p.fase`).bind(...argomenti).all();
  const fasi = (esito.results || []).map((r) => {
    const pick = Number(r.pick);
    const seguiti = Number(r.seguiti || 0);
    return {
      fase: r.fase, politica: r.politica, campione: pick,
      accordo_mox: pick >= 100 ? seguiti / pick : null,
      intervallo_95: pick >= 100 ? wilson(seguiti, pick) : null,
      alternative_vicine: Number(r.vicine || 0),
      dati_insufficienti: Number(r.pochi_dati || 0),
    };
  });
  const collegati = await db.prepare(`SELECT COUNT(*) AS partite,
      SUM(CASE WHEN l.esito = 'vinta' THEN 1 ELSE 0 END) AS vittorie
    FROM draft_link l JOIN draft d ON d.id = l.draft_id ${dove}`).bind(...argomenti).first();
  const partite = Number(collegati?.partite || 0);
  const vittorie = Number(collegati?.vittorie || 0);
  // Quanti Draft portano il mazzo davvero montato, e quante volte in media
  // l'utente lo ha cambiato. Sono due conteggi, non due percentuali: servono a
  // sapere se il dato **arriva**, che e' la domanda aperta finche' non ci sono
  // abbastanza Draft per confrontare consigliato e montato. Nessuna lista di
  // carte esce da qui.
  const mazzi = await db.prepare(`SELECT COUNT(DISTINCT m.draft_id) AS draft,
      COUNT(*) AS versioni
    FROM draft_mazzo m JOIN draft d ON d.id = m.draft_id ${dove}`)
    .bind(...argomenti).first();
  const conMazzo = Number(mazzi?.draft || 0);
  const versioniMazzo = Number(mazzi?.versioni || 0);
  return {
    versione: 1, soglia_percentuali: 100, soglia_match: 30, filtri: { set, formato }, fasi,
    risultati: { campione: partite, win_rate: partite >= 30 ? vittorie / partite : null,
      intervallo_95: partite >= 30 ? wilson(vittorie, partite) : null },
    mazzo_montato: { draft: conMazzo, versioni: versioniMazzo,
      cambi_medi: conMazzo ? (versioniMazzo - conMazzo) / conMazzo : null },
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
  return risposta({ eliminati: await eliminaMittente(ambiente, corpo.mittente) });
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
    const trovato = await db.prepare("SELECT id FROM draft WHERE impronta_arena = ?")
      .bind(partita.draft).first();
    if (trovato) {
      comandi.push(db.prepare(`INSERT OR IGNORE INTO draft_link
        (draft_id, partita, esito) VALUES (?, ?, ?)`).bind(
          trovato.id, partita.partita, partita.andamento.esito));
    }
  }
  if (comandi.length) await db.batch(comandi);
}
