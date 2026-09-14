// Proprieta' del join su tutte le 40.320 permutazioni di otto arrivi, divise
// fra sei worker reali. Ogni worker legge gli stessi arrivi e restituisce gli
// stati finali distinti della sua fetta; l'aggregazione e' un'unione ordinata,
// quindi il risultato non dipende da quanti worker ci sono ne' dall'ordine in
// cui rispondono.

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Worker } from "node:worker_threads";

import { J } from "../src/research/canonico.js";

const WORKER = 6;
const h = (n) => n.toString(16).padStart(64, "0");
const arrivo = (osservazioni, n) => ({ revisione: { modello: 1, osservazioni },
  retained: [{ hash: h(n), body: { n } }], overflow: false });

// Due arrivi vecchi, sei varianti alla revisione massima (una ripetuta).
const ARRIVI = [arrivo(1, 90), arrivo(2, 80), arrivo(3, 70), arrivo(3, 60),
  arrivo(3, 50), arrivo(3, 40), arrivo(3, 60), arrivo(3, 30)];

function esegui(inizio, fine) {
  return new Promise((risolvi, rifiuta) => {
    const lavoratore = new Worker(new URL("./lavoratore-proprieta.mjs", import.meta.url),
      { workerData: { inizio, fine, arrivi: ARRIVI } });
    lavoratore.once("message", risolvi);
    lavoratore.once("error", rifiuta);
  });
}

test("stato finale unico su 8! ordini, calcolato da 6 worker", async () => {
  const totale = 40320;
  const passo = Math.ceil(totale / WORKER);
  const fette = Array.from({ length: WORKER }, (_, i) =>
    [i * passo, Math.min(totale, (i + 1) * passo)]);
  const risposte = await Promise.all(fette.map(([a, b]) => esegui(a, b)));
  assert.equal(risposte.length, WORKER);
  assert.equal(risposte.reduce((n, r) => n + (r.fine - r.inizio), 0), totale);
  const finali = [...new Set(risposte.flatMap((r) => r.finali))].sort();
  // Atteso scritto a mano: revisione (1,3), i tre hash minori fra 30, 40,
  // 50, 60, 70 e overflow perche' le varianti distinte sono cinque.
  const atteso = { revisione: { modello: 1, osservazioni: 3 },
    retained: [30, 40, 50].map((n) => ({ hash: h(n), body: { n } })), overflow: true };
  assert.deepEqual(finali, [J(atteso)]);
});
