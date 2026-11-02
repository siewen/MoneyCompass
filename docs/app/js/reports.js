// Reports tab: choose the period and what to include, see the key figures, export to Excel, PDF or Word.
import {
  T, State, save, Calc, Advisor, ChartData, pln, rate, fmtDate, parseDate, monthName, monthStart, addMonths, addDays, today, isoDate,
  ONE_TIME, RECEIVED, currentName, savingsRateText, goalSaved, moduleOn, license, categoryIcon,
} from "./core.js";
import { esc, card, heading, hint, row, button, toast, alertBox, download, stamp } from "./ui.js";
import { App, windowsOrPro } from "./app.js";

const D = () => State.data;
const round = v => Math.round(v * 100) / 100;
const PERIODS = [["thisMonth", "This month"], ["lastMonth", "Last month"], ["last3", "Last 3 months"], ["last12", "Last 12 months"], ["thisYear", "This year"], ["all", "Everything"], ["custom", "Own dates"]];
const opts = () => {
  const s = D().Settings;
  s.Report = Object.assign({ period: "last3", from: "", to: "", skip: [] }, s.Report || {});
  return s.Report;
};

/** The chosen period: { from, to } as dates (to = end of that day). */
export function reportRange(o = opts()) {
  const t = today(), m0 = monthStart(t), end = d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  switch (o.period) {
    case "thisMonth": return { from: m0, to: end(t) };
    case "lastMonth": return { from: addMonths(m0, -1), to: end(addDays(m0, -1)) };
    case "last12": return { from: addMonths(m0, -11), to: end(t) };
    case "thisYear": return { from: new Date(t.getFullYear(), 0, 1), to: end(t) };
    case "all": { const f = ChartData.firstDate(D()); return { from: f ? monthStart(f) : m0, to: end(t) }; }
    case "custom": { const f = o.from ? parseDate(o.from) : addMonths(m0, -2), e = o.to ? parseDate(o.to) : t; return { from: f, to: end(e < f ? f : e) }; }
    default: return { from: addMonths(m0, -2), to: end(t) };
  }
}
const inRange = (x, r) => { const d = parseDate(x); return d && d >= r.from && d <= r.to; };

