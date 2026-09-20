// S2-BREW-FRONTEND: il sito presenta i gruppi Brew decisi dal server (contratto
// S1) senza raggrupparli da solo. Nel Meta una riga per gruppo e un solo
// riepilogo sotto soglia; link canonici `id_brew` con i filtri; vecchi link per
// impronta che diventano canonici; ritorno alle vecchie `varianti_brew` quando il
// Worker non espone i gruppi. Solo dati sintetici.

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { creaDocumento } from "./finto-dom.js";
import {
  brewGroupDetailUrl, brewGroups, brewGroupSummary, brewVariantDistance, brewVariantLabel,
  canonicalBrewUrl, deckDetailUrl, detailIdentifier, validVariantId,
} from "../sito/js/meta-model.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const leggi = (percorso) => readFileSync(QUI + "../sito/" + percorso, "utf8");
const FILTRI = { formato: "Standard", rank: "Gold,Platinum", periodo: "7", modalita: "BO3" };
const ORDINE = { key: "partite", direction: "desc" };
const G1 = `bg_${"1".repeat(32)}`;
const G2 = `bg_${"2".repeat(32)}`;
const bv = (c) => `bv_${c.repeat(32)}`;
const imp = (c) => c.repeat(64);

function variante(c, partite, vittorie, extra = {}) {
  return {
    variante_id: bv(c), impronta: imp(c), partite, vittorie, sconfitte: partite - vittorie,
    dati_sufficienti: true, win_rate: Math.round((vittorie * 10000) / partite) / 100, quota_meta: 10,
    decklist_pubblicabile: true, rappresentante: false, distanza_rappresentante: null, ...extra,
  };
}

function gruppo(id, varianti, { winRate = 55.55 } = {}) {
  const partite = varianti.reduce((s, v) => s + v.partite, 0);
  const vittorie = varianti.reduce((s, v) => s + v.vittorie, 0);
  return {
    etichetta: "Brew #9", tipo_dettaglio: "brew_group", gruppo_brew_id: id,
    in_attesa_di_raggruppamento: id === null, algoritmo: "main-multiset-radius-v1", soglia_distanza: 4,
    partite, vittorie, sconfitte: partite - vittorie, record_pubblico: true, dati_sufficienti: true,
    win_rate: winRate, quota_meta: 30, varianti_brew: varianti,
  };
}

// La riga «Altro (Brew)» come la produce S1: campi legacy e, accanto, i gruppi.
function meta({ gruppi = [], sotto = { liste: 0, partite: 0 }, disponibile = true, conGruppi = true } = {}) {
  const pubbliche = gruppi.flatMap((g) => g.varianti_brew);
  const partite = pubbliche.reduce((s, v) => s + v.partite, 0) + sotto.partite;
  const vittorie = pubbliche.reduce((s, v) => s + v.vittorie, 0);
  const recordPubblico = sotto.liste === 0;
  const altro = {
    nome: "Altro (Brew)", archetipo: "Altro (Brew)", archetipo_id: null, tipo_dettaglio: "altro",
    strategia: null, colori: [], impronta: null,
    impronte_raggruppate: pubbliche.length + sotto.liste, varianti_rilevate: pubbliche.length + sotto.liste,
    partite, ...(recordPubblico ? { vittorie, sconfitte: partite - vittorie } : {}),
    record_pubblico: recordPubblico, dati_sufficienti: partite >= 30,
    win_rate: recordPubblico && partite >= 30 ? 50 : null, quota_meta: partite >= 30 ? 100 : null,
    varianti_brew: pubbliche.map((v, i) => ({ etichetta: `Brew #${i + 1}`, impronta: v.impronta,
      partite: v.partite, vittorie: v.vittorie, sconfitte: v.sconfitte, dati_sufficienti: true,
      win_rate: v.win_rate, quota_meta: v.quota_meta })),
    brew_sotto_soglia: sotto,
    ...(conGruppi ? { gruppi_brew: gruppi,
      raggruppamento_brew: { algoritmo: "main-multiset-radius-v1", soglia_distanza: 4, disponibile } } : {}),
  };
  return { partite_totali: partite, aggiornato: "2026-09-16T08:00:00Z", soglia_percentuali: 30,
    partite_senza_rank: 0, mazzi: [altro] };
}

