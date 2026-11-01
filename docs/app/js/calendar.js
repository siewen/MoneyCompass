// Module "Payment calendar": everything that comes back regularly – income, fixed costs, transfers to savings,
// loan payments – in a month calendar and as a preview for 1, 3, 6 or 12 months.
import {
  T, State, save, Calc, pln, num, plain, fmtDate, parseDate, isoDate, inputDate, today, addDays, addMonths, monthStart, monthName,
  uuid, categories, categoryLabel, moduleOn, FREQUENCIES, ONE_TIME, locale, monthsCount, repeatingExpenses, setRepeat,
} from "./core.js";
import { esc, card, heading, hint, row, field, textInput, numInput, dateInput, select, button, values, confirmBox, toast } from "./ui.js";
import { App } from "./app.js";
import { binCard } from "./pages-main.js";
import { toBin } from "./core.js";

const D = () => State.data;
const KINDS = [["expense", "Payment"], ["saving", "Transfer to savings"]];
const RANGES = [1, 3, 6, 12];
let range = 3, shown = null, editId = null, selectedDay = null;

/** All payments between two dates: income, recurring payments, savings transfers and loans. */
export function events(d, from, to) {
  const list = [];
  for (const p of Calc.upcoming(d, from, to))
    list.push({ date: p.date, name: p.source.Name, amount: p.amount, type: "in", note: T(p.source.Type) });
  for (const r of (d.Recurring || []).filter(r => r.Active !== false)) {
    const amount = r.Amount || 0;
    const last = r.EndDate ? parseDate(r.EndDate) : null;
    let next = Calc.nextPayment(r, from), guard = 0;
    while (next && next <= to && (!last || next <= last) && guard++ < 400) {
      list.push({ date: next, name: r.Name, amount, type: r.Kind === "saving" ? "save" : "out", note: r.Kind === "saving" ? T("Transfer to savings") : T(r.Category || "Other"), id: r.Id });
      if (r.Frequency === ONE_TIME) break;
      next = Calc.nextPayment(r, addDays(next, 1));
    }
  }
  // My savings with a regular deposit (standing order)
  for (const h of d.Holdings.filter(h => h.Deposit > 0 && h.DepositDate)) {
    const rule = { Date: h.DepositDate, Frequency: h.DepositFrequency || "Monthly" };
    let next = Calc.nextPayment(rule, from), guard = 0;
    while (next && next <= to && guard++ < 400) {
      list.push({ date: next, name: h.Name, amount: h.Deposit, type: "save", note: T("My savings") + " · 🔁" + (h.DepositFrom ? " · " + T("from {0}", h.DepositFrom) : "") });
      next = Calc.nextPayment(rule, addDays(next, 1));
    }
  }
  // Expenses marked 🔁 in the Expenses tab: continued after their latest payment
  for (const e of repeatingExpenses(d)) {
    const lastPaid = parseDate(e.Date);
    let next = Calc.nextPayment({ Date: e.Date, Frequency: e.Repeat }, from), guard = 0;
    while (next && next <= to && guard++ < 400) {
      if (next > lastPaid) list.push({ date: next, name: e.Description || T(e.Category), amount: e.Amount, type: "out", note: T(e.Category) + " · 🔁", expense: e.Id });
      next = Calc.nextPayment({ Date: e.Date, Frequency: e.Repeat }, addDays(next, 1));
    }
  }
  if (moduleOn("loans"))
    for (const l of d.Loans.filter(l => l.Remaining > 0 && l.MonthlyPayment > 0)) {
      const end = parseDate(l.EndDate);
      let next = Calc.nextPayment({ Date: l.EndDate, Frequency: "Monthly" }, from), guard = 0;
      while (next && next <= to && next <= end && guard++ < 400) {
        list.push({ date: next, name: l.Name, amount: l.MonthlyPayment, type: "out", note: T("Loan payments") });
        next = Calc.nextPayment({ Date: l.EndDate, Frequency: "Monthly" }, addDays(next, 1));
      }
    }
  return list.sort((a, b) => a.date - b.date || (a.type === "in" ? -1 : 1));
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
  route: "calendar", title: "Payment calendar",
  render(el) {
    const d = D();
    if (!d.Recurring) d.Recurring = [];
    const start = monthStart(today());
    shown = shown || start;
    const end = addDays(addMonths(start, range), -1);
    const all = events(d, today(), end);
    const sums = t => all.filter(e => e.type === t).reduce((s, e) => s + e.amount, 0);
    const inSum = sums("in"), outSum = sums("out"), saveSum = sums("save");

    // ---------- Month calendar ----------
    const mEnd = addDays(addMonths(shown, 1), -1);
    const monthEvents = events(d, shown, mEnd);
    const firstDow = (shown.getDay() + 6) % 7;   // Monday first
    const days = mEnd.getDate();
    const dayNames = [...Array(7)].map((_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale(), { weekday: "short" }));
    let cells = "";
    for (let i = 0; i < firstDow; i++) cells += `<div class="cal-cell empty"></div>`;
    for (let day = 1; day <= days; day++) {
      const date = new Date(shown.getFullYear(), shown.getMonth(), day);
      const ev = monthEvents.filter(e => e.date.getDate() === day);
      const isToday = date.getTime() === today().getTime();
      const net = ev.reduce((s, e) => s + (e.type === "in" ? e.amount : -e.amount), 0);
      cells += `<button class="cal-cell${isToday ? " today" : ""}${ev.length ? " has" : ""}${selectedDay === day ? " sel" : ""}" data-day="${day}">
        <span class="cal-day">${day}</span>${ev.slice(0, 3).map(e => `<span class="cal-dot ${e.type}" title="${esc(e.name)}: ${esc(pln(e.amount))}"></span>`).join("")}
        ${ev.length ? `<span class="cal-net ${net >= 0 ? "good" : "bad"}">${net >= 0 ? "+" : "−"}${esc(short(Math.abs(net)))}</span>` : ""}</button>`;
    }
    const dayList = selectedDay ? monthEvents.filter(e => e.date.getDate() === selectedDay) : [];

    // ---------- Preview per month, with the running total ----------
    let running = 0;
    const months = [];
    for (let i = 0; i < range; i++) {
      const ms = addMonths(start, i), me = addDays(addMonths(ms, 1), -1);
      const ev = all.filter(e => e.date >= ms && e.date <= me);
      const inn = ev.filter(e => e.type === "in").reduce((s, e) => s + e.amount, 0);
      const out = ev.filter(e => e.type === "out").reduce((s, e) => s + e.amount, 0);
      const sav = ev.filter(e => e.type === "save").reduce((s, e) => s + e.amount, 0);
      running += inn - out - sav;
      months.push({ ms, ev, inn, out, sav, running });
    }

    const r = editId ? d.Recurring.find(x => x.Id === editId) : null;
    const f = r || { Name: "", Kind: "expense", Category: "Housing / rent", Amount: "", Frequency: "Monthly", Date: isoDate(today()), Active: true };
    const sugg = suggestions(d);
    const reps = repeatingExpenses(d);
    const deps = d.Holdings.filter(h => h.Deposit > 0 && h.DepositDate);
    const evRow = e => `<div class="item"><span class="cal-dot ${e.type}"></span><div><b>${esc(e.name)}</b><span class="hint">${fmtDate(e.date)} · ${esc(e.note)}</span></div>
      <b class="${e.type === "in" ? "good" : e.type === "save" ? "primary" : "bad"}">${e.type === "in" ? "+" : "−"}${pln(e.amount)}</b></div>`;

    el.innerHTML = `<div class="grid">
      ${card(heading(T("Next {0}", monthsLabel(range)), "📅") +
        `<div class="chips">${RANGES.map(n => `<button class="chip${n === range ? " on" : ""}" data-range="${n}">${esc(monthsLabel(n))}</button>`).join("")}</div>` +
        row(T("Money in"), `<span class="good">+${pln(inSum)}</span>`) + row(T("Payments"), `<span class="bad">−${pln(outSum)}</span>`) +
        row(T("To savings"), `<span class="primary">${pln(saveSum)}</span>`) + row(T("Left over"), pln(inSum - outSum - saveSum), "big" + (inSum - outSum - saveSum < 0 ? " bad" : " good")) +
        hint(T("From today to {0}: your income sources, the regular payments below and loan payments.", fmtDate(end))))}
      ${card(`<div class="cal-head"><button class="icon-btn" data-month="-1">◀</button><h3>${esc(monthName(shown))}</h3><button class="icon-btn" data-month="1">▶</button></div>
        <div class="cal-grid">${dayNames.map(n => `<div class="cal-dow">${esc(n)}</div>`).join("")}${cells}</div>
        <div class="cal-legend"><span><i class="cal-dot in"></i>${esc(T("Money in"))}</span><span><i class="cal-dot out"></i>${esc(T("Payments"))}</span><span><i class="cal-dot save"></i>${esc(T("To savings"))}</span></div>` +
        (selectedDay ? `<h3>${esc(fmtDate(new Date(shown.getFullYear(), shown.getMonth(), selectedDay)))}</h3>` + (dayList.length ? `<div class="list">${dayList.map(evRow).join("")}</div>` : hint(T("Nothing on this day."))) : hint(T("Click a day to see its payments."))))}
      ${card(`<form id="rec">${heading(r ? T("Edit: {0}", r.Name) : T("Add a regular payment"))}
        ${hint(T("Rent, bills, subscriptions, insurance, a standing order to your savings – anything that comes back. Your income comes from the Income tab."))}
        ${field(T("Name"), textInput("name", f.Name, T("e.g. {0}", "Netflix, czynsz, PZU")))}
        <div class="two">${field(T("Type"), select("kind", KINDS.map(k => [k[0], T(k[1])]), f.Kind))}${field(T("Amount (zł)"), numInput("amount", plain(f.Amount)))}</div>
        <div class="two">${field(T("Category"), select("category", categories().map(c => [c.Name, categoryLabel(c.Name)]), f.Category))}${field(T("How often"), select("frequency", FREQUENCIES.map(x => [x[0], T(x[0])]), f.Frequency))}</div>
        <div class="two">${field(T("Date of a payment (last or next one)"), dateInput("date", inputDate(parseDate(f.Date))))}
        ${field(T("Last payment (optional)"), `<input type="date" name="end" value="${f.EndDate ? inputDate(parseDate(f.EndDate)) : ""}">`)}</div>
        ${hint(T("For payments that stop, e.g. a loan or a contract: after the last payment it no longer counts. Or switch a payment off in the list below."))}
        <div class="buttons">${button(r ? T("Save changes") : T("Add"), "save-rec", "main")}${r ? button(T("Cancel"), "cancel-rec") : ""}</div></form>`)}
      ${card(heading(T("Regular payments")) + (deps.length ? `<h3 class="sub-h">🔁 ${esc(T("From My savings"))}</h3><div class="list">${deps.map(h => `
        <div class="item clickable" data-go="portfolio"><span class="cal-dot save"></span><div><b>${esc(h.Name)}</b>
        <span class="hint">${esc(T(h.DepositFrequency || "Monthly"))} · ${esc(T("Transfer to savings"))}${h.DepositFrom ? " · " + esc(T("from {0}", h.DepositFrom)) : ""} · ${esc(T("next {0}", fmtDate(Calc.nextPayment({ Date: h.DepositDate, Frequency: h.DepositFrequency || "Monthly" }, today()) || h.DepositDate)))}</span></div>
        <b class="primary">${pln(h.Deposit)}</b></div>`).join("")}</div><hr>` : "") + (reps.length ? `<h3 class="sub-h">🔁 ${esc(T("From your expenses"))}</h3><div class="list">${reps.map(e => `
        <div class="item"><span class="cal-dot out"></span><div><b>${esc(e.Description || T(e.Category))}</b>
        <span class="hint">${esc(T(e.Repeat))} · ${esc(T(e.Category))} · ${esc(T("next {0}", fmtDate(Calc.nextPayment({ Date: e.Date, Frequency: e.Repeat }, new Date(Math.max(today().getTime(), addDays(parseDate(e.Date), 1).getTime()))) || e.Date)))}</span></div>
        <b>${pln(e.Amount)}</b><label class="switch" title="${esc(T("Repeats"))}"><input type="checkbox" data-rep-exp="${e.Id}" checked><span></span></label></div>`).join("")}</div><hr>` : hint(T("Tip: mark an expense with 🔁 in the Expenses tab, and it appears here every month."))) + (d.Recurring.length ? `<div class="list">${d.Recurring.map(x => `
        <div class="item clickable${x.Active === false || ended(x) ? " off" : ""}" data-edit-rec="${x.Id}"><span class="cal-dot ${x.Kind === "saving" ? "save" : "out"}"></span><div><b>${esc(x.Name)}</b>
        <span class="hint">${esc(T(x.Frequency))} · ${esc(x.Kind === "saving" ? T("Transfer to savings") : T(x.Category))} · ${esc(x.Active === false ? T("switched off") : ended(x) ? T("ended {0}", fmtDate(x.EndDate)) : T("next {0}", fmtDate(Calc.nextPayment(x, today()) || x.Date)) + (x.EndDate ? " · " + T("last {0}", fmtDate(x.EndDate)) : ""))}</span></div>
        <b>${pln(x.Amount)}</b><label class="switch" title="${esc(T("Active (count it in the totals)"))}"><input type="checkbox" data-active-rec="${x.Id}"${x.Active !== false ? " checked" : ""}><span></span></label>
        <button class="icon-btn danger" data-del-rec="${x.Id}">🗑</button></div>`).join("")}</div>` + hint(T("Use the switch to stop counting a payment without deleting it.")) : (reps.length || deps.length ? "" : hint(T("No regular payments yet. Add your rent, bills and subscriptions above.")))) +
        (sugg.length ? `<hr><h3>💡 ${esc(T("Found in your expenses"))}</h3>${hint(T("These come back every month. Add them with one click."))}<div class="list">${sugg.map((x, i) => `
          <div class="item"><div><b>${esc(x.name)}</b><span class="hint">${esc(categoryLabel(x.category))} · ${esc(T("in {0} months", x.months))}</span></div><b>${pln(x.amount)}</b>
          <button class="btn second small" data-sugg="${i}">＋ ${esc(T("Add"))}</button></div>`).join("")}</div>` : ""))}
      ${card(heading(T("Month by month")) + months.map(m => `<div class="cal-month"><div class="cal-month-head"><b>${esc(monthName(m.ms))}</b>
        <span><span class="good">+${pln(m.inn)}</span> · <span class="bad">−${pln(m.out)}</span>${m.sav ? ` · <span class="primary">${pln(m.sav)}</span>` : ""} · <b class="${m.inn - m.out - m.sav >= 0 ? "good" : "bad"}">${pln(m.inn - m.out - m.sav)}</b></span></div>
        ${range <= 3 ? `<div class="list">${m.ev.map(evRow).join("") || hint(T("No payments expected in this period."))}</div>` : ""}</div>`).join("") +
        (range > 3 ? hint(T("Choose 1 or 3 months to see every payment.")) : "") +
        row(T("Together after {0}", monthsLabel(range)), pln(running), "big" + (running < 0 ? " bad" : " good")), "wide")}
      ${binCard(["recurring"])}
    </div>`;

    el.querySelectorAll("[data-range]").forEach(b => b.onclick = () => { range = +b.dataset.range; App.refresh(); });
    el.querySelectorAll("[data-month]").forEach(b => b.onclick = () => { shown = addMonths(shown, +b.dataset.month); selectedDay = null; App.refresh(); });
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
