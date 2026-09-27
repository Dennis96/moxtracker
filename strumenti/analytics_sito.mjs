export const TOKEN_ANALYTICS_PREVIEW = "f78e57ab382d423cb02c7b5414b8929e";
export const TOKEN_ANALYTICS_PRODUZIONE = "ad3e87d3290849cb8eadcf6c74765066";

export function aggiungiBeaconAnalytics(html, token) {
  if (!/^[a-f0-9]{32}$/.test(token)) {
    throw new Error("token Cloudflare Web Analytics preview non valido");
  }
  if (/static\.cloudflareinsights\.com\/beacon\.min\.js/.test(html)) {
    throw new Error("beacon Cloudflare già presente nella pagina");
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
