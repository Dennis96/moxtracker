// Account facoltativi, OAuth e collegamento sicuro delle installazioni Mox.

import { eliminaMittente, sha256 } from "./draft.js";
import { classificaFirma, classificaImpronte, firmaDaCarte,
  nomeCartaArena, stampaCartaArena } from "./archetipi.js";

const PROVIDER = new Set(["google", "discord"]);
const DURATA_STATO = 10 * 60 * 1000;
const DURATA_CODICE = 10 * 60 * 1000;
const DURATA_SESSIONE = 30 * 24 * 60 * 60 * 1000;
const ESADECIMALE = /^[0-9a-f]+$/;
const ALFABETO_CODICE = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function casuali(byte = 32) {
  const dati = new Uint8Array(byte);
  crypto.getRandomValues(dati);
  return [...dati].map((n) => n.toString(16).padStart(2, "0")).join("");
}

function codiceBreve() {
  const dati = new Uint8Array(9);
  crypto.getRandomValues(dati);
  return [...dati].map((n) => ALFABETO_CODICE[n % ALFABETO_CODICE.length]).join("");
}

function cookie(richiesta, nome) {
  const voci = (richiesta.headers.get("cookie") || "").split(";");
  for (const voce of voci) {
    const [chiave, ...resto] = voce.trim().split("=");
    if (chiave === nome) return decodeURIComponent(resto.join("="));
  }
  return null;
}

function origineSito(ambiente) {
  return String(ambiente.SITE_ORIGIN || "https://moxtracker.app").replace(/\/$/, "");
}

function originiSito(ambiente) {
  return [origineSito(ambiente), ambiente.PREVIEW_ORIGIN]
    .filter(Boolean)
    .map((origine) => String(origine).replace(/\/$/, ""));
}

function origineConsentita(richiesta, ambiente) {
  const origine = richiesta.headers.get("origin");
  return origine && originiSito(ambiente).includes(origine) ? origine : null;
}

function headersPrivati(richiesta, ambiente, altri = {}) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    vary: "Origin",
    ...altri,
  };
  const origine = origineConsentita(richiesta, ambiente);
  if (origine) {
    headers["access-control-allow-origin"] = origine;
    headers["access-control-allow-credentials"] = "true";
    headers["access-control-allow-headers"] = "content-type, authorization";
    headers["access-control-allow-methods"] = "GET, POST, PUT, DELETE, OPTIONS";
  }
  return headers;
}

export function rispostaAccount(richiesta, ambiente, corpo, stato = 200, altri = {}) {
  return new Response(JSON.stringify(corpo, null, 2) + "\n", {
    status: stato, headers: headersPrivati(richiesta, ambiente, altri),
  });
}

export function preflightAccount(richiesta, ambiente) {
  const origine = origineConsentita(richiesta, ambiente);
  return new Response(null, { status: origine ? 204 : 403,
    headers: headersPrivati(richiesta, ambiente) });
}

function reindirizza(indirizzo, cookieDaScrivere = null) {
  const headers = { location: indirizzo, "cache-control": "no-store" };
  if (cookieDaScrivere) headers["set-cookie"] = cookieDaScrivere;
  return new Response(null, { status: 302, headers });
}

function scadenza(daOra) {
  return new Date(Date.now() + daOra).toISOString();
}

function cookieSessione(token, durata = Math.floor(DURATA_SESSIONE / 1000)) {
  // La preview Pages e l'API sono su siti diversi: None e' necessario per le
  // richieste fetch con credenziali. CORS resta limitato alle due origini esatte.
  return `mox_sessione=${encodeURIComponent(token)}; Path=/; Max-Age=${durata}; HttpOnly; Secure; SameSite=None`;
}

function cookieStato(token, durata = Math.floor(DURATA_STATO / 1000)) {
  return `mox_oauth_stato=${encodeURIComponent(token)}; Path=/auth/; Max-Age=${durata}; HttpOnly; Secure; SameSite=Lax`;
}

function configurazioneProvider(provider, ambiente, origine) {
  const callback = `${origine}/auth/${provider}/callback`;
  if (provider === "google") return {
    clientId: ambiente.GOOGLE_CLIENT_ID,
    clientSecret: ambiente.GOOGLE_CLIENT_SECRET,
    autorizza: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    profilo: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid profile", callback,
  };
  return {
    clientId: ambiente.DISCORD_CLIENT_ID,
    clientSecret: ambiente.DISCORD_CLIENT_SECRET,
    autorizza: "https://discord.com/oauth2/authorize",
    token: "https://discord.com/api/oauth2/token",
    profilo: "https://discord.com/api/users/@me",
    scope: "identify", callback,
  };
}

function ritornoSicuro(indirizzo, ambiente) {
  const base = origineSito(ambiente);
  const richiesto = indirizzo.searchParams.get("ritorno") || "/account.html";
  try {
    const destinazione = new URL(richiesto, `${base}/`);
    const consentite = originiSito(ambiente).map((origine) => new URL(origine).origin);
    return consentite.includes(destinazione.origin)
      ? destinazione.toString() : `${base}/account.html`;
  } catch { return `${base}/account.html`; }
}

function ritornoOAuth(ritorno, sessione, ambiente) {
  const preview = ambiente.PREVIEW_ORIGIN && String(ambiente.PREVIEW_ORIGIN).replace(/\/$/, "");
  if (!preview) return ritorno;
  const destinazione = new URL(ritorno);
  if (destinazione.origin !== new URL(preview).origin) return ritorno;
  // pages.dev e api.moxtracker.app sono siti diversi: alcuni browser bloccano
  // il cookie terza parte. Il frammento non viaggia in rete e viene conservato
  // solo nella sessionStorage della preview, poi passato come Bearer via HTTPS.
  destinazione.hash = `mox_session=${encodeURIComponent(sessione)}`;
  return destinazione.toString();
}

async function iniziaOAuth(provider, richiesta, ambiente, indirizzo) {
  const origine = new URL(richiesta.url).origin;
  const config = configurazioneProvider(provider, ambiente, origine);
  if (!config.clientId || !config.clientSecret) {
    return rispostaAccount(richiesta, ambiente,
      { errore: `accesso ${provider} non configurato` }, 503);
  }
  const stato = casuali();
  const ora = new Date().toISOString();
  await ambiente.DB.batch([ambiente.DB.prepare(`INSERT INTO account_oauth_stato
    (hash, provider, ritorno, creato, scade) VALUES (?, ?, ?, ?, ?)`).bind(
      await sha256(stato), provider, ritornoSicuro(indirizzo, ambiente), ora,
      scadenza(DURATA_STATO))]);
  const destinazione = new URL(config.autorizza);
  destinazione.searchParams.set("client_id", config.clientId);
  destinazione.searchParams.set("redirect_uri", config.callback);
  destinazione.searchParams.set("response_type", "code");
  destinazione.searchParams.set("scope", config.scope);
  destinazione.searchParams.set("state", stato);
  if (provider === "google") destinazione.searchParams.set("prompt", "select_account");
  return reindirizza(destinazione.toString(), cookieStato(stato));
}

async function profiloOAuth(provider, codice, config, recupera) {
  const modulo = new URLSearchParams({
    client_id: config.clientId, client_secret: config.clientSecret,
    code: codice, grant_type: "authorization_code", redirect_uri: config.callback,
  });
  const rispostaToken = await recupera(config.token, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: modulo.toString(),
  });
  if (!rispostaToken.ok) throw new Error("scambio del codice OAuth non riuscito");
  const token = await rispostaToken.json();
  if (!token.access_token) throw new Error("token OAuth assente");
  const rispostaProfilo = await recupera(config.profilo, {
    headers: { authorization: `Bearer ${token.access_token}`, accept: "application/json" },
  });
  if (!rispostaProfilo.ok) throw new Error("profilo OAuth non leggibile");
  const dato = await rispostaProfilo.json();
  if (provider === "google") return {
    soggetto: String(dato.sub || ""), nome: String(dato.name || "Utente Mox"),
    avatar: dato.picture || null,
  };
  return {
    soggetto: String(dato.id || ""),
    nome: String(dato.global_name || dato.username || "Utente Mox"),
    avatar: dato.avatar ? `https://cdn.discordapp.com/avatars/${dato.id}/${dato.avatar}.png` : null,
  };
}

