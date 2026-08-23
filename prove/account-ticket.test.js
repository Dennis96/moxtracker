import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import worker from "../src/index.js";
import { pulisciTicketScaduti } from "../src/ticket.js";
import { sha256 } from "../src/draft.js";
import { creaFintoD1 } from "./finto-d1.js";

const qui = dirname(fileURLToPath(import.meta.url));
const principale = join(qui, "..", "schema.sql");
const draft = join(qui, "..", "schema-draft.sql");

function ambiente() {
  return {
    DB: creaFintoD1(principale), DRAFT_DB: creaFintoD1(draft),
    SITE_ORIGIN: "https://moxtracker.app",
    GOOGLE_CLIENT_ID: "google-client", GOOGLE_CLIENT_SECRET: "google-secret",
    DISCORD_CLIENT_ID: "discord-client", DISCORD_CLIENT_SECRET: "discord-secret",
    TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
    TURNSTILE_SECRET: "1x0000000000000000000000000000000AA",
    TURNSTILE_FETCH: async () => new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { "content-type": "application/json" },
    }),
    OAUTH_FETCH: async (url) => {
      if (String(url).includes("token")) return new Response(JSON.stringify({ access_token: "accesso" }), {
        status: 200, headers: { "content-type": "application/json" },
      });
      if (String(url).includes("discord.com/api/users")) return new Response(JSON.stringify({
        id: "discord-456", username: "Amico Discord", global_name: "Amico Discord",
        avatar: "avatar-discord",
      }), { status: 200, headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify({
        sub: "google-123", name: "Amico di Mox", email: "privata@example.test",
        email_verified: true, picture: "https://example.test/avatar.png",
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  };
}

function fileTicketFinti() {
  const oggetti = new Map();
  return {
    oggetti,
    async put(chiave, valore) {
      oggetti.set(chiave, new Uint8Array(await new Response(valore).arrayBuffer()));
    },
    async get(chiave) {
      const body = oggetti.get(chiave);
      return body ? { body } : null;
    },
    async delete(chiavi) {
      for (const chiave of Array.isArray(chiavi) ? chiavi : [chiavi]) oggetti.delete(chiave);
    },
  };
}

function primaCookie(risposta) {
  return risposta.headers.get("set-cookie").split(";", 1)[0];
}

async function accedi(env) {
  const inizio = await worker.fetch(new Request(
    "https://api.moxtracker.app/auth/google?ritorno=/account.html"), env);
  assert.equal(inizio.status, 302);
  const statoCookie = primaCookie(inizio);
  const stato = new URL(inizio.headers.get("location")).searchParams.get("state");
  const fine = await worker.fetch(new Request(
    `https://api.moxtracker.app/auth/google/callback?code=codice&state=${stato}`,
    { headers: { cookie: statoCookie } }), env);
  assert.equal(fine.status, 302);
  assert.equal(fine.headers.get("location"), "https://moxtracker.app/account.html");
  return primaCookie(fine);
}

function partitaPersonale({ id, mittente, segreto, esito = "vinta",
  quando = "2026-08-22T18:24:00Z", evento = "Ladder", formato = "Standard" }) {
  return {
    versione: 2, partita: id, mittente, segreto_cancellazione: segreto,
    evento, formato,
    mazzo: { impronta: "a".repeat(64), carte: { "103441": 4, "102": 56 } },
    avversario: { carte: [201, 202] },
    andamento: { esito, mulligan: 1, su_gioco: esito === "vinta", giochi: [esito] },
    quando, fuso: 120, durata: 300, turni: 10,
    rank: { costruito: { classe: "Gold", livello: 3 } },
    apertura: { "103441": 1, "102": 6 }, mox: "2 beta 2.9.12", arena: "2026.62.1",
  };
}

test("OAuth usa stato monouso e crea una sessione HttpOnly", async () => {
  const env = ambiente();
  const autorizzazione = await worker.fetch(new Request(
    "https://api.moxtracker.app/auth/google?ritorno=/account.html"), env);
  const scope = new URL(autorizzazione.headers.get("location")).searchParams.get("scope");
  assert.equal(scope, "openid profile");
  assert.equal(scope.includes("email"), false);
  const sessione = await accedi(env);
  assert.match(sessione, /^mox_sessione=/);
  const me = await worker.fetch(new Request("https://api.moxtracker.app/account/me", {
    headers: { cookie: sessione, origin: "https://moxtracker.app" },
  }), env);
  assert.equal(me.status, 200);
  const corpo = await me.json();
  assert.equal(corpo.account.nome, "Amico di Mox");
  assert.deepEqual(corpo.account.provider, ["google"]);
  assert.equal(me.headers.get("access-control-allow-origin"), "https://moxtracker.app");
  assert.equal(me.headers.get("access-control-allow-credentials"), "true");
  assert.equal(env.DB.conta("account_sessione"), 1);
  assert.equal(env.DB.tutte("SELECT hash FROM account_sessione")[0].hash.length, 64);
  assert.equal(env.DB.tutte("PRAGMA table_info(account_identita)")
    .some((colonna) => colonna.name.includes("email")), false);
});

test("Discord si collega alla sessione Google senza creare un secondo account", async () => {
  const env = ambiente();
  const sessioneGoogle = await accedi(env);
  const inizio = await worker.fetch(new Request(
    "https://api.moxtracker.app/auth/discord?ritorno=/account.html",
    { headers: { cookie: sessioneGoogle } }), env);
  assert.equal(new URL(inizio.headers.get("location")).searchParams.get("scope"), "identify");
  const statoCookie = primaCookie(inizio);
  const stato = new URL(inizio.headers.get("location")).searchParams.get("state");
  const fine = await worker.fetch(new Request(
    `https://api.moxtracker.app/auth/discord/callback?code=codice&state=${stato}`,
    { headers: { cookie: `${sessioneGoogle}; ${statoCookie}` } }), env);
  assert.equal(fine.status, 302);
  assert.equal(env.DB.conta("account"), 1);
  assert.equal(env.DB.conta("account_identita"), 2);
  const sessioneDiscord = primaCookie(fine);
  const me = await worker.fetch(new Request("https://api.moxtracker.app/account/me", {
    headers: { cookie: sessioneDiscord, origin: "https://moxtracker.app" },
  }), env);
  const corpo = await me.json();
  assert.deepEqual(corpo.account.provider, ["discord", "google"]);
  assert.equal(corpo.account.nome, "Amico di Mox");
});

test("Mox si collega all'account anche senza inviare partite o Draft", async () => {
  const env = ambiente();
  const sessione = await accedi(env);
  const codiceRisposta = await worker.fetch(new Request(
    "https://api.moxtracker.app/account/link-code", {
      method: "POST", headers: { cookie: sessione },
    }), env);
  const { codice } = await codiceRisposta.json();
  const collegato = await worker.fetch(new Request(
    "https://api.moxtracker.app/mox/account/link", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ codice, mittente: "d".repeat(32),
        segreto: "e".repeat(64), nome: "PC senza contributi" }),
    }), env);
  assert.equal(collegato.status, 200);
  assert.equal(env.DB.conta("contributori"), 0);
  assert.equal(env.DB.conta("account_dispositivo"), 1);
  assert.equal(env.DB.tutte("SELECT segreto_hash FROM account_dispositivo")[0]
    .segreto_hash, await sha256("e".repeat(64)));
});

