// Brew v2 nelle letture pubbliche (S1): /meta e /archetipo con i gruppi,
// conteggi esatti in ogni filtro, privacy sotto soglia, nessuna scrittura
// nelle GET e compatibilita' con i campi e il frontend di prima.

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { creaFintoD1 } from "./finto-d1.js";
import { creaDocumento } from "./finto-dom.js";
import { ALGORITMO_BREW } from "../src/brew-clustering.js";
import { assegnaBrew } from "../src/brew-gruppi.js";
import { leggiArchetipo } from "../src/dettaglio-archetipo.js";
import { leggiGiocoRisposta, leggiMeta } from "../src/lettura.js";
import server from "../src/index.js";
import {
  AURE_RICONOSCIUTE, BASE, BASE_56, BASE_59, GENERICHE_X, STESSO_COLORE, giocaPartite,
} from "./fixtures/brew-sintetici.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const SCHEMA = QUI + "../schema.sql";
const [A, B, C, D, E, H, P, Q] = ["a", "b", "c", "d", "e", "7", "5", "6"].map((x) => x.repeat(64));
const MAI = "0".repeat(64);
const GRUPPO_MAI = `bg_${"0".repeat(32)}`;

// A: 25 partite BO1 Gold recenti + 20 BO3 Platinum di venti giorni fa.
// B e' il 56/60 di A; C un falso amico; D sta a una carta da A ma ha 29
// partite; E e' Mono White Auras, riconosciuta.
function scenario() {
  const db = creaFintoD1(SCHEMA);
  giocaPartite(db, A, BASE, { partite: 25, vinte: 15, giorni: 2 });
  giocaPartite(db, A, BASE, { partite: 20, vinte: 12, evento: "Traditional_Ladder",
    rank: "Platinum", giorni: 20 });
  giocaPartite(db, B, BASE_56, { partite: 34, vinte: 20, giorni: 3 });
  giocaPartite(db, C, STESSO_COLORE, { partite: 31, vinte: 15, giorni: 5 });
  giocaPartite(db, D, BASE_59, { partite: 29, vinte: 29, giorni: 4 });
  giocaPartite(db, E, AURE_RICONOSCIUTE, { partite: 40, vinte: 22, giorni: 6 });
  return db;
}

const url = (percorso) => new URL(`https://x.invalid${percorso}`);
const meta = async (db, q = "") => (await leggiMeta(db, url(`/meta?formato=Standard${q}`))).corpo;
const dettaglio = (db, q) => leggiArchetipo(db, url(`/archetipo?formato=Standard${q}`));
const altroDi = (corpo) => corpo.mazzi.find((mazzo) => mazzo.tipo_dettaglio === "altro");
const gruppoCon = (altro, impronta) =>
  altro.gruppi_brew.find((g) => g.varianti_brew.some((v) => v.impronta === impronta));
function senzaV2(corpo) {
  return { ...corpo, mazzi: corpo.mazzi.map((mazzo) => {
    if (mazzo.tipo_dettaglio !== "altro") return mazzo;
    const { gruppi_brew: _g, raggruppamento_brew: _r, ...resto } = mazzo;
    return resto;
  }) };
}
function identita(db) {
  const righe = db.tutte("SELECT impronta, gruppo_id, variante_id FROM brew_membro");
  return {
    gruppo: new Map(righe.map((r) => [r.impronta, r.gruppo_id])),
    variante: new Map(righe.map((r) => [r.impronta, r.variante_id])),
  };
}

const FILTRI = ["", "&periodo=7", "&periodo=14", "&periodo=30", "&periodo=totale",
  "&modalita=BO1", "&modalita=BO3", "&rank=Gold", "&rank=Platinum", "&rank=Gold,Platinum",
  "&periodo=totale&modalita=BO3", "&periodo=7&modalita=BO1&rank=Gold"];

