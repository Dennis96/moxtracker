import { aggregaMeta, catalogoPronto, infoCatalogo } from "./archetipi.js";

export const SOGLIA_META = 30;
export const SOGLIA_SCONTRI = 100;
export const POLICY_META_SCORE = Object.freeze({
  peso_qualita: 0.7,
  peso_popolarita: 0.3,
  archetipi_minimi: 5,
  partite_per_archetipo: SOGLIA_META,
  finestre_30_giorni: 2,
});

function percentuale(parte, totale) {
  if (!totale) return null;
  return Math.round((parte * 10000) / totale) / 100;
}

// Limite inferiore Wilson al 95%: e' il valore prudente, non il win rate
// osservato. Viene esportato e testato separatamente per poter cambiare la
// politica senza nascondere il metodo dietro un numero opaco.
export function limiteWilson(successi, tentativi) {
  const n = Number(tentativi);
  const k = Number(successi);
  if (!Number.isFinite(n) || !Number.isFinite(k) || n <= 0 || k < 0 || k > n) return null;
  const z = 1.959963984540054;
  const p = k / n;
  const d = 1 + z * z / n;
  const centro = (p + z * z / (2 * n)) / d;
  const raggio = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return Math.max(0, Math.min(1, centro - raggio));
}

export function candidatiMetaScore(mazzi, policy = POLICY_META_SCORE) {
  const validi = (mazzi || []).filter(mazzo => Number(mazzo.partite) >= policy.partite_per_archetipo);
  const logMassimo = Math.max(...validi.map(mazzo => Math.log1p(Number(mazzo.partite))), 0);
  return validi.map(mazzo => {
    const qualita = limiteWilson(mazzo.vittorie, mazzo.partite);
    const popolarita = logMassimo ? Math.log1p(Number(mazzo.partite)) / logMassimo : 0;
    return {
      id: mazzo.archetipo_id || mazzo.impronta || mazzo.nome,
      qualita,
      popolarita,
      indice: qualita === null ? null : policy.peso_qualita * qualita + policy.peso_popolarita * popolarita,
    };
  }).sort((a, b) => Number(b.indice) - Number(a.indice) || String(a.id).localeCompare(String(b.id)));
}

// Le classi che Arena espone. Una partita puo' arrivare senza classe - il
// log a volte porta solo il livello - e in quel caso non appartiene a nessun
// rank: non si indovina, ma si dice quante sono.
const CLASSI_RANK = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Mythic"];

function filtri(indirizzo, extra = []) {
  const formato = (indirizzo.searchParams.get("formato") || "").trim();
  if (!formato || formato.length > 40) {
    return { errore: "formato mancante o non valido" };
  }
  // Il rank si puo' chiedere anche a piu' classi insieme, separate da
  // virgola: «da Gold a Platinum» e' una domanda normale, e prima si poteva
  // fare solo una classe alla volta o nessuna.
  const grezzo = (indirizzo.searchParams.get("rank") || "").trim();
  if (grezzo.length > 80) return { errore: "rank non valido" };
  const classi = grezzo ? grezzo.split(",").map((c) => c.trim()).filter(Boolean) : [];
  if (classi.some((c) => !CLASSI_RANK.includes(c))) {
    return { errore: "rank non valido" };
  }

  const condizioni = ["formato = ?", ...extra];
  const argomenti = [formato];
  const periodo = indirizzo.searchParams.get("periodo") || "30";
  if (!["7", "14", "30", "totale"].includes(periodo)) {
    return { errore: "periodo non valido" };
  }
  if (periodo !== "totale") {
    condizioni.push("COALESCE(quando, ricevuta) >= ?");
    argomenti.push(new Date(Date.now() - Number(periodo) * 86400000).toISOString());
  }
  const modalita = (indirizzo.searchParams.get("modalita") || "").toUpperCase();
  if (modalita && !["BO1", "BO3"].includes(modalita)) {
    return { errore: "modalita non valida" };
  }
  if (modalita === "BO3") condizioni.push("lower(COALESCE(evento, '')) LIKE '%traditional%'");
  if (modalita === "BO1") condizioni.push("lower(COALESCE(evento, '')) NOT LIKE '%traditional%'");
  if (classi.length) {
    condizioni.push(`rank_classe IN (${classi.map(() => "?").join(", ")})`);
    argomenti.push(...classi);
  }
  return {
    formato, periodo, modalita: modalita || null,
    rank: classi.length ? classi.join(",") : null,
    classi,
    where: "WHERE " + condizioni.join(" AND "),
    argomenti,
  };
}

async function quadro(db, filtro) {
  const riga = await db.prepare(
    `SELECT COUNT(*) AS partite_totali, MAX(ricevuta) AS aggiornato
     FROM partite ${filtro.where}`
  ).bind(...filtro.argomenti).first();
  // Con un filtro di rank attivo, un archetipo puo' sparire del tutto senza
  // che si capisca perche': le sue partite potrebbero non avere la classe.
  // Il numero si dice, cosi' il sito puo' spiegarlo invece di far sparire e
  // basta.
  let senzaRank = 0;
  if (filtro.classi && filtro.classi.length) {
    const escluse = await db.prepare(
      `SELECT COUNT(*) AS n FROM partite WHERE formato = ? AND rank_classe IS NULL`
    ).bind(filtro.formato).first();
    senzaRank = Number((escluse && escluse.n) || 0);
  }
  return {
    partite_totali: Number((riga && riga.partite_totali) || 0),
    aggiornato: (riga && riga.aggiornato) || null,
    partite_senza_rank: senzaRank,
  };
}