test("un codice collega Mox solo insieme al segreto dell'installazione", async () => {
  const env = ambiente();
  const sessione = await accedi(env);
  const mittente = "a".repeat(32);
  const segreto = "b".repeat(64);
  const hash = await sha256(segreto);
  await env.DB.batch([env.DB.prepare(`INSERT INTO contributori
    (mittente, cancellazione_hash, creato) VALUES (?, ?, ?)`)
    .bind(mittente, hash, new Date().toISOString())]);

  const codiceRisposta = await worker.fetch(new Request(
    "https://api.moxtracker.app/account/link-code", {
      method: "POST", headers: { cookie: sessione },
    }), env);
  const { codice } = await codiceRisposta.json();
  const sbagliato = await worker.fetch(new Request("https://api.moxtracker.app/mox/account/link", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ codice, mittente, segreto: "c".repeat(64) }),
  }), env);
  assert.equal(sbagliato.status, 403);

  const collegato = await worker.fetch(new Request("https://api.moxtracker.app/mox/account/link", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ codice, mittente, segreto, nome: "PC di prova" }),
  }), env);
  assert.equal(collegato.status, 200);
  assert.equal(env.DB.conta("account_dispositivo"), 1);
  assert.equal(env.DB.conta("account_codice_mox"), 0);
});