/** Every part of the report for the period: [key, title, rows (first row = column names)]; null when there is nothing for it. */
export function reportSections(r = reportRange()) {
  const d = D(), s = d.Settings;
  const months = ChartData.trend(d).filter(m => m.start >= monthStart(r.from) && m.start <= r.to);
  const inflow = months.reduce((a, m) => a + m.income, 0), outflow = months.reduce((a, m) => a + m.expenses, 0), n = Math.max(1, months.length);
  const p = Calc.portfolio(d), em = Calc.emergency(s);
  const summary = [[T("Item"), T("Value")],
    [T("Period"), `${fmtDate(r.from)} – ${fmtDate(r.to)} (${months.length} ${T("months")})`],
    [T("Inflows in this period"), round(inflow)], [T("Outflows in this period"), round(outflow)], [T("Balance"), round(inflow - outflow)],
    [T("Inflows per month (average)"), round(inflow / n)], [T("Outflows per month (average)"), round(outflow / n)],
    [T("Savings rate"), inflow > 0 ? savingsRateText(inflow - outflow, inflow) : "–"],
    [T("Savings today"), round(p.total)], [T("Secure savings (bank, cash)"), round(p.safe)], [T("Investments at risk (crypto, securities)"), round(p.risky)],
    [T("Emergency fund covered"), em.target > 0 ? Math.round(Math.min(1, p.safe / em.target) * 100) + "%" : "–"]];
  const monthly = [[T("Month"), T("Inflows"), T("Outflows"), T("Balance")], ...months.map(m => [monthName(m.start), round(m.income), round(m.expenses), round(m.income - m.expenses)])];
  const exp = d.Expenses.filter(e => inRange(e.Date, r)).sort((a, b) => parseDate(b.Date) - parseDate(a.Date));
  const byCat = new Map(); for (const e of exp) byCat.set(e.Category, (byCat.get(e.Category) || 0) + e.Amount);
  const catTotal = [...byCat.values()].reduce((a, b) => a + b, 0);
  const cats = [[T("Category"), T("Total"), T("Per month"), T("Share")], ...[...byCat.entries()].sort((a, b) => b[1] - a[1])
    .map(([c, v]) => [(categoryIcon(c) ? categoryIcon(c) + " " : "") + T(c), round(v), round(v / n), catTotal ? Math.round(v / catTotal * 100) + "%" : "–"])];
  const expenses = [[T("Date"), T("Category"), T("Description"), T("Amount (zł)"), T("Essential")], ...exp.map(e => [fmtDate(e.Date), T(e.Category), e.Description || "", e.Amount, e.Essential ? T("Yes") : T("No")])];
  const kindName = k => k === RECEIVED.salary ? T("Salary (regular pay)") : k === RECEIVED.none ? T("Not income") : T("Extra income (this month)");
  const rec = d.Received.filter(x => inRange(x.Date, r)).sort((a, b) => parseDate(b.Date) - parseDate(a.Date));
  const received = [[T("Date"), T("Description"), T("Counts as"), T("Amount (zł)")], ...rec.map(x => [fmtDate(x.Date), x.Description || "", kindName(x.Kind), x.Amount])];
  const tr = (d.Transfers || []).filter(t => t.Amount > 0 && !t.Back && inRange(t.Date, r)).sort((a, b) => parseDate(b.Date) - parseDate(a.Date));
  const transfers = [[T("Date"), T("Description"), T("Amount (zł)")], ...tr.map(t => [fmtDate(t.Date), t.Description || "", t.Amount])];
  const income = [[T("Name"), T("Type"), T("How often"), T("Per month (zł)"), T("Active")], ...d.Incomes.map(i => [i.Name, T(i.Type), T(i.Frequency), i.Frequency === ONE_TIME ? T("one-time") : round(Calc.monthlyPln(i, s)), i.Active ? T("Yes") : T("No")])];
  const holdings = [[T("Name"), T("Where"), T("In złoty"), T("Interest rate"), T("Safe")], ...d.Holdings.map(h => [h.Name, T(h.Place), round(Calc.toPln(h.Amount, h.Currency, s)), (h.RatePercent || 0) + "%", h.Safe ? T("Yes") : T("No")])];
  const checks = [[T("Statement"), T("Period"), T("Closing balance"), T("Gross interest"), T("Withholding tax (Belka, 19%)"), T("Fees & charges"), T("Net rate p.a. (after tax and fees)")],
    ...(d.SavingsChecks || []).map(c => [c.Name, `${fmtDate(c.From)} – ${fmtDate(c.To)}`, c.Closing, c.Interest, c.Tax, c.Fees, rate(c.Net)])];
  const offers = [[T("Name"), T("Real yearly rate after tax"), T("You keep")], ...d.Offers.map(o => ({ o, x: Calc.savings(o) })).sort((a, b) => b.x.net - a.x.net).map(({ o, x }) => [o.Name, rate(x.effective || 0), round(x.net)])];
  const loans = [[T("Name"), T("Remaining"), T("Monthly payment"), T("Interest rate")], ...d.Loans.map(l => [l.Name, round(l.Remaining || 0), round(l.MonthlyPayment || 0), (l.RatePercent || 0) + "%"])];
  const budget = [[T("Category"), T("Limit per month (zł)")], ...d.Budgets.filter(b => b.MonthlyLimit > 0).map(b => [T(b.Category), b.MonthlyLimit])];
  const goals = [[T("Goal"), T("Goal amount (zł)"), T("Already saved"), T("Reach it by")], ...d.Goals.map(g => [g.Name, g.Target, round(goalSaved(g, d)), fmtDate(g.TargetDate)])];
  const plan = [[T("Step"), T("Details"), T("Worth per year")], ...Advisor.analyse(d).map(a => [a.title, a.text, a.benefit > 0 ? round(a.benefit) : ""])];
  return [
    ["summary", T("Summary"), summary], ["monthly", T("Monthly totals"), monthly], ["categories", T("Outflows by category"), cats],
    ["expenses", T("All outflows"), expenses], ["received", T("Imported inflows"), received], ["transfers", T("Moved to your own accounts"), transfers],
    ["income", T("Your income sources"), income], ["savings", T("Accounts & holdings"), holdings], ["checks", T("Statement analyses"), checks],
    ["offers", T("Compare offers"), offers],
    ...(moduleOn("loans") ? [["loans", T("Loans & debts"), loans]] : []),
    ...(moduleOn("budget") ? [["budget", T("Budget plan"), budget], ["goals", T("Savings goals"), goals]] : []),
    ["plan", T("Your personal plan"), plan],
  ];
}
const chosen = () => { const o = opts(); return reportSections().filter(([k, , rows]) => !o.skip.includes(k) && rows.length > 1); };