// Ogni partita conta una volta, e i gruppi non aggiungono ne' tolgono niente.
function controllaConteggi(corpo) {
  assert.equal(corpo.mazzi.reduce((somma, mazzo) => somma + mazzo.partite, 0), corpo.partite_totali);
  const altro = altroDi(corpo);
  if (!altro) return;
  const gruppi = altro.gruppi_brew;
  assert.equal(gruppi.reduce((s, g) => s + g.partite, 0) + altro.brew_sotto_soglia.partite,
    altro.partite);
  for (const g of gruppi) {
    assert.equal(g.varianti_brew.reduce((s, v) => s + v.partite, 0), g.partite);
    assert.equal(g.varianti_brew.reduce((s, v) => s + v.vittorie, 0), g.vittorie);
    assert.ok(g.varianti_brew.every((v) => v.partite >= 30 && v.decklist_pubblicabile));
  }
  const nelleVarianti = altro.varianti_brew.map((v) => v.impronta).sort();
  const neiGruppi = gruppi.flatMap((g) => g.varianti_brew.map((v) => v.impronta)).sort();
  assert.deepEqual(neiGruppi, nelleVarianti, "le stesse liste, senza doppioni");
}

test("i campi di prima restano identici con o senza gruppi, in ogni filtro", async () => {
  const db = scenario();
  const prima = {};
  for (const filtro of FILTRI) prima[filtro] = await meta(db, filtro);
  // Prima dell'assegnazione le liste pubbliche sono gruppi a se', senza id.
  const attesa = altroDi(prima[""]);
  assert.ok(attesa.gruppi_brew.every((g) => g.in_attesa_di_raggruppamento &&
    g.gruppo_brew_id === null && g.varianti_brew.every((v) => v.variante_id === null)));
  controllaConteggi(prima[""]);
  await assegnaBrew(db, "Standard");
  for (const filtro of FILTRI) {
    const dopo = await meta(db, filtro);
    assert.deepEqual(senzaV2(dopo), senzaV2(prima[filtro]), filtro);
    controllaConteggi(dopo);
  }
});

test("il 56/60 e' un gruppo solo; la lista sotto soglia non compare", async () => {
  const db = scenario();
  await assegnaBrew(db, "Standard");
  const corpo = await meta(db);
  const altro = altroDi(corpo);
  assert.deepEqual(altro.raggruppamento_brew,
    { algoritmo: ALGORITMO_BREW, soglia_distanza: 4, disponibile: true });
  const g = gruppoCon(altro, A);
  assert.match(g.gruppo_brew_id, /^bg_[0-9a-f]{32}$/);
  assert.equal(g.tipo_dettaglio, "brew_group");
  assert.equal(g.in_attesa_di_raggruppamento, false);
  assert.deepEqual(g.varianti_brew.map((v) =>
    [v.impronta, v.partite, v.rappresentante, v.distanza_rappresentante]),
  [[A, 45, true, 0], [B, 34, false, 4]]);
  assert.ok(g.varianti_brew.every((v) => /^bv_[0-9a-f]{32}$/.test(v.variante_id)));
  assert.deepEqual([g.partite, g.vittorie, g.sconfitte, g.record_pubblico, g.win_rate],
    [79, 47, 32, true, 59.49]);
  assert.deepEqual(altro.gruppi_brew.map((x) => x.etichetta), ["Brew #1", "Brew #2"]);
  assert.deepEqual(altro.brew_sotto_soglia, { liste: 1, partite: 29 });
  assert.equal(JSON.stringify(corpo).includes(D), false);
  assert.equal(db.tutte("SELECT 1 FROM brew_membro WHERE impronta = ?", D).length, 0);
});

