export function linkLinguaAlternativa(pathname, inglese, ricerca = "", frammento = "") {
  const segmenti = String(pathname || "/").split("/").filter(Boolean);
  const locali = inglese ? segmenti.slice(1) : segmenti;
  if (locali.length > 1) {
    return `${inglese ? '/' : '/en/'}${locali.join('/')}${ricerca}${frammento}`;
  }
  const file = inglese && segmenti.length === 1
    ? "index.html"
    : segmenti.at(-1) || "index.html";
  const destinazione = inglese ? `../${file}` : `./en/${file}`;
  return `${destinazione}${ricerca}${frammento}`;
}