test("dashboard personale espone statistiche, mazzi e partite cliccabili", async () => {
  const env = ambiente();
  const sessione = await accedi(env);
  const mittente = "7".repeat(32);
  const segreto = "8".repeat(64);
  const codiceRisposta = await worker.fetch(new Request(
    "https://api.moxtracker.app/account/link-code", {
      method: "POST", headers: { cookie: sessione },
    }), env);
  const { codice } = await codiceRisposta.json();
  const collegato = await worker.fetch(new Request(
    "https://api.moxtracker.app/mox/account/link", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ codice, mittente, segreto, nome: "PC statistiche" }),
    }), env);
  assert.equal(collegato.status, 200);

  const partite = [
    partitaPersonale({ id: "1111111111", mittente, segreto }),
    partitaPersonale({ id: "2222222222", mittente, segreto, esito: "persa",
      quando: "2026-08-22T18:34:00Z", evento: "PickTwoDraft_HOB_20260811", formato: null }),
  ];
  const ingresso = await worker.fetch(new Request("https://api.moxtracker.app/partite", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ partite }),
  }), env);
  assert.equal(ingresso.status, 200);

  const stats = await worker.fetch(new Request("https://api.moxtracker.app/account/stats", {
    headers: { cookie: sessione, origin: "https://moxtracker.app" },
  }), env);
  assert.equal(stats.status, 200);
  const quadro = await stats.json();
  assert.deepEqual(quadro.totali, { partite: 2, vittorie: 1, sconfitte: 1,
    win_rate: 50, al_gioco: 1, alla_risposta: 1, durata_media: 300 });
  assert.equal(quadro.mazzi.length, 1);
  assert.equal(quadro.mazzi[0].formato, "Standard");
  assert.equal(quadro.mazzi[0].carte.reduce((n, carta) => n + carta.copie, 0), 60);
  assert.deepEqual(quadro.mazzi[0].carte.find((carta) => carta.arena_id === 103441),
    { arena_id: 103441, copie: 4, nome: "front porch sentries", set: "hob", numero: "67" });
  assert.equal(quadro.sessioni_limited.length, 1);
  assert.equal(quadro.sessioni_limited[0].nome, "HOB · Prendi Due");
  assert.equal(quadro.sessioni_limited[0].decklist.reduce(
    (n, carta) => n + carta.copie, 0), 60);
  assert.deepEqual(quadro.andamento_rank.map((p) => `${p.classe} ${p.livello}`), ["Gold 3"]);
  assert.equal(quadro.avversari.partite_totali, 1);
  assert.equal(quadro.avversari.non_riconosciuti, 1);

  const rinominato = await worker.fetch(new Request(
    `https://api.moxtracker.app/account/decks/${"a".repeat(64)}/name`, {
      method: "PUT", headers: { cookie: sessione, "content-type": "application/json" },
      body: JSON.stringify({ formato: "Standard", nome: "Aure bianche personali" }),
    }), env);
  assert.equal(rinominato.status, 200);
  assert.deepEqual(await rinominato.json(), { nome: "Aure bianche personali" });
  const statsRinominati = await worker.fetch(new Request(
    "https://api.moxtracker.app/account/stats", { headers: { cookie: sessione } }), env);
  assert.equal((await statsRinominati.json()).mazzi[0].nome_personalizzato,
    "Aure bianche personali");

  const elenco = await worker.fetch(new Request(
    "https://api.moxtracker.app/account/matches?limite=1&offset=0", {
      headers: { cookie: sessione },
    }), env);
  const cronologia = await elenco.json();
  assert.equal(cronologia.totale, 2);
  assert.equal(cronologia.partite.length, 1);
  const dettaglio = await worker.fetch(new Request(
    `https://api.moxtracker.app/account/matches/${cronologia.partite[0].id}`, {
      headers: { cookie: sessione },
    }), env);
  const corpo = await dettaglio.json();
  assert.equal(dettaglio.status, 200);
  assert.ok(corpo.partita.mazzo.carte);
  assert.equal("mittente" in corpo.partita, false);
  assert.equal("segreto_cancellazione" in corpo.partita, false);
  assert.ok(corpo.nomi_carte && typeof corpo.nomi_carte === "object");
  assert.ok(corpo.stampe_carte && typeof corpo.stampe_carte === "object");
  assert.deepEqual(corpo.stampe_carte["103441"], { set: "hob", numero: "67" });
});

