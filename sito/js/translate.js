const risposta = await fetch(new URL("../i18n/en.json", import.meta.url));
const traduzioni = await risposta.json();
const attributi = ["aria-label", "title", "placeholder"];
const schemi = [
  [/^(\d[\d.,]*) partita$/, "$1 match"],
  [/^(\d[\d.,]*) partite$/, "$1 matches"],
  [/^(\d[\d.,]*) gruppo mostrato$/, "$1 group shown"],
  [/^(\d[\d.,]*) gruppi mostrati$/, "$1 groups shown"],
  [/^(\d[\d.,]*) variante osservata$/, "$1 observed variant"],
  [/^(\d[\d.,]*) varianti osservate$/, "$1 observed variants"],
  [/^Ultimo dato ricevuto: (.+)$/, "Latest data received: $1"],
  [/^Aggiornato (.+)$/, "Updated $1"],
  [/^Solo (.+)$/, "$1 only"],
  [/^Da (.+) a (.+)$/, "From $1 to $2"],
  [/^(\d[\d.,]*) confronti pronti\. La matrice verrà renderizzata qui\.$/,
    "$1 comparisons ready. The matrix will be rendered here."],
  [/^Percentuali pubblicate da (\d[\d.,]*) partite\.$/,
    "Percentages are published from $1 matches."],
  [/^Statistiche Draft non disponibili: (.+)$/, "Draft statistics unavailable: $1"],
];

function traduciValore(valore) {
  if (traduzioni[valore]) return traduzioni[valore];
  for (const [schema, sostituzione] of schemi) {
    if (schema.test(valore)) return valore.replace(schema, sostituzione);
  }
  return valore;
}

function traduciNodo(nodo) {
  if (nodo.nodeType === Node.TEXT_NODE) {
    const valore = nodo.nodeValue;
    const chiave = valore.trim();
    const tradotto = chiave ? traduciValore(chiave) : chiave;
    if (chiave && tradotto !== chiave) {
      nodo.nodeValue = valore.replace(chiave, tradotto);
    }
    return;
  }
  if (!(nodo instanceof Element)) return;
  for (const attributo of attributi) {
    const valore = nodo.getAttribute(attributo);
    if (valore) nodo.setAttribute(attributo, traduciValore(valore));
  }
  for (const figlio of nodo.childNodes) traduciNodo(figlio);
}

traduciNodo(document.documentElement);
new MutationObserver((mutazioni) => {
  for (const mutazione of mutazioni) {
    for (const nodo of mutazione.addedNodes) traduciNodo(nodo);
  }
}).observe(document.body, { childList: true, subtree: true });
