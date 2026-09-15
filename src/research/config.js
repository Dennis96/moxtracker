// La configurazione Research: un oggetto solo, validato in memoria prima di
// qualunque accesso D1 (addendum finale M8 §8).
//
// Route, preflight e `/salute` leggono tutti questo oggetto: un cap che il
// validator usa e che `/salute` non pubblica, o viceversa, e' esattamente il
// genere di divergenza che fa rifiutare al server quello che il client crede
// ammesso. Qualunque valore mancante o di forma sbagliata spegne Research;
// nessun default permissivo e nessuna deduzione dal piano Cloudflare.
//
// Tre modalita' (`RESEARCH_MODE`), per la remediation del blocker B4:
//
// - `off`: niente Research, nessun accesso D1. E' il valore di un campo
//   assente o scritto male, e anche del vecchio `RESEARCH_ENABLED`, che non si
//   legge piu': una configurazione vecchia resta chiusa invece di aprirsi;
// - `drain`: il rollback dopo la 2.11.0. Niente consensi nuovi e niente
//   upload, ma revoca e cancellazione continuano a funzionare. Tornare a un
//   Worker senza le route Research non e' un rollback sicuro;
// - `on`: tutto, con qualification valida e, in produzione, il limitatore
//   d'ingresso configurato.

import {
  MAX_BODY_BYTES, SUPPORTED_RESEARCH_MODELS, TRANSPORT_RESEARCH, UPPER_BOUND_CLIENT,
  VERSIONI_CONSENSO_RESEARCH,
} from "./registro.js";

// Le chiavi pubbliche dei vettori G5C-04: se compaiono fuori dall'ambiente di
// prova locale qualcuno ha copiato la fixture in produzione.
const CHIAVI_FIXTURE = new Set([
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  "202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f",
]);

const MODI = new Set(["off", "drain", "on"]);
// Dove un limitatore d'ingresso mancante e' ammesso: la prova locale e lo
// staging, che non hanno traffico vero. In produzione e' obbligatorio.
const SENZA_LIMITATORE = new Set(["staging", "prova_locale"]);

const HEX64 = /^[0-9a-f]{64}$/;
const DEPLOYMENT = /^[A-Za-z0-9._-]{1,80}$/;
const ISTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function intero(valore) {
  if (typeof valore === "number") return Number.isSafeInteger(valore) ? valore : null;
  if (typeof valore === "string" && /^[1-9][0-9]{0,8}$/.test(valore)) return Number(valore);
  return null;
}

function leggiJson(testo) {
  if (typeof testo !== "string" || !testo) return undefined;
  try { return JSON.parse(testo); } catch { return null; }
}

function famigliaChiavi(famiglia, ambienteProva) {
  if (!famiglia || typeof famiglia !== "object" || Array.isArray(famiglia)) return null;
  const { corrente, versioni } = famiglia;
  if (!Number.isSafeInteger(corrente) || corrente < 0) return null;
  if (!versioni || typeof versioni !== "object" || Array.isArray(versioni)) return null;
  const pulite = {};
  for (const [versione, chiave] of Object.entries(versioni)) {
    if (!/^(0|[1-9][0-9]{0,8})$/.test(versione)) return null;
    if (typeof chiave !== "string" || !HEX64.test(chiave)) return null;
    if (CHIAVI_FIXTURE.has(chiave) && !ambienteProva) return null;
    pulite[Number(versione)] = chiave;
  }
  if (!(corrente in pulite)) return null;
  return Object.freeze({ corrente, versioni: Object.freeze(pulite) });
}

function chiavi(testo, ambienteProva) {
  const grezze = leggiJson(testo);
  if (!grezze || typeof grezze !== "object") return null;
  const lineage = famigliaChiavi(grezze.lineage, ambienteProva);
  const tombstone = famigliaChiavi(grezze.tombstone, ambienteProva);
  if (!lineage || !tombstone) return null;
  return Object.freeze({ lineage, tombstone });
}

function qualification(testo, deployment, maxContributi, maxQuery, adesso) {
  const grezza = leggiJson(testo);
  if (grezza === undefined) return { stato: "assente", id: null };
  if (!grezza || typeof grezza !== "object" || Array.isArray(grezza) ||
      grezza.versione !== 1 || typeof grezza.id !== "string" ||
      !DEPLOYMENT.test(grezza.id) || typeof grezza.deployment !== "string" ||
      !Number.isSafeInteger(grezza.max_contributions_per_request) ||
      !Number.isSafeInteger(grezza.max_d1_queries_per_request) ||
      typeof grezza.valida_fino !== "string" || !ISTANTE.test(grezza.valida_fino) ||
      Number.isNaN(Date.parse(grezza.valida_fino))) {
    return { stato: "invalida", id: null };
  }
  if (grezza.deployment !== deployment ||
      grezza.max_contributions_per_request !== maxContributi ||
      grezza.max_d1_queries_per_request !== maxQuery) {
    return { stato: "divergente", id: grezza.id };
  }
  if (Date.parse(grezza.valida_fino) <= adesso) return { stato: "stale", id: grezza.id };
  return { stato: "valida", id: grezza.id };
}

