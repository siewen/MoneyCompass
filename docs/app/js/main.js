// MoneyCompass web: the window, the tabs and starting up.
import { T, State, loadCurrent, license, moduleOn, MODULES, lang, currentName, save, lastSaveFailed, summary, fmtDate } from "./core.js";
import { esc, popup, toast } from "./ui.js";
import { App, DOWNLOAD_URL } from "./app.js";
import { Rates } from "./rates.js";
import { Overview, Income, Expenses, Emergency, Portfolio } from "./pages-main.js";
import { Savings, Goals, Loans, Budget, openOptimize, openBankImport } from "./pages-pro.js";
import { openProfile, openOptions, openHelp, openExport, openImport, openDelete, avatar, loadProfileFile, saveProfileFile } from "./dialogs.js";

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
        ${installed() ? "" : `<button class="act teal" data-act="install" title="${esc(T("Install app"))}">📲<span>${esc(T("Install app"))}</span></button>`}
        <button class="profile-btn" data-act="profile" title="${esc(T("Profile: {0}", currentName()))}">${avatar(34)}</button>
        ${installed() ? `<button class="act exit" data-act="exit" title="${esc(T("Close"))}">⏻</button>` : ""}
      </div>
    </header>
    ${license.isPro ? "" : `<div class="free-bar">${esc(T("Free web version."))} <a href="${DOWNLOAD_URL}" target="_blank" rel="noopener">${esc(T("Download the Windows app"))}</a> · <a href="#" data-act="profile">${esc(T("Enter license key"))}</a></div>`}
    <main id="page"></main>
    <button class="help-fab" data-act="help-menu" title="${esc(T("Help & About"))}">?</button>`;
  document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => App.go(b.dataset.tab));
  const acts = { delete: openDelete, import: openImport, export: openExport, profile: openProfile, "help-menu": helpMenu, install, exit: closeApp };
  document.querySelectorAll("[data-act]").forEach(b => b.onclick = ev => { ev.preventDefault(); acts[b.dataset.act](); });
  render();
}

function helpMenu() {
  const p = popup(`<div class="buttons col">
    <button class="btn second" data-m="help">? ${esc(T("Help"))}</button>
    <button class="btn second" data-m="options">⚙ ${esc(T("Options"))}</button>
    <button class="btn second" data-m="about">ℹ ${esc(T("About"))}</button>
    ${installed() ? "" : `<button class="btn second" data-m="install">📲 ${esc(T("Install app"))}</button>`}
    <button class="btn second" data-m="exit">⏻ ${esc(T("Close"))}</button></div>`, { width: 320 });
  p.el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => {
    p.close();
    if (b.dataset.m === "help") openHelp(); else if (b.dataset.m === "options") openOptions(); else if (b.dataset.m === "install") install(); else if (b.dataset.m === "exit") closeApp(); else about();
  });
}
// ---------- Install as an app (iPhone, iPad, Mac, Android, Windows) ----------
let installPrompt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installPrompt = e; });
window.addEventListener("appinstalled", () => { installPrompt = null; buildShell(); toast(T("MoneyCompass is installed. Open it from your home screen or apps.")); });
function installed() {
  return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}
async function install() {
  if (installPrompt) {
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch { /* closed */ }
    installPrompt = null;
    return;
  }
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const mac = /Macintosh/.test(ua) && !ios;
  const safari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox|FxiOS|CriOS/.test(ua);
  let steps;
  if (ios) steps = [T("Open this page in Safari."), T("Tap the Share button (the square with the arrow)."), T("Choose \"Add to Home Screen\", then \"Add\".")];
  else if (mac && safari) steps = [T("In the menu bar choose File → \"Add to Dock…\"."), T("Click \"Add\". MoneyCompass then opens from the Dock like any app.")];
  else steps = [T("Open the browser menu (⋮ or …)."), T("Choose \"Install MoneyCompass\" or \"Add to Home screen\".")];
  popup(`<h2 class="popup-title">📲 ${esc(T("Install app"))}</h2>
    <p>${esc(T("Install MoneyCompass like an app: its own icon, full screen, and it also opens without internet."))}</p>
    <ol>${steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol>
    <p class="hint">${esc(T("On iPhone and iPad the installed app has its own storage: if you already entered data in Safari, save your profile there first and load it in the app."))}</p>
    <div class="popup-buttons"><button class="btn main" data-close>${esc(T("OK"))}</button></div>`, { width: 480 });
}

// ---------- "Welcome back" when MoneyCompass opens (same as the Windows app) ----------
function welcome() {
  const d = State.data, s = d.Settings;
  if (!s.AskOnStart) return;
  if (d.Incomes.length + d.Expenses.length + d.Holdings.length + d.Offers.length + d.Loans.length + d.Goals.length === 0) return;
  let details = T("Your data: {0}.", summary(d));
  if (s.LastProfileSaved) details += "\n" + T("Last saved: {0}", fmtDate(s.LastProfileSaved) + " " + String(s.LastProfileSaved).slice(11, 16));
  const p = popup(`<div class="box-head"><span class="box-icon go">👋</span><h2>${esc(T("Welcome back!"))}</h2></div>
    <p class="hint">${esc(details).replace(/\n/g, "<br>")}</p>
    <div class="box-buttons">
      <button class="btn go" data-w="continue">✔ ${esc(T("Continue with my data"))}</button>
      <button class="btn second" data-w="load">📂 ${esc(T("Load a profile…"))}</button>
      <button class="btn danger" data-w="fresh">🗑 ${esc(T("Start fresh…"))}</button></div>
    <p class="hint">${esc(T("Choose exactly what to delete."))}</p>
    <label class="check"><input type="checkbox" name="dontask"><span>${esc(T("Don't ask again when MoneyCompass starts"))}</span></label>
    <p class="hint">${esc(T("You can switch this question back on in Options → Backup & restore."))}</p>`, { width: 440, cls: "box" });
  p.el.querySelectorAll("[data-w]").forEach(b => b.onclick = async () => {
    if (p.el.querySelector('[name="dontask"]').checked) { s.AskOnStart = false; save(); }
    p.close();
    if (b.dataset.w === "load") await loadProfileFile();
    else if (b.dataset.w === "fresh") openDelete();
  });
}

// ---------- Closing: the same "Save your profile before closing?" box as the Windows app ----------
async function closeApp() {
  const s = State.data.Settings;
  const choice = s.CloseChoice || "";
  if (choice === "with") { saveProfileFile(); return finishClose(); }
  if (choice === "without" || choice === "none") return finishClose();
  const p = popup(`<div class="box-head"><span class="box-icon">💾</span><h2>${esc(T("Save your profile before closing?"))}</h2></div>
    <p class="hint">${esc(T("Your entries are always kept in this browser. The profile is an extra copy, for example as a backup."))}</p>
    <div class="box-buttons">
      <button class="btn go" data-c="with">💾 ${esc(T("Save profile and close"))}</button>
      <button class="btn second" data-c="without">${esc(T("Close without saving"))}</button>
      <button class="btn second" data-c="cancel">${esc(T("Cancel"))}</button></div>
    <label class="check"><input type="checkbox" name="remember"><span>${esc(T("Remember my choice"))}</span></label>
    <p class="hint">${esc(T("You can change this later in Options → Backup & restore."))}</p>`, { width: 440, cls: "box" });
  p.el.querySelectorAll("[data-c]").forEach(b => b.onclick = () => {
    const c = b.dataset.c;
    p.close();
    if (c === "cancel") return;
    if (p.el.querySelector('[name="remember"]').checked) { s.CloseChoice = c; save(); }
    if (c === "with") saveProfileFile();
    setTimeout(finishClose, c === "with" ? 900 : 200);
  });
}
function finishClose() {
  save();
  window.close();
  // A normal browser tab can't be closed by the page itself
  setTimeout(() => { if (!window.closed) toast(T("Everything is saved. You can close this tab now.")); }, 300);
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
  welcome();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  Rates.listeners.push(() => { if (!document.querySelector(".popup-back")) render(); });
  Rates.refresh();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  try { navigator.storage?.persist?.(); } catch { /* not supported */ }
  window.addEventListener("storage", e => { if (e.key && e.key.startsWith("mc-")) { loadCurrent(); buildShell(); } });
}
start();
