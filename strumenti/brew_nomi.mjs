// Nomi pubblici dei gruppi Brew: elenco, dry-run e applicazione.
//
// Che cos'e' un nome Brew: soltanto un'etichetta editoriale, scelta a mano
// guardando la decklist rappresentativa che l'API pubblica gia' mostra. Non
// tocca il clustering, non cambia k, la soglia delle 30 partite o il
// classificatore, e non promuove il gruppo ad archetipo: nel sito resta il
// badge «Archetipo non ancora confermato».
//
// Da dove vengono i dati: soltanto dall'API pubblica. Lo strumento non legge
// mai partite, mittenti o liste sotto soglia, perche' l'API non le pubblica:
// se un gruppo non compare in `/meta`, qui non esiste e non si puo' nominare.
//
// Dove scrive: nella sola tabella sidecar `brew_nome`, con un comando D1
// passato a Wrangler. Non crea nessun endpoint amministrativo, non tocca
// `brew_gruppo` ne' `brew_membro` e non indebolisce nessun trigger.
//
// Uso:
//   node strumenti/brew_nomi.mjs --elenca [--api=...] [--formato=Standard] [--periodo=totale]
//   node strumenti/brew_nomi.mjs --mappa=nomi.json            (dry-run)
//   node strumenti/brew_nomi.mjs --mappa=nomi.json --applica --conferma=APPLICA-NOMI-BREW
//
// `nomi.json` e' un oggetto { "bg_<32 esadecimali>": "Nome pubblico", ... }.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { ALGORITMO_BREW } from "../src/brew-clustering.js";
import { CATALOGO_ARCHETIPI } from "../src/catalogo-archetipi-generato.js";

export const CONFERMA = "APPLICA-NOMI-BREW";
export const API_PREDEFINITA = "https://api.moxtracker.app";
export const DATABASE_PREDEFINITO = "moxtracker";
export const LUNGHEZZA_MINIMA = 2;
export const LUNGHEZZA_MASSIMA = 60;

