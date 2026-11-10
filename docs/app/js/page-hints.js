// A short "what to do here" window for pages that are still empty. The person can hide it for a page or for all pages,
// and bring it back in Settings (General and Reset).
import { T, State, save } from "./core.js";
import { esc, popup, toast } from "./ui.js";
import { App } from "./app.js";

const none = k => !((State.data[k] || []).length);
const has = (a, b) => a.some(x => x === b);

/** act: {i icon, l label, d description, go page to open first, click / focus: element to use once the page is open, fn: own action} */
const HINTS = {
  overview: { icon: "🧭", title: "Welcome to MoneyCompass", empty: () => none("Incomes") && none("Expenses"),
    text: "Add your income and expenses to unlock your personal financial assessment. Choose how you would like to begin:",
    acts: [{ i: "💶", l: "Add income", d: "Salary and other sources of income.", go: "income", click: '[data-action="inc-add"]' },
      { i: "🛒", l: "Add expenses", d: "Record your spending manually.", go: "expenses", click: '[data-action="ex-add"]' },
      { i: "⬆", l: "Import a bank statement", d: "Transactions are read and categorised automatically.", fn: "import" },
      { i: "🧪", l: "Explore with demo data", d: "Sample figures. Your own data is not affected.", fn: "demo" }] },
  income: { icon: "💶", title: "Set up your income", empty: () => none("Incomes") && none("Received"),
    text: "Record your salary and other income to see what remains each month. Enter it manually or import a bank statement.",
    acts: [{ i: "💶", l: "Add an income source", d: "Name, amount and frequency.", click: '[data-action="inc-add"]' },
      { i: "⬆", l: "Import a bank statement", d: "Salary payments are detected automatically.", fn: "import" }] },
  expenses: { icon: "🛒", title: "Set up your expenses", empty: () => none("Expenses"),
    text: "Record your spending manually, or import a bank statement and let MoneyCompass categorise it automatically.",
    acts: [{ i: "＋", l: "Add an expense", d: "A single purchase or bill.", click: '[data-action="ex-add"]' },
      { i: "⬆", l: "Import a bank statement", d: "All outflows in one step.", fn: "import" }] },
  emergency: { icon: "🛡️", title: "Set up your emergency fund", empty: () => none("Expenses") && none("Holdings"),
    text: "MoneyCompass needs your monthly expenses and savings to calculate how long your reserves would last.",
    acts: [{ i: "🛒", l: "Add expenses", d: "Establishes your monthly cost of living.", go: "expenses", click: '[data-action="ex-add"]' },
      { i: "🏦", l: "Add savings", d: "Funds available in an emergency.", go: "portfolio" }] },
  portfolio: { icon: "🏦", title: "Set up your savings", empty: () => none("Holdings"),
    text: "Add your savings accounts to see their real return and compare them with better offers.",
    acts: [{ i: "🏦", l: "Add a savings account", d: "Bank, balance and interest rate.", click: "[data-sv-add]" },
      { i: "⬆", l: "Import a savings statement", d: "Balance and interest are read from the file.", fn: "importSavings" }] },
  loans: { icon: "💳", title: "Set up your loans and debts", empty: () => none("Loans"),
    text: "Add a loan or credit card balance to see your payoff date and whether overpaying is worthwhile.",
    acts: [{ i: "💳", l: "Add a loan", d: "Balance, interest rate and monthly payment.", click: '[data-action="l-new"]' }] },
  budget: { icon: "🎯", title: "Set up your budget", empty: () => none("Budgets") && none("Goals"),
    text: "Define monthly spending limits and savings goals. MoneyCompass tracks your progress automatically.",
    acts: [{ i: "📊", l: "Set a monthly limit", d: "For any spending category.", click: '[data-action="b-new"]' },
      { i: "🎯", l: "Add a savings goal", d: "A purchase, holiday or deposit.", click: '[data-action="b-goals"]' }] },
  networth: { icon: "💎", title: "Set up your net worth", empty: () => none("Holdings") && none("Loans"),
    text: "Net worth is your assets minus your liabilities. Add your savings and loans to begin tracking.",
    acts: [{ i: "🏦", l: "Add savings", d: "Your assets.", go: "portfolio" }, { i: "💳", l: "Add loans", d: "Your liabilities.", go: "loans" }] },
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
  const p = popup(`<div class="nw-hd"><span class="nw-hi">${h.icon}</span><h2>${esc(T(h.title))}</h2><button class="nw-x" data-close aria-label="Close">✕</button></div>
    <div class="ph-body"><p class="ph-text">${esc(T(h.text))}</p>
      <div class="ph-acts">${h.acts.map((a, i) => `<button class="ph-act" data-i="${i}"><span class="ph-i">${a.i}</span><span class="ph-t"><b>${esc(T(a.l))}</b><small>${esc(T(a.d))}</small></span><em>→</em></button>`).join("")}</div></div>
    <div class="g2-foot"><label class="check"><input type="checkbox" name="hide"${has(hidden(), route) ? " checked" : ""}><span>${esc(T("Don't show this again on this page"))}</span></label>
      <div class="buttons"><button class="btn second" data-close>${esc(T("Later"))}</button></div></div>`, { width: 560, cls: "ph-popup nw-win" });
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
