// Il motore puro dei gruppi Brew (S1): firma del main deck, distanza e piano
// a raggio. Nessun database: vedi brew-gruppi.test.js per la persistenza.

import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  ALGORITMO_BREW, SOGLIA_DISTANZA_BREW, FirmaNonValida, distanza, firmaMain,
  nuovoIdOpaco, pianificaGruppi, statistichePiano,
} from "../src/brew-clustering.js";
import {
  BASE, BASE_40, BASE_48, BASE_52, BASE_55, BASE_56, BASE_59, BASE_61,
  GENERICHE_X, GENERICHE_Y, STESSO_COLORE, magia, quante, righe, sostituisci, terra,
} from "./fixtures/brew-sintetici.js";

const firma = (lista, catalogo = {}) => firmaMain(righe(lista), catalogo);
const d = (a, b) => distanza(firma(a), firma(b));
const impronta = (n) => n.toString(16).padStart(64, "0");

// Generatore deterministico per le prove: stessi passi, stessi identificativi.
function contatore() {
  let n = 0;
  return (prefisso) => `${prefisso}_${(n += 1).toString(16).padStart(32, "0")}`;
}

function candidato(n, lista, partite) {
  return { impronta: impronta(n), partite, firma: firma(lista) };
}

test("algoritmo e soglia sono dichiarati e versionati", () => {
  assert.equal(ALGORITMO_BREW, "main-multiset-radius-v1");
  assert.equal(SOGLIA_DISTANZA_BREW, 4);
});

test("distanza: identita', simmetria, 59/60 = 1 e 56/60 = 4", () => {
  assert.equal(quante(BASE), 60);
  assert.equal(d(BASE, BASE), 0);
  for (const [a, b] of [[BASE, BASE_56], [BASE, STESSO_COLORE], [GENERICHE_X, GENERICHE_Y]]) {
    assert.equal(d(a, b), d(b, a));
  }
  assert.equal(d(BASE, BASE_59), 1);
  assert.equal(d(BASE, BASE_56), 4);
  assert.equal(d(BASE, BASE_55), 5);
});

test("distanza: l'ordine delle carte non conta, le copie si", () => {
  const rovescia = [...BASE].reverse();
  assert.equal(d(BASE, rovescia), 0);
  // Due copie in meno della stessa carta sono due carte di differenza.
  assert.equal(d(BASE, sostituisci(BASE, [[magia(1), 2]], [[magia(60), 2]])), 2);
  // Una carta assente dall'altra lista conta tutte le sue copie.
  assert.equal(d(BASE, sostituisci(BASE, [[magia(3), 4]], [[magia(61), 4]])), 4);
});

test("distanza: deck size diversa", () => {
  assert.equal(quante(BASE_61), 61);
  assert.equal(d(BASE, BASE_61), 1);
  assert.equal(quante(BASE_40), 40);
  assert.equal(d(BASE, BASE_40), 20);
});

test("le terre contano: stessa lista con base di mana diversa non e' la stessa", () => {
  const altreTerre = sostituisci(BASE, [[terra(1), 8]], [[terra(9), 8]]);
  assert.equal(d(BASE, altreTerre), 8);
});

test("stampe diverse della stessa carta sono la stessa carta", () => {
  // Due ArenaId per la stessa terra base: per nome la distanza e' zero, per
  // ArenaId sarebbe venti.
  const catalogo = { id_a_nome: { [terra(1)]: "plains", [terra(5)]: "plains" } };
  const altraStampa = sostituisci(BASE, [[terra(1), 20]], [[terra(5), 20]]);
  assert.equal(distanza(firma(BASE, catalogo), firma(altraStampa, catalogo)), 0);
  assert.equal(d(BASE, altraStampa), 20, "senza nomi resta l'ArenaId");
  // Meta' e meta' di due stampe: sempre venti Plains.
  const mista = sostituisci(BASE, [[terra(1), 10]], [[terra(5), 10]]);
  assert.equal(firma(mista, catalogo).get("plains"), 20);
});

test("falsi amici: stesso colore o molte terre e generiche in comune restano lontani", () => {
  assert.equal(d(BASE, STESSO_COLORE), 36);
  assert.equal(d(GENERICHE_X, GENERICHE_Y), 28);
  for (const k of [3, 4, 5]) {
    assert.ok(d(BASE, STESSO_COLORE) > k && d(GENERICHE_X, GENERICHE_Y) > k);
  }
});

