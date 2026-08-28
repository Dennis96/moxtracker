const LOCALE = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
// L'anteprima locale usa il proxy in sola lettura di `npm run sito-locale`.
// In produzione il browser parla direttamente con l'API pubblica.
export const API_BASE = LOCALE ? `${window.location.origin}/api` : "https://api.moxtracker.app";
export const DEFAULT_FORMAT = "Standard";
export const FORMATS = ["Standard"];
export const RANKS = ["", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Mythic"];

// Download manuale dal sito: asset pubblicato e verificato della beta corrente.
// Il nome dell'asset GitHub fa parte della release: aggiornarlo insieme a ogni
// nuova beta, invece di puntare a un alias che GitHub non crea automaticamente.
// Il canale firmato /mox/release + /mox/download.exe resta separato per l'autoupdate.
export const DOWNLOAD_URL = "https://github.com/Dennis96/moxtracker/releases/download/mox-v2-beta2.9.27/Mox-v2-beta2.9.27-con-python.zip";