test("l'export account non espone hash di sessione o altre credenziali", async () => {
  const env = ambiente();
  const sessione = await accedi(env);
  const risposta = await worker.fetch(new Request(
    "https://api.moxtracker.app/account/export", {
      headers: { cookie: sessione },
    }), env);
  assert.equal(risposta.status, 200);
  const testo = await risposta.text();
  const corpo = JSON.parse(testo);
  assert.deepEqual(Object.keys(corpo.account).sort(), ["id", "nome"]);
  assert.equal(testo.includes("sessioneHash"), false);
  assert.equal(testo.includes("mox_sessione"), false);
});

test("ticket anonimo richiede il link segreto e accetta risposte", async () => {
  const env = ambiente();
  const creato = await worker.fetch(new Request("https://api.moxtracker.app/ticket", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ categoria: "bug", titolo: "Il contatore si blocca",
      testo: "Il contatore si blocca dopo avere chiuso Arena e non riparte.",
      turnstile_token: "token-valido" }),
  }), env);
  assert.equal(creato.status, 201);
  const dato = await creato.json();
  assert.ok(dato.token);
  assert.equal(env.DB.tutte("SELECT accesso_hash FROM ticket")[0].accesso_hash,
    await sha256(dato.token));

  const negato = await worker.fetch(new Request(
    `https://api.moxtracker.app/ticket/${dato.ticket.id}`), env);
  assert.equal(negato.status, 403);
  const dettaglio = await worker.fetch(new Request(
    `https://api.moxtracker.app/ticket/${dato.ticket.id}?token=${dato.token}`), env);
  assert.equal(dettaglio.status, 200);

  const risposta = await worker.fetch(new Request(
    `https://api.moxtracker.app/ticket/${dato.ticket.id}/messages?token=${dato.token}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ testo: "Aggiungo che succede solo sul secondo monitor." }),
    }), env);
  assert.equal(risposta.status, 200);
  assert.equal(env.DB.conta("ticket_messaggio"), 2);
});

test("gli allegati controllano il contenuto e restano scaricabili solo dal proprietario", async () => {
  const env = ambiente();
  env.TICKET_FILES = fileTicketFinti();
  const creato = await worker.fetch(new Request("https://api.moxtracker.app/ticket", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ categoria: "bug", titolo: "Immagine diagnostica",
      testo: "Allego una schermata che mostra chiaramente il problema rilevato.",
      turnstile_token: "token-valido" }),
  }), env);
  const { ticket, token } = await creato.json();

  const falso = new FormData();
  falso.append("file", new File(["non e' un'immagine"], "falso.png", { type: "image/png" }));
  const rifiutato = await worker.fetch(new Request(
    `https://api.moxtracker.app/ticket/${ticket.id}/attachments?token=${token}`,
    { method: "POST", body: falso }), env);
  assert.equal(rifiutato.status, 415);

  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
  const valido = new FormData();
  valido.append("file", new File([png], "schermata.png", { type: "image/png" }));
  const caricato = await worker.fetch(new Request(
    `https://api.moxtracker.app/ticket/${ticket.id}/attachments?token=${token}`,
    { method: "POST", body: valido }), env);
  assert.equal(caricato.status, 201);
  const allegato = (await caricato.json()).allegato;
  assert.equal(env.DB.conta("ticket_allegato"), 1);

  const percorso = `https://api.moxtracker.app/ticket/${ticket.id}/attachments/${allegato.id}`;
  assert.equal((await worker.fetch(new Request(percorso), env)).status, 403);
  const scaricato = await worker.fetch(new Request(`${percorso}?token=${token}`), env);
  assert.equal(scaricato.status, 200);
  assert.equal(scaricato.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(new Uint8Array(await scaricato.arrayBuffer()), png);
});

