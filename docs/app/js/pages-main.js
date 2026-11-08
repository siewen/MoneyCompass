// The free tabs: Overview, Inflows, Outflows, Emergency fund, Savings (with Savings goals for Pro).
import {
  T, State, save, Calc, Advisor, ChartData, COLORS, pln, rate, amount, num, plain, fmtDate, parseDate, isoDate, inputDate,
  today, addDays, addMonths, monthStart, monthName, monthsCount, uuid, categories, findCategory, categoryLabel, categoryIcon,
  addCategory, removeCategory, updateCategory, ICON_CHOICES, OTHER, license, moduleOn, FREQUENCIES, ONE_TIME, RECEIVED, LOAN_CATEGORY, netFromGross, loanPlan, currentRate, duePromos, freqLabel, customFrequency, parseCustom, repeatingExpenses, setReceivedRepeat, receivedRepeatOn, setRepeat, seriesKey, toBin, restoreFromBin, binLabel,
  matchKey, learnCategory, similarExpenses, setCategory, goalSaved, savingsRateText, mainCur, currentName } from "./core.js";
import { pageHead, band, si, IC } from "./page-head.js";
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
export function setSearch(text) { flt.text = text; }
/** "↑ +12% vs. previous month": the last finished month against the one before (pp = difference in percentage points). */
function deltaTag(cur, prev, upIsGood = true, pp = false) {
  if (cur === null || prev === null) return "";
  const diff = pp ? cur - prev : (Math.abs(prev) > 0 ? (cur - prev) / Math.abs(prev) * 100 : NaN);
  if (!isFinite(diff)) return "";
  const r = Math.abs(diff) < 10 ? Math.round(diff * 10) / 10 : Math.round(diff), good = r === 0 || (r > 0) === upIsGood;
  return `<em class="delta ${good ? "good" : "bad"}">${r >= 0 ? "↑" : "↓"} ${r >= 0 ? "+" : "−"}${String(Math.abs(r)).replace(".", ",")}${pp ? " pp" : "%"} <small>${esc(T("vs. previous month"))}</small></em>`;
}
const ic = (d, s = 22) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

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
    const dIn = have2 ? deltaTag(last.income, prevM.income) : "", dOut = have2 ? deltaTag(last.expenses, prevM.expenses, false) : "";
    const dLeft = have2 ? deltaTag(last.income - last.expenses, prevM.income - prevM.expenses) : "";
    const dRate = have2 && last.income > 0 && prevM.income > 0 ? deltaTag((last.income - last.expenses) / last.income * 100, (prevM.income - prevM.expenses) / prevM.income * 100, true, true) : "";
    const hr = new Date().getHours(), first = (currentName() || "").trim().split(/\s+/)[0] || "";
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
    if (top) sugg.push({ ic: "bulb", go: top.route || "", text: T("Best next step: {0}", top.title) });
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
    el.innerHTML = hero + warn + kpis + `<div class="ov-grid">${g.join("")}</div><div class="grid">${x.join("")}</div>`;
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
    const f = e || { Name: "", Type: "Salary", Amount: "", Currency: mainCur(), Frequency: "Monthly", Date: isoDate(today()), Active: true };
    const up = Calc.upcoming(d, today(), addDays(today(), 60));
    const dayText = dt => { const n = Math.round((dt - today()) / 86400000); return n === 0 ? T("today") : n === 1 ? T("tomorrow") : T("in {0} days", n); };

    // ---- Income Management layout ----
    const trend = ChartData.trend(d), pastM = trend.slice(-6);
    const doneM = trend.filter(m => !m.current && (m.income > 0 || m.expenses > 0));
    const lastM = doneM[doneM.length - 1], prevM = doneM[doneM.length - 2];
    const active = d.Incomes.filter(i => i.Active && i.Frequency !== ONE_TIME);
    const fmtShort = dt => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(dt);
    const futureM = Array.from({ length: 6 }, (_, k) => { const st = addMonths(monthStart(today()), k + 1); return { month: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(st), value: Calc.upcoming(d, st, addDays(addMonths(st, 1), -1)).reduce((x, p) => x + p.amount, 0) }; });
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
          <p class="hint">${esc(T("Estimate for an employment contract (umowa o pracę) in Poland: social and health insurance and income tax. Bonuses, a sport card (Multisport), PPK, the under-26 relief, overtime or another kind of contract change your net pay."))}</p>
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
    el.innerHTML = `<div class="pg-title"><span class="pg-ic">${ic('<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18"/><circle cx="16.5" cy="15" r="1.2"/>', 34)}</span><div><h2>${esc(T("Income Management"))}</h2><p>${esc(T("Manage all income sources and plan future cash flow."))}</p></div></div>
      ${kpis}<div class="inc-grid r2">${srcCard}${aiCard}${fcCard}</div><div class="inc-grid r3">${addCard}${tlCard}</div><div class="inc-grid r4">${npCard}${impCard}</div><div class="grid">${binCard(["income", "received"])}</div>`;
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
    const histCard = card(heading(T("Outflow history")) + hint(T("Click an expense to switch it between essential and not essential. The pen changes date, category, amount and more.")) + filterBar +
        (months.length ? visible.map((m, i) => {
          // Folded by month: the newest month open, older ones closed (all open while you search or filter)
          const total = m.items.reduce((s, e) => s + e.Amount, 0), ess = m.items.filter(e => e.Essential).reduce((s, e) => s + e.Amount, 0);
          const k = m.start.getTime(), open = filtering || (histOpen.has(k) ? histOpen.get(k) : i === 0);
          return `<details class="rec-month hist-month" data-hm="${k}"${open ? " open" : ""}><summary><b>${esc(monthName(m.start))}</b>
            <span class="hint">${esc(T("{0} expenses", m.items.length))} · <b>${pln(total)}</b> · ${esc(T("essential {0}", pln(ess)))}</span></summary><div class="list">${m.items.map(expenseRow).join("")}</div></details>`;
        }).join("") + (!showAllMonths && older ? button(T("Show older expenses ({0})", older), "older", "second") : "")
          : hint(filtering ? T("No expenses match this filter.") : T("No expenses yet."))), "wide");
    const tm = ChartData.trend(d).slice(-12), nxt = tm.length ? tm[tm.length - 1] : null;
    const okE = `<span class="nw-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12.500l4.500 4.500L19 7.500"/></svg></span>`;
    const trendCard = `<div class="nw-card ex-card"><div class="nw-ch"><h3>${esc(T("Monthly Spending Trend"))}</h3></div>${tm.length ? ovTrend(tm.map(m => ({ month: m.month, income: m.expenses, expenses: m.expenses }))) : ""}</div>`;
    const fcCard = `<div class="nw-card ex-card"><div class="nw-ch"><span class="rp-si i-res">${si(IC.trend, 24)}</span><h3>${esc(T("Expense Forecast"))}</h3></div><small class="ex-s">${esc(T("Predicted next month"))}:</small><b class="ex-big">${esc(monthly ? pln(monthly) : "–")}</b>${tm.length ? ovBars(tm.slice(-6).map(m => ({ month: m.month, income: m.expenses, expenses: 0 }))) : ""}</div>`;
    const sorted0 = [...(cats.all || [])].sort((x, y) => y.perMonth - x.perMonth), insights = [
      sorted0[0] ? T("{0} is your largest category: {1} per month", categoryLabel(sorted0[0].category), pln(sorted0[0].perMonth)) : null,
      avg.monthsUsed ? T("Not essential spending: {0} per month", pln(avg.nonEssential)) : null,
      avg.monthsUsed ? T("Potential savings opportunity: {0} per month", pln(avg.nonEssential * 0.2)) : null,
      otherCount ? T("{0} outflows are not sorted into a category yet", otherCount) : null].filter(Boolean);
    const insCard = `<div class="nw-card ex-card"><div class="nw-ch"><span class="rp-si i-bulb">${si(IC.bulb, 24)}</span><h3>${esc(T("AI Spending Insights"))}</h3></div><ul class="nw-ul">${insights.map(x => `<li>${okE}<span>${esc(x)}</span></li>`).join("") || `<li class="hint">${esc(T("Add expenses to see insights."))}</li>`}</ul><button class="btn main ex-opt" data-action="ex-optimize">${esc(T("Optimize My Budget"))}</button></div>`;
    const reps0 = d.Expenses.filter(e => e.Repeat), seenR = new Set(), bills = reps0.filter(e => { const k = e.Description || e.Category; if (seenR.has(k)) return false; seenR.add(k); return true; }).slice(0, 4);
    const billsCard = `<div class="nw-card ex-card"><div class="nw-ch"><span class="rp-si i-table">${si(IC.calx, 24)}</span><h3>${esc(T("Upcoming Bills"))}</h3></div>${bills.map(e => `<div class="ex-li"><span>${esc(e.Description || T(e.Category))}</span><b>${esc(pln(e.Amount))}</b><small>${esc(fmtDate(Calc.nextPayment({ Date: e.Date, Frequency: e.Repeat }, today()) || e.Date))}</small></div>`).join("") || `<p class="hint">${esc(T("Mark an expense with 🔁 to see it here."))}</p>`}</div>`;
    const recent = [...d.Expenses].sort((x, y) => parseDate(y.Date) - parseDate(x.Date)).slice(0, 5);
    const recentCard = `<div class="nw-card ex-card"><div class="nw-ch"><span class="rp-si i-res">${si(IC.res, 24)}</span><h3>${esc(T("Recent Expenses"))}</h3></div>${recent.map(e => `<div class="ex-li"><span>${esc(e.Description || T(e.Category))}</span><b>${esc(pln(e.Amount))}</b><small>${esc(fmtDate(e.Date))}</small></div>`).join("") || `<p class="hint">–</p>`}</div>`;
    const previewCard = `<div class="nw-card ex-card ex-prev"><div class="nw-ch"><span class="rp-si i-res">${si(IC.calx, 24)}</span><h3>${esc(T("Net Expense Preview"))}</h3></div><b class="ex-big">${esc(monthly ? pln(monthly) : "–")}</b><small class="ex-s">${esc(T("average per month"))}</small>${avg.monthsUsed ? `<div class="ex-imp"><b>${esc(T("Essential"))}: ${esc(pln(avg.essential))}</b><span class="cr-bar"><i style="width:${Math.min(100, Math.round(avg.essential / Math.max(1, monthly) * 100))}%;background:#34D399"></i></span></div>` : ""}</div>`;
    const topCats = [...(cats.all || [])].sort((x, y) => y.perMonth - x.perMonth).slice(0, 8);
    const quickCard = `<div class="nw-card ex-card ex-quick"><div class="nw-ch"><h3>${esc(T("Expense Categories Quick Access"))}</h3></div><div class="ex-chips">${topCats.map(c => `<button class="ex-chip" data-quick="${esc(c.category)}">${esc(categoryLabel(c.category))}</button>`).join("") || `<p class="hint">–</p>`}</div></div>`;
    el.innerHTML = expHead + `${tipC}<div class="ex-row1">${catCard}${trendCard}${fcCard}${insCard}</div>
    <div class="ex-row2"><div class="ex-form">${formCard}</div>${previewCard}${billsCard}${recentCard}</div>
    <div class="ex-row3">${quickCard}</div>
    <div class="grid">
      ${avgCard}
      ${histCard}
      ${movedCard(d)}
      ${binCard(["expense"])}
    </div>` + expBand;

    el.querySelector('[data-action="ex-add"]').onclick = () => { const f = el.querySelector("#expense-form"); f.scrollIntoView({ behavior: "smooth", block: "center" }); f.querySelector('[name="amount"]')?.focus(); };
    el.querySelectorAll("[data-quick]").forEach(b => b.onclick = () => { const f = el.querySelector("#expense-form"), sel = f.querySelector('[name="category"]'); if (sel) { sel.value = b.dataset.quick; sel.dispatchEvent(new Event("change", { bubbles: true })); } f.scrollIntoView({ behavior: "smooth", block: "center" }); f.querySelector('[name="amount"]')?.focus(); });
    el.querySelector('[data-action="ex-optimize"]')?.addEventListener("click", () => App.openOptimize());
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
  const draw = () => `<h2 class="popup-title">${esc(T("Edit categories"))}</h2>
    ${hint(T("Your own categories: change the name, icon or \"essential\" with ✎, or delete one with 🗑 (its expenses move to \"Other\"). The standard categories can't be changed."))}
    <div class="list">${d.Categories.length ? d.Categories.map(c => `<div class="item"><div><b>${esc((c.Icon ? c.Icon + " " : "") + c.Name)}</b>
      <span class="hint">${esc(c.Essential ? T("Essential") : T("Not essential"))} · ${esc((n => n === 1 ? T("1 expense") : T("{0} expenses", n))(d.Expenses.filter(e => e.Category === c.Name).length))}</span></div>
      <div class="row-actions"><button class="icon-btn" data-edit-cat="${esc(c.Name)}" title="${esc(T("Edit"))}">✎</button>
      <button class="icon-btn danger" data-del-cat="${esc(c.Name)}" title="${esc(T("Delete"))}">🗑</button></div></div>`).join("") : hint(T("No own categories yet."))}</div>
    <div class="popup-buttons"><button class="btn second" data-close>${esc(T("Close"))}</button><button class="btn main" data-add>＋ ${esc(T("New category"))}</button></div>`;
  const p = popup(draw(), { width: 560, onClose: () => App.refresh() });
  const bind = () => {
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
    const f = h || { Name: "", Place: "Bank", Amount: "", Currency: mainCur(), RatePercent: "", Safe: true };
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
      <!-- Importing a savings statement: the button in the page header ("Import savings account statement") -->
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
