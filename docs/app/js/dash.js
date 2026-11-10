// Dashboard blocks for the redesigned pages (Budget Plan, Expenses, Emergency Fund, Loans & Debts), built like the "Emerald Balanced" mockups.
import { locale, T, State, Calc, ChartData, pln, rate, fmtDate, parseDate, today, addMonths, monthName, categoryLabel, categoryIcon, COLORS, findCategory } from "./core.js";
import { esc } from "./ui.js";
import { si, IC, ring, band } from "./page-head.js";
import { lineChart, colBars, donutList } from "./ov-charts.js";

export const TICK = `<span class="nw-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12.500l4.500 4.500L19 7.500"/></svg></span>`;
export const WARN = `<span class="nw-warn"><svg viewBox="0 0 24 24" fill="#FFB020" stroke="none"><path d="M12 2L1 21h22zM11 9h2v6h-2zm0 8h2v2h-2z" fill-rule="evenodd"/></svg></span>`;
/** A card with an icon and a title. cls picks the icon colour (bulb = yellow, table/rank = blue, res = green, warn = orange). */
export const dcard = (icon, cls, title, body, { extra = "", klass = "" } = {}) => `<div class="nw-card dz ${klass}"><div class="nw-ch"><span class="rp-si i-${cls}">${si(IC[icon], 24)}</span><h3>${esc(title)}</h3>${extra}</div>${body}</div>`;
export const PM = (a, t) => `<button class="pm-btn" data-action="${a}" title="${esc(t)}" aria-label="${esc(t)}">±</button>`;
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
  const ins = [rows.length ? (rows.length === 1 ? T("1 category has a limit") : T("{0} categories have a limit", rows.length)) : T("Set a limit below to start your budget"), rows.filter(x => x.pc > 100).length ? T("{0} categories are over the limit", rows.filter(x => x.pc > 100).length) : T("No category is over its limit"), proj > total && total ? T("At this pace you will exceed your budget by {0}", pln(proj - total)) : T("Current budget is projected to finish below budget"), potential > 0 ? T("Potential monthly savings opportunity: {0}", pln(potential)) : null, T("Budget Health Score: {0} / 100", score)].filter(Boolean);
  const warnAt = rows.filter(x => x.pc > 100).length ? 1 : -1;
  const ov = dcard("save", "rank", T("Budget Overview"), `<div class="bp-ov-b">${ring(usage, usage + "%", T("Budget Usage"), 150, bcol(usage))}<div class="bp-ov-f">${stat(T("Budget Limit"), pln(total))}${stat(T("Spent"), pln(spent))}${stat(T("Remaining"), pln(left), left < 0 ? "bad" : "good")}</div></div><div class="bp-st ${status[0]}">✔ ${esc(status[1])}</div><button class="btn main ex-opt" data-action="b-opt">${esc(T("Optimize My Budget"))}</button>`, { klass: "bp-ovc" });
  const fc = dcard("trend", "res", T("Budget Forecast"), `<div class="dz-keys">${keys([["#22E39A", T("Budget Limit")], ["#3B9BFF", T("Current Spending")], ["#6FD6FF", T("Projected Spending")]])}</div>${lineChart(lab(n), [{ vals: Array(n).fill(total), color: "#22E39A" }, { vals: cum, color: "#3B9BFF", dots: false }, { vals: projLine, color: "#6FD6FF", dash: true }])}<div class="dz-two">${stat(T("Expected Month-End Spending"), pln(proj))}${stat(T("Expected Remaining"), pln(total - proj), total - proj < 0 ? "bad" : "")}</div><div class="bp-fc ${proj > total && total ? "bad" : "ok"}">${esc(proj > total && total ? T("Forecast is above budget limit") : T("Forecast remains below budget limit"))}</div>`, { klass: "bp-fcc" });
  const insC = dcard("sparkle", "res", T("AI Budget Insights"), list(ins, i => i === warnAt));
  const catC = dcard("bars", "rank", T("Budget Categories"), rows.map(x => `<div class="cr-row bp-row"><span class="cr-name">${esc(categoryLabel(x.c))}</span><span class="cr-bar"><i style="width:${Math.min(100, x.pc)}%;background:${bcol(x.pc)}"></i></span><b>${esc(pln(x.sp))} / ${esc(pln(x.lim))}</b></div>`).join("") || `<p class="hint">${esc(T("No limits yet. Set your first one below."))}</p>`, { extra: PM("b-limits", T("Edit budget limits")) });
  const distC = `<div class="bp-goals-slot"></div>`;
  const near = rows.filter(x => x.pc >= 50).sort((a, b) => b.pc - a.pc).slice(0, 5);
  const nearC = dcard("warn", "warn", T("Categories Near Limit"), near.map(x => `<div class="cr-row bp-row"><span class="cr-name">${esc(T(x.c))}</span><span class="cr-bar"><i style="width:${Math.min(100, x.pc)}%;background:${bcol(x.pc)}"></i></span><b>${Math.round(x.pc)}%</b></div>`).join("") || `<p class="hint">${esc(T("No category is close to its limit."))}</p>`);
  const availNow = Math.max(0, income - total), availOpt = availNow + potential;
  const impact = `<div class="dz-band"><span class="rp-si i-res">${si(IC.leaf, 44)}</span><div class="dz-bt"><h3>${esc(T("Savings Impact"))}</h3></div><div class="dz-bf">${stat(T("Current Budget — Available For Savings"), pln(availNow))}</div><div class="dz-bf">${stat(T("Optimized Budget — Available For Savings"), pln(availOpt))}</div><button class="dz-bhi" data-action="b-opt2" title="${esc(T("Show me how"))}"><small>${esc(T("Potential Improvement"))}</small><b>+${esc(pln(potential))}/${esc(T("month"))}</b><em>${esc(T("Show me how"))} →</em></button></div>`;
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
  const fcL = Array.from({ length: 7 }, (_, i) => at(i).toLocaleDateString(locale(), { month: "short" }));
  const cur = fcL.map((_, i) => Math.min(r.target || Infinity, safe + contrib * i));
  const fcC = dcard("trend", "res", T("Emergency Fund Forecast"), `<div class="dz-keys">${keys([["#22E39A", T("Current Plan")], ["#6FD6FF", T("Target Projection")]])}</div>${lineChart(fcL, [{ vals: Array(7).fill(r.target || 0), color: "#6FD6FF", dash: true }, { vals: cur, color: "#22E39A", dots: true }])}${est ? `<div class="bp-fc ok">${esc(T("Estimated completion: {0}", mon(est)))}</div>` : done ? `<div class="bp-fc ok">${esc(T("Target reached"))}</div>` : `<div class="bp-fc bad">${esc(T("Add savings or lower your costs to see a completion date"))}</div>`}`, { klass: "bp-fcc" });
  const prog = dcard("shield", "res", T("Emergency Fund Progress"), `<div class="bp-ov-b">${ring(pct, pct + "%", "", 150, "#22E39A")}<div class="bp-ov-f">${stat(T("Current"), pln(safe))}${stat(T("Target"), r.target > 0 ? pln(r.target) : "–")}${stat(T("Remaining"), pln(missing), missing ? "warn" : "good")}</div></div><div class="dz-two">${stat(T("Estimated Completion"), est ? mon(est) : done ? T("Done") : "–")}${stat(T("Monthly Contribution"), pln(contrib))}</div><button class="btn main ex-opt" data-go="portfolio">${esc(T("Boost My Fund"))}</button>`, { klass: "bp-ovc", extra: PM("em-manage", T("Edit costs and target")) });
  const ins = [r.target > 0 ? T("Emergency fund covers {0} months of expenses", covered.toFixed(1)) : T("Enter your costs below to see your target."), covered >= 3 ? T("Fund health rating: Good") : T("Fund health rating: Needs attention"), contrib > 0 ? T("Contribution pace is on track") : T("No monthly surplus to contribute yet"), T("Months you plan to cover: {0}", s.EmergencyMonths), T("Extra safety buffer: {0}%", s.BufferPercent ?? 0)];
  const insC = dcard("sparkle", "res", T("AI Emergency Fund Insights"), list(ins) + `<button class="btn main ex-opt" data-action="em-opt">${esc(T("Optimize My Safety Net"))}</button>`);
  const essCats = (ChartData.categories(d).all || []).filter(c => { const f = findCat(c.category); return f ? f.Essential : false; }), essTot = essCats.reduce((a, c) => a + c.perMonth, 0);
  const essC = dcard("shield", "res", T("Monthly Essential Costs"), essCats.length ? donutList(essCats.map((c, i) => ({ label: T(c.category), value: c.perMonth, color: COLORS.cats[i % COLORS.cats.length], text: pln(c.perMonth) })), pln(essTot), T("/month"), t => pln(t)) : `<p class="hint">${esc(T("Add expenses to see your essential costs."))}</p>`, { extra: PM("em-manage", T("Edit costs and target")) });
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

