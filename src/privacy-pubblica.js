// Regole comuni per tutto cio' che deriva dalle decklist osservate in MOX.
// Il numero di installazioni serve solo a decidere la pubblicazione: non deve
// mai uscire nelle risposte pubbliche.
export const SOGLIA_DECKLIST_PARTITE = 30;
export const SOGLIA_DECKLIST_CONTRIBUTORI = 5;

export function decklistPubblicabile(partite, contributori) {
  return Number(partite) >= SOGLIA_DECKLIST_PARTITE &&
    Number(contributori) >= SOGLIA_DECKLIST_CONTRIBUTORI;
}
