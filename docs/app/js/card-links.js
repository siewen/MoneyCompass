// Every card says what it is on mouse-over and, when clicked, opens the page where that topic is managed.
import { T } from "./core.js";
import { App } from "./app.js";

/** Card heading (English) → the page that holds the details. */
const GO = {
  // Inflows
  "Income Timeline": "calendar", "Income Insights": "reports", "Income Allocation": "budget",
  // Outflows
  "Monthly Spending Trend": "reports", "Expense Forecast": "calendar", "AI Spending Insights": "optcenter", "Category Analysis": "budget",
  "Upcoming Bills": "calendar", "Expense Health Score": "optcenter", "Recent Expenses": "expenses",
  // Emergency fund
  "Emergency Fund Forecast": "portfolio", "Contribution History": "portfolio", "Savings Capacity": "budget", "Risk Scenarios": "optcenter",
  "Emergency Fund Timeline": "calendar", "Financial Readiness Score": "networth",
  // Savings
  "My Saved Offers": "savings", "Offer Comparison Ranking": "portfolio", "AI Offer Insights": "optcenter", "Best Opportunity Summary": "optcenter", "Profit Projection": "optcenter",
  // Loans
  "Debt Payoff Forecast": "calendar", "Monthly Debt Payments": "budget", "Debt Breakdown": "networth", "Financial Strength Score": "networth",
  // Budget
  "Budget Forecast": "calendar", "AI Budget Insights": "optcenter", "Categories Near Limit": "expenses", "Budget Performance Projection": "reports",
  // Net worth
  "Net Worth History": "reports", "Milestones": "optcenter", "Financial Independence & Retirement": "investments", "Wealth Projection": "investments",
  // Net worth key figures and other cards without a heading (named by their small label)
  "Net worth": "reports", "Assets": "portfolio", "Liabilities": "loans", "Change": "reports", "Income vs Expenses": "income", "Expense Categories": "expenses",
  // Reports
  "Report Preview": "overview", "Report Insights": "optcenter", "Monthly Overview": "overview", "Financial Summary": "overview",
};
const FALLBACK = "optcenter";
const NOLINK = new Set(["Report Contents", "Period Selection", "Export Formats"]);   // these cards are controls, not shortcuts
const BLOCK = "input,select,textarea,form,details,summary";

export function linkCards(el, current) {
  const tabs = App.tabList ? App.tabList() : [];
  const ok = r => tabs.some(t => t.route === r), label = r => (tabs.find(t => t.route === r) || {}).title;
  // when a module is switched off, the nearest page that is on takes over
  const ALT = { calendar: "overview", investments: "networth", savings: "portfolio", reports: "overview" };
  el.querySelectorAll(".nw-card, .dz").forEach(c => {
    if (c.parentElement && c.parentElement.closest(".nw-card, .dz")) return;                                    // only the outer card
    if (c.closest("[data-go]") && c.closest("[data-go]") !== c) return;
    const h = c.querySelector("h2, h3, h4, .ei-msg b, small");
    const name = h ? h.textContent.trim().replace(/\s+/g, " ") : (c.classList.contains("ei-msg") ? c.textContent.trim().replace(/\s+/g, " ").slice(0, 60) : "");
    if (!name || NOLINK.has(name) || (!(name in GO) && c.querySelector(BLOCK))) return;
    let to = c.dataset.go || GO[name] || FALLBACK;
    if (!ok(to)) to = ALT[to] || FALLBACK;
    const dest = label(to);
    if (!dest || to === current) { if (!c.title) c.title = name; return; }
    if (!c.title) c.title = T("{0} – click to open {1}", name, dest);
    if (c.dataset.go || c.dataset.action || c.querySelector(BLOCK)) return;                                     // already clickable, or has fields
    c.dataset.go = to; c.dataset.auto = "1";
  });
}
