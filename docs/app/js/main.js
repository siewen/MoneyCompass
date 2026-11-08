// MoneyCompass web: the window, the tabs and starting up.
import { store, T, State, loadCurrent, license, moduleOn, MODULES, lang, currentName, save, lastSaveFailed, summary, fmtDate, changedSinceFile, LANGS, duePromos } from "./core.js";
import { esc, popup, toast } from "./ui.js";
import { startLock, lock, hasPin } from "./lock.js";
import { startBackup, drawBackupBar, backupProfileChanged, backupInfo } from "./backup.js";
import { smartImport, openImportCenter } from "./import.js";
import { Reports } from "./reports.js";
import { openSavingsCheck } from "./savings-check.js";
import { App, DOWNLOAD_URL } from "./app.js";
import { Rates } from "./rates.js";
import { WEB_VERSION, WEB_BUILD, WEB_DATE } from "./version.js";
import { openGuide, shouldShowGuide } from "./guide.js";
import { hasNews, openNews } from "./news.js";
import { Overview, Income, Expenses, Emergency, Portfolio, bindBin, setSearch, manageCategories } from "./pages-main.js";
import { Savings, Goals, Loans, Budget, openOptimize, openBankImport } from "./pages-pro.js";
import { Calendar } from "./calendar.js";
import { promoReminder } from "./advice.js";
import { openProfile, openOptions, openHelp, openExport, openImport, openDelete, avatar, loadProfileFile, saveProfileFile, openLanguage, setLanguage } from "./dialogs.js";

const ACCENT = { overview: "#0F766E", income: "#1D4ED8", expenses: "#C2410C", emergency: "#B45309", portfolio: "#15803D", goals: "#0E7490", loans: "#BE123C", budget: "#4338CA", calendar: "#0369A1", investments: "#CA8A04", reports: "#0E7490", savings: "#7E22CE" };
const MODULE_PAGES = { goals: Goals, loans: Loans, budget: Budget, calendar: Calendar };
let current = "overview";

function tabs() {
  const list = [Overview, Income, Expenses, Emergency, Portfolio];
  // Savings goals are part of the Budget plan (Pro), not a tab of their own
  for (const m of MODULES) if (moduleOn(m.code) && m.code !== "goals") list.push(MODULE_PAGES[m.code]);
  list.push(Savings, Reports);
  // Pro: your own menu order (pages not in it keep their usual place)
  const order = license.isPro && Array.isArray(State.data.Settings.TabOrder) ? State.data.Settings.TabOrder : null;
  if (!order) return list;
  const known = list.filter(t => order.includes(t.route)).sort((a, b) => order.indexOf(a.route) - order.indexOf(b.route));
  const out = [...known];
  list.forEach((t, i) => { if (!order.includes(t.route)) out.splice(Math.min(i, out.length), 0, t); });
  return out;
}
/** Move a page in the menu (Pro): to the place of another page, or one up/down. */
export function moveTab(route, target) {
  const routes = tabs().map(t => t.route), from = routes.indexOf(route);
  let to = typeof target === "number" ? from + target : routes.indexOf(target);
  if (from < 0 || to < 0 || to >= routes.length || from === to) return;
  routes.splice(to, 0, routes.splice(from, 1)[0]);
  State.data.Settings.TabOrder = routes; save(); buildShell();
}

