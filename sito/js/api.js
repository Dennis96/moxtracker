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
    const message = data?.errore || `Errore API (${response.status})`;
    throw new Error(message);
  }
  if (!data || typeof data !== "object") throw new Error("Risposta API non leggibile");
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
export function fetchArchetipo({ formato, rank, periodo, modalita, id, impronta }, options) {
  const params = new URLSearchParams({ formato });
  if (id) params.set("id", id);
  else if (impronta) params.set("impronta", impronta);
  else throw new Error("Serve id archetipo oppure impronta");
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
export function fetchStatisticheDraft({ set, formato, periodo } = {}, options) {
  const params = new URLSearchParams();
  if (set) params.set("set", set);
  if (formato) params.set("formato", formato);
  if (periodo) params.set("periodo", periodo);
  const coda = params.toString();
  return request(`/draft/statistiche${coda ? `?${coda}` : ""}`, options);
}
