export function aggiungiBeaconPreview(html, token) {
  if (!/^[a-f0-9]{32}$/.test(token)) {
    throw new Error("token Cloudflare Web Analytics preview non valido");
  }
  if (/static\.cloudflareinsights\.com\/beacon\.min\.js/.test(html)) {
    throw new Error("beacon Cloudflare gia' presente nella pagina");
  }
  if (!/<\/body>/i.test(html)) {
    throw new Error("pagina senza chiusura body");
  }
  const beacon = `<!-- Cloudflare Web Analytics -->` +
    `<script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' ` +
    `data-cf-beacon='{"token": "${token}"}'></script>` +
    `<!-- End Cloudflare Web Analytics -->\n`;
  return html.replace(/<\/body>/i, `${beacon}</body>`);
}