const ID_GRUPPO = /^bg_[0-9a-f]{32}$/;
// Le stesse regole del CHECK sulla colonna `nome`: ASCII stampabile, senza
// apici, virgolette, punto e virgola, barra rovesciata ne' trattini doppi. Il
// testo finisce anche dentro un comando SQL passato a Wrangler, e non deve
// poter chiudere una stringa.
const NOME_VALIDO = /^[ -~]+$/;
const NOME_VIETATO = /['";\\]|--/;

export function validaNome(nome) {
  const testo = String(nome ?? "");
  if (testo !== testo.trim()) return "spazi in testa o in coda";
  if (testo.length < LUNGHEZZA_MINIMA) return `piu' corto di ${LUNGHEZZA_MINIMA} caratteri`;
  if (testo.length > LUNGHEZZA_MASSIMA) return `piu' lungo di ${LUNGHEZZA_MASSIMA} caratteri`;
  if (!NOME_VALIDO.test(testo)) return "caratteri fuori dall'ASCII stampabile";
  if (NOME_VIETATO.test(testo)) return "apici, virgolette, punto e virgola, barra rovesciata o trattini doppi";
  return null;
}

// I nomi del catalogo: un gruppo Brew non deve chiamarsi come un archetipo
// riconosciuto, altrimenti il visitatore lo scambierebbe per quello.
export function nomiCatalogo(catalogo = CATALOGO_ARCHETIPI) {
  const nomi = new Set();
  for (const lista of catalogo?.liste || []) {
    for (const voce of [lista?.nome, lista?.archetipo]) {
      if (voce) nomi.add(String(voce).trim().toLocaleLowerCase("it"));
    }
  }
  return nomi;
}

function apici(valore) {
  const testo = String(valore);
  if (NOME_VIETATO.test(testo) || !NOME_VALIDO.test(testo)) {
    throw new Error(`valore non ammesso in SQL: ${testo}`);
  }
  return `'${testo}'`;
}

async function chiedi(recupera, url) {
  const risposta = await recupera(url);
  if (!risposta.ok) throw new Error(`${url} ha risposto ${risposta.status}`);
  return await risposta.json();
}

// I gruppi pubblici di un formato, con la loro rappresentativa: tutto da
// `/meta` e `/archetipo?id_brew=`, cioe' soltanto cio' che il sito mostra gia'.
export async function leggiGruppiPubblici({ api, formato, periodo, recupera }) {
  const meta = await chiedi(recupera,
    `${api}/meta?formato=${encodeURIComponent(formato)}&periodo=${encodeURIComponent(periodo)}`);
  const altro = (meta?.mazzi || []).find((mazzo) => Array.isArray(mazzo?.gruppi_brew));
  const gruppi = (altro?.gruppi_brew || [])
    .filter((gruppo) => ID_GRUPPO.test(String(gruppo?.gruppo_brew_id || "")));
  const fuori = [];
  for (const gruppo of gruppi) {
    const dettaglio = await chiedi(recupera,
      `${api}/archetipo?formato=${encodeURIComponent(formato)}&periodo=${encodeURIComponent(periodo)}` +
      `&id_brew=${encodeURIComponent(gruppo.gruppo_brew_id)}`);
    const varianti = Array.isArray(dettaglio?.varianti) ? dettaglio.varianti : [];
    const rappresentativa = varianti.find((variante) => variante?.rappresentante === true) ||
      varianti[0] || null;
    fuori.push({
      id: gruppo.gruppo_brew_id,
      nome_pubblico: gruppo.nome_pubblico ?? dettaglio?.nome_pubblico ?? null,
      partite: Number(gruppo.partite) || 0,
      varianti: varianti.length,
      // Solo le carte di una decklist gia' pubblicata: se non lo fosse, l'API
      // non ci darebbe le carte e qui resta una lista vuota.
      carte: (rappresentativa?.decklist_pubblicabile === true && Array.isArray(rappresentativa?.carte)
        ? rappresentativa.carte : [])
        .map((carta) => ({ nome: carta?.nome, copie: Number(carta?.copie) || 0 })),
    });
  }
  return fuori;
}

export function leggiMappa(percorso) {
  const grezzo = JSON.parse(readFileSync(percorso, "utf8"));
  if (!grezzo || typeof grezzo !== "object" || Array.isArray(grezzo)) {
    throw new Error("la mappa deve essere un oggetto { id_gruppo: nome }");
  }
  return grezzo;
}

/**
 * Valida la mappa contro i gruppi pubblici e i nomi gia' assegnati.
 * Non scrive niente: e' il dry-run.
 */
export function pianificaNomi(mappa, gruppi, {
  nomiEsistenti = new Map(), catalogo = CATALOGO_ARCHETIPI,
} = {}) {
  const pubblici = new Map(gruppi.map((gruppo) => [gruppo.id, gruppo]));
  const catalogoNomi = nomiCatalogo(catalogo);
  const errori = [];
  const operazioni = [];
  const visti = new Map();
  for (const [id, nome] of Object.entries(mappa)) {
    const breve = `${String(id).slice(0, 9)}...`;
    if (!ID_GRUPPO.test(String(id))) { errori.push(`${breve}: non e' un id di gruppo Brew`); continue; }
    if (!pubblici.has(id)) { errori.push(`${breve}: non e' un gruppo pubblico di questo formato`); continue; }
    const guasto = validaNome(nome);
    if (guasto) { errori.push(`${breve}: nome rifiutato (${guasto})`); continue; }
    const chiave = String(nome).toLocaleLowerCase("it");
    if (visti.has(chiave)) { errori.push(`${breve}: nome ripetuto nella mappa`); continue; }
    if (catalogoNomi.has(chiave)) {
      errori.push(`${breve}: il nome e' gia' quello di un archetipo del catalogo`);
      continue;
    }
    const proprietario = nomiEsistenti.get(chiave);
    if (proprietario && proprietario !== id) {
      errori.push(`${breve}: il nome e' gia' di un altro gruppo`);
      continue;
    }
    visti.set(chiave, id);
    const gruppo = pubblici.get(id);
    operazioni.push({
      id,
      nome: String(nome),
      precedente: gruppo.nome_pubblico ?? null,
      azione: gruppo.nome_pubblico
        ? (gruppo.nome_pubblico === String(nome) ? "invariato" : "rinomina")
        : "nuovo",
    });
  }
  const senzaNome = gruppi
    .filter((gruppo) => !gruppo.nome_pubblico && !mappa[gruppo.id])
    .map((gruppo) => gruppo.id);
  return { operazioni, errori, senza_nome: senzaNome };
}

export function comandiSql(operazioni, formato, { ora = () => new Date().toISOString() } = {}) {
  const quando = ora();
  return operazioni.filter((operazione) => operazione.azione !== "invariato").map((operazione) =>
    "INSERT INTO brew_nome (gruppo_id, formato, algoritmo, nome, origine, aggiornato) VALUES (" +
    `${apici(operazione.id)}, ${apici(formato)}, ${apici(ALGORITMO_BREW)}, ` +
    `${apici(operazione.nome)}, 'curato', ${apici(quando)}) ` +
    "ON CONFLICT(gruppo_id) DO UPDATE SET nome = excluded.nome, aggiornato = excluded.aggiornato;");
}

// L'esecutore vero: Wrangler sul D1. Le prove ne passano uno finto.
async function wrangler(sql, { database, remoto }) {
  const { spawnSync } = await import("node:child_process");
  const argomenti = ["wrangler", "d1", "execute", database, remoto ? "--remote" : "--local",
    "--json", "--command", sql];
  const esito = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", argomenti,
    { encoding: "utf8", shell: false });
  if (esito.status !== 0) throw new Error(`wrangler: ${esito.stderr || esito.stdout}`);
  return esito.stdout;
}

