import { API_BASE } from "./config.js";
import { createCardThumbnail, resolveCard } from "./card-images.js?v=20260822-9";

const $ = (id) => document.getElementById(id);
const numeri = new Intl.NumberFormat("it-IT");
const stato = { dashboard: null, statistiche: null, offset: 0, limite: 30,
  totale: 0, partite: [], filtri: { mazzo: "", esito: "", evento: "" } };

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
  let corpo = null;
  try { corpo = await risposta.json(); } catch { /* risposta non JSON */ }
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
    : data.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
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

function renderMazzi() {
  const contenitore = $("decks");
  contenitore.replaceChildren();
  const totale = stato.statistiche.mazzi.length;
  $("deck-count").textContent = `${totale} ${totale === 1 ? "mazzo" : "mazzi"}`;
  for (const mazzo of stato.statistiche.mazzi) {
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
    contenitore.append(bottone);
  }
  if (!totale) contenitore.append(riga("Nessun mazzo disponibile",
    "Le partite senza decklist restano comunque nella cronologia."));
}

function apriMazzo(mazzo) {
  const azioni = nodo("div", "service-actions");
  const partite = nodo("button", "service-button primary", "Vedi le sue partite");
  partite.type = "button";
  partite.addEventListener("click", () => {
    $("detail-dialog").close();
    $("filter-deck").value = mazzo.impronta;
    applicaFiltri();
    $("matches-section").scrollIntoView({ behavior: "smooth" });
  });
  azioni.append(partite);
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
  mostraDialogo("Mazzo personale", nomeMazzo(mazzo), [
    metriche([["Partite", mazzo.partite], ["Vittorie", mazzo.vittorie],
      ["Sconfitte", mazzo.sconfitte], ["Win rate", percentuale(mazzo.win_rate)],
      ["Ultima partita", dataOra(mazzo.ultima)]]),
    rinomina, listaCarte("Decklist osservata", mazzo.carte), azioni,
  ]);
}

function renderDraft() {
  const contenitore = $("draft-sessions");
  contenitore.replaceChildren();
  for (const sessione of stato.statistiche.sessioni_limited) {
    const bottone = nodo("button", "limited-card");
    bottone.type = "button";
    bottone.append(nodo("span", "eyebrow", "Risultato dalle partite"),
      nodo("strong", "", sessione.nome),
      nodo("span", "limited-record", `${sessione.vittorie}–${sessione.sconfitte}`),
      nodo("small", "", `${sessione.partite} partite · ${dataOra(sessione.iniziata)}`));
    bottone.addEventListener("click", () => apriSessione(sessione));
    contenitore.append(bottone);
  }
  for (const draft of stato.dashboard.draft) {
    const bottone = nodo("button", "limited-card trace-card");
    bottone.type = "button";
    bottone.append(nodo("span", "eyebrow", "Traccia Draft"),
      nodo("strong", "", `${draft.set_code} · ${draft.formato}`),
      nodo("span", "limited-record", `${draft.pick} pick`),
      nodo("small", "", draft.completo ? "Traccia completa" : "Traccia parziale"));
    bottone.addEventListener("click", () => apriDraft(draft.id));
    contenitore.append(bottone);
  }
  if (!contenitore.childNodes.length) contenitore.append(
    riga("Nessun Draft collegato", "I prossimi eventi compariranno qui."));
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
    const contenuto = [metriche([["Set", d.set_code], ["Formato", d.formato],
      ["Pick registrati", d.pick], ["Stato", d.completo ? "Completo" : "Parziale"],
      ["Inizio", dataOra(d.iniziato)]])];
    if (traccia?.pool_finale?.length) contenuto.push(listaCarte("Pool finale",
      traccia.pool_finale.map((arena_id) => ({ arena_id, copie: 1,
        nome: dato.nomi_carte?.[String(arena_id)],
        ...(dato.stampe_carte?.[String(arena_id)] || {}) }))));
    if (!traccia) contenuto.push(nodo("p", "detail-note",
      "Il dettaglio del pool non è disponibile, ma l'indice del Draft è conservato."));
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
  const eventi = new Map();
  for (const sessione of stato.statistiche.sessioni_limited) {
    eventi.set(sessione.evento, sessione.nome);
  }
  const event = $("filter-event");
  event.replaceChildren(new Option("Tutti gli eventi", ""));
  for (const [valore, nome] of eventi) event.append(new Option(nome, valore));
}

async function caricaPartite(aggiungi = false) {
  const params = new URLSearchParams({ limite: stato.limite,
    offset: aggiungi ? stato.offset : 0 });
  if (stato.filtri.mazzo) params.set("mazzo", stato.filtri.mazzo);
  if (stato.filtri.esito) params.set("esito", stato.filtri.esito);
  if (stato.filtri.evento) params.set("evento", stato.filtri.evento);
  $("load-more").disabled = true;
  try {
    const dato = await api(`/account/matches?${params}`);
    stato.totale = dato.totale;
    stato.partite = aggiungi ? [...stato.partite, ...dato.partite] : dato.partite;
    stato.offset = stato.partite.length;
    renderPartite();
  } finally { $("load-more").disabled = false; }
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
  $("load-more").classList.toggle("hidden", stato.partite.length >= stato.totale);
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
    mostraElenco($("devices"), dashboard.dispositivi.map((d) => {
      const b = nodo("button", "service-button danger", "Revoca");
      b.type = "button";
      b.addEventListener("click", async () => {
        await api(`/account/devices/${d.mittente}`, { method: "DELETE" });
        await carica();
      });
      return riga(d.nome, `Collegato ${dataOra(d.collegato)}`, b);
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
  } catch (errore) {
    $("account-loading").classList.add("hidden");
    $("account-login").classList.remove("hidden");
    if (errore.stato !== 401) {
      $("login-message").textContent = errore.message;
      $("login-message").className = "service-message error";
    }
  }
}

tema();
$("login-google").href = `${API_BASE}/auth/google?ritorno=${encodeURIComponent("/account.html")}`;
$("login-discord").href = `${API_BASE}/auth/discord?ritorno=${encodeURIComponent("/account.html")}`;
$("link-google").href = `${API_BASE}/auth/google?ritorno=${encodeURIComponent("/account.html")}`;
$("link-discord").href = `${API_BASE}/auth/discord?ritorno=${encodeURIComponent("/account.html")}`;
$("create-link").addEventListener("click", async () => {
  try {
    const dato = await api("/account/link-code", { method: "POST" });
    $("link-code").textContent = dato.codice;
    $("link-message").textContent = `Scade alle ${new Date(dato.scade).toLocaleTimeString("it-IT")}.`;
  } catch (e) { $("link-message").textContent = e.message; }
});
$("logout").addEventListener("click", async () => {
  await api("/account/logout", { method: "POST" }); location.reload();
});
$("export-data").addEventListener("click", async () => {
  try {
    const dato = await api("/account/export");
    const url = URL.createObjectURL(new Blob([JSON.stringify(dato, null, 2)],
      { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `mox-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) { $("account-message").textContent = e.message; }
});
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
$("load-more").addEventListener("click", () => caricaPartite(true));
$("detail-dialog").addEventListener("click", (evento) => {
  if (evento.target === $("detail-dialog") || evento.target.closest("[data-close]")) {
    $("detail-dialog").close();
  }
});
carica();
