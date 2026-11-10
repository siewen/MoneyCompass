// The free tabs: Overview, Inflows, Outflows, Emergency fund, Savings (with Savings goals for Pro).
import { infoBtn as scoreInfoBtn } from "./score-info.js";
import { goAttr } from "./page-head.js";
import {
  T, State, save, Calc, Advisor, ChartData, COLORS, pln, rate, amount, num, plain, fmtDate, parseDate, isoDate, inputDate,
  today, addDays, addMonths, monthStart, monthName, monthsCount, uuid, categories, findCategory, categoryLabel, categoryIcon,
  addCategory, removeCategory, updateCategory, ICON_CHOICES, OTHER, license, moduleOn, FREQUENCIES, ONE_TIME, RECEIVED, LOAN_CATEGORY, netFromGross, loanPlan, currentRate, duePromos, freqLabel, customFrequency, parseCustom, repeatingExpenses, setReceivedRepeat, receivedRepeatOn, setRepeat, seriesKey, toBin, restoreFromBin, binLabel,
  matchKey, lang, learnCategory, similarExpenses, setCategory, goalSaved, savingsRateText, mainCur, currentName } from "./core.js";
import { pageHead, band, si, IC, ring } from "./page-head.js";
const LOC = () => ({ en: "en-GB", pl: "pl-PL" })[lang()] || "en-GB";
import { emergencyDash, iconizeCards, dcard, PM } from "./dash.js";
import { lineChart } from "./ov-charts.js";
import { assess, assessmentHtml, setAssessSource } from "./assessment.js";
import { collectExtras } from "./engine/collect.js";
import { hbars, donut, legend, monthBars, progress, waveChart } from "./charts.js";
import { ovBars, ovTrend, donutList, legendKeys, ovForecast, spark, C_IN, C_OUT, C_LEFT } from "./ov-charts.js";
import { NEW_CAT } from "./ui.js";
import { esc, card, heading, hint, row, field, textInput, numInput, dateInput, select, check, button, values, popup, confirmBox, toast, ICON, ICONS, headingTip, categoryBox, infoTip } from "./ui.js";
import { App, requirePro } from "./app.js";
import { Rates } from "./rates.js";
import { adviceCard, bindAdvice, promoBadge, moves } from "./advice.js";
import { loanWarning } from "./pages-pro.js";
import { openSavingsCheck, savedChecksCard, bindSavedChecks, savingsChartCard, bindSavingsChart, savingsData } from "./savings-check.js";

const D = () => State.data;
const tile = (label, value, route, colors, cls = "", tip = "", delta = "") =>
  `<button class="tile" data-go="${route}"${tip ? ` data-tip="${esc(tip)}"` : ""} style="--t1:${colors[0]};--t2:${colors[1]};--t3:${colors[2]};--t4:${colors[3]}">
     <span>${esc(label)}</span><b class="${cls}">${value}</b>${delta}</button>`;
/** Search from the top bar: opens Outflows with the word in its search box. */
let ovPeriod = "n3";
document.addEventListener("change", e => { if (e.target?.name === "ov-per") { ovPeriod = e.target.value; App.refresh(); } });
export function setSearch(text) { flt.text = text; }
/** "↑ +12% vs. previous month": the last finished month against the one before (pp = difference in percentage points). */
function deltaTag(cur, prev, upIsGood = true, pp = false, neutral = false) {
  if (cur === null || prev === null) return "";
  const diff = pp ? cur - prev : (Math.abs(prev) > 0 ? (cur - prev) / Math.abs(prev) * 100 : NaN);
  if (!isFinite(diff)) return "";
  const r = Math.abs(diff) < 10 ? Math.round(diff * 10) / 10 : Math.round(diff), good = r === 0 || (r > 0) === upIsGood;
  // a jump of more than 100% says little as a percentage: show the change in money instead
  const txt = !pp && Math.abs(r) > 100 ? `${cur - prev >= 0 ? "+" : "−"}${pln0(Math.abs(cur - prev))}` : `${r >= 0 ? "+" : "−"}${String(Math.abs(r)).replace(".", ",")}${pp ? " pp" : "%"}`;
  return `<em class="delta ${neutral ? "flat" : good ? "good" : "bad"}">${r >= 0 ? "↑" : "↓"} ${txt} <small>${esc(T("vs. last full month"))}</small></em>`;
}
const ic = (d, s = 22) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

// ================================================================= Overview

