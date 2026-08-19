import { aggregaMeta, catalogoPronto, infoCatalogo } from "./archetipi.js";

export const SOGLIA_META = 30;
export const SOGLIA_SCONTRI = 100;

function percentuale(parte, totale) {
  if (!totale) return null;
  return Math.round((parte * 10000) / totale) / 100;
}

function filtri(indirizzo, extra = []) {
  const formato = (indirizzo.searchParams.get("formato") || "").trim();
  if (!formato || formato.length > 40) {
    return { errore: "formato mancante o non valido" };
  }
  const rank = (indirizzo.searchParams.get("rank") || "").trim();
  if (rank.length > 20) return { errore: "rank non valido" };

  const condizioni = ["formato = ?", ...extra];
  const argomenti = [formato];
  if (rank) {
    condizioni.push("rank_classe = ?");
    argomenti.push(rank);
  }
  return {
    formato,
    rank: rank || null,
    where: "WHERE " + condizioni.join(" AND "),
    argomenti,
  };
}

async function quadro(db, filtro) {
  const riga = await db.prepare(
    `SELECT COUNT(*) AS partite_totali, MAX(ricevuta) AS aggiornato
     FROM partite ${filtro.where}`
  ).bind(...filtro.argomenti).first();
  return {
    partite_totali: Number((riga && riga.partite_totali) || 0),
    aggiornato: (riga && riga.aggiornato) || null,
  };
}

function metaPerImpronta(esito, testa) {
  return (esito.results || []).map((riga) => {
    const partite = Number(riga.partite || 0);
    const vittorie = Number(riga.vittorie || 0);
    const sufficienti = partite >= SOGLIA_META;
    return {
      nome: null,
      archetipo: null,
      archetipo_id: null,
      strategia: null,
      colori: [],
      modalita: null,
      classificazione: null,
      livelli_classificazione: [],
      impronta: riga.impronta,
      impronte_raggruppate: 1,
      varianti_rilevate: 1,
      partite,
      vittorie,
      sconfitte: partite - vittorie,
      dati_sufficienti: sufficienti,
      win_rate: sufficienti ? percentuale(vittorie, partite) : null,
      quota_meta: sufficienti ? percentuale(partite, testa.partite_totali) : null,
    };
  });
}

export async function leggiMeta(db, indirizzo) {
  const filtro = filtri(indirizzo, ["impronta_mazzo IS NOT NULL"]);
  if (filtro.errore) return { errore: filtro.errore, stato: 400 };

  const testa = await quadro(db, filtro);
  const esito = await db.prepare(
    `SELECT impronta_mazzo AS impronta,
            COUNT(*) AS partite,
            SUM(CASE WHEN esito = 'vinta' THEN 1 ELSE 0 END) AS vittorie
     FROM partite ${filtro.where}
     GROUP BY impronta_mazzo
     ORDER BY partite DESC, impronta_mazzo ASC`
  ).bind(...filtro.argomenti).all();

  let mazzi = metaPerImpronta(esito, testa);
  const catalogo = infoCatalogo(filtro.formato);

  if (catalogoPronto(filtro.formato) && (esito.results || []).length) {
    // Una sola lettura per tutte le impronte del filtro. Il motore distingue:
    // - archetipo: nucleo di carte caratteristiche;
    // - variante: lista quasi identica al riferimento.
    // L'avversario resta fuori: non deduciamo l'archetipo dalle sole carte viste.
    const carte = await db.prepare(
      `SELECT p.impronta_mazzo AS impronta,
              cm.carta AS carta,
              MAX(cm.copie) AS copie
       FROM partite p
       JOIN carte_mazzo cm ON cm.partita = p.id
       ${filtro.where}
       GROUP BY p.impronta_mazzo, cm.carta`
    ).bind(...filtro.argomenti).all();
    mazzi = aggregaMeta(
      esito.results || [], carte.results || [], testa.partite_totali,
      SOGLIA_META, filtro.formato
    );
  }

  return {
    stato: 200,
    corpo: {
      ...testa,
      filtri: { formato: filtro.formato, rank: filtro.rank },
      soglia_percentuali: SOGLIA_META,
      raggruppamento: catalogo.disponibile
        ? "archetipo_con_fallback_impronta"
        : "impronta_mazzo",
      catalogo_archetipi: catalogo,
      nota: catalogo.disponibile
        ? "Gli archetipi sono riconosciuti da un nucleo di carte caratteristiche; la somiglianza completa al 90% identifica invece una variante quasi uguale al riferimento. I casi ambigui restano identificati soltanto dalla loro impronta."
        : "Il catalogo archetipi server non e' ancora generato: i mazzi restano raggruppati per impronta esatta.",
      mazzi,
    },
  };
}

export async function leggiGiocoRisposta(db, indirizzo) {
  const filtro = filtri(indirizzo);
  if (filtro.errore) return { errore: filtro.errore, stato: 400 };
  const testa = await quadro(db, filtro);

  const filtroNoto = filtri(indirizzo, ["su_gioco IS NOT NULL"]);
  const esito = await db.prepare(
    `SELECT su_gioco,
            COUNT(*) AS partite,
            SUM(CASE WHEN esito = 'vinta' THEN 1 ELSE 0 END) AS vittorie
     FROM partite ${filtroNoto.where}
     GROUP BY su_gioco
     ORDER BY su_gioco DESC`
  ).bind(...filtroNoto.argomenti).all();

  const gruppi = new Map((esito.results || []).map((r) => [Number(r.su_gioco), r]));
  const prepara = (chiave) => {
    const riga = gruppi.get(chiave) || { partite: 0, vittorie: 0 };
    const partite = Number(riga.partite || 0);
    const vittorie = Number(riga.vittorie || 0);
    const sufficienti = partite >= SOGLIA_META;
    return {
      partite,
      vittorie,
      sconfitte: partite - vittorie,
      dati_sufficienti: sufficienti,
      win_rate: sufficienti ? percentuale(vittorie, partite) : null,
    };
  };
  const alGioco = prepara(1);
  const allaRisposta = prepara(0);

  return {
    stato: 200,
    corpo: {
      ...testa,
      partite_con_iniziativa_nota: alGioco.partite + allaRisposta.partite,
      filtri: { formato: filtro.formato, rank: filtro.rank },
      soglia_percentuali: SOGLIA_META,
      al_gioco: alGioco,
      alla_risposta: allaRisposta,
    },
  };
}

export async function leggiScontri(db, indirizzo) {
  const filtro = filtri(indirizzo);
  if (filtro.errore) return { errore: filtro.errore, stato: 400 };
  const testa = await quadro(db, filtro);
  return {
    stato: 200,
    corpo: {
      ...testa,
      filtri: { formato: filtro.formato, rank: filtro.rank },
      soglia_coppia: SOGLIA_SCONTRI,
      disponibile: false,
      scontri: [],
      motivo: "Il database conosce l'impronta del mazzo Mox ma non ancora l'archetipo del mazzo avversario; la matrice non viene dedotta dalle sole carte rivelate.",
    },
  };
}
