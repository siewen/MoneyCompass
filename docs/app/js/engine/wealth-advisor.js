// Wealth Advisor: growth or shrinking of net worth, asset concentration, milestones, retirement readiness, long-term opportunity.
import { T, pln } from "../core.js";
import { wealthFacts, MILESTONES, fv } from "./wealth-math.js";

const pc = v => Math.round(v * 100) + "%";
const goNW = (title, desc) => [{ icon: "💎", title, desc, btn: T("Open Net Worth"), go: "networth" }];

export function wealthAdvise(s) {
  if (!s.has || !s.nw) return [];
  const n = s.nw, w = wealthFacts(s), out = [], conf = Math.min(0.9, 0.3 + n.history.length * 0.12);
  // Growth or shrinking, from the recorded history (one point per month)
  if (n.history.length >= 3 && n.change !== 0) {
    const yr = Math.abs(n.monthly) * 12;
    if (n.change > 0 && n.pct !== null && n.pct >= 0.1) out.push({ id: "strong-growth", advisorType: "wealth", kind: "positive", severity: 1, title: T("Strong Growth"),
      text: T("Your net worth grew by {0} ({1}) in {2} months.", pln(n.change), pc(n.pct), n.span), annualImpact: yr, confidence: conf, actions: goNW(T("See your wealth trend"), T("History, projections and milestones.")) });
    else if (n.change < 0 && (n.pct === null || n.pct <= -0.03)) out.push({ id: "shrinking-wealth", advisorType: "wealth", kind: "problem", severity: n.pct !== null && n.pct <= -0.1 ? 4 : 3, title: T("Shrinking Wealth"),
      text: T("Your net worth fell by {0} in {1} months.", pln(-n.change), n.span), annualImpact: yr, confidence: conf, difficulty: "hard", minutes: 120,
      doNothing: T("At this pace your net worth will be {0} in 12 months.", pln(n.net + n.monthly * 12)),
      actions: [{ icon: "✂️", title: T("Stop the loss"), desc: T("Find what pulls your wealth down."), btn: T("Open Outflows"), go: "expenses" }, ...goNW(T("See your wealth trend"), "")] });
  }
  // Retirement readiness
  const p = s.plan || {};
  if (!(p.age > 0)) out.push({ id: "retirement-setup", advisorType: "wealth", kind: "opportunity", severity: 1, title: T("Set Up Your Retirement Plan"),
    text: T("Add your age and MoneyCompass shows how ready you are for retirement and what to change."), confidence: 0.9, difficulty: "easy", minutes: 5, actions: goNW(T("Add your age"), T("Takes a minute."), ) });
  else if (w.readiness !== null && w.readiness < 1) out.push({ id: "retirement-risk", advisorType: "wealth", kind: "problem", severity: w.readiness < 0.5 ? 3 : 2, title: T("Retirement Risk"),
    text: T("At this pace you will have about {0} at {1}: {2} of the {3} you need.", pln(w.projected), p.retireAge, pc(w.readiness), pln(w.fiNumber)),
    annualImpact: w.gapMonthly * 12, confidence: 0.5, difficulty: "medium", minutes: 30,
    doNothing: T("You would cover only {0} of your spending in retirement. Saving {1} more per month closes the gap.", pc(w.readiness), pln(w.gapMonthly)),
    actions: goNW(T("Close the retirement gap"), T("Needs {0} more per month.", pln(w.gapMonthly))) });
  else if (w.readiness !== null) out.push({ id: "retirement-ok", advisorType: "wealth", kind: "positive", severity: 1, title: T("Retirement On Track"),
    text: T("At this pace you reach {0} at {1}, enough for your planned spending.", pln(w.projected), p.retireAge), confidence: 0.5, actions: goNW(T("See the projection"), "") });
  // Concentration: one place holds most of the assets
  const parts = [...(s.accounts || []).map(a => ({ name: a.name, v: a.amount })), ...(s.invest && s.invest.total > 0 ? [{ name: T("Investments"), v: s.invest.total }] : [])];
  const tot = parts.reduce((a, x) => a + x.v, 0), top = [...parts].sort((a, b) => b.v - a.v)[0];
  if (parts.length >= 2 && tot >= 20000 && top.v / tot > 0.7) out.push({ id: "asset-concentration", advisorType: "wealth", kind: "risk", severity: 2, title: T("Asset Concentration"),
    text: T("{0} holds {1} of your assets.", top.name, pc(top.v / tot)), confidence: 0.7, difficulty: "medium", minutes: 60,
    doNothing: T("One problem with that place hits most of your wealth at once."), actions: goNW(T("See your asset mix"), "") });
  // Milestones
  const next = MILESTONES.find(m => m > n.net), reached = [...MILESTONES].reverse().find(m => m <= n.net);
  if (next) {
    const eta = n.monthly > 0 ? Math.ceil((next - n.net) / n.monthly) : null;
    out.push({ id: "wealth-milestone", advisorType: "wealth", kind: "positive", severity: 1, title: T("Wealth Milestone"),
      text: (reached ? T("You passed {0}. ", pln(reached)) : "") + (eta ? T("Next milestone: {0}, in about {1} months at your current pace.", pln(next), eta) : T("Next milestone: {0}.", pln(next))),
      confidence: eta ? conf : 0.9, actions: goNW(T("See your milestones"), "") });
  }
  // Long-term opportunity: money above the emergency fund could grow, if the user accepts some risk
  if (s.fullEF && s.surplus > 5000 && p.ret > 0) {
    const rs = (s.accounts || []).filter(a => a.safe).reduce((a, x) => a + x.amount * x.rate, 0) / Math.max(1, (s.accounts || []).filter(a => a.safe).reduce((a, x) => a + x.amount, 0)) * 0.81;
    const diff = fv(s.surplus, 0, p.ret, 10) - fv(s.surplus, 0, rs, 10);
    if (diff > 0) out.push({ id: "long-term-opportunity", advisorType: "wealth", kind: "opportunity", severity: 1, title: T("Long-Term Opportunity"),
      text: T("If the {0} above your emergency fund earned {1}% a year (your assumption) instead of {2}%, it could be {3} more after 10 years. Investments can lose value.", pln(s.surplus), String(p.ret).replace(".", ","), (Math.round(rs * 10) / 10).toString().replace(".", ","), pln(diff)),
      annualImpact: diff / 10, potential: 0, confidence: 0.4, risk: "medium", difficulty: "medium", minutes: 60, doNothing: T("The money keeps earning only the savings rate."),
      actions: [{ icon: "📈", title: T("Look at long-term options"), desc: T("Only money you will not need for years."), btn: T("Open Investments"), go: "investments" }] });
  }
  return out;
}
