// The built-in advisors that need only the data every profile has. Other modules register theirs the same way
// (Tax Advisor, Investment Advisor, …): registerAdvisor({ id, module, advise(snapshot) → [state] }).
import { T, pln } from "../core.js";
import { registerAdvisor } from "./registry.js";

const pc = v => Math.round(v * 100) + "%";
const S = (s, ...k) => k.map(x => s.src && s.src[x]).filter(Boolean);   // sources of a state
const dec = v => (Math.round(v * 10) / 10).toString().replace(".", ",");

/** Financial Advisor: the monthly balance. */
function financial(s) {
  if (!s.has) return [];
  const out = [];
  if (s.neg) {
    const yr = -s.left * 12;
    out.push({ id: "overspending", sources: S(s, "own"), advisorType: "financial", kind: "problem", severity: s.emF < 0.25 ? 5 : 4,
      title: T("Overspending"), text: T("You spend {0} more than you earn each month.", pln(-s.left)),
      annualImpact: yr, potential: 0, pot: "cash", confidence: s.confidence, risk: "low", difficulty: "hard", minutes: 120,
      doNothing: s.runway ? T("In 12 months you will have spent {0} more than you earned. At this pace your savings last about {1} months.", pln(yr), dec(s.runway)) : T("In 12 months you will have spent {0} more than you earned, which means new debt.", pln(yr)),
      actions: [{ icon: "✂️", title: T("Cut spending by {0} a month", pln(-s.left)), desc: T("Look at your biggest categories first."), btn: T("Open Outflows"), go: "expenses" }] });
  } else if (s.both && s.svRate < 0.2) {
    const more = Math.max(0, s.income * 0.2 - Math.max(0, s.left)) * 12, tiny = s.svRate < 0.05;
    out.push({ id: "low-savings", sources: S(s, "own"), advisorType: "financial", kind: tiny ? "problem" : "opportunity", severity: tiny ? 3 : 2,
      title: T("High Savings Potential"), text: T("You keep only {0} of your income. Saving 20% would put {1} more aside each year.", pc(Math.max(0, s.svRate)), pln(more)),
      annualImpact: more, potential: 0, pot: "cash", confidence: s.confidence * 0.9, risk: "low", difficulty: "medium", minutes: 30,
      doNothing: T("At this pace you add only {0} to your savings in 12 months.", pln(Math.max(0, s.left) * 12)),
      actions: [{ icon: "🎯", title: tiny ? T("Save at least 10% first") : T("Save 20% of your income"), desc: T("Move money to savings on payday, before you spend."), btn: T("Open Outflows"), go: "expenses" }] });
  } else if (s.both && s.fullEF && s.dti <= 0.2) {
    out.push({ id: "healthy", sources: S(s, "own"), advisorType: "financial", kind: "positive", severity: 1,
      title: T("Healthy"), text: T("You keep {0} of your income, your emergency fund is complete and your debt is low.", pc(s.svRate)), confidence: s.confidence,
      actions: [{ icon: "🔍", title: T("Compare offers"), desc: T("Make sure your money earns the best safe rate."), btn: T("Compare Offers"), go: "portfolio" }] });
  }
  return out;
}