test("l'identita' dei gruppi non cambia con periodo, rank e modalita'", async () => {
  const db = scenario();
  await assegnaBrew(db, "Standard");
  const { gruppo, variante } = identita(db);
  for (const filtro of FILTRI) {
    const corpo = await meta(db, filtro);
    const altro = altroDi(corpo);
    if (!altro) continue;
    for (const g of altro.gruppi_brew) {
      for (const v of g.varianti_brew) {
        assert.equal(g.gruppo_brew_id, gruppo.get(v.impronta), filtro);
        assert.equal(v.variante_id, variante.get(v.impronta), filtro);
      }
    }
    // Una lista sotto soglia nel filtro non porta fuori ne' impronta ne' id.
    const testo = JSON.stringify(corpo);
    const visibili = new Set(altro.varianti_brew.map((v) => v.impronta));
    for (const impronta of [A, B, C, D]) {
      if (visibili.has(impronta)) continue;
      assert.equal(testo.includes(impronta), false, `${filtro} ${impronta[0]}`);
      if (variante.has(impronta)) assert.equal(testo.includes(variante.get(impronta)), false);
    }
  }
  // Negli ultimi sette giorni A ha 25 partite: resta B, nello stesso gruppo,
  // e la distanza da un rappresentante non pubblico non esce.
  const sette = gruppoCon(altroDi(await meta(db, "&periodo=7")), B);
  assert.equal(sette.gruppo_brew_id, gruppo.get(A));
  assert.deepEqual(sette.varianti_brew.map((v) => [v.impronta, v.rappresentante,
    v.distanza_rappresentante]), [[B, false, null]]);
});

test("BO1, BO3 e vista combinata: un gruppo per lista, nessun doppio conteggio", async () => {
  const db = scenario();
  giocaPartite(db, H, GENERICHE_X, { partite: 30, vinte: 10 });
  giocaPartite(db, H, GENERICHE_X, { partite: 30, vinte: 20, evento: "Traditional_Ladder" });
  await assegnaBrew(db, "Standard");
  const [insieme, bo1, bo3] = await Promise.all(["", "&modalita=BO1", "&modalita=BO3"]
    .map((filtro) => meta(db, filtro)));
  for (const corpo of [insieme, bo1, bo3]) controllaConteggi(corpo);
  assert.equal(altroDi(bo1).partite + altroDi(bo3).partite, altroDi(insieme).partite);
  const id = identita(db).gruppo.get(H);
  const perVista = [insieme, bo1, bo3].map((corpo) => gruppoCon(altroDi(corpo), H));
  assert.deepEqual(perVista.map((g) => [g.gruppo_brew_id, g.partite]), [[id, 60], [id, 30], [id, 30]]);
  // A e' in entrambe le modalita': una sola volta nella vista combinata, e
  // sotto soglia in ciascuna delle due.
  const combinate = altroDi(insieme).gruppi_brew.flatMap((g) => g.varianti_brew.map((v) => v.impronta));
  assert.equal(combinate.filter((impronta) => impronta === A).length, 1);
  for (const corpo of [bo1, bo3]) assert.equal(JSON.stringify(corpo).includes(A), false);
});

