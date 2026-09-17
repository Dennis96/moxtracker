// S3-META-CATALOG-REFRESH: collector privato dei candidati Brew pubblici.
// Legge soltanto GET pubbliche gia' esposte da MOX. Non interroga D1, endpoint
// admin o liste sotto soglia. Gli artefatti reali vanno in una directory
// temporanea fuori dal repository e non devono essere committati.

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { CATALOGO_ARCHETIPI } from "../src/catalogo-archetipi-generato.js";
import {
  ALGORITMO_BREW, SOGLIA_DISTANZA_BREW, firmaMain, pianificaGruppi,
} from "../src/brew-clustering.js";
import {
  POLICY_ARCHETIPI, classificaFirma, firmaDaCarte, somiglianza, somiglianzaCore,
} from "../src/archetipi.js";

export const API_BASE = "https://api.moxtracker.app";
export const FORMATO = "Standard";
export const PERIODO = "totale";
export const CUTOFF = "2026-09-17";
export const SOGLIA_PUBBLICA = 30;
const IMPRONTA = /^[0-9a-f]{64}$/;
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

function canonicale(valore) {
  if (Array.isArray(valore)) return valore.map(canonicale);
  if (valore && typeof valore === "object") {
    return Object.fromEntries(Object.keys(valore).sort().map((k) => [k, canonicale(valore[k])]));
  }
  return valore;
}

export function jsonCanonico(valore) {
  return JSON.stringify(canonicale(valore));
}

export function sha256(valore) {
  const testo = typeof valore === "string" ? valore : jsonCanonico(valore);
  return createHash("sha256").update(testo, "utf8").digest("hex");
}

export function directoryPrivata(esplicita = null) {
  const fuori = resolve(esplicita || `${tmpdir()}/mox-s3-meta-catalog-refresh-${CUTOFF}`);
  if (fuori === ROOT || fuori.startsWith(`${ROOT}${sep}`)) {
    throw new Error("La directory degli artefatti privati deve stare fuori dal repository.");
  }
  return fuori;
}

