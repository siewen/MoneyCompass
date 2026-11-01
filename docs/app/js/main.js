// MoneyCompass web: the window, the tabs and starting up.
import { store, T, State, loadCurrent, license, moduleOn, MODULES, lang, currentName, save, lastSaveFailed, summary, fmtDate, changedSinceFile } from "./core.js";
import { esc, popup, toast } from "./ui.js";
import { startLock, lock, hasPin } from "./lock.js";
import { App, DOWNLOAD_URL } from "./app.js";
import { Rates } from "./rates.js";
import { WEB_VERSION, WEB_BUILD, WEB_DATE } from "./version.js";
import { openGuide, shouldShowGuide } from "./guide.js";
import { hasNews, openNews } from "./news.js";
import { Overview, Income, Expenses, Emergency, Portfolio, bindBin } from "./pages-main.js";
import { Savings, Goals, Loans, Budget, openOptimize, openBankImport } from "./pages-pro.js";
import { Calendar } from "./calendar.js";
import { promoReminder } from "./advice.js";
import { openProfile, openOptions, openHelp, openExport, openImport, openDelete, avatar, loadProfileFile, saveProfileFile, openLanguage } from "./dialogs.js";

const ACCENT = { overview: "#0F766E", income: "#1D4ED8", expenses: "#C2410C", emergency: "#B45309", portfolio: "#15803D", goals: "#0E7490", loans: "#BE123C", budget: "#4338CA", calendar: "#0369A1", savings: "#7E22CE" };
const MODULE_PAGES = { goals: Goals, loans: Loans, budget: Budget, calendar: Calendar };
let current = "overview";

function tabs() {
  const list = [Overview, Income, Expenses, Emergency, Portfolio];
  // Savings goals are part of the Savings tab (Pro), not a tab of their own
  for (const m of MODULES) if (moduleOn(m.code) && m.code !== "goals") list.push(MODULE_PAGES[m.code]);
  list.push(Savings);
  return list;
}

