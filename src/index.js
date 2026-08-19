// Il server che riceve le partite di Mox.
//
// Gira su Cloudflare Workers, con un database D1 accanto.
// Riceve le partite e pubblica le letture necessarie al sito.

import { controlla, riga, LIMITI, VERSIONE_ACCETTATA } from "./controlli.js";
import { leggiMeta, leggiGiocoRisposta, leggiScontri } from "./lettura.js";
import { leggiArchetipo } from "./dettaglio-archetipo.js";

const INTESTAZIONI = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

function risposta(corpo, stato = 200, cache = false) {
  const headers = { ...INTESTAZIONI };
  if (cache && stato === 200) {
    headers["cache-control"] = "public, max-age=60, s-maxage=300";
  }
  return new Response(JSON.stringify(corpo, null, 2) + "\n",
    { status: stato, headers });
}

async function salva(db, dati, ricevuta) {
  const comandi = [];
  const indiciDellePartite = [];
  for (const dato of dati) {
    const r = riga(dato, ricevuta);
    indiciDellePartite.push(comandi.length);
    comandi.push(db.prepare(
      `INSERT OR IGNORE INTO partite
       (id, mittente, ricevuta, quando, evento, formato, esito, su_gioco,
        mulligan, turni, durata, giochi, rank_classe, rank_livello,
        impronta_mazzo, mox, arena, versione, dato)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(r.id, r.mittente, r.ricevuta, r.quando, r.evento, r.formato,
           r.esito, r.su_gioco, r.mulligan, r.turni, r.durata, r.giochi,
           r.rank_classe, r.rank_livello, r.impronta_mazzo, r.mox, r.arena,
           r.versione, r.dato));
    for (const [carta, copie] of Object.entries(dato.mazzo.carte)) {
      comandi.push(db.prepare(
        `INSERT OR IGNORE INTO carte_mazzo (partita, carta, copie) VALUES (?, ?, ?)`
      ).bind(r.id, Number(carta), copie));
    }
    for (const carta of dato.avversario.carte) {
      comandi.push(db.prepare(
        `INSERT OR IGNORE INTO carte_avversario (partita, carta) VALUES (?, ?)`
      ).bind(r.id, carta));
    }
  }
  const esiti = await db.batch(comandi);
  let nuove = 0;
  for (const indice of indiciDellePartite) {
    const esito = esiti[indice];
    if (esito && esito.meta && esito.meta.changes > 0) nuove += 1;
  }
  return nuove;
}

async function quantePerMittente(db, mittente, da) {
  const esito = await db.prepare(
    `SELECT COUNT(*) AS quante FROM partite WHERE mittente = ? AND ricevuta >= ?`
  ).bind(mittente, da).first();
  return (esito && esito.quante) || 0;
}

async function riceviPartite(richiesta, ambiente) {
  const lunghezza = Number(richiesta.headers.get("content-length") || 0);
  if (lunghezza > LIMITI.byteRichiesta) {
    return risposta({ errore: "richiesta troppo grande" }, 413);
  }
  let corpo;
  try {
    corpo = await richiesta.json();
  } catch {
    return risposta({ errore: "corpo non leggibile" }, 400);
  }
  const arrivate = Array.isArray(corpo) ? corpo
    : Array.isArray(corpo && corpo.partite) ? corpo.partite : [corpo];
  if (arrivate.length === 0) {
    return risposta({ errore: "nessuna partita" }, 400);
  }
  if (arrivate.length > LIMITI.partitePerRichiesta) {
    return risposta({ errore: `troppe partite in una volta (massimo ${LIMITI.partitePerRichiesta})` }, 413);
  }

  const buone = [];
  const rifiutate = [];
  for (const dato of arrivate) {
    const motivo = controlla(dato);
    if (motivo) rifiutate.push({ partita: dato && dato.partita, motivo });
    else buone.push(dato);
  }
  if (buone.length === 0) {
    return risposta({ accettate: 0, gia_presenti: 0, rifiutate }, 400);
  }

  const mittente = buone[0].mittente;
  if (buone.some((dato) => dato.mittente !== mittente)) {
    return risposta({ errore: "una richiesta, un mittente solo" }, 400);
  }
  const ieri = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const gia = await quantePerMittente(ambiente.DB, mittente, ieri);
  if (gia + buone.length > LIMITI.partitePerMittenteAlGiorno) {
    return risposta({
      errore: "tetto giornaliero raggiunto",
      tetto: LIMITI.partitePerMittenteAlGiorno,
      gia_ricevute: gia,
    }, 429);
  }

  const ricevuta = new Date().toISOString();
  const nuove = await salva(ambiente.DB, buone, ricevuta);
  return risposta({
    accettate: nuove,
    gia_presenti: buone.length - Math.min(nuove, buone.length),
    rifiutate,
  });
}

async function letturaPubblica(funzione, db, indirizzo) {
  const esito = await funzione(db, indirizzo);
  if (esito.errore) return risposta({ errore: esito.errore }, esito.stato || 400);
  return risposta(esito.corpo, esito.stato || 200, true);
}

export default {
  async fetch(richiesta, ambiente) {
    const indirizzo = new URL(richiesta.url);

    if (richiesta.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: INTESTAZIONI });
    }

    if (indirizzo.pathname === "/salute") {
      return risposta({ stato: "vivo", versione_accettata: VERSIONE_ACCETTATA });
    }

    if (indirizzo.pathname === "/meta") {
      if (richiesta.method !== "GET") return risposta({ errore: "usa GET" }, 405);
      return letturaPubblica(leggiMeta, ambiente.DB, indirizzo);
    }

    if (indirizzo.pathname === "/archetipo") {
      if (richiesta.method !== "GET") return risposta({ errore: "usa GET" }, 405);
      return letturaPubblica(leggiArchetipo, ambiente.DB, indirizzo);
    }

    if (indirizzo.pathname === "/gioco-risposta") {
      if (richiesta.method !== "GET") return risposta({ errore: "usa GET" }, 405);
      return letturaPubblica(leggiGiocoRisposta, ambiente.DB, indirizzo);
    }

    if (indirizzo.pathname === "/scontri") {
      if (richiesta.method !== "GET") return risposta({ errore: "usa GET" }, 405);
      return letturaPubblica(leggiScontri, ambiente.DB, indirizzo);
    }

    if (indirizzo.pathname === "/partite") {
      if (richiesta.method !== "POST") return risposta({ errore: "usa POST" }, 405);
      try {
        return await riceviPartite(richiesta, ambiente);
      } catch (guasto) {
        console.error("guasto ricevendo partite", guasto);
        return risposta({ errore: "guasto del server" }, 500);
      }
    }

    return risposta({ errore: "non c'e' niente qui" }, 404);
  },
};
