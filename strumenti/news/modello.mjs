import { createHash } from 'node:crypto';

export const REPO = 'Dennis96/moxtracker';
export const API = `https://api.github.com/repos/${REPO}/releases`;
export const sha256 = testo => createHash('sha256').update(testo).digest('hex');
const richiedi = (condizione, messaggio) => { if (!condizione) throw new Error(messaggio); };
const istante = valore => typeof valore === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(valore) && Number.isFinite(Date.parse(valore)) && new Date(valore).toISOString().replace('.000Z', 'Z') === valore.replace('.000Z', 'Z');
export const versioneTag = tag => /^mox-v2-beta(\d+\.\d+\.\d+)$/.exec(tag)?.[1]?.split('.').map(Number).join('.') || null;
export const slugRelease = release => encodeURIComponent(release.tag_name.replaceAll('.', '-'));
export function cachePubblica(r) {
  return Object.fromEntries(['id', 'tag_name', 'name', 'draft', 'prerelease', 'published_at', 'body', 'html_url', 'assets'].map(k => [k, k === 'assets' ? r.assets.map(a => Object.fromEntries(['id', 'name', 'size', 'digest', 'browser_download_url'].map(v => [v, a[v] ?? null]))) : r[k]]));
}

function urlGitHub(valore, prefisso) {
  const url = new URL(valore);
  richiedi(url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password && !url.search && !url.hash && url.pathname.startsWith(prefisso), 'URL GitHub non ammesso');
  return url.href;
}

export function normalizzaRelease(r) {
  richiedi(Number.isSafeInteger(r?.id) && r.id > 0 && typeof r.draft === 'boolean' && typeof r.prerelease === 'boolean', 'ID/stato release non valido');
  richiedi(versioneTag(r.tag_name) && istante(r.published_at), 'Tag/data release non validi');
  richiedi(typeof r.name === 'string' && typeof r.body === 'string' && r.body.length <= 1_000_000 && Array.isArray(r.assets), 'Body/asset non validi');
  const url = urlGitHub(r.html_url, `/${REPO}/releases/tag/`);
  richiedi(decodeURIComponent(new URL(url).pathname) === `/${REPO}/releases/tag/${r.tag_name}`, 'URL/tag discordanti');
  const assets = r.assets.map(a => {
    richiedi(Number.isSafeInteger(a.id) && a.id > 0 && typeof a.name === 'string' && Number.isSafeInteger(a.size) && a.size > 0, 'Asset non valido');
    const indirizzo = urlGitHub(a.browser_download_url, `/${REPO}/releases/download/`);
    richiedi(decodeURIComponent(new URL(indirizzo).pathname) === `/${REPO}/releases/download/${r.tag_name}/${a.name}`, 'URL asset discordante');
    richiedi(a.digest == null || /^sha256:[a-f0-9]{64}$/.test(a.digest), 'Digest non valido');
    return { id: a.id, name: a.name, size: a.size, browser_download_url: indirizzo, digest: a.digest || null };
  });
  richiedi(new Set(assets.map(a => a.id)).size === assets.length && new Set(assets.map(a => a.name)).size === assets.length, 'Asset duplicati');
  richiedi(assets.filter(a => /\.zip$/i.test(a.name)).length === 1, 'ZIP non univoco');
  const source = /^mox-core source commit\s*=\s*([a-f0-9]{40})\s*$/m.exec(r.body)?.[1] || null;
  return { id: r.id, tag_name: r.tag_name, version: versioneTag(r.tag_name), name: r.name,
    published_at: r.published_at, html_url: url, draft: r.draft, prerelease: r.prerelease,
    body: r.body, body_sha256: sha256(r.body), source_commit: source, assets };
}

export function noteLingua(body, lingua) {
  const blocco = codice => new RegExp(`<!-- mox-user-notes-${codice}:start -->\\r?\\n([\\s\\S]*?)\\r?\\n<!-- mox-user-notes-${codice}:end -->`).exec(body)?.[1];
  const it = blocco('it');
  const en = blocco('en');
  if (lingua === 'en' && en) return { text: en, lang: 'en', status: 'en_original' };
  return { text: it ?? body, lang: 'it', status: lingua === 'en' ? 'it_original_en_missing' : 'it_original' };
}

