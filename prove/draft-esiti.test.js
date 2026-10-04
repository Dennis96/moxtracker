// Esiti per singolo Draft, ritenti e aggiornamento del mazzo giocato.
//
// Nate dal pre-Stable del 04/10/2026. P1: un blocco di quattro Draft con un
// guasto al quarto rispondeva 500 per tutta la richiesta, con tre Draft gia'
// salvati; la cancellazione compensativa poteva togliere l'oggetto R2 di un
// Draft gia' indicizzato, o lasciarne uno orfano (D1 41 righe, R2 42 oggetti il
// 02/10). P2: lo stesso Draft rispedito con il mazzo montato era scartato come
// «gia' presente», e nessun Draft 2.11.x aveva il mazzo sul server.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import server from "../src/index.js";
import { riconciliaStorageDraft } from "../src/draft.js";
import { creaFintoD1 } from "./finto-d1.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const SCHEMA = QUI + "../schema.sql";
const SCHEMA_DRAFT = QUI + "../schema-draft.sql";

function esempio(cambia = {}) {
  return {
    versione: 1,
    draft: "a".repeat(32),
    mittente: "b".repeat(32),
    mox: "2 beta 2.11.6",
    set: "FRA",
    formato: "PremierDraft",
    iniziato: "2026-10-02T19:36:42Z",
    finito: "2026-10-02T19:46:52Z",
    completo: true,
    impronta_arena: "c".repeat(64),
    segreto_cancellazione: "d".repeat(64),
    pick: [
      { numero: 1, posizione: [1, 1], offerte: [101, 102], pool_prima: [],
        consiglio_mox: 101, politica: "policy-test", scelta: 102, seguito_mox: false,
        candidati: [
          { carta: 101, rango_mox: 1, campione: 1200, vicina: false },
          { carta: 102, rango_mox: 2, campione: 1100, vicina: true },
        ] },
      { numero: 2, posizione: [3, 2], offerte: [103, 104], pool_prima: [102],
        consiglio_mox: 103, politica: "policy-test", scelta: 103, seguito_mox: true,
        candidati: [{ carta: 103, rango_mox: 1, campione: 900, vicina: false }] },
    ],
    pool_finale: [102, 103],
    ...cambia,
  };
}

const VERSIONE_1 = { quando: "2026-10-02T19:51:25Z", mazzo: [[102, 1], [103, 22], [9001, 17]], riserva: [] };
const VERSIONE_2 = { quando: "2026-10-02T20:30:00Z", mazzo: [[103, 23], [9001, 17]], riserva: [[102, 1]] };

function idDraft(n) {
  return String(n).repeat(32);
}

function r2Finto() {
  const oggetti = new Map();
  const r2 = {
    oggetti,
    guastoPut: false,
    guastiDelete: 0,
    async put(chiave, valore) {
      if (r2.guastoPut) throw new Error("R2 put guasto simulato");
      oggetti.set(chiave, valore);
    },
    async get(chiave) {
      const valore = oggetti.get(chiave);
      if (valore === undefined) return null;
      return { async text() { return valore; } };
    },
    async delete(chiavi) {
      if (r2.guastiDelete > 0) {
        r2.guastiDelete -= 1;
        throw new Error("R2 delete guasto simulato");
      }
      for (const chiave of Array.isArray(chiavi) ? chiavi : [chiavi]) oggetti.delete(chiave);
    },
    async list(opzioni = {}) {
      const tutte = [...oggetti.entries()].sort(([a], [b]) => a.localeCompare(b));
      const inizio = Number(opzioni.cursor || 0);
      const fine = Math.min(tutte.length, inizio + Number(opzioni.limit || 1000));
      return {
        objects: tutte.slice(inizio, fine).map(([key, valore]) => ({
          key, size: new TextEncoder().encode(valore).byteLength,
        })),
        truncated: fine < tutte.length,
        cursor: fine < tutte.length ? String(fine) : undefined,
      };
    },
  };
  return r2;
}

function ambiente() {
  return { DB: creaFintoD1(SCHEMA), DRAFT_DB: creaFintoD1(SCHEMA_DRAFT),
    DRAFT_RAW: r2Finto() };
}

