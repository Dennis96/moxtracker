import { resolveCard } from "./card-images.js";

const TIPI = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Battle", "Land"];

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

function rigaValori(titolo, voci) {
  const blocco = document.createElement("div");
  blocco.className = "deck-profile-block";
  const heading = document.createElement("strong"); heading.textContent = titolo;
  const elenco = document.createElement("div"); elenco.className = "deck-profile-values";
  for (const [nome, valore] of voci.filter(([, valore]) => Number(valore) > 0)) {
    const voce = document.createElement("span"); voce.innerHTML = `<b>${valore}</b> ${nome}`; elenco.append(voce);
  }
  blocco.append(heading, elenco);
  return blocco;
}

export async function renderProfiloMazzo(host, carte, { campione = "" } = {}) {
  host.replaceChildren();
  const attesa = document.createElement("p"); attesa.className = "detail-note";
  attesa.textContent = "Calcolo curva, tipi e fonti di mana…"; host.append(attesa);
  const profilo = await analizzaProfiloMazzo(carte);
  const curva = profilo.curva.map((n, i) => [i === 6 ? "6+" : String(i), n]);
  host.replaceChildren(
    rigaValori("Curva di mana", curva),
    rigaValori("Tipi di carta", Object.entries(profilo.tipi)),
    rigaValori("Identità colore", Object.entries(profilo.colori)),
  );
  const terre = document.createElement("div"); terre.className = "deck-profile-block";
  const titolo = document.createElement("strong"); titolo.textContent = "Terre speciali e fixing";
  const testo = document.createElement("p"); testo.className = "detail-note";
  const nomiTerre = profilo.terre_speciali.map((c) => `${c.copie}× ${c.nome}`);
  const nomiFixing = profilo.fixing.map((c) => c.nome);
  testo.textContent = nomiTerre.length
    ? `${nomiTerre.join(" · ")}${nomiFixing.length ? `. Fixing rilevato: ${nomiFixing.join(", ")}.` : "."}`
    : "Nessuna terra speciale rilevata nella lista.";
  terre.append(titolo, testo); host.append(terre);
  if (campione || profilo.mancanti) {
    const nota = document.createElement("p"); nota.className = "variant-note";
    nota.textContent = [campione, profilo.mancanti ? `${profilo.mancanti} carte senza metadati completi.` : ""]
      .filter(Boolean).join(" ");
    host.append(nota);
  }
}
