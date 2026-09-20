import { CATALOGO_ARCHETIPI } from "./catalogo-archetipi-generato.js";
import { catalogoPronto, classificaImpronte } from "./archetipi.js";
import { decklistPubblicabile } from "./privacy-pubblica.js";
import { ALGORITMO_BREW } from "./brew-clustering.js";
import { leggiGruppo, leggiMembro } from "./brew-gruppi.js";

const SOGLIA_PERCENTUALI = 30;
const IMPRONTA = /^[0-9a-f]{64}$/i;
const ID_BREW = /^bg_[0-9a-f]{32}$/;
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
  const idBrew = (indirizzo.searchParams.get("id_brew") || "").trim().toLowerCase();
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
  if (idBrew && (id || impronta)) return { errore: "specifica id_brew da solo, senza id o impronta" };
  if (idBrew) {
    if (!ID_BREW.test(idBrew)) return { errore: "id_brew non valido" };
    return { formato, id: null, impronta: null, gruppo: idBrew, rank: rank || null, classi,
      periodo, modalita: modalita || null, tipo: "brew_group" };
  }
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
  if (p.gruppo) {
    condizioni.push(`impronta_mazzo IN (SELECT impronta FROM brew_membro
      WHERE gruppo_id = ? AND formato = ? AND algoritmo = ?)`);
    argomenti.push(p.gruppo, p.formato, ALGORITMO_BREW);
  }
  return { where: `WHERE ${condizioni.join(" AND ")}`, argomenti };
}

// Le tre letture comuni a ogni dettaglio, sempre dalle partite del filtro:
// totale del Meta, partite per impronta, carte per impronta.
async function leggiRighe(db, p) {
  const filtro = dove(p);
  const filtroMeta = dove({ ...p, impronta: null, gruppo: null });
  const totaleRiga = await db.prepare(
    `SELECT COUNT(*) AS totale FROM partite ${filtroMeta.where}`
  ).bind(...filtroMeta.argomenti).first();
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
  return {
    totaleMeta: numero(totaleRiga?.totale),
    tutte: esito.results || [],
    righeCarte: carteEsito.results || [],
  };
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

// Una sola risposta per «non c'e'»: vale sia per l'impronta mai vista sia per
// la lista non classificata sotto soglia, cosi' le due non si distinguono.
function nonTrovato() {
  return { errore: "archetipo non presente nei dati del filtro corrente", stato: 404 };
}

export async function leggiArchetipo(db, indirizzo) {
  const p = parametri(indirizzo);
  if (p.errore) return { errore: p.errore, stato: 400 };
  if (!catalogoPronto(p.formato)) {
    return { errore: "catalogo archetipi non disponibile per questo formato", stato: 409 };
  }

  if (p.tipo === "brew_group") return leggiGruppoBrew(db, p);

  const { totaleMeta, tutte, righeCarte } = await leggiRighe(db, p);
  const classificazioni = classificaImpronte(righeCarte, p.formato);
  const righe = p.tipo === "riconosciuto"
    ? tutte.filter(riga => classificazioni.get(String(riga.impronta || ""))?.archetipo_id === p.id)
    : tutte;
  if (!righe.length) return nonTrovato();
  // Un mazzo non classificato sotto soglia non si conferma nemmeno: la
  // risposta e' identica a quella di un'impronta mai vista, senza V/S,
  // decklist o impronta. Il Meta lo mostra solo dentro «N liste sotto soglia».
  if (p.tipo === "non_classificato" &&
      !decklistPubblicabile(righe.reduce((somma, riga) => somma + numero(riga.partite), 0))) {
    return nonTrovato();
  }

  const carte = cartePerImpronta(righeCarte);
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

  const corpo = {
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
  };
  // Il vecchio collegamento per impronta resta valido (S1) e dice a quale
  // gruppo Brew appartiene la lista, cosi' il sito potra' passare a `id_brew`
  // senza redirect lato API. Si arriva qui solo se la lista e' pubblicabile.
  if (!riconosciuto) {
    const membro = classificazioni.has(p.impronta) ? null
      : await leggiMembro(db, p.formato, p.impronta);
    corpo.gruppo_brew_id = membro?.gruppo_id ?? null;
    corpo.variante_brew_id = membro?.variante_id ?? null;
  }
  return { stato: 200, corpo };
}

// Il dettaglio di un gruppo Brew. Come in /meta, ne fanno parte solo le
// liste ancora non classificate che nel filtro arrivano alla soglia: un
// gruppo che non ne ha nessuna risponde come un id mai esistito, e le liste
// sotto soglia non vengono ne' contate ne' nominate.
async function leggiGruppoBrew(db, p) {
  const gruppo = await leggiGruppo(db, p.gruppo, p.formato);
  if (!gruppo) return nonTrovato();
  const { totaleMeta, tutte, righeCarte } = await leggiRighe(db, p);
  const classificazioni = classificaImpronte(righeCarte, p.formato);
  // Una lista che un catalogo nuovo riconosce esce dal gruppo senza che la
  // sua appartenenza venga riscritta.
  const pubbliche = tutte.filter((riga) => {
    const impronta = String(riga.impronta || "");
    return gruppo.membri.has(impronta) && !classificazioni.has(impronta) &&
      decklistPubblicabile(numero(riga.partite));
  });
  if (!pubbliche.length) return nonTrovato();

  const carte = cartePerImpronta(righeCarte);
  const conCentro = pubbliche.some((riga) => String(riga.impronta) === gruppo.rappresentante);
  let partite = 0;
  let vittorie = 0;
  const varianti = pubbliche.map((riga) => {
    const impronta = String(riga.impronta);
    const membro = gruppo.membri.get(impronta);
    partite += numero(riga.partite);
    vittorie += numero(riga.vittorie);
    return {
      ...variante(riga, null, carte, totaleMeta),
      variante_id: membro.variante_id,
      rappresentante: impronta === gruppo.rappresentante,
      distanza_rappresentante: conCentro ? membro.distanza : null,
    };
  }).sort((a, b) => b.partite - a.partite || b.vittorie - a.vittorie ||
    a.impronta.localeCompare(b.impronta));
  const sufficienti = partite >= SOGLIA_PERCENTUALI;

  return {
    stato: 200,
    corpo: {
      tipo_dettaglio: "brew_group",
      gruppo_brew_id: gruppo.id,
      algoritmo: ALGORITMO_BREW,
      soglia_distanza: gruppo.soglia_distanza,
      archetipo_id: null,
      nome: "Mazzo non classificato",
      archetipo: "Mazzo non classificato",
      archetipo_catalogo: null,
      strategia: null,
      colori: [],
      filtri: { formato: p.formato, rank: p.rank, periodo: p.periodo,
        modalita: p.modalita },
      soglia_percentuali: SOGLIA_PERCENTUALI,
      partite,
      vittorie,
      sconfitte: partite - vittorie,
      record_pubblico: true,
      dati_sufficienti: sufficienti,
      win_rate: sufficienti ? percentuale(vittorie, partite) : null,
      quota_meta: sufficienti ? percentuale(partite, totaleMeta) : null,
      varianti_osservate: varianti.length,
      livelli_classificazione: [],
      varianti,
      altre_varianti: null,
      liste_riferimento: [],
      nota_varianti: `Il gruppo raccoglie liste non classificate che differiscono al massimo di ${gruppo.soglia_distanza} carte del main deck dal proprio rappresentante. Mostra soltanto le liste arrivate a ${SOGLIA_PERCENTUALI} partite nel filtro corrente; le altre non vengono attribuite al gruppo.`,
    },
  };
}
