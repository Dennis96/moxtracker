import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  creaReportDaRisposte, directoryPrivata, estraiImprontePubbliche,
} from "../strumenti/s3_candidati_pubblici.mjs";

const A = "a".repeat(64);
const B = "b".repeat(64);
const SOTTO = "c".repeat(64);

function carte(diversa) {
  const fuori = [];
  for (let i = 0; i < 14; i += 1) {
    fuori.push({ arena_id: 9000000 + i, copie: 4, nome: `Carta comune ${i}` });
  }
  fuori.push({ arena_id: diversa, copie: 4, nome: `Carta ${diversa}` });
  return fuori;
}

function dettaglio(impronta, lista) {
  return {
    tipo_dettaglio: "non_classificato",
    varianti: [{
      impronta,
      decklist_pubblicabile: true,
      carte: lista,
    }],
  };
}

test("estrae solo varianti Brew gia' pubbliche", () => {
  const meta = {
    mazzi: [{
      tipo_dettaglio: "altro",
      varianti_brew: [
        { impronta: A, partite: 45, dati_sufficienti: true },
        { impronta: SOTTO, partite: 29, dati_sufficienti: false },
      ],
    }],
  };
  assert.deepEqual(estraiImprontePubbliche(meta), [{ impronta: A, partite: 45 }]);
});

test("usa il clustering S1 k=4: due 56/60 diventano un solo candidato", () => {
  const meta = {
    mazzi: [{
      tipo_dettaglio: "altro",
      varianti_brew: [
        { impronta: A, partite: 45, dati_sufficienti: true },
        { impronta: B, partite: 34, dati_sufficienti: true },
      ],
    }],
  };
  const report = creaReportDaRisposte({
    meta,
    dettagli: {
      [A]: dettaglio(A, carte(9000100)),
      [B]: dettaglio(B, carte(9000101)),
    },
    raccoltoIl: "2026-09-17T00:00:00.000Z",
  });
  assert.equal(report.stato, "RACCOLTO");
  assert.equal(report.gruppi.length, 1);
  assert.equal(report.gruppi[0].partite_aggregate, 79);
  assert.equal(report.gruppi[0].varianti_pubbliche, 2);
  assert.deepEqual(report.gruppi[0].membri.map((m) => m.distanza_rappresentante), [0, 4]);
  assert.equal(report.gruppi[0].classe_s3, null);
  assert.equal(report.gruppi[0].decisione_s3, "DA_REVISIONARE_CON_FONTI");
});

test("gli artefatti reali non possono essere scritti nel repository", () => {
  assert.throws(() => directoryPrivata(process.cwd()), /fuori dal repository/);
});
