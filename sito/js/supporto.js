import { API_BASE } from "./config.js";
import { intestazioniSessioneAccount } from "./sessione-account.js";
import { traduciDocumento } from "./translate.js";

const $ = (id) => document.getElementById(id);
const LINGUA = document.documentElement.lang === "en" ? "en-US" : "it-IT";
const parametri = new URLSearchParams(location.search);
let ticketId = parametri.get("ticket");
let token = parametri.get("token");
let emailToken = parametri.get("email_token");
let turnstileToken = "";
let turnstileId = null;

async function api(percorso, opzioni = {}) {
  const risposta = await fetch(`${API_BASE}${percorso}`, { credentials: "include", ...opzioni,
    headers: intestazioniSessioneAccount(opzioni.headers || {}) });
  let corpo = null; try { corpo = await risposta.json(); } catch { /* non JSON */ }
  if (!risposta.ok) throw new Error(corpo?.errore || `Errore ${risposta.status}`); return corpo;
}

function percorso(suffisso = "") {
  const query = new URLSearchParams();
  if (token) query.set("token", token); if (emailToken) query.set("email_token", emailToken);
  return `/ticket/${ticketId}${suffisso}${query.size ? `?${query}` : ""}`;
}

function mostraAccessoSegreto() {
  const host = $("ticket-access");
  host.replaceChildren();
  if (!ticketId || !token) return;
  const nota = document.createElement("p"); nota.className = "detail-note";
  nota.textContent = "Questo è il tuo link segreto: conservalo. Se hai scelto le notifiche email, conferma prima l’indirizzo dal messaggio ricevuto.";
  const link = document.createElement("a"); link.className = "secret-link"; link.href = location.href; link.textContent = location.href;
  const copia = document.createElement("button"); copia.type = "button"; copia.className = "service-button"; copia.textContent = "Copia link segreto";
  copia.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); copia.textContent = "Link copiato"; }
    catch { copia.textContent = "Copia non riuscita"; }
    setTimeout(() => { copia.textContent = "Copia link segreto"; }, 1800);
  });
  host.append(nota, link, copia);
  traduciDocumento(host);
}

function trovaFineZip(byte) {
  for (let indice = byte.length - 22; indice >= Math.max(0, byte.length - 65557); indice -= 1) {
    if (byte[indice] === 0x50 && byte[indice + 1] === 0x4b && byte[indice + 2] === 0x05 && byte[indice + 3] === 0x06) return indice;
  }
  return -1;
}

async function pacchettoMoxDaZip(file) {
  if (file.size > 10 * 1024 * 1024) throw new Error("Pacchetto diagnostico troppo grande");
  const buffer = await file.arrayBuffer(); const view = new DataView(buffer); const byte = new Uint8Array(buffer);
  const fine = trovaFineZip(byte);
  if (fine < 0 || view.getUint32(fine, true) !== 0x06054b50) throw new Error("Pacchetto ZIP Mox non leggibile");
  const quanti = view.getUint16(fine + 10, true); let cursore = view.getUint32(fine + 16, true); const visti = new Set();
  for (let indice = 0; indice < quanti; indice += 1) {
    if (cursore + 46 > byte.length || view.getUint32(cursore, true) !== 0x02014b50) throw new Error("Indice ZIP non valido");
    const scompresso = view.getUint32(cursore + 24, true); const nomeLunghezza = view.getUint16(cursore + 28, true);
    const extra = view.getUint16(cursore + 30, true); const commento = view.getUint16(cursore + 32, true);
    const nome = new TextDecoder().decode(byte.slice(cursore + 46, cursore + 46 + nomeLunghezza));
    if (!["rapporto.json", "LEGGIMI.txt", "arena/Player.log"].includes(nome) || visti.has(nome)) {
      throw new Error("Il pacchetto non è un diagnostico Mox valido");
    }
    if (nome === "rapporto.json" && scompresso > 256 * 1024) {
      throw new Error("Il pacchetto contiene un rapporto.json troppo grande");
    }
    visti.add(nome);
    cursore += 46 + nomeLunghezza + extra + commento;
  }
  if (!visti.has("rapporto.json")) throw new Error("Il pacchetto deve contenere rapporto.json");
  return file;
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
  if (file.type === "application/zip" || file.type === "application/x-zip-compressed" || nome.endsWith(".zip")) {
    return pacchettoMoxDaZip(file);
  }
  if (file.type === "application/json" || nome === "rapporto.json") {
    return fileRapportoMox(await file.arrayBuffer());
  }
  return file;
}

