import { fetchStatisticheDraft } from "./api.js";
import { traduciDocumento } from "./translate.js";

const $ = (id) => document.getElementById(id);
const lingua = document.documentElement.lang === "en" ? "en-US" : "it-IT";
const percentuale = new Intl.NumberFormat(lingua, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const numero = new Intl.NumberFormat(lingua);
let coloreSelezionato = "";

function intervallo(valore) {
  return Array.isArray(valore) ? `${percentuale.format(valore[0])}–${percentuale.format(valore[1])}` : "—";
}

function aggiornaSet(eventi) {
  const campo = $("draft-set");
  const selezionato = campo.value;
  const setDisponibili = [...new Set(eventi.map((riga) => String(riga.set || "").trim())
    .filter(Boolean))].sort();
  campo.replaceChildren(new Option("Tutti i set", ""));
  for (const set of setDisponibili) campo.append(new Option(set, set));
  campo.value = setDisponibili.includes(selezionato) ? selezionato : "";
}

function nodo(tag, classe = "", testo = "") {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (testo) elemento.textContent = testo;
  return elemento;
}

function disegnaApprofondimenti(dati) {
  const root = $("draft-insights");
  const badge = $("draft-insight-badge");
  const fonte = dati.approfondimenti?.fonte_mox || {};
  root.replaceChildren();
  if (!fonte.disponibili) {
    badge.textContent = "In raccolta";
    root.append(nodo("div", "", "Servono almeno 10 Draft completi con metadati carta verificati prima di mostrare i colori."));
  } else {
    badge.textContent = "Aggregati Mox";
    const colori = nodo("div", "draft-color-grid");
    for (const riga of fonte.colori || []) {
      const bottone = nodo("button", `draft-color-card${coloreSelezionato === riga.colore ? " is-selected" : ""}`);
      bottone.type = "button"; bottone.dataset.color = riga.colore;
      bottone.setAttribute("aria-pressed", String(coloreSelezionato === riga.colore));
      bottone.append(nodo("strong", "", riga.colore), nodo("span", "", `${numero.format(riga.draft)} Draft`),
        nodo("small", "", riga.win_rate === null ? "Risultati in raccolta" : `${percentuale.format(riga.win_rate)} · IC ${intervallo(riga.intervallo_95)}`));
      colori.append(bottone);
    }
    root.append(colori);
    if (coloreSelezionato) {
      const titolo = nodo("h3", "draft-cards-title", `Carte nei mazzi ${coloreSelezionato}`);
      const nota = nodo("p", "draft-insight-note", fonte.nota || "");
      const lista = nodo("ol", "draft-card-rank");
      for (const carta of fonte.carte || []) {
        const riga = nodo("li");
        riga.append(nodo("strong", "", carta.nome), nodo("span", "", `${numero.format(carta.draft)} Draft · ${numero.format(carta.campione)} match`),
          nodo("small", "", carta.win_rate === null ? "Dati insufficienti" : `${percentuale.format(carta.win_rate)} · IC ${intervallo(carta.intervallo_95)}`));
        lista.append(riga);
      }
      if (!lista.childNodes.length) lista.append(nodo("li", "", "Nessuna carta supera ancora le soglie."));
      root.append(titolo, nota, lista);
    }
  }
  const esterno = $("draft-17lands");
  const datiEsterni = dati.approfondimenti?.fonte_17lands || {};
  esterno.replaceChildren(); esterno.classList.toggle("hidden", !datiEsterni.disponibile);
  if (datiEsterni.disponibile) {
    esterno.append(nodo("h3", "", "17Lands — fonte separata"),
      nodo("p", "", `${datiEsterni.metrica}. Non viene sommata ai dati Mox.`),
      Object.assign(nodo("a", "inline-link", "Dataset pubblici e attribuzione"), { href: datiEsterni.url, target: "_blank", rel: "noopener noreferrer" }));
  }
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
  aggiornaSet(eventi);
  disegnaApprofondimenti(dati);
  if (!eventi.length) {
    $("draft-events").innerHTML = '<div class="draft-empty"><div><strong>Stiamo raccogliendo i primi Draft</strong><p>Gli aggregati compariranno dopo i contributi inviati con consenso.</p></div></div>';
    traduciDocumento();
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
  traduciDocumento();
}

async function carica() {
  $("draft-error").hidden = true;
  $("draft-events").innerHTML = '<div class="skeleton"></div>';
  try {
    const dati = await fetchStatisticheDraft({ set: $("draft-set").value, formato: $("draft-format").value, periodo: $("draft-period").value, colore: coloreSelezionato });
    disegna(dati);
  } catch (guasto) {
    $("draft-error").textContent = `Statistiche Draft non disponibili: ${guasto.message}`;
    $("draft-error").hidden = false;
    $("draft-events").innerHTML = '<div class="draft-empty">I dati Draft non sono disponibili.</div>';
    traduciDocumento();
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
$("draft-insights").addEventListener("click", (evento) => {
  const carta = evento.target.closest("[data-color]");
  if (!carta) return;
  coloreSelezionato = carta.dataset.color === coloreSelezionato ? "" : carta.dataset.color;
  carica();
});
carica();
