// Module "Taxes & Payroll": a rough estimate gross ↔ net for an employment contract in Poland, with the tax bracket you fall into.
// All rates live in tax-rates.js. This is an estimate, not tax advice.
import { T, State, save, pln, num, plain, uuid } from "./core.js";
import { esc, card, field, numInput, textInput, select, check, confirmBox, toast, popup, download, stamp } from "./ui.js";
import { donut } from "./charts.js";
import { si, IC, ring } from "./page-head.js";

import { TAX, TAX_SOURCES } from "./tax-rates.js";

const r2 = x => Math.round(x * 100) / 100;

/** Twelve months of the same gross pay → monthly and yearly figures.
 *  o: raisedCosts, pit2, under26, bonus (gross, paid once a year, in December), ppk (take part), benefit (taxable employer benefit a month, not paid in cash), deduct (other deductions from net a month) */
export function calcYear(gross, o = {}) {
  const z = TAX.zus, kup = (o.raisedCosts ? TAX.kup.raised : TAX.kup.standard), ben = o.benefit || 0, bonuses = o.bonuses || [], bonus = bonuses.reduce((a, b) => a + b.amount, 0);
  gross += o.allowance || 0;
  let cum = 0, pen = 0, dis = 0, sick = 0, health = 0, base = 0, first = null, ppkEmp = 0, ppkEr = 0; const months = []; const pit = TAX.pit, red = o.pit2 === false ? 0 : pit.taxFree * pit.low, ex = o.under26 ? TAX.youngLimit : 0; let tPaid = 0, taxableC = 0;
  for (let m = 0; m < 12; m++) {
    const g = gross + ben + bonuses.filter(b => b.month === m).reduce((a, b) => a + b.amount, 0), pb = Math.min(g, Math.max(0, TAX.zusYearLimit - cum)); cum += g;
    const p = pb * z.pension, d = pb * z.disability, s = g * z.sickness, soc = p + d + s, h = (g - soc) * TAX.health;
    const pe = o.ppk ? g * TAX.ppk.employee : 0, pr = o.ppk ? g * TAX.ppk.employer : 0;
    pen += p; dis += d; sick += s; health += h; ppkEmp += pe; ppkEr += pr; base += Math.max(0, g - soc - kup + pr);
    // Polish payroll: tax is settled on the running total since January, so the 12% → 32% change happens in the month the total passes the threshold
    taxableC = Math.max(0, base - ex);
    const tCum = Math.max(tPaid, taxableC <= pit.threshold ? Math.max(0, taxableC * pit.low - red * (m + 1) / 12) : pit.threshold * pit.low - red + (taxableC - pit.threshold) * pit.high);
    months.push({ m, gross: g - ben, ins: p + d + s + h, ppk: pe, tax: tCum - tPaid, high: taxableC > pit.threshold, bonus: bonuses.filter(b => b.month === m).reduce((a, b) => a + b.amount, 0) }); tPaid = tCum;
    if (!first) first = { pension: r2(p), disability: r2(d), sickness: r2(s), health: r2(h), ppk: r2(pe), base: Math.max(0, g - soc - kup + pr) };
  }
  const B = Math.round(base), taxable = taxableC, tax = tPaid;
  const social = pen + dis + sick, grossYear = gross * 12 + bonus, deductYear = (o.deduct || 0) * 12;
  const netYear = grossYear - social - health - tax - ppkEmp - deductYear;   // benefits are taxed but not paid in cash: they cancel out below
  const cashYear = netYear;
  for (const x of months) { x.deduct = o.deduct || 0; x.net = x.gross - x.ins - x.ppk - x.tax - x.deduct; }
  first.tax = r2(months[0].tax); first.deduct = r2(o.deduct || 0); first.base = Math.round(first.base);
  first.net = r2(gross - first.pension - first.disability - first.sickness - first.health - first.ppk - first.tax - first.deduct);
  return { months, gross, grossYear, social: r2(social), health: r2(health), tax: r2(tax), ppk: r2(ppkEmp), deductYear: r2(deductYear), netYear: r2(cashYear), netMonth: r2(cashYear / 12), base: B, taxable, first, benefit: ben, bonus,
    over: Math.max(0, taxable - pit.threshold), room: Math.max(0, pit.threshold - taxable), effective: grossYear > 0 ? (social + health + tax) / grossYear : 0 };
}
/** Find the gross pay that gives the wanted net pay per month (bisection). */
export function grossFromNet(net, o) {
  if (!(net > 0)) return 0;
  let lo = net, hi = net * 3 + 1000;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; calcYear(mid, o).first.net < net ? lo = mid : hi = mid; }
  return r2((lo + hi) / 2);
}

