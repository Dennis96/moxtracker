import { createPublicKey, verify } from 'node:crypto';
import { validaSnapshot, escapeHtml as e, markdownSicuro, noteLingua, slugRelease, sha256 } from './modello.mjs';
import { GUIDE, REVISIONE_DRAFT } from './guide.mjs';

export function validaFonti(f, key) {
  if (f?.schema_version !== 1 || !Number.isFinite(Date.parse(f.verified_at)) || f.public_key_sha256 !== sha256(JSON.stringify(key))) throw new Error('Snapshot fonti non valido');
  const pubblica = createPublicKey({ key: { kty: 'RSA', n: Buffer.from(key.modulo, 'hex').toString('base64url'), e: 'AQAB' }, format: 'jwk' });
  for (const canale of ['stable', 'canary']) {
    const record = f.channels?.[canale];
    if (record?.requested_channel !== canale || record.source !== `https://api.moxtracker.app/mox/release?piattaforma=win-x64&canale=${canale}&corrente=0` || record.fetched_at !== f.verified_at) throw new Error('Canale fonte non valido');
    if (record.data_sha256 !== sha256(JSON.stringify(record.data))) throw new Error('Integrità fonte non valida');
    const { firma, ...body } = record.data;
    const canone = JSON.stringify(Object.fromEntries(Object.entries(body).sort(([a], [b]) => a.localeCompare(b))));
    if (!verify('RSA-SHA256', Buffer.from(canone), pubblica, Buffer.from(firma, 'base64')) || !/^2 beta \d+\.\d+\.\d+$/.test(body.versione) || body.disponibile !== true) throw new Error('Firma/versione fonte non valida');
  }
  const p = f.public_data;
  if (p?.data_sha256 !== sha256(JSON.stringify(p?.data))) throw new Error('Integrità manifesto pubblico non valida');
  if (p?.source !== 'https://api.moxtracker.app/mox/draft-data/v1/public/manifest.json' || p.data?.schema !== 'mox.draft-stats-manifest/1' || p.data.namespace !== 'public' || p.data.source !== '17lands_public_dataset' || !Array.isArray(p.data.entries) || !Number.isFinite(Date.parse(p.data.generated_at))) throw new Error('Manifesto pubblico non valido');
  const ids = new Set();
  for (const r of p.data.entries) {
    const id = [r.set, r.format, r.main_colors].join('/');
    if (!/^[A-Z0-9]+$/.test(r.set) || !['PremierDraft', 'TradDraft', 'QuickDraft', 'PickTwoDraft'].includes(r.format) || !(r.main_colors === null || /^[WUBRG]{2}$/.test(r.main_colors)) || !/^[a-f0-9]{64}$/.test(r.sha256) || !/^\d{4}-\d\d-\d\d$/.test(r.source_published_at) || ids.has(id)) throw new Error('Entry pubblica non valida');
    ids.add(id);
  }
  return f;
}

