// Il gateway budgetizzato D1 di Research (addendum finale M8).
//
// Il binding strumentato qui sotto conta le invocation vere e, a ogni evento,
// pretende l'invariante `attempted_cost_prefix <= charged <= max`: se il
// gateway invocasse D1 prima di aver riservato, la prova fallirebbe nel punto
// esatto, non solo alla fine.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  ResearchD1BudgetContext, BudgetEsaurito, TokenNonValido, descrittore,
} from "../src/research/budget.js";

function bindingStrumentato({ guastoLettura = null, guastoBatch = null } = {}) {
  const registro = { letture: 0, statement: 0, batch: 0, eventi: [] };
  let contesto = null;
  const controlla = (costo) => {
    registro.tentato = (registro.tentato || 0) + costo;
    assert.ok(registro.tentato <= contesto.charged,
      `prefisso ${registro.tentato} oltre charged ${contesto.charged}`);
    assert.ok(contesto.charged <= contesto.max);
  };
  const binding = {
    prepare(sql) {
      const stmt = { sql, argomenti: [],
        bind(...a) { return { ...stmt, argomenti: a }; },
        async first() {
          controlla(1); registro.letture += 1; registro.eventi.push(["first", sql]);
          if (guastoLettura) await guastoLettura();
          return { valore: 1 };
        },
        async all() {
          controlla(1); registro.letture += 1; registro.eventi.push(["all", sql]);
          if (guastoLettura) await guastoLettura();
          return { results: [] };
        },
      };
      return stmt;
    },
    async batch(stmts) {
      controlla(stmts.length);
      registro.batch += 1;
      registro.statement += stmts.length;
      registro.eventi.push(["batch", stmts.length]);
      if (guastoBatch) await guastoBatch(stmts);
      return stmts.map(() => ({ meta: { changes: 1 } }));
    },
  };
  return {
    registro, binding,
    contesto(max) {
      contesto = new ResearchD1BudgetContext({ bindings: { DB: binding }, max });
      return contesto;
    },
  };
}

const lettura = (n = 0) => descrittore("lettura", `SELECT ${n}`, [n]);
const scrittura = (n) => descrittore("scrittura", "INSERT INTO t VALUES (?)", [n]);
const batch = (quanti, base = 0) =>
  Object.freeze(Array.from({ length: quanti }, (_, i) => scrittura(base + i)));

test("budget 4 e cinque letture: quattro invocate, la quinta non parte", async () => {
  const s = bindingStrumentato();
  const ctx = s.contesto(4);
  for (let i = 0; i < 4; i += 1) await ctx.first(lettura(i));
  await assert.rejects(() => ctx.first(lettura(5)), BudgetEsaurito);
  assert.equal(s.registro.letture, 4);
  assert.equal(s.registro.statement, 0);
  assert.equal(ctx.charged, 4);
});

async function scenario(max, letture, piano) {
  const s = bindingStrumentato();
  const ctx = s.contesto(max);
  for (let i = 0; i < letture; i += 1) await ctx.first(lettura(i));
  let token;
  try {
    token = ctx.reserveInitialWritePlan(piano);
  } catch (errore) {
    assert.ok(errore instanceof BudgetEsaurito);
    return { s, ctx, scritto: false };
  }
  for (let i = 0; i < piano.length; i += 1) await ctx.invokeReservedBatch(token[i], piano[i]);
  return { s, ctx, scritto: true };
}

test("A: 5 letture + 20 statement, rifiuto a 24 e costo esatto a 25", async () => {
  const no = await scenario(24, 5, [batch(20)]);
  assert.equal(no.scritto, false);
  assert.equal(no.s.registro.statement, 0);
  assert.equal(no.ctx.charged, 5, "nessuna reservation parziale");
  const si = await scenario(25, 5, [batch(20)]);
  assert.equal(si.s.registro.statement, 20);
  assert.equal(si.ctx.charged, 25);
});

test("B: 37 letture + 33 batch da 40, rifiuto a 1.356 e costo esatto a 1.357", async () => {
  const piano = () => Array.from({ length: 33 }, (_, i) => batch(40, i * 40));
  const no = await scenario(1356, 37, piano());
  assert.equal(no.s.registro.statement, 0);
  assert.equal(no.ctx.charged, 37);
  const si = await scenario(1357, 37, piano());
  assert.equal(si.s.registro.statement, 1320);
  assert.equal(si.s.registro.batch, 33);
  assert.equal(si.ctx.charged, 1357);
});

test("budget 1: una lettura esatta, la seconda negata, lettura condizionale inclusa", async () => {
  const s = bindingStrumentato();
  const ctx = s.contesto(1);
  const prima = await ctx.first(lettura());
  if (prima) await assert.rejects(() => ctx.all(lettura(2)), BudgetEsaurito);
  assert.equal(s.registro.letture, 1);
  assert.equal(ctx.charged, 1);
});