const KINDS = {
  bonus: ["🎁", "Bonus (gross, once a year)"],
  allowance: ["➕", "Extra pay every month (gross)"],
  benefit: ["🏥", "Benefit from the employer (taxed, not paid in cash)"],
  deduct: ["➖", "Deduction from net pay every month"],
};
const SHORT = { bonus: "Bonus", allowance: "Monthly extra pay", benefit: "Benefit", deduct: "Deduction from net" };
const PRESETS = [["Private medical care", "benefit"], ["Sport card", "benefit"], ["Medical care for my child", "benefit"], ["Bonus", "bonus"], ["Meal allowance", "allowance"], ["Union fee", "deduct"], ["Loan instalment", "deduct"]];
const MONTHS = () => Array.from({ length: 12 }, (_, i) => [String(i), new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date(2026, i, 1))]);
const plan = () => { const s = State.data.Settings; if (!s.TaxPlan) s.TaxPlan = { mode: "gross", amount: "", raised: false, pit2: true, under26: false, ppk: false, items: [] }; if (!Array.isArray(s.TaxPlan.items)) s.TaxPlan.items = []; if (!Array.isArray(s.TaxPlan.jobs)) s.TaxPlan.jobs = []; return s.TaxPlan; };
/** The saved extras → the options of the calculation. */
export function planOpts(P) {
  const it = P.items || [], sum = k => it.filter(x => x.kind === k).reduce((a, x) => a + (x.amount || 0), 0);
  return { raisedCosts: P.raised, pit2: P.pit2, under26: P.under26, ppk: P.ppk, allowance: sum("allowance"), benefit: sum("benefit"), deduct: sum("deduct"),
    bonuses: it.filter(x => x.kind === "bonus").map(x => ({ amount: x.amount || 0, month: +x.month >= 0 ? +x.month : 11 })) };
}

const chev = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
const SRC_CHIPS = [["Ministry of Finance", TAX_SOURCES[2][1]], ["ZUS", TAX_SOURCES[0][1]], ["PIT regulations", TAX_SOURCES[1][1]], ["PPK", TAX_SOURCES[3][1]]];

/** Ways to keep more of the pay, worked out from the entered numbers. */
function insights(g, o, y) {
  const list = [];
  if (!o.raisedCosts) { const d = calcYear(g, { ...o, raisedCosts: true }).netYear - y.netYear; if (d > 1) list.push({ t: T("Check the raised costs of earning income"), d: T("If you work in a different town than you live in, the raised costs ({0} a month) can apply and would give you about {1} more a year.", pln(TAX.kup.raised), pln(d)), v: d }); }
  if (o.pit2 === false) { const d = calcYear(g, { ...o, pit2: true }).netYear - y.netYear; if (d > 1) list.push({ t: T("Submit PIT-2 to your employer"), d: T("With PIT-2 your employer uses the tax-free amount every month: about {0} more a year.", pln(d)), v: d }); }
  if (!o.ppk) list.push({ t: T("Look at PPK"), d: T("With PPK the employer adds {0}% of your gross ({1} a year) to your retirement savings; you pay {2}%. You can leave the plan.", TAX.ppk.employer * 100, pln(y.grossYear * TAX.ppk.employer), TAX.ppk.employee * 100), v: 0 });
  if (y.over > 0 || (y.room > 0 && y.taxable / TAX.pit.threshold >= 0.85)) list.push({ t: T("Mind the 32% bracket"), d: T("{0} of your income is taxed at 32% (or soon will be). Ask your employer about the timing of bonuses and about tax reliefs you may use in your tax return, for example the internet relief or a child relief.", pln(Math.max(y.over, 0))), v: 0 });
  if (!list.length) list.push({ t: T("Verify additional tax reliefs"), d: T("In your yearly tax return you can use reliefs that this estimate does not include, for example for children or donations."), v: 0 });
  return list;
}

