import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const qui = dirname(fileURLToPath(import.meta.url));
const sito = join(qui, "..", "sito");
const leggi = (file) => readFileSync(join(sito, file), "utf8");

test("account espone OAuth, dispositivi, statistiche e dettagli privati", () => {
  const html = leggi("account.html");
  const js = leggi("js/account.js");
  const immaginiJs = leggi("js/card-images.js");
  const immaginiCss = leggi("css/card-images.css");
  const css = leggi("css/account-support.css");
  assert.match(html, /Continua con Google/);
  assert.match(html, /Continua con Discord/);
  assert.match(html, /Genera codice/);
  assert.match(html, /Esporta tutto/);
  assert.match(html, /Elimina dati e account/);
  assert.match(html, /I miei mazzi/);
  assert.match(html, /Le mie partite/);
  assert.match(html, /Draft e risultati/);
  assert.match(html, /Andamento del rank/);
  assert.match(html, /Contro gli archetipi/);
  assert.match(html, /id="detail-dialog"/);
  assert.match(html, /card-images\.css\?v=/);
  assert.match(html, /account-support\.css\?v=/);
  assert.match(js, /credentials:\s*"include"/);
  assert.match(js, /\/account\/link-code/);
  assert.match(js, /\/account\/stats/);
  assert.match(js, /\/account\/matches/);
  assert.match(js, /\/account\/drafts/);
  assert.match(js, /\/account\/decks\/\$\{mazzo\.impronta\}\/name/);
  assert.match(js, /Decklist del Draft/);
  assert.match(js, /La decklist completa è mostrata una sola volta/);
  assert.match(js, /createCardThumbnail/);
  assert.match(js, /Carte avversarie rivelate/);
  assert.match(immaginiJs, /setAttribute\("popover", "manual"\)/);
  assert.match(immaginiJs, /showPopover/);
  assert.match(immaginiJs, /hidePopover/);
  assert.match(immaginiCss, /\.card-hover-preview\s*\{[^}]*inset:\s*auto;[^}]*margin:\s*0;/s);
  assert.match(js, /\/account\/delete/);
  assert.match(css, /personal-deck-row/);
  assert.match(css, /personal-match-row/);
  assert.match(css, /@media \(max-width: 760px\)/);
});

test("account separa mazzi correnti e storico, mostra invii, versioni ed export per sezione", () => {
  const html = leggi("account.html");
  const js = leggi("js/account.js");
  const sessione = leggi("js/sessione-account.js");
  const traduzioniDinamiche = leggi("js/translate.js");
  assert.match(html, /id="last-send"/);
  assert.match(html, /lo stato corrente compare per ciascun dispositivo/);
  assert.match(html, /data-export="matches"/);
  assert.match(html, /data-export="draft"/);
  assert.match(html, /data-export="decks"/);
  assert.match(html, /data-delete-section="partite"/);
  assert.match(html, /data-delete-section="draft"/);
  assert.match(html, /data-delete-section="mazzi"/);
  assert.match(js, /gruppoMazzi\("In Arena"/);
  assert.match(js, /sincronizzati \? "Storico" : "Dalle partite"/);
  assert.match(js, /Versioni del mazzo giocato/);
  assert.match(js, /Nessuna differenza di carte/);
  assert.match(js, /Versioni con lo stesso nome/);
  assert.match(js, /giorni senza nuovi invii/);
  assert.match(js, /Stato consensi non ancora sincronizzato da Mox/);
  assert.match(js, /consenso_partite/);
  assert.match(js, /consenso_draft/);
  assert.match(js, /Record collegato/);
  assert.match(js, /Riepilogo Mox/);
  assert.match(js, /pick-by-pick resta fuori dalla prima beta/);
  assert.match(traduzioniDinamiche, /Mox ha registrato/);
  assert.match(js, /renderProfiloMazzo/);
  assert.match(js, /immagineCondivisibileMazzo/);
  assert.match(js, /Genera anteprima da condividere/);
  assert.match(js, /mostraAnteprimaCondivisibile/);
  assert.match(js, /Copia PNG/);
  assert.match(js, /ClipboardItem/);
  assert.match(js, /PERCORSO_ACCOUNT/);
  assert.match(js, /window\.location\.origin/);
  assert.match(js, /intestazioniSessioneAccount/);
  assert.match(sessione, /mox-preview-session/);
  assert.match(sessione, /authorization: `Bearer \$\{token\}`/);
  assert.match(js, /\/account\/delete-section/);
});

test("supporto distingue ticket anonimo e account e limita gli allegati", () => {
  const html = leggi("supporto.html");
  const js = leggi("js/supporto.js");
  assert.match(html, /Bug/);
  assert.match(html, /value="draft"/);
  assert.match(html, /value="account"/);
  assert.match(html, /value="installazione"/);
  assert.match(html, /value="suggerimenti"/);
  assert.match(html, /Problema dati/);
  assert.match(html, /Suggerimenti/);
  assert.match(html, /rapporto\.json/);
  assert.match(html, /256 KiB/);
  assert.match(html, /Player\.log<\/code> solo se hai selezionato esplicitamente/);
  assert.match(html, /accept="[^"]*(?:zip|\.zip)/i);
  assert.match(html, /turnstile-widget/);
  assert.match(html, /link segreto/i);
  assert.match(js, /FormData/);
  assert.match(js, /\/attachments/);
  assert.match(js, /pacchettoMoxDaZip/);
  assert.match(js, /ripulisciRapportoMox/);
  assert.match(js, /rapporto\.json/);
  assert.match(js, /\/messages/);
});

