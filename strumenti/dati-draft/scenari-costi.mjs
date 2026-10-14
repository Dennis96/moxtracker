#!/usr/bin/env node
// Scenari di costo della distribuzione dei dati Draft: 100, 1.000, 10.000 utenti.
//
// Nasce il 14/10/2026. Riproducibile: tutti gli ingressi sono qui sotto, con
// fonte e data; cambiare un'ipotesi vuol dire cambiare una riga e rilanciare.
// I conti si fanno **insieme all'uso gia' esistente** dell'account, non come un
// progetto isolato: le quote incluse sono dell'account intero.
//
//   node strumenti/dati-draft/scenari-costi.mjs

import { pathToFileURL } from "node:url";

// Tariffe pubbliche lette il 14/10/2026 (USD, tasse escluse):
// https://developers.cloudflare.com/workers/platform/pricing/ (agg. 02/10/2026)
// https://developers.cloudflare.com/r2/pricing/ (agg. 01/10/2026)
export const TARIFFE = Object.freeze({
  workersPaidBase: 5, workersRichiesteIncluse: 10_000_000, workersPerMilione: 0.30,
  workersCpuMsInclusi: 30_000_000, workersCpuPerMilioneMs: 0.02,
  r2GbMeseInclusi: 10, r2ClasseAInclusa: 1_000_000, r2ClasseBInclusa: 10_000_000,
  r2PerGbMese: 0.015, r2ClasseAPerMilione: 4.50, r2ClasseBPerMilione: 0.36,
});

// Piano verificato il 14/10/2026 dalla pagina Billing → Subscriptions
// (screenshot dell'utente): Workers Paid e R2 Paid, rinnovo 20/10/2026.
export const PIANO = Object.freeze({ workers: "Workers Paid", r2: "R2 Paid (a consumo)" });

// Uso esistente, misurato il 14/10/2026 via GraphQL Analytics (sola lettura),
// finestra 14/09–13/10/2026, account intero.
export const BASE = Object.freeze({
  workersRichieste: 6456 + 397,      // moxtracker + moxtracker-research-staging
  r2Byte: 3239478 + 472105205 + 1058988, // draft-raw + releases + ticket-files
  r2ClasseA: 59 + 32 + 3,            // PutObject + ListObjects + ListBuckets
  r2ClasseB: 33 * 3 + 61 + 70 + 1,   // HeadBucket + GetObject + GetBucketLifecycle
  cpuMs: null,                     // CPU dell'account non misurata: n.d.
});

// Misure della pipeline su TMT PremierDraft reale (14/10/2026).
export const MISURE = Object.freeze({ payloadPerSetFormato: 11, bytePerSetFormato: 567402,
  byteGlobale: 62399, byteCoppiaMedio: Math.round((567402 - 62399) / 10) });

// Ipotesi per utente attivo al mese. `prudente`: manifesto ogni 6 ore per 30
// giorni e 4 revisioni al mese con 3 payload ciascuna. `pessimo`: un
// controllo all'ora (riavvii, piu' processi) e 30 payload. Con central_api:
// `prudente` = globale, colori e coppia, due rinnovi/giorno; `pessimo` =
// 12 richieste API/giorno, includendo ripieghi di formato e tentativi.
// Sono ipotesi di scenario, non misure o limiti del comportamento del client.
export const IPOTESI = Object.freeze({
  prudente: { manifestoAlMese: 4 * 30, payloadAlMese: 12, apiAlMese: 3 * 2 * 30 },
  pessimo: { manifestoAlMese: 24 * 30, payloadAlMese: 30, apiAlMese: 12 * 30 },
});
// Conservazione: 10 set×formato attivi, 3 revisioni ciascuno; 4 pubblicazioni al mese.
export const PUBBLICAZIONE = Object.freeze({ setFormatiAttivi: 10, revisioniTenute: 3,
  pubblicazioniAlMese: 4 });

// Raccolta API centrale (decisione del proprietario, 14/10/2026): cron orario,
// 2 set attivi × 3 formati × 12 tabelle (globale, colori, 10 coppie), ogni
// tabella rinnovata 2 volte al giorno. Ogni giro legge lo stato di tutte le
// tabelle (HEAD), nel caso pessimo anche il loro segnaposto di rifiuto, e
// l'elenco dei set; i rifiuti definitivi scrivono un segnaposto (qui: tutte le
// tabelle rifiutate una volta al giorno, pessimo).
export const RACCOLTA = Object.freeze({ setAttivi: 2, formatiPerSet: 3, tabellePerFormato: 12,
  rinnoviAlGiorno: 2, giriAlGiorno: 24 });

export function raccoltaAlMese(r = RACCOLTA) {
  const tabelle = r.setAttivi * r.formatiPerSet * r.tabellePerFormato;
  const giri = r.giriAlGiorno * 30;
  const scritture = tabelle * r.rinnoviAlGiorno * 30;
  return { tabelle, invocazioni: giri, richieste17Lands: scritture,
    richieste17LandsAlGiorno: tabelle * r.rinnoviAlGiorno,
    classeA: scritture + tabelle * 30, classeB: giri * (2 * tabelle + 1), byte: tabelle * 250_000 };
}

const oltre = (uso, incluso, perMilione) => Math.max(0, uso - incluso) / 1e6 * perMilione;

