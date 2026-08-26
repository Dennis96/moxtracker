import { API_BASE } from "./config.js";

const $ = (id) => document.getElementById(id);
const parametri = new URLSearchParams(location.search);
let ticketId = parametri.get("ticket");
let token = parametri.get("token");
let turnstileToken = "";
let turnstileId = null;

async function api(percorso, opzioni = {}) {
  const risposta = await fetch(`${API_BASE}${percorso}`, { credentials: "include", ...opzioni,
    headers: { accept: "application/json", ...(opzioni.headers || {}) } });
  let corpo = null; try { corpo = await risposta.json(); } catch { /* non JSON */ }
  if (!risposta.ok) throw new Error(corpo?.errore || `Errore ${risposta.status}`); return corpo;
}

function percorso(suffisso = "") { return `/ticket/${ticketId}${suffisso}${token ? `?token=${encodeURIComponent(token)}` : ""}`; }

async function preparaTurnstile() {
  try {
    const configurazione = await api("/ticket/config");
    if (!configurazione.turnstile_site_key) {
      $("turnstile-message").textContent = "I ticket anonimi non sono ancora attivi: accedi con Google o Discord.";
      return;
    }
    await new Promise((risolvi, rifiuta) => {
      if (window.turnstile) { risolvi(); return; }
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true; script.defer = true; script.onload = risolvi;
      script.onerror = () => rifiuta(new Error("verifica anti-spam non caricata"));
      document.head.append(script);
    });
    turnstileId = window.turnstile.render("#turnstile-widget", {
      sitekey: configurazione.turnstile_site_key,
      callback: (valore) => { turnstileToken = valore; },
      "expired-callback": () => { turnstileToken = ""; },
      "error-callback": () => { turnstileToken = ""; },
    });
    $("turnstile-message").textContent = "La verifica è richiesta soltanto per i ticket senza account.";
  } catch (errore) {
    $("turnstile-message").textContent = errore.message;
  }
}

async function caricaTicket() {
  if (!ticketId) return;
  try {
    const dato = await api(percorso()); $("ticket-detail").classList.remove("hidden");
    const titolo = document.createElement("h3"); titolo.textContent = dato.ticket.titolo;
    const stato = document.createElement("span"); stato.className = "ticket-status"; stato.textContent = dato.ticket.stato.replaceAll("_", " ");
    $("ticket-summary").replaceChildren(titolo, stato);
    const messaggi = dato.messaggi.map((m) => { const r = document.createElement("article"); r.className = "service-row"; const a = document.createElement("span"); a.className = "message-author"; a.textContent = m.autore; const p = document.createElement("p"); p.className = "message-text"; p.textContent = m.testo; const d = document.createElement("small"); d.textContent = new Date(m.creato).toLocaleString("it-IT"); r.append(a, p, d); return r; });
    const allegati = dato.allegati.map((file) => { const r = document.createElement("a"); r.className = "service-row"; r.textContent = `Scarica ${file.nome} (${Math.ceil(file.byte / 1024)} KiB)`; r.href = `${API_BASE}${percorso(`/attachments/${file.id}`)}`; r.referrerPolicy = "no-referrer"; return r; });
    $("ticket-messages").replaceChildren(...messaggi, ...allegati);
  } catch (e) { $("ticket-message").textContent = e.message; $("ticket-message").className = "service-message error"; }
}

$("ticket-form").addEventListener("submit", async (evento) => {
  evento.preventDefault(); const bottone = $("ticket-submit"); bottone.disabled = true;
  try {
    const creato = await api("/ticket", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ categoria: $("ticket-category").value, titolo: $("ticket-title").value, testo: $("ticket-text").value, versione_mox: $("ticket-version").value, turnstile_token: turnstileToken }) });
    ticketId = creato.ticket.id; token = creato.token || null;
    const file = $("ticket-file").files[0];
    if (file) { const form = new FormData(); form.append("file", file); await api(percorso("/attachments"), { method: "POST", body: form }); }
    const url = new URL(location.href); url.searchParams.set("ticket", ticketId); if (token) url.searchParams.set("token", token); history.replaceState(null, "", url);
    $("ticket-message").textContent = token ? "Ticket inviato. Salva il link corrente: contiene il tuo accesso segreto." : "Ticket inviato e aggiunto al tuo account."; $("ticket-message").className = "service-message success"; await caricaTicket();
  } catch (e) { $("ticket-message").textContent = e.message; $("ticket-message").className = "service-message error"; }
  finally { bottone.disabled = false; turnstileToken = ""; if (turnstileId !== null) window.turnstile.reset(turnstileId); }
});
$("reply-form").addEventListener("submit", async (evento) => { evento.preventDefault(); try { await api(percorso("/messages"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ testo: $("reply-text").value }) }); $("reply-text").value = ""; await caricaTicket(); } catch (e) { $("ticket-message").textContent = e.message; } });
caricaTicket();
preparaTurnstile();
