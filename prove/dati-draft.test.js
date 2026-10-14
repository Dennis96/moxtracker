// Dati Draft centralizzati (14/10/2026): canale della policy, rotte di
// distribuzione, raccolta 17Lands inattiva, publisher, comando amministrativo e
// scenari di costo. Nessuna rete: R2 e `fetch` sono finti.

import { strict as assert } from "node:assert";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import server from "../src/index.js";
import { normalizzaPolitica } from "../src/politica-dati-esterni.js";
import { chiaveTabellaApi } from "../src/dati-draft.js";
import { LIMITI_RACCOLTA, raccogliLotto, raccogliTabella, raccoltaAutorizzata,
  salvaTabellaApi } from "../src/raccolta-17lands.js";
import { sha256, validaPayload } from "../strumenti/dati-draft/contratto.mjs";
import { main as mainPubblica, pianifica, pianoRollback } from "../strumenti/dati-draft/pubblica.mjs";
import { costruisciSecret, effetti, main as mainPolitica } from "../strumenti/dati-draft/politica.mjs";
import { BASE, TARIFFE, scenario, tutti } from "../strumenti/dati-draft/scenari-costi.mjs";

const PERMESSO = { granted: true, reference: "email 17Lands 2026-10-20" };

function secret(voce) {
  return JSON.stringify({ schema: 1, providers: { "17lands": { reason: "prova",
    updated_at: "2026-10-14T00:00:00Z", ...voce } } });
}

function payload({ set = "TMT", format = "PremierDraft", colori = null, source = "17lands_public_dataset",
  extra = {} } = {}) {
  return { schema: "mox.draft-stats/1", source, set, format, filter: { main_colors: colori },
    metrics: { gih_wr: "supported", gp_wr: "supported", iwd: "supported", ata: "supported",
      color_ratings: colori ? "unsupported" : "supported" },
    attribution: { text: "17Lands Public Data Sets, CC BY 4.0", license: "CC BY 4.0" },
    source_published_at: "2026-04-08",
    cards: [{ mtga_id: 100001, name: "Carta", ever_drawn_game_count: 1000, ever_drawn_win_rate: 0.55,
      game_count: 1500, win_rate: 0.54, pick_count: 900, avg_pick: 4.2 }],
    color_ratings: colori ? null : [{ color_name: "All Decks", short_name: null, games: 10, wins: 5 }],
    ...extra };
}

class R2Finto {
  constructor(oggetti = {}) {
    this.oggetti = new Map(Object.entries(oggetti).map(([k, v]) => [k,
      typeof v === "string" ? new TextEncoder().encode(v) : v]));
    this.letture = [];
    this.scritture = [];
  }
  async get(chiave) {
    this.letture.push(chiave);
    const byte = this.oggetti.get(chiave);
    if (!byte) return null;
    return { size: byte.byteLength, httpEtag: `"e-${sha256(Buffer.from(byte)).slice(0, 8)}"`,
      arrayBuffer: async () => byte.buffer.slice(byte.byteOffset, byte.byteOffset + byte.byteLength) };
  }
  async put(chiave, byte) { this.scritture.push(chiave); this.oggetti.set(chiave, byte); }
}

async function chiedi(percorso, ambiente, opzioni = {}) {
  const r = await server.fetch(new Request("https://api.esempio.invalid" + percorso, opzioni), ambiente);
  const corpo = await r.arrayBuffer();
  return { stato: r.status, headers: r.headers, corpo: Buffer.from(corpo) };
}

// ------------------------------------------------------------ policy, canale

test("policy: i casi della fixture condivisa con mox-core restano quelli", () => {
  const casi = JSON.parse(readFileSync(new URL("./casi-politica-canale.json", import.meta.url), "utf8"));
  assert.equal(casi.length, 9);
  for (const caso of casi) {
    const p = normalizzaPolitica(caso.secret);
    assert.equal(p ? 200 : 503, caso.stato, caso.nome);
    if (p) assert.deepEqual({ ...p, configurata: true }, caso.risposta, caso.nome);
  }
});