test("il rank si sceglie come intervallo, non come voce singola", () => {
  const html = leggi("index.html");
  const js = leggi("js/main.js");
  const css = leggi("css/site.css");
  assert.match(html, /id="rank-min"/);
  assert.match(html, /id="rank-max"/);
  assert.doesNotMatch(html, /<select id="rank-filter"/);
  assert.match(js, /Da \$\{elenco\[0\]\} a \$\{elenco\[elenco\.length - 1\]\}/);
  assert.match(js, /elenco\.join\(","\)/);
  assert.match(css, /\.rank-track/);
});

test("cronologie Draft e partite partono corte, con controlli sopra e sotto", () => {
  const html = leggi("account.html");
  const js = leggi("js/account.js");
  assert.match(js, /PASSO_PARTITE = 10/);
  assert.match(js, /PASSO_DRAFT = 10/);
  assert.match(js, /limite: PASSO_PARTITE/);
  assert.match(js, /Riduci a 10 partite/);
  assert.match(js, /Mostra altre partite/);
  assert.match(js, /Riduci a 10 Draft/);
  assert.match(html, /matches-controls-top/);
  assert.match(html, /matches-controls-bottom/);
  assert.match(html, /draft-controls-top/);
  assert.match(html, /draft-controls-bottom/);
});

test("il menu Evento si riempie da tutti gli eventi, non dai soli Draft", () => {
  const js = leggi("js/account.js");
  assert.match(js, /stato\.statistiche\.eventi/);
  // Le sessioni Limited restano dove servono davvero, cioe' nella sezione
  // dei Draft: qui si controlla solo che non riempiano piu' il menu.
  assert.doesNotMatch(js, /eventi\.set\(sessione\.evento/);
});

test("la verifica anti-spam puo' davvero caricarsi", () => {
  // Il 23/08/2026 il widget Turnstile non compariva e la pagina diceva
  // "verifica anti-spam non caricata": la CSP fermava lo script e l'iframe,
  // quindi nessun ticket anonimo poteva essere inviato.
  const headers = leggi("_headers");
  assert.match(headers, /script-src [^;]*https:\/\/challenges\.cloudflare\.com/);
  assert.match(headers, /frame-src [^;]*https:\/\/challenges\.cloudflare\.com/);
});

test("il testo del ticket si legge, e non resta attaccato al nome di chi scrive", () => {
  // Nell'amministrazione autore e messaggio finivano in <strong><small>
  // affiancati: si leggeva "utenteTicket di prova". Ora il messaggio ha un
  // paragrafo suo, in entrambe le pagine.
  const supporto = leggi("js/supporto.js");
  const admin = leggi("js/admin.js");
  const css = leggi("css/account-support.css");
  assert.match(supporto, /className = "message-text"/);
  assert.match(admin, /className = "message-text"/);
  assert.doesNotMatch(admin, /voce\(m\.autore, m\.testo\)/);
  assert.match(css, /\.message-text \{/);
  assert.match(css, /\.message-author \{ display: block/);
});

test("privacy dichiara account OAuth e ticket senza promettere anonimato falso", () => {
  const privacy = leggi("privacy.html");
  assert.match(privacy, /Account e ticket facoltativi/);
  assert.match(privacy, /Google o Discord/);
  assert.match(privacy, /Non chiediamo né conserviamo l'email/);
  assert.match(privacy, /90 giorni/);
  assert.match(privacy, /365 giorni/);
  assert.doesNotMatch(privacy, /Nessun account sul sito/);
});

test("amministrazione ticket usa la sessione account e non un token statico", () => {
  const html = leggi("admin.html");
  const js = leggi("js/admin.js");
  assert.match(html, /Area riservata/);
  assert.match(html, /Ogni modifica viene registrata/);
  assert.match(js, /credentials:\s*"include"/);
  assert.match(js, /\/admin\/tickets/);
  assert.match(html, /value="aperti"/);
  assert.match(html, /id="admin-close"/);
  assert.match(js, /Ticket chiuso/);
  assert.doesNotMatch(js, /TICKET_ADMIN_TOKEN/);
  assert.match(js, /intestazioniSessioneAccount/);
});
