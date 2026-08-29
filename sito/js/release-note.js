import { RELEASE_MANIFEST_URL } from "./config.js";
import { preparaDownloadLatest } from "./download.js";

preparaDownloadLatest();

try {
  const risposta = await fetch(RELEASE_MANIFEST_URL, { headers: { accept: "application/json" } });
  const release = await risposta.json();
  if (!risposta.ok || release?.disponibile !== true) throw new Error("release non disponibile");
  const host = document.querySelector("[data-release-current]");
  if (host) {
    const prefisso = document.documentElement.lang === "en" ? "Current Windows release" : "Release Windows corrente";
    host.textContent = `${prefisso}: ${release.versione}.${release.note ? ` ${release.note}` : ""}`;
  }
} catch {
  // La pagina conserva il link diretto all'installer: il riepilogo testuale
  // è opzionale e non deve impedire il download se il manifesto è temporaneamente irraggiungibile.
}
