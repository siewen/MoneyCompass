// Module "Calendar": everything that comes back regularly – income, fixed costs, transfers to savings,
// loan payments – in a month calendar and as a preview for 1, 3, 6 or 12 months.
import {
  T, State, save, Calc, pln, num, plain, fmtDate, parseDate, isoDate, inputDate, today, addDays, addMonths, monthStart, monthName,
  uuid, categories, categoryLabel, moduleOn, FREQUENCIES, ONE_TIME, locale, monthsCount, repeatingExpenses, setRepeat, freqLabel, repeatingReceived, setReceivedRepeat, seriesKey, LOAN_CATEGORY, isRecurringPayment,
} from "./core.js";
import { NEW_CAT } from "./ui.js";
import { esc, card, heading, hint, row, field, textInput, numInput, dateInput, select, button, values, confirmBox, toast } from "./ui.js";
import { App } from "./app.js";
import { pageHead, band, si, IC } from "./page-head.js";
import { ovTrend } from "./ov-charts.js";
import { binCard, infoBtn } from "./pages-main.js";
import { toBin } from "./core.js";

const D = () => State.data;
const KINDS = [["expense", "Payment"], ["saving", "Transfer to savings"]];
const RANGES = [1, 3, 6, 12];
let range = 3, shown = null, editId = null, selectedDay = null, allPast = false;
const folded = new Map();   // month → open (true) or closed (false), as you left it; all months start closed
const mkey = ms => ms.getFullYear() * 12 + ms.getMonth();

/** All payments between two dates: income, recurring payments, savings transfers and loans. */
export function events(d, from, to) {
  const list = [];
  for (const p of Calc.upcoming(d, from, to))
    list.push({ date: p.date, name: p.source.Name, amount: p.amount, type: "in", note: T(p.source.Type) + (p.source.Frequency && p.source.Frequency !== ONE_TIME ? " · 🔁 " + freqLabel(p.source.Frequency) : "") });
  for (const r of (d.Recurring || []).filter(r => r.Active !== false)) {
    const amount = r.Amount || 0;
    const last = r.EndDate ? parseDate(r.EndDate) : null;
    let next = Calc.nextPayment(r, from), guard = 0;
    while (next && next <= to && (!last || next <= last) && guard++ < 400) {
      list.push({ date: next, name: r.Name, amount, type: r.Kind === "saving" ? "save" : "out", note: (r.Kind === "saving" ? T("Transfer to savings") : T(r.Category || "Other")) + (r.Frequency !== ONE_TIME ? " · 🔁 " + freqLabel(r.Frequency) : ""), id: r.Id });
      if (r.Frequency === ONE_TIME) break;
      next = Calc.nextPayment(r, addDays(next, 1));
    }
  }
  // My savings with a regular deposit (standing order)
  for (const h of d.Holdings.filter(h => h.Deposit > 0 && h.DepositDate)) {
    const rule = { Date: h.DepositDate, Frequency: h.DepositFrequency || "Monthly" };
    let next = Calc.nextPayment(rule, from), guard = 0;
    while (next && next <= to && guard++ < 400) {
      list.push({ date: next, name: h.Name, amount: h.Deposit, type: "save", note: T("Savings") + " · 🔁 " + freqLabel(h.DepositFrequency || "Monthly") + (h.DepositFrom ? " · " + T("from {0}", h.DepositFrom) : "") });
      next = Calc.nextPayment(rule, addDays(next, 1));
    }
  }
  // Expenses marked 🔁 in the Expenses tab: continued after their latest payment
  for (const e of repeatingExpenses(d)) {
    const lastPaid = parseDate(e.Date);
    let next = Calc.nextPayment({ Date: e.Date, Frequency: e.Repeat }, from), guard = 0;
    while (next && next <= to && guard++ < 400) {
      if (next > lastPaid) list.push({ date: next, name: e.Description || T(e.Category), amount: e.Amount, type: "out", note: T(e.Category) + " · 🔁 " + freqLabel(e.Repeat), expense: e.Id });
      next = Calc.nextPayment({ Date: e.Date, Frequency: e.Repeat }, addDays(next, 1));
    }
  }
  // Money received (not salary) marked 🔁 in the Income tab
  for (const r of repeatingReceived(d)) {
    const lastPaid = parseDate(r.Date), rule = { Date: r.Date, Frequency: r.Repeat };
    let next = Calc.nextPayment(rule, from), guard = 0;
    while (next && next <= to && guard++ < 400) {
      if (next > lastPaid) list.push({ date: next, name: r.Description || T("Money received"), amount: r.Amount, type: "in", note: T("Extra income") + " · 🔁 " + freqLabel(r.Repeat), received: r.Id });
      next = Calc.nextPayment(rule, addDays(next, 1));
    }
  }
  // Savings promotions that end (after that most banks pay only about 0.5%)
  for (const h of d.Holdings.filter(h => h.PromoEnd && h.Amount > 0)) {
    const end = parseDate(h.PromoEnd);
    if (end >= from && end <= to) list.push({ date: end, name: "🎁 " + h.Name, amount: 0, type: "info", note: T("Promotion ends") });
  }
  if (moduleOn("loans"))
    for (const l of d.Loans.filter(l => l.Remaining > 0 && l.MonthlyPayment > 0)) {
      const end = parseDate(l.EndDate);
      let next = Calc.nextPayment({ Date: l.EndDate, Frequency: "Monthly" }, from), guard = 0;
      while (next && next <= to && next <= end && guard++ < 400) {
        list.push({ date: next, name: l.Name, amount: l.MonthlyPayment, type: "out", note: loanNote(l) });
        next = Calc.nextPayment({ Date: l.EndDate, Frequency: "Monthly" }, addDays(next, 1));
      }
    }
  return list.sort((a, b) => a.date - b.date || (a.type === "in" ? -1 : 1));
}

