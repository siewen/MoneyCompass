// The built-in advisors that need only the data every profile has. Other modules register theirs the same way
// (Tax Advisor, Investment Advisor, …): registerAdvisor({ id, module, advise(snapshot) → [state] }).
import { T, pln } from "../core.js";
import { registerAdvisor } from "./registry.js";

const pc = v => Math.round(v * 100) + "%";
const dec = v => (Math.round(v * 10) / 10).toString().replace(".", ",");

/** Financial Advisor: the monthly balance. */
function financial(s) {
  if (!s.has) return [];
  const out = [];
  if (s.neg) {
    const yr = -s.left * 12;
    out.push({ id: "overspending", advisorType: "financial", kind: "problem", severity: s.emF < 0.25 ? 5 : 4,
      title: T("Overspending"), text: T("You spend {0} more than you earn each month.", pln(-s.left)),
      annualImpact: yr, potential: yr, pot: "cash", confidence: s.confidence, risk: "low", difficulty: "hard", minutes: 120,
      doNothing: s.runway ? T("In 12 months you will have spent {0} more than you earned. At this pace your savings last about {1} months.", pln(yr), dec(s.runway)) : T("In 12 months you will have spent {0} more than you earned, which means new debt.", pln(yr)),
      actions: [{ icon: "✂️", title: T("Cut spending by {0} a month", pln(-s.left)), desc: T("Look at your biggest categories first."), btn: T("Open Outflows"), go: "expenses" }] });
  } else if (s.both && s.svRate < 0.2) {
    const more = Math.max(0, s.income * 0.2 - Math.max(0, s.left)) * 12, tiny = s.svRate < 0.05;
    out.push({ id: "low-savings", advisorType: "financial", kind: tiny ? "problem" : "opportunity", severity: tiny ? 3 : 2,
      title: T("High Savings Potential"), text: T("You keep only {0} of your income. Saving 20% would put {1} more aside each year.", pc(Math.max(0, s.svRate)), pln(more)),
      annualImpact: more, potential: more, pot: "cash", confidence: s.confidence * 0.9, risk: "low", difficulty: "medium", minutes: 30,
      doNothing: T("At this pace you add only {0} to your savings in 12 months.", pln(Math.max(0, s.left) * 12)),
      actions: [{ icon: "🎯", title: tiny ? T("Save at least 10% first") : T("Save 20% of your income"), desc: T("Move money to savings on payday, before you spend."), btn: T("Open Outflows"), go: "expenses" }] });
  } else if (s.both && s.fullEF && s.dti <= 0.2) {
    out.push({ id: "healthy", advisorType: "financial", kind: "positive", severity: 1,
      title: T("Healthy"), text: T("You keep {0} of your income, your emergency fund is complete and your debt is low.", pc(s.svRate)), confidence: s.confidence,
      actions: [{ icon: "🔍", title: T("Compare offers"), desc: T("Make sure your money earns the best safe rate."), btn: T("Compare Offers"), go: "portfolio" }] });
  }
  return out;
}

/** Financial Safety Advisor: the emergency fund. */
function safety(s) {
  if (!s.has || s.fullEF) return [];
  const none = s.target <= 0 || s.safe <= 0, cost = s.essential || 0;
  const btn = { icon: "🛡️", title: T("Build your emergency fund"), desc: s.target > 0 ? T("Still missing {0}.", pln(Math.max(0, s.target - s.safe))) : T("Aim for 3 to 6 months of essential costs."), btn: T("Open Emergency Fund"), go: "emergency" };
  const dn = cost > 0 ? T("An unexpected bill or a lost month of income ({0}) would go straight onto a loan or a card.", pln(cost)) : T("An unexpected bill or a lost job would go straight onto a loan or a card.");
  if (none) return [{ id: "missing-ef", advisorType: "safety", kind: "problem", severity: 4, title: T("Missing Emergency Fund"),
    text: s.target > 0 ? T("Your emergency fund is only {0} complete.", pc(Math.min(1, s.emF || 0))) : T("You have no emergency fund yet."), confidence: s.confidence, difficulty: "hard", minutes: 60, doNothing: dn, actions: [btn] }];
  const low = s.emF < 0.5;
  return [{ id: low ? "low-ef" : "partial-ef", advisorType: "safety", kind: low ? "problem" : "risk", severity: s.emF < 0.25 ? 4 : low ? 3 : 2,
    title: low ? T("Low Emergency Fund") : T("Emergency Fund Incomplete"),
    text: T("Your emergency fund covers only {0} months of essential costs.", dec(s.covered || 0)), confidence: s.confidence, minutes: 30, doNothing: dn, actions: [btn] }];
}

