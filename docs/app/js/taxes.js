// Module "Taxes": a rough estimate gross ↔ net for an employment contract in Poland, with the tax bracket you fall into.
// All rates live in tax-rates.js. This is an estimate, not tax advice.
import { T, State, save, pln, num, plain, uuid } from "./core.js";
import { esc, card, field, numInput, textInput, select, check, confirmBox, toast } from "./ui.js";
import { pageHead } from "./page-head.js";
import { TAX, TAX_SOURCES } from "./tax-rates.js";

const r2 = x => Math.round(x * 100) / 100;

/** Twelve months of the same gross pay → monthly and yearly figures.
 *  o: raisedCosts, pit2, under26, bonus (gross, paid once a year, in December), ppk (take part), benefit (taxable employer benefit a month, not paid in cash), deduct (other deductions from net a month) */
export function calcYear(gross, o = {}) {
  const z = TAX.zus, kup = (o.raisedCosts ? TAX.kup.raised : TAX.kup.standard), ben = o.benefit || 0, bonuses = o.bonuses || [], bonus = bonuses.reduce((a, b) => a + b.amount, 0);
  gross += o.allowance || 0;
  let cum = 0, pen = 0, dis = 0, sick = 0, health = 0, base = 0, first = null, ppkEmp = 0, ppkEr = 0;
  for (let m = 0; m < 12; m++) {
    const g = gross + ben + bonuses.filter(b => b.month === m).reduce((a, b) => a + b.amount, 0), pb = Math.min(g, Math.max(0, TAX.zusYearLimit - cum)); cum += g;
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
  const t0 = bonus ? calcYear(gross - (o.allowance || 0), { ...o, bonuses: [] }).tax : tax;
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

const KINDS = {
  bonus: ["🎁", "Bonus (gross, once a year)"],
  allowance: ["➕", "Extra pay every month (gross)"],
  benefit: ["🏥", "Benefit from the employer (taxed, not paid in cash)"],
  deduct: ["➖", "Deduction from net pay every month"],
};
const PRESETS = [["Medicover", "benefit"], ["Sport card (Multisport)", "benefit"], ["Medicover for my child", "benefit"], ["Bonus", "bonus"], ["Meal allowance", "allowance"], ["Union fee", "deduct"], ["Loan instalment", "deduct"]];
const MONTHS = () => Array.from({ length: 12 }, (_, i) => [String(i), new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date(2026, i, 1))]);
const plan = () => { const s = State.data.Settings; if (!s.TaxPlan) s.TaxPlan = { mode: "gross", amount: "", raised: false, pit2: true, under26: false, ppk: false, items: [] }; if (!Array.isArray(s.TaxPlan.items)) s.TaxPlan.items = []; return s.TaxPlan; };
/** The saved extras → the options of the calculation. */
export function planOpts(P) {
  const it = P.items || [], sum = k => it.filter(x => x.kind === k).reduce((a, x) => a + (x.amount || 0), 0);
  return { raisedCosts: P.raised, pit2: P.pit2, under26: P.under26, ppk: P.ppk, allowance: sum("allowance"), benefit: sum("benefit"), deduct: sum("deduct"),
    bonuses: it.filter(x => x.kind === "bonus").map(x => ({ amount: x.amount || 0, month: +x.month >= 0 ? +x.month : 11 })) };
}

export const Taxes = {
  route: "taxes", title: "Taxes",
  render(el) {
    const P = plan();
    const head = pageHead({ icon: "percent", title: T("Taxes"), sub: T("A rough estimate for Poland: gross and net pay, taxes and the bracket you are in."),
      kpis: [{ l: T("Rates valid for"), v: String(TAX.year), icon: "star" }, { l: T("Income tax"), v: "12% / 32%", icon: "percent", cls: "rate" }, { l: T("Tax-free amount a year"), v: pln(TAX.pit.taxFree), icon: "coins" }, { l: T("32% starts above (a year)"), v: pln(TAX.pit.threshold), icon: "bars", cls: "left" }] });
    const itemsHtml = () => {
      const it = P.items, tot = k => it.filter(x => x.kind === k).reduce((a, x) => a + (x.amount || 0), 0);
      return `<div class="nw-ch"><h3>${esc(T("Extras and benefits"))}</h3></div>
        <p class="hint">${esc(T("Everything on your pay slip besides the basic gross pay: bonuses, benefits like Medicover or a sport card, and deductions. It is saved and used in the calculation."))}</p>
        ${it.length ? `<div class="tx-list">${it.map(x => `<div class="tx-it" data-id="${x.id}"><span class="tx-ic">${KINDS[x.kind][0]}</span><span class="tx-n"><b>${esc(x.name)}</b><small>${esc(T(KINDS[x.kind][1]))}${x.kind === "bonus" ? " · " + esc(MONTHS()[+x.month >= 0 ? +x.month : 11][1]) : ""}</small></span>
          <span class="tx-a"><input type="text" inputmode="decimal" value="${esc(plain(x.amount))}" data-it-amount="${x.id}" aria-label="${esc(T("Amount"))}"><em>zł</em></span><button class="icon-btn danger" data-it-del="${x.id}" title="${esc(T("Delete"))}">🗑</button></div>`).join("")}</div>
          <div class="tx-tot">${["bonus", "allowance", "benefit", "deduct"].filter(k => tot(k)).map(k => `<span>${KINDS[k][0]} ${esc(pln(tot(k)))}</span>`).join("")}</div>` : `<p class="hint mc-empty">${esc(T("No extras yet. Add your first one below."))}</p>`}
        <form id="tx-add" class="tx-add"><h4>＋ ${esc(T("Add an item"))}</h4>
          <div class="tx-chips">${PRESETS.map(([n, k]) => `<button type="button" class="chip" data-preset="${esc(n)}|${k}">${esc(T(n))}</button>`).join("")}</div>
          <div class="tx-f">${field(T("Name"), textInput("name", "", T("e.g. {0}", "Medicover")))}${field(T("Type"), select("kind", Object.entries(KINDS).map(([k, v]) => [k, T(v[1])]), "benefit"))}
          ${field(T("Amount (zł)"), numInput("amount", "", "0"))}<span class="tx-mo" hidden>${field(T("Paid in"), select("month", MONTHS(), "11"))}</span></div>
          <button type="button" class="btn main" data-add-item>＋ ${esc(T("Add"))}</button></form>`;
    };
    el.innerHTML = `<div class="ni-page tx-page">${head}
      <p class="tx-pl">🇵🇱 ${esc(T("Poland only for now: these are Polish rules for {0}. Other countries may follow.", TAX.year))}</p>
      <div class="tx-grid">
        <div class="tx-left">
        ${card(`<h3>${esc(T("Your pay"))}</h3>
          <div class="tx-mode"><button type="button" class="chip${P.mode === "gross" ? " on" : ""}" data-mode="gross">${esc(T("I know the gross"))}</button><button type="button" class="chip${P.mode === "net" ? " on" : ""}" data-mode="net">${esc(T("I know the net"))}</button></div>
          <form id="tax-form">
            ${field(T("Contract type"), select("contract", [["uop", T("Employment contract (umowa o pracę)")]], "uop"))}
            <p class="hint">${esc(T("Contract for work (umowa zlecenie), self-employed with 19% flat tax and lump-sum tax will follow."))}</p>
            ${field(P.mode === "gross" ? T("Basic gross pay per month (brutto)") : T("Net pay per month (netto)"), numInput("amount", plain(P.amount), T("e.g. {0}", "10000")))}
            ${check("raised", T("Raised costs of earning income (you work in another town)"), P.raised)}
            ${check("pit2", T("Tax-free amount used at your employer (PIT-2 submitted)"), P.pit2)}
            ${check("under26", T("Under 26 – no income tax up to {0} a year", pln(TAX.youngLimit)), P.under26)}
            ${check("ppk", T("I take part in PPK (you pay {0}%, the employer {1}%)", TAX.ppk.employee * 100, TAX.ppk.employer * 100), P.ppk)}
          </form>`, "ov-card tx-in")}
        <div class="nw-card ov-card tx-items" id="tx-items">${itemsHtml()}</div></div>
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
        <p>${esc(T("This is a rough estimate for information only. It is not tax, legal or payroll advice, and it may differ from your real pay slip, because of bonuses, overtime, other contracts, reliefs, rounding, changes in the law and your personal tax return. MoneyCompass does not guarantee that the figures are correct or up to date and is not liable for decisions made on them. Check your real numbers with your payroll department, the tax office (KAS/ZUS) or a tax adviser."))}</p></div></div>`;
    const form = el.querySelector("#tax-form"), out = el.querySelector("#tax-out"), box = el.querySelector("#tx-items");
    const draw = () => {
      const v = num(P.amount) || 0, o = planOpts(P);
      if (!(v > 0)) { out.innerHTML = card(`<p class="hint mc-empty">${esc(T("Enter a pay amount to see the estimate."))}</p>`, "ov-card"); return; }
      const g = P.mode === "gross" ? v : grossFromNet(v, o), y = calcYear(g, o), f = y.first, p = TAX.pit;
      const more = r2(calcYear(g + 100, o).netMonth - y.netMonth);
      const row = (l, a, cls = "") => `<div class="tx-r ${cls}"><span>${esc(l)}</span><b>${esc(pln(a))}</b></div>`;
      const barPct = Math.min(100, Math.round(y.taxable / p.threshold * 100));
      const hint = y.over > 0 ? T("About {0} a year of your income is taxed at 32%.", pln(y.over))
        : barPct >= 85 ? T("You are close to the 32% bracket: only {0} a year left in the 12% bracket.", pln(y.room))
        : T("You are in the 12% bracket, with {0} a year of room before 32% starts.", pln(y.room));
      out.innerHTML = card(`<div class="tx-big"><div><small>${esc(y.bonus ? T("Net pay in a normal month") : T("Net pay per month"))}</small><b class="good">${esc(pln(f.net))}</b>${y.bonus ? `<small>${esc(T("Average over the year: {0}", pln(y.netMonth)))}</small>` : ""}</div><div><small>${esc(T("Gross pay per month"))}</small><b>${esc(pln(y.gross))}</b></div></div>
        <h4>${esc(T("Where the gross pay goes (per month)"))}</h4>
        ${row(T("Pension insurance"), f.pension)}${row(T("Disability insurance"), f.disability)}${row(T("Sickness insurance"), f.sickness)}${row(T("Health insurance"), f.health)}${row(T("Income tax advance"), f.tax)}${o.ppk ? row(T("PPK (your share)"), f.ppk) : ""}${f.deduct ? row(T("Other deductions"), f.deduct) : ""}${row(T("Net pay"), f.net, "tx-net")}
        <h4>${esc(T("Your tax bracket"))}</h4>
        <div class="tx-bar"><i style="width:${barPct}%"></i></div>
        <div class="tx-bl"><span>0</span><span>12%</span><span>${esc(pln(p.threshold))} → 32%</span></div>
        <p class="tx-hint ${y.over > 0 || barPct >= 85 ? "warn" : ""}">${esc(hint)}</p>
        <p class="hint">${esc(T("Each extra 100 zł of gross pay gives you about {0} net.", pln(more)))}</p>
        <h4>${esc(T("Per year"))}</h4>
        ${row(T("Gross"), y.grossYear)}${y.bonus ? row(T("…of which bonuses"), y.bonus) : ""}${row(T("Social + health insurance"), y.social + y.health)}${row(T("Income tax"), y.tax)}${o.ppk ? row(T("PPK (your share)"), y.ppk) : ""}${y.deductYear ? row(T("Other deductions"), y.deductYear) : ""}${row(T("Net"), y.netYear, "tx-net")}
        ${y.benefit ? `<p class="hint">${esc(T("Benefits are taxed like pay but you do not receive them as cash, so they only lower your net."))}</p>` : ""}
        <p class="hint">${esc(T("You keep {0} of your gross pay.", Math.round(y.netYear / y.grossYear * 100) + "%"))}${y.grossYear > TAX.zusYearLimit ? " " + esc(T("Pension and disability insurance stop once your gross for the year passes {0}.", pln(TAX.zusYearLimit))) : ""}</p>`, "ov-card tx-res");
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
    form.onsubmit = ev => ev.preventDefault();
    form.addEventListener("input", () => { P.amount = form.amount.value; save(); draw(); });
    form.addEventListener("change", () => { P.raised = form.raised.checked; P.pit2 = form.pit2.checked; P.under26 = form.under26.checked; P.ppk = form.ppk.checked; save(); draw(); });
    el.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { P.mode = b.dataset.mode; P.amount = ""; save(); Taxes.render(el); });
    bindItems(); draw();
  }
};
