import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { creaDocumento } from "./finto-dom.js";

// «Altro (Brew)» nel Meta Explorer, provato sul render vero con un DOM minimo
// (prove/finto-dom.js). Una per una compaiono solo le liste da 30 partite in
// su; le altre restano un conteggio, senza link e senza impronte.
const QUI = fileURLToPath(new URL(".", import.meta.url));
const leggi = (percorso) => readFileSync(QUI + "../sito/" + percorso, "utf8");
const IMPRONTE = ["c", "b"].map((x) => x.repeat(64));
const FILTRI = { formato: "Standard", rank: "Gold,Platinum", periodo: "7", modalita: "BO3" };
const ORDINE = { key: "partite", direction: "desc" };

function dati({ conVarianti = true, pubbliche = 2, sotto = { liste: 7, partite: 67 } } = {}) {
  const altro = {
    nome: "Altro (Brew)", archetipo: "Altro (Brew)", archetipo_id: null, tipo_dettaglio: "altro",
    strategia: null, colori: [], impronta: null, impronte_raggruppate: 9, varianti_rilevate: 9,
    partite: 152, vittorie: 87, sconfitte: 65, dati_sufficienti: true, win_rate: 57.24, quota_meta: 100,
  };
  if (conVarianti) {
    altro.varianti_brew = [
      { etichetta: "Brew #1", impronta: IMPRONTE[0], partite: 48, vittorie: 31, sconfitte: 17,
        dati_sufficienti: true, win_rate: 64.58, quota_meta: 31.58 },
      { etichetta: "Brew #2", impronta: IMPRONTE[1], partite: 37, vittorie: 20, sconfitte: 17,
        dati_sufficienti: true, win_rate: 54.05, quota_meta: 24.34 },
    ].slice(0, pubbliche);
    altro.brew_sotto_soglia = sotto;
    // Come il backend: con liste sotto soglia il record del gruppo non esce.
    altro.record_pubblico = !(sotto?.liste > 0);
    if (!altro.record_pubblico) {
      delete altro.vittorie;
      delete altro.sconfitte;
      altro.win_rate = null;
    }
  }
  return { partite_totali: 152, aggiornato: "2026-09-13T10:00:00Z", soglia_percentuali: 30,
    partite_senza_rank: 0, mazzi: [altro] };
}

let casi = 0;
async function montaMeta(lingua = "it") {
  const documento = creaDocumento(lingua);
  globalThis.document = documento;
  globalThis.window = { addEventListener() {}, innerWidth: 1440, innerHeight: 900 };
  for (const id of ["meta-body", "meta-count", "meta-updated", "meta-threshold", "meta-visible"]) {
    const nodo = documento.createElement("div");
    nodo.id = id;
    documento.body.append(nodo);
  }
  // Un'istanza nuova del modulo per ogni prova: lo stato aperto/chiuso non
  // passa da una prova all'altra.
  casi += 1;
  const render = await import(`../sito/js/render.js?lingua=${lingua}&caso=${casi}`);
  return { documento, render };
}

const controllato = (documento, bottone) =>
  documento.querySelector(`#${bottone.getAttribute("aria-controls")}`);

test("Altro (Brew) parte chiuso, si apre e si richiude dal pulsante", async () => {
  const { documento, render } = await montaMeta();
  render.renderMeta(dati(), ORDINE, {}, FILTRI);
  const bottoni = documento.querySelectorAll("button.brew-toggle");
  assert.equal(bottoni.length, 2, "un pulsante per la tabella e uno per le schede mobili");
  for (const bottone of bottoni) {
    assert.equal(bottone.type, "button");
    assert.match(bottone.textContent, /^9 liste/);
    assert.equal(bottone.getAttribute("aria-expanded"), "false");
    assert.equal(controllato(documento, bottone).hidden, true);
  }
  bottoni[0].click();
  for (const bottone of bottoni) {
    assert.equal(bottone.getAttribute("aria-expanded"), "true");
    assert.equal(controllato(documento, bottone).hidden, false);
  }
  // Riordinare la tabella ridisegna tutto: il gruppo resta aperto.
  render.renderMeta(dati(), { key: "nome", direction: "asc" }, {}, FILTRI);
  const ridisegnati = documento.querySelectorAll("button.brew-toggle");
  assert.equal(ridisegnati[0].getAttribute("aria-expanded"), "true");
  ridisegnati[1].click();
  for (const bottone of documento.querySelectorAll("button.brew-toggle")) {
    assert.equal(bottone.getAttribute("aria-expanded"), "false");
    assert.equal(controllato(documento, bottone).hidden, true);
  }
});