/** Regular payments folded by category: the header shows the category, how many and the total per month;
 *  open it for the payments themselves. Short lists (up to 5) stay open. Which groups are open is remembered. */
const catOpenState = new Map();
function catGroups(key, items, catOf, amtOf, freqOf, rowFn) {
  const groups = new Map();
  for (const x of items) { const c = catOf(x) || "Other"; if (!groups.has(c)) groups.set(c, []); groups.get(c).push(x); }
  const factor = f => (FREQUENCIES.find(q => q[0] === f) || [0, 1])[1];
  const list = [...groups.entries()].map(([c, xs]) => ({ c, xs, total: xs.reduce((s, x) => s + (amtOf(x) || 0) * factor(freqOf(x)), 0) })).sort((a, b) => b.total - a.total);
  const fold = items.length > 5;
  return list.map(g => {
    const id = key + ":" + g.c, open = catOpenState.has(id) ? catOpenState.get(id) : !fold;
    return `<details class="rec-month cat-group" data-cg="${esc(id)}"${open ? " open" : ""}><summary><b>${esc(g.c === "Transfer to savings" ? T(g.c) : categoryLabel(g.c))}</b>
      <span class="hint">${esc(g.xs.length === 1 ? T("1 payment") : T("{0} payments", g.xs.length))} · <b>${pln(g.total)}</b> ${esc(T("per month"))}</span></summary><div class="list">${g.xs.map(rowFn).join("")}</div></details>`;
  }).join("");
}
document.addEventListener("toggle", e => { const g = e.target.closest?.(".cat-group"); if (g) catOpenState.set(g.dataset.cg, g.open); }, true);


const loanNote = l => T("Loan payments") + " · 🔁 " + freqLabel("Monthly") + (l.PaidFrom ? " · " + T("from {0}", l.PaidFrom) : "");
/** Loan payments before today, from the loan's own payment day – also when they are paid from another bank
 *  that is not in your imports. A payment that is in your imports (category "Loan payments") is not shown twice. */
