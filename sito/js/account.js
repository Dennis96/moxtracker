import { API_BASE } from "./config.js";
import { createCardThumbnail, resolveCard } from "./card-images.js?v=20260822-9";
import { renderProfiloMazzo } from "./deck-profile.js";
import { eliminaSessioneAccountPreview, intestazioniSessioneAccount } from "./sessione-account.js";
import { traduciDocumento } from "./translate.js";

const $ = (id) => document.getElementById(id);
const INGLESE = document.documentElement.lang === "en";
const LINGUA = INGLESE ? "en-US" : "it-IT";
const PERCORSO_ACCOUNT = `${window.location.origin}${INGLESE ? "/en/account.html" : "/account.html"}`;
const numeri = new Intl.NumberFormat(LINGUA);
// Dieci partite per volta: a trenta la pagina diventava lunghissima e il
// pulsante «Carica altre partite» non lo vedeva nessuno.
const PASSO_PARTITE = 10;
const PASSO_DRAFT = 10;
const stato = { dashboard: null, statistiche: null, offset: 0, limite: PASSO_PARTITE,
  totale: 0, partite: [], limiteDraft: PASSO_DRAFT,
  filtri: { mazzo: "", esito: "", evento: "" } };

async function api(percorso, opzioni = {}) {
  const risposta = await fetch(`${API_BASE}${percorso}`, {
    credentials: "include", ...opzioni,
    headers: intestazioniSessioneAccount(opzioni.headers || {}),
  });
  let corpo = null;
  try { corpo = await risposta.json(); } catch { /* risposta non JSON */ }
  if (risposta.status === 401) eliminaSessioneAccountPreview();
  if (!risposta.ok) throw Object.assign(
    new Error(corpo?.errore || `Errore ${risposta.status}`), { stato: risposta.status });
  return corpo;
}

function nodo(tag, classe = "", testo = "") {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (testo !== "") elemento.textContent = testo;
  return elemento;
}

function riga(titolo, dettaglio, azione = null) {
  const voce = nodo("div", "service-row");
  const testa = nodo("div", "service-row-head");
  testa.append(nodo("strong", "", titolo));
  if (azione) testa.append(azione);
  voce.append(testa, nodo("small", "", dettaglio));
  return voce;
}

function mostraElenco(elemento, righe, vuoto) {
  elemento.replaceChildren(...(righe.length ? righe : [riga(vuoto, "")]));
}

function dataOra(valore) {
  if (!valore) return "Data non disponibile";
  const data = new Date(valore);
  return Number.isNaN(data.getTime()) ? "Data non disponibile"
    : data.toLocaleString(LINGUA, { dateStyle: "short", timeStyle: "short" });
}

function statoConsensi(dispositivo) {
  if (dispositivo.consenso_partite === null || dispositivo.consenso_partite === undefined ||
      dispositivo.consenso_draft === null || dispositivo.consenso_draft === undefined) {
    return INGLESE ? "Consent status not yet synchronized by Mox"
      : "Stato consensi non ancora sincronizzato da Mox";
  }
  const partite = dispositivo.consenso_partite
    ? (INGLESE ? "Matches on" : "Partite attive")
    : (INGLESE ? "Matches off" : "Partite disattive");
  const draft = dispositivo.consenso_draft
    ? (INGLESE ? "Draft on" : "Draft attivo")
    : (INGLESE ? "Draft off" : "Draft disattivo");
  const aggiornato = dispositivo.consensi_aggiornati
    ? ` · ${INGLESE ? "updated" : "aggiornati"} ${dataOra(dispositivo.consensi_aggiornati)}` : "";
  return `${partite} · ${draft}${aggiornato}`;
}

function durata(secondi) {
  if (!Number.isFinite(Number(secondi))) return "—";
  const minuti = Math.floor(Number(secondi) / 60);
  const resto = Number(secondi) % 60;
  return minuti ? `${minuti} min ${resto ? `${resto} s` : ""}`.trim() : `${resto} s`;
}

function percentuale(valore) {
  return Number.isFinite(Number(valore)) ? `${numeri.format(Number(valore))}%` : "—";
}

function esitoTesto(esito) {
  return esito === "vinta" ? "Vinta" : esito === "persa" ? "Persa" : "Esito n.d.";
}

function rankPartita(partita) {
  if (!Number.isInteger(partita.rank_livello)) return "";
  if (partita.rank_classe) return `${partita.rank_classe} ${partita.rank_livello}`;
  return `Livello ${partita.rank_livello} · classe non fornita da Arena`;
}

// Finche' Mox non ha mai mandato i mazzi, il sito non sa quali esistano
// ancora in Arena: in quel caso non dice niente, invece di dedurlo.
function etichettaMazzo(mazzo) {
  if (!stato.statistiche?.sincronizzazione?.mazzi) return null;
  if (mazzo.in_arena) return mazzo.partite ? "in Arena" : "in Arena, mai giocato";
  return "non piu' in Arena";
}

function nomeMazzo(mazzo) {
  if (mazzo?.nome_personalizzato) return mazzo.nome_personalizzato;
  if (mazzo?.nome) return mazzo.nome;
  const tipo = mazzo?.formato || mazzo?.evento || "Mazzo";
  return `${tipo} · ${String(mazzo?.impronta || "").slice(0, 8)}`;
}

function nomeArenaMazzo(nome) {
  return String(nome || "").replace(/[\r\n]+/g, " ").trim().slice(0, 80);
}

function testoArenaMazzo(mazzo) {
  const righe = (mazzo?.carte || []).filter((carta) => carta?.nome && Number(carta?.copie) > 0)
    .map((carta) => `${Number(carta.copie)} ${carta.nome}`);
  if (!righe.length) return "";
  const nome = nomeArenaMazzo(nomeMazzo(mazzo));
  return `${nome ? `About\nName ${nome}\n\n` : ""}Deck\n${righe.join("\n")}\n`;
}

async function copiaTestoArena(bottone, testo) {
  if (!testo) throw new Error("Decklist non disponibile");
  await navigator.clipboard.writeText(testo);
  const etichetta = bottone.textContent;
  bottone.textContent = "Copiato per Arena";
  setTimeout(() => { bottone.textContent = etichetta; }, 1600);
}

function angoliArrotondati(contesto, x, y, larghezza, altezza, raggio = 20) {
  const r = Math.min(raggio, larghezza / 2, altezza / 2);
  contesto.beginPath();
  contesto.moveTo(x + r, y);
  contesto.arcTo(x + larghezza, y, x + larghezza, y + altezza, r);
  contesto.arcTo(x + larghezza, y + altezza, x, y + altezza, r);
  contesto.arcTo(x, y + altezza, x, y, r);
  contesto.arcTo(x, y, x + larghezza, y, r);
  contesto.closePath();
}

