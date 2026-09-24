import { RELEASE_MANIFEST_URL } from "./config.js";
import { nomeReleasePubblico } from "./format.js";

try {
  const risposta = await fetch(RELEASE_MANIFEST_URL, { headers: { accept: "application/json" } });
  const release = await risposta.json();
  if (!risposta.ok || release?.disponibile !== true) throw new Error("release non disponibile");
  const host = document.querySelector("[data-release-current]");
  if (host) {
    const prefisso = document.documentElement.lang === "en" ? "Latest published Windows release" : "Ultima release Windows pubblicata";
    // Il campo `versione` del manifesto resta quello che l'updater legge; qui
    // si mostra soltanto il nome pubblico ricavato dal numero.
    const nome = nomeReleasePubblico(release.versione);
    // Senza un numero riconoscibile non si mostra il campo grezzo, ma nemmeno
    // si lascia a schermo «Controllo la release pubblicata...» per sempre.
    host.textContent = nome
      ? `${prefisso}: ${nome}`
      : (document.documentElement.lang === "en"
        ? "The latest Windows release is the one linked below."
        : "La release Windows più recente è quella collegata qui sotto.");
  }
} catch {
  // La pagina conserva il link diretto all'installer: il riepilogo testuale
  // è opzionale e non deve impedire il download se il manifesto è temporaneamente irraggiungibile.
}
