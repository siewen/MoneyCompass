// Module "Taxes": a rough estimate gross ↔ net for an employment contract in Poland, with the tax bracket you fall into.
// All rates live in tax-rates.js. This is an estimate, not tax advice.
import { T, State, pln, num, plain } from "./core.js";
import { esc, card, field, numInput, select, check } from "./ui.js";
import { pageHead } from "./page-head.js";
import { TAX, TAX_SOURCES } from "./tax-rates.js";

const r2 = x => Math.round(x * 100) / 100;

/** Twelve months of the same gross pay → monthly and yearly figures.
 *  o: raisedCosts, pit2, under26, bonus (gross, paid once a year, in December), ppk (take part), benefit (taxable employer benefit a month, not paid in cash), deduct (other deductions from net a month) */
export function calcYear(gross, o = {}) {
  const z = TAX.zus, kup = (o.raisedCosts ? TAX.kup.raised : TAX.kup.standard), ben = o.benefit || 0, bonus = o.bonus || 0;
  let cum = 0, pen = 0, dis = 0, sick = 0, health = 0, base = 0, first = null, ppkEmp = 0, ppkEr = 0;
  for (let m = 0; m < 12; m++) {
    const g = gross + ben + (m === 11 ? bonus : 0), pb = Math.min(g, Math.max(0, TAX.zusYearLimit - cum)); cum += g;
    const p = pb * z.pension, d = pb * z.disability, s = g * z.sickness, soc = p + d + s, h = (g - soc) * TAX.health;
    const pe = o.ppk ? g * TAX.ppk.employee : 0, pr = o.ppk ? g * TAX.ppk.employer : 0;
    pen += p; dis += d; sick += s; health += h; ppkEmp += pe; ppkEr += pr; base += Math.max(0, g - soc - kup + pr);
    if (!first) first = { pension: r2(p), disability: r2(d), sickness: r2(s), health: r2(h), ppk: r2(pe), base: Math.max(0, g - soc - kup + pr) };
  }
  const B = Math.round(base), pit = TAX.pit, red = o.pit2 === false ? 0 : pit.taxFree * pit.low;
  const taxable = o.under26 ? Math.max(0, B - TAX.youngLimit) : B;
  const tax = Math.max(0, taxable <= pit.threshold ? taxable * pit.low - red : pit.threshold * pit.low - red + (taxable - pit.threshold) * pit.high);
  const social = pen + dis + sick, grossYear = gross * 12 + bonus, deductYear = (o.deduct || 0) * 12;
  const netYear = grossYear - social - health - tax - ppkEmp - deductYear;   // benefits are taxed but not paid in cash: they cancel out below
  const cashYear = netYear;
  // a normal month (without the yearly bonus): tax from the same year without the bonus
  const t0 = bonus ? calcYear(gross, { ...o, bonus: 0 }).tax : tax;
  first.tax = r2(t0 / 12); first.deduct = r2(o.deduct || 0); first.base = Math.round(first.base);
  first.net = r2(gross - first.pension - first.disability - first.sickness - first.health - first.ppk - first.tax - first.deduct);
  return { gross, grossYear, social: r2(social), health: r2(health), tax: r2(tax), ppk: r2(ppkEmp), deductYear: r2(deductYear), netYear: r2(cashYear), netMonth: r2(cashYear / 12), base: B, taxable, first, benefit: ben, bonus,
    over: Math.max(0, taxable - pit.threshold), room: Math.max(0, pit.threshold - taxable), effective: grossYear > 0 ? (social + health + tax) / grossYear : 0 };
}
/** Find the gross pay that gives the wanted net pay per month (bisection). */
export function grossFromNet(net, o) {
  if (!(net > 0)) return 0;
  let lo = net, hi = net * 3 + 1000;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; calcYear(mid, o).first.net < net ? lo = mid : hi = mid; }
  return r2((lo + hi) / 2);
}

let st = { mode: "gross", amount: "", raised: false, pit2: true, under26: false, bonus: "", ppk: false, benefit: "", deduct: "" };

