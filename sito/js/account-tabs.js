// Le cinque schede di Il mio MOX (specifica, sezione 8): una sola visibile,
// tastiera secondo il pattern ARIA delle schede. All'avvio non tocchiamo
// l'hash: il ritorno dall'accesso porta #mox_session, che sessione-account.js
// deve ancora leggere.
const SCHEDE = ["panoramica", "mazzi", "partite", "draft", "account"];

function voci() {
  return SCHEDE.map((id) => ({
    id,
    tab: document.getElementById(`tab-${id}`),
    pannello: document.getElementById(`scheda-${id}`),
  })).filter((voce) => voce.tab && voce.pannello);
}

export function mostraScheda(id, { focus = false, aggiornaHash = false } = {}) {
  const elenco = voci();
  const scelta = elenco.find((voce) => voce.id === id) || elenco[0];
  if (!scelta) return;
  for (const voce of elenco) {
    const attiva = voce === scelta;
    voce.tab.setAttribute("aria-selected", String(attiva));
    voce.tab.tabIndex = attiva ? 0 : -1;
    voce.pannello.hidden = !attiva;
  }
  if (focus) scelta.tab.focus();
  if (aggiornaHash) history.replaceState(null, "", `${location.pathname}${location.search}#scheda-${scelta.id}`);
}

function schedaDaHash() {
  return SCHEDE.find((id) => location.hash === `#scheda-${id}`) || null;
}

const lista = document.querySelector('[role="tablist"]');
if (lista) {
  lista.addEventListener("click", (evento) => {
    const tab = evento.target.closest('[role="tab"]');
    if (tab) mostraScheda(tab.id.replace(/^tab-/, ""), { aggiornaHash: true });
  });
  lista.addEventListener("keydown", (evento) => {
    const elenco = voci();
    const attuale = elenco.findIndex((voce) => voce.tab === document.activeElement);
    if (attuale < 0) return;
    const destinazioni = {
      ArrowRight: (attuale + 1) % elenco.length,
      ArrowLeft: (attuale - 1 + elenco.length) % elenco.length,
      Home: 0,
      End: elenco.length - 1,
    };
    if (!(evento.key in destinazioni)) return;
    evento.preventDefault();
    mostraScheda(elenco[destinazioni[evento.key]].id, { focus: true, aggiornaHash: true });
  });
  document.addEventListener("click", (evento) => {
    const collegamento = evento.target.closest("[data-scheda]");
    if (!collegamento) return;
    evento.preventDefault();
    mostraScheda(collegamento.dataset.scheda, { focus: true, aggiornaHash: true });
  });
  window.addEventListener("hashchange", () => {
    const scheda = schedaDaHash();
    if (scheda) mostraScheda(scheda);
  });
  mostraScheda(schedaDaHash() || "panoramica");
}