// Line icons for the tabs (shown in the beta design's side menu)
const I = d => `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const TAB_ICON = {
  overview: I('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>'),
  income: I('<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18"/><circle cx="16.5" cy="15" r="1.2"/>'),
  expenses: I('<path d="M3 4h2l2.5 11h10l2-8H6.500"/><circle cx="9" cy="19.500" r="1.400"/><circle cx="17" cy="19.500" r="1.400"/>'),
  emergency: I('<path d="M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  portfolio: I('<path d="M5 12a7 5.500 0 0 1 7-5.500c3 0 5 1.200 6 3l2-.5v4l-2 .5c-.5 1-1.300 1.700-2.300 2.200V19h-3v-1.500h-3.400V19H7.300v-3.600C5.800 14.500 5 13.300 5 12z"/><circle cx="15" cy="11" r=".9"/>'),
  goals: I('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.500"/>'),
  loans: I('<path d="M3 9l9-5 9 5z"/><path d="M5.500 9v9M10 9v9M14 9v9M18.500 9v9"/><path d="M3 21h18"/>'),
  budget: I('<rect x="5" y="4" width="14" height="17" rx="2.500"/><path d="M9 2.500h6v3H9zM9 11h6M9 15h6"/>'),
  calendar: I('<rect x="3" y="5" width="18" height="16" rx="2.500"/><path d="M3 10h18M8 3v4M16 3v4M8 14h2M12 14h2M8 17.500h2"/>'),
  investments: I('<path d="M3 17l5-5 4 3 8-8"/><path d="M15 7h5v5"/><path d="M3 21h18"/>'),
  savings: I('<path d="M12 4v16M7 20h10M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>'),
  reports: I('<rect x="4" y="11" width="4" height="9" rx="1"/><rect x="10" y="5" width="4" height="15" rx="1"/><rect x="16" y="13" width="4" height="7" rx="1"/>'),
};
/** MoneyCompass has one design: Emerald (dark green, side menu on wide screens, bottom bar on phones). */
const beta = () => "emerald";
/** Side menu: "auto" folds to icons and opens when the mouse is on it, "pinned" stays open. */
const side = () => { try { return localStorage.getItem("mc-side") || "pinned"; } catch { return "auto"; } };
function toggleSide() {
  const v = side() === "pinned" ? "auto" : "pinned";
  try { localStorage.setItem("mc-side", v); } catch { /* private window */ }
  document.documentElement.dataset.side = v;
  // Folding: close it right away, even though the mouse is still on it (it opens again once the mouse leaves and comes back)
  const top = document.querySelector(".top");
  if (top) { top.classList.remove("open"); top.dataset.hold = v === "auto" ? "1" : ""; }
  const b = document.querySelector(".side-toggle"); if (b) { b.textContent = v === "pinned" ? "‹" : "›"; b.title = T(v === "pinned" ? "Fold the menu (it opens when you point at it)" : "Keep the menu open"); }
}

function applyTheme() {
  document.documentElement.dataset.theme = "light";
  document.documentElement.dataset.design = "emerald";
  document.documentElement.dataset.side = side();
}

let shellProfile = "";
function buildShell() {
  applyTheme();
  document.documentElement.lang = lang();
  document.title = "MoneyCompass";
  const list = tabs();
  if (!list.some(t => t.route === current)) current = "overview";
  // Sidebar like the mockup: the pages, then a line with Reports and Settings at the bottom
  const NAMES = { income: "Income", expenses: "Expenses", emergency: "Emergency Fund", portfolio: "My Savings", loans: "Loans & Debts", budget: "Budget Plan", savings: "Compare Offers" };
  const tabBtn = t => `<button class="tab${t.route === "reports" ? " tab-reports" : ""}" data-tab="${t.route}" style="--accent:${ACCENT[t.route]}"><span class="ti">${TAB_ICON[t.route] || ""}</span><span class="tl">${esc(lang() === "en" && NAMES[t.route] || T(t.title))}${t.route === "investments" ? ` <span class="beta-tag">${esc(T("Beta"))}</span>` : ""}</span></button>`;
  const main = list.filter(t => t.route !== "reports"), foot = list.filter(t => t.route === "reports");
  document.getElementById("app").innerHTML = `
    <header class="top">
      <button class="side-toggle" data-act="side" title="${esc(T(side() === "pinned" ? "Fold the menu (it opens when you point at it)" : "Keep the menu open"))}">${side() === "pinned" ? "‹" : "›"}</button>
      <a class="brand" href="../index.html" title="MoneyCompass"><img src="brand.svg" alt=""><span class="bt"><span class="bn"><i>Money</i><b>Compass</b></span></span></a>
      <nav class="tabs" id="tabs">${main.map(t => tabBtn(t) + (t.route === "portfolio" && moduleOn("budget") ? `<button class="tab tab-goals" data-nav="budget" style="--accent:#9DB8E8"><span class="ti">${TAB_ICON.goals}</span><span class="tl">${esc(T("Savings Goals"))}</span></button>` : "")).join("")}${foot.map(tabBtn).join("")}<div class="side-card"><span class="sc-ic">${I('<rect x="5" y="11" width="14" height="10" rx="2.500"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><circle cx="12" cy="16" r="1.300"/>')}</span><b>${esc(T("Your data is private and always secure"))}</b></div><button class="tab tab-settings" data-act="options" style="--accent:#9AA9A4"><span class="ti">${I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.100-1.500 1.700 1.700 0 0 0-1.800.3l-.1.1a2 2 0 1 1-2.800-2.800l.1-.1a1.700 1.700 0 0 0 .3-1.800 1.700 1.700 0 0 0-1.500-1H3a2 2 0 1 1 0-4h.1a1.700 1.700 0 0 0 1.500-1.100 1.700 1.700 0 0 0-.3-1.800l-.1-.1a2 2 0 1 1 2.800-2.800l.1.1a1.700 1.700 0 0 0 1.800.3H9a1.700 1.700 0 0 0 1-1.500V3a2 2 0 1 1 4 0v.1a1.700 1.700 0 0 0 1 1.500 1.700 1.700 0 0 0 1.800-.3l.1-.1a2 2 0 1 1 2.800 2.800l-.1.1a1.700 1.700 0 0 0-.3 1.800V9a1.700 1.700 0 0 0 1.500 1H21a2 2 0 1 1 0 4h-.1a1.700 1.700 0 0 0-1.500 1z"/>')}</span><span class="tl">${esc(T("Settings"))}</span></button></nav>
    </header>
    <div class="topbar">
      <label class="tb-search"><span aria-hidden="true">🔍</span><input type="search" id="tb-search" placeholder="${esc(T("Search transactions, categories, goals…"))}" autocomplete="off"></label>
      <button class="tb-btn" data-act="import" title="${esc(T("Import a bank statement (CSV) – current or savings account. You can also drop the file onto the app."))}"><span aria-hidden="true">⬆</span><span class="tb-l">${esc(T("Import"))}${license.isPro ? "" : " 🔒"}</span></button>
      <button class="tb-btn" data-act="export" title="${esc(T("Export"))}"><span aria-hidden="true">⬇</span><span class="tb-l">${esc(T("Export"))}</span></button>
      <button class="tb-bell" data-act="bell" title="${esc(T("Notifications"))}" aria-label="${esc(T("Notifications"))}">${I('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.500 2h-15z"/><path d="M10 21h4"/>')}<span class="bell-n" id="bell-n" hidden></span></button>
      <button class="me-row profile-btn" data-act="me" title="${esc(T("Profile: {0}", currentName()))}">${avatar(36)}
        <span class="me-text"><b>${esc(currentName())}</b><small class="me-badge ${license.isPro ? "pro" : "demo"}">${esc(license.isPro ? T("Pro Plan") : T("Demo"))}</small></span>
        <span class="me-more" aria-hidden="true">⌄</span></button>
    </div>
    ${license.isPro ? "" : `<div class="free-bar">${esc(T("Free web version."))} <a href="${DOWNLOAD_URL}" target="_blank" rel="noopener">${esc(T("Download the Windows app"))}</a> · <a href="#" data-act="profile">${esc(T("Enter license key"))}</a></div>`}
    <div id="backup-bar" class="backup-bar" hidden></div>
    <div class="page-head"><h1 id="page-title"></h1><button class="btn main small head-import" id="head-import" hidden></button></div>
    <main id="page"></main>
    <button class="help-fab" data-act="help-menu" title="${esc(T("Help & About"))}">?</button>`;
  document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => App.go(b.dataset.tab));
  // Pro: drag a page up or down in the side menu to change the order
  if (license.isPro && matchMedia("(hover: hover)").matches) document.querySelectorAll("#tabs [data-tab]").forEach(b => {
    b.draggable = true;
    b.addEventListener("dragstart", e => { e.dataTransfer.setData("text/mc-tab", b.dataset.tab); e.dataTransfer.effectAllowed = "move"; b.classList.add("dragging-tab"); });
    b.addEventListener("dragend", () => b.classList.remove("dragging-tab"));
    b.addEventListener("dragover", e => { if ([...e.dataTransfer.types].includes("text/mc-tab")) { e.preventDefault(); b.classList.add("drop-tab"); } });
    b.addEventListener("dragleave", () => b.classList.remove("drop-tab"));
    b.addEventListener("drop", e => { const r = e.dataTransfer.getData("text/mc-tab"); b.classList.remove("drop-tab"); if (r) { e.preventDefault(); e.stopPropagation(); moveTab(r, b.dataset.tab); } });
  });
  const acts = { import: () => openImportCenter(), options: () => openOptions(), add: addTransaction, bell: bellMenu, delete: openDelete, export: openExport, profile: openProfile, install, exit: closeApp, lang: () => openLanguage(), data: dataMenu, side: toggleSide, me: meMenu };
  document.querySelectorAll("[data-act]:not(.help-fab)").forEach(b => b.onclick = ev => { ev.preventDefault(); acts[b.dataset.act](); });
  document.querySelectorAll("[data-nav]").forEach(b => b.onclick = () => App.go(b.dataset.nav));
  const sb = document.getElementById("tb-search");
  if (sb) sb.onkeydown = e => { if (e.key !== "Enter" || !sb.value.trim()) return; setSearch(sb.value.trim()); if (current === "expenses") App.refresh(); else App.go("expenses"); sb.blur(); };
  updateBell();
  setupHelpButton();
  // Another profile now? Read its backup state; otherwise only draw the bar again
  if (shellProfile !== State.id) { shellProfile = State.id; backupProfileChanged(); } else drawBackupBar(saveProfileFile);
  render();
  fitTabs();
  // Folded side menu: opens while the mouse is on it. On touch screens (phones, the open Z Fold) it opens with the arrow instead,
  // because a tap would leave it open over the page.
  const top = document.querySelector(".top");
  if (top && matchMedia("(hover: hover)").matches) {
    top.addEventListener("mouseenter", () => { if (!top.dataset.hold) top.classList.add("open"); });
    top.addEventListener("mouseleave", () => { top.classList.remove("open"); top.dataset.hold = ""; });
  }
}

/** Top bar "Add Transaction": opens Expenses at the form for a new expense. */
function addTransaction() {
  const go = () => { const f = document.getElementById("expense-form"); if (f) { f.scrollIntoView({ block: "center" }); f.querySelector("input,select")?.focus(); } };
  if (current === "expenses") go(); else { App.go("expenses"); setTimeout(go, 400); }
}
/** The bell: what needs your attention (ended promotions, a backup that is not running). */
function notices() {
  const out = [], d = State.data;
  for (const x of duePromos(d)) out.push(x.p.ended ? T("The promotion at {0} ended on {1}", x.h.Name, fmtDate(x.p.end)) : T("The promotion at {0} ends in {1} days", x.h.Name, x.p.daysLeft));
  const b = backupInfo();
  if (license.isPro && (b.status === "paused" || b.status === "error")) out.push(T(b.status === "paused" ? "Automatic backup is waiting for your browser's permission." : "The automatic backup could not be written."));
  return out;
}
function bellMenu() {
  if (document.querySelector(".bell-menu")) { document.querySelectorAll(".bell-menu, .me-shield").forEach(x => x.remove()); return; }
  const r = document.querySelector(".tb-bell").getBoundingClientRect(), list = notices();
  const shield = document.createElement("div"); shield.className = "help-shield me-shield";
  const menu = document.createElement("div"); menu.className = "tab-menu data-menu bell-menu";
  menu.innerHTML = list.length ? list.map(t => `<p>${esc(t)}</p>`).join("") : `<p>${esc(T("You're all caught up."))}</p>`;
  document.body.append(shield, menu);
  menu.style.top = (r.bottom + 8) + "px"; menu.style.left = Math.max(8, Math.min(r.right - 280, window.innerWidth - 288)) + "px";
  shield.onclick = () => { shield.remove(); menu.remove(); };
}
function updateBell() { const n = document.getElementById("bell-n"); if (!n) return; const c = notices().length; n.hidden = !c; n.textContent = c; }

// ---------- The profile row: one small menu for profile, options, language, help and closing ----------
function meMenu() {
  if (document.querySelector(".me-menu")) { document.querySelectorAll(".me-menu, .me-shield").forEach(x => x.remove()); return; }
  const btn = document.querySelector(".me-row"), r = btn.getBoundingClientRect();
  const shield = document.createElement("div"); shield.className = "help-shield me-shield";
  const menu = document.createElement("div"); menu.className = "tab-menu data-menu me-menu";
  const mi = d => `<span class="mi">${I(d)}</span>`;
  menu.innerHTML = `<button data-m="profile">${mi('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.400 3.600-7 8-7s8 2.600 8 7"/>')}${esc(T("My Profile"))}</button>
    <button data-m="accounts">${mi('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M15 14h3"/>')}${esc(T("Accounts"))}</button>
    <button data-m="categories">${mi('<path d="M3 4h2l2.500 11h10l2-8H6.500"/><circle cx="9" cy="19.500" r="1.400"/><circle cx="17" cy="19.500" r="1.400"/>')}${esc(T("Categories"))}</button>
    <button data-m="language">${mi('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>')}${esc(T("Language"))}</button>
    <button data-m="backup">${mi('<path d="M7 18a4.500 4.500 0 0 1-.5-9A6 6 0 0 1 18 10a4 4 0 0 1 0 8z"/><path d="M12 16v-5M9.500 13.500L12 11l2.500 2.500"/>')}${esc(T("Backup & Restore"))}</button>
    <button data-m="help">${mi('<circle cx="12" cy="12" r="9"/><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.7.400-1 .9-1 1.700M12 17h.01"/>')}${esc(T("Help"))}</button>
    <button data-m="about">${mi('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500h.01"/>')}${esc(T("About"))}</button>
    <hr>
    <button data-m="signout">${mi('<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/>')}${esc(T("Sign Out"))}</button>`;
  document.body.append(shield, menu);
  const w = menu.offsetWidth, h = menu.offsetHeight, below = r.top < window.innerHeight / 2;
  menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + "px";
  menu.style.top = (below ? Math.min(r.bottom + 6, window.innerHeight - h - 8) : Math.max(8, r.top - h - 6)) + "px";
  const close = () => { shield.remove(); menu.remove(); };
  shield.onclick = close;
  document.addEventListener("keydown", function esc1(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc1); } });
  const run = { profile: openProfile, subscription: openProfile, backup: openProfile, options: openOptions, help: openHelp, about, language: () => openLanguage(), accounts: () => App.go("portfolio"), categories: () => manageCategories(), signout: () => installed() ? closeApp() : lock() };
  menu.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { close(); run[b.dataset.m](); });
  menu.querySelectorAll("[data-lang]").forEach(b => b.onclick = () => { close(); setLanguage(b.dataset.lang); });
}

// ---------- One "Data ▾" menu instead of four buttons: import, export, backup, install, delete ----------
function dataMenu() {
  const btn = document.querySelector('[data-act="data"]'), r = btn.getBoundingClientRect();
  // Data in, data out, and deleting. Profiles (load/save) are in the profile panel, installing in the ? menu.
  const items = [
    ["export", "⬇", T("Export report (Excel, PDF, Word)") + (license.isPro ? "" : " 🔒")],
    ["-"],
    ["delete", "🗑", T("Delete data…")],
  ];
  const shield = document.createElement("div"); shield.className = "help-shield";
  const menu = document.createElement("div"); menu.className = "tab-menu data-menu";
  menu.innerHTML = items.map(([k, i, l]) => k === "-" ? "<hr>" : `<button data-d="${k}"${k === "delete" ? ' class="danger-item"' : ""}><span class="mi">${i}</span>${esc(l)}</button>`).join("");
  document.body.append(shield, menu);
  const w = menu.offsetWidth;
  menu.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + "px";
  menu.style.top = Math.max(8, Math.min(r.bottom + 6, window.innerHeight - menu.offsetHeight - 8)) + "px";   // the beta side menu has the button low on the screen
  const close = () => { shield.remove(); menu.remove(); };
  shield.onclick = close;
  document.addEventListener("keydown", function esc1(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc1); } });
  const run = { csv: () => openBankImport(), load: () => loadProfileFile(), export: openExport, save: saveProfileFile, install, delete: openDelete };
  menu.querySelectorAll("[data-d]").forEach(b => b.onclick = () => { close(); run[b.dataset.d](); });
}

// ---------- Many tabs (more modules later): the ones that don't fit go into "More ▾" ----------
function fitTabs() {
  const nav = document.getElementById("tabs");
  if (!nav) return;
  nav.querySelector(".tab-more")?.remove();
  const tabsEls = [...nav.querySelectorAll("[data-tab]")];
  tabsEls.forEach(t => t.hidden = false);
  if (window.innerWidth >= 720) nav.scrollLeft = 0;
  // The beta design shows all tabs in a side menu on wide screens
  if (beta() && window.innerWidth >= 700) return;
  if (window.innerWidth < (beta() ? 700 : 720) || nav.scrollWidth <= nav.clientWidth + 1) return;
  const more = document.createElement("button");
  more.className = "tab tab-more";
  more.textContent = T("More") + " ▾";   // the label first: measured with its real width
  nav.appendChild(more);
  const hidden = [];
  for (let i = tabsEls.length - 1; i >= 0 && nav.scrollWidth > nav.clientWidth + 1; i--) {
    if (tabsEls[i].classList.contains("active")) continue;
    tabsEls[i].hidden = true; hidden.unshift(tabsEls[i]);
  }
  nav.scrollLeft = 0;
  more.onclick = () => {
    const r = more.getBoundingClientRect();
    const shield = document.createElement("div"); shield.className = "help-shield";
    const menu = document.createElement("div"); menu.className = "tab-menu";
    menu.style.left = Math.min(r.left, window.innerWidth - 230) + "px"; menu.style.top = (r.bottom + 4) + "px";
    menu.innerHTML = hidden.map(t => `<button data-t="${t.dataset.tab}" style="color:${ACCENT[t.dataset.tab]}">${esc(t.textContent)}</button>`).join("");
    document.body.append(shield, menu);
    const close = () => { shield.remove(); menu.remove(); };
    shield.onclick = close;
    menu.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { close(); App.go(b.dataset.t); });
  };
}
window.addEventListener("resize", () => { clearTimeout(fitTabs._t); fitTabs._t = setTimeout(fitTabs, 150); });
// The web font makes the tab names a little wider once it has loaded: measure again then
try { document.fonts?.ready.then(() => fitTabs()); } catch { /* old browser */ }

// ---------- The ? button can be dragged anywhere, like in the app ----------
function helpPos() { try { return JSON.parse(store.get("mc-help-pos")) || null; } catch { return null; } }
function placeHelp(fab, pos) {
  if (!pos) { fab.style.left = fab.style.top = ""; return; }
  const x = Math.min(Math.max(8, pos.x), window.innerWidth - 58), y = Math.min(Math.max(70, pos.y), window.innerHeight - 58);
  fab.style.left = x + "px"; fab.style.top = y + "px"; fab.style.right = fab.style.bottom = "auto";
}
function setupHelpButton() {
  const fab = document.querySelector(".help-fab");
  placeHelp(fab, helpPos());
  fab.title = T("Help & about  (drag to move)");
  fab.onclick = null;
  fab.addEventListener("pointerdown", e => {
    const r = fab.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top, sx = e.clientX, sy = e.clientY;
    let moved = false;
    fab.setPointerCapture(e.pointerId);
    const move = ev => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
      moved = true; closeHelpMenu();
      placeHelp(fab, { x: ev.clientX - dx, y: ev.clientY - dy });
    };
    const up = () => {
      fab.removeEventListener("pointermove", move); fab.removeEventListener("pointerup", up);
      if (moved) store.set("mc-help-pos", JSON.stringify({ x: parseFloat(fab.style.left), y: parseFloat(fab.style.top) }));
      else helpMenu();
    };
    fab.addEventListener("pointermove", move); fab.addEventListener("pointerup", up);
  });
}
App.resetHelpButton = () => { store.remove("mc-help-pos"); placeHelp(document.querySelector(".help-fab"), null); };
window.addEventListener("resize", () => { const f = document.querySelector(".help-fab"); if (f) placeHelp(f, helpPos()); });

function helpMenu() {
  // Small buttons above the round ? button, like the app (not a window in the middle)
  if (document.querySelector(".help-menu")) return closeHelpMenu();
  const shield = document.createElement("div"); shield.className = "help-shield";
  const menu = document.createElement("div"); menu.className = "help-menu";
  const items = [["guide", "🧭  " + T("Guide")], ["about", "ℹ  " + T("About")], ["help", "?  " + T("Help")], ["options", "⚙  " + T("Settings")]];
  if (!installed()) items.push(["install", "📲  " + T("Install app")]);
  items.push(["exit", "⏻  " + T("Close")]);
  menu.innerHTML = items.map(([k, t]) => `<button data-m="${k}">${esc(t)}</button>`).join("");
  document.body.append(shield, menu);
  const r = document.querySelector(".help-fab").getBoundingClientRect();
  const h = menu.offsetHeight, w = menu.offsetWidth;
  // Above the button, else below it, else next to it (small or landscape screens)
  let top = r.top - h - 10, left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
  if (top < 8) top = r.bottom + 10;
  if (top + h > window.innerHeight - 8) {
    top = Math.max(8, window.innerHeight - h - 8);
    left = r.left - w - 10 >= 8 ? r.left - w - 10 : Math.min(r.right + 10, window.innerWidth - w - 8);
  }
  Object.assign(menu.style, { left: left + "px", top: top + "px", right: "auto", bottom: "auto" });
  requestAnimationFrame(() => menu.classList.add("open"));
  shield.onclick = closeHelpMenu;
  menu.querySelectorAll("[data-m]").forEach(b => b.onclick = () => {
    closeHelpMenu();
    const m = b.dataset.m;
    if (m === "guide") openGuide(); else if (m === "help") openHelp(); else if (m === "options") openOptions(); else if (m === "install") install(); else if (m === "exit") closeApp(); else about();
  });
}
function closeHelpMenu() {
  document.querySelectorAll(".help-menu, .help-shield").forEach(x => x.remove());
}
document.addEventListener("keydown", e => { if (e.key === "Escape") closeHelpMenu(); });

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
// Shown first, before What's new and reminders; next() runs when it is answered.
function welcome(next = () => {}) {
  const d = State.data, s = d.Settings;
  if (!s.AskOnStart) return next();
  if (d.Incomes.length + d.Expenses.length + d.Received.length + d.Holdings.length + d.Offers.length + d.Loans.length + d.Goals.length === 0) return next();
  let action = "continue";
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
    <p class="hint">${esc(T("You can switch this question back on in Settings → Backup & restore."))}</p>`, { width: 440, cls: "box",
    onClose: () => { if (action === "continue") setTimeout(next, 250); } });
  p.el.querySelectorAll("[data-w]").forEach(b => b.onclick = async () => {
    if (p.el.querySelector('[name="dontask"]').checked) { s.AskOnStart = false; save(); }
    action = b.dataset.w;
    p.close();
    if (action === "load") { await loadProfileFile(); setTimeout(next, 250); }
    else if (action === "fresh") openDelete();
  });
}

