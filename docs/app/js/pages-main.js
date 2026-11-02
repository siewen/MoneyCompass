// The free tabs: Overview, Inflows, Outflows, Emergency fund, Savings (with Savings goals for Pro).
import {
  T, State, save, Calc, Advisor, ChartData, COLORS, pln, rate, amount, num, plain, fmtDate, parseDate, isoDate, inputDate,
  today, addDays, addMonths, monthStart, monthName, monthsCount, uuid, categories, findCategory, categoryLabel, categoryIcon,
  addCategory, removeCategory, ICON_CHOICES, OTHER, license, moduleOn, FREQUENCIES, ONE_TIME, RECEIVED, LOAN_CATEGORY, netFromGross, loanPlan, currentRate, duePromos, freqLabel, customFrequency, parseCustom, repeatingExpenses, setReceivedRepeat, receivedRepeatOn, setRepeat, seriesKey, toBin, restoreFromBin, binLabel,
  matchKey, learnCategory, similarExpenses, setCategory, goalSaved, savingsRateText } from "./core.js";
import { hbars, donut, legend, monthBars, progress, waveChart } from "./charts.js";
import { NEW_CAT } from "./ui.js";
import { esc, card, heading, hint, row, field, textInput, numInput, dateInput, select, check, button, values, popup, confirmBox, toast, ICON } from "./ui.js";
import { App, requirePro } from "./app.js";
import { Rates } from "./rates.js";
import { adviceCard, bindAdvice, promoBadge, moves } from "./advice.js";
import { loanWarning } from "./pages-pro.js";
import { openSavingsCheck, savedChecksCard, bindSavedChecks, savingsChartCard, bindSavingsChart } from "./savings-check.js";

const D = () => State.data;
const tile = (label, value, route, colors, cls = "", tip = "") =>
  `<button class="tile" data-go="${route}"${tip ? ` data-tip="${esc(tip)}"` : ""} style="--t1:${colors[0]};--t2:${colors[1]};--t3:${colors[2]};--t4:${colors[3]}">
     <span>${esc(label)}</span><b class="${cls}">${value}</b></button>`;

// ================================================================= Overview