let ovRange = 6;
const pln0 = v => Math.abs(v || 0) >= 1000 ? pln(Math.round(v)).replace(/[.,]00(?!\d)/, "") : pln(v);
const rate2 = v => (Math.round(v * 100) / 100).toString().replace(".", ",") + "%";
export const Overview = {
  route: "overview", title: "Overview",
  render(el) {
    const dAll = D(), per = Calc.scope(dAll, ovPeriod);
    Calc.maxMonths = per.n;
    try { return this.render0(el, dAll, per); } finally { Calc.maxMonths = 3; }
  },
  render0(el, dAll, per) {
    const d = per.data;
    const income = Calc.totalIncome(d), avg = Calc.spending(d);
    const spending = avg.essential + avg.nonEssential, left = income - spending;
    const both = income > 0 && avg.monthsUsed > 0;
    const p = Calc.portfolio(d);
    const months = ChartData.trend(dAll);
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
      : `<p class="savings-headline ${state}"><b>${esc(lastLeft < 0
          ? T("In {0} you spent {1} more than you earned.", monthName(last.start), pln(-lastLeft))
          : T("In {0} you kept {1} – {2}% of your income.", monthName(last.start), pln(lastLeft), Math.round(lastRate * 100)))}</b></p>` +
        "";
    const headTip = !last ? "" : state === "bad" ? T("Your savings shrink when this happens. Look at your biggest categories in Outflows – and set a Budget plan.")
          : state === "warn" ? T("You are saving, but little. A good aim is at least 10–20% of your income every month.")
          : T("Great – you are building up money. Keep it in safe savings until your emergency fund is full, then make it work (Compare offers).");
    const bars = done.length ? `<div class="mini-bars">${(() => {
        const max = Math.max(1, ...done.map(m => Math.abs(m.income - m.expenses)));
        return done.map(m => { const v = m.income - m.expenses, h = Math.max(4, Math.abs(v) / max * 44);
          return `<div class="mb" title="${esc(monthName(m.start))}: ${esc(pln(v))}"><span class="${v >= 0 ? "pos" : "neg"}" style="height:${h}px"></span><small>${esc(monthName(m.start).slice(0, 3))}</small></div>`; }).join("");
      })()}<span class="mb-label">${esc(T("Balance per month"))}</span></div>` : "";
    const growthLine = growth !== null && hist.length >= 2 ? `<p class="${growth >= 0 ? "good" : "bad"}">${growth >= 0 ? "▲" : "▼"} ${esc(T("Your savings since {0}: {1}{2}", fmtMonthKey(hist[0][0]), growth >= 0 ? "+" : "−", pln(Math.abs(growth))))}</p>` : "";

    // ---- Tiles: icon, value and the change against the previous month ----
    const prevM = done[done.length - 2], have2 = last && prevM;
    const dIn = have2 ? deltaTag(last.income, prevM.income) : "", dOut = have2 ? deltaTag(last.expenses, prevM.expenses, false, false, left >= 0 && income > 0 && left / income >= .2) : "";
    const dLeft = have2 ? deltaTag(last.income - last.expenses, prevM.income - prevM.expenses) : "";
    const dRate = have2 && last.income > 0 && prevM.income > 0 ? deltaTag((last.income - last.expenses) / last.income * 100, (prevM.income - prevM.expenses) / prevM.income * 100, true, true, left >= 0 && income > 0 && left / income >= .2) : "";
    const hr = new Date().getHours(), nm0 = (currentName() || "").trim(), first = nm0 === T("Demo User") ? nm0 : nm0.split(/\s+/)[0] || "";
    const hello = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
    const hero = `<div class="ov-hero"><div class="ov-hi"><h2>${esc(T(hello))}${first ? ", " + esc(first) : ""}!</h2><p>${esc(T("Here's your financial overview for {0}", monthName(today())))}</p></div>
      <div class="ov-quote">${esc(T("“Discipline today."))}<br>${esc(T("Freedom tomorrow.”"))}</div>
      <button class="btn main ov-opt" data-action="optimize"><span aria-hidden="true" class="ov-opt-ic">${ic('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>', 20)}</span>${esc(T("Optimize My Savings"))} <span aria-hidden="true">→</span></button></div>`;
    const kpi = (label, value, route, icon, cls, delta, tip, vcls = "") =>
      `<button class="kpi" data-go="${route}"${tip ? ` data-tip="${esc(tip)}"` : ""}><span class="kpi-ic ${cls}">${icon}</span><span class="kpi-t"><span class="kpi-l">${esc(label)}</span><b class="${vcls}">${value}</b>${delta || '<em class="delta"></em>'}</span></button>`;
    const kpis = `<div class="ov-kpis">
      ${kpi(T("Income per month"), pln(income), "income", ic('<path d="M7 17L17 7M8.5 7H17v8.5"/>', 26), "in", dIn, tipIncome)}
      ${kpi(T("Spending per month"), avg.monthsUsed ? pln(spending) : "–", "expenses", ic('<path d="M7 7l10 10M8.5 17H17V8.5"/>', 26), "out", dOut, tipSpending)}
      ${kpi(T("Left over per month"), both ? pln(left) : "–", "income", ic('<path d="M4 8h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 8l11-4v4M16 14h2"/>', 26), "left", dLeft, T("Inflows minus outflows: what you can save each month."), both && left < 0 ? "bad" : "")}
      ${kpi(T("Savings rate"), both ? savingsRateText(left, income) : "–", "portfolio", ic('<circle cx="12" cy="12" r="9"/><path d="M8.5 15.5l7-7"/><circle cx="9" cy="9" r="1.1"/><circle cx="15" cy="15" r="1.1"/>', 26), "rate", dRate, T("The part of your income you keep. A good aim is 10–20% or more."), both && left < 0 ? "bad" : "")}
    </div>`;
    const sw = shortDataWarning(d);
    const warn = sw ? `<div class="tip warn-tip short-data">${sw.replace(/<\/?p[^>]*>/g, "")} ${esc(T("Import or enter at least one whole month."))}</div>` : "";

    const cur = months.find(m => m.current);
    const m12 = months.slice(-12);
    const noteCur = cur ? `<p class="hint planned-note">* ${esc(T("{0} is not finished: income as planned from your income sources, expenses entered so far.", monthName(cur.start)))}</p>` : "";
    const hid = headTipText => headTipText;
    const g = [];   // the cards of the mockup, in its order
    g.push(card(`<div class="oc-head">${headingTip(T("Income vs Expenses"), T("Income as received (salary and extra income) – where nothing was imported, as planned from your income sources. Expenses as entered or imported."))}${legendKeys([{ color: C_IN, label: T("Income") }, { color: C_OUT, label: T("Expenses") }])}</div>` +
      (showTrend ? ovBars(m12) + noteCur : hint(T("Add income and expenses to see this chart."))), "ov-card link\" data-go=\"expenses"));
    g.push(card(`<div class="oc-head">${headingTip(T("Monthly Trend"), T("Income, expenses and what is left over (income minus expenses), month by month."))}${legendKeys([{ color: C_IN, label: T("Income") }, { color: C_OUT, label: T("Expenses") }, { color: C_LEFT, label: T("Left over"), dash: true }])}</div>` +
      (showTrend && months.length >= 2 ? ovTrend(m12) : hint(T("Add income and expenses to see this chart."))), "ov-card link\" data-go=\"income"));
    g.push(card(headingTip(T("Expense Categories"), basisText(d)) +
      (cats.slices.length ? donutList(cats.slices, pln(cats.total), T("per month"), v => ChartData.share(v, cats.total)) : hint(T("Add expenses to see where your money goes."))), "ov-card link\" data-go=\"expenses"));
    // Savings Breakdown: where your savings are kept
    const hold = d.Holdings.map((h, i) => ({ label: h.Name, value: Calc.toPln(h.Amount, h.Currency, d.Settings) })).filter(x => x.value > 0).sort((a, b) => b.value - a.value).map((x, i) => ({ ...x, color: COLORS.series[i % 6], text: pln(x.value) }));
    g.push(card(headingTip(T("Savings Breakdown"), T("Where your savings are kept. The figure in the middle is your savings rate.")) +
      (hold.length ? donutList(hold, both && left >= 0 ? savingsRateText(left, income) : pln(p.total), both && left >= 0 ? T("savings rate") : T("total savings"), v => ChartData.share(v, p.total)) : hint(T("Add your savings in the My Savings tab to see this chart."))), "ov-card link\" data-go=\"portfolio"));
    if (moduleOn("budget")) {
      const bl = d.Budgets.filter(b => b.MonthlyLimit > 0).slice(0, 5);
      g.push(card(`<div class="oc-head"><h3>${esc(T("Budget Plan"))} <span class="muted-s">(${esc(monthName(today()).split(" ")[0])})</span></h3></div>` + (bl.length ? bl.map(b => {
        const spent = Calc.spentThisMonth(b.Category), f = spent / b.MonthlyLimit, col = f > 1 ? "#F2777A" : f >= .8 ? "#E9D16A" : "#35D399";
        return `<div class="bp-row" data-budget="${esc(b.Category)}"><span class="bp-l">${esc(categoryLabel(b.Category))}</span><div class="bp-b"><small>${esc(pln(spent).replace(/ zł$/, ""))} / ${esc(pln(b.MonthlyLimit))}</small>${progress(f, col)}</div><b style="color:${col}">${Math.round(f * 100)}%</b></div>`;
      }).join("") : hint(T("Set your limits in the Budget plan tab to see them here."))), "ov-card ov-wide link\" data-go=\"budget"));
    }
    // Emergency Fund
    {
      const f = target > 0 ? p.safe / target : 0, chip = f >= 1 ? ["good", "Complete"] : f >= .5 ? ["good", "On track"] : ["warn", "Building up"];
      g.push(card(heading(T("Emergency Fund")) + (target > 0
        ? `<div class="ef"><span class="ef-ic">${ic('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>', 28)}</span><div class="ef-v"><b>${esc(pln(p.safe))}</b></div><div class="ef-p"><b class="${chip[0]}">${Math.round(Math.min(100, f * 100))}%</b><small>${esc(T("of {0} goal", pln(target)))}</small></div></div>${progress(f, f >= .5 ? "#35D399" : "#E9D16A")}
          <div class="ef-f"><span>${esc(T("{0} months of expenses", fmtNum(covered)))}</span><span class="chip-s ${chip[0]}">${esc(T(chip[1]))}</span></div>`
        : emergency), "ov-card link\" data-go=\"emergency"));
    }
    if (moduleOn("loans")) {
      const loans = d.Loans.filter(l => l.Remaining > 0).map(l => ({ ...l, Remaining: loanPlan(l).remainingNow })).filter(l => l.Remaining > 0).sort((a, b) => b.Remaining - a.Remaining);
      const total = loans.reduce((s, l) => s + l.Remaining, 0);
      g.push(card(heading(T("Loans & Debts")) + (loans.length
        ? `<div class="ln-top"><span class="ef-ic ln">${ic('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>', 26)}</span><div><b class="ln-v">${esc(pln(total))}</b><small>${esc(T("Total outstanding"))}</small></div><div class="ln-n"><b>${esc(T(loans.length === 1 ? "1 loan" : "{0} loans", loans.length))}</b><small>${esc(T("Active"))}</small></div></div>
          <div class="ln-tab">${loans.slice(0, 4).map(l => { const pl = loanPlan(d.Loans.find(x => x.Id === l.Id) || l); return `<div><span>${esc(l.Name)}</span><span>${esc(pln(l.Remaining))}</span><span>${l.RatePercent ? esc(String(l.RatePercent).replace(".", ",")) + "%" : ""}</span><span class="chip-s ${pl.never ? "bad" : "good"}">${esc(T(pl.never ? "Check" : "On track"))}</span></div>`; }).join("")}</div>`
        : hint(T("No loans – great!"))), "ov-card link\" data-go=\"loans"));
    }
    if (moduleOn("budget")) {
      const goals = [...d.Goals].sort((a, b) => parseDate(a.TargetDate) - parseDate(b.TargetDate)).slice(0, 4).map(gl => ({ ...gl, Saved: goalSaved(gl, d) }));
      g.push(card(`<div class="oc-head"><h3>${ic('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>', 20)} ${esc(T("Savings Goals"))}</h3></div>` + (goals.length ? goals.map(gl => {
        const f = gl.Target > 0 ? gl.Saved / gl.Target : 0;
        return `<div class="bp-row"><span class="bp-l">${esc(gl.Name)}</span><div class="bp-b"><small>${esc(pln(Math.min(gl.Saved, gl.Target)).replace(/ zł$/, ""))} / ${esc(pln(gl.Target))}</small>${progress(f, f >= 1 ? "#35D399" : "#8B7CF6")}</div><b>${Math.round(Math.min(100, f * 100))}%</b></div>`;
      }).join("") : hint(T("Set savings goals in the Budget plan tab."))), "ov-card ov-wide link\" data-go=\"budget"));
    }
    g.push(`<div class="card ov-peak"><svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2B3A5C"/><stop offset=".55" stop-color="#8A6A86"/><stop offset="1" stop-color="#E0A07A"/></linearGradient><linearGradient id="mt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#46556E"/><stop offset="1" stop-color="#1B2733"/></linearGradient><linearGradient id="wt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5B6A86"/><stop offset="1" stop-color="#1A2330"/></linearGradient></defs>
      <rect width="400" height="200" fill="url(#sk)"/><path d="M0 130l50-45 30 25 60-70 55 62 40-38 70 66 95-30v100H0z" fill="url(#mt)"/><path d="M140 40l-16 22 10-4 6 8 8-9 8 8z" fill="#EEF1F6" opacity=".9"/><path d="M0 150h400v50H0z" fill="url(#wt)"/><path d="M0 138l60 10 60-12 70 14 80-10 130 8v12H0z" fill="#15202B"/>
      <g fill="#0E1A17"><path d="M310 130l8 30h-16zM326 120l9 40h-18zM344 128l8 32h-16zM362 118l10 42h-20zM382 126l8 34h-16z"/></g></svg><p><b>${esc(T("A more secure tomorrow is a series of better choices today."))}</b></p></div>`);

    // ---- More cards of the app (not in the mockup): suggestions, savings and offers ----
    const x = [];
    const sugg = [];
    const due = duePromos(d)[0];
    if (due) sugg.push({ ic: "clock", cls: "warn", go: "portfolio", text: due.p.ended ? T("The promotion at {0} ended on {1} – see where to move the money", due.h.Name, fmtDate(due.p.end)) : T("The promotion at {0} ends in {1} days – see where to move the money", due.h.Name, due.p.daysLeft) });
    else { const m = moves(d)[0]; if (m) sugg.push({ ic: "trend", go: "portfolio", text: T("Your savings could earn about {0} more at {1} – see Savings", pln(m.gain), m.o.Bank) }); }
    if (sugg.length) x.push(card(`<div class="next-list">${sugg.map(s => `<button class="next-item ${s.cls || ""}" data-go="${s.go}">${ICONS[s.ic]}<span>${esc(s.text)}</span>${s.go ? "<i>→</i>" : ""}</button>`).join("")}</div>`, "fixed next-card no-sugg"));
    x.push(card(`<div class="link" data-go="portfolio">${headingTip(T("Your savings"), headTip)}${state ? `<span class="status-chip ${state}">${esc(state === "good" ? T("Growing") : state === "warn" ? T("Slow") : T("Shrinking"))}</span>` : ""}
      ${headline}${bars}${growthLine}${p.total > 0 ? savingsFacts(d, p) : hint(T("Add your savings in the Savings tab to see this chart."))}</div>`, "savings-card status-" + (state || "none")));
    if (license.isPro) {
      const ranked = d.Offers.map(o => ({ o, r: Calc.savings(o) })).filter(y => y.o.Amount > 0).sort((a, b) => b.r.net - a.r.net).slice(0, 4);
      const best = Rates.bestOffer();
      x.push(card(headingTip(T("Compare offers"), T("Your saved offers: interest after the 19% tax.")) +
        (ranked.length ? hbars(ranked.map((y, i) => ({ label: y.o.Name.length > 20 ? y.o.Name.slice(0, 19) + "…" : y.o.Name, value: y.r.net, color: COLORS.series[i], text: `${pln(y.r.net)} · ${rate(y.r.effective)}` })))
          : hint(T("No offers saved yet. Add them in the Compare offers tab, or with the Compare button in Optimize my finances."))) +
        (best ? `<hr><p class="good">🏦 ${esc(T("Best rate right now: {0} – {1} ({2}).", best.Bank, best.Name || best.Bank, rate(best.Rate)))}</p>` : ""), "link\" data-go=\"savings"));
    }
    // ---------- Financial Dashboard (design mockup) ----------
    const loansAll = d.Loans.map(l => ({ ...l, Remaining: loanPlan(l).remainingNow })).filter(l => l.Remaining > 0);
    const debt = loansAll.reduce((x, y) => x + y.Remaining, 0), netWorth = p.total - debt;
    const svRate = both ? left / income : 0, emF = target > 0 ? p.safe / target : 0;
    const wealth = Math.round(40 * Math.min(1, emF) + 30 * Math.min(1, Math.max(0, svRate) / 0.2) + 30 * (debt <= 0 ? 1 : income > 0 ? Math.max(0, 1 - debt / (income * 12)) : 0));
    const wl = wealth >= 80 ? T("Excellent") : wealth >= 60 ? T("Good") : wealth >= 40 ? T("Fair") : T("Needs attention");
    const mv0 = moves(d)[0];
    const asm = assess({ has: income > 0 || spending > 0 || p.total > 0 || debt > 0, income, spending, left, both, svRate, emF, target, safe: p.safe, total: p.total, covered, debt, essential: essentialMonth, months: avg.monthsUsed, ...collectExtras(dAll),
      loans: loansAll.map(l => ({ name: l.Name, rate: +l.RatePercent || 0, pay: +l.MonthlyPayment || 0, rem: l.Remaining })), wealth, mv: mv0 ? { gain: mv0.gain, bank: mv0.o.Bank, moved: mv0.moved } : null });
    const assessBand = assessmentHtml(asm, wealth, wl), pairBand = assessmentHtml(asm, wealth, wl, "pair");
    const kp = (l, v, ic2, cls, dl) => { const mainK = cls.includes("main"); const g = goAttr(l); return `<div class="kpi static${g ? " clk" : ""}${mainK ? " kpi-main" : ""}"${g}><span class="kpi-ic ${cls.replace(" main", "").replace(" neg", "")}">${si(IC[ic2])}</span><span class="kpi-t"><span class="kpi-l">${esc(l)}</span><b${cls.includes("neg") ? ' class="bad"' : ""}>${v}</b>${dl || ""}</span></div>`; };
    const head = `<div class="pg-title"><span class="pg-ic">${si(IC.trend, 34)}</span><div><h2>${esc(T(hello))}${first ? ", " + esc(first) : ""}!</h2><p>${esc(T("Overview for: {0}", T(per.label)))}${both ? " · " + esc(left < 0 ? T("Spending exceeds income: monthly deficit {0}", pln0(-left)) : T("You keep {0} of your income.", savingsRateText(left, income))) : ""}</p>${(() => { let st = 0; for (let i = done.length - 1; i >= 0 && done[i].income - done[i].expenses > 0; i--) st++;
        const w = [target > 0 && emF >= 1 ? ["🛡️ " + T("Emergency fund complete"), "emergency"] : null, debt <= 0 && d.Loans.length ? ["🎉 " + T("Debt-free"), "loans"] : null, st >= 2 ? ["🔥 " + T("{0} months in a row with money left over", st), "reports"] : null, both && svRate >= 0.2 ? ["🏆 " + T("Saving over 20% of your income"), "portfolio"] : null].filter(Boolean);
        return w.length ? `<div class="ov-wins">${w.map(x => `<button type="button" data-go="${x[1]}">${esc(x[0])}</button>`).join("")}</div>` : ""; })()}</div>
      <label class="ov-per" title="${esc(T("Choose the period"))}"><span>📅</span><select name="ov-per"><option value="all"${ovPeriod === "all" ? " selected" : ""}>${esc(T("All data"))}</option>${[2, 3, 6].map(k => `<option value="n${k}"${ovPeriod === "n" + k ? " selected" : ""}>${esc(T("Last {0} months", k))}</option>`).join("")}${per.months.length ? `<optgroup label="${esc(T("Single month"))}">${per.months.map(m => `<option value="m:${m.key}"${ovPeriod === "m:" + m.key ? " selected" : ""}>${esc(monthName(m.start))}</option>`).join("")}</optgroup>` : ""}</select></label></div>
      ${assessBand}
      @@OPT@@
      <div class="ov-kpis ovkp">${kp(T("Income per Month"), esc(pln0(income)), "wallet", "in", dIn)}${kp(T("Spending per Month"), esc(avg.monthsUsed ? pln0(spending) : "–"), "cart", "out", dOut)}${kp(both && left < 0 ? T("Monthly Deficit") : T("Remaining Money"), esc(both ? pln0(left) : "–"), "pig", "left main" + (both && left < 0 ? " neg" : ""), dLeft)}${kp(both && left < 0 ? T("Negative Savings Rate") : T("Savings Rate"), esc(both ? savingsRateText(left, income) : "–"), "percent", "rate" + (both && left < 0 ? " neg" : ""), dRate)}</div>`;
    let hk = hist.map(([k, v]) => ({ k, v: v - debt }));
    if (hk.length < 2) {   // not enough recorded history: estimate backwards from today using each month's surplus
      const ms = months.filter(m => m.income > 0 || m.expenses > 0).slice(-6); let run = netWorth; const est = [];
      for (let i = ms.length - 1; i >= 0; i--) { est.unshift({ k: `${ms[i].start.getFullYear()}-${String(ms[i].start.getMonth() + 1).padStart(2, "0")}`, v: run }); run -= (ms[i].income - ms[i].expenses); }
      if (est.length >= 2) hk = est;
    }
    const nwPrev = hk.length >= 2 ? hk[hk.length - 2].v : null;
    const nwCh = nwPrev && Math.abs(nwPrev) > 0 ? (netWorth - nwPrev) / Math.abs(nwPrev) * 100 : null;
    const chTag = (v, suf = "%") => v === null ? "" : `<em class="ovh-d ${v >= 0 ? "up" : "down"}">${v >= 0 ? "↑" : "↓"} ${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v * 10) / 10).toString().replace(".", ",")}${suf}</em>`;
    const mlab = k => new Intl.DateTimeFormat(LOC(), { month: "short", year: "numeric" }).format(new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1));
    const nwChart = hk.length >= 2 ? lineChart(hk.map(x => mlab(x.k)), [{ vals: hk.map(x => Math.round(x.v)), color: "#2EDC9A", dots: true, area: true }], { w: 1300, h: 150 }) : `<p class="hint">${esc(T("Add income and expenses of at least two months to see your net worth over time."))}</p>`;
    const svVals = hk.length >= 2 ? hk.map(x => x.v + debt) : hist.map(x => x[1]), svCh = svVals.length >= 2 && svVals[0] > 0 ? (svVals[svVals.length - 1] - svVals[0]) / svVals[0] * 100 : null;
    const emTone = emF >= 1 ? T("Complete") : emF >= .5 ? T("On track") : T("Building up");
    const health = `<div class="nw-card ovh"><div class="ni-fh"><span class="rp-si i-res">${si(IC.bars, 26)}</span><h3>${esc(T("Financial Health Overview"))}</h3></div>
      <div class="ovh-row"><div class="clk" data-go="portfolio"><small>${esc(T("Net Worth"))}</small><b class="ovh-big" style="font-size:${Math.min(26, Math.floor(230 / (pln(netWorth).length * 0.66)))}px;white-space:nowrap">${esc(pln0(netWorth))}</b>${chTag(nwCh)}<small>${esc(T("vs. last month"))}</small></div>
        <div class="dv clk" data-go="portfolio"><small>${esc(T("Total Savings"))}</small><b class="ovh-big">${esc(pln0(p.total))}</b>${svCh === null ? "" : chTag(svCh)}<small>${esc(T("Growth (YTD)"))}</small></div>
        <div class="dv ovh-em clk" data-go="emergency"><small>${esc(T("Emergency Fund"))}</small><div class="ovh-emr">${ring(emF * 100, Math.round(Math.min(100, emF * 100)) + "%", "", 76)}<span><b>${esc(pln0(p.safe))}</b><small>${esc(target > 0 ? T("Target: {0}", pln0(target)) : T("No target set"))}</small></span></div></div>
        <div class="dv clk" data-go="loans"><small>${esc(T("Debt Position"))}</small><b class="ovh-big">${esc(pln0(debt))}</b><small>${esc(debt > 0 ? T("{0} loan(s)", loansAll.length) : T("Debt-free"))}</small></div></div>
      <div class="ovh-ch"><small>${esc(T("Net Worth"))}</small>${nwChart}</div></div>`;
    const ovN = ovRange, mN = months.slice(-ovN);
    const incExp = `<div class="nw-card dz ovc" data-go="income"><div class="ni-fh"><span class="rp-si i-res">${si(IC.bank, 24)}</span><h3>${esc(T("Income vs Expenses"))}</h3><select class="ni-sel" data-ovr>${[3, 6, 12].map(n => `<option value="${n}"${n === ovN ? " selected" : ""}>${n} ${esc(T("Months"))}</option>`).join("")}</select></div>${legendKeys([{ color: C_IN, label: T("Income") }, { color: C_OUT, label: T("Expenses") }])}${showTrend ? ovBars(mN) : hint(T("Add income and expenses to see this chart."))}</div>`;
    const catCard = `<div class="nw-card dz ovc" data-go="expenses">${`<div class="ni-fh"><span class="rp-si i-res">${si(IC.pie, 24)}</span><h3>${esc(T("Expense Categories"))}</h3></div>`}${cats.slices.length ? donutList(cats.slices.slice(0, 6), pln(cats.total), T("/ month"), v => ChartData.share(v, cats.total)) : hint(T("Add expenses to see where your money goes."))}</div>`;
    const efCard = `<div class="nw-card dz ovc ovs" data-go="emergency"><div class="ni-fh"><span class="rp-si i-res">${si(IC.shield, 24)}</span><h3>${esc(T("Emergency Fund"))}</h3></div>${target > 0 ? `<b class="ovh-huge">${esc(fmtNum(covered))} <small>${esc(T("Months"))}</small></b>${progress(Math.min(1, emF), "#2EDC9A")}<small>${esc(emF >= 1 ? T("Goal reached") : emF >= .5 ? T("On track to meet your goal") : T("Still building up"))}</small>` : `<p class="hint">${esc(T("Set your emergency fund target in the Emergency Fund tab."))}</p>`}</div>`;
    const loanPay = loansAll.reduce((x, y) => x + (+y.MonthlyPayment || 0), 0);
    const lnCard = `<div class="nw-card dz ovc ovs"><div class="ni-fh"><span class="rp-si i-res">${si(IC.wallet, 24)}</span><h3>${esc(T("Loans & Debts"))}</h3></div><b class="ovh-huge">${esc(pln(loanPay))}</b><small>${esc(T("per month"))}</small><button class="sv-btn ghost" data-go="loans">${esc(T("View Details"))} →</button></div>`;
    const mv = moves(d)[0], potY = asm.potential.total, bestOpp = asm.potential.counted[0], gainM = potY / 12;
    const nOpp = asm.potential.counted.length, bestGain = bestOpp ? (bestOpp.potential || 0) : 0, pctBase = potY > 0 && p.total > 0 ? Math.round(potY / p.total * 1000) / 10 : null;
    const optBand = `<div class="nw-card ovo${potY > 0 ? " ovo-flag" : " ovo-calm"}"><div class="ovo-a"><span class="rp-si i-res">${si(IC.bulb, 34)}</span><div><h3>${esc(T("Optimization Opportunities"))}</h3><small>${esc(T("Additional return available"))}</small><b class="ovh-big good">${potY > 0 ? "+" + esc(pln0(potY)) + " <small>" + esc(T("per year")) + "</small>" : "–"}</b>${potY > 0 ? `<small>${esc(nOpp === 1 ? T("1 opportunity") : T("{0} opportunities", nOpp))}${pctBase !== null ? " · " + esc(T("+{0}% on your {1} of savings", String(pctBase).replace(".", ","), pln0(p.total))) : ""}</small>` : ""}</div></div>
      <div class="ovo-b dv"><div><small>${esc(T("Best opportunity"))}</small><b>${esc(bestOpp ? bestOpp.title : T("No suggestion right now"))}</b>${potY > 0 && bestGain > 0 ? `<small class="good">${esc(T("Potential: +{0} per year", pln0(bestGain)))} &nbsp;|&nbsp; ${esc(T("Risk: Low"))}</small>` : ""}</div></div>
      <button class="sv-btn ovo-btn${potY > 0 ? "" : " ghost"}" data-action="optimize">${esc(potY > 0 ? T("View Opportunity") : T("Open Optimization Center"))} →</button></div>`;
    const bestO = Rates.bestOffer();
    const cmpCard = `<div class="nw-card dz ovc"><div class="ni-fh"><span class="rp-si i-res">${si(IC.bank, 24)}</span><h3>${esc(T("Compare Offers"))}</h3><button class="pm-btn" data-action="ov-cmp" title="${esc(T("Your saved offers"))}">±</button></div><div class="ovb-r"><div><small>${esc(T("Best Available Offer"))}</small><b class="ovh-big">${bestO ? esc(rate2(bestO.Rate)) + " p.a." : "–"}</b>${bestO ? `<small>${esc(bestO.Bank)}</small>` : ""}</div></div><button class="sv-btn ghost ovb-b" data-go="savings">${esc(T("Compare Now"))} →</button></div>`;
    const savCard = `<div class="nw-card dz ovc"><div class="ni-fh"><span class="rp-si i-res">${si(IC.pig, 24)}</span><h3>${esc(T("Your Savings"))}</h3><button class="pm-btn" data-action="ov-sav" title="${esc(T("Details"))}">±</button></div>${hold.length ? `<div class="ovb-hold">${hold.slice(0, 3).map(h => `<div><span>${esc(h.label)}</span><b>${Math.round(h.value / Math.max(1, p.total) * 100)}%</b></div>`).join("")}</div>` : `<p class="hint">${esc(T("No savings added yet."))}</p>`}</div>`;
    const riskPct = p.total > 0 ? p.risky / p.total : 0, risk = riskPct < .1 ? T("Low") : riskPct < .3 ? T("Medium") : T("High");
    el.innerHTML = `<div class="ni-page">${head.replace("@@OPT@@", optBand)}${warn}${health}${pairBand}<div class="ovr2">${incExp}${catCard}</div><div class="ovr2e">${cmpCard}${savCard}</div></div>`;
    el.querySelector("[data-ovr]")?.addEventListener("change", e => { ovRange = +e.target.value; App.refresh(); });
    const openOv = (title, html) => {
      const pp = popup("", { width: 1100, cls: "nw-win pm-win" }), orig = App.refresh;
      pp.el.innerHTML = `<div class="nw-ch pm-head"><span class="rp-si i-res">${si(IC.bars, 24)}</span><h3>${esc(title)}</h3><button class="pm-x" data-close aria-label="${esc(T("Close"))}">✕</button></div><div class="inc-pop">${html}</div>`;
      App.refresh = (...a) => { orig(...a); pp.close(); };
      const close = pp.close; pp.close = (...a) => { App.refresh = orig; close(...a); };
      pp.el.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", ev => { if (ev.target.closest("button,a,input,select") && ev.target.closest("button,a,input,select") !== b) return; const r = b.dataset.go; pp.close(); if (r) App.go(r); }));
    };
    // ---- The three ± windows: a clear summary each, with a button to the full page ----
    const ovWin = (icon, title, sub, body, go, goLabel) => {
      const pp = popup(`<div class="nw-hd"><span class="nw-hi">${{ bank: "🏦", pig: "🐖", check: "✅" }[icon] || "•"}</span><div><h2>${esc(title)}</h2><p class="nw-sub">${esc(sub)}</p></div><button class="nw-x" data-close aria-label="${esc(T("Close"))}">✕</button></div>
        <div class="sc-body ow-body">${body}</div>
        <div class="nw-ft"><button class="btn second" data-close>${esc(T("Close"))}</button>${go ? `<button class="btn main" data-ogo="${go}">${esc(goLabel)} →</button>` : ""}</div>`, { width: 680, cls: "nw-win sc-win" });
      pp.el.querySelectorAll("[data-ogo],[data-orow]").forEach(b => b.onclick = () => { const r = b.dataset.ogo || b.dataset.orow; pp.close(); if (r) App.go(r); });
    };
    const big = (l, v, c = "") => `<div class="ow-big"><small>${esc(l)}</small><b class="${c}">${v}</b></div>`;
    const tone = ok => ok ? "good" : "warn";
    el.querySelector('[data-action="ov-cmp"]')?.addEventListener("click", () => {
      const rk = d.Offers.map(o => ({ o, r: Calc.savings(o) })).filter(y => y.o.Amount > 0).sort((a, b) => b.r.net - a.r.net).slice(0, 5), top = rk[0]?.r.net || 1;
      ovWin("bank", T("Compare Offers"), T("Your saved savings offers and the best rate right now."),
        `<div class="ow-bigs">${big(T("Best Available Offer"), bestO ? esc(rate2(bestO.Rate)) + " p.a." : "–")}${big(T("Additional Annual Profit"), mv ? "+" + esc(pln(mv.gain)) : "–", "good")}</div>
        ${bestO ? `<p class="ow-note">🏦 ${esc(T("Best rate right now: {0} – {1} ({2}).", bestO.Bank, bestO.Name || bestO.Bank, rate2(bestO.Rate)))}</p>` : ""}
        <h4>${esc(T("Your saved offers"))}</h4>
        ${rk.length ? rk.map(y => `<div class="ow-row"><span class="ow-t"><b>${esc(y.o.Name)}</b><i style="width:${Math.max(6, Math.round(y.r.net / top * 100))}%"></i></span><span>${esc(rate2(y.r.effective))}</span><b class="good">${esc(pln(y.r.net))}</b></div>`).join("") : `<p class="hint mc-empty">${esc(T("No offers saved yet. Add them in the Compare offers tab, or with the Compare button in Optimize my finances."))}</p>`}`, "savings", T("Open Compare Offers"));
    });
    el.querySelector('[data-action="ov-sav"]')?.addEventListener("click", () => {
      const tot = hold.reduce((a, h) => a + h.value, 0) || 1, PAL = ["#34d399", "#3b9bea", "#eda100", "#e87ba4", "#8b5cf6", "#22c7a0"];
      const col = i => PAL[i % PAL.length], safePct = Math.round(p.safe / tot * 100), growth = svCh === null ? null : (svCh >= 0 ? "+" : "−") + Math.abs(Math.round(svCh * 10) / 10).toString().replace(".", ",") + "%";
      ovWin("pig", T("Your Savings"), T("Where your savings are and how they are growing."),
        `<div class="sv2-hero"><div><small>${esc(T("Total Savings"))}</small><b>${esc(pln(p.total))}</b>
            <span class="sv2-chip ${svCh === null ? "" : svCh >= 0 ? "up" : "down"}">${growth === null ? esc(T("Not enough history yet")) : "↗ " + esc(growth) + " " + esc(T("Growth (YTD)"))}</span></div>
          ${hold.length ? `<div class="sv2-donut">${donut(hold.map((h, i) => ({ label: h.label, value: h.value, color: col(i) })), "", "")}</div>` : ""}</div>
        <div class="sv2-split"><div class="sv2-bar"><i style="width:${safePct}%"></i></div>
          <div class="sv2-leg"><span><u class="g"></u>${esc(T("Safe savings"))} <b>${esc(pln(p.safe))}</b></span><span><u class="o"></u>${esc(T("Higher-risk savings"))} <b>${esc(pln(p.risky))}</b></span></div></div>
        <h4>${esc(T("Accounts & Holdings"))}</h4>
        ${hold.length ? hold.map((h, i) => `<div class="ow-row sv2-row"><span class="ow-t"><b><u style="background:${col(i)}"></u>${esc(h.label)}</b><i style="width:${Math.max(4, Math.round(h.value / tot * 100))}%;background:${col(i)}"></i></span><span>${Math.round(h.value / tot * 100)}%</span><b>${esc(pln(h.value))}</b></div>`).join("") : `<p class="hint mc-empty">${esc(T("No savings added yet."))}</p>`}`, "portfolio", T("Open Savings"));
    });
    el.querySelectorAll("[data-savview]").forEach(b => b.onclick = ev => {
      ev.stopPropagation(); d.Settings.SavingsView = b.dataset.savview || null; save(); App.refresh();
    });
    el.querySelectorAll("[data-wave]").forEach(b => b.onclick = ev => {
      ev.stopPropagation();
      const h = new Set(d.Settings.WaveHidden || []), k = b.dataset.wave;
      h.has(k) ? h.delete(k) : h.add(k);
      d.Settings.WaveHidden = [...h]; save(); App.refresh();
    });
  },
};
/** "Your savings" on the Overview: the balance at each month end (from your statements) and the key figures, like a bank shows them. */
function savingsFacts(d, p) {
  const sv = savingsData(d);
  const accs = sv ? sv.accounts.filter(a => a.values.some(v => v > 0)) : [];
  // Which account the chart shows: all accounts combined (stacked by account) or one account
  const pick = accs.find(a => a.id === d.Settings.SavingsView) || null;
  const valAt = i => pick ? (pick.values[i] || 0) : sv.total[i];
  const pts = sv ? sv.months.map((m, i) => ({ m, i, v: valAt(i) })).filter(x => x.v > 0) : [];
  const short = v => { const a = Math.abs(v); return a >= 1000 ? (Math.round(a / 100) / 10).toString().replace(".", ",") + "k" : String(Math.round(a)); };
  const sign = v => (v >= 0 ? "+" : "−") + pln(Math.abs(v));
  let out = "";
  if (accs.length >= 2) out += `<div class="sav-pick">${[{ id: "", label: T("All accounts"), color: "" }, ...accs].map(a =>
    `<button class="sav-chip${(pick ? pick.id : "") === a.id ? " on" : ""}" data-savview="${esc(a.id)}"${a.color ? ` style="--c:${a.color}"` : ""}>${a.color ? "<i></i>" : ""}${esc(a.label)}</button>`).join("")}</div>`;
  if (pts.length >= 2) {
    const shown = pts.slice(-6), max = Math.max(...shown.map(x => x.v)), min = Math.min(...shown.map(x => x.v));
    // Zoomed scale: balances that change little would otherwise all look the same height (exact values are written above the bars)
    const lo = Math.max(0, min - (max - min) * 1.2), hgt = v => max > lo ? 10 + (v - lo) / (max - lo) * 46 : 56;
    const segs = x => pick || accs.length < 2 ? `<span class="sav" style="height:${hgt(x.v)}px${pick ? `;background:${pick.color}` : ""}"></span>`
      : `<span class="sav stack" style="height:${hgt(x.v)}px">${accs.map(a => (a.values[x.i] || 0) > 0 ? `<b style="flex:${a.values[x.i]};background:${a.color}"></b>` : "").reverse().join("")}</span>`;
    const tip = x => monthName(x.m) + ": " + pln(x.v) + (pick || accs.length < 2 ? "" : "\n" + accs.filter(a => a.values[x.i] > 0).map(a => a.label + ": " + pln(a.values[x.i])).join("\n"));
    out += `<div class="mini-bars sav-bars">${shown.map((x, k) => {
      const prev = k ? shown[k - 1].v : pts[pts.indexOf(x) - 1]?.v, ch = prev !== undefined ? x.v - prev : null;
      return `<div class="mb" title="${esc(tip(x))}"><em>${esc(short(x.v))}</em>${segs(x)}<small>${esc(monthName(x.m).slice(0, 3))}</small>${ch === null ? "<small>&nbsp;</small>" : `<small class="${ch >= 0 ? "up" : "down"}">${ch >= 0 ? "+" : "−"}${esc(short(ch))}</small>`}</div>`;
    }).join("")}<span class="mb-label">${esc(T("Balance at month end"))}</span></div>`;
    const first = pts[0], cur = pts[pts.length - 1], ch = cur.v - first.v, months = Math.max(1, pts.length - 1);
    const net = pick ? pick.net : sv.netTotal;
    out += row(pick ? T("Account balance") : T("Savings balance"), pln(pick ? cur.v : p.total), "strong") +
      row(T("Change since {0}", monthName(first.m)), sign(ch), ch >= 0 ? "in" : "out") +
      row(T("Average change per month"), sign(ch / months), ch >= 0 ? "in" : "out") +
      (net > 0 ? row(T("Net interest earned (after tax)"), "+" + pln(net), "in") : "");
  } else {
    out += row(T("Savings balance"), pln(p.total), "strong") + hint(T("Import the statement of your savings account (Savings tab) to see your balance month by month."));
  }
  if (pick) return out;
  const share = v => Math.round(v / p.total * 100) + "%";
  out += row(T("Secure savings (bank, cash)"), p.risky > 0 ? `${pln(p.safe)} <small class="hint">${share(p.safe)}</small>` : pln(p.safe)) +
    (p.risky > 0 ? row(T("Investments at risk (crypto, securities)"), `${pln(p.risky)} <small class="hint">${share(p.risky)}</small>`, "out") : "") +
    row(T("Interest p.a. (gross)"), pln(p.yearly));
  return out;
}
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
  const dh = d.Settings.DebtHistory || (d.Settings.DebtHistory = {}), debtNow = Math.round(d.Loans.filter(l => l.Remaining > 0).reduce((a, l) => a + loanPlan(l).remainingNow, 0));
  if (h[key] !== Math.round(total) || dh[key] !== debtNow) { h[key] = Math.round(total); dh[key] = debtNow; save(); }
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

