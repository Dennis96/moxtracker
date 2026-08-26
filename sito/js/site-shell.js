const pagina = document.body.dataset.page || "";

const percorsi = {
  home: "./index.html",
  meta: "./index.html#meta",
  draft: "./draft.html",
  account: "./account.html",
  support: "./supporto.html",
};

for (const link of document.querySelectorAll("[data-route]")) {
  const destinazione = link.dataset.route;
  if (percorsi[destinazione]) link.href = percorsi[destinazione];
  const attivo = destinazione === pagina ||
    (destinazione === "meta" && pagina === "archetype") ||
    (destinazione === "account" && pagina === "admin");
  if (attivo) link.setAttribute("aria-current", "page");
  else link.removeAttribute("aria-current");
}

const bottone = document.querySelector("#nav-toggle");
const menu = document.querySelector("#primary-nav");

function chiudiMenu() {
  if (!bottone || !menu) return;
  bottone.setAttribute("aria-expanded", "false");
  menu.removeAttribute("data-open");
}

if (bottone && menu) {
  bottone.addEventListener("click", () => {
    const aperto = bottone.getAttribute("aria-expanded") === "true";
    bottone.setAttribute("aria-expanded", String(!aperto));
    menu.toggleAttribute("data-open", !aperto);
  });
  menu.addEventListener("click", (evento) => {
    if (evento.target.closest("a")) chiudiMenu();
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
      chiudiMenu();
      bottone.focus();
    }
  });
  document.addEventListener("click", (evento) => {
    if (!evento.target.closest(".nav")) chiudiMenu();
  });
}