test("i ticket autenticati compaiono nella cronologia dell'account", async () => {
  const env = ambiente();
  const sessione = await accedi(env);
  const creato = await worker.fetch(new Request("https://api.moxtracker.app/ticket", {
    method: "POST", headers: { "content-type": "application/json", cookie: sessione },
    body: JSON.stringify({ categoria: "sviluppo", titolo: "Aggiungere un filtro",
      testo: "Vorrei filtrare le statistiche personali anche per tipo di evento." }),
  }), env);
  assert.equal(creato.status, 201);
  assert.equal((await creato.json()).token, undefined);
  const elenco = await worker.fetch(new Request("https://api.moxtracker.app/account/tickets", {
    headers: { cookie: sessione },
  }), env);
  assert.equal(elenco.status, 200);
  assert.equal((await elenco.json()).ticket.length, 1);
});

test("Turnstile e rate limiter chiudono davvero il ticket anonimo", async () => {
  const env = ambiente();
  const corpo = { categoria: "bug", titolo: "Tentativo automatico",
    testo: "Questa richiesta anonima deve fermarsi senza una verifica valida." };
  const senzaVerifica = await worker.fetch(new Request("https://api.moxtracker.app/ticket", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  }), env);
  assert.equal(senzaVerifica.status, 403);
  env.TICKET_RATE_LIMITER = { limit: async () => ({ success: false }) };
  const limitato = await worker.fetch(new Request("https://api.moxtracker.app/ticket", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...corpo, turnstile_token: "token-valido" }),
  }), env);
  assert.equal(limitato.status, 429);
});

test("l'amministratore usa OAuth e ogni modifica del ticket viene registrata", async () => {
  const env = ambiente();
  const sessione = await accedi(env);
  const account = env.DB.tutte("SELECT id FROM account")[0].id;
  await env.DB.batch([env.DB.prepare(
    "UPDATE account SET ruolo = 'amministratore' WHERE id = ?").bind(account)]);
  const creato = await worker.fetch(new Request("https://api.moxtracker.app/ticket", {
    method: "POST", headers: { "content-type": "application/json", cookie: sessione },
    body: JSON.stringify({ categoria: "dati", titolo: "Dati non aggiornati",
      testo: "Le statistiche mostrate nella pagina sembrano ferme alla settimana scorsa." }),
  }), env);
  const id = (await creato.json()).ticket.id;
  const elenco = await worker.fetch(new Request("https://api.moxtracker.app/admin/tickets", {
    headers: { cookie: sessione },
  }), env);
  assert.equal(elenco.status, 200);
  assert.equal((await elenco.json()).ticket.length, 1);
  const aggiornato = await worker.fetch(new Request(
    `https://api.moxtracker.app/admin/ticket/${id}`, {
      method: "POST", headers: { "content-type": "application/json", cookie: sessione },
      body: JSON.stringify({ stato: "da_verificare",
        testo: "Ricevuto: verifichiamo la sorgente dei dati." }),
    }), env);
  assert.equal(aggiornato.status, 200);
  assert.equal(env.DB.conta("ticket_audit"), 1);
  assert.equal(env.DB.tutte("SELECT account_id, azione FROM ticket_audit")[0].account_id,
    account);
  assert.equal(env.DB.tutte("SELECT stato FROM ticket")[0].stato, "da_verificare");
});

