import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync, sign } from 'node:crypto';
import { acquisisci, API, validaSnapshot, normalizzaRelease, markdownSicuro, noteLingua, sha256 } from '../strumenti/news/modello.mjs';
import { generaPagine, validaFonti, NOTE_UTENTE, GERGO_VIETATO } from '../strumenti/news/pagine.mjs';
import { downloadCoerente } from '../sito/js/download.js';
import { salvaFonti } from '../strumenti/news/fonti.mjs';

const leggi = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)));
const reale = leggi('config/news-releases.json');
const fonti = leggi('config/news-fonti.json');
const key = leggi('config/news-update-public-key.json');
const ora = '2026-10-15T12:00:00.000Z';
const originale = id => ({ id, tag_name: `mox-v2-beta2.12.${id}`, name: `MOX 2.12.${id}`, draft: false, prerelease: false,
  published_at: `2026-10-08T23:30:00Z`, body: 'Note italiane', html_url: `https://github.com/Dennis96/moxtracker/releases/tag/mox-v2-beta2.12.${id}`,
  assets: [{ id, name: `MOX-${id}.zip`, size: 100, digest: null, browser_download_url: `https://github.com/Dennis96/moxtracker/releases/download/mox-v2-beta2.12.${id}/MOX-${id}.zip` }] });
const response = (data, status = 200, headers = {}) => new Response(status === 304 ? null : JSON.stringify(data), { status, headers });
function banco(items = [originale(2), originale(1)], opzioni = {}) {
  const richieste = [];
  return { richieste, fetcher: async (url, init) => {
    richieste.push({ url, headers: init.headers });
    if (opzioni.override) { const r = await opzioni.override(url, richieste.length, init); if (r) return r; }
    if (url.endsWith('/latest')) return response(items.find(r => !r.prerelease && !r.draft));
    if (/\/\d+$/.test(url)) return response({}, 404);
    const n = Number(new URL(url).searchParams.get('page'));
    return response(items.slice((n - 1) * 100, n * 100), 200, { etag: `"page-${n}"` });
  } };
}
async function acquisizione(items, opzioni = {}) { return (await acquisisci({ ...banco(items, opzioni), now: ora, importaLegacy: true, sleep: async () => {} })).snapshot; }

test('A01 — corpus legacy esaustivo, 27 ID/tag/versioni/asset coerenti e paginazione multipla', async () => {
  validaSnapshot(reale);
  const corpus = [...reale.releases, ...reale.tombstones];
  assert.ok(corpus.length >= 27);
  assert.equal(new Set(corpus.map(r => r.id)).size, corpus.length);
  const items = Array.from({ length: 205 }, (_, i) => originale(i + 1));
  const s = await acquisizione(items);
  assert.equal(s.releases.length, 205); assert.equal(s.pages.length, 4);
  assert.deepEqual(s.releases.slice(0, 3).map(r => r.id), [205, 204, 203]);
});

test('A02 — Canary internamente stable, prerelease e soli branch non producono una News Stable', async () => {
  const fixture = originale(9); fixture.body = 'canale: stable';
  const s = (await acquisisci({ ...banco([fixture, { ...originale(8), prerelease: true }, { ...originale(7), draft: true }]), now: ora })).snapshot;
  assert.equal(s.releases.length, 1); assert.equal(s.releases[0].provenance, 'published_unverified');
  assert.equal(s.releases.some(r => r.provenance === 'stable_receipt'), false);
  const f = structuredClone(fonti);
  // Chiave sintetica solo in memoria; non è una chiave MOX o una fonte live.
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const fixtureKey = { algoritmo: 'RS256', esponente: 65537, modulo: Buffer.from(publicKey.export({ format: 'jwk' }).n, 'base64url').toString('hex') };
  f.public_key_sha256 = sha256(JSON.stringify(fixtureKey));
  for (const canale of ['stable', 'canary']) {
    const { firma: vecchiaFirma, ...m } = f.channels[canale].data;
    m.canale = 'stable'; m.versione = canale === 'stable' ? '2 beta 2.11.8' : '2 beta 2.11.9';
    const canone = JSON.stringify(Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b))));
    f.channels[canale].data = { ...m, firma: sign('RSA-SHA256', Buffer.from(canone), privateKey).toString('base64') };
    f.channels[canale].data_sha256 = sha256(JSON.stringify(f.channels[canale].data));
  }
  validaFonti(f, fixtureKey);
  const html = generaPagine(s, f, fixtureKey).get('it/note-versione.html').main;
  assert.doesNotMatch(html, /MOX 2\.12\.9|Note italiane|release-badge/);
  assert.equal(generaPagine(s, f, fixtureKey).size, 4);
});

