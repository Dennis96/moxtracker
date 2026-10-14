// Dati Draft centralizzati (14/10/2026): canale della policy, rotte di
// distribuzione, raccolta 17Lands inattiva, publisher, comando amministrativo e
// scenari di costo. Nessuna rete: R2 e `fetch` sono finti.

import { strict as assert } from "node:assert";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createServer } from "node:http";

import server from "../src/index.js";
import { normalizzaPolitica } from "../src/politica-dati-esterni.js";
import { chiaveTabellaApi } from "../src/dati-draft.js";
import { LIMITI_RACCOLTA, raccogliLotto, raccogliTabella, raccoltaAutorizzata,
  salvaTabellaApi, eseguiRaccolta, tabelleDelSet, CRON_RACCOLTA_17LANDS } from "../src/raccolta-17lands.js";
import { CHIAVE_SET_ATTIVI, dimenticaSetAttivi, fineEmbargo, inEmbargo, validaSetAttivi }
  from "../src/set-attivi.js";
import { main as mainSetAttivi } from "../strumenti/dati-draft/set-attivi.mjs";
import { sha256, validaPayload } from "../strumenti/dati-draft/contratto.mjs";
import { main as mainPubblica, pianifica, pianoRollback } from "../strumenti/dati-draft/pubblica.mjs";
import { costruisciSecret, effetti, main as mainPolitica } from "../strumenti/dati-draft/politica.mjs";
import { BASE, TARIFFE, IPOTESI, costo, scenario, tutti } from "../strumenti/dati-draft/scenari-costi.mjs";

