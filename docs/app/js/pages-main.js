// The free tabs: Overview, Income, Expenses, Emergency fund, My savings.
import {
  T, State, save, Calc, Advisor, ChartData, COLORS, pln, rate, amount, num, plain, fmtDate, parseDate, isoDate, inputDate,
  today, addDays, monthStart, monthName, monthsCount, uuid, categories, findCategory, categoryLabel, categoryIcon,
  addCategory, removeCategory, ICON_CHOICES, OTHER, license, moduleOn, FREQUENCIES, ONE_TIME, RECEIVED, LOAN_CATEGORY, netFromGross,
} from "./core.js";
import { hbars, donut, legend, monthBars, progress } from "./charts.js";
import { esc, card, heading, hint, row, field, textInput, numInput, dateInput, select, check, button, values, popup, confirmBox, toast } from "./ui.js";
import { App, requirePro } from "./app.js";
import { Rates } from "./rates.js";

const D = () => State.data;
const tile = (label, value, route, colors, cls = "") =>
  `<button class="tile" data-go="${route}" style="--t1:${colors[0]};--t2:${colors[1]};--t3:${colors[2]};--t4:${colors[3]}">
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

    let emergency;
    if (target > 0) {
      const f = p.safe / target;
      const color = f >= 1 ? COLORS.leftOver : f >= 0.5 ? "#F59E0B" : "#DC2626";
      emergency = progress(f, color) + `<p class="${f >= 1 ? "good" : f >= 0.5 ? "warn" : "bad"}">${esc(T("{0} of {1} ({2}%)", pln(Math.min(p.safe, target)), pln(target), Math.round(Math.min(100, f * 100))))}</p>`;
    } else emergency = hint(T("Set your target in the Emergency fund tab."));

    const parts = [];
    parts.push(`<div class="tiles">
      ${tile(T("Income per month"), pln(income), "income", ["#1E5FB0", "#60A5FA", "#EAF2FC", "#2A78D6"])}
      ${tile(T("Spending per month"), avg.monthsUsed ? pln(spending) : "–", "expenses", ["#C2410C", "#FB923C", "#FDF0E9", "#EB6834"])}
      ${tile(T("Left over per month"), both ? pln(left) : "–", "income", ["#0E7C55", "#34D399", "#E7F7F0", "#1BAF7A"], both && left < 0 ? "bad" : "")}
      ${tile(T("Savings rate"), both ? Math.round(left / income * 100) + "%" : "–", "portfolio", ["#7E22CE", "#C084FC", "#F5EDFD", "#A855F7"])}
    </div>`);
    parts.push(`<button class="btn go big" data-action="optimize">⚡ ${esc(T("Optimize my savings"))}</button>`);
    if (top) parts.push(`<button class="tip" data-go="${top.route || ""}">💡 ${esc(T("Best next step: {0}", top.title))}${top.route ? "  →" : ""}</button>`);
    parts.push(`<button class="btn second" data-action="export">⬇ ${esc(T("Export report (Excel, PDF, Word)"))}</button>`);

    parts.push(card(heading(T("Money in and out (per month)")) +
      (ChartData.hasInOut(d) ? hbars(ChartData.inOut(d)) : hint(T("Add income and expenses to see this chart."))), "link\" data-go=\"income"));
    parts.push(card(heading(T("Last {0}", monthsCount(months.length))) + hint(T("Income from your current income sources, expenses as entered.")) +
      (showTrend ? monthBars(months, axis, pln, [T("Income"), T("Expenses")]) + legend([
        { color: COLORS.income, label: T("Income"), text: pln(months.reduce((s, m) => s + m.income, 0) / Math.max(1, months.length)) + " " + T("avg.") },
        { color: COLORS.expenses, label: T("Expenses"), text: pln(months.reduce((s, m) => s + m.expenses, 0) / Math.max(1, months.length)) + " " + T("avg.") },
      ]) : hint(T("Add income and expenses to see this chart."))), "link\" data-go=\"expenses"));
    parts.push(card(heading(T("Your expenses")) + hint(T("Average per month, last 3 months with expenses.")) +
      (cats.slices.length ? `<div class="chart-row">${donut(cats.slices, pln(cats.total), T("per month"))}${legend(cats.slices.map(s => ({ color: s.color, label: (s.icon ? s.icon + " " : "") + s.label, text: s.text, share: ChartData.share(s.value, cats.total) })))}</div>`
        : hint(T("Add expenses to see where your money goes."))), "link\" data-go=\"expenses"));
    parts.push(card(`<div class="link" data-go="portfolio">${heading(T("Your savings"))}${p.total > 0
        ? `<div class="chart-row">${donut(ChartData.money(p), pln(p.total), T("in total"))}${legend([...ChartData.money(p).map(s => ({ color: s.color, label: s.label, text: s.text, share: ChartData.share(s.value, p.total) })), { label: T("Interest per year"), text: pln(p.yearly) }])}</div>`
        : hint(T("Add your savings in the My savings tab to see this chart."))}</div>
      <hr><div class="link" data-go="emergency">${heading(T("Emergency fund"))}${emergency}</div>`));

    if (moduleOn("loans")) {
      const loans = d.Loans.filter(l => l.Remaining > 0).sort((a, b) => b.Remaining - a.Remaining);
      const total = loans.reduce((s, l) => s + l.Remaining, 0);
      const items = loans.map((l, i) => ({ label: l.Name, value: l.Remaining, color: COLORS.series[i % 6], text: pln(l.Remaining) }));
      parts.push(card(heading(T("Loans & debts")) + (loans.length
        ? `<div class="chart-row">${donut(items, pln(total), T("Still to pay back"))}${legend(items.map(s => ({ ...s, share: ChartData.share(s.value, total) })))}</div>` +
          row(T("Payments per month"), pln(Calc.loanPayments(d))) + row(T("Debt-free"), monthName(new Date(Math.max(...loans.map(l => parseDate(l.EndDate).getTime())))))
        : hint(T("No loans – great!"))), "link\" data-go=\"loans"));
    }
    if (moduleOn("goals")) {
      const goals = [...d.Goals].sort((a, b) => parseDate(a.TargetDate) - parseDate(b.TargetDate));
      parts.push(card(heading(T("Savings goals")) + (goals.length ? goals.map(g => {
        const f = g.Target > 0 ? g.Saved / g.Target : 0, done = g.Target > 0 && g.Saved >= g.Target;
        return `<div class="bar-item"><b>${esc(g.Name)}</b>${progress(f, done ? COLORS.leftOver : "var(--goals)")}<span class="hint">${esc(done ? T("Goal reached – well done!")
          : T("{0} of {1} ({2}%) · by {3}", pln(Math.min(g.Saved, g.Target)), pln(g.Target), Math.round(Math.min(100, f * 100)), fmtDate(g.TargetDate)))}</span></div>`;
      }).join("") : hint(T("Add your goals in the Savings goals tab to see them here."))), "link\" data-go=\"goals"));
    }
    if (moduleOn("budget")) parts.push(card(heading(T("Budget plan")) + hint(monthName(today())) + budgetBars(), "link\" data-go=\"budget"));
    if (license.isPro) {
      const ranked = d.Offers.map(o => ({ o, r: Calc.savings(o) })).filter(x => x.o.Amount > 0).sort((a, b) => b.r.net - a.r.net).slice(0, 4);
      const best = Rates.bestOffer();
      parts.push(card(heading(T("Compare offers")) + hint(T("Your saved offers: interest after the 19% tax.")) +
        (ranked.length ? hbars(ranked.map((x, i) => ({ label: x.o.Name.length > 20 ? x.o.Name.slice(0, 19) + "…" : x.o.Name, value: x.r.net, color: COLORS.series[i], text: `${pln(x.r.net)} · ${rate(x.r.effective)}` })))
          : hint(T("No offers saved yet. Add them in the Compare offers tab, or with the Compare button in Optimize my savings."))) +
        (best ? `<hr><p class="good">🏦 ${esc(T("Best rate right now: {0} – {1} ({2}).", best.Bank, best.Name || best.Bank, rate(best.Rate)))}</p>` : ""), "link\" data-go=\"savings"));
    }
    el.innerHTML = `<div class="grid">${parts.join("")}</div>`;
  },
};
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
  route: "income", title: "Income",
  render(el) {
    const d = D(), s = d.Settings;
    const inc = Calc.income(d), avg = Calc.spending(d);
    const spending = avg.essential + avg.nonEssential, left = inc.monthlyTotal - spending;
    const extra = Calc.receivedIn(d, today());
    let message;
    if (!inc.monthlyTotal) message = T("Add your income below to see how much is left each month.");
    else if (!avg.monthsUsed) message = T("Add expenses in the Expenses tab to see how much is left each month.");
    else if (left < 0) message = T("You spend more than you earn on average. Check the not-essential costs in the Expenses tab.");
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
      ${card(heading(T("Overview (in złoty)")) +
        row(T("Regular income per month"), pln(inc.monthlyTotal)) +
        row(T("Regular income per year"), pln(inc.monthlyTotal * 12)) +
        row(T("One-time income in {0}", today().getFullYear()), pln(inc.oneTimeThisYear)) +
        (extra > 0 ? row(T("Extra income received this month (bank import)"), pln(extra)) : "") +
        row(T("Average spending per month (Expenses tab)"), avg.monthsUsed ? pln(spending) : esc(T("no data yet"))) +
        row(T("Left over per month"), avg.monthsUsed ? pln(left) : "–", avg.monthsUsed && left < 0 ? "bad" : "good") +
        row(T("Savings rate"), avg.monthsUsed && inc.monthlyTotal > 0 ? Math.round(left / inc.monthlyTotal * 100) + "%" : "–") +
        hint(message) + (inc.missing ? hint(T("Some income is in USD or EUR but the exchange rate is empty, so it counts as 0 zł. Enter the rates in the My savings tab."), "bad") : ""))}
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
        ${field(f.Frequency === ONE_TIME ? T("Date the money arrives") : T("Payday - date of any payment (last or next one); the app repeats it"), dateInput("date", inputDate(parseDate(f.Date))))}</div>
        ${check("active", T("Active (count it in the totals)"), f.Active)}
        <div class="buttons">${button(e ? T("Save changes") : T("Add income"), "save-income", "main")}${e ? button(T("Cancel editing"), "cancel-income") : ""}</div></form>`)}
      ${card(heading(T("Next payments (next {0} days)", 60)) + (up.length ? `<div class="list">${up.slice(0, 20).map(p => `
          <div class="item"><div><b>${esc(p.source.Name)}</b><span class="hint">${fmtDate(p.date)} · ${esc(dayText(p.date))}</span></div><b class="good">${pln(p.amount)}</b></div>`).join("")}</div>`
        : hint(T("No payments expected in this period."))))}
      ${card(heading(T("Your income sources")) + hint(T("Tap a source to edit it. Switch off 'Active' for income that has stopped but you want to keep in the list.")) +
        (d.Incomes.length ? `<div class="list">${d.Incomes.map(i => {
          const next = Calc.nextPayment(i, today());
          const info = i.Frequency === ONE_TIME ? `${T("one-time")} · ${T("on {0}", fmtDate(i.Date))}` : `${T(i.Frequency)} · ${next ? T("next {0}", fmtDate(next)) : ""}`;
          return `<div class="item clickable${i.Active ? "" : " off"}" data-edit-income="${i.Id}"><div><b>${esc(i.Name)}</b><span class="hint">${esc(T(i.Type))} · ${esc(info)}${i.Active ? "" : " · " + esc(T("not active"))}</span></div>
            <div class="right"><b>${amount(i.Amount, i.Currency)}</b>${i.Frequency !== ONE_TIME ? `<span class="hint">${esc(T("{0} / month", pln(Calc.monthlyPln(i, s))))}</span>` : ""}${i.Gross > 0 ? `<span class="hint">${esc(T("gross {0}", pln(i.Gross)))}</span>` : ""}</div>
            <label class="switch" title="${esc(T("Active (count it in the totals)"))}"><input type="checkbox" data-active-income="${i.Id}"${i.Active ? " checked" : ""}><span></span></label>
            <button class="icon-btn danger" data-del-income="${i.Id}" title="${esc(T("Delete"))}">🗑</button></div>`;
        }).join("")}</div>` : hint(T("No income added yet."))))}
      ${card(heading(T("Received (bank import)")) + hint(T("Money that came into your account, from your bank imports. Choose for each payment how it counts: Extra income – only in that month. Salary – your regular pay, counted every month through Your income sources. Not income – ignored.")) +
        (d.Received.length ? `<div class="list">${[...d.Received].sort((a, b) => parseDate(b.Date) - parseDate(a.Date)).slice(0, 150).map(r => `
          <div class="item"><div><b>${esc(r.Description || "–")}</b><span class="hint">${fmtDate(r.Date)} · +${pln(r.Amount)}</span></div>
          ${select("kind-" + r.Id, KINDS.map(k => [k[0], T(k[1])]), r.Kind)}
          <button class="icon-btn danger" data-del-received="${r.Id}" title="${esc(T("Delete"))}">🗑</button></div>`).join("")}</div>`
          : hint(T("Nothing imported yet."))))}
    </div>`;

    const form = el.querySelector("#income-form");
    form.frequency.onchange = () => {
      const lbl = form.date.closest(".field").querySelector("span");
      lbl.textContent = form.frequency.value === ONE_TIME ? T("Date the money arrives") : T("Payday - date of any payment (last or next one); the app repeats it");
    };
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
        d.Incomes = d.Incomes.filter(x => x !== i); if (editIncome === i.Id) editIncome = null; save(); App.refresh();
      }
    });
    el.querySelectorAll('select[name^="kind-"]').forEach(sel => sel.onchange = async () => {
      const r = d.Received.find(x => x.Id === sel.name.slice(5));
      r.Kind = sel.value; save();
      if (r.Kind === RECEIVED.salary) await offerSalary(r);
      App.refresh();
    });
    el.querySelectorAll("[data-del-received]").forEach(b => b.onclick = async () => {
      if (await confirmBox(T("Delete?"), T("Remove this received payment from MoneyCompass?"), T("Delete"), T("Cancel"), true)) {
        d.Received = d.Received.filter(x => x.Id !== b.dataset.delReceived); save(); App.refresh();
      }
    });
  },
};
function saveIncome(form) {
  const v = values(form), d = D();
  const amt = num(v.amount);
  if (!(amt > 0)) { toast(T("Please enter an amount bigger than 0."), "bad"); return; }
  const date = v.date ? isoDate(parseDate(v.date)) : isoDate(today());
  const name = v.name.trim() || T(v.type);
  if (editIncome) {
    Object.assign(d.Incomes.find(x => x.Id === editIncome), { Name: name, Type: v.type, Amount: amt, Currency: v.currency, Frequency: v.frequency, Date: date, Active: v.active, Gross: num(v.gross) || 0 });
    toast(T("Updated: {0}.", name)); editIncome = null;
  } else {
    d.Incomes.push({ Id: uuid(), Name: name, Type: v.type, Amount: amt, Currency: v.currency, Frequency: v.frequency, Date: date, Active: v.active, Gross: num(v.gross) || 0 });
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
export const Expenses = {
  route: "expenses", title: "Expenses",
  render(el) {
    const d = D();
    const avg = Calc.spending(d);
    const cats = ChartData.categories(d);
    const cat0 = categories()[0];
    const months = [];
    const sorted = [...d.Expenses].sort((a, b) => parseDate(b.Date) - parseDate(a.Date));
    for (const e of sorted) {
      const m = monthStart(parseDate(e.Date)), last = months[months.length - 1];
      if (!last || last.start.getTime() !== m.getTime()) months.push({ start: m, items: [e] }); else last.items.push(e);
    }
    const visible = showAllMonths ? months : months.slice(0, 3);
    const older = months.slice(3).reduce((s, m) => s + m.items.length, 0);
    const loans = Calc.loanPayments(d);

    el.innerHTML = `<div class="grid">
      ${card(`<form id="expense-form">${heading(T("Add an expense"))}
        <div class="two">${field(T("Date"), dateInput("date", inputDate(today())))}${field(T("Amount (zł)"), numInput("amount", "", T("e.g. {0}", "120,50")))}</div>
        <div class="cat-row">${field(T("Category"), select("category", categories().map(c => [c.Name, categoryLabel(c.Name)]), cat0.Name))}
          ${button(T("Categories…"), "categories", "second small")}</div>
        ${field(T("Description (optional)"), textInput("description", "", T("e.g. {0}", "Biedronka")))}
        ${check("essential", T("Essential (must pay even in a crisis)"), cat0.Essential)}
        <div class="buttons">${button(T("Add expense"), "add-expense", "main")}${button("⬆ " + esc(T("Import from your bank (CSV)…")), "import", "second")}</div></form>`)}
      ${card(heading(T("Monthly average")) + (avg.monthsUsed ? row(T("Essential"), pln(avg.essential)) + row(T("Not essential"), pln(avg.nonEssential)) + row(T("Total per month"), pln(avg.essential + avg.nonEssential)) +
          hint(T("Based on the last {0} month(s) with expenses: {1}. For accurate numbers, enter whole months. The current month is counted even if it's not finished.", Calc.averages(Calc.countedExpenses(d)).monthsUsed, Calc.averages(Calc.countedExpenses(d)).label)) +
          (loans > 0 ? hint(T("Includes {0} per month of loan payments from the Loans & debts tab. Expenses in the \"Loan payments\" category are not counted, so nothing is counted twice.", pln(loans))) : "")
        : hint(T("Add expenses to see your averages."))))}
      ${card(heading(T("By category")) + hint(T("Average per month, last 3 months with expenses.")) + (cats.all.length
        ? `<div class="chart-row">${donut(cats.slices, pln(cats.total), T("per month"))}${legend(cats.all.map((c, n) => ({
            key: c.category, color: n < 6 ? COLORS.series[n] : COLORS.other, label: categoryLabel(c.category), text: pln(c.perMonth), share: ChartData.share(c.perMonth, cats.total) })))}</div>` + hint(T("Click to see these expenses"))
        : hint(T("Add expenses to see where your money goes."))))}
      ${card(heading(T("Your expenses")) + hint(T("Click an expense to switch it between essential and not essential. The pen changes date, category, amount and more.")) +
        (months.length ? visible.map(m => {
          const total = m.items.reduce((s, e) => s + e.Amount, 0), ess = m.items.filter(e => e.Essential).reduce((s, e) => s + e.Amount, 0);
          return `<div class="month-head">${esc(T("{0}  ·  total {1}  ·  essential {2}", monthName(m.start), pln(total), pln(ess)))}</div><div class="list">${m.items.map(expenseRow).join("")}</div>`;
        }).join("") + (!showAllMonths && older ? button(T("Show older expenses ({0})", older), "older", "second") : "")
          : hint(T("No expenses yet."))), "wide")}
    </div>`;

    const form = el.querySelector("#expense-form");
    form.category.onchange = () => { form.essential.checked = !!findCategory(form.category.value)?.Essential; };
    el.querySelector('[data-action="add-expense"]').onclick = () => {
      const v = values(form), amt = num(v.amount);
      if (!(amt > 0)) { toast(T("Please enter an amount bigger than 0."), "bad"); return; }
      d.Expenses.push({ Id: uuid(), Date: isoDate(v.date ? parseDate(v.date) : today()), Description: v.description.trim(), Category: v.category, Amount: amt, Essential: v.essential });
      save(); toast(T("Added: {0}, {1}.", T(v.category), pln(amt))); App.refresh();
    };
    el.querySelector('[data-action="categories"]').onclick = () => manageCategories();
    el.querySelector('[data-action="import"]').onclick = () => App.openBankImport();
    const olderBtn = el.querySelector('[data-action="older"]');
    if (olderBtn) olderBtn.onclick = () => { showAllMonths = true; App.refresh(); };
    el.querySelectorAll(".legend-row[data-cat]").forEach(r => r.onclick = () => showCategory(r.dataset.cat));
    bindExpenseRows(el);
  },
};
function expenseRow(e) {
  const icon = categoryIcon(e.Category);
  return `<div class="item expense" data-id="${e.Id}">
    <div class="toggle" data-toggle="${e.Id}" title="${esc(T("Click to switch between essential and not essential"))}"><b>${esc(e.Description || T(e.Category))}</b>
      <span class="hint">${fmtDate(e.Date)} · ${esc((icon ? icon + " " : "") + T(e.Category))} · <span class="${e.Essential ? "ess" : "noness"}">${esc(e.Essential ? T("Essential") : T("Not essential"))}</span></span></div>
    <b>${pln(e.Amount)}</b>
    <button class="icon-btn" data-edit="${e.Id}" title="${esc(T("Change"))}">✎</button>
    <button class="icon-btn danger" data-del="${e.Id}" title="${esc(T("Delete"))}">🗑</button></div>`;
}
function bindExpenseRows(root, after = () => App.refresh()) {
  const d = D();
  root.querySelectorAll("[data-toggle]").forEach(x => x.onclick = () => {
    const e = d.Expenses.find(y => y.Id === x.dataset.toggle); e.Essential = !e.Essential; save(); after();
  });
  root.querySelectorAll("[data-edit]").forEach(x => x.onclick = () => editExpense(d.Expenses.find(y => y.Id === x.dataset.edit), after));
  root.querySelectorAll("[data-del]").forEach(x => x.onclick = async () => {
    const e = d.Expenses.find(y => y.Id === x.dataset.del);
    if (await confirmBox(T("Delete?"), `${e.Description || T(e.Category)} · ${pln(e.Amount)}`, T("Delete"), T("Cancel"), true)) {
      d.Expenses = d.Expenses.filter(y => y !== e); save(); after();
    }
  });
}
function editExpense(e, after) {
  const p = popup(`<h2 class="popup-title">${esc(T("Change expense"))}</h2><form>
    <div class="two">${field(T("Date"), dateInput("date", inputDate(parseDate(e.Date))))}${field(T("Amount (zł)"), numInput("amount", plain(e.Amount)))}</div>
    ${field(T("Category"), select("category", categories().map(c => [c.Name, categoryLabel(c.Name)]), e.Category))}
    ${field(T("Description"), textInput("description", e.Description))}
    ${check("essential", T("Essential (must pay even in a crisis)"), e.Essential)}</form>
    <div class="popup-buttons"><button class="btn second" data-close>${esc(T("Cancel"))}</button><button class="btn main" data-save>${esc(T("Save"))}</button></div>`, { width: 520 });
  p.el.querySelector("[data-save]").onclick = () => {
    const v = values(p.el), amt = num(v.amount);
    if (!(amt > 0)) { toast(T("Please enter an amount bigger than 0."), "bad"); return; }
    Object.assign(e, { Date: isoDate(parseDate(v.date)), Amount: amt, Category: v.category, Description: v.description.trim(), Essential: v.essential });
    save(); p.close(); after();
  };
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
    else if (!d.Holdings.length) status = hint(T("Add your safe savings in the My savings tab to see how much of this target you already have."));
    else if (safe >= r.target) status = `<p class="good">${esc(T("Your safe money ({0}) fully covers this target.", pln(safe)))}</p>`;
    else status = progress(safe / r.target, safe / r.target >= 0.5 ? "#F59E0B" : "#DC2626") + `<p class="warn">${esc(T("Your safe money ({0}) covers {1}% of this target. Still missing: {2}.", pln(safe), Math.round(safe / r.target * 100), pln(r.target - safe)))}</p>`;
    el.innerHTML = `<div class="grid">
      ${card(`<form id="em">${heading(T("Your monthly costs"))}${hint(T("Only costs you must pay even in a crisis: rent, bills, food, transport, insurance, loan payments."))}
        ${field(T("Essential costs per month (zł)"), numInput("monthly", plain(s.MonthlyEssentials), T("e.g. {0}", "4500")))}
        ${button(T("Use my average from the Expenses tab"), "use-avg", "second small")}<p class="hint" id="avg-note"></p>
        ${field(T("Yearly costs (zł per year) - car insurance, car service, home insurance, yearly subscriptions"), numInput("yearly", plain(s.YearlyCosts), T("e.g. {0}", "3000")))}
        <h3>${esc(T("Settings"))}</h3>
        <div class="two">${field(T("Months to cover (3 if your job is stable, 6 if less certain)"), select("months", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], s.EmergencyMonths))}
        ${field(T("Extra safety buffer (%)"), numInput("buffer", plain(s.BufferPercent)))}</div></form>`)}
      ${card(heading(T("Result")) + row(T("Monthly need (incl. yearly costs / 12)"), pln(r.monthly)) + row(T("3 months (with buffer)"), pln(r.three)) +
        row(T("6 months (with buffer)"), pln(r.six)) + row(T("Your target"), pln(r.target), "big") + status)}
      ${card(heading(T("Where to keep it")) + `<p>${esc(T("In a Polish bank savings account, in złoty: protected by the BFG up to €100,000 and available the same day. Not in crypto, and not in a long fixed deposit (lokata), because breaking it early usually loses the interest."))}</p>`)}
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
      if (!a.monthsUsed) { el.querySelector("#avg-note").textContent = T("No expenses yet. Add them in the Expenses tab first."); return; }
      s.MonthlyEssentials = Math.round(a.essential * 100) / 100; save(); App.refresh();
      toast(T("Average of your essential costs in {0}.", a.label));
    };
  },
};

