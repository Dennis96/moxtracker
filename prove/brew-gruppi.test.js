// Persistenza dei gruppi Brew (S1): schema e migrazione, backfill dry-run e
// apply, idempotenza, retry, concorrenza, nuovi membri, cron e strumento
// locale. Le letture pubbliche stanno in brew-meta.test.js.

import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { creaFintoD1 } from "./finto-d1.js";
import { ALGORITMO_BREW, SOGLIA_DISTANZA_BREW } from "../src/brew-clustering.js";
import {
  applicaPiano, assegnaBrew, assegnaBrewProgrammato, pianificaAssegnazione,
} from "../src/brew-gruppi.js";
import { CONFERMA, esegui } from "../strumenti/brew_gruppi.mjs";
import {
  AURE_RICONOSCIUTE, BASE, BASE_55, BASE_56, BASE_59, STESSO_COLORE, giocaPartite, magia,
  sostituisci,
} from "./fixtures/brew-sintetici.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const SCHEMA = QUI + "../schema.sql";
const TESTO_SCHEMA = readFileSync(SCHEMA, "utf8");
const MIGRAZIONE = readFileSync(QUI + "../migrazioni/2026-09-15-brew-gruppi.sql", "utf8");
const MIGRAZIONE_NOMI = readFileSync(QUI + "../migrazioni/2026-09-20-brew-nome-pubblico.sql", "utf8");
const [A, B, C, D, E, F, G, H] = ["a", "b", "c", "d", "e", "f", "1", "2"].map((x) => x.repeat(64));

// A (45) e B (34) sono il caso 56/60; C (31) un falso amico dello stesso
// colore; D (29) sta a una carta da A ma e' sotto soglia; E e' riconosciuta.
function scenario() {
  const db = creaFintoD1(SCHEMA);
  giocaPartite(db, A, BASE, { partite: 45 });
  giocaPartite(db, B, BASE_56, { partite: 34 });
  giocaPartite(db, C, STESSO_COLORE, { partite: 31 });
  giocaPartite(db, D, BASE_59, { partite: 29 });
  giocaPartite(db, E, AURE_RICONOSCIUTE, { partite: 40 });
  return db;
}

const righeBrew = (db) => ({
  gruppi: db.tutte("SELECT * FROM brew_gruppo ORDER BY ordine"),
  membri: db.tutte("SELECT * FROM brew_membro ORDER BY impronta"),
});

// Chi sta con chi e a che distanza, senza gli identificativi casuali.
function struttura(db) {
  const centro = new Map(db.tutte("SELECT id, rappresentante FROM brew_gruppo")
    .map((riga) => [riga.id, riga.rappresentante]));
  return db.tutte("SELECT impronta, gruppo_id, distanza FROM brew_membro ORDER BY impronta")
    .map((riga) => [riga.impronta[0], centro.get(riga.gruppo_id)[0], riga.distanza]);
}

function forma(sqlite) {
  return sqlite.prepare(`SELECT type, name, tbl_name, sql FROM sqlite_master
    WHERE name LIKE 'brew_%' ORDER BY name`).all().map((riga) => ({ ...riga }));
}

test("schema.sql contiene le migrazioni Brew, additive e ripetibili", () => {
  // Le due migrazioni stanno in schema.sql nell'ordine in cui si applicano:
  // prima i gruppi (S1), poi i nomi pubblici, che hanno una chiave esterna
  // verso i gruppi.
  assert.ok(TESTO_SCHEMA.includes(MIGRAZIONE + "\n" + MIGRAZIONE_NOMI + "\n-- Research R3"));
  const bootstrap = new DatabaseSync(":memory:");
  bootstrap.exec(TESTO_SCHEMA);
  const migrato = new DatabaseSync(":memory:");
  migrato.exec(TESTO_SCHEMA.replace(MIGRAZIONE + "\n" + MIGRAZIONE_NOMI + "\n", ""));
  assert.equal(forma(migrato).length, 0, "prima di S1 non ci sono oggetti Brew");
  const prima = migrato.prepare("SELECT name, sql FROM sqlite_master").all().map((r) => ({ ...r }));
  for (const passo of [MIGRAZIONE, MIGRAZIONE_NOMI, MIGRAZIONE, MIGRAZIONE_NOMI]) migrato.exec(passo);
  assert.deepEqual(forma(migrato), forma(bootstrap));
  assert.deepEqual(forma(bootstrap).map((r) => `${r.type}:${r.name}`), [
    "table:brew_gruppo", "trigger:brew_gruppo_congelato", "table:brew_membro",
    "trigger:brew_membro_congelato", "index:brew_membro_gruppo", "table:brew_nome",
  ]);
  // Additiva: tutto cio' che c'era resta identico.
  const dopo = new Map(migrato.prepare("SELECT name, sql FROM sqlite_master").all()
    .map((r) => [r.name, r.sql]));
  for (const { name, sql } of prima) assert.equal(dopo.get(name), sql, name);
});

