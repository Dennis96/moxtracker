// Nomi pubblici dei gruppi Brew: la tabella sidecar, il campo additivo nelle
// due API, il titolo del sito e lo strumento di denominazione.
//
// La regola che tutte queste prove difendono: un nome e' soltanto
// un'etichetta editoriale. Non tocca il clustering, non cambia k, la soglia
// delle 30 partite o il classificatore, e non fa diventare archetipo un
// gruppo che archetipo non e'.

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { creaFintoD1 } from "./finto-d1.js";
import { creaDocumento } from "./finto-dom.js";
import { ALGORITMO_BREW } from "../src/brew-clustering.js";
import { assegnaBrew, comandiPuliziaBrew, leggiNomePubblico, leggiNomiPubblici } from "../src/brew-gruppi.js";
import { leggiArchetipo } from "../src/dettaglio-archetipo.js";
import { leggiMeta } from "../src/lettura.js";
import { brewGroupName, filterMetaDecks } from "../sito/js/meta-model.js";
import {
  CONFERMA, comandiSql, esegui, pianificaNomi, validaNome,
} from "../strumenti/brew_nomi.mjs";
import {
  AURE_RICONOSCIUTE, BASE, BASE_56, BASE_59, STESSO_COLORE, giocaPartite,
} from "./fixtures/brew-sintetici.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const SCHEMA = QUI + "../schema.sql";
const leggiSito = (percorso) => readFileSync(QUI + "../sito/" + percorso, "utf8");
const [A, B, C, D, E] = ["a", "b", "c", "d", "e"].map((x) => x.repeat(64));
const url = (percorso) => new URL(`https://x.invalid${percorso}`);
const metaDi = async (db, q = "") => (await leggiMeta(db, url(`/meta?formato=Standard${q}`))).corpo;
const altroDi = (corpo) => corpo.mazzi.find((mazzo) => mazzo.tipo_dettaglio === "altro");

// A (45 partite) e il suo 56/60 B (34) stanno insieme; C (31) e' un falso
// amico dello stesso colore; D (29) e' sotto soglia; E e' riconosciuta.
function scenario() {
  const db = creaFintoD1(SCHEMA);
  giocaPartite(db, A, BASE, { partite: 45, vinte: 27 });
  giocaPartite(db, B, BASE_56, { partite: 34, vinte: 20 });
  giocaPartite(db, C, STESSO_COLORE, { partite: 31, vinte: 15 });
  giocaPartite(db, D, BASE_59, { partite: 29, vinte: 29 });
  giocaPartite(db, E, AURE_RICONOSCIUTE, { partite: 40, vinte: 22 });
  return db;
}

async function conGruppi() {
  const db = scenario();
  await assegnaBrew(db, "Standard");
  return db;
}

function battezza(db, gruppoId, nome) {
  db.prepare(`INSERT INTO brew_nome (gruppo_id, formato, algoritmo, nome, origine, aggiornato)
    VALUES (?, 'Standard', ?, ?, 'curato', '2026-09-20T10:00:00Z')`)
    .bind(gruppoId, ALGORITMO_BREW, nome).esegui();
}

const gruppoCon = (altro, impronta) =>
  altro.gruppi_brew.find((g) => g.varianti_brew.some((v) => v.impronta === impronta));

// --- Schema e sidecar -------------------------------------------------------

test("il nome sta in una tabella sua e non tocca mai brew_gruppo", async () => {
  const db = await conGruppi();
  const prima = db.tutte("SELECT * FROM brew_gruppo ORDER BY ordine");
  const membriPrima = db.tutte("SELECT * FROM brew_membro ORDER BY impronta");
  const [gruppo] = prima;
  battezza(db, gruppo.id, "Boros Equipment");
  assert.deepEqual(db.tutte("SELECT * FROM brew_gruppo ORDER BY ordine"), prima);
  assert.deepEqual(db.tutte("SELECT * FROM brew_membro ORDER BY impronta"), membriPrima);
  // Il trigger che congela i gruppi resta dov'era: il nome non lo ha
  // indebolito per farci stare un UPDATE.
  assert.throws(() => db.prepare("UPDATE brew_gruppo SET ordine = 9").esegui(), /congelato/);
  // Il nome, invece, si corregge: e' una scelta editoriale, non un dato del
  // clustering.
  db.prepare("UPDATE brew_nome SET nome = ? WHERE gruppo_id = ?").bind("Boros Weapons", gruppo.id).esegui();
  assert.equal((await leggiNomePubblico(db, gruppo.id, "Standard")), "Boros Weapons");
});