function metaPerImpronta(esito, testa) {
  return (esito.results || []).map((riga) => {
    const partite = Number(riga.partite || 0);
    const vittorie = Number(riga.vittorie || 0);
    const sufficienti = partite >= SOGLIA_META;
    return {
      nome: "Mazzo non classificato",
      archetipo: "Mazzo non classificato",
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

  // L'impronta serve al collegamento tecnico con il dettaglio, ma non e' un
  // nome da mostrare al visitatore. La classificazione resta del motore: qui
  // cambiamo soltanto il testo pubblico dei casi che il motore non riconosce.
  mazzi = raggruppaBrew(mazzi.map((mazzo) => mazzettoPubblico(mazzo)),
    testa.partite_totali, SOGLIA_META);

  // Il motore e' pronto, ma la risposta pubblica non espone ancora gli indici:
  // il campione reale non soddisfa le due finestre indipendenti richieste.
  // Tenere il contratto esplicito evita che un frontend futuro mostri per
  // errore una graduatoria sperimentale come se fosse una percentuale.
  const candidati = candidatiMetaScore(mazzi);
  const prontoOra = candidati.length >= POLICY_META_SCORE.archetipi_minimi &&
    filtro.periodo === "30";

  return {
    stato: 200,
    corpo: {
      ...testa,
      filtri: { formato: filtro.formato, rank: filtro.rank,
        periodo: filtro.periodo, modalita: filtro.modalita },
      soglia_percentuali: SOGLIA_META,
      raggruppamento: catalogo.disponibile
        ? "archetipo_con_fallback_impronta"
        : "impronta_mazzo",
      catalogo_archetipi: catalogo,
      meta_score: {
        disponibile: false,
        pronto_nella_finestra_corrente: prontoOra,
        richiede_finestre_30_giorni: POLICY_META_SCORE.finestre_30_giorni,
        policy: { peso_qualita: POLICY_META_SCORE.peso_qualita,
          peso_popolarita: POLICY_META_SCORE.peso_popolarita,
          archetipi_minimi: POLICY_META_SCORE.archetipi_minimi,
          partite_per_archetipo: POLICY_META_SCORE.partite_per_archetipo },
        motivo: "L'indice resta in validazione finché cinque archetipi sopra soglia non sono stabili in due finestre mobili di 30 giorni.",
      },
      nota: catalogo.disponibile
        ? "Gli archetipi sono riconosciuti da un nucleo di carte caratteristiche; la somiglianza completa al 90% identifica invece una variante quasi uguale al riferimento. I casi ambigui restano identificati soltanto dalla loro impronta."
        : "Il catalogo archetipi server non e' ancora generato: i mazzi restano raggruppati per impronta esatta.",
      mazzi,
    },
  };
}

function mazzettoPubblico(mazzo) {
  if (mazzo.archetipo_id) return mazzo;
  return {
    ...mazzo,
    nome: "Mazzo non classificato",
    archetipo: "Mazzo non classificato",
  };
}

function raggruppaBrew(mazzi, totale, soglia) {
  const riconosciuti = mazzi.filter((mazzo) => mazzo.archetipo_id);
  const brew = mazzi.filter((mazzo) => !mazzo.archetipo_id);
  if (!brew.length) return riconosciuti;
  const partite = brew.reduce((somma, mazzo) => somma + Number(mazzo.partite || 0), 0);
  const vittorie = brew.reduce((somma, mazzo) => somma + Number(mazzo.vittorie || 0), 0);
  const sufficienti = partite >= soglia;
  riconosciuti.push({
    nome: "Altro (Brew)", archetipo: "Altro (Brew)", archetipo_id: null,
    tipo_dettaglio: "altro", strategia: null, colori: [], modalita: null,
    classificazione: null, livelli_classificazione: [], impronta: null,
    impronte_raggruppate: brew.reduce((somma, mazzo) =>
      somma + Number(mazzo.impronte_raggruppate || 1), 0),
    varianti_rilevate: brew.reduce((somma, mazzo) =>
      somma + Number(mazzo.varianti_rilevate || 1), 0),
    partite, vittorie, sconfitte: partite - vittorie,
    dati_sufficienti: sufficienti,
    win_rate: sufficienti ? percentuale(vittorie, partite) : null,
    quota_meta: sufficienti ? percentuale(partite, totale) : null,
  });
  return riconosciuti.sort((a, b) => b.partite - a.partite ||
    String(a.nome).localeCompare(String(b.nome)));
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
      filtri: { formato: filtro.formato, rank: filtro.rank,
        periodo: filtro.periodo, modalita: filtro.modalita },
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
      filtri: { formato: filtro.formato, rank: filtro.rank,
        periodo: filtro.periodo, modalita: filtro.modalita },
      soglia_coppia: SOGLIA_SCONTRI,
      disponibile: false,
      scontri: [],
      motivo: "Il database conosce l'impronta del mazzo Mox ma non ancora l'archetipo del mazzo avversario; la matrice non viene dedotta dalle sole carte rivelate.",
    },
  };
}
