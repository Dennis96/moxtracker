#!/usr/bin/env node
// Publisher dei dati Draft pubblici: piano, validazione e swap atomico.
//
// Nasce il 14/10/2026. Prende l'uscita di `mox-core/strumenti/dati_draft_pubblici.py`
// (`payload/<sha>.json` + `voci.json`), la valida tutta, costruisce la
// revisione nuova del manifesto e un **piano** di scritture R2 nell'ordine che
// rende lo scambio atomico per i client:
//   1. i payload nuovi (indirizzati dal loro hash: non sovrascrivono niente);
//   2. la verifica di ogni payload riletto dal bucket (hash uguale);
//   3. l'archivio della revisione (`public/manifests/rev-<n>.json`);
//   4. per ultimo `public/manifest.json`, l'unico oggetto mutabile.
// Un client vede la revisione vecchia o quella nuova, mai una a meta'.
//
// **Predefinito: `--dry-run`.** Scrive davvero solo con `--esegui` **e**
// `--conferma-produzione`, e solo verso un bucket che esiste: oggi non esiste
// (gate del proprietario nel runbook). In questo mandato non si esegue.
//
// Rollback: `--rollback <manifesto archiviato>` ripubblica quelle voci come
// revisione nuova (numero piu' alto): il client rifiuta i numeri piu' bassi,
// quindi un rollback non torna mai indietro di numero.

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { MASSIMO_MANIFESTO, MASSIMO_PAYLOAD, SCHEMA_MANIFESTO, SORGENTI, sha256,
  validaManifesto, validaPayload } from "./contratto.mjs";

export const BUCKET = "moxtracker-draft-stats";
// Tetti di una pubblicazione: ben sotto le quote gratuite di R2 (1 M Class A
// al mese) e abbastanza larghi per un set con tutti i formati e le coppie.
export const LIMITI = Object.freeze({ oggettiPerPubblicazione: 200,
  bytePerPubblicazione: 32 * 1024 * 1024, vociNelManifesto: 600 });

function chiaveVoce(v) { return `${v.set}|${v.format}|${v.main_colors ?? ""}`; }

export function leggiUscita(cartella) {
  const voci = JSON.parse(readFileSync(join(cartella, "voci.json"), "utf8"));
  const payload = new Map();
  for (const nome of readdirSync(join(cartella, "payload"))) {
    payload.set(nome.replace(/\.json$/, ""), readFileSync(join(cartella, "payload", nome)));
  }
  return { voci, payload };
}

// Il piano, senza effetti. `corrente` e' il manifesto pubblicato (o null).
export function pianifica({ voci, payload, corrente = null, adesso = new Date() }) {
  const errori = [];
  if (corrente) errori.push(...validaManifesto(corrente).map((e) => `manifesto corrente: ${e}`));
  const daCaricare = [];
  const giaPresenti = new Set((corrente?.entries ?? []).map((v) => v.sha256));
  for (const voce of voci) {
    const byte = payload.get(voce.sha256);
    if (!byte) { errori.push(`payload mancante ${voce.sha256}`); continue; }
    if (sha256(byte) !== voce.sha256) { errori.push(`hash diverso ${voce.sha256}`); continue; }
    if (byte.length !== voce.bytes || byte.length > MASSIMO_PAYLOAD) {
      errori.push(`dimensione non valida ${voce.sha256}`); continue;
    }
    let documento;
    try { documento = JSON.parse(byte.toString("utf8")); } catch { errori.push(`JSON rotto ${voce.sha256}`); continue; }
    const problemi = validaPayload(documento, "public");
    if (problemi.length) { errori.push(`${voce.sha256}: ${problemi.join("; ")}`); continue; }
    if (documento.set !== voce.set || documento.format !== voce.format
      || (documento.filter.main_colors ?? null) !== (voce.main_colors ?? null)) {
      errori.push(`voce diversa dal payload ${voce.sha256}`); continue;
    }
    if (!giaPresenti.has(voce.sha256)) daCaricare.push(voce);
  }
  const nuove = new Map((corrente?.entries ?? []).map((v) => [chiaveVoce(v), v]));
  for (const v of voci) {
    nuove.set(chiaveVoce(v), { set: v.set, format: v.format, main_colors: v.main_colors ?? null,
      sha256: v.sha256, bytes: v.bytes, source_published_at: v.source_published_at ?? null });
  }
  const manifesto = {
    schema: SCHEMA_MANIFESTO, namespace: "public", source: SORGENTI.public,
    revision: (corrente?.revision ?? 0) + 1,
    generated_at: adesso.toISOString(),
    attribution: { text: "Statistiche calcolate da MOX sui 17Lands Public Data Sets, CC BY 4.0. "
      + "17Lands non approva ne' sostiene MOX.", license: "CC BY 4.0",
    source_url: "https://www.17lands.com/public_datasets" },
    entries: [...nuove.values()].sort((a, b) => chiaveVoce(a).localeCompare(chiaveVoce(b))),
  };
  errori.push(...validaManifesto(manifesto).map((e) => `manifesto nuovo: ${e}`));
  const byteManifesto = Buffer.from(JSON.stringify(manifesto));
  if (byteManifesto.length > MASSIMO_MANIFESTO) errori.push("manifesto oltre il limite");
  if (manifesto.entries.length > LIMITI.vociNelManifesto) errori.push("troppe voci nel manifesto");
  const oggetti = daCaricare.length + 2;
  const byteTotali = daCaricare.reduce((s, v) => s + v.bytes, 0) + 2 * byteManifesto.length;
  if (oggetti > LIMITI.oggettiPerPubblicazione) errori.push("troppi oggetti in una pubblicazione");
  if (byteTotali > LIMITI.bytePerPubblicazione) errori.push("troppi byte in una pubblicazione");
  const operazioni = [
    ...daCaricare.map((v) => ({ tipo: "put", chiave: `public/payload/${v.sha256}.json`, sha256: v.sha256, byte: v.bytes })),
    ...daCaricare.map((v) => ({ tipo: "verifica", chiave: `public/payload/${v.sha256}.json`, sha256: v.sha256 })),
    { tipo: "put", chiave: `public/manifests/rev-${manifesto.revision}.json`, byte: byteManifesto.length },
    { tipo: "put", chiave: "public/manifest.json", byte: byteManifesto.length, ultimo: true },
  ];
  return { ok: errori.length === 0, errori, manifesto, operazioni,
    costi: { classeA: daCaricare.length + 2, classeB: daCaricare.length, byteTotali } };
}

