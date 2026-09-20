import { aggregaMeta, catalogoPronto, infoCatalogo } from "./archetipi.js";
import { ALGORITMO_BREW, SOGLIA_DISTANZA_BREW } from "./brew-clustering.js";
import { leggiMembriPubblicabili, leggiNomiPubblici } from "./brew-gruppi.js";

export const SOGLIA_META = 30;
export const SOGLIA_SCONTRI = 100;

function percentuale(parte, totale) {
  if (!totale) return null;
  return Math.round((parte * 10000) / totale) / 100;
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

  // I gruppi Brew si leggono, non si calcolano: la GET non scrive mai. Servono
  // solo se nel filtro c'e' almeno un Brew.
  const membri = mazzi.some((mazzo) => !mazzo.archetipo_id)
    ? await leggiMembriPubblicabili(db, filtro, SOGLIA_META)
    : null;
  // I nomi pubblici dei gruppi, quando qualcuno gliene ha dato uno: etichette
  // editoriali, additive, che non toccano ne' i gruppi ne' i numeri.
  const nomi = membri instanceof Map ? await leggiNomiPubblici(db, filtro.formato) : null;

  // L'impronta serve al collegamento tecnico con il dettaglio, ma non e' un
  // nome da mostrare al visitatore. La classificazione resta del motore: qui
  // cambiamo soltanto il testo pubblico dei casi che il motore non riconosce.
  mazzi = raggruppaBrew(mazzi.map((mazzo) => mazzettoPubblico(mazzo)),
    testa.partite_totali, SOGLIA_META, membri, nomi);

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

function confrontaTesto(a, b) {
  const x = String(a ?? "");
  const y = String(b ?? "");
  return x < y ? -1 : x > y ? 1 : 0;
}

// Una lista di Altro: la soglia si riapplica qui, cosi' un win rate sotto 30
// partite non esce nemmeno se arrivasse dal motore.
function varianteBrew(mazzo, indice, totale, soglia) {
  const partite = Number(mazzo.partite || 0);
  const vittorie = Number(mazzo.vittorie || 0);
  const sufficienti = partite >= soglia;
  return {
    etichetta: `Brew #${indice + 1}`,
    impronta: mazzo.impronta || null,
    partite, vittorie, sconfitte: partite - vittorie,
    dati_sufficienti: sufficienti,
    win_rate: sufficienti ? percentuale(vittorie, partite) : null,
    quota_meta: sufficienti ? percentuale(partite, totale) : null,
  };
}

// Brew v2 (S1): i gruppi di liste quasi uguali, in parallelo ai campi di
// sempre, che restano identici finche' il sito non passa ai gruppi (S2).
//
// Entrano soltanto le liste che nel filtro arrivano alla soglia, cioe' le
// stesse di `varianti_brew`: partite e record di un gruppo sono la somma delle
// sue varianti pubbliche, quindi non dicono niente che le varianti non dicano
// gia'. Le liste sotto soglia restano nel solo conteggio globale
// `brew_sotto_soglia`, mai attribuite a un gruppo. La distanza dal
// rappresentante esce solo quando anche il rappresentante e' pubblico nella
// stessa risposta. Una lista pubblica non ancora assegnata (il cron non e'
// passato) resta un gruppo a se', senza identificativi.
function gruppiBrew(ordinate, membri, totale, soglia, nomi) {
  const gruppi = new Map();
  for (const mazzo of ordinate) {
    const partite = Number(mazzo.partite || 0);
    if (partite < soglia) continue;
    const vittorie = Number(mazzo.vittorie || 0);
    const membro = membri?.get(mazzo.impronta) || null;
    const chiave = membro ? membro.gruppo_id : `attesa:${mazzo.impronta}`;
    if (!gruppi.has(chiave)) {
      gruppi.set(chiave, {
        id: membro?.gruppo_id || null,
        soglia_distanza: membro ? membro.soglia_distanza : SOGLIA_DISTANZA_BREW,
        varianti: [],
      });
    }
    gruppi.get(chiave).varianti.push({
      variante_id: membro?.variante_id || null,
      impronta: mazzo.impronta || null,
      partite, vittorie, sconfitte: partite - vittorie,
      dati_sufficienti: true,
      win_rate: percentuale(vittorie, partite),
      quota_meta: percentuale(partite, totale),
      decklist_pubblicabile: true,
      rappresentante: Boolean(membro) && membro.rappresentante === mazzo.impronta,
      distanza: membro ? membro.distanza : null,
    });
  }
  const fuori = [...gruppi.values()].map((gruppo) => {
    const conCentro = gruppo.varianti.some((variante) => variante.rappresentante);
    const varianti = gruppo.varianti.map(({ distanza, ...variante }) => ({
      ...variante, distanza_rappresentante: conCentro ? distanza : null,
    }));
    const partite = varianti.reduce((somma, variante) => somma + variante.partite, 0);
    const vittorie = varianti.reduce((somma, variante) => somma + variante.vittorie, 0);
    return {
      tipo_dettaglio: "brew_group",
      gruppo_brew_id: gruppo.id,
      // Additivo: quando manca resta `null` e il sito usa il suo fallback.
      nome_pubblico: (gruppo.id && nomi?.get(gruppo.id)) || null,
      in_attesa_di_raggruppamento: gruppo.id === null,
      algoritmo: ALGORITMO_BREW,
      soglia_distanza: gruppo.soglia_distanza,
      partite, vittorie, sconfitte: partite - vittorie,
      record_pubblico: true,
      dati_sufficienti: partite >= soglia,
      win_rate: percentuale(vittorie, partite),
      quota_meta: percentuale(partite, totale),
      varianti_brew: varianti,
    };
  });
  return fuori.sort((a, b) => b.partite - a.partite || b.vittorie - a.vittorie ||
    confrontaTesto(a.gruppo_brew_id || a.varianti_brew[0].impronta,
      b.gruppo_brew_id || b.varianti_brew[0].impronta))
    .map((gruppo, indice) => ({ etichetta: `Brew #${indice + 1}`, ...gruppo }));
}

export function raggruppaBrew(mazzi, totale, soglia, membri = null, nomi = null) {
  const riconosciuti = mazzi.filter((mazzo) => mazzo.archetipo_id);
  const brew = mazzi.filter((mazzo) => !mazzo.archetipo_id);
  if (!brew.length) return riconosciuti;
  const partite = brew.reduce((somma, mazzo) => somma + Number(mazzo.partite || 0), 0);
  const vittorie = brew.reduce((somma, mazzo) => somma + Number(mazzo.vittorie || 0), 0);
  const sufficienti = partite >= soglia;
  // Ordine fisso (partite, vittorie, impronta) che non dipende da D1. Una per
  // una, con nome neutro e impronta per il dettaglio, solo le liste arrivate
  // alla soglia; le altre restano un conteggio senza impronta ne' V/S, perche'
  // una lista giocata poche volte puo' essere di una sola persona.
  const ordinate = [...brew].sort((a, b) => Number(b.partite || 0) - Number(a.partite || 0) ||
    Number(b.vittorie || 0) - Number(a.vittorie || 0) ||
    confrontaTesto(a.impronta, b.impronta));
  const sottoSoglia = ordinate.filter((mazzo) => Number(mazzo.partite || 0) < soglia);
  const variantiBrew = ordinate.filter((mazzo) => Number(mazzo.partite || 0) >= soglia)
    .map((mazzo, indice) => varianteBrew(mazzo, indice, totale, soglia));
  // Finche' c'e' una lista sotto soglia il record del gruppo non esce:
  // sottraendo i Brew pubblici si ricaverebbe quello delle liste sotto soglia
  // (esatto, se ne resta una). Partite e quota restano: non rivelano nulla.
  const recordPubblico = sottoSoglia.length === 0;
  riconosciuti.push({
    nome: "Altro (Brew)", archetipo: "Altro (Brew)", archetipo_id: null,
    tipo_dettaglio: "altro", strategia: null, colori: [], modalita: null,
    classificazione: null, livelli_classificazione: [], impronta: null,
    impronte_raggruppate: brew.reduce((somma, mazzo) =>
      somma + Number(mazzo.impronte_raggruppate || 1), 0),
    varianti_rilevate: brew.reduce((somma, mazzo) =>
      somma + Number(mazzo.varianti_rilevate || 1), 0),
    partite,
    ...(recordPubblico ? { vittorie, sconfitte: partite - vittorie } : {}),
    record_pubblico: recordPubblico,
    dati_sufficienti: sufficienti,
    win_rate: recordPubblico && sufficienti ? percentuale(vittorie, partite) : null,
    quota_meta: sufficienti ? percentuale(partite, totale) : null,
    varianti_brew: variantiBrew,
    brew_sotto_soglia: {
      liste: sottoSoglia.length,
      partite: sottoSoglia.reduce((somma, mazzo) => somma + Number(mazzo.partite || 0), 0),
    },
    gruppi_brew: gruppiBrew(ordinate, membri, totale, soglia, nomi),
    raggruppamento_brew: {
      algoritmo: ALGORITMO_BREW,
      soglia_distanza: SOGLIA_DISTANZA_BREW,
      disponibile: membri instanceof Map,
    },
  });
  return riconosciuti.sort((a, b) => b.partite - a.partite ||
    String(a.nome).localeCompare(String(b.nome)));
}

export async function leggiGiocoRisposta(db, indirizzo) {
  const filtro = filtri(indirizzo);
  if (filtro.errore) return { errore: filtro.errore, stato: 400 };
  const testa = await quadro(db, filtro);

  const filtroNoto = filtri(indirizzo, ["su_gioco IS NOT NULL"]);
  // Solo quante partite al gioco e alla risposta. Vittorie e win rate globali
  // permetterebbero di ricavare per sottrazione, togliendo le righe pubbliche
  // del Meta, il record delle liste Brew sotto soglia. Il sito non li usa.
  const esito = await db.prepare(
    `SELECT su_gioco, COUNT(*) AS partite
     FROM partite ${filtroNoto.where}
     GROUP BY su_gioco
     ORDER BY su_gioco DESC`
  ).bind(...filtroNoto.argomenti).all();

  const gruppi = new Map((esito.results || []).map((r) => [Number(r.su_gioco), r]));
  const prepara = (chiave) => {
    const partite = Number(gruppi.get(chiave)?.partite || 0);
    return { partite, dati_sufficienti: partite >= SOGLIA_META };
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
