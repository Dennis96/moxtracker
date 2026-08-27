import { CATALOGO_ARCHETIPI } from "./catalogo-archetipi-generato.js";
import { catalogoPronto, classificaImpronte } from "./archetipi.js";
import { decklistPubblicabile } from "./privacy-pubblica.js";

const SOGLIA_PERCENTUALI = 30;
const IMPRONTA = /^[0-9a-f]{64}$/i;
const CLASSI_RANK = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Mythic"];

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
  const impronta = (indirizzo.searchParams.get("impronta") || "").trim();
  const rank = (indirizzo.searchParams.get("rank") || "").trim();
  const classi = rank ? rank.split(",").map((voce) => voce.trim()).filter(Boolean) : [];
  const periodo = indirizzo.searchParams.get("periodo") || "30";
  const modalita = (indirizzo.searchParams.get("modalita") || "").toUpperCase();
  if (!formato || formato.length > 40) return { errore: "formato mancante o non valido" };
  if (rank.length > 80 || classi.some((voce) => !CLASSI_RANK.includes(voce))) {
    return { errore: "rank non valido" };
  }
  if (!["7", "14", "30", "totale"].includes(periodo)) return { errore: "periodo non valido" };
  if (modalita && !["BO1", "BO3"].includes(modalita)) return { errore: "modalita non valida" };
  if (id && impronta) return { errore: "specifica id oppure impronta, non entrambi" };
  if (id) {
    if (id.length > 100 || !/^[a-z0-9-]+$/i.test(id)) {
      return { errore: "id archetipo non valido" };
    }
    return { formato, id, impronta: null, rank: rank || null, classi, periodo,
      modalita: modalita || null, tipo: "riconosciuto" };
  }
  if (impronta) {
    if (!IMPRONTA.test(impronta)) return { errore: "impronta non valida" };
    return { formato, id: null, impronta: impronta.toLowerCase(), rank: rank || null,
      classi, periodo, modalita: modalita || null, tipo: "non_classificato" };
  }
  return { errore: "id archetipo o impronta mancanti" };
}

