// Dashboard blocks for the redesigned pages (Budget Plan, Expenses, Emergency Fund, Loans & Debts), built like the "Emerald Balanced" mockups.
import { T, State, Calc, ChartData, pln, rate, fmtDate, parseDate, today, addMonths, monthName, categoryLabel, categoryIcon, COLORS, findCategory } from "./core.js";
import { esc } from "./ui.js";
import { si, IC, ring, band } from "./page-head.js";
import { lineChart, colBars, donutList } from "./ov-charts.js";

export const TICK = `<span class="nw-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12.500l4.500 4.500L19 7.500"/></svg></span>`;
export const WARN = `<span class="nw-warn"><svg viewBox="0 0 24 24" fill="#FFB020" stroke="none"><path d="M12 2L1 21h22zM11 9h2v6h-2zm0 8h2v2h-2z" fill-rule="evenodd"/></svg></span>`;
/** A card with an icon and a title. cls picks the icon colour (bulb = yellow, table/rank = blue, res = green, warn = orange). */
export const dcard = (icon, cls, title, body, { extra = "", klass = "" } = {}) => `<div class="nw-card dz ${klass}"><div class="nw-ch"><span class="rp-si i-${cls}">${si(IC[icon], 24)}</span><h3>${esc(title)}</h3>${extra}</div>${body}</div>`;
export const list = (items, warnFn) => `<ul class="nw-ul">${items.map((x, i) => `<li>${warnFn && warnFn(i) ? WARN : TICK}<span>${esc(x)}</span></li>`).join("")}</ul>`;
export const keys = ks => `<span class="rp-leg">${ks.map(k => `<i style="background:${k[0]}"></i>${esc(k[1])}`).join(" ")}</span>`;
export const stat = (l, v, cls = "") => `<div class="dz-stat"><small>${esc(l)}</small><b class="${cls}">${esc(v)}</b></div>`;
const bcol = pc => pc > 100 ? "#FF4D5E" : pc > 80 ? "#FFB020" : "#22E39A";
const dim = () => { const t = today(), n = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); return { day: t.getDate(), n }; };
const lab = n => Array.from({ length: n }, (_, i) => i % 7 === 0 ? String(i + 1) : "");