test("i vincoli del nome fermano doppioni, testi storti e iniezioni SQL", async () => {
  const db = await conGruppi();
  const [uno, due] = db.tutte("SELECT id FROM brew_gruppo ORDER BY ordine");
  battezza(db, uno.id, "Boros Equipment");
  assert.throws(() => battezza(db, due.id, "Boros Equipment"), /UNIQUE/, "due gruppi, due nomi");
  for (const storto of ["A", " spazio", "spazio ", "nome; DROP TABLE partite",
    "nome' OR 1=1", 'virgolette "', "commento -- qui", "x".repeat(61)]) {
    assert.throws(() => battezza(db, due.id, storto), /CHECK/, storto);
  }
  assert.throws(() => battezza(db, `bg_${"z".repeat(32)}`, "Nome"), /CHECK|FOREIGN/);
});

test("clustering, soglia e k non cambiano quando i gruppi hanno un nome", async () => {
  const senza = await conGruppi();
  const con = await conGruppi();
  const [primo] = con.tutte("SELECT id FROM brew_gruppo ORDER BY ordine");
  battezza(con, primo.id, "Boros Equipment");
  const forma = (db) => db.tutte("SELECT impronta, distanza FROM brew_membro ORDER BY impronta");
  assert.deepEqual(forma(con), forma(senza));
  const corpo = await metaDi(con);
  const altro = altroDi(corpo);
  assert.equal(corpo.soglia_percentuali, 30);
  assert.equal(altro.raggruppamento_brew.algoritmo, ALGORITMO_BREW);
  assert.equal(altro.raggruppamento_brew.soglia_distanza, 4);
});

// --- API --------------------------------------------------------------------

test("/meta porta nome_pubblico sul gruppo che ce l'ha e null sugli altri", async () => {
  const db = await conGruppi();
  const primaDelNome = altroDi(await metaDi(db));
  const gruppoA = gruppoCon(primaDelNome, A);
  assert.equal(gruppoA.nome_pubblico, null, "senza nome il campo c'e' e vale null");
  battezza(db, gruppoA.gruppo_brew_id, "Boros Equipment");
  const altro = altroDi(await metaDi(db));
  assert.equal(gruppoCon(altro, A).nome_pubblico, "Boros Equipment");
  assert.equal(gruppoCon(altro, C).nome_pubblico, null);
  // Additivo: tolto il campo nuovo, la risposta e' quella di prima.
  const senzaNomi = (corpo) => JSON.stringify(corpo.gruppi_brew.map(
    ({ nome_pubblico: _n, ...resto }) => resto));
  assert.equal(senzaNomi(altro), senzaNomi(primaDelNome));
});

test("/archetipo?id_brew porta il nome, e il resto del corpo non cambia", async () => {
  const db = await conGruppi();
  const altro = altroDi(await metaDi(db));
  const id = gruppoCon(altro, A).gruppo_brew_id;
  const prima = await leggiArchetipo(db, url(`/archetipo?formato=Standard&id_brew=${id}`));
  assert.equal(prima.corpo.nome_pubblico, null);
  battezza(db, id, "Boros Equipment");
  const dopo = await leggiArchetipo(db, url(`/archetipo?formato=Standard&id_brew=${id}`));
  assert.equal(dopo.corpo.nome_pubblico, "Boros Equipment");
  // Il gruppo non e' diventato un archetipo: `nome` e `archetipo_id` restano
  // quelli di prima, e cosi' il badge del sito.
  assert.equal(dopo.corpo.nome, "Mazzo non classificato");
  assert.equal(dopo.corpo.archetipo_id, null);
  const senzaNome = ({ nome_pubblico: _n, ...resto }) => JSON.stringify(resto);
  assert.equal(senzaNome(dopo.corpo), senzaNome(prima.corpo));
});

