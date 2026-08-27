import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import server from "../src/index.js";
import { controllaDraft, riconciliaStorageDraft, sospettoDraft } from "../src/draft.js";
import { creaFintoD1 } from "./finto-d1.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const SCHEMA = QUI + "../schema.sql";
const SCHEMA_DRAFT = QUI + "../schema-draft.sql";

function esempio(cambia = {}) {
  return {
    versione: 1,
    draft: "a".repeat(32),
    mittente: "b".repeat(32),
    mox: "2.9",
    set: "HOB",
    formato: "PremierDraft",
    iniziato: "2026-08-20T10:00:00Z",
    finito: "2026-08-20T10:20:00Z",
    completo: true,
    impronta_arena: "c".repeat(64),
    segreto_cancellazione: "d".repeat(64),
    pick: [
      { numero: 1, posizione: [1, 1], offerte: [101, 102], pool_prima: [],
        consiglio_mox: 101, politica: "policy-test", scelta: 102, seguito_mox: false,
        candidati: [
          { carta: 101, rango_mox: 1, campione: 1200, valore_17lands: 0.576,
            fonte_17lands: "17lands GIH WR", intervallo_95: [0.548, 0.604],
            modifica_mox: 0, vicina: false },
          { carta: 102, rango_mox: 2, campione: 1100, valore_17lands: 0.562,
            fonte_17lands: "17lands GIH WR", intervallo_95: [0.532, 0.591],
            modifica_mox: 0, vicina: true },
        ] },
      { numero: 2, posizione: [1, 2], offerte: [103, 104], pool_prima: [102],
        consiglio_mox: 103, politica: "policy-test", scelta: 103, seguito_mox: true,
        candidati: [
          { carta: 103, rango_mox: 1, campione: 900, valore_17lands: 0.55,
            fonte_17lands: "17lands GIH WR", intervallo_95: [0.51, 0.59],
            modifica_mox: 0, vicina: false },
        ] },
    ],
    pool_finale: [102, 103],
    ...cambia,
  };
}

/** Lo stesso Draft, ma arrivato davvero in fondo ai tre pacchetti. */
function esempioCompleto(cambia = {}) {
  const base = esempio();
  base.pick[1] = { ...base.pick[1], posizione: [3, 2] };
  return { ...base, ...cambia };
}

