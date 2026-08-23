// Ticket bug/sviluppi/dati, utilizzabili con account oppure con link segreto.

import { preflightAccount, rispostaAccount, utenteDallaSessione } from "./account.js";
import { sha256 } from "./draft.js";

const CATEGORIE = new Set(["bug", "sviluppo", "dati"]);
const STATI = new Set([
  "ricevuto", "da_verificare", "pianificato", "in_lavorazione", "risolto", "chiuso",
]);
const TIPI_ALLEGATO = new Set([
  "image/png", "image/jpeg", "image/webp",
]);
const BYTE_MASSIMI = 10 * 1024 * 1024;

async function firmaAllegatoValida(file) {
  const byte = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const inizia = (...valori) => valori.every((v, i) => byte[i] === v);
  if (file.type === "image/png") return inizia(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (file.type === "image/jpeg") return inizia(0xff, 0xd8, 0xff);
  if (file.type === "image/webp") {
    return inizia(0x52, 0x49, 0x46, 0x46) &&
      byte[8] === 0x57 && byte[9] === 0x45 && byte[10] === 0x42 && byte[11] === 0x50;
  }
  return false;
}

function casuale(byte = 16) {
  const dati = new Uint8Array(byte);
  crypto.getRandomValues(dati);
  return [...dati].map((n) => n.toString(16).padStart(2, "0")).join("");
}

function sito(ambiente) {
  return String(ambiente.SITE_ORIGIN || "https://moxtracker.app").replace(/\/$/, "");
}

function pulisciTesto(valore, massimo) {
  return typeof valore === "string" ? valore.trim().slice(0, massimo) : "";
}

async function json(richiesta) {
  try { return await richiesta.json(); } catch { return null; }
}

async function limita(richiesta, ambiente, ambito, identita = "") {
  if (!ambiente.TICKET_RATE_LIMITER) return true;
  const attore = identita || richiesta.headers.get("cf-connecting-ip") || "sconosciuto";
  const esito = await ambiente.TICKET_RATE_LIMITER.limit({ key: `${ambito}:${attore}` });
  return Boolean(esito?.success);
}

async function verificaTurnstile(richiesta, ambiente, token) {
  if (!ambiente.TURNSTILE_SECRET || !ambiente.TURNSTILE_SITE_KEY) return false;
  token = pulisciTesto(token, 2048);
  if (!token) return false;
  const recupera = ambiente.TURNSTILE_FETCH || fetch;
  try {
    const risposta = await recupera(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          secret: ambiente.TURNSTILE_SECRET, response: token,
          remoteip: richiesta.headers.get("cf-connecting-ip") || undefined,
        }),
      });
    if (!risposta.ok) return false;
    const esito = await risposta.json();
    return esito.success === true;
  } catch {
    return false;
  }
}

async function richiedeAmministratore(richiesta, ambiente) {
  const utente = await utenteDallaSessione(richiesta, ambiente);
  return utente?.ruolo === "amministratore" ? utente : null;
}

async function proprietario(richiesta, ambiente, ticket, indirizzo) {
  const utente = await utenteDallaSessione(richiesta, ambiente);
  if (utente && ticket.account_id === utente.id) return { tipo: "account", utente };
  const token = indirizzo.searchParams.get("token") || richiesta.headers.get("x-ticket-token");
  if (!ticket.account_id && token && ticket.accesso_hash === await sha256(token)) {
    return { tipo: "anonimo", utente: null };
  }
  return null;
}

async function leggiTicket(db, id) {
  return db.prepare(`SELECT id, account_id, accesso_hash, categoria, titolo, stato,
    versione_mox, diagnostica_id, creato, aggiornato FROM ticket WHERE id = ?`)
    .bind(id).first();
}

function ticketPubblico(riga) {
  return {
    id: riga.id, categoria: riga.categoria, titolo: riga.titolo, stato: riga.stato,
    versione_mox: riga.versione_mox, diagnostica_id: riga.diagnostica_id,
    creato: riga.creato, aggiornato: riga.aggiornato,
  };
}