test('A03 — note originali: vuoto, escape, lingua e provenienza senza inferenze dai commit', () => {
  const corpus = [...reale.releases, ...reale.tombstones];
  const vuota = corpus.find(r => r.version === '2.9.12'); assert.equal(vuota.body.trim(), '');
  const escaped = corpus.find(r => r.version === '2.9.28'); assert.ok(escaped.body.includes('\\n'));
  assert.ok(markdownSicuro(escaped.body).includes('\\n'));
  assert.equal(noteLingua('Testo italiano', 'en').status, 'it_original_en_missing');
  const r = originale(1); r.target_commitish = 'a'.repeat(40); assert.equal(normalizzaRelease(r).source_commit, null);
  r.body = `mox-core source commit = ${'a'.repeat(40)}`; assert.equal(normalizzaRelease(r).source_commit, 'a'.repeat(40));
  const bilingue = '<!-- mox-user-notes-it:start -->\nItaliano\n<!-- mox-user-notes-it:end -->\n<!-- mox-user-notes-en:start -->\nEnglish\n<!-- mox-user-notes-en:end -->';
  assert.equal(noteLingua(bilingue, 'en').text, 'English');
});

test('Sito pubblico — note riservate ai tester bloccano la generazione senza alterare lo snapshot', async () => {
  const r = originale(1); r.body = 'Note Canary riservate ai tester';
  const s = await acquisizione([r]);
  const prima = JSON.stringify(s);
  assert.throws(() => generaPagine(s, fonti, key), /revisione editoriale richiesta/);
  assert.equal(JSON.stringify(s), prima);
});

test('A04 — dettaglio IT/EN con le note scritte per i giocatori, senza dettagli tecnici', () => {
  const p = generaPagine(reale, fonti, key);
  const stable = fonti.channels.stable.data.versione.replace('2 beta ', '');
  const ammessa = r => ['legacy_verified', 'stable_receipt'].includes(r.provenance) || r.version === stable;
  assert.equal([...p.keys()].filter(n => n.startsWith('en/note-versione/')).length, [...reale.releases, ...reale.tombstones].filter(ammessa).length);
  for (const r of reale.releases.filter(ammessa)) {
    const pagina = p.get(`en/note-versione/${r.tag_name.replaceAll('.', '-')}.html`).main;
    assert.ok(pagina.includes(r.published_at));
    assert.doesNotMatch(pagina, /Italian original|SHA-256|release-metadata|github\.com/);
    assert.ok(NOTE_UTENTE[r.version]?.it && NOTE_UTENTE[r.version]?.en, 'nota per i giocatori mancante: ' + r.version);
  }
  assert.doesNotMatch(p.get('it/note-versione.html').main, /\(UTC\)|GitHub Releases/);
});

test('Snapshot schema 1 senza latest_observed resta leggibile offline', () => {
  const vecchio = structuredClone(reale); delete vecchio.latest_observed;
  validaSnapshot(vecchio);
  assert.deepEqual(generaPagine(vecchio, fonti, key), generaPagine(reale, fonti, key));
});

test('Corpus pubblico — 27 legacy conservate e una pubblicazione non attestata esclusa', async () => {
  const nuova = originale(9);
  const s = (await acquisisci({ ...banco([nuova, ...reale.releases]), precedente: reale, now: ora })).snapshot;
  assert.equal(s.releases.length, reale.releases.length + 1);
  const p = generaPagine(s, fonti, key);
  assert.equal([...p.keys()].filter(n => n.startsWith('it/note-versione/')).length, reale.releases.length);
  assert.doesNotMatch(p.get('it/note-versione.html').main, /MOX 2\.12\.9/);
});