test("il nome non esce mai da un dato privato: niente impronte, id o note interne", async () => {
  const db = await conGruppi();
  const altro = altroDi(await metaDi(db));
  const id = gruppoCon(altro, A).gruppo_brew_id;
  battezza(db, id, "Boros Equipment");
  const dettaglio = await leggiArchetipo(db, url(`/archetipo?formato=Standard&id_brew=${id}`));
  for (const corpo of [await metaDi(db), dettaglio.corpo]) {
    const testo = JSON.stringify(corpo);
    assert.equal(testo.includes("curato"), false, "la provenienza editoriale resta interna");
    assert.equal(testo.includes("2026-09-20T10:00:00Z"), false, "niente timestamp editoriali");
    assert.equal(testo.includes(D.slice(0, 16)), false, "niente liste sotto soglia");
  }
});

test("senza le tabelle Brew, e con i soli gruppi senza i nomi, le letture reggono", async () => {
  const soloPartite = scenario();
  for (const tabella of ["brew_nome", "brew_membro", "brew_gruppo"]) {
    soloPartite.prepare(`DROP TABLE ${tabella}`).esegui();
  }
  const senzaTabelle = altroDi(await metaDi(soloPartite));
  // Senza le tabelle ogni lista pubblica e' un gruppo a se', in attesa del
  // cron: nessuna ha un nome, e il campo c'e' lo stesso.
  assert.equal(senzaTabelle.gruppi_brew.length, 3);
  assert.deepEqual([...new Set(senzaTabelle.gruppi_brew.map((g) => g.nome_pubblico))], [null]);
  assert.ok(senzaTabelle.gruppi_brew.every((g) => g.in_attesa_di_raggruppamento));
  assert.equal(senzaTabelle.raggruppamento_brew.disponibile, false);

  // Worker nuovo su un database migrato solo con S1: i gruppi ci sono, la
  // tabella dei nomi no.
  const soloS1 = await conGruppi();
  soloS1.prepare("DROP TABLE brew_nome").esegui();
  assert.equal(await leggiNomiPubblici(soloS1, "Standard"), null);
  const altro = altroDi(await metaDi(soloS1));
  assert.ok(altro.gruppi_brew.length >= 1);
  assert.deepEqual([...new Set(altro.gruppi_brew.map((g) => g.nome_pubblico))], [null]);
  const id = gruppoCon(altro, A).gruppo_brew_id;
  const dettaglio = await leggiArchetipo(soloS1, url(`/archetipo?formato=Standard&id_brew=${id}`));
  assert.equal(dettaglio.stato, 200);
  assert.equal(dettaglio.corpo.nome_pubblico, null);
});

test("cancellato il gruppo per privacy, il suo nome sparisce con lui", async () => {
  const db = await conGruppi();
  const [gruppo] = db.tutte("SELECT id, rappresentante FROM brew_gruppo ORDER BY ordine");
  battezza(db, gruppo.id, "Boros Equipment");
  assert.equal(db.tutte("SELECT * FROM brew_nome").length, 1);
  // La cancellazione dei contributi toglie le partite del rappresentante: il
  // gruppo si smonta, e la pulizia non deve lasciare indietro il nome.
  db.prepare("DELETE FROM carte_mazzo WHERE partita IN (SELECT id FROM partite WHERE impronta_mazzo = ?)")
    .bind(gruppo.rappresentante).esegui();
  db.prepare("DELETE FROM partite WHERE impronta_mazzo = ?").bind(gruppo.rappresentante).esegui();
  const comandi = await comandiPuliziaBrew(db);
  await db.batch(comandi);
  assert.equal(db.tutte("SELECT * FROM brew_gruppo WHERE id = ?", gruppo.id).length, 0);
  assert.equal(db.tutte("SELECT * FROM brew_nome").length, 0, "nessun nome senza gruppo");
});