let incRange = 6, incDraft = null, incWin = null, lastInc = { src: "", add: "", imp: "" };
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
    const f = e || { Name: incDraft?.Name || "", Type: "Salary", Amount: "", Currency: mainCur(), Frequency: incDraft?.Frequency || "Monthly", Date: isoDate(today()), Active: true };
    const up = Calc.upcoming(d, today(), addDays(today(), 60));
    const dayText = dt => { const n = Math.round((dt - today()) / 86400000); return n === 0 ? T("today") : n === 1 ? T("tomorrow") : T("in {0} days", n); };

    // ---- Income Management layout ----
    const trend = ChartData.trend(d), pastM = trend.slice(-6);
    const doneM = trend.filter(m => !m.current && (m.income > 0 || m.expenses > 0));
    const lastM = doneM[doneM.length - 1], prevM = doneM[doneM.length - 2];
    const active = d.Incomes.filter(i => i.Active && i.Frequency !== ONE_TIME);
    const fmtShort = dt => new Intl.DateTimeFormat(LOC(), { day: "numeric", month: "short" }).format(dt);
    const futureM = Array.from({ length: 6 }, (_, k) => { const st = addMonths(monthStart(today()), k + 1); return { month: new Intl.DateTimeFormat(LOC(), { month: "short" }).format(st), value: Calc.upcoming(d, st, addDays(addMonths(st, 1), -1)).reduce((x, p) => x + p.amount, 0) }; });
    const shares = active.map(i => Calc.monthlyPln(i, s)), totalShare = shares.reduce((x, y) => x + y, 0), maxShare = totalShare > 0 ? Math.max(...shares) / totalShare : 0;
    const iconFor = i => ic(i.Type === "Salary" ? '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>' : i.Type === "Investments" ? '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>' : '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>', 22);
    const kpi = (label, value, icon, cls, extra) => `<div class="kpi static"><span class="kpi-ic ${cls}">${icon}</span><span class="kpi-t"><span class="kpi-l">${esc(label)}</span><b>${value}</b>${extra || ""}</span></div>`;
    const incPast = pastM.map(m => m.income);
    const kpis = `<div class="ov-kpis">
      ${kpi(T("Monthly Income"), pln(inc.monthlyTotal), ic('<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>', 26), "in", (lastM && prevM ? deltaTag(lastM.income, prevM.income) : "") + spark(incPast, "#34D399"))}
      ${kpi(T("Active Sources"), String(active.length), ic('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.500 2.400 6.500 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.700 0 4.500 1.800 4.500 4.500"/>', 26), "src", `<small class="kpi-sub">${esc(T("active recurring income streams"))}</small>`)}
      ${kpi(T("Next Payment"), up[0] ? esc(fmtDate(up[0].date)) : "–", ic('<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4M8 14h2M12 14h2"/>', 26), "next", up[0] ? `<small class="kpi-sub">${esc(up[0].source.Name)} · ${esc(dayText(up[0].date))}</small>` : "")}
      ${kpi(T("Savings Potential"), avg.monthsUsed ? pln(left) : "–", ic('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>', 26), "rate", (lastM && prevM ? deltaTag(lastM.income - lastM.expenses, prevM.income - prevM.expenses) : "") + spark(pastM.map(m => m.income - m.expenses), "#34D399"))}
    </div>`;
    const srcCard = card(`<div class="oc-head"><h3>${ic('<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>', 22)} ${esc(T("Income Sources"))}</h3></div>` +
      (d.Incomes.length ? `<div class="is-head"><span>${esc(T("Name"))}</span><span>${esc(T("Amount"))}</span><span>${esc(T("Frequency"))}</span><span>${esc(T("Status"))}</span><span></span></div>` + d.Incomes.map(i => `
        <div class="is-row clickable${i.Active ? "" : " off"}" data-edit-income="${i.Id}"><span class="is-n">${iconFor(i)}<b>${esc(i.Name)}</b></span><b>${amount(i.Amount, i.Currency)}</b><span>${esc(i.Frequency === ONE_TIME ? T("one-time") : freqLabel(i.Frequency))}</span>
          <label class="switch" title="${esc(T("Active (count it in the totals)"))}"><input type="checkbox" data-active-income="${i.Id}"${i.Active ? " checked" : ""}><span></span></label>
          <button class="icon-btn danger" data-del-income="${i.Id}" title="${esc(T("Delete"))}">🗑</button></div>`).join("") : hint(T("No income added yet."))), "ov-card");
    const insights = [
      T("Active income sources: {0}", active.length),
      T("Income diversification score: {0}/100", Math.round((1 - maxShare) * 100)),
      T("Upcoming payments expected: {0}", up.length),
      T("Estimated annual income: {0}", pln(inc.monthlyTotal * 12 + inc.oneTimeThisYear)),
      avg.monthsUsed && inc.monthlyTotal > 0 ? T("You keep {0} of your income", savingsRateText(left, inc.monthlyTotal)) : T("Add expenses to see your savings rate"),
    ];
    const aiCard = card(`<div class="oc-head"><h3>${ic('<path d="M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>', 24)} ${esc(T("Income Insights"))}</h3></div><ul class="ai-list">${insights.map(t => `<li><i>✓</i>${esc(t)}</li>`).join("")}</ul>
      <button class="btn main ai-btn" data-action="optimize">${esc(T("Optimize My Income"))} →</button>`, "ov-card ai-card");
    const fcCard = card(`<div class="oc-head"><h3>${ic('<rect x="4" y="11" width="4" height="9" rx="1"/><rect x="10" y="5" width="4" height="15" rx="1"/><rect x="16" y="13" width="4" height="7" rx="1"/>', 22)} ${esc(T("Income Forecast"))}</h3>${legendKeys([{ color: C_IN, label: T("Income") }, { color: C_OUT, label: T("Projected") }])}</div>` +
      (pastM.length || futureM.some(x => x.value > 0) ? ovForecast(pastM.map(m => ({ month: m.month, value: m.income })), futureM) : hint(T("Add income to see the forecast."))), "ov-card");
    const preview = plain(f.Amount) || "0";
    const addCard = card(`<form id="income-form" class="inc-form">
      <div class="inc-fields"><h3 class="inc-h">${ic('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>', 24)} ${esc(e ? T("Edit: {0}", e.Name) : T("Add Income"))}</h3>
        ${field(T("Name"), textInput("name", f.Name, T("e.g. {0}", T("Salary, side job"))))}
        ${field(T("Type"), select("type", INCOME_TYPES.map(t => [t, T(t)]), f.Type))}
        ${field(T("Currency"), select("currency", CURRENCIES, f.Currency))}
        <div class="gross-box"${f.Type === "Salary" && f.Currency === "PLN" ? "" : " hidden"}>
          <div class="cat-row">${field(T("Gross salary per month (brutto, optional)"), numInput("gross", plain(f.Gross), T("e.g. {0}", "10000")))}
          ${button("→ " + esc(T("Calculate net")), "calc-net", "second small")}</div>
          <p class="hint">${esc(T("Estimate for an employment contract (umowa o pracę) in Poland: social and health insurance and income tax. Bonuses, a sport card, PPK, the under-26 relief, overtime or another kind of contract change your net pay."))}</p>
        </div>
        ${field(T("Net Amount"), numInput("amount", plain(f.Amount), T("e.g. 8500 (what you actually receive, after tax)")))}</div>
      <div class="inc-side"><div class="inc-prev"><span>${esc(T("Net Income Preview"))}</span><b id="inc-prev">${esc(pln(num(preview) || 0))}</b>
          <h4>${esc(T("Payment Schedule"))}</h4>
          <div class="sch-chips">${FREQUENCIES.map(x => `<button type="button" class="sch-chip${x[0] === f.Frequency ? " on" : ""}" data-freq="${esc(x[0])}">${esc(T(x[0] === "Every 2 weeks" ? "Every 2 Weeks" : x[0]))}</button>`).join("")}</div>
          <div hidden>${select("frequency", FREQUENCIES.map(x => [x[0], T(x[0])]), f.Frequency)}</div>
          ${field(f.Frequency === ONE_TIME ? T("Date the money arrives") : T("Payment date"), dateInput("date", inputDate(parseDate(f.Date))))}
          <p class="hint date-hint"${f.Frequency === ONE_TIME ? " hidden" : ""}>${esc(T("Any payment date – the last or the next one. MoneyCompass repeats it."))}</p></div>
        <div class="income-span"${f.Frequency === ONE_TIME ? " hidden" : ""}>
          <div class="two">${field(T("Start date (optional)"), dateInput("start", f.StartDate ? inputDate(parseDate(f.StartDate)) : ""))}
          <div class="field"><span>${esc(T("End date"))}</span>${dateInput("end", f.EndDate ? inputDate(parseDate(f.EndDate)) : "").replace("<input", `<input${f.EndDate ? "" : " disabled"}`)}
          <label class="check small"><input type="checkbox" name="noend"${f.EndDate ? "" : " checked"}><span>${esc(T("No end date"))}</span></label></div></div>
        </div>
        ${check("active", T("Active (count it in the totals)"), f.Active)}
        <button type="button" class="btn main inc-save" data-action="save-income">✓ ${esc(e ? T("Save changes") : T("Save Income"))}</button>${e ? button(T("Cancel editing"), "cancel-income") : ""}</div></form>`, "ov-card inc-add");
    const tlCard = card(`<div class="oc-head"><h3>${ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 22)} ${esc(T("Upcoming Income Timeline"))}</h3></div>` + (up.length ? `<div class="tl">${up.slice(0, 6).map(p => `<div class="tl-i"><i></i><span class="tl-d">${esc(fmtShort(p.date))}</span><span><b>${esc(p.source.Name)}</b><small>${pln(p.amount)}</small></span></div>`).join("")}</div>` : hint(T("No payments expected in this period."))), "ov-card");
    const npCard = card(`<div class="oc-head"><h3>${ic('<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>', 22)} ${esc(T("Next Payments"))}</h3></div>` + (up.length ? up.slice(0, 5).map(p => `<div class="np-row"><span>${iconFor(p.source)}${esc(p.source.Name)}</span><b>${pln(p.amount)}</b><small>${esc(fmtDate(p.date))}</small></div>`).join("") : hint(T("No payments expected in this period."))), "ov-card");
    const impCard = card(`<div class="oc-head"><h3>${ic('<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>', 22)} ${esc(T("Imported Statements"))}</h3></div>` + hint(T("Money that came into your account, from your bank imports. Choose for each payment how it counts: Extra income – only in that month. Salary – your regular pay, counted every month through Your income sources. Not income – transfers between your own accounts.")) +
      (d.Received.length ? importedList(d) : hint(T("Nothing imported yet."))), "ov-card");
    // ---------- Income Intelligence (design mockup) ----------
    const okI = `<span class="nw-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12.500l4.500 4.500L19 7.500"/></svg></span>`;
    const stab = active.length ? Math.round(Math.min(100, 50 + 30 * (1 - maxShare) + (!avg.monthsUsed || left >= 0 ? 20 : 0))) : 0, stabL = !active.length ? "–" : stab >= 80 ? T("Strong") : stab >= 60 ? T("Good") : T("Fair");
    const growth = avg.monthsUsed ? Math.max(0, left) : 0, annual = inc.monthlyTotal * 12 + inc.oneTimeThisYear;
    const nM = incRange, mLabels = [], mRec = [], mAll = [];
    for (let k = 0; k < nM; k++) { const st = addMonths(monthStart(today()), k), en = addDays(addMonths(st, 1), -1), pays = Calc.upcoming(d, k === 0 ? today() : st, en); mLabels.push(new Intl.DateTimeFormat(LOC(), { month: "short", year: "numeric" }).format(st)); mAll.push(Math.round(pays.reduce((x, y) => x + y.amount, 0))); mRec.push(Math.round(inc.monthlyTotal)); }
    const stepL = Math.ceil(nM / 6), thin = mLabels.map((l, i) => i % stepL === 0 ? l : "");
    const head = pageHead({ icon: "trend", title: T("Income Intelligence"), sub: T("Manage recurring income, forecast future cash flow and optimize financial growth."),
      kpis: [{ l: T("Monthly Income"), v: pln(inc.monthlyTotal), icon: "wallet", cls: "in" }, { l: T("Income Stability"), v: stabL, icon: "shield", cls: "src" }, { l: T("Next Payment"), v: up[0] ? fmtDate(up[0].date) : "–", icon: "cal", cls: "next" }, { l: T("Income Growth Potential"), v: pln(growth), icon: "trend", cls: "rate" }] });
    const fcBand = `<div class="nw-card ni-fc"><div class="ni-fh"><span class="rp-si i-res">${si(IC.bars, 26)}</span><h3>${esc(T("Income Forecast"))}</h3><span class="sv-tabs ni-tabs">${[3, 6, 12].map(n => `<button type="button" data-incr="${n}" class="${n === nM ? "on" : ""}">${n} ${esc(T("Months"))}</button>`).join("")}</span><span class="em-pill ni-pill">${okI} ${esc(left >= 0 || !avg.monthsUsed ? T("Healthy Cash Flow") : T("Check your spending"))}</span></div>
      <div class="ni-fb"><div class="ni-ch"><span class="sv-leg"><i style="background:#2EDC9A"></i>${esc(T("Monthly Income"))}<i style="background:#3B9BFF"></i>${esc(T("Projected Income"))}</span>${lineChart(thin, [{ vals: mRec, color: "#2EDC9A", dots: true, area: true }, { vals: mAll, color: "#3B9BFF", dash: true, dots: true }], { w: 720, h: 200 })}</div>
        <div class="ni-fr"><small>${esc(T("Annual Income Projection"))}</small><b class="ni-big">${esc(pln(annual))}</b><em>${esc(T("EXPECTED CASH FLOW"))}</em><small class="tx-note">${esc(T("Net income, after tax. Tax rises in steps with your pay."))}${moduleOn("taxes") ? ` <a href="#" data-go="taxes">${esc(T("See the tax estimate"))} →</a>` : ""}</small>
          <div class="ni-fs"><div><small>${esc(T("Remaining Money"))}</small><b>${esc(avg.monthsUsed ? pln(left) : "–")}</b></div><div><small>${esc(T("Expected Annual Surplus"))}</small><b>${esc(avg.monthsUsed ? pln(left * 12) : "–")}</b></div><div><small>${esc(T("Savings Potential"))}</small><b class="good">${esc(pln(growth))}/${esc(T("month"))}</b></div></div>
          <button class="sv-btn ni-opt" data-action="optimize">${si(IC.trend, 18)} ${esc(T("Optimize My Income"))}</button></div></div></div>`;
    const pal = ["#2EDC9A", "#3B9BFF", "#8B5CF6", "#9AA7B2", "#F5A623", "#C98FA0"], srcItems = active.map((i, n) => ({ n: i.Name, v: shares[n], c: pal[n % pal.length] })).filter(x => x.v > 0);
    const srcDash = dcard("bank", "res", T("Income Sources"), `<div class="sv-ar">${donut(srcItems.map(x => ({ label: x.n, value: x.v, color: x.c })), pln(inc.monthlyTotal), T("/ month"), 130)}<ul class="sv-al">${srcItems.map(x => `<li><i style="background:${x.c}"></i><span>${esc(x.n)}</span><b>${totalShare > 0 ? Math.round(x.v / totalShare * 100) : 0}%</b></li>`).join("") || `<li class="hint">${esc(T("No income added yet."))}</li>`}</ul></div>`, { klass: "ni-src", extra: PM("inc-src", T("Edit income sources")) });
    const tlDash = dcard("calx", "res", T("Income Timeline"), `<div class="ni-tl">${up.slice(0, 3).map(x => `<div class="ni-tr"><i></i><small>${esc(fmtDate(x.date))}</small><b>${esc(x.source.Name)}</b><em>+${esc(pln(x.amount))}</em></div>`).join("") || `<p class="hint">–</p>`}</div>`, { klass: "ni-tlc" });
    const insDash = dcard("bulb", "res", T("Income Insights"), `<ul class="nw-ul">${[stab >= 80 ? T("Income stability score excellent.") : T("Income stability score: {0}/100", stab), up.length ? T("Upcoming payments detected.") : null, annual > 0 ? T("Annual income forecast available.") : null, growth > 0 ? T("Savings capacity remains strong.") : null, up.length ? T("No payment gaps expected.") : null].filter(Boolean).map(x => `<li>${okI}<span>${esc(x)}</span></li>`).join("") || `<li class="hint">–</li>`}</ul>`, { klass: "ni-ins" });
    const salDet = d.Received.some(r => r.Kind === RECEIVED.salary);
    const impDash = `<div class="nw-card dz ni-imp"><div class="nw-ch"><span class="rp-si i-res">${si(IC.docs, 24)}</span><h3>${esc(T("Imported Income Analysis"))}</h3></div><div class="ni-ib"><span class="ni-tick">${okI}</span><div><b>${esc(salDet ? T("Recurring salary payments detected") : d.Received.length ? T("Imported payments: {0}", d.Received.length) : T("No bank statement imported yet"))}</b><small>${esc(salDet ? T("Your employment income is recognized and shows a stable trend.") : T("Import a bank statement (Import button, top right) to detect your income automatically."))}</small></div>
      <span class="ni-bars"><i style="height:30%"></i><i style="height:45%"></i><i style="height:40%"></i><i style="height:62%"></i><i style="height:78%"></i><i style="height:100%"></i></span></div><button class="sv-btn ghost ni-vd" data-action="inc-imp">${esc(T("View Details"))}</button></div>`;
    const alloc = [[T("Essential costs"), avg.essential, "#2EDC9A"], [T("Not essential"), avg.nonEssential, "#3B9BFF"], [T("Savings"), Math.max(0, left), "#F5A623"]].filter(x => x[1] > 0);
    const allocTot = alloc.reduce((x, y) => x + y[1], 0);
    const allocDash = dcard("pie", "res", T("Income Allocation"), `<div class="sv-ar">${donut(alloc.map(x => ({ label: x[0], value: x[1], color: x[2] })), "", "", 120)}<ul class="sv-al">${alloc.map(x => `<li><i style="background:${x[2]}"></i><span>${esc(x[0])}</span><b>${Math.round(x[1] / allocTot * 100)}%</b></li>`).join("") || `<li class="hint">${esc(T("Add expenses in the Outflows tab to see how your income is used."))}</li>`}</ul></div>`, { klass: "ni-alloc" });
    const addDash = `<div class="nw-card dz ni-add"><div class="nw-ch"><span class="rp-si i-res">${si(IC.plus, 24)}</span><h3>${esc(T("Add Income Source"))}</h3></div><div class="two">${field(T("Income Name"), textInput("qname", "", T("e.g. {0}", T("Salary, side job"))))}${field(T("Type"), select("qtype", [["Monthly", T("Recurring")], [ONE_TIME, T("One-time")]], "Monthly"))}</div><button class="sv-btn ni-addb" data-action="inc-add">＋ ${esc(T("Add Income Source"))}</button></div>`;
    const botBand = `<div class="nw-card rp-sum ni-bot"><div class="sv-b1"><span class="rp-si i-res">${si(IC.heart, 38)}</span><div><small>${esc(T("Income Health Score"))}${scoreInfoBtn(T("Income Health Score"), stab + " / 100", [
    { label: T("Base"), points: 50, max: 50, detail: T("Every income source you entered starts here.") },
    { label: T("Spread across sources"), points: 30 * (1 - maxShare), max: 30, detail: T("Your biggest source is {0}% of your income. The more evenly spread, the more points.", Math.round(maxShare * 100)) },
    { label: T("Income covers spending"), points: !avg.monthsUsed || left >= 0 ? 20 : 0, max: 20, detail: !avg.monthsUsed || left >= 0 ? T("Your income covers your spending.") : T("You spend more than you earn.") }])}</small><b>${stab} / 100</b></div></div><div class="sv-b1 dv"><span class="rp-si i-res">${si(IC.shield, 32)}</span><div><small>${esc(T("Income Stability"))}</small><b>${esc(stab >= 80 ? T("Excellent") : stabL)}</b></div></div><div class="sv-b1 dv"><span class="rp-si i-res">${si(IC.bars, 30)}</span><div><small>${esc(T("Annual Projection"))}</small><b>${esc(pln(annual))}</b></div></div><div class="sv-b1 dv"><span class="rp-si i-res">${si(IC.pig, 32)}</span><div><small>${esc(T("Savings Potential"))}</small><b>${esc(pln(growth))}/${esc(T("month"))}</b></div></div><div class="ni-bm">${okI}<span>${esc(T("Your income remains stable and provides strong opportunities for long-term savings growth."))}</span></div></div>`;
    lastInc = { src: srcCard + binCard(["income", "received"]), add: addCard, imp: impCard };
    el.innerHTML = `<div class="ni-page">${head}${fcBand}<div class="ni-r2">${srcDash}${tlDash}${insDash}</div><div class="ni-r3">${impDash}${allocDash}${addDash}</div>${botBand}</div>`;
    el.querySelectorAll("[data-incr]").forEach(b => b.onclick = () => { incRange = +b.dataset.incr; App.refresh(); });
    const openInc = (key, title, icon, width) => {
      const pp = popup("", { width, cls: "nw-win sc-win" }), orig = App.refresh; incWin = pp;
      const EMO = { src: "🏦", add: "＋", imp: "📄" }, SUB = { src: T("Everything you earn – switch a source off to leave it out of the totals."), add: T("Add what you earn so MoneyCompass can show what is left each month."), imp: T("Statements you imported.") };
      const draw = () => {
        const ii = Calc.income(D()), act = D().Incomes.filter(x => x.Active && x.Frequency !== ONE_TIME).length;
        const top = key === "src" ? `<div class="ow-bigs"><div class="ow-big"><small>${esc(T("Monthly Income"))}</small><b class="good">${esc(pln(ii.monthlyTotal))}</b></div><div class="ow-big"><small>${esc(T("Active Sources"))}</small><b>${act}</b></div></div>` : "";
        pp.el.innerHTML = `<div class="nw-hd"><span class="nw-hi">${EMO[key] || "💶"}</span><div><h2>${esc(title)}</h2><p class="nw-sub">${esc(SUB[key] || "")}</p></div><button class="nw-x" data-close aria-label="${esc(T("Close"))}">✕</button></div><div class="sc-body inc2-body">${top}<div class="grid bp-flat inc-pop">${lastInc[key]}</div></div>${key === "add" ? "" : `<div class="nw-ft"><button class="btn second" data-close>${esc(T("Close"))}</button></div>`}`;
        pp.el.querySelectorAll(".inc-pop .oc-head h3, .inc-pop .inc-h").forEach(h => { const hd = h.closest(".oc-head"); if (key === "add" || h.textContent.trim() === title) { if (hd && hd.children.length === 1) hd.remove(); else h.remove(); } });
        if (key === "add") bindAdd(pp.el); if (key === "src") { bindSrc(pp.el); bindBin(pp.el); } if (key === "imp") bindRec(pp.el); };
      App.refresh = (...a) => { orig(...a); if (key === "add") pp.close(); else if (!pp.closed) draw(); };
      const close = pp.close; pp.close = (...a) => { App.refresh = orig; incWin = null; close(...a); };
      draw();
    };
    el.querySelector('[data-action="inc-src"]')?.addEventListener("click", () => openInc("src", T("Income Sources"), "bank", 760));
    el.querySelector('[data-action="inc-imp"]')?.addEventListener("click", () => openInc("imp", T("Imported Statements"), "docs", 900));
    el.querySelector('[data-action="inc-add"]')?.addEventListener("click", () => { incDraft = { Name: el.querySelector('[name="qname"]').value.trim(), Frequency: el.querySelector('[name="qtype"]').value }; editIncome = null; App.refresh(); openInc("add", T("Add Income"), "plus", 1000); });
    const bindEdit = id => { incWin?.close(); editIncome = id; App.refresh(); openInc("add", T("Edit income"), "plus", 1000); };
    const bindAdd = el => {
    el.querySelectorAll("[data-freq]").forEach(b => b.onclick = () => { const fq = el.querySelector('#income-form [name="frequency"]'); fq.value = b.dataset.freq; fq.dispatchEvent(new Event("change")); el.querySelectorAll("[data-freq]").forEach(x => x.classList.toggle("on", x === b)); });
    el.querySelector('#income-form [name="amount"]').addEventListener("input", ev => { el.querySelector("#inc-prev").textContent = pln(num(ev.target.value) || 0); });

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
    };
    const bindSrc = el => {
    el.querySelectorAll("[data-active-income]").forEach(c => c.onchange = () => {
      const i = d.Incomes.find(y => y.Id === c.dataset.activeIncome); i.Active = c.checked; save(); App.refresh();
    });
    el.querySelectorAll("[data-edit-income]").forEach(x => x.onclick = ev => {
      if (ev.target.closest("[data-del-income], .switch")) return;
      bindEdit(x.dataset.editIncome);
    });
    el.querySelectorAll("[data-del-income]").forEach(b => b.onclick = async () => {
      const i = d.Incomes.find(x => x.Id === b.dataset.delIncome);
      if (await confirmBox(T("Delete?"), i.Name, T("Delete"), T("Cancel"), true)) {
        toBin("income", i); d.Incomes = d.Incomes.filter(x => x !== i); if (editIncome === i.Id) editIncome = null; save(); App.refresh();
      }
    });
    };
    const bindRec = el => {
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
    };
  },
};
/** Imported inflows, month by month: the newest month open, older ones folded – so a long import stays short.
 *  A filter shows only salary, extra income or "not income". */