for (const status of [403, 429, 500]) test(`A05 — errore ${status} non sostituisce last-valid e rispetta Retry-After`, async () => {
  const prima = JSON.stringify(reale), attese = [], b = banco([], { override: () => response({}, status, { 'retry-after': '2' }) });
  await assert.rejects(acquisisci({ ...b, precedente: reale, now: ora, sleep: async ms => attese.push(ms) }));
  assert.equal(JSON.stringify(reale), prima); assert.equal(b.richieste.length, 3); assert.deepEqual(attese, [2000, 2000]);
});

test('A05 — rate reset lungo, rete, JSON incompleto, pagina mancante e 304 senza cache falliscono chiusi', async () => {
  for (const override of [
    () => response({}, 429, { 'x-ratelimit-reset': String(Date.parse(ora) / 1000 + 3600) }),
    () => { throw new Error('rete assente'); },
    () => new Response('[{', { status: 200 }),
    url => url.includes('page=2') ? response({}, 404) : null,
    () => response(null, 304),
  ]) await assert.rejects(acquisisci({ ...banco(undefined, { override }), now: ora, sleep: async () => {} }));
});

test('A05 — 304 usa solo le pagine complete già validate, snapshot vecchio resta costruibile offline', async () => {
  const s = await acquisizione();
  const b = banco(undefined, { override: url => url.includes('?') ? response(null, 304) : null });
  const r = await acquisisci({ ...b, precedente: s, now: ora });
  assert.equal(r.snapshot.releases.length, s.releases.length);
  assert.equal(b.richieste[0].headers['If-None-Match'], '"page-1"');
  const vecchio = structuredClone(reale); vecchio.fetched_at = '2020-01-01T00:00:00Z'; assert.ok(generaPagine(vecchio, fonti, key).size > 50);
});

test('A06/A12 — job di verifica e build non hanno credenziali o comandi deploy/pubblicazione', () => {
  const workflow = readFileSync(new URL('../.github/workflows/news-verifica.yml', import.meta.url), 'utf8');
  assert.match(workflow, /workflow_dispatch/); assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /wrangler|git push|gh release|secrets\.|pull-requests: write/);
});

test('A07 — vecchi ingressi, SEO, sitemap, ancore e preview sono controllati dalla prova build', () => {
  const p = generaPagine(reale, fonti, key);
  assert.ok(p.has('it/note-versione.html')); assert.ok(p.has('en/note-versione.html'));
  const sorgente = readFileSync(new URL('../strumenti/build_sito.mjs', import.meta.url), 'utf8');
  assert.match(sorgente, /PAGINE_SEO\.add\(nome\)/); assert.match(sorgente, /noindex, nofollow/);
});

test('A08 — Draft e Aggiornamenti accessibili dal menu, home originale e focus preservati', () => {
  const home = readFileSync(new URL('../sito/index.html', import.meta.url), 'utf8');
  for (const route of ['guides', 'updates', 'support', 'account', 'meta', 'draft']) assert.ok(home.includes(`data-route="${route}"`));
  assert.doesNotMatch(home, /Inizia con MOX/);
  const shell = readFileSync(new URL('../sito/js/site-shell.js', import.meta.url), 'utf8');
  assert.match(shell, /bottone\.focus\(\)/); assert.match(shell, /aria-expanded/);
});

test('A09 — duplicati ID/tag/versione, schema, URL e digest errati sono rifiutati', async () => {
  await assert.rejects(acquisizione([originale(1), originale(1)]));
  for (const modifica of [r => r.html_url = 'https://github.com.evil.invalid/Dennis96/moxtracker/releases/tag/a', r => r.assets[0].browser_download_url = 'javascript:alert(1)', r => r.assets[0].digest = 'sha256:errato', r => r.published_at = 'ieri']) {
    const r = originale(1); modifica(r); assert.throws(() => normalizzaRelease(r));
  }
  assert.throws(() => normalizzaRelease({ ...originale(1), published_at: '2026-02-30T00:00:00Z' }));
  const s = structuredClone(reale); s.releases[0].body += 'alterato'; assert.throws(() => validaSnapshot(s));
});