export const Overview = {
  route: "overview", title: "Overview",
  render(el) {
    const d = D();
    const income = Calc.totalIncome(d), avg = Calc.spending(d);
    const spending = avg.essential + avg.nonEssential, left = income - spending;
    const both = income > 0 && avg.monthsUsed > 0;
    const top = Advisor.analyse(d)[0];
    const p = Calc.portfolio(d);
    const months = ChartData.trend(d);
    const showTrend = months.some(m => m.income > 0 || m.expenses > 0);
    const cats = ChartData.categories(d);
    const target = Calc.emergency(d.Settings).target;

    recordSavings(d, p.total);
    // Hover details for the four tiles
    const pinc = Calc.periodIncome(d);
    const tipIncome = pinc.months ? T("Salary {0} + extra income {1} per month, from the same months as your outflows. Click for the Inflows tab.", pln(pinc.salary), pln(pinc.extra)) : T("From your income sources. Click for the Inflows tab.");
    const tipSpending = avg.monthsUsed ? T("Essential {0} + not essential {1} per month, including loan instalments and regular payments. Click for the Outflows tab.", pln(avg.essential), pln(avg.nonEssential)) : "";
    // Emergency fund: how many months of essential costs your safe money covers
    const essentialMonth = Calc.emergency(d.Settings).monthly || avg.essential || 0;
    const covered = essentialMonth > 0 ? p.safe / essentialMonth : 0;
    let emergency, emState;
    if (target > 0) {
      const f = p.safe / target;
      emState = f >= 1 ? "good" : f >= 0.5 ? "warn" : "bad";
      const color = f >= 1 ? COLORS.leftOver : f >= 0.5 ? "#F59E0B" : "#DC2626";
      emergency = progress(f, color) + `<p class="${emState}"><b>${esc(T("{0} of {1} ({2}%)", pln(Math.min(p.safe, target)), pln(target), Math.round(Math.min(100, f * 100))))}</b></p>` +
        hint(f >= 1 ? T("Well done – your safe money covers your emergency fund.") : T("Covers {0} of {1} months of essential costs. Still missing {2}.", fmtNum(covered), d.Settings.EmergencyMonths || 0, pln(target - p.safe)));
    } else {
      emState = "bad";
      const lo = essentialMonth * 3, hi = essentialMonth * 6;
      emergency = `<div class="alert bad"><b>⚠ ${esc(T("No emergency fund yet"))}</b>
        <p>${esc(T("Without one, an unexpected bill or losing your job goes straight onto a loan or credit card. Keep 3–6 months of essential costs aside, in safe money."))}</p>
        ${essentialMonth > 0 ? `<p>${esc(T("With your essential costs ({0} per month) that is about {1} – {2}. Your safe money now covers {3} months.", pln(essentialMonth), pln(lo), pln(hi), fmtNum(covered)))}</p>` : ""}
        <span class="alert-link">${esc(T("Set it up in the Emergency fund tab"))} →</span></div>`;
    }
    // Is it going somewhere? Money left over each month (income − expenses), and the trend of your savings
    const done = months.filter(m => !m.current && (m.income > 0 || m.expenses > 0)).slice(-6);
    const last = done[done.length - 1];
    const lastLeft = last ? last.income - last.expenses : null, lastRate = last && last.income > 0 ? lastLeft / last.income : 0;
    const hist = Object.entries(d.Settings.SavingsHistory || {}).sort();
    const growth = hist.length >= 2 ? hist[hist.length - 1][1] - hist[0][1] : null;
    const state = !last ? "" : lastLeft < 0 ? "bad" : lastRate < 0.1 ? "warn" : "good";
    const headline = !last ? hint(T("Import or enter a full month of income and expenses to see whether your savings are growing."))
      : `<p class="savings-headline ${state}">${state === "bad" ? "📉" : state === "warn" ? "➖" : "📈"} <b>${esc(lastLeft < 0
          ? T("In {0} you spent {1} more than you earned.", monthName(last.start), pln(-lastLeft))
          : T("In {0} you kept {1} – {2}% of your income.", monthName(last.start), pln(lastLeft), Math.round(lastRate * 100)))}</b></p>` +
        hint(state === "bad" ? T("Your savings shrink when this happens. Look at your biggest categories in Outflows – and set a Budget plan.")
          : state === "warn" ? T("You are saving, but little. A good aim is at least 10–20% of your income every month.")
          : T("Great – you are building up money. Keep it in safe savings until your emergency fund is full, then make it work (Compare offers)."));
    const bars = done.length ? `<div class="mini-bars">${(() => {
        const max = Math.max(1, ...done.map(m => Math.abs(m.income - m.expenses)));
        return done.map(m => { const v = m.income - m.expenses, h = Math.max(4, Math.abs(v) / max * 44);
          return `<div class="mb" title="${esc(monthName(m.start))}: ${esc(pln(v))}"><span class="${v >= 0 ? "pos" : "neg"}" style="height:${h}px"></span><small>${esc(monthName(m.start).slice(0, 3))}</small></div>`; }).join("");
      })()}<span class="mb-label">${esc(T("Balance per month"))}</span></div>` : "";
    const growthLine = growth !== null && hist.length >= 2 ? `<p class="${growth >= 0 ? "good" : "bad"}">${growth >= 0 ? "▲" : "▼"} ${esc(T("Your savings since {0}: {1}{2}", fmtMonthKey(hist[0][0]), growth >= 0 ? "+" : "−", pln(Math.abs(growth))))}</p>` : "";

    const parts = [];
    parts.push(`<div class="tiles">
      ${tile(T("Inflows per month"), pln(income), "income", ["#1E5FB0", "#60A5FA", "#EAF2FC", "#2A78D6"], "", tipIncome)}
      ${tile(T("Outflows per month"), avg.monthsUsed ? pln(spending) : "–", "expenses", ["#C2410C", "#FB923C", "#FDF0E9", "#EB6834"], "", tipSpending)}
      ${tile(T("Balance per month"), both ? pln(left) : "–", "income", ["#0E7C55", "#34D399", "#E7F7F0", "#1BAF7A"], both && left < 0 ? "bad" : "", T("Inflows minus outflows: what you can save each month."))}
      ${tile(T("Savings rate"), both ? savingsRateText(left, income) : "–", "portfolio", ["#7E22CE", "#C084FC", "#F5EDFD", "#A855F7"], both && left < 0 ? "bad" : "", T("The part of your income you keep. A good aim is 10–20% or more."))}
    </div>`);
    const sw = shortDataWarning(d);
    if (sw) parts.push(`<div class="tip warn-tip short-data">${sw.replace(/<\/?p[^>]*>/g, "")} ${esc(T("Import or enter at least one whole month."))}</div>`);
    parts.push(`<button class="btn go big" data-action="optimize">⚡ ${esc(T("Optimize my finances"))}</button>`);
    const due = duePromos(d)[0];
    if (due) parts.push(`<button class="tip warn-tip" data-go="portfolio">⏰ ${esc(due.p.ended ? T("The promotion at {0} ended on {1} – see where to move the money", due.h.Name, fmtDate(due.p.end)) : T("The promotion at {0} ends in {1} days – see where to move the money", due.h.Name, due.p.daysLeft))}  →</button>`);
    else { const m = moves(d)[0]; if (m) parts.push(`<button class="tip" data-go="portfolio">🧭 ${esc(T("Your savings could earn about {0} more at {1} – see Savings", pln(m.gain), m.o.Bank))}  →</button>`); }
    if (top) parts.push(`<button class="tip" data-go="${top.route || ""}">💡 ${esc(T("Best next step: {0}", top.title))}${top.route ? "  →" : ""}</button>`);
    parts.push(`<button class="btn second" data-action="export">⬇ ${esc(T("Export report (Excel, PDF, Word)"))}</button>`);

    const pin = Calc.periodIncome(d);
    // Like the banks show it: balance of inflows and outflows, with a green/red split bar
    const basisMonths = Calc.groupMonths(Calc.countedExpenses(d)).slice(0, 3).reverse();
    const inflow = income, outflow = spending, bal = inflow - outflow, sum = inflow + outflow;
    const pIn = sum > 0 ? Math.round(inflow / sum * 100) : 0;
    const cov = Calc.coverage(d);
    const period = cov.from ? fmtDate(cov.from) + " – " + fmtDate(cov.to) + " (" + T("{0} days", cov.days) + ")" : "";
    parts.push(card(heading(T("Inflows and outflows (per month)")) + (ChartData.hasInOut(d) ? `
      <div class="flow-balance"><span>${esc(T("Balance of inflows and outflows"))}</span><b class="${bal < 0 ? "bad" : "good"}">${bal < 0 ? "−" : ""}${pln(Math.abs(bal))}</b>
        ${period ? `<small class="hint">${esc(T("Details for the period: {0}", period))}${cov.partial ? " · " + esc(T("converted to one month")) : basisMonths.length > 1 ? " · " + esc(T("average per month")) : ""}</small>` : ""}</div>
      <div class="flow-bar">
        <div class="in" style="flex:${Math.max(pIn, 28)}"><span>⬇ ${esc(T("Inflows"))}</span></div>
        <div class="out" style="flex:${Math.max(100 - pIn, 28)}"><span>⬆ ${esc(T("Outflows"))}</span></div></div>
      <div class="flow-values">
        <b class="in" data-tip="${esc(pin.months ? T("Salary {0} + extra income {1}", pln(pin.salary), pln(pin.extra)) : T("From your income sources"))}">${pln(inflow)} <small>${pIn}%</small></b>
        <b class="out" data-tip="${esc(T("Essential {0} + not essential {1}", pln(avg.essential), pln(avg.nonEssential)))}">${pln(outflow)} <small>${100 - pIn}%</small></b>
      </div>` : hint(T("Add income and expenses to see this chart."))), "link\" data-go=\"income"));
    const cur = months.find(m => m.current);
    const fd = ChartData.firstDate(d);
    parts.push(card(heading(T("Financial analysis: inflows and outflows by month")) +
      (fd ? `<p class="period-line">📅 ${esc(T("From {0} to {1} · {2} months", fmtDate(fd), fmtDate(today()), months.length))}</p>` : "") +
      hint(T("Inflows as received (salary and extra income) – where nothing was imported, as planned from your income sources. Outflows as entered or imported.")) +
      (showTrend ? monthBars(months, axis, pln, [T("Inflows"), T("Outflows")]) + legend([
        { color: "#2E9E5B", label: T("Inflows"), text: pln(months.reduce((s, m) => s + m.income, 0) / Math.max(1, months.length)) + " " + T("avg.") },
        { color: "#C81E26", label: T("Outflows"), text: pln(months.reduce((s, m) => s + m.expenses, 0) / Math.max(1, months.length)) + " " + T("avg.") },
      ]) + (Calc.coverage(d).partial ? hint(T("Months with only part of the data show what was entered, not a whole month.")) : "") + (cur ? `<p class="hint planned-note"><span class="planned-swatch"></span>${esc(T("{0} is not finished: income as planned from your income sources, expenses entered so far.", monthName(cur.start)))}</p>` : "")
      : hint(T("Add income and expenses to see this chart."))), "link\" data-go=\"expenses"));
    // Wave lines: inflows, outflows, saved (inflows − outflows) and, with the module, loan payments – month by month
    if (showTrend && months.length >= 2) {
      const hid = new Set(d.Settings.WaveHidden || []);
      const ser = [
        { key: "in", label: T("Inflows"), color: "var(--w-in)", values: months.map(m => m.income) },
        { key: "out", label: T("Outflows"), color: "var(--w-out)", values: months.map(m => m.expenses) },
        { key: "save", label: T("Saved"), color: "var(--w-save)", values: months.map(m => m.income - m.expenses) },
      ];
      if (moduleOn("loans") && d.Loans.some(l => l.MonthlyPayment > 0)) ser.push({ key: "loan", label: T("Loan payments"), color: "var(--w-loan)", values: months.map(m => Calc.loanPayments(d, m.start)) });
      const avgOf = s => s.values.reduce((a, b) => a + b, 0) / s.values.length;
      // No title: the lines and their names speak for themselves (the explanation is in the tooltip)
      parts.push(card(`<div class="wave-legend" data-tip="${esc(T("Saved = inflows minus outflows in that month. Click a name to show or hide its line."))}">${ser.map(s => `<button class="wave-key${hid.has(s.key) ? " off" : ""}" data-wave="${s.key}" style="--c:${s.color}"><i></i>${esc(s.label)}<small>${esc(T("avg. {0}", pln(avgOf(s))))}</small></button>`).join("")}</div>` +
        waveChart(months.map(m => m.month + (m.current ? " *" : "")), ser, axis, pln, hid)));
    }
    parts.push(card(heading(T("Outflows by category")) + hint(basisText(d)) +
      (cats.slices.length ? `<div class="chart-row">${donut(cats.slices, pln(cats.total), T("per month"))}${legend(cats.slices.map(s => ({ color: s.color, label: (s.icon ? s.icon + " " : "") + s.label, text: s.text, share: ChartData.share(s.value, cats.total) })))}</div>`
        : hint(T("Add expenses to see where your money goes."))), "link\" data-go=\"expenses"));
    parts.push(card(`<div class="link" data-go="portfolio">${heading(T("Your savings"))}${state ? `<span class="status-chip ${state}">${esc(state === "good" ? T("Growing") : state === "warn" ? T("Slow") : T("Shrinking"))}</span>` : ""}
      ${headline}${bars}${growthLine}${p.total > 0
        ? `<div class="chart-row">${donut(ChartData.money(p), pln(p.total), T("in total"))}${legend([...ChartData.money(p).map(s => ({ color: s.color, label: s.label, text: s.text, share: ChartData.share(s.value, p.total) })), { label: T("Interest p.a. (gross)"), text: pln(p.yearly) }])}</div>`
        : hint(T("Add your savings in the Savings tab to see this chart."))}</div>
      <hr><div class="link" data-go="emergency">${heading(T("Emergency fund"))}${emergency}</div>`, "savings-card status-" + (state || "none") + " em-" + emState));

    if (moduleOn("loans")) {
      // What is left today: worked out from the monthly payments made since you entered the loan
      const loans = d.Loans.filter(l => l.Remaining > 0).map(l => ({ ...l, Remaining: loanPlan(l).remainingNow })).filter(l => l.Remaining > 0).sort((a, b) => b.Remaining - a.Remaining);
      const total = loans.reduce((s, l) => s + l.Remaining, 0);
      const items = loans.map((l, i) => ({ label: l.Name, value: l.Remaining, color: COLORS.series[i % 6], text: pln(l.Remaining) }));
      // Paid back so far (green) – for loans where the amount at the start is known
      const paid = loans.reduce((s, l) => s + (l.Original > l.Remaining ? l.Original - l.Remaining : 0), 0);
      const ring = paid > 0 ? [...items, { label: T("Principal repaid"), value: paid, color: COLORS.leftOver, text: pln(paid) }] : items;
      const borrowed = total + paid;
      parts.push(card(heading(T("Loans & debts")) + (loans.length
        ? `<div class="chart-row">${donut(ring, pln(total), T("Remaining principal"))}${legend(ring.map(s => ({ ...s, share: ChartData.share(s.value, paid > 0 ? borrowed : total) })))}</div>` +
          (paid > 0 ? `<p class="good"><b>${esc(T("Principal amount repaid: {0} of {1} ({2}%)", pln(paid), pln(borrowed), Math.round(paid / borrowed * 100)))}</b></p>` : hint(T("Tip: enter how much you borrowed at the start (Loans & debts tab) to see how much is already paid back."))) +
          loans.map(l => loanWarning(l, true)).join("") + row(T("Loan payments per month"), pln(Calc.loanPayments(d))) + row(T("Debt-free"), monthName(new Date(Math.max(...loans.map(l => parseDate(l.EndDate).getTime())))))
        : hint(T("No loans – great!"))), "link\" data-go=\"loans"));
    }
    if (moduleOn("budget") && d.Goals.length) {
      const goals = [...d.Goals].sort((a, b) => parseDate(a.TargetDate) - parseDate(b.TargetDate)).map(g => ({ ...g, Saved: goalSaved(g, d) }));
      parts.push(card(heading(T("Savings goals")) + (goals.length ? goals.map(g => {
        const f = g.Target > 0 ? g.Saved / g.Target : 0, done = g.Target > 0 && g.Saved >= g.Target;
        return `<div class="bar-item"><b>${esc(g.Name)}</b>${progress(f, done ? COLORS.leftOver : "var(--goals)")}<span class="hint">${esc(done ? T("Goal reached – well done!")
          : T("{0} of {1} ({2}%) · by {3}", pln(Math.min(g.Saved, g.Target)), pln(g.Target), Math.round(Math.min(100, f * 100)), fmtDate(g.TargetDate)))}</span></div>`;
      }).join("") : ""), "link\" data-go=\"budget"));
    }
    if (moduleOn("budget")) parts.push(card(heading(T("Budget plan")) + hint(monthName(today())) + budgetBars(), "link\" data-go=\"budget"));
    if (license.isPro) {
      const ranked = d.Offers.map(o => ({ o, r: Calc.savings(o) })).filter(x => x.o.Amount > 0).sort((a, b) => b.r.net - a.r.net).slice(0, 4);
      const best = Rates.bestOffer();
      parts.push(card(heading(T("Compare offers")) + hint(T("Your saved offers: interest after the 19% tax.")) +
        (ranked.length ? hbars(ranked.map((x, i) => ({ label: x.o.Name.length > 20 ? x.o.Name.slice(0, 19) + "…" : x.o.Name, value: x.r.net, color: COLORS.series[i], text: `${pln(x.r.net)} · ${rate(x.r.effective)}` })))
          : hint(T("No offers saved yet. Add them in the Compare offers tab, or with the Compare button in Optimize my finances."))) +
        (best ? `<hr><p class="good">🏦 ${esc(T("Best rate right now: {0} – {1} ({2}).", best.Bank, best.Name || best.Bank, rate(best.Rate)))}</p>` : ""), "link\" data-go=\"savings"));
    }
    el.innerHTML = `<div class="grid">${parts.join("")}</div>`;
    el.querySelectorAll("[data-wave]").forEach(b => b.onclick = ev => {
      ev.stopPropagation();
      const h = new Set(d.Settings.WaveHidden || []), k = b.dataset.wave;
      h.has(k) ? h.delete(k) : h.add(k);
      d.Settings.WaveHidden = [...h]; save(); App.refresh();
    });
  },
};
/** What the expense averages are based on: the months that really have expenses (imported or entered). */
export function basisText(d) {
  const c = Calc.coverage(d);
  if (!c.months.length) return "";
  const from = fmtDate(c.from), to = fmtDate(c.to);
  if (c.short) return T("Based on {0} days of data ({1} – {2}). Amounts per month are an estimate – import or enter at least one whole month for reliable numbers.", c.days, from, to);
  if (c.partial) return T("Based on {0} days of data ({1} – {2}), converted to amounts per month.", c.days, from, to);
  return c.months.length === 1 ? T("Based on one whole month: {0} – {1}.", from, to)
    : T("Average per month of {0} whole months: {1} – {2}.", c.months.length, from, to);
}
/** A short orange warning when the data covers less than 3 weeks. */
export function shortDataWarning(d) {
  const c = Calc.coverage(d);
  return c.months.length && c.short ? `<p class="hint warn">⚠ ${esc(T("Only {0} days of data – the amounts per month are a rough estimate.", c.days))}</p>` : "";
}
const fmtNum = v => (Math.round(v * 10) / 10).toString().replace(".", ",");
const fmtMonthKey = k => monthName(new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1));
/** Remembers the total of your savings once a month, to show whether it grows. */
function recordSavings(d, total) {
  const now = today(), key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const h = d.Settings.SavingsHistory || (d.Settings.SavingsHistory = {});
  if (h[key] !== Math.round(total)) { h[key] = Math.round(total); save(); }
}
const axis = v => v >= 1000 ? (Math.round(v / 100) / 10).toString().replace(".", ",") + "k" : String(Math.round(v));