let recFilter = "", recOpen = new Map();
const histOpen = new Map();
document.addEventListener("toggle", e => { const h = e.target.closest?.(".hist-month"); if (h) histOpen.set(+h.dataset.hm, h.open); }, true);
function importedList(d) {
  const rows = [...d.Received].filter(r => !recFilter || r.Kind === recFilter).sort((a, b) => parseDate(b.Date) - parseDate(a.Date));
  const months = new Map();
  for (const r of rows) { const m = monthStart(parseDate(r.Date)), k = m.getTime(); if (!months.has(k)) months.set(k, { m, list: [] }); months.get(k).list.push(r); }
  const count = k => d.Received.filter(r => r.Kind === k).length;
  const chips = [["", T("All") + " (" + d.Received.length + ")"], ...KINDS.map(([k, n]) => [k, T(n).replace(/ \(.*\)$/, "") + " (" + count(k) + ")"])];
  const item = r => `
          <div class="item rec-item"><div><b class="rec-desc" title="${esc(r.Description || "")}">${esc(r.Description || "–")}</b><span class="hint">${fmtDate(r.Date)} · +${pln(r.Amount)}${r.Own ? " · 🔁 " + esc(T("from your own account")) : ""}${r.Kind === RECEIVED.income ? (rr => ` · <button class="rep-tag${rr ? " on" : ""}" data-repeat-rec="${r.Id}" title="${esc(T("How often does it repeat?"))}">🔁 ${esc(rr ? freqLabel(rr) : T("Does not repeat"))}</button>`)(receivedRepeatOn(d, r)) : ""}</span></div>
          <div class="rec-ctl">${select("kind-" + r.Id, KINDS.map(k => [k[0], T(k[1])]), r.Kind)}${infoBtn("received", r)}
          <button class="icon-btn danger" data-del-received="${r.Id}" title="${esc(T("Delete"))}">🗑</button></div></div>`;
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
    d.Incomes.push({ Id: uuid(), Name: T("Salary"), Type: "Salary", Amount: r.Amount, Currency: mainCur(), Frequency: "Monthly", Date: isoDate(parseDate(r.Date)), Active: true });
    save();
  }
}

// ================================================================= Expenses

