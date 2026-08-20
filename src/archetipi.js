import { CATALOGO_ARCHETIPI } from "./catalogo-archetipi-generato.js";

export const POLICY_ARCHETIPI = Object.freeze({
  soglia: 0.90,
  margine: 0.03,
  core_soglia: 0.60,
  core_min_carte: 5,
  core_margine: 0.20,
});

function numero(valore) {
  const n = Number(valore);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function chiaveFormato(valore) {
  return String(valore || "").trim().toLocaleLowerCase("en-US");
}

export function catalogoPronto(formato, catalogo = CATALOGO_ARCHETIPI) {
  return Boolean(
    catalogo && catalogo.generato === true &&
    chiaveFormato(catalogo.formato) === chiaveFormato(formato) &&
    Array.isArray(catalogo.liste) && catalogo.liste.length &&
    catalogo.id_a_nome && typeof catalogo.id_a_nome === "object"
  );
}

export function firmaDaCarte(righe, catalogo = CATALOGO_ARCHETIPI) {
  const firma = {};
  const basi = new Set((catalogo?.basi_ids || []).map(String));
  const nomi = catalogo?.id_a_nome || {};

  for (const riga of righe || []) {
    const id = String(riga?.carta ?? "");
    const copie = numero(riga?.copie);
    if (!id || !copie || basi.has(id)) continue;
    const nome = nomi[id] || `#${id}`;
    firma[nome] = (firma[nome] || 0) + copie;
  }
  return firma;
}

export function somiglianza(prima, seconda) {
  if (!prima || !seconda) return 0;
  const totaleA = Object.values(prima).reduce((s, n) => s + numero(n), 0);
  const totaleB = Object.values(seconda).reduce((s, n) => s + numero(n), 0);
  const totale = Math.max(totaleA, totaleB);
  if (!totale) return 0;
  let comuni = 0;
  for (const [nome, copie] of Object.entries(prima)) {
    comuni += Math.min(numero(copie), numero(seconda[nome]));
  }
  return comuni / totale;
}

export function somiglianzaCore(firma, core) {
  const carte = [...new Set((core || []).filter(Boolean).map(String))];
  if (!firma || !carte.length) return { punteggio: 0, carte: 0, totale: carte.length };
  const presenti = carte.filter(nome => numero(firma[nome]) > 0).length;
  return {
    punteggio: presenti / carte.length,
    carte: presenti,
    totale: carte.length,
  };
}

function candidatiLista(firma, catalogo) {
  return (catalogo.liste || []).map(lista => ({
    lista,
    punteggio: somiglianza(firma, lista.firma || {}),
  })).sort((a, b) => b.punteggio - a.punteggio ||
                    String(a.lista.id).localeCompare(String(b.lista.id)));
}

function concorrenteAltroArchetipo(candidati, archetipoId) {
  return candidati.find(c =>
    c.lista.archetipo_id && c.lista.archetipo_id !== archetipoId
  ) || null;
}

function risultato(lista, livello, extra = {}) {
  const nomeCatalogo = lista.archetipo || lista.nome || lista.archetipo_id;
  const nomePubblico = lista.nome_pubblico || nomeCatalogo;
  return {
    archetipo_id: lista.archetipo_id,
    archetipo: nomePubblico,
    nome_pubblico: nomePubblico,
    archetipo_catalogo: nomeCatalogo,
    strategia: lista.strategia || null,
    colori: Array.isArray(lista.colori) ? lista.colori : [],
    modalita: livello === "variante" ? (lista.modalita || null) : null,
    lista_id: livello === "variante" ? (lista.id || null) : null,
    lista_nome: livello === "variante" ? (lista.nome || null) : null,
    livello_classificazione: livello,
    ...extra,
  };
}

export function classificaFirma(firma, catalogo = CATALOGO_ARCHETIPI,
                                policy = POLICY_ARCHETIPI) {
  if (!catalogo?.liste?.length || !firma || !Object.keys(firma).length) return null;
  const regole = { ...POLICY_ARCHETIPI, ...(policy || {}) };

  const liste = candidatiLista(firma, catalogo);
  const primo = liste[0];
  if (primo && primo.punteggio >= regole.soglia) {
    const altro = concorrenteAltroArchetipo(liste, primo.lista.archetipo_id);
    if (!altro || primo.punteggio - altro.punteggio >= regole.margine) {
      return risultato(primo.lista, "variante", {
        _somiglianza: primo.punteggio,
        _core: null,
      });
    }
  }

  const cores = (catalogo.liste || []).map(lista => {
    const core = somiglianzaCore(firma, lista.core || []);
    return { lista, ...core };
  }).sort((a, b) => b.punteggio - a.punteggio ||
                    b.carte - a.carte ||
                    String(a.lista.id).localeCompare(String(b.lista.id)));

  const migliore = cores[0];
  if (!migliore ||
      migliore.carte < regole.core_min_carte ||
      migliore.punteggio < regole.core_soglia) return null;

  const altroCore = concorrenteAltroArchetipo(cores, migliore.lista.archetipo_id);
  if (altroCore && migliore.punteggio - altroCore.punteggio < regole.core_margine) {
    return null;
  }

  return risultato(migliore.lista, "archetipo", {
    _somiglianza: primo?.punteggio || 0,
    _core: {
      punteggio: migliore.punteggio,
      carte: migliore.carte,
      totale: migliore.totale,
    },
  });
}

export function classificaImpronte(righeCarte, formato,
                                   catalogo = CATALOGO_ARCHETIPI,
                                   policy = POLICY_ARCHETIPI) {
  const fuori = new Map();
  if (!catalogoPronto(formato, catalogo)) return fuori;

  const perImpronta = new Map();
  for (const riga of righeCarte || []) {
    const impronta = String(riga?.impronta || "");
    if (!impronta) continue;
    if (!perImpronta.has(impronta)) perImpronta.set(impronta, []);
    perImpronta.get(impronta).push(riga);
  }
  for (const [impronta, righe] of perImpronta) {
    const firma = firmaDaCarte(righe, catalogo);
    const classificazione = classificaFirma(firma, catalogo, policy);
    if (classificazione) fuori.set(impronta, classificazione);
  }
  return fuori;
}

function percentuale(parte, totale) {
  if (!totale) return null;
  return Math.round((parte * 10000) / totale) / 100;
}

function carteCoreArchetipo(archetipoId, catalogo) {
  if (!archetipoId) return [];
  const lista = (catalogo?.liste || []).find(item =>
    item?.archetipo_id === archetipoId &&
    Array.isArray(item.core) &&
    item.core.length
  );
  return lista ? [...lista.core] : [];
}

export function aggregaMeta(righeMeta, righeCarte, totale, soglia, formato,
                            catalogo = CATALOGO_ARCHETIPI,
                            policy = POLICY_ARCHETIPI) {
  const classificazioni = classificaImpronte(righeCarte, formato, catalogo, policy);
  const gruppi = new Map();

  for (const riga of righeMeta || []) {
    const impronta = String(riga?.impronta || "");
    const c = classificazioni.get(impronta) || null;
    const chiave = c ? `a:${c.archetipo_id}` : `i:${impronta}`;
    if (!gruppi.has(chiave)) {
      gruppi.set(chiave, {
        nome: c ? c.archetipo : null,
        archetipo: c ? c.archetipo : null,
        archetipo_id: c ? c.archetipo_id : null,
        strategia: c ? c.strategia : null,
        colori: c ? c.colori : [],
        carte_core: c ? carteCoreArchetipo(c.archetipo_id, catalogo) : [],
        modalita: null,
        classificazione: c ? "catalogo_mox_meta" : null,
        livelli_classificazione: new Set(),
        impronta: c ? null : impronta,
        impronte: new Set(),
        partite: 0,
        vittorie: 0,
      });
    }
    const gruppo = gruppi.get(chiave);
    gruppo.impronte.add(impronta);
    if (c?.livello_classificazione) gruppo.livelli_classificazione.add(c.livello_classificazione);
    gruppo.partite += numero(riga?.partite);
    gruppo.vittorie += numero(riga?.vittorie);
  }

  return [...gruppi.values()].map(gruppo => {
    const partite = gruppo.partite;
    const vittorie = gruppo.vittorie;
    const sufficienti = partite >= soglia;
    return {
      nome: gruppo.nome,
      archetipo: gruppo.archetipo,
      archetipo_id: gruppo.archetipo_id,
      strategia: gruppo.strategia,
      colori: gruppo.colori,
      carte_core: gruppo.carte_core,
      modalita: gruppo.modalita,
      classificazione: gruppo.classificazione,
      livelli_classificazione: [...gruppo.livelli_classificazione].sort(),
      impronta: gruppo.impronta,
      impronte_raggruppate: gruppo.impronte.size,
      varianti_rilevate: gruppo.impronte.size,
      partite,
      vittorie,
      sconfitte: partite - vittorie,
      dati_sufficienti: sufficienti,
      win_rate: sufficienti ? percentuale(vittorie, partite) : null,
      quota_meta: sufficienti ? percentuale(partite, totale) : null,
    };
  }).sort((a, b) => b.partite - a.partite ||
                    String(a.archetipo_id || a.impronta).localeCompare(
                      String(b.archetipo_id || b.impronta)));
}

export function infoCatalogo(formato, catalogo = CATALOGO_ARCHETIPI) {
  return {
    disponibile: catalogoPronto(formato, catalogo),
    formato: catalogo?.formato || null,
    aggiornato: catalogo?.aggiornato || null,
    liste: Array.isArray(catalogo?.liste) ? catalogo.liste.length : 0,
    soglia_somiglianza: POLICY_ARCHETIPI.soglia,
    soglia_variante: POLICY_ARCHETIPI.soglia,
    core_soglia: POLICY_ARCHETIPI.core_soglia,
    core_min_carte: POLICY_ARCHETIPI.core_min_carte,
    core_margine: POLICY_ARCHETIPI.core_margine,
  };
}
