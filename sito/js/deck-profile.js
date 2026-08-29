import { resolveCard } from "./card-images.js";

const TIPI = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Battle", "Land"];
const NOMI_TIPI_ITALIANI = {
  Creature: "Creatura", Instant: "Istantaneo", Sorcery: "Stregoneria", Artifact: "Artefatto",
  Enchantment: "Incantesimo", Planeswalker: "Planeswalker", Battle: "Battaglia", Land: "Terra", Other: "Altro",
};

function copie(carta) {
  return Math.max(1, Number(carta?.copie ?? carta?.copies) || 1);
}

export async function analizzaProfiloMazzo(carte) {
  const voci = (Array.isArray(carte) ? carte : []).filter(Boolean);
  const risolte = await Promise.all(voci.map(async (carta) => ({
    carta, copie: copie(carta), media: await resolveCard(carta),
  })));
  const curva = Array(7).fill(0);
  const tipi = Object.fromEntries([...TIPI, "Other"].map((tipo) => [tipo, 0]));
  const colori = Object.fromEntries(["W", "U", "B", "R", "G", "C"].map((colore) => [colore, 0]));
  const terreSpeciali = [];
  const fixing = [];
  let mancanti = 0;

  for (const voce of risolte) {
    const media = voce.media;
    if (!media) { mancanti += voce.copie; continue; }
    const tipo = TIPI.find((candidate) => media.typeLine?.includes(candidate)) || "Other";
    tipi[tipo] += voce.copie;
    if (tipo !== "Land" && media.manaValue !== null) {
      curva[Math.min(6, Math.max(0, Math.floor(media.manaValue)))] += voce.copie;
    }
    const identita = media.colors?.length ? media.colors : ["C"];
    for (const colore of identita) colori[colore] = (colori[colore] || 0) + voce.copie;
    if (tipo === "Land" && !/\bBasic Land\b/i.test(media.typeLine || "")) {
      terreSpeciali.push({ nome: media.name, copie: voce.copie });
      if ((media.producedMana || []).length >= 2 || /mana of any color/i.test(media.oracleText || "")) {
        fixing.push({ nome: media.name, copie: voce.copie });
      }
    }
  }
  return { curva, tipi, colori, terre_speciali: terreSpeciali, fixing, mancanti };
}

function bloccoProfilo(titolo, classe = "") {
  const blocco = document.createElement("div");
  blocco.className = `deck-profile-block ${classe}`.trim();
  const heading = document.createElement("strong"); heading.textContent = titolo;
  blocco.append(heading);
  return blocco;
}

function rigaValori(titolo, voci) {
  const blocco = bloccoProfilo(titolo, "deck-profile-values-block");
  const elenco = document.createElement("div"); elenco.className = "deck-profile-values";
  for (const [nome, valore] of voci.filter(([, valore]) => Number(valore) > 0)) {
    const voce = document.createElement("span");
    const etichetta = document.documentElement.lang === "it" ? (NOMI_TIPI_ITALIANI[nome] || nome) : nome;
    voce.innerHTML = `<b>${valore}</b> ${etichetta}`; elenco.append(voce);
  }
  blocco.append(elenco);
  return blocco;
}

function testoLingua(italiano, inglese) {
  return document.documentElement.lang === "en" ? inglese : italiano;
}

function curvaGrafica(curva) {
  const blocco = bloccoProfilo("Curva di mana", "deck-profile-curve");
  const grafico = document.createElement("div");
  grafico.className = "mana-curve";
  const voci = [
    ...(Number(curva[0]) > 0 ? [["0", curva[0]]] : []),
    ...curva.slice(1).map((valore, indice) => [indice === 5 ? "6+" : String(indice + 1), valore]),
  ];
  const massimo = Math.max(1, ...voci.map(([, valore]) => Number(valore) || 0));

  for (const [costo, valore] of voci) {
    const colonna = document.createElement("div");
    colonna.className = "mana-curve-column";
    colonna.setAttribute("aria-label", testoLingua(
      `${valore} carte a costo ${costo}`,
      `${valore} cards at mana value ${costo}`,
    ));
    const barra = document.createElement("span");
    barra.className = "mana-curve-bar";
    barra.style.setProperty("--curve-height", `${Math.max(4, Math.round((Number(valore) / massimo) * 42))}px`);
    barra.setAttribute("aria-hidden", "true");
    const etichetta = document.createElement("span");
    etichetta.className = "mana-curve-label";
    etichetta.textContent = costo;
    colonna.append(barra, etichetta);
    grafico.append(colonna);
  }
  blocco.append(grafico);
  return blocco;
}

const NOMI_COLORI = {
  W: ["bianco", "white"], U: ["blu", "blue"], B: ["nero", "black"],
  R: ["rosso", "red"], G: ["verde", "green"], C: ["incolore", "colorless"],
};

function coloriMana(colori) {
  const blocco = bloccoProfilo("Colori del mazzo", "deck-profile-colors");
  const elenco = document.createElement("div"); elenco.className = "deck-color-values";
  for (const colore of ["W", "U", "B", "R", "G", "C"]) {
    const valore = Number(colori[colore]) || 0;
    if (!valore) continue;
    const voce = document.createElement("span"); voce.className = "deck-color-value";
    const [italiano, inglese] = NOMI_COLORI[colore];
    voce.setAttribute("aria-label", testoLingua(
      `${valore} carte ${italiano}`,
      `${valore} ${inglese} cards`,
    ));
    const conto = document.createElement("b"); conto.textContent = String(valore);
    conto.setAttribute("aria-hidden", "true");
    const simbolo = document.createElement("span");
    simbolo.className = `mana-symbol mana-symbol-${colore}`;
    simbolo.textContent = colore;
    simbolo.setAttribute("aria-hidden", "true");
    voce.append(conto, simbolo); elenco.append(voce);
  }
  blocco.append(elenco);
  return blocco;
}

export async function renderProfiloMazzo(host, carte, { campione = "" } = {}) {
  host.replaceChildren();
  const attesa = document.createElement("p"); attesa.className = "detail-note";
  attesa.textContent = "Calcolo curva, tipi e fonti di mana…"; host.append(attesa);
  const profilo = await analizzaProfiloMazzo(carte);
  host.replaceChildren(
    curvaGrafica(profilo.curva),
    rigaValori("Tipi di carta", Object.entries(profilo.tipi)),
    coloriMana(profilo.colori),
  );
  const terre = bloccoProfilo("Terre speciali e fixing");
  const testo = document.createElement("p"); testo.className = "detail-note";
  const nomiTerre = profilo.terre_speciali.map((c) => `${c.copie}× ${c.nome}`);
  const nomiFixing = profilo.fixing.map((c) => c.nome);
  testo.textContent = nomiTerre.length
    ? `${nomiTerre.join(" · ")}${nomiFixing.length ? `. Fixing rilevato: ${nomiFixing.join(", ")}.` : "."}`
    : "Nessuna terra speciale rilevata nella lista.";
  terre.append(testo); host.append(terre);
  if (campione || profilo.mancanti) {
    const nota = document.createElement("p"); nota.className = "variant-note";
    nota.textContent = [campione, profilo.mancanti ? `${profilo.mancanti} carte senza metadati completi.` : ""]
      .filter(Boolean).join(" ");
    host.append(nota);
  }
}
