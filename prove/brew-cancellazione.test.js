// S1, delta cancellazione: dopo una cancellazione dei contributi non resta
// stato Brew senza partite dietro. Il membro che perde l'ultima partita
// sparisce, il gruppo che perde il rappresentante si smonta (eccezione privacy
// alla stabilita' degli id), un'impronta condivisa resta finche' ha partite,
// il retry completa la pulizia e le credenziali cadono solo alla fine.

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { creaFintoD1 } from "./finto-d1.js";
import {
  applicaPiano, assegnaBrew, assegnaBrewProgrammato, comandiPuliziaBrew, pianificaAssegnazione,
} from "../src/brew-gruppi.js";
import { leggiArchetipo } from "../src/dettaglio-archetipo.js";
import { eliminaMittente, sha256 } from "../src/draft.js";
import { leggiMeta } from "../src/lettura.js";
import worker from "../src/index.js";
import { BASE, BASE_56, STESSO_COLORE, giocaPartite } from "./fixtures/brew-sintetici.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const SCHEMA = QUI + "../schema.sql";
const SCHEMA_DRAFT = QUI + "../schema-draft.sql";
const [A, B, C] = ["a", "b", "c"].map((x) => x.repeat(64));
const [UNO, DUE] = ["1", "2"].map((x) => x.repeat(32));
const MAI = "0".repeat(64);
const GRUPPO_MAI = `bg_${"0".repeat(32)}`;

function registra(db, ...mittenti) {
  for (const mittente of mittenti) {
    db.prepare("INSERT INTO contributori (mittente, cancellazione_hash, creato) VALUES (?, ?, ?)")
      .bind(mittente, "0".repeat(64), "2026-09-15T00:00:00Z").esegui();
  }
}

const stato = (db) => ({
  gruppi: db.tutte("SELECT * FROM brew_gruppo ORDER BY ordine"),
  membri: db.tutte("SELECT * FROM brew_membro ORDER BY impronta"),
});
const partiteDi = (db, impronta) =>
  db.tutte("SELECT COUNT(*) AS n FROM partite WHERE impronta_mazzo = ?", impronta)[0].n;
const credenziali = (db, mittente) =>
  db.tutte("SELECT 1 FROM contributori WHERE mittente = ?", mittente).length;

// Stato Brew senza partite dietro: dopo una cancellazione completata deve
// essere sempre zero.
function orfani(db) {
  return {
    membri: db.tutte(`SELECT impronta FROM brew_membro m WHERE NOT EXISTS (SELECT 1 FROM partite p
      WHERE p.formato = m.formato AND p.impronta_mazzo = m.impronta)`).length,
    gruppi: db.tutte(`SELECT id FROM brew_gruppo g WHERE NOT EXISTS (SELECT 1 FROM partite p
      WHERE p.formato = g.formato AND p.impronta_mazzo = g.rappresentante)`).length,
  };
}

// A (rappresentante) la gioca solo UNO; B, a quattro carte da A, e C, un gruppo
// a parte, li gioca DUE.
async function rappresentanteDiUno() {
  const db = creaFintoD1(SCHEMA);
  giocaPartite(db, A, BASE, { partite: 45, mittente: UNO });
  giocaPartite(db, B, BASE_56, { partite: 34, mittente: DUE });
  giocaPartite(db, C, STESSO_COLORE, { partite: 31, mittente: DUE });
  registra(db, UNO, DUE);
  await assegnaBrew(db, "Standard");
  return db;
}

test("A. lista giocata solo dal mittente cancellato: via partite, membro e gruppo", async () => {
  const db = creaFintoD1(SCHEMA);
  giocaPartite(db, A, BASE, { partite: 35, mittente: UNO });
  registra(db, UNO);
  await assegnaBrew(db, "Standard");
  assert.deepEqual([db.conta("brew_gruppo"), db.conta("brew_membro")], [1, 1]);
  const esito = await eliminaMittente({ DB: db }, UNO);
  assert.equal(esito.partite, 35);
  assert.deepEqual([db.conta("partite"), db.conta("carte_mazzo"), db.conta("brew_membro"),
    db.conta("brew_gruppo"), db.conta("contributori")], [0, 0, 0, 0, 0]);
});

test("B. membro non rappresentante cancellato: sparisce lui, il gruppo e il suo id restano", async () => {
  const db = creaFintoD1(SCHEMA);
  giocaPartite(db, A, BASE, { partite: 45, mittente: DUE });
  giocaPartite(db, B, BASE_56, { partite: 34, mittente: UNO });
  registra(db, UNO, DUE);
  await assegnaBrew(db, "Standard");
  const prima = stato(db);
  assert.equal(prima.membri.length, 2);
  await eliminaMittente({ DB: db }, UNO);
  const dopo = stato(db);
  assert.deepEqual(dopo.gruppi, prima.gruppi);
  assert.deepEqual(dopo.membri, prima.membri.filter((m) => m.impronta !== B));
  assert.deepEqual(orfani(db), { membri: 0, gruppi: 0 });
});