const data = (iso, en) => new Intl.DateTimeFormat(en ? 'en-GB' : 'it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));

// Il sito pubblico espone esclusivamente note destinate agli utenti.
// Il corpus originale resta integro nello snapshot per audit e riconciliazione.
function notePubbliche(r, lingua) {
  const note = noteLingua(r.body, lingua);
  if (/canary/i.test(note.text)) throw new Error('Note riservate ai tester: revisione editoriale richiesta');
  return note;
}

function corpoNote(r, lingua) {
  const note = notePubbliche(r, lingua), en = lingua === 'en';
  // Titolo e commit hanno già una collocazione nella scheda e nei dettagli fonte.
  const righe = note.text.split(/\r?\n/);
  if (righe[0]?.replace(/^#\s+/, '').trim() === r.name) righe.shift();
  const testo = righe.filter(riga => !/^mox-core source commit\s*=\s*[a-f0-9]{40}\s*$/i.test(riga)).join('\n');
  const avviso = en && note.lang === 'it' ? '<p class="release-language">Italian original; an approved English translation is not available.</p>' : '';
  return avviso + '<div lang="' + note.lang + '" class="release-body">' + (testo.trim() ? markdownSicuro(testo) : '<p>' + (en ? 'Notes are not available in the original release.' : 'Note non disponibili nella release originale.') + '</p>') + '</div>';
}

export function generaPagine(snapshot, fonti, key) {
  validaSnapshot(snapshot); validaFonti(fonti, key);
  const pagine = new Map();
  const stable = fonti.channels.stable.data.versione.replace('2 beta ', '');
  const ammessa = r => r.provenance === 'legacy_verified' || r.provenance === 'stable_receipt' || r.version === stable;
  const pubbliche = snapshot.releases.filter(ammessa);
  const ritiratePubbliche = snapshot.tombstones.filter(ammessa);
  const latest = pubbliche[0];
  const latestGitHub = snapshot.latest_observed || snapshot.releases.find(r => r.id === snapshot.github_latest_id);
  for (const en of [false, true]) {
    const lingua = en ? 'en' : 'it', prefisso = en ? '/en' : '';
    const link = (nome, testo) => '<a href="' + prefisso + '/' + nome + '">' + e(testo) + '</a>';
    const schede = pubbliche.map(r => {
      const ultima = r.id === latest.id;
      const badge = ultima ? '<span class="release-badge">' + (en ? 'Latest' : 'Ultima versione') + '</span>' : '';
      return '<article class="release-card' + (ultima ? ' release-card-latest' : '') + '" id="release-' + e(r.version) + '"><header class="release-card-head"><div><h2>' + e(r.name) + ' ' + badge + '</h2><p class="release-date"><time datetime="' + e(r.published_at) + '">' + e(data(r.published_at, en)) + '</time></p></div>' + link('note-versione/' + slugRelease(r), (ultima ? en ? 'Open the release page' : 'Apri la pagina della versione' : en ? 'Read the release notes' : 'Leggi le note di versione') + ' →') + '</header>' + (ultima ? '<div class="release-card-notes">' + corpoNote(r, lingua) + '</div>' : '') + '</article>';
    }).join('');
    const avviso = latestGitHub.version !== stable ? '<p class="release-warning">' + (en ? 'Download is temporarily unavailable. Current public version: MOX ' : 'Download momentaneamente non disponibile. Versione pubblica corrente: MOX ') + e(stable) + '.</p>' : '';
    const ritirate = ritiratePubbliche.length ? '<section class="release-withdrawn"><h2>' + (en ? 'Withdrawn releases' : 'Versioni ritirate') + '</h2>' + ritiratePubbliche.map(r => '<p>' + link('note-versione/' + slugRelease(r), r.name) + '</p>').join('') + '</section>' : '';
    pagine.set(lingua + '/note-versione.html', {
      title: en ? 'Updates' : 'Aggiornamenti', page: 'updates',
      main: '<div class="news-page"><header class="news-head"><p class="news-eyebrow">News</p><h1>' + (en ? 'What changed in each release.' : 'Le novità di ogni versione.') + '</h1><p>' + (en ? 'The release notes for MOX, newest first.' : 'Le note di versione di MOX, dalla più recente alle precedenti.') + '</p></header>' + avviso + '<section class="release-feed" aria-label="' + (en ? 'Releases' : 'Versioni') + '">' + schede + '</section>' + ritirate + '<p class="news-source">' + (en ? 'Source: GitHub Releases. Checked on ' : 'Fonte: GitHub Releases. Verifica del ') + '<time datetime="' + e(snapshot.fetched_at) + '">' + e(data(snapshot.fetched_at, en)) + '</time> (UTC).</p></div>'
    });
    for (const r of [...pubbliche, ...ritiratePubbliche]) {
      const ritirata = snapshot.tombstones.includes(r);
      let corpo = '<p>' + link('note-versione', en ? '← All updates' : '← Tutti gli aggiornamenti') + '</p><p class="release-date"><time datetime="' + e(r.published_at) + '">' + e(data(r.published_at, en)) + ' UTC</time></p>';
      if (ritirata) corpo += '<p class="release-warning">' + (en ? 'Withdrawn release. Download links removed.' : 'Versione ritirata. Link di download rimossi.') + '</p>';
      else if (r.version !== stable) corpo += '<p class="release-history">' + (r.provenance === 'legacy_verified' ? en ? 'Verified legacy publication. Historical version.' : 'Pubblicazione legacy verificata. Versione storica.' : r.provenance === 'stable_receipt' ? en ? 'Stable promotion receipt recorded.' : 'Ricevuta di promozione Stable registrata.' : en ? 'Published on GitHub; Stable promotion unverified.' : 'Pubblicata su GitHub; promozione Stable non verificata.') + '</p>';
      if (r.body.includes('\\n')) corpo += '<p>' + (en ? 'Literal escape sequences are preserved from the original source.' : 'Le sequenze di escape letterali sono conservate dalla fonte originale.') + '</p>';
      corpo += corpoNote(r, lingua);
      corpo += '<p><a href="' + e(r.html_url) + '" rel="noopener noreferrer">' + (en ? 'Original GitHub release' : 'Release GitHub originale') + ' →</a></p><details class="release-metadata"><summary>' + (en ? 'Source details' : 'Dettagli della fonte') + '</summary><p>ID ' + r.id + ' · <code>' + e(r.tag_name) + '</code></p><p>SHA-256 body: <code>' + r.body_sha256 + '</code></p><p>' + (en ? 'Client source commit' : 'Commit sorgente client') + ': <code>' + e(r.source_commit || (en ? 'not attested' : 'non attestato')) + '</code></p>' + r.assets.map(a => '<p>' + e(a.name) + ' · ' + a.size + ' byte · <code>' + e(a.digest || 'n.d.') + '</code></p>').join('') + '</details>';
      pagine.set(lingua + '/note-versione/' + slugRelease(r) + '.html', { title: r.name, page: 'updates', main: '<div class="news-page news-detail"><header class="news-head"><p class="news-eyebrow">News</p><h1>' + e(r.name) + '</h1></header><article class="release-card">' + corpo + '</article></div>' });
    }
  }
  return pagine;
}

export function approfondimentiDraft(fonti, en = false) {
  const prefisso = en ? '/en' : '';
  const domande = {
    'inizia': ['Come installo MOX?', 'How do I install MOX?'],
    'registri-arena': ['Come collego Arena?', 'How do I connect Arena?'],
    'primo-draft': ['Come inizio un Draft?', 'How do I start a Draft?'],
    'consigli-draft': ['Come leggo punteggi e percentuali?', 'How do I read scores and percentages?'],
    'mazzo-draft': ['Come scelgo il mazzo finale?', 'How do I choose my final deck?'],
    'dati-account': ['Che cosa condivido?', 'What do I share?'],
  };
  return '<section class="draft-help" aria-labelledby="draft-help-title"><div class="part-head"><h2 id="draft-help-title">' + (en ? 'Draft, explained simply.' : 'Il Draft, spiegato semplice.') + '</h2><p>' + (en ? 'From your first pack to your final deck. Open the answer you need.' : 'Dalla prima busta al mazzo finale. Apri solo la risposta che ti serve.') + '</p><p class="fineprint">MOX ' + e(REVISIONE_DRAFT.versione) + ' · ' + (en ? 'Content checked on ' : 'Contenuti verificati il ') + '<time datetime="' + e(REVISIONE_DRAFT.verificata_il) + '">' + e(data(REVISIONE_DRAFT.verificata_il, en)) + '</time> (UTC).</p></div><div class="draft-answers">' + GUIDE.map(([slug, it, inglese, sezioni]) => '<details class="draft-answer" id="' + slug + '"><summary>' + e(domande[slug]?.[en ? 1 : 0] || (en ? inglese : it)) + '</summary><div class="draft-answer-body">' + sezioni.map(([hi, he, pi, pe]) => '<h3>' + e(en ? he : hi) + '</h3><p>' + e(en ? pe : pi) + '</p>').join('') + (slug === 'dati-draft' ? tabellaDati(fonti, en) : '') + (slug === 'inizia' ? '<p><a href="' + prefisso + '/download">' + (en ? 'Installation instructions →' : 'Procedura di installazione →') + '</a></p>' : '') + '</div></details>').join('') + '</div><p class="draft-help-links"><a href="' + prefisso + '/supporto">' + (en ? 'Need help?' : 'Ti serve una mano?') + '</a> · <a href="' + prefisso + '/privacy">Privacy</a> · <a href="' + prefisso + '/note-versione">' + (en ? 'Updates' : 'Aggiornamenti') + '</a></p></section>';
}

export function tabellaDati(fonti, en) {
  const m = fonti.public_data.data;
  const gruppi = new Map();
  for (const r of m.entries) { const id = [r.set, r.format, r.source_published_at].join('/'); if (!gruppi.has(id)) gruppi.set(id, []); gruppi.get(id).push(r); }
  return '<div class="draft-data"><h3>' + (en ? 'Public data available' : 'Dati pubblici disponibili') + '</h3>' + `<p>${en ? 'Public Data Sets only. Checked' : 'Solo Public Data Sets. Verificato al'} <time datetime="${e(fonti.public_data.fetched_at)}">${e(fonti.public_data.fetched_at)}</time>. ${en ? 'Manifest generated' : 'Manifesto generato'}: ${e(m.generated_at)}.</p><div class="table-scroll" tabindex="0" role="region" aria-label="${en ? 'Public Draft data table' : 'Tabella dati Draft pubblici'}"><table><thead><tr><th>Set</th><th>${en ? 'Format' : 'Formato'}</th><th>${en ? 'Source date' : 'Data sorgente'}</th><th>${en ? 'Tables' : 'Tabelle'}</th></tr></thead><tbody>${[...gruppi.values()].map(righe => `<tr><th scope="row">${e(righe[0].set)}</th><td>${e(righe[0].format)}</td><td>${e(righe[0].source_published_at)}</td><td>${righe.filter(r => r.main_colors === null).length} ${en ? 'global' : 'globale'} + ${righe.filter(r => r.main_colors !== null).length} ${en ? 'color pairs' : 'coppie colori'}</td></tr>`).join('')}</tbody></table></div><p>${en ? 'This table covers Public Data Sets only, not API availability. The listed date refers to the source data. Card-level metrics and coverage may vary; the client shows the source actually used.' : 'Questa tabella riguarda solo i Public Data Sets, non la disponibilità API. La data indicata è quella dei dati sorgente. Metriche e copertura per carta possono variare; il client mostra la fonte effettivamente usata.'}</p><p>${en ? 'Statistics calculated by MOX from 17Lands Public Data Sets, CC BY 4.0. 17Lands does not endorse MOX.' : 'Statistiche calcolate da MOX sui 17Lands Public Data Sets, CC BY 4.0. 17Lands non approva né sostiene MOX.'} <a href="https://www.17lands.com/public_datasets">17Lands Public Data Sets</a> · <a href="${e(fonti.public_data.source)}">${en ? 'Source manifest' : 'Manifesto fonte'}</a></p>` + '</div>';
}