/** Financial Safety Advisor: the emergency fund. */
function safety(s) {
  if (!s.has) return [];
  const extra = [];
  if (s.target > 0 && s.efMonths > 0 && s.efMonths < 3) extra.push({ id: "ef-target-low", sources: S(s, "own"), advisorType: "safety", kind: "risk", severity: 2, title: T("Emergency Target Too Low"),
    text: T("Your target is only {0} months of essential costs. Most advisors suggest 3 to 6 months.", s.efMonths), confidence: 0.8, difficulty: "easy", minutes: 5,
    doNothing: T("A job loss of a few months could use up the fund too early."), actions: [{ icon: "🛡️", title: T("Raise the target to 3 months"), desc: T("Set it in the Emergency Fund tab."), btn: T("Open Emergency Fund"), go: "emergency" }] });
  if (s.fullEF && s.surplus > s.target * 0.5 && s.surplus > 5000) extra.push({ id: "ef-surplus", sources: S(s, "own"), advisorType: "safety", kind: "opportunity", severity: 1, title: T("Money Above the Emergency Fund"),
    text: T("You hold {0} more than your emergency target. Money you will not need soon can work harder.", pln(s.surplus)), confidence: s.confidence, difficulty: "easy", minutes: 20,
    doNothing: T("Idle money loses value over time."), actions: [{ icon: "🔍", title: T("Compare offers"), desc: T("Find the best safe rate for it."), btn: T("Compare Offers"), go: "portfolio" }] });
  if (!s.fullEF && s.target > 0 && s.left > 0) {
    const gap = Math.max(0, s.target - s.safe), m = gap / s.left, m2 = gap / (s.left * 1.5);
    extra.push({ id: "ef-plan", sources: S(s, "own"), advisorType: "safety", kind: "opportunity", severity: 1, title: T("Emergency Fund Plan"),
      text: T("Saving {0} a month, your fund is complete in about {1} months. With 50% more, in about {2}.", pln(s.left), Math.ceil(m), Math.ceil(m2)), confidence: s.confidence * 0.9, difficulty: "medium", minutes: 15,
      doNothing: T("You stay exposed for about {0} months.", Math.ceil(m)), actions: [{ icon: "🛡️", title: T("Build your emergency fund"), desc: T("Still missing {0}.", pln(gap)), btn: T("Open Emergency Fund"), go: "emergency" }] });
  }
  if (s.fullEF) return extra;
  const none = s.target <= 0 || s.safe <= 0, cost = s.essential || 0;
  const btn = { icon: "🛡️", title: T("Build your emergency fund"), desc: s.target > 0 ? T("Still missing {0}.", pln(Math.max(0, s.target - s.safe))) : T("Aim for 3 to 6 months of essential costs."), btn: T("Open Emergency Fund"), go: "emergency" };
  const dn = cost > 0 ? T("An unexpected bill or a lost month of income ({0}) would go straight onto a loan or a card.", pln(cost)) : T("An unexpected bill or a lost job would go straight onto a loan or a card.");
  if (none) return [{ id: "missing-ef", sources: S(s, "own"), advisorType: "safety", kind: "problem", severity: 4, title: T("Missing Emergency Fund"),
    text: s.target > 0 ? T("Your emergency fund is only {0} complete.", pc(Math.min(1, s.emF || 0))) : T("You have no emergency fund yet."), confidence: s.confidence, difficulty: "hard", minutes: 60, doNothing: dn, actions: [btn] }, ...extra];
  const low = s.emF < 0.5;
  return [{ id: low ? "low-ef" : "partial-ef", sources: S(s, "own"), advisorType: "safety", kind: low ? "problem" : "risk", severity: s.emF < 0.25 ? 4 : low ? 3 : 2,
    title: low ? T("Low Emergency Fund") : T("Emergency Fund Incomplete"),
    text: T("Your emergency fund covers only {0} months of essential costs.", dec(s.covered || 0)), confidence: s.confidence, minutes: 30, doNothing: dn, actions: [btn] }, ...extra];
}