let showAllMonths = false;
const flt = { cat: "", text: "", ess: "", rep: false, min: "", max: "", days: "" };   // filter of "Your expenses"
let lastEx = { hist: "", side: "" };
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
    const shown = d.Expenses.filter(e => (!flt.cat || e.Category === flt.cat) && (!(minA > 0) || e.Amount >= minA) && (!(maxA > 0) || e.Amount <= maxA) && (!since || parseDate(e.Date) >= since) && (!flt.ess || (flt.ess.startsWith("i:") ? impOf(e) === flt.ess.slice(2) : (flt.ess === "yes") === !!e.Essential)) && (!flt.rep || !!repeatOn(e)) &&
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
      <select name="f-ess"><option value="">${esc(T("All"))}</option><option value="yes"${flt.ess === "yes" ? " selected" : ""}>${esc(T("Essential"))}</option><option value="no"${flt.ess === "no" ? " selected" : ""}>${esc(T("Not essential"))}</option>${IMPORTANCE.map(x => `<option value="i:${x[0]}"${flt.ess === "i:" + x[0] ? " selected" : ""}>${esc(T(x[1]))} ★</option>`).join("")}</select>
      <select name="f-days"><option value="">${esc(T("Whole period"))}</option>${[30, 90, 180, 365].map(n => `<option value="${n}"${String(n) === flt.days ? " selected" : ""}>${esc(T("Last {0} days", n))}</option>`).join("")}</select>
      <span class="amount-range"><input name="f-min" inputmode="decimal" value="${esc(flt.min)}" placeholder="${esc(T("Amount from"))} zł" data-tip="${esc(T("Amount from"))} (zł)"><span>–</span><input name="f-max" inputmode="decimal" value="${esc(flt.max)}" placeholder="${esc(T("Amount to"))} zł" data-tip="${esc(T("Amount to"))} (zł)"></span>
      <label class="check"><input type="checkbox" name="f-rep"${flt.rep ? " checked" : ""}><span>🔁 ${esc(T("Repeating only"))}</span></label>
      ${filtering ? `<button class="btn second small" data-action="f-clear">✕ ${esc(T("Clear filter"))}</button>` : ""}</div>` +
      (filtering ? `<p class="filter-result">${esc(T("Outflows found: {0} · together {1}", shown.length, pln(shown.reduce((s, e) => s + e.Amount, 0))))}</p>` : "") : "";
    const older = months.slice(3).reduce((s, m) => s + m.items.length, 0);
    const loans = Calc.loanPayments(d);

    const otherCount = d.Expenses.filter(x => x.Category === OTHER).length;
    const big0 = cats.all && cats.all[0], daysIn = 30, monthly = avg.monthsUsed ? avg.essential + avg.nonEssential : 0;
    const expHead = pageHead({ icon: "wallet", title: T("Expenses Management"), sub: T("Track spending, identify savings opportunities and improve your budget."),
      kpis: [{ l: T("Monthly Spending"), v: monthly ? pln(monthly) : "–", icon: "coins", cls: "in" }, { l: T("Average Daily Spending"), v: monthly ? pln(monthly / daysIn) : "–", icon: "cal", cls: "src" }, { l: T("Largest Category"), v: big0 ? categoryLabel(big0.category) : "–", icon: "trophy", cls: "next", sub: big0 ? pln(big0.perMonth) : "" }, { l: T("Potential Savings"), v: avg.monthsUsed ? pln(avg.nonEssential * 0.2) : "–", icon: "pig", cls: "rate", sub: T("per month") }], btn: `<button class="btn main rp-gen" data-action="ex-add">＋ ${esc(T("Add Expense"))}</button>` });
    const expBand = band(T("Savings Opportunities"), "pig", [{ l: T("Not essential per month"), v: avg.monthsUsed ? pln(avg.nonEssential) : "–" }, { l: T("Spending 20% less there saves"), v: avg.monthsUsed ? pln(avg.nonEssential * 0.2) + "/" + T("month") : "–", big: true, cls: "good" }], "rp-trend2");
    const tipC = otherCount >= 2 ? `<button class="tip" data-action="sort-other">🏷 ${esc(T("{0} outflows are in \"Other\" – sort them by shop in one go →", otherCount))}</button>` : "";
    const avgCard = card(heading(T("Monthly average")) + (avg.monthsUsed ? row(T("Essential"), pln(avg.essential)) + row(T("Not essential"), pln(avg.nonEssential)) + row(T("Total per month"), pln(avg.essential + avg.nonEssential)) +
          hint(basisText(d)) +
          (loans > 0 ? hint(T("Includes {0} per month of loan payments from the Loans & debts tab. Expenses in the \"Loan payments\" category are not counted, so nothing is counted twice.", pln(loans))) : "")
        : hint(T("Add expenses to see your averages."))));
    const catCard = card(heading(T("Outflows by category")) + hint(basisText(d)) + (cats.all.length
        ? (() => { // every category its own colour: the ring and the list show exactly the same
            const all = cats.all.map((c, n) => ({ key: c.category, color: COLORS.cats[n % COLORS.cats.length], label: categoryLabel(c.category), value: c.perMonth, text: pln(c.perMonth), share: ChartData.share(c.perMonth, cats.total) }));
            return `<div class="chart-row">${donut(all, pln(cats.total), T("per month"))}${legend(all)}</div>`; })() + hint(T("Click to see these expenses"))
        : hint(T("Add expenses to see where your money goes."))));
    const formCard = card(`<form id="expense-form"><div class="nw-ch"><span class="rp-si i-res">${si(IC.plus, 24)}</span><h3>${esc(T("Add Expense"))}</h3></div>
        <div class="two">${field(T("Date"), dateInput("date", inputDate(today())))}${field(T("Amount (zł)"), numInput("amount", "", T("e.g. {0}", "120,50")))}</div>
        <div class="cat-row">${field(T("Category"), select("category", [...categories().map(c => [c.Name, categoryLabel(c.Name)]), NEW_CAT()], cat0.Name))}
          ${button(T("Edit categories…"), "categories", "second small")}</div>
        ${field(T("Description (optional)"), textInput("description", "", T("e.g. {0}", "Biedronka")))}
        <div class="two">${field(T("Repeats"), select("repeat", REPEAT_OPTIONS(), ""))}<div class="hint">${esc(T("Repeating expenses appear automatically in the Calendar, also in the next months."))}</div></div>
        ${check("essential", T("Essential (must pay even in a crisis)"), cat0.Essential)}
        <div class="buttons">${button(T("Add expense"), "add-expense", "main")}</div></form>`);
    const histCard = card(hint(T("Click an expense to switch it between essential and not essential. The pen changes date, category, amount and more.")) + filterBar +
        (months.length ? visible.map((m, i) => {
          // Folded by month: the newest month open, older ones closed (all open while you search or filter)
          const total = m.items.reduce((s, e) => s + e.Amount, 0), ess = m.items.filter(e => e.Essential).reduce((s, e) => s + e.Amount, 0);
          const k = m.start.getTime(), open = filtering || (histOpen.has(k) ? histOpen.get(k) : i === 0);
          return `<details class="rec-month hist-month" data-hm="${k}"${open ? " open" : ""}><summary><b>${esc(monthName(m.start))}</b>
            <span class="hint">${esc(T("{0} expenses", m.items.length))} · <b>${pln(total)}</b> · ${esc(T("essential {0}", pln(ess)))}</span></summary><div class="list">${m.items.map(expenseRow).join("")}</div></details>`;
        }).join("") + (!showAllMonths && older ? button(T("Show older expenses ({0})", older), "older", "second") : "")
          : hint(filtering ? T("No expenses match this filter.") : T("No expenses yet."))), "wide");
    // ---------- Expenses Intelligence (design mockup) ----------
    const okE = `<span class="nw-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12.500l4.500 4.500L19 7.500"/></svg></span>`;
    const sorted0 = [...(cats.all || [])].sort((x, y) => y.perMonth - x.perMonth), t0 = today(), dim = new Date(t0.getFullYear(), t0.getMonth() + 1, 0).getDate();
    const monthSum = (off, catName) => { const m0 = monthStart(addMonths(t0, off)), m1 = addMonths(m0, 1); return d.Expenses.filter(e => { const dt = parseDate(e.Date); return dt >= m0 && dt < m1 && (!catName || e.Category === catName); }).reduce((a, e) => a + e.Amount, 0); };
    const cum = off => { const m0 = monthStart(addMonths(t0, off)), n = new Date(m0.getFullYear(), m0.getMonth() + 1, 0).getDate(), arr = Array(n).fill(0); d.Expenses.forEach(e => { const dt = parseDate(e.Date); if (dt.getFullYear() === m0.getFullYear() && dt.getMonth() === m0.getMonth()) arr[dt.getDate() - 1] += e.Amount; }); let r = 0; return arr.map(v => (r += v)); };
    const cur = cum(0).map((v, i) => i < t0.getDate() ? v : null), prev = cum(-1), prevAvg = [1, 2, 3].map(k => cum(-k)), avg3 = Array.from({ length: dim }, (_, i) => Math.round(prevAvg.reduce((a, x) => a + (x[Math.min(i, x.length - 1)] || 0), 0) / 3));
    const dayL = Array.from({ length: dim }, (_, i) => [1, 7, 14, 21, 28].includes(i + 1) ? String(i + 1) : "");
    const spentNow = monthSum(0), proj = spentNow > 0 ? spentNow / t0.getDate() * dim : monthly, budgetLim = d.Budgets.reduce((a, b) => a + (+b.MonthlyLimit || 0), 0);
    const nonEss = avg.monthsUsed ? avg.nonEssential : 0, saveM = nonEss * 0.2;
    const topNon = sorted0.filter(c => !findCategory(c.category)?.Essential).slice(0, 3);
    const opps = topNon.length ? topNon.map(c => [T("Lower {0} spending", categoryLabel(c.category)), c.perMonth * 0.2]) : [[T("Add expenses to see opportunities"), 0]];
    const optBand = `<div class="nw-card ei-opp"><button type="button" class="ei-bulb" data-action="ex-optimize" title="${esc(T("Optimize My Budget"))}">${si(IC.bulb, 70)}</button><div class="ei-o1"><h3>${esc(T("Savings Opportunities"))}</h3><small>${esc(T("Potential Monthly Savings"))}</small><b class="good">${esc(pln(saveM))}</b></div>
      <div class="ei-o2"><small>${esc(T("Potential Annual Savings"))}</small><b>${esc(pln(saveM * 12))}</b></div>
      <div class="ei-o3"><h4>${esc(T("Top Opportunities"))}</h4>${opps.map(o => `<div class="ei-op">${okE}<span>${esc(o[0])}</span><b>+${esc(pln(o[1]))}/${esc(T("month"))}</b></div>`).join("")}</div>
      <button class="sv-btn ei-ob" data-action="ex-optimize">${si(IC.trend, 18)} ${esc(T("Optimize My Budget"))}</button></div>`;
    const expHead2 = pageHead({ icon: "wallet", title: T("Expenses Intelligence"), sub: T("Analyze spending habits, reduce unnecessary costs and improve monthly savings."),
      kpis: [{ l: T("Monthly Spending"), v: monthly ? pln(monthly) : "–", icon: "wallet", cls: "in", attr: ' data-hist=""' }, { l: T("Average Daily Spending"), v: monthly ? pln(monthly / 30) : "–", icon: "cal", cls: "src", attr: ' data-hist=""' },
        { l: T("Largest Category"), v: sorted0[0] ? categoryLabel(sorted0[0].category) : "–", sub: sorted0[0] ? pln(sorted0[0].perMonth) : "", icon: "star", cls: "left", attr: sorted0[0] ? ` data-hist="${esc(sorted0[0].category)}"` : "" }, { l: T("Savings Opportunity"), v: pln(saveM) + "/" + T("month"), vcls: "good", icon: "pig", cls: "rate" }] });
    const bdAll = (cats.all || []).map((c, n) => ({ label: categoryLabel(c.category), value: c.perMonth, color: COLORS.cats[n % COLORS.cats.length], sh: ChartData.share(c.perMonth, cats.total) }));
    const breakCard = dcard("pie", "res", T("Spending Breakdown"), bdAll.length ? `<div class="sv-ar ei-br">${donut(bdAll, pln(cats.total), T("/month"), 150)}<ul class="sv-al">${bdAll.slice(0, 7).map(x => `<li data-cat="${esc(x.label)}"><i style="background:${x.color}"></i><span>${esc(x.label)}</span><b>${esc(String(x.sh).includes("%") ? x.sh : x.sh + "%")}</b></li>`).join("")}</ul></div>` : `<p class="hint">${esc(T("Add expenses to see where your money goes."))}</p>`, { klass: "ei-break", extra: PM("ex-more", T("Monthly average and transfers")) });
    const trendC = dcard("trend", "res", T("Monthly Spending Trend"), `<span class="sv-leg"><i style="background:#2EDC9A"></i>${esc(T("Current Month"))}<i style="background:#3B9BFF"></i>${esc(T("Previous Month"))}<i style="background:#F5A623"></i>${esc(T("3-Month Average"))}</span>` +
      lineChart(dayL, [{ vals: avg3, color: "#F5A623", dash: true }, { vals: prev, color: "#3B9BFF" }, { vals: cur, color: "#2EDC9A", dots: false }], { w: 560, h: 190 }), { klass: "ei-trend" });
    const fcLine = Array.from({ length: dim }, (_, i) => Math.round(proj * (i + 1) / dim));
    const fcC = dcard("bars", "res", T("Expense Forecast"), `<div class="ei-fh"><div><small>${esc(T("Projected Month-End Spending"))}</small><b>${esc(pln(proj))}</b></div><div class="ei-fl"><small>${esc(T("Budget Limit"))}</small><b class="good">${budgetLim ? esc(pln(budgetLim)) : "–"}</b></div></div>` +
      lineChart(Array(dim).fill(""), [{ vals: fcLine, color: "#2EDC9A", area: true }].concat(budgetLim ? [{ vals: Array(dim).fill(budgetLim), color: "#FFB020", dash: true }] : []), { w: 420, h: 150 }) + `<span class="sv-leg"><i style="background:#2EDC9A"></i>${esc(T("Trend Projection"))}</span>`, { klass: "ei-fc" });
    const lastM = monthSum(-1), prevM = monthSum(-2), downUp = lastM && prevM ? (lastM < prevM ? T("Spending is trending downward.") : T("Spending is trending upward.")) : null;
    const insights = [sorted0[0] ? T("Largest category remains stable.") : null, downUp, otherCount ? (otherCount === 1 ? T("1 transaction remains uncategorized.") : T("{0} transactions remain uncategorized.", otherCount)) : null, budgetLim ? T("Budget remains within acceptable range.") : null, saveM > 0 ? T("Monthly savings opportunity identified.") : null].filter(Boolean);
    const insC = dcard("sparkle", "res", T("AI Spending Insights"), `<ul class="nw-ul">${insights.map(x => `<li>${okE}<span>${esc(x)}</span></li>`).join("") || `<li class="hint">–</li>`}</ul>` + (otherCount >= 2 ? `<button class="ex-sortbtn" data-action="sort-other">🏷 ${esc(T("{0} outflows are in \"Other\" – sort them by shop in one go →", otherCount))}</button>` : ""), { klass: "ei-ins" });
    const chg = c => { const a = monthSum(-1, c), b2 = monthSum(-2, c); if (!(b2 > 0)) return `<span class="ei-ch">–</span>`; const v = Math.round((a - b2) / b2 * 100); return `<span class="ei-ch ${v > 0 ? "up" : v < 0 ? "dn" : ""}">${v > 0 ? "↑ +" : v < 0 ? "↓ " : "↔ "}${v}%</span>`; };
    const anaC = dcard("bars", "res", T("Category Analysis"), `<table class="sv-t ei-t"><thead><tr><th>${esc(T("Category"))}</th><th>${esc(T("Amount"))}</th><th>${esc(T("Change"))}</th></tr></thead><tbody>${sorted0.slice(0, 5).map(c => `<tr><td>${esc(categoryLabel(c.category))}</td><td><b>${esc(pln(c.perMonth))}</b></td><td>${chg(c.category)}</td></tr>`).join("") || `<tr><td colspan="3" class="hint">–</td></tr>`}</tbody></table>`, { klass: "ei-ana" });
    const reps0 = d.Expenses.filter(e => e.Repeat), seenR = new Set(), bills = reps0.filter(e => { const k = e.Description || e.Category; if (seenR.has(k)) return false; seenR.add(k); return true; }).map(e => ({ e, due: Calc.nextPayment({ Date: e.Date, Frequency: e.Repeat }, today()) || e.Date })).sort((x, y) => parseDate(x.due) - parseDate(y.due)).slice(0, 4);
    const billC = dcard("calx", "res", T("Upcoming Bills"), `<table class="sv-t ei-t"><thead><tr><th>${esc(T("Due Date"))}</th><th>${esc(T("Bill"))}</th><th>${esc(T("Amount"))}</th></tr></thead><tbody>${bills.map(x => `<tr><td>${esc(fmtDate(x.due))}</td><td>${esc(x.e.Description || T(x.e.Category))}</td><td><b>${esc(pln(x.e.Amount))}</b></td></tr>`).join("") || `<tr><td colspan="3" class="hint">${esc(T("Mark an expense with 🔁 to see it here."))}</td></tr>`}</tbody></table>`, { klass: "ei-bills" });
    const recent = [...d.Expenses].sort((x, y) => parseDate(y.Date) - parseDate(x.Date)).slice(0, 3);
    const recC = `<div class="nw-card dz ei-rec"><div class="nw-ch"><h3>${esc(T("Recent Expenses"))}</h3>${PM("ex-hist", T("Outflow history"))}</div>${recent.map(e => `<div class="ei-rr"><span>${esc(categoryIcon(e.Category) || "🧾")}</span><small>${esc(fmtDate(e.Date))}</small><b>${esc(e.Description || T(e.Category))}</b><em>${esc(T(e.Category))}</em><b>${esc(pln(e.Amount))}</b></div>`).join("") || `<p class="hint">–</p>`}</div>`;
    const topCats = sorted0.slice(0, 6);
    const quickC = `<div class="nw-card dz ei-quick"><div class="ei-qa"><h3>${esc(T("Quick Category Access"))}</h3><div class="ex-chips">${topCats.map(c => `<button class="ex-chip" data-quick="${esc(c.category)}">${esc(categoryLabel(c.category))}</button>`).join("") || `<p class="hint">–</p>`}</div></div>
      <div class="ei-ae"><h3>${esc(T("Add Expense"))}</h3><small>${esc(T("Date"))}</small>${dateInput("qdate", inputDate(today()))}<button class="sv-btn ei-add" data-action="ex-add">＋ ${esc(T("Add Expense"))}</button></div></div>`;
    const over = d.Budgets.some(b => Calc.spentThisMonth(b.Category) > (+b.MonthlyLimit || Infinity)), share = monthly > 0 ? nonEss / monthly : 0;
    const hs = Math.max(0, Math.min(100, Math.round(100 - share * 60 - Math.min(10, otherCount) - (over ? 10 : 0)))), unn = share < 0.25 ? T("Low") : share < 0.45 ? T("Medium") : T("High");
    const healthC = `<div class="nw-card dz ei-health"><div class="nw-ch"><h3>${esc(T("Expense Health Score"))}</h3></div><div class="ei-hb">${ring(hs, String(hs), "/ 100", 110, "#22E39A")}<div class="ei-hl"><p>${okE}<span><small>${esc(T("Unnecessary Spending"))}</small><b class="good">${esc(unn)}</b></span></p><p>${okE}<span><small>${esc(T("Budget Compliance"))}</small><b class="good">${esc(over ? T("Over limit") : T("Healthy"))}</b></span></p><p>${okE}<span><small>${esc(T("Potential Additional Savings"))}</small><b class="good">${esc(pln(saveM))}/${esc(T("month"))}</b></span></p></div></div></div>`;
    const msg = `<div class="nw-card ei-msg">${okE}<span>${esc(saveM > 0 ? T("Your spending remains under control and opportunities exist to improve monthly savings.") : T("Add your expenses to get personal savings opportunities."))}</span></div>`;
    el.innerHTML = `<div class="ei-page">` + expHead2 + optBand + `<div class="ei-r1">${breakCard}${trendC}${fcC}</div><div class="ei-r2">${insC}${anaC}${billC}</div><div class="ei-r3">${recC}${quickC}${healthC}</div>${msg}</div>`;
    lastEx = { hist: histCard + binCard(["expense"]), side: avgCard + movedCard(d) };
    const openAdd = (cat, date) => {
      const cat1 = findCategory(cat) || cat0;
      const pp = popup("", { width: 980, cls: "nw-win pm-win ee-win" });
      const sec = (n, t, sub, body) => `<section class="ee-s"><div class="ee-sh"><span class="ee-n">${n}</span><div><b>${esc(t)}</b><small>${esc(sub)}</small></div></div>${body}</section>`;
      const repOpts = REPEAT_OPTIONS();
      pp.el.innerHTML = `<div class="ee-hd"><span class="ee-hi">${si(IC.plus, 30)}</span><div><h2>${esc(T("Add Expense"))}</h2><p>${esc(T("Enter the details of a new expense and how important it is."))}</p></div><button class="pm-x" data-close aria-label="${esc(T("Close"))}">✕</button></div>
        <form id="expense-form" class="ee-form">
          ${sec(1, T("Transaction Information"), T("Basic details about this transaction."), `<div class="ee-r3">${field(T("Date"), dateInput("date", date || inputDate(today())))}${field(T("Amount (zł)"), numInput("amount", "", T("e.g. {0}", "120,50")))}<div class="cat-row">${field(T("Category"), select("category", [...categories().map(c => [c.Name, categoryLabel(c.Name)]), NEW_CAT()], cat1.Name))}${button(T("Edit categories…"), "categories", "second small")}</div></div>`)}
          ${sec(2, T("Classification"), T("Add a description and set the importance of this expense."), `<div class="ee-r2">${field(T("Description (optional)"), textInput("description", "", T("e.g. {0}", "Biedronka")))}<div class="ee-imp"><label>${esc(T("Expense importance"))}</label><div class="ee-chips" data-ee-imp>${IMPORTANCE.map(([v, l, c]) => `<button type="button" data-v="${v}" style="--c:${c}">${esc(T(l))}</button>`).join("")}</div><small data-ee-impnote></small></div></div><input type="hidden" name="importance" value="${cat1.Essential ? "essential" : "flexible"}"><label class="ee-hid">${check("essential", "", !!cat1.Essential)}</label>`)}
          ${sec(3, T("Recurrence"), T("How often does this expense occur? Repeating expenses appear automatically in the Calendar."), `<div class="ee-chips ee-rec" data-ee-rec>${repOpts.map(([v, l]) => `<button type="button" data-v="${esc(v)}">${esc(String(l).replace("🔁 ", ""))}</button>`).join("")}</div><div class="ee-hid">${select("repeat", repOpts, "")}</div>`)}
          ${sec(4, T("Financial Impact Preview"), T("See how this expense affects your financial plan."), `<div class="ee-prev" data-ee-prev></div>`)}
        </form>
        <div class="ee-foot"><button class="sv-btn ghost" data-close>${esc(T("Cancel"))}</button><button class="sv-btn" data-action="add-expense">＋ ${esc(T("Add expense"))}</button></div>`;
      const f = pp.el.querySelector("#expense-form"), root = pp.el, imp = f.importance, ess = f.essential, rep = f.repeat;
      const paint = () => {
        root.querySelectorAll("[data-ee-imp] button").forEach(b => b.classList.toggle("on", b.dataset.v === imp.value));
        root.querySelector("[data-ee-impnote]").textContent = { essential: T("Essential: a payment you must make even in a crisis."), important: T("Important: not vital, but you would rather not skip it."), flexible: T("Flexible: can be reduced when money is tight."), optional: T("Optional: nice to have, the first thing to cut.") }[imp.value];
        root.querySelectorAll("[data-ee-rec] button").forEach(b => b.classList.toggle("on", b.dataset.v === rep.value));
        const amt = num(f.amount.value) || 0, mon = rep.value ? Calc.monthlyPln({ Amount: amt, Currency: "PLN", Frequency: rep.value }, d.Settings) : 0;
        const cell = (ic2, l, v, sub) => `<div><span>${si(ic2, 26)}</span><span><small>${esc(l)}</small><b>${esc(v)}</b><em>${esc(sub)}</em></span></div>`;
        root.querySelector("[data-ee-prev]").innerHTML = cell(IC.house, T("Budget Category"), categoryLabel(f.category.value).replace(/^\S+\s/, "") || categoryLabel(f.category.value), ess.checked ? T("Part of your essential expenses") : T("Part of your not essential expenses")) +
          cell(IC.bars, T("Monthly Impact"), rep.value ? pln(mon) : T("One-time"), rep.value ? T("On your monthly budget") : pln(amt)) +
          cell(IC.calx, T("Annual Impact"), rep.value ? pln(mon * 12) : pln(amt), rep.value ? T("Total per year") : T("This year only")) +
          cell(IC.trend, T("Forecast Classification"), ess.checked ? (rep.value ? T("Essential Recurring Expense") : T("Essential Expense")) : T("Flexible Expense"), ess.checked ? T("Included in Emergency Fund calculations") : T("Not part of the Emergency Fund"));
      };
      root.querySelectorAll("[data-ee-imp] button").forEach(b => b.onclick = () => { imp.value = b.dataset.v; ess.checked = imp.value === "essential"; paint(); });
      root.querySelectorAll("[data-ee-rec] button").forEach(b => b.onclick = () => { rep.value = b.dataset.v; paint(); });
      f.addEventListener("input", paint); f.addEventListener("change", paint);
      f.category.addEventListener("change", () => { ess.checked = !!findCategory(f.category.value)?.Essential; imp.value = ess.checked ? "essential" : "flexible"; paint(); });
      paint();
      pp.el.querySelector('[data-action="categories"]').onclick = () => { pp.close(); manageCategories(); };
      pp.el.querySelector('[data-action="add-expense"]').onclick = () => {
        const v = values(f), amt = num(v.amount);
        if (!(amt > 0)) { toast(T("Please enter an amount bigger than 0."), "bad"); return; }
        d.Expenses.push({ Id: uuid(), Date: isoDate(v.date ? parseDate(v.date) : today()), Description: v.description.trim(), Category: v.category, Amount: amt, Essential: v.essential, Importance: v.importance, Repeat: v.repeat || "" });
        save(); toast(T("Added: {0}, {1}.", T(v.category), pln(amt))); pp.close(); App.refresh();
      };
      setTimeout(() => f.amount.focus(), 80);
    };
    el.querySelector('[data-action="ex-add"]').onclick = () => openAdd(null, el.querySelector('[name="qdate"]')?.value);
    el.querySelectorAll("[data-hist]").forEach(b => b.onclick = () => { flt.cat = b.dataset.hist; App.refresh(); openWin(T("Outflow history"), "table", "hist", 1000, () => { flt.cat = ""; App.refresh(); }); });
    el.querySelectorAll("[data-quick]").forEach(b => b.onclick = () => { flt.cat = b.dataset.quick; App.refresh(); openWin(T("Outflow history"), "table", "hist", 1000, () => { flt.cat = ""; App.refresh(); }); });
    el.querySelectorAll('[data-action="ex-optimize"]').forEach(b => b.addEventListener("click", () => App.openOptimize()));
    el.querySelector('[data-action="sort-other"]')?.addEventListener("click", () => sortOther(() => App.refresh()));
    const bindHist = root => {
    const olderBtn = root.querySelector('[data-action="older"]');
    if (olderBtn) olderBtn.onclick = () => { showAllMonths = true; App.refresh(); };
    // Filter: re-draw the list, and keep typing in the search box
    const ft = root.querySelector('[name="f-text"]');
    if (ft) {
      let timer;
      ft.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { flt.text = ft.value; App.refresh();
        // the cards are laid out again just after drawing, so put the cursor back a moment later
        setTimeout(() => { const n = document.querySelector('[name="f-text"]'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 30); }, 350); };
      root.querySelector('[name="f-cat"]').onchange = e => { flt.cat = e.target.value; App.refresh(); };
      root.querySelector('[name="f-ess"]').onchange = e => { flt.ess = e.target.value; App.refresh(); };
      root.querySelector('[name="f-rep"]').onchange = e => { flt.rep = e.target.checked; App.refresh(); };
      root.querySelector('[name="f-days"]').onchange = e => { flt.days = e.target.value; App.refresh(); };
      ["min", "max"].forEach(k => { root.querySelector(`[name="f-${k}"]`).onchange = e => { flt[k] = e.target.value.trim(); App.refresh(); }; });
      const clr = root.querySelector('[data-action="f-clear"]'); if (clr) clr.onclick = () => { Object.assign(flt, { cat: "", text: "", ess: "", rep: false, min: "", max: "", days: "" }); App.refresh(); };
    }
    };
    const openWin = (title, icon, key, wide, onClose) => {
      const pp = popup("", { width: wide, cls: "nw-win sc-win" }), orig = App.refresh;
      const EMO = { hist: "🧾", side: "📊" };
      const draw = () => { pp.el.innerHTML = `<div class="nw-hd"><span class="nw-hi">${EMO[key] || "🧾"}</span><div><h2>${esc(title)}</h2></div><button class="nw-x" data-close aria-label="${esc(T("Close"))}">✕</button></div><div class="sc-body ex2-body"><div class="grid bp-flat ex-pop">${lastEx[key]}</div></div><div class="nw-ft"><button class="btn second" data-close>${esc(T("Close"))}</button></div>`;
        pp.el.querySelectorAll(".ex-pop .nw-ch h3, .ex-pop .oc-head h3").forEach(h => { if (h.textContent.trim() === title) { const hd = h.parentElement; if (hd.children.length === 1) hd.remove(); else h.remove(); } });
        bindHist(pp.el); bindExpenseRows(pp.el); bindBin(pp.el); };
      App.refresh = (...a) => { orig(...a); if (!pp.closed) draw(); };
      const close = pp.close; pp.close = (...a) => { App.refresh = orig; close(...a); onClose?.(); };
      draw();
    };
    el.querySelector('[data-action="ex-hist"]')?.addEventListener("click", () => openWin(T("Outflow history"), "table", "hist", 1000));
    el.querySelector('[data-action="ex-more"]')?.addEventListener("click", () => openWin(T("Monthly average and transfers"), "calx", "side", 860));
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
const IMPORTANCE = [["essential", "Essential", "#2EDC9A"], ["important", "Important", "#FFC928"], ["flexible", "Flexible", "#3B9BFF"], ["optional", "Optional", "#9AA7B2"]];
/** Importance level of an expense: the chosen one, or essential / flexible from the old yes-no switch. */
const impOf = e => (e.Importance && (e.Importance === "essential") === !!e.Essential) ? e.Importance : (e.Essential ? "essential" : "flexible");
const impLabel = e => { const k = impOf(e); return (e.Importance && (e.Importance === "essential") === !!e.Essential) ? T(IMPORTANCE.find(x => x[0] === k)[1]) : (e.Essential ? T("Essential") : T("Not essential")); };
const REPEAT_OPTIONS = (cur = "") => [["", T("Does not repeat")], ...FREQUENCIES.filter(f => f[0] !== ONE_TIME).map(f => [f[0], "🔁 " + T(f[0])]),
  ...(parseCustom(cur) ? [[cur, "🔁 " + freqLabel(cur)]] : [])];
function expenseRow(e) {
  const icon = categoryIcon(e.Category), rep = repeatOn(e), k = impOf(e), col = IMPORTANCE.find(x => x[0] === k)[2];
  return `<div class="item expense hx" data-id="${e.Id}">
    <span class="hx-ic">${icon || "💳"}</span>
    <div class="toggle" data-toggle="${e.Id}" title="${esc(T("Click to switch between essential and not essential"))}"><b>${esc(e.Description || T(e.Category))}</b>
      <span class="hx-m"><span class="hx-d">${fmtDate(e.Date)}</span><span class="hx-c">${esc(T(e.Category))}</span><span class="hx-i" style="--c:${col}">${esc(impLabel(e))}</span><button class="rep-tag${rep ? " on" : ""}" data-repeat="${e.Id}" title="${esc(T("How often does it repeat?"))}">🔁 ${esc(rep ? freqLabel(rep) : T("Does not repeat"))}</button></span></div>
    <b class="hx-a">${pln(e.Amount)}</b>${infoBtn("expense", e)}
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
    const e = d.Expenses.find(y => y.Id === x.dataset.toggle); e.Essential = !e.Essential; e.Importance = e.Essential ? "essential" : "flexible"; save(); after();
  });
  root.querySelectorAll("[data-edit]").forEach(x => x.onclick = () => editExpense(d.Expenses.find(y => y.Id === x.dataset.edit), after));
  root.querySelectorAll("[data-del]").forEach(x => x.onclick = async () => {
    const e = d.Expenses.find(y => y.Id === x.dataset.del);
    if (await confirmBox(T("Delete?"), `${e.Description || T(e.Category)} · ${pln(e.Amount)}`, T("Delete"), T("Cancel"), true)) {
      toBin("expense", e); d.Expenses = d.Expenses.filter(y => y !== e); save(); toast(T("Deleted: {0}.", e.Description || T(e.Category))); after();
    }
  });
}
function editExpense(e, after) {
  const sec = (n, t, sub, body) => `<section class="ee-s"><div class="ee-sh"><span class="ee-n">${n}</span><div><b>${esc(t)}</b><small>${esc(sub)}</small></div></div>${body}</section>`;
  const rep0 = repeatOn(e), repOpts = REPEAT_OPTIONS(rep0);
  const p = popup(`<div class="ee-hd"><span class="ee-hi">${si(IC.docs, 30)}</span><div><h2>${esc(T("Edit Expense"))}</h2><p>${esc(T("Update transaction details and budget classification."))}</p></div><button class="pm-x" data-close aria-label="${esc(T("Close"))}">✕</button></div>
    <form class="ee-form">
      ${sec(1, T("Transaction Information"), T("Basic details about this transaction."), `<div class="ee-r3">${field(T("Date"), dateInput("date", inputDate(parseDate(e.Date))))}${field(T("Amount (zł)"), numInput("amount", plain(e.Amount)))}${field(T("Category"), select("category", [...categories().map(c => [c.Name, categoryLabel(c.Name)]), NEW_CAT()], e.Category))}</div>`)}
      ${sec(2, T("Classification"), T("Add a description and set the importance of this expense."), `<div class="ee-r2">${field(T("Description"), textInput("description", e.Description))}<div class="ee-imp"><label>${esc(T("Expense importance"))}</label><div class="ee-chips" data-ee-imp>${IMPORTANCE.map(([v, l, c]) => `<button type="button" data-v="${v}" style="--c:${c}">${esc(T(l))}</button>`).join("")}</div><small data-ee-impnote></small></div></div><input type="hidden" name="importance" value="${impOf(e)}"><label class="ee-hid">${check("essential", "", e.Essential)}</label>`)}
      ${sec(3, T("Recurrence"), T("How often does this expense occur?"), `<div class="ee-chips ee-rec" data-ee-rec>${repOpts.map(([v, l]) => `<button type="button" data-v="${esc(v)}">${esc(String(l).replace("🔁 ", ""))}</button>`).join("")}</div><div class="ee-hid">${select("repeat", repOpts, rep0)}</div>`)}
      ${sec(4, T("Financial Impact Preview"), T("See how this expense affects your financial plan."), `<div class="ee-prev" data-ee-prev></div>`)}
    </form>
    <div class="ee-foot"><button class="sv-btn ghost" data-close>${esc(T("Cancel"))}</button><button class="sv-btn ee-del" data-del-exp>🗑 ${esc(T("Delete Expense"))}</button><button class="sv-btn" data-save>✓ ${esc(T("Save Changes"))}</button></div>`, { width: 980, cls: "nw-win pm-win ee-win" });
  {
    const root = p.el, imp = root.querySelector('[name="importance"]'), ess = root.querySelector('[name="essential"]'), rep = root.querySelector('[name="repeat"]');
    const paint = () => {
      root.querySelectorAll("[data-ee-imp] button").forEach(b => b.classList.toggle("on", b.dataset.v === imp.value));
      root.querySelector("[data-ee-impnote]").textContent = { essential: T("Essential: a payment you must make even in a crisis."), important: T("Important: not vital, but you would rather not skip it."), flexible: T("Flexible: can be reduced when money is tight."), optional: T("Optional: nice to have, the first thing to cut.") }[imp.value];
      root.querySelectorAll("[data-ee-rec] button").forEach(b => b.classList.toggle("on", b.dataset.v === rep.value));
      const amt = num(root.querySelector('[name="amount"]').value) || 0, cat = root.querySelector('[name="category"]').value;
      const mon = rep.value ? Calc.monthlyPln({ Amount: amt, Currency: "PLN", Frequency: rep.value }, D().Settings) : 0;
      const cell = (ic, l, v, sub) => `<div><span>${si(ic, 26)}</span><span><small>${esc(l)}</small><b>${esc(v)}</b><em>${esc(sub)}</em></span></div>`;
      root.querySelector("[data-ee-prev]").innerHTML = cell(IC.house, T("Budget Category"), categoryLabel(cat).replace(/^\S+\s/, "") || categoryLabel(cat), ess.checked ? T("Part of your essential expenses") : T("Part of your not essential expenses")) +
        cell(IC.bars, T("Monthly Impact"), rep.value ? pln(mon) : T("One-time"), rep.value ? T("On your monthly budget") : pln(amt)) +
        cell(IC.calx, T("Annual Impact"), rep.value ? pln(mon * 12) : pln(amt), rep.value ? T("Total per year") : T("This year only")) +
        cell(IC.trend, T("Forecast Classification"), ess.checked ? (rep.value ? T("Essential Recurring Expense") : T("Essential Expense")) : T("Flexible Expense"), ess.checked ? T("Included in Emergency Fund calculations") : T("Not part of the Emergency Fund"));
    };
    root.querySelectorAll("[data-ee-imp] button").forEach(b => b.onclick = () => { imp.value = b.dataset.v; ess.checked = imp.value === "essential"; paint(); });
    root.querySelectorAll("[data-ee-rec] button").forEach(b => b.onclick = () => { rep.value = b.dataset.v; paint(); });
    root.querySelectorAll("input,select").forEach(x => x.addEventListener("input", paint)); root.querySelectorAll("select").forEach(x => x.addEventListener("change", paint));
    root.querySelector("[data-del-exp]").onclick = async () => {
      const d = D();
      if (await confirmBox(T("Delete?"), `${e.Description || T(e.Category)} · ${pln(e.Amount)}`, T("Delete"), T("Cancel"), true)) { toBin("expense", e); d.Expenses = d.Expenses.filter(y => y !== e); save(); toast(T("Deleted: {0}.", e.Description || T(e.Category))); p.close(); after(); }
    };
    paint();
  }
  p.el.querySelector("[data-save]").onclick = () => {
    const v = values(p.el), amt = num(v.amount);
    if (!(amt > 0)) { toast(T("Please enter an amount bigger than 0."), "bad"); return; }
    const before = repeatOn(e);
    const changed = isoDate(parseDate(v.date)) !== e.Date || amt !== e.Amount || v.category !== e.Category || v.description.trim() !== e.Description;
    Object.assign(e, { Date: isoDate(parseDate(v.date)), Amount: amt, Category: v.category, Description: v.description.trim(), Essential: v.essential, Importance: v.importance });
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
/** The loans behind the "Loan payments" category: each with its monthly payment (click → Loans & debts tab). */
function loanLines(d) {
  const start = monthStart(today()), loans = d.Loans.filter(l => l.MonthlyPayment > 0 && l.Remaining > 0 && parseDate(l.EndDate) >= start);
  if (!loans.length) return hint(T("Monthly payments from the Loans & debts tab."));
  return `<h3 class="sub-h">${esc(T("From the Loans & debts tab"))}</h3><div class="list">${loans.map(l => `<div class="item link" data-to-loans><div><b>${esc(l.Name)}</b>
    <span class="hint">${esc(l.EndDate ? T("until {0}", monthName(parseDate(l.EndDate))) : "")}</span></div><b>${pln(l.MonthlyPayment)} ${esc(T("per month"))}</b></div>`).join("")}</div>`;
}
function showCategory(name) {
  const d = D();
  const draw = () => {
    const list = d.Expenses.filter(e => e.Category === name).sort((a, b) => parseDate(b.Date) - parseDate(a.Date));
    const per = Advisor.spendingByCategory(d).find(c => c.category === name);
    return `<h2 class="popup-title">${esc(categoryLabel(name))}</h2>` +
      (name === LOAN_CATEGORY && Calc.loansCounted(d) ? loanLines(d) : "") +
      (per ? hint(T("Average per month: {0}", pln(per.perMonth))) : "") +
      (name === LOAN_CATEGORY && Calc.loansCounted(d) && !list.length ? "" : hint(T("{0} expenses, together {1}.", list.length, pln(list.reduce((s, e) => s + e.Amount, 0))))) +
      `<div class="list scroll">${list.map(expenseRow).join("")}</div><div class="popup-buttons"><button class="btn second" data-close>${esc(T("Close"))}</button></div>`;
  };
  const p = popup(draw(), { width: 640, onClose: () => App.refresh() });
  const toLoans = () => p.el.querySelectorAll("[data-to-loans]").forEach(x => x.onclick = () => { p.close(); App.go("loans"); });
  const redraw = () => { p.el.innerHTML = draw(); bindExpenseRows(p.el, redraw); toLoans(); };
  bindExpenseRows(p.el, redraw); toLoans();
}
export async function manageCategories() {
  if (!(await requirePro(T("Own categories")))) return;
  const d = D();
  const EXAMPLES = [["🌴", "Vacation Fund"], ["🎓", "School Expenses"], ["🐾", "Pets"], ["🏡", "Home Renovation"]];
  const draw = () => {
    const sys = categories().filter(c => !c.Custom && c.Name !== OTHER).length, ess = d.Categories.filter(c => c.Essential).length;
    const tile = (ic, l, v) => `<div class="kpi static"><span class="kpi-ic in">${si(IC[ic], 30)}</span><span class="kpi-t"><span class="kpi-l">${esc(l)}</span><b>${v}</b></span></div>`;
    const body = d.Categories.length ? `<div class="cm-list">${d.Categories.map(c => `<div class="cm-item"><span class="cm-ic">${esc(c.Icon || "📦")}</span><div><b>${esc(c.Name)}</b>
        <small>${esc(c.Essential ? T("Essential") : T("Not essential"))} · ${esc((n => n === 1 ? T("1 expense") : T("{0} expenses", n))(d.Expenses.filter(e => e.Category === c.Name).length))}</small></div>
        <div class="row-actions"><button class="icon-btn" data-edit-cat="${esc(c.Name)}" title="${esc(T("Edit"))}">✎</button><button class="icon-btn danger" data-del-cat="${esc(c.Name)}" title="${esc(T("Delete"))}">🗑</button></div></div>`).join("")}</div>` :
      `<div class="cm-empty"><span class="cm-art">${si(IC.tag, 54)}</span><h3>${esc(T("No custom categories yet"))}</h3><p>${esc(T("Create your first category to better organize transactions and reports."))}</p></div>`;
    return `<button class="pm-x pm-x-abs" data-close aria-label="${esc(T("Close"))}">✕</button>
    <div class="pg-title cm-head"><span class="pg-ic">${si(IC.tag, 40)}</span><div><h2>${esc(T("Category Management"))}</h2><p>${esc(T("Create and manage your own categories."))}</p>
      <small>${esc(T("Custom categories can be renamed, marked as essential, assigned an icon or removed at any time."))}<br>${esc(T("Standard system categories are protected and cannot be edited."))}</small></div></div>
    <div class="cm-kpis">${tile("palette", T("Custom Categories"), d.Categories.length)}${tile("star", T("Essential Categories"), ess)}${tile("shield", T("System Categories"), sys)}</div>
    <div class="nw-card cm-box">${body}<div class="cm-ex"><span>${esc(T("Popular examples:"))}</span>${EXAMPLES.map(x => `<button type="button" class="cm-chip" data-ex="${esc(x[1])}" data-exi="${x[0]}"><span>${x[0]}</span>${esc(T(x[1]))}</button>`).join("")}</div></div>
    <div class="cm-foot"><button class="sv-btn cm-new" data-add>＋ ${esc(T("New Category"))}</button><button class="sv-btn ghost cm-close" data-close>${esc(T("Close"))}</button></div>`;
  };
  const p = popup(draw(), { width: 820, cls: "nw-win pm-win cm-win", onClose: () => App.refresh() });
  const bind = () => {
    p.el.querySelectorAll("[data-ex]").forEach(b => b.onclick = async () => {
      const got = await categoryBox(ICON_CHOICES, { isNew: true, name: T(b.dataset.ex), icon: b.dataset.exi }); if (!got) return;
      const err = addCategory(got.name, got.essential, got.icon);
      if (err) { toast(err, "bad"); return; }
      toast(T("New category: {0}", got.name.trim())); p.el.innerHTML = draw(); bind();
    });
    p.el.querySelector("[data-add]").onclick = async () => {
      const got = await categoryBox(ICON_CHOICES); if (!got) return;
      const err = addCategory(got.name, got.essential, got.icon);
      if (err) { toast(err, "bad"); return; }
      toast(T("New category: {0}", got.name.trim())); p.el.innerHTML = draw(); bind();
    };
    p.el.querySelectorAll("[data-edit-cat]").forEach(b => b.onclick = async () => {
      const c = d.Categories.find(x => x.Name === b.dataset.editCat); if (!c) return;
      const got = await categoryBox(ICON_CHOICES, { name: c.Name, icon: c.Icon, essential: c.Essential }); if (!got) return;
      const err = updateCategory(c.Name, got.name, got.essential, got.icon);
      if (err) { toast(err, "bad"); return; }
      toast(T("Saved."), "good"); p.el.innerHTML = draw(); bind();
    });
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
    const ed = emergencyDash(d);
    const eHead = pageHead({ icon: "shield", title: T("Emergency Fund"), sub: T("Build financial security and protect yourself against unexpected events."),
      kpis: [{ l: T("Emergency Fund Balance"), v: pln(safe), icon: "coins", cls: "in" }, { l: T("Fund Completion"), v: ed.kpis.pct + "%", icon: "check", cls: "in" }, { l: T("Months Covered"), v: ed.kpis.covered.toFixed(1), icon: "calx", cls: "next" }, { l: T("Target Date"), v: ed.kpis.est ? ed.kpis.est.toLocaleDateString(undefined, { month: "long", year: "numeric" }) : ed.kpis.done ? T("Reached") : "–", icon: "flag", cls: "in" }],
      btn: `<button class="btn main rp-gen" data-go="portfolio">＋ ${esc(T("Add Contribution"))}</button>` });
    el.innerHTML = eHead + ed.html;
    const manageHtml = () => {
      const tgt = r.target, covered = tgt > 0 && safe >= tgt, pc = tgt > 0 ? Math.min(100, Math.round(safe / tgt * 100)) : 0;
      const okI = `<span class="nw-ok">✓</span>`, rowI = (ic, l, v) => `<div class="em-rr"><span class="rp-si i-res">${si(IC[ic], 22)}</span><span>${esc(l)}</span><b>${esc(v)}</b></div>`;
      const safeH = d.Holdings.filter(h => h.Safe).map(h => ({ n: h.Name, v: Calc.toPln(h.Amount, h.Currency, s) })).filter(x => x.v > 0), sTot = safeH.reduce((a, x) => a + x.v, 0);
      const pal = ["#3B9BFF", "#F5A623", "#8B5CF6", "#2EDC9A", "#C98FA0"];
      const ins = [covered ? T("Emergency fund target fully covered") : T("Your safe money covers {0}% of the target", pc), covered ? T("Safe savings exceed required reserve") : T("Still missing: {0}", pln(Math.max(0, tgt - safe))), covered ? T("No additional contributions required") : T("Keep contributing every month"), T("Liquidity remains excellent")];
      const kp = [["calx", T("Monthly Essential Costs"), pln(r.monthly)], ["flag", T("Recommended Target"), pln(tgt)], ["shield", T("Protected Months"), String(s.EmergencyMonths)], ["percent", T("Safety Buffer"), (s.BufferPercent || 0) + "%"]];
      return `<button class="pm-x pm-x-abs" data-close aria-label="${esc(T("Close"))}">✕</button>
      <div class="pg-title"><span class="pg-ic">${si(IC.shield, 38)}</span><div><h2>${esc(T("Emergency Fund Target"))}</h2><p>${esc(T("Calculate how much financial protection you need and track your readiness."))}</p></div></div>
      <div class="ov-kpis">${kp.map(k => `<div class="kpi static"><span class="kpi-ic in">${si(IC[k[0]])}</span><span class="kpi-t"><span class="kpi-l">${esc(k[1])}</span><b>${esc(k[2])}</b></span></div>`).join("")}</div>
      <div class="em-g1"><div class="nw-card dz em-ready"><div class="nw-ch"><span class="rp-si i-res">${si(IC.check, 24)}</span><h3>${esc(T("Emergency Fund Readiness"))}</h3></div>
          <div class="em-rb"><div class="em-ringc">${ring(pc, pc + " / 100", T("Readiness Score"), 150, "#22E39A")}<span class="em-pill">${okI} ${esc(covered ? T("Fully Protected") : T("Building"))}</span></div>
          <div class="em-cur"><small>${esc(T("Current Safe Savings"))}</small><b>${esc(pln(safe))}</b><small>${esc(T("Target"))}</small><b>${esc(pln(tgt))}</b></div></div>
          <div class="em-msg">${okI}<span>${esc(covered ? T("Your available safe savings already cover your recommended emergency fund target.") : T("Your safe savings do not cover the target yet."))}</span></div></div>
        <div class="em-col"><div class="nw-card dz em-rec"><div class="nw-ch"><span class="rp-si i-save">${si(IC.star, 24)}</span><h3>${esc(T("Recommended Emergency Fund"))}</h3></div>
          ${rowI("calx", T("Monthly Need"), pln(r.monthly))}${rowI("coins", T("3 Months Coverage"), pln(r.three))}${rowI("coins", T("6 Months Coverage"), pln(r.six))}
          <div class="em-tg"><span class="rp-si i-res">${si(IC.flag, 26)}</span><div><small>${esc(T("Recommended Target"))}</small><b>${esc(pln(tgt))}</b></div><span class="em-pill">${okI} ${esc(covered ? T("Fully Funded") : T("In progress"))}</span></div></div>
        <div class="nw-card dz em-keep"><div class="nw-ch"><span class="rp-si i-bulb">${si(IC.bulb, 24)}</span><h3>${esc(T("Where To Keep Emergency Funds"))}</h3></div>
          <div class="em-kb"><div><p>${esc(T("Recommended Location:"))} <b class="good">${esc(T("Polish Savings Account"))}</b></p><p>${okI} <span class="good">${esc(T("Protection:"))}</span> ${esc(T("BFG Coverage up to €100 000"))}</p><p>${okI} <span class="good">${esc(T("Liquidity:"))}</span> ${esc(T("Same-Day Access"))}</p><p><span class="em-w">▲</span> ${esc(T("Risk Level: Very Low"))}</p></div>
          <div class="em-av"><b>${esc(T("Avoid:"))}</b><p>✕ ${esc(T("Crypto Assets"))}</p><p>✕ ${esc(T("Long-Term Fixed Deposits"))}</p><p>✕ ${esc(T("Illiquid Investments"))}</p></div></div></div></div></div>
      <div class="em-g2"><div class="nw-card dz em-set"><form id="em"><div class="nw-ch"><span class="rp-si i-res">${si(IC.calc, 24)}</span><h3>${esc(T("Emergency Fund Settings"))}</h3></div>
          <div class="em-sg"><div>${field(T("Essential Monthly Costs"), numInput("monthly", plain(s.MonthlyEssentials), "4500"))}${field(T("Annual Costs"), numInput("yearly", plain(s.YearlyCosts), "3000"))}</div>
          <div>${field(T("Coverage Goal"), select("months", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => [n, n + " " + T(n === 1 ? "Month" : "Months")]), s.EmergencyMonths))}${field(T("Safety Buffer (%)"), numInput("buffer", plain(s.BufferPercent)))}</div></div>
          <button type="button" class="btn second em-avg" data-action="use-avg">${si(IC.calc, 16)} ${esc(T("Use my average from the Outflows tab"))}</button><p class="hint" id="avg-note"></p></form></div>
        <div class="nw-card dz em-alloc"><div class="nw-ch"><span class="rp-si i-save">${si(IC.trophy, 24)}</span><h3>${esc(T("Emergency Fund Allocation"))}</h3></div><div class="sv-ar">${donut(safeH.map((x, i) => ({ label: x.n, value: x.v, color: pal[i % pal.length] })), pln(tgt), T("Target"), 130)}
          <ul class="sv-al">${safeH.map((x, i) => `<li><i style="background:${pal[i % pal.length]}"></i><span>${esc(x.n)}</span><b>${sTot > 0 ? Math.round(x.v / sTot * 100) : 0}%</b></li>`).join("") || `<li class="hint">–</li>`}</ul></div></div>
        <div class="nw-card dz em-ins"><div class="nw-ch"><span class="rp-si i-res">${si(IC.sparkle, 24)}</span><h3>${esc(T("AI Emergency Fund Insights"))}</h3></div><ul class="nw-ul">${ins.map(x => `<li>${okI}<span>${esc(x)}</span></li>`).join("")}</ul></div></div>
      <div class="nw-card rp-sum em-bot"><div class="sv-b1"><span class="rp-si i-res">${si(IC.heart, 34)}</span><div><small>${esc(T("Emergency Fund Health"))}</small><b>${pc} / 100</b></div></div>
        <div class="sv-b1 dv"><span class="rp-si i-res">${si(IC.calx, 30)}</span><div><small>${esc(T("Coverage"))}</small><b class="good">${esc(s.EmergencyMonths + " " + T("Months"))}</b></div></div>
        <div class="sv-b1 dv"><span class="rp-si i-res">${si(IC.trophy, 30)}</span><div><small>${esc(T("Target"))}</small><b class="good">${esc(covered ? T("Achieved") : T("In progress"))}</b></div></div>
        <div class="sv-b1 dv"><span class="rp-si i-res">${si(IC.bolt, 30)}</span><div><small>${esc(T("Liquidity"))}</small><b class="good">${esc(T("Excellent"))}</b></div></div>
        <div class="sv-msg"><span class="rp-si i-res">${si(IC.check, 30)}</span><span>${esc(covered ? T("You have sufficient emergency savings and are financially prepared for unexpected expenses.") : T("Keep building your emergency savings."))}</span></div>
        <div class="em-btns"><button type="button" class="sv-btn" data-close>${esc(T("Save Emergency Fund Plan"))}</button><button type="button" class="sv-btn ghost" data-close>${esc(T("Close"))}</button></div></div>`;
    };
    const bindManage = root => {
      const form = root.querySelector("#em");
      const apply = () => {
        const v = values(form);
        s.MonthlyEssentials = num(v.monthly) || 0; s.YearlyCosts = num(v.yearly) || 0;
        s.EmergencyMonths = +v.months; s.BufferPercent = num(v.buffer) ?? 0;
        save(); App.refresh();
      };
      form.querySelectorAll("input,select").forEach(i => i.addEventListener("change", apply));
      root.querySelector('[data-action="use-avg"]').onclick = () => {
        const a = Calc.spending(d);
        if (!a.monthsUsed) { root.querySelector("#avg-note").textContent = T("No expenses yet. Add them in the Outflows tab first."); return; }
        s.MonthlyEssentials = Math.round(a.essential * 100) / 100; save(); App.refresh();
        toast(T("Average of your essential costs in {0}.", a.label));
      };
    };
    el.querySelectorAll('[data-action="em-manage"]').forEach(b => b.onclick = () => {
      const pp = popup("", { width: 1250, cls: "wide-popup nw-win pm-win" }), orig = App.refresh;
      const draw = () => {
        pp.el.innerHTML = `<div class="em-pop">${manageHtml()}</div>`; bindManage(pp.el);
        const host = pp.el.querySelector(".em-pop"), avail = window.innerHeight * 0.94 - 30; let z = 1; host.style.zoom = 1;
        for (let i = 0; i < 4 && z > 0.4; i++) { const hh = host.getBoundingClientRect().height; if (hh <= avail) break; z = Math.max(0.4, z * avail / hh * 0.99); host.style.zoom = z; }
        pp.el.style.maxHeight = "none"; pp.el.style.overflow = "hidden";
      };
      App.refresh = (...a) => { orig(...a); if (!pp.closed) draw(); };
      const close = pp.close; pp.close = (...a) => { App.refresh = orig; close(...a); };
      draw();
    });
    el.querySelector('[data-action="em-opt"]')?.addEventListener("click", () => App.openOptimize());
  },
};

// ================================================================= My savings

const PLACES = ["Bank", "Crypto platform", "Broker", "Cash", "Other"];
let editHolding = null, svRange = 3;
export const Portfolio = {
  route: "portfolio", title: "Savings",
  render(el) {
    const d = D(), s = d.Settings, p = Calc.portfolio(d), r = Calc.emergency(s);
    const h = editHolding ? d.Holdings.find(x => x.Id === editHolding) : null;
    const f = h || { Name: "", Place: "Bank", Amount: "", Currency: mainCur(), RatePercent: "", Safe: true };
    let em;
    if (r.target <= 0) em = T("Set up your emergency fund target in the Emergency fund tab.");
    else if (p.safe >= r.target) em = T("Emergency fund target ({0}) is fully covered by safe money.", pln(r.target));
    else em = T("Emergency fund: {0} of {1} in safe money. Missing {2}.", pln(p.safe), pln(r.target), pln(r.target - p.safe));
    const rateInfo = s.AutoExchangeRates ? (Rates.data.Usd > 0 ? T("Official NBP average rates from {0}.", fmtDate(Rates.data.ExchangeDate)) : T("The NBP rates will be filled in as soon as there is an internet connection.")) : T("You enter the rates yourself.");
    // ---------- numbers for the new dashboard ----------
    const sd = savingsData(d, 0), first = sd && sd.total.length > 1 ? sd.total.find(v => v != null) : null;
    const growth = first != null ? p.total - first : 0;
    const hv = d.Holdings.map(x => ({ x, pl: Calc.toPln(x.Amount, x.Currency, s), r: currentRate(x) || 0 }));
    const avgR = p.total > 0 ? hv.reduce((a, y) => a + y.pl * y.r, 0) / p.total : 0;
    const covered = r.target > 0 ? Math.min(1, p.safe / r.target) : 1;
    const divers = Math.min(1, d.Holdings.length / 3);
    const score = d.Holdings.length ? Math.round(40 * covered + 30 * divers + 30 * Math.min(1, avgR / 4)) : 0;
    const mv = moves(d), mvShown = license.isPro ? mv : mv.slice(0, 1), potential = mv.reduce((a, m) => a + m.gain, 0);
    const offerNm = o => `${o.Bank}${o.Name ? " – " + o.Name : ""}`;
    const dot = n => `<span class="ct-dot">${esc((n || "?").trim().charAt(0).toUpperCase())}</span>`;
    const head = pageHead({ icon: "pig", title: T("My Savings"), sub: T("Track, grow and optimize your savings portfolio."),
      kpis: [{ l: T("Total Savings"), v: pln(p.total), icon: "pig" }, { l: T("Net Growth"), v: (growth >= 0 ? "+" : "−") + pln(Math.abs(growth)), icon: "bars", cls: "in" },
        { l: T("Annual Interest Projection"), v: pln(p.yearly), icon: "percent", cls: "rate" }, { l: T("Savings Health Score"), v: score + " / 100", icon: "star", cls: "left" }] });
    const dueTxt = duePromos(d).map(({ h, p: q }) => `<p class="${q.ended ? "bad" : "warn"} promo-alert"><b>⏰ ${esc(q.ended ? T("The promotion at {0} ended on {1}.", h.Name, fmtDate(q.end)) : T("The promotion at {0} ends on {1} – in {2} days.", h.Name, fmtDate(q.end), q.daysLeft))}</b></p>`).join("");
    const opp = mvShown.length ? mvShown.slice(0, 2).map((m, i) => `<div class="sv-op"><span class="sv-opi">${si(IC.repeat, 34)}</span>
        <div class="sv-opt"><em class="sv-tag${i ? " rec" : ""}">${esc(i ? T("Recommended") : T("High Opportunity"))}</em><b>${esc(T("Move {0}", pln(m.moved)))}</b>
          <small>${esc(T("From: {0}", m.h.Name))} → ${esc(T("To: {0}", offerNm(m.o)))}</small></div>
        <div class="sv-opg"><small>${esc(T("Additional Annual Profit"))}</small><b>+${esc(pln(m.gain))}</b></div>
        <div class="sv-opb"><button class="sv-btn" data-offer-info="${i}">${si(IC.eye, 16)} ${esc(T("View Offer"))}</button>
          <button class="sv-btn ghost" data-moved="${i}">✓ ${esc(T("I moved it"))}</button></div></div>`).join("") :
      `<p class="hint${d.Holdings.some(h => h.Safe && h.Amount > 0) ? "" : " sv-go"}"${d.Holdings.some(h => h.Safe && h.Amount > 0) ? "" : ' data-sv-add role="button" tabindex="0"'}>${esc(d.Holdings.some(h => h.Safe && h.Amount > 0) ? T("Your savings already earn about as much as today's best offers. Nothing to move right now.") : T("Add your savings (bank, cash) above, with their interest rate, to see where they would earn more."))}</p>`;
    const optBand = `<div class="nw-card sv-opp"><div class="sv-oh"><span class="sv-star">${si(IC.star, 40)}</span><div><h3>${esc(T("Wealth Optimization Opportunities"))}</h3><small>${esc(T("Smart recommendations to help you get more from your savings."))}</small></div></div>${dueTxt}<div class="sv-ops${mvShown.length > 1 ? "" : " one"}">${opp}</div>
      ${!license.isPro && mv.length > 1 ? `<p class="hint">🔒 ${esc(T("{0} more suggestions for your other savings with MoneyCompass Pro.", mv.length - 1))}</p>` : ""}</div>`;
    // ---------- Savings Performance: what today's rates do to your savings over 1 / 3 / 5 years ----------
    const yrs = svRange, steps = yrs * 4, risky = hv.filter(y => !y.x.Safe).reduce((a, y) => a + y.pl, 0);
    const labs = [], tot = [], inv = [], intr = [];
    for (let k = 0; k <= steps; k++) {
      const mo = k * 3, dt = addMonths(today(), mo); labs.push(dt.toLocaleDateString(LOC(), { month: "short", year: "numeric" }));
      let t = 0; for (const y of hv) t += y.x.Safe || !y.r ? y.pl * Math.pow(1 + y.r / 100 / 12, mo) : y.pl;
      tot.push(Math.round(t)); inv.push(Math.round(risky)); intr.push(Math.round(t - p.total));
    }
    const perfChart = dcard("bars", "res", T("Savings Performance"), `<span class="sv-leg"><i style="background:#2EDC9A"></i>${esc(T("Total Savings"))}<i style="background:#3B9BFF"></i>${esc(T("Investments"))}<i style="background:#F5A623"></i>${esc(T("Interest Earned"))}</span>` +
      lineChart(labs.map((l, i) => i % Math.ceil(steps / 6) === 0 ? l : ""), [{ vals: tot, color: "#2EDC9A", dots: true }, { vals: inv, color: "#3B9BFF", dots: true }, { vals: intr, color: "#F5A623", dots: true }], { w: 700, h: 200 }),
      { klass: "sv-chart", extra: `<span class="sv-tabs">${[1, 3, 5].map(n => `<button type="button" data-svr="${n}" class="${n === yrs ? "on" : ""}">${n} ${esc(n === 1 ? T("Year") : T("Years"))}</button>`).join("")}</span>` });
    const holdCard = dcard("bank", "res", T("Accounts & Holdings"), (d.Holdings.length ? `<div class="sv-hl">${hv.map(({ x, pl, r: rr }) => `<div class="sv-h" data-edit-holding="${x.Id}"><span class="sv-hi">${si(x.Place === "Cash" ? IC.coins || IC.bank : IC.bank, 26)}</span>
        <div class="sv-hn"><b>${esc(x.Name)}</b><small>${esc(T("Annual Return: {0}", pln(pl * rr / 100)))}</small>${promoBadge(x)}</div>
        <div class="sv-hv">${amount(x.Amount, x.Currency)}</div><div class="sv-hr">${esc(rate(rr))}</div>
        <span class="sv-hx">${infoBtn("holding", x)}<button class="icon-btn danger" data-del-holding="${x.Id}">🗑</button></span></div>`).join("")}</div>` : `<p class="hint sv-go" data-sv-add role="button" tabindex="0">${esc(T("Nothing added yet."))} <b>${esc(T("Add your first savings account"))} →</b></p>`), { klass: "sv-hold", extra: `<button class="pm-btn" data-action="sv-checks" title="${esc(T("Statement analyses"))}" aria-label="${esc(T("Statement analyses"))}">±</button>` });
    const risk = x => x.Safe ? T("Low") : T("High");
    const perfCard = `<div class="nw-card dz sv-perf"><div class="nw-ch"><span class="rp-si i-res">${si(IC.trend, 22)}</span><h3>${esc(T("Performance Analysis"))}</h3></div><table class="sv-t"><thead><tr><th>${esc(T("Institution"))}</th><th>${esc(T("Balance"))}</th><th>${esc(T("Yield"))}</th><th>${esc(T("Annual Return"))}</th><th>${esc(T("Risk Profile"))}</th></tr></thead><tbody>${hv.map(({ x, pl, r: rr }) =>
      `<tr><td>${esc(x.Name)}</td><td>${esc(pln(pl))}</td><td>${esc(rate(rr))}</td><td>${esc(pln(pl * rr / 100))}</td><td><span class="sv-risk ${x.Safe ? "low" : "high"}">${esc(risk(x))}</span></td></tr>`).join("") || `<tr><td colspan="5" class="hint">–</td></tr>`}</tbody></table></div>`;
    const pal = ["#2EDC9A", "#3B9BFF", "#F5A623", "#C98FA0", "#8B5CF6", "#22C7A0"];
    const al = hv.filter(y => y.pl > 0).map((y, i) => ({ n: y.x.Name, v: y.pl, c: pal[i % pal.length] }));
    const allocCard = `<div class="nw-card dz sv-alloc"><div class="nw-ch"><span class="rp-si i-res">${si(IC.star, 22)}</span><h3>${esc(T("Allocation"))}</h3></div><div class="sv-ar">${donut(al.map(a => ({ label: a.n, value: a.v, color: a.c })), pln(p.total), "", 130)}
      <ul class="sv-al">${al.map(a => `<li><i style="background:${a.c}"></i><span>${esc(a.n)}</span><b>${p.total > 0 ? Math.round(a.v / p.total * 100) : 0}%</b></li>`).join("")}</ul></div></div>`;
    const fxCard = `<div class="nw-card dz sv-fx"><form id="fx"><div class="nw-ch"><span class="rp-si i-res">${si(IC.repeat, 22)}</span><h3>${esc(T("Exchange rates"))}</h3></div><small class="sv-fxs">${esc(T("Official NBP Rates"))}</small>
        <div class="sv-fxr"><span>EUR</span>${numInput("eur", plain(s.EurToPln))}</div><div class="sv-fxr"><span>USD</span>${numInput("usd", plain(s.UsdToPln))}</div>
        <label class="sv-auto"><input type="checkbox" name="auto"${s.AutoExchangeRates ? " checked" : ""}><span class="nw-ok">✓</span> ${esc(T("Automatically Updated"))}</label></form></div>`;
    const addCard = `<div class="nw-card dz sv-add"><form id="hold"><div class="nw-ch"><span class="rp-si i-res">${si(IC.plus, 22)}</span><h3>${esc(h ? T("Edit: {0}", h.Name) : T("Add Savings Account"))}</h3></div>
        ${field(T("Institution"), textInput("name", f.Name, T("e.g. {0}", "ING, Revolut, …")))}
        ${field(T("Account Type"), select("place", PLACES.map(x => [x, T(x)]), f.Place))}${field(T("Currency"), select("currency", CURRENCIES, f.Currency))}
        <div class="two">${field(T("Balance"), numInput("amount", plain(f.Amount), "10000"))}${field(T("Interest Rate (%)"), numInput("rate", plain(f.RatePercent), "0"))}</div>
        <details class="deposit sv-more"${f.Deposit > 0 || f.PromoEnd ? " open" : ""}><summary>${esc(T("More options"))}</summary>
        ${check("safe", T("Safe money (guaranteed, e.g. bank)"), f.Safe)}
        <div class="two">${field(T("Regular deposit (zł)"), numInput("deposit", plain(f.Deposit), "500"))}${field(T("How often"), select("depfreq", FREQUENCIES.filter(x => x[0] !== ONE_TIME).map(x => [x[0], T(x[0])]), f.DepositFrequency || "Monthly"))}</div>
        <div class="two">${field(T("Date of a payment (last or next one)"), dateInput("depdate", inputDate(parseDate(f.DepositDate || isoDate(today())))))}
          ${field(T("From which account (optional)"), `<input name="depfrom" list="dep-accounts" value="${esc(f.DepositFrom || "")}" placeholder="mBank">`)}</div>
          <datalist id="dep-accounts">${[T("Current account"), ...d.Holdings.filter(x => !h || x.Id !== h.Id).map(x => x.Name)].map(n => `<option value="${esc(n)}">`).join("")}</datalist>
        <div class="two">${field(T("Promotion ends on"), `<input type="date" name="promoend" value="${f.PromoEnd ? inputDate(parseDate(f.PromoEnd)) : ""}">`)}
          ${field(T("Rate after the promotion (% per year)"), numInput("rateafter", f.RateAfter !== null && f.RateAfter !== undefined ? plain(f.RateAfter) : "", "0,5"))}</div>
        </details>
        <div class="buttons">${button("＋ " + (h ? T("Save changes") : T("Add Account")), "save-holding", "main sv-addbtn")}${h ? button(T("Cancel editing"), "cancel-holding") : ""}</div></form></div>`;
    const bot = `<div class="nw-card rp-sum sv-bot"><div class="sv-b1"><span class="rp-si i-res">${si(IC.check, 44)}</span><div><small>${esc(T("Wealth Health Score"))}</small><b>${score} / 100</b></div></div>
      <div class="sv-b1 dv"><span class="rp-si i-res">${si(IC.bars, 34)}</span><div><small class="good">${esc(T("Diversification"))}</small><b>${esc(divers >= 1 ? T("Good") : divers > 0.3 ? T("Fair") : T("Low"))}</b></div></div>
      <div class="sv-b1 dv"><span class="rp-si i-save">${si(IC.coins || IC.save, 34)}</span><div><small>${esc(T("Potential Additional Return"))}</small><b>+${esc(pln(potential))}</b></div></div>
      <div class="sv-b1 dv"><span class="rp-si i-res">${si(IC.trend, 34)}</span><div><small>${esc(T("Projected Annual Return"))}</small><b>${esc(pln(p.yearly + potential))}</b></div></div>
      <div class="sv-msg"><span class="rp-si i-res">${si(IC.check, 34)}</span><span>${esc(mv.length ? T("Your savings portfolio is healthy and multiple opportunities exist to improve annual returns.") : T("Your savings portfolio is healthy."))}</span></div></div>`;
    el.innerHTML = `<div class="sv-page">` + head + optBand + `<div class="sv-main"><div class="sv-left"><div class="sv-r1">${perfChart}${holdCard}</div><div class="sv-r2">${perfCard}${allocCard}${fxCard}</div></div>${addCard}</div>` + bot +
      `<div class="grid">${binCard(["holding"])}</div>` + (p.missing ? hint(T("Some items are in USD or EUR but the exchange rate is empty, so they count as 0 zł. Enter the rates below."), "bad") : "") + `</div>`;
    el.querySelector('[data-action="sv-checks"]')?.addEventListener("click", () => {
      const pp = popup("", { width: 720, cls: "nw-win pm-win" }), orig = App.refresh;
      const draw = () => { pp.el.innerHTML = `<div class="nw-ch pm-head"><span class="rp-si i-res">${si(IC.docs, 24)}</span><h3>${esc(T("Statement analyses"))}</h3><button class="pm-x" data-close aria-label="${esc(T("Close"))}">✕</button></div><div class="bp-flat sv-sc">${savedChecksCard(State.data) || hint(T("No statement analyses yet. Import a savings account statement (Import button, top right)."))}</div>`; bindSavedChecks(pp.el, State.data); };
      App.refresh = (...a) => { orig(...a); if (!pp.closed) draw(); };
      const close = pp.close; pp.close = (...a) => { App.refresh = orig; close(...a); };
      draw();
    });
    el.querySelectorAll("[data-svr]").forEach(b => b.onclick = () => { svRange = +b.dataset.svr; App.refresh(); });
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
    el.querySelectorAll("[data-sv-add]").forEach(x => { const go = () => { const c = el.querySelector(".sv-add"); if (!c) return; c.scrollIntoView({ behavior: "smooth", block: "center" }); c.classList.add("flash"); setTimeout(() => c.classList.remove("flash"), 1400); setTimeout(() => c.querySelector("input")?.focus({ preventScroll: true }), 350); }; x.onclick = go; x.onkeydown = ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); } }; });
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

// Other pages (advisor panels, Optimization Center) ask the Overview to work out the current assessment.
setAssessSource(() => Overview.render(document.createElement("div")));
