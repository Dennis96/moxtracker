function istante(valore) {
  const millisecondi = Date.parse(String(valore || ""));
  return Number.isFinite(millisecondi) ? millisecondi : Number.NEGATIVE_INFINITY;
}

// I due flussi hanno fonti diverse: le sessioni storiche terminano con
// `finita`, le tracce hanno l'istante di ricezione. Li ordiniamo solo con il
// timestamp che ciascuna fonte dichiara, senza provare a ricostruire eventi.
export function ordinaVociDraft(sessioni = [], tracce = []) {
  return [
    ...sessioni.map((valore) => ({ tipo: "sessione", valore, quando: valore?.finita })),
    // `completo` non rende consultabile una traccia senza alcuna scelta: e'
    // un indice difettoso e non rappresenta un Draft utile.
    ...tracce.filter((valore) => Number(valore?.pick) > 0).map((valore) => ({ tipo: "draft", valore,
      quando: valore?.ricevuto || valore?.iniziato })),
  ].sort((a, b) => istante(b.quando) - istante(a.quando));
}

// `pool_finale` e' una sequenza di carte, percio' lo stesso Arena ID compare
// tante volte quante le copie. Il nome non e' una chiave affidabile: ristampe
// o carte diverse possono avere lo stesso testo localizzato.
export function raggruppaCartePool(pool = [], nomi = {}, stampe = {}) {
  const raggruppate = new Map();
  for (const valore of Array.isArray(pool) ? pool : []) {
    const chiave = String(valore);
    if (!chiave) continue;
    const arenaId = Number.isInteger(Number(valore)) ? Number(valore) : valore;
    const presente = raggruppate.get(chiave);
    if (presente) { presente.copie += 1; continue; }
    raggruppate.set(chiave, {
      arena_id: arenaId, copie: 1, nome: nomi[chiave], ...(stampe[chiave] || {}),
    });
  }
  return [...raggruppate.values()];
}