/** Debt Advisor: loan payments and expensive debt. */
function debt(s) {
  if (!s.has || (!s.loans.length && !(s.loansX || []).length)) return [];
  const out = [], d = s.dear;
  const dearBtn = d ? [{ icon: "💳", title: T("Reduce your most expensive debt"), desc: T("{0} at {1}% is the first to pay down.", d.name || T("Your loan"), dec(d.rate)), btn: T("Open Loans"), go: "loans" }] : [];
  if (s.dti > 0.35) out.push({ id: "debt-risk", sources: S(s, "own"), advisorType: "debt", kind: "problem", severity: s.dti > 0.5 ? 5 : 4, title: T("Debt Risk"),
    text: T("Loan payments take {0} of your income.", pc(s.dti)), annualImpact: s.interestYear, confidence: s.confidence, difficulty: "hard", minutes: 90,
    doNothing: T("You pay about {0} in interest every year, and a drop in income would make the payments hard to carry.", pln(s.interestYear)), actions: dearBtn });
  else if (s.dti > 0.2) out.push({ id: "debt-load", sources: S(s, "own"), advisorType: "debt", kind: "risk", severity: 2, title: T("High Loan Payments"),
    text: T("Loan payments are {0} of your income.", pc(s.dti)), confidence: s.confidence, doNothing: T("High loan payments leave little room if your income drops."), actions: dearBtn });
  if (d && d.rate >= 10 && d.rem > 0) {
    const yr = d.rem * d.rate / 100;
    const gain = s.surplus > 0 ? Math.min(d.rem, s.surplus) * d.rate / 100 : Math.max(0, s.left) * 12 * d.rate / 100 / 2;   // with spare money now, or with extra payments over the year
    out.push({ id: "expensive-debt", sources: S(s, "own"), advisorType: "debt", kind: "opportunity", severity: 3, title: T("Expensive Debt"),
      text: T("{0} costs you {1}% interest.", d.name || T("A loan"), dec(d.rate)), annualImpact: yr, potential: gain, pot: ["surplus", "loan:" + (d.id || d.name)], confidence: s.confidence * 0.8, minutes: 30,
      doNothing: T("{0} keeps costing you up to {1} in interest every year.", d.name || T("It"), pln(yr)), actions: dearBtn });
  }
  for (const x of s.loansX || []) {
    const id = x.id || x.name;
    if (x.refi && x.refi.net > Math.max(1000, x.refi.costs) && x.months > 0) {
      const yr = x.refi.diff * 12;
      out.push({ id: "refinance-" + id, sources: S(s, "loanOffers", "own"), advisorType: "debt", kind: "opportunity", severity: 3, title: T("Refinance Opportunity"),
        text: T("{0}: with {1} at {2} you could pay about {3} less per month, {4} after switching costs.", x.name || T("Your loan"), x.refi.bank, dec(x.refi.rate) + "%", pln(x.refi.diff), pln(x.refi.net)),
        annualImpact: yr, potential: yr, pot: ["loan:" + id], confidence: s.confidence * 0.6, risk: "medium", difficulty: "hard", minutes: 240,   // your own offer depends on your credit history
        doNothing: T("You keep paying about {0} more per year than the best offer on the market.", pln(yr)),
        actions: [{ icon: "🔁", title: T("Compare loan offers"), desc: T("Your bank's real offer depends on your income and credit history."), btn: T("Open Loans"), go: "loans" }] });
    }
    if (x.extra && x.months > 12) {
      const yr = x.extra.saved / (x.months / 12);
      out.push({ id: "extra-payment-" + id, sources: S(s, "own"), advisorType: "debt", kind: "opportunity", severity: 2, title: T("Pay Off Faster"),
        text: T("{0}: paying {1} more each month saves about {2} interest and ends {3} months earlier.", x.name || T("Your loan"), pln(x.extra.more), pln(x.extra.saved), x.extra.monthsEarlier),
        annualImpact: yr, potential: yr, pot: ["cash", "loan:" + id], confidence: s.confidence * 0.9, difficulty: "medium", minutes: 15,
        doNothing: T("You keep paying interest for {0} months longer.", x.extra.monthsEarlier),
        actions: [{ icon: "💳", title: T("Pay {0} more each month", pln(x.extra.more)), desc: T("Ask your bank to apply it to the capital."), btn: T("Open Loans"), go: "loans" }] });
    }
  }
  if (s.debtFreeMonths > 0) {
    const m = s.debtFreeMonths, y = Math.floor(m / 12), r = m % 12;
    out.push({ id: "debt-free", sources: S(s, "own"), advisorType: "debt", kind: "positive", severity: 1, title: T("Debt-Free Date"),
      text: T("At the current payments you are debt-free in {0}.", (y ? (y === 1 ? T("1 year") : T("{0} years", y)) + " " : "") + (r || !y ? (r === 1 ? T("1 month") : T("{0} months", r)) : "")), confidence: s.confidence,
      actions: [{ icon: "💳", title: T("See your loans"), desc: T("Repayment plan of every loan."), btn: T("Open Loans"), go: "loans" }] });
  }
  return out;
}