test("un nome orfano sparisce anche dove le chiavi esterne non sono applicate", async () => {
  const db = await conGruppi();
  const [gruppo] = db.tutte("SELECT id FROM brew_gruppo ORDER BY ordine");
  battezza(db, gruppo.id, "Boros Equipment");
  db.prepare("PRAGMA foreign_keys = OFF").esegui();
  db.prepare("DELETE FROM brew_gruppo WHERE id = ?").bind(gruppo.id).esegui();
  assert.equal(db.tutte("SELECT * FROM brew_nome").length, 1, "senza FK il nome resta li'");
  await db.batch(await comandiPuliziaBrew(db));
  assert.equal(db.tutte("SELECT * FROM brew_nome").length, 0);
});

// --- Sito -------------------------------------------------------------------

test("il fallback e' «Brew», uguale in italiano e in inglese", () => {
  assert.equal(brewGroupName({ nome_pubblico: null }), "Brew");
  assert.equal(brewGroupName({}), "Brew");
  assert.equal(brewGroupName({ nome_pubblico: "   " }), "Brew");
  assert.equal(brewGroupName({ nome_pubblico: "x".repeat(61) }), "Brew", "un nome assurdo non passa");
  assert.equal(brewGroupName({ nome_pubblico: "Boros Equipment" }), "Boros Equipment");
});

test("«Gruppo Brew» non e' piu' un titolo pubblico da nessuna parte", () => {
  const sorgenti = ["js/render.js", "js/meta-model.js", "js/archetype.js"].map(leggiSito).join("\n");
  const righe = sorgenti.split("\n").filter((riga) => /Gruppo Brew|Brew group/.test(riga));
  // Restano solo i commenti che spiegano perche' non si usa piu'.
  assert.deepEqual(righe.filter((riga) => !riga.trimStart().startsWith("//")), []);
  // Il titolo del dettaglio e' il nome pubblico, senza rami per lingua.
  assert.match(leggiSito("js/archetype.js"), /brewGroup \? brewGroupName\(deck\) : deckLabel\(deck\)/);
});

test("la ricerca del Meta trova un gruppo per nome pubblico", () => {
  const altro = {
    nome: "Altro (Brew)", archetipo: "Altro (Brew)", archetipo_id: null, tipo_dettaglio: "altro",
    gruppi_brew: [
      { gruppo_brew_id: `bg_${"1".repeat(32)}`, nome_pubblico: "Boros Equipment" },
      { gruppo_brew_id: `bg_${"2".repeat(32)}`, nome_pubblico: null },
    ],
    varianti_brew: [{ etichetta: "Brew #1" }],
  };
  const mazzi = [altro, { nome: "Rakdos Aggro", archetipo: "Rakdos Aggro", archetipo_id: "rakdos-aggro" }];
  assert.deepEqual(filterMetaDecks(mazzi, { search: "boros" }).map((m) => m.nome), ["Altro (Brew)"]);
  assert.deepEqual(filterMetaDecks(mazzi, { search: "equipment" }).map((m) => m.nome), ["Altro (Brew)"]);
  assert.deepEqual(filterMetaDecks(mazzi, { search: "rakdos" }).map((m) => m.nome), ["Rakdos Aggro"]);
  assert.deepEqual(filterMetaDecks(mazzi, { search: "bg_1111" }).map((m) => m.nome), [],
    "l'id tecnico non e' un termine di ricerca");
});