// ---------- Terms of use: accepted once (again when they change) ----------
const TERMS_VERSION = "2026-11-01";
function termsGate(next) {
  const s = State.data.Settings;
  if (s.TermsAccepted === TERMS_VERSION || store.get("mc-terms") === TERMS_VERSION) { s.TermsAccepted = TERMS_VERSION; return next(); }
  const p = popup(`<div class="box-head"><span class="box-icon">📜</span><h2>${esc(T("Before you start"))}</h2></div>
    <p>${esc(T("MoneyCompass helps you keep an overview of your money. Please note:"))}</p>
    <ul class="terms-list">
      <li>${esc(T("It does not give financial, investment, tax or legal advice – all results are estimates for information only."))}</li>
      <li>${esc(T("The figures depend on what you enter and on public data, which can be out of date. Always check the bank's own terms before you decide."))}</li>
      <li>${esc(T("You decide what to do with your money and you are responsible for your decisions and for backups of your data."))}</li>
    </ul>
    <p><a href="../terms.html#${lang()}" target="_blank" rel="noopener">${esc(T("Read the full Terms of use"))}</a> · <a href="../privacy.html#${lang()}" target="_blank" rel="noopener">${esc(T("Privacy policy"))}</a></p>
    <label class="check"><input type="checkbox" name="agree"><span>${esc(T("I have read and accept the Terms of use."))}</span></label>
    <div class="box-buttons"><button class="btn main" data-ok disabled>${esc(T("Continue"))}</button></div>`, { width: 520, cls: "box terms-box", onClose: () => { if (s.TermsAccepted !== TERMS_VERSION) setTimeout(() => termsGate(next), 50); } });
  const cb = p.el.querySelector('[name="agree"]'), ok = p.el.querySelector("[data-ok]");
  p.el.querySelectorAll("[data-close]").forEach(x => x.remove());   // must be answered
  cb.onchange = () => { ok.disabled = !cb.checked; };
  ok.onclick = () => { s.TermsAccepted = TERMS_VERSION; store.set("mc-terms", TERMS_VERSION); save(); p.close(); next(); };
}