function pastLoans(d, from, to) {
  if (!moduleOn("loans")) return [];
  const list = [], end = new Date(Math.min(to.getTime(), addDays(today(), -1).getTime()));
  for (const l of d.Loans.filter(l => l.MonthlyPayment > 0 && l.EndDate)) {
    const rule = { Date: l.NextPayment || l.EndDate, Frequency: "Monthly" };
    let next = Calc.nextPayment(rule, from), guard = 0;
    while (next && next <= end && guard++ < 400) {
      const n = next;
      const imported = d.Expenses.some(e => e.Category === LOAN_CATEGORY && Math.abs(parseDate(e.Date) - n) <= 5 * 86400000 && Math.abs(e.Amount - l.MonthlyPayment) <= l.MonthlyPayment * 0.05);
      if (!imported) list.push({ date: n, name: l.Name, amount: l.MonthlyPayment, type: "out", note: loanNote(l), past: true });
      next = Calc.nextPayment(rule, addDays(next, 1));
    }
  }
  return list;
}
/** What really happened before today: your expenses, money received and transfers to savings (typed in or imported). */
function pastEvents(d, from, to) {
  const list = [], inRange = x => { const t = parseDate(x.Date); return t >= from && t <= to && t < today(); };
  // By default only what comes back: repeating expenses, salary and repeating income, transfers to savings.
  // "All transactions" shows every single payment too.
  const repOf = new Map(d.Expenses.filter(e => e.Repeat).map(e => [seriesKey(e), e.Repeat])), recOf = new Map(d.Received.filter(r => r.Repeat).map(r => [seriesKey(r), r.Repeat]));
  const repKeys = new Set(repOf.keys()), recKeys = new Set(recOf.keys());
  const tag = (map, x) => map.has(seriesKey(x)) ? " · 🔁 " + freqLabel(map.get(seriesKey(x))) : "";
  // An expense that is one of your regular payments from this page (same amount, around the same day of the month)
  const recs = (d.Recurring || []).filter(r => r.Active !== false && r.Kind !== "saving" && r.Amount > 0);
  const matchesRec = e => recs.some(r => Math.abs(e.Amount - r.Amount) <= r.Amount * 0.05 && Math.abs(parseDate(e.Date).getDate() - parseDate(r.Date).getDate()) <= 5);
  const regularExp = e => allPast || repKeys.has(seriesKey(e)) || matchesRec(e), regularRec = r => allPast || r.Kind === "salary" || recKeys.has(seriesKey(r));
  for (const e of d.Expenses.filter(e => inRange(e) && regularExp(e)))
    list.push({ date: parseDate(e.Date), name: e.Description || T(e.Category), amount: e.Amount, type: "out", note: T(e.Category) + tag(repOf, e), past: true, info: ["expense", e] });
  for (const r of d.Received.filter(r => r.Kind !== "none" && inRange(r) && regularRec(r)))
    list.push({ date: parseDate(r.Date), name: r.Description || T("Money received"), amount: r.Amount, type: "in", note: T(r.Kind === "salary" ? "Salary" : "Extra income") + tag(recOf, r), past: true, info: ["received", r] });
  for (const t of d.Transfers.filter(t => t.Saved && inRange(t))) {
    const h = d.Holdings.find(x => x.Id === t.HoldingId);
    list.push({ date: parseDate(t.Date), name: h ? h.Name : (t.Description || T("Transfer to savings")), amount: t.Amount, type: "save", note: T("Transfer to savings") + (t.Info?.Account ? " · " + T("from {0}", t.Info.Account) : ""), past: true, info: ["transfer", t] });
  }
  list.push(...pastLoans(d, from, to));
  // Your income sources (Inflows tab) in past months too – e.g. a salary paid into a bank you don't import.
  // A month that already has a salary from your bank imports keeps that one (not counted twice).
  const end = new Date(Math.min(to.getTime(), addDays(today(), -1).getTime()));
  if (end >= from) {
    const salaryIn = (a, b) => d.Received.some(r => r.Kind === "salary" && parseDate(r.Date) >= a && parseDate(r.Date) <= b);
    for (const p of Calc.upcoming(d, from, end)) {
      const ms = monthStart(p.date), me = addDays(addMonths(ms, 1), -1);
      if (salaryIn(ms, me)) continue;
      list.push({ date: p.date, name: p.source.Name, amount: p.amount, type: "in", past: true,
        note: T(p.source.Type) + (p.source.Frequency && p.source.Frequency !== ONE_TIME ? " · 🔁 " + freqLabel(p.source.Frequency) : "") + " · " + T("from your income sources") });
    }
  }
  // Regular payments added here: shown in past months too, unless the same payment is already among your expenses
  const until = new Date(Math.min(to.getTime(), addDays(today(), -1).getTime()));
  for (const r of (d.Recurring || []).filter(r => r.Active !== false && r.Amount > 0)) {
    const last = r.EndDate ? parseDate(r.EndDate) : null;
    let next = Calc.nextPayment(r, from), guard = 0;
    while (next && next <= until && (!last || next <= last) && guard++ < 62) {
      const n = next;
      const known = r.Kind !== "saving" && d.Expenses.some(e => isRecurringPayment(e, r, n));
      if (!known) list.push({ date: n, name: r.Name, amount: r.Amount, type: r.Kind === "saving" ? "save" : "out", past: true,
        note: (r.Kind === "saving" ? T("Transfer to savings") : T(r.Category || "Other")) + (r.Frequency !== ONE_TIME ? " · 🔁 " + freqLabel(r.Frequency) : "") });
      if (r.Frequency === ONE_TIME) break;
      next = Calc.nextPayment(r, addDays(next, 1));
    }
  }
  return list;
}
/** The first month with any of your data – the calendar can go back to it. */
function firstMonth(d) {
  const dates = [...d.Expenses, ...d.Received, ...d.Transfers.filter(t => t.Saved)].map(x => parseDate(x.Date)).filter(x => x && !isNaN(x));
  const start = monthStart(today());
  if (!dates.length) return start;
  const first = monthStart(new Date(Math.min(...dates)));
  return first < start ? first : start;
}

