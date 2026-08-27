import { fetchStatisticheDraft } from "./api.js";

const $ = (id) => document.getElementById(id);
const lingua = document.documentElement.lang === "en" ? "en-US" : "it-IT";
const percentuale = new Intl.NumberFormat(lingua, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const numero = new Intl.NumberFormat(lingua);

function intervallo(valore) {
  return Array.isArray(valore) ? `${percentuale.format(valore[0])}–${percentuale.format(valore[1])}` : "—";
}

function disegna(dati) {
  const totali = dati.totali || {};
  $("draft-count").textContent = numero.format(Number(totali.draft || 0));
  $("draft-picks").textContent = numero.format(Number(totali.pick || 0));
  const risultati = dati.risultati || {};
  $("draft-matches").textContent = numero.format(Number(risultati.campione || 0));
  const pubblicabile = risultati.win_rate !== null && risultati.win_rate !== undefined;
  $("draft-winrate").textContent = pubblicabile ? percentuale.format(risultati.win_rate) : "Dati insufficienti";
  $("draft-match-note").textContent = pubblicabile ? `IC 95% ${intervallo(risultati.intervallo_95)}` : "Servono almeno 30 match collegati";
  const aggiornato = totali.aggiornato || dati.aggiornato;
  $("draft-updated").textContent = aggiornato ? `Aggiornato ${new Date(aggiornato).toLocaleString(lingua)}` : "";
  const eventi = Array.isArray(dati.eventi) ? dati.eventi : [];
  if (!eventi.length) {
    $("draft-events").innerHTML = '<div class="draft-empty"><div><strong>Stiamo raccogliendo i primi Draft</strong><p>Gli aggregati compariranno dopo i contributi inviati con consenso.</p></div></div>';
    return;
  }
  $("draft-events").replaceChildren(...eventi.map((riga) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "phase-card event-card";
    card.dataset.set = riga.set;
    card.dataset.formato = riga.formato;
    card.innerHTML = `<span class="eyebrow">${riga.formato}</span><h3>${riga.set}</h3><dl><dt>Draft</dt><dd>${numero.format(riga.draft)}</dd><dt>Scelte</dt><dd>${numero.format(riga.pick)}</dd></dl><span class="event-open">Filtra questo gruppo →</span>`;
    return card;
  }));
}

async function carica() {
  $("draft-error").hidden = true;
  $("draft-events").innerHTML = '<div class="skeleton"></div>';
  try {
    const dati = await fetchStatisticheDraft({ set: $("draft-set").value.trim().toUpperCase(), formato: $("draft-format").value, periodo: $("draft-period").value });
    disegna(dati);
  } catch (guasto) {
    $("draft-error").textContent = `Statistiche Draft non disponibili: ${guasto.message}`;
    $("draft-error").hidden = false;
    $("draft-events").innerHTML = '<div class="draft-empty">I dati Draft non sono disponibili.</div>';
  }
}

$("draft-filters").addEventListener("submit", (evento) => { evento.preventDefault(); carica(); });
$("draft-events").addEventListener("click", (evento) => {
  const card = evento.target.closest(".event-card");
  if (!card) return;
  $("draft-set").value = card.dataset.set;
  $("draft-format").value = card.dataset.formato;
  carica();
  $("laboratorio").scrollIntoView({ behavior: "smooth" });
});
carica();
