import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function limiteWilson(vittorie, partite, z = 1.959963984540054) {
  if (!partite) return null;
  const p = vittorie / partite;
  const d = 1 + z * z / partite;
  return (p + z * z / (2 * partite) - z * Math.sqrt(
    p * (1 - p) / partite + z * z / (4 * partite * partite))) / d;
}

function percentile(valori, valore) {
  if (valori.length <= 1) return 0.5;
  const minori = valori.filter((v) => v < valore).length;
  const uguali = valori.filter((v) => v === valore).length;
  return (minori + (uguali - 1) / 2) / (valori.length - 1);
}

export function confrontaFormule(meta) {
  const eleggibili = (meta.mazzi || []).filter((m) => m.dati_sufficienti &&
    Number.isFinite(Number(m.win_rate)) && Number(m.partite) >= 30);
  const campioni = eleggibili.map((m) => Math.log1p(Number(m.partite)));
  return eleggibili.map((m) => {
    const n = Number(m.partite);
    const vittorie = Number(m.vittorie);
    const wilson = limiteWilson(vittorie, n);
    const popolarita = percentile(campioni, Math.log1p(n));
    return {
      nome: m.nome,
      partite: n,
      win_rate: Number(m.win_rate),
      quota_meta: Number(m.quota_meta),
      wilson_95_inferiore: Math.round(wilson * 10000) / 100,
      candidato_conservativo: Math.round((0.7 * wilson + 0.3 * popolarita) * 1000) / 10,
    };
  }).sort((a, b) => b.candidato_conservativo - a.candidato_conservativo);
}

async function leggi(sorgente) {
  if (/^https?:/i.test(sorgente)) {
    const risposta = await fetch(sorgente);
    if (!risposta.ok) throw new Error(`HTTP ${risposta.status}`);
    return risposta.json();
  }
  return JSON.parse(await readFile(sorgente, "utf8"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sorgente = process.argv[2] || "https://api.moxtracker.app/meta?formato=Standard";
  const meta = await leggi(sorgente);
  console.log(JSON.stringify({ partite_totali: meta.partite_totali,
    aggiornato: meta.aggiornato, eleggibili: confrontaFormule(meta) }, null, 2));
}