// A: due gruppi, il primo con due varianti; 5 liste sotto soglia globali. Il
// win rate del primo gruppo e' volutamente diverso da quello che darebbero V/S:
// il sito deve mostrare quello del server, non ricalcolarlo.
const gruppiMisti = () => [
  gruppo(G1, [variante("a", 45, 27, { rappresentante: true, distanza_rappresentante: 0 }),
    variante("b", 34, 20, { distanza_rappresentante: 4 })], { winRate: 12.34 }),
  gruppo(G2, [variante("c", 31, 15, { rappresentante: true, distanza_rappresentante: 0 })]),
];
const MISTO = () => meta({ gruppi: gruppiMisti(), sotto: { liste: 5, partite: 41 } });
const TUTTO_PUBBLICO = () => meta({ gruppi: gruppiMisti() });
const TUTTO_SOTTO = () => meta({ sotto: { liste: 3, partite: 20 } });
const IN_ATTESA = () => meta({ gruppi: [gruppo(null, [variante("d", 30, 18, { variante_id: null })])] });

let casi = 0;
async function montaMeta(lingua = "it") {
  const documento = creaDocumento(lingua);
  globalThis.document = documento;
  globalThis.window = { addEventListener() {}, innerWidth: 1440, innerHeight: 900,
    location: { hostname: "moxtracker.app", origin: "https://moxtracker.app" } };
  for (const id of ["meta-body", "meta-count", "meta-updated", "meta-threshold", "meta-visible"]) {
    const nodo = documento.createElement("div");
    nodo.id = id;
    documento.body.append(nodo);
  }
  casi += 1;
  const render = await import(`../sito/js/render.js?lingua=${lingua}&caso=s2-${casi}`);
  return { documento, render };
}

async function disegna(dati, lingua = "it") {
  const { documento, render } = await montaMeta(lingua);
  render.renderMeta(dati, ORDINE, {}, FILTRI);
  const [righe, schede] = documento.querySelectorAll(".brew-children");
  return { documento, render, righe, schede };
}

function elementi(nodo) {
  const fuori = [];
  const visita = (n) => { for (const figlio of n.children) { fuori.push(figlio); visita(figlio); } };
  visita(nodo);
  return fuori;
}

const parametri = (href) => new URLSearchParams(String(href).split("?")[1]);