async function salvaIdentita(db, provider, profilo, accountCollegamento = null) {
  if (!profilo.soggetto || profilo.soggetto.length > 200) {
    throw new Error("identificativo OAuth non valido");
  }
  const esistente = await db.prepare(`SELECT account_id FROM account_identita
    WHERE provider = ? AND soggetto = ?`).bind(provider, profilo.soggetto).first();
  if (accountCollegamento && esistente && esistente.account_id !== accountCollegamento) {
    throw new Error("identita OAuth gia collegata a un altro account");
  }
  if (accountCollegamento && !esistente) {
    const stessoProvider = await db.prepare(`SELECT soggetto FROM account_identita
      WHERE account_id = ? AND provider = ?`).bind(accountCollegamento, provider).first();
    if (stessoProvider) throw new Error("provider OAuth gia collegato all'account");
  }
  const accountId = esistente?.account_id || accountCollegamento || casuali(16);
  const ora = new Date().toISOString();
  const nome = profilo.nome.slice(0, 80);
  if (esistente) {
    if (!accountCollegamento) await db.batch([
      db.prepare("UPDATE account SET nome = ?, avatar = ?, aggiornato = ? WHERE id = ?")
        .bind(nome, profilo.avatar, ora, accountId),
    ]);
  } else if (accountCollegamento) {
    await db.batch([
      db.prepare(`INSERT INTO account_identita
        (provider, soggetto, account_id) VALUES (?, ?, ?)`)
        .bind(provider, profilo.soggetto, accountId),
      db.prepare("UPDATE account SET aggiornato = ? WHERE id = ?").bind(ora, accountId),
    ]);
  } else {
    await db.batch([
      db.prepare(`INSERT INTO account (id, nome, avatar, creato, aggiornato)
        VALUES (?, ?, ?, ?, ?)`).bind(accountId, nome, profilo.avatar, ora, ora),
      db.prepare(`INSERT INTO account_identita
        (provider, soggetto, account_id)
        VALUES (?, ?, ?)`).bind(provider, profilo.soggetto, accountId),
    ]);
  }
  return accountId;
}

async function completaOAuth(provider, richiesta, ambiente, indirizzo) {
  const stato = indirizzo.searchParams.get("state") || "";
  const codice = indirizzo.searchParams.get("code") || "";
  if (!stato || stato !== cookie(richiesta, "mox_oauth_stato") || !codice) {
    return rispostaAccount(richiesta, ambiente, { errore: "risposta OAuth non valida" }, 400,
      { "set-cookie": cookieStato("", 0) });
  }
  const statoHash = await sha256(stato);
  const registrato = await ambiente.DB.prepare(`SELECT provider, ritorno, scade
    FROM account_oauth_stato WHERE hash = ?`).bind(statoHash).first();
  await ambiente.DB.batch([
    ambiente.DB.prepare("DELETE FROM account_oauth_stato WHERE hash = ?").bind(statoHash),
  ]);
  if (!registrato || registrato.provider !== provider || registrato.scade <= new Date().toISOString()) {
    return rispostaAccount(richiesta, ambiente, { errore: "accesso scaduto o gia usato" }, 400,
      { "set-cookie": cookieStato("", 0) });
  }
  try {
    const config = configurazioneProvider(provider, ambiente, new URL(richiesta.url).origin);
    const profilo = await profiloOAuth(provider, codice, config,
      ambiente.OAUTH_FETCH || fetch);
    const sessioneEsistente = await utenteDallaSessione(richiesta, ambiente);
    const accountId = await salvaIdentita(ambiente.DB, provider, profilo,
      sessioneEsistente?.id || null);
    const sessione = casuali();
    const ora = new Date().toISOString();
    await ambiente.DB.batch([ambiente.DB.prepare(`INSERT INTO account_sessione
      (hash, account_id, creato, scade) VALUES (?, ?, ?, ?)`).bind(
        await sha256(sessione), accountId, ora, scadenza(DURATA_SESSIONE))]);
    return reindirizza(ritornoOAuth(registrato.ritorno, sessione, ambiente), cookieSessione(sessione));
  } catch (guasto) {
    console.error("guasto OAuth", provider, String(guasto));
    return rispostaAccount(richiesta, ambiente, { errore: "accesso OAuth non riuscito" }, 502,
      { "set-cookie": cookieStato("", 0) });
  }
}

export async function utenteDallaSessione(richiesta, ambiente) {
  const daCookie = cookie(richiesta, "mox_sessione");
  const bearer = richiesta.headers.get("authorization") || "";
  const token = daCookie || bearer.match(/^Bearer ([0-9a-f]{64})$/i)?.[1] || null;
  if (!token) return null;
  const hash = await sha256(token);
  const riga = await ambiente.DB.prepare(`SELECT a.id, a.nome, a.avatar, a.ruolo, s.scade
    FROM account_sessione s JOIN account a ON a.id = s.account_id
    WHERE s.hash = ?`).bind(hash).first();
  if (!riga || riga.scade <= new Date().toISOString()) {
    if (riga) await ambiente.DB.batch([
      ambiente.DB.prepare("DELETE FROM account_sessione WHERE hash = ?").bind(hash),
    ]);
    return null;
  }
  return { id: riga.id, nome: riga.nome, avatar: riga.avatar,
    ruolo: riga.ruolo || "utente", sessioneHash: hash };
}

async function providerAccount(db, accountId) {
  const risultato = await db.prepare(`SELECT provider FROM account_identita
    WHERE account_id = ? ORDER BY provider`).bind(accountId).all();
  return (risultato.results || []).map((riga) => riga.provider);
}

async function corpoJson(richiesta) {
  try { return await richiesta.json(); } catch { return null; }
}

async function richiedeUtente(richiesta, ambiente) {
  const utente = await utenteDallaSessione(richiesta, ambiente);
  return utente || rispostaAccount(richiesta, ambiente, { errore: "accesso richiesto" }, 401,
    { "set-cookie": cookieSessione("", 0) });
}

async function dispositivi(db, accountId) {
  const esito = await db.prepare(`SELECT mittente, nome, collegato,
      consenso_partite, consenso_draft, consensi_aggiornati
    FROM account_dispositivo WHERE account_id = ? ORDER BY collegato DESC`)
    .bind(accountId).all();
  return (esito.results || []).map((dispositivo) => ({
    ...dispositivo,
    consenso_partite: dispositivo.consenso_partite === null ||
      dispositivo.consenso_partite === undefined ? null
      : Boolean(dispositivo.consenso_partite),
    consenso_draft: dispositivo.consenso_draft === null ||
      dispositivo.consenso_draft === undefined ? null
      : Boolean(dispositivo.consenso_draft),
  }));
}

function percentuale(parte, totale) {
  return totale ? Math.round((Number(parte) * 10000) / Number(totale)) / 100 : null;
}

function chiaveMazzo(formato, impronta) {
  return `${String(formato || "")}\u0000${String(impronta || "")}`;
}

function cartaPersonale(arenaId, copie = 1) {
  return { arena_id: Number(arenaId), copie: Number(copie),
    nome: nomeCartaArena(arenaId), ...(stampaCartaArena(arenaId) || {}) };
}

function catalogoCarte(ids) {
  return Object.fromEntries([...new Set((ids || []).map(Number).filter(Number.isInteger))]
    .map((id) => [String(id), nomeCartaArena(id)]).filter(([, nome]) => nome));
}

function catalogoStampe(ids) {
  return Object.fromEntries([...new Set((ids || []).map(Number).filter(Number.isInteger))]
    .map((id) => [String(id), stampaCartaArena(id)]).filter(([, stampa]) => stampa));
}

// Il nome grezzo che Arena scrive nel log non e' fatto per essere letto:
// "DualColorPrecons", "jump_in", "Constructed_Event_Standard_20260801". Qui
// diventa leggibile, ma senza inventare: quello che non riconosciamo viene
// ripulito, non tradotto a indovinare.
function etichettaEvento(evento) {
  const testo = String(evento || "").trim();
  if (!testo) return "Evento sconosciuto";
  const set = testo.match(/(?:Draft|Sealed)_([A-Z0-9]{3,6})_/i)?.[1]?.toUpperCase();
  const limitato = /PickTwoDraft/i.test(testo) ? "Prendi Due"
    : /PremierDraft/i.test(testo) ? "Premier Draft"
      : /QuickDraft/i.test(testo) ? "Quick Draft"
        : /TradDraft/i.test(testo) ? "Traditional Draft"
          : /Sealed/i.test(testo) ? "Sealed"
            : /Draft/i.test(testo) ? "Draft" : null;
  if (limitato) return set ? `${set} · ${limitato}` : limitato;
  const minuscolo = testo.toLowerCase();
  if (minuscolo === "ladder") return "Ladder";
  if (minuscolo === "traditional_ladder") return "Ladder tradizionale";
  if (minuscolo.startsWith("constructed_event")) return "Evento costruito";
  if (minuscolo.startsWith("dualcolorprecons")) return "Mazzi precostruiti";
  if (minuscolo.startsWith("welcomedeckduels")) return "Mazzi di benvenuto";
  if (minuscolo.startsWith("jump_in") || minuscolo.startsWith("jumpin")) return "Jump In";
  if (minuscolo.startsWith("brawl") || minuscolo.includes("_brawl")) return "Brawl";
  return testo.replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ").trim();
}