function testoCanvas(contesto, testo, massimo) {
  const pulito = String(testo || "").replace(/\s+/g, " ").trim();
  if (contesto.measureText(pulito).width <= massimo) return pulito;
  let accorciato = pulito;
  while (accorciato.length && contesto.measureText(`${accorciato}…`).width > massimo) {
    accorciato = accorciato.slice(0, -1);
  }
  return `${accorciato}…`;
}

function blobCanvas(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (blob) resolve(blob); else reject(new Error("Immagine non creata"));
  }, "image/png"));
}

async function immagineCondivisibileMazzo(mazzo) {
  const carte = (mazzo.carte || []).filter((carta) => carta?.nome && Number(carta?.copie) > 0)
    .sort((a, b) => Number(b.copie) - Number(a.copie) || String(a.nome).localeCompare(String(b.nome), LINGUA));
  if (!carte.length) throw new Error("Decklist non disponibile");
  const larghezza = 1200;
  const righe = Math.ceil(carte.length / 2);
  const altezza = Math.max(1120, 730 + righe * 52 + 100);
  const canvas = document.createElement("canvas");
  canvas.width = larghezza; canvas.height = altezza;
  const contesto = canvas.getContext("2d");
  if (!contesto) throw new Error("Il browser non può creare l'immagine");

  const sfondo = contesto.createLinearGradient(0, 0, larghezza, altezza);
  sfondo.addColorStop(0, "#10081f"); sfondo.addColorStop(.52, "#171027"); sfondo.addColorStop(1, "#07080e");
  contesto.fillStyle = sfondo; contesto.fillRect(0, 0, larghezza, altezza);
  contesto.fillStyle = "rgba(181, 70, 255, .16)"; contesto.beginPath();
  contesto.arc(1040, 130, 300, 0, Math.PI * 2); contesto.fill();
  contesto.fillStyle = "#b950ff"; contesto.fillRect(64, 64, 10, 94);
  contesto.font = "800 34px system-ui, sans-serif"; contesto.fillStyle = "#d47bff";
  contesto.fillText("MOX • MAZZO PERSONALE", 94, 96);
  contesto.font = "900 62px system-ui, sans-serif"; contesto.fillStyle = "#f7f2ff";
  contesto.fillText(testoCanvas(contesto, nomeMazzo(mazzo), 1030), 64, 180);
  contesto.font = "500 26px system-ui, sans-serif"; contesto.fillStyle = "#bfb2ce";
  const meta = [mazzo.formato || mazzo.evento, mazzo.archetipo, mazzo.strategia].filter(Boolean).join(" • ");
  contesto.fillText(testoCanvas(contesto, meta || "Statistiche registrate da Mox", 1060), 64, 224);

  const metricheImmagine = [
    ["PARTITE", String(mazzo.partite ?? 0)], ["VITTORIE", String(mazzo.vittorie ?? 0)],
    ["SCONFITTE", String(mazzo.sconfitte ?? 0)], ["WIN RATE", percentuale(mazzo.win_rate)],
  ];
  metricheImmagine.forEach(([etichetta, valore], indice) => {
    const x = 64 + indice * 272;
    angoliArrotondati(contesto, x, 276, 246, 142); contesto.fillStyle = "#211833"; contesto.fill();
    contesto.strokeStyle = "#6b3d92"; contesto.lineWidth = 2; contesto.stroke();
    contesto.font = "800 18px system-ui, sans-serif"; contesto.fillStyle = "#bdb0ce"; contesto.fillText(etichetta, x + 22, 311);
    contesto.font = "900 42px system-ui, sans-serif"; contesto.fillStyle = "#cf62ff"; contesto.fillText(valore, x + 22, 372);
  });
  contesto.font = "800 30px system-ui, sans-serif"; contesto.fillStyle = "#f7f2ff";
  contesto.fillText(`DECKLIST • ${carte.reduce((totale, carta) => totale + Number(carta.copie), 0)} CARTE`, 64, 492);

  const larghezzaColonna = 520;
  carte.forEach((carta, indice) => {
    const colonna = indice % 2; const riga = Math.floor(indice / 2);
    const x = 64 + colonna * 556; const y = 524 + riga * 52;
    angoliArrotondati(contesto, x, y, larghezzaColonna, 40, 10); contesto.fillStyle = "#191326"; contesto.fill();
    contesto.font = "900 21px system-ui, sans-serif"; contesto.fillStyle = "#cf62ff";
    contesto.fillText(`${Number(carta.copie)}×`, x + 16, y + 27);
    contesto.font = "600 21px system-ui, sans-serif"; contesto.fillStyle = "#f7f2ff";
    contesto.fillText(testoCanvas(contesto, carta.nome, 420), x + 72, y + 27);
  });
  contesto.font = "500 19px system-ui, sans-serif"; contesto.fillStyle = "#bfb2ce";
  contesto.fillText(`Ultima partita: ${dataOra(mazzo.ultima)} • moxtracker.app`, 64, altezza - 42);
  const nome = nomeMazzo(mazzo).toLocaleLowerCase("it-IT").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mazzo";
  return new File([await blobCanvas(canvas)], `mox-${nome}.png`, { type: "image/png" });
}

function scaricaFile(file) {
  const url = URL.createObjectURL(file);
  const collegamento = document.createElement("a");
  collegamento.href = url; collegamento.download = file.name; collegamento.hidden = true;
  document.body.append(collegamento); collegamento.click(); collegamento.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function condividiFile(file, titolo) {
  const condivisione = { title: titolo, text: "Statistiche e decklist Mox", files: [file] };
  if (!(navigator.canShare?.(condivisione) && navigator.share)) return false;
  await navigator.share(condivisione);
  return true;
}

async function copiaImmagine(file) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") return false;
  await navigator.clipboard.write([new ClipboardItem({ [file.type]: file })]);
  return true;
}

