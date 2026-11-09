// Collects the extra facts the Savings, Loans and Emergency advisors need from the saved data and today's offers.
// The result is merged into the snapshot. (Everything else in the snapshot comes from the page figures.)
import { T, Calc, promo, currentRate, loanPlan, State, goalSaved, parseDate, today, moduleOn } from "../core.js";
import { investFacts } from "../investments.js";
import { Rates } from "../rates.js";
import { TAX } from "../tax-rates.js";
import { moves } from "../advice.js";
import { extraEffect, paymentFor, switchCost } from "../debts.js";

const BELKA = 0.81;   // after 19% tax on interest

export function collectExtras(d = State.data) {
  const accounts = (d.Holdings || []).map(h => {
    const p = promo(h), amount = Calc.toPln(h.Amount, h.Currency, d.Settings);
    return { id: h.Id, name: h.Name, amount, rate: currentRate(h), safe: !!h.Safe, place: h.Place,
      promo: p && !p.ended ? { daysLeft: p.daysLeft, now: +h.RatePercent || 0, after: p.rateAfter !== null && p.rateAfter !== "" ? +p.rateAfter || 0 : 0 } : null };
  }).filter(a => a.amount > 0);
  const offers = [...(Rates.savings || []), ...(Rates.deposits || [])].filter(o => o.Rate > 0);
  const bestRate = offers.reduce((m, o) => Math.max(m, o.Rate), 0);

  const loansX = (d.Loans || []).filter(l => l.Remaining > 0).map(l => {
    const pl = loanPlan(l), rate = +l.RatePercent || 0, pay = +l.MonthlyPayment || 0, rem = pl.remainingNow, n = pl.left;
    const x = { id: l.Id, name: l.Name, kind: l.Kind || "other", rate, pay, rem, months: pl.never ? null : n, refi: null, extra: null };
    if (!(rem > 0)) return x;
    // Refinancing: the same remaining amount and end date at the best new offer (as in Compare loans), after switching costs
    if (["mortgage", "cash", "car"].includes(x.kind) && !pl.never && n > 0) {
      try {
        const costs = switchCost(x.kind, rem);
        for (const o of Rates.loanOffers(x.kind).slice(0, 4)) {
          const or = o.Rate || o.Rrso, diff = paymentFor(rem, n, rate) - paymentFor(rem, n, or), net = diff * n - costs;
          if (!x.refi || net > x.refi.net) x.refi = { bank: o.Bank, rate: or, diff, net, costs };
        }
      } catch { /* offers not available */ }
    }
    // Paying 10% more every month: interest saved and months earlier
    if (pay > 0 && rate > 0 && !pl.never) {
      const more = Math.round(pay * 0.1), e = extraEffect(l, 0, "shorter", more);
      if (e.monthsEarlier > 0 && e.saved > 0) x.extra = { more, saved: e.saved, monthsEarlier: e.monthsEarlier };
    }
    return x;
  });
  const left = loansX.map(x => x.months);

  // Net worth: assets minus debts, month by month from what has been recorded (the current month is always live)
  const assets = Calc.portfolio(d).total, liab = loansX.reduce((a, x) => a + x.rem, 0), t = today();
  const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
  const ah = { ...(d.Settings.SavingsHistory || {}) }, dh = d.Settings.DebtHistory || {};
  ah[key] = assets;
  let lastDebt = null;
  const history = Object.entries(ah).sort().map(([k, a]) => { const dk = k === key ? liab : dh[k]; if (dk !== undefined) lastDebt = dk; return { k, assets: a, debt: dk ?? lastDebt ?? liab, net: a - (dk ?? lastDebt ?? liab) }; });
  const mIdx = k => +k.slice(0, 4) * 12 + +k.slice(5, 7), first = history[0], last = history[history.length - 1];
  const span = history.length >= 2 ? mIdx(last.k) - mIdx(first.k) : 0, change = history.length >= 2 ? last.net - first.net : 0;
  const nw = { assets, liabilities: liab, net: assets - liab, history, span, change, monthly: span > 0 ? change / span : 0, pct: first && first.net > 0 && history.length >= 2 ? change / first.net : null };
  const wp = d.Settings.WealthPlan || {};
  const plan = { age: +wp.age || 0, retireAge: +wp.retireAge || 65, spend: +wp.spend || 0, ret: wp.ret === undefined || wp.ret === "" ? 4 : +wp.ret, contrib: wp.contrib === undefined || wp.contrib === "" ? null : +wp.contrib };

  const goals = (d.Goals || []).map(g => ({ id: g.Id, name: g.Name, target: +g.Target || 0, saved: goalSaved(g, d), date: g.TargetDate }))
    .filter(g => g.target > 0 && g.saved < g.target && g.date).map(g => { const dt = parseDate(g.date);
      return { ...g, remaining: g.target - g.saved, months: (dt.getFullYear() - t.getFullYear()) * 12 + dt.getMonth() - t.getMonth(), overdue: dt < t }; })
    .sort((a, b) => parseDate(a.date) - parseDate(b.date));
  // Where the numbers come from, and when that was checked (shown next to every gain)
  const src = {
    offers: { name: T("Bank savings and deposit offers"), date: Rates.checked },
    loanOffers: { name: T("Loan offers from bank rankings"), date: Rates.loansChecked },
    fx: { name: T("NBP exchange rates"), date: Rates.data.ExchangeDate },
    tax: { name: T("Polish tax and ZUS rules {0}", TAX.year), date: TAX.checked },
    guarantee: { name: T("Deposit guarantee (BFG): 100 000 EUR per person and bank"), date: null },
    own: { name: T("Your own entries"), date: null },
    assumption: { name: T("Your own assumptions (not a forecast)"), date: null },
  };
  return {
    src, accounts, bestRate, loansX, nw, plan, goals, invest: moduleOn("investments") ? investFacts(d) : null,
    moves: moves(d).map(m => ({ id: m.h.Id, name: m.h.Name, bank: m.o.Bank, moved: m.moved, gain: m.gain })),
    debtFreeMonths: loansX.length && left.every(m => m !== null) ? Math.max(...left) : null,
    efMonths: +d.Settings.EmergencyMonths || 0,
    eurPln: Calc.toPln(1, "EUR", d.Settings) || 0,
    bestNet: bestRate * BELKA,
  };
}
