import { CATALOGO_ARCHETIPI } from "./catalogo-archetipi-generato.js";
import { catalogoPronto, classificaImpronte } from "./archetipi.js";

const SOGLIA_PERCENTUALI = 30;

function numero(valore) {
  const n = Number(valore);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function percentuale(parte, totale) {
  if (!totale) return null;
  return Math.round((parte * 10000) / totale) / 100;
}

function parametri(indirizzo) {
  const formato = (indirizzo.searchParams.get("formato") || "").trim();
  const id = (indirizzo.searchParams.get("id") || "").trim();
  const rank = (indirizzo.searchParams.get("rank") || "").trim();
  if (!formato || formato.length > 40) return { errore: "formato mancante o non valido" };
  if (!id || id.length > 100 || !/^[a-z0-9-]+$/i.test(id)) {
    return { errore: "id archetipo mancante o non valido" };
  }
  if (rank.length > 20) return { errore: "rank non valido" };
  return { formato, id, rank: rank || null };
}

function riferimenti(archetipoId) {
  return (CATALOGO_ARCHETIPI.liste || [])
    .filter(lista => lista.archetipo_id === archetipoId)
    .map(lista => ({
      id: lista.id || null,
      nome: lista.nome || null,
      nome_pubblico: lista.nome_pubblico || lista.archetipo || lista.nome || archetipoId,
      modalita: lista.modalita || null,
      fonte: lista.fonte || null,
      data: lista.data || null,
      lista: Array.isArray(lista.lista_riferimento) ? lista.lista_riferimento : [],
      sideboard: Array.isArray(lista.sideboard_riferimento) ? lista.sideboard_riferimento : [],
    }));
}

function cartaPubblica(riga) {
  const id = String(riga?.carta ?? "");
  return {
    arena_id: Number(id),
    copie: numero(riga?.copie),
    nome: CATALOGO_ARCHETIPI.id_a_nome?.[id] || null,
  };
}

export async function leggiArchetipo(db, indirizzo) {
  const p = parametri(indirizzo);
  if (p.errore) return { errore: p.errore, stato: 400 };
  if (!catalogoPronto(p.formato)) {
    return { errore: "catalogo archetipi non disponibile per questo formato", stato: 409 };
  }

  const condizioni = ["formato = ?", "impronta_mazzo IS NOT NULL"];
  const argomenti = [p.formato];
  if (p.rank) {
    condizioni.push("rank_classe = ?");
    argomenti.push(p.rank);
  }
  const where = `WHERE ${condizioni.join(" AND ")}`;

  const totaleRiga = await db.prepare(
    `SELECT COUNT(*) AS totale FROM partite ${where}`
  ).bind(...argomenti).first();
  const totaleMeta = numero(totaleRiga?.totale);

  const esito = await db.prepare(
    `SELECT impronta_mazzo AS impronta,
            COUNT(*) AS partite,
            SUM(CASE WHEN esito = 'vinta' THEN 1 ELSE 0 END) AS vittorie
     FROM partite ${where}
     GROUP BY impronta_mazzo
     ORDER BY partite DESC, impronta_mazzo ASC`
  ).bind(...argomenti).all();

  const carte = await db.prepare(
    `SELECT p.impronta_mazzo AS impronta,
            cm.carta AS carta,
            MAX(cm.copie) AS copie
     FROM partite p
     JOIN carte_mazzo cm ON cm.partita = p.id
     ${where}
     GROUP BY p.impronta_mazzo, cm.carta
     ORDER BY p.impronta_mazzo ASC, cm.carta ASC`
  ).bind(...argomenti).all();

  const classificazioni = classificaImpronte(carte.results || [], p.formato);
  const righe = (esito.results || []).filter(riga =>
    classificazioni.get(String(riga.impronta || ""))?.archetipo_id === p.id
  );
  if (!righe.length) return { errore: "archetipo non presente nei dati del filtro corrente", stato: 404 };

  const cartePerImpronta = new Map();
  for (const riga of carte.results || []) {
    const impronta = String(riga.impronta || "");
    if (!cartePerImpronta.has(impronta)) cartePerImpronta.set(impronta, []);
    cartePerImpronta.get(impronta).push(cartaPubblica(riga));
  }

  let partite = 0;
  let vittorie = 0;
  const livelli = new Set();
  const varianti = righe.map(riga => {
    const impronta = String(riga.impronta || "");
    const classificazione = classificazioni.get(impronta);
    const quante = numero(riga.partite);
    const vinte = numero(riga.vittorie);
    partite += quante;
    vittorie += vinte;
    if (classificazione?.livello_classificazione) livelli.add(classificazione.livello_classificazione);
    return {
      variante_id: impronta.slice(0, 12),
      impronta,
      livello_classificazione: classificazione?.livello_classificazione || "archetipo",
      lista_riferimento_id: classificazione?.lista_id || null,
      lista_riferimento_nome: classificazione?.lista_nome || null,
      partite: quante,
      vittorie: vinte,
      sconfitte: quante - vinte,
      dati_sufficienti: quante >= SOGLIA_PERCENTUALI,
      win_rate: quante >= SOGLIA_PERCENTUALI ? percentuale(vinte, quante) : null,
      carte: (cartePerImpronta.get(impronta) || []).sort((a, b) =>
        String(a.nome || a.arena_id).localeCompare(String(b.nome || b.arena_id))
      ),
    };
  });

  varianti.sort((a, b) => b.partite - a.partite || a.impronta.localeCompare(b.impronta));
  const prima = classificazioni.get(String(righe[0].impronta || ""));
  const sufficienti = partite >= SOGLIA_PERCENTUALI;
  const ref = riferimenti(p.id);

  return {
    stato: 200,
    corpo: {
      archetipo_id: p.id,
      nome: prima?.nome_pubblico || prima?.archetipo || ref[0]?.nome_pubblico || p.id,
      archetipo: prima?.nome_pubblico || prima?.archetipo || ref[0]?.nome_pubblico || p.id,
      archetipo_catalogo: prima?.archetipo_catalogo || null,
      strategia: prima?.strategia || null,
      colori: prima?.colori || [],
      filtri: { formato: p.formato, rank: p.rank },
      soglia_percentuali: SOGLIA_PERCENTUALI,
      partite,
      vittorie,
      sconfitte: partite - vittorie,
      dati_sufficienti: sufficienti,
      win_rate: sufficienti ? percentuale(vittorie, partite) : null,
      quota_meta: sufficienti ? percentuale(partite, totaleMeta) : null,
      varianti_osservate: varianti.length,
      livelli_classificazione: [...livelli].sort(),
      varianti,
      liste_riferimento: ref,
      nota_varianti: "Una variante osservata e' una diversa impronta di decklist raccolta da MOXTRACKER. Non equivale automaticamente a una lista ufficiale del catalogo mox-meta.",
    },
  };
}