test("C. rappresentante cancellato: il gruppo si smonta, i superstiti restano e si raggruppano di nuovo", async () => {
  const db = await rappresentanteDiUno();
  const prima = stato(db);
  const gruppoDi = (impronta) => prima.membri.find((m) => m.impronta === impronta).gruppo_id;
  const vecchio = gruppoDi(A);
  assert.equal(gruppoDi(B), vecchio);
  const altro = prima.gruppi.find((g) => g.id === gruppoDi(C));

  await eliminaMittente({ DB: db }, UNO);
  // Il gruppo di A se ne va con tutte le sue membership; quello di C non si tocca.
  assert.deepEqual(stato(db).gruppi, [altro]);
  assert.deepEqual(stato(db).membri, prima.membri.filter((m) => m.impronta === C));
  assert.equal(partiteDi(db, B), 34, "le partite superstiti restano");
  assert.equal(partiteDi(db, A), 0);
  assert.deepEqual(orfani(db), { membri: 0, gruppi: 0 });

  // Il giro successivo raggruppa di nuovo B, con id nuovi: e' l'eccezione privacy.
  const nuovo = await assegnaBrew(db, "Standard");
  assert.deepEqual([nuovo.gruppi_creati, nuovo.membri_assegnati], [1, 1]);
  const rinato = db.tutte("SELECT * FROM brew_gruppo WHERE rappresentante = ?", B)[0];
  assert.notEqual(rinato.id, vecchio);
  const [membro] = db.tutte("SELECT * FROM brew_membro WHERE impronta = ?", B);
  assert.equal(membro.gruppo_id, rinato.id);
  assert.notEqual(membro.variante_id, prima.membri.find((m) => m.impronta === B).variante_id);
});

test("D. impronta condivisa: se restano partite di un altro mittente, membro e gruppo restano", async () => {
  const db = creaFintoD1(SCHEMA);
  giocaPartite(db, A, BASE, { partite: 20, mittente: UNO });
  giocaPartite(db, A, BASE, { partite: 25, mittente: DUE });
  giocaPartite(db, B, BASE_56, { partite: 34, mittente: DUE });
  registra(db, UNO, DUE);
  await assegnaBrew(db, "Standard");
  const prima = stato(db);
  await eliminaMittente({ DB: db }, UNO);
  assert.equal(partiteDi(db, A), 25);
  assert.deepEqual(stato(db), prima, "nessuna membership tolta solo perche' un contributore e' sparito");
  assert.deepEqual(orfani(db), { membri: 0, gruppi: 0 });
  assert.equal(credenziali(db, UNO), 0);
  assert.equal(credenziali(db, DUE), 1);
});

test("E. retry: un guasto annulla tutto il batch, e il retry completa la pulizia prima delle credenziali", async () => {
  // Guasto dentro la pulizia: il batch e' atomico, quindi le partite tornano
  // al loro posto insieme a tutto il resto, e le credenziali restano.
  const db = await rappresentanteDiUno();
  const prima = stato(db);
  db.guasti.statement = 4;
  await assert.rejects(eliminaMittente({ DB: db }, UNO), /guasto simulato/);
  assert.equal(partiteDi(db, A), 45);
  assert.equal(credenziali(db, UNO), 1);
  assert.deepEqual(stato(db), prima);
  await eliminaMittente({ DB: db }, UNO);
  assert.deepEqual(orfani(db), { membri: 0, gruppi: 0 });
  assert.equal(credenziali(db, UNO), 0);
  const completato = stato(db);

  // Commit riuscito ma risposta persa: le credenziali restano, e il retry
  // chiude senza doppioni.
  const secondo = await rappresentanteDiUno();
  secondo.guasti.dopoCommit = true;
  await assert.rejects(eliminaMittente({ DB: secondo }, UNO), /rete caduta/);
  assert.equal(partiteDi(secondo, A), 0);
  assert.deepEqual(orfani(secondo), { membri: 0, gruppi: 0 });
  assert.equal(credenziali(secondo, UNO), 1, "le credenziali non cadono prima della fine");
  const dopoGuasto = stato(secondo);
  await eliminaMittente({ DB: secondo }, UNO);
  assert.deepEqual(stato(secondo), dopoGuasto);
  assert.equal(credenziali(secondo, UNO), 0);
  assert.deepEqual(stato(secondo).gruppi.map((g) => g.rappresentante),
    completato.gruppi.map((g) => g.rappresentante));

  // Partite gia' sparite e pulizia mai fatta (per esempio da un Worker di
  // prima): il retry non ha piu' una lista di impronte del mittente, ma la
  // pulizia guarda lo stato vero e toglie comunque gli orfani.
  const terzo = await rappresentanteDiUno();
  terzo.prepare("DELETE FROM carte_mazzo WHERE partita IN (SELECT id FROM partite WHERE mittente = ?)")
    .bind(UNO).esegui();
  terzo.prepare("DELETE FROM partite WHERE mittente = ?").bind(UNO).esegui();
  assert.deepEqual(orfani(terzo), { membri: 1, gruppi: 1 });
  const esito = await eliminaMittente({ DB: terzo }, UNO);
  assert.equal(esito.partite, 0);
  assert.deepEqual(orfani(terzo), { membri: 0, gruppi: 0 });
  assert.deepEqual([terzo.conta("brew_gruppo"), terzo.conta("brew_membro")], [1, 1], "resta C");
  assert.equal(credenziali(terzo, UNO), 0);
});

