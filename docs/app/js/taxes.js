// Module "Taxes & Payroll": a rough estimate gross ↔ net for an employment contract in Poland, with the tax bracket you fall into.
// All rates live in tax-rates.js. This is an estimate, not tax advice.
import { T, State, save, pln, num, plain, uuid, mainCur } from "./core.js";
import { esc, card, field, numInput, textInput, select, check, confirmBox, toast, popup, download, stamp } from "./ui.js";
import { donut } from "./charts.js";
import { si, IC, ring } from "./page-head.js";

import { TAX, TAX_SOURCES } from "./tax-rates.js";

const r2 = x => Math.round(x * 100) / 100;

/** Twelve months of the same gross pay → monthly and yearly figures.
 *  o: raisedCosts, pit2, under26, bonus (gross, paid once a year, in December), ppk (take part), benefit (taxable employer benefit a month, not paid in cash), deduct (other deductions from net a month) */
function calcEmp(gross, o = {}) {
  const ct = o.contract || "uop", noS = !!o.noSocial || ct === "dzielo" || (ct === "zlecenie" && !!o.student), noH = ct === "dzielo" || (ct === "zlecenie" && !!o.student), noSick = ct === "zlecenie" && !o.sickVol; let kupLeft = o.kupRate === TAX.zlecenie.kupCopyright ? TAX.zlecenie.copyrightLimit : Infinity;
  const z = TAX.zus, kup = (o.raisedCosts ? TAX.kup.raised : TAX.kup.standard), ben = o.benefit || 0, bonuses = o.bonuses || [], bonus = bonuses.reduce((a, b) => a + b.amount, 0);
  gross += o.allowance || 0;
  let cum = 0, pen = 0, dis = 0, sick = 0, health = 0, base = 0, first = null, ppkEmp = 0, ppkEr = 0; const months = []; const pit = TAX.pit, red = o.pit2 === false ? 0 : pit.taxFree * pit.low, ex = o.under26 || (ct === "zlecenie" && o.student) ? TAX.youngLimit : 0; let tPaid = 0, taxableC = 0, zTax = 0, sickDays = 0;
  if (o.sick && o.sick.length) { var normal = calcEmp(gross - (o.allowance || 0), { ...o, sick: [] }).first; }
  let cnt = 0;
  for (let m = 0; m < 12; m++) {
    if (m < (o.from || 0) || m > (o.to ?? 11)) { months.push({ m, gross: 0, ins: 0, ppk: 0, tax: 0, sick: 0, manualNet: 0, high: taxableC > pit.threshold, bonus: 0 }); continue; }
    cnt++;
    const gm = (o.raise && m >= o.raise.month && o.raise.gross > 0 ? o.raise.gross : gross - (o.allowance || 0)) + (o.allowance || 0);
    const sk = (o.sick || []).filter(x => x.month === m), sd = Math.min(30, sk.reduce((a, x) => a + (x.days || 0), 0)), manualNet = sk.find(x => x.net > 0);
    // sick leave (auto): 80% of the pay after social insurance, per day = / 30. The employer pays the first 33 days of the year, ZUS the rest.
    let dE = 0, dZ = 0; if (sd > 0 && !manualNet) { dE = Math.max(0, Math.min(sd, TAX.sick.employerDays - sickDays)); dZ = sd - dE; } sickDays += sd;
    const daily = gm * (1 - z.pension - z.disability - z.sickness) / 30 * TAX.sick.rate, sickPay = daily * dE, zusBen = daily * dZ, hz = zusBen * TAX.health, tz = zusBen * pit.low; zTax += tz;
    const g = gm * (30 - dE - dZ) / 30 + sickPay + ben + bonuses.filter(b => b.month === m).reduce((a, b) => a + b.amount, 0), pb = Math.min(g, Math.max(0, TAX.zusYearLimit - cum)); cum += g;
    const p = noS ? 0 : pb * z.pension, d = noS ? 0 : pb * z.disability, s = noS || noSick ? 0 : (g - sickPay) * z.sickness, soc = p + d + s, h = noH ? 0 : (g - soc) * TAX.health;
    const kupM = o.kupRate ? Math.min(Math.max(0, g - soc) * o.kupRate, kupLeft) : kup; kupLeft -= kupM;
    const pe = o.ppk ? g * TAX.ppk.employee : 0, pr = o.ppk ? g * TAX.ppk.employer : 0;
    pen += p; dis += d; sick += s; health += h + hz; ppkEmp += pe; ppkEr += pr; base += Math.max(0, g - soc - kupM + pr);
    // Polish payroll: tax is settled on the running total since January, so the 12% → 32% change happens in the month the total passes the threshold
    taxableC = Math.max(0, base - ex);
    const tCum = Math.max(tPaid, taxableC <= pit.threshold ? Math.max(0, taxableC * pit.low - red * cnt / 12) : pit.threshold * pit.low - red + (taxableC - pit.threshold) * pit.high);
    months.push({ m, gross: g - ben + zusBen, ins: p + d + s + h + hz, ppk: pe, tax: tCum - tPaid + tz, sick: sd, manualNet: manualNet ? manualNet.net : 0, high: taxableC > pit.threshold, bonus: bonuses.filter(b => b.month === m).reduce((a, b) => a + b.amount, 0) }); tPaid = tCum;
    if (!first) first = { pension: r2(p), disability: r2(d), sickness: r2(s), health: r2(h), ppk: r2(pe), base: Math.max(0, g - soc - kupM + pr) };
  }
  if (!first) first = { pension: 0, disability: 0, sickness: 0, health: 0, ppk: 0, base: 0 };
  const B = Math.round(base), taxable = taxableC, tax = tPaid + zTax;
  const social = pen + dis + sick, grossYear = months.reduce((a, x) => a + x.gross, 0), deductYear = (o.deduct || 0) * 12;
  let netYear = 0;   // benefits are taxed but not paid in cash: they cancel out below
  for (const x of months) { x.deduct = o.deduct || 0; x.net = x.manualNet || (x.gross - x.ins - x.ppk - x.tax - x.deduct); netYear += x.net; }
  const cashYear = netYear;
  first.tax = r2(months[Math.min(11, o.from || 0)].tax); first.deduct = r2(o.deduct || 0); first.base = Math.round(first.base);
  if (normal) Object.assign(first, normal);
  else first.net = r2(gross - first.pension - first.disability - first.sickness - first.health - first.ppk - first.tax - first.deduct);
  return { months, gross, grossYear, social: r2(social), health: r2(health), tax: r2(tax), ppk: r2(ppkEmp), deductYear: r2(deductYear), netYear: r2(cashYear), netMonth: r2(cashYear / 12), base: B, taxable, first, benefit: ben, bonus,
    over: Math.max(0, taxable - pit.threshold), room: Math.max(0, pit.threshold - taxable), effective: grossYear > 0 ? (social + health + tax) / grossYear : 0 };
}
/** Own business (B2B): `gross` = revenue a month without VAT; o.costs = business costs a month. Same result shape as calcEmp. */
function calcB2B(gross, o = {}) {
  const B = TAX.b2b, pit = TAX.pit, zt = o.zus || "full", zp = B.zusPlus, Z = zt === "plus" ? { ...B.zus.pref, base: Math.min(zp.max, Math.max(zp.min, Math.round((num(o.zusPlusIncome) || 0) / 365 * 30 * zp.factor * 100) / 100)) } : B.zus[zt], costs = o.costs || 0, form = o.taxForm || "linear", rate = o.lumpRate || 0.12;
  const socM = zt === "none" ? 0 : Z.base * (Z.pension + Z.disability + Z.accident + Z.fund + (o.zusSick ? Z.sickness : 0));
  const socP = zt === "none" ? 0 : Z.base * Z.pension, socD = zt === "none" ? 0 : Z.base * Z.disability, socS = zt === "none" ? 0 : socM - socP - socD;
  const red = pit.taxFree * pit.low, months = []; let base = 0, tPaid = 0, healthY = 0, taxableC = 0, dedLeft = B.healthDeductLimit;
  const lumpHealth = B.health.lump.find(([lim]) => gross * 12 <= lim)[1] * B.health.scale;
  for (let m = 0; m < 12; m++) {
    const inc = Math.max(0, gross - costs - socM), min = m === 0 ? B.health.minJan : B.health.min;
    const h = form === "lump" ? lumpHealth : Math.max(min, inc * (form === "linear" ? B.health.linear : B.health.scale));
    let tCum;
    if (form === "linear") { const dd = Math.min(h, dedLeft); dedLeft -= dd; base += Math.max(0, inc - dd); taxableC = base; tCum = taxableC * B.linear; }
    else if (form === "lump") { base += Math.max(0, gross - socM); taxableC = base; tCum = taxableC * rate; }
    else { base += inc; taxableC = Math.max(0, base - (o.under26 ? TAX.youngLimit : 0)); tCum = Math.max(tPaid, taxableC <= pit.threshold ? Math.max(0, taxableC * pit.low - (o.pit2 === false ? 0 : red) * (m + 1) / 12) : pit.threshold * pit.low - (o.pit2 === false ? 0 : red) + (taxableC - pit.threshold) * pit.high); }
    tCum = Math.max(tPaid, tCum); healthY += h;
    months.push({ m, gross, ins: socM + h, ppk: 0, tax: tCum - tPaid, deduct: costs, bonus: 0, sick: 0, high: form === "scale" && taxableC > pit.threshold }); tPaid = tCum;
  }
  let netYear = 0; for (const x of months) { x.net = x.gross - x.ins - x.tax - x.deduct; netYear += x.net; }
  const grossYear = gross * 12, f = months[0], first = { pension: r2(socP), disability: r2(socD), sickness: r2(socS), health: r2(f.ins - socM), ppk: 0, tax: r2(f.tax), deduct: r2(costs), base: Math.round(base / 12), net: r2(f.net) };
  return { months, gross, grossYear, social: r2(socM * 12), health: r2(healthY), tax: r2(tPaid), ppk: 0, deductYear: r2(costs * 12), netYear: r2(netYear), netMonth: r2(netYear / 12), base: Math.round(base), taxable: taxableC, first, benefit: 0, bonus: 0,
    over: form === "scale" ? Math.max(0, taxableC - pit.threshold) : 0, room: form === "scale" ? Math.max(0, pit.threshold - taxableC) : 0, effective: grossYear > 0 ? (socM * 12 + healthY + tPaid) / grossYear : 0 };
}
export const calcYear = (gross, o = {}) => (o.contract === "b2b" ? calcB2B(gross, o) : calcEmp(gross, o));
/** Find the gross pay that gives the wanted net pay per month (bisection). */
export function grossFromNet(net, o) {
  if (!(net > 0)) return 0;
  let lo = net, hi = net * 3 + 1000 + (o.costs || 0);
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; calcYear(mid, o).first.net < net ? lo = mid : hi = mid; }
  return r2((lo + hi) / 2);
}

