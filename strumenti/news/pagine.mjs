import { createPublicKey, verify } from 'node:crypto';
import { validaSnapshot, escapeHtml as e, markdownSicuro, noteLingua, slugRelease, sha256 } from './modello.mjs';
import { GUIDE } from './guide.mjs';

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
const pannello = (titolo, corpo, id = '') => `<section class="panel privacy-section"${id ? ` id="${id}"` : ''}><h2>${e(titolo)}</h2>${corpo}</section>`;
const cornice = (titolo, descrizione, corpo) => `<section class="privacy-hero"><div class="privacy-hero-inner"><h1>${e(titolo)}</h1><p>${e(descrizione)}</p></div></section><div class="privacy-content">${corpo}</div>`;

export function generaPagine(snapshot, fonti, key) {
  validaSnapshot(snapshot); validaFonti(fonti, key);
  const pagine = new Map();
  const stable = fonti.channels.stable.data.versione.replace('2 beta ', '');
  for (const en of [false, true]) {
    const lingua = en ? 'en' : 'it', prefisso = en ? '/en' : '';
    const percorso = nome => `${prefisso}/${nome}`;
    const link = (nome, testo) => `<a href="${percorso(nome)}">${e(testo)}</a>`;
    const metadati = `<p>${en ? 'Sources checked' : 'Fonti verificate'}: <time datetime="${e(fonti.verified_at)}">${e(fonti.verified_at)}</time>. ${en ? 'Dates displayed in UTC. This is a dated snapshot, not live monitoring.' : 'Date visualizzate in UTC. È una fotografia datata, non un monitoraggio live.'}</p>`;
    const latest = snapshot.releases.find(r => r.id === snapshot.github_latest_id);
    const stato = `<p>${en ? 'Latest published release' : 'Ultima release pubblicata'}: ${link(`note-versione/${slugRelease(latest)}`, latest.name)}.</p><p data-release-current>${en ? 'Stable currently distributed' : 'Stable attualmente distribuita'}: MOX ${e(stable)} (${en ? 'verified snapshot' : 'snapshot verificato'}).</p>${metadati}` +
      (latest.version !== stable ? `<p class="release-warning">${en ? 'Published and distributed versions differ. Download requires aligned sources; contact Support.' : 'Versione pubblicata e distribuita divergono. Il download richiede fonti allineate; contatta il Supporto.'}</p>` : '') +
      `<p>${en ? 'GitHub publication alone does not attest Stable promotion.' : 'La sola pubblicazione GitHub non attesta una promozione Stable.'}</p>`;
    let lista = pannello(en ? 'Publication and distribution' : 'Pubblicazione e distribuzione', stato);
    lista += pannello(en ? 'Published releases' : 'Release pubblicate', `<p>${snapshot.releases.length} ${en ? 'published releases in this snapshot. Original notes come from GitHub; older entries are explicitly marked as legacy.' : 'release pubblicate nello snapshot. Le note originali provengono da GitHub; le storiche sono identificate come legacy.'}</p><ol class="release-list">` + snapshot.releases.map(r => `<li id="release-${e(r.version)}">${link(`note-versione/${slugRelease(r)}`, r.name)} — <time datetime="${e(r.published_at)}">${e(data(r.published_at, en))}</time> · ${e(r.provenance === 'legacy_verified' ? en ? 'verified legacy publication' : 'pubblicazione legacy verificata' : r.provenance === 'stable_receipt' ? en ? 'Stable gate receipt' : 'ricevuta gate Stable' : en ? 'publication; promotion unverified' : 'pubblicazione; promozione non verificata')}</li>`).join('') + '</ol>');
    if (snapshot.tombstones.length) lista += pannello(en ? 'Withdrawn releases' : 'Release ritirate', snapshot.tombstones.map(r => `<p>${link(`note-versione/${slugRelease(r)}`, r.name)} — ${e(r.withdrawn_at)}</p>`).join(''));
    pagine.set(`${lingua}/note-versione.html`, { title: en ? 'Release notes' : 'Note di versione', page: 'updates', main: cornice(en ? 'Release notes' : 'Note di versione', en ? 'Published GitHub releases, with original notes and source links.' : 'Release GitHub pubblicate, con note originali e link alla fonte.', lista) });
    for (const r of [...snapshot.releases, ...snapshot.tombstones]) {
      const ritirata = snapshot.tombstones.includes(r);
      const note = noteLingua(r.body, lingua);
      let corpo = `<p>${link('note-versione', en ? 'All release notes' : 'Tutte le note di versione')}</p><p><time datetime="${e(r.published_at)}">${e(data(r.published_at, en))} UTC</time> · ID ${r.id} · <code>${e(r.tag_name)}</code></p>`;
      corpo += `<p>${ritirata ? en ? 'Withdrawn release. Download links removed.' : 'Release ritirata. Link di download rimossi.' : r.provenance === 'legacy_verified' ? en ? 'Verified legacy publication. This is historical distribution, not the current recommendation.' : 'Pubblicazione legacy verificata. È una distribuzione storica, non la raccomandazione corrente.' : r.provenance === 'stable_receipt' ? en ? 'Stable promotion receipt recorded.' : 'Ricevuta di promozione Stable registrata.' : en ? 'Published on GitHub; Stable promotion has not been verified.' : 'Pubblicata su GitHub; promozione Stable non verificata.'}</p>`;
      if (en && note.lang === 'it') corpo += '<p>Italian original; an approved English translation is not available.</p>';
      if (r.body.includes('\\n')) corpo += `<p>${en ? 'Literal escape sequences are preserved from the original source.' : 'Le sequenze di escape letterali sono conservate dalla fonte originale.'}</p>`;
      corpo += `<div lang="${note.lang}" class="release-body">${note.text.trim() ? markdownSicuro(note.text) : `<p>${en ? 'Notes are not available in the original release.' : 'Note non disponibili nella release originale.'}</p>`}</div>`;
      corpo += `<p><a href="${e(r.html_url)}" rel="noopener noreferrer">${en ? 'Original GitHub release' : 'Release GitHub originale'}</a></p><details><summary>${en ? 'Source and artifact metadata' : 'Metadati fonte e artefatti'}</summary><p>SHA-256 body: <code>${r.body_sha256}</code></p><p>${en ? 'Client source commit' : 'Commit sorgente client'}: <code>${e(r.source_commit || (en ? 'not attested' : 'non attestato'))}</code></p><ul>${r.assets.map(a => `<li>${e(a.name)} · ${a.size} byte · <code>${e(a.digest || 'n.d.')}</code></li>`).join('')}</ul></details>`;
      pagine.set(`${lingua}/note-versione/${slugRelease(r)}.html`, { title: r.name, page: 'updates', main: cornice(r.name, en ? 'Original release notes and verified publication metadata.' : 'Note originali e metadati verificati della pubblicazione.', pannello(en ? 'Release' : 'Release', corpo)) });
    }
    const indice = GUIDE.map(([slug, it, inglese]) => `<li>${link(`guide/${slug}`, en ? inglese : it)}</li>`).join('');
    pagine.set(`${lingua}/guide.html`, { title: en ? 'MOX guides' : 'Guide MOX', page: 'guides', main: cornice(en ? 'MOX guides' : 'Guide MOX', en ? 'Start, play, understand data and choose sharing.' : 'Inizia, gioca, interpreta i dati e scegli le condivisioni.', pannello(en ? 'Choose a task' : 'Scegli un percorso', `<ul>${indice}</ul><p>${link('supporto', en ? 'Private Support' : 'Supporto privato')} · ${link('privacy', 'Privacy')}</p>`)) });
    for (const [slug, it, inglese, sezioni] of GUIDE) {
      let corpo = `<p>${link('guide', en ? 'All guides' : 'Tutte le guide')} · ${link('download', 'Download')} · ${link('supporto', en ? 'Support' : 'Supporto')}</p><p>${en ? 'Applies to Stable 2.11.8 and Canary 2.11.9; source behavior checked on October 15, 2026.' : 'Si applica a Stable 2.11.8 e Canary 2.11.9; comportamento sorgente verificato il 15 ottobre 2026.'}</p>`;
      corpo += sezioni.map(([hIt, hEn, pIt, pEn]) => pannello(en ? hEn : hIt, `<p>${e(en ? pEn : pIt)}</p>`)).join('');
      if (slug === 'dati-draft') corpo += tabellaDati(fonti, en);
      corpo += pannello(en ? 'Continue' : 'Prosegui', `<ul>${indice}</ul><p>${link('cosa-invia-mox', en ? 'What MOX sends' : 'Cosa invia MOX')} · ${link('privacy', 'Privacy')} · ${link('note-versione', en ? 'Release notes' : 'Note di versione')}</p>`);
      pagine.set(`${lingua}/guide/${slug}.html`, { title: en ? inglese : it, page: 'guides', main: cornice(en ? inglese : it, en ? 'Practical instructions and explicit limits for the released client.' : 'Istruzioni pratiche e limiti espliciti del client rilasciato.', corpo) });
    }
  }
  return pagine;
}

