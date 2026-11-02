// Reports tab: choose the period and what to include, see the key figures, export to Excel, PDF or Word.
import {
  T, State, save, Calc, Advisor, ChartData, pln, rate, fmtDate, parseDate, monthName, monthStart, addMonths, addDays, today, isoDate,
  ONE_TIME, RECEIVED, currentName, savingsRateText, goalSaved, moduleOn, license, categoryIcon,
} from "./core.js";
import { esc, card, heading, hint, row, button, toast, alertBox, download, stamp } from "./ui.js";
import { App, requirePro } from "./app.js";
import { monthBars, donut, savingsChart } from "./charts.js";
import { savingsData } from "./savings-check.js";

const D = () => State.data;
const round = v => Math.round(v * 100) / 100;
const PERIODS = [["thisMonth", "This month"], ["lastMonth", "Last month"], ["last3", "Last 3 months"], ["last12", "Last 12 months"], ["thisYear", "This year"], ["all", "Everything"], ["custom", "Own dates"]];
const opts = () => {
  const s = D().Settings;
  // Defaults filled in place: every part of the page changes the same saved object
  const o = s.Report || (s.Report = {});
  for (const [k, v] of Object.entries({ period: "last3", from: "", to: "", skip: [] })) if (o[k] === undefined) o[k] = Array.isArray(v) ? [] : v;
  return o;
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
const wantCharts = () => !opts().skip.includes("charts");

// ---------- diagrams (PDF and Word) ----------
// Drawn with the app's charts, in light print colours. Word gets them as pictures inside the file.
const PALETTE = ["#2563EB", "#F97316", "#16A34A", "#DB2777", "#CA8A04", "#7C3AED", "#9CA3AF"];
function printable(svg, w, h, axisPx = 11) {
  let s = svg.split("var(--grid)").join("#E5E7EB").split("var(--card)").join("#FFFFFF").split("var(--primary)").join("#0F766E");
  s = s.replace(/<svg ([^>]*)>/, (m, at) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" ${at.replace(/\s(width|height)="[^"]*"/g, "")}>`).replace(/(<svg[^>]*>)/,
    `$1<style>.axis{font:${axisPx}px Segoe UI,Arial,sans-serif;fill:#6B7280}.donut-top{font:800 15px Segoe UI,Arial,sans-serif;fill:#111827}.donut-bottom{font:11px Segoe UI,Arial,sans-serif;fill:#6B7280}</style>`);
  return s.replace(/<title>[\s\S]*?<\/title>/g, "");
}
/** The diagrams for the period: [{ title, svg, w, h, legend }] */
export function reportCharts(r = reportRange()) {
  const d = D(), out = [];
  const months = ChartData.trend(d).filter(m => m.start >= monthStart(r.from) && m.start <= r.to);
  const axis = v => v >= 1000 ? +(v / 1000).toFixed(1) + "k" : String(Math.round(v));
  if (months.some(m => m.income || m.expenses))
    out.push({ title: T("Inflows and outflows per month"), w: 560, h: 220, svg: monthBars(months, axis, pln, [T("Inflows"), T("Outflows")]),
      legend: [[T("Inflows"), "#2E9E5B"], [T("Outflows"), "#C81E26"]] });
  const by = new Map(); for (const e of d.Expenses.filter(e => inRange(e.Date, r))) by.set(e.Category, (by.get(e.Category) || 0) + e.Amount);
  const cats = [...by.entries()].sort((a, b) => b[1] - a[1]), total = cats.reduce((a, c) => a + c[1], 0);
  if (total > 0) {
    const top = cats.slice(0, 6).map(([c, v], i) => ({ label: T(c), value: v, color: PALETTE[i], text: pln(v) }));
    const rest = cats.slice(6).reduce((a, c) => a + c[1], 0); if (rest > 0) top.push({ label: T("Everything else"), value: rest, color: PALETTE[6], text: pln(rest) });
    out.push({ title: T("Outflows by category"), w: 220, h: 220, svg: donut(top, pln(total), T("in this period"), 220),
      legend: top.map(x => [`${x.label}: ${x.text} (${Math.round(x.value / total * 100)}%)`, x.color]) });
  }
  const sv = savingsData(d, 0);
  if (sv) {
    const idx = sv.months.map((m, i) => i).filter(i => sv.months[i] >= monthStart(r.from) && sv.months[i] <= r.to);
    if (idx.length) {
      const labels = idx.map(i => sv.months[i].toLocaleDateString(undefined, { month: "short", year: "2-digit" }));
      const lines = [{ key: "t", label: T("Total balance"), color: "#0F766E", values: idx.map(i => sv.total[i]), main: true },
        ...(sv.accounts.length > 1 ? sv.accounts.map(a => ({ ...a, values: idx.map(i => a.values[i]) })) : [])];
      out.push({ title: T("Savings balance"), w: 700, h: 230, axis: 17, svg: savingsChart(labels, lines, [], axis, pln, new Set()),
        legend: lines.map(l => [l.label, l.color]) });
    }
  }
  return out.map(c => ({ ...c, svg: printable(c.svg, c.w, c.h, c.axis) }));
}
/** A diagram as a PNG picture (base64), for Word. */
function toPng(c) {
  return new Promise((res, rej) => {
    const img = new Image(), k = 2;
    img.onload = () => { const cv = document.createElement("canvas"); cv.width = c.w * k; cv.height = c.h * k;
      const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
      res(cv.toDataURL("image/png").split(",")[1]); };
    img.onerror = () => rej(new Error("chart"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(c.svg);
  });
}
const legendHtml = c => `<p class="lg">${c.legend.map(([l, col]) => `<span><i style="background:${col}"></i>${esc(l)}</span>`).join(" ")}</p>`;

// ---------- files ----------
function reportHtml(forWord = false, pics = null) {
  const r = reportRange(), parts = chosen();
  const charts = wantCharts() ? reportCharts(r) : [];
  const chartBlock = charts.length ? `<h2>${esc(T("Diagrams"))}</h2>` + charts.map((c, i) => `<h3>${esc(c.title)}</h3>` +
    `<div class="ch">${c.svg}</div>` + legendHtml(c)).join("") : "";
  const table = rows => `<table><tr>${rows[0].map(h => `<th>${esc(h)}</th>`).join("")}</tr>${rows.slice(1).map(x => `<tr>${x.map(c => `<td>${esc(typeof c === "number" ? pln(c) : c)}</td>`).join("")}</tr>`).join("")}</table>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(T("MoneyCompass report"))}</title><style>
    body{font-family:Segoe UI,Arial,sans-serif;color:#111827;margin:24px}h1{color:#0F766E;margin:0}h2{color:#0F766E;margin-top:28px;font-size:18px}
    table{border-collapse:collapse;width:100%;font-size:12px;margin-top:6px}th{background:#0F766E;color:#fff;text-align:left;padding:5px}td{border-bottom:1px solid #E5E7EB;padding:5px;vertical-align:top}
    .muted{color:#6B7280;font-size:12px}h3{font-size:14px;margin:16px 0 4px;color:#111827}.ch svg{max-width:100%;height:auto}
    .lg{font-size:11px;color:#374151}.lg span{margin-right:12px;white-space:nowrap}.lg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:middle}${forWord ? "" : "@media print{h2{break-after:avoid}table{break-inside:auto}tr{break-inside:avoid}}"}</style></head><body>
    <h1>${esc(T("MoneyCompass report"))}</h1><p class="muted">${esc(T("Created on {0}", fmtDate(new Date())))} · ${esc(currentName())} · ${esc(fmtDate(r.from) + " – " + fmtDate(r.to))}</p>
    ${parts.map(([k, title, rows]) => `<h2>${esc(title)}</h2>${table(rows)}` + (k === "summary" ? chartBlock : "")).join("")}
    ${parts.some(p => p[0] === "summary") ? "" : chartBlock}
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
/** Word: a real .docx (Word, LibreOffice, Google Docs), tables and the diagrams as pictures. */
const loadScript = src => new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = src; sc.onload = res; sc.onerror = () => rej(new Error("Word library could not be loaded.")); document.head.appendChild(sc); });
async function exportWord() {
  if (!window.docx) await loadScript("https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js");
  const X = window.docx, r = reportRange(), parts = chosen();
  const charts = wantCharts() ? reportCharts(r) : [];
  const text = (t, o = {}) => new X.TextRun({ text: String(t ?? ""), size: 18, ...o });
  const cell = (t, head) => new X.TableCell({ children: [new X.Paragraph({ children: [text(t, head ? { bold: true, color: "FFFFFF" } : {})] })],
    ...(head ? { shading: { type: X.ShadingType.CLEAR, color: "auto", fill: "0F766E" } } : {}), margins: { top: 40, bottom: 40, left: 80, right: 80 } });
  const table = rows => new X.Table({ width: { size: 100, type: X.WidthType.PERCENTAGE },
    rows: rows.map((row, n) => new X.TableRow({ tableHeader: n === 0, children: row.map(c => cell(typeof c === "number" ? pln(c) : c, n === 0)) })) });
  const h = (t, level) => new X.Paragraph({ heading: level, spacing: { before: 240, after: 80 }, children: [new X.TextRun({ text: t, color: "0F766E", bold: true })] });
  const chartBlock = [];
  if (charts.length) {
    chartBlock.push(h(T("Diagrams"), X.HeadingLevel.HEADING_2));
    for (const c of charts) {
      let png = null; try { png = await toPng(c); } catch { /* left out */ }
      if (!png) continue;
      const scale = Math.min(1, 600 / c.w);
      chartBlock.push(h(c.title, X.HeadingLevel.HEADING_3),
        new X.Paragraph({ children: [new X.ImageRun({ data: Uint8Array.from(atob(png), ch => ch.charCodeAt(0)), transformation: { width: Math.round(c.w * scale), height: Math.round(c.h * scale) } })] }),
        new X.Paragraph({ children: c.legend.map(([l], i) => text((i ? "   ·   " : "") + l, { color: "374151", size: 16 })) }));
    }
  }
  const body = [
    new X.Paragraph({ heading: X.HeadingLevel.TITLE, children: [new X.TextRun({ text: T("MoneyCompass report"), color: "0F766E", bold: true })] }),
    new X.Paragraph({ children: [text(`${T("Created on {0}", fmtDate(new Date()))} · ${currentName()} · ${fmtDate(r.from)} – ${fmtDate(r.to)}`, { color: "6B7280" })] }),
  ];
  for (const [k, title, rows] of parts) { body.push(h(title, X.HeadingLevel.HEADING_2), table(rows)); if (k === "summary") body.push(...chartBlock); }
  if (!parts.some(p => p[0] === "summary")) body.push(...chartBlock);
  body.push(new X.Paragraph({ spacing: { before: 240 }, children: [text(T("These suggestions are calculated from what you entered and are estimates. They are not financial, investment or tax advice."), { color: "6B7280", size: 16 })] }));
  const doc = new X.Document({ creator: "MoneyCompass", title: T("MoneyCompass report"), styles: { default: { document: { run: { font: "Segoe UI" } } } }, sections: [{ children: body }] });
  download(`MoneyCompass-report-${stamp()}.docx`, await X.Packer.toBlob(doc));
}
async function exportAs(f) {
  if (!(await requirePro(T("Reports")))) return;
  if (!chosen().length && !(wantCharts() && reportCharts().length)) { toast(T("Choose at least one part of the report."), "bad"); return; }
  try {
    if (f === "xlsx") await exportExcel();
    else if (f === "pdf") { if (!printReport()) return; }
    else await exportWord();
    toast(T("Report saved"));
  } catch (e) { alertBox(T("Export report"), T("The report could not be created.") + "\n" + e.message); }
}

// ---------- the tab ----------
export const Reports = {
  route: "reports", title: "Reports",
  render(el) {
    if (!license.isPro) {
      el.innerHTML = `<div class="grid">${card(heading(T("Reports are part of MoneyCompass Pro"), "🔒") +
        hint(T("Choose any period, pick what to include – summary, monthly totals, outflows by category, savings, loans, budget and more – with diagrams, and export to Excel, PDF or Word.")) +
        `<div class="buttons">${button(esc(T("Enter license key")), "rep-pro", "main")}</div>`, "wide")}</div>`;
      el.querySelector('[data-action="rep-pro"]').onclick = () => App.openProfile();
      return;
    }
    const o = opts(), r = reportRange(o), all = reportSections(r), lock = "";
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
        `<div class="rep-parts">${(() => { const n = reportCharts(r).length;
          return `<label class="check${n ? "" : " off"}"><input type="checkbox" data-part="charts"${!o.skip.includes("charts") && n ? " checked" : ""}${n ? "" : " disabled"}><span><em>📊 ${esc(T("Diagrams (PDF and Word)"))}</em><small class="hint">${n || "–"}</small></span></label>`; })()}${all.map(([k, title, rows]) => { const n = rows.length - 1, empty = n < 1;
          return `<label class="check${empty ? " off" : ""}"><input type="checkbox" data-part="${k}"${!o.skip.includes(k) && !empty ? " checked" : ""}${empty ? " disabled" : ""}><span><em>${esc(title)}</em><small class="hint">${empty ? "–" : n}</small></span></label>`; }).join("")}</div>` +
        `<div class="buttons"><button class="btn second small" data-all="1">${esc(T("All"))}</button><button class="btn second small" data-all="0">${esc(T("None"))}</button></div>`)}
      ${card(heading(T("Export"), "⬇") + hint(T("Each export is a new file with date and time, so older reports are kept.")) +
        `<div class="buttons col rep-export">
          <button class="btn second" data-f="xlsx"><b>📊 ${esc(T("Excel (.xlsx)"))}${lock}</b><br><span class="hint">${esc(T("Every part on its own sheet, with real numbers you can calculate with."))}</span></button>
          <button class="btn second" data-f="pdf"><b>🖨️ ${esc(T("PDF"))}${lock}</b><br><span class="hint">${esc(T("Opens the print window: choose \"Save as PDF\"."))}</span></button>
          <button class="btn second" data-f="doc"><b>📝 ${esc(T("Word (.docx)"))}${lock}</b><br><span class="hint">${esc(T("A document you can still edit, add notes to or send."))}</span></button></div>`)}
      ${card(heading(T("Monthly totals"), "📈") + (() => { const m = all.find(x => x[0] === "monthly")[2];
        return m.length > 1 ? `<table class="rate-table"><thead><tr>${m[0].map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${m.slice(1).reverse().map(x => `<tr><td>${esc(x[0])}</td><td>${pln(x[1])}</td><td>${pln(x[2])}</td><td class="${x[3] < 0 ? "bad" : "good"}">${pln(x[3])}</td></tr>`).join("")}</tbody></table>` : hint(T("No data in this period."));
      })(), "wide")}
    </div>`;
    el.querySelectorAll("[data-period]").forEach(b => b.onclick = () => { o.period = b.dataset.period; save(); App.refresh(); });
    el.querySelectorAll('[name="rfrom"], [name="rto"]').forEach(i => i.onchange = () => { o.from = el.querySelector('[name="rfrom"]').value; o.to = el.querySelector('[name="rto"]').value; save(); App.refresh(); });
    el.querySelectorAll("[data-part]").forEach(c => c.onchange = () => {
      const set = new Set(o.skip); c.checked ? set.delete(c.dataset.part) : set.add(c.dataset.part); o.skip = [...set]; save();
    });
    el.querySelectorAll("[data-all]").forEach(b => b.onclick = () => { o.skip = b.dataset.all === "1" ? [] : [...all.map(x => x[0]), "charts"]; save(); App.refresh(); });
    el.querySelectorAll("[data-f]").forEach(b => b.onclick = () => exportAs(b.dataset.f));
  },
};
