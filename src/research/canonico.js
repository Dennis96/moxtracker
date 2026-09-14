// Le forme canoniche di Research, in un posto solo.
//
// `J` e' il JSON canonico del contratto (addendum G3A/G5 §3.1): chiavi
// ordinate per punto di codice Unicode, nessuno spazio, caratteri non ASCII
// scritti cosi' come sono, soltanto interi. E' byte per byte il
// `json.dumps(x, ensure_ascii=False, sort_keys=True, separators=(",", ":"))`
// di Python: il client calcola le stesse impronte, e se le due strade
// divergono le varianti di una contribution smettono di coincidere.
//
// I tre tag HMAC seguono l'encoding byte-esatto del G5C-04: dominio UTF-8,
// separatore 0x00, `mittente` come 32 byte ASCII, segreto e `id_pubblico`
// decodificati in 32 byte raw, lineage tag annidato come raw32. Niente
// normalizzazioni: una forma non canonica si rifiuta, non si corregge.

const CODIFICA = new TextEncoder();
const HEX32 = /^[0-9a-f]{32}$/;
const HEX64 = /^[0-9a-f]{64}$/;

export const DOMINIO_SNAPSHOT = "mox-research-snapshot-v1";
export const DOMINIO_LINEAGE = "mox-research-lineage-v1";
export const DOMINIO_CREDENTIAL = "mox-research-lineage-credential-v1";
export const DOMINIO_TOMBSTONE = "mox-research-deleted-contribution-v1";

function confrontaPuntiDiCodice(a, b) {
  const pa = [...a];
  const pb = [...b];
  const quanti = Math.min(pa.length, pb.length);
  for (let i = 0; i < quanti; i += 1) {
    const x = pa[i].codePointAt(0);
    const y = pb[i].codePointAt(0);
    if (x !== y) return x < y ? -1 : 1;
  }
  return pa.length - pb.length;
}

export function J(valore) {
  if (valore === null) return "null";
  if (valore === undefined) throw new TypeError("J: valore undefined");
  if (typeof valore === "boolean") return valore ? "true" : "false";
  if (typeof valore === "number") {
    if (!Number.isSafeInteger(valore)) {
      throw new TypeError("J: soltanto interi, nessun numero decimal o fuori scala");
    }
    return String(valore);
  }
  if (typeof valore === "string") return JSON.stringify(valore);
  if (Array.isArray(valore)) return "[" + valore.map(J).join(",") + "]";
  if (typeof valore === "object") {
    const chiavi = Object.keys(valore).sort(confrontaPuntiDiCodice);
    return "{" + chiavi.map((k) => JSON.stringify(k) + ":" + J(valore[k])).join(",") + "}";
  }
  throw new TypeError(`J: tipo ${typeof valore} non ammesso`);
}

function unisci(...parti) {
  const totale = parti.reduce((n, p) => n + p.length, 0);
  const fuori = new Uint8Array(totale);
  let posizione = 0;
  for (const parte of parti) {
    fuori.set(parte, posizione);
    posizione += parte.length;
  }
  return fuori;
}

const ZERO = Uint8Array.of(0);

export function byteInHex(byte) {
  return [...new Uint8Array(byte)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexInByte(testo) {
  const fuori = new Uint8Array(testo.length / 2);
  for (let i = 0; i < fuori.length; i += 1) {
    fuori[i] = parseInt(testo.slice(i * 2, i * 2 + 2), 16);
  }
  return fuori;
}

export async function sha256Hex(dati) {
  const byte = typeof dati === "string" ? CODIFICA.encode(dati) : dati;
  return byteInHex(await crypto.subtle.digest("SHA-256", byte));
}

export async function varianteHash(snapshot) {
  return sha256Hex(unisci(CODIFICA.encode(DOMINIO_SNAPSHOT), ZERO,
    CODIFICA.encode(J(snapshot))));
}

function canonico(valore, forma, nome) {
  if (typeof valore !== "string" || !forma.test(valore)) {
    throw new TypeError(`${nome} non canonico`);
  }
  return valore;
}

function chiave(chiavi, famiglia, versione) {
  const esadecimale = chiavi?.[famiglia]?.versioni?.[versione];
  if (typeof esadecimale !== "string" || !HEX64.test(esadecimale)) {
    throw new RangeError(`versione ${versione} della chiave ${famiglia} non disponibile`);
  }
  return hexInByte(esadecimale);
}

async function hmac(byteChiave, messaggio) {
  const k = await crypto.subtle.importKey("raw", byteChiave,
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return byteInHex(await crypto.subtle.sign("HMAC", k, messaggio));
}

export async function lineageTag(chiavi, versione, mittente) {
  canonico(mittente, HEX32, "mittente");
  return hmac(chiave(chiavi, "lineage", versione), unisci(
    CODIFICA.encode(DOMINIO_LINEAGE), ZERO, CODIFICA.encode(mittente)));
}

export async function credentialTag(chiavi, versione, mittente, segreto) {
  canonico(mittente, HEX32, "mittente");
  canonico(segreto, HEX64, "segreto");
  return hmac(chiave(chiavi, "lineage", versione), unisci(
    CODIFICA.encode(DOMINIO_CREDENTIAL), ZERO, CODIFICA.encode(mittente), ZERO,
    hexInByte(segreto)));
}

export async function deletedContributionTag(chiavi, versione, lineage, idPubblico) {
  canonico(lineage, HEX64, "lineage tag");
  canonico(idPubblico, HEX64, "id_pubblico");
  return hmac(chiave(chiavi, "tombstone", versione), unisci(
    CODIFICA.encode(DOMINIO_TOMBSTONE), ZERO, hexInByte(lineage), ZERO,
    hexInByte(idPubblico)));
}

// Il confronto di tag e impronte non si ferma al primo carattere diverso:
// il tempo non deve dire quanto prefisso era giusto.
export function stessoValore(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let differenza = 0;
  for (let i = 0; i < a.length; i += 1) differenza |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return differenza === 0;
}