test("i vincoli fermano gruppi riscritti, membri doppi e identificativi storti", () => {
  const db = creaFintoD1(SCHEMA);
  const gid = (n) => `bg_${String(n).padStart(32, "0")}`;
  const vid = (n) => `bv_${String(n).padStart(32, "0")}`;
  const gruppo = (id, rappresentante, ordine, formato = "Standard") => db.prepare(`INSERT INTO
    brew_gruppo (id, formato, algoritmo, soglia_distanza, ordine, rappresentante, creato)
    VALUES (?, ?, ?, 4, ?, ?, 'x')`).bind(id, formato, ALGORITMO_BREW, ordine, rappresentante).esegui();
  const membro = (impronta, gruppoId, varianteId, formato = "Standard") => db.prepare(`INSERT INTO
    brew_membro (formato, algoritmo, impronta, gruppo_id, variante_id, distanza, assegnato)
    VALUES (?, ?, ?, ?, ?, 0, 'x')`).bind(formato, ALGORITMO_BREW, impronta, gruppoId, varianteId).esegui();
  gruppo(gid(1), A, 1);
  membro(A, gid(1), vid(1));
  assert.throws(() => db.prepare("UPDATE brew_gruppo SET rappresentante = ?").bind(B).esegui(), /congelato/);
  assert.throws(() => db.prepare("UPDATE brew_membro SET distanza = 1").esegui(), /congelato/);
  assert.throws(() => membro(A, gid(1), vid(2)), /UNIQUE|PRIMARY/, "un'impronta, un gruppo");
  assert.throws(() => membro(B, gid(1), vid(1)), /UNIQUE/, "variante_id unico");
  assert.throws(() => membro(C, gid(1), vid(3), "Historic"), /FOREIGN KEY/, "stesso formato del gruppo");
  assert.throws(() => gruppo(gid(2), A, 2), /UNIQUE/, "un rappresentante, un gruppo");
  assert.throws(() => gruppo(gid(3), B, 1), /UNIQUE/, "ordine unico");
  for (const storto of ["bg_123", `bx_${"0".repeat(32)}`, `bg_${"G".repeat(32)}`, A.slice(0, 35)]) {
    assert.throws(() => gruppo(storto, C, 9), /CHECK/, storto);
  }
  assert.throws(() => membro("A".repeat(64), gid(1), vid(9)), /CHECK/);
  assert.throws(() => membro(B, gid(1), `bv_${"x".repeat(32)}`), /CHECK/);
});

test("il dry-run pianifica senza scrivere: candidate solo le liste non classificate da 30 partite", async () => {
  const db = scenario();
  const { riepilogo, piano } = await pianificaAssegnazione(db, "Standard");
  assert.equal(db.conta("brew_gruppo") + db.conta("brew_membro"), 0);
  assert.deepEqual(db.registro.batch, []);
  assert.equal(riepilogo.liste_pubblicabili, 4, "A, B, C ed E; D ha 29 partite");
  assert.equal(riepilogo.classificate, 1, "E e' riconosciuta dal catalogo");
  assert.deepEqual([riepilogo.candidati, riepilogo.gruppi_nuovi, riepilogo.singleton, riepilogo.rimasti],
    [3, 2, 1, 0]);
  assert.equal(piano.membri.some((m) => m.impronta === D), false, "sotto soglia non entra");
  assert.equal(JSON.stringify(riepilogo).includes("aaaa"), false);
});