// ---------- Closing: the same "Save your profile before closing?" box as the Windows app ----------
async function closeApp() {
  const s = State.data.Settings;
  const choice = s.CloseChoice || "";
  if (!license.isPro) return finishClose(false);   // the demo keeps no backups: nothing to save before closing
  if (choice === "with") { if (await saveProfileFile()) return savedThenClose(); return; }
  if (choice === "without" || choice === "none") return finishClose(false);
  const p = popup(`<div class="box-head"><span class="box-icon">💾</span><h2>${esc(T("Save your profile before closing?"))}</h2></div>
    <p class="hint">${esc(T("Your entries are always kept in this browser. The profile is an extra copy, for example as a backup."))}</p>
    <div class="box-buttons">
      <button class="btn go" data-c="with">💾 ${esc(T("Save profile and close"))}</button>
      <button class="btn second" data-c="without">${esc(T("Close without saving"))}</button>
      <button class="btn second" data-c="cancel">${esc(T("Cancel"))}</button></div>
    <label class="check"><input type="checkbox" name="remember"><span>${esc(T("Remember my choice"))}</span></label>
    <p class="hint">${esc(T("You can change this later in Settings → Backup & restore."))}</p>`, { width: 440, cls: "box" });
  p.el.querySelectorAll("[data-c]").forEach(b => b.onclick = () => {
    const c = b.dataset.c;
    p.close();
    if (c === "cancel") return;
    if (p.el.querySelector('[name="remember"]').checked) { s.CloseChoice = c; save(); }
    if (c === "with") { saveProfileFile().then(ok => ok && savedThenClose()); }
    else setTimeout(() => finishClose(false), 200);
  });
}
// The browser must finish the download before the window may close (Edge otherwise asks "Your file is still downloading"):
// so after saving, the user closes with one more click
function savedThenClose() {
  const p = popup(`<div class="box-head"><span class="box-icon go">💾</span><h2>${esc(T("Profile saved"))}</h2></div>
    <p class="hint">${esc(T("Your profile file is in your Downloads folder."))}</p>
    <div class="box-buttons"><button class="btn main" data-x="close">⏻ ${esc(T("Close MoneyCompass"))}</button>
    <button class="btn second" data-close>${esc(T("Stay"))}</button></div>`, { width: 420, cls: "box" });
  const btn = p.el.querySelector('[data-x="close"]');
  btn.disabled = true;
  setTimeout(() => { btn.disabled = false; }, 1500);
  btn.onclick = () => { p.close(); setTimeout(() => finishClose(true), 150); };
}