export function budgetBars() {
  const d = D();
  const names = categories().map(c => c.Name);
  const budgets = d.Budgets.filter(b => b.MonthlyLimit > 0).sort((a, b) => names.indexOf(a.Category) - names.indexOf(b.Category));
  if (!budgets.length) return hint(T("Set your limits in the Budget plan tab to see them here."));
  return budgets.map(b => {
    const spent = Calc.spentThisMonth(b.Category), f = spent / b.MonthlyLimit;
    const color = f > 1 ? "#DC2626" : f >= 0.8 ? "#F59E0B" : COLORS.leftOver;
    return `<div class="bar-item" data-budget="${esc(b.Category)}"><b>${esc(categoryLabel(b.Category))}</b>${progress(f, color)}<span class="hint">${esc(spent > b.MonthlyLimit
      ? T("{0} of {1} – over by {2}", pln(spent), pln(b.MonthlyLimit), pln(spent - b.MonthlyLimit))
      : T("{0} of {1} – {2} left", pln(spent), pln(b.MonthlyLimit), pln(b.MonthlyLimit - spent)))}</span></div>`;
  }).join("");
}

// ================================================================= Income

const INCOME_TYPES = ["Salary", "Side job", "Freelance", "Bonus", "Rent income", "Benefits", "Pension", "Investments", "Tax refund", "Other"];
const CURRENCIES = ["PLN", "USD", "EUR"];
const KINDS = [[RECEIVED.income, "Extra income (this month)"], [RECEIVED.salary, "Salary (regular pay)"], [RECEIVED.none, "Not income"]];
let editIncome = null;

export const Income = {
  route: "income", title: "Inflows",
  render(el) {
    const d = D(), s = d.Settings;
    const inc = Calc.income(d), avg = Calc.spending(d);
    const spending = avg.essential + avg.nonEssential, left = inc.monthlyTotal - spending;
    const extra = Calc.receivedIn(d, today());
    let message;
    if (!inc.monthlyTotal) message = T("Add your income below to see how much is left each month.");
    else if (!avg.monthsUsed) message = T("Add expenses in the Outflows tab to see how much is left each month.");
    else if (left < 0) message = T("You spend more than you earn on average. Check the not-essential costs in the Outflows tab.");
    else {
      const target = Calc.emergency(s).target, safe = Calc.portfolio(d).safe;
      message = target <= 0 ? T("Set your emergency fund target in the Emergency fund tab to see how long it takes to reach it.")
        : safe >= target ? T("Your emergency fund is complete. What's left over can go to savings or investments.")
        : T("If you save everything left over, your emergency fund ({0}) is complete in about {1} month(s).", pln(target), Math.ceil((target - safe) / Math.max(1, left)));
    }
    const e = editIncome ? d.Incomes.find(x => x.Id === editIncome) : null;
    const f = e || { Name: "", Type: "Salary", Amount: "", Currency: "PLN", Frequency: "Monthly", Date: isoDate(today()), Active: true };
    const up = Calc.upcoming(d, today(), addDays(today(), 60));
    const dayText = dt => { const n = Math.round((dt - today()) / 86400000); return n === 0 ? T("today") : n === 1 ? T("tomorrow") : T("in {0} days", n); };

    el.innerHTML = `<div class="grid">
      ${card(heading(T("Summary (PLN)")) +
        row(T("Regular income per month"), pln(inc.monthlyTotal)) +
        row(T("Regular income per year"), pln(inc.monthlyTotal * 12)) +
        row(T("One-time income in {0}", today().getFullYear()), pln(inc.oneTimeThisYear)) +
        (extra > 0 ? row(T("Extra income received this month (bank import)"), pln(extra)) : "") +
        row(T("Average outflows per month (Outflows tab)"), avg.monthsUsed ? pln(spending) : esc(T("no data yet"))) +
        row(T("Balance per month"), avg.monthsUsed ? pln(left) : "–", avg.monthsUsed && left < 0 ? "bad" : "good") +
        row(T("Savings rate"), avg.monthsUsed && inc.monthlyTotal > 0 ? savingsRateText(left, inc.monthlyTotal) : "–", avg.monthsUsed && left < 0 ? "bad" : "") +
        hint(message) + (inc.missing ? hint(T("Some income is in USD or EUR but the exchange rate is empty, so it counts as 0 zł. Enter the rates in the Savings tab."), "bad") : ""))}
      ${card(heading(T("Your income sources")) + hint(T("Tap a source to edit it. Switch off 'Active' for income that has stopped but you want to keep in the list.")) +
        (d.Incomes.length ? `<div class="list">${d.Incomes.map(i => {
          const next = Calc.nextIncome(i, today()), sp = Calc.incomeSpan(i);
          const info = i.Frequency === ONE_TIME ? `${T("one-time")} · ${T("on {0}", fmtDate(i.Date))}` : `${freqLabel(i.Frequency)} · ${next ? T("next {0}", fmtDate(next)) : T("ended")}${sp.start ? " · " + T("since {0}", fmtDate(sp.start)) : ""}${sp.end ? " · " + T("until {0}", fmtDate(sp.end)) : ""}`;
          return `<div class="item clickable${i.Active ? "" : " off"}" data-edit-income="${i.Id}"><div><b>${esc(i.Name)}</b><span class="hint">${esc(T(i.Type))} · ${esc(info)}${i.Active ? "" : " · " + esc(T("not active"))}</span></div>
            <div class="right"><b>${amount(i.Amount, i.Currency)}</b>${i.Frequency !== ONE_TIME ? `<span class="hint">${esc(T("{0} / month", pln(Calc.monthlyPln(i, s))))}</span>` : ""}${i.Gross > 0 ? `<span class="hint">${esc(T("gross {0}", pln(i.Gross)))}</span>` : ""}</div>
            <label class="switch" title="${esc(T("Active (count it in the totals)"))}"><input type="checkbox" data-active-income="${i.Id}"${i.Active ? " checked" : ""}><span></span></label>
            <button class="icon-btn danger" data-del-income="${i.Id}" title="${esc(T("Delete"))}">🗑</button></div>`;
        }).join("")}</div>` : hint(T("No income added yet."))))}
      ${card(heading(T("Next payments (next {0} days)", 60)) + (up.length ? `<div class="list">${up.slice(0, 20).map(p => `
          <div class="item"><div><b>${esc(p.source.Name)}</b><span class="hint">${fmtDate(p.date)} · ${esc(dayText(p.date))}</span></div><b class="good">${pln(p.amount)}</b></div>`).join("")}</div>`
        : hint(T("No payments expected in this period."))))}
      ${card(`<form id="income-form">${heading(e ? T("Edit: {0}", e.Name) : T("Add income"))}
        ${field(T("Name"), textInput("name", f.Name, T("e.g. {0}", T("Salary, side job"))))}
        <div class="two">${field(T("Type"), select("type", INCOME_TYPES.map(t => [t, T(t)]), f.Type))}
        ${field(T("Currency"), select("currency", CURRENCIES, f.Currency))}</div>
        <div class="gross-box"${f.Type === "Salary" && f.Currency === "PLN" ? "" : " hidden"}>
          <div class="cat-row">${field(T("Gross salary per month (brutto, optional)"), numInput("gross", plain(f.Gross), T("e.g. {0}", "10000")))}
          ${button("→ " + esc(T("Calculate net")), "calc-net", "second small")}</div>
          <p class="hint">${esc(T("Estimate for an employment contract (umowa o pracę) in Poland: social and health insurance and income tax. Bonuses, a sport card (Multisport), PPK, the under-26 relief, overtime or another kind of contract change your net pay – compare with your payslip and correct the net amount below if needed."))}</p>
        </div>
        ${field(T("Amount you receive each time (net, after tax)"), numInput("amount", plain(f.Amount), T("e.g. 8500 (what you actually receive, after tax)")))}
        <div class="two">${field(T("How often"), select("frequency", FREQUENCIES.map(x => [x[0], T(x[0])]), f.Frequency))}
        ${field(f.Frequency === ONE_TIME ? T("Date the money arrives") : T("Payment date"), dateInput("date", inputDate(parseDate(f.Date))))}</div>
        <p class="hint date-hint"${f.Frequency === ONE_TIME ? " hidden" : ""}>${esc(T("Any payment date – the last or the next one. MoneyCompass repeats it."))}</p>
        <div class="income-span"${f.Frequency === ONE_TIME ? " hidden" : ""}>
          <div class="two">${field(T("Start date (optional)"), dateInput("start", f.StartDate ? inputDate(parseDate(f.StartDate)) : ""))}
          <div class="field"><span>${esc(T("End date"))}</span>${dateInput("end", f.EndDate ? inputDate(parseDate(f.EndDate)) : "").replace("<input", `<input${f.EndDate ? "" : " disabled"}`)}
          <label class="check small"><input type="checkbox" name="noend"${f.EndDate ? "" : " checked"}><span>${esc(T("No end date"))}</span></label></div></div>
          ${hint(T("Start date: the first payment – nothing is counted before it, e.g. for a new job. Leave it empty for income you have had for a long time. Without an end date the income continues in all forecasts."))}
        </div>
        ${check("active", T("Active (count it in the totals)"), f.Active)}
        <div class="buttons">${button(e ? T("Save changes") : T("Add income"), "save-income", "main")}${e ? button(T("Cancel editing"), "cancel-income") : ""}</div></form>`)}
      ${card(heading(T("Imported inflows")) + hint(T("Money that came into your account, from your bank imports. Choose for each payment how it counts: Extra income – only in that month. Salary – your regular pay, counted every month through Your income sources. Not income – ignored.")) +
        (d.Received.length ? importedList(d)           : hint(T("Nothing imported yet."))))}
      ${binCard(["income", "received"])}
    </div>`;

    const form = el.querySelector("#income-form");
    form.frequency.onchange = () => {
      const lbl = form.date.closest(".field").querySelector("span");
      lbl.textContent = form.frequency.value === ONE_TIME ? T("Date the money arrives") : T("Payment date");
      el.querySelector(".income-span").hidden = form.frequency.value === ONE_TIME;
      el.querySelector(".date-hint").hidden = form.frequency.value === ONE_TIME;
    };
    form.noend.onchange = () => { form.end.disabled = form.noend.checked; if (form.noend.checked) form.end.value = ""; else form.end.focus(); };
    const grossBox = el.querySelector(".gross-box");
    const toggleGross = () => { grossBox.hidden = !(form.type.value === "Salary" && form.currency.value === "PLN"); };
    form.type.addEventListener("change", toggleGross); form.currency.addEventListener("change", toggleGross);
    el.querySelector('[data-action="calc-net"]').onclick = () => {
      const g = num(form.gross.value);
      if (!(g > 0)) { toast(T("Please enter an amount bigger than 0."), "bad"); return; }
      form.amount.value = plain(netFromGross(g));
      form.amount.classList.add("flash"); setTimeout(() => form.amount.classList.remove("flash"), 900);
      toast(T("Net about {0} – you can still change it.", pln(netFromGross(g))));
    };
    form.onsubmit = ev => { ev.preventDefault(); saveIncome(form); };
    el.querySelector('[data-action="save-income"]').onclick = () => saveIncome(form);
    const cancel = el.querySelector('[data-action="cancel-income"]');
    if (cancel) cancel.onclick = () => { editIncome = null; App.refresh(); };
    el.querySelectorAll("[data-active-income]").forEach(c => c.onchange = () => {
      const i = d.Incomes.find(y => y.Id === c.dataset.activeIncome); i.Active = c.checked; save(); App.refresh();
    });
    el.querySelectorAll("[data-edit-income]").forEach(x => x.onclick = ev => {
      if (ev.target.closest("[data-del-income], .switch")) return;
      editIncome = x.dataset.editIncome; App.refresh(); window.scrollTo({ top: 0, behavior: "smooth" });
    });
    el.querySelectorAll("[data-del-income]").forEach(b => b.onclick = async () => {
      const i = d.Incomes.find(x => x.Id === b.dataset.delIncome);
      if (await confirmBox(T("Delete?"), i.Name, T("Delete"), T("Cancel"), true)) {
        toBin("income", i); d.Incomes = d.Incomes.filter(x => x !== i); if (editIncome === i.Id) editIncome = null; save(); App.refresh();
      }
    });
    el.querySelectorAll('select[name^="kind-"]').forEach(sel => sel.onchange = async () => {
      const r = d.Received.find(x => x.Id === sel.name.slice(5));
      r.Kind = sel.value; save();
      if (r.Kind === RECEIVED.salary) await offerSalary(r);
      App.refresh();
    });
    el.querySelectorAll("[data-rec-filter]").forEach(b => b.onclick = () => { recFilter = b.dataset.recFilter; App.refresh(); });
    el.querySelectorAll("details.rec-month").forEach(x => x.addEventListener("toggle", () => recOpen.set(+x.dataset.month, x.open)));
    el.querySelectorAll("[data-repeat-rec]").forEach(b => b.onclick = () => {
      const r = d.Received.find(x => x.Id === b.dataset.repeatRec);
      pickRepeat(receivedRepeatOn(d, r), freq => {
        setReceivedRepeat(d, r, freq); save();
        toast(freq ? T("{0} repeats: {1} – see the Calendar.", r.Description || "–", freqLabel(freq)) : T("{0} no longer repeats.", r.Description || "–"));
        App.refresh();
      });
    });
    el.querySelectorAll("[data-del-received]").forEach(b => b.onclick = async () => {
      if (await confirmBox(T("Delete?"), T("Remove this received payment from MoneyCompass?"), T("Delete"), T("Cancel"), true)) {
        toBin("received", d.Received.find(x => x.Id === b.dataset.delReceived)); d.Received = d.Received.filter(x => x.Id !== b.dataset.delReceived); save(); App.refresh();
      }
    });
  },
};
/** Imported inflows, month by month: the newest month open, older ones folded – so a long import stays short.
 *  A filter shows only salary, extra income or "not income". */
