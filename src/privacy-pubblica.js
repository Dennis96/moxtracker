// Regola comune per tutto cio' che deriva dalle decklist osservate in MOX.
// La lista precisa diventa pubblicabile quando la stessa variante raggiunge
// almeno 30 partite. L'identificativo dell'installazione resta sempre privato
// e non condiziona la soglia di pubblicazione.
export const SOGLIA_DECKLIST_PARTITE = 30;

export function decklistPubblicabile(partite) {
  return Number(partite) >= SOGLIA_DECKLIST_PARTITE;
}
