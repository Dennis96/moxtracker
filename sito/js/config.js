const LOCALE = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
// L'anteprima locale usa il proxy in sola lettura di `npm run sito-locale`.
// In produzione il browser parla direttamente con l'API pubblica.
export const API_BASE = LOCALE ? `${window.location.origin}/api` : "https://api.moxtracker.app";
export const DEFAULT_FORMAT = "Standard";
export const FORMATS = ["Standard"];
export const RANKS = ["", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Mythic"];

// Il click sul sito risolve la release GitHub più recente e scarica il suo
// asset ZIP. Il pulsante non punta mai alla pagina delle release né
// all'installer del Worker, riservato all'autoupdate di Mox.
export const DOWNLOAD_URL = "#download";
export const GITHUB_LATEST_RELEASE_API = "https://api.github.com/repos/Dennis96/moxtracker/releases/latest";
export const RELEASE_MANIFEST_URL = "https://api.moxtracker.app/mox/release?piattaforma=win-x64&canale=stable&corrente=0";