// ------------------------------------------------------------------ Budget Plan
export function budgetDash(d) {
  const limits = d.Budgets.filter(b => b.MonthlyLimit > 0);
  const rows = limits.map(b => ({ c: b.Category, lim: b.MonthlyLimit, sp: Calc.spentThisMonth(b.Category) })).map(x => ({ ...x, pc: x.lim ? x.sp / x.lim * 100 : 0 }));
  const total = rows.reduce((s, x) => s + x.lim, 0), spent = rows.reduce((s, x) => s + x.sp, 0), left = total - spent, usage = total ? Math.round(spent / total * 100) : 0;
  const score = Math.max(0, Math.round(100 - rows.filter(x => x.pc > 80 && x.pc <= 100).length * 10 - rows.filter(x => x.pc > 100).length * 25));
  const { day, n } = dim(), start = new Date(today().getFullYear(), today().getMonth(), 1), cats = new Set(rows.map(x => x.c));
  const perDay = Array(n).fill(0);
  d.Expenses.filter(e => cats.has(e.Category) && parseDate(e.Date) >= start && parseDate(e.Date) < addMonths(start, 1)).forEach(e => { perDay[parseDate(e.Date).getDate() - 1] += e.Amount; });
  const extra = Math.max(0, spent - perDay.reduce((a, b) => a + b, 0)); perDay[0] += extra;
  let run = 0; const cum = perDay.map((v, i) => (run += v, i < day ? run : null));
  const proj = day > 0 ? spent / day * n : spent, projLine = cum.map((v, i) => i + 1 < day ? null : spent + (proj - spent) * (i + 1 - day) / Math.max(1, n - day));
  const sp = Calc.spending(d), potential = sp.monthsUsed ? sp.nonEssential * 0.2 : 0, income = Calc.totalIncome(d);
  const status = usage > 100 ? ["bad", T("Over budget")] : usage > 80 ? ["warn", T("Almost used")] : ["ok", T("On Track")];
  // spending this month by category (distribution)
  const by = {}; d.Expenses.filter(e => parseDate(e.Date) >= start && parseDate(e.Date) < addMonths(start, 1)).forEach(e => { by[e.Category] = (by[e.Category] || 0) + e.Amount; });
  const items = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([c, v], i) => ({ label: T(c), value: v, color: COLORS.cats[i % COLORS.cats.length], text: pln(v) }));
  const totSp = items.reduce((s, x) => s + x.value, 0);
  const ins = [rows.length ? T("{0} categories have a limit", rows.length) : T("Set a limit below to start your budget"), rows.filter(x => x.pc > 100).length ? T("{0} categories are over the limit", rows.filter(x => x.pc > 100).length) : T("No category is over its limit"), proj > total && total ? T("At this pace you will exceed your budget by {0}", pln(proj - total)) : T("Current budget is projected to finish below budget"), potential > 0 ? T("Potential monthly savings opportunity: {0}", pln(potential)) : null, T("Budget Health Score: {0} / 100", score)].filter(Boolean);
  const warnAt = rows.filter(x => x.pc > 100).length ? 1 : -1;
  const ov = dcard("save", "rank", T("Budget Overview"), `<div class="bp-ov-b">${ring(usage, usage + "%", T("Budget Usage"), 150, bcol(usage))}<div class="bp-ov-f">${stat(T("Budget Limit"), pln(total))}${stat(T("Spent"), pln(spent))}${stat(T("Remaining"), pln(left), left < 0 ? "bad" : "good")}</div></div><div class="bp-st ${status[0]}">✔ ${esc(status[1])}</div><button class="btn main ex-opt" data-action="b-opt">${esc(T("Optimize My Budget"))}</button>`, { klass: "bp-ovc" });
  const fc = dcard("trend", "res", T("Budget Forecast"), `<div class="dz-keys">${keys([["#22E39A", T("Budget Limit")], ["#3B9BFF", T("Current Spending")], ["#6FD6FF", T("Projected Spending")]])}</div>${lineChart(lab(n), [{ vals: Array(n).fill(total), color: "#22E39A" }, { vals: cum, color: "#3B9BFF", dots: false }, { vals: projLine, color: "#6FD6FF", dash: true }])}<div class="dz-two">${stat(T("Expected Month-End Spending"), pln(proj))}${stat(T("Expected Remaining"), pln(total - proj), total - proj < 0 ? "bad" : "")}</div><div class="bp-fc ${proj > total && total ? "bad" : "ok"}">${esc(proj > total && total ? T("Forecast is above budget limit") : T("Forecast remains below budget limit"))}</div>`, { klass: "bp-fcc" });
  const insC = dcard("sparkle", "res", T("AI Budget Insights"), list(ins, i => i === warnAt));
  const catC = dcard("bars", "rank", T("Budget Categories"), rows.map(x => `<div class="cr-row bp-row"><span class="cr-name">${esc(categoryLabel(x.c))}</span><span class="cr-bar"><i style="width:${Math.min(100, x.pc)}%;background:${bcol(x.pc)}"></i></span><b>${esc(pln(x.sp))} / ${esc(pln(x.lim))}</b></div>`).join("") || `<p class="hint">${esc(T("No limits yet. Set your first one below."))}</p>`);
  const distC = dcard("pie", "table", T("Spending Distribution"), items.length ? donutList(items, pln(totSp), "", t => Math.round(t / totSp * 100) + "%") : `<p class="hint">${esc(T("No expenses this month yet."))}</p>`);
  const near = rows.filter(x => x.pc >= 50).sort((a, b) => b.pc - a.pc).slice(0, 5);
  const nearC = dcard("warn", "warn", T("Categories Near Limit"), near.map(x => `<div class="cr-row bp-row"><span class="cr-name">${esc(T(x.c))}</span><span class="cr-bar"><i style="width:${Math.min(100, x.pc)}%;background:${bcol(x.pc)}"></i></span><b>${Math.round(x.pc)}%</b></div>`).join("") || `<p class="hint">${esc(T("No category is close to its limit."))}</p>`);
  const availNow = Math.max(0, income - total), availOpt = availNow + potential;
  const impact = `<div class="dz-band"><span class="rp-si i-res">${si(IC.leaf, 44)}</span><div class="dz-bt"><h3>${esc(T("Savings Impact"))}</h3></div><div class="dz-bf">${stat(T("Current Budget — Available For Savings"), pln(availNow))}</div><div class="dz-bf">${stat(T("Optimized Budget — Available For Savings"), pln(availOpt))}</div><div class="dz-bhi"><small>${esc(T("Potential Improvement"))}</small><b>+${esc(pln(potential))}/${esc(T("month"))}</b></div></div>`;
  const perf = band(T("Budget Performance Projection"), "trend", [{ l: T("Current Spending"), v: pln(spent) }, { l: T("Projected Month-End Spending"), v: pln(proj) }, { l: T("Budget Limit"), v: pln(total) }, { l: T("Potential Monthly Savings"), v: pln(potential) }, { l: T("Projected Additional Savings in 12 Months"), v: "+" + pln(potential * 12), big: true, cls: "good" }], "rp-trend2");
  return { kpis: { total, spent, left, score }, html: `<div class="bp-row1">${ov}${fc}${insC}</div><div class="bp-row1 bp-r2">${catC}${distC}${nearC}</div>${impact}${perf}` };
}

