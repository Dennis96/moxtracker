// Le forme canoniche di Research: JSON J, impronte e i tre tag HMAC.
//
// I valori attesi sono letterali presi dai documenti normativi (G5C-04) o
// calcolati una volta con Python, indipendentemente da questo codice: se la
// derivazione JavaScript diverge da quella del client o del contratto, qui si
// vede.

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  J, sha256Hex, varianteHash, lineageTag, credentialTag,
  deletedContributionTag, stessoValore,
} from "../src/research/canonico.js";

const QUI = fileURLToPath(new URL(".", import.meta.url));
const GOLDEN_BYTE = readFileSync(QUI + "fixtures/research-golden-rev2.json");
const GOLDEN = JSON.parse(GOLDEN_BYTE.toString("utf8"));

// Chiavi fixture pubbliche del G5C-04: vietate in produzione.
const CHIAVI = {
  lineage: { corrente: 7, versioni: {
    7: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f" } },
  tombstone: { corrente: 9, versioni: {
    9: "202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f" } },
};
const MITTENTE = "0123456789abcdef0123456789abcdef";
const SEGRETO = "ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100";
const ID = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const LINEAGE = "9ab646339fe5f2c0990f7639f5d3b9d1d0b915170d2af50946322a6330bd521f";
const CREDENTIAL = "7e1c758c11772217592e1c8c1d8bf9771e1baed5f285bc2622b4eeeb3853ef35";
const TOMBSTONE = "ea7395b97480752f2384ea3bd7d2ea5a0bf54894c416c20d6394d12c4ae8fdb0";

test("la golden rev2 copiata e' byte per byte quella del contratto", () => {
  assert.equal(createHash("sha256").update(GOLDEN_BYTE).digest("hex"),
    "93b6e596d64ca4810808a5831ff98ab15cd66d9b6e54603e9253f71873255a44");
});

test("J ordina le chiavi per punto di codice come Python, senza spazi", () => {
  assert.equal(J({ b: 1, a: [{ d: "x", c: 2 }] }), '{"a":[{"c":2,"d":"x"}],"b":1}');
  // U+FFFF viene prima di U+1F600 per punto di codice; in UTF-16 no.
  assert.equal(J({ "\u{1F600}": 2, "￿": 1 }), '{"￿":1,"\u{1F600}":2}');
  assert.equal(J({ a: "é" }), '{"a":"é"}');
  assert.throws(() => J({ a: 1.5 }), /decimal/);
  assert.throws(() => J({ a: undefined }), /undefined/);
});

test("J della richiesta golden pesa 4.164 byte compatti", () => {
  assert.equal(Buffer.byteLength(J(GOLDEN.richiesta), "utf8"), 4164);
});

test("variant_hash delle due contribution golden coincide con Python", async () => {
  const [bo1, bo3] = GOLDEN.richiesta.partite;
  assert.equal(await varianteHash(bo1),
    "27d3c2881d29b2577729558707bdc29b85ace75338ac52e88c9c11aef38150a7");
  assert.equal(await varianteHash(bo3),
    "5e2088d4817aa3c6dd5fabe067d466dc4ca3f5fa5f096987efc1d05a960bee50");
  assert.equal(await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("i tre tag HMAC riproducono i vettori G5C-04", async () => {
  assert.equal(await lineageTag(CHIAVI, 7, MITTENTE), LINEAGE);
  assert.equal(await credentialTag(CHIAVI, 7, MITTENTE, SEGRETO), CREDENTIAL);
  assert.equal(await deletedContributionTag(CHIAVI, 9, LINEAGE, ID), TOMBSTONE);
});

test("i vettori negativi non producono i tag attesi", async () => {
  // key version sbagliata: chiave inesistente, nessun ripiego silenzioso.
  await assert.rejects(() => lineageTag(CHIAVI, 8, MITTENTE), /versione/);
  // una chiave diversa sotto la stessa forma produce un altro tag.
  const altre = { ...CHIAVI, lineage: { corrente: 8, versioni: {
    8: "ff".repeat(32) } } };
  assert.notEqual(await lineageTag(altre, 8, MITTENTE), LINEAGE);
  // case non canonico: rifiutato, non normalizzato.
  await assert.rejects(() => lineageTag(CHIAVI, 7, MITTENTE.toUpperCase()), /canonic/);
  await assert.rejects(() => credentialTag(CHIAVI, 7, MITTENTE, SEGRETO.toUpperCase()), /canonic/);
  await assert.rejects(() => deletedContributionTag(CHIAVI, 9, LINEAGE, ID.toUpperCase()), /canonic/);
  // raw contro hex: il tombstone annida il lineage tag raw32; se si annidasse
  // il testo esadecimale il risultato cambierebbe. Lo stesso per il segreto.
  const { createHmac } = await import("node:crypto");
  const k7 = Buffer.from(CHIAVI.lineage.versioni[7], "hex");
  const conHex = createHmac("sha256", k7).update(Buffer.concat([
    Buffer.from("mox-research-lineage-credential-v1"), Buffer.from([0]),
    Buffer.from(MITTENTE), Buffer.from([0]), Buffer.from(SEGRETO)])).digest("hex");
  assert.notEqual(conHex, CREDENTIAL);
  const senzaSeparatore = createHmac("sha256", k7).update(Buffer.concat([
    Buffer.from("mox-research-lineage-v1"), Buffer.from(MITTENTE)])).digest("hex");
  assert.notEqual(senzaSeparatore, LINEAGE);
});

test("il confronto a tempo costante distingue anche l'ultimo carattere", () => {
  assert.equal(stessoValore(LINEAGE, LINEAGE), true);
  assert.equal(stessoValore(LINEAGE, LINEAGE.slice(0, -1) + "0"), false);
  assert.equal(stessoValore(LINEAGE, LINEAGE.slice(0, -1)), false);
  assert.equal(stessoValore(null, LINEAGE), false);
});