export function pianoRollback({ archiviato, corrente, adesso = new Date() }) {
  const errori = validaManifesto(archiviato).map((e) => `archiviato: ${e}`);
  const manifesto = { ...archiviato, revision: (corrente?.revision ?? 0) + 1,
    generated_at: adesso.toISOString(), rollback_of: archiviato.revision };
  const byte = Buffer.from(JSON.stringify(manifesto)).length;
  return { ok: errori.length === 0, errori, manifesto, operazioni: [
    { tipo: "put", chiave: `public/manifests/rev-${manifesto.revision}.json`, byte },
    { tipo: "put", chiave: "public/manifest.json", byte, ultimo: true }] };
}

// Esecuzione vera: wrangler, un oggetto alla volta, fermandosi al primo errore.
export function esegui(piano, { payload, bucket = BUCKET, lancia = lanciaWrangler }) {
  const cartella = mkdtempSync(join(tmpdir(), "mox-dati-draft-"));
  const manifesto = Buffer.from(JSON.stringify(piano.manifesto));
  for (const op of piano.operazioni) {
    const file = join(cartella, "oggetto.json");
    if (op.tipo === "put") {
      writeFileSync(file, op.sha256 ? payload.get(op.sha256) : manifesto);
      lancia(["r2", "object", "put", `${bucket}/${op.chiave}`, "--file", file,
        "--content-type", "application/json", "--remote"]);
    } else if (op.tipo === "verifica") {
      lancia(["r2", "object", "get", `${bucket}/${op.chiave}`, "--file", file, "--remote"]);
      if (sha256(readFileSync(file)) !== op.sha256) throw new Error(`verifica fallita ${op.chiave}`);
    }
  }
}

function lanciaWrangler(argomenti) {
  const esito = spawnSync("npx", ["wrangler", ...argomenti], { stdio: "inherit", shell: process.platform === "win32" });
  if (esito.status !== 0) throw new Error(`wrangler ${argomenti.slice(0, 3).join(" ")}: ${esito.status}`);
}

function argomenti(argv) {
  const a = { esegui: false, conferma: false };
  for (let i = 0; i < argv.length; i += 1) {
    const x = argv[i];
    if (x === "--esegui") a.esegui = true;
    else if (x === "--conferma-produzione") a.conferma = true;
    else if (x === "--dry-run") a.esegui = false;
    else if (["--uscita", "--manifesto-corrente", "--rollback", "--piano", "--bucket"].includes(x)) a[x.slice(2)] = argv[++i];
    else throw new Error(`argomento sconosciuto: ${x}`);
  }
  return a;
}

export function main(argv = process.argv.slice(2)) {
  const a = argomenti(argv);
  const corrente = a["manifesto-corrente"] ? JSON.parse(readFileSync(a["manifesto-corrente"], "utf8")) : null;
  let piano, payload = new Map();
  if (a.rollback) {
    piano = pianoRollback({ archiviato: JSON.parse(readFileSync(a.rollback, "utf8")), corrente });
  } else {
    if (!a.uscita) throw new Error("serve --uscita");
    const uscita = leggiUscita(a.uscita);
    payload = uscita.payload;
    piano = pianifica({ ...uscita, corrente });
  }
  const riassunto = { ok: piano.ok, errori: piano.errori, revisione: piano.manifesto.revision,
    voci: piano.manifesto.entries.length, operazioni: piano.operazioni, costi: piano.costi };
  if (a.piano) writeFileSync(a.piano, JSON.stringify({ ...riassunto, manifesto: piano.manifesto }, null, 1));
  console.log(JSON.stringify(riassunto, null, 1));
  if (!piano.ok) return 2;
  if (!a.esegui) { console.log("dry-run: nessuna scrittura"); return 0; }
  if (!a.conferma) { console.error("serve anche --conferma-produzione"); return 3; }
  esegui(piano, { payload, bucket: a.bucket ?? BUCKET });
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = main();
