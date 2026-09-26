const PAGES_BEACON = /<!-- Cloudflare Pages Analytics --><script defer src='https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js' data-cf-beacon='([^']+)'><\/script><!-- Cloudflare Pages Analytics -->/g;
const ZONE_BEACON = /<script type="module" src="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js\/[a-f0-9]+" integrity="sha512-[A-Za-z0-9+/=]+" data-cf-beacon='([^']+)' crossorigin="anonymous"><\/script>\r?\n/g;

export function rimuoviBeaconIniettati(html) {
  const trovati = [];
  const rimuovi = (tipo) => (_script, configurazione) => {
    const dati = JSON.parse(configurazione);
    if (!/^[a-f0-9]{32}$/.test(dati.token)) {
      throw new Error(`beacon Cloudflare ${tipo} con token non valido`);
    }
    trovati.push(tipo);
    return "";
  };
  const senzaPages = html.replace(PAGES_BEACON, rimuovi("Pages"));
  const senzaBeacon = senzaPages.replace(ZONE_BEACON, rimuovi("zona"));
  if (trovati.length > 2 || /<script[^>]+static\.cloudflareinsights\.com/.test(senzaBeacon)) {
    throw new Error("iniezione Cloudflare inattesa nell'HTML di release");
  }
  return { html: senzaBeacon, beacon: trovati };
}
