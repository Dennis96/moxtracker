// Il lavoro di un worker della prova di proprieta': applica `decidi` a una
// fetta delle permutazioni degli arrivi e restituisce gli stati finali
// distinti visti. Input di sola lettura, output locale al worker.

import { parentPort, workerData } from "node:worker_threads";

import { J } from "../src/research/canonico.js";
import { decidi } from "../src/research/join.js";

function permutazione(indice, elementi) {
  const restanti = [...elementi];
  const fuori = [];
  for (let n = restanti.length; n > 0; n -= 1) {
    let fattoriale = 1;
    for (let k = 2; k < n; k += 1) fattoriale *= k;
    const posizione = Math.floor(indice / fattoriale);
    indice %= fattoriale;
    fuori.push(restanti.splice(posizione, 1)[0]);
  }
  return fuori;
}

const { inizio, fine, arrivi } = workerData;
const finali = new Set();
for (let i = inizio; i < fine; i += 1) {
  const stato = permutazione(i, arrivi).reduce((s, a) => decidi(s, a).stato, null);
  finali.add(J(stato));
}
parentPort.postMessage({ inizio, fine, finali: [...finali].sort() });
