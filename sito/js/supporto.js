import { API_BASE } from "./config.js";
import { intestazioniSessioneAccount } from "./sessione-account.js";

const $ = (id) => document.getElementById(id);
const parametri = new URLSearchParams(location.search);
let ticketId = parametri.get("ticket");
let token = parametri.get("token");
let turnstileToken = "";
let turnstileId = null;

async function api(percorso, opzioni = {}) {
  const risposta = await fetch(`${API_BASE}${percorso}`, { credentials: "include", ...opzioni,
    headers: intestazioniSessioneAccount(opzioni.headers || {}) });
  let corpo = null; try { corpo = await risposta.json(); } catch { /* non JSON */ }
  if (!risposta.ok) throw new Error(corpo?.errore || `Errore ${risposta.status}`); return corpo;
}

function percorso(suffisso = "") { return `/ticket/${ticketId}${suffisso}${token ? `?token=${encodeURIComponent(token)}` : ""}`; }

function trovaFineZip(byte) {
  for (let indice = byte.length - 22; indice >= Math.max(0, byte.length - 65557); indice -= 1) {
    if (byte[indice] === 0x50 && byte[indice + 1] === 0x4b && byte[indice + 2] === 0x05 && byte[indice + 3] === 0x06) return indice;
  }
  return -1;
}

async function rapportoDaZip(file) {
  if (file.size > 10 * 1024 * 1024) throw new Error("Pacchetto diagnostico troppo grande");
  const buffer = await file.arrayBuffer(); const view = new DataView(buffer); const byte = new Uint8Array(buffer);
  const fine = trovaFineZip(byte);
  if (fine < 0 || view.getUint32(fine, true) !== 0x06054b50) throw new Error("Pacchetto ZIP Mox non leggibile");
  const quanti = view.getUint16(fine + 10, true); let cursore = view.getUint32(fine + 16, true); let rapporto = null;
  for (let indice = 0; indice < quanti; indice += 1) {
    if (cursore + 46 > byte.length || view.getUint32(cursore, true) !== 0x02014b50) throw new Error("Indice ZIP non valido");
    const metodo = view.getUint16(cursore + 10, true); const compresso = view.getUint32(cursore + 20, true);
    const scompresso = view.getUint32(cursore + 24, true); const nomeLunghezza = view.getUint16(cursore + 28, true);
    const extra = view.getUint16(cursore + 30, true); const commento = view.getUint16(cursore + 32, true);
    const locale = view.getUint32(cursore + 42, true);
    const nome = new TextDecoder().decode(byte.slice(cursore + 46, cursore + 46 + nomeLunghezza));
    if (nome === "rapporto.json") rapporto = { metodo, compresso, scompresso, locale };
    cursore += 46 + nomeLunghezza + extra + commento;
  }
  if (!rapporto || rapporto.scompresso > 256 * 1024 || rapporto.compresso > 256 * 1024) {
    throw new Error("Il pacchetto deve contenere un rapporto.json Mox fino a 256 KiB");
  }
  const locale = rapporto.locale;
  if (locale + 30 > byte.length || view.getUint32(locale, true) !== 0x04034b50) throw new Error("Rapporto ZIP non leggibile");
  const nomeLunghezza = view.getUint16(locale + 26, true); const extra = view.getUint16(locale + 28, true);
  const dati = byte.slice(locale + 30 + nomeLunghezza + extra, locale + 30 + nomeLunghezza + extra + rapporto.compresso);
  let rapportoByte;
  if (rapporto.metodo === 0) rapportoByte = dati;
  else if (rapporto.metodo === 8 && "DecompressionStream" in window) {
    rapportoByte = new Uint8Array(await new Response(new Blob([dati]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
  } else throw new Error("Questo browser non può leggere il pacchetto diagnostico ZIP");
  if (rapportoByte.byteLength !== rapporto.scompresso) throw new Error("Rapporto ZIP incompleto");
  return fileRapportoMox(rapportoByte);
}

// Mox anonimizza il rapporto, ma la diagnostica recente conserva unicamente le
// ultime cifre dell'impronta del Draft. Per il ticket non servono: le togliamo
// prima dell'invio, insieme a qualunque campo che il server considera privato.
function ripulisciRapportoMox(valore, chiave = "") {
  if (/(?:segreto|password|token|mittente|email|player.?log|impronta)/i.test(chiave)) return undefined;
  if (Array.isArray(valore)) return valore.map((voce) => ripulisciRapportoMox(voce))
    .filter((voce) => voce !== undefined);
  if (!valore || typeof valore !== "object") return valore;
  return Object.fromEntries(Object.entries(valore).flatMap(([nome, contenuto]) => {
    const pulito = ripulisciRapportoMox(contenuto, nome);
    return pulito === undefined ? [] : [[nome, pulito]];
  }));
}

function fileRapportoMox(byte) {
  let rapporto;
  try { rapporto = JSON.parse(new TextDecoder().decode(byte)); }
  catch { throw new Error("rapporto.json non valido"); }
  const pulito = ripulisciRapportoMox(rapporto);
  return new File([JSON.stringify(pulito)], "rapporto.json", { type: "application/json" });
}

async function allegatoDaInviare(file) {
  if (!file) return null;
  const nome = file.name.toLocaleLowerCase("it-IT");
  if (file.type === "application/zip" || nome.endsWith(".zip")) return rapportoDaZip(file);
  if (file.type === "application/json" || nome === "rapporto.json") {
    return fileRapportoMox(await file.arrayBuffer());
  }
  return file;
}

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
    const file = await allegatoDaInviare($("ticket-file").files[0]);
    const creato = await api("/ticket", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ categoria: $("ticket-category").value, titolo: $("ticket-title").value, testo: $("ticket-text").value, versione_mox: $("ticket-version").value, turnstile_token: turnstileToken }) });
    ticketId = creato.ticket.id; token = creato.token || null;
    if (file) { const form = new FormData(); form.append("file", file); await api(percorso("/attachments"), { method: "POST", body: form }); }
    const url = new URL(location.href); url.searchParams.set("ticket", ticketId); if (token) url.searchParams.set("token", token); history.replaceState(null, "", url);
    $("ticket-message").textContent = token ? "Ticket inviato. Salva il link corrente: contiene il tuo accesso segreto." : "Ticket inviato e aggiunto al tuo account."; $("ticket-message").className = "service-message success"; await caricaTicket();
  } catch (e) { $("ticket-message").textContent = e.message; $("ticket-message").className = "service-message error"; }
  finally { bottone.disabled = false; turnstileToken = ""; if (turnstileId !== null) window.turnstile.reset(turnstileId); }
});
$("reply-form").addEventListener("submit", async (evento) => { evento.preventDefault(); try { await api(percorso("/messages"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ testo: $("reply-text").value }) }); $("reply-text").value = ""; await caricaTicket(); } catch (e) { $("ticket-message").textContent = e.message; } });
caricaTicket();
preparaTurnstile();