// ------------------------------------------------------------------ Emergency Fund
export function emergencyDash(d) {
  const s = d.Settings, r = Calc.emergency(s), safe = Calc.portfolio(d).safe, sp = Calc.spending(d);
  const income = Calc.totalIncome(d), exp = sp.monthsUsed ? sp.essential + sp.nonEssential : 0, avail = Math.max(0, income - exp);
  const contrib = Math.floor(avail * 0.5 / 50) * 50, covered = r.monthly > 0 ? safe / r.monthly : 0, missing = Math.max(0, r.target - safe);
  const pct = r.target > 0 ? Math.min(100, Math.round(safe / r.target * 100)) : 0, months = contrib > 0 ? Math.ceil(missing / contrib) : null;
  const at = k => addMonths(today(), k), mon = dt => dt.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const done = pct >= 100, est = done ? null : months != null ? at(months) : null;
  const fcL = Array.from({ length: 7 }, (_, i) => at(i).toLocaleDateString(undefined, { month: "short" }));
  const cur = fcL.map((_, i) => Math.min(r.target || Infinity, safe + contrib * i));
  const fcC = dcard("trend", "res", T("Emergency Fund Forecast"), `<div class="dz-keys">${keys([["#22E39A", T("Current Plan")], ["#6FD6FF", T("Target Projection")]])}</div>${lineChart(fcL, [{ vals: Array(7).fill(r.target || 0), color: "#6FD6FF", dash: true }, { vals: cur, color: "#22E39A", dots: true }])}${est ? `<div class="bp-fc ok">${esc(T("Estimated completion: {0}", mon(est)))}</div>` : done ? `<div class="bp-fc ok">${esc(T("Target reached"))}</div>` : `<div class="bp-fc bad">${esc(T("Add savings or lower your costs to see a completion date"))}</div>`}`, { klass: "bp-fcc" });
  const prog = dcard("shield", "res", T("Emergency Fund Progress"), `<div class="bp-ov-b">${ring(pct, pct + "%", "", 150, "#22E39A")}<div class="bp-ov-f">${stat(T("Current"), pln(safe))}${stat(T("Target"), r.target > 0 ? pln(r.target) : "–")}${stat(T("Remaining"), pln(missing), missing ? "warn" : "good")}</div></div><div class="dz-two">${stat(T("Estimated Completion"), est ? mon(est) : done ? T("Done") : "–")}${stat(T("Monthly Contribution"), pln(contrib))}</div><button class="btn main ex-opt" data-go="portfolio">${esc(T("Boost My Fund"))}</button>`, { klass: "bp-ovc" });
  const ins = [r.target > 0 ? T("Emergency fund covers {0} months of expenses", covered.toFixed(1)) : T("Enter your costs below to see your target."), covered >= 3 ? T("Fund health rating: Good") : T("Fund health rating: Needs attention"), contrib > 0 ? T("Contribution pace is on track") : T("No monthly surplus to contribute yet"), T("Months you plan to cover: {0}", s.EmergencyMonths), T("Extra safety buffer: {0}%", s.BufferPercent ?? 0)];
  const insC = dcard("sparkle", "res", T("AI Emergency Fund Insights"), list(ins) + `<button class="btn main ex-opt" data-action="em-opt">${esc(T("Optimize My Safety Net"))}</button>`);
  const essCats = (ChartData.categories(d).all || []).filter(c => { const f = findCat(c.category); return f ? f.Essential : false; }), essTot = essCats.reduce((a, c) => a + c.perMonth, 0);
  const essC = dcard("shield", "res", T("Monthly Essential Costs"), essCats.length ? donutList(essCats.map((c, i) => ({ label: T(c.category), value: c.perMonth, color: COLORS.cats[i % COLORS.cats.length], text: pln(c.perMonth) })), pln(essTot), T("/month"), t => pln(t)) : `<p class="hint">${esc(T("Add expenses to see your essential costs."))}</p>`);
  const tm = ChartData.trend(d).slice(-5), histC = dcard("shield", "res", T("Contribution History"), `<small class="hint">${esc(T("Money left over each month"))}</small>${tm.length ? colBars(tm.map(m => m.month), tm.map(m => Math.max(0, Math.round(m.income - m.expenses)))) : ""}`);
  const capC = dcard("pig", "res", T("Savings Capacity"), `<div class="ex-li"><span>${esc(T("Income"))}:</span><b>${esc(pln(income))}</b></div><div class="ex-li"><span>${esc(T("Expenses"))}:</span><b>${esc(pln(exp))}</b></div><div class="ex-li"><span>${esc(T("Available"))}:</span><b class="good">${esc(pln(avail))}</b></div><div class="dz-two">${stat(T("Recommended Contribution"), pln(contrib) + "/" + T("month"))}</div>`);
  const yc = (s.YearlyCosts || 0), sc = [[T("Job Loss Coverage"), covered.toFixed(1) + " " + T("months"), covered >= 3], [T("Medical Emergency"), covered >= 1 ? T("Covered") : T("Not yet"), covered >= 1], [T("Home Repair"), safe >= Math.max(yc, r.monthly) && safe > 0 ? T("Covered") : T("Not yet"), safe >= Math.max(yc, r.monthly) && safe > 0], [T("Car Breakdown"), safe >= Math.max(yc, r.monthly) && safe > 0 ? T("Covered") : T("Not yet"), safe >= Math.max(yc, r.monthly) && safe > 0]];
  const riskC = dcard("check", "res", T("Risk Scenarios"), sc.map(x => `<div class="ex-li">${x[2] ? TICK : WARN}<span>${esc(x[0])}</span><b class="${x[2] ? "good" : "warn"}">${esc(x[1])}</b></div>`).join(""));
  const stepD = k => { const need = r.target * k; if (safe >= need) return [true, T("Reached")]; return [false, contrib > 0 ? mon(at(Math.ceil((need - safe) / contrib))) : "–"]; };
  const first = ChartData.firstDate(d), steps = [[T("Started"), first ? mon(first) : "–", true], [T("25% Achieved"), ...stepD(0.25).reverse()], [T("50% Achieved"), ...stepD(0.5).reverse()], [T("Expected Completion"), est ? mon(est) : done ? T("Done") : "–", done]];
  const tl = dcard("trend", "res", T("Emergency Fund Timeline"), `<div class="em-tl">${steps.map(x => `<div class="em-st${x[2] ? " done" : ""}"><i></i><b>${esc(x[0])}</b><small>${esc(x[1] === true ? "" : String(x[1]))}</small></div>`).join("")}</div>`, { klass: "em-tlc" });
  const score = Math.min(100, Math.round(pct * 0.7 + Math.min(covered, 6) / 6 * 30)), lvl = score >= 75 ? T("Strong") : score >= 50 ? T("Fair") : T("Needs work");
  const rd = dcard("trend", "res", T("Financial Readiness Score"), `<div class="bp-ov-b">${ring(score, score + "/100", "", 110, "#22E39A")}<div class="bp-ov-f">${stat(T("Emergency Fund"), lvl, score >= 75 ? "good" : "warn")}</div></div>`);
  return { kpis: { safe, pct, covered, target: r.target, est, done }, html: `<div class="bp-row1">${prog}${fcC}${insC}</div><div class="em-r2">${essC}${histC}${capC}${riskC}</div><div class="em-r3">${tl}${rd}</div>` };
}
const findCat = name => findCategory(name);