export function validaSnapshot(s) {
  richiedi(s?.schema_version === 1 && s.repository === REPO && s.source === API && s.complete === true && istante(s.fetched_at), 'Schema/provenienza snapshot non validi');
  richiedi(Array.isArray(s.releases) && s.releases.length > 0 && Array.isArray(s.tombstones) && Array.isArray(s.exceptions), 'Snapshot incompleto');
  const id = new Set(), tag = new Set(), versioni = new Set();
  for (const r of [...s.releases, ...s.tombstones]) {
    const n = normalizzaRelease(r);
    richiedi(!r.draft && !r.prerelease && n.body_sha256 === r.body_sha256 && n.version === r.version && n.source_commit === r.source_commit, 'Integrità release fallita');
    richiedi(!id.has(r.id) && !tag.has(r.tag_name) && !versioni.has(r.version), 'ID/tag/versione duplicati');
    id.add(r.id); tag.add(r.tag_name); versioni.add(r.version);
    richiedi(['legacy_verified', 'published_unverified', 'stable_receipt'].includes(r.provenance), 'Provenienza non valida');
    if (r.provenance === 'stable_receipt') richiedi(r.receipt?.source_commit === r.source_commit && /^[a-f0-9]{40}$/.test(r.source_commit) && istante(r.receipt.verified_at) && r.receipt.version === r.version, 'Ricevuta Stable non valida');
    if (s.tombstones.includes(r)) richiedi(istante(r.withdrawn_at) && [404, 410].includes(r.withdrawal_status), 'Ritiro non confermato');
  }
  richiedi(s.releases.some(r => r.id === s.github_latest_id), 'Latest assente dal corpus');
  if (s.latest_observed) richiedi(JSON.stringify(normalizzaRelease(s.latest_observed)) === JSON.stringify(normalizzaRelease(s.releases.find(r => r.id === s.github_latest_id))), 'Latest/corpus discordanti');
  richiedi(Array.isArray(s.pages) && s.pages.length >= 2 && s.pages.at(-1).data.length === 0, 'Paginazione non attestata');
  for (const [i, p] of s.pages.entries()) {
    richiedi(p.url === `${API}?per_page=100&page=${i + 1}` && Array.isArray(p.data) && p.data.length <= 100 && p.body_sha256 === sha256(JSON.stringify(p.data)), 'Pagina cache non valida');
  }
  const cache = s.pages.flatMap(p => p.data);
  richiedi(new Set(cache.map(r => r.id)).size === cache.length && new Set(cache.map(r => r.tag_name)).size === cache.length, 'Duplicati nella cache paginata');
  const presenti = cache.filter(r => !r.draft && !r.prerelease).map(normalizzaRelease);
  richiedi(presenti.length === s.releases.length && presenti.every(r => s.releases.some(n => n.id === r.id && JSON.stringify(normalizzaRelease(n)) === JSON.stringify(r))), 'Corpus/cache discordanti');
  return s;
}