async function statistichePersonali(ambiente, accountId) {
  const device = await dispositivi(ambiente.DB, accountId);
  if (!device.length) return {
    totali: { partite: 0, vittorie: 0, sconfitte: 0, win_rate: null,
      al_gioco: 0, alla_risposta: 0, durata_media: null },
    mazzi: [], forma_recente: [], sessioni_limited: [], andamento_rank: [],
    eventi: [], sincronizzazione: { mazzi: 0, quando: null },
    avversari: { riconosciuti: [], non_riconosciuti: 0, partite_totali: 0 },
  };
  const mittenti = device.map((d) => d.mittente);
  const segni = mittenti.map(() => "?").join(", ");
  const totale = await ambiente.DB.prepare(`SELECT COUNT(*) AS partite,
      SUM(CASE WHEN esito = 'vinta' THEN 1 ELSE 0 END) AS vittorie,
      SUM(CASE WHEN esito = 'persa' THEN 1 ELSE 0 END) AS sconfitte,
      SUM(CASE WHEN su_gioco = 1 THEN 1 ELSE 0 END) AS al_gioco,
      SUM(CASE WHEN su_gioco = 0 THEN 1 ELSE 0 END) AS alla_risposta,
      AVG(durata) AS durata_media
    FROM partite WHERE mittente IN (${segni})`).bind(...mittenti).first();
  const gruppi = await ambiente.DB.prepare(`SELECT impronta_mazzo AS impronta,
      formato, MAX(evento) AS evento, COUNT(*) AS partite,
      SUM(CASE WHEN esito = 'vinta' THEN 1 ELSE 0 END) AS vittorie,
      SUM(CASE WHEN esito = 'persa' THEN 1 ELSE 0 END) AS sconfitte,
      MAX(COALESCE(quando, ricevuta)) AS ultima
    FROM partite WHERE mittente IN (${segni}) AND impronta_mazzo IS NOT NULL
      AND formato IS NOT NULL
      AND lower(COALESCE(evento, '')) NOT LIKE '%draft%'
      AND lower(COALESCE(evento, '')) NOT LIKE '%precon%'
    GROUP BY formato, impronta_mazzo ORDER BY partite DESC, ultima DESC`)
    .bind(...mittenti).all();
  const righeCarte = await ambiente.DB.prepare(`SELECT p.formato,
      p.impronta_mazzo AS impronta, cm.carta, MAX(cm.copie) AS copie
    FROM partite p JOIN carte_mazzo cm ON cm.partita = p.id
    WHERE p.mittente IN (${segni}) AND p.impronta_mazzo IS NOT NULL
    GROUP BY p.formato, p.impronta_mazzo, cm.carta
    ORDER BY p.formato, p.impronta_mazzo, cm.carta`).bind(...mittenti).all();
  const cartePerMazzo = new Map();
  for (const riga of righeCarte.results || []) {
    const chiave = chiaveMazzo(riga.formato, riga.impronta);
    if (!cartePerMazzo.has(chiave)) cartePerMazzo.set(chiave, []);
    cartePerMazzo.get(chiave).push(cartaPersonale(riga.carta, riga.copie));
  }
  const classificazioni = new Map();
  for (const formato of new Set((righeCarte.results || []).map((r) => r.formato).filter(Boolean))) {
    const righe = (righeCarte.results || []).filter((r) => r.formato === formato);
    for (const [impronta, classificazione] of classificaImpronte(righe, formato)) {
      classificazioni.set(chiaveMazzo(formato, impronta), classificazione);
    }
  }
  const sincronizzati = await mazziSincronizzati(ambiente.DB, accountId);
  const inArena = new Map(sincronizzati.map((m) => [m.impronta, m]));
  const nomiSalvati = await ambiente.DB.prepare(`SELECT formato, impronta, nome
    FROM account_mazzo_nome WHERE account_id = ?`).bind(accountId).all();
  const nomiPerMazzo = new Map((nomiSalvati.results || []).map((riga) =>
    [chiaveMazzo(riga.formato, riga.impronta), riga.nome]));
  const mazzi = (gruppi.results || []).map((riga) => {
    const chiave = chiaveMazzo(riga.formato, riga.impronta);
    const c = classificazioni.get(chiave) || null;
    const partite = Number(riga.partite || 0);
    const vittorie = Number(riga.vittorie || 0);
    // Il nome vero del mazzo, quello scritto in Arena, vale piu' di un
    // archetipo dedotto: e' l'unico che l'utente riconosce. Sotto resta
    // sempre visibile l'archetipo, che e' quello che conta per il meta.
    const arena = inArena.get(riga.impronta) || null;
    return {
      impronta: riga.impronta, formato: riga.formato, evento: riga.evento,
      nome_personalizzato: nomiPerMazzo.get(chiave) || null,
      nome: arena?.nome || c?.nome_pubblico || c?.archetipo || null,
      nome_arena: arena?.nome || null,
      archetipo: c?.nome_pubblico || c?.archetipo || null,
      in_arena: Boolean(arena),
      archetipo_id: c?.archetipo_id || null,
      strategia: c?.strategia || null, colori: c?.colori || [],
      modalita: c?.modalita || null, livello_classificazione: c?.livello_classificazione || null,
      partite, vittorie, sconfitte: Number(riga.sconfitte || 0),
      win_rate: percentuale(vittorie, partite), ultima: riga.ultima,
      carte: cartePerMazzo.get(chiave) || [],
    };
  });
  // I mazzi che esistono in Arena ma non hanno ancora una partita ricevuta:
  // ci sono, e dirlo e' meglio che farli sparire finche' non li giochi.
  const conPartite = new Set(mazzi.map((m) => m.impronta));
  for (const arena of sincronizzati) {
    if (conPartite.has(arena.impronta)) continue;
    mazzi.push({
      impronta: arena.impronta, formato: null, evento: null,
      nome_personalizzato: null, nome: arena.nome, nome_arena: arena.nome,
      archetipo: null, in_arena: true, archetipo_id: null, strategia: null,
      colori: (arena.colori || "").split(""), modalita: null,
      livello_classificazione: null, partite: 0, vittorie: 0, sconfitte: 0,
      win_rate: null, ultima: null,
      carte: Object.entries(arena.carte || {})
        .map(([id, copie]) => cartaPersonale(Number(id), Number(copie))),
    });
  }

  // Il menu «Evento» della cronologia si riempiva dalle sole sessioni
  // Limited: Ladder, precostruiti e Jump In non erano nemmeno filtrabili,
  // anche se il filtro lato server accettava già qualsiasi evento.
  const eventiRighe = await ambiente.DB.prepare(`SELECT evento,
      COUNT(*) AS partite, MAX(COALESCE(quando, ricevuta)) AS ultima
    FROM partite WHERE mittente IN (${segni}) AND evento IS NOT NULL
      AND evento <> '' GROUP BY evento ORDER BY partite DESC, ultima DESC`)
    .bind(...mittenti).all();
  const eventi = (eventiRighe.results || []).map((riga) => ({
    valore: riga.evento, nome: etichettaEvento(riga.evento),
    partite: Number(riga.partite || 0),
  }));

  const forma = await ambiente.DB.prepare(`SELECT id, esito, quando, ricevuta
    FROM partite WHERE mittente IN (${segni})
    ORDER BY COALESCE(quando, ricevuta) DESC LIMIT 10`).bind(...mittenti).all();
  let partiteConTraccia = new Set();
  if (ambiente.DRAFT_DB) {
    const link = await ambiente.DRAFT_DB.prepare(`SELECT l.partita FROM draft_link l
      JOIN draft d ON d.id = l.draft_id WHERE d.mittente IN (${segni})
      AND (d.completo = 1 OR d.pick > 0)`)
      .bind(...mittenti).all();
    partiteConTraccia = new Set((link.results || []).map((riga) => riga.partita));
  }
  const limited = await ambiente.DB.prepare(`SELECT id, evento, esito, quando, ricevuta,
      impronta_mazzo
    FROM partite WHERE mittente IN (${segni}) AND formato IS NULL
      AND lower(COALESCE(evento, '')) LIKE '%draft%'
    ORDER BY COALESCE(quando, ricevuta), evento, id`).bind(...mittenti).all();
  const sessioni = [];
  for (const partita of limited.results || []) {
    // Se il client ha registrato il riferimento Arena, `draft_link` e' la
    // fonte esatta. Non mostriamo di nuovo la stessa partita in un gruppo
    // euristico destinato ai soli log storici senza collegamento.
    if (partiteConTraccia.has(partita.id)) continue;
    const istante = new Date(partita.quando || partita.ricevuta).getTime();
    let sessione = sessioni.at(-1);
    if (!sessione || sessione.evento !== partita.evento ||
        !Number.isFinite(istante) || istante - sessione._ultimaMs > 12 * 60 * 60 * 1000) {
      sessione = { id: `${partita.evento}:${partita.quando || partita.ricevuta}`,
        evento: partita.evento, nome: etichettaEvento(partita.evento),
        iniziata: partita.quando || partita.ricevuta, finita: partita.quando || partita.ricevuta,
        partite: 0, vittorie: 0, sconfitte: 0, partite_id: [], decklist: [],
        impronta_mazzo: null, _ultimaMs: istante };
      sessioni.push(sessione);
    }
    sessione.partite += 1;
    if (partita.esito === "vinta") sessione.vittorie += 1;
    if (partita.esito === "persa") sessione.sconfitte += 1;
    sessione.finita = partita.quando || partita.ricevuta;
    sessione.partite_id.push(partita.id);
    if (partita.impronta_mazzo) {
      sessione.impronta_mazzo = partita.impronta_mazzo;
      sessione.decklist = cartePerMazzo.get(chiaveMazzo(null, partita.impronta_mazzo)) || [];
    }
    sessione._ultimaMs = istante;
  }
  for (const sessione of sessioni) {
    sessione.win_rate = percentuale(sessione.vittorie, sessione.partite);
    delete sessione._ultimaMs;
  }
  const partite = Number(totale?.partite || 0);
  const vittorie = Number(totale?.vittorie || 0);
  const rank = await ambiente.DB.prepare(`SELECT id, COALESCE(quando, ricevuta) AS data,
      rank_classe AS classe, rank_livello AS livello
    FROM partite WHERE mittente IN (${segni}) AND formato IS NOT NULL
      AND rank_stato IN ('completo', 'dedotto')
      AND rank_classe IS NOT NULL AND rank_livello IS NOT NULL
    ORDER BY COALESCE(quando, ricevuta)`).bind(...mittenti).all();
  const ordineRank = new Map([["Bronze", 0], ["Silver", 1], ["Gold", 2],
    ["Platinum", 3], ["Diamond", 4], ["Mythic", 5]]);
  const andamentoRank = [];
  for (const punto of rank.results || []) {
    const base = ordineRank.get(punto.classe);
    if (base === undefined) continue;
    const voce = { id: punto.id, data: punto.data, classe: punto.classe,
      livello: Number(punto.livello), valore: base * 4 + (5 - Number(punto.livello)) };
    const precedente = andamentoRank.at(-1);
    if (precedente?.classe === voce.classe && precedente?.livello === voce.livello) {
      andamentoRank[andamentoRank.length - 1] = voce;
    } else andamentoRank.push(voce);
  }
  const carteAvversari = await ambiente.DB.prepare(`SELECT p.id, p.esito, p.formato,
      ca.carta FROM partite p LEFT JOIN carte_avversario ca ON ca.partita = p.id
    WHERE p.mittente IN (${segni}) AND p.formato IS NOT NULL
    ORDER BY p.id, ca.carta`).bind(...mittenti).all();
  const perPartita = new Map();
  for (const riga of carteAvversari.results || []) {
    if (!perPartita.has(riga.id)) perPartita.set(riga.id,
      { esito: riga.esito, formato: riga.formato, carte: [] });
    if (Number.isInteger(Number(riga.carta))) {
      perPartita.get(riga.id).carte.push({ carta: riga.carta, copie: 1 });
    }
  }
  const gruppiAvversari = new Map();
  let nonRiconosciuti = 0;
  for (const partita of perPartita.values()) {
    if (String(partita.formato || "").toLowerCase() !== "standard") {
      nonRiconosciuti += 1;
      continue;
    }
    const c = classificaFirma(firmaDaCarte(partita.carte));
    if (!c) { nonRiconosciuti += 1; continue; }
    const chiave = c.archetipo_id;
    if (!gruppiAvversari.has(chiave)) gruppiAvversari.set(chiave, {
      archetipo_id: chiave, nome: c.nome_pubblico || c.archetipo,
      strategia: c.strategia || null, colori: c.colori || [],
      partite: 0, vittorie: 0, sconfitte: 0,
    });
    const gruppo = gruppiAvversari.get(chiave);
    gruppo.partite += 1;
    if (partita.esito === "vinta") gruppo.vittorie += 1;
    if (partita.esito === "persa") gruppo.sconfitte += 1;
  }
  const avversari = [...gruppiAvversari.values()].map((gruppo) => ({ ...gruppo,
    win_rate: percentuale(gruppo.vittorie, gruppo.partite) }))
    .sort((a, b) => b.partite - a.partite || a.nome.localeCompare(b.nome));
  return {
    totali: { partite, vittorie, sconfitte: Number(totale?.sconfitte || 0),
      win_rate: percentuale(vittorie, partite), al_gioco: Number(totale?.al_gioco || 0),
      alla_risposta: Number(totale?.alla_risposta || 0),
      durata_media: totale?.durata_media === null ? null : Math.round(Number(totale.durata_media)) },
    mazzi, forma_recente: forma.results || [], sessioni_limited: sessioni.reverse(),
    // Senza sincronizzazione non si puo' dire che un mazzo "non c'e' piu' in
    // Arena": semplicemente non lo sappiamo, e dirlo lo stesso sarebbe una
    // deduzione inventata. Il sito mostra le etichette solo da qui in poi.
    eventi,
    sincronizzazione: { mazzi: sincronizzati.length,
      quando: sincronizzati[0]?.sincronizzato || null },
    andamento_rank: andamentoRank,
    avversari: { riconosciuti: avversari, non_riconosciuti: nonRiconosciuti,
      partite_totali: perPartita.size },
  };
}