test("apply: rappresentante a distanza zero, 56/60 a distanza 4, identificativi opachi", async () => {
  const db = scenario();
  const esito = await assegnaBrew(db, "Standard");
  assert.deepEqual([esito.gruppi_creati, esito.membri_assegnati], [2, 3]);
  assert.deepEqual(struttura(db), [["a", "a", 0], ["b", "a", 4], ["c", "c", 0]]);
  const { gruppi, membri } = righeBrew(db);
  for (const gruppo of gruppi) {
    assert.match(gruppo.id, /^bg_[0-9a-f]{32}$/);
    assert.equal(gruppo.algoritmo, ALGORITMO_BREW);
    assert.equal(gruppo.soglia_distanza, SOGLIA_DISTANZA_BREW);
  }
  for (const membro of membri) assert.match(membro.variante_id, /^bv_[0-9a-f]{32}$/);
  // Non si ricavano dall'impronta: lo stesso backfill su un altro database
  // produce la stessa struttura con identificativi tutti diversi.
  const altro = scenario();
  await assegnaBrew(altro, "Standard");
  assert.deepEqual(struttura(altro), struttura(db));
  const ids = (d) => [...d.tutte("SELECT id FROM brew_gruppo"),
    ...d.tutte("SELECT variante_id AS id FROM brew_membro")].map((r) => r.id);
  const primi = new Set(ids(db));
  assert.equal(ids(altro).some((id) => primi.has(id)), false);
  for (const id of primi) {
    for (const impronta of [A, B, C]) assert.equal(id.includes(impronta.slice(0, 8)), false);
  }
});

test("apply ripetuto e retry dopo un guasto non creano doppioni", async () => {
  const db = scenario();
  db.guasti.statement = 2;
  await assert.rejects(assegnaBrew(db, "Standard"), /guasto simulato/);
  assert.equal(db.conta("brew_gruppo") + db.conta("brew_membro"), 0, "rollback completo");
  await assegnaBrew(db, "Standard");
  const prima = righeBrew(db);
  const ancora = await assegnaBrew(db, "Standard");
  assert.deepEqual([ancora.gruppi_creati, ancora.membri_assegnati], [0, 0]);
  assert.deepEqual(righeBrew(db), prima);
  // Commit riuscito ma risposta persa: il retry trova tutto gia' fatto.
  const secondo = scenario();
  secondo.guasti.dopoCommit = true;
  await assert.rejects(assegnaBrew(secondo, "Standard"), /rete caduta/);
  const dopoGuasto = righeBrew(secondo);
  assert.equal((await assegnaBrew(secondo, "Standard")).membri_assegnati, 0);
  assert.deepEqual(righeBrew(secondo), dopoGuasto);
  assert.deepEqual(struttura(secondo), struttura(db));
});

test("un giro rilegge le carte solo di candidati e rappresentanti, non dei membri gia' assegnati", async () => {
  const db = scenario();
  await assegnaBrew(db, "Standard");
  const lette = new Set();
  const prepara = db.prepare;
  db.prepare = (sql) => {
    const comando = prepara(sql);
    if (!sql.includes("carte_mazzo")) return comando;
    return { ...comando, bind: (...argomenti) => {
      const legato = comando.bind(...argomenti);
      return { ...legato, all: () => {
        const esito = legato.all();
        for (const riga of esito.results) lette.add(riga.impronta);
        return esito;
      } };
    } };
  };
  const { riepilogo } = await pianificaAssegnazione(db, "Standard");
  // A e C sono rappresentanti; E non e' membro (riconosciuta) e va
  // riclassificata; B e' un membro gia' assegnato; D e' sotto soglia.
  assert.deepEqual([...lette].sort(), [A, C, E].sort());
  assert.deepEqual([riepilogo.gia_assegnate, riepilogo.classificate, riepilogo.candidati], [3, 1, 0]);
});

test("due assegnazioni in parallelo: la seconda si ferma sui vincoli e non lascia doppioni", async () => {
  const db = scenario();
  const uno = await pianificaAssegnazione(db, "Standard");
  const due = await pianificaAssegnazione(db, "Standard");
  await applicaPiano(db, uno);
  const prima = righeBrew(db);
  await assert.rejects(applicaPiano(db, due), /UNIQUE|PRIMARY/);
  assert.deepEqual(righeBrew(db), prima);
});

test("i nuovi membri non cambiano gruppi, rappresentanti e identificativi esistenti", async () => {
  const db = scenario();
  await assegnaBrew(db, "Standard");
  const prima = righeBrew(db);
  // F sta a una carta da A e diventa la lista piu' giocata: entra nel gruppo
  // di A, e A resta il rappresentante.
  giocaPartite(db, F, sostituisci(BASE, [[magia(1), 1]], [[magia(70), 1]]), { partite: 120 });
  const esito = await assegnaBrew(db, "Standard");
  assert.deepEqual([esito.gruppi_creati, esito.membri_assegnati], [0, 1]);
  const dopo = righeBrew(db);
  assert.deepEqual(dopo.gruppi, prima.gruppi);
  assert.deepEqual(dopo.membri.filter((m) => m.impronta !== F), prima.membri);
  assert.deepEqual(struttura(db).find((r) => r[0] === "f"), ["f", "a", 1]);
  // D arriva a 30 partite: entra anche lei, attorno ad A.
  giocaPartite(db, D, BASE_59, { partite: 1 });
  await assegnaBrew(db, "Standard");
  assert.deepEqual(struttura(db).find((r) => r[0] === "d"), ["d", "a", 1]);
  assert.throws(() => db.prepare("UPDATE brew_gruppo SET rappresentante = ?").bind(F).esegui(),
    /congelato/);
});