let recFilter = "", recOpen = new Map();
function importedList(d) {
  const rows = [...d.Received].filter(r => !recFilter || r.Kind === recFilter).sort((a, b) => parseDate(b.Date) - parseDate(a.Date));
  const months = new Map();
  for (const r of rows) { const m = monthStart(parseDate(r.Date)), k = m.getTime(); if (!months.has(k)) months.set(k, { m, list: [] }); months.get(k).list.push(r); }
  const count = k => d.Received.filter(r => r.Kind === k).length;
  const chips = [["", T("All") + " (" + d.Received.length + ")"], ...KINDS.map(([k, n]) => [k, T(n).replace(/ \(.*\)$/, "") + " (" + count(k) + ")"])];
  const item = r => `
          <div class="item"><div><b>${esc(r.Description || "–")}</b><span class="hint">${fmtDate(r.Date)} · +${pln(r.Amount)}${r.Own ? " · 🔁 " + esc(T("from your own account")) : ""}${r.Kind === RECEIVED.income ? (rr => ` · <button class="rep-tag${rr ? " on" : ""}" data-repeat-rec="${r.Id}" title="${esc(T("How often does it repeat?"))}">🔁 ${esc(rr ? freqLabel(rr) : T("Does not repeat"))}</button>`)(receivedRepeatOn(d, r)) : ""}</span></div>
          ${select("kind-" + r.Id, KINDS.map(k => [k[0], T(k[1])]), r.Kind)}${infoBtn("received", r)}
          <button class="icon-btn danger" data-del-received="${r.Id}" title="${esc(T("Delete"))}">🗑</button></div>`;
  let first = true;
  const groups = [...months.values()].map(({ m, list }) => {
    const k = m.getTime(), open = recOpen.has(k) ? recOpen.get(k) : first; first = false;
    const sum = list.filter(r => r.Kind !== RECEIVED.none).reduce((a, r) => a + r.Amount, 0);
    return `<details class="rec-month" data-month="${k}"${open ? " open" : ""}><summary><b>${esc(monthName(m))}</b>
      <span class="hint">${esc(T("{0} payments", list.length))} · <b class="good">+${pln(sum)}</b></span></summary><div class="list">${list.map(item).join("")}</div></details>`;
  }).join("");
  return `<div class="chips rec-filter">${chips.map(([k, l]) => `<button class="chip${recFilter === k ? " on" : ""}" data-rec-filter="${k}">${esc(l)}</button>`).join("")}</div>` +
    (groups || hint(T("Nothing here with this filter.")));
}
function saveIncome(form) {
  const v = values(form), d = D();
  const amt = num(v.amount);
  if (!(amt > 0)) { toast(T("Please enter an amount bigger than 0."), "bad"); return; }
  const date = v.date ? isoDate(parseDate(v.date)) : isoDate(today());
  const name = v.name.trim() || T(v.type);
  const once = v.frequency === ONE_TIME;
  const startD = !once && v.start ? parseDate(v.start) : null, endD = !once && !v.noend && v.end ? parseDate(v.end) : null;
  if (!once && !v.noend && !v.end) { toast(T("Enter the end date, or tick \"No end date\"."), "bad"); return; }
  if (startD && endD && endD < startD) { toast(T("The last payment can't be before the first one."), "bad"); return; }
  const span = { StartDate: startD ? isoDate(startD) : null, EndDate: endD ? isoDate(endD) : null };
  if (editIncome) {
    Object.assign(d.Incomes.find(x => x.Id === editIncome), { Name: name, Type: v.type, Amount: amt, Currency: v.currency, Frequency: v.frequency, Date: date, Active: v.active, Gross: num(v.gross) || 0, ...span });
    toast(T("Updated: {0}.", name)); editIncome = null;
  } else {
    d.Incomes.push({ Id: uuid(), Name: name, Type: v.type, Amount: amt, Currency: v.currency, Frequency: v.frequency, Date: date, Active: v.active, Gross: num(v.gross) || 0, ...span });
    toast(T("Added: {0}.", name));
  }
  save(); App.refresh();
}
/** A payment marked as salary: offer to add it as a monthly income source. */
export async function offerSalary(r) {
  const d = D();
  if (d.Incomes.some(i => i.Active && i.Frequency !== ONE_TIME && Math.abs(Calc.toPln(i.Amount, i.Currency, d.Settings) - r.Amount) < 1)) return;
  const day = parseDate(r.Date).getDate();
  if (await confirmBox(T("Salary"), T("Add {0} as your monthly salary? MoneyCompass then counts it every month (Your income sources), with payday on the {1}.", pln(r.Amount), day + "."), T("Add salary"), T("Not now"))) {
    d.Incomes.push({ Id: uuid(), Name: T("Salary"), Type: "Salary", Amount: r.Amount, Currency: "PLN", Frequency: "Monthly", Date: isoDate(parseDate(r.Date)), Active: true });
    save();
  }
}

// ================================================================= Expenses

