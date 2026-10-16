import { test } from 'node:test';
// Si esegue dopo la build, separatamente dalla suite concorrente che ricrea .dist.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { linkLinguaAlternativa } from '../sito/js/language-link.js';
const root = fileURLToPath(new URL('../.dist/sito/', import.meta.url));
const manifesto = JSON.parse(readFileSync(root + 'build-manifest.json'));
const read = n => readFileSync(root + n, 'utf8');
const files = Object.keys(manifesto.file).filter(n => n.endsWith('.html'));
const snapshot = JSON.parse(readFileSync(new URL('../config/news-releases.json', import.meta.url)));
const fonti = JSON.parse(readFileSync(new URL('../config/news-fonti.json', import.meta.url)));
const stable = fonti.channels.stable.data.versione.replace('2 beta ', '');
const ammessa = r => ['legacy_verified', 'stable_receipt'].includes(r.provenance) || r.version === stable;
const pubbliche = snapshot.releases.filter(ammessa);

test('News build — corpus completo per lingua, approfondimenti in Draft, un H1 e SEO completo', () => {
  const attese = pubbliche.length + snapshot.tombstones.filter(ammessa).length;
  assert.equal(files.filter(n => n.startsWith('note-versione/')).length, attese);
  assert.equal(files.filter(n => n.startsWith('en/note-versione/')).length, attese);
  assert.equal(files.filter(n => /^(?:en\/)?guide(?:\/|\.html)/.test(n)).length, 0);
  for (const n of files.filter(n => /^(?:en\/)?(?:draft|note-versione)/.test(n))) {
    const html = read(n);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, n);
    for (const term of ['rel="canonical"', 'hreflang="it"', 'hreflang="en"', 'hreflang="x-default"', 'property="og:url"']) assert.ok(html.includes(term), n + ': ' + term);
    assert.ok(read('sitemap.xml').includes('https://moxtracker.app/' + n.slice(0, -5)), n);
    assert.doesNotMatch(html, /Controllo la release|Controllo la release|<img[^>]*tracker\.invalid|<script[^>]*release-note/);
  }
  for (const prefisso of ['', 'en/']) {
    const draft = read(prefisso + 'draft.html');
    assert.equal((draft.match(/class="draft-answer"/g) || []).length, 8);
    assert.ok(draft.includes('0–110')); assert.ok(draft.includes('0,54') || draft.includes('0.54'));
    const news = read(prefisso + 'note-versione.html');
    assert.equal((news.match(/class="release-card-head"/g) || []).length, pubbliche.length);
    assert.equal((news.match(/class="release-card-notes"/g) || []).length, pubbliche.length ? 1 : 0);
    assert.doesNotMatch(news, /class="release-list"/);
  }
});

test('News build — link e ancore locali validi per tutte le pagine nuove e Privacy', () => {
  for (const n of files.filter(n => /draft|note-versione|privacy|cosa-invia/.test(n))) {
    const html = read(n);
    for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const url = m[1].replaceAll('&amp;', '&');
      if (/^(?:https?:|mailto:|data:)/.test(url) || url === '#download') continue;
      const [pathquery, anchor] = url.split('#');
      const path = decodeURIComponent(pathquery.split('?')[0]);
      let file = path.startsWith('/') ? root + path.slice(1) : resolve(dirname(root + n), path || n.split('/').at(-1));
      if (file.endsWith('/')) file += 'index.html';
      if (!existsSync(file) && !file.endsWith('.html')) file += '.html';
      assert.ok(existsSync(file), `${n}: ${url}`);
      if (anchor && file.endsWith('.html')) assert.ok(readFileSync(file, 'utf8').includes(`id="${anchor}"`), `${n}: ancora ${url}`);
    }
  }
});

test('News build — originale IT in cornice EN, nessun token nel bundle e date dichiarate', () => {
  const n = read('en/note-versione/mox-v2-beta2-9-12.html');
  assert.match(n, /<html lang="en"/); assert.match(n, /Notes are not available in the original release/);
  assert.match(read('en/note-versione/mox-v2-beta2-9-28.html'), /Italian original/);
  for (const f of Object.keys(manifesto.file).filter(n => /\.(?:html|js|json|css)$/.test(n))) assert.doesNotMatch(read(f), /canary|github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{16,}/i, f);
  const privacy = read('en/privacy.html');
  for (const term of ['October 6, 2026', 'October 15, 2026', 'Technical requests and statistical sources', 'Data flow matrix', 'Provider log and backup retention']) assert.ok(privacy.includes(term), term);
});

test('Home — hero approvato, due sole CTA e unica aggiunta della versione', () => {
  const hero = read('index.html').match(/<section class="home-hero"[\s\S]*?<\/section>/)?.[0];
  assert.ok(hero);
  assert.match(hero, /Tracker, Assistente al Draft, mazzi e statistiche per MTG Arena\./);
  assert.match(hero, /Durante la partita conta le carte che restano nel tuo mazzo/);
  assert.equal((hero.match(/class="button /g) || []).length, 2);
  assert.match(hero, /Windows · Beta pubblica · Download da GitHub<span data-home-release> · MOX \d+\.\d+\.\d+<\/span>/);
  assert.doesNotMatch(hero, /Inizia con MOX|Pubblicazione e distribuzione|<time/);
});

test('News build — lingua annidata conserva percorso, query e frammento', () => {
  assert.equal(linkLinguaAlternativa('/guide/dati-draft', false, '?x=1', '#fonte'), '/en/guide/dati-draft?x=1#fonte');
  assert.equal(linkLinguaAlternativa('/en/note-versione/mox-v2-beta2-11-8.html', true), '/note-versione/mox-v2-beta2-11-8.html');
});

test('News build — preview noindex in HTML, headers e robots (quando MOX_BUILD_TARGET=preview)', { skip: process.env.MOX_BUILD_TARGET !== 'preview' }, () => {
  for (const f of files) assert.match(read(f), /name="robots" content="noindex, nofollow"/, f);
  assert.match(read('_headers'), /X-Robots-Tag: noindex, nofollow/); assert.equal(read('robots.txt'), 'User-agent: *\nDisallow: /\n');
});
