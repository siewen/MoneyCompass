// Collects the extra facts the Savings, Loans and Emergency advisors need from the saved data and today's offers.
// The result is merged into the snapshot. (Everything else in the snapshot comes from the page figures.)
import { Calc, promo, currentRate, loanPlan, State } from "../core.js";
import { Rates } from "../rates.js";
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
  return {
    accounts, bestRate, loansX,
    moves: moves(d).map(m => ({ id: m.h.Id, name: m.h.Name, bank: m.o.Bank, moved: m.moved, gain: m.gain })),
    debtFreeMonths: loansX.length && left.every(m => m !== null) ? Math.max(...left) : null,
    efMonths: +d.Settings.EmergencyMonths || 0,
    eurPln: Calc.toPln(1, "EUR", d.Settings) || 0,
    bestNet: bestRate * BELKA,
  };
}