let closing = false;
function finishClose(fileSaved) {
  save();
  closing = true;
  try { window.close(); } catch { /* not allowed */ }
  // The browser may not allow a page to close its own window or tab: then say so honestly
  setTimeout(() => {
    if (window.closed) return;
    popup(`<div class="box-head"><span class="box-icon">⏻</span><h2>${esc(T("Close the window"))}</h2></div>
      <p>${esc(fileSaved ? T("Your profile file was saved.") : T("No profile file was saved."))}</p>
      <p class="hint">${esc(T("Your entries always stay in this browser, as before. This browser doesn't let MoneyCompass close the window by itself – close it with the X at the top right."))}</p>
      <div class="box-buttons"><button class="btn main" data-close>${esc(T("OK"))}</button></div>`, { width: 440, cls: "box" });
  }, 400);
}

function about() {
  const p = popup(`<div class="about"><img src="../logo.svg" alt="" width="72"><h2>MoneyCompass</h2><p>${esc(T("Your personal money overview"))}</p>
    <p><b>${esc(T("Version {0} (build {1})", WEB_VERSION, WEB_BUILD))}</b> · ${esc(T("Web version"))}</p>
    <p><button class="btn second" data-news>✨ ${esc(T("What's new"))}</button></p>
    <p class="hint">${esc(T("Last update: {0}", fmtDate(WEB_DATE) + " " + WEB_DATE.slice(11, 16)))}</p>
    <p class="hint">${esc(Rates.data.Updated ? T("Current rates from NBP and the Ministry of Finance, updated {0}.", fmtDate(Rates.data.Updated) + " " + new Date(Rates.data.Updated).toTimeString().slice(0, 5)) : T("Current rates have not been downloaded yet."))}</p>
    <p class="hint">${esc(license.status)}</p>
    <p class="hint">${esc(T("© {0} MoneyCompass. All rights reserved.", new Date().getFullYear()))}</p>
    <p class="hint"><a href="../terms.html#${lang()}" target="_blank" rel="noopener">${esc(T("Terms of use"))}</a> · <a href="../privacy.html#${lang()}" target="_blank" rel="noopener">${esc(T("Privacy policy"))}</a></p>
    ${installed() ? `<p class="hint good">✔ ${esc(T("Installed as an app on this device."))}</p>` : `<button class="btn go" data-install>📲 ${esc(T("Install app"))}</button>`}</div>
    <div class="popup-buttons"><button class="btn second" data-close>${esc(T("Close"))}</button></div>`, { width: 420 });
  p.el.querySelector("[data-news]").onclick = e => { e.preventDefault(); p.close(); openNews(true); };
  const ib = p.el.querySelector("[data-install]"); if (ib) ib.onclick = () => { p.close(); install(); };
}