test('A09 — modifica body rilevata; tombstone solo dopo inventario completo e 404 individuale', async () => {
  const prima = await acquisizione(); const r = originale(2); r.body = 'Modificato';
  const s = (await acquisisci({ ...banco([r]), precedente: prima, now: ora })).snapshot;
  assert.equal(s.tombstones.length, 1); assert.equal(s.tombstones[0].id, 1); assert.equal(s.exceptions.some(r => r.type === 'body_changed'), true);
  await assert.rejects(acquisisci({ ...banco([r], { override: url => url.endsWith('/1') ? response(originale(1)) : null }), precedente: prima, now: ora }));
});

test('A09 — XSS/HTML raw, immagini, script, iframe, URL manipolati restano testo inerte', () => {
  const html = markdownSicuro('<script>alert(1)</script>\n<img src="https://tracker.invalid/x">\n<iframe src="x"></iframe>\n![x](https://tracker.invalid/x)\n[x](javascript:alert(1))\n[x](data:text/html,x)\n[x](https://user:password@example.org/x)\n[x](https://example.org/x)\n`<svg onload=alert(1)>`');
  assert.doesNotMatch(html, /<(?:script|iframe|img|svg)\b|href="(?:javascript|data):|href="https:\/\/user:/i);
  assert.match(html, /&lt;script&gt;/); assert.match(html, /href="https:\/\/example.org\/x"/);
  assert.equal(markdownSicuro('**<img src=x onerror=alert(1)>**'), '<p><strong>&lt;img src=x onerror=alert(1)&gt;</strong></p>');
});

test('A10 — Latest errata, rollback Stable, Canary internamente stable e ZIP manipolato bloccano la CTA', () => {
  const r = originale(2), s = { disponibile: true, versione: '2 beta 2.12.2', canale: 'stable' };
  assert.equal(downloadCoerente(r, s), true);
  assert.equal(downloadCoerente(r, { ...s, versione: '2 beta 2.12.1' }), false);
  assert.equal(downloadCoerente(r, fonti.channels.canary.data), false);
  assert.equal(downloadCoerente({ ...r, prerelease: true }, s), false);
  const dannoso = structuredClone(r); dannoso.assets[0].browser_download_url += '?redirect=evil'; assert.equal(downloadCoerente(dannoso, s), false);
});

test('A11 — gate editoriale futuro richiede IT/EN, provenienza e checklist Privacy senza invalidare legacy', () => {
  const procedura = readFileSync(new URL('../passaggi/sito/NEWS-SNAPSHOT-E-GATE.md', import.meta.url), 'utf8');
  assert.match(procedura, /mox-user-notes-it:start/); assert.match(procedura, /mox-user-notes-en:start/); assert.match(procedura, /Privacy/); assert.match(procedura, /OWNER APPROVAL REQUIRED/);
  assert.ok(reale.releases.some(r => r.provenance === 'legacy_verified'));
});

test('Review R01 — ogni nuovo click riverifica le fonti; richieste concorrenti condivise solo in corso', async () => {
  const precedente = globalThis.fetch;
  let numero = 2, chiamate = 0;
  globalThis.fetch = async (url, options) => {
    chiamate++; assert.equal(options.cache, 'no-store');
    return response(url.includes('/latest') ? originale(numero) : { disponibile: true, versione: `2 beta 2.12.${numero}` });
  };
  try {
    const { releaseGitHubLatest, releaseStable } = await import('../sito/js/download.js?review-r01');
    const coppia = async () => Promise.all([releaseGitHubLatest(), releaseStable()]);
    const [prima, contemporanea] = await Promise.all([coppia(), coppia()]);
    assert.equal(chiamate, 2); assert.equal(prima[0].id, contemporanea[0].id);
    numero = 1;
    const seconda = await coppia(); assert.equal(chiamate, 4); assert.equal(seconda[0].id, 1);
    assert.equal(downloadCoerente(prima[0], seconda[1]), false);
  } finally { globalThis.fetch = precedente; }
});

test('Review R02 — tombstone preservata quando l’ID ricompare solo prerelease/draft', async () => {
  const prima = await acquisizione();
  const ritirata = (await acquisisci({ ...banco([originale(2)]), precedente: prima, now: ora })).snapshot;
  for (const stato of ['prerelease', 'draft']) {
    const s = (await acquisisci({ ...banco([originale(2), { ...originale(1), [stato]: true }]), precedente: ritirata, now: ora })).snapshot;
    assert.equal(s.tombstones.length, 1); assert.equal(s.tombstones[0].id, 1);
  }
});

