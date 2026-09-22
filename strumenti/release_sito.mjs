import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = fileURLToPath(new URL("..", import.meta.url));
const CONFIG = JSON.parse(readFileSync(join(RADICE, "release-sito.config.json"), "utf8"));
const CONFERMA_PRODUZIONE = "PUBBLICA-SITO-PRODUZIONE";
const WRANGLER_CLI = fileURLToPath(
  new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const CARTELLA_BUILD = join(RADICE, ".dist", "sito");

function argomento(nome, predefinito = null) {
  const prefisso = `--${nome}=`;
  return process.argv.find((voce) => voce.startsWith(prefisso))?.slice(prefisso.length) ?? predefinito;
}

function git(...argomenti) {
  return execFileSync("git", ["-c", `safe.directory=${RADICE.replaceAll("\\", "/")}`,
    ...argomenti], { cwd: RADICE, encoding: "utf8" }).trim();
}

function esegui(comando, argomenti) {
  const esito = spawnSync(comando, argomenti, { cwd: RADICE, encoding: "utf8", stdio: "inherit" });
  if (esito.status !== 0) throw new Error(`gate fallito: ${comando} ${argomenti.join(" ")}`);
}

function preparaIndicizzazione(ambiente) {
  if (ambiente !== "preview") return;
  const headersFile = join(CARTELLA_BUILD, "_headers");
  let headers = readFileSync(headersFile, "utf8");
  if (!headers.includes("X-Robots-Tag: noindex")) {
    headers = headers.replace(
      /^\/\*\r?\n/m,
      "/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n",
    );
  }
  writeFileSync(headersFile, headers);
  writeFileSync(join(CARTELLA_BUILD, "robots.txt"), "User-agent: *\nDisallow: /\n");
}

function hashDeployment(manifesto) {
  const risultati = {};
  for (const nome of Object.keys(manifesto.file)) {
    const corpo = readFileSync(join(CARTELLA_BUILD, nome));
    risultati[nome] = createHash("sha256").update(corpo).digest("hex");
  }
  return Object.fromEntries(Object.entries(risultati).sort(([a], [b]) => a.localeCompare(b)));
}

function verificaDatiLegaliProduzione() {
  const privacy = readFileSync(join(CARTELLA_BUILD, "privacy.html"), "utf8");
  if (privacy.includes("data-legal-todo") ||
      privacy.includes("[NOME/COGNOME O DENOMINAZIONE DA FORNIRE]")) {
    throw new Error("produzione bloccata: identità del titolare privacy non completata");
  }
}

async function smokeTest(base) {
  const percorsi = ["/", "/draft", "/account", "/supporto", "/privacy", "/en/"];
  const risultati = [];
  for (const percorso of percorsi) {
    const url = new URL(percorso, base);
    let ultimo;
    for (let tentativo = 0; tentativo < 4; tentativo += 1) {
      try {
        ultimo = await fetch(url, { redirect: "follow" });
        if (ultimo.ok) break;
      } catch (errore) { ultimo = errore; }
      await new Promise((risolvi) => setTimeout(risolvi, 1_000));
    }
    if (!(ultimo instanceof Response) || !ultimo.ok) {
      throw new Error(`smoke test fallito per ${url}`);
    }
    risultati.push({ percorso, stato: ultimo.status });
  }
  return risultati;
}

async function verificaIndicizzazione(base, ambiente) {
  const home = await fetch(new URL("/", base), { redirect: "follow" });
  const robotsResponse = await fetch(new URL("/robots.txt", base), { redirect: "follow" });
  if (!home.ok || !robotsResponse.ok) {
    throw new Error("verifica indicizzazione fallita: home o robots.txt non raggiungibile");
  }
  const xRobots = home.headers.get("x-robots-tag") || "";
  const robots = await robotsResponse.text();
  if (ambiente === "preview") {
    if (!/\bnoindex\b/i.test(xRobots) || !/^Disallow:\s*\/\s*$/im.test(robots)) {
      throw new Error("preview non protetta da noindex + robots Disallow");
    }
    return { modalita: "noindex", x_robots_tag: xRobots, robots: "disallow-all" };
  }
  if (/\bnoindex\b/i.test(xRobots) ||
      !/^Allow:\s*\/\s*$/im.test(robots) ||
      !/^Sitemap:\s*https:\/\/moxtracker\.app\/sitemap\.xml\s*$/im.test(robots)) {
    throw new Error("produzione non configurata come indicizzabile");
  }
  return { modalita: "index", x_robots_tag: xRobots || null, robots: "allow+sitemap" };
}

const ambiente = argomento("environment", "preview");
const deploy = process.argv.includes("--deploy");
if (!["preview", "production"].includes(ambiente)) {
  throw new Error("--environment deve essere preview o production");
}
if (git("status", "--porcelain", "--untracked-files=all")) {
  throw new Error("release rifiutata: working tree non pulita");
}
const ramo = git("branch", "--show-current");
if (ramo !== CONFIG.source_branch) {
  throw new Error(`release rifiutata: ramo ${ramo}, atteso ${CONFIG.source_branch}`);
}
const commit = git("rev-parse", "HEAD");
let upstream;
try { upstream = git("rev-parse", "@{u}"); }
catch { throw new Error("release rifiutata: ramo senza upstream remoto"); }
if (upstream !== commit) {
  throw new Error("release rifiutata: HEAD non coincide con l'upstream remoto");
}

esegui(process.execPath, ["--test", "prove/*.test.js"]);
esegui(process.execPath, ["strumenti/build_sito.mjs"]);
const manifesto = JSON.parse(readFileSync(join(CARTELLA_BUILD, "build-manifest.json"), "utf8"));
if (manifesto.commit_git !== commit) throw new Error("manifesto e commit Git non coincidono");

const ramoPages = ambiente === "production"
  ? CONFIG.production_branch
  : CONFIG.preview_branch;
if (!ramoPages || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(ramoPages)) {
  throw new Error(`ramo Pages non valido per ${ambiente}`);
}
const comando = [
  "wrangler", "pages", "deploy", ".dist/sito",
  `--project-name=${CONFIG.project_name}`,
  `--branch=${ramoPages}`,
  `--commit-hash=${commit}`,
  `--commit-message=Sito ${manifesto.build_id}`,
  "--commit-dirty=false",
];
let proveVisive = null;

if (!deploy) {
  console.log(JSON.stringify({ modalita: "piano", ambiente, ramo_sorgente: ramo,
    ramo_pages: ramoPages, commit, build_id: manifesto.build_id,
    indicizzazione: ambiente === "preview" ? "noindex" : "index",
    comando: ["npx", ...comando] }, null, 2));
  process.exit(0);
}

if (ambiente === "production") {
  verificaDatiLegaliProduzione();
  if (argomento("conferma") !== CONFERMA_PRODUZIONE) {
    throw new Error(`la produzione richiede --conferma=${CONFERMA_PRODUZIONE}`);
  }
  const recordPreview = argomento("preview-record");
  if (!recordPreview) throw new Error("la produzione richiede --preview-record=<file>");
  const preview = JSON.parse(readFileSync(recordPreview, "utf8"));
  if (preview.ambiente !== "preview" || preview.commit !== commit ||
      preview.build_id !== manifesto.build_id || preview.indicizzazione?.modalita !== "noindex" ||
      !Array.isArray(preview.smoke_test) || preview.smoke_test.length < 6 ||
      preview.smoke_test.some((riga) => riga.stato !== 200)) {
    throw new Error("il record preview non corrisponde esattamente alla build corrente");
  }
  proveVisive = ["desktop-screenshot", "mobile-screenshot"].map((nome) => {
    const percorso = argomento(nome);
    if (!percorso || !existsSync(percorso)) {
      throw new Error(`la produzione richiede --${nome}=<file>`);
    }
    const corpo = readFileSync(percorso);
    return { tipo: nome.replace("-screenshot", ""), file: basename(percorso),
      sha256: createHash("sha256").update(corpo).digest("hex") };
  });
}

preparaIndicizzazione(ambiente);
const hashFileDeployment = hashDeployment(manifesto);

const uscita = execFileSync(process.execPath, [WRANGLER_CLI, ...comando.slice(1)],
  { cwd: RADICE, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
process.stdout.write(uscita);
const url = uscita.match(/https:\/\/[a-z0-9-]+\.moxtracker\.pages\.dev/i)?.[0];
if (!url) throw new Error("deploy riuscito ma URL non riconosciuto: record non scritto");
const deploymentId = new URL(url).hostname.split(".", 1)[0];
const record = {
  versione: 1, ambiente, deployment_id: deploymentId, url,
  commit, build_id: manifesto.build_id, hash_file: hashFileDeployment,
  prove_visive: proveVisive,
};
const cartellaRecord = join(RADICE, ".release");
mkdirSync(cartellaRecord, { recursive: true });
const fileRecord = join(cartellaRecord,
  `${ambiente}-${commit.slice(0, 12)}-${deploymentId}.json`);
try {
  record.smoke_test = await smokeTest(url);
  record.indicizzazione = await verificaIndicizzazione(url, ambiente);
  record.esito = "verificato";
} catch (errore) {
  record.smoke_test = [];
  record.indicizzazione = null;
  record.esito = "smoke-fallito";
  record.errore = String(errore?.message || errore);
}
writeFileSync(fileRecord, JSON.stringify(record, null, 2) + "\n");
console.log(`Record release: ${fileRecord}`);
if (record.esito !== "verificato") throw new Error(record.errore);