async function manda(env, percorso, corpo) {
  const richiesta = new Request("https://esempio.invalid" + percorso, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const risposta = await server.fetch(richiesta, env);
  return { stato: risposta.status, corpo: await risposta.json() };
}

async function coerente(env) {
  const rapporto = await riconciliaStorageDraft(env.DRAFT_DB, env.DRAFT_RAW);
  assert.ok(rapporto.coerente, JSON.stringify(rapporto));
}

function esiti(corpo) {
  return corpo.esiti.map((e) => e.esito);
}

async function silenzia(lavoro) {
  const errore = console.error;
  const avviso = console.warn;
  const registro = console.log;
  const righe = [];
  console.error = (...argomenti) => righe.push(argomenti.join(" "));
  console.warn = (...argomenti) => righe.push(argomenti.join(" "));
  console.log = (...argomenti) => righe.push(argomenti.join(" "));
  try {
    return { esito: await lavoro(), righe };
  } finally {
    console.error = errore;
    console.warn = avviso;
    console.log = registro;
  }
}

// ------------------------------------------------------------------- P1

test("P1: quattro Draft, guasto D1 al quarto: esito per Draft, 503 e ritento idempotente", async () => {
  const env = ambiente();
  const blocco = [1, 2, 3, 4].map((n) => esempio({ draft: idDraft(n), impronta_arena: String(n).repeat(64) }));
  env.DRAFT_DB.guasti.saltaBatch = 3;
  env.DRAFT_DB.guasti.statement = 1;
  const { esito: primo, righe } = await silenzia(() => manda(env, "/draft", { draft: blocco }));
  assert.equal(primo.stato, 503);
  assert.deepEqual(esiti(primo.corpo), ["nuovo", "nuovo", "nuovo", "temporaneo"]);
  assert.deepEqual(primo.corpo.da_ritentare, [idDraft(4)]);
  assert.equal(primo.corpo.accettati, 3);
  assert.equal(env.DRAFT_DB.conta("draft"), 3);
  assert.equal(env.DRAFT_RAW.oggetti.size, 3);
  // Il log dice fase, tipo e messaggio di D1, e non porta il pacchetto.
  const log = righe.find((r) => r.includes("draft_salvataggio_fallito"));
  assert.ok(log, righe.join("\n"));
  const dato = JSON.parse(log);
  assert.equal(dato.fase, "d1_batch");
  assert.equal(dato.indice, 3);
  assert.equal(dato.totale, 4);
  assert.match(dato.messaggio, /guasto simulato/);
  assert.ok(!log.includes("segreto") && !log.includes("candidati"));
  await coerente(env);

  const ritento = await silenzia(() => manda(env, "/draft", { draft: blocco }));
  assert.equal(ritento.esito.stato, 200);
  assert.deepEqual(esiti(ritento.esito.corpo), ["gia", "gia", "gia", "nuovo"]);
  assert.deepEqual(ritento.esito.corpo.da_ritentare, []);
  assert.equal(env.DRAFT_DB.conta("draft"), 4);
  await coerente(env);
});

test("P1: un rifiuto semantico nel blocco non ferma gli altri e resta definitivo", async () => {
  const env = ambiente();
  const rotto = esempio({ draft: idDraft(2), impronta_arena: "2".repeat(64), set: "x" });
  const { esito } = await silenzia(() => manda(env, "/draft", {
    draft: [esempio({ draft: idDraft(1) }), rotto] }));
  assert.equal(esito.stato, 200);
  assert.deepEqual(esiti(esito.corpo), ["nuovo", "rifiutato"]);
  assert.equal(esito.corpo.esiti[1].motivo, "set non valido");
  assert.deepEqual(esito.corpo.rifiutati, [{ draft: idDraft(2), motivo: "set non valido" }]);
});

test("P1: D1 salva ma la risposta si perde: l'oggetto R2 resta, l'esito e' nuovo", async () => {
  const env = ambiente();
  env.DRAFT_DB.guasti.dopoCommit = true;
  const { esito } = await silenzia(() => manda(env, "/draft", esempio()));
  assert.equal(esito.stato, 200);
  assert.deepEqual(esiti(esito.corpo), ["nuovo"]);
  assert.equal(env.DRAFT_DB.conta("draft"), 1);
  assert.equal(env.DRAFT_RAW.oggetti.size, 1);
  await coerente(env);
});

test("P1: compensazione R2 fallita: orfano osservabile, retry salva un oggetto proprio", async () => {
  const env = ambiente();
  env.DRAFT_DB.guasti.statement = 0;
  env.DRAFT_RAW.guastiDelete = 2;
  const { esito, righe } = await silenzia(() => manda(env, "/draft", esempio()));
  assert.equal(esito.stato, 503);
  assert.deepEqual(esiti(esito.corpo), ["temporaneo"]);
  assert.equal(env.DRAFT_DB.conta("draft"), 0);
  assert.equal(env.DRAFT_RAW.oggetti.size, 1);
  assert.ok(righe.some((r) => r.includes("draft_oggetto_orfano")));
  const rapporto = await riconciliaStorageDraft(env.DRAFT_DB, env.DRAFT_RAW);
  assert.equal(rapporto.orfani_r2.length, 1);

  // Il retry non riusa la chiave di un tentativo precedente: l'orfano
  // resta osservabile dalla manutenzione, senza rischiare l'oggetto vivo.
  const ritento = await silenzia(() => manda(env, "/draft", esempio()));
  assert.deepEqual(esiti(ritento.esito.corpo), ["nuovo"]);
  assert.equal(env.DRAFT_RAW.oggetti.size, 2);
  const dopo = await riconciliaStorageDraft(env.DRAFT_DB, env.DRAFT_RAW);
  assert.equal(dopo.senza_oggetto.length, 0);
  assert.deepEqual(dopo.orfani_r2, rapporto.orfani_r2);
});

test("P1: un guasto R2 in scrittura e' temporaneo e non scrive D1", async () => {
  const env = ambiente();
  env.DRAFT_RAW.guastoPut = true;
  const { esito } = await silenzia(() => manda(env, "/draft", esempio()));
  assert.equal(esito.stato, 503);
  assert.deepEqual(esiti(esito.corpo), ["temporaneo"]);
  assert.equal(env.DRAFT_DB.conta("draft"), 0);
  assert.equal(env.DRAFT_RAW.oggetti.size, 0);
});

test("P1: due richieste dello stesso Draft in gara non cancellano l'oggetto vivo", async () => {
  const env = ambiente();
  // Prima del batch della prima richiesta, la seconda arriva e finisce.
  env.DRAFT_DB.primaDelBatch = async () => {
    const seconda = await manda(env, "/draft", esempio());
    assert.deepEqual(esiti(seconda.corpo), ["nuovo"]);
  };
  const { esito } = await silenzia(() => manda(env, "/draft", esempio()));
  assert.equal(esito.stato, 200);
  // «gia'» se l'altra richiesta ha un altro millisecondo, «nuovo» se coincide:
  // per il client sono tutti e due «salvato», e nessuno dei due cancella.
  assert.ok(["gia", "nuovo"].includes(esiti(esito.corpo)[0]));
  assert.equal(env.DRAFT_DB.conta("draft"), 1);
  assert.equal(env.DRAFT_RAW.oggetti.size, 1);
  await coerente(env);
});

test("P1: due Draft distinti con la stessa impronta Arena si salvano entrambi", async () => {
  const env = ambiente();
  const primo = await manda(env, "/draft", esempio({ draft: idDraft(1) }));
  const secondo = await silenzia(() => manda(env, "/draft", esempio({
    draft: idDraft(2), iniziato: "2026-10-03T10:00:00Z" })));
  assert.deepEqual(esiti(primo.corpo), ["nuovo"]);
  assert.equal(secondo.esito.stato, 200);
  assert.deepEqual(esiti(secondo.esito.corpo), ["nuovo"]);
  const righe = env.DRAFT_DB.tutte("SELECT id, impronta_arena FROM draft ORDER BY id");
  assert.deepEqual(righe.map((r) => r.impronta_arena), [1, 2].map(
    (n) => `ambigua:${"c".repeat(64)}:${idDraft(n)}`));
  // L'impronta resta nel grezzo: e' l'indice a non poterla avere due volte.
  const grezzo = [...env.DRAFT_RAW.oggetti.values()].map((v) => JSON.parse(v))
    .find((d) => d.draft === idDraft(2));
  assert.equal(grezzo.impronta_arena, "c".repeat(64));
  await coerente(env);
});

// ------------------------------------------------------------------ A121

test("A121: ranghi duplicati nella stessa voce sono rifiutati dal Worker", async () => {
  const env = ambiente();
  const doppio = esempio();
  doppio.pick[0].candidati[1].rango_mox = 1;
  const { stato, corpo } = await manda(env, "/draft", doppio);
  assert.equal(stato, 400);
  assert.deepEqual(esiti(corpo), ["rifiutato"]);
  assert.equal(corpo.esiti[0].motivo, "rango Mox duplicato");
  assert.equal(env.DRAFT_DB.conta("draft"), 0);
});

// -------------------------------------------------------------------- P2

test("P2: il mazzo montato arriva dopo il Draft e cresce in modo monotono", async () => {
  const env = ambiente();
  const senza = await manda(env, "/draft", esempio());
  assert.deepEqual(esiti(senza.corpo), ["nuovo"]);
  assert.equal(env.DRAFT_DB.conta("draft_mazzo"), 0);

  const conMazzo = await silenzia(() => manda(env, "/draft",
    esempio({ mazzo_giocato: [VERSIONE_1] })));
  assert.equal(conMazzo.esito.stato, 200);
  assert.deepEqual(esiti(conMazzo.esito.corpo), ["aggiornato"]);
  assert.equal(conMazzo.esito.corpo.aggiornati, 1);
  assert.equal(env.DRAFT_DB.conta("draft_mazzo"), 1);
  assert.equal(env.DRAFT_RAW.oggetti.size, 1, "il vecchio oggetto e' tolto");
  await coerente(env);

  const identico = await manda(env, "/draft", esempio({ mazzo_giocato: [VERSIONE_1] }));
  assert.deepEqual(esiti(identico.corpo), ["gia"]);
  // Una versione nuova di Mox che rispedisce non e' un Draft diverso.
  const altroMox = await manda(env, "/draft", esempio({ mox: "2 beta 2.11.7",
    mazzo_giocato: [VERSIONE_1] }));
  assert.deepEqual(esiti(altroMox.corpo), ["gia"]);

  const seconda = await silenzia(() => manda(env, "/draft",
    esempio({ mazzo_giocato: [VERSIONE_1, VERSIONE_2] })));
  assert.deepEqual(esiti(seconda.esito.corpo), ["aggiornato"]);
  assert.deepEqual(env.DRAFT_DB.tutte(
    "SELECT versione, quando, carte FROM draft_mazzo ORDER BY versione")
    .map((r) => [r.versione, r.quando, r.carte]),
  [[1, VERSIONE_1.quando, 40], [2, VERSIONE_2.quando, 40]]);

  // Invii vecchi, anche senza mazzo: non tolgono niente.
  for (const vecchio of [esempio({ mazzo_giocato: [VERSIONE_1] }), esempio()]) {
    const esito = await manda(env, "/draft", vecchio);
    assert.deepEqual(esiti(esito.corpo), ["gia"]);
  }
  assert.equal(env.DRAFT_DB.conta("draft_mazzo"), 2);
  assert.equal(env.DRAFT_DB.conta("draft"), 1);
  assert.equal(env.DRAFT_DB.conta("draft_pick"), 2);
  const grezzo = JSON.parse([...env.DRAFT_RAW.oggetti.values()][0]);
  assert.equal(grezzo.mazzo_giocato.length, 2);
  await coerente(env);

  // Il recupero restituisce l'ultimo mazzo valido.
  const recupero = await manda(env, "/draft/recupera", {
    mittente: "b".repeat(32), segreto: "d".repeat(64), set: "FRA",
    formato: "PremierDraft", mazzo: VERSIONE_2.mazzo, riserva: VERSIONE_2.riserva });
  assert.equal(recupero.stato, 200);
  assert.deepEqual(recupero.corpo.recupero.mazzo_giocato, VERSIONE_2);
});

test("P2: pick, pool o versioni gia' registrate diverse sono un conflitto visibile", async () => {
  const env = ambiente();
  await manda(env, "/draft", esempio({ mazzo_giocato: [VERSIONE_1] }));
  const prima = [...env.DRAFT_RAW.oggetti.entries()];

  const altraScelta = esempio({ mazzo_giocato: [VERSIONE_1, VERSIONE_2] });
  altraScelta.pick[1].scelta = 104;
  altraScelta.pick[1].seguito_mox = false;
  altraScelta.pool_finale = [102, 104];
  const piuVersioni = await silenzia(() => manda(env, "/draft", altraScelta));
  assert.deepEqual(esiti(piuVersioni.esito.corpo), ["rifiutato"]);
  assert.equal(piuVersioni.esito.corpo.esiti[0].motivo, "Draft gia' presente con contenuto diverso");
  assert.ok(piuVersioni.righe.some((r) => r.includes("draft_conflitto")));

  const altroMazzo = await silenzia(() => manda(env, "/draft", esempio({
    mazzo_giocato: [VERSIONE_2, VERSIONE_1] })));
  assert.equal(altroMazzo.esito.corpo.esiti[0].motivo,
    "Draft gia' presente con un mazzo giocato diverso");

  const altroMittente = await silenzia(() => manda(env, "/draft", esempio({
    mittente: "e".repeat(32), mazzo_giocato: [VERSIONE_1, VERSIONE_2] })));
  assert.deepEqual(esiti(altroMittente.esito.corpo), ["rifiutato"]);

  assert.deepEqual([...env.DRAFT_RAW.oggetti.entries()], prima);
  assert.equal(env.DRAFT_DB.conta("draft_mazzo"), 1);
  await coerente(env);
});

test("P2: aggiornamento con D1 guasto resta ritentabile e non sposta niente", async () => {
  const env = ambiente();
  await manda(env, "/draft", esempio());
  const prima = [...env.DRAFT_RAW.oggetti.entries()];
  env.DRAFT_DB.guasti.statement = 0;
  const guasto = await silenzia(() => manda(env, "/draft",
    esempio({ mazzo_giocato: [VERSIONE_1] })));
  assert.equal(guasto.esito.stato, 503);
  assert.deepEqual(esiti(guasto.esito.corpo), ["temporaneo"]);
  assert.deepEqual([...env.DRAFT_RAW.oggetti.entries()], prima);
  assert.equal(env.DRAFT_DB.conta("draft_mazzo"), 0);
  await coerente(env);

  const ritento = await silenzia(() => manda(env, "/draft",
    esempio({ mazzo_giocato: [VERSIONE_1] })));
  assert.deepEqual(esiti(ritento.esito.corpo), ["aggiornato"]);
  assert.equal(env.DRAFT_DB.conta("draft_mazzo"), 1);
  await coerente(env);
});

test("P2: aggiornamento salvato con risposta persa: nessun oggetto perso", async () => {
  const env = ambiente();
  await manda(env, "/draft", esempio());
  env.DRAFT_DB.guasti.dopoCommit = true;
  const { esito } = await silenzia(() => manda(env, "/draft",
    esempio({ mazzo_giocato: [VERSIONE_1] })));
  assert.equal(esito.stato, 200);
  assert.deepEqual(esiti(esito.corpo), ["aggiornato"]);
  assert.equal(env.DRAFT_DB.conta("draft_mazzo"), 1);
  assert.equal(env.DRAFT_RAW.oggetti.size, 1);
  await coerente(env);
});

test("P2: un oggetto R2 mancante conserva il retry senza inventare la storia", async () => {
  const env = ambiente();
  await manda(env, "/draft", esempio({ mazzo_giocato: [VERSIONE_1] }));
  env.DRAFT_RAW.oggetti.clear();
  const { esito } = await silenzia(() => manda(env, "/draft",
    esempio({ mazzo_giocato: [VERSIONE_1] })));
  assert.equal(esito.stato, 503);
  assert.deepEqual(esiti(esito.corpo), ["temporaneo"]);
  assert.equal(env.DRAFT_RAW.oggetti.size, 0);
  assert.equal(env.DRAFT_DB.conta("draft_mazzo"), 1);
});

test("A121: con ranghi distinti `vicina` non dipende dall'ordine dei candidati", async () => {
  const valori = [];
  for (const inverti of [false, true]) {
    const env = ambiente();
    const dato = esempio({ pick: [
      { numero: 1, posizione: [1, 1], offerte: [101, 101, 102], pool_prima: [],
        consiglio_mox: 101, politica: "policy-test", scelta: 101, seguito_mox: true,
        candidati: [
          { carta: 101, rango_mox: 1, campione: 1200, vicina: false },
          { carta: 101, rango_mox: 2, campione: 1200, vicina: true },
          { carta: 102, rango_mox: 3, campione: 800, vicina: false },
        ] },
    ], pool_finale: [101], completo: false });
    if (inverti) dato.pick[0].candidati.reverse();
    const { stato } = await manda(env, "/draft", dato);
    assert.equal(stato, 200);
    valori.push(env.DRAFT_DB.tutte("SELECT vicina FROM draft_pick")[0].vicina);
  }
  assert.deepEqual(valori, [0, 0]);
});

test("P2: un campo nuovo nei candidati non trasforma il reinvio in un conflitto", async () => {
  const env = ambiente();
  await manda(env, "/draft", esempio());
  const nuovoClient = esempio({ mox: "2 beta 2.12.0", mazzo_giocato: [VERSIONE_1] });
  nuovoClient.pick[0].candidati[0].motivi = ["campo di una versione futura"];
  const { esito } = await silenzia(() => manda(env, "/draft", nuovoClient));
  assert.deepEqual(esiti(esito.corpo), ["aggiornato"]);
  assert.equal(env.DRAFT_DB.conta("draft_mazzo"), 1);
  await coerente(env);
});