function numero(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function estraiImprontePubbliche(meta) {
  const mazzi = Array.isArray(meta?.mazzi) ? meta.mazzi : [];
  const altro = mazzi.find((m) => m?.tipo_dettaglio === "altro") ||
    mazzi.find((m) => !m?.archetipo_id && Array.isArray(m?.varianti_brew));
  if (!altro) return [];
  return (altro.varianti_brew || [])
    .filter((v) => IMPRONTA.test(String(v?.impronta || "")))
    .filter((v) => numero(v?.partite) >= SOGLIA_PUBBLICA && v?.dati_sufficienti !== false)
    .map((v) => ({
      impronta: String(v.impronta).toLowerCase(),
      partite: numero(v.partite),
    }))
    .sort((a, b) => b.partite - a.partite || a.impronta.localeCompare(b.impronta));
}

function righeDaDettaglio(impronta, dettaglio) {
  if (dettaglio?.tipo_dettaglio !== "non_classificato") {
    throw new Error(`Dettaglio ${impronta.slice(0, 8)} non e' un Brew legacy pubblicabile.`);
  }
  const variante = (dettaglio.varianti || []).find((v) =>
    String(v?.impronta || "").toLowerCase() === impronta);
  if (!variante || variante.decklist_pubblicabile !== true || !Array.isArray(variante.carte)) {
    throw new Error(`Decklist pubblica mancante per ${impronta.slice(0, 8)}.`);
  }
  const righe = variante.carte.map((c) => ({
    carta: Number(c?.arena_id),
    copie: Number(c?.copie),
  }));
  if (!righe.length) throw new Error(`Decklist vuota per ${impronta.slice(0, 8)}.`);
  return { righe, carte: variante.carte };
}

function diagnosticaCatalogo(righe) {
  const firmaClassificatore = firmaDaCarte(righe, CATALOGO_ARCHETIPI);
  const corrente = classificaFirma(firmaClassificatore, CATALOGO_ARCHETIPI);
  const vicini = (CATALOGO_ARCHETIPI.liste || []).map((lista) => {
    const core = somiglianzaCore(firmaClassificatore, lista.core || []);
    return {
      id: lista.id || null,
      archetipo_id: lista.archetipo_id || null,
      nome: lista.nome_pubblico || lista.archetipo || lista.nome || null,
      somiglianza_lista: somiglianza(firmaClassificatore, lista.firma || {}),
      core_punteggio: core.punteggio,
      core_carte: core.carte,
      core_totale: core.totale,
    };
  }).sort((a, b) =>
    b.core_punteggio - a.core_punteggio ||
    b.somiglianza_lista - a.somiglianza_lista ||
    String(a.id).localeCompare(String(b.id))
  ).slice(0, 8);
  return { corrente, vicini };
}

function generaIdDeterministico() {
  const n = { bg: 0, bv: 0 };
  return (prefisso) => {
    n[prefisso] += 1;
    return `${prefisso}_${n[prefisso].toString(16).padStart(32, "0")}`;
  };
}

export function creaReportDaRisposte({ meta, dettagli, raccoltoIl = new Date().toISOString() }) {
  const pubbliche = estraiImprontePubbliche(meta);
  if (!pubbliche.length) {
    return {
      schema: "mox-s3-candidati-v1",
      stato: "NESSUN_CANDIDATO_PUBBLICO",
      parametri: parametri(raccoltoIl),
      candidati: [],
      gruppi: [],
    };
  }

  const candidati = pubbliche.map(({ impronta, partite }) => {
    const dettaglio = dettagli[impronta];
    if (!dettaglio) throw new Error(`Risposta dettaglio mancante per ${impronta.slice(0, 8)}.`);
    const { righe, carte } = righeDaDettaglio(impronta, dettaglio);
    const firma = firmaMain(righe, CATALOGO_ARCHETIPI);
    const diagnosi = diagnosticaCatalogo(righe);
    return {
      impronta,
      partite,
      firma,
      righe,
      main_deck: carte.map((c) => ({
        arena_id: Number(c.arena_id),
        copie: Number(c.copie),
        nome: c.nome || CATALOGO_ARCHETIPI.id_a_nome?.[String(c.arena_id)] || null,
      })),
      classificazione_corrente: diagnosi.corrente,
      riferimenti_vicini: diagnosi.vicini,
    };
  });

  const piano = pianificaGruppi({
    candidati: candidati.map((c) => ({ impronta: c.impronta, partite: c.partite, firma: c.firma })),
    soglia: SOGLIA_DISTANZA_BREW,
    generaId: generaIdDeterministico(),
  });
  const perImpronta = new Map(candidati.map((c) => [c.impronta, c]));
  const gruppiMap = new Map();
  for (const membro of piano.membri) {
    if (!gruppiMap.has(membro.gruppo_id)) gruppiMap.set(membro.gruppo_id, []);
    gruppiMap.get(membro.gruppo_id).push(membro);
  }

  const gruppi = [...gruppiMap.entries()].map(([gruppoId, membri]) => {
    const ordinati = membri.map((m) => ({ ...m, candidato: perImpronta.get(m.impronta) }))
      .sort((a, b) => a.distanza - b.distanza || b.candidato.partite - a.candidato.partite ||
        a.impronta.localeCompare(b.impronta));
    const rappresentante = ordinati.find((m) => m.distanza === 0) || ordinati[0];
    const rep = rappresentante.candidato;
    return {
      candidato_id: null,
      gruppo_temporaneo: gruppoId,
      partite_aggregate: ordinati.reduce((s, m) => s + m.candidato.partite, 0),
      varianti_pubbliche: ordinati.length,
      colori_osservati: null,
      rappresentante: {
        impronta: rep.impronta,
        partite: rep.partite,
        main_deck: rep.main_deck,
        riferimenti_catalogo_vicini: rep.riferimenti_vicini,
        classificazione_corrente: rep.classificazione_corrente,
      },
      membri: ordinati.map((m) => ({
        impronta: m.impronta,
        partite: m.candidato.partite,
        distanza_rappresentante: m.distanza,
      })),
      motivo_tecnico_corrente: rep.classificazione_corrente
        ? "INCOERENZA_DA_REVISIONARE: la lista pubblicata come Brew risulta classificabile col catalogo locale."
        : "NON_CLASSIFICATO_DAL_CATALOGO_CORRENTE",
      classe_s3: null,
      decisione_s3: "DA_REVISIONARE_CON_FONTI",
    };
  }).sort((a, b) => b.partite_aggregate - a.partite_aggregate ||
    String(a.gruppo_temporaneo).localeCompare(String(b.gruppo_temporaneo)))
    .map((gruppo, indice) => ({
      ...gruppo,
      candidato_id: `C${String(indice + 1).padStart(3, "0")}`,
    }));

  return {
    schema: "mox-s3-candidati-v1",
    stato: "RACCOLTO",
    parametri: parametri(raccoltoIl),
    candidati: candidati.map((c) => ({
      impronta: c.impronta,
      partite: c.partite,
      classificazione_corrente: c.classificazione_corrente,
      riferimenti_vicini: c.riferimenti_vicini,
    })),
    gruppi,
  };
}

function parametri(raccoltoIl) {
  return {
    formato: FORMATO,
    periodo: PERIODO,
    cutoff_fonti: CUTOFF,
    raccolto_il: raccoltoIl,
    soglia_pubblicazione: SOGLIA_PUBBLICA,
    algoritmo_clustering: ALGORITMO_BREW,
    k: SOGLIA_DISTANZA_BREW,
    policy_classificatore: POLICY_ARCHETIPI,
    stato_decisioni: "PROPOSED_FOR_REVIEW",
  };
}

async function fetchJson(url, fetchImpl = fetch) {
  const risposta = await fetchImpl(url, {
    method: "GET",
    headers: { accept: "application/json" },
    redirect: "error",
  });
  if (!risposta.ok) throw new Error(`GET ${url.pathname}: HTTP ${risposta.status}`);
  return risposta.json();
}

export async function raccogli({ fetchImpl = fetch, outputDir = null } = {}) {
  const base = new URL(API_BASE);
  const metaUrl = new URL("/meta?formato=Standard&periodo=totale", base);
  const meta = await fetchJson(metaUrl, fetchImpl);
  const pubbliche = estraiImprontePubbliche(meta);
  const dettagli = {};

  for (const voce of pubbliche) {
    const url = new URL("/archetipo", base);
    url.searchParams.set("formato", FORMATO);
    url.searchParams.set("periodo", PERIODO);
    url.searchParams.set("impronta", voce.impronta);
    dettagli[voce.impronta] = await fetchJson(url, fetchImpl);
  }

  const raccoltoIl = new Date().toISOString();
  const report = creaReportDaRisposte({ meta, dettagli, raccoltoIl });
  const manifest = {
    schema: "mox-s3-manifest-v1",
    parametri: parametri(raccoltoIl),
    origine: {
      meta: metaUrl.toString(),
      dettagli: pubbliche.map((v) => `/archetipo?formato=${FORMATO}&periodo=${PERIODO}&impronta=${v.impronta}`),
    },
    sha256: {
      meta: sha256(meta),
      dettagli: Object.fromEntries(Object.entries(dettagli).map(([k, v]) => [k, sha256(v)])),
      corpus: sha256({ meta, dettagli }),
    },
    risposte: { meta, dettagli },
  };

  const dir = directoryPrivata(outputDir);
  await mkdir(dir, { recursive: true });
  const jsonPath = resolve(dir, `S3-CANDIDATI-PRIVATO-${CUTOFF}.json`);
  const mdPath = resolve(dir, `S3-CANDIDATI-PRIVATO-${CUTOFF}.md`);
  const manifestPath = resolve(dir, `S3-MANIFEST-PRIVATO-${CUTOFF}.json`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(mdPath, markdown(report, manifest.sha256.corpus), "utf8");
  return { report, manifest, files: { jsonPath, mdPath, manifestPath } };
}

function markdown(report, corpusHash) {
  const righe = [
    `# S3 candidati privati — ${CUTOFF}`,
    "",
    `- Stato: \`${report.stato}\``,
    `- Formato: ${FORMATO}`,
    `- Clustering: \`${ALGORITMO_BREW}\`, k=${SOGLIA_DISTANZA_BREW}`,
    `- SHA-256 corpus: \`${corpusHash}\``,
    `- Gruppi candidati: ${report.gruppi.length}`,
    "",
    "> PRIVATO: contiene impronte/decklist pubbliche raccolte per la revisione S3. Non committare.",
    "",
  ];
  for (const g of report.gruppi) {
    righe.push(`## ${g.candidato_id}`, "");
    righe.push(`- Partite aggregate: ${g.partite_aggregate}`);
    righe.push(`- Varianti pubbliche: ${g.varianti_pubbliche}`);
    righe.push(`- Motivo tecnico corrente: ${g.motivo_tecnico_corrente}`);
    righe.push(`- Classe S3: ${g.classe_s3 ?? "DA DECIDERE"}`, "");
    righe.push("### Riferimenti catalogo più vicini", "");
    for (const r of g.rappresentante.riferimenti_catalogo_vicini.slice(0, 5)) {
      righe.push(`- ${r.nome} (${r.archetipo_id}): core ${(r.core_punteggio * 100).toFixed(1)}%, lista ${(r.somiglianza_lista * 100).toFixed(1)}%`);
    }
    righe.push("");
  }
  return `${righe.join("\n")}\n`;
}

function argomento(argv, nome) {
  const prefisso = `--${nome}=`;
  return argv.find((x) => x.startsWith(prefisso))?.slice(prefisso.length) || null;
}

async function main() {
  const outputDir = argomento(process.argv.slice(2), "output-dir");
  const esito = await raccogli({ outputDir });
  console.log("S3 collector: OK");
  console.log(`  candidati: ${esito.report.gruppi.length}`);
  console.log(`  corpus SHA-256: ${esito.manifest.sha256.corpus}`);
  console.log(`  JSON privato: ${esito.files.jsonPath}`);
  console.log(`  Markdown privato: ${esito.files.mdPath}`);
  console.log(`  Manifest privato: ${esito.files.manifestPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((errore) => {
    console.error(`S3 collector: FAIL — ${errore.message}`);
    process.exit(1);
  });
}