const limitatoreValido = (binding) => Boolean(binding) && typeof binding.limit === "function";

export function configResearch(ambiente = {}, adesso = Date.now()) {
  const modo = MODI.has(ambiente.RESEARCH_MODE) ? ambiente.RESEARCH_MODE : "off";
  const ambienteProva = ambiente.RESEARCH_AMBIENTE === "prova_locale";
  let maxContributi = intero(ambiente.RESEARCH_MAX_CONTRIBUTIONS_PER_REQUEST);
  if (maxContributi !== null && (maxContributi < 1 || maxContributi > UPPER_BOUND_CLIENT)) {
    maxContributi = null;
  }
  let maxQuery = intero(ambiente.RESEARCH_MAX_D1_QUERIES_PER_REQUEST);
  if (maxQuery !== null && maxQuery < 1) maxQuery = null;
  const deployment = typeof ambiente.RESEARCH_DEPLOYMENT === "string" &&
    DEPLOYMENT.test(ambiente.RESEARCH_DEPLOYMENT) ? ambiente.RESEARCH_DEPLOYMENT : null;
  const qualifica = qualification(ambiente.RESEARCH_RUNTIME_QUALIFICATION, deployment,
    maxContributi, maxQuery, adesso);
  const chiaviValide = chiavi(ambiente.RESEARCH_HMAC_KEYS, ambienteProva);

  // Il ciclo di vita (revoca, cancellazione) chiede solo quello che usa:
  // chiavi, budget D1 e deployment. Non la qualification: in drain deve
  // funzionare anche quando la qualification e' scaduta.
  let motivoCiclo = null;
  if (modo === "off") motivoCiclo = "spenta";
  else if (maxQuery === null) motivoCiclo = "budget_d1_non_valido";
  else if (deployment === null) motivoCiclo = "deployment_non_valido";
  else if (!chiaviValide) motivoCiclo = "chiavi_non_valide";

  // L'ingresso (consenso nuovo, upload) chiede tutto il resto.
  let motivo = motivoCiclo;
  if (motivo === null && modo === "drain") motivo = "drain";
  else if (motivo === null) {
    if (maxContributi === null) motivo = "cap_contributi_non_valido";
    else if (qualifica.stato !== "valida") motivo = `qualification_${qualifica.stato}`;
    else if (!SENZA_LIMITATORE.has(ambiente.RESEARCH_AMBIENTE) &&
             !limitatoreValido(ambiente.RESEARCH_RATE_LIMITER_INGRESSO)) {
      motivo = "rate_limiter_assente";
    }
  }

  const enabled = motivo === null;
  return Object.freeze({
    modo,
    enabled,
    motivo,
    lifecycle: motivoCiclo === null,
    motivo_ciclo: motivoCiclo,
    transport: TRANSPORT_RESEARCH,
    models: SUPPORTED_RESEARCH_MODELS[TRANSPORT_RESEARCH],
    versioni_consenso: VERSIONI_CONSENSO_RESEARCH,
    max_body_bytes: MAX_BODY_BYTES,
    client_payload_upper_bound: UPPER_BOUND_CLIENT,
    max_contributions_per_request: enabled ? maxContributi : (maxContributi ?? null),
    max_d1_queries_per_request: enabled ? maxQuery : (maxQuery ?? null),
    qualification: Object.freeze(qualifica),
    deployment,
    chiavi: chiaviValide,
    ambiente_prova: ambienteProva,
  });
}

// Quello che il client puo' sapere: niente chiavi, niente deployment interno.
// Da spenta, o in drain, i cap non si pubblicano: il client non deve comporre
// richieste su numeri che nessuno ha qualificato, e non chiede consensi.
export function saluteResearch(config) {
  return {
    enabled: config.enabled,
    modo: config.modo,
    lifecycle: config.lifecycle,
    ...(config.enabled ? {} : { motivo: config.motivo }),
    transport: config.transport,
    models: [...config.models],
    versioni_consenso: [...config.versioni_consenso],
    max_body_bytes: config.max_body_bytes,
    client_payload_upper_bound: config.client_payload_upper_bound,
    max_contributions_per_request: config.enabled ? config.max_contributions_per_request : null,
    max_d1_queries_per_request: config.enabled ? config.max_d1_queries_per_request : null,
    qualification: { stato: config.qualification.stato, id: config.qualification.id },
  };
}
