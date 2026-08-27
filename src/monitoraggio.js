export async function controllaStorageGiornaliero(ambiente) {
  const [partite, draft, sospetti] = await Promise.all([
    ambiente.DB.prepare("SELECT COUNT(*) AS n FROM partite").first(),
    ambiente.DRAFT_DB.prepare("SELECT COUNT(*) AS n FROM draft").first(),
    ambiente.DRAFT_DB.prepare(
      "SELECT COUNT(*) AS n FROM draft WHERE sospetto IS NOT NULL").first(),
  ]);
  if (!ambiente.DRAFT_RAW?.list) throw new Error("bucket Draft non disponibile");
  const oggetti = await ambiente.DRAFT_RAW.list({ limit: 1000 });
  const rapporto = {
    evento: "controllo_storage_giornaliero",
    quando: new Date().toISOString(),
    partite: Number(partite?.n || 0),
    draft: Number(draft?.n || 0),
    draft_sospetti: Number(sospetti?.n || 0),
    oggetti_r2: (oggetti.objects || []).length,
    r2_completo: !oggetti.truncated,
  };
  rapporto.coerente = !rapporto.r2_completo || rapporto.draft === rapporto.oggetti_r2;
  console.log(JSON.stringify(rapporto));
  if (!rapporto.coerente) throw new Error(
    `storage Draft incoerente: D1=${rapporto.draft}, R2=${rapporto.oggetti_r2}`);
  return rapporto;
}
