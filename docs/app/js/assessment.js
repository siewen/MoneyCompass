// The Financial Assessment of the Overview: turns the numbers into a status, a short explanation and the next steps.
// Pure functions (no page access), so the rules are easy to read and to test.
import { T, pln } from "./core.js";
import { esc } from "./ui.js";
import { ring, si, IC } from "./page-head.js";

/** The six financial states (plus "start" when there is no data yet): colour, icon and name. */
export const STATES = {
  healthy:     { name: "Healthy",                  color: "#10B981", icon: "🟢" },
  stable:      { name: "Stable",                   color: "#14B8A6", icon: "🟦" },
  warning:     { name: "Warning",                  color: "#F59E0B", icon: "🟡" },
  critical:    { name: "Critical",                 color: "#EF4444", icon: "🔴" },
  debt:        { name: "Debt Risk",                color: "#F97316", icon: "🟠" },
  opportunity: { name: "Optimization Opportunity", color: "#22D3EE", icon: "💡" },
  start:       { name: "Getting started",          color: "#94A3B8", icon: "🌱" },
};
const pc = v => Math.round(v * 100) + "%";

/** c: { has, income, spending, left, both, svRate, emF, target, safe, total, covered, debt, loans:[{name, rate, pay, rem}], wealth, mv:{gain, bank, moved} } */
export function assess(c) {
  const dti = c.income > 0 ? c.loans.reduce((a, l) => a + (l.pay || 0), 0) / c.income : 0;     // loan payments / income
  const dear = [...c.loans].sort((a, b) => b.rate - a.rate)[0];                                  // most expensive loan
  const neg = c.both && c.left < 0, lowEF = c.target > 0 ? c.emF < 0.5 : c.safe <= 0, fullEF = c.target > 0 && c.emF >= 1;
  const gain = c.mv && c.mv.gain > 0 ? c.mv.gain : 0;
  let state;
  if (!c.has) state = "start";
  else if (dti > 0.35 || (c.debt > 0 && neg)) state = "debt";
  else if ((neg && c.emF < 0.25) || c.wealth < 30) state = "critical";
  else if (neg || (c.both && c.svRate < 0.05) || lowEF || c.wealth < 55) state = "warning";
  else if (c.wealth < 75 || !fullEF || (c.both && c.svRate < 0.2)) state = "stable";
  else state = gain > 0 ? "opportunity" : "healthy";

  // ---- the explanation ----
  const rate = c.both ? pc(Math.max(0, c.svRate)) : "–", ef = pc(Math.min(1, c.emF || 0)), why = [];
  if (neg) why.push(T("you spend {0} more than you earn each month", pln(-c.left)));
  if (dti > 0.35) why.push(T("loan payments take {0} of your income", pc(dti)));
  if (lowEF) why.push(c.target > 0 ? T("your emergency fund is only {0} complete", ef) : T("you have no emergency fund yet"));
  if (c.both && !neg && c.svRate < 0.05) why.push(T("you keep only {0} of your income", rate));
  let text;
  switch (state) {
    case "start": text = T("Add your income and your spending (or import a bank statement) and MoneyCompass will tell you how you are doing, what your biggest problem is and what to do next."); break;
    case "debt": text = T("Debt is the most urgent topic: {0}. Bring the monthly payments down before you take on anything new.", why.join("; ")); break;
    case "critical": text = T("Your finances are in a critical state: {0}. Stabilise the monthly balance first, everything else comes after.", why.join("; ")); break;
    case "warning": text = T("Your finances need attention: {0}. A few focused steps will bring you back on track.", why.length ? why.join("; ") : T("your wealth score is {0} out of 100", c.wealth)); break;
    case "stable": text = T("You stand on a steady footing: you keep {0} of your income and your emergency fund is {1} complete. A few steps will make it strong.", rate, ef); break;
    case "opportunity": text = T("Your finances are healthy and your money could work harder: a better place for your savings could earn about {0} more per year.", pln(gain)); break;
    default: text = T("Your finances are in good shape: you keep {0} of your income, your emergency fund is complete and your debt is low.", rate);
  }

  // ---- biggest problem / gain / risk ----
  let problem;
  if (!c.has) problem = T("Not enough data yet to find a problem.");
  else if (neg) problem = T("You spend {0} more than you earn.", pln(-c.left));
  else if (dti > 0.35) problem = T("Loan payments are {0} of your income.", pc(dti));
  else if (lowEF) problem = c.target > 0 ? (Math.round(c.covered * 10) / 10 === 1 ? T("Your emergency fund covers only 1 month of essential costs.") : T("Your emergency fund covers only {0} months of essential costs.", (Math.round(c.covered * 10) / 10).toString().replace(".", ","))) : T("You have no emergency fund.");
  else if (c.both && c.svRate < 0.1) problem = T("You keep only {0} of your income.", rate);
  else if (dear && dear.rate >= 10) problem = T("{0} costs you {1}% interest.", dear.name || T("A loan"), (Math.round(dear.rate * 10) / 10).toString().replace(".", ","));
  else problem = T("No urgent problem. Keep your habits and review your numbers every month.");
  let win;
  if (gain > 0) win = T("Move {0} to {1}: about {2} more per year.", pln(c.mv.moved || 0), c.mv.bank, pln(gain));
  else if (dear && dear.rem > 0 && dear.rate > 0) win = T("Paying off {0} would save up to {1} interest per year.", dear.name || T("your loan"), pln(dear.rem * dear.rate / 100));
  else if (neg) win = T("Bringing spending back to your income would stop the loss of {0} a month.", pln(-c.left));
  else if (c.both && c.svRate < 0.2 && c.income > 0) win = T("Saving 20% of your income would put {0} more aside each month.", pln(Math.max(0, c.income * 0.2 - Math.max(0, c.left))));
  else win = T("Nothing to improve right now. Keep saving.");
  let risk;
  if (!c.has) risk = T("Without numbers, risks stay invisible.");
  else if (neg) risk = T("Your savings shrink every month while spending is above income.");
  else if (dti > 0.2) risk = T("High loan payments leave little room if your income drops.");
  else if (!fullEF) risk = T("An unexpected bill or a lost job would go straight onto a loan or card.");
  else risk = T("No major risk visible. Keep the emergency fund full.");

  // ---- next actions (most urgent first, at most three) ----
  const act = [];
  const add = (icon, title, desc, btn, go) => { if (!act.some(x => x.title === title)) act.push({ icon, title, desc, btn, go }); };
  if (!c.has) { add("💶", T("Add your income"), T("Your salary and other income."), T("Open Inflows"), "income"); add("🛒", T("Add your spending"), T("Enter or import your expenses."), T("Open Outflows"), "expenses"); add("🏦", T("Add your savings"), T("Bank accounts and cash, with their interest."), T("Open Savings"), "portfolio"); }
  else {
    if (neg) add("✂️", T("Cut spending by {0} a month", pln(-c.left)), T("Look at your biggest categories first."), T("Open Outflows"), "expenses");
    if (dti > 0.3 || (dear && dear.rate >= 10)) add("💳", T("Reduce your most expensive debt"), dear ? T("{0} at {1}% is the first to pay down.", dear.name || T("Your loan"), (Math.round(dear.rate * 10) / 10).toString().replace(".", ",")) : "", T("Open Loans"), "loans");
    if (!fullEF) add("🛡️", T("Build your emergency fund"), c.target > 0 ? T("Still missing {0}.", pln(Math.max(0, c.target - c.safe))) : T("Aim for 3 to 6 months of essential costs."), T("Open Emergency Fund"), "emergency");
    if (c.both && !neg && c.svRate < 0.1) add("🎯", T("Save at least 10% first"), T("Move money to savings on payday, before you spend."), T("Open Outflows"), "expenses");
    if (gain > 0) add("📈", T("Earn {0} more per year", pln(gain)), T("Move savings to {0}.", c.mv.bank), T("View Opportunity"), "@optimize");
    if (c.total <= 0) add("🏦", T("Add your savings"), T("So MoneyCompass can find better offers."), T("Open Savings"), "portfolio");
    if (state === "healthy" || state === "stable") add("🔍", T("Compare offers"), T("Make sure your money earns the best safe rate."), T("Compare Offers"), "portfolio");
  }
  return { state, text, problem, win, risk, actions: act.slice(0, 3), dti };
}

