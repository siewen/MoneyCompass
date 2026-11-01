// Loans & debts: extra repayments (nadpłata) and advice for "Optimize my finances".
import { T, State, save, Calc, pln, rate, fmtDate, isoDate, parseDate, today, addMonths, monthName, loanPlan, planLoan, loanNextPayment, license } from "./core.js";
import { esc, card, heading, hint } from "./ui.js";
import { Rates, LOAN_MARKET, maxLegalRate } from "./rates.js";

const TAX = 0.81;

/** Pay back A with payment P at monthly rate r: number of months and the interest paid (Infinity when never). */
export function simulate(A, P, ratePct) {
  const r = (ratePct || 0) / 100 / 12;
  if (A <= 0) return { months: 0, interest: 0 };
  if (P <= 0 || P <= A * r) return { months: Infinity, interest: Infinity };
  let months = 0, interest = 0;
  while (A > 0.005 && months < 1200) { const i = A * r; interest += i; A = A + i - P; months++; }
  return { months, interest };
}
/** The monthly payment that pays back A in n months. */
export function paymentFor(A, n, ratePct) {
  const r = (ratePct || 0) / 100 / 12;
  if (n <= 0) return A;
  return r > 0 ? A * r / (1 - Math.pow(1 + r, -n)) : A / n;
}

/** What an extra repayment changes: shorter loan (same payment) or lower payment (same end). */
export function extraEffect(l, amount, mode, extraMonthly = 0) {
  const p = loanPlan(l), now = p.remainingNow, payment = +l.MonthlyPayment || 0;
  const before = simulate(now, payment, l.RatePercent);
  const left = Math.max(0, now - (amount || 0));
  if (mode === "lower") {
    const n = before.months === Infinity ? 0 : before.months;
    const newPay = paymentFor(left, n, l.RatePercent) + extraMonthly;
    const after = simulate(left, newPay, l.RatePercent);
    return { before, after, newPayment: paymentFor(left, n, l.RatePercent), saved: before.interest - after.interest, left, next: p.next || loanNextPayment(l) };
  }
  const after = simulate(left, payment + extraMonthly, l.RatePercent);
  return { before, after, newPayment: payment, saved: before.interest - after.interest, left, next: p.next || loanNextPayment(l),
    monthsEarlier: before.months === Infinity || after.months === Infinity ? null : before.months - after.months };
}

/** Records an extra repayment: lowers what is left and, if chosen, the monthly payment. */
export function applyExtra(l, amount, mode, date) {
  const e = extraEffect(l, amount, mode);
  (l.Extra ||= []).push({ Date: isoDate(date || today()), Amount: amount, Mode: mode });
  l.Remaining = Math.round(e.left * 100) / 100;
  l.NextPayment = isoDate(e.next);
  if (mode === "lower") l.MonthlyPayment = Math.round(e.newPayment * 100) / 100;
  planLoan(l);
  save();
  return e;
}

const endOf = (months, next) => months === Infinity ? T("never") : monthName(addMonths(next, Math.max(0, months - 1)));

