const base = String(process.env.MOX_SITE_URL || "https://moxtracker.app").replace(/\/$/, "");
const api = String(process.env.MOX_API_URL || "https://api.moxtracker.app").replace(/\/$/, "");
const controlli = [
  ["home", `${base}/`, /MOX/i],
  ["draft", `${base}/draft`, /Draft/i],
  ["account", `${base}/account`, /Account|Il mio MOX/i],
  ["supporto", `${base}/supporto`, /Supporto|Support/i],
  ["privacy", `${base}/privacy`, /Privacy/i],
  ["inglese", `${base}/en/`, /Your assistant for MTG Arena/i],
  ["salute API", `${api}/salute`, /"stato"\s*:\s*"vivo"/i],
  ["meta API", `${api}/meta?formato=Standard`, /"partite_totali"/i],
  ["draft API", `${api}/draft/statistiche?periodo=30`, /"totali"/i],
  ["gate account", `${api}/account/me`, /accesso richiesto/i, 401],
];

let fallimenti = 0;
for (const [nome, url, atteso, statoAtteso = 200] of controlli) {
  try {
    const risposta = await fetch(url, { redirect: "follow",
      headers: { accept: "text/html,application/json;q=0.9" } });
    const corpo = await risposta.text();
    const valido = risposta.status === statoAtteso && atteso.test(corpo);
    console.log(`${valido ? "OK" : "ERRORE"} ${nome}: HTTP ${risposta.status}`);
    if (!valido) fallimenti += 1;
  } catch (errore) {
    fallimenti += 1;
    console.error(`ERRORE ${nome}: ${errore.message}`);
  }
}

const release = await fetch("https://github.com/Dennis96/moxtracker/releases/latest/download/Mox-Windows-beta.zip",
  { method: "HEAD", redirect: "follow" });
console.log(`${release.ok ? "OK" : "ERRORE"} download: HTTP ${release.status}`);
if (!release.ok) fallimenti += 1;
if (fallimenti) process.exitCode = 1;