test("dettaglio ?id_brew=: varianti pubblicabili del filtro, 404 identico a un id mai esistito", async () => {
  const db = scenario();
  await assegnaBrew(db, "Standard");
  const { gruppo, variante } = identita(db);
  const id = gruppo.get(A);
  const pieno = await dettaglio(db, `&id_brew=${id}`);
  assert.equal(pieno.stato, 200);
  const corpo = pieno.corpo;
  assert.deepEqual([corpo.tipo_dettaglio, corpo.gruppo_brew_id, corpo.algoritmo, corpo.soglia_distanza],
    ["brew_group", id, ALGORITMO_BREW, 4]);
  assert.deepEqual(corpo.varianti.map((v) => [v.impronta, v.variante_id, v.distanza_rappresentante]),
    [[A, variante.get(A), 0], [B, variante.get(B), 4]]);
  assert.ok(corpo.varianti.every((v) => v.decklist_pubblicabile && v.carte.length > 0));
  assert.deepEqual([corpo.partite, corpo.vittorie, corpo.varianti_osservate, corpo.altre_varianti],
    [79, 47, 2, null]);
  assert.equal((await dettaglio(db, `&id_brew=${id.toUpperCase().replace("BG_", "bg_")}`)).stato, 200);

  const sette = await dettaglio(db, `&id_brew=${id}&periodo=7`);
  assert.deepEqual(sette.corpo.varianti.map((v) => [v.impronta, v.distanza_rappresentante]), [[B, null]]);
  assert.equal(sette.corpo.varianti_osservate, 1);
  assert.equal(JSON.stringify(sette).includes(A), false);

  // In BO3 A ha 20 partite e B nessuna: il gruppo non si conferma nemmeno.
  const vuoto = await dettaglio(db, `&id_brew=${id}&modalita=BO3`);
  assert.equal(vuoto.stato, 404);
  assert.deepEqual(vuoto, await dettaglio(db, `&id_brew=${GRUPPO_MAI}&modalita=BO3`));
  const http = async (q) => {
    const risposta = await server.fetch(new Request(`https://x.invalid/archetipo?formato=Standard${q}`),
      { DB: db });
    return [risposta.status, await risposta.text()];
  };
  assert.deepEqual(await http(`&id_brew=${id}&modalita=BO3`), await http(`&id_brew=${GRUPPO_MAI}&modalita=BO3`));

  for (const q of ["&id_brew=bg_123", `&id_brew=${id}&impronta=${A}`, `&id_brew=${id}&id=aure-mono-bianco`,
    `&id_brew=${A}`, `&id_brew=${variante.get(A)}`]) {
    assert.equal((await dettaglio(db, q)).stato, 400, q);
  }
});

test("percorso legacy ?impronta= invariato, con il collegamento al gruppo", async () => {
  const db = scenario();
  const prima = await dettaglio(db, `&impronta=${A}`);
  const archetipoPrima = await dettaglio(db, "&id=aure-mono-bianco");
  await assegnaBrew(db, "Standard");
  const dopo = await dettaglio(db, `&impronta=${A}`);
  const { gruppo, variante } = identita(db);
  const { gruppo_brew_id: g0, variante_brew_id: v0, ...restoPrima } = prima.corpo;
  const { gruppo_brew_id: g1, variante_brew_id: v1, ...restoDopo } = dopo.corpo;
  assert.deepEqual(restoDopo, restoPrima);
  assert.deepEqual([g0, v0], [null, null]);
  assert.deepEqual([g1, v1], [gruppo.get(A), variante.get(A)]);
  // Gli archetipi riconosciuti non cambiano di un campo.
  assert.deepEqual(await dettaglio(db, "&id=aure-mono-bianco"), archetipoPrima);
  assert.equal("gruppo_brew_id" in archetipoPrima.corpo, false);
  // Sotto soglia resta indistinguibile da un'impronta mai vista.
  assert.deepEqual(await dettaglio(db, `&impronta=${D}`), await dettaglio(db, `&impronta=${MAI}`));
});