test("policy: senza canale la risposta e' identica a prima", async () => {
  for (const modo of ["enabled", "cache_only", "disabled"]) {
    const r = await chiedi("/mox/external-data-policy", { MOX_EXTERNAL_DATA_POLICY: secret({ mode: modo }) });
    assert.deepEqual(JSON.parse(r.corpo), { schema: 1, providers: { "17lands": { mode: modo,
      reason: "prova", updated_at: "2026-10-14T00:00:00Z" } }, configurata: true });
  }
});

test("policy: public_only e off forzano disabled per i client 2.11.4–2.11.8", async () => {
  for (const canale of ["public_only", "off"]) {
    for (const modo of ["enabled", "cache_only", "disabled"]) {
      const r = await chiedi("/mox/external-data-policy",
        { MOX_EXTERNAL_DATA_POLICY: secret({ mode: modo, channel: canale }) });
      const voce = JSON.parse(r.corpo).providers["17lands"];
      assert.equal(voce.mode, "disabled");
      assert.equal(voce.channel, canale);
      assert.equal(r.headers.get("cache-control"), "no-store");
    }
  }
});

test("policy: central_api senza permesso esplicito vale public_only, mai enabled implicito", () => {
  for (const permesso of [undefined, null, {}, { granted: true }, { granted: "true", reference: "abc" },
    { granted: 1, reference: "abc" }, { granted: true, reference: "  " }]) {
    const p = normalizzaPolitica(secret({ mode: "enabled", channel: "central_api", api_permission: permesso }));
    assert.equal(p.providers["17lands"].channel, "public_only");
    assert.equal(p.providers["17lands"].mode, "disabled");
  }
  const p = normalizzaPolitica(secret({ mode: "cache_only", channel: "central_api", api_permission: PERMESSO }));
  assert.equal(p.providers["17lands"].channel, "central_api");
  assert.equal(p.providers["17lands"].mode, "cache_only");
});

