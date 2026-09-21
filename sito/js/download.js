import { DOWNLOAD_URL, GITHUB_LATEST_RELEASE_API } from "./config.js";
import { nomeReleasePubblico } from "./format.js";

let releaseLatestPromise = null;

function zipPiuRecente(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  return assets.find(asset => /\.zip$/i.test(String(asset?.name || "")) && asset?.browser_download_url) || null;
}

export function releaseGitHubLatest() {
  if (!releaseLatestPromise) {
    releaseLatestPromise = fetch(GITHUB_LATEST_RELEASE_API, {
      headers: { accept: "application/vnd.github+json" },
    }).then(async (risposta) => {
      if (!risposta.ok) throw new Error(`GitHub ${risposta.status}`);
      return risposta.json();
    }).catch((errore) => {
      // Un errore transitorio non viene messo in cache: il prossimo clic puo'
      // sempre riprovare senza costringere l'utente a ricaricare la pagina.
      releaseLatestPromise = null;
      throw errore;
    });
  }
  return releaseLatestPromise;
}

async function indirizzoZipLatest() {
  const asset = zipPiuRecente(await releaseGitHubLatest());
  if (!asset) throw new Error("Nessun archivio ZIP nella release più recente");
  return asset.browser_download_url;
}

export async function mostraReleaseGitHubLatest(root = document) {
  const host = root.querySelector("[data-github-release]");
  if (!host) return;
  try {
    const release = await releaseGitHubLatest();
    const asset = zipPiuRecente(release);
    if (!asset) throw new Error("ZIP non disponibile");
    // Il tag tecnico non si mostra mai: se non se ne ricava un numero di
    // versione, si dice soltanto che lo ZIP piu' recente verra' scelto al
    // download, come nel ramo di errore qui sotto.
    const nome = nomeReleasePubblico(release.tag_name || release.name);
    const inglese = document.documentElement.lang === "en";
    if (!nome) {
      host.textContent = inglese
        ? "The latest Windows ZIP will be selected when you download."
        : "Lo ZIP Windows più recente verrà scelto quando avvii il download.";
      return;
    }
    host.textContent = inglese ? `Latest release: ${nome}` : `Release più recente: ${nome}`;
  } catch {
    host.textContent = document.documentElement.lang === "en"
      ? "The latest Windows ZIP will be selected when you download."
      : "Lo ZIP Windows più recente verrà scelto quando avvii il download.";
  }
}

export function preparaDownloadLatest(root = document) {
  for (const link of root.querySelectorAll("[data-download]")) {
    // Il click passa sempre dal resolver e va direttamente all'asset ZIP
    // dell'ultima release: non usiamo la pagina GitHub delle release come
    // surrogato di un download.
    link.href = DOWNLOAD_URL;
    link.addEventListener("click", async (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (link.dataset.downloadInCorso === "true") return;
      link.dataset.downloadInCorso = "true";
      link.setAttribute("aria-busy", "true");
      try {
        window.location.assign(await indirizzoZipLatest());
      } catch {
        // Non apriamo la pagina delle release come se fosse un download. Il
        // link resta disponibile per un nuovo tentativo quando GitHub torna.
        link.removeAttribute("aria-busy");
        link.dataset.downloadInCorso = "false";
        link.title = document.documentElement.lang === "en"
          ? "Could not prepare the ZIP download. Please try again."
          : "Impossibile preparare il download ZIP. Riprova.";
      }
    });
  }
}
