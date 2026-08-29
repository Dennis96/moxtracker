import { API_BASE } from "./config.js";
import { eliminaSessioneAccountPreview, intestazioniSessioneAccount } from "./sessione-account.js";

const $ = (id) => document.getElementById(id);
let ticketCorrente = null;

async function api(percorso, opzioni = {}) {
  const risposta = await fetch(`${API_BASE}${percorso}`, {
    credentials: "include", ...opzioni,
    headers: intestazioniSessioneAccount(opzioni.headers || {}),
  });
  let corpo = null; try { corpo = await risposta.json(); } catch { /* non JSON */ }
  if (risposta.status === 401) eliminaSessioneAccountPreview();
  if (!risposta.ok) throw new Error(corpo?.errore || `Errore ${risposta.status}`);
  return corpo;
}

function voce(titolo, dettaglio, azione = null) {
  const riga = document.createElement("div"); riga.className = "service-row";
  const testa = document.createElement("div"); testa.className = "service-row-head";
  const forte = document.createElement("strong"); forte.textContent = titolo;
  testa.append(forte);
  if (dettaglio) { const piccolo = document.createElement("small"); piccolo.textContent = dettaglio; testa.append(piccolo); }
  riga.append(testa); if (azione) riga.append(azione); return riga;
}

// Il messaggio non e' un dettaglio della riga: e' il contenuto del ticket.
// Passarlo a voce() lo attaccava al nome dell'autore e lo rimpiccioliva.
function messaggio(autore, testo, quando) {
  const riga = document.createElement("article"); riga.className = "service-row";
  const chi = document.createElement("span"); chi.className = "message-author"; chi.textContent = autore;
  const corpo = document.createElement("p"); corpo.className = "message-text"; corpo.textContent = testo;
  riga.append(chi, corpo);
  if (quando) { const data = document.createElement("small"); data.textContent = new Date(quando).toLocaleString("it-IT"); riga.append(data); }
  return riga;
}

async function apriTicket(id) {
  const dato = await api(`/admin/ticket/${id}`); ticketCorrente = id;
  $("admin-detail").classList.remove("hidden");
  $("admin-title").textContent = dato.ticket.titolo;
  $("admin-status").value = dato.ticket.stato;
  const messaggi = dato.messaggi.map((m) => messaggio(m.autore, m.testo, m.creato));
  const allegati = dato.allegati.map((a) => {
    const link = document.createElement("button"); link.type = "button"; link.className = "service-button";
    link.textContent = `Scarica ${a.nome}`;
    link.addEventListener("click", async () => {
      link.disabled = true;
      try {
        const risposta = await fetch(`${API_BASE}/ticket/${id}/attachments/${a.id}`, {
          credentials: "include", headers: intestazioniSessioneAccount(),
        });
        if (!risposta.ok) throw new Error("Download allegato non riuscito");
        const url = URL.createObjectURL(await risposta.blob());
        const scarica = document.createElement("a"); scarica.href = url; scarica.download = a.nome; scarica.click();
        URL.revokeObjectURL(url);
      } catch (errore) { $("admin-message").textContent = errore.message; }
      finally { link.disabled = false; }
    });
    return voce(a.nome, `${Math.ceil(a.byte / 1024)} KiB`, link);
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