test("lettura fallita o in timeout resta addebitata: nessun rimborso", async () => {
  const s = bindingStrumentato({ guastoLettura: async () => { throw new Error("D1 giu'"); } });
  const ctx = s.contesto(3);
  await assert.rejects(() => ctx.first(lettura()), /D1 giu'/);
  await assert.rejects(() => ctx.first(lettura()), /D1 giu'/);
  assert.equal(ctx.charged, 2);
  // Un esito incerto: la Promise non si risolve mai. La charge c'e' gia'.
  const sospesa = bindingStrumentato({ guastoLettura: () => new Promise(() => {}) });
  const ctx2 = sospesa.contesto(1);
  void ctx2.first(lettura());
  assert.equal(ctx2.charged, 1);
  await assert.rejects(() => ctx2.first(lettura()), BudgetEsaurito);
});

test("un batch che fallisce al primo statement conserva l'intera charge", async () => {
  const s = bindingStrumentato({ guastoBatch: async () => { throw new Error("CHECK constraint failed"); } });
  const ctx = s.contesto(10);
  const [token] = ctx.reserveInitialWritePlan([batch(7)]);
  await assert.rejects(() => ctx.invokeReservedBatch(token, batch(7)), /CHECK/);
  assert.equal(ctx.charged, 7);
  assert.throws(() => ctx.reserveInitialWritePlan([batch(4)]), BudgetEsaurito);
  assert.equal(ctx.charged, 7);
});

test("un token si usa una volta sola, e solo per il suo piano", async () => {
  const s = bindingStrumentato();
  const ctx = s.contesto(100);
  const piano = batch(3);
  const [token] = ctx.reserveInitialWritePlan([piano]);
  await ctx.invokeReservedBatch(token, piano);
  await assert.rejects(() => ctx.invokeReservedBatch(token, piano), TokenNonValido);
  assert.equal(s.registro.batch, 1, "il riuso non raggiunge il binding");
  assert.equal(ctx.charged, 3, "nessun doppio addebito");
  await assert.rejects(() => ctx.invokeReservedBatch(null, piano), TokenNonValido);
  await assert.rejects(() => ctx.invokeReservedBatch({ costo: 3 }, piano), TokenNonValido);
  const altro = bindingStrumentato().contesto(100);
  const [estraneo] = altro.reserveInitialWritePlan([batch(3)]);
  await assert.rejects(() => ctx.invokeReservedBatch(estraneo, batch(3)), TokenNonValido);
  assert.equal(s.registro.batch, 1);
});

test("rechunk, statement aggiunti, omessi o descriptor mutati si fermano prima di D1", async () => {
  const s = bindingStrumentato();
  const ctx = s.contesto(1000);
  const piano = batch(6);
  const [t1, t2, t3, t4, t5] = ctx.reserveInitialWritePlan([piano, piano, piano, piano, piano]);
  await assert.rejects(() => ctx.invokeReservedBatch(t1, piano.slice(0, 3)), TokenNonValido);
  await assert.rejects(() => ctx.invokeReservedBatch(t2, [...piano, scrittura(99)]), TokenNonValido);
  await assert.rejects(() => ctx.invokeReservedBatch(t3, piano.slice(1)), TokenNonValido);
  const mutato = [...piano];
  mutato[2] = scrittura(1234);
  await assert.rejects(() => ctx.invokeReservedBatch(t4, mutato), TokenNonValido);
  assert.throws(() => { piano[0].params[0] = 5; }, TypeError, "descriptor congelato");
  assert.equal(s.registro.batch, 0);
  // Anche i token respinti restano addebitati: nessun rimborso.
  assert.equal(ctx.charged, 30);
  await ctx.invokeReservedBatch(t5, piano);
  assert.equal(s.registro.statement, 6);
});

test("due reservation concorrenti con un solo credito: una sola autorizzata", async () => {
  const s = bindingStrumentato();
  const ctx = s.contesto(1);
  const esiti = await Promise.allSettled([ctx.first(lettura(1)), ctx.first(lettura(2))]);
  assert.deepEqual(esiti.map((e) => e.status).sort(), ["fulfilled", "rejected"]);
  assert.equal(s.registro.letture, 1);
  assert.equal(ctx.charged, 1);
  const ctx2 = bindingStrumentato().contesto(5);
  const piani = await Promise.allSettled([
    Promise.resolve().then(() => ctx2.reserveInitialWritePlan([batch(4)])),
    Promise.resolve().then(() => ctx2.reserveInitialWritePlan([batch(4)])),
  ]);
  assert.deepEqual(piani.map((e) => e.status).sort(), ["fulfilled", "rejected"]);
  assert.equal(ctx2.charged, 4);
});

test("un budget non intero positivo non crea nemmeno il context", () => {
  for (const max of [0, -1, 1.5, "10", null, undefined]) {
    assert.throws(() => new ResearchD1BudgetContext({ bindings: { DB: {} }, max }), RangeError);
  }
});

test("un batch non puo' mescolare database diversi", async () => {
  const s = bindingStrumentato();
  const ctx = new ResearchD1BudgetContext({ bindings: { DB: s.binding, DRAFT_DB: s.binding }, max: 10 });
  const misto = Object.freeze([scrittura(1), descrittore("scrittura", "INSERT", [1], "DRAFT_DB")]);
  assert.throws(() => ctx.reserveInitialWritePlan([misto]), TypeError);
  assert.equal(ctx.charged, 0);
});