let casi = 0;
async function disegna(dati, lingua = "it") {
  const documento = creaDocumento(lingua);
  globalThis.document = documento;
  globalThis.window = { addEventListener() {}, innerWidth: 1440, innerHeight: 900,
    location: { hostname: "moxtracker.app", origin: "https://moxtracker.app" } };
  for (const id of ["meta-body", "meta-count", "meta-updated", "meta-threshold", "meta-visible"]) {
    const nodo = documento.createElement("div");
    nodo.id = id;
    documento.body.append(nodo);
  }
  casi += 1;
  const render = await import(`../sito/js/render.js?lingua=${lingua}&nomi=${casi}`);
  render.renderMeta(dati, { key: "partite", direction: "desc" }, {},
    { formato: "Standard", periodo: "30" });
  return {
    documento,
    righe: documento.querySelector("#meta-body"),
    schede: documento.querySelector(".meta-mobile-list") || documento.body,
  };
}

function metaFinto(nome) {
  const variante = {
    variante_id: `bv_${"a".repeat(32)}`, impronta: "a".repeat(64), partite: 31, vittorie: 16,
    sconfitte: 15, dati_sufficienti: true, win_rate: 51.61, quota_meta: 30,
    decklist_pubblicabile: true, rappresentante: true, distanza_rappresentante: 0,
  };
  const gruppo = {
    etichetta: "Brew #1", tipo_dettaglio: "brew_group", gruppo_brew_id: `bg_${"1".repeat(32)}`,
    nome_pubblico: nome, in_attesa_di_raggruppamento: false, algoritmo: ALGORITMO_BREW,
    soglia_distanza: 4, partite: 31, vittorie: 16, sconfitte: 15, record_pubblico: true,
    dati_sufficienti: true, win_rate: 51.61, quota_meta: 30, varianti_brew: [variante],
  };
  const altro = {
    nome: "Altro (Brew)", archetipo: "Altro (Brew)", archetipo_id: null, tipo_dettaglio: "altro",
    strategia: null, colori: [], impronta: null, impronte_raggruppate: 1, varianti_rilevate: 1,
    partite: 31, vittorie: 16, sconfitte: 15, record_pubblico: true, dati_sufficienti: true,
    win_rate: 51.61, quota_meta: 100,
    varianti_brew: [{ etichetta: "Brew #1", impronta: variante.impronta, partite: 31, vittorie: 16,
      sconfitte: 15, dati_sufficienti: true, win_rate: 51.61, quota_meta: 100 }],
    brew_sotto_soglia: { liste: 0, partite: 0 },
    gruppi_brew: [gruppo],
    raggruppamento_brew: { algoritmo: ALGORITMO_BREW, soglia_distanza: 4, disponibile: true },
  };
  return { partite_totali: 31, aggiornato: "2026-09-20T08:00:00Z", soglia_percentuali: 30,
    partite_senza_rank: 0, mazzi: [altro] };
}

function testoVisibile(documento) {
  const visibile = [];
  for (const nodo of documento.querySelectorAll("*")) {
    visibile.push(nodo.textContent || "");
    for (const attributo of ["aria-label", "title", "alt"]) {
      if (nodo.hasAttribute(attributo)) visibile.push(nodo.getAttribute(attributo));
    }
  }
  return visibile.join("\n");
}

test("nel Meta il gruppo nominato si presenta col suo nome, riga e scheda", async () => {
  const { documento, righe, schede } = await disegna(metaFinto("Boros Equipment"));
  const [riga] = righe.querySelectorAll("tr.brew-group");
  assert.match(riga.textContent, /^Boros Equipment1 variante pubblicata/);
  assert.equal(riga.querySelector("a").getAttribute("aria-label"), "Apri Boros Equipment da 31 partite");
  assert.match(schede.querySelector(".brew-group").textContent, /Boros Equipment/);
  const testo = testoVisibile(documento);
  assert.doesNotMatch(testo, /Gruppo Brew/);
  assert.doesNotMatch(testo, /bg_|bv_/);
  assert.equal(testo.includes("a".repeat(8)), false, "nessuna impronta visibile");
});