function mostraAnteprimaCondivisibile(host, file, mazzo) {
  host.replaceChildren(); host.classList.remove("hidden");
  const titolo = nodo("h3", "", "Anteprima da condividere");
  const nota = nodo("p", "detail-note",
    "L'immagine contiene le statistiche del mazzo e la decklist. Puoi controllarla qui prima di scaricarla o condividerla.");
  if (host._moxPreviewUrl) URL.revokeObjectURL(host._moxPreviewUrl);
  const immagine = document.createElement("img"); immagine.className = "deck-share-image";
  immagine.alt = `Scheda Mox del mazzo ${nomeMazzo(mazzo)}`;
  host._moxPreviewUrl = URL.createObjectURL(file); immagine.src = host._moxPreviewUrl;
  const azioni = nodo("div", "service-actions");
  const condividi = nodo("button", "service-button primary", "Condividi PNG"); condividi.type = "button";
  condividi.addEventListener("click", async () => {
    try {
      if (await condividiFile(file, nomeMazzo(mazzo))) condividi.textContent = "Immagine condivisa";
      else { scaricaFile(file); condividi.textContent = "PNG scaricata"; }
    } catch (errore) {
      if (errore?.name !== "AbortError") { scaricaFile(file); condividi.textContent = "PNG scaricata"; }
    }
    setTimeout(() => { condividi.textContent = "Condividi PNG"; }, 2200);
  });
  const copia = nodo("button", "service-button", "Copia PNG"); copia.type = "button";
  copia.addEventListener("click", async () => {
    try {
      if (await copiaImmagine(file)) copia.textContent = "Immagine copiata";
      else copia.textContent = "Copia non supportata";
    } catch { copia.textContent = "Copia non riuscita"; }
    setTimeout(() => { copia.textContent = "Copia PNG"; }, 2200);
  });
  const scarica = nodo("button", "service-button", "Scarica PNG"); scarica.type = "button";
  scarica.addEventListener("click", () => scaricaFile(file));
  azioni.append(condividi, copia, scarica);
  host.append(titolo, nota, immagine, azioni);
}

function mazzoDellaPartita(partita) {
  return stato.statistiche?.mazzi.find((m) => m.impronta === partita.impronta_mazzo &&
    String(m.formato || "") === String(partita.formato || "")) || null;
}

function cartaRiga(carta, copie = null) {
  const specifica = typeof carta === "object" ? carta : { arena_id: carta, copie };
  const r = nodo("li", "personal-card-row");
  const miniatura = createCardThumbnail(specifica, { compact: true });
  const quantita = nodo("strong", "card-quantity",
    Number(specifica.copie) > 0 ? `${specifica.copie}x` : "");
  const nome = nodo("span", "card-name",
    specifica.nome || `Carta Arena #${specifica.arena_id}`);
  r.append(miniatura, quantita, nome);
  resolveCard(specifica).then((media) => { if (media?.name) nome.textContent = media.name; });
  return r;
}

function listaCarte(titolo, carte, classe = "", nomi = {}, stampe = {}) {
  const sezione = nodo("section", `detail-card-list ${classe}`.trim());
  const elenco = Array.isArray(carte) ? carte
    : Object.entries(carte || {}).map(([arena_id, copie]) => ({
      arena_id: Number(arena_id), copie: Number(copie), nome: nomi[String(arena_id)],
      ...(stampe[String(arena_id)] || {}),
    }));
  const quante = elenco.reduce((n, c) => n + (Number(c.copie) || 1), 0);
  sezione.append(nodo("h3", "", `${titolo} (${quante})`));
  const ul = nodo("ul", "personal-card-list");
  for (const carta of elenco.sort((a, b) => Number(b.copie || 1) - Number(a.copie || 1) ||
    Number(a.arena_id) - Number(b.arena_id))) ul.append(cartaRiga(carta));
  sezione.append(ul);
  return sezione;
}

function mostraDialogo(soprattitolo, titolo, contenuto) {
  $("detail-eyebrow").textContent = soprattitolo;
  $("detail-title").textContent = titolo;
  $("detail-content").replaceChildren(...(Array.isArray(contenuto) ? contenuto : [contenuto]));
  $("detail-dialog").showModal();
}

function metriche(voci) {
  const griglia = nodo("div", "detail-metrics");
  for (const [nome, valore] of voci) {
    const voce = nodo("div", "detail-metric");
    voce.append(nodo("span", "", nome), nodo("strong", "", String(valore ?? "—")));
    griglia.append(voce);
  }
  return griglia;
}

function mostraPanoramica() {
  const t = stato.statistiche.totali;
  $("total-matches").textContent = numeri.format(t.partite);
  $("total-wins").textContent = numeri.format(t.vittorie);
  $("total-losses").textContent = numeri.format(t.sconfitte);
  $("win-rate").textContent = percentuale(t.win_rate);
  $("play-draw").textContent = `${t.al_gioco} / ${t.alla_risposta}`;
  $("average-duration").textContent = durata(t.durata_media);
  $("total-drafts").textContent = numeri.format(stato.dashboard.totali.draft);
  const forma = stato.statistiche.forma_recente.map((p) =>
    nodo("span", `form-dot ${p.esito === "vinta" ? "win" : "loss"}`,
      p.esito === "vinta" ? "V" : "S"));
  $("recent-form").replaceChildren(...forma);
}

function etichettaRank(punto) {
  return `${punto.classe} ${punto.livello}`;
}

