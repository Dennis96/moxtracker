import { fetchStatisticheDraft } from "./api.js";

const $ = (id) => document.getElementById(id);
const percentuale = new Intl.NumberFormat("it-IT", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const numero = new Intl.NumberFormat("it-IT");

function intervallo(valore) {
  return Array.isArray(valore) ? `${percentuale.format(valore[0])}–${percentuale.format(valore[1])}` : "—";
}

function disegna(dati) {
  const fasi = Array.isArray(dati.fasi) ? dati.fasi : [];
  const pick = fasi.reduce((totale, riga) => totale + Number(riga.campione || 0), 0);
  const seguitiStimati = fasi.reduce((totale, riga) => totale +
    (riga.accordo_mox === null ? 0 : Number(riga.accordo_mox) * Number(riga.campione)), 0);
  const pickConPercentuale = fasi.reduce((totale, riga) => totale +
    (riga.accordo_mox === null ? 0 : Number(riga.campione)), 0);
  const vicine = fasi.reduce((totale, riga) => totale + Number(riga.alternative_vicine || 0), 0);
  $("draft-picks").textContent = numero.format(pick);
  $("draft-close").textContent = numero.format(vicine);
  $("draft-agreement").textContent = pickConPercentuale >= 100 ? percentuale.format(seguitiStimati / pickConPercentuale) : "Dati insufficienti";
  $("draft-agreement-note").textContent = pickConPercentuale >= 100 ? `Calcolato su ${numero.format(pickConPercentuale)} pick pubblicabili` : "Servono almeno 100 pick per una percentuale";
  const risultati = dati.risultati || {};
  $("draft-matches").textContent = numero.format(Number(risultati.campione || 0));
  $("draft-match-note").textContent = risultati.win_rate === null || risultati.win_rate === undefined ? "Win rate nascosto sotto 30 match" : `Win rate ${percentuale.format(risultati.win_rate)} · IC 95% ${intervallo(risultati.intervallo_95)}`;
  $("draft-updated").textContent = dati.aggiornato ? `Aggiornato ${new Date(dati.aggiornato).toLocaleString("it-IT")}` : "";
  const politiche = [...new Set(fasi.map((r) => r.politica).filter(Boolean))];
  $("draft-policy").textContent = `Politica: ${politiche.length === 1 ? politiche[0] : politiche.length ? `${politiche.length} versioni` : "—"}`;
  if (!fasi.length) {
    $("draft-phases").innerHTML = '<div class="draft-empty"><div><strong>Stiamo raccogliendo i primi Draft</strong><p>Gli aggregati compariranno dopo i contributi inviati con consenso. Servono a verificare l\'algoritmo, non a tracciare i giocatori.</p></div></div>';
    return;
  }
  $("draft-phases").innerHTML = fasi.map((riga) => `<article class="phase-card"><h3>${riga.fase}</h3><dl><dt>Pick</dt><dd>${numero.format(riga.campione)}</dd><dt>Accordo MOX</dt><dd>${riga.accordo_mox === null ? "—" : percentuale.format(riga.accordo_mox)}</dd><dt>Intervallo 95%</dt><dd>${intervallo(riga.intervallo_95)}</dd><dt>Alternative vicine</dt><dd>${numero.format(riga.alternative_vicine)}</dd></dl>${riga.accordo_mox === null ? '<p class="phase-note">Campione sotto 100: nessuna percentuale pubblicata.</p>' : ""}</article>`).join("");
}

async function carica() {
  $("draft-error").hidden = true;
  $("draft-phases").innerHTML = '<div class="skeleton"></div>';
  try {
    const dati = await fetchStatisticheDraft({ set: $("draft-set").value.trim().toUpperCase(), formato: $("draft-format").value });
    disegna(dati);
  } catch (guasto) {
    $("draft-error").textContent = `Statistiche Draft non disponibili: ${guasto.message}`;
    $("draft-error").hidden = false;
    $("draft-phases").innerHTML = '<div class="draft-empty">Il laboratorio non puo leggere l\'API locale.</div>';
  }
}

$("draft-filters").addEventListener("submit", (evento) => { evento.preventDefault(); carica(); });
carica();