function limiteIntero(valore, ripiego, minimo, massimo) {
  const numero = Number.parseInt(String(valore ?? ""), 10);
  return Number.isInteger(numero) ? Math.min(massimo, Math.max(minimo, numero)) : ripiego;
}

async function cronologiaPartite(richiesta, ambiente, accountId, indirizzo) {
  const device = await dispositivi(ambiente.DB, accountId);
  if (!device.length) return rispostaAccount(richiesta, ambiente,
    { partite: [], totale: 0, limite: 30, offset: 0 });
  const limite = limiteIntero(indirizzo.searchParams.get("limite"), 30, 1, 100);
  const offset = limiteIntero(indirizzo.searchParams.get("offset"), 0, 0, 1000000);
  const condizioni = [`mittente IN (${device.map(() => "?").join(", ")})`];
  const argomenti = device.map((d) => d.mittente);
  const impronta = indirizzo.searchParams.get("mazzo");
  if (impronta && hex(impronta, 64)) { condizioni.push("impronta_mazzo = ?"); argomenti.push(impronta); }
  const esito = indirizzo.searchParams.get("esito");
  if (["vinta", "persa"].includes(esito)) { condizioni.push("esito = ?"); argomenti.push(esito); }
  const evento = String(indirizzo.searchParams.get("evento") || "").trim().slice(0, 100);
  if (evento) { condizioni.push("evento = ?"); argomenti.push(evento); }
  const dove = condizioni.join(" AND ");
  const totale = await ambiente.DB.prepare(`SELECT COUNT(*) AS n FROM partite WHERE ${dove}`)
    .bind(...argomenti).first();
  const righe = await ambiente.DB.prepare(`SELECT id, quando, ricevuta, evento, formato,
      esito, su_gioco, mulligan, turni, durata, giochi, rank_classe, rank_livello,
      rank_stato, impronta_mazzo
    FROM partite WHERE ${dove} ORDER BY COALESCE(quando, ricevuta) DESC LIMIT ? OFFSET ?`)
    .bind(...argomenti, limite, offset).all();
  return rispostaAccount(richiesta, ambiente, { partite: righe.results || [],
    totale: Number(totale?.n || 0), limite, offset });
}