let showAllMonths = false;
const flt = { cat: "", text: "", ess: "", rep: false, min: "", max: "", days: "" };   // filter of "Your expenses"
export const Expenses = {
  route: "expenses", title: "Outflows",
  render(el) {
    const d = D();
    const avg = Calc.spending(d);
    const cats = ChartData.categories(d);
    const cat0 = categories()[0];
    const months = [];
    const filtering = !!(flt.cat || flt.text.trim() || flt.ess || flt.rep || flt.min || flt.max || flt.days);
    const minA = num(flt.min), maxA = num(flt.max), since = flt.days ? addDays(today(), -(+flt.days)) : null;
    const words = flt.text.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const shown = d.Expenses.filter(e => (!flt.cat || e.Category === flt.cat) && (!(minA > 0) || e.Amount >= minA) && (!(maxA > 0) || e.Amount <= maxA) && (!since || parseDate(e.Date) >= since) && (!flt.ess || (flt.ess === "yes") === !!e.Essential) && (!flt.rep || !!repeatOn(e)) &&
      words.every(w => `${e.Description || ""} ${T(e.Category)} ${plain(e.Amount)} ${e.Info ? Object.values(e.Info).join(" ") : ""}`.toLowerCase().includes(w)));
    const sorted = shown.sort((a, b) => parseDate(b.Date) - parseDate(a.Date));
    for (const e of sorted) {
      const m = monthStart(parseDate(e.Date)), last = months[months.length - 1];
      if (!last || last.start.getTime() !== m.getTime()) months.push({ start: m, items: [e] }); else last.items.push(e);
    }
    const visible = showAllMonths || filtering ? months : months.slice(0, 3);
    const usedCats = [...new Set(d.Expenses.map(e => e.Category))].sort((a, b) => T(a).localeCompare(T(b)));
    const filterBar = d.Expenses.length ? `<div class="filter-bar">
      <input type="search" name="f-text" value="${esc(flt.text)}" placeholder="🔍 ${esc(T("Search: shop, amount…"))}">
      <select name="f-cat"><option value="">${esc(T("All categories"))}</option>${usedCats.map(c => `<option value="${esc(c)}"${c === flt.cat ? " selected" : ""}>${esc(categoryLabel(c))}</option>`).join("")}</select>
      <select name="f-ess"><option value="">${esc(T("All"))}</option><option value="yes"${flt.ess === "yes" ? " selected" : ""}>${esc(T("Essential"))}</option><option value="no"${flt.ess === "no" ? " selected" : ""}>${esc(T("Not essential"))}</option></select>
      <select name="f-days"><option value="">${esc(T("Whole period"))}</option>${[30, 90, 180, 365].map(n => `<option value="${n}"${String(n) === flt.days ? " selected" : ""}>${esc(T("Last {0} days", n))}</option>`).join("")}</select>
      <span class="amount-range"><input name="f-min" inputmode="decimal" value="${esc(flt.min)}" placeholder="${esc(T("Amount from"))} zł" data-tip="${esc(T("Amount from"))} (zł)"><span>–</span><input name="f-max" inputmode="decimal" value="${esc(flt.max)}" placeholder="${esc(T("Amount to"))} zł" data-tip="${esc(T("Amount to"))} (zł)"></span>
      <label class="check"><input type="checkbox" name="f-rep"${flt.rep ? " checked" : ""}><span>🔁 ${esc(T("Repeating only"))}</span></label>
      ${filtering ? `<button class="btn second small" data-action="f-clear">✕ ${esc(T("Clear filter"))}</button>` : ""}</div>` +
      (filtering ? `<p class="filter-result">${esc(T("Outflows found: {0} · together {1}", shown.length, pln(shown.reduce((s, e) => s + e.Amount, 0))))}</p>` : "") : "";
    const older = months.slice(3).reduce((s, m) => s + m.items.length, 0);
    const loans = Calc.loanPayments(d);

    const otherCount = d.Expenses.filter(x => x.Category === OTHER).length;
    el.innerHTML = `<div class="grid">
      ${otherCount >= 2 ? `<button class="tip" data-action="sort-other">🏷 ${esc(T("{0} outflows are in \"Other\" – sort them by shop in one go →", otherCount))}</button>` : ""}
      ${card(heading(T("Monthly average")) + (avg.monthsUsed ? row(T("Essential"), pln(avg.essential)) + row(T("Not essential"), pln(avg.nonEssential)) + row(T("Total per month"), pln(avg.essential + avg.nonEssential)) +
          hint(basisText(d)) +
          (loans > 0 ? hint(T("Includes {0} per month of loan payments from the Loans & debts tab. Expenses in the \"Loan payments\" category are not counted, so nothing is counted twice.", pln(loans))) : "")
        : hint(T("Add expenses to see your averages."))))}
      ${card(heading(T("Outflows by category")) + hint(basisText(d)) + (cats.all.length
        ? `<div class="chart-row">${donut(cats.slices, pln(cats.total), T("per month"))}${legend(cats.all.map((c, n) => ({
            key: c.category, color: n < 6 ? COLORS.series[n] : COLORS.other, label: categoryLabel(c.category), text: pln(c.perMonth), share: ChartData.share(c.perMonth, cats.total) })))}</div>` + hint(T("Click to see these expenses"))
        : hint(T("Add expenses to see where your money goes."))))}
      ${card(`<form id="expense-form">${heading(T("Add an expense"))}
        <div class="two">${field(T("Date"), dateInput("date", inputDate(today())))}${field(T("Amount (zł)"), numInput("amount", "", T("e.g. {0}", "120,50")))}</div>
        <div class="cat-row">${field(T("Category"), select("category", [...categories().map(c => [c.Name, categoryLabel(c.Name)]), NEW_CAT()], cat0.Name))}
          ${button(T("Categories…"), "categories", "second small")}</div>
        ${field(T("Description (optional)"), textInput("description", "", T("e.g. {0}", "Biedronka")))}
        <div class="two">${field(T("Repeats"), select("repeat", REPEAT_OPTIONS(), ""))}<div class="hint">${esc(T("Repeating expenses appear automatically in the Calendar, also in the next months."))}</div></div>
        ${check("essential", T("Essential (must pay even in a crisis)"), cat0.Essential)}
        <div class="buttons">${button(T("Add expense"), "add-expense", "main")}</div></form>`)}
      ${card(heading(T("Outflow history")) + hint(T("Click an expense to switch it between essential and not essential. The pen changes date, category, amount and more.")) + filterBar +
        (months.length ? visible.map(m => {
          const total = m.items.reduce((s, e) => s + e.Amount, 0), ess = m.items.filter(e => e.Essential).reduce((s, e) => s + e.Amount, 0);
          return `<div class="month-head">${esc(T("{0}  ·  total {1}  ·  essential {2}", monthName(m.start), pln(total), pln(ess)))}</div><div class="list">${m.items.map(expenseRow).join("")}</div>`;
        }).join("") + (!showAllMonths && older ? button(T("Show older expenses ({0})", older), "older", "second") : "")
          : hint(filtering ? T("No expenses match this filter.") : T("No expenses yet."))), "wide")}
      ${movedCard(d)}
      ${binCard(["expense"])}
    </div>`;

    const form = el.querySelector("#expense-form");
    form.category.onchange = () => { form.essential.checked = !!findCategory(form.category.value)?.Essential; };
    el.querySelector('[data-action="add-expense"]').onclick = () => {
      const v = values(form), amt = num(v.amount);
      if (!(amt > 0)) { toast(T("Please enter an amount bigger than 0."), "bad"); return; }
      d.Expenses.push({ Id: uuid(), Date: isoDate(v.date ? parseDate(v.date) : today()), Description: v.description.trim(), Category: v.category, Amount: amt, Essential: v.essential, Repeat: v.repeat || "" });
      save(); toast(T("Added: {0}, {1}.", T(v.category), pln(amt))); App.refresh();
    };
    el.querySelector('[data-action="categories"]').onclick = () => manageCategories();
    el.querySelector('[data-action="sort-other"]')?.addEventListener("click", () => sortOther(() => App.refresh()));
    const olderBtn = el.querySelector('[data-action="older"]');
    if (olderBtn) olderBtn.onclick = () => { showAllMonths = true; App.refresh(); };
    // Filter: re-draw the list, and keep typing in the search box
    const ft = el.querySelector('[name="f-text"]');
    if (ft) {
      let timer;
      ft.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { flt.text = ft.value; App.refresh();
        // the cards are laid out again just after drawing, so put the cursor back a moment later
        setTimeout(() => { const n = document.querySelector('[name="f-text"]'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 30); }, 350); };
      el.querySelector('[name="f-cat"]').onchange = e => { flt.cat = e.target.value; App.refresh(); };
      el.querySelector('[name="f-ess"]').onchange = e => { flt.ess = e.target.value; App.refresh(); };
      el.querySelector('[name="f-rep"]').onchange = e => { flt.rep = e.target.checked; App.refresh(); };
      el.querySelector('[name="f-days"]').onchange = e => { flt.days = e.target.value; App.refresh(); };
      ["min", "max"].forEach(k => { el.querySelector(`[name="f-${k}"]`).onchange = e => { flt[k] = e.target.value.trim(); App.refresh(); }; });
      const clr = el.querySelector('[data-action="f-clear"]'); if (clr) clr.onclick = () => { Object.assign(flt, { cat: "", text: "", ess: "", rep: false, min: "", max: "", days: "" }); App.refresh(); };
    }
    el.querySelectorAll(".legend-row[data-cat]").forEach(r => r.onclick = () => showCategory(r.dataset.cat));
    bindExpenseRows(el);
  },
};
/** Money moved to your own accounts (from bank imports): shown month by month, not counted as spending. */
function movedCard(d) {
  const tr = (d.Transfers || []).filter(t => t.Amount > 0 && !t.Back && t.Date).sort((a, b) => parseDate(b.Date) - parseDate(a.Date));
  if (!tr.length) return "";
  const byMonth = new Map();
  for (const t of tr) { const k = monthStart(parseDate(t.Date)).getTime(); if (!byMonth.has(k)) byMonth.set(k, []); byMonth.get(k).push(t); }
  return card(heading(T("Moved to your own accounts"), "🔁") + hint(T("Transfers from your bank imports to your own accounts (savings, another bank). Not spending – they are not counted in your outflows.")) +
    [...byMonth.entries()].map(([k, items], n) => `<details class="rec-month"${n === 0 ? " open" : ""}><summary><b>${esc(monthName(new Date(k)))}</b>
      <span class="hint">${esc(T("{0} transfers", items.length))} · <b>${pln(items.reduce((a, t) => a + t.Amount, 0))}</b></span></summary>
      <div class="list">${items.map(t => `<div class="item"><div><b>${esc(t.Description || "–")}</b><span class="hint">${fmtDate(t.Date)}${t.Saved ? " · 🏦 " + esc(T("Savings")) : ""}${t.Info?.OtherAccount ? " → " + esc(t.Info.OtherAccount) : ""}</span></div><b>${pln(t.Amount)}</b></div>`).join("")}</div></details>`).join(""));
}
const REPEAT_OPTIONS = (cur = "") => [["", T("Does not repeat")], ...FREQUENCIES.filter(f => f[0] !== ONE_TIME).map(f => [f[0], "🔁 " + T(f[0])]),
  ...(parseCustom(cur) ? [[cur, "🔁 " + freqLabel(cur)]] : [])];
