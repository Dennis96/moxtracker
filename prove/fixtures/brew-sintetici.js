// Mazzi sintetici e anonimi per le prove S1 (Brew quasi uguali).
//
// Nessuna lista reale: gli ArenaId sono inventati, fuori da quelli di Arena
// (magie 91000xx, terre 91900xx), cosi' il catalogo non li riconosce e ogni
// lista resta un Brew. Una lista e' un array di [arenaId, copie].

export const magia = (n) => 9100000 + n;
export const terra = (n) => 9190000 + n;

export function sostituisci(lista, via, dentro) {
  const copie = new Map(lista);
  for (const [carta, n] of via) {
    const resto = (copie.get(carta) || 0) - n;
    if (resto < 0) throw new Error("sostituzione impossibile");
    if (resto) copie.set(carta, resto); else copie.delete(carta);
  }
  for (const [carta, n] of dentro) copie.set(carta, (copie.get(carta) || 0) + n);
  return [...copie];
}

export const righe = (lista) => lista.map(([carta, copie]) => ({ carta, copie }));

// L'unica lista con ArenaId veri: il riferimento Mono White Auras del catalogo
// (la stessa di dettaglio-archetipo.test.js), per avere un mazzo riconosciuto.
export const AURE_RICONOSCIUTE = [
  [51307, 4], [92081, 4], [92090, 4], [97823, 4], [97964, 4],
  [91549, 2], [92089, 2], [66499, 20],
];

let progressivo = 0;

// Partite sintetiche: ogni partita porta le sue carte, come le salva il Worker.
export function giocaPartite(db, impronta, lista, { partite, vinte = 0, formato = "Standard",
  evento = "Ladder", rank = "Gold", giorni = 1, su = 1 } = {}) {
  const ricevuta = new Date(Date.now() - giorni * 86400000).toISOString();
  for (let i = 0; i < partite; i += 1) {
    progressivo += 1;
    const id = progressivo.toString(16).padStart(10, "0");
    db.prepare(`INSERT INTO partite
      (id, mittente, ricevuta, formato, evento, esito, su_gioco, rank_classe,
       impronta_mazzo, versione, dato)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '{}')`)
      .bind(id, "f".repeat(32), ricevuta, formato, evento, i < vinte ? "vinta" : "persa", su,
        rank, impronta).esegui();
    for (const [carta, copie] of lista) {
      db.prepare("INSERT INTO carte_mazzo (partita, carta, copie) VALUES (?, ?, ?)")
        .bind(id, carta, copie).esegui();
    }
  }
}
export const quante = (lista) => lista.reduce((somma, [, copie]) => somma + copie, 0);

// La lista di partenza: dieci magie da quattro e venti terre.
export const BASE = [
  ...Array.from({ length: 10 }, (_, i) => [magia(i + 1), 4]),
  [terra(1), 20],
];

// Il caso osservato nel collaudo: 56 carte su 60 in comune, quattro
// sostituzioni (distanza 4). Il 59/60 e' una copia sola (distanza 1).
export const BASE_59 = sostituisci(BASE, [[magia(10), 1]], [[magia(51), 1]]);
export const BASE_56 = sostituisci(BASE, [[magia(10), 4]], [[magia(52), 4]]);
// Cinque sostituzioni: separa k=4 da k=5.
export const BASE_55 = sostituisci(BASE, [[magia(10), 4], [magia(9), 1]],
  [[magia(52), 4], [magia(53), 1]]);
// Otto sostituzioni a partire da BASE_56: dista 4 da BASE_56 e 8 da BASE.
export const BASE_52 = sostituisci(BASE_56, [[magia(9), 4]], [[magia(54), 4]]);
// Quattro sostituzioni ancora: dista 4 da BASE_52 e 8 da BASE_56.
export const BASE_48 = sostituisci(BASE_52, [[magia(8), 4]], [[magia(55), 4]]);

// Mazzi di dimensione diversa.
export const BASE_61 = sostituisci(BASE, [], [[terra(1), 1]]);
export const BASE_40 = sostituisci(BASE, [[magia(6), 4], [magia(7), 4], [magia(8), 4],
  [magia(9), 4], [magia(10), 4]], []);

// Falsi amici. Stesso colore (stesse terre) e una magia generica in comune,
// ma un nucleo diverso: 24 carte in comune su 60.
export const STESSO_COLORE = [
  [terra(1), 20], [magia(1), 4],
  ...Array.from({ length: 9 }, (_, i) => [magia(20 + i), 4]),
];
// Due mazzi che condividono 24 terre e 8 magie generiche (32 carte su 60), ma
// fanno cose diverse con le altre 28.
const COMUNI = [[terra(1), 16], [terra(2), 4], [terra(3), 4], [magia(1), 4], [magia(2), 4]];
export const GENERICHE_X = [...COMUNI, ...Array.from({ length: 7 }, (_, i) => [magia(30 + i), 4])];
export const GENERICHE_Y = [...COMUNI, ...Array.from({ length: 7 }, (_, i) => [magia(40 + i), 4])];
