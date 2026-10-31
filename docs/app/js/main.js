// MoneyCompass web: the window, the tabs and starting up.
import { T, State, loadCurrent, license, moduleOn, MODULES, lang, currentName, save, lastSaveFailed } from "./core.js";
import { esc, popup, toast } from "./ui.js";
import { App, DOWNLOAD_URL } from "./app.js";
import { Rates } from "./rates.js";
import { Overview, Income, Expenses, Emergency, Portfolio } from "./pages-main.js";
import { Savings, Goals, Loans, Budget, openOptimize, openBankImport } from "./pages-pro.js";
import { openProfile, openOptions, openHelp, openExport, openImport, openDelete, avatar } from "./dialogs.js";

const ACCENT = { overview: "#0F766E", income: "#1D4ED8", expenses: "#C2410C", emergency: "#B45309", portfolio: "#15803D", goals: "#0E7490", loans: "#BE123C", budget: "#4338CA", savings: "#7E22CE" };
const MODULE_PAGES = { goals: Goals, loans: Loans, budget: Budget };
let current = "overview";

function tabs() {
  const list = [Overview, Income, Expenses, Emergency, Portfolio];
  for (const m of MODULES) if (moduleOn(m.code)) list.push(MODULE_PAGES[m.code]);
  list.push(Savings);
  return list;
}

function applyTheme() {
  let design = State.data.Settings.Design || "light";
  if (!license.isPro) design = "light";
  if (design === "system") design = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = design;
}

function buildShell() {
  applyTheme();
  document.documentElement.lang = lang();
  document.title = "MoneyCompass";
  const list = tabs();
  if (!list.some(t => t.route === current)) current = "overview";
  document.getElementById("app").innerHTML = `
    <header class="top">
      <a class="brand" href="../index.html" title="MoneyCompass"><img src="../logo.svg" alt=""><span>MoneyCompass</span></a>
      <nav class="tabs" id="tabs">${list.map(t => `<button class="tab" data-tab="${t.route}" style="--accent:${ACCENT[t.route]}">${esc(T(t.title))}</button>`).join("")}</nav>
      <div class="actions">
        <button class="act red" data-act="delete" title="${esc(T("Delete data…"))}">🗑<span>${esc(T("Delete data…"))}</span></button>
        <button class="act blue" data-act="import" title="${esc(T("Import"))}">⬆<span>${esc(T("Import"))}</span></button>
        <button class="act green" data-act="export" title="${esc(T("Export"))}">⬇<span>${esc(T("Export"))}</span></button>
        <button class="profile-btn" data-act="profile" title="${esc(T("Profile: {0}", currentName()))}">${avatar(34)}</button>
      </div>
    </header>
    ${license.isPro ? "" : `<div class="free-bar">${esc(T("Free web version."))} <a href="${DOWNLOAD_URL}" target="_blank" rel="noopener">${esc(T("Download the Windows app"))}</a> · <a href="#" data-act="profile">${esc(T("Enter license key"))}</a></div>`}
    <main id="page"></main>
    <button class="help-fab" data-act="help-menu" title="${esc(T("Help & About"))}">?</button>`;
  document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => App.go(b.dataset.tab));
  const acts = { delete: openDelete, import: openImport, export: openExport, profile: openProfile, "help-menu": helpMenu };
  document.querySelectorAll("[data-act]").forEach(b => b.onclick = ev => { ev.preventDefault(); acts[b.dataset.act](); });
  render();
}

function helpMenu() {
  const p = popup(`<div class="buttons col">
    <button class="btn second" data-m="help">? ${esc(T("Help"))}</button>
    <button class="btn second" data-m="options">⚙ ${esc(T("Options"))}</button>
    <button class="btn second" data-m="about">ℹ ${esc(T("About"))}</button></div>`, { width: 320 });
  p.el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => {
    p.close();
    if (b.dataset.m === "help") openHelp(); else if (b.dataset.m === "options") openOptions(); else about();
  });
}
function about() {
  popup(`<div class="about"><img src="../logo.svg" alt="" width="72"><h2>MoneyCompass</h2><p>${esc(T("Your personal money overview"))}</p>
    <p class="hint">${esc(T("Web version"))} · ${esc(license.status)}</p>
    <p class="hint">${esc(T("© {0} MoneyCompass. All rights reserved.", new Date().getFullYear()))}</p>
    <a class="btn go" href="${DOWNLOAD_URL}" target="_blank" rel="noopener">⬇ ${esc(T("Download for Windows"))}</a></div>
    <div class="popup-buttons"><button class="btn second" data-close>${esc(T("Close"))}</button></div>`, { width: 420 });
}

function render() {
  const page = tabs().find(t => t.route === current) || Overview;
  document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === page.route));
  document.documentElement.style.setProperty("--accent", ACCENT[page.route]);
  document.documentElement.dataset.page = page.route;
  const el = document.getElementById("page");
  const y = window.scrollY;
  page.render(el);
  el.querySelectorAll("[data-go]").forEach(x => x.addEventListener("click", ev => {
    const inner = ev.target.closest("button,a,input,select,label,[data-cat]");
    if (inner && inner !== x) return;
    ev.stopPropagation();
    if (x.dataset.go) App.go(x.dataset.go);
  }));
  el.querySelectorAll('[data-action="optimize"]').forEach(b => b.onclick = openOptimize);
  el.querySelectorAll('[data-action="export"]').forEach(b => b.onclick = openExport);
  window.scrollTo(0, y);
  if (lastSaveFailed()) toast(T("Could not save in this browser. Save your profile to a file to keep your data."), "bad");
}

Object.assign(App, {
  go(route) {
    if (!tabs().some(t => t.route === route)) route = "overview";
    current = route; render(); window.scrollTo(0, 0);
    const tab = document.querySelector(`[data-tab="${route}"]`);
    if (tab) tab.scrollIntoView({ inline: "center", block: "nearest" });
    try { history.replaceState(null, "", "#" + route); } catch { /* file */ }
  },
  refresh: render,
  rebuild: buildShell,
  applyTheme,
  openProfile, openOptions, openHelp, openExport, openImport, openDelete, openOptimize, openBankImport,
});

async function start() {
  loadCurrent();
  await license.load();
  const hash = location.hash.slice(1);
  if (hash) current = hash;
  buildShell();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  Rates.listeners.push(() => { if (!document.querySelector(".popup-back")) render(); });
  Rates.refresh();
  window.addEventListener("storage", e => { if (e.key && e.key.startsWith("mc-")) { loadCurrent(); buildShell(); } });
}
start();
