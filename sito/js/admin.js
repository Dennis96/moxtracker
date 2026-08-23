import { API_BASE } from "./config.js";

const $ = (id) => document.getElementById(id);
let ticketCorrente = null;

function tema() {
  const salvato = localStorage.getItem("mox-theme");
  if (salvato) document.documentElement.dataset.theme = salvato;
  $("theme-toggle").addEventListener("click", () => {
    const prossimo = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = prossimo;
    localStorage.setItem("mox-theme", prossimo);
  });
}

async function api(percorso, opzioni = {}) {
  const risposta = await fetch(`${API_BASE}${percorso}`, {
    credentials: "include", ...opzioni,
    headers: { accept: "application/json", ...(opzioni.headers || {}) },
  });
  let corpo = null; try { corpo = await risposta.json(); } catch { /* non JSON */ }
  if (!risposta.ok) throw new Error(corpo?.errore || `Errore ${risposta.status}`);
  return corpo;
}

function voce(titolo, dettaglio, azione = null) {
  const riga = document.createElement("div"); riga.className = "service-row";
  const forte = document.createElement("strong"); forte.textContent = titolo;
  const piccolo = document.createElement("small"); piccolo.textContent = dettaglio;
  riga.append(forte, piccolo); if (azione) riga.append(azione); return riga;
}

async function apriTicket(id) {
  const dato = await api(`/admin/ticket/${id}`); ticketCorrente = id;
  $("admin-detail").classList.remove("hidden");
  $("admin-title").textContent = dato.ticket.titolo;
  $("admin-status").value = dato.ticket.stato;
  const messaggi = dato.messaggi.map((m) => voce(m.autore, m.testo));
  const allegati = dato.allegati.map((a) => {
    const link = document.createElement("a"); link.className = "service-button";
    link.textContent = `Scarica ${a.nome}`;
    link.href = `${API_BASE}/ticket/${id}/attachments/${a.id}`;
    link.referrerPolicy = "no-referrer"; return voce(a.nome, `${Math.ceil(a.byte / 1024)} KiB`, link);
  });
  $("admin-messages").replaceChildren(...messaggi, ...allegati);
}

async function caricaTicket() {
  try {
    const filtro = $("admin-filter").value;
    const dato = await api(`/admin/tickets${filtro ? `?stato=${encodeURIComponent(filtro)}` : ""}`);
    $("admin-message").textContent = `${dato.ticket.length} ticket`;
    const righe = dato.ticket.map((t) => {
      const bottone = document.createElement("button"); bottone.type = "button";
      bottone.className = "service-button"; bottone.textContent = "Apri";
      bottone.addEventListener("click", () => apriTicket(t.id));
      return voce(t.titolo, `${t.categoria} · ${t.stato.replaceAll("_", " ")}`, bottone);
    });
    $("admin-tickets").replaceChildren(...righe);
  } catch (errore) {
    $("admin-message").textContent = errore.message;
    $("admin-message").className = "service-message error";
  }
}

tema();
$("admin-filter").addEventListener("change", caricaTicket);
$("admin-form").addEventListener("submit", async (evento) => {
  evento.preventDefault(); if (!ticketCorrente) return;
  try {
    await api(`/admin/ticket/${ticketCorrente}`, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify({
        stato: $("admin-status").value, testo: $("admin-reply").value,
      }) });
    $("admin-reply").value = ""; await apriTicket(ticketCorrente); await caricaTicket();
  } catch (errore) { $("admin-message").textContent = errore.message; }
});
caricaTicket();