test("un catalogo nuovo che riconosce una lista non riscrive la storia dei gruppi", async () => {
  const db = scenario();
  await assegnaBrew(db, "Standard");
  const prima = righeBrew(db);
  // Un catalogo finto che riconosce la lista di C e la sua vicina G, e non
  // conosce Mono White Auras: E diventa una candidata come le altre.
  const firma = Object.fromEntries(STESSO_COLORE.map(([carta, copie]) => [`#${carta}`, copie]));
  const catalogo = { generato: true, formato: "Standard", id_a_nome: {}, basi_ids: [],
    liste: [{ id: "finta", archetipo_id: "finto", archetipo: "Finto", firma, core: [] }] };
  giocaPartite(db, G, sostituisci(STESSO_COLORE, [[magia(20), 1]], [[magia(71), 1]]), { partite: 30 });
  const pianificato = await pianificaAssegnazione(db, "Standard", { catalogo });
  const { gia_assegnate, classificate, candidati } = pianificato.riepilogo;
  assert.deepEqual([gia_assegnate, classificate, candidati], [3, 1, 1]);
  await applicaPiano(db, pianificato);
  const dopo = righeBrew(db);
  assert.deepEqual(dopo.gruppi.slice(0, prima.gruppi.length), prima.gruppi);
  assert.deepEqual(dopo.membri.filter((m) => m.impronta !== E), prima.membri,
    "C resta nel suo gruppo anche se ora e' riconosciuta");
});

test("il limite di candidati si rispetta e i giri successivi completano lo stesso piano", async () => {
  const db = scenario();
  const primo = await assegnaBrew(db, "Standard", { limite: 1 });
  assert.deepEqual([primo.membri_assegnati, primo.riepilogo.rimasti], [1, 2]);
  await assegnaBrew(db, "Standard", { limite: 1 });
  await assegnaBrew(db, "Standard", { limite: 1 });
  const completo = scenario();
  await assegnaBrew(completo, "Standard");
  assert.deepEqual(struttura(db), struttura(completo));
  await assert.rejects(pianificaAssegnazione(db, "Standard", { limite: 0 }), /limite/);
  await assert.rejects(pianificaAssegnazione(db, " Standard"), /formato/);
});

test("liste senza carte leggibili restano fuori; un gruppo senza piu' carte non accoglie nessuno", async () => {
  const db = scenario();
  giocaPartite(db, G, [[magia(80), 0], ...BASE.slice(1)], { partite: 30 });
  assert.equal((await pianificaAssegnazione(db, "Standard")).riepilogo.firme_non_valide, 1);
  await assegnaBrew(db, "Standard");
  assert.equal(db.tutte("SELECT 1 FROM brew_membro WHERE impronta = ?", G).length, 0);
  // Partite di A tolte senza passare dalla cancellazione dei contributi, che
  // smonterebbe il gruppo (brew-cancellazione.test.js): il piano comunque non
  // usa mai un centro di cui non ha le carte.
  db.prepare(`DELETE FROM carte_mazzo WHERE partita IN
    (SELECT id FROM partite WHERE impronta_mazzo = ?)`).bind(A).esegui();
  db.prepare("DELETE FROM partite WHERE impronta_mazzo = ?").bind(A).esegui();
  const prima = righeBrew(db);
  giocaPartite(db, F, BASE, { partite: 30 });
  const dopo = await pianificaAssegnazione(db, "Standard");
  assert.equal(dopo.riepilogo.gruppi_orfani, 1);
  assert.notEqual(dopo.piano.membri.find((m) => m.impronta === F).gruppo_id, prima.gruppi[0].id);
  await applicaPiano(db, dopo);
  // In coda all'apply la pulizia smonta il gruppo rimasto senza partite; F
  // sta nel suo gruppo nuovo.
  assert.equal(db.tutte("SELECT 1 FROM brew_gruppo WHERE id = ?", prima.gruppi[0].id).length, 0);
  const [f] = db.tutte("SELECT gruppo_id FROM brew_membro WHERE impronta = ?", F);
  assert.equal(db.tutte("SELECT rappresentante FROM brew_gruppo WHERE id = ?", f.gruppo_id)[0]
    .rappresentante, F);
});