// Line icons for the tabs (shown in the beta design's side menu)
const I = d => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const TAB_ICON = {
  overview: I('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  income: I('<path d="M12 4v12M6 10l6 6 6-6"/><path d="M4 20h16"/>'),
  expenses: I('<path d="M12 20V8M6 14l6-6 6 6"/><path d="M4 4h16"/>'),
  emergency: I('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  portfolio: I('<path d="M4 8h13a3 3 0 0 1 3 3v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 8l11-4 2 4"/><circle cx="16" cy="14" r="1.3"/>'),
  loans: I('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h4"/>'),
  budget: I('<path d="M12 3v9h9"/><path d="M20.5 15A9 9 0 1 1 9 3.5"/>'),
  calendar: I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  savings: I('<path d="M4 7h16M4 12h16M4 17h10"/><path d="M18 15l2 2-2 2"/>'),
};
/** Beta design: "navy" or "emerald" (saved in this browser), or "" for the normal design. */
const BETA_KEY = "mc-beta";
// Emerald is the standard design; "classic" is saved when someone chooses Classic light or dark
const beta = () => { let v = null; try { v = localStorage.getItem(BETA_KEY); } catch { /* private window */ } return v === "classic" ? "" : v || "emerald"; };
/** Beta side menu: "auto" folds to icons and opens when the mouse is on it, "pinned" stays open. */
const side = () => { try { return localStorage.getItem("mc-side") || "auto"; } catch { return "auto"; } };
function toggleSide() {
  const v = side() === "pinned" ? "auto" : "pinned";
  try { localStorage.setItem("mc-side", v); } catch { /* private window */ }
  document.documentElement.dataset.side = v;
  const b = document.querySelector(".side-toggle"); if (b) { b.textContent = v === "pinned" ? "‹" : "›"; b.title = T(v === "pinned" ? "Fold the menu (it opens when you point at it)" : "Keep the menu open"); }
}
function setBeta(v) { try { localStorage.setItem(BETA_KEY, v || "classic"); } catch { /* private window */ } buildShell(); }
function betaMenu() {
  const btn = document.querySelector('[data-act="beta"]'), r = btn.getBoundingClientRect();
  const now = beta() || (State.data.Settings.Design === "dark" ? "dark" : "light");
  const shield = document.createElement("div"); shield.className = "help-shield";
  const menu = document.createElement("div"); menu.className = "tab-menu data-menu beta-menu";
  const opt = (v, sw, label, sub) => `<button data-b="${v}"${now === v ? ' class="on"' : ""}><span class="swatch ${sw}"></span><span><b>${esc(label)}</b><small>${esc(sub)}</small></span>${now === v ? "<i>✓</i>" : ""}</button>`;
  menu.innerHTML = `<div class="menu-title">${esc(T("Design"))}</div>` + opt("light", "classic", T("Classic – Light"), T("The design you know")) + opt("dark", "classic-dark", T("Classic – Dark"), T("Same layout, dark background")) + "<hr>" +
    opt("navy", "navy", T("Navy"), T("Side menu, dark blue with mint and magenta")) + opt("emerald", "emerald", T("Emerald"), T("Standard design: side menu, dark green with lavender"));
  document.body.append(shield, menu);
  const w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + "px";
  menu.style.top = Math.max(8, Math.min(r.bottom + 6, window.innerHeight - h - 8)) + "px";
  const close = () => { shield.remove(); menu.remove(); };
  shield.onclick = close;
  menu.querySelectorAll("[data-b]").forEach(b => b.onclick = () => {
    close();
    const v = b.dataset.b;
    if (v === "light" || v === "dark") { State.data.Settings.Design = v; save(); setBeta(""); } else setBeta(v);
  });
}

function applyTheme() {
  let design = State.data.Settings.Design || "light";
  if (design === "colourful") design = "light";   // the Colourful theme was replaced by the beta designs
  if (design === "system") design = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = design;
  const b = beta();
  if (b) document.documentElement.dataset.design = b; else delete document.documentElement.dataset.design;
  document.documentElement.dataset.side = side();
}

function buildShell() {
  applyTheme();
  document.documentElement.lang = lang();
  document.title = "MoneyCompass";
  const list = tabs();
  if (!list.some(t => t.route === current)) current = "overview";
  document.getElementById("app").innerHTML = `
    <header class="top">
      <button class="side-toggle" data-act="side" title="${esc(T(side() === "pinned" ? "Fold the menu (it opens when you point at it)" : "Keep the menu open"))}">${side() === "pinned" ? "‹" : "›"}</button>
      <a class="brand" href="../index.html" title="MoneyCompass"><img src="../logo.svg" alt=""><span>MoneyCompass</span></a>
      <nav class="tabs" id="tabs">${list.map(t => `<button class="tab" data-tab="${t.route}" style="--accent:${ACCENT[t.route]}"><span class="ti">${TAB_ICON[t.route] || ""}</span><span class="tl">${esc(T(t.title))}</span></button>`).join("")}</nav>
      <div class="actions">
        <button class="design-switch${beta() ? " on" : ""}" data-act="beta" title="${esc(T("Design: classic light or dark, or the new beta designs"))}"><span class="sw"></span><span class="sw-l">${esc(T("Design"))}</span></button>
        <button class="act data-btn" data-act="data" title="${esc(T("Data: import, export, backup"))}">🗂<span>${esc(T("Data"))}</span> ▾</button>
        <button class="act lang-btn" data-act="lang" title="${esc(T("Language"))}">🌐<b>${esc(lang().toUpperCase())}</b></button>
        <button class="profile-btn" data-act="profile" title="${esc(T("Profile: {0}", currentName()))}">${avatar(34)}</button>
        ${installed() ? `<button class="act exit" data-act="exit" title="${esc(T("Close"))}">⏻</button>` : ""}
      </div>
    </header>
    ${license.isPro ? "" : `<div class="free-bar">${esc(T("Free web version."))} <a href="${DOWNLOAD_URL}" target="_blank" rel="noopener">${esc(T("Download the Windows app"))}</a> · <a href="#" data-act="profile">${esc(T("Enter license key"))}</a></div>`}
    <div class="page-head"><h1 id="page-title"></h1></div>
    <main id="page"></main>
    <button class="help-fab" data-act="help-menu" title="${esc(T("Help & About"))}">?</button>`;
  document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => App.go(b.dataset.tab));
  const acts = { delete: openDelete, import: openImport, export: openExport, profile: openProfile, install, exit: closeApp, lang: () => openLanguage(), data: dataMenu, beta: betaMenu, side: toggleSide };
  document.querySelectorAll("[data-act]:not(.help-fab)").forEach(b => b.onclick = ev => { ev.preventDefault(); acts[b.dataset.act](); });
  setupHelpButton();
  render();
  fitTabs();
}

// ---------- One "Data ▾" menu instead of four buttons: import, export, backup, install, delete ----------
function dataMenu() {
  const btn = document.querySelector('[data-act="data"]'), r = btn.getBoundingClientRect();
  // Data in, data out, and deleting. Profiles (load/save) are in the profile panel, installing in the ? menu.
  const items = [
    ["csv", "🏦", T("Import bank statement (CSV)…") + (license.isPro ? "" : " 🔒")],
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
  if (beta() && window.innerWidth >= 900) return;
  if (window.innerWidth < 720 || nav.scrollWidth <= nav.clientWidth + 1) return;
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
  const items = [["guide", "🧭  " + T("Guide")], ["about", "ℹ  " + T("About")], ["help", "?  " + T("Help")], ["options", "⚙  " + T("Options")]];
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
    <p class="hint">${esc(T("You can switch this question back on in Options → Backup & restore."))}</p>`, { width: 440, cls: "box",
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
  if (choice === "with") { saveProfileFile(); return savedThenClose(); }
  if (choice === "without" || choice === "none") return finishClose(false);
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
    if (c === "with") { saveProfileFile(); savedThenClose(); }
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
  const el = document.getElementById("page");
  const y = window.scrollY;
  page.render(el);
  bindBin(el);
  const grid = el.querySelector(".grid");
  if (grid) grid.dataset.key = "web:" + page.route;
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
    if (route === "goals") route = "portfolio";
    if (!tabs().some(t => t.route === route)) route = "overview";
    current = route; render(); fitTabs(); window.scrollTo(0, 0);
    const tab = document.querySelector(`[data-tab="${route}"]`);
    // Phones: the tabs scroll sideways, so bring the chosen one into view. Wider screens: "More ▾" holds the rest,
    // so the tab row must start at the left (otherwise "Overview" ends up half hidden under the logo)
    const nav = document.getElementById("tabs");
    if (window.innerWidth < 720) { if (tab) tab.scrollIntoView({ inline: "center", block: "nearest" }); }
    else if (nav) nav.scrollLeft = 0;
    try { history.replaceState(null, "", "#" + route); } catch { /* file */ }
  },
  refresh: render,
  rebuild: buildShell,
  applyTheme,
  openProfile, openOptions, openHelp, openExport, openImport, openDelete, openOptimize, openBankImport, install, openGuide,
  saveProfile: saveProfileFile,
});

async function start() {
  loadCurrent();
  await license.load();
  const hash = location.hash.slice(1);
  if (hash) current = hash === "goals" ? "portfolio" : hash;
  if (hash === "goals") history.replaceState(null, "", "#portfolio");
  buildShell();
  const d0 = State.data;
  const isNew = d0.Incomes.length + d0.Expenses.length + d0.Holdings.length + d0.Offers.length === 0;
  // Order at start: Terms (once) → Welcome back (continue, load a profile or start fresh) → What's new → guide or promotion reminder
  const afterTerms = () => welcome(() => {
    if (hasNews(isNew)) openNews(false, () => { if (shouldShowGuide()) openGuide(); });
    else if (shouldShowGuide()) openGuide(); else promoReminder();
  });
  startLock(buildShell);
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
    if (closing || c === "without" || c === "none" || !changedSinceFile()) return;
    e.preventDefault(); e.returnValue = "";
  });
  window.addEventListener("storage", e => { if (e.key && e.key.startsWith("mc-")) { loadCurrent(); buildShell(); } });
}
start();
