const views = new Set(["home-a", "home-b", "home-sections", "meta", "draft", "account", "support"]);
const query = new URLSearchParams(window.location.search);
const view = views.has(query.get("view")) ? query.get("view") : "home-a";

document.querySelectorAll("[data-route]").forEach((link) => {
  link.classList.toggle("active", link.dataset.route === view || (view === "home-sections" && link.dataset.route === "home-a"));
});
document.title = `MOX mockup · ${view}`;

document.querySelectorAll("[data-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    const name = tab.dataset.tab;
    document.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("active", item === tab));
    document.querySelectorAll("[data-tab-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.tabPanel === name));
  });
});
