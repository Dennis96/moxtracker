// DOM minimo per provare in Node il comportamento dei moduli del sito che
// costruiscono la pagina: solo cio' che usano render.js e i suoi import.
// Selettori supportati: #id, .classe, tag, tag.classe, [attributo].

class Testo {
  constructor(testo) {
    this.textContent = String(testo);
    this.parentNode = null;
  }
  remove() { staccaDaGenitore(this); }
}

function staccaDaGenitore(nodo) {
  if (!nodo.parentNode) return;
  nodo.parentNode.childNodes = nodo.parentNode.childNodes.filter((n) => n !== nodo);
  nodo.parentNode = null;
}

class Elemento {
  constructor(tag, documento) {
    this.tagName = String(tag).toUpperCase();
    this.ownerDocument = documento;
    this.childNodes = [];
    this.parentNode = null;
    this.attributi = new Map();
    this.ascoltatori = new Map();
    this.style = {};
    this.dataset = {};
    this.hidden = false;
    this.className = "";
    this.id = "";
  }

  get firstChild() { return this.childNodes[0] ?? null; }
  get children() { return this.childNodes.filter((n) => n instanceof Elemento); }

  append(...nodi) {
    for (const nodo of nodi) {
      const vero = typeof nodo === "string" ? new Testo(nodo) : nodo;
      staccaDaGenitore(vero);
      vero.parentNode = this;
      this.childNodes.push(vero);
    }
  }

  remove() { staccaDaGenitore(this); }

  get textContent() { return this.childNodes.map((n) => n.textContent).join(""); }
  set textContent(valore) {
    this.childNodes = [];
    if (valore !== undefined && valore !== null && valore !== "") this.append(String(valore));
  }

  setAttribute(nome, valore) {
    if (nome === "id") this.id = String(valore);
    else if (nome === "class") this.className = String(valore);
    else this.attributi.set(nome, String(valore));
  }
  getAttribute(nome) {
    if (nome === "id") return this.id || null;
    if (nome === "class") return this.className || null;
    return this.attributi.has(nome) ? this.attributi.get(nome) : null;
  }
  hasAttribute(nome) { return this.getAttribute(nome) !== null; }

  get classList() {
    const elemento = this;
    const voci = () => elemento.className.split(/\s+/).filter(Boolean);
    return {
      contains: (classe) => voci().includes(classe),
      add: (...classi) => { elemento.className = [...new Set([...voci(), ...classi])].join(" "); },
      remove: (...classi) => { elemento.className = voci().filter((c) => !classi.includes(c)).join(" "); },
      toggle(classe, forza) {
        const accesa = forza === undefined ? !this.contains(classe) : Boolean(forza);
        if (accesa) this.add(classe); else this.remove(classe);
        return accesa;
      },
    };
  }

  addEventListener(tipo, funzione) {
    if (!this.ascoltatori.has(tipo)) this.ascoltatori.set(tipo, []);
    this.ascoltatori.get(tipo).push(funzione);
  }
  click() {
    const evento = { type: "click", target: this, currentTarget: this, preventDefault() {} };
    for (const funzione of this.ascoltatori.get("click") || []) funzione(evento);
  }

  corrisponde(selettore) {
    if (selettore.startsWith("#")) return this.id === selettore.slice(1);
    const attributo = selettore.match(/^\[([\w-]+)\]$/);
    if (attributo) return this.hasAttribute(attributo[1]);
    const [tag, ...classi] = selettore.split(".");
    if (tag && this.tagName !== tag.toUpperCase()) return false;
    return classi.every((classe) => this.classList.contains(classe));
  }

  querySelectorAll(selettore) {
    const trovati = [];
    const visita = (nodo) => {
      for (const figlio of nodo.children) {
        if (figlio.corrisponde(selettore)) trovati.push(figlio);
        visita(figlio);
      }
    };
    visita(this);
    return trovati;
  }
  querySelector(selettore) { return this.querySelectorAll(selettore)[0] ?? null; }

  closest(selettore) {
    for (let nodo = this; nodo instanceof Elemento; nodo = nodo.parentNode) {
      if (nodo.corrisponde(selettore)) return nodo;
    }
    return null;
  }
}

export function creaDocumento(lingua = "it") {
  const documento = {
    documentElement: { lang: lingua },
    createElement: (tag) => new Elemento(tag, documento),
    addEventListener() {},
  };
  documento.body = new Elemento("body", documento);
  documento.querySelector = (selettore) => documento.body.querySelector(selettore);
  documento.querySelectorAll = (selettore) => documento.body.querySelectorAll(selettore);
  return documento;
}
