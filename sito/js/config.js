const LOCALE = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
// L'anteprima locale usa il proxy in sola lettura di `npm run sito-locale`.
// In produzione il browser parla direttamente con l'API pubblica.
export const API_BASE = LOCALE ? `${window.location.origin}/api` : "https://api.moxtracker.app";
export const DEFAULT_FORMAT = "Standard";
export const FORMATS = ["Standard"];
export const RANKS = ["", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Mythic"];

// Il Worker pubblica lo stesso installer firmato usato dall'autoupdate. Il nome
// del file resta stabile mentre il contenuto passa alla release stable più recente.
export const DOWNLOAD_URL = "https://api.moxtracker.app/mox/download.exe";
export const RELEASE_MANIFEST_URL = "https://api.moxtracker.app/mox/release?piattaforma=win-x64&canale=stable&corrente=0";
