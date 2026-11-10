// A short "what to do here" window for pages that are still empty. The person can hide it for a page or for all pages,
// and bring it back in Settings (General and Reset).
import { T, State, save } from "./core.js";
import { esc, popup, toast } from "./ui.js";
import { App } from "./app.js";


// Line icons (same style as the rest of MoneyCompass) instead of emoji
const ICON = {
  income: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v.01M17.5 14.5v.01"/>',
  cart: '<path d="M3 4h2.2l2 11h10.2l2-8H6.3"/><circle cx="9.5" cy="19" r="1.3"/><circle cx="16.5" cy="19" r="1.3"/>',
  import: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4 15v3.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.500-1.500V15"/>',
  demo: '<path d="M12 3l1.8 4.7L18.500 9.500l-4.700 1.800L12 16l-1.800-4.700L5.500 9.500l4.700-1.800z"/><path d="M18.500 15.500l.7 1.800 1.800.7-1.800.7-.7 1.800-.7-1.800-1.800-.7 1.800-.7z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bank: '<path d="M3.500 9.500L12 4l8.500 5.500"/><path d="M5.500 10v7M9.500 10v7M14.500 10v7M18.500 10v7M3.500 19.500h17"/>',
  card: '<rect x="3" y="5.500" width="18" height="13" rx="2.500"/><path d="M3 10h18M6.500 15h3"/>',
  target: '<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="4.500"/><circle cx="12" cy="12" r=".8"/>',
  chart: '<path d="M5 20V11M12 20V4M19 20v-6"/>',
  shield: '<path d="M12 3l7.500 3v5.500c0 4.500-3.100 8-7.500 9.500-4.400-1.500-7.500-5-7.500-9.500V6z"/><path d="M8.800 12l2.200 2.200 4.200-4.400"/>',
  gem: '<path d="M6.500 4h11l3.500 5-9 11L3 9z"/><path d="M3 9h18M9.500 4L8 9l4 11 4-11-1.500-5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.500 8.500l-2 5-5 2 2-5z"/>',
};
const ico = k => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] || ICON.compass}</svg>`;

const none = k => !((State.data[k] || []).length);
const has = (a, b) => a.some(x => x === b);

/** act: {i icon, l label, d description, go page to open first, click / focus: element to use once the page is open, fn: own action} */
const HINTS = {
  overview: { icon: "compass", title: "Welcome to MoneyCompass", empty: () => none("Incomes") && none("Expenses"),
    text: "Add your income and expenses to unlock your personal financial assessment. Choose how you would like to begin:",
    acts: [{ i: "income", l: "Add income", d: "Salary and other sources of income.", go: "income", click: '[data-action="inc-add"]' },
      { i: "cart", l: "Add expenses", d: "Record your spending manually.", go: "expenses", click: '[data-action="ex-add"]' },
      { i: "import", l: "Import a bank statement", d: "Transactions are read and categorised automatically.", fn: "import" },
      { i: "demo", l: "Explore with demo data", d: "Sample figures. Your own data is not affected.", fn: "demo" }] },
  income: { icon: "income", title: "Set up your income", empty: () => none("Incomes") && none("Received"),
    text: "Record your salary and other income to see what remains each month. Enter it manually or import a bank statement.",
    acts: [{ i: "income", l: "Add an income source", d: "Name, amount and frequency.", click: '[data-action="inc-add"]' },
      { i: "import", l: "Import a bank statement", d: "Salary payments are detected automatically.", fn: "import" }] },
  expenses: { icon: "cart", title: "Set up your expenses", empty: () => none("Expenses"),
    text: "Record your spending manually, or import a bank statement and let MoneyCompass categorise it automatically.",
    acts: [{ i: "plus", l: "Add an expense", d: "A single purchase or bill.", click: '[data-action="ex-add"]' },
      { i: "import", l: "Import a bank statement", d: "All outflows in one step.", fn: "import" }] },
  emergency: { icon: "shield", title: "Set up your emergency fund", empty: () => none("Expenses") && none("Holdings"),
    text: "MoneyCompass needs your monthly expenses and savings to calculate how long your reserves would last.",
    acts: [{ i: "cart", l: "Add expenses", d: "Establishes your monthly cost of living.", go: "expenses", click: '[data-action="ex-add"]' },
      { i: "bank", l: "Add savings", d: "Funds available in an emergency.", go: "portfolio" }] },
  portfolio: { icon: "bank", title: "Set up your savings", empty: () => none("Holdings"),
    text: "Add your savings accounts to see their real return and compare them with better offers.",
    acts: [{ i: "bank", l: "Add a savings account", d: "Bank, balance and interest rate.", click: "[data-sv-add]" },
      { i: "import", l: "Import a savings statement", d: "Balance and interest are read from the file.", fn: "importSavings" }] },
  loans: { icon: "card", title: "Set up your loans and debts", empty: () => none("Loans"),
    text: "Add a loan or credit card balance to see your payoff date and whether overpaying is worthwhile.",
    acts: [{ i: "card", l: "Add a loan", d: "Balance, interest rate and monthly payment.", click: '[data-action="l-new"]' }] },
  budget: { icon: "target", title: "Set up your budget", empty: () => none("Budgets") && none("Goals"),
    text: "Define monthly spending limits and savings goals. MoneyCompass tracks your progress automatically.",
    acts: [{ i: "chart", l: "Set a monthly limit", d: "For any spending category.", click: '[data-action="b-new"]' },
      { i: "target", l: "Add a savings goal", d: "A purchase, holiday or deposit.", click: '[data-action="b-goals"]' }] },
  networth: { icon: "gem", title: "Set up your net worth", empty: () => none("Holdings") && none("Loans"),
    text: "Net worth is your assets minus your liabilities. Add your savings and loans to begin tracking.",
    acts: [{ i: "bank", l: "Add savings", d: "Your assets.", go: "portfolio" }, { i: "card", l: "Add loans", d: "Your liabilities.", go: "loans" }] },
};

const hidden = () => (State.data.Settings.HintsHidden = State.data.Settings.HintsHidden || []);
let shown = "";   // the page we last looked at: the window comes once per visit, not on every redraw

/** Called after a page is drawn. ctx: { smartImport, startDemo, openSavingsCheck } */
export function maybeHint(route, ctx) {
  if (route === shown) return; shown = route;
  const h = HINTS[route], s = State.data.Settings;
  if (!h || s.HintsOff || s.IsDemo || has(hidden(), route) || !h.empty()) return;
  setTimeout(() => {
    if (document.querySelector(".popup-back") || !document.getElementById("page") || document.documentElement.dataset.page !== route) return;
    openHint(route, ctx);
  }, 700);
}

export function openHint(route, ctx) {
  const h = HINTS[route]; if (!h) return;
  const p = popup(`<div class="ph-hd"><span class="ph-mark">${ico(h.icon)}</span><div class="ph-ht"><h2>${esc(T(h.title))}</h2><p class="ph-text">${esc(T(h.text))}</p></div><button class="nw-x" data-close aria-label="Close">✕</button></div>
    <div class="ph-body"><div class="ph-acts">${h.acts.map((a, i) => `<button class="ph-act${i === 0 ? " main" : ""}" data-i="${i}"><span class="ph-i">${ico(a.i)}</span><span class="ph-t"><b>${esc(T(a.l))}</b><small>${esc(T(a.d))}</small></span><span class="ph-go" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></button>`).join("")}</div></div>
    <div class="ph-foot"><label class="ph-sw"><input type="checkbox" name="hide"${has(hidden(), route) ? " checked" : ""}><i></i><span>${esc(T("Don't show this again on this page"))}</span></label>
      <button class="btn second ph-later" data-close>${esc(T("Later"))}</button></div>`, { width: 540, cls: "ph-popup nw-win" });
  p.el.querySelector('[name="hide"]').onchange = e => { const l = hidden(), i = l.indexOf(route); if (e.target.checked && i < 0) l.push(route); if (!e.target.checked && i >= 0) l.splice(i, 1); save(); };
  p.el.querySelectorAll(".ph-act").forEach(b => b.onclick = () => {
    const a = h.acts[+b.dataset.i]; p.close();
    if (a.fn === "import") return ctx.smartImport();
    if (a.fn === "importSavings") return ctx.openSavingsCheck();
    if (a.fn === "demo") { ctx.startDemo(); App.rebuild(); return; }
    if (a.go) App.go(a.go);
    setTimeout(() => {
      const el = (a.click || a.focus) && document.querySelector("#page " + (a.click || a.focus).replace(/^#page /, ""));
      if (!el) return;
      if (a.click) el.click(); else { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.focus({ preventScroll: true }); }
    }, a.go ? 350 : 80);
  });
}

/** Settings: bring every tip back. */
export function resetHints() { const s = State.data.Settings; s.HintsHidden = []; s.HintsOff = false; shown = ""; save(); toast(T("Setup guidance restored.")); }
