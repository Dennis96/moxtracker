import { deckLabel, formatInteger, UNCLASSIFIED_DECK_NAME } from "./format.js";

export const COLORS = ["W", "U", "B", "R", "G"];

export function deckArchetypeId(deck) {
  const value = deck?.archetipo_id ?? deck?.id_archetipo ?? null;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function deckColors(deck) {
  const value = Array.isArray(deck?.colori) ? deck.colori : Array.isArray(deck?.colors) ? deck.colors : [];
  return [...new Set(value.map(v => String(v).trim().toUpperCase()).filter(v => COLORS.includes(v)))];
}

export function deckMode(deck) {
  const value = deck?.modalita ?? deck?.mode ?? null;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function deckStrategy(deck) {
  const value = deck?.strategia ?? deck?.strategy ?? null;
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

export function strategyLabel(value) {
  if (!value) return "—";
  const cleaned = String(value).trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : "—";
}

export function deckIsClassified(deck) {
  if (deck?.tipo_dettaglio === "non_classificato") return false;
  if (deck?.nome === UNCLASSIFIED_DECK_NAME || deck?.archetipo === UNCLASSIFIED_DECK_NAME) {
    return Boolean(deckArchetypeId(deck));
  }
  return Boolean(deckArchetypeId(deck) || deck?.tipo_dettaglio === "riconosciuto");
}

export function classificationSummary(deck) {
  if (deck?.tipo_dettaglio === "altro") {
    const gruppi = Number(deck.impronte_raggruppate || 0);
    return gruppi ? `${gruppi} liste non riconosciute raggruppate` : "Liste non riconosciute raggruppate";
  }
  if (!deckIsClassified(deck)) return "Archetipo non ancora confermato";
  const bits = [];
  const colors = deckColors(deck);
  const strategy = deckStrategy(deck);
  const mode = deckMode(deck);
  if (colors.length) bits.push(colors.join("/"));
  if (strategy) bits.push(strategyLabel(strategy));
  if (mode) bits.push(mode);
  return bits.join(" • ") || "Archetipo riconosciuto";
}

export function observedDecklistCards(item) {
  if (item?.origine !== "osservazione_mox") return [];
  if (item?.decklist_pubblicabile !== true) return [];
  return Array.isArray(item?.carte) ? item.carte : [];
}

export function availableStrategies(decks) {
  return [...new Set((Array.isArray(decks) ? decks : []).map(deckStrategy).filter(Boolean))].sort((a, b) => strategyLabel(a).localeCompare(strategyLabel(b), "it"));
}

export function classificationAvailable(decks) {
  return (Array.isArray(decks) ? decks : []).some(deckIsClassified);
}

export function filterMetaDecks(decks, filters = {}) {
  const search = String(filters.search || "").trim().toLocaleLowerCase("it");
  const selectedColors = Array.isArray(filters.colors) ? filters.colors : [];
  const strategy = String(filters.strategy || "").trim().toLowerCase();

  return (Array.isArray(decks) ? decks : []).filter(deck => {
    if (search) {
      const haystack = [
        deckLabel(deck),
        deck?.archetipo,
        deckArchetypeId(deck),
        deckStrategy(deck),
        deckMode(deck),
        deckColors(deck).join(" "),
        deck?.impronta,
        // Cercando «Brew #3» deve restare visibile la riga Altro che la contiene.
        ...(Array.isArray(deck?.varianti_brew) ? deck.varianti_brew.map((variante) => variante?.etichetta) : []),
        // E lo stesso vale per il nome pubblico dei gruppi che stanno dentro
        // la riga Altro: si cerca «Boros Equipment», non l'id del gruppo.
        ...(Array.isArray(deck?.gruppi_brew) ? deck.gruppi_brew.map((gruppo) => gruppo?.nome_pubblico) : []),
      ].filter(Boolean).join(" ").toLocaleLowerCase("it");
      if (!haystack.includes(search)) return false;
    }

    if (selectedColors.length) {
      const colors = deckColors(deck);
      if (!colors.length || !selectedColors.every(color => colors.includes(color))) return false;
    }

    if (strategy && deckStrategy(deck) !== strategy) return false;
    return true;
  });
}

// Gli identificativi opachi dei gruppi Brew (contratto S1): servono soltanto a
// URL e stato della pagina, e non si mostrano mai al visitatore.
export const ID_GRUPPO_BREW = /^bg_[0-9a-f]{32}$/;
export const ID_VARIANTE_BREW = /^bv_[0-9a-f]{32}$/;
const ID_VARIANTE_LEGACY = /^[0-9a-f]{12}$/i;

export function deckDetailUrl(deck, apiFilters = {}) {
  const params = new URLSearchParams();
  if (apiFilters.formato) params.set("formato", apiFilters.formato);
  if (apiFilters.rank) params.set("rank", apiFilters.rank);
  if (apiFilters.periodo) params.set("periodo", apiFilters.periodo);
  const id = deckArchetypeId(deck);
  if (id) {
    params.set("id", id);
  } else if (ID_GRUPPO_BREW.test(String(deck?.gruppo_brew_id || ""))) {
    params.set("id_brew", deck.gruppo_brew_id);
  } else if (typeof deck?.impronta === "string" && deck.impronta.trim()) {
    params.set("impronta", deck.impronta.trim());
  }
  const mode = apiFilters.modalita || deckMode(deck);
  if (mode) params.set("modalita", mode);
  if (!params.has("id") && !params.has("id_brew") && !params.has("impronta")) return null;
  return `./archetipo.html?${params.toString()}`;
}

// I gruppi Brew li decide il server. null vuol dire che il Worker non espone
// ancora il contratto nuovo (o l'ha spento): chi chiama resta sulle vecchie
// `varianti_brew`, cosi' sito e Worker si possono promuovere o riportare
// indietro separatamente. Il browser non raggruppa, non divide e non ricalcola.
export function brewGroups(deck) {
  if (deck?.raggruppamento_brew?.disponibile !== true || !Array.isArray(deck?.gruppi_brew)) return null;
  return deck.gruppi_brew.filter((gruppo) => Array.isArray(gruppo?.varianti_brew) && gruppo.varianti_brew.length > 0);
}

// Dettaglio di un gruppo: l'id canonico se esiste; un gruppo ancora in attesa
// del cron usa il vecchio collegamento per impronta della sua unica lista.
export function brewGroupDetailUrl(gruppo, apiFilters = {}) {
  if (ID_GRUPPO_BREW.test(String(gruppo?.gruppo_brew_id || ""))) {
    return deckDetailUrl({ gruppo_brew_id: gruppo.gruppo_brew_id }, apiFilters);
  }
  if (gruppo?.gruppo_brew_id === null && gruppo?.in_attesa_di_raggruppamento === true) {
    const [variante] = gruppo.varianti_brew || [];
    if (typeof variante?.impronta === "string" && variante.impronta.trim()) {
      return deckDetailUrl({ impronta: variante.impronta }, apiFilters);
    }
  }
  return null;
}

// Il nome pubblico di un gruppo Brew. E' soltanto un'etichetta editoriale
// scelta a mano sulla decklist rappresentativa: non promuove il gruppo ad
// archetipo, che resta «non ancora confermato» nel suo badge. Senza nome il
// titolo e' «Brew», identico in italiano e in inglese; «Gruppo Brew» non si
// usa piu' come titolo, perche' non dice niente di quel mazzo.
export const LUNGHEZZA_MASSIMA_NOME_BREW = 60;
export function brewGroupName(gruppo) {
  const nome = String(gruppo?.nome_pubblico ?? "").trim();
  return nome && nome.length <= LUNGHEZZA_MASSIMA_NOME_BREW ? nome : "Brew";
}

export function brewGroupSummary(gruppo, inglese = false) {
  if (!ID_GRUPPO_BREW.test(String(gruppo?.gruppo_brew_id || ""))) {
    return inglese ? "Published list, not grouped yet" : "Lista pubblicata, non ancora raggruppata";
  }
  const n = gruppo.varianti_brew.length;
  return inglese
    ? `${formatInteger(n)} published ${n === 1 ? "variant" : "variants"}`
    : `${formatInteger(n)} ${n === 1 ? "variante pubblicata" : "varianti pubblicate"}`;
}

// Etichette neutre: nessun indice «#N», che cambierebbe con filtri e ordine.
export function brewVariantLabel(variante, inglese = false) {
  if (variante?.rappresentante === true) return inglese ? "Representative variant" : "Variante rappresentativa";
  return inglese ? "Similar variant" : "Variante simile";
}

// La distanza esce solo se il server la pubblica: con null non si ricostruisce.
export function brewVariantDistance(variante, inglese = false) {
  const carte = variante?.distanza_rappresentante;
  if (variante?.rappresentante === true || !Number.isInteger(carte) || carte < 0) return null;
  if (carte === 0) {
    return inglese ? "Same main deck as the representative variant" : "Stesso mazzo principale della rappresentativa";
  }
  return inglese
    ? `${formatInteger(carte)} ${carte === 1 ? "card differs" : "cards differ"} from the representative variant`
    : `${formatInteger(carte)} ${carte === 1 ? "carta diversa" : "carte diverse"} dalla rappresentativa`;
}

export function validVariantId(valore) {
  const id = String(valore || "");
  return ID_VARIANTE_LEGACY.test(id) || ID_VARIANTE_BREW.test(id);
}

// Quale dettaglio chiede l'URL: uno solo fra archetipo, gruppo Brew e impronta.
export function detailIdentifier(params) {
  const id = (params.get("id") || "").trim();
  const idBrew = (params.get("id_brew") || "").trim();
  const impronta = (params.get("impronta") || "").trim();
  const presenti = [id, idBrew, impronta].filter(Boolean).length;
  if (presenti === 0) return { errore: "Manca l'identificativo dell'archetipo o del mazzo." };
  if (presenti > 1) return { errore: "L'indirizzo contiene più di un identificativo: aprilo di nuovo dal Meta." };
  return id ? { id } : idBrew ? { id_brew: idBrew } : { impronta };
}

// Un vecchio link per impronta diventa l'URL canonico del gruppo, con gli
// stessi filtri e la stessa lista aperta. Ricaricato, quell'URL chiede lo
// stesso gruppo e riapre la stessa variante. Se manca qualcosa resta il
// percorso vecchio: null.
export function canonicalBrewUrl(href, legacy, gruppo) {
  const idGruppo = String(legacy?.gruppo_brew_id || "");
  if (legacy?.tipo_dettaglio !== "non_classificato" || !ID_GRUPPO_BREW.test(idGruppo)) return null;
  if (gruppo?.tipo_dettaglio !== "brew_group" || gruppo.gruppo_brew_id !== idGruppo) return null;
  const url = new URL(href);
  url.searchParams.delete("impronta");
  url.searchParams.delete("id");
  url.searchParams.set("id_brew", idGruppo);
  const variante = String(legacy.variante_brew_id || "");
  const presente = ID_VARIANTE_BREW.test(variante) &&
    (Array.isArray(gruppo.varianti) ? gruppo.varianti : []).some((voce) => voce?.variante_id === variante);
  if (presente) url.searchParams.set("variante", variante);
  else url.searchParams.delete("variante");
  url.hash = "";
  return url.href;
}
