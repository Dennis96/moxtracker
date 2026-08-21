const LOCALE = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
// L'anteprima locale usa il proxy in sola lettura di `npm run sito-locale`.
// In produzione il browser parla direttamente con l'API pubblica.
export const API_BASE = LOCALE ? `${window.location.origin}/api` : "https://api.moxtracker.app";
export const DEFAULT_FORMAT = "Standard";
export const FORMATS = ["Standard"];
export const RANKS = ["", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Mythic"];

// Nome stabile dell'asset nella release GitHub piu' recente: il sito non deve
// cambiare URL a ogni nuova beta di Mox.
export const DOWNLOAD_URL = "https://github.com/Dennis96/moxtracker/releases/latest/download/Mox-Windows-beta.zip";