async function dettaglioPartita(richiesta, ambiente, accountId, id) {
  const riga = await ambiente.DB.prepare(`SELECT p.dato FROM partite p
    JOIN account_dispositivo d ON d.mittente = p.mittente
    WHERE p.id = ? AND d.account_id = ?`).bind(id, accountId).first();
  if (!riga) return rispostaAccount(richiesta, ambiente, { errore: "partita non trovata" }, 404);
  const partita = JSON.parse(riga.dato);
  delete partita.mittente;
  delete partita.segreto_cancellazione;
  const ids = [
    ...Object.keys(partita.mazzo?.carte || {}),
    ...Object.keys(partita.apertura || {}),
    ...(partita.avversario?.carte || []),
  ];
  return rispostaAccount(richiesta, ambiente,
    { id, partita, nomi_carte: catalogoCarte(ids), stampe_carte: catalogoStampe(ids) });
}

async function dettaglioDraft(richiesta, ambiente, accountId, id) {
  if (!ambiente.DRAFT_DB) return rispostaAccount(richiesta, ambiente,
    { errore: "archivio Draft non disponibile" }, 503);
  const device = await dispositivi(ambiente.DB, accountId);
  if (!device.length) return rispostaAccount(richiesta, ambiente, { errore: "Draft non trovato" }, 404);
  const segni = device.map(() => "?").join(", ");
  const indice = await ambiente.DRAFT_DB.prepare(`SELECT id, ricevuto, iniziato, set_code,
      formato, completo, pick, mox, oggetto_r2 FROM draft
    WHERE id = ? AND mittente IN (${segni})`).bind(id, ...device.map((d) => d.mittente)).first();
  if (!indice) return rispostaAccount(richiesta, ambiente, { errore: "Draft non trovato" }, 404);
  const link = await ambiente.DRAFT_DB.prepare(`SELECT partita, esito FROM draft_link
    WHERE draft_id = ? ORDER BY partita`).bind(id).all();
  let traccia = null;
  if (ambiente.DRAFT_RAW && indice.oggetto_r2) {
    const oggetto = await ambiente.DRAFT_RAW.get(indice.oggetto_r2);
    if (oggetto) traccia = await oggetto.json();
  }
  if (traccia) { delete traccia.mittente; delete traccia.segreto_cancellazione; }
  const pubblico = { ...indice }; delete pubblico.oggetto_r2;
  return rispostaAccount(richiesta, ambiente,
    { draft: pubblico, traccia, partite: link.results || [],
      nomi_carte: catalogoCarte(traccia?.pool_finale || []),
      stampe_carte: catalogoStampe(traccia?.pool_finale || []) });
}

async function rinominaMazzo(richiesta, ambiente, accountId, impronta) {
  const corpo = await corpoJson(richiesta);
  const formato = String(corpo?.formato || "").trim().slice(0, 40);
  const nome = String(corpo?.nome || "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (!formato) return rispostaAccount(richiesta, ambiente,
    { errore: "formato del mazzo richiesto" }, 400);
  const device = await dispositivi(ambiente.DB, accountId);
  if (!device.length) return rispostaAccount(richiesta, ambiente,
    { errore: "mazzo non trovato" }, 404);
  const segni = device.map(() => "?").join(", ");
  const esiste = await ambiente.DB.prepare(`SELECT 1 AS presente FROM partite
    WHERE mittente IN (${segni}) AND formato = ? AND impronta_mazzo = ?
      AND lower(COALESCE(evento, '')) NOT LIKE '%draft%'
      AND lower(COALESCE(evento, '')) NOT LIKE '%precon%' LIMIT 1`)
    .bind(...device.map((d) => d.mittente), formato, impronta).first();
  if (!esiste) return rispostaAccount(richiesta, ambiente,
    { errore: "mazzo costruito non trovato" }, 404);
  if (!nome) {
    await ambiente.DB.batch([ambiente.DB.prepare(`DELETE FROM account_mazzo_nome
      WHERE account_id = ? AND formato = ? AND impronta = ?`)
      .bind(accountId, formato, impronta)]);
  } else {
    await ambiente.DB.batch([ambiente.DB.prepare(`INSERT INTO account_mazzo_nome
      (account_id, formato, impronta, nome, aggiornato) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(account_id, formato, impronta) DO UPDATE SET
        nome = excluded.nome, aggiornato = excluded.aggiornato`)
      .bind(accountId, formato, impronta, nome, new Date().toISOString())]);
  }
  return rispostaAccount(richiesta, ambiente, { nome: nome || null });
}

async function riepilogoDashboard(ambiente, accountId) {
  const device = await dispositivi(ambiente.DB, accountId);
  if (!device.length) return { dispositivi: [], partite: [], draft: [], totali: { partite: 0, draft: 0 } };
  const segni = device.map(() => "?").join(", ");
  const mittenti = device.map((d) => d.mittente);
  const partite = await ambiente.DB.prepare(`SELECT id, quando, evento, formato, esito, mox,
    rank_classe, rank_livello, rank_stato
    FROM partite WHERE mittente IN (${segni}) ORDER BY ricevuta DESC LIMIT 100`)
    .bind(...mittenti).all();
  let draft = { results: [] };
  if (ambiente.DRAFT_DB) {
    draft = await ambiente.DRAFT_DB.prepare(`SELECT d.id, d.ricevuto, d.iniziato,
      d.set_code, d.formato, d.completo, d.pick, d.mox,
      COUNT(l.partita) AS partite,
      COALESCE(SUM(CASE WHEN l.esito = 'vinta' THEN 1 ELSE 0 END), 0) AS vittorie,
      COALESCE(SUM(CASE WHEN l.esito = 'persa' THEN 1 ELSE 0 END), 0) AS sconfitte
      FROM draft d LEFT JOIN draft_link l ON l.draft_id = d.id
      WHERE d.mittente IN (${segni}) AND (d.completo = 1 OR d.pick > 0)
      GROUP BY d.id, d.ricevuto, d.iniziato, d.set_code, d.formato,
        d.completo, d.pick, d.mox
      ORDER BY d.ricevuto DESC LIMIT 100`).bind(...mittenti).all();
  }
  const totalePartite = await ambiente.DB.prepare(
    `SELECT COUNT(*) AS n FROM partite WHERE mittente IN (${segni})`).bind(...mittenti).first();
  const totaleDraft = ambiente.DRAFT_DB ? await ambiente.DRAFT_DB.prepare(
    `SELECT COUNT(*) AS n FROM draft WHERE mittente IN (${segni})
      AND (completo = 1 OR pick > 0)`).bind(...mittenti).first() : null;
  return {
    dispositivi: device, partite: partite.results || [], draft: draft.results || [],
    totali: { partite: Number(totalePartite?.n || 0), draft: Number(totaleDraft?.n || 0) },
  };
}

async function creaCodice(richiesta, ambiente, utente) {
  const codice = codiceBreve();
  const ora = new Date().toISOString();
  await ambiente.DB.batch([
    ambiente.DB.prepare("DELETE FROM account_codice_mox WHERE account_id = ?").bind(utente.id),
    ambiente.DB.prepare(`INSERT INTO account_codice_mox
      (hash, account_id, creato, scade) VALUES (?, ?, ?, ?)`).bind(
        await sha256(codice), utente.id, ora, scadenza(DURATA_CODICE)),
  ]);
  return rispostaAccount(richiesta, ambiente, { codice, scade: scadenza(DURATA_CODICE) });
}

function hex(valore, lunghezza) {
  return typeof valore === "string" && valore.length === lunghezza &&
    ESADECIMALE.test(valore.toLowerCase());
}