function render() {
  const page = tabs().find(t => t.route === current) || Overview;
  document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === page.route));
  document.documentElement.style.setProperty("--accent", ACCENT[page.route]);
  document.documentElement.dataset.page = page.route;
  const pt = document.getElementById("page-title"); if (pt) pt.textContent = T(page.title);
  // Import right where the data goes: Outflows and Inflows (bank statement), Savings (savings account statement)
  const hi = document.getElementById("head-import");
  if (hi) {
    const lock = license.isPro ? "" : " 🔒";
    const what = { expenses: ["⬆ " + T("Import bank statement") + lock, () => smartImport()], income: ["⬆ " + T("Import bank statement") + lock, () => smartImport()],
      portfolio: ["⬆ " + T("Import savings account statement") + lock, () => openSavingsCheck()],
      investments: ["⬆ " + T("Import CSV") + lock, async () => (await import("./invest-import.js")).openInvestImport()] }[page.route];
    hi.hidden = !what; if (what) { hi.textContent = what[0]; hi.onclick = what[1]; }
  }
  const el = document.getElementById("page");
  const y = window.scrollY;
  page.render(el);
  bindBin(el);
  const grid = el.querySelector(".grid");
  if (grid) grid.dataset.key = "web2:" + page.route;   // "web2": the new standard order of the cards (orders saved for the old one are not used)
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
    if (route === "goals") route = "budget";
    if (!tabs().some(t => t.route === route)) route = "overview";
    current = route; render(); fitTabs(); window.scrollTo(0, 0);
    const tab = document.querySelector(`[data-tab="${route}"]`);
    // Phones: the tabs scroll sideways, so bring the chosen one into view. Wider screens: "More ▾" holds the rest,
    // so the tab row must start at the left (otherwise "Overview" ends up half hidden under the logo)
    const nav = document.getElementById("tabs");
    if (window.innerWidth < (beta() ? 700 : 720)) { if (tab) tab.scrollIntoView({ inline: "center", block: "nearest" }); }
    else if (nav) nav.scrollLeft = 0;
    try { history.replaceState(null, "", "#" + route); } catch { /* file */ }
  },
  refresh: render,
  rebuild: buildShell,
  applyTheme,
  openProfile, openOptions, openHelp, openExport, openImport, openDelete, openOptimize, openBankImport, install, openGuide,
  saveProfile: saveProfileFile,
  tabList: () => tabs().map(t => ({ route: t.route, title: T(t.title) })),
  moveTab, resetTabs: () => { delete State.data.Settings.TabOrder; save(); buildShell(); },
});

