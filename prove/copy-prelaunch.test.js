import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sito = new URL("../sito/", import.meta.url);
const leggi = (name) => readFileSync(new URL(name, sito), "utf8");

test("privacy, trasparenza e download hanno copy inglese per ogni testo nuovo", () => {
  const en = JSON.parse(leggi("i18n/en.json"));
  const neutral = new Set(["MOX", "Meta", "Draft", "Account", "Home", "Privacy", "GitHub", "Download", "Footer", "Menu", "Research", "Scryfall", "Cloudflare", "Google", "Discord", "Resend", "Windows", "Player.log", "Mox.exe", "MOX.bat", "INSTALLA-MOX.bat", "Dennis Santinelli", "MOX home", "width=device-width, initial-scale=1", "MOX-x.y.z.zip", "collezione.json", "InventoryInfo", "Bug", "rapporto.json", ".zip", "no-referrer", "nome@example.com"]);
  const missing = [];
  for (const name of ["privacy.html", "cosa-invia-mox.html", "download.html", "supporto.html", "note-versione.html"]) {
    const html = leggi(name).replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
    const texts = [...html.matchAll(/>([^<>]+)</g)].map(match => match[1].trim());
    const attrs = [...html.matchAll(/\b(?:aria-label|title|placeholder|alt|content)="([^"]+)"/g)].map(match => match[1].trim());
    for (const value of new Set([...texts, ...attrs])) {
      if (!/[a-zà-ù]/i.test(value) || neutral.has(value) || /^#/.test(value)) continue;
      if (!en[value]) missing.push(`${name}: ${value}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("il sito presenta la soglia matchup 30/100 e dichiara i limiti privacy", () => {
  const meta = leggi("meta.html");
  const privacy = leggi("privacy.html");
  assert.match(meta, /da 30 partite per coppia/);
  assert.match(meta, /da 100 il campione è più solido/);
  assert.match(privacy, /una sola installazione/);
  assert.match(privacy, /pseudonimizzati/);
  assert.match(privacy, /730 giorni/);
  assert.match(privacy, /soglia di scadenza[^<]*730 giorni dalla ricezione sul server/);
  assert.match(privacy, /l'account Arena, l'identificatore dell'installazione o la cronologia personale/);
  assert.doesNotMatch(privacy, /non hanno oggi un termine massimo di conservazione/);
});

test("prima del login Il mio MOX spiega i benefici e nasconde le metriche", () => {
  const html = leggi("account.html");
  const login = html.match(/<section id="account-login"[\s\S]*?<\/section>/)?.[0] || "";
  const dashboard = html.match(/<section id="account-dashboard"[^>]*>/)?.[0] || "";
  assert.match(html, /<h1>Il mio MOX<\/h1>/);
  for (const value of ["statistiche personali", "mazzi sincronizzati", "attività", "facoltativo", "Accedi"]) {
    assert.match(login + html.match(/<header class="page-head">[\s\S]*?<\/header>/)?.[0], new RegExp(value));
  }
  assert.match(dashboard, /class="account-dashboard hidden"/);
  assert.doesNotMatch(login, />0<|>—</);
  const js = leggi("js/account.js");
  assert.match(js, /if \(errore\.stato !== 401\)/);
  assert.match(js, /\$\("account-login"\)\.classList\.remove\("hidden"\)/);
});

test("P1: nomi Draft, 17Lands e retention Research sono coerenti in IT/EN", () => {
  const en = JSON.parse(leggi("i18n/en.json"));
  const pagine = ["index.html", "draft.html", "account.html", "privacy.html", "note-versione.html"]
    .map(leggi).join("\n");
  assert.doesNotMatch(pagine, /Assistente al draft|17lands|Al gioco \/ risposta/);
  assert.match(pagine, /Assistente al Draft/);
  assert.match(pagine, /17Lands/);
  assert.match(pagine, /Al gioco \/ alla risposta/);
  assert.match(leggi("privacy.html"), /per Research è di 730 giorni dalla prima ricezione/);
  assert.match(leggi("privacy.html"), /il completamento può richiedere più cicli/);
  assert.doesNotMatch(leggi("privacy.html"), /massimo di 730 giorni/);
  assert.ok(Object.values(en).some((value) => value.includes("completion may take more than one maintenance run")));
  assert.ok(Object.values(en).some((value) => value.includes("become due for deletion 730 days") && value.includes("completion may require more than one run")));
  assert.match(leggi("account.html"), /Controllo l'accesso…/);
  assert.equal(en["Controllo l'accesso…"], "Checking your sign-in…");
  assert.match(leggi("supporto.html"), /proponi una nuova funzione/);
  assert.match(en["Segnala un bug, un problema nei dati o proponi una nuova funzione. Se non accedi riceverai un link segreto: conservalo, perché è l’unico modo per rileggere il ticket."], /suggest a new feature/);
  assert.doesNotMatch(leggi("note-versione.html"), /Build del sito riproducibile|protezione CORS/);
});