/** Debt Advisor: loan payments and expensive debt. */
function debt(s) {
  if (!s.has || !s.loans.length) return [];
  const out = [], d = s.dear;
  const dearBtn = d ? [{ icon: "💳", title: T("Reduce your most expensive debt"), desc: T("{0} at {1}% is the first to pay down.", d.name || T("Your loan"), dec(d.rate)), btn: T("Open Loans"), go: "loans" }] : [];
  if (s.dti > 0.35) out.push({ id: "debt-risk", advisorType: "debt", kind: "problem", severity: s.dti > 0.5 ? 5 : 4, title: T("Debt Risk"),
    text: T("Loan payments take {0} of your income.", pc(s.dti)), annualImpact: s.interestYear, confidence: s.confidence, difficulty: "hard", minutes: 90,
    doNothing: T("You pay about {0} in interest every year, and a drop in income would make the payments hard to carry.", pln(s.interestYear)), actions: dearBtn });
  else if (s.dti > 0.2) out.push({ id: "debt-load", advisorType: "debt", kind: "risk", severity: 2, title: T("High Loan Payments"),
    text: T("Loan payments are {0} of your income.", pc(s.dti)), confidence: s.confidence, doNothing: T("High loan payments leave little room if your income drops."), actions: dearBtn });
  if (d && d.rate >= 10 && d.rem > 0) {
    const yr = d.rem * d.rate / 100;
    const gain = s.surplus > 0 ? Math.min(d.rem, s.surplus) * d.rate / 100 : Math.max(0, s.left) * 12 * d.rate / 100 / 2;   // with spare money now, or with extra payments over the year
    out.push({ id: "expensive-debt", advisorType: "debt", kind: "opportunity", severity: 3, title: T("Expensive Debt"),
      text: T("{0} costs you {1}% interest.", d.name || T("A loan"), dec(d.rate)), annualImpact: yr, potential: gain, pot: "surplus", confidence: s.confidence * 0.8, minutes: 30,
      doNothing: T("{0} keeps costing you up to {1} in interest every year.", d.name || T("It"), pln(yr)), actions: dearBtn });
  }
  return out;
}

/** Savings Advisor: where the savings sit. */
function savings(s) {
  const out = [];
  if (s.gain > 0 && s.mv) out.push({ id: "better-deposit", advisorType: "savings", kind: "opportunity", severity: 2, title: T("Better Deposit Available"),
    text: T("Move {0} to {1}: about {2} more per year.", pln(s.mv.moved || 0), s.mv.bank, pln(s.gain)), annualImpact: s.gain, potential: s.gain, pot: "surplus", confidence: 0.8, difficulty: "easy", minutes: 20,
    doNothing: T("You keep earning {0} less per year than you could.", pln(s.gain)),
    actions: [{ icon: "📈", title: T("Earn {0} more per year", pln(s.gain)), desc: T("Move savings to {0}.", s.mv.bank), btn: T("View Opportunity"), go: "@optimize" }] });
  if (s.has && s.total <= 0) out.push({ id: "no-savings", advisorType: "savings", kind: "problem", severity: 2, title: T("No Savings Yet"), text: T("Add your savings so MoneyCompass can find better offers."), confidence: s.confidence,
    actions: [{ icon: "🏦", title: T("Add your savings"), desc: T("So MoneyCompass can find better offers."), btn: T("Open Savings"), go: "portfolio" }] });
  return out;
}

let done = false;
/** Registers the built-in advisors once. */
export function registerCoreAdvisors() {
  if (done) return; done = true;
  registerAdvisor({ id: "financial", advise: financial });
  registerAdvisor({ id: "safety", advise: safety });
  registerAdvisor({ id: "debt", advise: debt });
  registerAdvisor({ id: "savings", advise: savings });
}