function renderRank() {
  const contenitore = $("rank-chart");
  const riepilogo = $("rank-summary");
  const punti = stato.statistiche.andamento_rank || [];
  contenitore.replaceChildren();
  if (!punti.length) {
    riepilogo.textContent = "Nessun rank completo ricevuto.";
    contenitore.append(nodo("p", "detail-note",
      "Arena non ha ancora fornito abbastanza dati completi per tracciare l'andamento."));
    return;
  }
  const primo = punti[0];
  const ultimo = punti.at(-1);
  riepilogo.textContent = `${etichettaRank(primo)} → ${etichettaRank(ultimo)}`;
  const larghezza = 900;
  const altezza = 240;
  const margine = { x: 46, y: 24 };
  const valori = punti.map((p) => Number(p.valore));
  const minimo = Math.min(...valori);
  const massimo = Math.max(...valori);
  const intervallo = Math.max(1, massimo - minimo);
  const coordinate = punti.map((p, indice) => ({
    x: margine.x + (punti.length === 1 ? (larghezza - 2 * margine.x) / 2
      : indice * (larghezza - 2 * margine.x) / (punti.length - 1)),
    y: altezza - margine.y - (Number(p.valore) - minimo) *
      (altezza - 2 * margine.y) / intervallo,
    punto: p,
  }));
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${larghezza} ${altezza}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Andamento rank da ${etichettaRank(primo)} a ${etichettaRank(ultimo)}`);
  svg.classList.add("rank-svg");
  const linea = document.createElementNS(svg.namespaceURI, "polyline");
  linea.setAttribute("points", coordinate.map((p) => `${p.x},${p.y}`).join(" "));
  linea.classList.add("rank-line");
  svg.append(linea);
  for (const coordinata of coordinate) {
    const cerchio = document.createElementNS(svg.namespaceURI, "circle");
    cerchio.setAttribute("cx", coordinata.x);
    cerchio.setAttribute("cy", coordinata.y);
    cerchio.setAttribute("r", "5");
    cerchio.classList.add("rank-point");
    const titolo = document.createElementNS(svg.namespaceURI, "title");
    titolo.textContent = `${etichettaRank(coordinata.punto)} · ${dataOra(coordinata.punto.data)}`;
    cerchio.append(titolo);
    svg.append(cerchio);
  }
  contenitore.append(svg);
}

function renderAvversari() {
  const contenitore = $("opponent-stats");
  const riepilogo = $("opponent-summary");
  const dati = stato.statistiche.avversari || {};
  const gruppi = dati.riconosciuti || [];
  contenitore.replaceChildren();
  riepilogo.textContent = `${gruppi.length} riconosciuti · ${dati.non_riconosciuti || 0} non classificabili`;
  for (const gruppo of gruppi) {
    const voce = nodo("div", "opponent-stat-row");
    const copia = nodo("span", "opponent-stat-copy");
    copia.append(nodo("strong", "", gruppo.nome),
      nodo("small", "", [gruppo.strategia, ...(gruppo.colori || [])].filter(Boolean).join(" · ")));
    const numeriRiga = nodo("span", "opponent-stat-numbers");
    numeriRiga.append(nodo("strong", "", `${gruppo.vittorie} / ${gruppo.sconfitte}`),
      nodo("small", "", `${gruppo.partite} partite · ${percentuale(gruppo.win_rate)}`));
    voce.append(copia, numeriRiga);
    contenitore.append(voce);
  }
  if (!gruppi.length) contenitore.append(nodo("p", "detail-note",
    "Nessun archetipo avversario è riconoscibile con sufficiente certezza dalle sole carte rivelate."));
  if (dati.non_riconosciuti) contenitore.append(nodo("p", "detail-note",
    `${dati.non_riconosciuti} partite restano fuori dalle statistiche: il log non mostrava abbastanza carte avversarie per una classificazione affidabile.`));
}

function creaRigaMazzo(mazzo) {
  const bottone = nodo("button", "personal-deck-row");
  bottone.type = "button";
  const identita = nodo("span", "personal-deck-identity");
  const nome = nodo("span", "personal-deck-name", nomeMazzo(mazzo));
  const meta = nodo("span", "personal-deck-meta",
    [etichettaMazzo(mazzo), mazzo.formato || mazzo.evento || "Formato n.d.",
      mazzo.archetipo && mazzo.archetipo !== mazzo.nome ? mazzo.archetipo : null,
      mazzo.strategia, mazzo.modalita].filter(Boolean).join(" · "));
  const immagini = nodo("span", "personal-deck-cards");
  for (const carta of mazzo.carte.slice().sort((a, b) => b.copie - a.copie).slice(0, 7)) {
    immagini.append(createCardThumbnail(carta));
  }
  identita.append(nome, meta, immagini);
  const dati = nodo("span", "personal-deck-numbers");
  for (const [etichetta, valore] of [
    ["Partite", mazzo.partite], ["V / S", `${mazzo.vittorie} / ${mazzo.sconfitte}`],
    ["Win rate", percentuale(mazzo.win_rate)],
  ]) {
    const voce = nodo("span");
    voce.append(nodo("small", "", etichetta), nodo("strong", "", String(valore)));
    dati.append(voce);
  }
  bottone.append(identita, dati, nodo("span", "row-chevron", "›"));
  bottone.addEventListener("click", () => apriMazzo(mazzo));
  return bottone;
}

function gruppoMazzi(titolo, descrizione, mazzi) {
  const gruppo = nodo("section", "personal-deck-group");
  const testa = nodo("div", "personal-deck-group-head");
  testa.append(nodo("h3", "", titolo), nodo("span", "section-count", String(mazzi.length)));
  gruppo.append(testa, nodo("p", "detail-note", descrizione));
  for (const mazzo of mazzi) gruppo.append(creaRigaMazzo(mazzo));
  return gruppo;
}

function renderMazzi() {
  const contenitore = $("decks");
  contenitore.replaceChildren();
  const tutti = stato.statistiche.mazzi;
  const nascosti = tutti.filter((m) => m.nascosto);
  const visibili = tutti.filter((m) => !m.nascosto);
  const totale = visibili.length;
  $("deck-count").textContent = `${totale} ${totale === 1 ? "mazzo" : "mazzi"}`;
  const sincronizzati = Boolean(stato.statistiche?.sincronizzazione?.mazzi);
  const correnti = sincronizzati ? visibili.filter((m) => m.in_arena) : [];
  const storici = sincronizzati ? visibili.filter((m) => !m.in_arena) : visibili;
  if (correnti.length) contenitore.append(gruppoMazzi("In Arena",
    "Fotografia dell'ultima sincronizzazione di Mox.", correnti));
  if (storici.length) contenitore.append(gruppoMazzi(sincronizzati ? "Storico" : "Dalle partite",
    sincronizzati ? "Liste non più presenti in Arena, conservate insieme alle partite giocate."
      : "Mox non ha ancora inviato la fotografia dei mazzi attuali.", storici));
  if (!totale) contenitore.append(riga("Nessun mazzo disponibile",
    "Le partite senza decklist restano comunque nella cronologia."));
  if (nascosti.length) {
    const dettagli = nodo("details", "hidden-decks");
    dettagli.append(nodo("summary", "", `${nascosti.length} mazzi nascosti`),
      gruppoMazzi("Mazzi nascosti", "Non vengono mostrati nell'archivio normale e tornano visibili soltanto se lo scegli.", nascosti));
    contenitore.append(dettagli);
  }
}

function apriMazzo(mazzo) {
  const azioni = nodo("div", "service-actions");
  const copia = nodo("button", "service-button", "Copia per Arena");
  copia.type = "button";
  copia.addEventListener("click", async () => {
    try { await copiaTestoArena(copia, testoArenaMazzo(mazzo)); }
    catch (errore) { copia.textContent = "Copia non riuscita"; setTimeout(() => { copia.textContent = "Copia per Arena"; }, 1600); }
  });
  const anteprima = nodo("section", "deck-share-preview hidden");
  const condividi = nodo("button", "service-button", "Genera anteprima da condividere");
  condividi.type = "button";
  condividi.addEventListener("click", async () => {
    try {
      condividi.disabled = true;
      const immagine = await immagineCondivisibileMazzo(mazzo);
      mostraAnteprimaCondivisibile(anteprima, immagine, mazzo);
      condividi.textContent = "Anteprima aggiornata";
      setTimeout(() => { condividi.textContent = "Genera anteprima da condividere"; }, 2200);
    } catch (errore) {
      if (errore?.name !== "AbortError") {
        condividi.textContent = "Immagine non riuscita";
        setTimeout(() => { condividi.textContent = "Genera anteprima da condividere"; }, 1600);
      }
    } finally {
      condividi.disabled = false;
    }
  });
  const partite = nodo("button", "service-button primary", "Vedi le sue partite");
  partite.type = "button";
  partite.addEventListener("click", () => {
    $("detail-dialog").close();
    $("filter-deck").value = mazzo.impronta;
    applicaFiltri();
    $("matches-section").scrollIntoView({ behavior: "smooth" });
  });
  const nascondi = nodo("button", "service-button", mazzo.nascosto ? "Mostra nell'archivio" : "Nascondi dall'archivio");
  nascondi.type = "button";
  nascondi.addEventListener("click", async () => {
    nascondi.disabled = true;
    try {
      await api(`/account/decks/${mazzo.impronta}/hidden`, {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ nascosto: !mazzo.nascosto }),
      });
      $("detail-dialog").close(); await carica();
    } finally { nascondi.disabled = false; }
  });
  azioni.append(copia, condividi, partite, nascondi);
  const rinomina = nodo("form", "deck-rename");
  const etichetta = nodo("label", "service-field");
  etichetta.append(nodo("span", "", "Nome personalizzato"));
  const input = nodo("input");
  input.type = "text";
  input.maxLength = 60;
  input.placeholder = mazzo.nome || "Nome del mazzo";
  input.value = mazzo.nome_personalizzato || "";
  etichetta.append(input);
  const salva = nodo("button", "service-button", "Salva nome");
  salva.type = "submit";
  const messaggio = nodo("p", "service-message");
  rinomina.append(etichetta, salva, messaggio);
  rinomina.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    salva.disabled = true;
    try {
      const dato = await api(`/account/decks/${mazzo.impronta}/name`, {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ formato: mazzo.formato, nome: input.value }),
      });
      mazzo.nome_personalizzato = dato.nome;
      renderMazzi();
      popolaFiltri();
      $("detail-title").textContent = nomeMazzo(mazzo);
      messaggio.textContent = dato.nome ? "Nome salvato." : "Nome personalizzato rimosso.";
      messaggio.className = "service-message success";
    } catch (errore) {
      messaggio.textContent = errore.message;
      messaggio.className = "service-message error";
    } finally { salva.disabled = false; }
  });
  const versioni = stato.statistiche.mazzi.filter((altro) => altro.impronta !== mazzo.impronta &&
    nomeMazzo(altro).trim().toLocaleLowerCase(LINGUA) === nomeMazzo(mazzo).trim().toLocaleLowerCase(LINGUA));
  const bloccoVersioni = nodo("section", "deck-versions");
  if (versioni.length) {
    bloccoVersioni.append(nodo("h3", "", "Versioni con lo stesso nome"));
    const base = new Map(mazzo.carte.map((c) => [Number(c.arena_id), Number(c.copie)]));
    for (const versione of versioni) {
      const confronto = new Map(versione.carte.map((c) => [Number(c.arena_id), Number(c.copie)]));
      const cambi = [...new Set([...base.keys(), ...confronto.keys()])]
        .map((id) => ({ id, delta: (confronto.get(id) || 0) - (base.get(id) || 0) }))
        .filter((c) => c.delta);
      bloccoVersioni.append(riga(`${versione.in_arena ? "In Arena" : "Storico"} · ${dataOra(versione.ultima)}`,
        cambi.length ? `${cambi.length} carte con quantità diversa` : "Nessuna differenza di carte"));
    }
  }
  const contenuto = [
    metriche([["Partite", mazzo.partite], ["Vittorie", mazzo.vittorie],
      ["Sconfitte", mazzo.sconfitte], ["Win rate", percentuale(mazzo.win_rate)],
      ["Ultima partita", dataOra(mazzo.ultima)]]),
    rinomina, listaCarte("Decklist osservata", mazzo.carte), anteprima,
  ];
  if (versioni.length) contenuto.push(bloccoVersioni);
  contenuto.push(azioni);
  mostraDialogo("Mazzo personale", nomeMazzo(mazzo), contenuto);
}

function renderDraft() {
  const contenitore = $("draft-sessions");
  contenitore.replaceChildren();
  const tutti = [...stato.statistiche.sessioni_limited.map((sessione) => ({ tipo: "sessione", valore: sessione })),
    ...stato.dashboard.draft.map((draft) => ({ tipo: "draft", valore: draft }))];
  for (const voce of tutti.slice(0, stato.limiteDraft)) {
    if (voce.tipo === "sessione") {
      const sessione = voce.valore;
    const bottone = nodo("button", "limited-card");
    bottone.type = "button";
    bottone.append(nodo("span", "eyebrow", "Risultato dalle partite"),
      nodo("strong", "", sessione.nome),
      nodo("span", "limited-record", `${sessione.vittorie}–${sessione.sconfitte}`),
      nodo("small", "", `${sessione.partite} partite · ${dataOra(sessione.iniziata)}`));
    bottone.addEventListener("click", () => apriSessione(sessione));
    contenitore.append(bottone);
      continue;
    }
    const draft = voce.valore;
    const bottone = nodo("button", "limited-card trace-card");
    bottone.type = "button";
    const partite = Number(draft.partite || 0);
    const risultato = partite
      ? `${Number(draft.vittorie || 0)}–${Number(draft.sconfitte || 0)}`
      : `${draft.pick} pick`;
    bottone.append(nodo("span", "eyebrow", "Traccia Draft"),
      nodo("strong", "", `${draft.set_code} · ${draft.formato}`),
      nodo("span", "limited-record", risultato),
      nodo("small", "", `${draft.pick} pick · ${draft.completo ? "Traccia completa" : "Traccia parziale"}`));
    bottone.addEventListener("click", () => apriDraft(draft.id));
    contenitore.append(bottone);
  }
  if (!contenitore.childNodes.length) contenitore.append(
    riga("Nessun Draft collegato", "I prossimi eventi compariranno qui."));
  aggiornaControlliElenco("draft", tutti.length, stato.limiteDraft);
}

function apriSessione(sessione) {
  const elenco = nodo("div", "session-match-list");
  for (const id of sessione.partite_id) {
    const b = nodo("button", "service-button", `Apri partita ${id}`);
    b.type = "button";
    b.addEventListener("click", () => apriPartita(id));
    elenco.append(b);
  }
  const nota = nodo("p", "detail-note",
    "Il record è calcolato dalle partite effettivamente ricevute. La traccia dei pick può essere separata o parziale nelle vecchie versioni di Mox.");
  mostraDialogo("Sessione Limited", sessione.nome, [
    metriche([["Record", `${sessione.vittorie}–${sessione.sconfitte}`],
      ["Partite", sessione.partite], ["Win rate", percentuale(sessione.win_rate)],
      ["Dal", dataOra(sessione.iniziata)], ["Al", dataOra(sessione.finita)]]),
    nota,
    sessione.decklist?.length ? listaCarte("Decklist del Draft", sessione.decklist)
      : nodo("p", "detail-warning", "La decklist del Draft non è presente nei log ricevuti."),
    elenco,
  ]);
}

async function apriDraft(id) {
  mostraDialogo("Traccia Draft", "Caricamento…",
    nodo("p", "detail-note", "Recupero il pool privato."));
  try {
    const dato = await api(`/account/drafts/${id}`);
    const d = dato.draft;
    const traccia = dato.traccia;
    const partiteCollegate = Array.isArray(dato.partite) ? dato.partite : [];
    const vittorie = partiteCollegate.filter((p) => p.esito === "vinta").length;
    const sconfitte = partiteCollegate.filter((p) => p.esito === "persa").length;
    const contenuto = [metriche([["Set", d.set_code], ["Formato", d.formato],
      ["Pick registrati", d.pick], ["Stato", d.completo ? "Completo" : "Parziale"],
      ["Record collegato", partiteCollegate.length ? `${vittorie}–${sconfitte}` : "Nessuna partita collegata"],
      ["Inizio", dataOra(d.iniziato)]])];
    if (traccia?.pick?.length) {
      let scelte = 0;
      let seguite = 0;
      for (const pick of traccia.pick) {
        const fatte = pick.scelte ?? (pick.scelta !== undefined ? [pick.scelta] : []);
        const consigli = pick.consigli_mox ?? (pick.consiglio_mox !== undefined
          ? [pick.consiglio_mox] : []);
        scelte += fatte.length;
        seguite += fatte.filter((carta) => consigli.includes(carta)).length;
      }
      const riepilogo = nodo("section", "draft-mox-summary");
      riepilogo.append(nodo("h3", "", "Riepilogo Mox"), nodo("p", "detail-note",
        `Mox ha registrato ${scelte} scelte; ${seguite} coincidevano con il consiglio salvato. Il dettaglio pick-by-pick resta fuori dalla prima beta.`));
      contenuto.push(riepilogo);
    }
    if (traccia?.pool_finale?.length) contenuto.push(listaCarte("Pool finale",
      traccia.pool_finale.map((arena_id) => ({ arena_id, copie: 1,
        nome: dato.nomi_carte?.[String(arena_id)],
        ...(dato.stampe_carte?.[String(arena_id)] || {}) }))));
    const versioni = Array.isArray(traccia?.mazzo_giocato) ? traccia.mazzo_giocato : [];
    if (versioni.length) {
      const blocco = nodo("section", "draft-deck-versions");
      blocco.append(nodo("h3", "", `Versioni del mazzo giocato (${versioni.length})`),
        nodo("p", "detail-note", "Ogni versione è una fotografia salvata da Arena. Le differenze sono mostrate rispetto alla versione precedente."));
      let precedente = new Map();
      versioni.forEach((versione, indice) => {
        const carte = new Map([...(versione.mazzo || []), ...(versione.riserva || [])]
          .map(([idCarta, copie]) => [Number(idCarta), Number(copie)]));
        const cambi = [...new Set([...precedente.keys(), ...carte.keys()])]
          .map((idCarta) => ({ idCarta, delta: (carte.get(idCarta) || 0) - (precedente.get(idCarta) || 0) }))
          .filter((voce) => voce.delta);
        const dettaglio = indice === 0 ? `${carte.size} carte distinte`
          : cambi.length ? cambi.map(({ idCarta, delta }) =>
            `${delta > 0 ? "+" : ""}${delta} ${dato.nomi_carte?.[String(idCarta)] || `#${idCarta}`}`).join(" · ")
            : "Nessuna differenza di carte";
        blocco.append(riga(`Versione ${indice + 1} · ${dataOra(versione.quando)}`, dettaglio));
        precedente = carte;
      });
      contenuto.push(blocco);
      const ultima = versioni.at(-1);
      const carteProfilo = [...(ultima.mazzo || []), ...(ultima.riserva || [])]
        .map(([arena_id, copie]) => ({ arena_id, copie,
          nome: dato.nomi_carte?.[String(arena_id)],
          ...(dato.stampe_carte?.[String(arena_id)] || {}) }));
      const profilo = nodo("section", "deck-profile");
      contenuto.push(profilo);
      renderProfiloMazzo(profilo, carteProfilo,
        { campione: `Ultima delle ${versioni.length} versioni registrate da Arena.` });
    }
    if (!traccia) contenuto.push(nodo("p", "detail-note",
      "Il dettaglio del pool non è disponibile, ma l'indice del Draft è conservato."));
    if (traccia && !versioni.length) contenuto.push(nodo("p", "detail-warning",
      "Mox non ha registrato una versione del mazzo montato per questo Draft."));
    if (traccia && Number(d.pick) < traccia.pool_finale.length) contenuto.push(
      nodo("p", "detail-warning",
        `Il pool contiene ${traccia.pool_finale.length} carte, ma Mox registrò soltanto ${d.pick} pick: la cronologia delle scelte è parziale.`));
    mostraDialogo("Traccia Draft", `${d.set_code} · ${d.formato}`, contenuto);
  } catch (errore) {
    mostraDialogo("Traccia Draft", "Impossibile aprire il Draft",
      nodo("p", "detail-warning", errore.message));
  }
}

function popolaFiltri() {
  const deck = $("filter-deck");
  deck.replaceChildren(new Option("Tutti i mazzi", ""));
  for (const mazzo of stato.statistiche.mazzi) {
    deck.append(new Option(nomeMazzo(mazzo), mazzo.impronta));
  }
  // Prima qui si guardavano solo le sessioni Limited: chi voleva filtrare le
  // partite Ladder o i precostruiti non trovava la voce nel menu.
  const event = $("filter-event");
  event.replaceChildren(new Option("Tutti gli eventi", ""));
  for (const evento of stato.statistiche.eventi || []) {
    event.append(new Option(`${evento.nome} (${evento.partite})`, evento.valore));
  }
}

async function caricaPartite(aggiungi = false) {
  const params = new URLSearchParams({ limite: stato.limite,
    offset: aggiungi ? stato.offset : 0 });
  if (stato.filtri.mazzo) params.set("mazzo", stato.filtri.mazzo);
  if (stato.filtri.esito) params.set("esito", stato.filtri.esito);
  if (stato.filtri.evento) params.set("evento", stato.filtri.evento);
  impostaDisabilitatiControlli("matches", true);
  try {
    const dato = await api(`/account/matches?${params}`);
    stato.totale = dato.totale;
    stato.partite = aggiungi ? [...stato.partite, ...dato.partite] : dato.partite;
    stato.offset = stato.partite.length;
    renderPartite();
  } finally { impostaDisabilitatiControlli("matches", false); }
}

function renderPartite() {
  const contenitore = $("matches");
  contenitore.replaceChildren();
  $("matches-count").textContent = `${stato.partite.length} di ${stato.totale}`;
  for (const partita of stato.partite) {
    const mazzo = mazzoDellaPartita(partita);
    const bottone = nodo("button", "personal-match-row");
    bottone.type = "button";
    const esito = nodo("span", `match-result ${partita.esito === "vinta" ? "win" : "loss"}`,
      partita.esito === "vinta" ? "V" : "S");
    const testo = nodo("span", "match-copy");
    testo.append(nodo("strong", "", mazzo ? nomeMazzo(mazzo)
      : (partita.formato || partita.evento || "Partita")),
    nodo("small", "", [dataOra(partita.quando || partita.ricevuta),
      partita.formato || partita.evento, rankPartita(partita)].filter(Boolean).join(" · ")));
    const dati = nodo("span", "match-data", [
      partita.su_gioco === 1 ? "Al gioco" : partita.su_gioco === 0 ? "Alla risposta" : null,
      partita.turni ? `${partita.turni} turni` : null,
      partita.durata ? durata(partita.durata) : null,
    ].filter(Boolean).join(" · "));
    bottone.append(esito, testo, dati, nodo("span", "row-chevron", "›"));
    bottone.addEventListener("click", () => apriPartita(partita.id));
    contenitore.append(bottone);
  }
  if (!stato.partite.length) contenitore.append(
    riga("Nessuna partita con questi filtri", "Prova ad azzerare i filtri."));
  aggiornaControlliElenco("matches", stato.totale, stato.partite.length);
}

function controlloElenco(tipo, posizione, azione, testo) {
  const bottone = nodo("button", "service-button", testo);
  bottone.type = "button";
  bottone.id = `${tipo}-${azione}-${posizione}`;
  bottone.dataset.azione = azione;
  bottone.addEventListener("click", () => gestisciControlloElenco(tipo, azione));
  return bottone;
}

function aggiornaControlliElenco(tipo, totale, mostrati) {
  for (const posizione of ["top", "bottom"]) {
    const host = $(`${tipo}-controls-${posizione}`);
    if (!host) continue;
    host.replaceChildren();
    host.classList.toggle("hidden", totale <= (tipo === "draft" ? PASSO_DRAFT : PASSO_PARTITE));
    if (mostrati < totale) host.append(controlloElenco(tipo, posizione, "espandi",
      tipo === "draft" ? "Mostra altri Draft" : "Mostra altre partite"));
    if (mostrati > (tipo === "draft" ? PASSO_DRAFT : PASSO_PARTITE)) {
      host.append(controlloElenco(tipo, posizione, "riduci",
        tipo === "draft" ? "Riduci a 10 Draft" : "Riduci a 10 partite"));
    }
  }
}

function impostaDisabilitatiControlli(tipo, disabilitato) {
  document.querySelectorAll(`[id^="${tipo}-"][data-azione]`).forEach((bottone) => {
    bottone.disabled = disabilitato;
  });
}

async function gestisciControlloElenco(tipo, azione) {
  if (tipo === "draft") {
    const tutti = (stato.statistiche?.sessioni_limited?.length || 0) + (stato.dashboard?.draft?.length || 0);
    stato.limiteDraft = azione === "espandi" ? Math.min(tutti, stato.limiteDraft + PASSO_DRAFT) : PASSO_DRAFT;
    renderDraft();
    if (azione === "riduci") $("draft-sessions").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (azione === "espandi") { await caricaPartite(true); return; }
  await caricaPartite(false);
  $("matches").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function apriPartita(id) {
  mostraDialogo("Partita", "Caricamento…",
    nodo("p", "detail-note", "Recupero i dettagli privati."));
  try {
    const dato = await api(`/account/matches/${id}`);
    const p = dato.partita;
    const a = p.andamento || {};
    const giochi = nodo("div", "game-flow");
    for (const [indice, esito] of (a.giochi || [a.esito]).entries()) {
      giochi.append(nodo("span", `game-chip ${esito === "vinta" ? "win" : "loss"}`,
        `G${indice + 1} ${esitoTesto(esito)}`));
    }
    const contenuto = [metriche([["Esito", esitoTesto(a.esito)],
      ["Data", dataOra(p.quando)], ["Evento", p.formato || p.evento || "—"],
      ["Partenza", a.su_gioco === true ? "Al gioco" : a.su_gioco === false ? "Alla risposta" : "n.d."],
      ["Turni", p.turni || "n.d."], ["Durata", durata(p.durata)],
      ["Mulligan", a.mulligan ?? "n.d."]]), giochi];
    const limited = /draft|sealed/i.test(`${p.formato || ""} ${p.evento || ""}`);
    if (p.mazzo?.carte && !limited) contenuto.push(
      listaCarte("Il mio mazzo", p.mazzo.carte, "", dato.nomi_carte, dato.stampe_carte));
    if (p.mazzo?.carte && limited) contenuto.push(nodo("p", "detail-note",
      "La decklist completa è mostrata una sola volta nella sessione Draft."));
    if (p.apertura) contenuto.push(
      listaCarte("Mano iniziale osservata", p.apertura, "", dato.nomi_carte, dato.stampe_carte));
    if (p.avversario?.carte?.length) contenuto.push(listaCarte("Carte avversarie rivelate",
      p.avversario.carte.map((arena_id) => ({ arena_id, copie: 1,
        nome: dato.nomi_carte?.[String(arena_id)],
        ...(dato.stampe_carte?.[String(arena_id)] || {}) })), "opponent-cards"));
    else contenuto.push(nodo("p", "detail-note",
      "Nessuna carta avversaria è stata rivelata nel log conservato."));
    mostraDialogo(esitoTesto(a.esito), p.formato || p.evento || "Partita", contenuto);
  } catch (errore) {
    mostraDialogo("Partita", "Impossibile aprire la partita",
      nodo("p", "detail-warning", errore.message));
  }
}

function applicaFiltri() {
  stato.filtri = { mazzo: $("filter-deck").value,
    esito: $("filter-result").value, evento: $("filter-event").value };
  stato.offset = 0;
  caricaPartite(false);
}

async function carica() {
  $("account-loading").classList.remove("hidden");
  try {
    const [dashboard, statistiche, ticket] = await Promise.all([
      api("/account/dashboard"), api("/account/stats"), api("/account/tickets"),
    ]);
    stato.dashboard = dashboard;
    stato.statistiche = statistiche;
    $("account-loading").classList.add("hidden");
    $("account-dashboard").classList.remove("hidden");
    $("account-name").textContent = dashboard.account.nome;
    const provider = new Set(dashboard.account.provider || []);
    const accessi = [...provider].map((p) => p === "google" ? "Google" : "Discord").join(", ");
    $("provider-status").textContent = `Accessi collegati: ${accessi}`;
    $("account-accesses").textContent = `Accessi collegati: ${accessi}. Puoi aggiungere l'altro provider senza creare un secondo account.`;
    $("link-google").classList.toggle("hidden", provider.has("google"));
    $("link-discord").classList.toggle("hidden", provider.has("discord"));
    $("admin-link").classList.toggle("hidden", !dashboard.account.amministratore);
    $("ticket-link").classList.toggle("hidden", dashboard.account.amministratore);
    const invii = [...dashboard.partite.map((p) => p.quando),
      ...dashboard.draft.map((d) => d.ricevuto || d.iniziato)]
      .filter(Boolean).map((v) => new Date(v)).filter((v) => !Number.isNaN(v.getTime()));
    const ultimoInvio = invii.length ? new Date(Math.max(...invii.map((v) => v.getTime()))) : null;
    $("last-send").textContent = ultimoInvio ? dataOra(ultimoInvio.toISOString()) : "nessun invio ricevuto";
    const giorniFermo = ultimoInvio ? Math.floor((Date.now() - ultimoInvio.getTime()) / 86400000) : null;
    $("last-send").classList.toggle("stale-send", giorniFermo === null || giorniFermo >= 3);
    $("last-send").title = giorniFermo === null ? "Nessun contributo ricevuto"
      : giorniFermo >= 3 ? `${giorniFermo} giorni senza nuovi invii: verifica Mox e i consensi.` : "Invio recente";
    mostraElenco($("devices"), dashboard.dispositivi.map((d) => {
      const b = nodo("button", "service-button danger", "Revoca");
      b.type = "button";
      b.addEventListener("click", async () => {
        await api(`/account/devices/${d.mittente}`, { method: "DELETE" });
        await carica();
      });
      const collegato = INGLESE ? "Linked" : "Collegato";
      return riga(d.nome, `${collegato} ${dataOra(d.collegato)} · ${statoConsensi(d)}`, b);
    }), "Nessun dispositivo collegato");
    mostraElenco($("tickets"), ticket.ticket.map((t) => {
      const link = nodo("a", "service-button", "Apri");
      link.href = `./supporto.html?ticket=${t.id}`;
      return riga(t.titolo, `${t.categoria} · ${t.stato.replaceAll("_", " ")}`, link);
    }), "Nessun ticket");
    mostraPanoramica();
    renderMazzi();
    renderRank();
    renderAvversari();
    renderDraft();
    popolaFiltri();
    await caricaPartite(false);
    traduciDocumento();
  } catch (errore) {
    $("account-loading").classList.add("hidden");
    $("account-login").classList.remove("hidden");
    if (errore.stato !== 401) {
      $("login-message").textContent = errore.message;
      $("login-message").className = "service-message error";
    }
    traduciDocumento();
  }
}