test("il cron assegna solo con BREW_GRUPPI acceso, con un tetto, e tollera le tabelle assenti", async () => {
  const db = scenario();
  assert.equal(await assegnaBrewProgrammato({ DB: db }), null);
  assert.equal(await assegnaBrewProgrammato({ DB: db, BREW_GRUPPI: "true" }), null);
  assert.equal(db.conta("brew_membro"), 0);
  giocaPartite(db, H, BASE, { partite: 30, formato: "Historic" });
  const primo = await assegnaBrewProgrammato({ DB: db, BREW_GRUPPI: "on" }, { limite: 2 });
  assert.equal(primo.reduce((somma, esito) => somma + esito.membri_assegnati, 0), 2);
  await assegnaBrewProgrammato({ DB: db, BREW_GRUPPI: "on" });
  assert.equal(db.conta("brew_membro"), 4, "A, B, C in Standard e H in Historic");
  const senza = creaFintoD1(SCHEMA);
  senza.prepare("DROP TABLE brew_membro").esegui();
  senza.prepare("DROP TABLE brew_gruppo").esegui();
  giocaPartite(senza, A, BASE, { partite: 30 });
  assert.equal(await assegnaBrewProgrammato({ DB: senza, BREW_GRUPPI: "on" }), null);
});

test("strumento locale: analisi senza scritture, report k=3/4/5, apply con conferma e idempotente", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "brew-gruppi-"));
  const file = join(cartella, "locale.sqlite");
  try {
    const db = creaFintoD1(SCHEMA, { file });
    giocaPartite(db, A, BASE, { partite: 45 });
    giocaPartite(db, B, BASE_56, { partite: 34 });
    giocaPartite(db, C, STESSO_COLORE, { partite: 31 });
    giocaPartite(db, H, BASE_55, { partite: 30 });
    db.chiudi();
    const uscita = [];
    const stampa = (testo) => uscita.push(testo);
    const base = [`--database=${file}`, "--formato=Standard"];

    assert.equal(await esegui(base, { stampa }), 0);
    const analisi = JSON.parse(uscita[0]);
    assert.deepEqual([analisi.modalita, analisi.candidati, analisi.gruppi_nuovi], ["analisi", 4, 3]);
    await assert.rejects(esegui([...base, "--apply"], { stampa }), /conferma/);
    await assert.rejects(esegui([...base, "--apply", `--conferma=${CONFERMA}`, "--k=5"], { stampa }),
      /k=4/);

    uscita.length = 0;
    await esegui([...base, "--report"], { stampa });
    const report = JSON.parse(uscita[0]);
    // k=3: {A} {B,H} {C}; k=4: {A,B} {C} {H}; k=5: {A,B,H} {C}.
    assert.deepEqual([3, 4, 5].map((k) => report.per_k[k].gruppi_nuovi), [3, 3, 2]);
    assert.deepEqual(report.liste_che_cambiano_gruppo, { "3->4": 3, "4->5": 3 });
    assert.equal(uscita.join("\n").includes("aaaaaaaa"), false, "nessuna impronta in uscita");

    const lettore = new DatabaseSync(file, { readOnly: true });
    assert.equal(lettore.prepare("SELECT COUNT(*) AS n FROM brew_membro").get().n, 0);
    lettore.close();

    uscita.length = 0;
    await esegui([...base, "--apply", `--conferma=${CONFERMA}`], { stampa });
    assert.equal(JSON.parse(uscita[0]).membri_assegnati, 4);
    uscita.length = 0;
    await esegui([...base, "--apply", `--conferma=${CONFERMA}`], { stampa });
    assert.equal(JSON.parse(uscita[0]).membri_assegnati, 0);

    await assert.rejects(esegui(["--database=https://esempio.invalid/db", "--formato=Standard"],
      { stampa }), /locale/);
    await assert.rejects(esegui([`--database=${join(cartella, "manca.sqlite")}`, "--formato=Standard"],
      { stampa }), /locale/);
    const vecchio = join(cartella, "vecchio.sqlite");
    const senzaBrew = new DatabaseSync(vecchio);
    senzaBrew.exec(TESTO_SCHEMA.replace(MIGRAZIONE + "\n", ""));
    senzaBrew.close();
    await assert.rejects(esegui([`--database=${vecchio}`, "--formato=Standard"], { stampa }),
      /2026-09-15-brew-gruppi\.sql/);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});