async function collegaMox(richiesta, ambiente) {
  const corpo = await corpoJson(richiesta);
  const codice = String(corpo?.codice || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (codice.length !== 9 || !hex(corpo?.mittente, 32) || !hex(corpo?.segreto, 64)) {
    return rispostaAccount(richiesta, ambiente, { errore: "dati di collegamento non validi" }, 400);
  }
  const riga = await ambiente.DB.prepare(`SELECT account_id, scade
    FROM account_codice_mox WHERE hash = ?`).bind(await sha256(codice)).first();
  if (!riga || riga.scade <= new Date().toISOString()) {
    return rispostaAccount(richiesta, ambiente, { errore: "codice scaduto o non riconosciuto" }, 403);
  }
  const hashSegreto = await sha256(corpo.segreto);
  const dispositivo = await ambiente.DB.prepare(`SELECT account_id, segreto_hash
    FROM account_dispositivo WHERE mittente = ?`).bind(corpo.mittente).first();
  if (dispositivo && dispositivo.segreto_hash !== hashSegreto) {
    return rispostaAccount(richiesta, ambiente,
      { errore: "questa installazione usa un segreto locale diverso" }, 403);
  }
  if (dispositivo && dispositivo.account_id !== riga.account_id) {
    return rispostaAccount(richiesta, ambiente,
      { errore: "installazione gia collegata a un altro account: revocala prima" }, 409);
  }
  const registrati = [];
  const principale = await ambiente.DB.prepare(
    "SELECT cancellazione_hash FROM contributori WHERE mittente = ?").bind(corpo.mittente).first();
  if (principale) registrati.push(principale.cancellazione_hash);
  if (ambiente.DRAFT_DB) {
    const draft = await ambiente.DRAFT_DB.prepare(
      "SELECT cancellazione_hash FROM contributori WHERE mittente = ?").bind(corpo.mittente).first();
    if (draft) registrati.push(draft.cancellazione_hash);
  }
  if (registrati.some((hash) => hash !== hashSegreto)) {
    return rispostaAccount(richiesta, ambiente,
      { errore: "il segreto locale non coincide con i contributi esistenti" }, 403);
  }
  const nome = String(corpo.nome || "Mox Windows").trim().slice(0, 60) || "Mox Windows";
  const ora = new Date().toISOString();
  await ambiente.DB.batch([
    ambiente.DB.prepare(`INSERT INTO account_dispositivo
      (mittente, account_id, nome, segreto_hash, collegato) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(mittente) DO UPDATE SET account_id = excluded.account_id,
        nome = excluded.nome, segreto_hash = excluded.segreto_hash,
        collegato = excluded.collegato`).bind(
          corpo.mittente, riga.account_id, nome, hashSegreto, ora),
    ambiente.DB.prepare("DELETE FROM account_codice_mox WHERE hash = ?")
      .bind(await sha256(codice)),
  ]);
  return rispostaAccount(richiesta, ambiente, { collegato: true });
}

// I mazzi che l'utente ha davvero in Arena, mandati dal suo Mox collegato.
//
// Non e' un contributo anonimo come le partite: sono dati suoi, arrivano con
// il nome che ha scelto lui e restano dentro il suo account. Per questo qui
// non basta il mittente: serve anche il segreto locale, lo stesso che
// autorizza il collegamento e la cancellazione dei contributi.
//
// La sincronizzazione e' una fotografia, non un accumulo: quello che l'utente
// ha cancellato da Arena sparisce anche qui. Le partite giocate con un mazzo
// che non esiste piu' restano dov'erano e la dashboard le mostra come storico.
function mazzoValido(voce) {
  if (!voce || typeof voce !== "object") return null;
  if (!hex(voce.impronta, 64)) return null;
  const carte = carteValide(voce.carte);
  if (!carte) return null;
  const principali = Object.values(carte).reduce((somma, n) => somma + n, 0);
  if (!principali) return null;
  const sideboard = voce.sideboard ? carteValide(voce.sideboard) : null;
  const laterale = sideboard
    ? Object.values(sideboard).reduce((somma, n) => somma + n, 0) : 0;
  const colori = String(voce.colori || "").toUpperCase().replace(/[^WUBRG]/g, "");
  const nome = String(voce.nome || "").trim().slice(0, 120);
  if (!nome) return null;
  const aggiornato = typeof voce.aggiornato === "string"
    && !Number.isNaN(Date.parse(voce.aggiornato)) ? voce.aggiornato : null;
  return { impronta: voce.impronta, nome, carte, sideboard, principali,
    laterale, colori, aggiornato };
}

function carteValide(grezze) {
  if (!grezze || typeof grezze !== "object" || Array.isArray(grezze)) return null;
  const voci = Object.entries(grezze).slice(0, 300);
  const carte = {};
  for (const [chiave, valore] of voci) {
    const id = Number(chiave);
    const copie = Number(valore);
    if (!Number.isInteger(id) || id <= 0) return null;
    if (!Number.isInteger(copie) || copie <= 0 || copie > 250) return null;
    carte[String(id)] = copie;
  }
  return Object.keys(carte).length ? carte : null;
}

async function sincronizzaMazzi(richiesta, ambiente) {
  const corpo = await corpoJson(richiesta);
  if (!hex(corpo?.mittente, 32) || !hex(corpo?.segreto, 64)) {
    return rispostaAccount(richiesta, ambiente,
      { errore: "dati di sincronizzazione non validi" }, 400);
  }
  const dispositivo = await ambiente.DB.prepare(`SELECT account_id, segreto_hash
    FROM account_dispositivo WHERE mittente = ?`).bind(corpo.mittente).first();
  if (!dispositivo) {
    return rispostaAccount(richiesta, ambiente,
      { errore: "installazione non collegata a un account" }, 403);
  }
  if (dispositivo.segreto_hash !== await sha256(corpo.segreto)) {
    return rispostaAccount(richiesta, ambiente,
      { errore: "segreto locale non coerente" }, 403);
  }
  if (!Array.isArray(corpo?.mazzi)) {
    return rispostaAccount(richiesta, ambiente,
      { errore: "manca l'elenco dei mazzi" }, 400);
  }
  const validi = [];
  const visti = new Set();
  for (const voce of corpo.mazzi.slice(0, 200)) {
    const mazzo = mazzoValido(voce);
    if (!mazzo || visti.has(mazzo.impronta)) continue;
    visti.add(mazzo.impronta);
    validi.push(mazzo);
  }
  const ora = new Date().toISOString();
  const comandi = [ambiente.DB.prepare("DELETE FROM account_mazzo WHERE account_id = ?")
    .bind(dispositivo.account_id)];
  for (const mazzo of validi) {
    comandi.push(ambiente.DB.prepare(`INSERT INTO account_mazzo
      (account_id, impronta, nome, carte, sideboard, principali, laterale,
       colori, aggiornato, sincronizzato)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        dispositivo.account_id, mazzo.impronta, mazzo.nome,
        JSON.stringify(mazzo.carte),
        mazzo.sideboard ? JSON.stringify(mazzo.sideboard) : null,
        mazzo.principali, mazzo.laterale, mazzo.colori || null,
        mazzo.aggiornato, ora));
  }
  await ambiente.DB.batch(comandi);
  return rispostaAccount(richiesta, ambiente,
    { sincronizzati: validi.length, scartati: corpo.mazzi.length - validi.length });
}

// Mox e' la sorgente autorevole dei due interruttori. Il sito conserva solo
// l'ultima fotografia esplicita ricevuta dal client collegato: non deduce mai
// un consenso dalla presenza di upload, che potrebbe essere storico o in coda.
async function sincronizzaConsensi(richiesta, ambiente) {
  const corpo = await corpoJson(richiesta);
  if (!hex(corpo?.mittente, 32) || !hex(corpo?.segreto, 64) ||
      typeof corpo?.partite !== "boolean" || typeof corpo?.draft !== "boolean") {
    return rispostaAccount(richiesta, ambiente,
      { errore: "stato consensi non valido" }, 400);
  }
  const dispositivo = await ambiente.DB.prepare(`SELECT account_id, segreto_hash
    FROM account_dispositivo WHERE mittente = ?`).bind(corpo.mittente).first();
  if (!dispositivo) {
    return rispostaAccount(richiesta, ambiente,
      { errore: "installazione non collegata a un account" }, 403);
  }
  if (dispositivo.segreto_hash !== await sha256(corpo.segreto)) {
    return rispostaAccount(richiesta, ambiente,
      { errore: "segreto locale non coerente" }, 403);
  }
  const aggiornato = new Date().toISOString();
  await ambiente.DB.batch([ambiente.DB.prepare(`UPDATE account_dispositivo
    SET consenso_partite = ?, consenso_draft = ?, consensi_aggiornati = ?
    WHERE mittente = ? AND account_id = ?`).bind(
      corpo.partite ? 1 : 0, corpo.draft ? 1 : 0, aggiornato,
      corpo.mittente, dispositivo.account_id)]);
  return rispostaAccount(richiesta, ambiente, { aggiornato: true, quando: aggiornato });
}

async function mazziSincronizzati(db, accountId) {
  const righe = await db.prepare(`SELECT impronta, nome, carte, sideboard,
      principali, laterale, colori, aggiornato, sincronizzato
    FROM account_mazzo WHERE account_id = ? ORDER BY nome`).bind(accountId).all();
  return (righe.results || []).map((riga) => ({
    ...riga,
    carte: leggiCarte(riga.carte),
    sideboard: leggiCarte(riga.sideboard),
  }));
}

function leggiCarte(testo) {
  if (!testo) return null;
  try { return JSON.parse(testo); } catch { return null; }
}

async function esporta(richiesta, ambiente, utente) {
  const quadro = await riepilogoDashboard(ambiente, utente.id);
  const nomiMazzi = await ambiente.DB.prepare(`SELECT formato, impronta, nome, aggiornato
    FROM account_mazzo_nome WHERE account_id = ? ORDER BY aggiornato`)
    .bind(utente.id).all();
  const mazziArena = await mazziSincronizzati(ambiente.DB, utente.id);
  const mittenti = quadro.dispositivi.map((d) => d.mittente);
  if (!mittenti.length) return rispostaAccount(richiesta, ambiente,
    { versione: 1, esportato: new Date().toISOString(), account: {
      id: utente.id, nome: utente.nome,
    }, dati: quadro, nomi_mazzi: nomiMazzi.results || [],
      mazzi_arena: mazziArena });
  const segni = mittenti.map(() => "?").join(", ");
  const partite = await ambiente.DB.prepare(
    `SELECT dato FROM partite WHERE mittente IN (${segni}) ORDER BY ricevuta`).bind(...mittenti).all();
  const pacchettiDraft = [];
  if (ambiente.DRAFT_DB && ambiente.DRAFT_RAW) {
    const indici = await ambiente.DRAFT_DB.prepare(
      `SELECT oggetto_r2 FROM draft WHERE mittente IN (${segni}) ORDER BY ricevuto LIMIT 500`)
      .bind(...mittenti).all();
    for (const indice of indici.results || []) {
      const oggetto = await ambiente.DRAFT_RAW.get(indice.oggetto_r2);
      if (oggetto) pacchettiDraft.push(await oggetto.json());
    }
  }
  return rispostaAccount(richiesta, ambiente, {
    versione: 1, esportato: new Date().toISOString(), account: {
      id: utente.id, nome: utente.nome,
    }, dispositivi: quadro.dispositivi,
    partite: (partite.results || []).map((r) => JSON.parse(r.dato)), draft: pacchettiDraft,
    nomi_mazzi: nomiMazzi.results || [], mazzi_arena: mazziArena,
  });
}

async function esci(richiesta, ambiente, utente) {
  await ambiente.DB.batch([
    ambiente.DB.prepare("DELETE FROM account_sessione WHERE hash = ?").bind(utente.sessioneHash),
  ]);
  return rispostaAccount(richiesta, ambiente, { uscito: true }, 200,
    { "set-cookie": cookieSessione("", 0) });
}

// Le tabelle che appartengono a un account, in un posto solo.
//
// Il 23/08/2026 `account_mazzo` e' nata senza passare di qui: la cancellazione
// elencava dodici DELETE scritti a mano e quello nuovo mancava, cosi' i mazzi
// - con il nome scelto dall'utente, il dato piu' personale di questo database
// - sopravvivevano a un account cancellato. Aggiungere una tabella con una
// colonna `account_id` senza metterla in questo elenco fa fallire una prova:
// non e' piu' una cosa che si puo' dimenticare.
export const TABELLE_DELL_ACCOUNT = [
  "account_dispositivo",
  "account_codice_mox",
  "account_mazzo_nome",
  "account_mazzo",
  "account_sessione",
  "account_identita",
  "ticket_audit",
];

// Le tabelle dei ticket non hanno `account_id`: appartengono all'account
// attraverso il ticket, e vanno svuotate prima di lui.
const TABELLE_DEI_TICKET = ["ticket_audit", "ticket_allegato", "ticket_messaggio",
  "ticket_notifica_accesso", "ticket_notifica_email"];

export function comandiCancellaAccount(db, accountId) {
  const comandi = TABELLE_DEI_TICKET.map((tabella) => db.prepare(
    `DELETE FROM ${tabella} WHERE ticket_id IN
      (SELECT id FROM ticket WHERE account_id = ?)`).bind(accountId));
  comandi.push(db.prepare("DELETE FROM ticket WHERE account_id = ?").bind(accountId));
  for (const tabella of TABELLE_DELL_ACCOUNT) {
    comandi.push(db.prepare(`DELETE FROM ${tabella} WHERE account_id = ?`).bind(accountId));
  }
  comandi.push(db.prepare("DELETE FROM account WHERE id = ?").bind(accountId));
  return comandi;
}

async function eliminaAccount(richiesta, ambiente, utente) {
  const corpo = await corpoJson(richiesta);
  if (corpo?.conferma !== "ELIMINA") return rispostaAccount(richiesta, ambiente,
    { errore: "conferma richiesta" }, 400);
  const device = await dispositivi(ambiente.DB, utente.id);
  const eliminati = { partite: 0, draft: 0 };
  for (const dispositivo of device) {
    const parziale = await eliminaMittente(ambiente, dispositivo.mittente);
    eliminati.partite += parziale.partite;
    eliminati.draft += parziale.draft;
  }
  const allegati = await ambiente.DB.prepare(`SELECT a.oggetto_r2 FROM ticket_allegato a
    JOIN ticket t ON t.id = a.ticket_id WHERE t.account_id = ?`).bind(utente.id).all();
  if (ambiente.TICKET_FILES) {
    const chiavi = (allegati.results || []).map((r) => r.oggetto_r2);
    for (let i = 0; i < chiavi.length; i += 1000) {
      await ambiente.TICKET_FILES.delete(chiavi.slice(i, i + 1000));
    }
  }
  await ambiente.DB.batch(comandiCancellaAccount(ambiente.DB, utente.id));
  return rispostaAccount(richiesta, ambiente, { eliminato: true, contributi: eliminati }, 200,
    { "set-cookie": cookieSessione("", 0) });
}

async function eliminaSezione(richiesta, ambiente, utente) {
  const corpo = await corpoJson(richiesta);
  const sezione = String(corpo?.sezione || "").toLowerCase();
  const conferme = { partite: "PARTITE", draft: "DRAFT", mazzi: "MAZZI" };
  if (!conferme[sezione] || corpo?.conferma !== conferme[sezione]) {
    return rispostaAccount(richiesta, ambiente, { errore: "conferma richiesta" }, 400);
  }
  const device = await dispositivi(ambiente.DB, utente.id);
  const mittenti = device.map((d) => d.mittente);
  if (sezione === "mazzi") {
    const prima = await ambiente.DB.prepare(
      "SELECT COUNT(*) AS n FROM account_mazzo WHERE account_id = ?").bind(utente.id).first();
    await ambiente.DB.batch([
      ambiente.DB.prepare("DELETE FROM account_mazzo WHERE account_id = ?").bind(utente.id),
      ambiente.DB.prepare("DELETE FROM account_mazzo_nome WHERE account_id = ?").bind(utente.id),
    ]);
    return rispostaAccount(richiesta, ambiente,
      { eliminato: "mazzi", righe: Number(prima?.n || 0) });
  }
  if (!mittenti.length) return rispostaAccount(richiesta, ambiente,
    { eliminato: sezione, righe: 0 });
  const segni = mittenti.map(() => "?").join(", ");
  if (sezione === "partite") {
    const righe = await ambiente.DB.prepare(
      `SELECT id FROM partite WHERE mittente IN (${segni})`).bind(...mittenti).all();
    const linkDaTogliere = (righe.results || []).map((riga) => ambiente.DRAFT_DB?.prepare(
      "DELETE FROM draft_link WHERE partita = ?").bind(riga.id)).filter(Boolean);
    if (linkDaTogliere.length) await ambiente.DRAFT_DB.batch(linkDaTogliere);
    await ambiente.DB.batch([
      ambiente.DB.prepare(`DELETE FROM carte_mazzo WHERE partita IN
        (SELECT id FROM partite WHERE mittente IN (${segni}))`).bind(...mittenti),
      ambiente.DB.prepare(`DELETE FROM carte_avversario WHERE partita IN
        (SELECT id FROM partite WHERE mittente IN (${segni}))`).bind(...mittenti),
      ambiente.DB.prepare(`DELETE FROM partite WHERE mittente IN (${segni})`).bind(...mittenti),
      ambiente.DB.prepare(`DELETE FROM contributori WHERE mittente IN (${segni})`).bind(...mittenti),
    ]);
    return rispostaAccount(richiesta, ambiente,
      { eliminato: "partite", righe: (righe.results || []).length });
  }
  if (!ambiente.DRAFT_DB) return rispostaAccount(richiesta, ambiente,
    { errore: "archivio Draft non disponibile" }, 503);
  const righe = await ambiente.DRAFT_DB.prepare(
    `SELECT id, oggetto_r2 FROM draft WHERE mittente IN (${segni})`).bind(...mittenti).all();
  const oggetti = (righe.results || []).map((riga) => riga.oggetto_r2);
  if (oggetti.length && !ambiente.DRAFT_RAW) return rispostaAccount(richiesta, ambiente,
    { errore: "archivio Draft non disponibile" }, 503);
  for (let i = 0; i < oggetti.length; i += 1000) {
    await ambiente.DRAFT_RAW.delete(oggetti.slice(i, i + 1000));
  }
  await ambiente.DRAFT_DB.batch([
    ambiente.DRAFT_DB.prepare(`DELETE FROM draft_link WHERE draft_id IN
      (SELECT id FROM draft WHERE mittente IN (${segni}))`).bind(...mittenti),
    ambiente.DRAFT_DB.prepare(`DELETE FROM draft_mazzo WHERE draft_id IN
      (SELECT id FROM draft WHERE mittente IN (${segni}))`).bind(...mittenti),
    ambiente.DRAFT_DB.prepare(`DELETE FROM draft_pick WHERE draft_id IN
      (SELECT id FROM draft WHERE mittente IN (${segni}))`).bind(...mittenti),
    ambiente.DRAFT_DB.prepare(`DELETE FROM draft WHERE mittente IN (${segni})`).bind(...mittenti),
    ambiente.DRAFT_DB.prepare(`DELETE FROM contributori WHERE mittente IN (${segni})`).bind(...mittenti),
  ]);
  return rispostaAccount(richiesta, ambiente,
    { eliminato: "draft", righe: (righe.results || []).length });
}

// Sessioni, stati OAuth e codici Mox scaduti: nessuno li toglieva.
//
// Venivano cancellati solo quando qualcuno li usava: chi comincia un accesso e
// non lo finisce, chi genera un codice e non collega niente, chi smette di
// usare il sito senza fare logout lasciavano una riga per sempre. Sono
// credenziali morte - hash, ma pur sempre righe legate a un account - e la
// tabella cresceva senza motivo. Il cron di ogni notte le porta via.
export async function pulisciCredenzialiScadute(ambiente, adesso = new Date().toISOString()) {
  const esiti = await ambiente.DB.batch([
    ambiente.DB.prepare("DELETE FROM account_sessione WHERE scade < ?").bind(adesso),
    ambiente.DB.prepare("DELETE FROM account_oauth_stato WHERE scade < ?").bind(adesso),
    ambiente.DB.prepare("DELETE FROM account_codice_mox WHERE scade < ?").bind(adesso),
  ]);
  return (esiti || []).reduce(
    (somma, esito) => somma + Number(esito?.meta?.changes || 0), 0);
}

export async function gestisciAccount(richiesta, ambiente, indirizzo) {
  const percorso = indirizzo.pathname;
  const accountRoute = percorso.startsWith("/account/") || percorso === "/account" ||
    percorso.startsWith("/auth/") || percorso === "/mox/account/link" ||
    percorso === "/mox/account/decks" || percorso === "/mox/account/consents";
  if (!accountRoute) return null;
  if (richiesta.method === "OPTIONS") return preflightAccount(richiesta, ambiente);
  const oauth = percorso.match(/^\/auth\/(google|discord)$/);
  if (oauth) return richiesta.method === "GET"
    ? iniziaOAuth(oauth[1], richiesta, ambiente, indirizzo)
    : rispostaAccount(richiesta, ambiente, { errore: "usa GET" }, 405);
  const callback = percorso.match(/^\/auth\/(google|discord)\/callback$/);
  if (callback) return richiesta.method === "GET"
    ? completaOAuth(callback[1], richiesta, ambiente, indirizzo)
    : rispostaAccount(richiesta, ambiente, { errore: "usa GET" }, 405);
  if (percorso === "/mox/account/link") return richiesta.method === "POST"
    ? collegaMox(richiesta, ambiente)
    : rispostaAccount(richiesta, ambiente, { errore: "usa POST" }, 405);
  // Mox manda qui i mazzi: si autentica col mittente e col segreto locale,
  // non con la sessione del browser, che sul desktop non esiste.
  if (percorso === "/mox/account/decks") return richiesta.method === "POST"
    ? sincronizzaMazzi(richiesta, ambiente)
    : rispostaAccount(richiesta, ambiente, { errore: "usa POST" }, 405);
  if (percorso === "/mox/account/consents") return richiesta.method === "POST"
    ? sincronizzaConsensi(richiesta, ambiente)
    : rispostaAccount(richiesta, ambiente, { errore: "usa POST" }, 405);

  const richiesto = await richiedeUtente(richiesta, ambiente);
  if (richiesto instanceof Response) return richiesto;
  const provider = await providerAccount(ambiente.DB, richiesto.id);
  if (percorso === "/account/me" && richiesta.method === "GET") {
    return rispostaAccount(richiesta, ambiente, { account: {
      id: richiesto.id, nome: richiesto.nome, avatar: richiesto.avatar,
      amministratore: richiesto.ruolo === "amministratore",
      provider,
    } });
  }
  if (percorso === "/account/dashboard" && richiesta.method === "GET") {
    return rispostaAccount(richiesta, ambiente,
      { account: { id: richiesto.id, nome: richiesto.nome, avatar: richiesto.avatar,
        amministratore: richiesto.ruolo === "amministratore", provider },
        ...(await riepilogoDashboard(ambiente, richiesto.id)) });
  }
  if (percorso === "/account/stats" && richiesta.method === "GET") {
    return rispostaAccount(richiesta, ambiente,
      await statistichePersonali(ambiente, richiesto.id));
  }
  if (percorso === "/account/matches" && richiesta.method === "GET") {
    return cronologiaPartite(richiesta, ambiente, richiesto.id, indirizzo);
  }
  const partita = percorso.match(/^\/account\/matches\/([0-9a-f]{10})$/);
  if (partita && richiesta.method === "GET") {
    return dettaglioPartita(richiesta, ambiente, richiesto.id, partita[1]);
  }
  const draftDettaglio = percorso.match(/^\/account\/drafts\/([0-9a-f]{32})$/);
  if (draftDettaglio && richiesta.method === "GET") {
    return dettaglioDraft(richiesta, ambiente, richiesto.id, draftDettaglio[1]);
  }
  const nomeMazzoRoute = percorso.match(/^\/account\/decks\/([0-9a-f]{64})\/name$/);
  if (nomeMazzoRoute && richiesta.method === "PUT") {
    return rinominaMazzo(richiesta, ambiente, richiesto.id, nomeMazzoRoute[1]);
  }
  if (percorso === "/account/link-code" && richiesta.method === "POST") {
    return creaCodice(richiesta, ambiente, richiesto);
  }
  if (percorso === "/account/export" && richiesta.method === "GET") {
    return esporta(richiesta, ambiente, richiesto);
  }
  if (percorso === "/account/logout" && richiesta.method === "POST") {
    return esci(richiesta, ambiente, richiesto);
  }
  if (percorso === "/account/delete" && richiesta.method === "POST") {
    return eliminaAccount(richiesta, ambiente, richiesto);
  }
  if (percorso === "/account/delete-section" && richiesta.method === "POST") {
    return eliminaSezione(richiesta, ambiente, richiesto);
  }
  const revoca = percorso.match(/^\/account\/devices\/([0-9a-f]{32})$/);
  if (revoca && richiesta.method === "DELETE") {
    await ambiente.DB.batch([ambiente.DB.prepare(`DELETE FROM account_dispositivo
      WHERE mittente = ? AND account_id = ?`).bind(revoca[1], richiesto.id)]);
    return rispostaAccount(richiesta, ambiente, { revocato: true });
  }
  return rispostaAccount(richiesta, ambiente, { errore: "operazione account non trovata" }, 404);
}