// ================================================================= My savings

const PLACES = ["Bank", "Crypto platform", "Broker", "Cash", "Other"];
let editHolding = null;
export const Portfolio = {
  route: "portfolio", title: "My savings",
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
      ${card(heading(T("Overview (in złoty)")) + row(T("Total"), pln(p.total), "big") + row(T("Safe money (bank, cash)"), pln(p.safe)) +
        row(T("Risky money (crypto platforms, investments)"), pln(p.risky)) + row(T("Interest per year"), pln(p.yearly)) +
        row(T("Interest per month"), pln(p.yearly / 12)) + row(T("Interest per day"), pln(p.yearly / 365)) +
        hint(T("Interest is before tax and assumes today's rates stay the same.")) + hint(em) +
        (p.missing ? hint(T("Some items are in USD or EUR but the exchange rate is empty, so they count as 0 zł. Enter the rates below."), "bad") : ""))}
      ${card(`<form id="hold">${heading(h ? T("Edit: {0}", h.Name) : T("Add money"))}
        ${field(T("Name"), textInput("name", f.Name, T("e.g. {0}", "ING, Revolut, …")))}
        <div class="two">${field(T("Where"), select("place", PLACES.map(x => [x, T(x)]), f.Place))}${field(T("Currency"), select("currency", CURRENCIES, f.Currency))}</div>
        <div class="two">${field(T("Amount"), numInput("amount", plain(f.Amount), T("e.g. {0}", "10000")))}${field(T("Interest rate (% per year, 0 if none)"), numInput("rate", plain(f.RatePercent), "0"))}</div>
        ${check("safe", T("Safe money (guaranteed, e.g. bank)"), f.Safe)}
        <div class="buttons">${button(h ? T("Save changes") : T("Add"), "save-holding", "main")}${h ? button(T("Cancel editing"), "cancel-holding") : ""}</div></form>`)}
      ${card(heading(T("Your savings")) + hint(T("Tap an item to edit it, for example to update the amount.")) + (d.Holdings.length ? `<div class="list">${d.Holdings.map(x => `
        <div class="item clickable" data-edit-holding="${x.Id}"><div><b>${esc(x.Name)}</b><span class="hint">${esc(T(x.Place))} · ${esc(x.Safe ? T("Safe") : T("Risky"))} · ${rate(x.RatePercent || 0)}</span></div>
        <div class="right"><b>${amount(x.Amount, x.Currency)}</b>${x.RatePercent ? `<span class="hint">${esc(T("{0} / year", pln(Calc.toPln(x.Amount, x.Currency, s) * x.RatePercent / 100)))}</span>` : ""}</div>
        <button class="icon-btn danger" data-del-holding="${x.Id}">🗑</button></div>`).join("")}</div>` : hint(T("Nothing added yet."))))}
      ${card(`<form id="fx">${heading(T("Exchange rates"))}${hint(T("Used to convert dollars and euros to złoty."))}
        ${check("auto", T("Update automatically with the official NBP rates"), s.AutoExchangeRates)}
        <div class="two">${field("1 USD = … zł", numInput("usd", plain(s.UsdToPln)))}${field("1 EUR = … zł", numInput("eur", plain(s.EurToPln)))}</div>${hint(rateInfo)}</form>`)}
    </div>`;
    const form = el.querySelector("#hold");
    const saveIt = () => {
      const v = values(form), amt = num(v.amount);
      if (!(amt > 0)) { toast(T("Please enter an amount bigger than 0."), "bad"); return; }
      const item = { Name: v.name.trim() || T(v.place), Place: v.place, Amount: amt, Currency: v.currency, RatePercent: num(v.rate) || 0, Safe: v.safe };
      if (h) { Object.assign(h, item); toast(T("Updated: {0}.", item.Name)); editHolding = null; }
      else { d.Holdings.push({ Id: uuid(), ...item }); toast(T("Added: {0}.", item.Name)); }
      save(); App.refresh();
    };
    form.place.onchange = () => { form.safe.checked = ["Bank", "Cash"].includes(form.place.value); };
    el.querySelector('[data-action="save-holding"]').onclick = saveIt;
    const c = el.querySelector('[data-action="cancel-holding"]'); if (c) c.onclick = () => { editHolding = null; App.refresh(); };
    el.querySelectorAll("[data-edit-holding]").forEach(x => x.onclick = ev => { if (ev.target.closest("[data-del-holding]")) return; editHolding = x.dataset.editHolding; App.refresh(); window.scrollTo({ top: 0, behavior: "smooth" }); });
    el.querySelectorAll("[data-del-holding]").forEach(b => b.onclick = async () => {
      const x = d.Holdings.find(y => y.Id === b.dataset.delHolding);
      if (await confirmBox(T("Delete?"), x.Name, T("Delete"), T("Cancel"), true)) { d.Holdings = d.Holdings.filter(y => y !== x); save(); App.refresh(); }
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