test("policy: canale sconosciuto e' un secret rotto (503)", async () => {
  for (const canale of ["api", "CENTRAL_API", "", null, 1]) {
    const r = await chiedi("/mox/external-data-policy",
      { MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled", channel: canale }) });
    assert.equal(r.stato, 503, String(canale));
  }
});

// --------------------------------------------------------------- rotte

function archivioPubblico() {
  const byte = Buffer.from(JSON.stringify(payload()));
  const sha = sha256(byte);
  const manifesto = { schema: "mox.draft-stats-manifest/1", namespace: "public",
    source: "17lands_public_dataset", revision: 3, entries: [{ set: "TMT", format: "PremierDraft",
      main_colors: null, sha256: sha, bytes: byte.length, source_published_at: "2026-04-08" }] };
  const api = Buffer.from(JSON.stringify(payload({ source: "17lands_api" })));
  return { sha, byte, r2: new R2Finto({ "public/manifest.json": JSON.stringify(manifesto),
    [`public/payload/${sha}.json`]: byte,
    "api/card_data/TMT/PremierDraft/tutti.json": api }) };
}

test("rotte: senza binding R2 rispondono 503 no-store (oggi in produzione)", async () => {
  for (const p of ["public/manifest.json", "api/card_data?expansion=TMT&event_type=PremierDraft"]) {
    const r = await chiedi(`/mox/draft-data/v1/${p}`, {});
    assert.equal(r.stato, 503);
    assert.equal(r.headers.get("cache-control"), "no-store");
  }
});

test("rotte: manifesto e payload pubblici, con hash, ETag e cache giuste", async () => {
  const { sha, byte, r2 } = archivioPubblico();
  const ambiente = { DRAFT_STATS: r2 };
  const m = await chiedi("/mox/draft-data/v1/public/manifest.json", ambiente);
  assert.equal(m.stato, 200);
  assert.equal(m.headers.get("cache-control"), "public, max-age=300");
  assert.equal(m.headers.get("x-mox-sha256"), sha256(m.corpo));
  const etag = m.headers.get("etag");
  const ancora = await chiedi("/mox/draft-data/v1/public/manifest.json", ambiente,
    { headers: { "if-none-match": etag } });
  assert.equal(ancora.stato, 304);
  const p = await chiedi(`/mox/draft-data/v1/public/payload/${sha}.json`, ambiente);
  assert.equal(p.stato, 200);
  assert.ok(p.corpo.equals(byte));
  assert.equal(p.headers.get("x-mox-sha256"), sha);
  assert.match(p.headers.get("cache-control"), /immutable/);
  for (const brutto of ["abc.json", `${sha.toUpperCase()}.json`, `${sha}`, `${sha}.json.json`]) {
    assert.equal((await chiedi(`/mox/draft-data/v1/public/payload/${brutto}`, ambiente)).stato, 400);
  }
  assert.equal((await chiedi(`/mox/draft-data/v1/public/payload/${"0".repeat(64)}.json`, ambiente)).stato, 404);
});

test("rotte: canale off o secret rotto negano anche i pubblici", async () => {
  const { r2 } = archivioPubblico();
  for (const grezzo of [secret({ mode: "enabled", channel: "off" }), "{rotto"]) {
    const r = await chiedi("/mox/draft-data/v1/public/manifest.json",
      { DRAFT_STATS: r2, MOX_EXTERNAL_DATA_POLICY: grezzo });
    assert.equal(r.stato, 403);
    assert.equal(r.headers.get("cache-control"), "no-store");
  }
  const ok = await chiedi("/mox/draft-data/v1/public/manifest.json",
    { DRAFT_STATS: r2, MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled", channel: "public_only" }) });
  assert.equal(ok.stato, 200);
});

test("rotte API: negate senza central_api, permesso e variabile; mai in cache", async () => {
  const { r2 } = archivioPubblico();
  const percorso = "/mox/draft-data/v1/api/card_data?expansion=TMT&event_type=PremierDraft&time_period=ALL_TIME";
  const negati = [
    {},
    { MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled" }) },
    { MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled", channel: "public_only" }) },
    { MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled", channel: "central_api" }), MOX_DRAFT_API_DISTRIBUTION: "on" },
    { MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled", channel: "central_api", api_permission: PERMESSO }) },
    { MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled", channel: "central_api", api_permission: PERMESSO }), MOX_DRAFT_API_DISTRIBUTION: "true" },
    { MOX_EXTERNAL_DATA_POLICY: secret({ mode: "disabled", channel: "central_api", api_permission: PERMESSO }), MOX_DRAFT_API_DISTRIBUTION: "on" },
  ];
  for (const ambiente of negati) {
    r2.letture.length = 0;
    const r = await chiedi(percorso, { DRAFT_STATS: r2, ...ambiente });
    assert.equal(r.stato, 403);
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.deepEqual(r2.letture, [], "nessuna lettura dello spazio API quando e' negato");
  }
  const attivo = { DRAFT_STATS: r2, MOX_DRAFT_API_DISTRIBUTION: "on",
    MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled", channel: "central_api", api_permission: PERMESSO }) };
  const r = await chiedi(percorso, attivo);
  assert.equal(r.stato, 200);
  assert.equal(r.headers.get("cache-control"), "private, no-store");
  assert.equal(r.headers.get("x-mox-sha256"), sha256(r.corpo));
  for (const brutto of ["&user_group=top", "&time_period=LAST_DAY", "&expansion=SOS", "&colors=WUB", "&colors=WX"]) {
    assert.equal((await chiedi(percorso + brutto, attivo)).stato, 400, brutto);
  }
});

test("rotte: chiavi API dalla whitelist", () => {
  const p = (q) => new URLSearchParams(q);
  assert.equal(chiaveTabellaApi("card_data", p("expansion=TMT&event_type=PremierDraft&colors=UW")),
    "api/card_data/TMT/PremierDraft/WU.json");
  assert.equal(chiaveTabellaApi("color_ratings", p("expansion=TMT&event_type=PremierDraft")),
    "api/color_ratings/TMT/PremierDraft/tutti.json");
  assert.equal(chiaveTabellaApi("color_ratings", p("expansion=TMT&event_type=PremierDraft&colors=WU")), null);
  assert.equal(chiaveTabellaApi("card_data", p("expansion=tmt&event_type=PremierDraft")), null);
  assert.equal(chiaveTabellaApi("card_data", p("expansion=TMT&event_type=Cube")), null);
  assert.equal(chiaveTabellaApi("deck_data", p("expansion=TMT&event_type=PremierDraft")), null);
});

test("rotte: solo GET; le rotte esistenti non cambiano", async () => {
  const { r2 } = archivioPubblico();
  for (const metodo of ["POST", "PUT", "DELETE", "OPTIONS"]) {
    const r = await chiedi("/mox/draft-data/v1/public/manifest.json", { DRAFT_STATS: r2 }, { method: metodo });
    assert.equal(r.stato, 405, metodo);
  }
  const salute = await chiedi("/salute", {});
  assert.equal(salute.stato, 200);
  assert.equal(JSON.parse(salute.corpo).stato, "vivo");
  assert.equal(r2.scritture.length, 0);
});

test("il Worker non importa la raccolta 17Lands, e nessun cron la chiama", () => {
  const indice = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  assert.doesNotMatch(indice, /raccolta-17lands/);
  const distribuzione = readFileSync(new URL("../src/dati-draft.js", import.meta.url), "utf8");
  assert.doesNotMatch(distribuzione, /17lands\.com/);
  const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  assert.doesNotMatch(toml, /DRAFT_STATS|MOX_17LANDS_RACCOLTA|MOX_DRAFT_API_DISTRIBUTION/);
});

// ------------------------------------------------------------- raccolta

function rispostaFinta(corpo, stato = 200, intestazioni = {}) {
  return new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo),
    { status: stato, headers: intestazioni });
}

const AMBIENTE_RACCOLTA = { MOX_17LANDS_RACCOLTA: "on",
  MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled", channel: "central_api", api_permission: PERMESSO }) };

test("raccolta: zero richieste se un cancello e' chiuso", async () => {
  const chiusi = [
    {},
    { MOX_17LANDS_RACCOLTA: "on" },
    { ...AMBIENTE_RACCOLTA, MOX_17LANDS_RACCOLTA: "1" },
    { ...AMBIENTE_RACCOLTA, MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled" }) },
    { ...AMBIENTE_RACCOLTA, MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled", channel: "central_api" }) },
    { ...AMBIENTE_RACCOLTA, MOX_EXTERNAL_DATA_POLICY: secret({ mode: "cache_only", channel: "central_api", api_permission: PERMESSO }) },
    { ...AMBIENTE_RACCOLTA, MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled", channel: "public_only", api_permission: PERMESSO }) },
    { ...AMBIENTE_RACCOLTA, MOX_EXTERNAL_DATA_POLICY: "{rotto" },
  ];
  for (const ambiente of chiusi) {
    let chiamate = 0;
    const r = await raccogliTabella({ tabella: "card_data", set: "TMT", formato: "PremierDraft",
      ambiente, fetch: async () => { chiamate += 1; return rispostaFinta([]); } });
    assert.equal(r.esito, "negata");
    assert.equal(chiamate, 0);
    assert.equal(raccoltaAutorizzata(ambiente).ok, false);
  }
});

test("raccolta: con i cancelli aperti una richiesta, UA, whitelist e payload valido", async () => {
  const viste = [];
  const r = await raccogliTabella({ tabella: "card_data", set: "TMT", formato: "PremierDraft", colori: "BW",
    ambiente: AMBIENTE_RACCOLTA, adesso: 1000,
    fetch: async (url, opzioni) => { viste.push([url, opzioni.headers["user-agent"]]);
      return rispostaFinta({ data: [{ mtga_id: 1, name: "A", ever_drawn_win_rate: 0.5,
        ever_drawn_game_count: 10, url: "https://immagine", game_count: 12, win_rate: 0.4 }] }); } });
  assert.equal(r.esito, "ok");
  assert.equal(viste.length, 1);
  assert.equal(viste[0][0], "https://www.17lands.com/api/card_data?expansion=TMT&event_type=PremierDraft&time_period=ALL_TIME&colors=WB");
  assert.match(viste[0][1], /^MoxCentral\//);
  assert.equal(r.chiave, "api/card_data/TMT/PremierDraft/WB.json");
  assert.equal(r.payload.cards[0].url, undefined, "niente campi superflui");
  assert.deepEqual(validaPayload(r.payload, "api"), []);
});

test("raccolta: parametri fuori whitelist, dedupe, limiti, ritentativi", async () => {
  let chiamate = 0;
  const fetch = async () => { chiamate += 1; return rispostaFinta([]); };
  for (const [tabella, set, formato, colori] of [["deck_data", "TMT", "PremierDraft", null],
    ["card_data", "tmt", "PremierDraft", null], ["card_data", "TMT", "Cube", null],
    ["color_ratings", "TMT", "PremierDraft", "WU"], ["card_data", "TMT", "PremierDraft", "WUB"]]) {
    const r = await raccogliTabella({ tabella, set, formato, colori, ambiente: AMBIENTE_RACCOLTA, fetch });
    assert.equal(r.esito, "rifiutata");
  }
  assert.equal(chiamate, 0);
  const registro = new Map();
  const colori = async () => rispostaFinta([{ color_name: "All Decks", games: 10, wins: 4 }]);
  const a = await raccogliTabella({ tabella: "color_ratings", set: "TMT", formato: "PremierDraft",
    ambiente: AMBIENTE_RACCOLTA, fetch: colori, registro, adesso: 0 });
  const b = await raccogliTabella({ tabella: "color_ratings", set: "TMT", formato: "PremierDraft",
    ambiente: AMBIENTE_RACCOLTA, fetch: colori, registro, adesso: 1000 });
  assert.equal(a.esito, "ok");
  assert.equal(b.esito, "troppo_presto");
  const grande = await raccogliTabella({ tabella: "card_data", set: "TMT", formato: "PremierDraft",
    ambiente: AMBIENTE_RACCOLTA, fetch: async () => rispostaFinta("[]", 200,
      { "content-length": String(LIMITI_RACCOLTA.byteMassimi + 1) }) });
  assert.equal(grande.esito, "errore");
  let tentativi = 0;
  const lento = await raccogliTabella({ tabella: "card_data", set: "TMT", formato: "TradDraft",
    ambiente: AMBIENTE_RACCOLTA, fetch: async () => { tentativi += 1; return rispostaFinta("", 429); } });
  assert.equal(lento.esito, "errore");
  assert.equal(tentativi, LIMITI_RACCOLTA.tentativi);
  // Un errore transitorio non blocca la tabella: si puo' ritentare subito.
  const registroLento = new Map();
  await raccogliTabella({ tabella: "card_data", set: "TMT", formato: "TradDraft", registro: registroLento,
    ambiente: AMBIENTE_RACCOLTA, fetch: async () => rispostaFinta("", 503) });
  assert.equal(registroLento.size, 0);
  const ripresa = await raccogliTabella({ tabella: "card_data", set: "TMT", formato: "TradDraft",
    registro: registroLento, ambiente: AMBIENTE_RACCOLTA, fetch: async () => rispostaFinta([]) });
  assert.equal(ripresa.esito, "ok");
  assert.equal(registroLento.size, 1);
  const rotta = await raccogliTabella({ tabella: "card_data", set: "TMT", formato: "QuickDraft",
    ambiente: AMBIENTE_RACCOLTA, fetch: async () => rispostaFinta({ data: [{ mtga_id: "1" }] }) });
  assert.equal(rotta.esito, "errore");
  const lotto = await raccogliLotto(Array.from({ length: LIMITI_RACCOLTA.richiestePerEsecuzione + 3 },
    () => ({ tabella: "deck_data", set: "TMT", formato: "PremierDraft" })), { ambiente: AMBIENTE_RACCOLTA, fetch });
  assert.equal(lotto.filter((x) => x.esito === "rinviata").length, 3);
});

test("raccolta: una revoca arrivata durante la richiesta impedisce il salvataggio", async () => {
  const r = await raccogliTabella({ tabella: "color_ratings", set: "TMT", formato: "PremierDraft",
    ambiente: AMBIENTE_RACCOLTA, fetch: async () => rispostaFinta([]) });
  const r2 = new R2Finto();
  const revocato = { ...AMBIENTE_RACCOLTA,
    MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled", channel: "public_only" }) };
  assert.equal((await salvaTabellaApi(r2, revocato, r)).esito, "negata");
  assert.equal(r2.scritture.length, 0);
  assert.equal((await salvaTabellaApi(r2, AMBIENTE_RACCOLTA, r)).esito, "salvata");
});

// ------------------------------------------------------------- publisher

function uscitaFinta(voci = [payload(), payload({ colori: "WB" })]) {
  const cartella = mkdtempSync(join(tmpdir(), "mox-uscita-"));
  mkdirSync(join(cartella, "payload"));
  const elenco = voci.map((d) => {
    const byte = Buffer.from(JSON.stringify(d));
    const sha = sha256(byte);
    writeFileSync(join(cartella, "payload", `${sha}.json`), byte);
    return { set: d.set, format: d.format, main_colors: d.filter.main_colors, sha256: sha,
      bytes: byte.length, source_published_at: "2026-04-08" };
  });
  writeFileSync(join(cartella, "voci.json"), JSON.stringify(elenco));
  return { cartella, elenco };
}

test("publisher: piano valido, manifesto scritto per ultimo, payload gia' presenti saltati", () => {
  const { cartella, elenco } = uscitaFinta();
  const payloadMap = new Map(elenco.map((v) => [v.sha256, readFileSync(join(cartella, "payload", `${v.sha256}.json`))]));
  const piano = pianifica({ voci: elenco, payload: payloadMap, adesso: new Date("2026-10-14T00:00:00Z") });
  assert.equal(piano.ok, true, piano.errori.join("; "));
  assert.equal(piano.manifesto.revision, 1);
  assert.equal(piano.operazioni.at(-1).chiave, "public/manifest.json");
  assert.equal(piano.operazioni.filter((o) => o.tipo === "verifica").length, 2);
  const secondo = pianifica({ voci: elenco, payload: payloadMap, corrente: piano.manifesto });
  assert.equal(secondo.manifesto.revision, 2);
  assert.equal(secondo.operazioni.filter((o) => o.tipo === "put").length, 2, "solo archivio e manifesto");
  const rollback = pianoRollback({ archiviato: piano.manifesto, corrente: secondo.manifesto });
  assert.equal(rollback.manifesto.revision, 3);
  assert.equal(rollback.manifesto.rollback_of, 1);
});

test("publisher: rifiuta hash sbagliati, sorgente API, chiavi individuali", () => {
  for (const [voce, atteso] of [
    [payload({ source: "17lands_api" }), /sorgente/],
    [payload({ extra: { quality: { draft_id: "abc" } } }), /chiave vietata/],
    [payload({ extra: { cards: [{ mtga_id: 1, win_rate: 1.4 }] } }), /fuori da/],
  ]) {
    const { cartella, elenco } = uscitaFinta([voce]);
    const mappa = new Map(elenco.map((v) => [v.sha256, readFileSync(join(cartella, "payload", `${v.sha256}.json`))]));
    const piano = pianifica({ voci: elenco, payload: mappa });
    assert.equal(piano.ok, false);
    assert.match(piano.errori.join(" "), atteso);
  }
  const { cartella, elenco } = uscitaFinta([payload()]);
  const mappa = new Map([[elenco[0].sha256, Buffer.from("{}")]]);
  assert.match(pianifica({ voci: elenco, payload: mappa }).errori.join(" "), /hash diverso/);
  assert.ok(cartella);
});

test("publisher e policy: il dry-run non scrive mai, l'esecuzione vuole la conferma", () => {
  const { cartella } = uscitaFinta();
  const log = console.log;
  console.log = () => {};
  try {
    assert.equal(mainPubblica(["--uscita", cartella]), 0);
    assert.equal(mainPubblica(["--uscita", cartella, "--esegui"]), 3);
    let lanci = 0;
    const lancia = () => { lanci += 1; return 0; };
    assert.equal(mainPolitica(["--canale", "off", "--motivo", "prova"], lancia), 0);
    const errore = console.error;
    console.error = () => {};
    assert.equal(mainPolitica(["--canale", "off", "--esegui"], lancia), 3);
    console.error = errore;
    assert.equal(lanci, 0);
    assert.equal(mainPolitica(["--canale", "off", "--esegui", "--conferma-produzione"], lancia), 0);
    assert.equal(lanci, 1);
  } finally {
    console.log = log;
  }
});

test("comando policy: central_api solo con permesso e modo espliciti", () => {
  assert.throws(() => costruisciSecret({ canale: "central_api" }), /permesso/);
  assert.throws(() => costruisciSecret({ canale: "central_api", riferimento: "email" }), /modo-legacy/);
  assert.throws(() => costruisciSecret({ canale: "public_only", modoLegacy: "enabled" }), /disabled/);
  assert.throws(() => costruisciSecret({ canale: "tutto" }), /canale/);
  const s = costruisciSecret({ canale: "central_api", riferimento: "email 17Lands", modoLegacy: "cache_only" });
  const e = effetti(s);
  assert.equal(e.risposta_worker.providers["17lands"].channel, "central_api");
  assert.match(e.client["2.11.4-2.11.8"], /cache_only/);
  assert.match(e.client["fino a 2.11.3"], /non leggono/);
  assert.equal(effetti(costruisciSecret({ canale: "public_only" })).risposta_worker.providers["17lands"].mode, "disabled");
});

// ---------------------------------------------------------------- costi

test("costi: tre scenari dentro le quote incluse, incrementale zero", () => {
  const s = tutti();
  for (const nome of ["prudente", "pessimo"]) {
    assert.deepEqual(s[nome].map((x) => x.utenti), [100, 1000, 10000]);
    for (const x of s[nome]) {
      assert.equal(x.incrementale_usd, 0);
      assert.equal(x.totale_usd, TARIFFE.workersPaidBase);
      assert.ok(x.quota_workers_usata < 1);
    }
  }
  const prudente = scenario(10000, { manifestoAlMese: 120, payloadAlMese: 12 });
  assert.equal(prudente.aggiunte.richieste, 1_320_000);
  assert.equal(prudente.totale.richieste, 1_320_000 + BASE.workersRichieste);
  assert.ok(s.soglia_utenti_pessimo > 10000);
  const oltre = scenario(20000, { manifestoAlMese: 720, payloadAlMese: 30 });
  assert.ok(oltre.incrementale_usd > 0, "oltre la soglia il costo variabile compare");
});
