// Module "Taxes": a rough estimate gross ↔ net for an employment contract in Poland, with the tax bracket you fall into.
// All rates live in tax-rates.js. This is an estimate, not tax advice.
import { T, State, pln, num, plain } from "./core.js";
import { esc, card, field, numInput, select, check } from "./ui.js";
import { pageHead } from "./page-head.js";
import { TAX } from "./tax-rates.js";

const r2 = x => Math.round(x * 100) / 100;

/** Twelve months of the same gross pay → monthly and yearly figures. */
export function calcYear(gross, o = {}) {
  const z = TAX.zus, kup = (o.raisedCosts ? TAX.kup.raised : TAX.kup.standard);
  let cum = 0, pen = 0, dis = 0, sick = 0, health = 0, base = 0, first = null;
  for (let m = 0; m < 12; m++) {
    const pb = Math.min(gross, Math.max(0, TAX.zusYearLimit - cum)); cum += gross;
    const p = pb * z.pension, d = pb * z.disability, s = gross * z.sickness, soc = p + d + s, h = (gross - soc) * TAX.health;
    pen += p; dis += d; sick += s; health += h; base += Math.max(0, gross - soc - kup);
    if (!first) first = { pension: r2(p), disability: r2(d), sickness: r2(s), health: r2(h), base: Math.max(0, gross - soc - kup) };
  }
  const B = Math.round(base), pit = TAX.pit, red = o.pit2 === false ? 0 : pit.taxFree * pit.low;
  const taxable = o.under26 ? Math.max(0, B - TAX.youngLimit) : B;
  const tax = Math.max(0, taxable <= pit.threshold ? taxable * pit.low - red : pit.threshold * pit.low - red + (taxable - pit.threshold) * pit.high);
  const social = pen + dis + sick, grossYear = gross * 12, netYear = grossYear - social - health - tax;
  first.tax = r2(tax / 12); first.net = r2(netYear / 12); first.base = Math.round(first.base);
  return { gross, grossYear, social: r2(social), health: r2(health), tax: r2(tax), netYear: r2(netYear), netMonth: r2(netYear / 12), base: B, taxable, first,
    over: Math.max(0, taxable - pit.threshold), room: Math.max(0, pit.threshold - taxable), effective: grossYear > 0 ? (social + health + tax) / grossYear : 0 };
}
/** Find the gross pay that gives the wanted net pay per month (bisection). */
export function grossFromNet(net, o) {
  if (!(net > 0)) return 0;
  let lo = net, hi = net * 3 + 1000;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; calcYear(mid, o).netMonth < net ? lo = mid : hi = mid; }
  return r2((lo + hi) / 2);
}

let st = { mode: "gross", amount: "", raised: false, pit2: true, under26: false };

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
          </form>`, "ov-card tx-in")}
        <div id="tax-out" class="tx-out"></div>
      </div>
      <p class="hint tx-disc">⚠ ${esc(T("This is a rough estimate for {0}, not tax advice. Bonuses, PPK, a sport card, overtime, other contracts and your tax return change the real result.", TAX.year))}</p></div>`;
    const form = el.querySelector("#tax-form"), out = el.querySelector("#tax-out");
    const draw = () => {
      const v = num(form.amount.value) || 0, o = { raisedCosts: st.raised, pit2: st.pit2, under26: st.under26 };
      if (!(v > 0)) { out.innerHTML = card(`<p class="hint mc-empty">${esc(T("Enter a pay amount to see the estimate."))}</p>`, "ov-card"); return; }
      const g = st.mode === "gross" ? v : grossFromNet(v, o), y = calcYear(g, o), f = y.first, p = TAX.pit;
      const more = r2(calcYear(g + 100, o).netMonth - y.netMonth);
      const row = (l, a, cls = "") => `<div class="tx-r ${cls}"><span>${esc(l)}</span><b>${esc(pln(a))}</b></div>`;
      const barPct = Math.min(100, Math.round(y.taxable / p.threshold * 100));
      const hint = y.over > 0 ? T("About {0} a year of your income is taxed at 32%.", pln(y.over))
        : barPct >= 85 ? T("You are close to the 32% bracket: only {0} a year left in the 12% bracket.", pln(y.room))
        : T("You are in the 12% bracket, with {0} a year of room before 32% starts.", pln(y.room));
      out.innerHTML = card(`<div class="tx-big"><div><small>${esc(T("Net pay per month"))}</small><b class="good">${esc(pln(y.netMonth))}</b></div><div><small>${esc(T("Gross pay per month"))}</small><b>${esc(pln(g))}</b></div></div>
        <h4>${esc(T("Where the gross pay goes (per month)"))}</h4>
        ${row(T("Pension insurance"), f.pension)}${row(T("Disability insurance"), f.disability)}${row(T("Sickness insurance"), f.sickness)}${row(T("Health insurance"), f.health)}${row(T("Income tax advance"), f.tax)}${row(T("Net pay"), f.net, "tx-net")}
        <h4>${esc(T("Your tax bracket"))}</h4>
        <div class="tx-bar"><i style="width:${barPct}%"></i><em style="left:100%"></em></div>
        <div class="tx-bl"><span>0</span><span>${esc(T("12%"))}</span><span>${esc(pln(p.threshold))} → 32%</span></div>
        <p class="tx-hint ${y.over > 0 || barPct >= 85 ? "warn" : ""}">${esc(hint)}</p>
        <p class="hint">${esc(T("Each extra 100 zł of gross pay gives you about {0} net.", pln(more)))}</p>
        <h4>${esc(T("Per year"))}</h4>
        ${row(T("Gross"), y.grossYear)}${row(T("Social + health insurance"), y.social + y.health)}${row(T("Income tax"), y.tax)}${row(T("Net"), y.netYear, "tx-net")}
        <p class="hint">${esc(T("You keep {0} of your gross pay.", Math.round(y.netYear / y.grossYear * 100) + "%"))}${y.grossYear > TAX.zusYearLimit ? " " + esc(T("Pension and disability insurance stop once your gross for the year passes {0}.", pln(TAX.zusYearLimit))) : ""}</p>`, "ov-card tx-res");
    };
    form.onsubmit = ev => ev.preventDefault();
    form.addEventListener("input", () => { st.amount = form.amount.value; draw(); });
    form.addEventListener("change", () => { st.raised = form.raised.checked; st.pit2 = form.pit2.checked; st.under26 = form.under26.checked; draw(); });
    el.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { st.mode = b.dataset.mode; st.amount = ""; Taxes.render(el); });
    draw();
  }
};