$("login-google").href = `${API_BASE}/auth/google?ritorno=${encodeURIComponent(PERCORSO_ACCOUNT)}`;
$("login-discord").href = `${API_BASE}/auth/discord?ritorno=${encodeURIComponent(PERCORSO_ACCOUNT)}`;
$("link-google").href = `${API_BASE}/auth/google?ritorno=${encodeURIComponent(PERCORSO_ACCOUNT)}`;
$("link-discord").href = `${API_BASE}/auth/discord?ritorno=${encodeURIComponent(PERCORSO_ACCOUNT)}`;
$("create-link").addEventListener("click", async () => {
  try {
    const dato = await api("/account/link-code", { method: "POST" });
    $("link-code").textContent = dato.codice;
    $("link-message").textContent = `Scade alle ${new Date(dato.scade).toLocaleTimeString(LINGUA)}.`;
  } catch (e) { $("link-message").textContent = e.message; }
});
$("logout").addEventListener("click", async () => {
  try { await api("/account/logout", { method: "POST" }); }
  finally { eliminaSessionePreview(); location.reload(); }
});
for (const bottone of document.querySelectorAll("[data-export]")) bottone.addEventListener("click", async () => {
  try {
    const dato = await api("/account/export");
    const sezione = bottone.dataset.export;
    const esportato = sezione === "all" ? dato : sezione === "matches"
      ? { versione: dato.versione, esportato: dato.esportato, partite: dato.partite || [] }
      : sezione === "draft"
        ? { versione: dato.versione, esportato: dato.esportato, draft: dato.draft || [] }
        : { versione: dato.versione, esportato: dato.esportato,
          nomi_mazzi: dato.nomi_mazzi || [], mazzi_arena: dato.mazzi_arena || [] };
    const url = URL.createObjectURL(new Blob([JSON.stringify(esportato, null, 2)],
      { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `mox-export-${sezione}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) { $("account-message").textContent = e.message; }
});
for (const bottone of document.querySelectorAll("[data-delete-section]")) {
  bottone.addEventListener("click", async () => {
    const sezione = bottone.dataset.deleteSection;
    const conferma = sezione.toUpperCase();
    if (prompt(`Scrivi ${conferma} per cancellare definitivamente questa sezione`) !== conferma) return;
    try {
      const esito = await api("/account/delete-section", { method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sezione, conferma }) });
      $("account-message").textContent = `${esito.righe} elementi cancellati dalla sezione ${sezione}.`;
      $("account-message").className = "service-message success";
      await carica();
    } catch (e) {
      $("account-message").textContent = e.message;
      $("account-message").className = "service-message error";
    }
  });
}
$("delete-account").addEventListener("click", async () => {
  if (!confirm("Eliminare definitivamente account, contributi, ticket e allegati?")) return;
  if (prompt("Scrivi ELIMINA per confermare") !== "ELIMINA") return;
  try {
    await api("/account/delete", { method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conferma: "ELIMINA" }) });
    location.reload();
  } catch (e) {
    $("account-message").textContent = e.message;
    $("account-message").className = "service-message error";
  }
});
$("filter-deck").addEventListener("change", applicaFiltri);
$("filter-result").addEventListener("change", applicaFiltri);
$("filter-event").addEventListener("change", applicaFiltri);
$("clear-filters").addEventListener("click", () => {
  $("filter-deck").value = ""; $("filter-result").value = "";
  $("filter-event").value = ""; applicaFiltri();
});
$("detail-dialog").addEventListener("click", (evento) => {
  if (evento.target === $("detail-dialog") || evento.target.closest("[data-close]")) {
    $("detail-dialog").close();
  }
});
carica();