export function costo({ richieste, byte, classeA, classeB, cpuMs = null }, t = TARIFFE) {
  const gb = byte / 1e9;
  const richiesteWorkers = t.workersPaidBase + oltre(richieste, t.workersRichiesteIncluse, t.workersPerMilione);
  const cpu = cpuMs === null ? "n.d." : oltre(cpuMs, t.workersCpuMsInclusi, t.workersCpuPerMilioneMs);
  return {
    workers_richieste: richiesteWorkers,
    workers_cpu: cpu,
    workers: cpu === "n.d." ? "n.d." : richiesteWorkers + cpu,
    r2: Math.max(0, gb - t.r2GbMeseInclusi) * t.r2PerGbMese
      + oltre(classeA, t.r2ClasseAInclusa, t.r2ClasseAPerMilione)
      + oltre(classeB, t.r2ClasseBInclusa, t.r2ClasseBPerMilione),
  };
}

export function scenario(utenti, ipotesi, cpu = { esistenteMs: BASE.cpuMs,
  perRichiestaMs: null, perGiroMs: null }) {
  const apiPerUtente = ipotesi.apiAlMese ?? 0;
  const pubbliche = ipotesi.manifestoAlMese + ipotesi.payloadAlMese;
  const perUtente = pubbliche + apiPerUtente;
  // Ogni richiesta al Worker e' una lettura R2 (anche il 304: si legge l'ETag).
  const raccolta = raccoltaAlMese();
  const aggiunte = {
    richieste: utenti * perUtente + raccolta.invocazioni,
    byte: PUBBLICAZIONE.setFormatiAttivi * PUBBLICAZIONE.revisioniTenute * MISURE.bytePerSetFormato
      + raccolta.byte,
    classeA: PUBBLICAZIONE.pubblicazioniAlMese * (MISURE.payloadPerSetFormato + 2) + raccolta.classeA,
    // API: GET della tabella + GET dei set nel caso prudenziale di cache
    // dell'isolato sempre fredda. Pubblici: una lettura per richiesta.
    classeB: utenti * (pubbliche + 2 * apiPerUtente)
      + PUBBLICAZIONE.pubblicazioniAlMese * MISURE.payloadPerSetFormato
      + raccolta.classeB,
  };
  const base = { richieste: BASE.workersRichieste, byte: BASE.r2Byte,
    classeA: BASE.r2ClasseA, classeB: BASE.r2ClasseB };
  const totale = Object.fromEntries(Object.keys(base).map((k) => [k, base[k] + aggiunte[k]]));
  const noteCpu = [cpu.esistenteMs, cpu.perRichiestaMs, cpu.perGiroMs];
  if (noteCpu.some((v) => v !== null && (!Number.isFinite(v) || v < 0))) {
    throw new Error("misure CPU non valide");
  }
  totale.cpuMs = noteCpu.includes(null) ? null : cpu.esistenteMs
    + utenti * perUtente * cpu.perRichiestaMs + raccolta.invocazioni * cpu.perGiroMs;
  const prima = costo({ ...base, cpuMs: cpu.esistenteMs });
  const dopo = costo(totale);
  const egressByte = utenti * (ipotesi.manifestoAlMese * 2048 * 0.05 // 5% di 200 col corpo
    + ipotesi.payloadAlMese * ((MISURE.byteGlobale + 2 * MISURE.byteCoppiaMedio) / 3));
  return {
    utenti, aggiunte, totale,
    quota_workers_usata: totale.richieste / TARIFFE.workersRichiesteIncluse,
    quota_r2_b_usata: totale.classeB / TARIFFE.r2ClasseBInclusa,
    richieste_al_giorno: Math.round(totale.richieste / 30),
    costo_prima: prima, costo_dopo: dopo,
    cpu_ms: totale.cpuMs ?? "n.d.",
    misure_cpu: cpu,
    richieste_api_client: utenti * apiPerUtente,
    incrementale_usd: prima.workers === "n.d." || dopo.workers === "n.d." ? "n.d."
      : +(dopo.workers + dopo.r2 - prima.workers - prima.r2).toFixed(4),
    totale_usd: dopo.workers === "n.d." ? "n.d." : +(dopo.workers + dopo.r2).toFixed(4),
    incrementale_parziale_usd: +(dopo.workers_richieste + dopo.r2
      - prima.workers_richieste - prima.r2).toFixed(4),
    totale_parziale_usd: +(dopo.workers_richieste + dopo.r2).toFixed(4),
    egress_gb: +(egressByte / 1e9).toFixed(3),
  };
}

export function tutti() {
  const fuori = {};
  for (const [nome, ipotesi] of Object.entries(IPOTESI)) {
    fuori[nome] = [100, 1000, 10000].map((u) => scenario(u, ipotesi));
  }
  // Fino a quanti utenti il caso pessimo resta dentro le richieste incluse.
  const perUtente = IPOTESI.pessimo.manifestoAlMese + IPOTESI.pessimo.payloadAlMese + IPOTESI.pessimo.apiAlMese;
  fuori.soglia_utenti_pessimo = Math.floor(
    (TARIFFE.workersRichiesteIncluse - BASE.workersRichieste - raccoltaAlMese().invocazioni) / perUtente);
  fuori.raccolta = raccoltaAlMese();
  return fuori;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  console.log(JSON.stringify({ piano: PIANO, tariffe: TARIFFE, base: BASE, misure: MISURE,
    ipotesi: IPOTESI, scenari: tutti() }, null, 1));
}
