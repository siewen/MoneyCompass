// Tax Advisor (Taxes & Payroll module): turns the ideas of the Taxes page into states, from the saved plan.
import { T, pln } from "../core.js";
import { taxFacts } from "../taxes.js";

export function taxAdvise(s) {
  const f = taxFacts(), src = s && s.src ? [s.src.tax, s.src.own].filter(Boolean) : [];
  if (!f) return [];
  const out = [];
  f.ins.filter(x => x.v > 0).forEach((x, i) => out.push({
    id: "tax-opt-" + i, sources: src, advisorType: "tax", kind: "opportunity", severity: 2, title: x.t, text: x.d,
    annualImpact: x.v, potential: x.v, pot: "tax-" + i, confidence: 0.6, risk: "low", difficulty: "easy", minutes: 15,   // rules-based estimate, so not fully sure
    doNothing: T("You keep paying about {0} more tax a year than necessary.", pln(x.v)),
    actions: [{ icon: "🧾", title: x.t, desc: T("Worked out from your Taxes & Payroll numbers."), btn: T("Open Taxes"), go: "taxes" }] }));
  const b = f.bracket;
  if (b && (b.over > 0 || (b.room > 0 && b.share >= 0.85))) out.push({
    id: "tax-bracket", sources: src, advisorType: "tax", kind: "risk", severity: 2, title: T("Tax Bracket Watch"),
    text: b.over > 0 ? T("{0} of your income is taxed at 32%.", pln(b.over)) : T("You are close to the 32% bracket: {0} a year of room is left.", pln(b.room)),
    annualImpact: b.over * 0.2, confidence: 0.7, doNothing: T("Every extra zloty above the threshold is taxed at 32% instead of 12%."),
    actions: [{ icon: "🧾", title: T("Mind the 32% bracket"), desc: T("Plan bonuses and reliefs with the threshold in mind."), btn: T("Open Taxes"), go: "taxes" }] });
  return out;
}
