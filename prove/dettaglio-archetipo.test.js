import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { creaFintoD1 } from "./finto-d1.js";
import { leggiArchetipo } from "../src/dettaglio-archetipo.js";
import server from "../src/index.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const SCHEMA = QUI + "../schema.sql";
const IMPRONTA_RICONOSCIUTA = "4".repeat(64);
const IMPRONTA_SCONOSCIUTA = "e".repeat(64);
const CARTA_FIXTURE = 51307; // Ethereal Armor: nome e Arena ID non devono filtrare sotto soglia.

function inserisciPartite(db, {
  impronta, partite, contributori, carte = [], prefisso = "m",
}) {
  for (let i = 0; i < partite; i += 1) {
    const id = `${prefisso}${String(i).padStart(9, "0")}`;
    const mittente = `contributore-${i % contributori}`;
    db.prepare(`INSERT INTO partite
      (id, mittente, ricevuta, formato, esito, su_gioco, rank_classe,
       impronta_mazzo, versione, dato)
      VALUES (?, ?, ?, 'Standard', 'vinta', 1, 'Gold', ?, 1, '{}')`)
      .bind(id, mittente, "2026-08-19T10:00:00Z", impronta).esegui();
    if (i === 0) {
      for (const [carta, copie] of carte) {
        db.prepare("INSERT INTO carte_mazzo (partita, carta, copie) VALUES (?, ?, ?)")
          .bind(id, carta, copie).esegui();
      }
    }
  }
}

const CARTE_AURE = [
  [51307, 4], [92081, 4], [92090, 4], [97823, 4], [97964, 4],
  [91549, 2], [92089, 2], [66499, 20],
];

function url(path) { return new URL("https://x.invalid" + path); }

test("variante riconosciuta: osservazione protetta, catalogo sempre pubblico", async () => {
  const db = creaFintoD1(SCHEMA);
  inserisciPartite(db, {
    impronta: IMPRONTA_RICONOSCIUTA, partite: 40, contributori: 1, carte: CARTE_AURE,
  });
  const r = await leggiArchetipo(db, url("/archetipo?formato=Standard&id=aure-mono-bianco"));
  assert.equal(r.stato, 200);
  assert.equal(r.corpo.nome, "Mono White Auras");
  assert.equal(r.corpo.varianti[0].origine, "osservazione_mox");
  assert.equal(r.corpo.varianti[0].decklist_pubblicabile, false);
  assert.equal("carte" in r.corpo.varianti[0], false);
  assert.ok(r.corpo.liste_riferimento.length >= 1);
  assert.equal(r.corpo.liste_riferimento[0].origine, "catalogo_reference");
  assert.ok(r.corpo.liste_riferimento[0].lista.length >= 1);
});

test("decklist osservata richiede insieme 30 partite e 5 contributor", async () => {
  const casi = [
    { partite: 60, contributori: 1, pubblicabile: false },
    { partite: 29, contributori: 10, pubblicabile: false },
    { partite: 30, contributori: 5, pubblicabile: true },
  ];
  for (const caso of casi) {
    const db = creaFintoD1(SCHEMA);
    inserisciPartite(db, {
      impronta: IMPRONTA_SCONOSCIUTA, ...caso, carte: [[CARTA_FIXTURE, 4]],
    });
    const r = await leggiArchetipo(db,
      url(`/archetipo?formato=Standard&impronta=${IMPRONTA_SCONOSCIUTA}`));
    assert.equal(r.stato, 200);
    assert.equal(r.corpo.nome, "Mazzo non classificato");
    assert.equal(r.corpo.archetipo_id, null);
    assert.equal(r.corpo.tipo_dettaglio, "non_classificato");
    assert.equal(r.corpo.varianti[0].decklist_pubblicabile, caso.pubblicabile);
    assert.equal("carte" in r.corpo.varianti[0], caso.pubblicabile);
  }
});

test("risposta sotto soglia non serializza carte, Arena ID o contributor", async () => {
  const db = creaFintoD1(SCHEMA);
  inserisciPartite(db, {
    impronta: IMPRONTA_SCONOSCIUTA, partite: 60, contributori: 1,
    carte: [[CARTA_FIXTURE, 4]],
  });
  const r = await leggiArchetipo(db,
    url(`/archetipo?formato=Standard&impronta=${IMPRONTA_SCONOSCIUTA}`));
  const testo = JSON.stringify(r.corpo);
  assert.equal(testo.includes(String(CARTA_FIXTURE)), false);
  assert.equal(testo.includes("Ethereal Armor"), false);
  assert.equal(testo.includes("mittente"), false);
  assert.equal(testo.includes("contributore-0"), false);
  assert.equal(testo.includes("contributori"), false);
});

test("impronta valida apre il dettaglio e una malformata viene rifiutata", async () => {
  const db = creaFintoD1(SCHEMA);
  inserisciPartite(db, {
    impronta: IMPRONTA_SCONOSCIUTA, partite: 30, contributori: 5,
    carte: [[CARTA_FIXTURE, 4]],
  });
  const buona = await leggiArchetipo(db,
    url(`/archetipo?formato=Standard&impronta=${IMPRONTA_SCONOSCIUTA}`));
  assert.equal(buona.stato, 200);
  assert.equal(buona.corpo.varianti[0].carte[0].arena_id, CARTA_FIXTURE);
  const cattiva = await leggiArchetipo(db,
    url("/archetipo?formato=Standard&impronta=not-hex"));
  assert.equal(cattiva.stato, 400);
});

test("la strada pubblica /archetipo usa GET", async () => {
  const db = creaFintoD1(SCHEMA);
  inserisciPartite(db, {
    impronta: IMPRONTA_SCONOSCIUTA, partite: 30, contributori: 5,
    carte: [[CARTA_FIXTURE, 4]],
  });
  const richiesta = new Request(
    `https://x.invalid/archetipo?formato=Standard&impronta=${IMPRONTA_SCONOSCIUTA}`,
    { method: "GET" },
  );
  const risposta = await server.fetch(richiesta, { DB: db });
  const corpo = await risposta.json();
  assert.equal(risposta.status, 200);
  assert.equal(corpo.nome, "Mazzo non classificato");
});

test("archetipo richiede id o impronta validi", async () => {
  const db = creaFintoD1(SCHEMA);
  const r = await leggiArchetipo(db, url("/archetipo?formato=Standard"));
  assert.equal(r.stato, 400);
});