const CONTRACTS = [["uop", "Employment Contract (umowa o pracę)"], ["zlecenie", "Mandate Contract (umowa zlecenie)"], ["dzielo", "Contract for Specific Work (umowa o dzieło)"], ["b2b", "Own Business (B2B / JDG)"]];
const CNOTE = {
  uop: "Employment contract: social insurance and health insurance are taken from your pay. Bonuses, benefits, deductions and sick leave can be added below.",
  zlecenie: "Mandate contract: pension and disability insurance are due unless you are a student under 26 or already employed with at least the minimum wage; health insurance is due (not for students). Costs of earning income: 20%.",
  dzielo: "Contract for specific work: normally no ZUS and no health insurance. Costs of earning income 20% (50% for copyright work). Income tax 12% / 32%. If the contract is with your own employer, it is treated like an employment contract: use that type.",
  b2b: "Own business: you pay your own ZUS and health insurance, and the tax form you choose decides the income tax. Not included: the deduction of health insurance from the tax (flat tax and lump sum), reliefs and VAT. Compare the three tax forms in the insights.",
};
const KINDS = {
  bonus: ["🎁", "One-off pay in a month (bonus, 13th salary, holiday pay, overtime)"],
  allowance: ["➕", "Extra pay every month (gross)"],
  benefit: ["🏥", "Benefit from the employer (taxed, not paid in cash)"],
  deduct: ["➖", "Deduction from net pay every month"],
  sick: ["🤒", "Sick leave (L4)"],
};
const SHORT = { bonus: "Bonus", allowance: "Monthly extra pay", benefit: "Benefit", deduct: "Deduction from net", sick: "Sick leave" };
const PRESETS = [["Private medical care", "benefit"], ["Sport card", "benefit"], ["Medical care for my child", "benefit"], ["Bonus", "bonus"], ["13th salary", "bonus"], ["Holiday pay", "bonus"], ["Overtime in one month", "bonus"], ["Overtime every month", "allowance"], ["Meal allowance", "allowance"], ["Union fee", "deduct"], ["Loan instalment", "deduct"], ["Sick leave", "sick"]];
const MONTHS = () => Array.from({ length: 12 }, (_, i) => [String(i), new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date(2026, i, 1))]);
const plan = () => { const s = State.data.Settings; if (!s.TaxPlan) s.TaxPlan = { mode: "gross", amount: "", raised: false, pit2: true, under26: false, ppk: false, items: [] }; const q = s.TaxPlan; if (!q.contract) Object.assign(q, { contract: "uop", taxForm: "linear", zus: "full", lumpRate: "0.12", costs: "" }); if (!Array.isArray(s.TaxPlan.items)) s.TaxPlan.items = []; if (!Array.isArray(s.TaxPlan.jobs)) s.TaxPlan.jobs = []; return s.TaxPlan; };
/** The saved extras → the options of the calculation. */
export function planOpts(P) {
  const ct = P.contract || "uop", it = ct === "uop" ? P.items || [] : [], sum = k => it.filter(x => x.kind === k).reduce((a, x) => a + (x.amount || 0), 0);
  const mo = v => (v === undefined || v === "" || v === null ? null : +v);
  return { from: ct === "b2b" ? 0 : mo(P.from) ?? 0, to: ct === "b2b" ? 11 : mo(P.to) ?? 11, raise: ct !== "b2b" && mo(P.raiseMonth) !== null && num(P.raiseGross) > 0 ? { month: mo(P.raiseMonth), gross: num(P.raiseGross) } : null, zusPlusIncome: P.zusPlusIncome, contract: ct, student: P.student, sickVol: P.sickVol, noSocial: P.otherJob, kupRate: ct === "zlecenie" || ct === "dzielo" ? (P.copyright ? TAX.zlecenie.kupCopyright : TAX.zlecenie.kup) : 0, zus: P.zus, zusSick: P.zusSick, costs: num(P.costs) || 0, taxForm: P.taxForm, lumpRate: +P.lumpRate || 0.12,
    raisedCosts: P.raised, pit2: ct === "dzielo" ? false : P.pit2, under26: P.under26, ppk: ct === "uop" && P.ppk, allowance: sum("allowance"), benefit: sum("benefit"), deduct: sum("deduct"),
    sick: it.filter(x => x.kind === "sick" && x.days > 0).flatMap(x => { const out = []; let m = +x.month >= 0 ? +x.month : 0, d = x.days; if (x.manual) return [{ month: m, days: Math.min(30, d), net: x.amount || 0 }]; while (d > 0 && m < 12) { out.push({ month: m, days: Math.min(30, d), net: 0 }); d -= 30; m++; } return out; }),
    bonuses: it.filter(x => x.kind === "bonus").map(x => ({ amount: x.amount || 0, month: +x.month >= 0 ? +x.month : 11 })) };
}

const chev = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
const SRC_CHIPS = [["Ministry of Finance", TAX_SOURCES[2][1]], ["ZUS", TAX_SOURCES[0][1]], ["PIT regulations", TAX_SOURCES[1][1]], ["PPK", TAX_SOURCES[3][1]]];

