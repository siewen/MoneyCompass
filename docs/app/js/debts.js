// Loans & debts: extra repayments (nadpłata) and advice for "Optimize my finances".
import { T, State, save, Calc, pln, rate, fmtDate, isoDate, parseDate, today, addMonths, monthName, loanPlan, planLoan, loanNextPayment, license } from "./core.js";
import { esc, card, heading, hint } from "./ui.js";
import { Rates, LOAN_MARKET, LOAN_RANKINGS, maxLegalRate } from "./rates.js";

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
    tips.push(compareLoan(x, kind));
  }
  const untyped = loans.filter(x => !x.l.Kind || x.l.Kind === "other");
  if (untyped.length)
    tips.push(`<div class="advice primary"><b>💡 ${esc(T("Compare your loans with the market"))}</b><p>${esc(T("Choose the type of each loan – MoneyCompass then compares your rate with today's best offers."))}</p>
      ${untyped.map(x => `<label class="kind-pick"><span>${esc(x.l.Name)}</span><select data-loan-kind="${esc(x.l.Id)}">${LOAN_TYPES.map(([k, n]) => `<option value="${k}"${(x.l.Kind || "other") === k ? " selected" : ""}>${esc(T(n))}</option>`).join("")}</select></label>`).join("")}</div>`);
  // 6. How to overpay in Poland
  add("primary", "💡 " + esc(T("When you overpay")), T("Choose a shorter loan (skrócenie okresu) if you can still pay the same amount – it saves the most interest. A lower monthly payment (zmniejszenie raty) gives you more room each month. Banks may charge a fee: for consumer loans at most 1% (0.5% with less than a year left), for variable-rate mortgages only in the first 3 years – check your contract."));

  const total = loans.reduce((s, x) => s + (x.p.never ? 0 : x.p.interest), 0);
  tips.push(`<p class="hint">${esc(T("Typical market rates checked {0}. Your bank's offer depends on your income, credit history and the amount – always check the full terms.", fmtDate(LOAN_MARKET.checked)))}</p>`);
  return card(heading(T("Your loans & debts"), "💳") +
    `<p>${esc(T("Remaining principal amount to be repaid: {0} · interest still to be repaid: about {1}", pln(loans.reduce((s, x) => s + x.p.remainingNow, 0)), pln(total)))}</p>` + tips.join(""));
}

const LOAN_TYPES = [["mortgage", "Mortgage"], ["cash", "Cash loan"], ["car", "Car loan"], ["card", "Credit card / overdraft"], ["other", "Other loan or debt"]];
/** Switching costs we subtract: valuation, notary and court fees for a mortgage; the early repayment fee (at most 1%) for other loans. */
export const switchCost = (kind, amount) => kind === "mortgage" ? 1500 : Math.round(amount * 0.01);

/** Your loan against today's best offers: the same remaining amount and end date at each offer's rate.
 *  Calculated again every time Optimize opens – with your current loan and the newest offers. */
export function compareLoan(x, kind) {
  const l = x.l, r = +l.RatePercent || 0, rem = x.p.remainingNow, n = x.p.left;
  const what = T(kind === "mortgage" ? "mortgage" : kind === "car" ? "car loan" : "cash loan");
  const link = LOAN_RANKINGS[kind === "car" ? "cash" : kind];
  if (x.p.never || !(n > 0) || rem <= 0) return "";
  const costs = switchCost(kind, rem);
  const rows = Rates.loanOffers(kind).slice(0, 4).map(o => {
    // Compared with your own rate over the same months, so rounding in your payment does not count as a saving
    const or = o.Rate || o.Rrso, pay = paymentFor(rem, n, or), diff = paymentFor(rem, n, r) - pay, total = diff * n, net = total - costs;
    return { o, or, pay, diff, total, net };
  });
  if (!rows.length) return "";
  const best = rows.reduce((a, b) => b.net > a.net ? b : a);
  const worth = best.net > Math.max(1000, costs);
  const head = worth
    ? "🔁 " + esc(T("{0}: better offers exist", l.Name))
    : "✔ " + esc(T("{0}: your rate is close to today's market", l.Name));
  const intro = worth
    ? T("You pay {0}. With {1} at {2} you could pay about {3} less per month – about {4} less in total, or {5} after switching costs.", rate(r), best.o.Bank, rate(best.or), pln(best.diff), pln(best.total), pln(best.net))
    : T("You pay {0}; the best new {1} offers are from {2}. After switching costs, refinancing is probably not worth it right now.", rate(r), what, rate(rows[0].or));
  const list = rows.map(({ o, or, pay, diff, net }) => `<div class="loan-offer">
      <div><b>${esc(o.Bank)}</b><span class="hint">${esc(o.Name)}${o.Fixed === true ? " · " + esc(T("fixed rate")) : o.Fixed === false ? " · " + esc(T("variable rate")) : ""}</span></div>
      <div class="lo-rate"><b class="${or < r ? "good" : ""}">${rate(or)}</b><span class="hint">${esc(o.Rate ? T("RRSO {0}", rate(o.Rrso)) : "RRSO")}</span></div>
      <div class="lo-pay"><span>${esc(T("{0} / month", pln(pay)))}</span><span class="${diff > 0 ? "good" : "bad"} small">${diff > 0 ? "−" : "+"}${esc(pln(Math.abs(diff)))}</span></div>
      <div class="lo-net ${net > 0 ? "good" : "hint"} small">${esc(net > 0 ? T("saves about {0}", pln(net)) : T("not worth it"))}</div></div>`).join("");
  return `<div class="advice ${worth ? "good" : "primary"} loan-compare"><b>${head}</b><p>${esc(intro)}</p>${list}
    <p class="hint">${esc(T("Same remaining amount ({0}) and same end ({1} more payments). Switching costs of about {2} are subtracted ({3}). Offers checked {4}; your bank's offer depends on your income and credit history.",
      pln(rem), n, pln(costs), T(kind === "mortgage" ? "valuation, notary and court fees" : "early repayment fee, at most 1%"), fmtDate(String(Rates.loansChecked).slice(0, 10))))}
    ${link ? ` <a href="${esc(link)}" target="_blank" rel="noopener">${esc(T("Open the full ranking"))} ↗</a>` : ""}</p></div>`;
}