async function preparaTurnstile() {
  try {
    const configurazione = await api("/ticket/config");
    $("ticket-email-wrap").classList.toggle("hidden", !configurazione.notifiche_email);
    $("ticket-email-note").classList.toggle("hidden", !configurazione.notifiche_email);
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
    traduciDocumento($("turnstile-message"));
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
    const messaggi = dato.messaggi.map((m) => { const r = document.createElement("article"); r.className = "service-row"; const a = document.createElement("span"); a.className = "message-author"; a.textContent = m.autore; const p = document.createElement("p"); p.className = "message-text"; p.textContent = m.testo; const d = document.createElement("small"); d.textContent = new Date(m.creato).toLocaleString(LINGUA); r.append(a, p, d); return r; });
    const allegati = dato.allegati.map((file) => { const r = document.createElement("a"); r.className = "service-row"; r.textContent = `Scarica ${file.nome} (${Math.ceil(file.byte / 1024)} KiB)`; r.href = `${API_BASE}${percorso(`/attachments/${file.id}`)}`; r.referrerPolicy = "no-referrer"; return r; });
    $("ticket-messages").replaceChildren(...messaggi, ...allegati);
    $("ticket-email-unsubscribe").classList.toggle("hidden", !emailToken);
    traduciDocumento($("ticket-detail"));
  } catch (e) { $("ticket-message").textContent = e.message; $("ticket-message").className = "service-message error"; }
}

$("ticket-form").addEventListener("submit", async (evento) => {
  evento.preventDefault(); const bottone = $("ticket-submit"); bottone.disabled = true;
  try {
    const file = await allegatoDaInviare($("ticket-file").files[0]);
    const creato = await api("/ticket", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ categoria: $("ticket-category").value, titolo: $("ticket-title").value, testo: $("ticket-text").value, versione_mox: $("ticket-version").value, turnstile_token: turnstileToken, email_notifica: $("ticket-email").value, consenso_email: $("ticket-email-consent").checked }) });
    ticketId = creato.ticket.id; token = creato.token || null;
    if (file) { const form = new FormData(); form.append("file", file); await api(percorso("/attachments"), { method: "POST", body: form }); }
    const url = new URL(location.href); url.searchParams.set("ticket", ticketId); if (token) url.searchParams.set("token", token); history.replaceState(null, "", url);
    const email = creato.notifica_email === "conferma_inviata" ? " Controlla l’email e conferma l’indirizzo per ricevere le risposte." : "";
    $("ticket-message").textContent = (token ? "Ticket inviato: salva il link segreto qui sotto." : "Ticket inviato e aggiunto al tuo account.") + email; $("ticket-message").className = "service-message success"; traduciDocumento($("ticket-message")); mostraAccessoSegreto(); await caricaTicket();
  } catch (e) { $("ticket-message").textContent = e.message; $("ticket-message").className = "service-message error"; }
  finally { bottone.disabled = false; turnstileToken = ""; if (turnstileId !== null) window.turnstile.reset(turnstileId); }
});
$("reply-form").addEventListener("submit", async (evento) => { evento.preventDefault(); try { await api(percorso("/messages"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ testo: $("reply-text").value }) }); $("reply-text").value = ""; await caricaTicket(); } catch (e) { $("ticket-message").textContent = e.message; } });
$("ticket-email-unsubscribe").addEventListener("click", async () => { try { await api(percorso("/email/unsubscribe"), { method: "POST" }); $("ticket-email-unsubscribe").textContent = "Notifiche email disattivate"; $("ticket-email-unsubscribe").disabled = true; traduciDocumento($("ticket-email-unsubscribe")); } catch (e) { $("ticket-message").textContent = e.message; $("ticket-message").className = "service-message error"; } });
mostraAccessoSegreto();
caricaTicket();
preparaTurnstile();
