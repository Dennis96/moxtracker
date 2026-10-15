import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { acquisisci, validaSnapshot } from './modello.mjs';

const file = fileURLToPath(new URL('../../config/news-releases.json', import.meta.url));
let precedente = null;
try { precedente = validaSnapshot(JSON.parse(await readFile(file, 'utf8'))); }
catch (errore) { if (errore.code !== 'ENOENT') throw errore; }
const receipts = JSON.parse(await readFile(new URL('../../config/news-stable-receipts.json', import.meta.url), 'utf8'));
const { snapshot, requests } = await acquisisci({ precedente, receipts, importaLegacy: process.argv.includes('--importa-legacy') });
// Scrittura atomica sullo stesso volume: errori di rete/validazione non toccano last-valid.
const temporaneo = file + '.tmp';
await writeFile(temporaneo, JSON.stringify(snapshot, null, 2) + '\n');
await rename(temporaneo, file);
console.log(`${snapshot.releases.length} release, ${snapshot.tombstones.length} ritiri confermati; ${requests} GET; ${snapshot.fetched_at}`);
