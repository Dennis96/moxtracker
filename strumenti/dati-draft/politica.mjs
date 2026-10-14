#!/usr/bin/env node
// Comando amministrativo del canale dei dati Draft: `central_api`, `public_only`, `off`.
//
// Nasce il 14/10/2026. Scrive il secret `MOX_EXTERNAL_DATA_POLICY` (schema 1,
// lo stesso del kill switch del 28/09) con il campo additivo `channel`, e
// prima di farlo mostra che cosa vedra' **ogni famiglia di client**:
//   - fino alla 2.11.3: niente (non leggono la policy, chiamano 17Lands);
//   - 2.11.4–2.11.8: il solo `mode`, che con `public_only`/`off` e' `disabled`;
//   - client nuovo: il canale.
// Non c'e' nessuna rotta pubblica per cambiarlo: si cambia da qui, da una
// checkout pulita, con wrangler autenticato.
//
// **Predefinito: `--dry-run`.** Scrive davvero solo con `--esegui` **e**
// `--conferma-produzione`. `central_api` richiede `--base` (`owner_decision`,
// decisione del proprietario, o `17lands_permission`, permesso scritto di
// 17Lands), `--riferimento` (dove sta scritta) e un `--modo-legacy` esplicito:
// niente di implicito, e una decisione del proprietario non si registra come
// permesso di 17Lands.
//
// Esempi:
//   node strumenti/dati-draft/politica.mjs --canale public_only --motivo "solo dati pubblici"
//   node strumenti/dati-draft/politica.mjs --canale central_api --base owner_decision \
//     --riferimento "decisione del proprietario 14/10/2026; richiesta a 17Lands del 28/09 senza risposta" \
//     --modo-legacy enabled --motivo "raccolta centrale"
//   node strumenti/dati-draft/politica.mjs --canale off --motivo "richiesta 17Lands" --esegui --conferma-produzione

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { BASI_AUTORIZZAZIONE_API, CANALI_DATI_DRAFT, MODI_DATI_ESTERNI, normalizzaPolitica }
  from "../../src/politica-dati-esterni.js";

export function costruisciSecret({ canale, motivo = "", modoLegacy, base, riferimento, dataDecisione,
  adesso = new Date() }) {
  if (!CANALI_DATI_DRAFT.includes(canale)) throw new Error(`canale non valido: ${canale}`);
  const voce = { reason: String(motivo).slice(0, 200), updated_at: adesso.toISOString(), channel: canale };
  if (canale === "central_api") {
    if (!BASI_AUTORIZZAZIONE_API.includes(base)) {
      throw new Error("central_api richiede --base owner_decision o 17lands_permission");
    }
    if (!riferimento || riferimento.trim().length < 3) {
      throw new Error("central_api richiede --riferimento");
    }
    if (!MODI_DATI_ESTERNI.includes(modoLegacy)) {
      throw new Error("central_api richiede --modo-legacy esplicito");
    }
    voce.mode = modoLegacy;
    voce.api_authorization = { basis: base, reference: riferimento.trim(),
      decided_at: dataDecisione ?? adesso.toISOString().slice(0, 10) };
  } else {
    if (modoLegacy && modoLegacy !== "disabled") {
      throw new Error(`${canale} impone il modo legacy disabled`);
    }
    voce.mode = "disabled";
  }
  return { schema: 1, providers: { "17lands": voce } };
}

// Che cosa fara' ogni famiglia di client con questo secret (senza rete).
export function effetti(secret) {
  const risposta = normalizzaPolitica(JSON.stringify(secret));
  if (!risposta) throw new Error("il secret non supera la validazione del Worker");
  const voce = risposta.providers["17lands"];
  const legacy = { enabled: "chiamano 17Lands e usano le cache",
    cache_only: "nessuna richiesta, usano le cache su disco",
    disabled: "nessuna richiesta e nessuna cache 17Lands" }[voce.mode];
  const nuovo = { central_api: `aggregati API via MOX (${voce.api_authorization?.basis}), poi Public Data Sets`,
    public_only: "solo Public Data Sets (CC BY 4.0)", off: "nessun dato esterno" }[voce.channel];
  return { risposta_worker: { ...risposta, configurata: true },
    client: { "fino a 2.11.3": "invariati: non leggono la policy (limite dichiarato)",
      "2.11.4-2.11.8": `modo ${voce.mode}: ${legacy}`, nuovo: `canale ${voce.channel}: ${nuovo}` } };
}

function argomenti(argv) {
  const a = { esegui: false, conferma: false };
  const nomi = { "--canale": "canale", "--motivo": "motivo", "--modo-legacy": "modoLegacy",
    "--base": "base", "--riferimento": "riferimento", "--data-decisione": "dataDecisione" };
  for (let i = 0; i < argv.length; i += 1) {
    const x = argv[i];
    if (x === "--esegui") a.esegui = true;
    else if (x === "--conferma-produzione") a.conferma = true;
    else if (x === "--dry-run") a.esegui = false;
    else if (nomi[x]) a[nomi[x]] = argv[++i];
    else throw new Error(`argomento sconosciuto: ${x}`);
  }
  return a;
}

export function main(argv = process.argv.slice(2), lancia = null) {
  const a = argomenti(argv);
  const secret = costruisciSecret(a);
  console.log(JSON.stringify({ secret, ...effetti(secret) }, null, 1));
  if (!a.esegui) { console.log("dry-run: secret non scritto"); return 0; }
  if (!a.conferma) { console.error("serve anche --conferma-produzione"); return 3; }
  // Il JSON passa da stdin, mai da una pipe di PowerShell che lo riscrive.
  const esegui = lancia ?? ((input) => spawnSync("npx", ["wrangler", "secret", "put",
    "MOX_EXTERNAL_DATA_POLICY"], { input, stdio: ["pipe", "inherit", "inherit"],
  shell: process.platform === "win32" }).status);
  return esegui(JSON.stringify(secret)) === 0 ? 0 : 4;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = main();
