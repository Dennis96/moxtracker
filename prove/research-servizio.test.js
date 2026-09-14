// Le route Research per intero, sul Worker vero e su SQLite vero.
//
// Consenso, upload, join, revoca, delete e le loro corse: ogni esito atteso
// e' scritto a mano dai documenti normativi. Solo dati sintetici (golden rev2).

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import server from "../src/index.js";
import { sha256Hex } from "../src/research/canonico.js";
import { creaFintoD1 } from "./finto-d1.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const SCHEMA = QUI + "../schema.sql";
const GOLDEN = JSON.parse(readFileSync(QUI + "fixtures/research-golden-rev2.json", "utf8"));
const copia = (x) => JSON.parse(JSON.stringify(x));

const CHIAVI = JSON.stringify({
  lineage: { corrente: 7, versioni: {
    7: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f" } },
  tombstone: { corrente: 9, versioni: {
    9: "202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f" } },
});
const MITTENTE = GOLDEN.richiesta.mittente;
const SEGRETO = GOLDEN.richiesta.segreto_cancellazione;
const ALTRO = "3".repeat(32);
const SEGRETO_ALTRO = "4".repeat(64);

function ambiente(db, { cap = 5, query = 500, ...extra } = {}) {
  return {
    DB: db,
    RESEARCH_ENABLED: "true",
    RESEARCH_AMBIENTE: "prova_locale",
    RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST: String(cap),
    RESEARCH_MAX_D1_QUERIES_PER_REQUEST: String(query),
    RESEARCH_DEPLOYMENT: "prova-locale",
    RESEARCH_RUNTIME_QUALIFICATION: JSON.stringify({ versione: 1, id: "q-locale",
      deployment: "prova-locale", max_contributions_per_request: cap,
      max_d1_queries_per_request: query, valida_fino: "2099-01-01T00:00:00Z" }),
    RESEARCH_HMAC_KEYS: CHIAVI,
    ...extra,
  };
}

async function manda(amb, percorso, corpo, { token, metodo = "POST" } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const risposta = await server.fetch(new Request("https://esempio.invalid" + percorso, {
    method: metodo, headers, body: metodo === "POST" ? JSON.stringify(corpo) : undefined,
  }), amb);
  const testo = await risposta.text();
  return { stato: risposta.status, corpo: testo ? JSON.parse(testo) : null,
    headers: risposta.headers };
}

async function consenso(amb, mittente = MITTENTE, segreto = SEGRETO) {
  const esito = await manda(amb, "/research/consenso",
    { mittente, segreto_cancellazione: segreto, versione_consenso: 1 });
  assert.equal(esito.stato, 200, JSON.stringify(esito.corpo));
  return esito.corpo.generation;
}

function busta(partite, mittente = MITTENTE, segreto = SEGRETO) {
  return { ...copia(GOLDEN.richiesta), mittente, segreto_cancellazione: segreto,
    partite: copia(partite) };
}

const bo1 = () => copia(GOLDEN.richiesta.partite[0]);
const bo3 = () => copia(GOLDEN.richiesta.partite[1]);
const stati = (esito) => esito.corpo.risultati.map((r) => r.stato);

function nuovoDb() {
  return creaFintoD1(SCHEMA);
}

test("/salute pubblica il blocco research dalla stessa configurazione", async () => {
  const db = nuovoDb();
  const accesa = await manda(ambiente(db), "/salute", null, { metodo: "GET" });
  assert.equal(accesa.corpo.stato, "vivo");
  assert.deepEqual(accesa.corpo.versioni_partite_accettate, [1, 2]);
  assert.equal(accesa.corpo.research.enabled, true);
  assert.deepEqual(accesa.corpo.research.models, [1]);
  assert.equal(accesa.corpo.research.max_contributions_per_request, 5);
  const spenta = await manda({ DB: db }, "/salute", null, { metodo: "GET" });
  assert.equal(spenta.corpo.research.enabled, false);
});

test("con Research spenta le route rispondono 503 senza toccare D1", async () => {
  const db = nuovoDb();
  const amb = ambiente(db, { RESEARCH_ENABLED: undefined });
  for (const percorso of ["/research/partite", "/research/consenso", "/research/elimina"]) {
    const esito = await manda(amb, percorso, busta([bo1()]), { token: "a".repeat(64) });
    assert.equal(esito.stato, 503, percorso);
    assert.equal(esito.corpo.errore, "research_disabilitata");
  }
  const staleQ = ambiente(db, { RESEARCH_RUNTIME_QUALIFICATION: JSON.stringify({ versione: 1,
    id: "q", deployment: "prova-locale", max_contributions_per_request: 5,
    max_d1_queries_per_request: 500, valida_fino: "2020-01-01T00:00:00Z" }) });
  assert.equal((await manda(staleQ, "/research/partite", busta([bo1()]),
    { token: "a".repeat(64) })).stato, 503);
  assert.equal(db.registro.letture, 0);
  assert.equal(db.registro.statement, 0);
});

test("consenso, upload, retry identico: accepted_new, poi unchanged senza righe nuove", async () => {
  const db = nuovoDb();
  const amb = ambiente(db);
  const token = await consenso(amb);
  assert.match(token, /^[0-9a-f]{64}$/);
  const generazione = db.tutte("SELECT hash FROM research_consent_generation").map((r) => r.hash);
  assert.deepEqual(generazione, [await sha256Hex(token)]);

  const prima = await manda(amb, "/research/partite", busta([bo1(), bo3()]), { token });
  assert.equal(prima.stato, 200, JSON.stringify(prima.corpo));
  assert.deepEqual(prima.corpo.risultati.map((r) => [r.stato, r.input_indices]),
    [["accepted_new", [0]], ["accepted_new", [1]]]);
  assert.equal(db.conta("research_contribution"), 2);
  assert.equal(db.conta("research_game_contribution"), 4);
  assert.equal(db.conta("research_event"), 13);
  assert.equal(db.conta("research_deck_card"), 36);
  assert.equal(db.conta("research_sideboard_delta"), 2);
  const [riga] = db.tutte(`SELECT formato, evento, esito, turni FROM research_contribution
    WHERE id_pubblico = ?`, bo3().id_pubblico);
  assert.deepEqual({ ...riga }, { formato: "Standard", evento: "SyntheticBO3", esito: "vinta", turni: 24 });

  const dopo = await manda(amb, "/research/partite", busta([bo1(), bo3()]), { token });
  assert.deepEqual(stati(dopo), ["unchanged", "unchanged"]);
  assert.equal(db.conta("research_revisione_server"), 2);
  assert.equal(db.conta("research_event"), 13);

  // Nessun segreto o token nel database.
  for (const tabella of db.tutte("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'research_%'")) {
    const righe = JSON.stringify(db.tutte(`SELECT * FROM ${tabella.name}`));
    assert.ok(!righe.includes(token) && !righe.includes(SEGRETO), tabella.name);
  }
});

test("revisione maggiore, minore, conflitto e overflow", async () => {
  const db = nuovoDb();
  const amb = ambiente(db);
  const token = await consenso(amb);
  await manda(amb, "/research/partite", busta([bo1()]), { token });
  const piu = bo1(); piu.revisione.osservazioni = 3; piu.turni = 7;
  assert.deepEqual(stati(await manda(amb, "/research/partite", busta([piu]), { token })), ["updated"]);
  assert.deepEqual(stati(await manda(amb, "/research/partite", busta([bo1()]), { token })), ["stale"]);
  assert.equal(db.conta("research_snapshot_storia"), 1);
  const esiti = [];
  for (const turni of [8, 9, 10, 11]) {
    const variante = bo1(); variante.revisione.osservazioni = 3; variante.turni = turni;
    esiti.push(...stati(await manda(amb, "/research/partite", busta([variante]), { token })));
  }
  assert.deepEqual(esiti, ["conflict", "conflict", "conflict_overflow", "conflict_overflow"]);
  assert.equal(db.conta("research_event"), 0, "nessuna proiezione da uno stato conteso");
  assert.equal(db.conta("research_contribution_variante"), 3);
  const [c] = db.tutte("SELECT stato, overflow, snapshot FROM research_contribution");
  assert.deepEqual({ ...c }, { stato: "conflitto", overflow: 1, snapshot: null });
  const futuro = bo1(); futuro.revisione.modello = 2;
  const rifiutata = await manda(amb, "/research/partite", busta([futuro]), { token });
  assert.equal(rifiutata.corpo.risultati[0].motivo_codice, "modello_non_supportato");
});

test("il corpo effettivo sta in un posto solo; le varianti esistono solo nei conflitti", async () => {
  const db = nuovoDb();
  const amb = ambiente(db);
  const token = await consenso(amb);
  await manda(amb, "/research/partite", busta([bo1()]), { token });
  assert.equal(db.conta("research_contribution_variante"), 0);
  const [effettiva] = db.tutte("SELECT snapshot, variant_hash FROM research_contribution");
  assert.ok(effettiva.snapshot && effettiva.variant_hash);
  const altra = bo1(); altra.turni = 7;
  assert.deepEqual(stati(await manda(amb, "/research/partite", busta([altra]), { token })), ["conflict"]);
  assert.equal(db.conta("research_contribution_variante"), 2, "entrambe le varianti, anche quella che era effettiva");
  // Retry della variante che era effettiva: stato invariato, niente scritture.
  const prima = db.registro.statement;
  assert.deepEqual(stati(await manda(amb, "/research/partite", busta([bo1()]), { token })), ["conflict"]);
  assert.equal(db.registro.statement, prima);
  const bump = bo1(); bump.revisione.osservazioni = 3;
  assert.deepEqual(stati(await manda(amb, "/research/partite", busta([bump]), { token })), ["updated"]);
  assert.equal(db.conta("research_contribution_variante"), 0, "una revisione maggiore risolve e le varianti spariscono");
  assert.equal(db.conta("research_snapshot_storia"), 2, "il summary conteso finisce in storia");
  assert.equal(db.conta("research_event"), 4);
});

test("due mittenti nello stesso match: due contribution, nessun overwrite", async () => {
  const db = nuovoDb();
  const amb = ambiente(db);
  const t1 = await consenso(amb);
  const t2 = await consenso(amb, ALTRO, SEGRETO_ALTRO);
  assert.deepEqual(stati(await manda(amb, "/research/partite", busta([bo1()]), { token: t1 })), ["accepted_new"]);
  const loro = bo1(); loro.games[0].on_play = true;
  assert.deepEqual(stati(await manda(amb, "/research/partite", busta([loro], ALTRO, SEGRETO_ALTRO),
    { token: t2 })), ["accepted_new"]);
  assert.equal(db.tutte("SELECT COUNT(DISTINCT mittente) AS n FROM research_contribution WHERE id_pubblico = ?",
    bo1().id_pubblico)[0].n, 2);
  // Il token di uno non vale per l'altro.
  const scambio = await manda(amb, "/research/partite", busta([bo1()]), { token: t2 });
  assert.equal(scambio.stato, 403);
});

test("batch misto: esiti per elemento con HTTP 200", async () => {
  const db = nuovoDb();
  const amb = ambiente(db);
  const token = await consenso(amb);
  const rotta = bo3(); rotta.games[0].extra = 1;
  const esito = await manda(amb, "/research/partite", busta([bo1(), rotta]), { token });
  assert.equal(esito.stato, 200);
  assert.deepEqual(esito.corpo.risultati.map((r) => [r.stato, r.motivo_codice ?? null]),
    [["accepted_new", null], ["rejected", "campo_non_ammesso"]]);
  // Lo stesso id due volte nello stesso batch: un risultato con due indici.
  const doppio = await manda(amb, "/research/partite", busta([bo3(), bo3()]), { token });
  assert.deepEqual(doppio.corpo.risultati.map((r) => [r.stato, r.input_indices]),
    [["accepted_new", [0, 1]]]);
});

test("revoca, re-consenso e vecchio token", async () => {
  const db = nuovoDb();
  const amb = ambiente(db);
  const vecchio = await consenso(amb);
  await manda(amb, "/research/partite", busta([bo1()]), { token: vecchio });
  const revoca = await manda(amb, "/research/consenso/revoca",
    { mittente: MITTENTE, segreto_cancellazione: SEGRETO });
  assert.equal(revoca.stato, 200);
  const bloccato = await manda(amb, "/research/partite", busta([bo3()]), { token: vecchio });
  assert.equal(bloccato.stato, 403);
  assert.equal(bloccato.corpo.errore, "generation_inactive");
  assert.equal(db.conta("research_contribution"), 1, "la revoca conserva i dati");
  const nuovo = await consenso(amb);
  assert.notEqual(nuovo, vecchio);
  assert.deepEqual(stati(await manda(amb, "/research/partite", busta([bo1()]), { token: nuovo })), ["unchanged"]);
  assert.equal((await manda(amb, "/research/partite", busta([bo1()]), { token: vecchio })).stato, 403);
});

test("un segreto diverso per la stessa lineage viene respinto", async () => {
  const db = nuovoDb();
  const amb = ambiente(db);
  const token = await consenso(amb);
  const altro = await manda(amb, "/research/consenso",
    { mittente: MITTENTE, segreto_cancellazione: SEGRETO_ALTRO, versione_consenso: 1 });
  assert.equal(altro.stato, 403);
  assert.equal(altro.corpo.errore, "lineage_credential_mismatch");
  const upload = await manda(amb, "/research/partite", busta([bo1()], MITTENTE, SEGRETO_ALTRO), { token });
  assert.equal(upload.stato, 403);
  assert.equal(upload.corpo.errore, "lineage_credential_mismatch");
});

test("il TOFU pretende il segreto gia' legato al mittente nei contributori legacy", async () => {
  const db = nuovoDb();
  const amb = ambiente(db);
  await db.batch([db.prepare(`INSERT INTO contributori (mittente, cancellazione_hash, creato)
    VALUES (?, ?, ?)`).bind(MITTENTE, await sha256Hex(SEGRETO_ALTRO), "2026-09-01T00:00:00Z")]);
  const rifiutato = await manda(amb, "/research/consenso",
    { mittente: MITTENTE, segreto_cancellazione: SEGRETO, versione_consenso: 1 });
  assert.equal(rifiutato.stato, 403);
  await consenso(amb, MITTENTE, SEGRETO_ALTRO);
});

test("un D1 con la sola migrazione Research: senza tabelle legacy nessun verificatore, il consenso passa", async () => {
  // Lo staging R3 riceve soltanto la migrazione Research: `contributori` non
  // esiste, quindi non esiste nemmeno un verificatore legacy da confrontare.
  const db = creaFintoD1(QUI + "../migrazioni/2026-09-14-research-r3.sql");
  const amb = ambiente(db);
  const token = await consenso(amb);
  const esito = await manda(amb, "/research/partite", busta([bo1()]), { token });
  assert.deepEqual(stati(esito), ["accepted_new"]);
});

test("delete: tombstone, dati via, vecchio token morto, stesso id soppresso, id nuovo ammesso", async () => {
  const db = nuovoDb();
  const amb = ambiente(db);
  const vecchio = await consenso(amb);
  await manda(amb, "/research/partite", busta([bo1(), bo3()]), { token: vecchio });
  const cancellato = await manda(amb, "/research/elimina",
    { mittente: MITTENTE, segreto_cancellazione: SEGRETO });
  assert.equal(cancellato.stato, 200, JSON.stringify(cancellato.corpo));
  assert.equal(cancellato.corpo.stato, "deleted");
  for (const tabella of ["research_contribution", "research_contribution_variante",
    "research_snapshot_storia", "research_revisione_server", "research_game_contribution",
    "research_event", "research_deck_card", "research_sideboard_delta",
    "research_consent_generation"]) {
    assert.equal(db.conta(tabella), 0, tabella);
  }
  assert.equal(db.conta("research_deleted_contribution"), 2);
  assert.equal(db.conta("research_consent_tombstone"), 1);
  assert.deepEqual(db.tutte("SELECT stato FROM research_lineage").map((r) => r.stato), ["deleted"]);
  assert.equal((await manda(amb, "/research/partite", busta([bo1()]), { token: vecchio })).stato, 403);
  const nuovo = await consenso(amb);
  const replay = await manda(amb, "/research/partite", busta([bo1(), bo3()]), { token: nuovo });
  assert.deepEqual(replay.corpo.risultati.map((r) => r.motivo_codice),
    ["deleted_contribution", "deleted_contribution"]);
  const diverso = bo1(); diverso.id_pubblico = "5".repeat(64);
  assert.deepEqual(stati(await manda(amb, "/research/partite", busta([diverso]), { token: nuovo })), ["accepted_new"]);
  // Un mittente indipendente con lo stesso match non e' soppresso: nuova lineage.
  const t2 = await consenso(amb, ALTRO, SEGRETO_ALTRO);
  assert.deepEqual(stati(await manda(amb, "/research/partite", busta([bo1()], ALTRO, SEGRETO_ALTRO),
    { token: t2 })), ["accepted_new"]);
  // Il tombstone non conserva mittente, id_pubblico o segreto.
  const tomba = JSON.stringify(db.tutte("SELECT * FROM research_deleted_contribution"));
  assert.ok(!tomba.includes(MITTENTE) && !tomba.includes(bo1().id_pubblico) && !tomba.includes(SEGRETO));
});

test("budget: letture oltre il cap e piano oltre il residuo si fermano senza scrivere", async () => {
  const db = nuovoDb();
  const token = await consenso(ambiente(db));
  const letture = db.registro.letture;
  const statement = db.registro.statement;
  const quattro = await manda(ambiente(db, { query: 4 }), "/research/partite", busta([bo1(), bo3()]), { token });
  assert.equal(quattro.stato, 413);
  assert.equal(quattro.corpo.errore, "budget_d1_superato");
  assert.equal(db.registro.letture - letture, 4, "quattro letture, la quinta non parte");
  const nove = await manda(ambiente(db, { query: 9 }), "/research/partite", busta([bo1(), bo3()]), { token });
  assert.equal(nove.stato, 413);
  assert.equal(db.registro.statement, statement, "nessuna scrittura");
  assert.equal(db.conta("research_contribution"), 0);
});

test("il piano eseguito coincide con i descriptor riservati", async () => {
  const db = nuovoDb();
  const amb = ambiente(db);
  const token = await consenso(amb);
  const prima = db.registro.statement;
  const esito = await manda(amb, "/research/partite", busta([bo1(), bo3()]), { token });
  // Dopo la compattazione D1 una snapshot effettiva non scrive varianti.
  // BO1: guardia, contribution, game, eventi, mazzo = 5.
  // BO3: guardia, contribution, game, eventi, mazzo x2, delta = 7.
  assert.equal(db.registro.statement - prima, 12);
  assert.equal(esito.corpo.diagnostica.statement_pianificati, 12);
  assert.equal(esito.corpo.diagnostica.charged, esito.corpo.diagnostica.letture + 12);
});

test("corsa CAS: chi perde rilegge, ripianifica e diventa stale", async () => {
  const db = nuovoDb();
  const amb = ambiente(db);
  const token = await consenso(amb);
  const vincente = bo1(); vincente.revisione.osservazioni = 3; vincente.turni = 7;
  db.primaDelBatch = async () => {
    const dentro = await manda(amb, "/research/partite", busta([vincente]), { token });
    assert.deepEqual(stati(dentro), ["accepted_new"]);
  };
  const perdente = await manda(amb, "/research/partite", busta([bo1()]), { token });
  assert.deepEqual(stati(perdente), ["stale"]);
  const [riga] = db.tutte("SELECT revisione_osservazioni, turni FROM research_contribution");
  assert.deepEqual({ ...riga }, { revisione_osservazioni: 3, turni: 7 });
});

test("upload preparato prima del delete e arrivato dopo: la guardia lo ferma", async () => {
  const db = nuovoDb();
  const amb = ambiente(db);
  const token = await consenso(amb);
  db.primaDelBatch = async () => {
    const del = await manda(amb, "/research/elimina", { mittente: MITTENTE, segreto_cancellazione: SEGRETO });
    assert.equal(del.corpo.stato, "deleted");
  };
  const upload = await manda(amb, "/research/partite", busta([bo1()]), { token });
  assert.deepEqual(upload.corpo.risultati.map((r) => [r.stato, r.motivo_codice]),
    [["rejected", "generation_inactive"]]);
  assert.equal(db.conta("research_contribution"), 0);
});

test("delete che si guasta a ogni statement: rollback, deleting e retry completo", async () => {
  for (let k = 0; k < 11; k += 1) {
    const db = nuovoDb();
    const amb = ambiente(db);
    const token = await consenso(amb);
    await manda(amb, "/research/partite", busta([bo1()]), { token });
    db.guasti.saltaBatch = 1;          // il mark passa, il chunk si guasta
    db.guasti.statement = k;
    const guasto = await manda(amb, "/research/elimina", { mittente: MITTENTE, segreto_cancellazione: SEGRETO });
    assert.equal(guasto.stato, 503, `statement ${k}`);
    assert.equal(db.conta("research_deleted_contribution"), 0, `tombstone rollback ${k}`);
    assert.equal(db.conta("research_contribution"), 1, `dati intatti ${k}`);
    assert.deepEqual(db.tutte("SELECT stato FROM research_lineage").map((r) => r.stato), ["deleting"]);
    assert.equal((await manda(amb, "/research/partite", busta([bo3()]), { token })).stato, 403);
    const nuovo = await manda(amb, "/research/consenso",
      { mittente: MITTENTE, segreto_cancellazione: SEGRETO, versione_consenso: 1 });
    assert.equal(nuovo.stato, 409, "nessuna generation durante deleting");
    const retry = await manda(amb, "/research/elimina", { mittente: MITTENTE, segreto_cancellazione: SEGRETO });
    assert.equal(retry.corpo.stato, "deleted", `retry ${k}`);
    assert.equal(db.conta("research_deleted_contribution"), 1);
    assert.equal(db.conta("research_contribution"), 0);
  }
});

test("delete lungo oltre il budget: continuation e deleting fra i segmenti", async () => {
  const db = nuovoDb();
  const token = await consenso(ambiente(db));
  const tante = Array.from({ length: 5 }, (_, i) => {
    const c = bo1(); c.id_pubblico = (i + 1).toString(16).padStart(64, "0"); return c;
  });
  await manda(ambiente(db), "/research/partite", busta(tante), { token });
  const corto = ambiente(db, { query: 20 });
  const primo = await manda(corto, "/research/elimina", { mittente: MITTENTE, segreto_cancellazione: SEGRETO });
  assert.equal(primo.stato, 202);
  assert.equal(primo.corpo.stato, "deleting");
  assert.equal(primo.corpo.motivo_codice, "budget_d1_retry_esaurito");
  assert.ok(db.conta("research_contribution") > 0);
  let giri = 0;
  let esito = primo;
  while (esito.corpo.stato === "deleting" && giri < 10) {
    esito = await manda(corto, "/research/elimina", { mittente: MITTENTE, segreto_cancellazione: SEGRETO });
    giri += 1;
  }
  assert.equal(esito.corpo.stato, "deleted");
  assert.equal(db.conta("research_deleted_contribution"), 5);
});

test("esito incerto dopo il commit: 503 e un retry idempotente", async () => {
  const db = nuovoDb();
  const amb = ambiente(db);
  const token = await consenso(amb);
  db.guasti.dopoCommit = true;
  const incerto = await manda(amb, "/research/partite", busta([bo1()]), { token });
  assert.equal(incerto.stato, 503);
  assert.deepEqual(stati(await manda(amb, "/research/partite", busta([bo1()]), { token })), ["unchanged"]);
});

test("errori di forma e intestazioni: 400, 413, nessun CORS", async () => {
  const db = nuovoDb();
  const amb = ambiente(db);
  const token = await consenso(amb);
  assert.equal((await manda(amb, "/research/partite", busta([bo1()]))).stato, 400);
  const troppe = await manda(amb, "/research/partite", busta(Array(6).fill(bo1())), { token });
  assert.equal(troppe.stato, 413);
  assert.equal(troppe.corpo.errore, "troppi_contributi");
  assert.equal(troppe.corpo.cap, 5);
  const opzioni = await server.fetch(new Request("https://esempio.invalid/research/partite",
    { method: "OPTIONS" }), amb);
  assert.equal(opzioni.headers.get("access-control-allow-origin"), null);
  const ok = await manda(amb, "/research/partite", busta([bo1()]), { token });
  assert.equal(ok.headers.get("access-control-allow-origin"), null);
  assert.equal(ok.headers.get("cache-control"), "no-store");
});

test("nessun token o segreto finisce nei log", async () => {
  const scritti = [];
  const originali = { log: console.log, error: console.error, warn: console.warn };
  for (const nome of Object.keys(originali)) {
    console[nome] = (...parti) => scritti.push(parti.map(String).join(" "));
  }
  let token;
  try {
    const db = nuovoDb();
    const amb = ambiente(db);
    token = await consenso(amb);
    await manda(amb, "/research/partite", busta([bo1()]), { token });
    db.guasti.dopoCommit = true;
    await manda(amb, "/research/partite", busta([bo3()]), { token });
    await manda(amb, "/research/consenso", { mittente: MITTENTE,
      segreto_cancellazione: SEGRETO_ALTRO, versione_consenso: 1 });
    await manda(amb, "/research/elimina", { mittente: MITTENTE, segreto_cancellazione: SEGRETO });
  } finally {
    Object.assign(console, originali);
  }
  const tutto = scritti.join("\n");
  for (const segreto of [token, SEGRETO, SEGRETO_ALTRO]) assert.ok(!tutto.includes(segreto));
});
