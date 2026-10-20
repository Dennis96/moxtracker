import { readFile, writeFile, rename } from 'node:fs/promises';
import { createPublicKey, verify } from 'node:crypto';
import { sha256 } from './modello.mjs';
import { validaFonti } from './pagine.mjs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const base = new URL('../../config/', import.meta.url);
export async function acquisisciFonti(key, { fetcher = fetch, now = new Date().toISOString() } = {}) {
if (key.algoritmo !== 'RS256' || key.esponente !== 65537 || !/^[a-f0-9]{512,}$/i.test(key.modulo)) throw new Error('Chiave pubblica non valida');
const pubblica = createPublicKey({ key: { kty: 'RSA', n: Buffer.from(key.modulo, 'hex').toString('base64url'), e: 'AQAB' }, format: 'jwk' });
async function leggi(url) {
  const risposta = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
  if (!risposta.ok) throw new Error(`Fonte HTTP ${risposta.status}`);
  const body = await risposta.text();
  const data = JSON.parse(body);
  return { source: url, fetched_at: now, sha256: sha256(body), data_sha256: sha256(JSON.stringify(data)), data };
}
const channels = {};
for (const canale of ['stable', 'canary']) {
  const fonte = await leggi(`https://api.moxtracker.app/mox/release?piattaforma=win-x64&canale=${canale}&corrente=0`);
  const { firma, ...manifesto } = fonte.data;
  const canone = JSON.stringify(Object.fromEntries(Object.entries(manifesto).sort(([a], [b]) => a.localeCompare(b))));
  if (!verify('RSA-SHA256', Buffer.from(canone), pubblica, Buffer.from(firma, 'base64'))) throw new Error(`Firma ${canale} non valida`);
  channels[canale] = { ...fonte, signature_verified: true, requested_channel: canale };
}
const publicData = await leggi('https://api.moxtracker.app/mox/draft-data/v1/public/manifest.json');
const result = { schema_version: 1, verified_at: now, public_key_sha256: sha256(JSON.stringify(key)), channels, public_data: publicData };
return validaFonti(result, key);
}

export async function salvaFonti(key, { scrivi = writeFile, sposta = rename, ...opzioni } = {}) {
const result = await acquisisciFonti(key, opzioni);
// Le due acquisizioni sono candidate locali; nessuna scrittura sulle fonti.
const file = new URL('news-fonti.json', base), tmp = new URL('news-fonti.json.tmp', base);
await scrivi(tmp, JSON.stringify(result, null, 2) + '\n');
await sposta(tmp, file);
return result;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
const key = JSON.parse(await readFile(new URL('news-update-public-key.json', base), 'utf8'));
const result = await salvaFonti(key);
console.log(`Fonti pubbliche verificate al ${result.verified_at}; firme Stable/Canary valide; manifesto ${result.public_data.sha256}`);
}
