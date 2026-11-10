// A short "what to do here" window for pages that are still empty. The person can hide it for a page or for all pages,
// and bring it back in Settings (General and Reset).
import { T, State, save } from "./core.js";
import { esc, popup, toast } from "./ui.js";
import { App } from "./app.js";

const none = k => !((State.data[k] || []).length);
const has = (a, b) => a.some(x => x === b);

/** act: {i icon, l label, d description, go page to open first, click / focus: element to use once the page is open, fn: own action} */
const HINTS = {
  overview: { icon: "🧭", title: "Let's set up your Overview", empty: () => none("Incomes") && none("Expenses"),
    text: "MoneyCompass needs two things to show you the full picture: what you earn and what you spend. Pick the quickest way:",
    acts: [{ i: "💶", l: "Add your income", d: "Your salary and other income.", go: "income", focus: '[name="qname"]' },
      { i: "🛒", l: "Add your spending", d: "Enter what you spend.", go: "expenses", click: '[data-action="ex-add"]' },
      { i: "⬆", l: "Import a bank statement", d: "MoneyCompass reads the file and sorts it for you.", fn: "import" },
      { i: "🧪", l: "Look at the demo first", d: "Made-up numbers – your own data is not touched.", fn: "demo" }] },
  income: { icon: "💶", title: "Add your income", empty: () => none("Incomes") && none("Received"),
    text: "Your salary and other income. Add it by hand, or import a bank statement and MoneyCompass finds it for you.",
    acts: [{ i: "💶", l: "Add an income source", d: "Name, amount and how often you get it.", focus: '[name="qname"]' },
      { i: "⬆", l: "Import a bank statement", d: "Salary payments are found automatically.", fn: "import" }] },
  expenses: { icon: "🛒", title: "Add your spending", empty: () => none("Expenses"),
    text: "Enter what you spend, or import a bank statement – MoneyCompass sorts it into categories.",
    acts: [{ i: "＋", l: "Add an expense", d: "One purchase or bill.", click: '[data-action="ex-add"]' },
      { i: "⬆", l: "Import a bank statement", d: "All your outflows at once.", fn: "import" }] },
  emergency: { icon: "🛡️", title: "Build your safety net", empty: () => none("Expenses") && none("Holdings"),
    text: "To show how long your money would last, MoneyCompass needs your monthly spending and your savings.",
    acts: [{ i: "🛒", l: "Add your spending", d: "Gives the monthly cost of living.", go: "expenses", click: '[data-action="ex-add"]' },
      { i: "🏦", l: "Add your savings", d: "What you could use in an emergency.", go: "portfolio" }] },
  portfolio: { icon: "🏦", title: "Add your savings", empty: () => none("Holdings"),
    text: "List your savings accounts to see what they really earn – and where you could earn more.",
    acts: [{ i: "🏦", l: "Add a savings account", d: "Bank, balance and interest rate.", click: "[data-sv-add]" },
      { i: "⬆", l: "Import a savings statement", d: "Balance and interest are read from the file.", fn: "importSavings" }] },
  loans: { icon: "💳", title: "Add your loans", empty: () => none("Loans"),
    text: "Add a loan or card debt to see when you are debt-free and whether paying extra is worth it.",
    acts: [{ i: "💳", l: "Add a loan", d: "Balance, rate and monthly payment.", click: '[data-action="l-new"]' }] },
  budget: { icon: "🎯", title: "Plan your budget", empty: () => none("Budgets") && none("Goals"),
    text: "Set a monthly limit for a category, or a savings goal – MoneyCompass keeps track for you.",
    acts: [{ i: "📊", l: "Set a monthly limit", d: "For food, transport or anything else.", click: '[data-action="b-new"]' },
      { i: "🎯", l: "Add a savings goal", d: "A car, a holiday, a flat.", click: '[data-action="b-goals"]' }] },
  networth: { icon: "💎", title: "Track your net worth", empty: () => none("Holdings") && none("Loans"),
    text: "Net worth is what you own minus what you owe. Add your savings and loans to start.",
    acts: [{ i: "🏦", l: "Add your savings", d: "What you own.", go: "portfolio" }, { i: "💳", l: "Add your loans", d: "What you owe.", go: "loans" }] },
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
    <div class="g2-foot"><label class="check"><input type="checkbox" name="hide"${has(hidden(), route) ? " checked" : ""}><span>${esc(T("Don't show this tip on this page again"))}</span></label>
      <div class="buttons"><button class="btn second" data-close>${esc(T("Not now"))}</button></div></div>`, { width: 560, cls: "ph-popup nw-win" });
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
export function resetHints() { const s = State.data.Settings; s.HintsHidden = []; s.HintsOff = false; shown = ""; save(); toast(T("Page tips are back.")); }