/** The two bands for the top of the Overview: assessment + wealth score, then next actions. */
export function assessmentHtml(a, wealth, wl) {
  const S = STATES[a.state];
  const box = (ic, label, txt, cls) => `<div class="oa-box oa-b-${cls}"><span class="oa-bi">${ic}</span><div><small>${esc(label)}</small><p>${esc(txt)}</p></div></div>`;
  const act = a.actions.map((x, i) => `<div class="oa-act"><span class="oa-n">${i + 1}</span><span class="oa-ai">${x.icon}</span><div><b>${esc(x.title)}</b><p>${esc(x.desc)}</p></div>${x.go.startsWith("@") ? `<button class="sv-btn" data-action="${x.go.slice(1)}">${esc(x.btn)} →</button>` : `<button class="sv-btn" data-go="${x.go}">${esc(x.btn)} →</button>`}</div>`).join("");
  return `<section class="ov-assess" style="--st:${S.color}">
    <div class="nw-card oa-main"><div class="oa-top"><span class="oa-badge">${S.icon} ${esc(T(S.name))}</span><h3>${esc(T("Financial Assessment"))}</h3></div>
      <p class="oa-text">${esc(a.text)}</p>
      <div class="oa-boxes">${box("⚠️", T("Biggest problem"), a.problem, "bad")}${box("📈", T("Biggest gain"), a.win, "good")}${box("🛡️", T("Main risk"), a.risk, "warn")}</div>
      <small class="oa-note">${esc(T("General information based on your own numbers. It is not personal financial advice."))}</small></div>
    <div class="nw-card oa-score" data-go="portfolio"><small>${esc(T("Wealth Score"))}</small>${a.state === "start" ? ring(0, "–", "/100", 132) : ring(wealth, String(wealth), "/100", 132)}<b>${esc(a.state === "start" ? T("Add your data") : wl)}</b></div>
    <div class="nw-card oa-next"><div class="oa-top"><h3>${esc(T("Next Actions"))}</h3><small>${esc(T("In this order"))}</small></div>${act || `<p class="hint">${esc(T("No action needed right now."))}</p>`}</div>
  </section>`;
}