export const Taxes = {
  route: "taxes", title: "Taxes",
  render(el) {
    const s = State.data.Settings;
    const head = pageHead({ icon: "percent", title: T("Taxes"), sub: T("A rough estimate: gross and net pay, taxes and the bracket you are in."),
      kpis: [{ l: T("Rates valid for"), v: String(TAX.year), icon: "star" }, { l: T("Income tax"), v: "12% / 32%", icon: "percent", cls: "rate" }, { l: T("Tax-free amount a year"), v: pln(TAX.pit.taxFree), icon: "coins" }, { l: T("32% starts above (a year)"), v: pln(TAX.pit.threshold), icon: "bars", cls: "left" }] });
    el.innerHTML = `<div class="ni-page tx-page">${head}
      <div class="tx-grid">
        ${card(`<h3>${esc(T("Your pay"))}</h3>
          <div class="tx-mode"><button type="button" class="chip${st.mode === "gross" ? " on" : ""}" data-mode="gross">${esc(T("I know the gross"))}</button><button type="button" class="chip${st.mode === "net" ? " on" : ""}" data-mode="net">${esc(T("I know the net"))}</button></div>
          <form id="tax-form">
            ${field(T("Contract type"), select("contract", [["uop", T("Employment contract (umowa o pracę)")]], "uop"))}
            <p class="hint">${esc(T("Contract for work (umowa zlecenie), self-employed with 19% flat tax and lump-sum tax will follow."))}</p>
            ${field(st.mode === "gross" ? T("Gross pay per month (brutto)") : T("Net pay per month (netto)"), numInput("amount", plain(st.amount), T("e.g. {0}", "10000")))}
            ${check("raised", T("Raised costs of earning income (you work in another town)"), st.raised)}
            ${check("pit2", T("Tax-free amount used at your employer (PIT-2 submitted)"), st.pit2)}
            ${check("under26", T("Under 26 – no income tax up to {0} a year", pln(TAX.youngLimit)), st.under26)}
            <details class="tx-extra"${st.bonus || st.ppk || st.benefit || st.deduct ? " open" : ""}><summary>${esc(T("Extras: bonus, PPK, benefits, deductions"))}</summary>
              <p class="hint">${esc(T("Regular extras in your gross pay (allowances, commission) belong in the gross amount above. Add the rest here."))}</p>
              ${field(T("Yearly bonus, gross (paid in December)"), numInput("bonus", plain(st.bonus), "0"))}
              ${check("ppk", T("I take part in PPK (you pay {0}%, the employer {1}%)", TAX.ppk.employee * 100, TAX.ppk.employer * 100), st.ppk)}
              ${field(T("Taxable benefit from the employer per month (sport card, private medical care)"), numInput("benefit", plain(st.benefit), "0"))}
              ${field(T("Other deductions from your net pay per month (union fee, loan, garnishment)"), numInput("deduct", plain(st.deduct), "0"))}
            </details>
          </form>`, "ov-card tx-in")}
        <div id="tax-out" class="tx-out"></div>
      </div>
      ${card(`<h3>${esc(T("Where the numbers come from"))}</h3>
        <p class="hint">${esc(T("Rates and limits for {0}, checked {1}. They are kept in one file inside MoneyCompass and updated once a year.", TAX.year, TAX.checked))}</p>
        <ul class="tx-src">${TAX_SOURCES.map(([n, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(T(n))} ↗</a></li>`).join("")}</ul>
        <details class="tx-how"><summary>${esc(T("How the estimate is calculated"))}</summary><ol class="hint">
          <li>${esc(T("Social insurance: pension {0}%, disability {1}%, sickness {2}% of the gross. Pension and disability stop above {3} a year.", TAX.zus.pension * 100, TAX.zus.disability * 100, (TAX.zus.sickness * 100).toFixed(2).replace(/\.?0+$/, ""), pln(TAX.zusYearLimit)))}</li>
          <li>${esc(T("Health insurance: {0}% of the gross minus social insurance (not deductible from tax).", TAX.health * 100))}</li>
          <li>${esc(T("Income tax: gross − social insurance − costs of earning income ({0} or {1} a month) = tax base; {2}% up to {3} a year, {4}% above; minus {5} for the tax-free amount.", pln(TAX.kup.standard), pln(TAX.kup.raised), TAX.pit.low * 100, pln(TAX.pit.threshold), TAX.pit.high * 100, pln(TAX.pit.taxFree * TAX.pit.low)))}</li>
          <li>${esc(T("Net = gross − insurance − tax. Twelve months of the same pay, the tax is settled over the whole year."))}</li></ol></details>`, "ov-card tx-srcc")}
      <div class="tx-disc"><b>⚠ ${esc(T("Important"))}</b>
        <p>${esc(T("This is a rough estimate for information only. It is not tax, legal or payroll advice, and it may differ from your real pay slip, because of bonuses, overtime, other contracts, reliefs, rounding, changes in the law and your personal tax return. MoneyCompass does not guarantee that the figures are correct or up to date and is not liable for decisions made on them. Check your real numbers with your payroll department, the tax office (KAS/ZUS) or a tax adviser.", TAX.year))}</p></div></div>`;
    const form = el.querySelector("#tax-form"), out = el.querySelector("#tax-out");
    const draw = () => {
      const v = num(form.amount.value) || 0, o = { raisedCosts: st.raised, pit2: st.pit2, under26: st.under26, bonus: num(form.bonus.value) || 0, ppk: st.ppk, benefit: num(form.benefit.value) || 0, deduct: num(form.deduct.value) || 0 };
      if (!(v > 0)) { out.innerHTML = card(`<p class="hint mc-empty">${esc(T("Enter a pay amount to see the estimate."))}</p>`, "ov-card"); return; }
      const g = st.mode === "gross" ? v : grossFromNet(v, o), y = calcYear(g, o), f = y.first, p = TAX.pit;
      const more = r2(calcYear(g + 100, o).netMonth - y.netMonth);
      const row = (l, a, cls = "") => `<div class="tx-r ${cls}"><span>${esc(l)}</span><b>${esc(pln(a))}</b></div>`;
      const barPct = Math.min(100, Math.round(y.taxable / p.threshold * 100));
      const hint = y.over > 0 ? T("About {0} a year of your income is taxed at 32%.", pln(y.over))
        : barPct >= 85 ? T("You are close to the 32% bracket: only {0} a year left in the 12% bracket.", pln(y.room))
        : T("You are in the 12% bracket, with {0} a year of room before 32% starts.", pln(y.room));
      out.innerHTML = card(`<div class="tx-big"><div><small>${esc(y.bonus ? T("Net pay in a normal month") : T("Net pay per month"))}</small><b class="good">${esc(pln(f.net))}</b>${y.bonus ? `<small>${esc(T("Average over the year: {0}", pln(y.netMonth)))}</small>` : ""}</div><div><small>${esc(T("Gross pay per month"))}</small><b>${esc(pln(g))}</b></div></div>
        <h4>${esc(T("Where the gross pay goes (per month)"))}</h4>
        ${row(T("Pension insurance"), f.pension)}${row(T("Disability insurance"), f.disability)}${row(T("Sickness insurance"), f.sickness)}${row(T("Health insurance"), f.health)}${row(T("Income tax advance"), f.tax)}${o.ppk ? row(T("PPK (your share)"), f.ppk) : ""}${f.deduct ? row(T("Other deductions"), f.deduct) : ""}${row(T("Net pay"), f.net, "tx-net")}
        <h4>${esc(T("Your tax bracket"))}</h4>
        <div class="tx-bar"><i style="width:${barPct}%"></i><em style="left:100%"></em></div>
        <div class="tx-bl"><span>0</span><span>${esc(T("12%"))}</span><span>${esc(pln(p.threshold))} → 32%</span></div>
        <p class="tx-hint ${y.over > 0 || barPct >= 85 ? "warn" : ""}">${esc(hint)}</p>
        <p class="hint">${esc(T("Each extra 100 zł of gross pay gives you about {0} net.", pln(more)))}</p>
        <h4>${esc(T("Per year"))}</h4>
        ${row(T("Gross"), y.grossYear)}${y.bonus ? row(T("…of which yearly bonus"), y.bonus) : ""}${row(T("Social + health insurance"), y.social + y.health)}${row(T("Income tax"), y.tax)}${o.ppk ? row(T("PPK (your share)"), y.ppk) : ""}${y.deductYear ? row(T("Other deductions"), y.deductYear) : ""}${row(T("Net"), y.netYear, "tx-net")}${y.bonus ? `<p class="hint">${esc(T("The bonus is paid in December. The yearly net includes it."))}</p>` : ""}${y.benefit ? `<p class="hint">${esc(T("The benefit is taxed like pay but you do not receive it as cash, so it only lowers your net."))}</p>` : ""}
        <p class="hint">${esc(T("You keep {0} of your gross pay.", Math.round(y.netYear / y.grossYear * 100) + "%"))}${y.grossYear > TAX.zusYearLimit ? " " + esc(T("Pension and disability insurance stop once your gross for the year passes {0}.", pln(TAX.zusYearLimit))) : ""}</p>`, "ov-card tx-res");
    };
    form.onsubmit = ev => ev.preventDefault();
    form.addEventListener("input", () => { st.amount = form.amount.value; draw(); });
    form.addEventListener("change", () => { st.raised = form.raised.checked; st.pit2 = form.pit2.checked; st.under26 = form.under26.checked; st.ppk = form.ppk.checked; draw(); });
    el.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { st.mode = b.dataset.mode; st.amount = ""; Taxes.render(el); });
    draw();
  }
};
