import { createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
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

// Note scritte per i giocatori, una per versione (IT/EN). Il sito non mostra
// il testo tecnico delle GitHub Releases quando esiste la nota per i giocatori.
export const NOTE_UTENTE = JSON.parse(readFileSync(new URL('../../config/news-note-utente.json', import.meta.url), 'utf8'));
// Parole da sviluppatore o da programma tester che non devono comparire nelle pagine pubbliche.
// È una rete di sicurezza, non la revisione editoriale: ogni nota nuova si rilegge come la leggerebbe un giocatore.
export const GERGO_VIETATO = /canary|\btester\b|canale di prova|versioni? sperimental|confidenza=|central_api|owner_decision|\blegacy\b|(?<!privacy )\bpolicy\b|\bendpoint\b|\bAPI\b|\bfallback\b|\bcache\b|chi prova le versioni|versioni? di prova|codice di accesso|\btest(ing)? channel\b|\bearly access\b|\bhash\b|\bparser\b|\bpayload\b|\bmanifest[oi]?\b|\bfrontend\b|\bbackend\b|\bWorker\b|\bD1\b|\bR2\b|\bOAuth\b|\bcommit\b|\bsuite\b|\bfuzzing\b|\bschema\b|\bhotfix\b|\bA\d{2,3}\b/i;

const data = (iso, en) => new Intl.DateTimeFormat(en ? 'en-GB' : 'it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));

// Il sito pubblico espone esclusivamente note destinate agli utenti.
// Il corpus originale resta integro nello snapshot per audit e riconciliazione.
function notePubbliche(r, lingua, noteUtente) {
  const scritta = noteUtente[r.version]?.[lingua];
  const note = scritta ? { text: scritta, lang: lingua, status: 'utente' } : noteLingua(r.body, lingua);
  // La riga del commit sorgente non arriva mai nella pagina (corpoNote la toglie).
  if (GERGO_VIETATO.test(note.text.replace(/^mox-core source commit\s*=.*$/gim, ''))) throw new Error('Note con linguaggio da sviluppatori o per tester: revisione editoriale richiesta (' + r.version + ')');
  return note;
}

function corpoNote(r, lingua, noteUtente) {
  const note = notePubbliche(r, lingua, noteUtente), en = lingua === 'en';
  // Titolo e commit hanno già una collocazione nella scheda e nei dettagli fonte.
  const righe = note.text.split(/\r?\n/);
  if (righe[0]?.replace(/^#\s+/, '').trim() === r.name) righe.shift();
  const testo = righe.filter(riga => !/^mox-core source commit\s*=\s*[a-f0-9]{40}\s*$/i.test(riga)).join('\n');
  const avviso = en && note.lang === 'it' ? '<p class="release-language">Italian original; an approved English translation is not available.</p>' : '';
  return avviso + '<div lang="' + note.lang + '" class="release-body">' + (testo.trim() ? markdownSicuro(testo) : '<p>' + (en ? 'Notes are not available in the original release.' : 'Note non disponibili nella release originale.') + '</p>') + '</div>';
}

export function generaPagine(snapshot, fonti, key, noteUtente = NOTE_UTENTE) {
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
      return '<article class="release-card' + (ultima ? ' release-card-latest' : '') + '" id="release-' + e(r.version) + '"><header class="release-card-head"><div><h2>' + e(r.name) + ' ' + badge + '</h2><p class="release-date"><time datetime="' + e(r.published_at) + '">' + e(data(r.published_at, en)) + '</time></p></div>' + link('note-versione/' + slugRelease(r), (ultima ? en ? 'Open the release page' : 'Apri la pagina della versione' : en ? 'Read the release notes' : 'Leggi le note di versione') + ' →') + '</header>' + (ultima ? '<div class="release-card-notes">' + corpoNote(r, lingua, noteUtente) + '</div>' : '') + '</article>';
    }).join('');
    const avviso = latestGitHub.version !== stable ? '<p class="release-warning">' + (en ? 'Download is temporarily unavailable. Current public version: MOX ' : 'Download momentaneamente non disponibile. Versione pubblica corrente: MOX ') + e(stable) + '.</p>' : '';
    const ritirate = ritiratePubbliche.length ? '<section class="release-withdrawn"><h2>' + (en ? 'Withdrawn releases' : 'Versioni ritirate') + '</h2>' + ritiratePubbliche.map(r => '<p>' + link('note-versione/' + slugRelease(r), r.name) + '</p>').join('') + '</section>' : '';
    pagine.set(lingua + '/note-versione.html', {
      title: en ? 'Updates' : 'Aggiornamenti', page: 'updates',
      main: '<div class="news-page"><header class="news-head"><p class="news-eyebrow">News</p><h1>' + (en ? 'What changed in each release.' : 'Le novità di ogni versione.') + '</h1><p>' + (en ? 'The release notes for MOX, newest first.' : 'Le note di versione di MOX, dalla più recente alle precedenti.') + '</p></header>' + avviso + '<section class="release-feed" aria-label="' + (en ? 'Releases' : 'Versioni') + '">' + schede + '</section>' + ritirate + '</div>'
    });
    for (const r of [...pubbliche, ...ritiratePubbliche]) {
      const ritirata = snapshot.tombstones.includes(r);
      let corpo = '<p>' + link('note-versione', en ? '← All updates' : '← Tutti gli aggiornamenti') + '</p><p class="release-date"><time datetime="' + e(r.published_at) + '">' + e(data(r.published_at, en)) + '</time></p>';
      if (ritirata) corpo += '<p class="release-warning">' + (en ? 'Withdrawn release. Download links removed.' : 'Versione ritirata. Link di download rimossi.') + '</p>';
      else if (r.version !== stable) corpo += '<p class="release-history">' + (en ? 'Earlier version.' : 'Versione precedente.') + '</p>';
      corpo += corpoNote(r, lingua, noteUtente);
      // Dettagli tecnici (ID, hash, commit, digest) restano nello snapshot interno, non nella pagina.
      pagine.set(lingua + '/note-versione/' + slugRelease(r) + '.html', { title: r.name, page: 'updates', main: '<div class="news-page news-detail"><header class="news-head"><p class="news-eyebrow">News</p><h1>' + e(r.name) + '</h1></header><article class="release-card">' + corpo + '</article></div>' });
    }
    pagine.set(lingua + '/guide.html', { title: en ? 'MOX guides' : 'Guide MOX', page: 'guides', main: paginaGuide(fonti, en) });
  }
  return pagine;
}

export function paginaGuide(fonti, en = false) {
  const prefisso = en ? '/en' : '';
  const gruppi = [
    { id: 'inizia-mox', titolo: en ? 'Start with MOX' : 'Inizia con MOX', descrizione: en ? 'Install the app, connect Arena and keep MOX up to date.' : 'Installa il programma, collega Arena e tieni MOX aggiornato.', slugs: ['inizia', 'registri-arena', 'aggiornamenti'] },
    { id: 'usa-draft', titolo: en ? 'Use Draft' : 'Usa il Draft', descrizione: en ? 'From your first pack to reading recommendations and building your deck.' : 'Dalla prima busta ai consigli, fino al mazzo finale.', slugs: ['primo-draft', 'consigli-draft', 'mazzo-draft'] },
    { id: 'dati-privacy', titolo: en ? 'Data and privacy' : 'Dati e privacy', descrizione: en ? 'Understand the sources and choose what you share.' : 'Capisci le fonti e scegli che cosa condividere.', slugs: ['dati-draft', 'dati-account'] },
  ];
  const domande = {
    'inizia': ['Come installo MOX?', 'How do I install MOX?'],
    'registri-arena': ['Come collego Arena?', 'How do I connect Arena?'],
    'primo-draft': ['Come inizio un Draft?', 'How do I start a Draft?'],
    'consigli-draft': ['Come leggo punteggi e percentuali?', 'How do I read scores and percentages?'],
    'mazzo-draft': ['Come scelgo il mazzo finale?', 'How do I choose my final deck?'],
    'dati-account': ['Che cosa condivido?', 'What do I share?'],
  };
  const schede = gruppi.map(g => '<a class="guide-card" href="#' + g.id + '"><h2>' + e(g.titolo) + '</h2><p>' + e(g.descrizione) + '</p><span aria-hidden="true">→</span></a>').join('');
  const risposte = slugs => slugs.map(slug => {
    const [, it, inglese, sezioni] = GUIDE.find(r => r[0] === slug);
    return '<details class="draft-answer" id="' + slug + '"><summary>' + e(domande[slug]?.[en ? 1 : 0] || (en ? inglese : it)) + '</summary><div class="draft-answer-body">' + sezioni.map(([hi, he, pi, pe]) => '<h3>' + e(en ? he : hi) + '</h3><p>' + e(en ? pe : pi) + '</p>').join('') + (slug === 'dati-draft' ? tabellaDati(fonti, en) : '') + (slug === 'inizia' ? '<p><a href="' + prefisso + '/download">' + (en ? 'Installation instructions →' : 'Procedura di installazione →') + '</a></p>' : '') + '</div></details>';
  }).join('');
  const contenuti = gruppi.map(g => '<section class="guide-group" id="' + g.id + '" aria-labelledby="' + g.id + '-title"><h2 id="' + g.id + '-title">' + e(g.titolo) + '</h2><div class="draft-answers">' + risposte(g.slugs) + '</div></section>').join('');
  return '<div class="guide-page"><header class="guide-head"><h1>' + (en ? 'MOX guides' : 'Guide MOX') + '</h1><p>' + (en ? 'Find the answer you need. From installation to your next Draft.' : 'Trova la risposta che ti serve. Dall’installazione al prossimo Draft.') + '</p></header><nav class="guide-cards" aria-label="' + (en ? 'Choose a topic' : 'Scegli un argomento') + '">' + schede + '</nav>' + contenuti + '<p class="guide-revision">' + (en ? 'Guides updated for MOX ' : 'Guide aggiornate per MOX ') + e(REVISIONE_DRAFT.versione) + (en ? ' on ' : ' il ') + '<time datetime="' + e(REVISIONE_DRAFT.verificata_il) + '">' + e(data(REVISIONE_DRAFT.verificata_il, en)) + '</time>.</p><p class="draft-help-links"><a href="' + prefisso + '/supporto">' + (en ? 'Need help?' : 'Ti serve una mano?') + '</a> · <a href="' + prefisso + '/privacy">Privacy</a> · <a href="' + prefisso + '/note-versione">' + (en ? 'Updates' : 'Aggiornamenti') + '</a></p></div>';
}

export function tabellaDati(fonti, en) {
  const m = fonti.public_data.data;
  const gruppi = new Map();
  for (const r of m.entries) { const id = [r.set, r.format, r.source_published_at].join('/'); if (!gruppi.has(id)) gruppi.set(id, []); gruppi.get(id).push(r); }
  const formati = { PremierDraft: 'Premier Draft', TradDraft: 'Traditional Draft', QuickDraft: 'Quick Draft', PickTwoDraft: en ? 'Pick Two' : 'Prendi Due' };
  const righe = [...gruppi.values()].map(g => '<tr><th scope="row">' + e(g[0].set) + '</th><td>' + e(formati[g[0].format] || g[0].format) + '</td><td><time datetime="' + e(g[0].source_published_at) + '">' + e(data(g[0].source_published_at + 'T00:00:00Z', en)) + '</time></td><td>' + (en ? 'All decks' : 'Tutti i mazzi') + ' + ' + g.filter(r => r.main_colors !== null).length + (en ? ' color pairs' : ' coppie di colori') + '</td></tr>').join('');
  return '<div class="draft-data"><h3>' + (en ? 'Public 17Lands statistics available' : 'Statistiche pubbliche di 17Lands disponibili') + '</h3><p>' + (en ? 'Sets and formats for which MOX has 17Lands public data, with the date of the data.' : 'Set e formati per cui MOX ha i dati pubblici di 17Lands, con la data dei dati.') + '</p><div class="table-scroll" tabindex="0" role="region" aria-label="' + (en ? 'Public Draft statistics' : 'Statistiche Draft pubbliche') + '"><table><thead><tr><th>Set</th><th>' + (en ? 'Format' : 'Formato') + '</th><th>' + (en ? 'Data from' : 'Dati del') + '</th><th>' + (en ? 'Statistics for' : 'Statistiche per') + '</th></tr></thead><tbody>' + righe + '</tbody></table></div><p>' + (en ? 'Not every card has statistics. In the Draft window MOX always shows which data it is using.' : 'Non tutte le carte hanno statistiche. Nella finestra del Draft MOX mostra sempre quali dati sta usando.') + '</p><p>' + (en ? 'Statistics calculated by MOX from 17Lands Public Data Sets, CC BY 4.0. 17Lands does not endorse MOX.' : 'Statistiche calcolate da MOX sui 17Lands Public Data Sets, CC BY 4.0. 17Lands non approva né sostiene MOX.') + ' <a href="https://www.17lands.com/public_datasets">17Lands Public Data Sets</a></p></div>';
}