test("in inglese il nome resta quello, e senza nome si legge «Brew»", async () => {
  const inglese = await disegna(metaFinto("Boros Equipment"), "en");
  const [riga] = inglese.righe.querySelectorAll("tr.brew-group");
  assert.match(riga.textContent, /^Boros Equipment1 published variant/);
  assert.equal(riga.querySelector("a").getAttribute("aria-label"), "Open Boros Equipment, 31 matches");
  assert.doesNotMatch(testoVisibile(inglese.documento), /Brew group/);

  const senzaNome = await disegna(metaFinto(null), "en");
  const [riga2] = senzaNome.righe.querySelectorAll("tr.brew-group");
  assert.match(riga2.textContent, /^Brew1 published variant/);
  assert.equal(riga2.querySelector("a").getAttribute("aria-label"), "Open Brew, 31 matches");
});

// --- Strumento --------------------------------------------------------------

const GRUPPO_UNO = `bg_${"1".repeat(32)}`;
const GRUPPO_DUE = `bg_${"2".repeat(32)}`;
const pubblici = (nomi = {}) => [
  { id: GRUPPO_UNO, nome_pubblico: nomi[GRUPPO_UNO] ?? null, partite: 79, varianti: 2, carte: [] },
  { id: GRUPPO_DUE, nome_pubblico: nomi[GRUPPO_DUE] ?? null, partite: 31, varianti: 1, carte: [] },
];

test("lo strumento valida i nomi con le stesse regole della colonna", () => {
  assert.equal(validaNome("Boros Equipment"), null);
  assert.equal(validaNome("Mono-Red Dragons"), null);
  for (const storto of ["", "A", " Boros", "Boros ", "Nome; DROP", "Nome' OR 1=1",
    'Nome "', "Nome -- commento", "x".repeat(61), "Simic — Nome"]) {
    assert.ok(validaNome(storto), storto);
  }
});