/** Ways to keep more of the pay, worked out from the entered numbers. */
function insights(g, o, y) {
  const list = [];
  if (o.contract === "b2b") {
    const forms = [["linear", T("Flat tax 19%")], ["scale", T("Tax scale 12% / 32%")], ...TAX.b2b.lumpRates.filter(r => [0.12, 0.085, 0.15].includes(r)).map(r => ["lump:" + r, T("Lump-sum tax {0}%", r * 100)])];
    const res = forms.map(([k, n]) => [n, k, calcYear(g, k.startsWith("lump") ? { ...o, taxForm: "lump", lumpRate: +k.split(":")[1] } : { ...o, taxForm: k }).netYear]).sort((a, b) => b[2] - a[2]);
    const cur = y.netYear, best = res[0];
    list.push(best[2] - cur > 1 ? { t: T("Compare the tax forms"), d: T("With the same revenue and costs, {0} would leave you about {1} more a year than your current choice. Lump-sum tax depends on your type of business, so check the rate for your activity.", best[0], pln(best[2] - cur)), v: best[2] - cur } : { t: T("Your tax form looks good"), d: T("Among flat tax, tax scale and the lump-sum rates 8.5%, 12% and 15%, your current choice leaves you the most. The best rate for lump-sum tax depends on your type of business."), v: 0 });
    list.push({ t: T("Check the ZUS options"), d: T("New businesses can use preferential ZUS for 24 months, and later the small ZUS Plus if the income is low. Check with ZUS what applies to you."), v: 0 });
    return list;
  }
  if (o.contract && o.contract !== "uop") { list.push({ t: T("Use the tax reliefs"), d: T("In your yearly tax return you can use reliefs that this estimate does not include, for example for children, internet or donations."), v: 0 }); if (!o.kupRate || o.kupRate < 0.5) list.push({ t: T("Copyright costs of 50%"), d: T("If your work creates copyrighted works (for example software, texts, designs), the costs of earning income can be 50%. Ask your payer or a tax adviser."), v: 0 }); return list; }
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
    const CT = P.contract || "uop";
    const monthSel = (name, val, none) => select(name, [...(none ? [["", T("No change")]] : []), ...MONTHS()], val);
    const periodHtml = () => `<details class="tp-fold"><summary><span>📅 ${esc(T("Months & raise"))}</span>${chev}</summary>
                <div class="tx-f">${field(T("First month of work"), monthSel("from", String(P.from ?? 0)))}${field(T("Last month of work"), monthSel("to", String(P.to ?? 11)))}
                ${field(T("Raise: new gross from month"), monthSel("raiseMonth", P.raiseMonth ?? "", true))}${field(T("New gross (per month)"), numInput("raiseGross", plain(P.raiseGross), "0"))}</div>
                <p class="hint">${esc(T("For a job that starts or ends during the year, or a raise. Months without work are left out; the tax-free amount is counted from the first month."))}</p></details>`;
    const settingsHtml = () => {
      const fold = (ic, t, body) => `<details class="tp-fold" open><summary><span>${ic} ${esc(T(t))}</span>${chev}</summary>${body}</details>`;
      if (CT === "uop") return periodHtml() + `<details class="tp-fold"><summary><span>⚙️ ${esc(T("Tax Settings"))}</span>${chev}</summary>
                ${check("raised", T("Raised costs of earning income (you work in another town)"), P.raised)}
                ${check("pit2", T("Tax-free amount used at your employer (PIT-2 submitted)"), P.pit2)}
                ${check("under26", T("Under 26 – no income tax up to {0} a year", pln(TAX.youngLimit)), P.under26)}</details>
              <details class="tp-fold"><summary><span>🎚️ ${esc(T("Advanced Options"))}</span>${chev}</summary>
                ${check("ppk", T("I take part in PPK (you pay {0}%, the employer {1}%)", TAX.ppk.employee * 100, TAX.ppk.employer * 100), P.ppk)}</details>`;
      if (CT === "zlecenie") return periodHtml() + fold("⚙️", "Tax Settings", `${check("student", T("Student or pupil under 26 (no ZUS and no health insurance from this contract)"), P.student)}
                ${check("otherJob", T("I also have an employment contract with at least the minimum wage (then only health insurance is due here)"), P.otherJob)}
                ${check("sickVol", T("I pay voluntary sickness insurance ({0}%)", TAX.zus.sickness * 100), P.sickVol)}
                ${check("copyright", T("Copyright work (costs of earning income 50% instead of 20%)"), P.copyright)}
                ${check("pit2", T("Tax-free amount used at this payer (PIT-2 submitted)"), P.pit2)}
                ${check("under26", T("Under 26 – no income tax up to {0} a year", pln(TAX.youngLimit)), P.under26)}`);
      if (CT === "dzielo") return periodHtml() + fold("⚙️", "Tax Settings", `${check("copyright", T("Copyright work (costs of earning income 50% instead of 20%)"), P.copyright)}
                ${check("under26", T("Under 26 – no income tax up to {0} a year", pln(TAX.youngLimit)), P.under26)}`);
      return fold("⚙️", "Business Settings", `${field(T("Tax form"), select("taxForm", [["linear", T("Flat tax 19%")], ["scale", T("Tax scale 12% / 32%")], ["lump", T("Lump-sum tax (ryczałt)")]], P.taxForm || "linear"))}
                ${P.taxForm === "lump" ? field(T("Lump-sum rate"), select("lumpRate", TAX.b2b.lumpRates.map(r => [String(r), pcx(r * 100)]), String(P.lumpRate || "0.12"))) : ""}
                ${field(T("ZUS (social insurance)"), select("zus", [["full", T("Full ZUS")], ["pref", T("Preferential ZUS (first 24 months)")], ["plus", T("Small ZUS Plus (income up to {0} last year)", pln(TAX.b2b.zusPlus.revenueLimit))], ["none", T("No ZUS (e.g. covered by an employment contract)")]], P.zus || "full"))}
                ${P.zus === "plus" ? field(T("Business income last year (zł per year)"), numInput("zusPlusIncome", plain(P.zusPlusIncome), "0")) : ""}
                ${check("zusSick", T("Voluntary sickness insurance"), P.zusSick)}
                ${P.taxForm === "scale" ? check("pit2", T("Use the tax-free amount"), P.pit2) : ""}`);
    };
    const itemsHtml = () => {
      const it = P.items, tot = k => it.filter(x => x.kind === k).reduce((a, x) => a + (x.amount || 0), 0);
      return `<div class="tp-h"><span class="tp-hi">🎁</span><h3>${esc(T("Employee Benefits"))}</h3></div>
        ${it.length ? `<div class="tx-list">${it.map(x => `<div class="tx-it" data-id="${x.id}"><span class="tx-ic">${KINDS[x.kind][0]}</span><span class="tx-n"><b>${esc(x.name)}</b><small>${esc(T(SHORT[x.kind]))}${x.kind === "bonus" ? " · " + esc(MONTHS()[+x.month >= 0 ? +x.month : 11][1]) : ""}${x.kind === "sick" ? " · " + esc(MONTHS()[+x.month >= 0 ? +x.month : 0][1]) + " · " + esc(T("{0} days", x.days)) + " · " + esc(x.manual ? T("amount entered by you") : T("calculated")) : ""}</small></span>
          ${x.kind === "sick" && !x.manual ? `<span class="tx-a"><em>${esc(T("{0} days", x.days))}</em></span>` : `<span class="tx-a"><input type="text" inputmode="decimal" value="${esc(plain(x.amount))}" data-it-amount="${x.id}" aria-label="${esc(T("Amount"))}"><em>zł</em></span>`}<button class="icon-btn danger" data-it-del="${x.id}" title="${esc(T("Delete"))}">🗑</button></div>`).join("")}</div>
          <div class="tx-tot">${["bonus", "allowance", "benefit", "deduct"].filter(k => tot(k)).map(k => `<span>${KINDS[k][0]} ${esc(pln(tot(k)))}</span>`).join("")}</div>` : `<p class="hint mc-empty">${esc(T("No extras yet. Add bonuses, medical care, a sport card or deductions below."))}</p>`}
        <form id="tx-add" class="tx-add"><details class="tp-fold"${it.length ? "" : " open"}><summary><span>＋ ${esc(T("Add an item"))}</span>${chev}</summary>
          <div class="tx-chips">${PRESETS.map(([n, k]) => `<button type="button" class="chip" data-preset="${esc(n)}|${k}">${esc(T(n))}</button>`).join("")}</div>
          <div class="tx-f">${field(T("Name"), textInput("name", "", T("e.g. {0}", "Private medical care")))}${field(T("Type"), select("kind", Object.entries(KINDS).map(([k, v]) => [k, T(v[1])]), "benefit"))}
          <span class="tx-am">${field(T("Amount (zł)"), numInput("amount", "", "0"))}</span><span class="tx-sk" hidden>${field(T("Days of sick leave"), numInput("days", "", "10"))}${field(T("How to count it"), select("how", [["auto", T("Calculate for me")], ["manual", T("I enter the net pay I got")]], "auto"))}</span><span class="tx-mo" hidden>${field(T("Paid in"), select("month", MONTHS(), "11"))}</span></div>
          <button type="button" class="btn main" data-add-item>＋ ${esc(T("Add"))}</button></details></form>`;
    };
    const jobsHtml = () => `<div class="tp-h"><span class="tp-hi">👥</span><h3>${esc(T("More Incomes"))}</h3></div>
      <p class="hint">${esc(T("Do you have a second employment contract? Add it here. Every employer withholds tax on its own, and the tax-free amount is used at one employer only. At your yearly tax return all incomes are added up."))}</p>
      ${P.jobs.length ? `<div class="tx-list">${P.jobs.map(j => `<div class="tx-it"><span class="tx-ic">💼</span><span class="tx-n"><input type="text" value="${esc(j.name)}" data-job-name="${j.id}" aria-label="${esc(T("Name"))}"><small>${esc(T("Employment contract, gross per month"))}</small><label class="tx-chk"><input type="checkbox" data-job-pit2="${j.id}"${j.pit2 ? " checked" : ""}> ${esc(T("Tax-free amount used here"))}</label></span>
        <span class="tx-a"><input type="text" inputmode="decimal" value="${esc(plain(j.amount))}" data-job-amount="${j.id}" aria-label="${esc(T("Amount"))}"><em>zł</em></span><button class="icon-btn danger" data-job-del="${j.id}" title="${esc(T("Delete"))}">🗑</button></div>`).join("")}</div>` : ""}
      <button type="button" class="btn second" data-add-job>＋ ${esc(T("Add another income"))}</button>`;
    const famHtml = () => `<div class="tp-h"><span class="tp-hi">👨‍👩‍👧</span><h3>${esc(T("Family & Yearly Tax Return"))}</h3></div>
      <p class="hint">${esc(T("In Poland the income tax depends on your marital status, your children and the type of income. It does not depend on whether you are a man or a woman."))}</p>
      <div class="tx-f">${field(T("Your situation"), select("status", [["single", T("Single")], ["joint", T("Married – joint tax return with my spouse")], ["separate", T("Married – separate tax returns")], ["parent", T("Single parent (raising a child alone)")]], P.status || "single"))}
      ${(P.status || "single") === "joint" ? field(T("Spouse: gross pay per month (employment contract)"), numInput("spouse", plain(P.spouse), "0")) : ""}
      ${field(T("Other deductions from income at the tax return (zł per year)"), numInput("relief", plain(P.relief), "0"))}
      ${field(T("Children (under 18, or studying)"), select("kids", [0, 1, 2, 3, 4, 5, 6].map(n => [String(n), String(n)]), String(P.kids || 0)))}</div>
      <div id="tx-famres" class="hint"></div>`;
    let TAB = "overview";
    const showTab = t => { TAB = t; el.querySelectorAll("[data-pane]").forEach(p => { p.hidden = p.dataset.pane !== t; }); el.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === t)); el.querySelector(".tp-tabs")?.scrollIntoView({ behavior: "smooth", block: "nearest" }); };
    const kpiRow = v => [[T("Net per month"), v[0], "coins", "overview", "in"], [T("Tax per year"), v[1], "percent", "year", "rate"], [T("Effective tax rate"), v[2], "bars", "overview", "left"], [T("Yearly tax return"), v[3], "star", "year", "src"]].map(([l, x, ic, go, cl]) => kpi(l, x == null ? "–" : x, ic, go, cl)).join("");
    const kpi = (l, v, icon, go, cls = "in") => `<div class="kpi static clk" data-txgo="${go}"><span class="kpi-ic ${cls}">${si(IC[icon] || IC.bars)}</span><span class="kpi-t"><span class="kpi-l">${esc(l)}</span><b>${esc(v)}</b></span></div>`;
    const acc = (id, ic, title, body, open) => `<details class="tp-acc" id="acc-${id}"${open ? " open" : ""}><summary><span class="tp-hi">${ic}</span><b>${esc(T(title))}</b><em class="tp-accs" id="accs-${id}"></em>${chev}</summary><div class="tp-accb">${body}</div></details>`;
    const TABS = [["overview", "🧮", "Overview"], ["monthly", "📅", "Monthly"], ["year", "📈", "Year & tax return"], ["rules", "📚", "Sources & rules"]];
    el.innerHTML = `<div class="ni-page tx-page tp">
      <div class="tp-head"><span class="tp-logo">⚖️</span><div><h2>${esc(T("Taxes & Payroll Intelligence Center"))}</h2><p>${esc(T("Estimate salary, taxes, contributions and discover optimization opportunities."))}</p><span class="tp-yr">${esc(T("Tax year {0}", TAX.year))}</span></div>
        <label class="tp-country"><svg class="tp-flag" viewBox="0 0 28 20" width="22" height="16" aria-hidden="true"><rect width="28" height="10" fill="#f8fafc"/><rect y="10" width="28" height="10" fill="#dc2626"/></svg> <select disabled aria-label="${esc(T("Country"))}"><option>${esc(T("Poland"))}</option></select></label></div>
      <div class="ov-kpis" id="tx-kpis">${kpiRow([])}</div>
      <p class="tx-pl"><svg class="tp-flag" viewBox="0 0 28 20" width="22" height="16" aria-hidden="true"><rect width="28" height="10" fill="#f8fafc"/><rect y="10" width="28" height="10" fill="#dc2626"/></svg> ${esc(T("Poland only for now: these are Polish rules for {0}. Other countries may follow.", TAX.year))}</p>
      <div class="tp2">
        <aside class="tp2-side"><div class="nw-card ov-card tp-card tp-sidecard">
          <div class="tp-h"><span class="tp-hi">🎛️</span><h3>${esc(T("Your situation"))}</h3></div>
          ${acc("pay", "💼", "Salary & contract", `
            <form id="tax-form">
              ${field(T("Contract Type"), select("contract", CONTRACTS.map(([k, n]) => [k, T(n)]), CT))}
              <div class="tp-two-in">${field(CT === "b2b" ? T("Revenue (without VAT, per month)") : T("Gross Salary (brutto, per month)"), numInput("amount", P.mode === "gross" ? plain(P.amount) : "", T("e.g. {0}", "10000")))}${field(CT === "b2b" ? T("Take-home (netto, per month)") : T("Net Salary (netto, per month)"), numInput("netamount", P.mode === "net" ? plain(P.amount) : "", T("e.g. {0}", "7200")))}</div><p class="hint">${esc(T("Type either one: the other is calculated for you."))}</p>
              ${CT === "b2b" ? field(T("Business costs (per month, without VAT)"), numInput("costs", plain(P.costs), "0")) : ""}
              ${settingsHtml()}
              <p class="hint tp-cnote">${esc(T(CNOTE[CT]))}</p>
            </form>`, true)}
          ${acc("jobs", "👥", "More incomes", `<div id="tx-jobs">${jobsHtml()}</div>`, false)}
          ${acc("fam", "👨‍👩‍👧", "Family & tax return", `<div id="tx-fam">${famHtml()}</div>`, false)}
          ${acc("items", "🎁", "Benefits, bonuses & sick leave", `<div id="tx-items">${itemsHtml()}</div>`, false)}
        </div></aside>
        <section class="tp2-main">
          <div class="tp-tabs" role="tablist">${TABS.map(([k, ic, n]) => `<button type="button" role="tab" class="tp-tab${k === TAB ? " on" : ""}" data-tab="${k}">${ic} ${esc(T(n))}</button>`).join("")}</div>
          <div class="tp-pane" data-pane="overview"${TAB === "overview" ? "" : " hidden"}>
            <div class="nw-card ov-card tp-card" id="tx-sum"></div>
            <div class="tp-two"><div class="nw-card ov-card tp-card" id="tx-brk"></div><div class="nw-card ov-card tp-card" id="tx-ins"></div></div></div>
          <div class="tp-pane" data-pane="monthly"${TAB === "monthly" ? "" : " hidden"}>
            <div class="nw-card ov-card tp-card" id="tx-mon"></div></div>
          <div class="tp-pane" data-pane="year"${TAB === "year" ? "" : " hidden"}>
            <div class="nw-card ov-card tp-card" id="tx-all" hidden></div>
            <div class="nw-card ov-card tp-card" id="tx-ann"></div></div>
          <div class="tp-pane" data-pane="rules"${TAB === "rules" ? "" : " hidden"}>
            <div class="nw-card ov-card tp-card tp-src" id="tx-sources"><div class="tp-srch"><span class="tp-info">i</span><h3>${esc(T("Official Sources"))}</h3></div>
          <div class="tx-chips">${SRC_CHIPS.map(([n, u]) => `<a class="chip" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(T(n))} ↗</a>`).join("")}</div>
          <p class="hint">${esc(T("Rates and limits for {0}, checked {1}. They are kept in one file inside MoneyCompass and updated once a year.", TAX.year, TAX.checked))}</p>
          <details class="tx-how" id="tx-how"><summary>${esc(T("How the estimate is calculated"))}</summary><ol class="hint">
            <li>${esc(T("Social insurance: pension {0}%, disability {1}%, sickness {2}% of the gross. Pension and disability stop above {3} a year.", TAX.zus.pension * 100, TAX.zus.disability * 100, (TAX.zus.sickness * 100).toFixed(2).replace(/\.?0+$/, ""), pln(TAX.zusYearLimit)))}</li>
            <li>${esc(T("Health insurance: {0}% of the gross minus social insurance (not deductible from tax).", TAX.health * 100))}</li>
            <li>${esc(T("Income tax: gross − social insurance − costs of earning income ({0} or {1} a month) = tax base; {2}% up to {3} a year, {4}% above; minus {5} for the tax-free amount.", pln(TAX.kup.standard), pln(TAX.kup.raised), TAX.pit.low * 100, pln(TAX.pit.threshold), TAX.pit.high * 100, pln(TAX.pit.taxFree * TAX.pit.low)))}</li>
            <li>${esc(T("Net = gross − insurance − tax. Twelve months of the same pay, the tax is settled over the whole year."))}</li></ol></details></div></div>
        </section>
      </div>
      <div class="tx-disc"><b>⚠ ${esc(T("Important"))}</b>
        <p>${esc(T("This is a rough estimate for information only. It is not tax, legal or payroll advice, and it may differ from your real pay slip, because of bonuses, overtime, other contracts, reliefs, rounding, changes in the law and your personal tax return. MoneyCompass does not guarantee that the figures are correct or up to date and is not liable for decisions made on them. Check your real numbers with your payroll department, the tax office (KAS/ZUS) or a tax adviser."))}</p></div></div>`;
    el.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => showTab(b.dataset.tab));    const form = el.querySelector("#tax-form"), box = el.querySelector("#tx-items");
    const set = (id, html) => { el.querySelector("#" + id).innerHTML = html; };
    const empty = T("Enter a gross salary to see the estimate.");
    const draw = () => {
      const v = num(P.amount) || 0, o = planOpts(P);
      const other = P.mode === "gross" ? form.netamount : form.amount;
      const head = (ic, t) => `<div class="tp-h"><span class="tp-hi">${ic}</span><h3>${esc(t)}</h3></div>`;
      if (!(v > 0)) { el.querySelector("#tx-all").hidden = true; el.querySelector("#tx-kpis").innerHTML = kpiRow([]); other.value = ""; for (const [id, ic, t] of [["tx-sum", "🧮", "Payroll Summary"], ["tx-brk", "🥧", "Salary Breakdown"], ["tx-ins", "💡", "MoneyCompass Optimization Insights"], ["tx-ann", "📈", "Annual Projection"], ["tx-mon", "📅", "Monthly Payment Overview"]]) set(id, head(ic, T(t)) + `<p class="hint mc-empty">${esc(empty)}</p>`); return; }
      const g = P.mode === "gross" ? v : grossFromNet(v, o), y = calcYear(g, o), f = y.first, p = TAX.pit;
      const extras = P.jobs.map(j => ({ j, y: calcYear(num(j.amount) || 0, { pit2: !!j.pit2 }) })).filter(e => e.y.grossYear > 0), ALL = [y, ...extras.map(e => e.y)];
      const sumA = k => ALL.reduce((a, x) => a + x[k], 0);
      const mm = extras.length ? y.months.map((x, i) => { const r = { m: x.m, bonus: x.bonus, high: ALL.some(a => a.months[i].high) }; for (const k of ["gross", "net", "tax", "ins", "ppk", "deduct"]) r[k] = ALL.reduce((a, z) => a + z.months[i][k], 0); return r; }) : y.months;
      const A = { grossYear: sumA("grossYear"), netYear: sumA("netYear"), tax: sumA("tax") };
      const baseAll = ALL.reduce((a, x) => a + x.taxable, 0), pt = TAX.pit, F = TAX.family;
      const fam = (() => {   // yearly tax return: marital status, spouse, children
        const own = !(o.contract === "b2b" && o.taxForm !== "scale"), st = own ? (P.status || "single") : "single";
        const fT = b => Math.max(0, b <= pt.threshold ? b * pt.low - pt.taxFree * pt.low : pt.threshold * pt.low - pt.taxFree * pt.low + (b - pt.threshold) * pt.high);
        let spW = 0, spB = 0; if (st === "joint" && num(P.spouse) > 0) { const sp = calcYear(num(P.spouse), { pit2: true }); spB = sp.taxable; spW = sp.tax; }
        const bT = Math.max(0, baseAll - (num(P.relief) || 0)), combined = bT + spB, separate = fT(bT) + fT(spB), liab = st === "joint" ? 2 * fT(combined / 2) : st === "parent" ? 2 * fT(bT / 2) : fT(bT);
        const n = own ? Math.max(0, Math.round(num(P.kids) || 0)) : 0; let relief = 0;
        if (n > 0) { relief = n <= 4 ? F.childRelief[n] : F.childRelief[4] + (n - 4) * F.childExtra; if (n === 1 && (st === "joint" ? combined : baseAll) > (st === "joint" || st === "parent" ? F.limitOne.joint : F.limitOne.other)) relief = 0; }
        relief = Math.min(relief, liab);
        const liabNet = liab - relief, share = combined > 0 ? bT / combined : 1;
        return { own, st, n, relief, liabNet, share, spW, diff: own ? liabNet - (A.tax + spW) : 0, saving: st === "joint" ? separate - fT(combined / 2) * 2 : st === "parent" ? fT(bT) - 2 * fT(bT / 2) : 0 };
      })();
      const trueTax = fam.own ? fam.liabNet * fam.share : A.tax, diffAll = fam.diff;
      { const fr = el.querySelector("#tx-famres"), li = [];
        if (!fam.own) li.push(T("Family options apply to the scale tax (12% / 32%) and to employment-type contracts."));
        else {
          if (fam.st === "joint") li.push(num(P.spouse) > 0 ? (fam.saving > 1 ? T("A joint tax return saves you about {0} a year compared to two separate returns.", pln(fam.saving)) : T("A joint tax return brings little here: both incomes are similar.")) : T("Enter your spouse's gross pay to see how a joint tax return changes the tax."));
          if (fam.st === "joint") li.push(T("Joint return: married the whole year with joint property, and neither of you uses flat tax or lump-sum tax for business income. The income of both is added, halved, and the tax doubled."));
          if (fam.st === "parent") li.push(fam.saving > 1 ? T("Filing as a single parent saves you about {0} a year (the tax is calculated on half of the income and doubled).", pln(fam.saving)) : T("Filing as a single parent brings little at this income."));
          if (fam.n > 0) li.push(fam.relief > 0 ? T("Child relief lowers your yearly tax by {0}.", pln(fam.relief)) : T("With one child, the relief is lost when the income is above {0}.", pln(fam.st === "joint" || fam.st === "parent" ? TAX.family.limitOne.joint : TAX.family.limitOne.other)));
          if (fam.n > 0 && fam.st !== "joint" && fam.st !== "parent") li.push(T("If both parents claim the relief, it is split between you."));
        }
        fr.innerHTML = li.map(x => `<p>${esc(x)}</p>`).join(""); }
      { const box2 = el.querySelector("#tx-all"); box2.hidden = !extras.length;
        if (extras.length) {
          const base = baseAll, diff = diffAll;
          const nm = [T("Main income"), ...extras.map(e => e.j.name || T("Other income"))];
          box2.innerHTML = head("👥", T("All Incomes Together")) + `<div class="tp-mt-wrap"><table class="tp-mt"><thead><tr><th>${esc(T("Income"))}</th><th>${esc(T("Gross (brutto)"))}</th><th>${esc(T("Net (netto)"))}</th><th>${esc(T("Tax paid"))} / ${esc(T("per year"))}</th></tr></thead><tbody>
            ${ALL.map((x, i) => `<tr><td>${esc(nm[i])}</td><td>${esc(pln(x.gross))}</td><td><b class="good">${esc(pln(x.first.net))}</b></td><td>${esc(pln(x.tax))}</td></tr>`).join("")}</tbody>
            <tfoot><tr><td>${esc(T("Together"))}</td><td>${esc(pln(ALL.reduce((a, x) => a + x.gross, 0)))}</td><td><b class="good">${esc(pln(ALL.reduce((a, x) => a + x.first.net, 0)))}</b></td><td>${esc(pln(A.tax))}</td></tr></tfoot></table></div>
            <p class="${Math.abs(diff) > 1 ? "tp-warn" : "hint"}">${esc(Math.abs(diff) <= 1 ? T("Your yearly tax return should come out about even.") : diff > 0 ? T("Your employers together withhold about {0} too little. At your yearly tax return (PIT-37) you will probably pay about {0} more. Keep this money aside.", pln(diff)) : T("Your employers together withhold about {0} too much. You will probably get about {0} back with your yearly tax return (PIT-37).", pln(-diff)))}</p>
            <p class="hint">${esc(T("Combined income for the year: {0} tax base. Social insurance is counted for every income separately here; if your pay is above the yearly limit, ask your employer about it.", pln(base)))}</p>`; } }
      if (document.activeElement !== other) other.value = plain(P.mode === "gross" ? f.net : g);
      const sf = k => ALL.reduce((a, x) => a + x.first[k], 0), socY = sumA("social"), hlY = sumA("health");
      const S = extras.length ? { gross: sumA("gross"), net: sf("net"), tax: sf("tax"), health: sf("health"), mo: sf("pension") + sf("disability") + sf("sickness"), ppk: sf("ppk"), deduct: sf("deduct"), taxable: baseAll, over: Math.max(0, baseAll - p.threshold), room: Math.max(0, p.threshold - baseAll), eff: A.grossYear > 0 ? (socY + hlY + trueTax) / A.grossYear * 100 : 0, netMonth: (A.netYear - diffAll) / 12 }
        : { gross: y.gross, net: f.net, tax: f.tax, health: f.health, mo: f.pension + f.disability + f.sickness, ppk: f.ppk, deduct: f.deduct, taxable: y.taxable, over: y.over, room: y.room, eff: y.grossYear > 0 ? (y.social + y.health + y.tax) / y.grossYear * 100 : 0, netMonth: y.netMonth };
      const eff = S.eff, mo = S.mo;
      el.querySelector("#tx-kpis").innerHTML = kpiRow([pln(S.net), pln(extras.length || fam.own ? trueTax : A.tax), pcx(eff), Math.abs(diffAll) <= 1 ? T("About even") : diffAll > 0 ? T("Pay {0}", pln(diffAll)) : T("Back {0}", pln(-diffAll))]);
      { const set2 = (id, t) => { const e2 = el.querySelector("#accs-" + id); if (e2) e2.textContent = t; };
        set2("jobs", P.jobs.length ? String(P.jobs.length) : ""); set2("items", P.items.length ? String(P.items.length) : ""); set2("fam", ({ single: "", joint: T("Joint"), parent: T("Single parent"), separate: T("Separate") })[P.status || "single"] + (P.kids ? (P.status && P.status !== "single" ? " · " : "") + T("{0} children", P.kids) : "")); }
      const util = Math.min(100, Math.round(S.taxable / p.threshold * 100)), within = S.over <= 0;
      const rev = o.contract === "b2b", flat = rev && o.taxForm !== "scale";
      const row = (l, a, cls = "") => `<div class="tp-r ${cls}"><span>${esc(l)}</span><b>${esc(pln(a))}</b></div>`;
      set("tx-sum", head("🧮", T("Payroll Summary")) + `<div class="tp-sum">
        <div class="tp-s1">${row(rev ? T("Revenue") : T("Gross Salary"), S.gross)}${row(rev ? T("Take-home") : y.bonus ? T("Net Salary (normal month)") : T("Net Salary"), S.net, "tp-net")}${row(T("Income Tax"), S.tax)}${row(T("Health Insurance"), S.health)}${row(T("Social Security"), mo)}${o.ppk ? row(T("PPK (your share)"), S.ppk) : ""}${S.deduct ? row(rev ? T("Business costs") : T("Other deductions"), S.deduct) : ""}
          ${diffAll > 1 ? row(T("To pay at tax return (yearly)"), diffAll, "warn") : diffAll < -1 ? row(T("Back at tax return (yearly)"), -diffAll) : ""}
          ${y.bonus || extras.length || y.months.some(x => x.sick) ? `<small class="hint">${esc(T("Average over the year: {0}", pln(S.netMonth)))}</small>` : ""}</div>
        <div class="tp-s2"><small>${esc(T("Effective Tax Rate"))}</small>${ring(Math.min(100, eff), pcx(eff), "", 150)}<small class="hint">${esc(T("Insurance and tax together"))}</small></div>
        <div class="tp-s3">${flat ? `<small>${esc(T("Tax form"))}</small><b>${esc(o.taxForm === "lump" ? T("Lump-sum tax {0}%", (o.lumpRate || 0.12) * 100) : T("Flat tax 19%"))}</b><small>${esc(T("Tax base (year)"))}</small><b>${esc(pln(S.taxable))}</b><small class="hint">${esc(T("No 12% / 32% brackets with this tax form."))}</small>` : `<small>${esc(T("Tax Bracket Status"))}</small><b class="${within ? "good" : "warn"}">${within ? "✅ " + esc(T("Within Threshold")) : "⚠️ " + esc(T("Above the 32% threshold"))}</b>
          <small>${esc(T("Current Annual Income"))}</small><b>${esc(pln(S.taxable))}</b><small>${esc(T("Threshold Utilization"))}</small>
          <div class="tp-util"><div class="tx-bar"><i style="width:${util}%"></i></div><b>${util}%</b></div>
          <small class="hint">${esc(within ? T("{0} a year of room before 32% starts.", pln(S.room)) : T("{0} a year is taxed at 32%.", pln(S.over)))}</small>`}</div></div>`);
      const parts = [[T("Net Pay"), S.net, "#34d399"], [T("Tax"), S.tax, "#f59e0b"], [T("Social Security"), mo, "#3b9bea"], [T("Health Insurance"), S.health, "#8b5cf6"], ...(o.ppk ? [[T("PPK"), S.ppk, "#ec4899"]] : []), ...(S.deduct ? [[T("Other deductions"), S.deduct, "#94a3b8"]] : [])].filter(x => x[1] > 0), sumP = parts.reduce((a, x) => a + x[1], 0) || 1;
      set("tx-brk", head("🥧", T("Salary Breakdown")) + `<div class="tp-brk"><div class="tx-donut">${donut(parts.map(x => ({ label: x[0], value: x[1], color: x[2] })), "", "")}<div class="tp-dc"><b>${esc(pln(S.net))}</b><small>${esc(T("Net Pay"))}</small></div></div>
        <div class="tx-leg col">${parts.map(x => `<span><u style="background:${x[2]}"></u>${esc(x[0])} <b>${Math.round(x[1] / sumP * 100)}%</b></span>`).join("")}</div></div>`);
      const ins = insights(g, o, y); if (extras.length && Math.abs(diffAll) > 1) ins.unshift({ t: T("Plan for the tax return"), d: diffAll > 0 ? T("Your incomes together are taxed higher than your employers withhold. Keep about {0} aside for the yearly tax return. Submitting PIT-2 at only one employer is correct; check with your payroll departments.", pln(diffAll)) : T("You should get about {0} back with your yearly tax return.", pln(-diffAll)), v: 0 }); const ben = ins.reduce((a, x) => a + x.v, 0);
      set("tx-ins", head("💡", T("MoneyCompass Optimization Insights")) + `<div class="tp-ib"><div><small>${esc(T("Potential Annual Benefit"))}</small><b class="good">${ben > 0 ? "+" + esc(pln(ben)) : "–"}</b></div><div><small>${esc(T("Recommendations Found"))}</small><b>${ins.length}</b></div></div>
        <ol class="tp-tips">${ins.slice(0, 3).map(x => `<li>${esc(x.t)}</li>`).join("")}</ol><button type="button" class="btn main" data-ins-details>${esc(T("View Details"))} →</button>`);
      el.querySelector("[data-ins-details]").onclick = () => popup(`<div class="nw-hd"><span class="nw-hi">💡</span><div><h2>${esc(T("Optimization Insights"))}</h2><p class="nw-sub">${esc(T("Ideas to keep more of your pay. Check them with your payroll department or a tax adviser."))}</p></div><button class="nw-x" data-close aria-label="${esc(T("Close"))}">✕</button></div>
        <div class="sc-body" style="display:grid;gap:10px">${ins.map((x, i) => `<div class="nw-card" style="padding:14px"><b>${i + 1}. ${esc(x.t)}</b><p style="margin:6px 0">${esc(x.d)}</p>${x.v > 0 ? `<b class="good">+${esc(pln(x.v))} / ${esc(T("per year"))}</b>` : ""}</div>`).join("")}</div>
        <div class="nw-ft"><button class="btn second" data-close>${esc(T("Close"))}</button></div>`, { width: 600, cls: "nw-win sc-win" });
      { const loc = document.documentElement.lang || "en", mn = i => new Date(2026, i, 1).toLocaleString(loc, { month: "short" }), M = mm, sum = k => M.reduce((a, x) => a + x[k], 0);
        set("tx-mon", head("📅", T("Monthly Payment Overview")) + `<div class="tp-mt-wrap"><table class="tp-mt"><thead><tr><th>${esc(T("Month"))}</th><th>${esc(T("Gross (brutto)"))}</th><th>${esc(T("Net (netto)"))}</th><th>${esc(T("Tax paid"))}</th><th>${esc(T("Insurance (ZUS + health)"))}</th><th>${esc(T("PPK"))}</th><th>${esc(T("Deductions"))}</th></tr></thead><tbody>
          ${M.map(x => `<tr class="${x.high ? "hi" : ""}${x.bonus ? " bon" : ""}"><td>${esc(mn(x.m))}${x.bonus ? " 🎁" : ""}${x.sick ? " 🤒" : ""}${x.high ? ` <span class="tp-c32">32%</span>` : ""}</td><td>${esc(pln(x.gross))}</td><td><b class="good">${esc(pln(x.net))}</b></td><td>${esc(pln(x.tax))}</td><td>${esc(pln(x.ins))}</td><td>${esc(pln(x.ppk))}</td><td>${esc(pln(x.deduct))}</td></tr>`).join("")}
          </tbody><tfoot><tr><td>${esc(T("Year"))}</td><td>${esc(pln(sum("gross")))}</td><td><b class="good">${esc(pln(sum("net")))}</b></td><td>${esc(pln(sum("tax")))}</td><td>${esc(pln(sum("ins")))}</td><td>${esc(pln(sum("ppk")))}</td><td>${esc(pln(sum("deduct")))}</td></tr></tfoot></table></div>
          ${(() => { const k = M.findIndex(x => x.high); if (k < 0) return ""; const a = M[k + 1] && !M[k + 1].bonus ? M[k + 1] : M[k]; return `<p class="tp-warn">${esc(T("From {0} your income since January is above {1}, so the tax goes up from 12% to 32% on the rest of the year. Your net falls from about {2} to about {3} a month.", mn(M[k].m), pln(TAX.pit.threshold), pln(M[0].net), pln(a.net)))}</p>`; })()}
          ${M.some(x => x.sick) ? `<p class="hint">🤒 ${esc(T("Sick leave: you get {0}% of your pay after social insurance (per day = that amount / 30). Your employer pays the first {1} days of the year, ZUS pays from day {2}. If you entered the net pay yourself, that number is used for the month.", TAX.sick.rate * 100, TAX.sick.employerDays, TAX.sick.employerDays + 1))}</p>` : ""}
          ${extras.length ? `<p class="hint">${esc(T("With more than one income, the tax in this table is what your employers withhold. The difference to the real yearly tax is settled in your tax return (see above)."))}</p>` : ""}
          <div class="tp-exp"><button class="btn main" data-mon-csv>⬇ ${esc(T("Export to Excel (CSV)"))}</button><button class="btn second" data-mon-print>🖨 ${esc(T("Print / save as PDF"))}</button><button class="btn second" data-mon-income>💾 ${esc(T("Save net pay to my Income"))}</button></div>
          <p class="hint">${esc(T("Month by month, as it would arrive on your account. Polish payroll counts your income from January onward, so the tax steps up in the month the total passes the threshold. A month with a bonus 🎁 pays more tax. Estimate only."))}</p>`); }
      { const M = mm, nf = v => (Math.round(v * 100) / 100).toFixed(2).replace(".", ","), loc = document.documentElement.lang || "en", mn = i => new Date(2026, i, 1).toLocaleString(loc, { month: "long" });
        const hd = [T("Month"), T("Gross (brutto)"), T("Net (netto)"), T("Tax paid"), T("Insurance (ZUS + health)"), T("PPK"), T("Deductions")];
        const rows = M.map(x => [mn(x.m), x.gross, x.net, x.tax, x.ins, x.ppk, x.deduct]), tot = [T("Year"), ...[1, 2, 3, 4, 5, 6].map(i => rows.reduce((a, r) => a + r[i], 0))];
        const q = c => `"${String(c).replace(/"/g, '""')}"`;
        el.querySelector("[data-mon-csv]").onclick = () => download(`MoneyCompass-payroll-${stamp()}.csv`, "\ufeff" + [hd.map(q).join(";"), ...[...rows, tot].map(r => r.map((c, i) => i ? nf(c) : q(c)).join(";"))].join("\r\n") + "\r\n" + q(T("Estimate only, not tax advice. Polish rules for {0}.", TAX.year)) + "\r\n", "text/csv;charset=utf-8");
        el.querySelector("[data-mon-income]").onclick = () => {
          const d = State.data, name = T("Salary (Taxes & Payroll)"), amt = Math.round(S.net * 100) / 100, ex = d.Incomes.find(x => x.Name === name && x.Type === "Salary");
          if (ex) { ex.Amount = amt; ex.Gross = Math.round(S.gross * 100) / 100; toast(T("Updated: {0}.", name)); }
          else { d.Incomes.push({ Id: uuid(), Name: name, Type: "Salary", Amount: amt, Currency: mainCur(), Frequency: "Monthly", Date: new Date().toISOString().slice(0, 10), Active: true, Gross: Math.round(S.gross * 100) / 100, StartDate: null, EndDate: null }); toast(T("Added: {0}.", name)); }
          save();
        };
        el.querySelector("[data-mon-print]").onclick = () => { const w = window.open("", "_blank"); if (!w) { toast(T("Allow pop-ups to print.")); return; }
          w.document.write(`<!doctype html><meta charset="utf-8"><title>MoneyCompass – ${esc(T("Monthly Payment Overview"))}</title><style>body{font:14px system-ui,sans-serif;margin:28px;color:#111}table{border-collapse:collapse;width:100%}th,td{padding:6px 8px;border-bottom:1px solid #ddd;text-align:right}th:first-child,td:first-child{text-align:left}tfoot td{font-weight:700;border-top:2px solid #111}small{color:#555}</style><h2>${esc(T("Monthly Payment Overview"))} – ${esc(String(TAX.year))}</h2><table><thead><tr>${hd.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td>${i ? esc(pln(c)) : esc(c)}</td>`).join("")}</tr>`).join("")}</tbody><tfoot><tr>${tot.map((c, i) => `<td>${i ? esc(pln(c)) : esc(c)}</td>`).join("")}</tr></tfoot></table><p><small>${esc(T("Estimate only, not tax advice. Polish rules for {0}.", TAX.year))}</small></p>`);
          w.document.close(); w.focus(); setTimeout(() => w.print(), 300); }; }
      if (extras.length) el.querySelector("#tx-sum").insertAdjacentHTML("beforeend", `<p class="hint" style="margin-top:8px">${esc(T("Main income and your other incomes together. Details for each income are in the table below."))}</p>`);
      set("tx-ann", head("📈", T("Annual Projection")) + `<div class="tp-ann"><div><small>${esc(T("Annual Gross"))}</small><b>${esc(pln(A.grossYear))}</b></div><div><small>${esc(T("Annual Net"))}</small><b class="good">${esc(pln(A.netYear - diffAll))}</b></div><div><small>${esc(T("Annual Taxes"))}</small><b>${esc(pln(extras.length ? trueTax : A.tax))}</b></div></div>
        <p class="hint">${esc(T("You keep {0} of your gross pay.", Math.round((A.netYear - diffAll) / A.grossYear * 100) + "%"))}${y.grossYear > TAX.zusYearLimit ? " " + esc(T("Pension and disability insurance stop once your gross for the year passes {0}.", pln(TAX.zusYearLimit))) : ""}${y.benefit ? " " + esc(T("Benefits are taxed like pay but you do not receive them as cash, so they only lower your net.")) : ""}</p>`);
    };
    const bindItems = () => {
      const f = box.querySelector("#tx-add"), setMo = () => { const k = f.kind.value, sk = k === "sick"; box.querySelector(".tx-mo").hidden = !(k === "bonus" || sk); box.querySelector(".tx-sk").hidden = !sk; box.querySelector(".tx-am").hidden = sk && f.how.value === "auto"; };
      f.kind.onchange = setMo; f.how.onchange = setMo; setMo();
      box.querySelectorAll("[data-preset]").forEach(b => b.onclick = () => { const [n, k] = b.dataset.preset.split("|"); f.name.value = T(n); f.kind.value = k; setMo(); f.amount.focus(); });
      box.querySelector("[data-add-item]").onclick = () => {
        const sk = f.kind.value === "sick", manual = sk && f.how.value === "manual", days = sk ? Math.min(120, Math.round(num(f.days.value) || 0)) : 0, amount = num(f.amount.value) || 0, name = f.name.value.trim() || (sk ? T("Sick leave") : "");
        if (sk && !(days > 0)) { toast(T("Please enter the number of sick days (1 to 120)."), "bad"); return; }
        if (!name || (!sk || manual) && !(amount > 0)) { toast(T("Please enter a name and an amount bigger than 0."), "bad"); return; }
        P.items.push({ id: uuid(), name, kind: f.kind.value, amount: sk && !manual ? 0 : amount, month: f.kind.value === "bonus" || sk ? +f.month.value : null, days, manual }); save(); box.innerHTML = itemsHtml(); bindItems(); draw();
      };
      box.querySelectorAll("[data-it-amount]").forEach(i => i.onchange = () => { const it = P.items.find(x => x.id === i.dataset.itAmount); if (it) { it.amount = num(i.value) || 0; save(); box.innerHTML = itemsHtml(); bindItems(); draw(); } });
      box.querySelectorAll("[data-it-del]").forEach(b => b.onclick = async () => {
        const it = P.items.find(x => x.id === b.dataset.itDel); if (!it) return;
        if (await confirmBox(T("Delete this item?"), it.name, T("Delete"), T("Cancel"), true)) { P.items = P.items.filter(x => x !== it); save(); box.innerHTML = itemsHtml(); bindItems(); draw(); }
      });
    };
    const fb = el.querySelector("#tx-fam");
    fb.addEventListener("change", ev => { const n = ev.target.name; if (n === "status" || n === "kids") { P[n] = n === "kids" ? +ev.target.value : ev.target.value; save(); if (n === "status") { fb.innerHTML = famHtml(); } draw(); } });
    fb.addEventListener("input", ev => { if (ev.target.name === "spouse" || ev.target.name === "relief") { P[ev.target.name] = ev.target.value; save(); draw(); } });
    const jb = el.querySelector("#tx-jobs");
    const bindJobs = () => {
      jb.querySelector("[data-add-job]").onclick = () => { P.jobs.push({ id: uuid(), name: T("Second job"), amount: 0 }); save(); jb.innerHTML = jobsHtml(); bindJobs(); jb.querySelector(`[data-job-amount="${P.jobs[P.jobs.length - 1].id}"]`)?.focus(); draw(); };
      jb.querySelectorAll("[data-job-pit2]").forEach(i => i.onchange = () => { const j = P.jobs.find(x => x.id === i.dataset.jobPit2); if (j) { j.pit2 = i.checked; save(); draw(); } });
      jb.querySelectorAll("[data-job-name]").forEach(i => i.onchange = () => { const j = P.jobs.find(x => x.id === i.dataset.jobName); if (j) { j.name = i.value.trim(); save(); draw(); } });
      jb.querySelectorAll("[data-job-amount]").forEach(i => i.oninput = () => { const j = P.jobs.find(x => x.id === i.dataset.jobAmount); if (j) { j.amount = num(i.value) || 0; save(); draw(); } });
      jb.querySelectorAll("[data-job-del]").forEach(b => b.onclick = async () => {
        const j = P.jobs.find(x => x.id === b.dataset.jobDel); if (!j) return;
        if (await confirmBox(T("Delete this income?"), j.name, T("Delete"), T("Cancel"), true)) { P.jobs = P.jobs.filter(x => x !== j); save(); jb.innerHTML = jobsHtml(); bindJobs(); draw(); }
      });
    };
    form.onsubmit = ev => ev.preventDefault();
    form.addEventListener("input", ev => { const n = ev.target.name; if (n === "amount" || n === "netamount") { P.mode = n === "amount" ? "gross" : "net"; P.amount = ev.target.value; save(); draw(); } });
    form.addEventListener("change", ev => {
      const n = ev.target.name; if (!n) return;
      if (ev.target.type === "checkbox") P[n] = ev.target.checked; else if (["contract", "taxForm", "lumpRate", "zus", "from", "to", "raiseMonth"].includes(n)) P[n] = ev.target.value;
      save(); if (n === "contract" || n === "taxForm" || n === "zus" || (n === "student" && P.student)) { if (n === "student") P.under26 = true; Taxes.render(el); return; } draw();
    });
    form.addEventListener("input", ev => { const nn = ev.target.name; if (nn === "costs" || nn === "raiseGross" || nn === "zusPlusIncome") { P[nn] = ev.target.value; save(); draw(); } });
    el.querySelector("#acc-items").hidden = CT !== "uop";
    el.querySelector("#tx-kpis").onclick = ev => { const k = ev.target.closest("[data-txgo]"); if (k) showTab(k.dataset.txgo); };
    bindItems(); bindJobs(); draw();
  }
};
