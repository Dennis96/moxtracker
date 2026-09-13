import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { creaDocumento } from "./finto-dom.js";

// «Altro (Brew)» nel Meta Explorer, provato sul render vero con un DOM minimo
// (prove/finto-dom.js).
const QUI = fileURLToPath(new URL(".", import.meta.url));
const leggi = (percorso) => readFileSync(QUI + "../sito/" + percorso, "utf8");
const IMPRONTE = ["c", "b", "a"].map((x) => x.repeat(64));
const FILTRI = { formato: "Standard", rank: "Gold,Platinum", periodo: "7", modalita: "BO3" };
const ORDINE = { key: "partite", direction: "desc" };

function dati({ conVarianti = true } = {}) {
  const altro = {
    nome: "Altro (Brew)", archetipo: "Altro (Brew)", archetipo_id: null, tipo_dettaglio: "altro",
    strategia: null, colori: [], impronta: null, impronte_raggruppate: 3, varianti_rilevate: 3,
    partite: 109, vittorie: 65, sconfitte: 44, dati_sufficienti: true, win_rate: 59.63, quota_meta: 54.5,
  };
  if (conVarianti) {
    altro.varianti_brew = [
      { etichetta: "Brew #1", impronta: IMPRONTE[0], partite: 48, vittorie: 31, sconfitte: 17,
        dati_sufficienti: true, win_rate: 64.58, quota_meta: 24 },
      { etichetta: "Brew #2", impronta: IMPRONTE[1], partite: 37, vittorie: 20, sconfitte: 17,
        dati_sufficienti: true, win_rate: 54.05, quota_meta: 18.5 },
      // Un win rate arrivato per errore sotto soglia non deve comparire.
      { etichetta: "Brew #3", impronta: IMPRONTE[2], partite: 24, vittorie: 14, sconfitte: 10,
        dati_sufficienti: false, win_rate: 58.33, quota_meta: 12 },
    ];
  }
  return { partite_totali: 200, aggiornato: "2026-09-13T10:00:00Z", soglia_percentuali: 30,
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

test("ogni Brew apre il dettaglio della sua impronta con i filtri del Meta", async () => {
  const { documento, render } = await montaMeta();
  render.renderMeta(dati(), ORDINE, {}, FILTRI);
  const gruppi = documento.querySelectorAll(".brew-children");
  assert.equal(gruppi.length, 2);
  for (const gruppo of gruppi) {
    const link = gruppo.querySelectorAll("a");
    assert.equal(link.length, 3);
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

test("il testo non mostra impronte e sotto soglia non pubblica percentuali", async () => {
  const { documento, render } = await montaMeta();
  render.renderMeta(dati(), ORDINE, {}, FILTRI);
  const testo = documento.body.textContent;
  for (const impronta of IMPRONTE) assert.equal(testo.includes(impronta.slice(0, 8)), false);
  const [righe, schede] = documento.querySelectorAll(".brew-children");
  const [prima, , terza] = righe.querySelectorAll("tr");
  assert.match(prima.textContent, /Brew #1/);
  assert.match(prima.textContent, /%/);
  assert.match(terza.textContent, /Brew #3/);
  assert.match(terza.textContent, /Sotto soglia/);
  assert.match(terza.textContent, /24 partite su 30: ne mancano 6/);
  assert.doesNotMatch(terza.textContent, /%/);
  const terzaScheda = schede.querySelectorAll("a")[2];
  assert.match(terzaScheda.textContent, /Sotto soglia/);
  assert.doesNotMatch(terzaScheda.textContent, /%/);
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
  assert.equal(schede.querySelectorAll("a.mobile-brew-child").length, 3);
  bottone.click();
  assert.equal(schede.hidden, false);
});

test("in inglese i testi nuovi nascono in inglese o hanno la traduzione a runtime", async () => {
  const { documento, render } = await montaMeta("en");
  render.renderMeta(dati(), ORDINE, {}, FILTRI);
  const en = JSON.parse(leggi("i18n/en.json"));
  const [desktop, mobile] = documento.querySelectorAll("button.brew-toggle");
  assert.match(desktop.textContent, /3 lists/);
  assert.equal(desktop.getAttribute("aria-label"), "3 lists in Other (Brew)");
  const gruppi = documento.querySelectorAll(".brew-children");
  for (const gruppo of gruppi) {
    for (const a of gruppo.querySelectorAll("a")) {
      if (a.hasAttribute("aria-label")) assert.match(a.getAttribute("aria-label"), /^Open Brew #\d$/);
    }
  }
  // Ogni testo italiano rimasto deve avere la traduzione che translate.js
  // applica a runtime: una chiave esatta di en.json o lo schema «ne mancano».
  const schema = /^\d+ partite su \d+: ne mancano \d+$/;
  assert.match(leggi("js/translate.js"), /partite su .*ne mancano/);
  const foglie = [];
  const raccogli = (nodo) => {
    for (const figlio of nodo.childNodes) {
      if (figlio.childNodes) raccogli(figlio); else foglie.push(figlio.textContent.trim());
    }
  };
  for (const nodo of [desktop, mobile, ...gruppi]) raccogli(nodo);
  const italiane = foglie.filter((t) => /partit|\blist[ae]\b|soglia|\bApri\b|classificat|V \/ S/i.test(t));
  for (const t of italiane) assert.ok(en[t] || schema.test(t), `senza traduzione: ${t}`);
});

test("cercando l'etichetta di una lista Brew resta visibile la riga Altro", async () => {
  const { filterMetaDecks } = await import("../sito/js/meta-model.js");
  const altro = dati().mazzi[0];
  assert.deepEqual(filterMetaDecks([altro], { search: "brew #3" }), [altro]);
  assert.deepEqual(filterMetaDecks([altro], { search: "brew #7" }), []);
});

test("il dettaglio di una lista non classificata non mostra identificativi tecnici", () => {
  const archetipo = leggi("js/archetype.js");
  assert.doesNotMatch(archetipo, /ID tecnico/);
  // L'«ID» della variante compare solo per gli archetipi riconosciuti.
  assert.match(archetipo, /identity\.append\(title, \.\.\.\(recognized \? \[sub\] : \[\]\)\)/);
  assert.match(archetipo, /if \(selection && classified\) tags\.append/);
});

test("senza varianti_brew dall'API la riga Altro resta com'era", async () => {
  const { documento, render } = await montaMeta();
  render.renderMeta(dati({ conVarianti: false }), ORDINE, {}, FILTRI);
  assert.equal(documento.querySelectorAll(".brew-toggle").length, 0);
  assert.equal(documento.querySelectorAll(".brew-children").length, 0);
  assert.match(documento.querySelector("#meta-body").textContent, /Altro \(Brew\)/);
});

test("il gruppo chiuso resta nascosto anche con il CSS e il pulsante ha il focus visibile", () => {
  const css = leggi("css/redesign.css");
  assert.match(css, /\.brew-children\[hidden\] \{ display: none; \}/);
  assert.match(css, /\.brew-toggle:focus-visible/);
});
