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

/** Esegue i compiti della manutenzione notturna e dice quale e' fallito (P5).
 *
 * `compiti` e' un elenco di `[nome, promessa]`. Fino al 04/10/2026 il cron
 * finiva con un solo «manutenzione programmata incompleta», e i log di
 * Cloudflare non riportavano le cause interne di `AggregateError`: il 02 e il
 * 03/10 e' servito incrociare a mano il rapporto dello storage per scoprire
 * che era il controllo D1/R2. Adesso ogni compito fallito ha una riga sua, con
 * nome, tipo e messaggio, e il nome finisce anche nel messaggio d'errore. Un
 * fallimento resta un fallimento: niente viene saltato o promosso a successo.
 */
export async function eseguiManutenzione(compiti) {
  const esiti = await Promise.allSettled(compiti.map(([, lavoro]) => lavoro));
  const falliti = [];
  esiti.forEach((esito, indice) => {
    if (esito.status !== "rejected") return;
    const nome = compiti[indice][0];
    falliti.push(nome);
    console.error(JSON.stringify({
      evento: "manutenzione_compito_fallito",
      compito: nome,
      tipo: String(esito.reason?.name || typeof esito.reason).slice(0, 60),
      messaggio: String(esito.reason?.message ?? esito.reason).slice(0, 300),
    }));
  });
  console.log(JSON.stringify({ evento: "manutenzione_programmata",
    compiti: compiti.map(([nome]) => nome), falliti }));
  if (falliti.length) {
    throw new AggregateError(esiti.filter((e) => e.status === "rejected").map((e) => e.reason),
      `manutenzione programmata incompleta: ${falliti.join(", ")}`);
  }
  return { compiti: compiti.length, falliti };
}
