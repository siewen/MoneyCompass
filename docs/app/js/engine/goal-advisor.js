// Goal Advisor (module Budget plan, where the savings goals live): on track, at risk, delayed, funding and completion forecasts.
import { T, pln, fmtDate } from "../core.js";

const S = (s, ...k) => k.map(x => s.src && s.src[x]).filter(Boolean);
const pc = v => Math.round(Math.min(1, v) * 100) + "%";
const go = (title, desc) => [{ icon: "🎯", title, desc, btn: T("Open Budget plan"), go: "budget" }];
const date = m => { const d = new Date(); d.setMonth(d.getMonth() + m); return fmtDate(d); };

export function goalAdvise(s) {
  const goals = s.goals || [];
  if (!s.has || !goals.length) return [];
  const out = [], avail = Math.max(0, s.left || 0), forecast = [];
  let used = 0, firstGap = null;
  const dated = goals.filter(g => !g.overdue), late = goals.filter(g => g.overdue);
  for (const g of dated) {      // soonest first; the monthly money is shared in that order
    const left = Math.max(1, g.months), req = g.remaining / left;
    used += req;
    if (used <= avail + 0.01) {
      out.push({ id: "goal-on-track-" + g.id, sources: S(s, "own"), advisorType: "goal", kind: "positive", severity: 1, title: T("Goal On Track"),
        text: T("{0}: {1} of {2} saved. Put {3} aside each month and it is done by {4}.", g.name, pc(g.saved / g.target), pln(g.target), pln(req), fmtDate(g.date)), confidence: s.confidence, actions: go(T("See your goals"), "") });
      forecast.push(`${g.name}: ${fmtDate(g.date)}`);
    } else {
      const sh = Math.max(0, req - (used - avail)), m = sh > 0 ? Math.ceil(g.remaining / sh) : null, lateBy = m ? Math.max(0, m - left) : null;
      out.push({ id: "goal-at-risk-" + g.id, sources: S(s, "own"), advisorType: "goal", kind: "risk", severity: left <= 3 ? 3 : 2, title: T("Goal At Risk"),
        text: T("{0} needs {1} a month, but you can set aside about {2}.", g.name, pln(req), pln(sh)), annualImpact: (req - sh) * 12, potential: 0, confidence: s.confidence * 0.9, difficulty: "medium", minutes: 30,
        doNothing: m ? T("At this pace you reach {0} of the target by {1}, and it is complete only {2} months later.", pc((g.saved + sh * left) / g.target), fmtDate(g.date), lateBy) : T("Without money set aside for it, it will not be reached."),
        actions: go(T("Raise the monthly amount"), T("Or move the date.")) });
      firstGap = firstGap || { ...g, per: req };
      if (m) forecast.push(`${g.name}: ${date(m)}`);
    }
  }
  const leftover = Math.max(0, avail - used);      // overdue goals share what is left after the dated ones
  for (const g of late) {
    const share = leftover / late.length, m = share > 0 ? Math.ceil(g.remaining / share) : null;
    out.push({ id: "goal-delayed-" + g.id, sources: S(s, "own"), advisorType: "goal", kind: "problem", severity: 3, title: T("Goal Delayed"),
      text: T("{0} was due {1}; {2} is still missing.", g.name, fmtDate(g.date), pln(g.remaining)), annualImpact: 0, confidence: s.confidence, difficulty: "medium", minutes: 30,
      doNothing: m ? T("At {0} a month it would take {1} more months.", pln(share), m) : T("Without money set aside for it, it stays open."),
      actions: go(T("Set a new date or fund it"), T("Still missing {0}.", pln(g.remaining))) });
    firstGap = firstGap || { ...g, per: 0 };
    if (m) forecast.push(`${g.name}: ${date(m)}`);
  }
  if (firstGap && s.fullEF && s.surplus > 1000) {
    const amt = Math.min(s.surplus, firstGap.remaining), freed = firstGap.per * Math.min(1, amt / firstGap.remaining);
    out.push({ id: "goal-funding", sources: S(s, "own"), advisorType: "goal", kind: "opportunity", severity: 1, title: T("Funding Opportunity"),
      text: freed > 0 ? T("Your emergency fund is full. Using {0} of the extra safe money for {1} frees about {2} a month.", pln(amt), firstGap.name, pln(freed)) : T("Your emergency fund is full. Using {0} of the extra safe money would close most of {1}.", pln(amt), firstGap.name),
      annualImpact: freed * 12, potential: 0, confidence: 0.7, difficulty: "easy", minutes: 15,   // frees cash flow, it is not a yearly gain
      doNothing: T("You keep the extra money idle while the goal waits."), actions: go(T("Fund the goal"), T("Link a savings account or add the amount.")) });
  }
  if (forecast.length) out.push({ id: "goal-forecast", sources: S(s, "own"), advisorType: "goal", kind: "positive", severity: 1, title: T("Goal Completion Forecast"),
    text: forecast.slice(0, 3).join(" · "), confidence: s.confidence * 0.9, actions: go(T("See your goals"), "") });
  return out;
}