test("la pulizia elimina allegati e ticket chiusi secondo la retention", async () => {
  const env = ambiente();
  env.TICKET_FILES = fileTicketFinti();
  const vecchio = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
  await env.TICKET_FILES.put("ticket/vecchio/file", new Uint8Array([1, 2, 3]));
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO ticket
      (id, account_id, accesso_hash, categoria, titolo, stato, versione_mox,
       diagnostica_id, creato, aggiornato) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind("1".repeat(32), null, "hash", "bug", "Ticket vecchio", "chiuso",
        null, null, vecchio, vecchio),
    env.DB.prepare(`INSERT INTO ticket_messaggio
      (id, ticket_id, autore, testo, creato) VALUES (?, ?, ?, ?, ?)`)
      .bind("2".repeat(32), "1".repeat(32), "utente", "testo", vecchio),
    env.DB.prepare(`INSERT INTO ticket_allegato
      (id, ticket_id, nome, tipo, byte, oggetto_r2, creato)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).bind("3".repeat(32), "1".repeat(32),
        "vecchio.png", "image/png", 3, "ticket/vecchio/file", vecchio),
  ]);
  const esito = await pulisciTicketScaduti(env);
  assert.equal(esito.allegati_eliminati, 1);
  assert.equal(esito.ticket_eliminati, 1);
  assert.equal(env.DB.conta("ticket"), 0);
  assert.equal(env.DB.conta("ticket_allegato"), 0);
  assert.equal(env.TICKET_FILES.oggetti.size, 0);
});

async function collegaUnMox(env, mittente, segreto) {
  const sessione = await accedi(env);
  const codiceRisposta = await worker.fetch(new Request(
    "https://api.moxtracker.app/account/link-code", {
      method: "POST", headers: { cookie: sessione },
    }), env);
  const { codice } = await codiceRisposta.json();
  const collegato = await worker.fetch(new Request(
    "https://api.moxtracker.app/mox/account/link", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ codice, mittente, segreto, nome: "PC di prova" }),
    }), env);
  assert.equal(collegato.status, 200);
  return sessione;
}

function sincronizza(env, corpo) {
  return worker.fetch(new Request("https://api.moxtracker.app/mox/account/decks", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  }), env);
}

test("i mazzi veri di Arena arrivano con il loro nome e si uniscono alle partite", async () => {
  const env = ambiente();
  const mittente = "a".repeat(32);
  const segreto = "b".repeat(64);
  const sessione = await collegaUnMox(env, mittente, segreto);
  // L'impronta e' quella che partitaPersonale usa nel suo pacchetto: e'
  // l'unione fra mazzo reale e partite gia' ricevute che questa prova guarda.
  const impronta = "a".repeat(64);
  await worker.fetch(new Request("https://api.moxtracker.app/partite", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify([partitaPersonale({ id: "aa00bb11cc", mittente, segreto })]),
  }), env);

  const esito = await sincronizza(env, { mittente, segreto, mazzi: [
    { impronta, nome: "Tritoni Pedine", carte: { "90000": 4, "90001": 56 },
      sideboard: { "90002": 15 }, colori: "U", aggiornato: "2026-08-23T08:00:00Z" },
    { impronta: "2".repeat(64), nome: "Danitha, New Benalia's Light",
      carte: { "90003": 99 }, colori: "WG" },
    { impronta: "non valida", nome: "scartato", carte: { "1": 1 } },
    { impronta: "3".repeat(64), nome: "", carte: { "4": 4 } },
  ] });
  assert.equal(esito.status, 200);
  const contati = await esito.json();
  assert.equal(contati.sincronizzati, 2);
  assert.equal(contati.scartati, 2);

  const stat = await worker.fetch(new Request(
    "https://api.moxtracker.app/account/stats", { headers: { cookie: sessione } }), env);
  const dati = await stat.json();
  const giocato = dati.mazzi.find((m) => m.impronta === impronta);
  assert.equal(giocato.nome, "Tritoni Pedine");
  assert.equal(giocato.in_arena, true);
  assert.equal(giocato.partite, 1);
  const maiGiocato = dati.mazzi.find((m) => m.impronta === "2".repeat(64));
  assert.equal(maiGiocato.nome, "Danitha, New Benalia's Light");
  assert.equal(maiGiocato.partite, 0);
  assert.equal(maiGiocato.win_rate, null);
});

test("il nome del mazzo resta privato: non entra nel meta pubblico", async () => {
  const env = ambiente();
  const mittente = "c".repeat(32);
  const segreto = "d".repeat(64);
  await collegaUnMox(env, mittente, segreto);
  await sincronizza(env, { mittente, segreto, mazzi: [
    { impronta: "4".repeat(64), nome: "Mazzo con il mio nome vero dentro",
      carte: { "90010": 60 }, colori: "W" },
  ] });
  const meta = await worker.fetch(new Request(
    "https://api.moxtracker.app/meta?formato=Standard"), env);
  const testo = await meta.text();
  assert.doesNotMatch(testo, /nome vero dentro/);
});

test("sincronizzare e' una fotografia: quello che togli da Arena sparisce", async () => {
  const env = ambiente();
  const mittente = "e".repeat(32);
  const segreto = "f".repeat(64);
  const sessione = await collegaUnMox(env, mittente, segreto);
  await sincronizza(env, { mittente, segreto, mazzi: [
    { impronta: "5".repeat(64), nome: "Uno", carte: { "1": 60 } },
    { impronta: "6".repeat(64), nome: "Due", carte: { "2": 60 } },
  ] });
  assert.equal(env.DB.conta("account_mazzo"), 2);
  await sincronizza(env, { mittente, segreto, mazzi: [
    { impronta: "5".repeat(64), nome: "Uno rinominato", carte: { "1": 60 } },
  ] });
  assert.equal(env.DB.conta("account_mazzo"), 1);
  const stat = await worker.fetch(new Request(
    "https://api.moxtracker.app/account/stats", { headers: { cookie: sessione } }), env);
  const dati = await stat.json();
  assert.equal(dati.mazzi.length, 1);
  assert.equal(dati.mazzi[0].nome, "Uno rinominato");
});

test("i mazzi non partono senza il segreto dell'installazione collegata", async () => {
  const env = ambiente();
  const mittente = "1".repeat(32);
  const segreto = "2".repeat(64);
  await collegaUnMox(env, mittente, segreto);
  const sbagliato = await sincronizza(env, { mittente, segreto: "3".repeat(64),
    mazzi: [{ impronta: "7".repeat(64), nome: "Non deve entrare", carte: { "1": 60 } }] });
  assert.equal(sbagliato.status, 403);
  const estraneo = await sincronizza(env, { mittente: "9".repeat(32), segreto,
    mazzi: [{ impronta: "8".repeat(64), nome: "Nemmeno questo", carte: { "1": 60 } }] });
  assert.equal(estraneo.status, 403);
  assert.equal(env.DB.conta("account_mazzo"), 0);
});