test("il piano rifiuta id sconosciuti, gruppi non pubblici, doppioni e archetipi", () => {
  const gruppi = pubblici();
  const buono = pianificaNomi({ [GRUPPO_UNO]: "Boros Equipment" }, gruppi);
  assert.deepEqual(buono.errori, []);
  assert.deepEqual(buono.operazioni, [{ id: GRUPPO_UNO, nome: "Boros Equipment",
    precedente: null, azione: "nuovo" }]);
  assert.deepEqual(buono.senza_nome, [GRUPPO_DUE], "chi resta senza nome viene detto");

  const brutto = pianificaNomi({
    [`bg_${"9".repeat(32)}`]: "Sconosciuto",
    "non-un-id": "Storto",
    [GRUPPO_UNO]: "Rakdos Aggro",
    [GRUPPO_DUE]: "x",
  }, gruppi);
  assert.equal(brutto.operazioni.length, 0);
  assert.equal(brutto.errori.length, 4);
  assert.match(brutto.errori.join("\n"), /archetipo del catalogo/);
  assert.equal(brutto.errori.join("\n").includes("Rakdos Aggro"), false,
    "i messaggi non ripetono dati inutili");

  // Lo stesso nome a due gruppi, nella mappa o gia' nel database.
  assert.match(pianificaNomi({ [GRUPPO_UNO]: "Boros Equipment", [GRUPPO_DUE]: "boros equipment" },
    gruppi).errori.join("\n"), /ripetuto/);
  assert.match(pianificaNomi({ [GRUPPO_DUE]: "Boros Equipment" }, gruppi,
    { nomiEsistenti: new Map([["boros equipment", GRUPPO_UNO]]) }).errori.join("\n"),
  /gia' di un altro gruppo/);

  // Rinominare un gruppo gia' nominato si vede nel piano.
  const rinomina = pianificaNomi({ [GRUPPO_UNO]: "Boros Weapons" },
    pubblici({ [GRUPPO_UNO]: "Boros Equipment" }));
  assert.deepEqual(rinomina.operazioni, [{ id: GRUPPO_UNO, nome: "Boros Weapons",
    precedente: "Boros Equipment", azione: "rinomina" }]);
});

test("l'SQL scritto tocca solo brew_nome, ed e' un upsert", () => {
  const [comando, ...resto] = comandiSql(
    [{ id: GRUPPO_UNO, nome: "Boros Equipment", azione: "nuovo" },
      { id: GRUPPO_DUE, nome: "Gia' cosi'", azione: "invariato" }],
    "Standard", { ora: () => "2026-09-20T12:00:00Z" });
  assert.equal(resto.length, 0, "l'invariato non si riscrive");
  assert.match(comando, /^INSERT INTO brew_nome /);
  assert.match(comando, /ON CONFLICT\(gruppo_id\) DO UPDATE SET nome = excluded\.nome/);
  assert.doesNotMatch(comando, /brew_gruppo|brew_membro|partite|DROP|DELETE/);
  assert.throws(() => comandiSql([{ id: GRUPPO_UNO, nome: "x'; DROP TABLE partite; --",
    azione: "nuovo" }], "Standard"), /non ammesso/);
});

function fintaApi(gruppi) {
  return async (indirizzo) => {
    const url = new URL(indirizzo);
    if (url.pathname === "/meta") {
      return { ok: true, json: async () => ({ mazzi: [{ tipo_dettaglio: "altro",
        gruppi_brew: gruppi.map((g) => ({ gruppo_brew_id: g.id, nome_pubblico: g.nome_pubblico,
          partite: g.partite })) }] }) };
    }
    const id = url.searchParams.get("id_brew");
    const gruppo = gruppi.find((g) => g.id === id);
    return { ok: true, json: async () => ({ nome_pubblico: gruppo.nome_pubblico, varianti: [
      { rappresentante: true, decklist_pubblicabile: true,
        carte: [{ nome: "Lightning Helix", copie: 4 }] },
    ] }) };
  };
}

test("elenco, dry-run e applicazione: si scrive solo con la conferma esplicita", async () => {
  const righe = [];
  const eseguiti = [];
  const opzioni = {
    stampa: (testo) => righe.push(testo),
    recupera: fintaApi(pubblici()),
    sql: async (comando, dove) => eseguiti.push([comando, dove]),
    ora: () => "2026-09-20T12:00:00Z",
  };
  const mappa = QUI + "fixtures/brew-nomi-mappa.json";

  assert.equal(await esegui(["--elenca"], opzioni), 0);
  const elenco = JSON.parse(righe.at(-1));
  assert.equal(elenco.gruppi_pubblici, 2);
  assert.equal(elenco.senza_nome, 2);
  assert.deepEqual(elenco.gruppi[0].rappresentativa, [{ nome: "Lightning Helix", copie: 4 }]);
  assert.equal(eseguiti.length, 0);

  assert.equal(await esegui([`--mappa=${mappa}`], opzioni), 0);
  assert.equal(JSON.parse(righe.at(-2)).modalita, "dry-run");
  assert.equal(eseguiti.length, 0, "il dry-run non scrive");

  await assert.rejects(() => esegui([`--mappa=${mappa}`, "--applica"], opzioni), /conferma/);
  assert.equal(eseguiti.length, 0);

  assert.equal(await esegui([`--mappa=${mappa}`, "--applica", `--conferma=${CONFERMA}`], opzioni), 0);
  assert.equal(eseguiti.length, 2);
  assert.deepEqual(eseguiti[0][1], { database: "moxtracker", remoto: true });
  assert.equal(JSON.parse(righe.at(-1)).scritti, 2);
});

test("una mappa sbagliata esce con 1 e non scrive niente", async () => {
  const righe = [];
  const eseguiti = [];
  const codice = await esegui([`--mappa=${QUI}fixtures/brew-nomi-mappa-storta.json`], {
    stampa: (testo) => righe.push(testo),
    recupera: fintaApi(pubblici()),
    sql: async (...argomenti) => eseguiti.push(argomenti),
  });
  assert.equal(codice, 1);
  assert.equal(eseguiti.length, 0);
  assert.equal(JSON.parse(righe.at(-1)).modalita, "rifiutato");
});