// ---------- files ----------
function reportHtml(forWord = false) {
  const r = reportRange(), parts = chosen();
  const table = rows => `<table><tr>${rows[0].map(h => `<th>${esc(h)}</th>`).join("")}</tr>${rows.slice(1).map(x => `<tr>${x.map(c => `<td>${esc(typeof c === "number" ? pln(c) : c)}</td>`).join("")}</tr>`).join("")}</table>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(T("MoneyCompass report"))}</title><style>
    body{font-family:Segoe UI,Arial,sans-serif;color:#111827;margin:24px}h1{color:#0F766E;margin:0}h2{color:#0F766E;margin-top:28px;font-size:18px}
    table{border-collapse:collapse;width:100%;font-size:12px;margin-top:6px}th{background:#0F766E;color:#fff;text-align:left;padding:5px}td{border-bottom:1px solid #E5E7EB;padding:5px;vertical-align:top}
    .muted{color:#6B7280;font-size:12px}${forWord ? "" : "@media print{h2{break-after:avoid}table{break-inside:auto}tr{break-inside:avoid}}"}</style></head><body>
    <h1>${esc(T("MoneyCompass report"))}</h1><p class="muted">${esc(T("Created on {0}", fmtDate(new Date())))} · ${esc(currentName())} · ${esc(fmtDate(r.from) + " – " + fmtDate(r.to))}</p>
    ${parts.map(([, title, rows]) => `<h2>${esc(title)}</h2>${table(rows)}`).join("")}
    <p class="muted">${esc(T("These suggestions are calculated from what you entered and are estimates. They are not financial, investment or tax advice."))}</p></body></html>`;
}
function printReport() {
  const w = window.open("", "_blank");
  if (!w) { alertBox(T("Export report"), T("Please allow pop-up windows for this page.")); return false; }
  w.document.write(reportHtml()); w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
  return true;
}
async function exportExcel() {
  if (!window.XLSX) await new Promise((res, rej) => {
    const sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    sc.onload = res; sc.onerror = () => rej(new Error("Excel library could not be loaded.")); document.head.appendChild(sc);
  });
  const X = window.XLSX, wb = X.utils.book_new(), used = new Set();
  for (const [, title, rows] of chosen()) {
    let name = title.replace(/[\\/?*[\]:]/g, "").slice(0, 31); while (used.has(name)) name = name.slice(0, 29) + "2"; used.add(name);
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(rows), name);
  }
  X.writeFile(wb, `MoneyCompass-report-${stamp()}.xlsx`);
}
async function exportAs(f) {
  if (!(await windowsOrPro(T("Export report")))) return;
  if (!chosen().length) { toast(T("Choose at least one part of the report."), "bad"); return; }
  try {
    if (f === "xlsx") await exportExcel();
    else if (f === "pdf") { if (!printReport()) return; }
    else download(`MoneyCompass-report-${stamp()}.doc`, "﻿" + reportHtml(true), "application/msword");
    toast(T("Report saved"));
  } catch (e) { alertBox(T("Export report"), T("The report could not be created.") + "\n" + e.message); }
}