async function dettaglio(richiesta, ambiente, indirizzo, id) {
  const ticket = await leggiTicket(ambiente.DB, id);
  if (!ticket) return rispostaAccount(richiesta, ambiente, { errore: "ticket non trovato" }, 404);
  if (!await proprietario(richiesta, ambiente, ticket, indirizzo)) {
    return rispostaAccount(richiesta, ambiente, { errore: "accesso al ticket negato" }, 403);
  }
  const messaggi = await ambiente.DB.prepare(`SELECT id, autore, testo, creato
    FROM ticket_messaggio WHERE ticket_id = ? ORDER BY creato`).bind(id).all();
  const allegati = await ambiente.DB.prepare(`SELECT id, nome, tipo, byte, creato
    FROM ticket_allegato WHERE ticket_id = ? ORDER BY creato`).bind(id).all();
  return rispostaAccount(richiesta, ambiente, {
    ticket: ticketPubblico(ticket), messaggi: messaggi.results || [],
    allegati: allegati.results || [],
  });
}

async function crea(richiesta, ambiente) {
  const corpo = await json(richiesta);
  const categoria = pulisciTesto(corpo?.categoria, 30);
  const titolo = pulisciTesto(corpo?.titolo, 120);
  const testo = pulisciTesto(corpo?.testo, 5000);
  if (!CATEGORIE.has(categoria) || titolo.length < 5 || testo.length < 20) {
    return rispostaAccount(richiesta, ambiente,
      { errore: "categoria, titolo o descrizione non validi" }, 400);
  }
  const utente = await utenteDallaSessione(richiesta, ambiente);
  if (!await limita(richiesta, ambiente, "crea", utente?.id || "")) {
    return rispostaAccount(richiesta, ambiente,
      { errore: "troppi ticket in poco tempo: riprova piu tardi" }, 429);
  }
  if (!utente && !await verificaTurnstile(richiesta, ambiente, corpo?.turnstile_token)) {
    return rispostaAccount(richiesta, ambiente,
      { errore: "verifica anti-spam non riuscita: aggiorna la pagina e riprova" }, 403);
  }
  const id = casuale();
  const token = utente ? null : casuale(32);
  const ora = new Date().toISOString();
  const versione = pulisciTesto(corpo?.versione_mox, 60) || null;
  const diagnostica = pulisciTesto(corpo?.diagnostica_id, 100) || null;
  await ambiente.DB.batch([
    ambiente.DB.prepare(`INSERT INTO ticket
      (id, account_id, accesso_hash, categoria, titolo, stato, versione_mox,
       diagnostica_id, creato, aggiornato) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, utente?.id || null, token ? await sha256(token) : null,
        categoria, titolo, "ricevuto", versione, diagnostica, ora, ora),
    ambiente.DB.prepare(`INSERT INTO ticket_messaggio
      (id, ticket_id, autore, testo, creato) VALUES (?, ?, ?, ?, ?)`)
      .bind(casuale(), id, "utente", testo, ora),
  ]);
  const risultato = { ticket: { id, stato: "ricevuto" } };
  if (token) {
    risultato.token = token;
    risultato.link_segreto = `${sito(ambiente)}/supporto.html?ticket=${id}&token=${token}`;
  }
  return rispostaAccount(richiesta, ambiente, risultato, 201);
}

async function aggiungiMessaggio(richiesta, ambiente, indirizzo, id) {
  const ticket = await leggiTicket(ambiente.DB, id);
  if (!ticket) return rispostaAccount(richiesta, ambiente, { errore: "ticket non trovato" }, 404);
  const proprieta = await proprietario(richiesta, ambiente, ticket, indirizzo);
  if (!proprieta) {
    return rispostaAccount(richiesta, ambiente, { errore: "accesso al ticket negato" }, 403);
  }
  if (!await limita(richiesta, ambiente, "messaggio", proprieta.utente?.id || id)) {
    return rispostaAccount(richiesta, ambiente,
      { errore: "troppi messaggi in poco tempo: riprova piu tardi" }, 429);
  }
  if (ticket.stato === "chiuso") {
    return rispostaAccount(richiesta, ambiente, { errore: "il ticket e' chiuso" }, 409);
  }
  const corpo = await json(richiesta);
  const testo = pulisciTesto(corpo?.testo, 5000);
  if (testo.length < 2) return rispostaAccount(richiesta, ambiente,
    { errore: "messaggio troppo breve" }, 400);
  const ora = new Date().toISOString();
  await ambiente.DB.batch([
    ambiente.DB.prepare(`INSERT INTO ticket_messaggio
      (id, ticket_id, autore, testo, creato) VALUES (?, ?, ?, ?, ?)`)
      .bind(casuale(), id, "utente", testo, ora),
    ambiente.DB.prepare("UPDATE ticket SET aggiornato = ? WHERE id = ?").bind(ora, id),
  ]);
  return rispostaAccount(richiesta, ambiente, { aggiunto: true });
}

async function aggiungiAllegato(richiesta, ambiente, indirizzo, id) {
  const ticket = await leggiTicket(ambiente.DB, id);
  if (!ticket) return rispostaAccount(richiesta, ambiente, { errore: "ticket non trovato" }, 404);
  const proprieta = await proprietario(richiesta, ambiente, ticket, indirizzo);
  if (!proprieta) {
    return rispostaAccount(richiesta, ambiente, { errore: "accesso al ticket negato" }, 403);
  }
  if (!await limita(richiesta, ambiente, "allegato", proprieta.utente?.id || id)) {
    return rispostaAccount(richiesta, ambiente,
      { errore: "troppi allegati in poco tempo: riprova piu tardi" }, 429);
  }
  if (ticket.stato === "chiuso") {
    return rispostaAccount(richiesta, ambiente, { errore: "il ticket e' chiuso" }, 409);
  }
  if (!ambiente.TICKET_FILES) return rispostaAccount(richiesta, ambiente,
    { errore: "allegati temporaneamente non configurati" }, 503);
  const dichiarati = Number(richiesta.headers.get("content-length") || 0);
  if (dichiarati > BYTE_MASSIMI + 128 * 1024) return rispostaAccount(richiesta, ambiente,
    { errore: "allegato troppo grande" }, 413);
  let modulo;
  try { modulo = await richiesta.formData(); } catch {
    return rispostaAccount(richiesta, ambiente, { errore: "allegato non leggibile" }, 400);
  }
  const file = modulo.get("file");
  if (!(file instanceof File) || !TIPI_ALLEGATO.has(file.type) || file.size > BYTE_MASSIMI ||
      !await firmaAllegatoValida(file)) {
    return rispostaAccount(richiesta, ambiente,
      { errore: "usa un vero PNG, JPEG o WebP fino a 10 MB" }, 415);
  }
  const quanti = await ambiente.DB.prepare(
    "SELECT COUNT(*) AS n FROM ticket_allegato WHERE ticket_id = ?").bind(id).first();
  if (Number(quanti?.n || 0) >= 5) return rispostaAccount(richiesta, ambiente,
    { errore: "massimo 5 allegati per ticket" }, 413);
  const allegato = casuale();
  const nome = pulisciTesto(file.name.replace(/[\\/\u0000-\u001f]/g, "_"), 120) || "allegato";
  const oggetto = `ticket/${id}/${allegato}`;
  const ora = new Date().toISOString();
  await ambiente.TICKET_FILES.put(oggetto, file.stream(), {
    httpMetadata: { contentType: file.type }, customMetadata: { ticket: id, allegato },
  });
  try {
    await ambiente.DB.batch([ambiente.DB.prepare(`INSERT INTO ticket_allegato
      (id, ticket_id, nome, tipo, byte, oggetto_r2, creato)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(
        allegato, id, nome, file.type, file.size, oggetto, ora)]);
  } catch (guasto) {
    await ambiente.TICKET_FILES.delete(oggetto);
    throw guasto;
  }
  return rispostaAccount(richiesta, ambiente,
    { allegato: { id: allegato, nome, tipo: file.type, byte: file.size } }, 201);
}

