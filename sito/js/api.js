import { API_BASE } from "./config.js";

async function request(path, { signal } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: { accept: "application/json" },
    signal,
  });
  let data = null;
  try { data = await response.json(); } catch { /* handled below */ }
  if (!response.ok) {
    const message = data?.errore || (document.documentElement.lang === "en"
      ? `Service unavailable (${response.status})`
      : `Servizio non disponibile (${response.status})`);
    throw new Error(message);
  }
  if (!data || typeof data !== "object") throw new Error(document.documentElement.lang === "en"
    ? "Unreadable service response" : "Risposta del servizio non leggibile");
  return data;
}

function query({ formato, rank, periodo, modalita }) {
  const params = new URLSearchParams({ formato });
  if (rank) params.set("rank", rank);
  if (periodo) params.set("periodo", periodo);
  if (modalita) params.set("modalita", modalita);
  return params.toString();
}

export function fetchMeta(filters, options) {
  return request(`/meta?${query(filters)}`, options);
}
// Tre dettagli alternativi: archetipo (`id`), gruppo Brew (`id_brew`) o la
// vecchia lista per impronta. Mai due insieme.
export function fetchArchetipo({ formato, rank, periodo, modalita, id, id_brew: idBrew, impronta }, options) {
  const params = new URLSearchParams({ formato });
  const scelti = [["id", id], ["id_brew", idBrew], ["impronta", impronta]].filter(([, valore]) => valore);
  if (scelti.length !== 1) throw new Error("Serve un solo identificativo: archetipo, gruppo Brew o impronta");
  params.set(...scelti[0]);
  if (rank) params.set("rank", rank);
  if (periodo) params.set("periodo", periodo);
  if (modalita) params.set("modalita", modalita);
  return request(`/archetipo?${params.toString()}`, options);
}
export function fetchGiocoRisposta(filters, options) {
  return request(`/gioco-risposta?${query(filters)}`, options);
}
export function fetchScontri(filters, options) {
  return request(`/scontri?${query(filters)}`, options);
}