// Niente impronte, id opachi o indici «Brew #N» nel testo, nelle etichette
// accessibili e nei title. Gli id stanno solo negli href dei link canonici.
function nessunIdentificativoVisibile(documento, impronte) {
  const visibile = [documento.body.textContent];
  for (const nodo of elementi(documento.body)) {
    for (const attributo of ["aria-label", "title"]) {
      if (nodo.hasAttribute(attributo)) visibile.push(nodo.getAttribute(attributo));
    }
  }
  const testo = visibile.join("\n");
  assert.doesNotMatch(testo, /bg_|bv_|Brew #/);
  for (const impronta of impronte) assert.equal(testo.includes(impronta.slice(0, 8)), false, impronta);
}

test("A. una riga per gruppo: due varianti dello stesso gruppo non diventano due Brew", async () => {
  const { documento, righe, schede } = await disegna(MISTO());
  const gruppiRighe = righe.querySelectorAll("tr.brew-group");
  assert.equal(gruppiRighe.length, 2, "due gruppi, non tre liste");
  assert.equal(righe.querySelectorAll("tr.brew-child").length, 3, "due gruppi e il riepilogo");
  assert.equal(schede.querySelectorAll(".brew-group").length, 2);
  // Numeri del server, compreso il win rate che non torna con V/S.
  const celle = gruppiRighe[0].querySelectorAll("td").map((td) => td.textContent);
  assert.equal(celle[0], "Gruppo Brew2 varianti pubblicate");
  assert.deepEqual(celle.slice(1, 5), ["79", "47", "32", "12,34%"]);
  assert.match(schede.querySelector(".brew-group").textContent, /12,34%/);
  nessunIdentificativoVisibile(documento, ["a", "b", "c"].map(imp));
});

test("A. link del gruppo: id_brew con tutti i filtri, nessuna impronta", async () => {
  const { righe, schede } = await disegna(MISTO());
  const link = righe.querySelectorAll("a");
  assert.equal(link.length, 2);
  for (const [a, atteso] of [[link[0], G1], [link[1], G2]]) {
    const [pagina] = a.href.split("?");
    const p = parametri(a.href);
    assert.equal(pagina, "./archetipo.html");
    assert.equal(p.get("id_brew"), atteso);
    assert.deepEqual([p.get("formato"), p.get("rank"), p.get("periodo"), p.get("modalita")],
      ["Standard", "Gold,Platinum", "7", "BO3"]);
    assert.equal(p.has("impronta"), false);
    assert.equal(p.has("id"), false);
  }
  assert.equal(link[0].getAttribute("aria-label"), "Apri gruppo Brew da 79 partite");
  const schedeLink = schede.querySelectorAll("a.mobile-brew-child");
  assert.deepEqual(schedeLink.map((a) => parametri(a.href).get("id_brew")), [G1, G2]);
});

test("A. un solo riepilogo sotto soglia, senza link, id o percentuali", async () => {
  const { righe, schede } = await disegna(MISTO());
  for (const contenitore of [righe, schede]) {
    const resto = contenitore.querySelectorAll(".brew-rest");
    assert.equal(resto.length, 1);
    assert.equal(resto[0].querySelector("a"), null);
    assert.match(resto[0].textContent, /5 liste sotto soglia/);
    assert.doesNotMatch(resto[0].textContent, /%/);
  }
  const [riga] = righe.querySelectorAll(".brew-rest");
  assert.match(riga.textContent, /Dati e decklist non pubblicati/);
  assert.match(riga.textContent, /non vengono attribuite ai gruppi/);
  assert.equal(riga.querySelectorAll("td")[1].textContent, "41");
  assert.match(schede.querySelector(".brew-rest").textContent, /41 pt\./);
});

test("A. apertura e chiusura su desktop e mobile, con ARIA coerente e senza controlli annidati", async () => {
  const { documento } = await disegna(MISTO());
  const bottoni = documento.querySelectorAll("button.brew-toggle");
  assert.equal(bottoni.length, 2);
  for (const bottone of bottoni) {
    assert.equal(bottone.type, "button");
    assert.match(bottone.textContent, /^2 gruppi/);
    assert.equal(bottone.getAttribute("aria-label"), "2 gruppi e 5 liste sotto soglia di Altro (Brew)");
    assert.equal(bottone.getAttribute("aria-expanded"), "false");
    const controllato = documento.querySelector(`#${bottone.getAttribute("aria-controls")}`);
    assert.ok(controllato, "aria-controls punta a un elemento vero");
    assert.equal(controllato.hidden, true);
  }
  bottoni[1].click();
  for (const bottone of documento.querySelectorAll("button.brew-toggle")) {
    assert.equal(bottone.getAttribute("aria-expanded"), "true");
    assert.equal(documento.querySelector(`#${bottone.getAttribute("aria-controls")}`).hidden, false);
  }
  bottoni[0].click();
  for (const gruppo of documento.querySelectorAll(".brew-children")) assert.equal(gruppo.hidden, true);
  // Nessun link o pulsante dentro un altro link o pulsante.
  for (const nodo of elementi(documento.body)) {
    if (!["A", "BUTTON"].includes(nodo.tagName)) continue;
    for (let su = nodo.parentNode; su && su.tagName; su = su.parentNode) {
      assert.equal(["A", "BUTTON"].includes(su.tagName), false, `${nodo.tagName} dentro ${su.tagName}`);
    }
  }
});

test("B. tutto pubblico: niente riepilogo sotto soglia e record di Altro pubblicato", async () => {
  const { documento, righe, schede } = await disegna(TUTTO_PUBBLICO());
  assert.equal(documento.querySelectorAll(".brew-rest").length, 0);
  const [bottone] = documento.querySelectorAll("button.brew-toggle");
  assert.equal(bottone.textContent.replace("⌄", ""), "2 gruppi");
  assert.equal(bottone.getAttribute("aria-label"), "2 gruppi di Altro (Brew)");
  assert.equal(righe.querySelectorAll("tr.brew-group").length, 2);
  assert.equal(schede.querySelectorAll(".brew-group").length, 2);
});

test("C. tutto sotto soglia: nessun gruppo, nessun link, solo il riepilogo", async () => {
  const { documento, righe, schede } = await disegna(TUTTO_SOTTO());
  const [bottone] = documento.querySelectorAll("button.brew-toggle");
  assert.equal(bottone.textContent.replace("⌄", ""), "3 liste");
  assert.equal(bottone.getAttribute("aria-label"), "3 liste sotto soglia di Altro (Brew)");
  for (const contenitore of [righe, schede]) {
    assert.equal(contenitore.querySelectorAll("a").length, 0);
    assert.equal(contenitore.querySelectorAll(".brew-group").length, 0);
    assert.equal(contenitore.querySelectorAll(".brew-rest").length, 1);
  }
  nessunIdentificativoVisibile(documento, []);
});

test("D. gruppo in attesa del cron: nessun id inventato, link legacy per impronta", async () => {
  const { documento, righe, schede } = await disegna(IN_ATTESA());
  const [riga] = righe.querySelectorAll("tr.brew-group");
  assert.match(riga.textContent, /Lista pubblicata, non ancora raggruppata/);
  const p = parametri(riga.querySelector("a").href);
  assert.equal(p.get("impronta"), imp("d"));
  assert.equal(p.has("id_brew"), false);
  assert.equal(parametri(schede.querySelector("a.mobile-brew-child").href).get("impronta"), imp("d"));
  // L'impronta sta solo nell'href del collegamento legacy, mai nel testo.
  nessunIdentificativoVisibile(documento, [imp("d")]);
});

test("E. senza gruppi del server il Meta resta quello di prima", async () => {
  for (const dati of [meta({ gruppi: gruppiMisti(), sotto: { liste: 5, partite: 41 }, disponibile: false }),
    meta({ gruppi: gruppiMisti(), sotto: { liste: 5, partite: 41 }, conGruppi: false })]) {
    const { documento, righe } = await disegna(dati);
    assert.equal(documento.querySelectorAll(".brew-group").length, 0);
    const figli = righe.querySelectorAll("tr.brew-child");
    assert.equal(figli.length, 4, "tre liste e il riepilogo, come prima");
    assert.match(figli[0].textContent, /Brew #1/);
    assert.equal(parametri(figli[0].querySelector("a").href).get("impronta"), imp("a"));
    const [bottone] = documento.querySelectorAll("button.brew-toggle");
    assert.equal(bottone.textContent.replace("⌄", ""), "8 liste");
    assert.match(righe.querySelector(".brew-rest").textContent, /compaiono qui una per una/);
  }
});

test("inglese e singolare: testi nella lingua della pagina, «1 group», «1 published variant»", async () => {
  const uno = meta({ gruppi: [gruppo(G1, [variante("a", 31, 16, { rappresentante: true })])],
    sotto: { liste: 1, partite: 1 } });
  const { documento, righe, schede } = await disegna(uno, "en");
  const [bottone] = documento.querySelectorAll("button.brew-toggle");
  assert.equal(bottone.textContent.replace("⌄", ""), "1 group");
  assert.equal(bottone.getAttribute("aria-label"), "1 group and 1 list below threshold in Other (Brew)");
  const [riga] = righe.querySelectorAll("tr.brew-group");
  assert.match(riga.textContent, /^Brew group1 published variant/);
  assert.equal(riga.querySelector("a").getAttribute("aria-label"), "Open Brew group, 31 matches");
  assert.match(righe.querySelector(".brew-rest").textContent, /1 list below threshold/);
  assert.match(righe.querySelector(".brew-rest").textContent, /isn't attributed to any group/);
  assert.equal(schede.querySelector(".brew-group").querySelector(".mobile-brew-child-head")
    .querySelector("span").textContent, "31 matches ›");
  // Ogni testo italiano rimasto ha la sua traduzione a runtime in en.json.
  const en = JSON.parse(leggi("i18n/en.json"));
  const foglie = [];
  const raccogli = (nodo) => {
    for (const figlio of nodo.childNodes) {
      if (figlio.childNodes) raccogli(figlio); else foglie.push(figlio.textContent.trim());
    }
  };
  for (const nodo of [righe, schede]) raccogli(nodo);
  for (const t of foglie.filter((f) => /partit|\blist[ae]\b|soglia|\bApri\b|grupp|variant[ei]|pubblicat|V \/ S/i.test(f))) {
    assert.ok(en[t], `senza traduzione: ${t}`);
  }
  const it = await disegna(meta({ gruppi: [gruppo(G1, [variante("a", 31, 16)])] }));
  assert.match(it.righe.querySelector("tr.brew-group").textContent, /1 variante pubblicata/);
  assert.equal(it.documento.querySelector("button.brew-toggle").textContent.replace("⌄", ""), "1 gruppo");
});

test("stati vuoto ed errore del Meta restano comprensibili", async () => {
  const { documento, render } = await montaMeta();
  render.renderMeta({ ...MISTO(), mazzi: [] }, ORDINE, {}, FILTRI);
  assert.match(documento.querySelector("#meta-body").textContent, /Nessun risultato/);
  render.renderMetaError(new Error("API pubblica non raggiungibile"));
  assert.match(documento.querySelector("#meta-body").textContent, /Meta non disponibile/);
  assert.equal(documento.querySelector("button.retry").type, "button");
});

test("contratto: gruppi solo se il server li dichiara disponibili; il browser non raggruppa", () => {
  assert.equal(brewGroups(MISTO().mazzi[0]).length, 2);
  assert.equal(brewGroups({ ...MISTO().mazzi[0], raggruppamento_brew: { disponibile: false } }), null);
  assert.equal(brewGroups({ gruppi_brew: gruppiMisti() }), null);
  assert.equal(brewGroups({ raggruppamento_brew: { disponibile: true } }), null);
  assert.deepEqual(brewGroups({ raggruppamento_brew: { disponibile: true },
    gruppi_brew: [{ gruppo_brew_id: G1, varianti_brew: [] }] }), []);
  const sorgenti = leggi("js/render.js") + leggi("js/meta-model.js") + leggi("js/archetype.js");
  assert.doesNotMatch(sorgenti, /distanza\s*\(|similarit|firmaMain|pianificaGruppi/i);
});

test("URL di dettaglio: id, poi id_brew, poi impronta; id malformati ignorati", () => {
  const f = { formato: "Standard", periodo: "30" };
  assert.match(deckDetailUrl({ archetipo_id: "aure", gruppo_brew_id: G1, impronta: imp("a") }, f), /[?&]id=aure/);
  const brew = parametri(deckDetailUrl({ gruppo_brew_id: G1, impronta: imp("a") }, f));
  assert.deepEqual([brew.get("id_brew"), brew.has("impronta")], [G1, false]);
  assert.equal(parametri(deckDetailUrl({ gruppo_brew_id: "bg_123", impronta: imp("a") }, f)).get("impronta"), imp("a"));
  assert.equal(deckDetailUrl({ gruppo_brew_id: "bg_123" }, f), null);
  assert.equal(brewGroupDetailUrl({ gruppo_brew_id: null, in_attesa_di_raggruppamento: false,
    varianti_brew: [variante("a", 30, 15)] }, f), null, "senza id e non in attesa: nessun link");
  assert.equal(brewGroupDetailUrl({ gruppo_brew_id: null, in_attesa_di_raggruppamento: true,
    varianti_brew: [{ impronta: "" }] }, f), null);
  assert.equal(brewGroupSummary({ gruppo_brew_id: G1, varianti_brew: [1, 2, 3] }, true), "3 published variants");
});

test("variante: id legacy a 12 caratteri e id opaco bv_, nient'altro", () => {
  assert.equal(validVariantId("0123456789ab"), true);
  assert.equal(validVariantId(bv("e")), true);
  for (const storto of ["", null, G1, `bv_${"e".repeat(31)}`, `bv_${"E".repeat(32)}`, imp("a"), "0123456789abc"]) {
    assert.equal(validVariantId(storto), false, String(storto));
  }
});

test("dettaglio: uno solo fra id, id_brew e impronta", () => {
  const q = (s) => detailIdentifier(new URLSearchParams(s));
  assert.deepEqual(q("formato=Standard&id=aure"), { id: "aure" });
  assert.deepEqual(q(`formato=Standard&id_brew=${G1}`), { id_brew: G1 });
  assert.deepEqual(q(`formato=Standard&impronta=${imp("a")}`), { impronta: imp("a") });
  assert.match(q("formato=Standard").errore, /Manca/);
  assert.match(q(`id_brew=${G1}&impronta=${imp("a")}`).errore, /più di un identificativo/);
});

test("canonicalizzazione: da impronta a id_brew con gli stessi filtri, e al reload lo stesso gruppo", () => {
  const vecchio = `https://moxtracker.app/archetipo.html?formato=Standard&rank=Gold&periodo=7&modalita=BO3&impronta=${imp("b")}&variante=bbbbbbbbbbbb`;
  const legacy = { tipo_dettaglio: "non_classificato", gruppo_brew_id: G1, variante_brew_id: bv("b") };
  const dettaglioGruppo = { tipo_dettaglio: "brew_group", gruppo_brew_id: G1,
    varianti: [variante("a", 45, 27), variante("b", 34, 20)] };
  const canonico = canonicalBrewUrl(vecchio, legacy, dettaglioGruppo);
  const url = new URL(canonico);
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    formato: "Standard", rank: "Gold", periodo: "7", modalita: "BO3", id_brew: G1, variante: bv("b"),
  });
  // Ricaricato, l'URL chiede lo stesso gruppo e riapre la stessa variante; e
  // riapplicare la canonicalizzazione non lo cambia.
  assert.deepEqual(detailIdentifier(url.searchParams), { id_brew: G1 });
  assert.equal(validVariantId(url.searchParams.get("variante")), true);
  assert.equal(canonicalBrewUrl(canonico, legacy, dettaglioGruppo), canonico);

  // La variante che il gruppo non contiene nel filtro corrente non si porta dietro.
  const senza = new URL(canonicalBrewUrl(vecchio, legacy, { ...dettaglioGruppo, varianti: [variante("a", 45, 27)] }));
  assert.equal(senza.searchParams.has("variante"), false);
  // Tutti i casi in cui si resta sul percorso legacy.
  for (const [l, g] of [
    [{ ...legacy, gruppo_brew_id: null }, dettaglioGruppo],
    [{ ...legacy, gruppo_brew_id: "bg_123" }, dettaglioGruppo],
    [{ ...legacy, tipo_dettaglio: "riconosciuto" }, dettaglioGruppo],
    [legacy, { ...dettaglioGruppo, gruppo_brew_id: G2 }],
    [legacy, { ...dettaglioGruppo, tipo_dettaglio: "non_classificato" }],
    [legacy, null],
  ]) {
    assert.equal(canonicalBrewUrl(vecchio, l, g), null);
  }
});

test("etichette delle varianti: neutre, rappresentativa riconoscibile, distanza solo se pubblicata", () => {
  assert.equal(brewVariantLabel({ rappresentante: true }), "Variante rappresentativa");
  assert.equal(brewVariantLabel({ rappresentante: false }), "Variante simile");
  assert.equal(brewVariantLabel({ rappresentante: true }, true), "Representative variant");
  assert.equal(brewVariantDistance({ rappresentante: false, distanza_rappresentante: null }), null);
  assert.equal(brewVariantDistance({ rappresentante: true, distanza_rappresentante: 0 }), null);
  assert.equal(brewVariantDistance({ distanza_rappresentante: 1 }), "1 carta diversa dalla rappresentativa");
  assert.equal(brewVariantDistance({ distanza_rappresentante: 4 }), "4 carte diverse dalla rappresentativa");
  assert.equal(brewVariantDistance({ distanza_rappresentante: 4 }, true), "4 cards differ from the representative variant");
  assert.equal(brewVariantDistance({ distanza_rappresentante: 0 }), "Stesso mazzo principale della rappresentativa");
});

test("API: fetchArchetipo accetta id, id_brew o impronta, mai due insieme", async () => {
  globalThis.window = { location: { hostname: "moxtracker.app", origin: "https://moxtracker.app" } };
  const chiamate = [];
  const fetchPrima = globalThis.fetch;
  globalThis.fetch = async (indirizzo) => {
    chiamate.push(String(indirizzo));
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  try {
    const { fetchArchetipo } = await import("../sito/js/api.js");
    await fetchArchetipo({ ...FILTRI, id_brew: G1 });
    const p = new URL(chiamate[0]).searchParams;
    assert.deepEqual(Object.fromEntries(p), { formato: "Standard", id_brew: G1, rank: "Gold,Platinum",
      periodo: "7", modalita: "BO3" });
    await fetchArchetipo({ ...FILTRI, impronta: imp("a") });
    assert.equal(new URL(chiamate[1]).searchParams.get("impronta"), imp("a"));
    await fetchArchetipo({ ...FILTRI, id: "aure" });
    assert.equal(new URL(chiamate[2]).searchParams.get("id"), "aure");
    assert.throws(() => fetchArchetipo({ ...FILTRI, id: "aure", id_brew: G1 }), /un solo identificativo/);
    assert.throws(() => fetchArchetipo({ ...FILTRI }), /un solo identificativo/);
    assert.equal(chiamate.length, 3);
  } finally {
    globalThis.fetch = fetchPrima;
  }
});

test("dettaglio in inglese: i testi fissi del riepilogo hanno la traduzione, numeri e record nascono in inglese", () => {
  const js = leggi("js/archetype.js");
  const en = JSON.parse(leggi("i18n/en.json"));
  for (const testo of ["Campione sopra soglia", "Pubblicato da 30 partite", "Quota nel filtro corrente",
    "Pubblicata da 30 partite", "Dati insufficienti", "Tutti", "Archetipo non ancora confermato",
    "Mostra decklist osservata", "Copia per Arena", "Decklist pubblicata", "Decklist da 30 partite",
    "L'indirizzo contiene più di un identificativo: aprilo di nuovo dal Meta.",
    "Manca l'identificativo dell'archetipo o del mazzo."]) {
    assert.ok(js.includes(`"${testo}"`) || leggi("js/meta-model.js").includes(`"${testo}"`), `testo assente: ${testo}`);
    assert.ok(en[testo], `senza traduzione: ${testo}`);
  }
  assert.match(js, /`\$\{formatInteger\(dati\.vittorie\)\} W \/ \$\{formatInteger\(dati\.sconfitte\)\} L`/);
  assert.match(js, /partiteLabel = INGLESE \? \(unaPartita \? "match" : "matches"\)/);
});

test("dettaglio: il gruppo Brew non e' un archetipo, e l'URL si canonicalizza senza nuove voci di cronologia", () => {
  const js = leggi("js/archetype.js");
  assert.match(js, /history\.replaceState\(null, "", canonico\.url\)/);
  assert.doesNotMatch(js, /pushState/);
  assert.match(js, /if \(identificativo\.impronta\) \{\s*const canonico = await gruppoCanonico\(data, filtri\);/);
  // Niente catalogo, niente barra di ripartizione, nessun ID per i gruppi Brew.
  assert.match(js, /data\.tipo_dettaglio === "non_classificato" \|\| data\.tipo_dettaglio === "brew_group"/);
  assert.match(js, /if \(data\?\.tipo_dettaglio === "brew_group"\) \{\s*box\.hidden = true;/);
  assert.match(js, /const recognized = !brewGroup && data\.tipo_dettaglio !== "non_classificato"/);
  // Decklist e copia Arena solo per le varianti pubblicabili.
  assert.match(js, /if \(variant\.decklist_pubblicabile !== true\) \{\s*article\.append\(protectedDecklistBlock\(\)\);\s*return;/);
  assert.match(js, /if \(recognized \|\| brewGroup\) aggiornaVarianteNellUrl\(variant, details\.open\)/);
});