test("privacy 29+1, 20+20, 30+29: le liste sotto soglia non entrano in nessun gruppo", async () => {
  const casi = [
    { nome: "29+1", liste: [[P, BASE, 29], [Q, BASE_59, 1]], gruppi: 0, sotto: { liste: 2, partite: 30 } },
    { nome: "20+20", liste: [[P, BASE, 20], [Q, BASE_59, 20]], gruppi: 0, sotto: { liste: 2, partite: 40 } },
    { nome: "30+29", liste: [[P, BASE, 30], [Q, BASE_59, 29]], gruppi: 1, sotto: { liste: 1, partite: 29 } },
  ];
  for (const caso of casi) {
    const db = creaFintoD1(SCHEMA);
    for (const [impronta, lista, partite] of caso.liste) {
      giocaPartite(db, impronta, lista, { partite, vinte: Math.floor(partite / 2) });
    }
    await assegnaBrew(db, "Standard");
    const corpo = await meta(db);
    const altro = altroDi(corpo);
    assert.equal(altro.gruppi_brew.length, caso.gruppi, caso.nome);
    assert.deepEqual(altro.brew_sotto_soglia, caso.sotto, caso.nome);
    assert.equal(altro.record_pubblico, false, caso.nome);
    assert.equal("vittorie" in altro, false, caso.nome);
    assert.equal(JSON.stringify(corpo).includes(Q), false, caso.nome);
    assert.equal(db.tutte("SELECT 1 FROM brew_membro WHERE impronta = ?", Q).length, 0, caso.nome);
    assert.deepEqual(await dettaglio(db, `&impronta=${Q}`), await dettaglio(db, `&impronta=${MAI}`));
    controllaConteggi(corpo);
    if (!caso.gruppi) continue;
    const [g] = altro.gruppi_brew;
    assert.deepEqual([g.partite, g.varianti_brew.length], [30, 1]);
    const det = await dettaglio(db, `&id_brew=${g.gruppo_brew_id}`);
    assert.deepEqual([det.corpo.partite, det.corpo.varianti_osservate, det.corpo.altre_varianti],
      [30, 1, null]);
    assert.equal(JSON.stringify(det).includes(Q), false);
  }
});

test("gruppo tutto pubblico, poi misto: nessuna sottrazione rivela la lista sotto soglia", async () => {
  const db = creaFintoD1(SCHEMA);
  giocaPartite(db, A, BASE, { partite: 40, vinte: 25 });
  giocaPartite(db, B, BASE_56, { partite: 35, vinte: 20 });
  await assegnaBrew(db, "Standard");
  const pubblico = altroDi(await meta(db));
  const [g] = pubblico.gruppi_brew;
  assert.equal(pubblico.record_pubblico, true);
  assert.deepEqual([g.partite, g.vittorie], [pubblico.partite, pubblico.vittorie]);

  // D, a una carta da A, gioca dieci partite e le vince tutte.
  giocaPartite(db, D, BASE_59, { partite: 10, vinte: 10 });
  await assegnaBrew(db, "Standard");
  const corpo = await meta(db);
  const misto = altroDi(corpo);
  assert.equal(misto.record_pubblico, false);
  assert.equal("vittorie" in misto, false);
  assert.deepEqual(misto.gruppi_brew.map((x) => [x.partite, x.vittorie]), [[75, 45]],
    "il gruppo somma solo le sue varianti pubbliche, come prima dell'arrivo di D");
  assert.deepEqual(misto.brew_sotto_soglia, { liste: 1, partite: 10 });
  assert.equal(JSON.stringify(corpo).includes(D), false);
  const gioco = await leggiGiocoRisposta(db, url("/gioco-risposta?formato=Standard"));
  for (const vietato of ["vittorie", "sconfitte", "win_rate"]) {
    assert.equal(JSON.stringify(gioco.corpo).includes(vietato), false, vietato);
  }
  controllaConteggi(corpo);
});

test("un catalogo nuovo che riconosce un membro lo toglie dal gruppo senza riscriverlo", async () => {
  const db = scenario();
  await assegnaBrew(db, "Standard");
  const id = identita(db).gruppo.get(A);
  // E (Mono White Auras) come se un catalogo vecchio l'avesse messa nel gruppo di A.
  db.prepare(`INSERT INTO brew_membro
    (formato, algoritmo, impronta, gruppo_id, variante_id, distanza, assegnato)
    VALUES ('Standard', ?, ?, ?, ?, 3, 'x')`).bind(ALGORITMO_BREW, E, id, `bv_${"e".repeat(32)}`).esegui();
  const corpo = await meta(db);
  assert.equal(JSON.stringify(altroDi(corpo)).includes(E), false);
  assert.ok(corpo.mazzi.some((mazzo) => mazzo.archetipo_id === "aure-mono-bianco"));
  const det = await dettaglio(db, `&id_brew=${id}`);
  assert.equal(det.corpo.varianti.some((v) => v.impronta === E), false);
  assert.equal(db.tutte("SELECT 1 FROM brew_membro WHERE impronta = ?", E).length, 1);
  controllaConteggi(corpo);
});