test("F. dopo la cancellazione il vecchio id_brew e la vecchia impronta rispondono come mai esistiti", async () => {
  const db = await rappresentanteDiUno();
  const vecchio = db.tutte("SELECT gruppo_id, variante_id FROM brew_membro WHERE impronta = ?", A)[0];
  const url = (q) => new URL(`https://x.invalid${q}`);
  assert.equal((await leggiArchetipo(db, url(`/archetipo?formato=Standard&id_brew=${vecchio.gruppo_id}`))).stato, 200);

  await eliminaMittente({ DB: db }, UNO);
  const dettaglio = (q) => leggiArchetipo(db, url(`/archetipo?formato=Standard${q}`));
  assert.deepEqual(await dettaglio(`&id_brew=${vecchio.gruppo_id}`), await dettaglio(`&id_brew=${GRUPPO_MAI}`));
  assert.deepEqual(await dettaglio(`&impronta=${A}`), await dettaglio(`&impronta=${MAI}`));
  const http = async (q) => {
    const risposta = await worker.fetch(new Request(`https://x.invalid/archetipo?formato=Standard${q}`),
      { DB: db });
    return [risposta.status, await risposta.text()];
  };
  assert.deepEqual(await http(`&id_brew=${vecchio.gruppo_id}`), await http(`&id_brew=${GRUPPO_MAI}`));

  const meta = (await leggiMeta(db, url("/meta?formato=Standard&periodo=totale"))).corpo;
  const testo = JSON.stringify(meta);
  for (const sparito of [A, vecchio.gruppo_id, vecchio.variante_id]) {
    assert.equal(testo.includes(sparito), false);
  }
  // B resta pubblico, in attesa del prossimo giro del cron.
  const altro = meta.mazzi.find((mazzo) => mazzo.tipo_dettaglio === "altro");
  const b = altro.gruppi_brew.find((g) => g.varianti_brew.some((v) => v.impronta === B));
  assert.deepEqual([b.in_attesa_di_raggruppamento, b.gruppo_brew_id], [true, null]);
});

test("la cancellazione della sezione partite dell'account pulisce allo stesso modo", async () => {
  const env = {
    DB: creaFintoD1(SCHEMA), DRAFT_DB: creaFintoD1(SCHEMA_DRAFT),
    SITE_ORIGIN: "https://moxtracker.app", PREVIEW_ORIGIN: "https://preview.moxtracker.pages.dev",
    GOOGLE_CLIENT_ID: "google-client", GOOGLE_CLIENT_SECRET: "google-secret",
    OAUTH_FETCH: async (indirizzo) => (String(indirizzo).includes("token")
      ? new Response(JSON.stringify({ access_token: "accesso" }), { status: 200 })
      : new Response(JSON.stringify({ sub: "google-123", name: "Amico di Mox" }), { status: 200 })),
  };
  const cookie = (r) => r.headers.get("set-cookie").split(";", 1)[0];
  const inizio = await worker.fetch(new Request("https://api.moxtracker.app/auth/google?ritorno=/account.html"), env);
  const statoOauth = new URL(inizio.headers.get("location")).searchParams.get("state");
  const fine = await worker.fetch(new Request(
    `https://api.moxtracker.app/auth/google/callback?code=codice&state=${statoOauth}`,
    { headers: { cookie: cookie(inizio) } }), env);
  const sessione = cookie(fine);
  const [{ id }] = env.DB.tutte("SELECT id FROM account");
  env.DB.prepare(`INSERT INTO account_dispositivo (mittente, account_id, nome, segreto_hash, collegato)
    VALUES (?, ?, 'pc', ?, '2026-09-15T00:00:00Z')`).bind(UNO, id, await sha256("5".repeat(64))).esegui();

  giocaPartite(env.DB, A, BASE, { partite: 45, mittente: UNO });
  giocaPartite(env.DB, B, BASE_56, { partite: 34, mittente: DUE });
  registra(env.DB, UNO, DUE);
  await assegnaBrew(env.DB, "Standard");
  const risposta = await worker.fetch(new Request("https://api.moxtracker.app/account/delete-section", {
    method: "POST",
    headers: { cookie: sessione, origin: "https://moxtracker.app", "content-type": "application/json" },
    body: JSON.stringify({ sezione: "partite", conferma: "PARTITE" }),
  }), env);
  assert.equal(risposta.status, 200, await risposta.clone().text());
  assert.deepEqual([env.DB.conta("brew_gruppo"), env.DB.conta("brew_membro")], [0, 0]);
  assert.deepEqual(orfani(env.DB), { membri: 0, gruppi: 0 });
  assert.equal(partiteDi(env.DB, B), 34);
  assert.deepEqual([credenziali(env.DB, UNO), credenziali(env.DB, DUE)], [0, 1]);
});