/** Hints for your loans in "Optimize my finances". */
export function debtAdvice(d) {
  const loans = d.Loans.filter(l => l.Remaining > 0).map(l => ({ l, p: loanPlan(l) })).filter(x => x.p.remainingNow > 0);
  if (!loans.length) return "";
  const best = [...Rates.savings, ...Rates.deposits].sort((a, b) => b.Rate - a.Rate)[0];
  const saveNet = best ? best.Rate * TAX : 0;
  const pf = Calc.portfolio(d), target = Calc.emergency(d.Settings).target, spare = target > 0 ? pf.safe - target : 0;
  const income = Calc.totalIncome(d), payments = loans.reduce((s, x) => s + (+x.l.MonthlyPayment || 0), 0);
  const tips = [];
  const add = (cls, title, text) => tips.push(`<div class="advice ${cls}" data-route="loans"><b>${title}</b><p>${esc(text)}</p></div>`);
  const sorted = [...loans].sort((a, b) => (+b.l.RatePercent || 0) - (+a.l.RatePercent || 0));
  const top = sorted[0];

  // 1. The share of income
  if (income > 0) {
    const share = payments / income;
    if (share > 0.4) add("bad", "⚠️ " + esc(T("Your loans take {0}% of your income", Math.round(share * 100))), T("Above 40% is risky: one bad month can mean a missed payment. Don't take new loans, and put any extra money into the most expensive one first."));
    else if (share >= 0.3) add("warn", "⚠️ " + esc(T("Your loans take {0}% of your income", Math.round(share * 100))), T("30–40% is on the high side. Avoid new loans until this goes down."));
  }
  // 2. Never paid back
  for (const x of loans.filter(x => x.p.never)) add("bad", "⚠️ " + esc(x.l.Name), T("The monthly payment doesn't cover the interest, so this debt grows. Pay more each month or talk to your bank now."));
  // 3. Most expensive first
  if (sorted.length >= 2 && (+top.l.RatePercent || 0) > (+sorted[1].l.RatePercent || 0))
    add("good", "💳 " + esc(T("Pay extra into {0} first", top.l.Name)), T("It has the highest interest ({0}). Every extra złoty there saves more than in your other loans (the \"avalanche\" method). Keep paying the minimum on the others.", rate(+top.l.RatePercent || 0)));
  // 4. Overpay or save?
  if (top && !top.p.never) {
    const loanRate = +top.l.RatePercent || 0;
    if (loanRate > saveNet + 0.5) {
      const e = extraEffect(top.l, 0, "shorter", 200);
      const em = target > 0 && pf.safe < target;
      add(em ? "warn" : "good", "📉 " + esc(T("Overpaying {0} pays more than saving", top.l.Name)),
        T("The loan costs {0} a year, while the best savings pay about {1} after tax. Paying 200 zł a month extra: debt-free {2} months earlier and about {3} less interest.", rate(loanRate), rate(saveNet), e.monthsEarlier ?? "–", pln(Math.max(0, e.saved))) +
        (em ? " " + T("But fill your emergency fund first – a loan can't be taken back if you suddenly need cash.") : ""));
      if (spare > 1000) {
        // Spare money above the emergency fund: most expensive loan first, then the next one
        let rest = Math.floor(spare / 100) * 100;
        const lines = [];
        for (const x of sorted.filter(x => !x.p.never && (+x.l.RatePercent || 0) > saveNet + 0.5)) {
          if (rest < 500) break;
          const amt = Math.min(rest, Math.ceil(x.p.remainingNow));
          const o = extraEffect(x.l, amt, "shorter");
          lines.push(T("Paying {0} once into {1}: debt-free {2} months earlier ({3}) and about {4} less interest.", pln(amt), x.l.Name, o.monthsEarlier ?? "–", endOf(o.after.months, o.next), pln(Math.max(0, o.saved))));
          rest -= amt;
        }
        if (lines.length) add("good", "💰 " + esc(T("You have {0} more than your emergency fund needs", pln(spare))), lines.join(" "));
      }
    } else if (loanRate > 0) {
      add("primary", "🏦 " + esc(T("Saving pays more than overpaying {0}", top.l.Name)),
        T("The loan costs {0} a year, and the best savings pay about {1} after tax. Keep extra money in savings – it stays available, and you can still overpay later.", rate(loanRate), rate(saveNet)));
    }
  }
  // 5. Your rate compared with today's market (by type of loan)
  const max = maxLegalRate();
  for (const x of loans) {
    const r = +x.l.RatePercent || 0, kind = x.l.Kind || "other", m = LOAN_MARKET[kind];
    if (r <= 0) continue;
    if (kind === "card" || (!m && r >= Math.max(10, max - 3))) {
      if (r > max + 0.1) add("bad", "⚠️ " + esc(T("{0}: {1} is above the legal maximum", x.l.Name, rate(r))), T("In Poland the maximum interest is {0} now (2 × the NBP reference rate + 3.5%). Check the rate in your contract – it may include fees, or the lender may be charging too much.", rate(max)));
      else if (r >= 10) add("warn", "🔁 " + esc(T("{0} is expensive ({1})", x.l.Name, rate(r))), T("Credit cards and overdrafts usually charge the legal maximum ({0} now). A cash loan from about {1} to pay it off at once, then paying off the cash loan, usually costs much less.", rate(max), rate(LOAN_MARKET.cash.rate)));
      continue;
    }
    if (!m || !m.rate) continue;
    const marketLink = LOAN_MARKET.links[kind] ? ` <a href="${esc(LOAN_MARKET.links[kind])}" target="_blank" rel="noopener">${esc(T("See today's offers"))} ↗</a>` : "";
    const margin = kind === "mortgage" ? 0.8 : 1.5;
    if (r > m.rate + margin && !x.p.never) {
      const now = simulate(x.p.remainingNow, +x.l.MonthlyPayment || 0, r), cheaper = simulate(x.p.remainingNow, +x.l.MonthlyPayment || 0, m.rate);
      const saved = now.interest === Infinity ? 0 : now.interest - cheaper.interest;
      tips.push(`<div class="advice warn" data-route="loans"><b>🔁 ${esc(T("{0}: your rate is above today's market", x.l.Name))}</b><p>${esc(T("You pay {0}; new {1} offers are about {2} ({3}). Refinancing at that rate could save about {4} in interest – minus its costs (commission, possible early repayment fee{5}). Ask your bank for a better rate first, then compare other banks.",
        rate(r), T(kind === "mortgage" ? "mortgage" : kind === "car" ? "car loan" : "cash loan"), rate(m.rate), T(m.note), pln(Math.max(0, saved)), kind === "mortgage" ? ", " + T("valuation and notary costs") : ""))}${marketLink}</p></div>`);
    } else if (r <= m.rate + margin) {
      tips.push(`<div class="advice primary" data-route="loans"><b>✔ ${esc(T("{0}: your rate is close to today's market", x.l.Name))}</b><p>${esc(T("You pay {0}; new {1} offers are about {2}. Refinancing is probably not worth its costs right now.", rate(r), T(kind === "mortgage" ? "mortgage" : kind === "car" ? "car loan" : "cash loan"), rate(m.rate)))}</p></div>`);
    }
  }
  if (loans.some(x => !x.l.Kind || x.l.Kind === "other"))
    tips.push(`<div class="advice primary" data-route="loans"><b>💡 ${esc(T("Compare your loans with the market"))}</b><p>${esc(T("Choose the type of each loan (mortgage, cash loan, car loan, credit card) in Loans & debts – MoneyCompass then compares your rate with today's offers."))}</p></div>`);
  // 6. How to overpay in Poland
  add("primary", "💡 " + esc(T("When you overpay")), T("Choose a shorter loan (skrócenie okresu) if you can still pay the same amount – it saves the most interest. A lower monthly payment (zmniejszenie raty) gives you more room each month. Banks may charge a fee: for consumer loans at most 1% (0.5% with less than a year left), for variable-rate mortgages only in the first 3 years – check your contract."));

  const total = loans.reduce((s, x) => s + (x.p.never ? 0 : x.p.interest), 0);
  tips.push(`<p class="hint">${esc(T("Typical market rates checked {0}. Your bank's offer depends on your income, credit history and the amount – always check the full terms.", fmtDate(LOAN_MARKET.checked)))}</p>`);
  return card(heading(T("Your loans & debts"), "💳") +
    `<p>${esc(T("Remaining principal amount to be repaid: {0} · interest still to be repaid: about {1}", pln(loans.reduce((s, x) => s + x.p.remainingNow, 0)), pln(total)))}</p>` + tips.join(""));
}