function expenseRow(e) {
  const icon = categoryIcon(e.Category);
  const rep = repeatOn(e);
  return `<div class="item expense" data-id="${e.Id}">
    <div class="toggle" data-toggle="${e.Id}" title="${esc(T("Click to switch between essential and not essential"))}"><b>${esc(e.Description || T(e.Category))}</b>
      <span class="hint">${fmtDate(e.Date)} · ${esc((icon ? icon + " " : "") + T(e.Category))} · <span class="${e.Essential ? "ess" : "noness"}">${esc(e.Essential ? T("Essential") : T("Not essential"))}</span> · <button class="rep-tag${rep ? " on" : ""}" data-repeat="${e.Id}" title="${esc(T("How often does it repeat?"))}">🔁 ${esc(rep ? freqLabel(rep) : T("Does not repeat"))}</button></span></div>
    <b>${pln(e.Amount)}</b>${infoBtn("expense", e)}
    <button class="icon-btn c-repeat${rep ? " on" : ""}" data-repeat="${e.Id}" title="${esc(rep ? T("Repeats: {0} – click to change", freqLabel(rep)) : T("Click to choose how often it repeats"))}">${ICON.repeat}</button>
    <button class="icon-btn c-edit${e.Edited ? " on" : ""}" data-edit="${e.Id}" title="${esc(e.Edited ? T("Changed by you – click to change again") : T("Change"))}">${ICON.edit}</button>
    <button class="icon-btn c-del" data-del="${e.Id}" title="${esc(T("Delete"))}">${ICON.trash}</button></div>`;
}
/** Choose how often an expense repeats: the usual ones, or your own (every N days / weeks / months). */
export function pickRepeat(current, done) {
  const c = parseCustom(current) || { n: 3, unit: "d" };
  const opts = [["", T("Does not repeat")], ...FREQUENCIES.filter(f => f[0] !== ONE_TIME).map(f => [f[0], T(f[0])])];
  const p = popup(`<div class="box-head"><span class="box-icon rep">🔁</span><h2>${esc(T("How often does it repeat?"))}</h2></div>
    <div class="rep-choices">${opts.map(([v, l]) => `<button class="chip${v === (current || "") ? " on" : ""}" data-f="${esc(v)}">${esc(l)}</button>`).join("")}</div>
    <h3>${esc(T("Your own"))}</h3>
    <div class="rep-own${parseCustom(current) ? " on" : ""}"><span>${esc(T("Every"))}</span><input type="number" name="n" min="1" max="999" value="${c.n}">
      ${select("unit", [["d", T("days")], ["w", T("weeks")], ["m", T("months")]], c.unit)}
      <button class="btn main small" data-own>${esc(T("OK"))}</button></div>
    ${hint(T("Repeating expenses appear automatically in the Calendar, also in the next months."))}
    <div class="box-buttons"><button class="btn second" data-close>${esc(T("Cancel"))}</button></div>`, { width: 460, cls: "box" });
  p.el.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { p.close(); done(b.dataset.f); });
  p.el.querySelector("[data-own]").onclick = () => {
    const n = +p.el.querySelector('[name="n"]').value, unit = p.el.querySelector('[name="unit"]').value;
    if (!(n >= 1)) return;
    p.close();
    // "Every 1 week" is simply Weekly, and so on
    const plain = n === 1 ? { d: "Daily", w: "Weekly", m: "Monthly" }[unit] : n === 2 && unit === "w" ? "Every 2 weeks" : n === 3 && unit === "m" ? "Quarterly" : n === 6 && unit === "m" ? "Twice a year" : n === 12 && unit === "m" ? "Yearly" : "";
    done(plain || customFrequency(n, unit));
  };
}
/** The repeat of this expense's series ("Monthly"…), or "" when it does not repeat. */
function repeatOn(e) {
  const k = seriesKey(e);
  const r = State.data.Expenses.find(x => x.Repeat && seriesKey(x) === k);
  return r ? r.Repeat : "";
}
function bindExpenseRows(root, after = () => App.refresh()) {
  const d = D();
  root.querySelectorAll("[data-repeat]").forEach(x => x.onclick = ev => {
    ev.stopPropagation();
    const e = d.Expenses.find(y => y.Id === x.dataset.repeat);
    pickRepeat(repeatOn(e), freq => {
      const name = e.Description || T(e.Category);
      setRepeat(d, e, "");
      if (freq) {
        // The newest payment of this expense carries the repeat
        const k = seriesKey(e);
        const newest = d.Expenses.filter(y => seriesKey(y) === k).reduce((a, b) => parseDate(a.Date) > parseDate(b.Date) ? a : b);
        setRepeat(d, newest, freq); toast(T("{0} repeats: {1} – see the Calendar.", name, freqLabel(freq)));
      } else toast(T("{0} no longer repeats.", name));
      save(); after();
    });
  });
  root.querySelectorAll("[data-toggle]").forEach(x => x.onclick = () => {
    const e = d.Expenses.find(y => y.Id === x.dataset.toggle); e.Essential = !e.Essential; save(); after();
  });
  root.querySelectorAll("[data-edit]").forEach(x => x.onclick = () => editExpense(d.Expenses.find(y => y.Id === x.dataset.edit), after));
  root.querySelectorAll("[data-del]").forEach(x => x.onclick = async () => {
    const e = d.Expenses.find(y => y.Id === x.dataset.del);
    if (await confirmBox(T("Delete?"), `${e.Description || T(e.Category)} · ${pln(e.Amount)}`, T("Delete"), T("Cancel"), true)) {
      toBin("expense", e); d.Expenses = d.Expenses.filter(y => y !== e); save(); after();
    }
  });
}
function editExpense(e, after) {
  const p = popup(`<h2 class="popup-title">${esc(T("Change expense"))}</h2><form>
    <div class="two">${field(T("Date"), dateInput("date", inputDate(parseDate(e.Date))))}${field(T("Amount (zł)"), numInput("amount", plain(e.Amount)))}</div>
    ${field(T("Category"), select("category", [...categories().map(c => [c.Name, categoryLabel(c.Name)]), NEW_CAT()], e.Category))}
    ${field(T("Description"), textInput("description", e.Description))}
    ${field(T("Repeats"), select("repeat", REPEAT_OPTIONS(repeatOn(e)), repeatOn(e)))}
    ${check("essential", T("Essential (must pay even in a crisis)"), e.Essential)}</form>
    <div class="popup-buttons"><button class="btn second" data-close>${esc(T("Cancel"))}</button><button class="btn main" data-save>${esc(T("Save"))}</button></div>`, { width: 520 });
  p.el.querySelector("[data-save]").onclick = () => {
    const v = values(p.el), amt = num(v.amount);
    if (!(amt > 0)) { toast(T("Please enter an amount bigger than 0."), "bad"); return; }
    const before = repeatOn(e);
    const changed = isoDate(parseDate(v.date)) !== e.Date || amt !== e.Amount || v.category !== e.Category || v.description.trim() !== e.Description;
    Object.assign(e, { Date: isoDate(parseDate(v.date)), Amount: amt, Category: v.category, Description: v.description.trim(), Essential: v.essential });
    if (changed) e.Edited = true;
    if (v.repeat !== before) { setRepeat(D(), e, ""); if (v.repeat) setRepeat(D(), e, v.repeat); }
    const oldCat = p.oldCat;
    save(); p.close(); after();
    if (v.category !== oldCat) offerSameCategory(e, after);
  };
  p.oldCat = e.Category;
}
/** You changed the category of one expense: the same shop or payee can get it everywhere, and in future imports. */
async function offerSameCategory(e, after) {
  const d = D(), others = similarExpenses(d, e).filter(x => x.Category !== e.Category);
  learnCategory(d, e.Description, e.Category); save();
  if (!others.length) return;
  const ok = await confirmBox(T("Change the same ones too?"),
    T("{0} more outflows look like \"{1}\". Put all of them in \"{2}\" too?\nNew bank imports from there will get this category automatically.", others.length, e.Description, categoryLabel(e.Category)),
    T("Yes, change all {0}", others.length), T("Only this one"), false, "🏷");
  if (!ok) return;
  setCategory(others, e.Category); save(); after();
  toast(T("{0} outflows moved to {1}.", others.length + 1, categoryLabel(e.Category)), "good");
}
/** All outflows in "Other", grouped by shop or payee: give each group a category in one go. */
function sortOther(after) {
  const d = D();
  const draw = () => {
    const groups = new Map();
    for (const x of d.Expenses.filter(x => x.Category === OTHER)) {
      const k = matchKey(x.Description) || "—"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x);
    }
    const list = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || b[1].reduce((s, x) => s + x.Amount, 0) - a[1].reduce((s, x) => s + x.Amount, 0));
    return `<h2 class="popup-title">🏷 ${esc(T("Sort the \"Other\" outflows"))}</h2>
      ${hint(T("The same shops and payees are grouped. Choose a category for a group – all its outflows move there, and new bank imports from there get it automatically."))}
      ${list.length ? `<div class="list scroll sort-other">${list.slice(0, 80).map(([k, xs]) => `<div class="item"><div><b>${esc(xs[0].Description || T("No description"))}</b>
        <span class="hint">${esc(T("{0} × · together {1}", xs.length, pln(xs.reduce((s, x) => s + x.Amount, 0))))}</span></div>
        <select data-group="${esc(k)}">${[...categories().map(c => [c.Name, categoryLabel(c.Name)])].map(([v, l]) => `<option value="${esc(v)}"${v === OTHER ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>`).join("")}</div>`
        : `<p class="good">✔ ${esc(T("Nothing left in \"Other\"."))}</p>`}
      <div class="popup-buttons"><button class="btn main" data-close>${esc(T("Done"))}</button></div>`;
  };
  const p = popup(draw(), { width: 680, onClose: () => after() });
  const bind = () => p.el.querySelectorAll("[data-group]").forEach(sel => sel.onchange = () => {
    const k = sel.dataset.group, xs = d.Expenses.filter(x => x.Category === OTHER && (matchKey(x.Description) || "—") === k);
    if (!xs.length || sel.value === OTHER) return;
    setCategory(xs, sel.value); learnCategory(d, xs[0].Description, sel.value); save();
    toast(T("{0} outflows moved to {1}.", xs.length, categoryLabel(sel.value)), "good");
    p.el.innerHTML = draw(); bind();
  });
  bind();
}
function showCategory(name) {
  const d = D();
  const draw = () => {
    const list = d.Expenses.filter(e => e.Category === name).sort((a, b) => parseDate(b.Date) - parseDate(a.Date));
    const per = Advisor.spendingByCategory(d).find(c => c.category === name);
    return `<h2 class="popup-title">${esc(categoryLabel(name))}</h2>` +
      (name === LOAN_CATEGORY && Calc.loansCounted(d) ? hint(T("Monthly payments from the Loans & debts tab.")) : "") +
      (per ? hint(T("Average per month: {0}", pln(per.perMonth))) : "") +
      hint(T("{0} expenses, together {1}.", list.length, pln(list.reduce((s, e) => s + e.Amount, 0)))) +
      `<div class="list scroll">${list.map(expenseRow).join("")}</div><div class="popup-buttons"><button class="btn second" data-close>${esc(T("Close"))}</button></div>`;
  };
  const p = popup(draw(), { width: 640, onClose: () => App.refresh() });
  const redraw = () => { p.el.innerHTML = draw(); bindExpenseRows(p.el, redraw); };
  bindExpenseRows(p.el, redraw);
}
export async function manageCategories() {
  if (!(await requirePro(T("Own categories")))) return;
  const d = D();
  const draw = () => `<h2 class="popup-title">${esc(T("Your own categories"))}</h2>
    ${hint(T("Delete a category with the red button. Its expenses move to \"Other\"."))}
    <div class="list">${d.Categories.length ? d.Categories.map(c => `<div class="item"><div><b>${esc((c.Icon ? c.Icon + " " : "") + c.Name)}</b>
      <span class="hint">${esc(c.Essential ? T("Essential") : T("Not essential"))}</span></div>
      <button class="icon-btn danger" data-del-cat="${esc(c.Name)}">🗑</button></div>`).join("") : hint(T("No own categories yet."))}</div>
    <hr><h3>${esc(T("New category"))}</h3>
    <div class="two">${field(T("Name"), textInput("name", "", T("e.g. {0}", T("Pets"))))}${field(T("Icon"), select("icon", ICON_CHOICES, "📦"))}</div>
    ${check("essential", T("Essential (must pay even in a crisis)"), false)}
    <div class="popup-buttons"><button class="btn second" data-close>${esc(T("Close"))}</button><button class="btn main" data-add>${esc(T("Add category"))}</button></div>`;
  const p = popup(draw(), { width: 560, onClose: () => App.refresh() });
  const bind = () => {
    p.el.querySelector("[data-add]").onclick = () => {
      const v = values(p.el), err = addCategory(v.name, v.essential, v.icon);
      if (err) { toast(err, "bad"); return; }
      toast(T("New category: {0}", v.name.trim())); p.el.innerHTML = draw(); bind();
    };
    p.el.querySelectorAll("[data-del-cat]").forEach(b => b.onclick = async () => {
      if (await confirmBox(T("Delete category?"), T("Expenses in \"{0}\" move to \"Other\". A budget limit for it is removed.", b.dataset.delCat), T("Delete"), T("Cancel"), true)) {
        removeCategory(b.dataset.delCat); p.el.innerHTML = draw(); bind();
      }
    });
  };
  bind();
}

// ================================================================= Emergency fund

export const Emergency = {
  route: "emergency", title: "Emergency fund",
  render(el) {
    const d = D(), s = d.Settings, r = Calc.emergency(s), safe = Calc.portfolio(d).safe;
    let status;
    if (r.target <= 0) status = hint(T("Enter your costs above to see your target."));
    else if (!d.Holdings.length) status = hint(T("Add your safe savings in the Savings tab to see how much of this target you already have."));
    else if (safe >= r.target) status = `<p class="good">${esc(T("Your safe money ({0}) fully covers this target.", pln(safe)))}</p>`;
    else status = progress(safe / r.target, safe / r.target >= 0.5 ? "#F59E0B" : "#DC2626") + `<p class="warn">${esc(T("Your safe money ({0}) covers {1}% of this target. Still missing: {2}.", pln(safe), Math.round(safe / r.target * 100), pln(r.target - safe)))}</p>`;
    el.innerHTML = `<div class="grid">
      ${card(heading(T("Result")) + row(T("Monthly need (incl. yearly costs / 12)"), pln(r.monthly)) + row(T("3 months (with buffer)"), pln(r.three)) +
        row(T("6 months (with buffer)"), pln(r.six)) + row(T("Your target"), pln(r.target), "big") + status)}
      ${card(heading(T("Where to keep it")) + `<p>${esc(T("In a Polish bank savings account, in złoty: protected by the BFG up to €100,000 and available the same day. Not in crypto, and not in a long fixed deposit (lokata), because breaking it early usually loses the interest."))}</p>`)}
      ${card(`<form id="em">${heading(T("Your monthly costs"))}${hint(T("Only costs you must pay even in a crisis: rent, bills, food, transport, insurance, loan payments."))}
        ${field(T("Essential costs per month (zł)"), numInput("monthly", plain(s.MonthlyEssentials), T("e.g. {0}", "4500")))}
        ${button(T("Use my average from the Outflows tab"), "use-avg", "second small")}<p class="hint" id="avg-note"></p>
        ${field(T("Yearly costs (zł per year) - car insurance, car service, home insurance, yearly subscriptions"), numInput("yearly", plain(s.YearlyCosts), T("e.g. {0}", "3000")))}
        <h3>${esc(T("Settings"))}</h3>
        <div class="two">${field(T("Months to cover (3 if your job is stable, 6 if less certain)"), select("months", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], s.EmergencyMonths))}
        ${field(T("Extra safety buffer (%)"), numInput("buffer", plain(s.BufferPercent)))}</div></form>`)}
    </div>`;
    const form = el.querySelector("#em");
    const apply = () => {
      const v = values(form);
      s.MonthlyEssentials = num(v.monthly) || 0; s.YearlyCosts = num(v.yearly) || 0;
      s.EmergencyMonths = +v.months; s.BufferPercent = num(v.buffer) ?? 0;
      save(); App.refresh();
    };
    form.querySelectorAll("input,select").forEach(i => i.addEventListener("change", apply));
    el.querySelector('[data-action="use-avg"]').onclick = () => {
      const a = Calc.spending(d);
      if (!a.monthsUsed) { el.querySelector("#avg-note").textContent = T("No expenses yet. Add them in the Outflows tab first."); return; }
      s.MonthlyEssentials = Math.round(a.essential * 100) / 100; save(); App.refresh();
      toast(T("Average of your essential costs in {0}.", a.label));
    };
  },
};

// ================================================================= My savings

const PLACES = ["Bank", "Crypto platform", "Broker", "Cash", "Other"];
let editHolding = null;
export const Portfolio = {
  route: "portfolio", title: "Savings",
  render(el) {
    const d = D(), s = d.Settings, p = Calc.portfolio(d), r = Calc.emergency(s);
    const h = editHolding ? d.Holdings.find(x => x.Id === editHolding) : null;
    const f = h || { Name: "", Place: "Bank", Amount: "", Currency: "PLN", RatePercent: "", Safe: true };
    let em;
    if (r.target <= 0) em = T("Set up your emergency fund target in the Emergency fund tab.");
    else if (p.safe >= r.target) em = T("Emergency fund target ({0}) is fully covered by safe money.", pln(r.target));
    else em = T("Emergency fund: {0} of {1} in safe money. Missing {2}.", pln(p.safe), pln(r.target), pln(r.target - p.safe));
    const rateInfo = s.AutoExchangeRates ? (Rates.data.Usd > 0 ? T("Official NBP average rates from {0}.", fmtDate(Rates.data.ExchangeDate)) : T("The NBP rates will be filled in as soon as there is an internet connection.")) : T("You enter the rates yourself.");
    el.innerHTML = `<div class="grid">
      ${savingsChartCard(d)}
      ${card(heading(T("Summary (PLN)")) + row(T("Total"), pln(p.total), "big") + row(T("Secure savings (bank, cash)"), pln(p.safe)) +
        row(T("Investments at risk (crypto, securities)"), pln(p.risky)) + row(T("Interest p.a. (gross)"), pln(p.yearly)) +
        row(T("Interest per month (gross)"), pln(p.yearly / 12)) + row(T("Interest per day (gross)"), pln(p.yearly / 365)) +
        hint(T("Interest is before tax and assumes today's rates stay the same.")) + hint(em) +
        (p.missing ? hint(T("Some items are in USD or EUR but the exchange rate is empty, so they count as 0 zł. Enter the rates below."), "bad") : ""))}
      ${card(heading(T("Accounts & holdings")) + hint(T("Tap an item to edit it, for example to update the amount.")) + (d.Holdings.length ? `<div class="list">${d.Holdings.map(x => `
        <div class="item clickable" data-edit-holding="${x.Id}"><div><b>${esc(x.Name)}</b><span class="hint">${esc(T(x.Place))} · ${esc(x.Safe ? T("Safe") : T("Risky"))} · ${rate(currentRate(x))}</span>${promoBadge(x)}</div>
        <div class="right"><b>${amount(x.Amount, x.Currency)}</b>${currentRate(x) ? `<span class="hint">${esc(T("{0} / year", pln(Calc.toPln(x.Amount, x.Currency, s) * currentRate(x) / 100)))}</span>` : ""}${x.Deposit > 0 ? `<span class="hint primary">🔁 +${esc(pln(x.Deposit))} · ${esc(freqLabel(x.DepositFrequency || "Monthly"))}${x.DepositFrom ? " · " + esc(T("from {0}", x.DepositFrom)) : ""}</span>` : ""}</div>
        ${infoBtn("holding", x)}<button class="icon-btn danger" data-del-holding="${x.Id}">🗑</button></div>`).join("")}</div>` : hint(T("Nothing added yet."))))}
      ${d.SavingsChecks?.length ? "" : card(heading(T("Import savings account statement"), "🏦") +
        hint(T("The balance of a savings account comes from its own statement: import its CSV file and MoneyCompass sets the balance and the month-by-month history from the bank's figures – with the interest, the 19% tax, fees and the real rate.")) +
        `<div class="buttons">${button("⬆ " + esc(T("Import savings account statement (CSV)…")) + (license.isPro ? "" : " 🔒"), "savings-check", "main")}</div>`)}
      ${savedChecksCard(d)}
      ${card(`<form id="hold">${heading(h ? T("Edit: {0}", h.Name) : T("Add an account"))}
        ${field(T("Name"), textInput("name", f.Name, T("e.g. {0}", "ING, Revolut, …")))}
        <div class="two">${field(T("Where"), select("place", PLACES.map(x => [x, T(x)]), f.Place))}${field(T("Currency"), select("currency", CURRENCIES, f.Currency))}</div>
        <div class="two">${field(T("Amount"), numInput("amount", plain(f.Amount), T("e.g. {0}", "10000")))}${field(T("Interest rate (% per year, 0 if none)"), numInput("rate", plain(f.RatePercent), "0"))}</div>
        ${check("safe", T("Safe money (guaranteed, e.g. bank)"), f.Safe)}
        <details class="deposit"${f.Deposit > 0 ? " open" : ""}><summary>🔁 ${esc(T("Regular deposit (standing order) – optional"))}</summary>
          <div class="two">${field(T("Amount (zł)"), numInput("deposit", plain(f.Deposit), T("e.g. {0}", "500")))}${field(T("How often"), select("depfreq", FREQUENCIES.filter(x => x[0] !== ONE_TIME).map(x => [x[0], T(x[0])]), f.DepositFrequency || "Monthly"))}</div>
          <div class="two">${field(T("Date of a payment (last or next one)"), dateInput("depdate", inputDate(parseDate(f.DepositDate || isoDate(today())))))}
          ${field(T("From which account (optional)"), `<input name="depfrom" list="dep-accounts" value="${esc(f.DepositFrom || "")}" placeholder="${esc(T("e.g. {0}", "mBank, PKO – konto osobiste"))}">`)}</div>
          <datalist id="dep-accounts">${[T("Current account"), ...d.Holdings.filter(x => !h || x.Id !== h.Id).map(x => x.Name)].map(n => `<option value="${esc(n)}">`).join("")}</datalist>
          ${hint(T("Shown as \"To savings\" in the Calendar. The amount above is not changed by itself – update it when you check your account."))}
        </details>
        <details class="deposit promo"${f.PromoEnd ? " open" : ""}><summary>🎁 ${esc(T("Promotion – optional"))}</summary>
          <div class="two">${field(T("Promotion ends on"), `<input type="date" name="promoend" value="${f.PromoEnd ? inputDate(parseDate(f.PromoEnd)) : ""}">`)}
          ${field(T("Rate after the promotion (% per year)"), numInput("rateafter", f.RateAfter !== null && f.RateAfter !== undefined ? plain(f.RateAfter) : "", T("e.g. {0}", "0,5")))}</div>
          ${hint(T("The interest rate above is the promotion rate. MoneyCompass reminds you 2 weeks before it ends and shows where to move the money – after a promotion most banks pay only about 0.5%."))}
        </details>
        <div class="buttons">${button(h ? T("Save changes") : T("Add"), "save-holding", "main")}${h ? button(T("Cancel editing"), "cancel-holding") : ""}</div></form>`)}
      ${adviceCard(d)}
      ${card(`<form id="fx">${heading(T("Exchange rates"))}${hint(T("Used to convert dollars and euros to złoty."))}
        ${check("auto", T("Update automatically with the official NBP rates"), s.AutoExchangeRates)}
        <div class="two">${field("1 USD = … zł", numInput("usd", plain(s.UsdToPln)))}${field("1 EUR = … zł", numInput("eur", plain(s.EurToPln)))}</div>${hint(rateInfo)}</form>`)}
      ${binCard(["holding"])}
    </div>`;
    bindAdvice(el, d);
    el.querySelector('[data-action="savings-check"]')?.addEventListener("click", () => openSavingsCheck());
    bindSavedChecks(el, d); bindSavingsChart(el, d);
    const form = el.querySelector("#hold");
    const saveIt = () => {
      const v = values(form), amt = num(v.amount);
      if (!(amt > 0)) { toast(T("Please enter an amount bigger than 0."), "bad"); return; }
      const dep = num(v.deposit) || 0;
      const item = { Name: v.name.trim() || T(v.place), Place: v.place, Amount: amt, Currency: v.currency, RatePercent: num(v.rate) || 0, Safe: v.safe,
        Deposit: dep, DepositFrequency: dep > 0 ? v.depfreq : "", DepositDate: dep > 0 ? isoDate(parseDate(v.depdate)) : null, DepositFrom: dep > 0 ? (v.depfrom || "").trim() : "",
        PromoEnd: v.promoend ? isoDate(parseDate(v.promoend)) : null, RateAfter: v.rateafter !== "" && !isNaN(num(v.rateafter)) ? num(v.rateafter) : null };
      if (h) { Object.assign(h, item); toast(T("Updated: {0}.", item.Name)); editHolding = null; }
      else { d.Holdings.push({ Id: uuid(), ...item }); toast(T("Added: {0}.", item.Name)); }
      save(); App.refresh();
    };
    form.place.onchange = () => { form.safe.checked = ["Bank", "Cash"].includes(form.place.value); };
    el.querySelector('[data-action="save-holding"]').onclick = saveIt;
    const c = el.querySelector('[data-action="cancel-holding"]'); if (c) c.onclick = () => { editHolding = null; App.refresh(); };
    el.querySelectorAll("[data-edit-holding]").forEach(x => x.onclick = ev => { if (ev.target.closest("[data-del-holding], [data-info]")) return; editHolding = x.dataset.editHolding; App.refresh(); window.scrollTo({ top: 0, behavior: "smooth" }); });
    el.querySelectorAll("[data-del-holding]").forEach(b => b.onclick = async () => {
      const x = d.Holdings.find(y => y.Id === b.dataset.delHolding);
      if (await confirmBox(T("Delete?"), x.Name, T("Delete"), T("Cancel"), true)) { toBin("holding", x); d.Holdings = d.Holdings.filter(y => y !== x); save(); App.refresh(); }
    });
    const fx = el.querySelector("#fx");
    fx.querySelectorAll("input").forEach(i => i.addEventListener("change", () => {
      const v = values(fx);
      s.AutoExchangeRates = v.auto;
      s.UsdToPln = num(v.usd) || 0; s.EurToPln = num(v.eur) || 0;
      if (s.AutoExchangeRates) Rates.applyExchange();
      save(); App.refresh();
    }));
  },
};

// ---------------------------------------------------------------- "Deleted items" card at the bottom of a tab

const BIN_NAMES = { expense: "Expenses", income: "Income", received: "Imported inflows", holding: "Savings", offer: "Compare offers", goal: "Savings goals", loan: "Loans & debts", budget: "Budget plan", recurring: "Regular payments" };
export function binCard(kinds) {
  const items = (State.data.Deleted || []).filter(x => kinds.includes(x.Kind));
  if (!items.length) return "";
  return card(`<details class="bin"><summary><h3>🗑 ${esc(T("Deleted items"))} <span class="count">${items.length}</span></h3></summary>
    ${hint(T("What you deleted on this tab. Put an item back with ↩, or empty the list to delete for good."))}
    <div class="list">${items.slice(0, 100).map(x => { const l = binLabel(x); const when = new Date(x.DeletedAt);
      return `<div class="item"><div><b>${esc(l.name)}</b><span class="hint">${esc(T(BIN_NAMES[x.Kind]))} · ${esc(T("deleted {0}", fmtDate(when) + " " + when.toTimeString().slice(0, 5)))}</span></div>
      ${l.value !== undefined ? `<b>${pln(l.value)}</b>` : ""}<button class="btn second small" data-restore="${x.Id}">↩ ${esc(T("Restore"))}</button></div>`; }).join("")}</div>
    <div class="buttons">${button("🗑 " + esc(T("Empty the list")), "empty-bin", "second small", `data-kinds="${kinds.join(",")}"`)}</div></details>`, "wide bin-card");
}
// ---------- ⓘ: what the bank file says about an entry (accounts, name, title) ----------
const INFO_LISTS = { expense: "Expenses", received: "Received", transfer: "Transfers", holding: "Holdings" };
const hasInfo = (kind, x) => kind === "holding"
  ? !!(x.DepositInfo || x.DepositFrom || State.data.Transfers.some(t => t.HoldingId === x.Id && t.Info))
  : !!(x.Info && Object.keys(x.Info).length);
/** The ⓘ button – only for entries that have details from the bank import. */
export function infoBtn(kind, x) {
  return hasInfo(kind, x) ? `<button class="icon-btn c-info" data-info="${kind}:${x.Id}" title="${esc(T("Details from the bank statement"))}">ⓘ</button>` : "";
}
function infoRows(info, incoming = false) {
  // Card payments, BLIK and cash: the bank file has no account of the shop – say so instead of leaving it out
  const card = /kart|card|blik|bankomat|atm|wypłata|withdrawal/i.test((info.Type || "") + " " + (info.Title || ""));
  const missing = T(card ? "– not in the bank file (card payment: banks don't give the shop's account)" : "– not in the bank file");
  const acc = v => v ? `<span class="info-acc">${esc(v)}</span>` : `<span class="hint">${esc(missing)}</span>`;
  const mine = `<b>${esc(T("Your account"))}${info.Bank ? " · " + esc(info.Bank) : ""}</b>${info.Account ? `<span class="info-acc">${esc(info.Account)}</span>` : ""}`;
  const theirs = `<b>${esc(info.Name || info.Title || "–")}</b>${acc(info.OtherAccount)}`;
  const flow = `<div class="info-flow"><div><small>${esc(T("From"))}</small>${incoming ? theirs : mine}</div><span class="info-arrow">→</span>
    <div><small>${esc(T("To"))}</small>${incoming ? mine : theirs}</div></div>`;
  return flow + [["Type", "Type"], ["Title", "Title"], ["Category", "Bank category"]].filter(([k]) => info[k])
    .map(([k, l]) => row(T(l), `<span class="info-val">${esc(info[k])}</span>`)).join("");
}
export function showInfo(kind, id) {
  const d = State.data, x = (d[INFO_LISTS[kind]] || []).find(y => y.Id === id);
  if (!x) return;
  let body = "";
  if (kind === "holding") {
    if (x.Deposit > 0) body += `<h3>🔁 ${esc(T("Regular deposit"))}</h3>` + row(T("Amount"), pln(x.Deposit)) + row(T("How often"), esc(freqLabel(x.DepositFrequency || "Monthly"))) +
      (x.DepositFrom ? row(T("From which account"), esc(x.DepositFrom)) : "") + (x.DepositInfo ? infoRows(x.DepositInfo) : "");
    const tr = d.Transfers.filter(t => t.HoldingId === x.Id).sort((a, b) => parseDate(b.Date) - parseDate(a.Date));
    if (tr.length) body += `<h3>⬆ ${esc(T("Transfers from bank imports"))}</h3><div class="list">${tr.slice(0, 50).map(t => `<div class="item"><div><b>${esc(t.Description || "–")}</b>
      <span class="hint">${fmtDate(t.Date)}${t.Info?.Account ? " · " + esc(T("from {0}", t.Info.Account)) : ""}${t.Info?.OtherAccount ? " → " + esc(t.Info.OtherAccount) : ""}</span></div><b class="primary">${pln(t.Amount)}</b></div>`).join("")}</div>`;
  } else {
    body = row(T("Date"), fmtDate(x.Date)) + row(T("Amount"), pln(x.Amount)) + infoRows(x.Info || {}, kind === "received");
  }
  const p = popup(`<div class="box-head"><span class="box-icon">ⓘ</span><h2>${esc(x.Description || x.Name || "–")}</h2></div>${body}
    ${hint(T("From the imported bank file. It stays only in this browser."))}
    <div class="box-buttons"><button class="btn main" data-close>${esc(T("OK"))}</button></div>`, { width: 520, cls: "box" });
  return p;
}
export function bindBin(el) {
  el.querySelectorAll("[data-info]").forEach(b => b.onclick = ev => { ev.stopPropagation(); const [k, id] = b.dataset.info.split(":"); showInfo(k, id); });
  el.querySelectorAll("[data-restore]").forEach(b => b.onclick = () => {
    const entry = restoreFromBin(b.dataset.restore);
    if (entry) { toast(T("Restored: {0}.", binLabel(entry).name)); App.refresh(); }
  });
  const empty = el.querySelector('[data-action="empty-bin"]');
  if (empty) empty.onclick = async () => {
    const kinds = empty.dataset.kinds.split(",");
    if (await confirmBox(T("Empty the list?"), T("These items are then deleted for good."), T("Delete"), T("Cancel"), true)) {
      State.data.Deleted = State.data.Deleted.filter(x => !kinds.includes(x.Kind)); save(); App.refresh();
    }
  };
}
