// Che cosa il server accetta, e che cosa rifiuta.
//
// Sta in un file suo, separato dal Worker, per un motivo pratico: qui non c'e'
// niente di Cloudflare, quindi si prova con `node --test` in mezzo secondo e
// senza rete. La parte che sbaglia di piu' in un server che riceve dati e'
// proprio questa, ed e' quella che deve essere provata di piu'.
//
// La forma dei pacchetti la decide Mox, in `strumenti/pacchetto_partita.py`.
// Se cambia li', cambia qui: e' per questo che ogni pacchetto porta il suo
// numero di versione.

export const VERSIONI_ACCETTATE = [1, 2];
export const VERSIONE_ACCETTATA = 2;

// Limiti dichiarati, non sparsi nel codice.
export const LIMITI = {
  partitePerRichiesta: 200,
  byteRichiesta: 256 * 1024,
  carteInMazzo: 250,
  carteRivelate: 200,
  turniMassimi: 500,
  durataMassima: 4 * 60 * 60, // quattro ore: oltre non e' una partita
  partitePerMittenteAlGiorno: 300,
};

const ESITI = new Set(["vinta", "persa"]);
const ESADECIMALE = /^[0-9a-f]+$/;

function stringa(valore, lunghezza) {
  return typeof valore === "string" && valore.length === lunghezza &&
    ESADECIMALE.test(valore);
}

function interoTra(valore, minimo, massimo) {
  return Number.isInteger(valore) && valore >= minimo && valore <= massimo;
}

function dataUtc(valore) {
  if (typeof valore !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(valore)) return false;
  const quando = new Date(valore);
  return !Number.isNaN(quando.getTime());
}

function carteConCopie(valore, massimo) {
  if (!valore || typeof valore !== "object" || Array.isArray(valore)) return false;
  const voci = Object.entries(valore);
  if (voci.length === 0 || voci.length > massimo) return false;
  let totale = 0;
  for (const [carta, copie] of voci) {
    if (!/^\d{1,7}$/.test(carta)) return false;
    if (!interoTra(copie, 1, massimo)) return false;
    totale += copie;
  }
  return totale <= massimo;
}

function elencoCarte(valore, massimo) {
  return Array.isArray(valore) && valore.length <= massimo &&
    valore.every((carta) => interoTra(carta, 1, 9999999));
}

/**
 * Dice se un pacchetto si puo' salvare, e se no perche'.
 *
 * Il motivo torna al mittente in chiaro: un client che sbaglia deve poterlo
 * capire senza indovinare, e un rifiuto muto e' il modo migliore per non
 * accorgersi mai che nessuno riesce piu' a mandare niente.
 */
export function controlla(dato) {
  if (!dato || typeof dato !== "object" || Array.isArray(dato)) {
    return "non e' un pacchetto";
  }
  if (!VERSIONI_ACCETTATE.includes(dato.versione)) {
    return `versione ${JSON.stringify(dato.versione)} sconosciuta`;
  }
  if (!stringa(dato.partita, 10)) return "identificativo della partita non valido";
  if (!stringa(dato.mittente, 32)) return "mittente non valido";
  if (dato.versione === 2 && !stringa(dato.segreto_cancellazione, 64)) {
    return "segreto di cancellazione non valido";
  }

  const mazzo = dato.mazzo;
  if (!mazzo || typeof mazzo !== "object") return "manca il mazzo";
  if (!stringa(mazzo.impronta, 64)) return "impronta del mazzo non valida";
  if (!carteConCopie(mazzo.carte, LIMITI.carteInMazzo)) return "carte del mazzo non valide";

  const avversario = dato.avversario;
  if (!avversario || typeof avversario !== "object") return "manca l'avversario";
  if (!elencoCarte(avversario.carte, LIMITI.carteRivelate)) {
    return "carte rivelate non valide";
  }
  // Regola del progetto, non dettaglio: dell'avversario arrivano solo le carte
  // che il log ha gia' mostrato. Se un client mandasse la sua mano, il server
  // la rifiuta invece di conservarla.
  for (const proibito of ["mano", "libreria", "nome", "id"]) {
    if (proibito in avversario) return `dell'avversario non deve arrivare ${proibito}`;
  }

  const andamento = dato.andamento;
  if (!andamento || typeof andamento !== "object") return "manca l'andamento";
  if (!ESITI.has(andamento.esito)) return "esito non valido";
  if (!interoTra(andamento.mulligan, 0, 7)) return "mulligan non valido";
  if ("su_gioco" in andamento && typeof andamento.su_gioco !== "boolean") {
    return "su_gioco non valido";
  }
  if ("giochi" in andamento) {
    const giochi = andamento.giochi;
    if (!Array.isArray(giochi) || giochi.length > 5 ||
        !giochi.every((g) => ESITI.has(g))) {
      return "esiti dei singoli game non validi";
    }
  }

  if ("quando" in dato && !dataUtc(dato.quando)) return "data non valida";
  if ("fuso" in dato && !interoTra(dato.fuso, -840, 840)) return "fuso non valido";
  if ("durata" in dato && !interoTra(dato.durata, 0, LIMITI.durataMassima)) {
    return "durata non valida";
  }
  if ("turni" in dato && !interoTra(dato.turni, 1, LIMITI.turniMassimi)) {
    return "turni non validi";
  }
  if ("apertura" in dato && !carteConCopie(dato.apertura, 7)) {
    return "mano iniziale non valida";
  }
  if (typeof dato.evento !== "string" || dato.evento.length > 80) {
    return "evento non valido";
  }
  if (dato.formato !== null && typeof dato.formato !== "string") {
    return "formato non valido";
  }
  if ("draft" in dato &&
      (dato.versione !== 2 || !stringa(dato.draft, 64))) {
    return "collegamento al Draft non valido";
  }
  return null;
}

/**
 * Le colonne di una partita, ricavate dal pacchetto.
 *
 * Il pacchetto intero si conserva comunque in `dato`: le colonne servono a
 * cercare in fretta, il JSON a poter rifare i conti domani con regole nuove
 * senza aver buttato via niente.
 */
export function riga(dato, ricevuta) {
  const rank = (dato.rank && dato.rank.costruito) || (dato.rank && dato.rank.limitato) || {};
  return {
    id: dato.partita,
    mittente: dato.mittente,
    ricevuta,
    quando: dato.quando ?? null,
    evento: dato.evento ?? null,
    formato: dato.formato ?? null,
    esito: dato.andamento.esito,
    su_gioco: "su_gioco" in dato.andamento ? (dato.andamento.su_gioco ? 1 : 0) : null,
    mulligan: dato.andamento.mulligan,
    turni: dato.turni ?? null,
    durata: dato.durata ?? null,
    giochi: Array.isArray(dato.andamento.giochi) ? dato.andamento.giochi.length : null,
    rank_classe: typeof rank.classe === "string" ? rank.classe : null,
    rank_livello: Number.isInteger(rank.livello) ? rank.livello : null,
    impronta_mazzo: dato.mazzo.impronta,
    mox: typeof dato.mox === "string" ? dato.mox.slice(0, 40) : null,
    arena: typeof dato.arena === "string" ? dato.arena.slice(0, 40) : null,
    versione: dato.versione,
    dato: JSON.stringify(dato),
  };
}