function riferimenti(archetipoId) {
  return (CATALOGO_ARCHETIPI.liste || [])
    .filter(lista => lista.archetipo_id === archetipoId)
    .map(lista => ({
      origine: "catalogo_reference",
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

function dove(p) {
  const condizioni = ["formato = ?", "impronta_mazzo IS NOT NULL"];
  const argomenti = [p.formato];
  if (p.classi?.length) {
    condizioni.push(`rank_classe IN (${p.classi.map(() => "?").join(", ")})`);
    argomenti.push(...p.classi);
  }
  if (p.periodo !== "totale") {
    condizioni.push("COALESCE(quando, ricevuta) >= ?");
    argomenti.push(new Date(Date.now() - Number(p.periodo) * 86400000).toISOString());
  }
  if (p.modalita === "BO3") condizioni.push("lower(COALESCE(evento, '')) LIKE '%traditional%'");
  if (p.modalita === "BO1") condizioni.push("lower(COALESCE(evento, '')) NOT LIKE '%traditional%'");
  if (p.impronta) {
    condizioni.push("impronta_mazzo = ?");
    argomenti.push(p.impronta);
  }
  return { where: `WHERE ${condizioni.join(" AND ")}`, argomenti };
}

function cartePerImpronta(righe) {
  const fuori = new Map();
  for (const riga of righe) {
    const impronta = String(riga.impronta || "");
    if (!fuori.has(impronta)) fuori.set(impronta, []);
    fuori.get(impronta).push(cartaPubblica(riga));
  }
  return fuori;
}

function variante(riga, classificazione, carte, totaleMeta) {
  const impronta = String(riga.impronta || "");
  const partite = numero(riga.partite);
  const vittorie = numero(riga.vittorie);
  const pubblicabile = decklistPubblicabile(partite);
  const sufficienti = partite >= SOGLIA_PERCENTUALI;
  const fuori = {
    origine: "osservazione_mox",
    variante_id: impronta.slice(0, 12),
    impronta,
    livello_classificazione: classificazione?.livello_classificazione || "non_classificato",
    partite,
    vittorie,
    sconfitte: partite - vittorie,
    dati_sufficienti: sufficienti,
    win_rate: sufficienti ? percentuale(vittorie, partite) : null,
    quota_meta: sufficienti ? percentuale(partite, totaleMeta) : null,
    decklist_pubblicabile: pubblicabile,
  };
  if (pubblicabile) {
    fuori.lista_riferimento_id = classificazione?.lista_id || null;
    fuori.lista_riferimento_nome = classificazione?.lista_nome || null;
    fuori.carte = (carte.get(impronta) || []).sort((a, b) =>
      String(a.nome || a.arena_id).localeCompare(String(b.nome || b.arena_id)));
  }
  return fuori;
}

export async function leggiArchetipo(db, indirizzo) {
  const p = parametri(indirizzo);
  if (p.errore) return { errore: p.errore, stato: 400 };
  if (!catalogoPronto(p.formato)) {
    return { errore: "catalogo archetipi non disponibile per questo formato", stato: 409 };
  }

  const filtro = dove(p);
  const filtroMeta = dove({ ...p, impronta: null });
  const totaleRiga = await db.prepare(
    `SELECT COUNT(*) AS totale FROM partite ${filtroMeta.where}`
  ).bind(...filtroMeta.argomenti).first();
  const totaleMeta = numero(totaleRiga?.totale);
  const esito = await db.prepare(
    `SELECT impronta_mazzo AS impronta,
            COUNT(*) AS partite,
            SUM(CASE WHEN esito = 'vinta' THEN 1 ELSE 0 END) AS vittorie
     FROM partite ${filtro.where}
     GROUP BY impronta_mazzo
     ORDER BY partite DESC, impronta_mazzo ASC`
  ).bind(...filtro.argomenti).all();
  const carteEsito = await db.prepare(
    `SELECT p.impronta_mazzo AS impronta,
            cm.carta AS carta,
            MAX(cm.copie) AS copie
     FROM partite p
     JOIN carte_mazzo cm ON cm.partita = p.id
     ${filtro.where}
     GROUP BY p.impronta_mazzo, cm.carta
     ORDER BY p.impronta_mazzo ASC, cm.carta ASC`
  ).bind(...filtro.argomenti).all();
  const classificazioni = classificaImpronte(carteEsito.results || [], p.formato);
  const tutte = esito.results || [];
  const righe = p.tipo === "riconosciuto"
    ? tutte.filter(riga => classificazioni.get(String(riga.impronta || ""))?.archetipo_id === p.id)
    : tutte;
  if (!righe.length) return { errore: "archetipo non presente nei dati del filtro corrente", stato: 404 };

  const carte = cartePerImpronta(carteEsito.results || []);
  let partite = 0;
  let vittorie = 0;
  const livelli = new Set();
  const variantiOsservate = righe.map((riga) => {
    const classificazione = classificazioni.get(String(riga.impronta || ""));
    if (classificazione?.livello_classificazione) livelli.add(classificazione.livello_classificazione);
    partite += numero(riga.partite);
    vittorie += numero(riga.vittorie);
    return variante(riga, classificazione, carte, totaleMeta);
  }).sort((a, b) => b.partite - a.partite || a.impronta.localeCompare(b.impronta));

  const prima = classificazioni.get(String(righe[0].impronta || ""));
  const sufficienti = partite >= SOGLIA_PERCENTUALI;
  const riconosciuto = p.tipo === "riconosciuto";
  const varianti = riconosciuto
    ? variantiOsservate.filter((voce) => voce.decklist_pubblicabile)
    : variantiOsservate;
  const piccole = riconosciuto
    ? variantiOsservate.filter((voce) => !voce.decklist_pubblicabile)
    : [];
  const altreVarianti = piccole.length ? {
    varianti: piccole.length,
    partite: piccole.reduce((somma, voce) => somma + voce.partite, 0),
  } : null;
  const ref = riconosciuto ? riferimenti(p.id) : [];
  const nome = riconosciuto
    ? prima?.nome_pubblico || prima?.archetipo || ref[0]?.nome_pubblico || p.id
    : "Mazzo non classificato";

  return {
    stato: 200,
    corpo: {
      tipo_dettaglio: p.tipo,
      archetipo_id: riconosciuto ? p.id : null,
      nome,
      archetipo: nome,
      archetipo_catalogo: riconosciuto ? (prima?.archetipo_catalogo || null) : null,
      strategia: riconosciuto ? (prima?.strategia || null) : null,
      colori: riconosciuto ? (prima?.colori || []) : [],
      filtri: { formato: p.formato, rank: p.rank, periodo: p.periodo,
        modalita: p.modalita },
      soglia_percentuali: SOGLIA_PERCENTUALI,
      partite,
      vittorie,
      sconfitte: partite - vittorie,
      dati_sufficienti: sufficienti,
      win_rate: sufficienti ? percentuale(vittorie, partite) : null,
      quota_meta: sufficienti ? percentuale(partite, totaleMeta) : null,
      varianti_osservate: variantiOsservate.length,
      livelli_classificazione: [...livelli].sort(),
      varianti,
      altre_varianti: altreVarianti,
      liste_riferimento: ref,
      nota_varianti: "Le varianti osservate provengono dai contributi MOXTRACKER e rispettano le soglie di pubblicazione. Le liste di riferimento provengono separatamente dal catalogo mox-meta.",
    },
  };
}