// ---------- the tab ----------
export const Reports = {
  route: "reports", title: "Reports",
  render(el) {
    const o = opts(), r = reportRange(o), all = reportSections(r), lock = license.isPro ? "" : " 🔒";
    const sum = all.find(x => x[0] === "summary")[2];
    const val = label => sum.find(x => x[0] === label)?.[1];
    const fig = (label, v, cls = "") => `<div><span>${esc(label)}</span><b class="${cls}">${esc(typeof v === "number" ? pln(v) : v ?? "–")}</b></div>`;
    const bal = val(T("Balance"));
    el.innerHTML = `<div class="grid">
      ${card(heading(T("Period"), "📅") +
        `<div class="chips">${PERIODS.map(([k, l]) => `<button class="chip${o.period === k ? " on" : ""}" data-period="${k}">${esc(T(l))}</button>`).join("")}</div>` +
        (o.period === "custom" ? `<div class="two"><label class="field"><span>${esc(T("From"))}</span><input type="date" name="rfrom" value="${isoDate(r.from).slice(0, 10)}"></label>
          <label class="field"><span>${esc(T("To"))}</span><input type="date" name="rto" value="${isoDate(r.to).slice(0, 10)}"></label></div>` : "") +
        `<p class="period-line">${esc(fmtDate(r.from))} – ${esc(fmtDate(r.to))}</p>` +
        `<div class="sav-figures rep-figures">${fig(T("Inflows"), val(T("Inflows in this period")), "good")}${fig(T("Outflows"), val(T("Outflows in this period")))}
          ${fig(T("Balance"), bal, bal < 0 ? "bad" : "good")}${fig(T("Savings rate"), val(T("Savings rate")))}${fig(T("Savings today"), val(T("Savings today")))}</div>`)}
      ${card(heading(T("What to include"), "☑️") + hint(T("Tick the parts you want in the report. The number shows how many lines each part has for this period.")) +
        `<div class="rep-parts">${all.map(([k, title, rows]) => { const n = rows.length - 1, empty = n < 1;
          return `<label class="check${empty ? " off" : ""}"><input type="checkbox" data-part="${k}"${!o.skip.includes(k) && !empty ? " checked" : ""}${empty ? " disabled" : ""}><span><em>${esc(title)}</em><small class="hint">${empty ? "–" : n}</small></span></label>`; }).join("")}</div>` +
        `<div class="buttons"><button class="btn second small" data-all="1">${esc(T("All"))}</button><button class="btn second small" data-all="0">${esc(T("None"))}</button></div>`)}
      ${card(heading(T("Export"), "⬇") + hint(T("Each export is a new file with date and time, so older reports are kept.")) +
        `<div class="buttons col rep-export">
          <button class="btn second" data-f="xlsx"><b>📊 ${esc(T("Excel (.xlsx)"))}${lock}</b><br><span class="hint">${esc(T("Every part on its own sheet, with real numbers you can calculate with."))}</span></button>
          <button class="btn second" data-f="pdf"><b>🖨️ ${esc(T("PDF"))}${lock}</b><br><span class="hint">${esc(T("Opens the print window: choose \"Save as PDF\"."))}</span></button>
          <button class="btn second" data-f="doc"><b>📝 ${esc(T("Word (.docx)").replace(".docx", ".doc"))}${lock}</b><br><span class="hint">${esc(T("A document you can still edit, add notes to or send."))}</span></button></div>`)}
      ${card(heading(T("Monthly totals"), "📈") + (() => { const m = all.find(x => x[0] === "monthly")[2];
        return m.length > 1 ? `<table class="rate-table"><thead><tr>${m[0].map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${m.slice(1).reverse().map(x => `<tr><td>${esc(x[0])}</td><td>${pln(x[1])}</td><td>${pln(x[2])}</td><td class="${x[3] < 0 ? "bad" : "good"}">${pln(x[3])}</td></tr>`).join("")}</tbody></table>` : hint(T("No data in this period."));
      })(), "wide")}
    </div>`;
    el.querySelectorAll("[data-period]").forEach(b => b.onclick = () => { o.period = b.dataset.period; save(); App.refresh(); });
    el.querySelectorAll('[name="rfrom"], [name="rto"]').forEach(i => i.onchange = () => { o.from = el.querySelector('[name="rfrom"]').value; o.to = el.querySelector('[name="rto"]').value; save(); App.refresh(); });
    el.querySelectorAll("[data-part]").forEach(c => c.onchange = () => {
      const set = new Set(o.skip); c.checked ? set.delete(c.dataset.part) : set.add(c.dataset.part); o.skip = [...set]; save();
    });
    el.querySelectorAll("[data-all]").forEach(b => b.onclick = () => { o.skip = b.dataset.all === "1" ? [] : all.map(x => x[0]); save(); App.refresh(); });
    el.querySelectorAll("[data-f]").forEach(b => b.onclick = () => exportAs(b.dataset.f));
  },
};
