// Script classico, caricato in <head> della Home prima di tutto il resto.
// Il Meta vive in meta.html: i vecchi link /#meta, /index.html#meta e le sue
// sezioni #matchup e #metodo portano alla nuova pagina senza rompersi. Il
// percorso relativo conserva la lingua: /en/#meta diventa /en/meta.html.
(function (radice) {
  const SEZIONI = { "#meta": "", "#matchup": "#matchup", "#metodo": "#metodo" };
  radice.destinazioneMetaLegacy = function (hash, search) {
    if (!Object.prototype.hasOwnProperty.call(SEZIONI, hash)) return null;
    return `./meta.html${search || ""}${SEZIONI[hash]}`;
  };
  const vai = () => {
    const destinazione = radice.destinazioneMetaLegacy(location.hash, location.search);
    if (destinazione) location.replace(destinazione);
  };
  vai();
  // Un #meta aggiunto a una Home già aperta non ricarica la pagina: lo seguiamo.
  if (typeof radice.addEventListener === "function") radice.addEventListener("hashchange", vai);
})(globalThis);