/** Expenses that look like they come back every month (same name, similar amount, in 2 or more months). */
function suggestions(d) {
  const key = s => (s || "").toLowerCase().replace(/[0-9.,/#*-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
  const known = new Set([...(d.Recurring || []).map(r => key(r.Name)), ...repeatingExpenses(d).map(e => key(e.Description))]);
  const since = addMonths(monthStart(today()), -4);
  const groups = new Map();
  for (const e of d.Expenses.filter(e => parseDate(e.Date) >= since && e.Description)) {
    const k = key(e.Description);
    if (!k || known.has(k)) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  const out = [];
  for (const [k, list] of groups) {
    const months = new Set(list.map(e => { const x = parseDate(e.Date); return x.getFullYear() * 12 + x.getMonth(); }));
    if (months.size < 2) continue;
    const amounts = list.map(e => e.Amount), avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    if (amounts.some(a => Math.abs(a - avg) > avg * 0.2 + 1)) continue;
    const last = list.reduce((a, b) => parseDate(a.Date) > parseDate(b.Date) ? a : b);
    out.push({ name: last.Description, amount: Math.round(avg * 100) / 100, category: last.Category, date: last.Date, months: months.size });
  }
  return out.sort((a, b) => b.amount - a.amount).slice(0, 8);
}

export const Calendar = {
  route: "calendar", title: "Calendar",
  render(el) {
    const d = D();
    if (!d.Recurring) d.Recurring = [];
    const start = monthStart(today());
    // The calendar starts with the oldest month of your data (typed in or imported) and goes into the future
    const first = firstMonth(d);
    if (!shown || shown < first) shown = first;
    const end = addDays(addMonths(start, range), -1);
    const all = events(d, today(), end);
    const sums = t => all.filter(e => e.type === t).reduce((s, e) => s + e.amount, 0);
    const inSum = sums("in"), outSum = sums("out"), saveSum = sums("save");

    // ---------- Month calendar ----------
    const mEnd = addDays(addMonths(shown, 1), -1);
    // Before today: what really happened. From today: what is planned.
    const monthEvents = [...pastEvents(d, shown, mEnd), ...(mEnd >= today() ? events(d, new Date(Math.max(shown.getTime(), today().getTime())), mEnd) : [])]
      .sort((a, b) => a.date - b.date || (a.type === "in" ? -1 : 1));
    const firstDow = (shown.getDay() + 6) % 7;   // Monday first
    const days = mEnd.getDate();
    const dayNames = [...Array(7)].map((_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale(), { weekday: "short" }));
    let cells = "";
    for (let i = 0; i < firstDow; i++) cells += `<div class="cal-cell empty"></div>`;
    for (let day = 1; day <= days; day++) {
      const date = new Date(shown.getFullYear(), shown.getMonth(), day);
      const ev = monthEvents.filter(e => e.date.getDate() === day);
      const isToday = date.getTime() === today().getTime();
      const net = ev.reduce((s, e) => s + (e.type === "in" ? e.amount : -e.amount), 0), money = ev.some(e => e.type !== "info");
      cells += `<button class="cal-cell${isToday ? " today" : ""}${date < today() ? " past" : ""}${ev.length ? " has" : ""}${selectedDay === day ? " sel" : ""}" data-day="${day}">
        <span class="cal-day">${day}</span>${ev.slice(0, 2).map(e => `<span class="cal-chip ${e.type}" title="${esc(e.name)}: ${esc(pln(e.amount))}"><b>${esc(e.name)}</b>${e.type === "info" ? "" : `<i>${e.type === "in" ? "+" : "−"}${esc(short(e.amount))}</i>`}</span>`).join("")}${ev.length > 2 ? `<span class="cal-more">+${ev.length - 2}</span>` : ""}
        </button>`;
    }
    const dayList = selectedDay ? monthEvents.filter(e => e.date.getDate() === selectedDay) : [];

    // ---------- Preview per month, with the running total ----------
    // Months before this one: what really happened (from the oldest month of your data)
    const sumUp = ev => ({ inn: ev.filter(e => e.type === "in").reduce((s, e) => s + e.amount, 0), out: ev.filter(e => e.type === "out").reduce((s, e) => s + e.amount, 0),
      sav: ev.filter(e => e.type === "save").reduce((s, e) => s + e.amount, 0) });
    const pastMonths = [];
    for (let ms = first; ms < start; ms = addMonths(ms, 1)) {
      const ev = pastEvents(d, ms, addDays(addMonths(ms, 1), -1)).sort((a, b) => a.date - b.date);
      pastMonths.push({ ms, ev, ...sumUp(ev) });
    }
    let running = 0;
    const months = [];
    for (let i = 0; i < range; i++) {
      const ms = addMonths(start, i), me = addDays(addMonths(ms, 1), -1);
      // This month: what already happened before today + what is planned from today
      const ev = [...(i === 0 ? pastEvents(d, ms, me) : []), ...all.filter(e => e.date >= ms && e.date <= me)].sort((a, b) => a.date - b.date);
      const inn = ev.filter(e => e.type === "in").reduce((s, e) => s + e.amount, 0);
      const out = ev.filter(e => e.type === "out").reduce((s, e) => s + e.amount, 0);
      const sav = ev.filter(e => e.type === "save").reduce((s, e) => s + e.amount, 0);
      running += inn - out - sav;
      months.push({ ms, ev, inn, out, sav, running });
    }

    const r = editId ? d.Recurring.find(x => x.Id === editId) : null;
    const f = r || { Name: "", Kind: "expense", Category: "Housing / rent", Amount: "", Frequency: "Monthly", Date: isoDate(today()), Active: true };
    const sugg = suggestions(d);
    const reps = repeatingExpenses(d), recs = repeatingReceived(d);
    const deps = d.Holdings.filter(h => h.Deposit > 0 && h.DepositDate);
    const evRow = e => `<div class="item"><span class="cal-dot ${e.type}"></span><div><b>${esc(e.name)}</b><span class="hint">${fmtDate(e.date)} · ${esc(e.note)}${e.past ? "" : " · " + esc(T("scheduled"))}</span></div>
      ${e.type === "info" ? "" : `<b class="${e.type === "in" ? "good" : e.type === "save" ? "primary" : "bad"}">${e.type === "in" ? "+" : "−"}${pln(e.amount)}</b>`}${e.info ? infoBtn(...e.info) : ""}</div>`;

    const netCf = inSum - outSum - saveSum;
    const calHead = pageHead({ icon: "cal", title: T("Financial Calendar"), sub: T("View upcoming income, expenses, subscriptions and cashflow forecasts in one place."),
      kpis: [{ l: T("Upcoming Income"), v: pln(inSum), icon: "up", cls: "in" }, { l: T("Upcoming Expenses"), v: pln(outSum), icon: "down", cls: "out" }, { l: T("Scheduled Savings Transfers"), v: pln(saveSum), icon: "pig", cls: "rate" }, { l: T("Expected Net Cashflow"), v: (netCf >= 0 ? "+" : "−") + pln(Math.abs(netCf)), icon: "bars", cls: "left", vcls: netCf < 0 ? "bad" : "" }] });
    const calBand = band(T("Cashflow Projection"), "trend", [{ l: T("Upcoming Income"), v: pln(inSum) }, { l: T("Upcoming Expenses"), v: pln(outSum) }, { l: T("Planned Savings"), v: pln(saveSum) }, { l: T("Expected Surplus"), v: pln(netCf), big: true, cls: netCf < 0 ? "bad" : "good" }], "rp-trend2");
    const forecastCard = card(heading((range === 1 ? T("Forecast for the coming month") : T("Forecast for the next {0} months", range)), "📅") +
        `<div class="chips">${RANGES.map(n => `<button class="chip${n === range ? " on" : ""}" data-range="${n}">${esc(monthsLabel(n))}</button>`).join("")}</div>` +
        row(T("Expected inflows"), `<span class="good">+${pln(inSum)}</span>`) + row(T("Expected outflows"), `<span class="bad">−${pln(outSum)}</span>`) +
        row(T("Transfers to savings"), `<span class="primary">${pln(saveSum)}</span>`) + row(T("Expected balance"), pln(inSum - outSum - saveSum), "big" + (inSum - outSum - saveSum < 0 ? " bad" : " good")) +
        hint(T("From today to {0}. Includes your income sources, recurring payments and loan instalments.", fmtDate(end))));
    const calCard = card(`<div class="cal-head"><button class="icon-btn" data-month="-1"${shown <= first ? ` disabled title="${esc(T("This is the first month of your data."))}"` : ""}>◀</button><h3>${esc(monthName(shown))}</h3>${shown.getTime() !== start.getTime() ? `<button class="chip" data-month="now">${esc(T("Today"))}</button>` : ""}<button class="icon-btn" data-month="1">▶</button></div>
        <div class="cal-grid">${dayNames.map(n => `<div class="cal-dow">${esc(n)}</div>`).join("")}${cells}</div>
        <div class="cal-legend"><span><i class="cal-dot in"></i>${esc(T("Inflows"))}</span><span><i class="cal-dot out"></i>${esc(T("Outflows"))}</span><span><i class="cal-dot save"></i>${esc(T("Savings"))}</span><span><i class="cal-dot info"></i>${esc(T("Promotion ends"))}</span></div>` );
    const regCard = card(heading(T("Regular payments")) + (deps.length ? `<h3 class="sub-h">🔁 ${esc(T("Standing orders to savings"))}</h3><div class="list">${deps.map(h => `
        <div class="item clickable" data-go="portfolio"><span class="cal-dot save"></span><div><b>${esc(h.Name)}</b>
        <span class="hint">${esc(freqLabel(h.DepositFrequency || "Monthly"))} · ${esc(T("Transfer to savings"))}${h.DepositFrom ? " · " + esc(T("from {0}", h.DepositFrom)) : ""} · ${esc(T("next {0}", fmtDate(Calc.nextPayment({ Date: h.DepositDate, Frequency: h.DepositFrequency || "Monthly" }, today()) || h.DepositDate)))}</span></div>
        <b class="primary">${pln(h.Deposit)}</b></div>`).join("")}</div><hr>` : "") + (recs.length ? `<h3 class="sub-h">🔁 ${esc(T("Recurring income"))}</h3><div class="list">${recs.map(r => `
        <div class="item"><span class="cal-dot in"></span><div><b>${esc(r.Description || "–")}</b>
        <span class="hint">${esc(freqLabel(r.Repeat))} · ${esc(T("Extra income"))} · ${esc(T("next {0}", fmtDate(Calc.nextPayment({ Date: r.Date, Frequency: r.Repeat }, new Date(Math.max(today().getTime(), addDays(parseDate(r.Date), 1).getTime()))) || r.Date)))}</span></div>
        <b class="good">+${pln(r.Amount)}</b><label class="switch" title="${esc(T("Repeats"))}"><input type="checkbox" data-rep-rec="${r.Id}" checked><span></span></label></div>`).join("")}</div><hr>` : "") + (reps.length ? `<h3 class="sub-h">🔁 ${esc(T("Recurring expenses"))}</h3>${catGroups("rep", reps, e => e.Category, e => e.Amount, e => e.Repeat, e => `
        <div class="item"><span class="cal-dot out"></span><div><b class="rec-desc" title="${esc(e.Description || "")}">${esc(e.Description || T(e.Category))}</b>
        <span class="hint">${esc(freqLabel(e.Repeat))} · ${esc(T(e.Category))} · ${esc(T("next {0}", fmtDate(Calc.nextPayment({ Date: e.Date, Frequency: e.Repeat }, new Date(Math.max(today().getTime(), addDays(parseDate(e.Date), 1).getTime()))) || e.Date)))}</span></div>
        <b>${pln(e.Amount)}</b><label class="switch" title="${esc(T("Repeats"))}"><input type="checkbox" data-rep-exp="${e.Id}" checked><span></span></label></div>`)}<hr>` : hint(T("Tip: mark an expense with 🔁 in the Outflows tab to include it here every month."))) + (d.Recurring.length ? `${catGroups("own", d.Recurring, x => x.Kind === "saving" ? "Transfer to savings" : x.Category, x => x.Active === false || ended(x) ? 0 : x.Amount, x => x.Frequency, x => `
        <div class="item clickable${x.Active === false || ended(x) ? " off" : ""}" data-edit-rec="${x.Id}"><span class="cal-dot ${x.Kind === "saving" ? "save" : "out"}"></span><div><b class="rec-desc" title="${esc(x.Name)}">${esc(x.Name)}</b>
        <span class="hint">${esc(freqLabel(x.Frequency))} · ${esc(x.Kind === "saving" ? T("Transfer to savings") : T(x.Category))} · ${esc(x.Active === false ? T("switched off") : ended(x) ? T("ended {0}", fmtDate(x.EndDate)) : T("next {0}", fmtDate(Calc.nextPayment(x, today()) || x.Date)) + (x.EndDate ? " · " + T("last {0}", fmtDate(x.EndDate)) : ""))}</span></div>
        <b>${pln(x.Amount)}</b><label class="switch" title="${esc(T("Active (included in totals)"))}"><input type="checkbox" data-active-rec="${x.Id}"${x.Active !== false ? " checked" : ""}><span></span></label>
        <button class="icon-btn danger" data-del-rec="${x.Id}">🗑</button></div>`)}` + hint(T("Use the switch to stop counting a payment without deleting it.")) : (reps.length || deps.length ? "" : hint(T("No regular payments yet. Add your rent, bills and subscriptions above.")))) +
        (sugg.length ? `<hr><h3>💡 ${esc(T("Suggestions from your expenses"))}</h3>${hint(T("These recur every month. Add them with one click."))}<div class="list">${sugg.map((x, i) => `
          <div class="item"><div><b>${esc(x.name)}</b><span class="hint">${esc(categoryLabel(x.category))} · ${esc(T("in {0} months", x.months))}</span></div><b>${pln(x.amount)}</b>
          <button class="btn second small" data-sugg="${i}">＋ ${esc(T("Add"))}</button></div>`).join("")}</div>` : ""));
    const formCard = card(`<form id="rec">${heading(r ? T("Edit: {0}", r.Name) : T("Add a regular payment"))}
        ${hint(T("Rent, bills, subscriptions, insurance or a standing order to savings – anything that recurs. Payments added here are included in your expenses, budget and forecasts, unless the same payment is already in your expenses. Income is managed in the Inflows tab."))}
        ${field(T("Name"), textInput("name", f.Name, T("e.g. {0}", "Netflix, czynsz, PZU")))}
        <div class="two">${field(T("Type"), select("kind", KINDS.map(k => [k[0], T(k[1])]), f.Kind))}${field(T("Amount (zł)"), numInput("amount", plain(f.Amount)))}</div>
        <div class="two">${field(T("Category"), select("category", [...categories().map(c => [c.Name, categoryLabel(c.Name)]), NEW_CAT()], f.Category))}${field(T("How often"), select("frequency", FREQUENCIES.map(x => [x[0], T(x[0])]), f.Frequency))}</div>
        <div class="two">${field(T("Date of a payment (past or upcoming)"), dateInput("date", inputDate(parseDate(f.Date))))}
        ${field(T("Final payment (optional)"), `<input type="date" name="end" value="${f.EndDate ? inputDate(parseDate(f.EndDate)) : ""}">`)}</div>
        ${hint(T("For payments that end, such as a contract: enter the final payment date and it stops counting after that. You can also switch a payment off in the list below."))}
        <div class="buttons">${button(r ? T("Save changes") : T("Add"), "save-rec", "main")}${r ? button(T("Cancel"), "cancel-rec") : ""}</div></form>`);
    const monthsCard = card(`<div class="nw-ch"><span class="rp-si i-table">${si(IC.table, 24)}</span><h3>${esc(T("Month by month"))}</h3></div>` + `<div class="chips past-chips"><button class="chip${allPast ? "" : " on"}" data-past="0">🔁 ${esc(T("Recurring only"))}</button><button class="chip${allPast ? " on" : ""}" data-past="1">${esc(T("All transactions"))}</button></div>` +
        hint(allPast ? T("Past months show every transaction from your entries and bank imports.") : T("Past months show recurring items only: expenses marked 🔁, salary, recurring income and transfers to savings. Mark an expense with 🔁 in the Outflows tab to include it.")) + pastMonths.map(m => `<details class="cal-month past" data-m="${mkey(m.ms)}"${folded.get(mkey(m.ms)) ? " open" : ""}><summary class="cal-month-head"><span class="m-name"><b>${esc(monthName(m.ms))}</b> <small class="hint">· ${esc(T("actual"))}</small></span>
        <span><span class="good">+${pln(m.inn)}</span> · <span class="bad">−${pln(m.out)}</span>${m.sav ? ` · <span class="primary">${pln(m.sav)}</span>` : ""} · <b class="${m.inn - m.out - m.sav >= 0 ? "good" : "bad"}">${pln(m.inn - m.out - m.sav)}</b></span></summary>
        <div class="list">${m.ev.map(evRow).join("") || hint(T("Nothing in this month."))}</div></details>`).join("") + months.map(m => `<details class="cal-month" data-m="${mkey(m.ms)}"${folded.get(mkey(m.ms)) ? " open" : ""}><summary class="cal-month-head"><span class="m-name"><b>${esc(monthName(m.ms))}</b></span>
        <span><span class="good">+${pln(m.inn)}</span> · <span class="bad">−${pln(m.out)}</span>${m.sav ? ` · <span class="primary">${pln(m.sav)}</span>` : ""} · <b class="${m.inn - m.out - m.sav >= 0 ? "good" : "bad"}">${pln(m.inn - m.out - m.sav)}</b></span></summary>
        <div class="list">${m.ev.map(evRow).join("") || hint(T("No payments scheduled for this period."))}</div></details>`).join("") +
        hint(T("Click a month to see its payments.")) +
        row(T("Balance after {0}", monthsLabel(range)), pln(running), "big" + (running < 0 ? " bad" : " good")), "wide");
    const evCard = `<div class="nw-card cal-ev"><div class="nw-ch"><span class="rp-si">${si(IC.cal, 22)}</span><h3>${esc(T("Event Details"))}</h3></div>${selectedDay ? `<h3 class="cal-evd">${esc(fmtDate(new Date(shown.getFullYear(), shown.getMonth(), selectedDay)))}</h3>` + (dayList.length ? `<div class="list">${dayList.map(evRow).join("")}</div>` : hint(T("Nothing on this day."))) : hint(T("Click a day to see its payments."))}${hint(T("Before today: actual transactions (your entries and bank imports). From today: scheduled payments."))}</div>`;
    const trendMonths = months.map(m => ({ month: monthName(m.ms), income: m.inn, expenses: m.out }));
    const chartCard = `<div class="nw-card cal-chart"><div class="nw-ch"><span class="rp-si">${si(IC.trend, 22)}</span><h3>${esc(T("Cashflow Forecast"))}</h3><span class="rp-leg"><i style="background:#35D399"></i>${esc(T("Income"))} <i style="background:#3B82F6"></i>${esc(T("Expenses"))}</span></div>
      <div class="chips">${RANGES.map(n => `<button class="chip${n === range ? " on" : ""}" data-range="${n}">${esc(monthsLabel(n))}</button>`).join("")}</div>
      <div class="cal-chart-body">${trendMonths.length ? ovTrend(trendMonths) : ""}<div class="cal-chart-side"><div><small>${esc(T("Expected Income"))}</small><b class="good">${esc(pln(inSum))}</b></div><div><small>${esc(T("Expected Expenses"))}</small><b>${esc(pln(outSum + saveSum))}</b></div><div><small>${esc(T("Net Cashflow"))}</small><b class="${netCf < 0 ? "bad" : "good"}">${esc((netCf >= 0 ? "+" : "−") + pln(Math.abs(netCf)))}</b></div></div></div></div>`;
    const stripCard = h => h.slice(h.indexOf(">") + 1, h.lastIndexOf("</section>"));
    const suggMark = `<hr><h3>💡 ${esc(T("Suggestions from your expenses"))}</h3>`;
    let regInner = stripCard(regCard).replace(heading(T("Regular payments")), "");
    let suggHtml = "";
    const si2 = regInner.indexOf(suggMark);
    if (si2 >= 0) { suggHtml = `<details class="cal-fold"><summary>💡 ${esc(T("Suggestions from your expenses"))} (${sugg.length})</summary>${regInner.slice(si2 + suggMark.length)}</details>`; regInner = regInner.slice(0, si2); }
    const mergedReg = `<section class="card cal-reg-card"><div class="nw-ch"><span class="rp-si i-rep">${si(IC.repeat, 24)}</span><h3>${esc(T("Regular Payments"))}</h3></div><details class="cal-fold"${r ? " open data-edit" : ""}><summary>＋ ${esc(T("Add a regular payment"))}</summary>${stripCard(formCard)}</details><div class="cal-reg-list">${regInner}</div>${suggHtml}</section>`;
    el.innerHTML = calHead + `<div class="cal-top"><div class="cal-main">${calCard}</div><div class="cal-side">${evCard}</div></div>
    <div class="cal-mid">${chartCard}<div class="cal-reg">${mergedReg}</div></div>
    <div class="grid">
      ${monthsCard}
      ${binCard(["recurring"])}
    </div>` + calBand;

    el.querySelectorAll("details.cal-month").forEach(x => x.addEventListener("toggle", () => folded.set(+x.dataset.m, x.open)));
    el.querySelectorAll("[data-past]").forEach(b => b.onclick = () => { allPast = b.dataset.past === "1"; App.refresh(); });
    el.querySelectorAll("[data-range]").forEach(b => b.onclick = () => { range = +b.dataset.range; App.refresh(); });
    el.querySelectorAll("[data-month]").forEach(b => b.onclick = () => { shown = b.dataset.month === "now" ? start : addMonths(shown, +b.dataset.month); selectedDay = null; App.refresh(); });
    el.querySelectorAll("[data-day]").forEach(b => b.onclick = () => { selectedDay = +b.dataset.day === selectedDay ? null : +b.dataset.day; App.refresh(); });
    const fm = el.querySelector("#rec");
    fm.kind.onchange = () => { fm.category.disabled = fm.kind.value === "saving"; };
    fm.category.disabled = fm.kind.value === "saving";
    el.querySelector('[data-action="save-rec"]').onclick = () => {
      const v = values(fm), amt = num(v.amount);
      if (!v.name.trim() || !(amt > 0)) { toast(T("Please enter a name and an amount."), "bad"); return; }
      const item = { Name: v.name.trim(), Kind: v.kind, Category: v.kind === "saving" ? "" : v.category, Amount: amt, Frequency: v.frequency, Date: isoDate(parseDate(v.date)),
        EndDate: v.end ? isoDate(parseDate(v.end)) : null, Active: r ? r.Active !== false : true };
      if (r) Object.assign(r, item); else d.Recurring.push({ Id: uuid(), ...item });
      editId = null; save(); toast(T("Saved.")); App.refresh();
    };
    const c = el.querySelector('[data-action="cancel-rec"]'); if (c) c.onclick = () => { editId = null; App.refresh(); };
    el.querySelectorAll("[data-rep-exp]").forEach(c => c.onchange = () => {
      const e = d.Expenses.find(y => y.Id === c.dataset.repExp); setRepeat(d, e, ""); save(); toast(T("{0} no longer repeats.", e.Description || T(e.Category))); App.refresh();
    });
    el.querySelectorAll("[data-rep-rec]").forEach(c => c.onchange = () => {
      const r = d.Received.find(y => y.Id === c.dataset.repRec); setReceivedRepeat(d, r, ""); save(); toast(T("{0} no longer repeats.", r.Description || "–")); App.refresh();
    });
    el.querySelectorAll("[data-active-rec]").forEach(c => c.onchange = () => {
      const x = d.Recurring.find(y => y.Id === c.dataset.activeRec); x.Active = c.checked; save(); App.refresh();
    });
    el.querySelectorAll("[data-edit-rec]").forEach(x => x.onclick = ev => { if (ev.target.closest("[data-del-rec], .switch")) return; editId = x.dataset.editRec; App.refresh(); });
    el.querySelectorAll("[data-del-rec]").forEach(b => b.onclick = async () => {
      const x = d.Recurring.find(y => y.Id === b.dataset.delRec);
      if (await confirmBox(T("Delete?"), x.Name, T("Delete"), T("Cancel"), true)) { toBin("recurring", x); d.Recurring = d.Recurring.filter(y => y !== x); save(); App.refresh(); }
    });
    el.querySelectorAll("[data-sugg]").forEach(b => b.onclick = () => {
      const x = sugg[+b.dataset.sugg];
      const newest = d.Expenses.filter(e => e.Description === x.name).reduce((a, b) => parseDate(a.Date) > parseDate(b.Date) ? a : b);
      setRepeat(d, newest, "Monthly");
      save(); toast(T("Added: {0}.", x.name)); App.refresh();
    });
  },
};

const monthsLabel = n => monthsCount(n);
const ended = x => x.EndDate && parseDate(x.EndDate) < today();
function short(v) { return v >= 1000 ? (Math.round(v / 100) / 10).toString().replace(".", ",") + "k" : String(Math.round(v)); }