async function start() {
  loadCurrent();
  await license.load();
  const hash = location.hash.slice(1);
  if (hash) current = hash === "goals" ? "budget" : hash;
  if (hash === "goals") history.replaceState(null, "", "#budget");
  buildShell();
  const d0 = State.data;
  const isNew = d0.Incomes.length + d0.Expenses.length + d0.Holdings.length + d0.Offers.length === 0;
  // Order at start: Terms (once) → Welcome back (continue, load a profile or start fresh) → What's new → guide or promotion reminder
  const afterTerms = () => welcome(() => {
    if (hasNews(isNew)) openNews(false, () => { if (shouldShowGuide()) openGuide(); });
    else if (shouldShowGuide()) openGuide(); else promoReminder();
  });
  startLock(buildShell);
  startBackup(() => drawBackupBar(saveProfileFile));
  // With a PIN the lock screen comes first
  if (hasPin()) lock(() => termsGate(afterTerms)); else termsGate(afterTerms);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  Rates.listeners.push(() => { if (!document.querySelector(".popup-back, .dragging")) render(); });
  Rates.refresh();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  try { navigator.storage?.persist?.(); } catch { /* not supported */ }
  // Closed with the X of the window or tab: a page can't show its own box there, only the browser's
  // "Leave?" question – asked when there are changes that are not in a profile file yet
  window.addEventListener("beforeunload", e => {
    save();
    const c = State.data.Settings.CloseChoice || "";
    if (closing || !license.isPro || c === "without" || c === "none" || !changedSinceFile()) return;
    e.preventDefault(); e.returnValue = "";
  });
  window.addEventListener("storage", e => { if (e.key && e.key.startsWith("mc-")) { loadCurrent(); buildShell(); } });
}
start();
