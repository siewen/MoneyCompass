// Net Worth: what you own minus what you owe, how it develops, how close you are to financial independence and to retirement.
// The Wealth Advisor (engine/wealth-advisor.js) speaks at the top; every number here comes from the same snapshot as the Overview.
import { locale, T, pln, State, save, num, plain } from "./core.js";
import { esc, field, numInput } from "./ui.js";
import { App } from "./app.js";
import { donut } from "./charts.js";
import { lineChart } from "./ov-charts.js";
import { ring } from "./page-head.js";
import { currentAssessment } from "./assessment.js";
import { wealthFacts, fv, MILESTONES } from "./engine/wealth-math.js";

const pc = v => Math.round(v * 100) + "%";
const MON = () => Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1).toLocaleDateString(locale(), { month: "short" }).replace(".", ""));
const COLORS = ["#35D399", "#3B82F6", "#F59E0B", "#A78BFA", "#F472B6", "#22D3EE"];
const yrs = y => y === 1 ? T("1 year") : T("{0} years", y);
const years = m => m === null ? T("more than 100 years") : m <= 0 ? T("reached") : m < 12 ? (m === 1 ? T("1 month") : T("{0} months", m)) : yrs(Math.round(m / 12 * 10) / 10);

export const NetWorth = {
  route: "networth", title: "Net Worth",
  render(el) {
    const r = currentAssessment();
    if (!r || !r.snap.has) {
      el.innerHTML = `<div class="ox"><div class="nw-card ox-empty"><h3>💎 ${esc(T("Net Worth"))}</h3><p>${esc(T("Add your savings and loans first. MoneyCompass then tracks what you own minus what you owe, month by month."))}</p><div class="oa-start"><button class="sv-btn" data-go="portfolio">${esc(T("Open Savings"))} →</button><button class="sv-btn sec" data-demo>🧪 ${esc(T("Try the demo profile"))}</button></div></div></div>`;
      return;
    }
    const s = r.snap, n = s.nw, w = wealthFacts(s), P = s.plan, hist = n.history;
    // Wealth Score: the same three parts as the Overview
    const part = [[T("Emergency fund"), 40 * Math.min(1, s.emF || 0), 40, "emergency"], [T("Savings rate"), 30 * Math.min(1, Math.max(0, s.svRate || 0) / 0.2), 30, "income"],
      [T("Debt"), 30 * (n.liabilities <= 0 ? 1 : s.income > 0 ? Math.max(0, 1 - n.liabilities / (s.income * 12)) : 0), 30, "loans"]];
    const kpi = (l, v, sub, cls = "") => `<div class="nw-card"><small>${esc(l)}</small><b class="${cls}">${esc(v)}</b><i>${esc(sub)}</i></div>`;
    // Assets by kind
    const kinds = {}; (s.accounts || []).forEach(a => { const k = a.place || "Bank"; kinds[k] = (kinds[k] || 0) + a.amount; });
    if (s.invest && s.invest.total > 0) kinds[T("Investments")] = s.invest.total;
    const items = Object.entries(kinds).map(([k, v], i) => ({ label: T(k), value: v, color: COLORS[i % COLORS.length] })).sort((a, b) => b.value - a.value);
    const chart = hist.length >= 2 ? lineChart(hist.map(h => MON()[+h.k.slice(5, 7) - 1] + (hist.length > 12 ? " " + h.k.slice(2, 4) : "")), [
        { vals: hist.map(h => Math.round(h.assets)), color: "#3B82F6", dots: false }, { vals: hist.map(h => Math.round(h.net)), color: "#35D399", area: true, dots: true }], { w: 620, h: 260 })
      : `<p class="hint">${esc(T("Your history builds up by itself: MoneyCompass notes your net worth every month you open it. Come back next month to see the trend."))}</p>`;
    const base = Math.max(0, n.net), proj = [1, 5, 10, 20].map(y => [y, fv(base, w.contrib, P.ret, y)]);
    const next = MILESTONES.find(m => m > n.net);
    const miles = MILESTONES.map(m => `<li class="${m <= n.net ? "done" : m === next ? "next" : ""}"><span>${m <= n.net ? "✓" : m === next ? "→" : "○"}</span><b>${esc(pln(m))}</b><em>${m <= n.net ? esc(T("reached")) : m === next && n.monthly > 0 ? esc(T("in about {0}", years(Math.ceil((m - n.net) / n.monthly)))) : ""}</em></li>`).join("");
    const plan = (k, label, ph, val) => field(label, numInput(k, val ? plain(val) : "", ph));
    const wp = State.data.Settings.WealthPlan || {};
    el.innerHTML = `<div class="ox"><div class="ox-head"><span class="ox-logo">💎</span><div><h2>${esc(T("Net Worth"))}</h2><p>${esc(T("What you own minus what you owe, how it grows and how close you are to financial independence."))}</p></div></div>
      <div class="ox-kpis">${kpi(T("Net worth"), pln(n.net), T("assets minus debts"), n.net < 0 ? "bad" : "good")}${kpi(T("Assets"), pln(n.assets), T("savings and investments"))}${kpi(T("Liabilities"), pln(n.liabilities), T("loans and debts"), n.liabilities > 0 ? "" : "good")}
        ${kpi(hist.length >= 2 ? T("Change in {0} months", n.span) : T("Change"), hist.length >= 2 ? (n.change >= 0 ? "+" : "") + pln(n.change) : "–", n.pct !== null && hist.length >= 2 ? (n.pct >= 0 ? "+" : "") + pc(n.pct) : T("needs two months"), n.change < 0 ? "bad" : "good")}</div>
      <div class="nwp-grid"><div class="nw-card nwp-chart"><div class="oa-top"><h3>${esc(T("Net Worth History"))}</h3><small><i class="nwp-k" style="background:#35D399"></i>${esc(T("Net worth"))} <i class="nwp-k" style="background:#3B82F6"></i>${esc(T("Assets"))}</small></div>${chart}</div>
        <div class="nw-card"><div class="oa-top"><h3>${esc(T("Wealth Score"))}</h3></div><div class="nwp-score">${ring(s.wealth, String(s.wealth), "/100", 120)}<div>${part.map(p => `<div class="nwp-bar" data-go="${p[3]}"><span>${esc(p[0])}</span><b>${Math.round(p[1])}/${p[2]}</b><div class="tx-bar"><i style="width:${Math.round(p[1] / p[2] * 100)}%"></i></div></div>`).join("")}</div></div></div></div>
      <div class="nwp-grid3"><div class="nw-card"><div class="oa-top"><h3>${esc(T("Your Assets"))}</h3></div>${items.length ? `<div class="nwp-donut">${donut(items, pln(n.assets), "", 150)}<div class="tx-leg col">${items.map(x => `<span><u style="background:${x.color}"></u>${esc(x.label)} <b>${pc(x.value / Math.max(1, items.reduce((a, y) => a + y.value, 0)))}</b></span>`).join("")}</div></div>` : `<p class="hint">${esc(T("No assets yet."))}</p>`}</div>
        <div class="nw-card"><div class="oa-top"><h3>${esc(T("Your Liabilities"))}</h3></div>${(s.loansX || []).length ? (s.loansX).map(x => `<div class="nwp-row" data-go="loans"><span>${esc(x.name)}</span><b>${esc(pln(x.rem))}</b><em>${esc(String(x.rate).replace(".", ","))}%</em></div>`).join("") : `<p class="hint">${esc(T("You have no debts. That is a strong base for building wealth."))}</p>`}</div>
        <div class="nw-card"><div class="oa-top"><h3>${esc(T("Milestones"))}</h3></div><ul class="nwp-ms">${miles}</ul></div></div>
      <div class="nwp-grid"><div class="nw-card"><div class="oa-top"><h3>${esc(T("Financial Independence & Retirement"))}</h3></div>
        <div class="nwp-fi"><div class="nwp-fr">${ring(Math.min(100, w.progress * 100), pc(w.progress), "", 120)}<small>${esc(T("of your independence number"))}</small></div>
          <div class="nwp-fl"><div class="nwp-row"><span>${esc(T("Independence number"))}</span><b>${esc(pln(w.fiNumber))}</b></div><small class="hint">${esc(T("25 times your yearly spending in retirement: the 4% rule of thumb. A rough guide, not a promise."))}</small>
            <div class="nwp-row"><span>${esc(T("Time to reach it"))}</span><b>${esc(w.fiMonths === null ? T("more than 100 years") : years(w.fiMonths))}</b></div>
            ${w.projected !== null ? `<div class="nwp-row"><span>${esc(T("At {0} you could have", P.retireAge))}</span><b>${esc(pln(w.projected))}</b></div><div class="nwp-row"><span>${esc(T("Retirement readiness"))}</span><b class="${w.readiness >= 1 ? "good" : w.readiness < 0.5 ? "bad" : ""}">${pc(w.readiness)}</b></div>` : `<p class="hint">${esc(T("Add your age below to see your retirement readiness."))}</p>`}</div></div>
        <form id="wp-form" class="nwp-form"><div class="tx-f">${plan("age", T("Your age"), "35", wp.age)}${plan("retireAge", T("Retirement age"), "65", wp.retireAge)}${plan("spend", T("Spending per month in retirement"), plain(Math.round(s.spending || 0)), wp.spend)}${plan("contrib", T("Saved per month"), plain(Math.round(Math.max(0, s.left || 0))), wp.contrib)}${plan("ret", T("Expected return per year (%)"), "4", wp.ret)}</div>
          <small class="hint">${esc(T("Empty fields use your current numbers. The return is your own assumption, not a forecast."))}</small></form></div>
        <div class="nw-card"><div class="oa-top"><h3>${esc(T("Wealth Projection"))}</h3></div><div class="tp-mt-wrap"><table class="tp-mt"><thead><tr><th>${esc(T("In"))}</th><th>${esc(T("Net worth"))}</th></tr></thead><tbody>${proj.map(([y, v]) => `<tr><td>${esc(yrs(y))}</td><td><b>${esc(pln(v))}</b></td></tr>`).join("")}</tbody></table></div>
          <small class="hint">${esc(T("With {0} saved per month and {1}% a year. Debts are not repaid in this simple projection, so it is a rough guide.", pln(w.contrib), String(P.ret).replace(".", ",")))}</small></div></div>
      <small class="oa-note">${esc(T("General information based on your own numbers and assumptions. It is not personal financial advice."))}</small></div>`;
    el.querySelectorAll("#wp-form input").forEach(i => i.addEventListener("change", () => {
      const q = State.data.Settings.WealthPlan || (State.data.Settings.WealthPlan = {});
      q[i.name] = i.value.trim() === "" ? "" : num(i.value); save(); App.refresh();
    }));
  },
};