test("senza tabelle Brew la cancellazione resta quella di prima", async () => {
  const db = creaFintoD1(SCHEMA);
  db.prepare("DROP TABLE brew_membro").esegui();
  db.prepare("DROP TABLE brew_gruppo").esegui();
  assert.deepEqual(await comandiPuliziaBrew(db), []);
  giocaPartite(db, A, BASE, { partite: 30, mittente: UNO });
  registra(db, UNO);
  assert.equal((await eliminaMittente({ DB: db }, UNO)).partite, 30);
  assert.deepEqual([db.conta("partite"), db.conta("contributori")], [0, 0]);
});

test("il cron ripassa la pulizia prima di assegnare", async () => {
  const db = await rappresentanteDiUno();
  // Partite di A tolte senza pulizia: il cron non deve pianificare attorno a
  // un gruppo che non ha piu' partite dietro.
  db.prepare("DELETE FROM partite WHERE mittente = ?").bind(UNO).esegui();
  assert.deepEqual(orfani(db), { membri: 1, gruppi: 1 });
  await assegnaBrewProgrammato({ DB: db, BREW_GRUPPI: "on" });
  assert.deepEqual(orfani(db), { membri: 0, gruppi: 0 });
  assert.equal(db.tutte("SELECT 1 FROM brew_gruppo WHERE rappresentante = ?", B).length, 1);
});

test("una cancellazione fra il piano e il batch del cron non lascia orfani", async () => {
  const db = creaFintoD1(SCHEMA);
  giocaPartite(db, A, BASE, { partite: 45, mittente: UNO });
  giocaPartite(db, B, BASE_56, { partite: 34, mittente: DUE });
  registra(db, UNO, DUE);
  const piano = await pianificaAssegnazione(db, "Standard");
  assert.deepEqual(piano.piano.membri.map((m) => m.impronta), [A, B]);
  // Il mittente di A si cancella proprio prima che il batch del piano parta.
  db.primaDelBatch = async () => { await eliminaMittente({ DB: db }, UNO); };
  await applicaPiano(db, piano);
  assert.equal(partiteDi(db, A), 0);
  assert.equal(credenziali(db, UNO), 0);
  assert.deepEqual(orfani(db), { membri: 0, gruppi: 0 });
  assert.deepEqual([db.conta("brew_gruppo"), db.conta("brew_membro")], [0, 0],
    "il gruppo attorno ad A non sopravvive al suo stesso batch");
  await assegnaBrew(db, "Standard");
  assert.equal(db.tutte("SELECT 1 FROM brew_gruppo WHERE rappresentante = ?", B).length, 1);
});

test("DELETE resta possibile, UPDATE resta congelato", async () => {
  const db = await rappresentanteDiUno();
  assert.throws(() => db.prepare("UPDATE brew_membro SET distanza = 0").esegui(), /congelato/);
  assert.throws(() => db.prepare("UPDATE brew_gruppo SET ordine = 99").esegui(), /congelato/);
  db.prepare("DELETE FROM brew_membro WHERE impronta = ?").bind(C).esegui();
  db.prepare("DELETE FROM brew_gruppo WHERE rappresentante = ?").bind(C).esegui();
  assert.equal(db.tutte("SELECT 1 FROM brew_gruppo WHERE rappresentante = ?", C).length, 0);
});