test("firma e distanza rifiutano l'input non valido invece di indovinare", () => {
  const storte = [
    [], null, "BASE",
    [{ carta: 0, copie: 4 }], [{ carta: -1, copie: 4 }], [{ carta: 1.5, copie: 4 }],
    [{ carta: "123", copie: 4 }], [{ carta: 10000000, copie: 4 }],
    [{ carta: 123, copie: 0 }], [{ carta: 123, copie: -2 }], [{ carta: 123, copie: 2.5 }],
    [{ carta: 123, copie: "4" }], [{ carta: 123, copie: Number.NaN }], [{ carta: 123 }],
    [{ carta: 123, copie: 200 }, { carta: 124, copie: 51 }],
  ];
  for (const riga of storte) {
    assert.throws(() => firmaMain(riga, {}), FirmaNonValida, JSON.stringify(riga));
  }
  const buona = firma(BASE);
  for (const cattiva of [null, {}, new Map(), new Map([["x", 0]]), new Map([["x", 1.5]]),
    new Map([["", 4]]), [["x", 4]]]) {
    assert.throws(() => distanza(buona, cattiva), FirmaNonValida);
    assert.throws(() => distanza(cattiva, buona), FirmaNonValida);
  }
});

test("il sideboard non entra: la firma legge solo le righe del main deck", () => {
  // Il pacchetto legacy manda soltanto il main deck, e `carte_mazzo` contiene
  // solo quello; qualunque campo in piu' nella riga viene ignorato.
  const conRiserva = righe(BASE).map((riga) => ({ ...riga, sideboard: 15 }));
  assert.equal(distanza(firmaMain(conRiserva, {}), firma(BASE)), 0);
});

test("raggio, non catene: A-B = 4, B-C = 4, A-C = 8", () => {
  const [A, B, C] = [BASE, BASE_56, BASE_52];
  assert.deepEqual([d(A, B), d(B, C), d(A, C)], [4, 4, 8]);
  // A e' la piu' giocata e fa da rappresentante: C non entra.
  const primo = pianificaGruppi({ candidati: [candidato(1, A, 50), candidato(2, B, 40),
    candidato(3, C, 30)], generaId: contatore() });
  assert.equal(primo.gruppi.length, 2);
  const gruppoDi = (piano, n) => piano.membri.find((m) => m.impronta === impronta(n)).gruppo_id;
  assert.equal(gruppoDi(primo, 1), gruppoDi(primo, 2));
  assert.notEqual(gruppoDi(primo, 3), gruppoDi(primo, 1));
  // B al centro: A e C stanno entrambi entro 4 da B, ma la stella non si
  // allunga oltre il raggio. D dista 4 da C e 8 da B: nasce un gruppo nuovo.
  const D = BASE_48;
  assert.deepEqual([d(C, D), d(B, D)], [4, 8]);
  const secondo = pianificaGruppi({ candidati: [candidato(1, A, 40), candidato(2, B, 50),
    candidato(3, C, 30), candidato(4, D, 20)], generaId: contatore() });
  assert.equal(gruppoDi(secondo, 1), gruppoDi(secondo, 2));
  assert.equal(gruppoDi(secondo, 3), gruppoDi(secondo, 2));
  assert.notEqual(gruppoDi(secondo, 4), gruppoDi(secondo, 2));
});

test("ogni membro sta entro k dal rappresentante, e il gruppo non supera 2k", () => {
  const liste = [BASE, BASE_59, BASE_56, BASE_55, BASE_52, BASE_48, BASE_61, BASE_40,
    STESSO_COLORE, GENERICHE_X, GENERICHE_Y];
  for (const k of [3, 4, 5]) {
    const candidati = liste.map((lista, i) => candidato(i + 1, lista, 100 - i * 7));
    const piano = pianificaGruppi({ candidati, soglia: k, generaId: contatore() });
    const perImpronta = new Map(candidati.map((c) => [c.impronta, c.firma]));
    const rappresentanti = new Map(piano.gruppi.map((g) => [g.id, perImpronta.get(g.rappresentante)]));
    for (const membro of piano.membri) {
      const dalCentro = distanza(perImpronta.get(membro.impronta), rappresentanti.get(membro.gruppo_id));
      assert.ok(dalCentro <= k);
      assert.equal(membro.distanza, dalCentro);
    }
    for (const a of piano.membri) {
      for (const b of piano.membri) {
        if (a.gruppo_id !== b.gruppo_id) continue;
        assert.ok(distanza(perImpronta.get(a.impronta), perImpronta.get(b.impronta)) <= 2 * k);
      }
    }
  }
});

test("il primo backfill non dipende dall'ordine dei candidati", () => {
  const candidati = [candidato(1, BASE, 45), candidato(2, BASE_56, 34), candidato(3, BASE_59, 34),
    candidato(4, STESSO_COLORE, 31), candidato(5, GENERICHE_X, 12)];
  const atteso = pianificaGruppi({ candidati, generaId: contatore() });
  const permutazioni = (voci) => voci.length <= 1 ? [voci]
    : voci.flatMap((v, i) => permutazioni([...voci.slice(0, i), ...voci.slice(i + 1)]).map((r) => [v, ...r]));
  for (const ordine of permutazioni(candidati)) {
    assert.deepEqual(pianificaGruppi({ candidati: ordine, generaId: contatore() }), atteso);
  }
  // Il rappresentante e' la lista piu' giocata; a pari partite l'impronta minore.
  assert.equal(atteso.gruppi[0].rappresentante, impronta(1));
  const pari = pianificaGruppi({ candidati: [candidato(9, BASE, 30), candidato(8, BASE_56, 30)],
    generaId: contatore() });
  assert.equal(pari.gruppi[0].rappresentante, impronta(8));
});