/** Savings Advisor: where the savings sit. */
function savings(s) {
  const out = [];
  // One idea per account that could earn more. Different accounts add up; the biggest one also shares the "surplus" money with debt repayment.
  const mv = s.moves && s.moves.length ? s.moves : s.gain > 0 && s.mv ? [{ id: "", name: "", bank: s.mv.bank, moved: s.mv.moved, gain: s.gain }] : [];
  mv.forEach((m, k) => out.push({ id: "better-deposit" + (m.id ? "-" + m.id : ""), sources: S(s, "offers", "own"), advisorType: "savings", kind: "opportunity", severity: 2, title: T("Better Deposit Available"),
    text: T("Move {0} to {1}: about {2} more per year.", pln(m.moved || 0), m.bank, pln(m.gain)), annualImpact: m.gain, potential: m.gain, pot: k === 0 ? ["surplus", "move:" + m.id] : ["move:" + m.id], confidence: 0.8, difficulty: "easy", minutes: 20,
    doNothing: T("You keep earning {0} less per year than you could.", pln(m.gain)),
    actions: [{ icon: "📈", title: T("Earn {0} more per year", pln(m.gain)), desc: T("Move savings to {0}.", m.bank), btn: T("View Opportunity"), go: "@optimize" }] }));
  for (const a of s.accounts || []) {
    if (a.promo && a.promo.daysLeft <= 45 && a.promo.now > a.promo.after) {
      const loss = a.amount * (a.promo.now - a.promo.after) / 100 * 0.81;
      out.push({ id: "promo-ending-" + a.id, sources: S(s, "own"), advisorType: "savings", kind: "risk", severity: a.promo.daysLeft <= 14 ? 3 : 2, title: T("Promotion Ending"),
        text: T("{0} pays {1} for only {2} more days, then {3}.", a.name, dec(a.promo.now) + "%", a.promo.daysLeft, dec(a.promo.after) + "%"),
        annualImpact: loss, confidence: 0.9, minutes: 20,   // not added to the potential: the better-deposit idea already counts this money
        doNothing: T("From then on you earn about {0} less per year on this money.", pln(loss)),
        actions: [{ icon: "📈", title: T("Move it before the promotion ends"), desc: T("See where this money earns more."), btn: T("View Opportunity"), go: "@optimize" }] });
    }
    if (a.place === "Bank" && s.eurPln > 0 && a.amount > 100000 * s.eurPln) out.push({ id: "guarantee-" + a.id, sources: S(s, "guarantee", "fx", "own"), advisorType: "savings", kind: "risk", severity: 2, title: T("Above the Deposit Guarantee"),
      text: T("{0} holds {1}. The Polish deposit guarantee covers up to 100 000 EUR per person and bank.", a.name, pln(a.amount)), confidence: 0.6, difficulty: "easy", minutes: 30,
      doNothing: T("If that bank failed, the part above the guarantee could be lost."),
      actions: [{ icon: "🏦", title: T("Spread savings over more banks"), desc: T("Keep each bank below the guarantee limit."), btn: T("Open Savings"), go: "portfolio" }] });
  }
  if (s.has && s.total > 0 && s.total - (s.safe || 0) > s.total * 0.5 && !s.fullEF) out.push({ id: "risky-share", sources: S(s, "own"), advisorType: "savings", kind: "risk", severity: 3, title: T("Too Much in Risky Assets"),
    text: T("{0} of your money is not in safe savings, while your emergency fund is not complete.", pc((s.total - s.safe) / s.total)), confidence: s.confidence, difficulty: "medium", minutes: 30,
    doNothing: T("A fall in the markets could hit you just when you need cash."),
    actions: [{ icon: "🛡️", title: T("Fill the emergency fund first"), desc: T("Keep it in safe money."), btn: T("Open Emergency Fund"), go: "emergency" }] });
  if (s.has && s.total <= 0) out.push({ id: "no-savings", sources: S(s, "own"), advisorType: "savings", kind: "problem", severity: 2, title: T("No Savings Yet"), text: T("Add your savings so MoneyCompass can find better offers."), confidence: s.confidence,
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
