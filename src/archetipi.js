import { CATALOGO_ARCHETIPI } from "./catalogo-archetipi-generato.js";

export const POLICY_ARCHETIPI = Object.freeze({
  soglia: 0.90,
  margine: 0.03,
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
    // Una carta non nota al catalogo NON viene ignorata: rimane nella firma
    // come ID anonimo e quindi abbassa la somiglianza, invece di gonfiarla.
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

export function classificaFirma(firma, catalogo = CATALOGO_ARCHETIPI,
                                policy = POLICY_ARCHETIPI) {
  if (!catalogo?.liste?.length || !firma || !Object.keys(firma).length) return null;

  const candidati = catalogo.liste.map(lista => ({
    lista,
    punteggio: somiglianza(firma, lista.firma || {}),
  })).sort((a, b) => b.punteggio - a.punteggio ||
                    String(a.lista.id).localeCompare(String(b.lista.id)));

  const primo = candidati[0];
  if (!primo || primo.punteggio < policy.soglia) return null;

  // Due varianti dello STESSO archetipo non sono ambiguita': cerchiamo il
  // miglior concorrente che porterebbe a un archetipo diverso.
  const altro = candidati.find(c =>
    c.lista.archetipo_id && c.lista.archetipo_id !== primo.lista.archetipo_id
  );
  if (altro && primo.punteggio - altro.punteggio < policy.margine) return null;

  const lista = primo.lista;
  return {
    archetipo_id: lista.archetipo_id,
    archetipo: lista.archetipo || lista.nome || lista.archetipo_id,
    strategia: lista.strategia || null,
    colori: Array.isArray(lista.colori) ? lista.colori : [],
    modalita: lista.modalita || null,
    lista_id: lista.id || null,
    // Solo per diagnostica interna e test. Non viene pubblicato come win rate.
    _somiglianza: primo.punteggio,
  };
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

export function aggregaMeta(righeMeta, righeCarte, totale, soglia, formato,
                            catalogo = CATALOGO_ARCHETIPI,
                            policy = POLICY_ARCHETIPI) {
  const classificazioni = classificaImpronte(righeCarte, formato, catalogo, policy);
  const gruppi = new Map();

  for (const riga of righeMeta || []) {
    const impronta = String(riga?.impronta || "");
    const c = classificazioni.get(impronta) || null;
    const chiave = c
      ? `a:${c.archetipo_id}:${String(c.modalita || "").toLowerCase()}`
      : `i:${impronta}`;
    if (!gruppi.has(chiave)) {
      gruppi.set(chiave, {
        nome: c ? c.archetipo : null,
        archetipo: c ? c.archetipo : null,
        archetipo_id: c ? c.archetipo_id : null,
        strategia: c ? c.strategia : null,
        colori: c ? c.colori : [],
        modalita: c ? c.modalita : null,
        classificazione: c ? "catalogo_mox_meta" : null,
        impronta: c ? null : impronta,
        impronte: new Set(),
        partite: 0,
        vittorie: 0,
      });
    }
    const gruppo = gruppi.get(chiave);
    gruppo.impronte.add(impronta);
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
      modalita: gruppo.modalita,
      classificazione: gruppo.classificazione,
      impronta: gruppo.impronta,
      impronte_raggruppate: gruppo.impronte.size,
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
  };
}