const PERMESSO = { basis: "owner_decision", reference: "decisione del proprietario 14/10/2026",
  decided_at: "2026-10-14" };

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
    this.metadati = new Map();
  }
  async get(chiave) {
    this.letture.push(chiave);
    const byte = this.oggetti.get(chiave);
    if (!byte) return null;
    // Senza metadati espliciti una tabella e' appena raccolta.
    const customMetadata = this.metadati.get(chiave) ?? { raccolto_il: new Date().toISOString() };
    return { size: byte.byteLength, customMetadata, httpEtag: `"e-${sha256(Buffer.from(byte)).slice(0, 8)}"`,
      text: async () => new TextDecoder().decode(byte),
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

test("policy: central_api senza autorizzazione esplicita vale public_only, mai enabled implicito", () => {
  for (const autorizzazione of [undefined, null, {}, { basis: "owner_decision" },
    { basis: "proprietario", reference: "abc" }, { basis: true, reference: "abc" },
    { basis: "owner_decision", reference: "  " }, { granted: true, reference: "abc" }]) {
    const p = normalizzaPolitica(secret({ mode: "enabled", channel: "central_api", api_authorization: autorizzazione }));
    assert.equal(p.providers["17lands"].channel, "public_only");
    assert.equal(p.providers["17lands"].mode, "disabled");
  }
  const p = normalizzaPolitica(secret({ mode: "cache_only", channel: "central_api", api_authorization: PERMESSO }));
  assert.equal(p.providers["17lands"].channel, "central_api");
  assert.equal(p.providers["17lands"].mode, "cache_only");
  // La base resta scritta com'e': una decisione del proprietario non diventa un permesso.
  assert.deepEqual(p.providers["17lands"].api_authorization, PERMESSO);
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
  dimenticaSetAttivi();
  const byte = Buffer.from(JSON.stringify(payload()));
  const sha = sha256(byte);
  const manifesto = { schema: "mox.draft-stats-manifest/1", namespace: "public",
    source: "17lands_public_dataset", revision: 3, entries: [{ set: "TMT", format: "PremierDraft",
      main_colors: null, sha256: sha, bytes: byte.length, source_published_at: "2026-04-08" }] };
  const api = Buffer.from(JSON.stringify(payload({ source: "17lands_api" })));
  return { sha, byte, r2: new R2Finto({ "public/manifest.json": JSON.stringify(manifesto),
    [`public/payload/${sha}.json`]: byte,
    "api/card_data/TMT/PremierDraft/tutti.json": api,
    [CHIAVE_SET_ATTIVI]: JSON.stringify({ schema: 1, set: [{ set: "TMT", uscita: "2026-01-01",
      speciale: false, formati: ["PremierDraft"] }] }) }) };
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
    { MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled", channel: "central_api", api_authorization: PERMESSO }) },
    { MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled", channel: "central_api", api_authorization: PERMESSO }), MOX_DRAFT_API_DISTRIBUTION: "true" },
    { MOX_EXTERNAL_DATA_POLICY: secret({ mode: "disabled", channel: "central_api", api_authorization: PERMESSO }), MOX_DRAFT_API_DISTRIBUTION: "on" },
  ];
  for (const ambiente of negati) {
    r2.letture.length = 0;
    const r = await chiedi(percorso, { DRAFT_STATS: r2, ...ambiente });
    assert.equal(r.stato, 403);
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.deepEqual(r2.letture, [], "nessuna lettura dello spazio API quando e' negato");
  }
  const attivo = { DRAFT_STATS: r2, MOX_DRAFT_API_DISTRIBUTION: "on",
    MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled", channel: "central_api", api_authorization: PERMESSO }) };
  const r = await chiedi(percorso, attivo);
  assert.equal(r.stato, 200);
  assert.equal(r.headers.get("cache-control"), "private, no-store");
  assert.equal(r.headers.get("x-mox-sha256"), sha256(r.corpo));
  for (const brutto of ["&user_group=top", "&time_period=LAST_DAY", "&expansion=SOS", "&colors=WUB", "&colors=WX"]) {
    assert.equal((await chiedi(percorso + brutto, attivo)).stato, 400, brutto);
  }
});

test("rotte API: una tabella piu' vecchia di 7 giorni non si serve", async () => {
  const { r2 } = archivioPubblico();
  const chiave = "api/card_data/TMT/PremierDraft/tutti.json";
  const attivo = { DRAFT_STATS: r2, MOX_DRAFT_API_DISTRIBUTION: "on",
    MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled", channel: "central_api", api_authorization: PERMESSO }) };
  const percorso = "/mox/draft-data/v1/api/card_data?expansion=TMT&event_type=PremierDraft";
  for (const [metadati, stato] of [[{ raccolto_il: new Date(Date.now() - 8 * GIORNO).toISOString() }, 404],
    [{}, 404], [{ raccolto_il: "ieri" }, 404], [{ raccolto_il: new Date(Date.now() - 6 * GIORNO).toISOString() }, 200]]) {
    r2.metadati.set(chiave, metadati);
    assert.equal((await chiedi(percorso, attivo)).stato, stato, JSON.stringify(metadati));
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

test("wrangler.toml non accende niente: binding, variabili e cron della raccolta stanno nel frammento", () => {
  const distribuzione = readFileSync(new URL("../src/dati-draft.js", import.meta.url), "utf8");
  assert.doesNotMatch(distribuzione, /17lands\.com/);
  const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  assert.doesNotMatch(toml, /DRAFT_STATS|MOX_17LANDS_RACCOLTA|MOX_DRAFT_API_DISTRIBUTION/);
  assert.ok(!toml.includes(CRON_RACCOLTA_17LANDS));
  const frammento = readFileSync(new URL("../strumenti/dati-draft/wrangler-dati-draft.frammento.toml",
    import.meta.url), "utf8");
  assert.ok(frammento.includes(CRON_RACCOLTA_17LANDS));
});

test("cron: quello della raccolta non lancia la manutenzione, gli altri si'", async () => {
  const lavori = [];
  const contesto = { waitUntil: (p) => lavori.push(p) };
  await server.scheduled({ cron: CRON_RACCOLTA_17LANDS }, {}, contesto);
  assert.equal(lavori.length, 1);
  assert.deepEqual(await lavori[0], undefined);
  const spenta = await eseguiRaccolta({}, { fetch: async () => { throw new Error("rete"); } });
  assert.equal(spenta.esito, "spenta");
});

// -------------------------------------------------------- embargo e set

const FRA = { set: "FRA", uscita: "2026-09-22", speciale: false, formati: ["PremierDraft"] };
const GIORNO = 24 * 3600 * 1000;

test("set attivi: validazione e embargo prudente (12° giorno → +13, speciali +8)", () => {
  assert.equal(validaSetAttivi({ schema: 1, set: [FRA] }).ok, true);
  for (const rotto of [null, {}, { schema: 2, set: [] }, { schema: 1, set: [{ ...FRA, set: "fra" }] },
    { schema: 1, set: [{ ...FRA, uscita: "22/09/2026" }] }, { schema: 1, set: [{ ...FRA, formati: ["Cube"] }] },
    { schema: 1, set: [{ ...FRA, speciale: "no" }] }, { schema: 1, set: [FRA, FRA] }]) {
    assert.equal(validaSetAttivi(rotto).ok, false, JSON.stringify(rotto));
  }
  const uscita = Date.parse("2026-09-22T00:00:00Z");
  assert.equal(fineEmbargo(FRA), uscita + 13 * GIORNO);
  assert.equal(inEmbargo(FRA, uscita + 13 * GIORNO - 1), true);
  assert.equal(inEmbargo(FRA, uscita + 13 * GIORNO), false);
  assert.equal(fineEmbargo({ ...FRA, speciale: true }), uscita + 8 * GIORNO);
  assert.equal(tabelleDelSet(FRA).length, 12);
});

class R2ConMetadati extends R2Finto {
  constructor(oggetti) { super(oggetti); this.teste = 0; }
  async get(chiave) {
    const o = await super.get(chiave);
    if (o) o.text = async () => new TextDecoder().decode(this.oggetti.get(chiave));
    return o;
  }
  async head(chiave) {
    this.teste += 1;
    return this.oggetti.has(chiave) ? { customMetadata: this.metadati.get(chiave) ?? {} } : null;
  }
  async put(chiave, byte, opzioni) {
    await super.put(chiave, byte);
    this.metadati.set(chiave, opzioni?.customMetadata ?? {});
  }
}

function archivioConSet(...set) {
  dimenticaSetAttivi();
  return new R2ConMetadati({ [CHIAVE_SET_ATTIVI]: JSON.stringify({ schema: 1, set }) });
}

test("raccolta programmata: niente in embargo, poi 12 tabelle, poi niente per 12 ore", async () => {
  const uscita = Date.parse("2026-09-22T00:00:00Z");
  const url = [];
  const fetch = async (u) => { url.push(u); return rispostaFinta(u.includes("color_ratings")
    ? [{ color_name: "All Decks", games: 10, wins: 5 }]
    : { data: [{ mtga_id: 1, name: "A", ever_drawn_win_rate: 0.5, ever_drawn_game_count: 10 }] }); };
  const ambiente = { ...AMBIENTE_RACCOLTA, DRAFT_STATS: archivioConSet(FRA) };
  const prima = await eseguiRaccolta(ambiente, { fetch, adesso: uscita + 5 * GIORNO });
  assert.deepEqual([prima.esito, prima.set, prima.salvate, url.length], ["eseguita", [], 0, 0]);
  dimenticaSetAttivi();
  const dopo = await eseguiRaccolta(ambiente, { fetch, adesso: uscita + 14 * GIORNO });
  assert.equal(dopo.salvate, 12);
  assert.ok(url.slice(0, 2).every((u) => !u.includes("colors=")), "prima le globali");
  assert.ok(url.every((u) => u.startsWith("https://www.17lands.com/")));
  const pagina = ambiente.DRAFT_STATS.oggetti.get("api/card_data/FRA/PremierDraft/WU.json");
  const p = JSON.parse(new TextDecoder().decode(pagina));
  assert.equal(p.collection.basis, "owner_decision");
  assert.deepEqual(validaPayload(p, "api"), []);
  dimenticaSetAttivi();
  const subito = await eseguiRaccolta(ambiente, { fetch, adesso: uscita + 14 * GIORNO + 3600_000 });
  assert.equal(subito.salvate, 0);
  assert.equal(url.length, 12);
  dimenticaSetAttivi();
  const poi = await eseguiRaccolta(ambiente, { fetch, adesso: uscita + 14 * GIORNO + 13 * 3600_000 });
  assert.equal(poi.salvate, 12);
});

test("raccolta programmata: un rifiuto definitivo si ritenta dopo 12 ore, non ogni ora", async () => {
  const adesso = Date.parse("2026-12-01T00:00:00Z");
  const ambiente = { ...AMBIENTE_RACCOLTA, DRAFT_STATS: archivioConSet(FRA) };
  let chiamate = 0;
  const rifiuta = async () => { chiamate += 1; return rispostaFinta("", 404); };
  const primo = await eseguiRaccolta(ambiente, { fetch: rifiuta, adesso });
  assert.deepEqual([primo.salvate, primo.errori, chiamate], [0, 12, 12]);
  dimenticaSetAttivi();
  await eseguiRaccolta(ambiente, { fetch: rifiuta, adesso: adesso + 3600_000 });
  assert.equal(chiamate, 12, "nessun nuovo tentativo dopo un'ora");
  dimenticaSetAttivi();
  await eseguiRaccolta(ambiente, { fetch: rifiuta, adesso: adesso + 13 * 3600_000 });
  assert.equal(chiamate, 24);
  // Un 503 invece non lascia segnaposto: il giro dopo riprova.
  dimenticaSetAttivi();
  const transitorio = { ...AMBIENTE_RACCOLTA, DRAFT_STATS: archivioConSet(FRA) };
  let altre = 0;
  await eseguiRaccolta(transitorio, { fetch: async () => { altre += 1; return rispostaFinta("", 503); },
    adesso, dormi: async () => {} });
  dimenticaSetAttivi();
  await eseguiRaccolta(transitorio, { fetch: async () => { altre += 1; return rispostaFinta("", 503); },
    adesso: adesso + 3600_000, dormi: async () => {} });
  assert.equal(altre, 2 * 12 * LIMITI_RACCOLTA.tentativi);
  dimenticaSetAttivi();
});

test("raccolta programmata: dopo 8 minuti non comincia tabelle nuove", async () => {
  const ambiente = { ...AMBIENTE_RACCOLTA, DRAFT_STATS: archivioConSet(FRA) };
  let tempo = 0;
  const orologio = () => tempo;
  const lenta = async () => { tempo += 3 * 60 * 1000; return rispostaFinta([]); };
  const giro = await eseguiRaccolta(ambiente, { fetch: lenta, adesso: Date.parse("2026-12-01T00:00:00Z"), orologio });
  assert.equal(giro.salvate, 3, "a 0, 3 e 6 minuti si comincia; a 9 no");
  assert.equal(giro.rinviate, 9);
  dimenticaSetAttivi();
});

test("cron: un errore della raccolta finisce nel log, non in una rejection", async () => {
  const lavori = [];
  const errore = console.error;
  const scritti = [];
  console.error = (...x) => scritti.push(x.join(" "));
  try {
    const archivio = archivioConSet(FRA);
    archivio.head = async () => { throw new Error("R2 giu'"); };
    await server.scheduled({ cron: CRON_RACCOLTA_17LANDS }, { ...AMBIENTE_RACCOLTA, DRAFT_STATS: archivio },
      { waitUntil: (p) => lavori.push(p) });
    await Promise.all(lavori);
  } finally { console.error = errore; dimenticaSetAttivi(); }
  assert.equal(lavori.length, 1);
  assert.ok(scritti.some((r) => r.includes("raccolta 17Lands fallita")), scritti.join("|"));
});

test("raccolta programmata: al piu' 30 tabelle per giro; elenco rotto = niente", async () => {
  const set = ["AAA", "BBB", "CCC"].map((s) => ({ ...FRA, set: s }));
  const ambiente = { ...AMBIENTE_RACCOLTA, DRAFT_STATS: archivioConSet(...set) };
  let chiamate = 0;
  const giro = await eseguiRaccolta(ambiente, { fetch: async () => { chiamate += 1; return rispostaFinta([]); },
    adesso: Date.parse("2026-12-01T00:00:00Z") });
  assert.equal(chiamate, LIMITI_RACCOLTA.richiestePerEsecuzione);
  assert.equal(giro.rinviate, 36 - LIMITI_RACCOLTA.richiestePerEsecuzione);
  dimenticaSetAttivi();
  const rotto = new R2ConMetadati({ [CHIAVE_SET_ATTIVI]: "{rotto" });
  chiamate = 0;
  const nulla = await eseguiRaccolta({ ...AMBIENTE_RACCOLTA, DRAFT_STATS: rotto },
    { fetch: async () => { chiamate += 1; return rispostaFinta([]); } });
  assert.deepEqual([nulla.set, chiamate], [[], 0]);
  dimenticaSetAttivi();
});

test("rotte API: un set in embargo non si serve nemmeno se c'e' la tabella", async () => {
  const r2 = archivioConSet({ ...FRA, uscita: new Date().toISOString().slice(0, 10) });
  r2.oggetti.set("api/card_data/FRA/PremierDraft/tutti.json", new TextEncoder().encode("{}"));
  const ambiente = { DRAFT_STATS: r2, MOX_DRAFT_API_DISTRIBUTION: "on",
    MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled", channel: "central_api", api_authorization: PERMESSO }) };
  const r = await chiedi("/mox/draft-data/v1/api/card_data?expansion=FRA&event_type=PremierDraft", ambiente);
  assert.equal(r.stato, 404);
  assert.match(r.corpo.toString(), /embargo/);
  dimenticaSetAttivi();
});

test("comando set attivi: dry-run, poi scrittura solo con conferma", () => {
  const log = console.log; console.log = () => {};
  const errore = console.error; console.error = () => {};
  try {
    let scritture = 0;
    const lancia = () => { scritture += 1; return 0; };
    assert.equal(mainSetAttivi(["--set", "FRA:2026-09-22:PremierDraft,QuickDraft"], lancia), 0);
    assert.equal(mainSetAttivi(["--set", "FRA:2026-09-22:Cube"], lancia), 2);
    assert.equal(mainSetAttivi(["--set", "FRA:2026-09-22:PremierDraft", "--esegui"], lancia), 3);
    assert.equal(scritture, 0);
    assert.equal(mainSetAttivi(["--set", "FRA:2026-09-22:PremierDraft", "--esegui", "--conferma-produzione"], lancia), 0);
    assert.equal(scritture, 1);
  } finally { console.log = log; console.error = errore; }
});

// ------------------------------------------------------------- raccolta

function rispostaFinta(corpo, stato = 200, intestazioni = {}) {
  return new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo),
    { status: stato, headers: intestazioni });
}

const AMBIENTE_RACCOLTA = { MOX_17LANDS_RACCOLTA: "on",
  MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled", channel: "central_api", api_authorization: PERMESSO }) };

test("raccolta: zero richieste se un cancello e' chiuso", async () => {
  const chiusi = [
    {},
    { MOX_17LANDS_RACCOLTA: "on" },
    { ...AMBIENTE_RACCOLTA, MOX_17LANDS_RACCOLTA: "1" },
    { ...AMBIENTE_RACCOLTA, MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled" }) },
    { ...AMBIENTE_RACCOLTA, MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled", channel: "central_api" }) },
    { ...AMBIENTE_RACCOLTA, MOX_EXTERNAL_DATA_POLICY: secret({ mode: "cache_only", channel: "central_api", api_authorization: PERMESSO }) },
    { ...AMBIENTE_RACCOLTA, MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled", channel: "public_only", api_authorization: PERMESSO }) },
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

test("comando policy: central_api solo con base, riferimento e modo espliciti", () => {
  assert.throws(() => costruisciSecret({ canale: "central_api" }), /--base/);
  assert.throws(() => costruisciSecret({ canale: "central_api", base: "permesso" }), /--base/);
  assert.throws(() => costruisciSecret({ canale: "central_api", base: "owner_decision" }), /--riferimento/);
  assert.throws(() => costruisciSecret({ canale: "central_api", base: "owner_decision",
    riferimento: "decisione" }), /modo-legacy/);
  assert.throws(() => costruisciSecret({ canale: "public_only", modoLegacy: "enabled" }), /disabled/);
  assert.throws(() => costruisciSecret({ canale: "tutto" }), /canale/);
  const s = costruisciSecret({ canale: "central_api", base: "owner_decision", riferimento: "decisione 14/10",
    modoLegacy: "cache_only", adesso: new Date("2026-10-14T10:00:00Z") });
  assert.deepEqual(s.providers["17lands"].api_authorization,
    { basis: "owner_decision", reference: "decisione 14/10", decided_at: "2026-10-14" });
  const e = effetti(s);
  assert.equal(e.risposta_worker.providers["17lands"].channel, "central_api");
  assert.match(e.client["2.11.4-2.11.8"], /cache_only/);
  assert.match(e.client["fino a 2.11.3"], /non leggono/);
  assert.equal(effetti(costruisciSecret({ canale: "public_only" })).risposta_worker.providers["17lands"].mode, "disabled");
});

// ---------------------------------------------------------------- costi

test("costi: traffico API esplicito, CPU sconosciuta e costo parziale distinto dal totale", () => {
  const s = tutti();
  for (const nome of ["prudente", "pessimo"]) {
    assert.deepEqual(s[nome].map((x) => x.utenti), [100, 1000, 10000]);
    for (const x of s[nome]) {
      assert.equal(x.incrementale_usd, "n.d.");
      assert.equal(x.totale_usd, "n.d.");
      assert.equal(x.cpu_ms, "n.d.");
      assert.ok(x.richieste_api_client > 0);
    }
  }
  const prudente = scenario(10000, IPOTESI.prudente);
  assert.equal(prudente.aggiunte.richieste, 3_120_000 + 720, "include 1,8 M richieste API client");
  assert.equal(prudente.totale.richieste, 3_120_720 + BASE.workersRichieste);
  assert.equal(prudente.aggiunte.classeB, 4_920_000 + 44 + 104400);
  assert.equal(prudente.incrementale_parziale_usd, 0);
  assert.ok(s.soglia_utenti_pessimo < 10000, "lo scenario pessimo include anche i client API");
  assert.ok(s.pessimo.at(-1).incrementale_parziale_usd > 0);
  const noto = costo({ richieste: 0, byte: 0, classeA: 0, classeB: 0, cpuMs: 31_000_000 });
  assert.equal(noto.workers_cpu, 0.02);
  assert.equal(noto.workers, 5.02);
  const misurato = scenario(10000, IPOTESI.prudente, { esistenteMs: 0, perRichiestaMs: 10, perGiroMs: 1 });
  assert.ok(misurato.incrementale_usd > 0);
  assert.equal(misurato.cpu_ms, 31_200_720);
  assert.throws(() => scenario(100, IPOTESI.prudente, { esistenteMs: -1,
    perRichiestaMs: null, perGiroMs: null }), /CPU/);
});

test("rotte API: configurazione assente, rotta, set o formato sconosciuti restano chiusi", async () => {
  for (const configurazione of [null, "{rotto", { schema: 1, set: [] },
    { schema: 1, set: [{ set: "TMT", uscita: "2026-01-01", speciale: false, formati: ["TradDraft"] }] }]) {
    const { r2 } = archivioPubblico();
    r2.oggetti.delete(CHIAVE_SET_ATTIVI);
    if (configurazione !== null) r2.oggetti.set(CHIAVE_SET_ATTIVI,
      new TextEncoder().encode(typeof configurazione === "string" ? configurazione : JSON.stringify(configurazione)));
    const ambiente = { DRAFT_STATS: r2, MOX_DRAFT_API_DISTRIBUTION: "on",
      MOX_EXTERNAL_DATA_POLICY: secret({ mode: "enabled", channel: "central_api", api_authorization: PERMESSO }) };
    const r = await chiedi("/mox/draft-data/v1/api/card_data?expansion=TMT&event_type=PremierDraft", ambiente);
    assert.equal(r.stato, 404);
    assert.ok(!r2.letture.includes("api/card_data/TMT/PremierDraft/tutti.json"));
  }
});

test("raccolta programmata: JSON rotto lascia un rifiuto persistito per dodici ore", async () => {
  const adesso = Date.parse("2026-12-01T00:00:00Z");
  const ambiente = { ...AMBIENTE_RACCOLTA, DRAFT_STATS: archivioConSet(FRA) };
  let fetch = 0;
  const prendi = async () => { fetch++; return rispostaFinta("{rotto"); };
  const primo = await eseguiRaccolta(ambiente, { fetch: prendi, adesso });
  assert.equal(primo.errori, 12);
  assert.equal(fetch, 12, "nessun secondo tentativo sul JSON non valido");
  assert.equal(ambiente.DRAFT_STATS.scritture.filter(k => k.endsWith(".rifiuto")).length, 12);
  dimenticaSetAttivi();
  await eseguiRaccolta(ambiente, { fetch: prendi, adesso: adesso + 3600_000 });
  assert.equal(fetch, 12);
  dimenticaSetAttivi();
  await eseguiRaccolta(ambiente, { fetch: prendi, adesso: adesso + 13 * 3600_000 });
  assert.equal(fetch, 24);
});

test("raccolta: stream troppo grande senza header o con header falso viene cancellato presto", async () => {
  for (const header of [{}, { "content-length": "1" }]) {
    let letti = 0, annullato = false, fetch = 0;
    const stream = new ReadableStream({ pull(controller) {
      if (letti >= 10) { controller.close(); return; }
      letti++;
      controller.enqueue(new Uint8Array(1024 * 1024));
    }, cancel() { annullato = true; } }, { highWaterMark: 0 });
    const risultato = await raccogliTabella({ tabella: "card_data", set: "TMT", formato: "PremierDraft",
      ambiente: AMBIENTE_RACCOLTA, fetch: async () => { fetch++; return new Response(stream, { headers: header }); } });
    assert.equal(risultato.definitivo, true);
    assert.equal(fetch, 1);
    assert.ok(annullato);
    assert.equal(letti, 5, "quattro blocchi ammessi, poi il primo oltre il limite");
  }
});

test("raccolta: errori del trasporto del corpo restano transitori e i retry attendono", async () => {
  let fetch = 0;
  const attese = [];
  const risultato = await raccogliTabella({ tabella: "card_data", set: "TMT", formato: "PremierDraft",
    ambiente: AMBIENTE_RACCOLTA, dormi: async ms => attese.push(ms), fetch: async () => {
      fetch++;
      return new Response(new ReadableStream({ start(controller) { controller.error(new TypeError("trasporto interrotto")); } }));
    } });
  assert.equal(fetch, 2);
  assert.deepEqual(attese, [2000]);
  assert.ok(!risultato.definitivo);
});

test("raccolta programmata: la pausa del retry passa anche dal chiamante del cron", async () => {
  const attese = [];
  let fetch = 0;
  await eseguiRaccolta({ ...AMBIENTE_RACCOLTA, DRAFT_STATS: archivioConSet(FRA) }, {
    adesso: Date.parse("2026-12-01T00:00:00Z"), dormi: async ms => attese.push(ms),
    fetch: async () => { fetch++; return rispostaFinta("", 429); } });
  assert.equal(fetch, 24);
  assert.deepEqual(attese, Array(12).fill(2000));
});

test("raccolta: timeout copre anche il corpo lento e una revoca nega il retry", async () => {
  const veroTimer = globalThis.setTimeout;
  const scadenze = [];
  globalThis.setTimeout = (fn, ms, ...argomenti) => {
    scadenze.push(ms);
    return veroTimer(fn, 1, ...argomenti);
  };
  let chiamate = 0;
  try {
    const risultato = await raccogliTabella({ tabella: "card_data", set: "TMT", formato: "PremierDraft",
      ambiente: AMBIENTE_RACCOLTA, dormi: async () => {}, fetch: async (_url, { signal }) => {
        chiamate++;
        return new Response(new ReadableStream({ start(controller) {
          signal.addEventListener("abort", () => controller.error(new DOMException("lento", "AbortError")), { once: true });
        } }));
      } });
    assert.equal(risultato.esito, "errore");
    assert.ok(!risultato.definitivo);
    assert.equal(chiamate, 2);
    assert.deepEqual(scadenze, [15000, 15000]);
  } finally { globalThis.setTimeout = veroTimer; }
  const ambiente = { ...AMBIENTE_RACCOLTA };
  chiamate = 0;
  const revocato = await raccogliTabella({ tabella: "card_data", set: "TMT", formato: "PremierDraft",
    ambiente, dormi: async () => {}, fetch: async () => {
      chiamate++;
      ambiente.MOX_17LANDS_RACCOLTA = "off";
      return rispostaFinta("", 503);
    } });
  assert.equal(revocato.esito, "negata");
  assert.equal(chiamate, 1);
});

test("raccolta: un redirect HTTP non esce dalla whitelist degli endpoint", async () => {
  let destinazioni = 0;
  const dest = createServer((_req, res) => {
    destinazioni++;
    res.end(JSON.stringify([{ mtga_id: 1, name: "Carta sintetica" }]));
  });
  await new Promise(risolvi => dest.listen(0, "127.0.0.1", risolvi));
  const origine = createServer((_req, res) => {
    res.writeHead(302, { Location: `http://127.0.0.1:${dest.address().port}/fuori-whitelist` });
    res.end();
  });
  await new Promise(risolvi => origine.listen(0, "127.0.0.1", risolvi));
  try {
    let chiamate = 0;
    const risultato = await raccogliTabella({ tabella: "card_data", set: "TMT", formato: "PremierDraft",
      ambiente: AMBIENTE_RACCOLTA, fetch: async (_url, opzioni) => {
        chiamate++;
        // L'URL 17Lands e' sostituito prima di fetch: solo loopback reale.
        return fetch(`http://127.0.0.1:${origine.address().port}/endpoint`, opzioni);
      } });
    assert.equal(risultato.definitivo, true);
    assert.equal(risultato.motivo, "HTTP 302");
    assert.equal(chiamate, 1);
    assert.equal(destinazioni, 0);
  } finally {
    for (const server of [origine, dest]) {
      server.closeAllConnections();
      await new Promise(risolvi => server.close(risolvi));
    }
  }
});