export function tabellaDati(fonti, en) {
  const m = fonti.public_data.data;
  const gruppi = new Map();
  for (const r of m.entries) { const id = [r.set, r.format, r.source_published_at].join('/'); if (!gruppi.has(id)) gruppi.set(id, []); gruppi.get(id).push(r); }
  return pannello(en ? 'Draft data availability' : 'Disponibilità dati Draft', `<p>${en ? 'Public Data Sets only. Checked' : 'Solo Public Data Sets. Verificato al'} <time datetime="${e(fonti.public_data.fetched_at)}">${e(fonti.public_data.fetched_at)}</time>. ${en ? 'Manifest generated' : 'Manifesto generato'}: ${e(m.generated_at)}.</p><div class="table-scroll" tabindex="0" role="region" aria-label="${en ? 'Public Draft data table' : 'Tabella dati Draft pubblici'}"><table><thead><tr><th>Set</th><th>${en ? 'Format' : 'Formato'}</th><th>${en ? 'Source date' : 'Data sorgente'}</th><th>${en ? 'Tables' : 'Tabelle'}</th></tr></thead><tbody>${[...gruppi.values()].map(righe => `<tr><th scope="row">${e(righe[0].set)}</th><td>${e(righe[0].format)}</td><td>${e(righe[0].source_published_at)}</td><td>${righe.filter(r => r.main_colors === null).length} ${en ? 'global' : 'globale'} + ${righe.filter(r => r.main_colors !== null).length} ${en ? 'color pairs' : 'coppie colori'}</td></tr>`).join('')}</tbody></table></div><p>${en ? 'The manifest exposes no card-level metric coverage. Catalog recognition does not attest statistical availability. FRA API availability is not certified by this public-only manifest; a complete live API registry needs a separately authorized source. No instant refresh is promised.' : 'Il manifesto non espone la copertura delle metriche per carta. Il riconoscimento nel catalogo non attesta disponibilità statistica. La disponibilità API FRA non è certificata da questo manifesto solo pubblico; un registry API live completo richiede una fonte autorizzata separatamente. Nessun refresh istantaneo promesso.'}</p><p>${en ? 'Statistics calculated by MOX from 17Lands Public Data Sets, CC BY 4.0. 17Lands does not endorse MOX.' : 'Statistiche calcolate da MOX sui 17Lands Public Data Sets, CC BY 4.0. 17Lands non approva né sostiene MOX.'} <a href="https://www.17lands.com/public_datasets">17Lands Public Data Sets</a> · <a href="${e(fonti.public_data.source)}">${en ? 'Source manifest' : 'Manifesto fonte'}</a></p>`);
}