test("ogni Brew da 30 partite apre il dettaglio della sua impronta con i filtri del Meta", async () => {
  const { documento, render } = await montaMeta();
  render.renderMeta(dati(), ORDINE, {}, FILTRI);
  const gruppi = documento.querySelectorAll(".brew-children");
  assert.equal(gruppi.length, 2);
  for (const gruppo of gruppi) {
    const link = gruppo.querySelectorAll("a");
    assert.equal(link.length, 2);
    link.forEach((a, indice) => {
      const [pagina, query] = a.href.split("?");
      assert.equal(pagina, "./archetipo.html");
      const parametri = new URLSearchParams(query);
      assert.equal(parametri.get("impronta"), IMPRONTE[indice]);
      assert.equal(parametri.get("formato"), "Standard");
      assert.equal(parametri.get("rank"), "Gold,Platinum");
      assert.equal(parametri.get("periodo"), "7");
      assert.equal(parametri.get("modalita"), "BO3");
      assert.equal(parametri.has("id"), false);
    });
  }
});

test("le liste sotto soglia restano una voce sola, senza link, impronte o percentuali", async () => {
  const { documento, render } = await montaMeta();
  render.renderMeta(dati(), ORDINE, {}, FILTRI);
  const testo = documento.body.textContent;
  for (const impronta of IMPRONTE) assert.equal(testo.includes(impronta.slice(0, 8)), false);
  const [righe, schede] = documento.querySelectorAll(".brew-children");
  const [prima, , resto] = righe.querySelectorAll("tr");
  assert.match(prima.textContent, /Brew #1/);
  assert.match(prima.textContent, /%/);
  assert.ok(resto.classList.contains("brew-rest"));
  assert.match(resto.textContent, /7 liste sotto soglia/);
  assert.equal(resto.querySelectorAll("td")[1].textContent, "67", "la colonna Partite");
  assert.match(resto.textContent, /Dati e decklist non pubblicati/);
  assert.doesNotMatch(resto.textContent, /%/);
  assert.equal(resto.querySelector("a"), null);
  const voce = schede.querySelector(".brew-rest");
  assert.equal(voce.tagName, "DIV", "la voce mobile non e' un link");
  assert.match(voce.textContent, /7 liste sotto soglia/);
  assert.match(voce.textContent, /67 pt\./);
  assert.equal(voce.querySelector("a"), null);
});

const celleAltro = (documento) =>
  documento.querySelector("tbody").querySelector("tr").querySelectorAll("td").map((td) => td.textContent);

test("con liste sotto soglia la riga Altro mostra partite e quota ma non V/S né win rate", async () => {
  const { documento, render } = await montaMeta();
  render.renderMeta(dati(), ORDINE, {}, FILTRI);
  const celle = celleAltro(documento);
  assert.equal(celle[1], "152");
  assert.equal(celle[2], "—");
  assert.equal(celle[3], "—");
  assert.match(celle[4], /^Non pubblicato/);
  assert.match(celle[4], /finché ci sono liste sotto soglia/);
  assert.doesNotMatch(celle[4], /%/);
  assert.match(celle[5], /100/);
  const scheda = documento.querySelector(".mobile-deck");
  assert.match(scheda.textContent, /V \/ S—/);
  assert.match(scheda.textContent, /Win rateNon pubblicato/);
  assert.doesNotMatch(scheda.textContent, /87|65|57/);
});

test("quando tutte le liste sono pubbliche la riga Altro mostra di nuovo V/S e win rate", async () => {
  const { documento, render } = await montaMeta();
  render.renderMeta(dati({ sotto: { liste: 0, partite: 0 } }), ORDINE, {}, FILTRI);
  const celle = celleAltro(documento);
  assert.equal(celle[2], "87");
  assert.equal(celle[3], "65");
  assert.match(celle[4], /57,24/);
});

test("mobile: la scheda Altro ha il suo pulsante e schede figlie con il link", async () => {
  const { documento, render } = await montaMeta();
  render.renderMeta(dati(), ORDINE, {}, FILTRI);
  const mobile = documento.querySelector(".mobile-meta");
  const bottone = mobile.querySelector("button.brew-toggle");
  assert.ok(bottone);
  assert.equal(bottone.closest("a"), null, "il pulsante non sta dentro un link");
  const schede = controllato(documento, bottone);
  assert.ok(schede.classList.contains("mobile-brew-children"));
  assert.equal(schede.querySelectorAll("a.mobile-brew-child").length, 2);
  bottone.click();
  assert.equal(schede.hidden, false);
});

test("con sole liste sotto soglia il gruppo si apre sul conteggio, senza link", async () => {
  const { documento, render } = await montaMeta();
  render.renderMeta(dati({ pubbliche: 0, sotto: { liste: 3, partite: 20 } }), ORDINE, {}, FILTRI);
  const bottoni = documento.querySelectorAll("button.brew-toggle");
  assert.equal(bottoni.length, 2);
  assert.match(bottoni[0].textContent, /^3 liste/);
  for (const gruppo of documento.querySelectorAll(".brew-children")) {
    assert.equal(gruppo.querySelectorAll("a").length, 0);
    assert.match(gruppo.textContent, /3 liste sotto soglia/);
  }
});

test("in inglese i testi nuovi nascono in inglese o hanno la traduzione a runtime", async () => {
  const { documento, render } = await montaMeta("en");
  render.renderMeta(dati(), ORDINE, {}, FILTRI);
  const en = JSON.parse(leggi("i18n/en.json"));
  const [desktop, mobile] = documento.querySelectorAll("button.brew-toggle");
  assert.match(desktop.textContent, /^9 lists/);
  assert.equal(desktop.getAttribute("aria-label"), "9 lists in Other (Brew)");
  const gruppi = documento.querySelectorAll(".brew-children");
  for (const gruppo of gruppi) {
    for (const a of gruppo.querySelectorAll("a")) {
      if (a.hasAttribute("aria-label")) assert.match(a.getAttribute("aria-label"), /^Open Brew #\d$/);
    }
    assert.match(gruppo.querySelector(".brew-rest").textContent, /7 lists below threshold/);
  }
  assert.match(gruppi[0].textContent, /Data and decklists not published/);
  const celle = celleAltro(documento);
  assert.match(celle[4], /^Not published/);
  assert.match(celle[4], /while some lists are below threshold/);
  // Ogni testo italiano rimasto deve avere la traduzione che translate.js
  // applica a runtime: una chiave esatta di en.json.
  const foglie = [];
  const raccogli = (nodo) => {
    for (const figlio of nodo.childNodes) {
      if (figlio.childNodes) raccogli(figlio); else foglie.push(figlio.textContent.trim());
    }
  };
  for (const nodo of [desktop, mobile, ...gruppi]) raccogli(nodo);
  const italiane = foglie.filter((t) => /partit|\blist[ae]\b|soglia|\bApri\b|classificat|pubblicat|V \/ S/i.test(t));
  for (const t of italiane) assert.ok(en[t], `senza traduzione: ${t}`);
});

test("al singolare: «1 lista sotto soglia», «1 list below threshold», «1 match»", async () => {
  const it = await montaMeta();
  it.render.renderMeta(dati({ sotto: { liste: 1, partite: 1 } }), ORDINE, {}, FILTRI);
  assert.match(it.documento.querySelector(".brew-rest").textContent, /1 lista sotto soglia/);
  const en = await montaMeta("en");
  en.render.renderMeta(dati({ sotto: { liste: 1, partite: 1 } }), ORDINE, {}, FILTRI);
  // Il DOM finto conosce solo selettori semplici: si cerca un livello alla volta.
  const voce = en.documento.querySelector(".mobile-brew-children").querySelector(".brew-rest");
  assert.match(voce.textContent, /1 list below threshold/);
  assert.equal(voce.querySelector(".mobile-brew-child-head").querySelector("span").textContent, "1 match");
  assert.equal(en.documento.querySelector(".mobile-brew-child-head").querySelector("span").textContent,
    "48 matches ›");
});

test("cercando l'etichetta di una lista Brew resta visibile la riga Altro", async () => {
  const { filterMetaDecks } = await import("../sito/js/meta-model.js");
  const altro = dati().mazzi[0];
  assert.deepEqual(filterMetaDecks([altro], { search: "brew #2" }), [altro]);
  assert.deepEqual(filterMetaDecks([altro], { search: "brew #3" }), []);
});

test("il dettaglio di una lista non classificata non mostra identificativi tecnici", () => {
  const archetipo = leggi("js/archetype.js");
  assert.doesNotMatch(archetipo, /ID tecnico/);
  // L'«ID» della variante compare solo per gli archetipi riconosciuti; un
  // gruppo Brew mostra al suo posto, se pubblicata, la distanza (S2).
  assert.match(archetipo, /identity\.append\(title, \.\.\.\(recognized \? \[sub\] : \[\]\), \.\.\.\(distanza \? \[nota\] : \[\]\)\)/);
  assert.match(archetipo, /const recognized = !brewGroup && data\.tipo_dettaglio !== "non_classificato"/);
  assert.match(archetipo, /if \(selection && classified\) tags\.append/);
});

test("la lista Brew pubblicata offre copia Arena, descrizione e profilo", () => {
  const archetipo = leggi("js/archetype.js");
  // Il nome copiato in Arena di un Brew non porta indici instabili (S2).
  // Il nome pubblico del gruppo se c'e', il fallback sicuro di sempre se manca.
  assert.ok(archetipo.includes("? `Variante osservata #${index + 1}`"));
  assert.ok(archetipo.includes(': (brewGroup && nomeBrew && nomeBrew !== "Brew" ? nomeBrew : "Brew MOX");'));
  assert.ok(archetipo.includes("preparaCopiaArena(copia, testoArena(cards, nomeCopia));"));
  assert.doesNotMatch(archetipo, /`Brew #\$\{index \+ 1\}`/);
  assert.match(archetipo, /Lista effettivamente osservata/);
  assert.match(archetipo, /brew-deck-profile/);
  assert.match(archetipo, /renderProfiloMazzo\(profilo, cards/);
});

test("senza varianti_brew dall'API la riga Altro resta com'era", async () => {
  const { documento, render } = await montaMeta();
  render.renderMeta(dati({ conVarianti: false }), ORDINE, {}, FILTRI);
  assert.equal(documento.querySelectorAll(".brew-toggle").length, 0);
  assert.equal(documento.querySelectorAll(".brew-children").length, 0);
  assert.match(documento.querySelector("#meta-body").textContent, /Altro \(Brew\)/);
});

test("il gruppo chiuso resta nascosto anche con il CSS e la voce sotto soglia ha il suo stile", () => {
  const css = leggi("css/redesign.css");
  assert.match(css, /\.brew-children\[hidden\] \{ display: none; \}/);
  assert.match(css, /\.brew-toggle:focus-visible/);
  assert.match(css, /\.brew-rest/);
});