test('Review R03 — delimitatori bilingui CRLF non cambiano hash o lingua', () => {
  const body = '<!-- mox-user-notes-it:start -->\r\nItaliano\r\n<!-- mox-user-notes-it:end -->\r\n<!-- mox-user-notes-en:start -->\r\nEnglish\r\n<!-- mox-user-notes-en:end -->';
  assert.equal(noteLingua(body, 'en').text, 'English'); assert.equal(noteLingua(body, 'it').text, 'Italiano');
});

test('Review R04 — data e asset discordanti dalla cache sono rifiutati', () => {
  for (const muta of [s => s.releases[0].published_at = '2000-01-01T00:00:00Z', s => s.releases[0].assets[0].size = 1]) {
    const s = structuredClone(reale); muta(s); assert.throws(() => validaSnapshot(s), /discordanti/);
  }
});

test('Review R05 — un 200 JSON con manifesto pubblico invalido non scrive né sostituisce last-valid', async () => {
  let scritture = 0;
  await assert.rejects(salvaFonti(key, { now: fonti.verified_at,
    fetcher: async url => response(url.includes('canale=stable') ? fonti.channels.stable.data : url.includes('canale=canary') ? fonti.channels.canary.data : { error: 'upstream schema drift' }),
    scrivi: async () => { scritture++; }, sposta: async () => { scritture++; },
  }));
  assert.equal(scritture, 0);
});

test('Review R06 — 28 pubblicazioni senza attestazione restano interne, ricevuta ammette solo la versione verificata', async () => {
  const items = Array.from({ length: 28 }, (_, i) => originale(i + 1));
  items[0].body = '<!-- mox-user-notes-en:start -->\nEnglish approved\n<!-- mox-user-notes-en:end -->\nmox-core source commit = ' + 'a'.repeat(40);
  const s = (await acquisisci({ ...banco(items), now: ora })).snapshot;
  const p = generaPagine(s, fonti, key);
  assert.equal([...p.keys()].filter(n => n.startsWith('en/note-versione/')).length, 0);
  assert.equal(s.releases.every(r => r.provenance === 'published_unverified'), true);
  const ricevuta = { version: '2.12.1', source_commit: 'a'.repeat(40), verified_at: ora };
  const verificato = (await acquisisci({ ...banco(items), now: ora, receipts: [ricevuta] })).snapshot;
  const ammessa = generaPagine(verificato, fonti, key);
  assert.equal([...ammessa.keys()].filter(n => n.startsWith('en/note-versione/')).length, 1);
  assert.match(ammessa.get('en/note-versione/mox-v2-beta2-12-1.html').main, /English approved/);
});

test('Review R07 — duplicato nelle pagine conservate rifiutato anche con hash cache ricalcolato', () => {
  const s = structuredClone(reale); s.pages[0].data[1] = structuredClone(s.pages[0].data[0]);
  s.pages[0].body_sha256 = sha256(JSON.stringify(s.pages[0].data));
  assert.throws(() => validaSnapshot(s), /Duplicati/);
});

test('Review R08 — tre retry navbar riusano un messaggio; successo rimuove messaggio e riabilita CTA', async () => {
  const originali = { fetch: globalThis.fetch, window: globalThis.window, document: globalThis.document };
  let callback, creati = 0, successo = false, navigazioni = 0;
  const header = { nextElementSibling: null, after(n) { this.nextElementSibling = n; } };
  const attrs = new Map();
  const link = { dataset: {}, nextElementSibling: null, closest: () => header,
    setAttribute: (k,v) => attrs.set(k,v), removeAttribute: k => attrs.delete(k),
    addEventListener: (_event, f) => { callback = f; } };
  globalThis.window = { location: { assign: () => { navigazioni++; } } };
  globalThis.document = { documentElement: { lang: 'it' }, createElement: () => { creati++; return { dataset: {}, setAttribute() {}, matches: () => true, remove() { header.nextElementSibling = null; } }; } };
  globalThis.fetch = async url => {
    if (!successo) throw new Error('offline');
    return response(url.includes('/latest') ? originale(2) : { disponibile: true, versione: '2 beta 2.12.2' });
  };
  try {
    const { preparaDownloadLatest } = await import('../sito/js/download.js?review-r08');
    preparaDownloadLatest({ querySelectorAll: () => [link] });
    const click = () => callback({ button: 0, preventDefault() {} });
    await click(); await click(); await click();
    assert.equal(creati, 1); assert.ok(header.nextElementSibling.textContent.includes('Stable'));
    successo = true; await click();
    assert.equal(navigazioni, 1); assert.equal(header.nextElementSibling, null);
    assert.equal(attrs.has('aria-busy'), false); assert.equal(link.dataset.downloadInCorso, 'false');
  } finally { Object.assign(globalThis, originali); }
});

