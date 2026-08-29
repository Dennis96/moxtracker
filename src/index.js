// Il server che riceve le partite di Mox.
//
// Gira su Cloudflare Workers, con un database D1 accanto.
// Riceve le partite e pubblica le letture necessarie al sito.

import { controlla, riga, LIMITI, VERSIONI_ACCETTATE } from "./controlli.js";
import { leggiMeta, leggiGiocoRisposta, leggiScontri } from "./lettura.js";
import { leggiArchetipo } from "./dettaglio-archetipo.js";
import {
  VERSIONI_DRAFT_ACCETTATE, collegaPartiteDraft, eliminaContributi,
  recuperaDraft, riceviDraft, sha256, statisticheDraft,
} from "./draft.js";
import { gestisciAccount, pulisciCredenzialiScadute } from "./account.js";
import { gestisciTicket, pulisciTicketScaduti } from "./ticket.js";
import { controllaStorageGiornaliero } from "./monitoraggio.js";

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

async function salva(db, dati, ricevuta, segretoHash = null) {
  const comandi = [];
  if (segretoHash) {
    comandi.push(db.prepare(`INSERT OR IGNORE INTO contributori
      (mittente, cancellazione_hash, creato) VALUES (?, ?, ?)`).bind(
        dati[0].mittente, segretoHash, ricevuta));
  }
  const indiciDellePartite = [];
  for (const dato of dati) {
    const pulito = { ...dato };
    delete pulito.segreto_cancellazione;
    const r = riga(pulito, ricevuta);
    indiciDellePartite.push(comandi.length);
    comandi.push(db.prepare(
      `INSERT OR IGNORE INTO partite
       (id, mittente, ricevuta, quando, evento, formato, esito, su_gioco,
        mulligan, turni, durata, giochi, rank_classe, rank_livello, rank_stato,
        impronta_mazzo, mox, arena, versione, dato)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(r.id, r.mittente, r.ricevuta, r.quando, r.evento, r.formato,
           r.esito, r.su_gioco, r.mulligan, r.turni, r.durata, r.giochi,
           r.rank_classe, r.rank_livello, r.rank_stato, r.impronta_mazzo, r.mox, r.arena,
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
  const segreti = [...new Set(buone.filter((d) => d.versione === 2)
    .map((d) => d.segreto_cancellazione))];
  if (segreti.length > 1) {
    return risposta({ errore: "un mittente, un solo segreto di cancellazione" }, 400);
  }
  let segretoHash = null;
  if (segreti.length === 1) {
    segretoHash = await sha256(segreti[0]);
    const contributore = await ambiente.DB.prepare(
      "SELECT cancellazione_hash FROM contributori WHERE mittente = ?"
    ).bind(mittente).first();
    if (contributore && contributore.cancellazione_hash !== segretoHash) {
      return risposta({ errore: "segreto del contributore non coerente" }, 403);
    }
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
  const nuove = await salva(ambiente.DB, buone, ricevuta, segretoHash);
  await collegaPartiteDraft(ambiente.DRAFT_DB, buone);
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

function numeriVersione(valore) {
  const numeri = String(valore || "").match(/\d+/g)?.map(Number) || [];
  return [...numeri, 0, 0, 0, 0].slice(0, 4);
}

function versioneMaggiore(a, b) {
  const prima = numeriVersione(a);
  const seconda = numeriVersione(b);
  for (let i = 0; i < prima.length; i += 1) {
    if (prima[i] !== seconda[i]) return prima[i] > seconda[i];
  }
  return false;
}

const VERSIONE_UPDATER_CON_DISPATCH_SICURO = "2 beta 2.9.22";

function rispostaRelease(corpo, stato = 200) {
  const esito = risposta(corpo, stato);
  // Il manifesto cambia a ogni pubblicazione: una risposta `disponibile:
  // false` in cache impedirebbe ai client di vedere subito la nuova release.
  esito.headers.set("cache-control", "no-store");
  return esito;
}

async function attesaRecuperoUpdater(ambiente, corrente) {
  if (!versioneMaggiore(VERSIONE_UPDATER_CON_DISPATCH_SICURO, corrente)) return;
  const configurata = Number(ambiente.MOX_RELEASE_RECOVERY_DELAY_MS || 0);
  if (!Number.isFinite(configurata) || configurata <= 0) return;
  // Le versioni precedenti alla 2.9.22 possono ricevere il manifesto prima
  // che Tk abbia iniziato mainloop e perdere per sempre il callback. Il ponte
  // resta deliberatamente sotto il timeout di cinque secondi dei client.
  const millisecondi = Math.min(Math.trunc(configurata), 4000);
  await new Promise((risolvi) => setTimeout(risolvi, millisecondi));
}

async function releaseMox(ambiente, indirizzo) {
  const canale = indirizzo.searchParams.get("canale");
  if (indirizzo.searchParams.get("piattaforma") !== "win-x64" ||
      (canale !== "stable" && canale !== "canary")) {
    return rispostaRelease({ errore: "piattaforma o canale non valido" }, 400);
  }
  // Il canary e' una release che sta su un manifesto suo e che vede una
  // macchina sola - questa - prima del canale pubblico. Non ripiega mai sullo
  // stable: se il manifesto canary non c'e', per quel canale non c'e' niente
  // da aggiornare. Ripiegare vorrebbe dire far credere di stare collaudando
  // una versione nuova mentre si riscarica quella di tutti.
  const grezzo = canale === "canary"
    ? ambiente.MOX_RELEASE_MANIFEST_CANARY
    : ambiente.MOX_RELEASE_MANIFEST;
  if (!grezzo) return rispostaRelease({ disponibile: false });
  let manifesto;
  try { manifesto = JSON.parse(grezzo); } catch {
    return rispostaRelease({ errore: "release non configurata" }, 503);
  }
  const obbligatori = ["versione", "url", "sha256", "dimensione", "firma"];
  if (!manifesto || obbligatori.some((chiave) => !(chiave in manifesto))) {
    return rispostaRelease({ errore: "release non configurata" }, 503);
  }
  const corrente = indirizzo.searchParams.get("corrente") || "0";
  if (!versioneMaggiore(manifesto.versione, corrente)) {
    return rispostaRelease({ disponibile: false });
  }
  await attesaRecuperoUpdater(ambiente, corrente);
  return rispostaRelease({ disponibile: true, ...manifesto });
}

async function scaricaReleaseMox(ambiente) {
  if (!ambiente.MOX_RELEASES) {
    return risposta({ errore: "download release non configurato" }, 503);
  }
  const oggetto = await ambiente.MOX_RELEASES.get("Mox-Installer-win-x64.exe");
  if (!oggetto) return risposta({ errore: "installer non trovato" }, 404);
  if (ambiente.DB) {
    await ambiente.DB.batch([ambiente.DB.prepare(`INSERT INTO metrica_pubblica
      (chiave, valore, aggiornato) VALUES ('richieste_download', 1, ?)
      ON CONFLICT(chiave) DO UPDATE SET valore = valore + 1, aggiornato = excluded.aggiornato`)
      .bind(new Date().toISOString())]);
  }
  return new Response(oggetto.body, {
    headers: {
      ...INTESTAZIONI,
      "content-type": "application/vnd.microsoft.portable-executable",
      "content-length": String(oggetto.size),
      "content-disposition": "attachment; filename=\"Mox-Installer-win-x64.exe\"",
      "cache-control": "no-store",
    },
  });
}

async function provaSociale(ambiente) {
  const [partite, collegamenti, download, draft] = await Promise.all([
    ambiente.DB.prepare("SELECT COUNT(*) AS n FROM partite").first(),
    ambiente.DB.prepare("SELECT COUNT(*) AS n FROM account_dispositivo").first(),
    ambiente.DB.prepare("SELECT valore AS n, aggiornato FROM metrica_pubblica WHERE chiave = 'richieste_download'").first(),
    ambiente.DRAFT_DB ? ambiente.DRAFT_DB.prepare("SELECT COUNT(*) AS n FROM draft WHERE sospetto IS NULL").first() : null,
  ]);
  return risposta({ richieste_download: Number(download?.n || 0), collegamenti_mox: Number(collegamenti?.n || 0),
    contributi_partite: Number(partite?.n || 0), contributi_draft: Number(draft?.n || 0),
    aggiornato: download?.aggiornato || null,
    nota: "Le richieste di download non equivalgono a installazioni o persone.",
  }, 200, true);
}

export default {
  async fetch(richiesta, ambiente) {
    const indirizzo = new URL(richiesta.url);

    const ticket = await gestisciTicket(richiesta, ambiente, indirizzo);
    if (ticket) return ticket;
    const account = await gestisciAccount(richiesta, ambiente, indirizzo);
    if (account) return account;

    if (richiesta.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: INTESTAZIONI });
    }

    if (indirizzo.pathname === "/salute") {
      return risposta({ stato: "vivo", versioni_partite_accettate: VERSIONI_ACCETTATE,
        versioni_draft_accettate: VERSIONI_DRAFT_ACCETTATE });
    }

    if (indirizzo.pathname === "/mox/release") {
      if (richiesta.method !== "GET") return risposta({ errore: "usa GET" }, 405);
      return releaseMox(ambiente, indirizzo);
    }

    if (indirizzo.pathname === "/mox/download.exe") {
      if (richiesta.method !== "GET") return risposta({ errore: "usa GET" }, 405);
      return scaricaReleaseMox(ambiente);
    }

    if (indirizzo.pathname === "/prova-sociale") {
      if (richiesta.method !== "GET") return risposta({ errore: "usa GET" }, 405);
      return provaSociale(ambiente);
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

    if (indirizzo.pathname === "/draft") {
      if (richiesta.method !== "POST") return risposta({ errore: "usa POST" }, 405);
      try {
        return await riceviDraft(richiesta, ambiente, risposta);
      } catch (guasto) {
        console.error("guasto ricevendo Draft", guasto);
        return risposta({ errore: "guasto del server" }, 500);
      }
    }

    if (indirizzo.pathname === "/draft/recupera") {
      if (richiesta.method !== "POST") return risposta({ errore: "usa POST" }, 405);
      try {
        const esito = await recuperaDraft(richiesta, ambiente, risposta);
        esito.headers.set("cache-control", "no-store");
        return esito;
      } catch (guasto) {
        console.error("guasto recuperando Draft", guasto);
        return risposta({ errore: "guasto del server" }, 500);
      }
    }

    if (indirizzo.pathname === "/draft/statistiche") {
      if (richiesta.method !== "GET") return risposta({ errore: "usa GET" }, 405);
      try {
        const esito = await statisticheDraft(ambiente.DRAFT_DB, indirizzo);
        if (esito.errore) return risposta({ errore: esito.errore }, esito.stato || 400, true);
        return risposta(esito, 200, true);
      } catch (guasto) {
        console.error("guasto leggendo statistiche Draft", guasto);
        return risposta({ errore: "guasto del server" }, 500);
      }
    }

    if (indirizzo.pathname === "/contributi/elimina") {
      if (richiesta.method !== "POST") return risposta({ errore: "usa POST" }, 405);
      try {
        return await eliminaContributi(richiesta, ambiente, risposta);
      } catch (guasto) {
        console.error("guasto cancellando contributi", guasto);
        return risposta({ errore: "guasto del server" }, 500);
      }
    }

    return risposta({ errore: "non c'e' niente qui" }, 404);
  },
  async scheduled(_controllore, ambiente, contesto) {
    contesto.waitUntil(Promise.all([
      pulisciTicketScaduti(ambiente),
      pulisciCredenzialiScadute(ambiente),
      controllaStorageGiornaliero(ambiente),
    ]));
  },
};