export async function acquisisci({ fetcher = fetch, precedente = null, now = new Date().toISOString(), sleep = ms => new Promise(r => setTimeout(r, ms)), importaLegacy = false, receipts = [] } = {}) {
  if (precedente) validaSnapshot(precedente);
  richiedi(!importaLegacy || !precedente, 'Importazione legacy ammessa solo al primo inventario revisionato');
  let richieste = 0;
  async function get(url, cache = null) {
    richiedi(url === `${API}/latest` || url.startsWith(`${API}?per_page=100&page=`) || new RegExp(`^${API}/[0-9]+$`).test(url), 'Endpoint non ammesso');
    for (let tentativo = 0; tentativo < 3; tentativo++) {
      let risposta;
      try { richieste++; risposta = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(20_000), headers: { accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(cache?.etag ? { 'If-None-Match': cache.etag } : {}) } }); }
      catch (errore) { if (tentativo === 2) throw errore; await sleep(250 * (tentativo + 1)); continue; }
      if (risposta.status === 304) {
        richiedi(cache && cache.body_sha256 === sha256(JSON.stringify(cache.data)), '304 senza cache valida');
        return cache;
      }
      if ([403, 429, 500, 502, 503, 504].includes(risposta.status) && tentativo < 2) {
        const retry = risposta.headers.get('retry-after');
        const reset = risposta.headers.get('x-ratelimit-reset');
        const attesa = retry ? (/^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.parse(now)) : reset ? Number(reset) * 1000 - Date.parse(now) : 250 * (tentativo + 1);
        richiedi(Number.isFinite(attesa) && attesa <= 60_000, 'Rate limit: riprovare dopo la finestra indicata');
        await sleep(Math.max(0, attesa)); continue;
      }
      if ([404, 410].includes(risposta.status)) return { status: risposta.status };
      richiedi(risposta.status === 200, `GitHub HTTP ${risposta.status}`);
      let data = await risposta.json();
      // Nessun autore, avatar o URL di upload nel derivato pubblico versionato.
      if (Array.isArray(data)) data = data.map(cachePubblica);
      return { url, data, etag: risposta.headers.get('etag'), body_sha256: sha256(JSON.stringify(data)) };
    }
  }
  const pages = [], raccolte = [];
  for (let pagina = 1; pagina <= 100; pagina++) {
    const url = `${API}?per_page=100&page=${pagina}`;
    const p = await get(url, precedente?.pages.find(p => p.url === url));
    richiedi(Array.isArray(p.data) && p.data.length <= 100, 'Pagina mancante/non valida');
    pages.push(p); raccolte.push(...p.data);
    if (p.data.length === 0) break;
    richiedi(pagina < 100, 'Inventario oltre limite di sicurezza');
  }
  const ids = new Set(), tags = new Set();
  for (const r of raccolte) {
    richiedi(!ids.has(r.id) && !tags.has(r.tag_name), 'Paginazione ripetuta/duplicati'); ids.add(r.id); tags.add(r.tag_name);
  }
  const releases = raccolte.filter(r => !r.draft && !r.prerelease).map(normalizzaRelease).map(r => {
    const vecchia = precedente?.releases.find(v => v.id === r.id) || precedente?.tombstones.find(v => v.id === r.id);
    richiedi(!vecchia || vecchia.tag_name === r.tag_name, 'ID/tag modificato: richiede riconciliazione editoriale');
    const receipt = receipts.find(v => v.version === r.version && v.source_commit === r.source_commit);
    return { ...r, language_status: noteLingua(r.body, 'en').status, provenance: receipt ? 'stable_receipt' : importaLegacy || vecchia?.provenance === 'legacy_verified' ? 'legacy_verified' : 'published_unverified', ...(receipt ? { receipt } : {}) };
  }).sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at) || b.id - a.id);
  const latest = await get(`${API}/latest`);
  richiedi(latest.data && !latest.data.draft && !latest.data.prerelease, 'Latest non valida');
  const latestObserved = normalizzaRelease(latest.data);
  richiedi(releases.some(r => r.id === latestObserved.id && JSON.stringify(normalizzaRelease(r)) === JSON.stringify(latestObserved)), 'Latest/corpus discordanti');
  const tombstones = [...(precedente?.tombstones || [])].filter(r => !releases.some(v => v.id === r.id));
  for (const r of precedente?.releases || []) {
    if (ids.has(r.id) && releases.some(n => n.id === r.id)) continue;
    const conferma = await get(`${API}/${r.id}`);
    richiedi([404, 410].includes(conferma.status), 'Ritiro non confermato: preservare snapshot');
    tombstones.push({ ...r, withdrawn_at: now, withdrawal_status: conferma.status });
  }
  const exceptions = releases.flatMap(r => [
    ...(!r.body.trim() ? [{ id: r.id, type: 'empty_body' }] : []),
    ...(r.body.includes('\\n') ? [{ id: r.id, type: 'literal_escapes' }] : []),
    ...(noteLingua(r.body, 'en').status === 'it_original_en_missing' ? [{ id: r.id, type: 'en_missing' }] : []),
    ...(precedente?.releases.some(v => v.id === r.id && v.body_sha256 !== r.body_sha256) ? [{ id: r.id, type: 'body_changed', previous_body_sha256: precedente.releases.find(v => v.id === r.id).body_sha256 }] : []),
  ]);
  const snapshot = { schema_version: 1, repository: REPO, source: API, complete: true, fetched_at: now,
    github_latest_id: latest.data.id, latest_observed: latestObserved, pages, releases, tombstones, exceptions };
  return { snapshot: validaSnapshot(snapshot), requests: richieste };
}

export const escapeHtml = valore => String(valore).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

// Sottoinsieme intenzionale: testo, titoli, liste, codice e link HTTPS.
// L'HTML sorgente e le immagini rimangono testo; nessun attributo dal body.
export function markdownSicuro(body) {
  const testoSicuro = testo => escapeHtml(testo).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  const inline = testo => {
    const regex = /`([^`]+)`|(!?)\[([^\]\n]+)\]\(([^\s)]+)\)/g;
    let html = '', posizione = 0;
    for (const m of testo.matchAll(regex)) {
      html += testoSicuro(testo.slice(posizione, m.index)); posizione = m.index + m[0].length;
      if (m[1]) { html += `<code>${escapeHtml(m[1])}</code>`; continue; }
      let url;
      try { url = new URL(m[4]); } catch { /* testo letterale */ }
      if (m[2] || !url || url.protocol !== 'https:' || url.username || url.password || /[\u0000-\u0020\\]/.test(m[4])) html += escapeHtml(m[0]);
      else html += `<a href="${escapeHtml(url.href)}" rel="noopener noreferrer">${escapeHtml(m[3])}</a>`;
    }
    return html + testoSicuro(testo.slice(posizione));
  };
  let codice = false, lista = false, html = '';
  for (const riga of body.split(/\r?\n/)) {
    if (riga.startsWith('```')) { if (lista) { html += '</ul>'; lista = false; } html += codice ? '</code></pre>' : '<pre><code>'; codice = !codice; continue; }
    if (codice) { html += escapeHtml(riga) + '\n'; continue; }
    const elemento = /^\s*[-*] (.*)$/.exec(riga);
    if (elemento) { if (!lista) html += '<ul>'; lista = true; html += `<li>${inline(elemento[1])}</li>`; continue; }
    if (lista) { html += '</ul>'; lista = false; }
    const titolo = /^#{1,6} (.*)$/.exec(riga);
    html += titolo ? `<h3>${inline(titolo[1])}</h3>` : riga.trim() ? `<p>${inline(riga)}</p>` : '';
  }
  if (lista) html += '</ul>';
  if (codice) html += '</code></pre>';
  return html;
}