test('Guide e News pubbliche parlano ai giocatori: niente gergo da sviluppatori o da tester', () => {
  for (const [nome, pagina] of generaPagine(reale, fonti, key)) {
    assert.doesNotMatch(pagina.main.replace(/<[^>]+>/g, ' '), GERGO_VIETATO, nome);
  }
  // Senza le note per i giocatori i testi GitHub originali (programma tester, dettagli tecnici) fermano la build.
  assert.throws(() => generaPagine(reale, fonti, key, {}), /revisione editoriale richiesta/);
});

test('Privacy e Cosa invia MOX non contengono segnaposto o nomi interni', () => {
  const leggiSito = nome => readFileSync(new URL('../sito/' + nome, import.meta.url), 'utf8').replace(/<script[\s\S]*?<\/script>|<head>[\s\S]*?<\/head>/g, ' ').replace(/<[^>]+>/g, ' ');
  for (const nome of ['privacy.html', 'cosa-invia-mox.html', 'download.html', 'archetipo.html']) {
    assert.doesNotMatch(leggiSito(nome), /da confermare|A1\d\d|central_api|owner_decision|\blegacy\b|\bR2\b|\bD1\b|OAuth|Turnstile|InventoryInfo|pipeline|\bhash\b|mox-meta/i, nome);
  }
});

test('Privacy: il comando di cancellazione non promette di togliere i mazzi dell’account', () => {
  const testo = nome => readFileSync(new URL('../sito/' + nome, import.meta.url), 'utf8').replace(/<[^>]+>/g, '');
  const en = JSON.parse(readFileSync(new URL('../sito/i18n/en.json', import.meta.url), 'utf8'));
  const privacy = testo('privacy.html');
  // Il server cancella partite e Draft dell'installazione e lascia i mazzi sincronizzati (src/draft.js, src/account.js).
  assert.doesNotMatch(privacy, /tutto quello che quella installazione ha condiviso/);
  assert.match(privacy, /Non tocca i mazzi sincronizzati nel tuo account: quelli li cancelli dal tuo account sul sito/);
  assert.ok(Object.values(en).some(v => v.includes('does not touch the decks synced to your account')));
  assert.ok(!Object.values(en).some(v => v.includes('everything that installation shared')));
});

test('Privacy e Cosa invia: «mai» vale per le condivisioni di gioco, Player.log solo se lo alleghi tu', () => {
  const testo = nome => readFileSync(new URL('../sito/' + nome, import.meta.url), 'utf8').replace(/<[^>]+>/g, '');
  const cosa = testo('cosa-invia-mox.html'), privacy = testo('privacy.html');
  // Il pacchetto diagnostico copia Player.log intero (strumenti/diagnostica.py della 2.11.8).
  assert.doesNotMatch(cosa, /(^|>|\s)Non inviamo mai:/);
  assert.match(cosa, /Nelle condivisioni non inviamo mai:/);
  assert.match(cosa, /Player\.log\), che contiene anche il tuo nome e account Arena, parte solo se scegli tu di allegarlo a un ticket/);
  assert.match(privacy, /Cosa non entra mai nelle condivisioni di gioco/);
  assert.match(privacy, /Fa eccezione solo il registro di Arena/);
  assert.match(privacy, /Il registro di Arena, che contiene il tuo nome, parte solo se scegli tu di allegarlo a un ticket di supporto/);
});