test("nessuna GET pubblica scrive nel database", async () => {
  const db = scenario();
  await assegnaBrew(db, "Standard");
  const id = identita(db).gruppo.get(A);
  const eseguite = [];
  const prepara = db.prepare;
  db.prepare = (sql) => {
    eseguite.push(sql);
    return prepara(sql);
  };
  const batch = db.registro.batch.length;
  const conti = () => ["partite", "brew_gruppo", "brew_membro"].map((t) => db.conta(t));
  const prima = conti();
  for (const filtro of FILTRI) {
    await meta(db, filtro);
    await leggiGiocoRisposta(db, url(`/gioco-risposta?formato=Standard${filtro}`));
    await dettaglio(db, `&id_brew=${id}${filtro}`);
  }
  await dettaglio(db, `&impronta=${A}`);
  await dettaglio(db, "&id=aure-mono-bianco");
  for (const percorso of ["/meta?formato=Standard", `/archetipo?formato=Standard&id_brew=${id}`]) {
    assert.equal((await server.fetch(new Request(`https://x.invalid${percorso}`), { DB: db })).status, 200);
  }
  assert.ok(eseguite.length > 0);
  assert.deepEqual(eseguite.filter((sql) => /^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER)\b/i.test(sql)), []);
  assert.equal(db.registro.batch.length, batch);
  assert.deepEqual(conti(), prima);
});

test("senza le tabelle Brew (prima della migrazione) le letture restano quelle di prima", async () => {
  const db = scenario();
  const conTabelle = await meta(db);
  db.prepare("DROP TABLE brew_membro").esegui();
  db.prepare("DROP TABLE brew_gruppo").esegui();
  const senza = await meta(db);
  assert.equal(altroDi(senza).raggruppamento_brew.disponibile, false);
  assert.deepEqual(senzaV2(senza), senzaV2(conTabelle));
  assert.ok(altroDi(senza).gruppi_brew.every((g) => g.in_attesa_di_raggruppamento));
  controllaConteggi(senza);
  assert.equal((await dettaglio(db, `&id_brew=${GRUPPO_MAI}`)).stato, 404);
  const legacy = await dettaglio(db, `&impronta=${A}`);
  assert.deepEqual([legacy.stato, legacy.corpo.gruppo_brew_id], [200, null]);
});

test("il frontend attuale disegna il Meta con i gruppi come prima", async () => {
  const db = scenario();
  await assegnaBrew(db, "Standard");
  const corpo = await meta(db);
  const documento = creaDocumento("it");
  globalThis.document = documento;
  globalThis.window = { addEventListener() {}, innerWidth: 1440, innerHeight: 900 };
  for (const id of ["meta-body", "meta-count", "meta-updated", "meta-threshold", "meta-visible"]) {
    const nodo = documento.createElement("div");
    nodo.id = id;
    documento.body.append(nodo);
  }
  const render = await import("../sito/js/render.js?lingua=it&caso=brew-v2");
  // Solo la riga Altro, dove stanno tutti i campi S1: le righe riconosciute
  // chiedono al DOM misure che il DOM minimo delle prove non ha (come in
  // meta-brew-ui.test.js).
  render.renderMeta({ ...corpo, mazzi: [altroDi(corpo)] }, { key: "partite", direction: "desc" }, {},
    { formato: "Standard", periodo: "30" });
  const [righe] = documento.querySelectorAll(".brew-children");
  const impronte = [...righe.querySelectorAll("a")]
    .map((a) => new URLSearchParams(a.href.split("?")[1]).get("impronta"));
  assert.deepEqual(impronte, [A, B, C]);
  assert.equal(documento.body.textContent.includes(D.slice(0, 8)), false);
});