export const Taxes = {
  route: "taxes", title: "Taxes & Payroll",
  render(el) {
    const P = plan(), pcx = n => (Math.round(n * 10) / 10).toString().replace(".", ",") + "%";
    const itemsHtml = () => {
      const it = P.items, tot = k => it.filter(x => x.kind === k).reduce((a, x) => a + (x.amount || 0), 0);
      return `<div class="tp-h"><span class="tp-hi">🎁</span><h3>${esc(T("Employee Benefits"))}</h3></div>
        ${it.length ? `<div class="tx-list">${it.map(x => `<div class="tx-it" data-id="${x.id}"><span class="tx-ic">${KINDS[x.kind][0]}</span><span class="tx-n"><b>${esc(x.name)}</b><small>${esc(T(SHORT[x.kind]))}${x.kind === "bonus" ? " · " + esc(MONTHS()[+x.month >= 0 ? +x.month : 11][1]) : ""}</small></span>
          <span class="tx-a"><input type="text" inputmode="decimal" value="${esc(plain(x.amount))}" data-it-amount="${x.id}" aria-label="${esc(T("Amount"))}"><em>zł</em></span><button class="icon-btn danger" data-it-del="${x.id}" title="${esc(T("Delete"))}">🗑</button></div>`).join("")}</div>
          <div class="tx-tot">${["bonus", "allowance", "benefit", "deduct"].filter(k => tot(k)).map(k => `<span>${KINDS[k][0]} ${esc(pln(tot(k)))}</span>`).join("")}</div>` : `<p class="hint mc-empty">${esc(T("No extras yet. Add bonuses, medical care, a sport card or deductions below."))}</p>`}
        <form id="tx-add" class="tx-add"><details class="tp-fold"${it.length ? "" : " open"}><summary><span>＋ ${esc(T("Add an item"))}</span>${chev}</summary>
          <div class="tx-chips">${PRESETS.map(([n, k]) => `<button type="button" class="chip" data-preset="${esc(n)}|${k}">${esc(T(n))}</button>`).join("")}</div>
          <div class="tx-f">${field(T("Name"), textInput("name", "", T("e.g. {0}", "Private medical care")))}${field(T("Type"), select("kind", Object.entries(KINDS).map(([k, v]) => [k, T(v[1])]), "benefit"))}
          ${field(T("Amount (zł)"), numInput("amount", "", "0"))}<span class="tx-mo" hidden>${field(T("Paid in"), select("month", MONTHS(), "11"))}</span></div>
          <button type="button" class="btn main" data-add-item>＋ ${esc(T("Add"))}</button></details></form>`;
    };
    const jobsHtml = () => `<div class="tp-h"><span class="tp-hi">👥</span><h3>${esc(T("More Incomes"))}</h3></div>
      <p class="hint">${esc(T("Do you have a second employment contract? Add it here. Every employer withholds tax on its own, and the tax-free amount is used at one employer only. At your yearly tax return all incomes are added up."))}</p>
      ${P.jobs.length ? `<div class="tx-list">${P.jobs.map(j => `<div class="tx-it"><span class="tx-ic">💼</span><span class="tx-n"><input type="text" value="${esc(j.name)}" data-job-name="${j.id}" aria-label="${esc(T("Name"))}"><small>${esc(T("Employment contract, gross per month"))}</small></span>
        <span class="tx-a"><input type="text" inputmode="decimal" value="${esc(plain(j.amount))}" data-job-amount="${j.id}" aria-label="${esc(T("Amount"))}"><em>zł</em></span><button class="icon-btn danger" data-job-del="${j.id}" title="${esc(T("Delete"))}">🗑</button></div>`).join("")}</div>` : ""}
      <button type="button" class="btn second" data-add-job>＋ ${esc(T("Add another income"))}</button>`;
    const kpi = (l, v, icon, go, cls = "in") => `<div class="kpi static clk" data-txgo="${go}"><span class="kpi-ic ${cls}">${si(IC[icon] || IC.bars)}</span><span class="kpi-t"><span class="kpi-l">${esc(l)}</span><b>${esc(v)}</b></span></div>`;
    el.innerHTML = `<div class="ni-page tx-page tp">
      <div class="tp-head"><span class="tp-logo">⚖️</span><div><h2>${esc(T("Taxes & Payroll Intelligence Center"))}</h2><p>${esc(T("Estimate salary, taxes, contributions and discover optimization opportunities."))}</p></div>
        <label class="tp-country"><svg class="tp-flag" viewBox="0 0 28 20" width="22" height="16" aria-hidden="true"><rect width="28" height="10" fill="#f8fafc"/><rect y="10" width="28" height="10" fill="#dc2626"/></svg> <select disabled aria-label="${esc(T("Country"))}"><option>${esc(T("Poland"))}</option></select></label></div>
      <div class="ov-kpis">${kpi(T("Tax Year"), String(TAX.year), "star", "sources")}${kpi(T("Primary Income Tax Rate"), "12%", "percent", "how", "rate")}${kpi(T("Tax-Free Amount"), pln(TAX.pit.taxFree), "coins", "how")}${kpi(T("32% Threshold"), pln(TAX.pit.threshold), "bars", "bracket", "left")}</div>
      <p class="tx-pl"><svg class="tp-flag" viewBox="0 0 28 20" width="22" height="16" aria-hidden="true"><rect width="28" height="10" fill="#f8fafc"/><rect y="10" width="28" height="10" fill="#dc2626"/></svg> ${esc(T("Poland only for now: these are Polish rules for {0}. Other countries may follow.", TAX.year))}</p>
      <div class="tp-main">
        <div class="tp-left">
          <div class="nw-card ov-card tp-card"><div class="tp-h"><span class="tp-hi">💼</span><h3>${esc(T("Salary Inputs"))}</h3></div>
            <form id="tax-form">
              ${field(T("Contract Type"), select("contract", [["uop", T("Employment Contract")]], "uop"))}
              <div class="tp-two-in">${field(T("Gross Salary (brutto, per month)"), numInput("amount", P.mode === "gross" ? plain(P.amount) : "", T("e.g. {0}", "10000")))}${field(T("Net Salary (netto, per month)"), numInput("netamount", P.mode === "net" ? plain(P.amount) : "", T("e.g. {0}", "7200")))}</div><p class="hint">${esc(T("Type either one: the other is calculated for you."))}</p>
              <details class="tp-fold"><summary><span>⚙️ ${esc(T("Tax Settings"))}</span>${chev}</summary>
                ${check("raised", T("Raised costs of earning income (you work in another town)"), P.raised)}
                ${check("pit2", T("Tax-free amount used at your employer (PIT-2 submitted)"), P.pit2)}
                ${check("under26", T("Under 26 – no income tax up to {0} a year", pln(TAX.youngLimit)), P.under26)}</details>
              <details class="tp-fold"><summary><span>🎚️ ${esc(T("Advanced Options"))}</span>${chev}</summary>
                ${check("ppk", T("I take part in PPK (you pay {0}%, the employer {1}%)", TAX.ppk.employee * 100, TAX.ppk.employer * 100), P.ppk)}</details>
            </form></div>
          <div class="nw-card ov-card tp-card" id="tx-jobs">${jobsHtml()}</div>
          <div class="nw-card ov-card tp-card" id="tx-items">${itemsHtml()}</div></div>
        <div class="tp-right">
          <div class="nw-card ov-card tp-card" id="tx-sum"></div>
          <div class="tp-two"><div class="nw-card ov-card tp-card" id="tx-brk"></div><div class="nw-card ov-card tp-card" id="tx-ins"></div></div></div>
      </div>
      <div class="nw-card ov-card tp-card" id="tx-all" style="margin-top:14px" hidden></div>
      <div class="nw-card ov-card tp-card" id="tx-mon" style="margin-top:14px"></div>
      <div class="tp-two tp-bot"><div class="nw-card ov-card tp-card" id="tx-ann"></div>
        <div class="nw-card ov-card tp-card tp-src" id="tx-sources"><div class="tp-srch"><span class="tp-info">i</span><h3>${esc(T("Official Sources"))}</h3></div>
          <div class="tx-chips">${SRC_CHIPS.map(([n, u]) => `<a class="chip" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(T(n))} ↗</a>`).join("")}</div>
          <p class="hint">${esc(T("Rates and limits for {0}, checked {1}. They are kept in one file inside MoneyCompass and updated once a year.", TAX.year, TAX.checked))}</p>
          <details class="tx-how" id="tx-how"><summary>${esc(T("How the estimate is calculated"))}</summary><ol class="hint">
            <li>${esc(T("Social insurance: pension {0}%, disability {1}%, sickness {2}% of the gross. Pension and disability stop above {3} a year.", TAX.zus.pension * 100, TAX.zus.disability * 100, (TAX.zus.sickness * 100).toFixed(2).replace(/\.?0+$/, ""), pln(TAX.zusYearLimit)))}</li>
            <li>${esc(T("Health insurance: {0}% of the gross minus social insurance (not deductible from tax).", TAX.health * 100))}</li>
            <li>${esc(T("Income tax: gross − social insurance − costs of earning income ({0} or {1} a month) = tax base; {2}% up to {3} a year, {4}% above; minus {5} for the tax-free amount.", pln(TAX.kup.standard), pln(TAX.kup.raised), TAX.pit.low * 100, pln(TAX.pit.threshold), TAX.pit.high * 100, pln(TAX.pit.taxFree * TAX.pit.low)))}</li>
            <li>${esc(T("Net = gross − insurance − tax. Twelve months of the same pay, the tax is settled over the whole year."))}</li></ol></details></div></div>
      <div class="tx-disc"><b>⚠ ${esc(T("Important"))}</b>
        <p>${esc(T("This is a rough estimate for information only. It is not tax, legal or payroll advice, and it may differ from your real pay slip, because of bonuses, overtime, other contracts, reliefs, rounding, changes in the law and your personal tax return. MoneyCompass does not guarantee that the figures are correct or up to date and is not liable for decisions made on them. Check your real numbers with your payroll department, the tax office (KAS/ZUS) or a tax adviser."))}</p></div></div>`;
    const form = el.querySelector("#tax-form"), box = el.querySelector("#tx-items");
    const set = (id, html) => { el.querySelector("#" + id).innerHTML = html; };
    const empty = T("Enter a gross salary to see the estimate.");
    const draw = () => {
      const v = num(P.amount) || 0, o = planOpts(P);
      const other = P.mode === "gross" ? form.netamount : form.amount;
      const head = (ic, t) => `<div class="tp-h"><span class="tp-hi">${ic}</span><h3>${esc(t)}</h3></div>`;
      if (!(v > 0)) { el.querySelector("#tx-all").hidden = true; other.value = ""; for (const [id, ic, t] of [["tx-sum", "🧮", "Payroll Summary"], ["tx-brk", "🥧", "Salary Breakdown"], ["tx-ins", "💡", "MoneyCompass Optimization Insights"], ["tx-ann", "📈", "Annual Projection"], ["tx-mon", "📅", "Monthly Payment Overview"]]) set(id, head(ic, T(t)) + `<p class="hint mc-empty">${esc(empty)}</p>`); return; }
      const g = P.mode === "gross" ? v : grossFromNet(v, o), y = calcYear(g, o), f = y.first, p = TAX.pit;
      const extras = P.jobs.map(j => ({ j, y: calcYear(num(j.amount) || 0, { pit2: false }) })).filter(e => e.y.grossYear > 0), ALL = [y, ...extras.map(e => e.y)];
      const sumA = k => ALL.reduce((a, x) => a + x[k], 0);
      const mm = extras.length ? y.months.map((x, i) => { const r = { m: x.m, bonus: x.bonus, high: ALL.some(a => a.months[i].high) }; for (const k of ["gross", "net", "tax", "ins", "ppk", "deduct"]) r[k] = ALL.reduce((a, z) => a + z.months[i][k], 0); return r; }) : y.months;
      const A = { grossYear: sumA("grossYear"), netYear: sumA("netYear"), tax: sumA("tax") };
      { const box2 = el.querySelector("#tx-all"); box2.hidden = !extras.length;
        if (extras.length) {
          const base = ALL.reduce((a, x) => a + x.taxable, 0), pt = TAX.pit, red = pt.taxFree * pt.low, trueTax = Math.max(0, base <= pt.threshold ? base * pt.low - red : pt.threshold * pt.low - red + (base - pt.threshold) * pt.high), diff = trueTax - A.tax;
          const nm = [T("Main income"), ...extras.map(e => e.j.name || T("Other income"))];
          box2.innerHTML = head("👥", T("All Incomes Together")) + `<div class="tp-mt-wrap"><table class="tp-mt"><thead><tr><th>${esc(T("Income"))}</th><th>${esc(T("Gross (brutto)"))}</th><th>${esc(T("Net (netto)"))}</th><th>${esc(T("Tax paid"))} / ${esc(T("per year"))}</th></tr></thead><tbody>
            ${ALL.map((x, i) => `<tr><td>${esc(nm[i])}</td><td>${esc(pln(x.gross))}</td><td><b class="good">${esc(pln(x.first.net))}</b></td><td>${esc(pln(x.tax))}</td></tr>`).join("")}</tbody>
            <tfoot><tr><td>${esc(T("Together"))}</td><td>${esc(pln(ALL.reduce((a, x) => a + x.gross, 0)))}</td><td><b class="good">${esc(pln(ALL.reduce((a, x) => a + x.first.net, 0)))}</b></td><td>${esc(pln(A.tax))}</td></tr></tfoot></table></div>
            <p class="${Math.abs(diff) > 1 ? "tp-warn" : "hint"}">${esc(Math.abs(diff) <= 1 ? T("Your yearly tax return should come out about even.") : diff > 0 ? T("Your employers together withhold about {0} too little. At your yearly tax return (PIT-37) you will probably pay about {0} more. Keep this money aside.", pln(diff)) : T("Your employers together withhold about {0} too much. You will probably get about {0} back with your yearly tax return (PIT-37).", pln(-diff)))}</p>
            <p class="hint">${esc(T("Combined income for the year: {0} tax base. Social insurance is counted for every income separately here; if your pay is above the yearly limit, ask your employer about it.", pln(base)))}</p>`; } }
      if (document.activeElement !== other) other.value = plain(P.mode === "gross" ? f.net : g);
      const mo = f.pension + f.disability + f.sickness, deductions = y.social + y.health + y.tax, eff = y.grossYear > 0 ? deductions / y.grossYear * 100 : 0;
      const util = Math.min(100, Math.round(y.taxable / p.threshold * 100)), within = y.over <= 0;
      const row = (l, a, cls = "") => `<div class="tp-r ${cls}"><span>${esc(l)}</span><b>${esc(pln(a))}</b></div>`;
      set("tx-sum", head("🧮", T("Payroll Summary")) + `<div class="tp-sum">
        <div class="tp-s1">${row(T("Gross Salary"), y.gross)}${row(y.bonus ? T("Net Salary (normal month)") : T("Net Salary"), f.net, "tp-net")}${row(T("Income Tax"), f.tax)}${row(T("Health Insurance"), f.health)}${row(T("Social Security"), mo)}${o.ppk ? row(T("PPK (your share)"), f.ppk) : ""}${f.deduct ? row(T("Other deductions"), f.deduct) : ""}
          ${y.bonus ? `<small class="hint">${esc(T("Average over the year: {0}", pln(y.netMonth)))}</small>` : ""}</div>
        <div class="tp-s2"><small>${esc(T("Effective Tax Rate"))}</small>${ring(Math.min(100, eff), pcx(eff), "", 150)}<small class="hint">${esc(T("Insurance and tax together"))}</small></div>
        <div class="tp-s3"><small>${esc(T("Tax Bracket Status"))}</small><b class="${within ? "good" : "warn"}">${within ? "✅ " + esc(T("Within Threshold")) : "⚠️ " + esc(T("Above the 32% threshold"))}</b>
          <small>${esc(T("Current Annual Income"))}</small><b>${esc(pln(y.taxable))}</b><small>${esc(T("Threshold Utilization"))}</small>
          <div class="tp-util"><div class="tx-bar"><i style="width:${util}%"></i></div><b>${util}%</b></div>
          <small class="hint">${esc(within ? T("{0} a year of room before 32% starts.", pln(y.room)) : T("{0} a year is taxed at 32%.", pln(y.over)))}</small></div></div>`);
      const parts = [[T("Net Pay"), f.net, "#34d399"], [T("Tax"), f.tax, "#f59e0b"], [T("Social Security"), mo, "#3b9bea"], [T("Health Insurance"), f.health, "#8b5cf6"], ...(o.ppk ? [[T("PPK"), f.ppk, "#ec4899"]] : []), ...(f.deduct ? [[T("Other deductions"), f.deduct, "#94a3b8"]] : [])].filter(x => x[1] > 0), sumP = parts.reduce((a, x) => a + x[1], 0) || 1;
      set("tx-brk", head("🥧", T("Salary Breakdown")) + `<div class="tp-brk"><div class="tx-donut">${donut(parts.map(x => ({ label: x[0], value: x[1], color: x[2] })), "", "")}<div class="tp-dc"><b>${esc(pln(f.net))}</b><small>${esc(T("Net Pay"))}</small></div></div>
        <div class="tx-leg col">${parts.map(x => `<span><u style="background:${x[2]}"></u>${esc(x[0])} <b>${Math.round(x[1] / sumP * 100)}%</b></span>`).join("")}</div></div>`);
      const ins = insights(g, o, y), ben = ins.reduce((a, x) => a + x.v, 0);
      set("tx-ins", head("💡", T("MoneyCompass Optimization Insights")) + `<div class="tp-ib"><div><small>${esc(T("Potential Annual Benefit"))}</small><b class="good">${ben > 0 ? "+" + esc(pln(ben)) : "–"}</b></div><div><small>${esc(T("Recommendations Found"))}</small><b>${ins.length}</b></div></div>
        <ol class="tp-tips">${ins.slice(0, 3).map(x => `<li>${esc(x.t)}</li>`).join("")}</ol><button type="button" class="btn main" data-ins-details>${esc(T("View Details"))} →</button>`);
      el.querySelector("[data-ins-details]").onclick = () => popup(`<div class="nw-hd"><span class="nw-hi">💡</span><div><h2>${esc(T("Optimization Insights"))}</h2><p class="nw-sub">${esc(T("Ideas to keep more of your pay. Check them with your payroll department or a tax adviser."))}</p></div><button class="nw-x" data-close aria-label="${esc(T("Close"))}">✕</button></div>
        <div class="sc-body" style="display:grid;gap:10px">${ins.map((x, i) => `<div class="nw-card" style="padding:14px"><b>${i + 1}. ${esc(x.t)}</b><p style="margin:6px 0">${esc(x.d)}</p>${x.v > 0 ? `<b class="good">+${esc(pln(x.v))} / ${esc(T("per year"))}</b>` : ""}</div>`).join("")}</div>
        <div class="nw-ft"><button class="btn second" data-close>${esc(T("Close"))}</button></div>`, { width: 600, cls: "nw-win sc-win" });
      { const loc = document.documentElement.lang || "en", mn = i => new Date(2026, i, 1).toLocaleString(loc, { month: "short" }), M = mm, sum = k => M.reduce((a, x) => a + x[k], 0);
        set("tx-mon", head("📅", T("Monthly Payment Overview")) + `<div class="tp-mt-wrap"><table class="tp-mt"><thead><tr><th>${esc(T("Month"))}</th><th>${esc(T("Gross (brutto)"))}</th><th>${esc(T("Net (netto)"))}</th><th>${esc(T("Tax paid"))}</th><th>${esc(T("Insurance (ZUS + health)"))}</th><th>${esc(T("PPK"))}</th><th>${esc(T("Deductions"))}</th></tr></thead><tbody>
          ${M.map(x => `<tr class="${x.high ? "hi" : ""}${x.bonus ? " bon" : ""}"><td>${esc(mn(x.m))}${x.bonus ? " 🎁" : ""}${x.high ? ` <span class="tp-c32">32%</span>` : ""}</td><td>${esc(pln(x.gross))}</td><td><b class="good">${esc(pln(x.net))}</b></td><td>${esc(pln(x.tax))}</td><td>${esc(pln(x.ins))}</td><td>${esc(pln(x.ppk))}</td><td>${esc(pln(x.deduct))}</td></tr>`).join("")}
          </tbody><tfoot><tr><td>${esc(T("Year"))}</td><td>${esc(pln(sum("gross")))}</td><td><b class="good">${esc(pln(sum("net")))}</b></td><td>${esc(pln(sum("tax")))}</td><td>${esc(pln(sum("ins")))}</td><td>${esc(pln(sum("ppk")))}</td><td>${esc(pln(sum("deduct")))}</td></tr></tfoot></table></div>
          ${(() => { const k = M.findIndex(x => x.high); if (k < 0) return ""; const a = M[k + 1] && !M[k + 1].bonus ? M[k + 1] : M[k]; return `<p class="tp-warn">${esc(T("From {0} your income since January is above {1}, so the tax goes up from 12% to 32% on the rest of the year. Your net falls from about {2} to about {3} a month.", mn(M[k].m), pln(TAX.pit.threshold), pln(M[0].net), pln(a.net)))}</p>`; })()}
          <div class="tp-exp"><button class="btn main" data-mon-csv>⬇ ${esc(T("Export to Excel (CSV)"))}</button><button class="btn second" data-mon-print>🖨 ${esc(T("Print / save as PDF"))}</button></div>
          <p class="hint">${esc(T("Month by month, as it would arrive on your account. Polish payroll counts your income from January onward, so the tax steps up in the month the total passes the threshold. A month with a bonus 🎁 pays more tax. Estimate only."))}</p>`); }
      { const M = mm, nf = v => (Math.round(v * 100) / 100).toFixed(2).replace(".", ","), loc = document.documentElement.lang || "en", mn = i => new Date(2026, i, 1).toLocaleString(loc, { month: "long" });
        const hd = [T("Month"), T("Gross (brutto)"), T("Net (netto)"), T("Tax paid"), T("Insurance (ZUS + health)"), T("PPK"), T("Deductions")];
        const rows = M.map(x => [mn(x.m), x.gross, x.net, x.tax, x.ins, x.ppk, x.deduct]), tot = [T("Year"), ...[1, 2, 3, 4, 5, 6].map(i => rows.reduce((a, r) => a + r[i], 0))];
        const q = c => `"${String(c).replace(/"/g, '""')}"`;
        el.querySelector("[data-mon-csv]").onclick = () => download(`MoneyCompass-payroll-${stamp()}.csv`, "\ufeff" + [hd.map(q).join(";"), ...[...rows, tot].map(r => r.map((c, i) => i ? nf(c) : q(c)).join(";"))].join("\r\n") + "\r\n" + q(T("Estimate only, not tax advice. Polish rules for {0}.", TAX.year)) + "\r\n", "text/csv;charset=utf-8");
        el.querySelector("[data-mon-print]").onclick = () => { const w = window.open("", "_blank"); if (!w) { toast(T("Allow pop-ups to print.")); return; }
          w.document.write(`<!doctype html><meta charset="utf-8"><title>MoneyCompass – ${esc(T("Monthly Payment Overview"))}</title><style>body{font:14px system-ui,sans-serif;margin:28px;color:#111}table{border-collapse:collapse;width:100%}th,td{padding:6px 8px;border-bottom:1px solid #ddd;text-align:right}th:first-child,td:first-child{text-align:left}tfoot td{font-weight:700;border-top:2px solid #111}small{color:#555}</style><h2>${esc(T("Monthly Payment Overview"))} – ${esc(String(TAX.year))}</h2><table><thead><tr>${hd.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td>${i ? esc(pln(c)) : esc(c)}</td>`).join("")}</tr>`).join("")}</tbody><tfoot><tr>${tot.map((c, i) => `<td>${i ? esc(pln(c)) : esc(c)}</td>`).join("")}</tr></tfoot></table><p><small>${esc(T("Estimate only, not tax advice. Polish rules for {0}.", TAX.year))}</small></p>`);
          w.document.close(); w.focus(); setTimeout(() => w.print(), 300); }; }
      if (extras.length) el.querySelector("#tx-sum").insertAdjacentHTML("beforeend", `<p class="hint" style="margin-top:8px">${esc(T("This summary shows your main income only. All incomes together are in the table below."))}</p>`);
      set("tx-ann", head("📈", T("Annual Projection")) + `<div class="tp-ann"><div><small>${esc(T("Annual Gross"))}</small><b>${esc(pln(A.grossYear))}</b></div><div><small>${esc(T("Annual Net"))}</small><b class="good">${esc(pln(A.netYear))}</b></div><div><small>${esc(T("Annual Taxes"))}</small><b>${esc(pln(A.tax))}</b></div></div>
        <p class="hint">${esc(T("You keep {0} of your gross pay.", Math.round(A.netYear / A.grossYear * 100) + "%"))}${y.grossYear > TAX.zusYearLimit ? " " + esc(T("Pension and disability insurance stop once your gross for the year passes {0}.", pln(TAX.zusYearLimit))) : ""}${y.benefit ? " " + esc(T("Benefits are taxed like pay but you do not receive them as cash, so they only lower your net.")) : ""}</p>`);
    };
    const bindItems = () => {
      const f = box.querySelector("#tx-add"), setMo = () => { box.querySelector(".tx-mo").hidden = f.kind.value !== "bonus"; };
      f.kind.onchange = setMo; setMo();
      box.querySelectorAll("[data-preset]").forEach(b => b.onclick = () => { const [n, k] = b.dataset.preset.split("|"); f.name.value = T(n); f.kind.value = k; setMo(); f.amount.focus(); });
      box.querySelector("[data-add-item]").onclick = () => {
        const amount = num(f.amount.value), name = f.name.value.trim();
        if (!name || !(amount > 0)) { toast(T("Please enter a name and an amount bigger than 0."), "bad"); return; }
        P.items.push({ id: uuid(), name, kind: f.kind.value, amount, month: f.kind.value === "bonus" ? +f.month.value : null }); save(); box.innerHTML = itemsHtml(); bindItems(); draw();
      };
      box.querySelectorAll("[data-it-amount]").forEach(i => i.onchange = () => { const it = P.items.find(x => x.id === i.dataset.itAmount); if (it) { it.amount = num(i.value) || 0; save(); box.innerHTML = itemsHtml(); bindItems(); draw(); } });
      box.querySelectorAll("[data-it-del]").forEach(b => b.onclick = async () => {
        const it = P.items.find(x => x.id === b.dataset.itDel); if (!it) return;
        if (await confirmBox(T("Delete this item?"), it.name, T("Delete"), T("Cancel"), true)) { P.items = P.items.filter(x => x !== it); save(); box.innerHTML = itemsHtml(); bindItems(); draw(); }
      });
    };
    const jb = el.querySelector("#tx-jobs");
    const bindJobs = () => {
      jb.querySelector("[data-add-job]").onclick = () => { P.jobs.push({ id: uuid(), name: T("Second job"), amount: 0 }); save(); jb.innerHTML = jobsHtml(); bindJobs(); jb.querySelector(`[data-job-amount="${P.jobs[P.jobs.length - 1].id}"]`)?.focus(); draw(); };
      jb.querySelectorAll("[data-job-name]").forEach(i => i.onchange = () => { const j = P.jobs.find(x => x.id === i.dataset.jobName); if (j) { j.name = i.value.trim(); save(); draw(); } });
      jb.querySelectorAll("[data-job-amount]").forEach(i => i.oninput = () => { const j = P.jobs.find(x => x.id === i.dataset.jobAmount); if (j) { j.amount = num(i.value) || 0; save(); draw(); } });
      jb.querySelectorAll("[data-job-del]").forEach(b => b.onclick = async () => {
        const j = P.jobs.find(x => x.id === b.dataset.jobDel); if (!j) return;
        if (await confirmBox(T("Delete this income?"), j.name, T("Delete"), T("Cancel"), true)) { P.jobs = P.jobs.filter(x => x !== j); save(); jb.innerHTML = jobsHtml(); bindJobs(); draw(); }
      });
    };
    form.onsubmit = ev => ev.preventDefault();
    form.addEventListener("input", ev => { const n = ev.target.name; if (n === "amount" || n === "netamount") { P.mode = n === "amount" ? "gross" : "net"; P.amount = ev.target.value; save(); draw(); } });
    form.addEventListener("change", () => { P.raised = form.raised.checked; P.pit2 = form.pit2.checked; P.under26 = form.under26.checked; P.ppk = form.ppk.checked; save(); draw(); });
    el.querySelectorAll("[data-txgo]").forEach(k => k.onclick = () => {
      const w = k.dataset.txgo, t = el.querySelector(w === "bracket" ? "#tx-sum" : w === "how" ? "#tx-how" : "#tx-sources");
      if (w === "how" && t) t.open = true;
      t?.scrollIntoView({ behavior: "smooth", block: "center" });
      t?.classList.add("flash"); setTimeout(() => t?.classList.remove("flash"), 1200);
    });
    bindItems(); bindJobs(); draw();
  }
};