async function scaricaAllegato(richiesta, ambiente, indirizzo, id, allegatoId) {
  const ticket = await leggiTicket(ambiente.DB, id);
  if (!ticket) return rispostaAccount(richiesta, ambiente, { errore: "ticket non trovato" }, 404);
  const amministratore = await richiedeAmministratore(richiesta, ambiente);
  if (!amministratore && !await proprietario(richiesta, ambiente, ticket, indirizzo)) {
    return rispostaAccount(richiesta, ambiente, { errore: "accesso al ticket negato" }, 403);
  }
  if (!ambiente.TICKET_FILES) return rispostaAccount(richiesta, ambiente,
    { errore: "allegati temporaneamente non configurati" }, 503);
  const riga = await ambiente.DB.prepare(`SELECT nome, tipo, oggetto_r2 FROM ticket_allegato
    WHERE id = ? AND ticket_id = ?`).bind(allegatoId, id).first();
  if (!riga) return rispostaAccount(richiesta, ambiente, { errore: "allegato non trovato" }, 404);
  const oggetto = await ambiente.TICKET_FILES.get(riga.oggetto_r2);
  if (!oggetto) return rispostaAccount(richiesta, ambiente, { errore: "allegato non disponibile" }, 404);
  const nome = String(riga.nome).replace(/["\\\r\n]/g, "_");
  return new Response(oggetto.body, { headers: {
    "content-type": riga.tipo,
    "content-disposition": `attachment; filename="${nome}"`,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  } });
}

async function elencoAccount(richiesta, ambiente) {
  const utente = await utenteDallaSessione(richiesta, ambiente);
  if (!utente) return rispostaAccount(richiesta, ambiente, { errore: "accesso richiesto" }, 401);
  const righe = await ambiente.DB.prepare(`SELECT id, categoria, titolo, stato,
    versione_mox, diagnostica_id, creato, aggiornato FROM ticket
    WHERE account_id = ? ORDER BY aggiornato DESC LIMIT 100`).bind(utente.id).all();
  return rispostaAccount(richiesta, ambiente, { ticket: righe.results || [] });
}

async function elencoAmministratore(richiesta, ambiente, indirizzo) {
  const amministratore = await richiedeAmministratore(richiesta, ambiente);
  if (!amministratore) return rispostaAccount(richiesta, ambiente,
    { errore: "accesso amministratore richiesto" }, 403);
  const stato = pulisciTesto(indirizzo.searchParams.get("stato"), 30);
  if (stato && !STATI.has(stato)) return rispostaAccount(richiesta, ambiente,
    { errore: "stato non valido" }, 400);
  const query = stato
    ? `SELECT id, account_id, categoria, titolo, stato, versione_mox,
       diagnostica_id, creato, aggiornato FROM ticket
       WHERE stato = ? ORDER BY aggiornato DESC LIMIT 200`
    : `SELECT id, account_id, categoria, titolo, stato, versione_mox,
       diagnostica_id, creato, aggiornato FROM ticket
       ORDER BY aggiornato DESC LIMIT 200`;
  const comando = ambiente.DB.prepare(query);
  const righe = await (stato ? comando.bind(stato) : comando).all();
  return rispostaAccount(richiesta, ambiente, { ticket: righe.results || [] });
}

async function dettaglioAmministratore(richiesta, ambiente, id) {
  const amministratore = await richiedeAmministratore(richiesta, ambiente);
  if (!amministratore) return rispostaAccount(richiesta, ambiente,
    { errore: "accesso amministratore richiesto" }, 403);
  const ticket = await leggiTicket(ambiente.DB, id);
  if (!ticket) return rispostaAccount(richiesta, ambiente,
    { errore: "ticket non trovato" }, 404);
  const messaggi = await ambiente.DB.prepare(`SELECT id, autore, testo, creato
    FROM ticket_messaggio WHERE ticket_id = ? ORDER BY creato`).bind(id).all();
  const allegati = await ambiente.DB.prepare(`SELECT id, nome, tipo, byte, creato
    FROM ticket_allegato WHERE ticket_id = ? ORDER BY creato`).bind(id).all();
  return rispostaAccount(richiesta, ambiente, {
    ticket: ticketPubblico(ticket), messaggi: messaggi.results || [],
    allegati: allegati.results || [],
  });
}

async function registraAudit(ambiente, amministratore, ticket, azione, dettaglio) {
  await ambiente.DB.batch([ambiente.DB.prepare(`INSERT INTO ticket_audit
    (id, account_id, ticket_id, azione, dettaglio, creato)
    VALUES (?, ?, ?, ?, ?, ?)`).bind(casuale(), amministratore.id, ticket,
      azione, dettaglio || null, new Date().toISOString())]);
}

async function aggiornaDaAmministratore(richiesta, ambiente, id) {
  const amministratore = await richiedeAmministratore(richiesta, ambiente);
  if (!amministratore) return rispostaAccount(richiesta, ambiente,
    { errore: "accesso amministratore richiesto" }, 403);
  const ticket = await leggiTicket(ambiente.DB, id);
  if (!ticket) return rispostaAccount(richiesta, ambiente, { errore: "ticket non trovato" }, 404);
  const corpo = await json(richiesta);
  const stato = pulisciTesto(corpo?.stato, 30);
  const testo = pulisciTesto(corpo?.testo, 5000);
  if (stato && !STATI.has(stato)) return rispostaAccount(richiesta, ambiente,
    { errore: "stato non valido" }, 400);
  if (!stato && testo.length < 2) return rispostaAccount(richiesta, ambiente,
    { errore: "nessuna modifica" }, 400);
  const ora = new Date().toISOString();
  const comandi = [ambiente.DB.prepare(
    "UPDATE ticket SET stato = ?, aggiornato = ? WHERE id = ?")
    .bind(stato || ticket.stato, ora, id)];
  if (testo) comandi.push(ambiente.DB.prepare(`INSERT INTO ticket_messaggio
    (id, ticket_id, autore, testo, creato) VALUES (?, ?, ?, ?, ?)`)
    .bind(casuale(), id, "supporto", testo, ora));
  await ambiente.DB.batch(comandi);
  await registraAudit(ambiente, amministratore, id, "ticket_aggiornato",
    JSON.stringify({ da: ticket.stato, a: stato || ticket.stato,
      risposta: Boolean(testo) }));
  return rispostaAccount(richiesta, ambiente,
    { aggiornato: true, stato: stato || ticket.stato });
}

export async function pulisciTicketScaduti(ambiente, adesso = Date.now()) {
  const allegatiPrima = new Date(adesso - 90 * 24 * 60 * 60 * 1000).toISOString();
  const ticketPrima = new Date(adesso - 365 * 24 * 60 * 60 * 1000).toISOString();
  const allegati = await ambiente.DB.prepare(`SELECT a.id, a.oggetto_r2
    FROM ticket_allegato a JOIN ticket t ON t.id = a.ticket_id
    WHERE t.stato = 'chiuso' AND t.aggiornato < ? LIMIT 1000`)
    .bind(allegatiPrima).all();
  const righeAllegati = allegati.results || [];
  if (ambiente.TICKET_FILES && righeAllegati.length) {
    await ambiente.TICKET_FILES.delete(righeAllegati.map((r) => r.oggetto_r2));
  }
  if (righeAllegati.length) {
    const segni = righeAllegati.map(() => "?").join(", ");
    await ambiente.DB.batch([ambiente.DB.prepare(
      `DELETE FROM ticket_allegato WHERE id IN (${segni})`)
      .bind(...righeAllegati.map((r) => r.id))]);
  }
  const vecchi = await ambiente.DB.prepare(`SELECT id FROM ticket
    WHERE stato = 'chiuso' AND aggiornato < ? LIMIT 500`).bind(ticketPrima).all();
  const idVecchi = (vecchi.results || []).map((r) => r.id);
  for (const id of idVecchi) {
    const residui = await ambiente.DB.prepare(
      "SELECT oggetto_r2 FROM ticket_allegato WHERE ticket_id = ?").bind(id).all();
    const oggetti = (residui.results || []).map((r) => r.oggetto_r2);
    if (ambiente.TICKET_FILES && oggetti.length) await ambiente.TICKET_FILES.delete(oggetti);
    await ambiente.DB.batch([
      ambiente.DB.prepare("DELETE FROM ticket_allegato WHERE ticket_id = ?").bind(id),
      ambiente.DB.prepare("DELETE FROM ticket_messaggio WHERE ticket_id = ?").bind(id),
      ambiente.DB.prepare("DELETE FROM ticket_audit WHERE ticket_id = ?").bind(id),
      ambiente.DB.prepare("DELETE FROM ticket WHERE id = ?").bind(id),
    ]);
  }
  return { allegati_eliminati: righeAllegati.length, ticket_eliminati: idVecchi.length };
}

export async function gestisciTicket(richiesta, ambiente, indirizzo) {
  const percorso = indirizzo.pathname;
  const routeTicket = percorso === "/ticket" || percorso.startsWith("/ticket/") ||
    percorso === "/account/tickets" || percorso.startsWith("/admin/ticket/");
  if (routeTicket && richiesta.method === "OPTIONS") {
    return preflightAccount(richiesta, ambiente);
  }
  if (percorso === "/account/tickets") {
    return richiesta.method === "GET" ? elencoAccount(richiesta, ambiente)
      : rispostaAccount(richiesta, ambiente, { errore: "usa GET" }, 405);
  }
  if (percorso === "/ticket/config" && richiesta.method === "GET") {
    return rispostaAccount(richiesta, ambiente,
      { turnstile_site_key: ambiente.TURNSTILE_SITE_KEY || null });
  }
  if (percorso === "/ticket") return richiesta.method === "POST"
    ? crea(richiesta, ambiente)
    : rispostaAccount(richiesta, ambiente, { errore: "usa POST" }, 405);
  const messaggi = percorso.match(/^\/ticket\/([0-9a-f]{32})\/messages$/);
  if (messaggi) return richiesta.method === "POST"
    ? aggiungiMessaggio(richiesta, ambiente, indirizzo, messaggi[1])
    : rispostaAccount(richiesta, ambiente, { errore: "usa POST" }, 405);
  const allegati = percorso.match(/^\/ticket\/([0-9a-f]{32})\/attachments$/);
  if (allegati) return richiesta.method === "POST"
    ? aggiungiAllegato(richiesta, ambiente, indirizzo, allegati[1])
    : rispostaAccount(richiesta, ambiente, { errore: "usa POST" }, 405);
  const scarica = percorso.match(
    /^\/ticket\/([0-9a-f]{32})\/attachments\/([0-9a-f]{32})$/);
  if (scarica) return richiesta.method === "GET"
    ? scaricaAllegato(richiesta, ambiente, indirizzo, scarica[1], scarica[2])
    : rispostaAccount(richiesta, ambiente, { errore: "usa GET" }, 405);
  if (percorso === "/admin/tickets") return richiesta.method === "GET"
    ? elencoAmministratore(richiesta, ambiente, indirizzo)
    : rispostaAccount(richiesta, ambiente, { errore: "usa GET" }, 405);
  const amministrazione = percorso.match(/^\/admin\/ticket\/([0-9a-f]{32})$/);
  if (amministrazione) {
    if (richiesta.method === "GET") {
      return dettaglioAmministratore(richiesta, ambiente, amministrazione[1]);
    }
    return richiesta.method === "POST"
      ? aggiornaDaAmministratore(richiesta, ambiente, amministrazione[1])
      : rispostaAccount(richiesta, ambiente, { errore: "usa GET o POST" }, 405);
  }
  const singolo = percorso.match(/^\/ticket\/([0-9a-f]{32})$/);
  if (singolo) return richiesta.method === "GET"
    ? dettaglio(richiesta, ambiente, indirizzo, singolo[1])
    : rispostaAccount(richiesta, ambiente, { errore: "usa GET" }, 405);
  return null;
}