// ------------------------------------------------------------------ Loans & Debts
import { loanPlan } from "./core.js";
export function loansDash(d, debtFree) {
  const running = d.Loans.filter(x => x.Remaining > 0), now = x => loanPlan(x).remainingNow;
  const payments = Calc.loanPayments(d), income = Calc.totalIncome(d), share = income > 0 ? payments / income : 0;
  const rem = running.reduce((a, x) => a + now(x), 0), orig = running.reduce((a, x) => a + (x.Original > 0 ? x.Original : now(x)), 0), paid = orig > 0 ? Math.max(0, Math.min(100, Math.round((1 - rem / orig) * 100))) : 0;
  const dScore = !running.length ? 100 : income > 0 ? Math.max(0, Math.round(100 - share * 200)) : 50;
  const sim = factor => { const b = running.map(x => now(x)), out = []; for (let m = 0; m <= 60; m++) { out.push(b.reduce((a, v) => a + v, 0)); running.forEach((x, i) => { b[i] = Math.max(0, b[i] * (1 + (x.RatePercent || 0) / 1200) - (x.MonthlyPayment || 0) * factor); }); if (!b.some(v => v > 0)) { out.push(0); break; } } return out; };
  const cur = sim(1), acc = sim(1.2), len = Math.max(cur.length, acc.length), step = Math.max(1, Math.ceil(len / 8));
  const idx = Array.from({ length: Math.ceil(len / step) }, (_, i) => i * step), at = k => addMonths(today(), k);
  const labels = idx.map(k => at(k).toLocaleDateString(locale(), { month: "short", year: "2-digit" }));
  const pick = arr => idx.map(k => k < arr.length ? arr[k] : 0);
  const plan = dcard("save", "res", T("Debt Freedom Plan"), `<div class="bp-ov-b">${ring(paid, paid + "%", T("Debt Paid Off"), 150, "#22E39A")}<div class="bp-ov-f">${stat(T("Remaining Debt"), pln(rem))}${stat(T("Already Repaid"), pln(Math.max(0, orig - rem)), "good")}${stat(T("Total Original Debt"), pln(orig))}</div></div><button class="btn main ex-opt" data-action="l-extra">${esc(T("Accelerate My Payoff Plan"))} →</button>`, { klass: "bp-ovc" });
  const fc = dcard("trend", "res", T("Debt Payoff Forecast"), `<div class="dz-keys">${keys([["#22E39A", T("Current Plan")], ["#3B9BFF", T("Accelerated Plan (+20% payment)")]])}</div>${running.length ? lineChart(labels, [{ vals: pick(cur), color: "#22E39A", dots: true }, { vals: pick(acc), color: "#3B9BFF", dots: true }]) : `<p class="hint">${esc(T("You have no active debts"))}</p>`}${running.length ? `<div class="bp-fc ok">${esc(T("Debt-Free"))}: ${esc(debtFree)}</div>` : ""}`, { klass: "bp-fcc" });
  const ins = [running.length ? (running.length === 1 ? T("1 active loan or debt") : T("{0} active loans or debts", running.length)) : T("You have no active debts"), income > 0 && running.length ? T("Loan payments take {0}% of your income", Math.round(share * 100)) : null, running.length ? T("Debt-free: {0}", debtFree) : null, T("Debt Score: {0} / 100", dScore)].filter(Boolean);
  const insC = dcard("sparkle", "res", T("AI Debt Insights"), list(ins) + `<button class="btn main ex-opt" data-action="l-extra">${esc(T("Improve My Payoff Strategy"))} →</button>`);
  const totRate = rem > 0 ? running.reduce((a, x) => a + (x.RatePercent || 0) * now(x), 0) / rem : 0;
  const port = dcard("bank", "table", T("Loans Portfolio"), `<table class="ln-t"><thead><tr><th>${esc(T("Loan"))}</th><th>${esc(T("Remaining"))}</th><th>${esc(T("Interest Rate"))}</th></tr></thead><tbody>${running.map(x => `<tr><td>${esc(x.Name)}</td><td>${esc(pln(now(x)))}</td><td>${esc(rate(x.RatePercent || 0))}</td></tr>`).join("")}</tbody>${running.length ? `<tfoot><tr><td>${esc(T("Total"))}</td><td>${esc(pln(rem))}</td><td>${esc(rate(totRate))}</td></tr></tfoot>` : ""}</table>`, { extra: PM("l-new", T("Add or edit loans")) });
  const mp = dcard("calx", "table", T("Monthly Debt Payments"), running.map(x => `<div class="cr-row bp-row"><span class="cr-name">${esc(x.Name)}</span><span class="cr-bar"><i style="width:${payments ? Math.round(x.MonthlyPayment / payments * 100) : 0}%;background:#3B9BFF"></i></span><b>${esc(pln(x.MonthlyPayment))}</b></div>`).join("") || `<p class="hint">–</p>`);
  const br = dcard("pie", "table", T("Debt Breakdown"), running.length ? donutList(running.map((x, i) => ({ label: x.Name, value: now(x), color: COLORS.cats[i % COLORS.cats.length], text: pln(now(x)) })), pln(rem), "", t => Math.round(t / Math.max(1, rem) * 100) + "%") : `<p class="hint">–</p>`);
  const tm = ChartData.trend(d).slice(-2), surplus = income > 0 ? 1 - ((Calc.spending(d).essential + Calc.spending(d).nonEssential) / income) : 0, up = tm.length === 2 && (tm[1].income - tm[1].expenses) >= (tm[0].income - tm[0].expenses);
  const lvl = dScore >= 75 ? T("Strong") : dScore >= 50 ? T("Fair") : T("Needs work");
  const fs = dcard("shield", "res", T("Financial Strength Score"), `<div class="bp-ov-b">${ring(dScore, dScore + "", "/100", 110, "#22E39A")}<div class="bp-ov-f"><small>${esc(T("Status"))}:</small><b class="${dScore >= 75 ? "good" : "warn"}">${esc(lvl)}</b></div></div>${list([T("Savings Rate: {0}", surplus >= 0.2 ? T("Excellent") : surplus > 0 ? T("OK") : T("Low")), T("Debt Ratio: {0}", share < 0.3 ? T("Healthy") : T("High")), T("Growth Trend: {0}", up ? T("Positive") : T("Negative"))], i => (i === 0 && surplus <= 0) || (i === 1 && share >= 0.3) || (i === 2 && !up))}`);
  const onTrack = !running.length || share < 0.4;
  const bandH = `<div class="dz-band ln-band"><span class="rp-si i-res">${si(IC.check, 48)}</span><div class="dz-bt"><h3>${esc(onTrack ? T("Your debt freedom plan is on track!") : T("Your debt load is high – an accelerated plan can help."))}</h3><small>${esc(running.length ? T("With your current strategy, you could be debt-free by {0}.", debtFree) : T("You have no active debts."))}</small></div><div class="ln-bars">${idx.map((k, i) => `<i style="height:${Math.max(6, Math.round((1 - (pick(cur)[i] || 0) / Math.max(1, cur[0])) * 60) + 6)}px"></i>`).join("")}</div><button class="btn main rp-gen" data-action="l-extra">${esc(T("View Detailed Plan"))} →</button></div>`;
  return { kpis: { rem, payments, dScore }, html: `<div class="bp-row1">${plan}${fc}${insC}</div><div class="em-r2">${port}${mp}${br}${fs}</div>${bandH}` };
}

// Old-style cards inside "Manage …" sections get the same icon header as the dashboard cards
export function iconizeCards(root) {
  const map = [[/add|new|set|edit|form|target/i, "plus", "save"], [/repay|overpay|chart/i, "trend", "res"], [/debt|result|summary/i, "pie", "table"], [/loan/i, "bank", "table"], [/where|keep/i, "wallet", "res"], [/bin|deleted/i, "docs", "table"]];
  root.querySelectorAll(".bp-manage .card:not(.nw-card)").forEach(c => {
    const h = c.querySelector(":scope > h3, :scope > form > h3, :scope > .card-h > h3, :scope h3"); if (!h || h.closest(".nw-ch")) return;
    const t = h.textContent, m = map.find(r => r[0].test(t)) || [0, "table", "table"];
    const wrap = document.createElement("div"); wrap.className = "nw-ch"; h.before(wrap);
    wrap.innerHTML = `<span class="rp-si i-${m[2]}">${si(IC[m[1]], 24)}</span>`; wrap.appendChild(h); c.classList.add("nw-card", "dz");
  });
}