function r2Finto() {
  const oggetti = new Map();
  return {
    oggetti,
    async put(chiave, valore) { oggetti.set(chiave, valore); },
    async get(chiave) {
      const valore = oggetti.get(chiave);
      if (valore === undefined) return null;
      return { async text() { return valore; } };
    },
    async delete(chiavi) {
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
}

function ambiente() {
  return { DB: creaFintoD1(SCHEMA), DRAFT_DB: creaFintoD1(SCHEMA_DRAFT),
    DRAFT_RAW: r2Finto() };
}

async function manda(env, percorso, corpo, metodo = "POST") {
  const richiesta = new Request("https://esempio.invalid" + percorso, {
    method: metodo,
    headers: { "content-type": "application/json" },
    body: metodo === "POST" ? JSON.stringify(corpo) : undefined,
  });
  const risposta = await server.fetch(richiesta, env);
  return { stato: risposta.status, corpo: await risposta.json() };
}

test("valida sequenza, offerte, pool e campi vietati", () => {
  assert.equal(controllaDraft(esempio()), null);
  const sceltaImpossibile = esempio();
  sceltaImpossibile.pick[0].scelta = 999;
  assert.match(controllaDraft(sceltaImpossibile), /scelta/);
  const sequenza = esempio();
  sequenza.pick[1].numero = 3;
  assert.match(controllaDraft(sequenza), /sequenza/);
  const ostile = esempio({ opponent: "nome privato" });
  assert.match(controllaDraft(ostile), /vietato/);
});

test("Prendi Due valida e indicizza entrambe le carte della decisione", async () => {
  const env = ambiente();
  const pickTwo = esempio({
    draft: "9".repeat(32), formato: "PickTwoDraft",
    pick: [{
      numero: 1, posizione: [1, 1], offerte: [101, 102, 103], pool_prima: [],
      consiglio_mox: 101, consigli_mox: [101, 102], politica: "policy-test",
      scelte: [102, 101], seguito_mox: true,
      candidati: [
        { carta: 101, rango_mox: 1, campione: 1200, vicina: false },
        { carta: 102, rango_mox: 2, campione: 1100, vicina: false },
        { carta: 103, rango_mox: 3, campione: 900, vicina: true },
      ],
    }],
    pool_finale: [102, 101],
  });
  assert.equal(controllaDraft(pickTwo), null);
  const esito = await manda(env, "/draft", pickTwo);
  assert.equal(esito.stato, 200);
  assert.equal(env.DRAFT_DB.conta("draft_pick"), 2);
  const indice = env.DRAFT_DB.tutte(
    "SELECT numero, consiglio, scelta, seguito FROM draft_pick ORDER BY numero");
  assert.deepEqual(indice.map((riga) => riga.numero), [1, 2]);
  assert.deepEqual(indice.map((riga) => riga.scelta), [102, 101]);
  assert.ok(indice.every((riga) => riga.seguito === 1));

  const incompleto = structuredClone(pickTwo);
  incompleto.pick[0].scelte = [101];
  assert.match(controllaDraft(incompleto), /scelt/);
});

test("salva indice in D1 e traccia privata in R2 senza il segreto", async () => {
  const env = ambiente();
  const esito = await manda(env, "/draft", { draft: [esempio()] });
  assert.equal(esito.stato, 200);
  assert.equal(esito.corpo.accettati, 1);
  assert.equal(env.DRAFT_DB.conta("draft"), 1);
  assert.equal(env.DRAFT_DB.conta("draft_pick"), 2);
  assert.equal(env.DRAFT_RAW.oggetti.size, 1);
  const raw = [...env.DRAFT_RAW.oggetti.values()][0];
  assert.ok(!raw.includes("segreto_cancellazione"));
  assert.ok(!raw.includes("nome privato"));

  const doppione = await manda(env, "/draft", { draft: [esempio()] });
  assert.equal(doppione.corpo.gia_presenti, 1);
  assert.equal(env.DRAFT_RAW.oggetti.size, 1);
  assert.equal((await manda(env, "/draft/raw", null, "GET")).stato, 404);
});

test("recupera soltanto il proprio pool Draft con segreto, set e formato", async () => {
  const env = ambiente();
  const mazzo = {
    quando: "2026-08-20T10:25:00Z",
    mazzo: [[102, 2], [103, 21], [104, 17]],
    riserva: [[105, 2]],
  };
  const salvato = esempio({
    draft: "1".repeat(32), formato: "QuickDraft", pick: [],
    pool_finale: [102, 102, 103, 104, 105], mazzo_giocato: [mazzo],
  });
  assert.equal((await manda(env, "/draft", salvato)).stato, 200);
  assert.equal((await manda(env, "/draft", esempio({
    draft: "2".repeat(32), set: "TLA", formato: "QuickDraft",
    impronta_arena: "e".repeat(64),
  }))).stato, 200);

  const { stato, corpo } = await manda(env, "/draft/recupera", {
    mittente: "b".repeat(32), segreto: "d".repeat(64),
    set: "hob", formato: "QuickDraft", mazzo: mazzo.mazzo,
    riserva: mazzo.riserva,
  });
  assert.equal(stato, 200);
  assert.deepEqual(corpo, {
    versione: 1,
    recupero: {
      set: "HOB", formato: "QuickDraft", completo: true,
      iniziato: "2026-08-20T10:00:00Z",
      pool_finale: [102, 102, 103, 104, 105],
      mazzo_giocato: mazzo,
    },
  });
  const serializzato = JSON.stringify(corpo);
  for (const vietato of ["mittente", "segreto", "oggetto_r2", "candidati", "pick"]) {
    assert.ok(!serializzato.includes(vietato), `non deve uscire ${vietato}`);
  }
});

test("il recupero Draft rifiuta credenziali errate e non mescola gli eventi", async () => {
  const env = ambiente();
  assert.equal((await manda(env, "/draft", esempio({
    formato: "QuickDraft", pick: [], pool_finale: [101, 102],
  }))).stato, 200);

  assert.equal((await manda(env, "/draft/recupera", {
    mittente: "b".repeat(32), segreto: "e".repeat(64),
    set: "HOB", formato: "QuickDraft", mazzo: [[101, 1]], riserva: [],
  })).stato, 403);
  assert.equal((await manda(env, "/draft/recupera", {
    mittente: "c".repeat(32), segreto: "d".repeat(64),
    set: "HOB", formato: "QuickDraft", mazzo: [[101, 1]], riserva: [],
  })).stato, 403);
  assert.deepEqual((await manda(env, "/draft/recupera", {
    mittente: "b".repeat(32), segreto: "d".repeat(64),
    set: "HOB", formato: "QuickDraft", mazzo: [[999, 40]], riserva: [],
  })).corpo, { versione: 1, recupero: null });
  assert.equal((await manda(env, "/draft/recupera", {
    mittente: "b".repeat(32), segreto: "d".repeat(64), set: "HOB",
  })).stato, 400);
});

test("il recupero Draft ha un tetto prima di qualunque lettura R2", async () => {
  const env = ambiente();
  const mazzo = { quando: null, mazzo: [[101, 40]], riserva: [] };
  assert.equal((await manda(env, "/draft", esempio({
    formato: "QuickDraft", pick: [], pool_finale: [101],
    mazzo_giocato: [mazzo],
  }))).stato, 200);
  let lettureR2 = 0;
  const getVero = env.DRAFT_RAW.get.bind(env.DRAFT_RAW);
  env.DRAFT_RAW.get = async (...argomenti) => {
    lettureR2 += 1;
    return getVero(...argomenti);
  };
  let queryD1 = 0;
  const preparaVero = env.DRAFT_DB.prepare.bind(env.DRAFT_DB);
  env.DRAFT_DB.prepare = (...argomenti) => {
    queryD1 += 1;
    return preparaVero(...argomenti);
  };
  let chiaveLimite = null;
  env.TICKET_RATE_LIMITER = { limit: async ({ key }) => {
    chiaveLimite = key;
    return { success: false };
  } };

  const esito = await manda(env, "/draft/recupera", {
    mittente: "b".repeat(32), segreto: "d".repeat(64),
    set: "HOB", formato: "QuickDraft", mazzo: mazzo.mazzo, riserva: [],
  });
  assert.equal(esito.stato, 429);
  assert.match(esito.corpo.errore, /troppe richieste/i);
  assert.equal(chiaveLimite, `draft-recupera:${"b".repeat(32)}`);
  assert.equal(queryD1, 0);
  assert.equal(lettureR2, 0);
});

test("riconcilia D1 e R2 senza esporre o leggere il contenuto grezzo", async () => {
  const env = ambiente();
  assert.equal((await manda(env, "/draft", esempio())).stato, 200);
  const riga = env.DRAFT_DB.tutte("SELECT oggetto_r2 FROM draft")[0];
  env.DRAFT_RAW.oggetti.set(riga.oggetto_r2, "x");
  env.DRAFT_RAW.oggetti.set("2026-08/orfano.json", "{}");
  env.DRAFT_DB.prepare(`INSERT INTO draft
    (id, mittente, ricevuto, set_code, formato, completo, pick, politica,
     oggetto_r2, byte, versione) VALUES (?, ?, ?, 'HOB', 'PremierDraft', 1,
     1, 'p', ?, 99, 1)`).bind("f".repeat(32), "b".repeat(32),
      new Date().toISOString(), "2026-08/mancante.json").esegui();

  const rapporto = await riconciliaStorageDraft(env.DRAFT_DB, env.DRAFT_RAW);
  assert.equal(rapporto.coerente, false);
  assert.deepEqual(rapporto.orfani_r2, ["2026-08/orfano.json"]);
  assert.deepEqual(rapporto.senza_oggetto.map((x) => x.oggetto_r2),
    ["2026-08/mancante.json"]);
  assert.deepEqual(rapporto.dimensioni_incoerenti.map((x) => x.oggetto_r2),
    [riga.oggetto_r2]);
});

test("un guasto R2 non scrive D1 e un guasto D1 compensa R2", async () => {
  const r2Rotto = ambiente();
  r2Rotto.DRAFT_RAW.put = async () => { throw new Error("R2 put guasto"); };
  assert.equal((await manda(r2Rotto, "/draft", esempio())).stato, 500);
  assert.equal(r2Rotto.DRAFT_DB.conta("draft"), 0);
  assert.equal(r2Rotto.DRAFT_RAW.oggetti.size, 0);

  const d1Rotto = ambiente();
  d1Rotto.DRAFT_DB.batch = async () => { throw new Error("D1 batch guasto"); };
  assert.equal((await manda(d1Rotto, "/draft", esempio())).stato, 500);
  assert.equal(d1Rotto.DRAFT_DB.conta("draft"), 0);
  assert.equal(d1Rotto.DRAFT_RAW.oggetti.size, 0);
});

test("il raro doppio guasto viene trovato dalla riconciliazione", async () => {
  const env = ambiente();
  env.DRAFT_DB.batch = async () => { throw new Error("D1 batch guasto"); };
  env.DRAFT_RAW.delete = async () => { throw new Error("R2 delete guasto"); };
  assert.equal((await manda(env, "/draft", esempio())).stato, 500);
  assert.equal(env.DRAFT_DB.conta("draft"), 0);
  assert.equal(env.DRAFT_RAW.oggetti.size, 1);
  const rapporto = await riconciliaStorageDraft(env.DRAFT_DB, env.DRAFT_RAW);
  assert.equal(rapporto.coerente, false);
  assert.equal(rapporto.orfani_r2.length, 1);
});

test("pubblica solo aggregati Draft semplici e nasconde diagnostica e percentuali sotto soglia", async () => {
  const env = ambiente();
  await manda(env, "/draft", { draft: [esempioCompleto()] });
  const { stato, corpo } = await manda(env, "/draft/statistiche?set=HOB", null, "GET");
  assert.equal(stato, 200);
  assert.equal(corpo.totali.draft, 1);
  assert.equal(corpo.totali.pick, 2);
  assert.equal(corpo.eventi[0].set, "HOB");
  assert.equal(corpo.eventi[0].formato, "PremierDraft");
  assert.equal(corpo.risultati.win_rate, null);
  assert.ok(!JSON.stringify(corpo).match(/offerte|politica|tracce_marcate|mazzo_montato/));
});

test("un periodo Draft non valido viene rifiutato come richiesta errata", async () => {
  const env = ambiente();
  const { stato, corpo } = await manda(env, "/draft/statistiche?periodo=ieri", null, "GET");
  assert.equal(stato, 400);
  assert.equal(corpo.errore, "periodo Draft non valido");
});

test("cancella Draft e oggetti solo col segreto corretto", async () => {
  const env = ambiente();
  await manda(env, "/draft", esempio());
  const partita = {
    versione: 2, partita: "1".repeat(10), mittente: "b".repeat(32),
    evento: "PremierDraft_HOB", formato: "Limited",
    mazzo: { impronta: "e".repeat(64), carte: { "101": 40 } },
    avversario: { carte: [] }, andamento: { esito: "vinta", mulligan: 0 },
    segreto_cancellazione: "d".repeat(64), mox: "2.9",
  };
  assert.equal((await manda(env, "/partite", partita)).stato, 200);
  assert.equal(env.DB.conta("partite"), 1);
  assert.ok(!env.DB.tutte("SELECT dato FROM partite")[0].dato
    .includes("segreto_cancellazione"));
  const negato = await manda(env, "/contributi/elimina", {
    mittente: "b".repeat(32), segreto: "e".repeat(64),
  });
  assert.equal(negato.stato, 403);
  const tolto = await manda(env, "/contributi/elimina", {
    mittente: "b".repeat(32), segreto: "d".repeat(64),
  });
  assert.equal(tolto.stato, 200);
  assert.deepEqual(tolto.corpo.eliminati, { draft: 1, partite: 1 });
  assert.equal(env.DRAFT_DB.conta("draft"), 0);
  assert.equal(env.DRAFT_DB.conta("draft_pick"), 0);
  assert.equal(env.DRAFT_RAW.oggetti.size, 0);
  assert.equal(env.DB.conta("partite"), 0);
  assert.equal(env.DB.conta("carte_mazzo"), 0);
  assert.equal(env.DB.conta("contributori"), 0);
});

test("una cancellazione interrotta prima di D1 e' ripetibile", async () => {
  const env = ambiente();
  await manda(env, "/draft", esempio());
  const eliminaVero = env.DRAFT_RAW.delete.bind(env.DRAFT_RAW);
  let primo = true;
  env.DRAFT_RAW.delete = async (chiavi) => {
    if (primo) { primo = false; throw new Error("R2 temporaneamente guasto"); }
    return eliminaVero(chiavi);
  };
  const corpo = { mittente: "b".repeat(32), segreto: "d".repeat(64) };
  assert.equal((await manda(env, "/contributi/elimina", corpo)).stato, 500);
  assert.equal(env.DRAFT_DB.conta("draft"), 1);
  assert.equal(env.DRAFT_DB.conta("contributori"), 1);
  assert.equal((await manda(env, "/contributi/elimina", corpo)).stato, 200);
  assert.equal(env.DRAFT_DB.conta("draft"), 0);
  assert.equal(env.DRAFT_DB.conta("contributori"), 0);
  assert.equal(env.DRAFT_RAW.oggetti.size, 0);
});

test("il tetto per contributore rifiuta senza scrivere R2", async () => {
  const env = ambiente();
  const oggi = new Date().toISOString();
  for (let n = 0; n < 30; n += 1) {
    env.DRAFT_DB.prepare(`INSERT INTO draft
      (id, mittente, ricevuto, set_code, formato, completo, pick, politica,
       oggetto_r2, byte, versione) VALUES (?, ?, ?, 'HOB', 'PremierDraft', 1,
       1, 'p', ?, 10, 1)`).bind(String(n).padStart(32, "0"), "b".repeat(32),
        oggi, `x/${n}.json`).esegui();
  }
  const esito = await manda(env, "/draft", esempio());
  assert.equal(esito.stato, 429);
  assert.match(esito.corpo.errore, /tetto/);
  assert.equal(env.DRAFT_RAW.oggetti.size, 0);
});

test("un Draft completo usa insert compatti e la richiesta resta entro D1 Free", async () => {
  const env = ambiente();
  const lungo = esempio({ draft: "f".repeat(32), pick: [], pool_finale: [] });
  const pool = [];
  for (let numero = 1; numero <= 42; numero += 1) {
    const scelta = 1000 + numero;
    lungo.pick.push({
      numero,
      posizione: [Math.ceil(numero / 14), ((numero - 1) % 14) + 1],
      offerte: [scelta, 2000 + numero],
      pool_prima: [...pool],
      consiglio_mox: scelta,
      politica: "policy-test",
      scelta,
      seguito_mox: true,
      candidati: [{ carta: scelta, rango_mox: 1, campione: 1000, vicina: false }],
    });
    pool.push(scelta);
  }
  lungo.pool_finale = [...pool];
  assert.equal((await manda(env, "/draft", lungo)).stato, 200);
  assert.equal(env.DRAFT_DB.conta("draft_pick"), 42);
  const troppi = Array.from({ length: 5 }, (_, n) =>
    esempio({ draft: String(n).padStart(32, "0") }));
  assert.equal((await manda(ambiente(), "/draft", { draft: troppi })).stato, 413);
});

test("salute dichiara le versioni accettate", async () => {
  const env = ambiente();
  const { corpo } = await manda(env, "/salute", null, "GET");
  assert.deepEqual(corpo.versioni_partite_accettate, [1, 2]);
  assert.deepEqual(corpo.versioni_draft_accettate, [1]);
});

test("una partita v2 si collega soltanto con la stessa impronta Arena e senza duplicati", async () => {
  const env = ambiente();
  await manda(env, "/draft", esempio());
  const partita = {
    versione: 2, partita: "1".repeat(10), mittente: "b".repeat(32),
    evento: "PremierDraft_HOB", formato: "Limited",
    mazzo: { impronta: "e".repeat(64), carte: { "101": 40 } },
    avversario: { carte: [] }, andamento: { esito: "vinta", mulligan: 0 },
    draft: "c".repeat(64), segreto_cancellazione: "d".repeat(64), mox: "2.9",
  };
  const esito = await manda(env, "/partite", partita);
  assert.equal(esito.stato, 200);
  assert.equal(env.DRAFT_DB.conta("draft_link"), 1);
  assert.equal((await manda(env, "/partite", partita)).stato, 200);
  assert.equal(env.DRAFT_DB.conta("draft_link"), 1);

  const diversa = structuredClone(partita);
  diversa.partita = "2".repeat(10);
  diversa.draft = "d".repeat(64);
  assert.equal((await manda(env, "/partite", diversa)).stato, 200);
  assert.equal(env.DRAFT_DB.conta("draft_link"), 1);
});

test("una bozza dichiarata completa a meta' viene marcata, non creduta", async () => {
  // Il 25/08/2026 e' arrivato un Premier `completo` con nove scelte, sei
  // minuti prima che Arena finisse il Draft. Il contributo si conserva - e'
  // roba vera - ma non puo' entrare nella misura della policy come se fosse
  // un Draft intero.
  const env = ambiente();
  assert.equal((await manda(env, "/draft", esempio())).stato, 200);

  const riga = env.DRAFT_DB.tutte("SELECT sospetto FROM draft")[0];
  assert.equal(riga.sospetto, "dichiarato completo al pacchetto 1");

  const { corpo } = await manda(env, "/draft/statistiche?set=HOB", null, "GET");
  assert.equal(corpo.totali.draft, 0, "fuori dagli aggregati pubblici");
  assert.deepEqual(corpo.eventi, []);
});

test("un Draft arrivato in fondo non viene marcato", async () => {
  const env = ambiente();
  assert.equal((await manda(env, "/draft", esempioCompleto())).stato, 200);

  const riga = env.DRAFT_DB.tutte("SELECT sospetto FROM draft")[0];
  assert.equal(riga.sospetto, null);

  const { corpo } = await manda(env, "/draft/statistiche?set=HOB", null, "GET");
  assert.equal(corpo.totali.draft, 1);
  assert.equal(corpo.eventi.length, 1);
});

test("il pool piu' grande delle scelte registrate resta un contributo parziale", async () => {
  // Mox aperto a meta' Draft: le prime scelte non le ha viste. E' legittimo e
  // si conserva, ma il campione non e' completo e non deve sembrarlo.
  const env = ambiente();
  const parziale = esempioCompleto({ pool_finale: [102, 103, 104, 105] });
  delete parziale.pick[1].scelta;
  delete parziale.pick[1].seguito_mox;
  assert.equal((await manda(env, "/draft", parziale)).stato, 200);

  const riga = env.DRAFT_DB.tutte("SELECT sospetto FROM draft")[0];
  assert.match(riga.sospetto, /pool di 4 carte con 1 scelte registrate/);
});

test("un Draft completo con pool ma zero scelte viene marcato", () => {
  const senzaScelte = esempioCompleto({ pick: [], pool_finale: [101, 102, 103] });
  assert.equal(controllaDraft(senzaScelte), null, "il contributo resta conservabile");
  assert.equal(sospettoDraft(senzaScelte),
    "pool di 3 carte con 0 scelte registrate");
});

test("un Draft esplicitamente incompleto non viene marcato", () => {
  const incompleto = esempioCompleto({ completo: false, pick: [], pool_finale: [101] });
  assert.equal(sospettoDraft(incompleto), null);
});
