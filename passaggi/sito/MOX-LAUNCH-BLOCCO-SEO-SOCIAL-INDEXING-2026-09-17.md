# MOX — LAUNCH BLOCK: SEO, SOCIAL SHARING E INDICIZZAZIONE

Data: 2026-09-17
Stato: IMPLEMENTAZIONE SU BRANCH, NESSUN DEPLOY
Branch: `chatgpt/launch-seo-social-2026-09-17`
Base: `b3605746e46b6cbdae71fc3ab9f15fa9e305d860`

## Obiettivo

Rendere il candidato launch coerente per motori di ricerca e condivisione social senza rendere indicizzabile la preview.

Scope:

- canonical assolute verso `https://moxtracker.app`;
- hreflang IT/EN + `x-default`;
- Open Graph;
- Twitter Card;
- sitemap XML IT/EN;
- `robots.txt` di produzione indicizzabile con sitemap;
- preview Cloudflare Pages `noindex, nofollow, noarchive` + `Disallow: /`;
- verifica automatica dell'indicizzazione nel gate di release;
- test automatici del build SEO.

Nessun deploy, merge o modifica produzione autorizzati.

## Implementazione

### Build sito

`strumenti/build_sito.mjs` genera SEO soltanto per le pagine statiche pubbliche:

- Home;
- Meta;
- Draft;
- Download;
- Supporto;
- Privacy;
- Cosa invia MOX;
- Note di versione.

`account.html` e `archetipo.html` non ricevono canonical statiche in questa fase: Account non è contenuto SEO e Archetipi può dipendere da parametri/dati dinamici, quindi una canonical unica statica rischierebbe di essere semanticamente sbagliata.

Ogni pagina SEO riceve:

- `rel=canonical`;
- alternate `it`;
- alternate `en`;
- alternate `x-default` verso IT;
- `og:type=website`;
- `og:site_name=MOX`;
- locale Open Graph corretto;
- titolo, descrizione e URL Open Graph;
- immagine Open Graph;
- `twitter:card=summary_large_image`;
- titolo, descrizione e immagine Twitter.

Le pagine inglesi usano canonical e alternate assolute sotto `/en/`.

### Sitemap

La build genera deterministicamente `sitemap.xml` e lo include nel `build-manifest.json`.

Per ogni pagina SEO sono presenti URL IT ed EN con alternate reciproche `it`, `en` e `x-default`.

### Produzione

`sito/robots.txt` resta indicizzabile:

```text
User-agent: *
Allow: /
Sitemap: https://moxtracker.app/sitemap.xml
```

### Preview

Il sorgente statico non contiene un `noindex` permanente, perché la stessa sorgente deve poter essere promossa in produzione.

Durante un deploy `preview`, `strumenti/release_sito.mjs` modifica soltanto gli artefatti di deployment:

- aggiunge `X-Robots-Tag: noindex, nofollow, noarchive` in `_headers`;
- sostituisce il `robots.txt` della preview con `Disallow: /`.

La produzione viene invece costruita nuovamente dalla sorgente canonica e resta indicizzabile.

Il record release salva gli hash reali degli artefatti effettivamente deployati e registra la modalità di indicizzazione verificata.

La promozione in produzione richiede inoltre che il record preview abbia verificato `modalita = noindex`.

## Social image

Finché non viene aggiunto l'asset social dedicato, i tag usano come fallback reale già versionato:

`https://moxtracker.app/assets/home/client-home.webp`

Questo evita riferimenti rotti nel branch.

Asset definitivo previsto:

`site/assets/social/mox-social-card.png`

Dimensione target:

`1200 × 630 px`

Il passaggio al nuovo asset richiede soltanto la sostituzione della costante `IMMAGINE_SOCIAL` dopo aver aggiunto il PNG al repository e aver verificato la resa reale dei link condivisi.

## Test

`prove/build-sito.test.js` copre:

- canonical Home IT/EN;
- hreflang `it`, `en`, `x-default`;
- Open Graph;
- Twitter Card;
- sitemap generata e inclusa nel manifesto;
- `robots.txt` production-ready;
- presenza nel release gate della trasformazione preview noindex;
- obbligo del record preview `noindex` prima della produzione.

## Gate

PASS se:

- la suite `npm.cmd run prove` passa;
- `npm.cmd run sito:build` passa due volte con output deterministico;
- Home IT/EN della build contiene canonical e hreflang corretti;
- `sitemap.xml` contiene URL assolute di produzione;
- robots della build di produzione contiene `Allow: /` + sitemap;
- il piano release preview dichiara `noindex`;
- nessun deploy è stato eseguito;
- dopo il futuro deploy preview, risposta Home contiene `X-Robots-Tag: noindex` e `/robots.txt` contiene `Disallow: /`.

FAIL se:

- canonical punta alla preview;
- la preview può risultare indicizzabile;
- la produzione eredita `noindex`;
- sitemap include URL preview;
- hreflang IT/EN non è reciproco;
- `og:image` punta a un asset inesistente;
- una modifica SEO rende non riproducibile la build.

## Residuo intenzionale

L'unico residuo del blocco è l'asset social 1200×630 dedicato. Fino al suo inserimento il fallback `client-home.webp` mantiene i metadata social validi e non rotti.
