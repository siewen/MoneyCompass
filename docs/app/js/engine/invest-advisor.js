// Investment Advisor (module Investments): portfolio health, concentration, overexposure, diversification, growth, fees.
import { T, pln } from "../core.js";
import { fv } from "./wealth-math.js";

const pc = v => Math.round(v * 100) + "%";
const S = (s, ...k) => k.map(x => s.src && s.src[x]).filter(Boolean);
const go = (title, desc) => [{ icon: "📈", title, desc, btn: T("Open Investments"), go: "investments" }];

export function investAdvise(s) {
  const v = s.invest;
  if (!s.has || !v || !(v.total > 0)) return [];
  const out = [], conf = 0.8;
  if (v.count >= 2 && v.topShare > 0.5 && v.total >= 2000) out.push({ id: "invest-concentration", sources: S(s, "own"), advisorType: "investment", kind: "risk", severity: v.topShare > 0.8 ? 3 : 2, title: T("Concentration Risk"),
    text: T("{0} is {1} of your portfolio.", v.topName, pc(v.topShare)), confidence: conf, difficulty: "medium", minutes: 60,
    doNothing: T("A fall in one position moves your whole portfolio."), actions: go(T("Spread your portfolio"), T("No single position above half.")) });
  if (v.cryptoShare > 0.3) out.push({ id: "invest-crypto", sources: S(s, "own"), advisorType: "investment", kind: "risk", severity: v.cryptoShare > 0.6 ? 3 : 2, title: T("Overexposure to Crypto"),
    text: T("{0} of your portfolio is crypto, which can fall sharply.", pc(v.cryptoShare)), confidence: conf, difficulty: "medium", minutes: 30,
    doNothing: T("A crypto crash of 50% would cost you about {0}.", pln(v.total * v.cryptoShare * 0.5)), actions: go(T("Rebalance"), T("Many advisors keep crypto to a small part."))});
  if (v.shareOfWealth > 0.8 && v.total >= 5000) out.push({ id: "invest-overexposure", sources: S(s, "own"), advisorType: "investment", kind: "risk", severity: 2, title: T("Overexposure to Investments"),
    text: T("{0} of all your money is invested, and little is in safe savings.", pc(v.shareOfWealth)), confidence: conf, difficulty: "medium", minutes: 30,
    doNothing: T("A market fall and an unexpected bill at the same time would force you to sell at a loss."), actions: go(T("Keep a safe part"), "") });
  if (v.total >= 2000 && (v.count === 1 || v.cryptoShare === 1 || v.cryptoShare === 0 && v.count < 3)) out.push({ id: "invest-diversify", sources: S(s, "own"), advisorType: "investment", kind: "opportunity", severity: 1, title: T("Diversification Opportunity"),
    text: v.count === 1 ? T("All your investments are in one position. Spreading them lowers the risk.") : T("Your investments sit in few positions of one kind. A mix lowers the risk."), confidence: 0.7, difficulty: "medium", minutes: 60, actions: go(T("Add a different kind of asset"), "") });
  const plan = s.plan || {};
  if (v.monthly <= 0 && s.fullEF && s.left > 0 && plan.ret > 0) {
    const m = Math.round(s.left * 0.5 / 10) * 10 || Math.round(s.left);
    out.push({ id: "invest-growth", sources: S(s, "own", "assumption"), advisorType: "investment", kind: "opportunity", severity: 1, title: T("Investment Growth Opportunity"),
      text: T("Investing {0} a month for 10 years, at {1}% a year (your assumption), could grow to {2}. Investments can lose value.", pln(m), String(plan.ret).replace(".", ","), pln(fv(0, m, plan.ret, 10))),
      annualImpact: 0, confidence: 0.4, risk: "medium", difficulty: "medium", minutes: 30, doNothing: T("Without regular investing your money only grows at the savings rate."), actions: go(T("Set up regular investing"), "") });
  }
  const fees = v.positions.filter(p => p.fee > 0);
  fees.filter(p => p.fee > 1).forEach(p => {
    const gain = p.value * (p.fee - 0.5) / 100;
    out.push({ id: "invest-fee-" + p.name, sources: S(s, "own"), advisorType: "investment", kind: "opportunity", severity: 2, title: T("Fee Drag Opportunity"),
      text: T("{0} costs {1}% a year, about {2}. Broad index funds often cost well below 0,5%.", p.name, String(p.fee).replace(".", ","), pln(p.value * p.fee / 100)),
      annualImpact: p.value * p.fee / 100, potential: gain, pot: "fee:" + p.name, confidence: 0.5, risk: "medium", difficulty: "medium", minutes: 90,
      doNothing: T("You keep paying about {0} a year in fees.", pln(p.value * p.fee / 100)), actions: go(T("Compare costs"), T("Check the fees of cheaper options.")) });
  });
  if (!fees.length) out.push({ id: "invest-fee-info", sources: S(s, "own"), advisorType: "investment", kind: "opportunity", severity: 1, title: T("Check Your Investment Costs"),
    text: T("Enter the yearly cost (fees) of your positions to see how much they take from your returns."), confidence: 0.9, difficulty: "easy", minutes: 5, actions: go(T("Add the yearly cost"), "") });
  // Portfolio health: 100 minus penalties for concentration, crypto, a single position and a very high share of all money
  const score = Math.max(0, Math.round(100 - (v.topShare > 0.4 ? (v.topShare - 0.4) * 60 : 0) - v.cryptoShare * 40 - (v.count === 1 ? 15 : 0) - (v.shareOfWealth > 0.7 ? 15 : 0)));
  out.push({ id: "portfolio-health", sources: S(s, "own"), advisorType: "investment", kind: score < 50 ? "risk" : "positive", severity: score < 50 ? 2 : 1, title: T("Portfolio Health"),
    text: T("Your portfolio health score is {0} out of 100 ({1} positions).", score, v.count), confidence: conf, actions: go(T("See your portfolio"), "") });
  return out;
}