export async function esegui(argv, {
  stampa = console.log, recupera = fetch, sql = wrangler, ora = () => new Date().toISOString(),
} = {}) {
  const argomento = (nome, difetto = null) => {
    const trovato = argv.find((voce) => voce.startsWith(`--${nome}=`));
    return trovato === undefined ? difetto : trovato.slice(nome.length + 3);
  };
  const api = argomento("api", API_PREDEFINITA).replace(/\/+$/, "");
  const formato = argomento("formato", "Standard");
  const periodo = argomento("periodo", "totale");
  const database = argomento("database", DATABASE_PREDEFINITO);
  const remoto = !argv.includes("--locale");
  const gruppi = await leggiGruppiPubblici({ api, formato, periodo, recupera });

  if (argv.includes("--elenca") || !argomento("mappa")) {
    stampa(JSON.stringify({
      modalita: "elenco",
      api,
      formato,
      periodo,
      gruppi_pubblici: gruppi.length,
      senza_nome: gruppi.filter((gruppo) => !gruppo.nome_pubblico).length,
      gruppi: gruppi.map((gruppo) => ({
        id: gruppo.id,
        nome_pubblico: gruppo.nome_pubblico,
        partite: gruppo.partite,
        varianti: gruppo.varianti,
        rappresentativa: gruppo.carte,
      })),
    }, null, 2));
    return 0;
  }

  const mappa = leggiMappa(argomento("mappa"));
  // I nomi gia' scritti servono a non dare lo stesso nome a due gruppi: li
  // conosce l'API, che li pubblica per ogni gruppo.
  const nomiEsistenti = new Map(gruppi.filter((gruppo) => gruppo.nome_pubblico)
    .map((gruppo) => [String(gruppo.nome_pubblico).toLocaleLowerCase("it"), gruppo.id]));
  const piano = pianificaNomi(mappa, gruppi, { nomiEsistenti });
  const applica = argv.includes("--applica");

  if (piano.errori.length) {
    stampa(JSON.stringify({ modalita: "rifiutato", errori: piano.errori }, null, 2));
    return 1;
  }
  const comandi = comandiSql(piano.operazioni, formato, { ora });
  if (!applica) {
    stampa(JSON.stringify({ modalita: "dry-run", formato, ...piano, comandi: comandi.length }, null, 2));
    stampa(`Nessun dato modificato. Per applicare servono --applica e --conferma=${CONFERMA}.`);
    return 0;
  }
  if (argomento("conferma") !== CONFERMA) {
    throw new Error(`per applicare serve --conferma=${CONFERMA}`);
  }
  for (const comando of comandi) await sql(comando, { database, remoto });
  stampa(JSON.stringify({
    modalita: "applicato", formato, database, remoto, scritti: comandi.length, ...piano,
  }, null, 2));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  esegui(process.argv.slice(2)).then((codice) => process.exit(codice), (guasto) => {
    console.error(guasto.message);
    process.exit(1);
  });
}