test("i nuovi candidati entrano nel gruppo piu' vicino; a parita' vince il piu' vecchio", () => {
  const esistenti = [
    { id: `bg_${"a".repeat(32)}`, ordine: 1, firma: firma(BASE) },
    { id: `bg_${"b".repeat(32)}`, ordine: 2, firma: firma(BASE_52) },
  ];
  // BASE_56 dista 4 da entrambi i rappresentanti: vince l'ordine 1.
  const pari = pianificaGruppi({ gruppi: esistenti, candidati: [candidato(3, BASE_56, 10)],
    generaId: contatore() });
  assert.deepEqual(pari.gruppi, []);
  assert.equal(pari.membri[0].gruppo_id, esistenti[0].id);
  // BASE_48 e' piu' vicino al secondo.
  const vicino = pianificaGruppi({ gruppi: esistenti, candidati: [candidato(4, BASE_48, 10)],
    generaId: contatore() });
  assert.equal(vicino.membri[0].gruppo_id, esistenti[1].id);
  assert.equal(vicino.membri[0].distanza, 4);
  // Nessun gruppo compatibile: ne nasce uno nuovo, con l'ordine successivo.
  const nuovo = pianificaGruppi({ gruppi: esistenti, candidati: [candidato(5, STESSO_COLORE, 99)],
    generaId: contatore() });
  assert.deepEqual(nuovo.gruppi.map((g) => g.ordine), [3]);
  // Un gruppo di cui non si conoscono piu' le carte del rappresentante non
  // accoglie nessuno, e non viene riscritto.
  const orfano = pianificaGruppi({ gruppi: [{ ...esistenti[0], firma: null }],
    candidati: [candidato(6, BASE, 10)], generaId: contatore() });
  assert.equal(orfano.gruppi.length, 1);
  assert.notEqual(orfano.membri[0].gruppo_id, esistenti[0].id);
});

test("k=3/4/5 sulle fixture: il 56/60 entra da k=4, il 55/60 solo con k=5", () => {
  const esito = {};
  for (const k of [3, 4, 5]) {
    const piano = pianificaGruppi({ candidati: [candidato(1, BASE, 60), candidato(2, BASE_56, 40),
      candidato(3, BASE_55, 30), candidato(4, BASE_59, 20)], soglia: k, generaId: contatore() });
    esito[k] = piano.membri.map((m) => m.gruppo_id === piano.membri[0].gruppo_id);
  }
  assert.deepEqual(esito[3], [true, false, false, true]);
  assert.deepEqual(esito[4], [true, true, false, true]);
  assert.deepEqual(esito[5], [true, true, true, true]);
});

test("identificativi opachi: casuali, con prefisso, mai uguali", () => {
  const visti = new Set();
  for (let i = 0; i < 200; i += 1) {
    const id = nuovoIdOpaco("bg");
    assert.match(id, /^bg_[0-9a-f]{32}$/);
    visti.add(id);
  }
  assert.equal(visti.size, 200);
  // Un generatore che ripete o sbaglia forma ferma il piano.
  assert.throws(() => pianificaGruppi({ candidati: [candidato(1, BASE, 3), candidato(2, STESSO_COLORE, 2)],
    generaId: () => `bg_${"0".repeat(32)}` }), /identificativo/);
  assert.throws(() => pianificaGruppi({ candidati: [candidato(1, BASE, 3)],
    generaId: (p) => `${p}_${impronta(1).slice(0, 32)}x` }), /identificativo/);
});

test("il piano rifiuta candidati duplicati o non validi", () => {
  assert.throws(() => pianificaGruppi({ candidati: [candidato(1, BASE, 3), candidato(1, BASE, 3)] }),
    /duplicato/);
  assert.throws(() => pianificaGruppi({ candidati: [{ impronta: "x", partite: 1, firma: firma(BASE) }] }),
    /non valido/);
  assert.throws(() => pianificaGruppi({ candidati: [candidato(1, BASE, 3)], soglia: -1 }), /soglia/);
});

test("statistiche del piano: solo conteggi", () => {
  const piano = pianificaGruppi({ candidati: [candidato(1, BASE, 60), candidato(2, BASE_56, 40),
    candidato(3, STESSO_COLORE, 30)], generaId: contatore() });
  assert.deepEqual(statistichePiano(piano), {
    candidati: 3, gruppi_toccati: 2, gruppi_nuovi: 2, singleton: 1,
    distribuzione_dimensioni: { 1: 1, 2: 1 },
  });
  assert.equal(JSON.stringify(statistichePiano(piano)).includes(impronta(1)), false);
});
