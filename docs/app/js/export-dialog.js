// The Export window: what to export, the period and the format (Excel, PDF or Word), then the normal report export.
import { T, State, license, isoDate, today, monthStart, addMonths } from "./core.js";
import { esc, popup, toast } from "./ui.js";
import { requirePro } from "./app.js";
import { exportAs, setReportOptions, reportKeys } from "./reports.js";

const ic = (d, s = 28) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const CAL = '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>';
const WHAT = [
  ["complete", "Complete Financial Report", "Export all available financial data.", ic('<rect x="4" y="11" width="4" height="9" rx="1"/><rect x="10" y="5" width="4" height="15" rx="1"/><rect x="16" y="13" width="4" height="7" rx="1"/>', 36), null],
  ["ie", "Income & Expenses", "Export inflows, outflows and spending categories.", ic('<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18"/><circle cx="16.5" cy="15" r="1.2"/>', 36), ["summary", "monthly", "categories", "expenses", "received", "transfers", "income"]],
  ["sg", "Savings & Goals", "Export savings, emergency fund and goal tracking.", ic('<path d="M5 12a7 5.5 0 0 1 7-5.5c3 0 5 1.2 6 3l2-.5v4l-2 .5c-.5 1-1.3 1.7-2.3 2.2V19h-3v-1.5h-3.4V19H7.3v-3.6C5.8 14.5 5 13.3 5 12z"/><circle cx="15" cy="11" r=".9"/>', 36), ["summary", "savings", "checks", "offers", "goals", "budget"]],
  ["ld", "Loans & Debts", "Export debt balances, repayments and projections.", ic('<path d="M12 4v16M7 20h10M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>', 36), ["loans"]],
];
const RANGE = [["thisMonth", "This Month"], ["lastMonth", "Last Month"], ["last3", "Last 3 Months"], ["last12", "Last 12 Months"], ["all", "All Data"], ["custom", "Custom Range"]];
const FORMAT = [["xlsx", "Excel (.xlsx)", "Perfect for analysis and further processing.", "#1D8F55", "X"], ["pdf", "PDF (.pdf)", "Professional format for sharing and printing.", "#E5332A", "PDF"], ["doc", "Word (.docx)", "Editable report in Microsoft Word.", "#2B6CD4", "W"]];

export async function openExportDialog() {
  if (!(await requirePro(T("Export report")))) return;
  const sel = { what: "complete", range: "thisMonth", format: "xlsx" };
  const t = today(), f0 = isoDate(monthStart(t)).slice(0, 10), t0 = isoDate(t).slice(0, 10);
  const p = popup(`<div class="exp">
    <div class="exp-hero"><span class="exp-hero-ic">${ic('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M12 18v-6M9.5 14.5L12 12l2.5 2.5"/>', 44)}</span>
      <div><h2>${esc(T("Export Financial Data"))}</h2><p>${esc(T("Generate professional exports of your financial information, reports and account history."))}</p></div></div>
    <h3 class="exp-step"><i>1</i>${esc(T("What would you like to export?"))}</h3>
    <div class="exp-what">${WHAT.map(([k, title, text, icon]) => `<button class="exp-card${k === sel.what ? " on" : ""}" data-what="${k}"><span class="exp-check">✓</span><span class="exp-ico">${icon}</span><b>${esc(T(title))}</b><small>${esc(T(text))}</small>${k === "complete" ? `<em class="exp-rec">✓ ${esc(T("Recommended"))}</em>` : ""}</button>`).join("")}</div>
    <h3 class="exp-step"><i>2</i>${esc(T("Select Date Range"))}</h3>
    <div class="exp-range">${RANGE.map(([k, l]) => `<button class="exp-chip${k === sel.range ? " on" : ""}" data-range="${k}">${ic(CAL, 18)}${esc(T(l))}</button>`).join("")}</div>
    <div class="exp-dates" hidden><label>${esc(T("From"))} <input type="date" name="xfrom" value="${f0}"></label><label>${esc(T("To"))} <input type="date" name="xto" value="${t0}"></label></div>
    <h3 class="exp-step"><i>${ic('<path d="M6 3h9l4 4v14H6z"/>', 16)}</i>${esc(T("Choose Export Format"))}</h3>
    <div class="exp-format">${FORMAT.map(([k, title, text, col, mark]) => `<button class="exp-fmt${k === sel.format ? " on" : ""}" data-format="${k}"><span class="exp-radio"></span><span class="exp-file" style="background:${col}">${mark}</span><span><b>${esc(T(title))}</b><small>${esc(T(text))}</small></span></button>`).join("")}</div>
    <div class="exp-secure"><span class="exp-lock">${ic('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 26)}</span><div><b>${esc(T("Your financial data is always protected and exported securely."))}</b><small>${esc(T("Exports are generated locally and contain only the data you select."))}</small></div><span class="exp-badge">${ic('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>', 20)}${esc(T("Secure Export"))}</span></div>
    <div class="exp-buttons"><button class="btn main exp-go" data-go>${ic('<path d="M12 15V4M8 8l4-4 4 4"/><path d="M4 20h16"/>', 18)} ${esc(T("Export Data"))}</button><button class="btn second" data-close>${esc(T("Cancel"))}</button></div></div>`, { width: 900, cls: "export-dlg" });
  const pick = (attr, key) => p.el.querySelectorAll(`[data-${attr}]`).forEach(b => b.onclick = () => { sel[key] = b.dataset[attr]; p.el.querySelectorAll(`[data-${attr}]`).forEach(x => x.classList.toggle("on", x === b)); p.el.querySelector(".exp-dates").hidden = sel.range !== "custom"; });
  pick("what", "what"); pick("range", "range"); pick("format", "format");
  p.el.querySelector("[data-go]").onclick = async () => {
    const keep = WHAT.find(w => w[0] === sel.what)[4], all = reportKeys();
    const skip = keep ? [...all.filter(k => !keep.includes(k)), ...(sel.what === "ld" ? ["charts"] : [])] : [];
    setReportOptions({ period: sel.range, skip, from: p.el.querySelector('[name="xfrom"]').value, to: p.el.querySelector('[name="xto"]').value });
    p.close(); await exportAs(sel.format);
  };
}
