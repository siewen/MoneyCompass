// MoneyCompass Pro: Compare offers, Optimize my savings, Goals, Loans, Budget, bank import.
import {
  T, State, save, Calc, Advisor, pln, rate, num, plain, fmtDate, parseDate, isoDate, inputDate, today, addMonths, monthName,
  uuid, categories, findCategory, categoryLabel, license, moduleOn, OTHER, RECEIVED, COLORS, BELKA,
} from "./core.js";
import { progress } from "./charts.js";
import { esc, card, heading, hint, row, field, textInput, numInput, dateInput, select, check, button, values, popup, confirmBox, alertBox, toast, pickFile } from "./ui.js";
import { App, requirePro } from "./app.js";
import { Rates, BOND_CODES, BONDS_WEBSITE, SAVINGS_RANKING, DEPOSITS_RANKING } from "./rates.js";
import { budgetBars, offerSalary } from "./pages-main.js";
import * as Csv from "./csv.js";

const D = () => State.data;
const locked = (title, text) => `<div class="grid">${card(`<div class="locked">🔒<h3>${esc(title)}</h3><p>${esc(text)}</p>${button(esc(T("Enter license key")), "unlock", "main")}</div>`)}</div>`;
const bindUnlock = el => { const b = el.querySelector('[data-action="unlock"]'); if (b) b.onclick = () => App.openProfile(); };

// ================================================================= Compare offers

let form = null;
export const Savings = {
  route: "savings", title: "Compare offers",
  render(el) {
    if (!license.isPro) {
      el.innerHTML = locked(T("Compare offers is part of MoneyCompass Pro"), T("Enter several bank offers – promo rate, promo limit and length, the rate afterwards and the 19% Belka tax – and see which one really pays the most."));
      return bindUnlock(el);
    }
    const d = D();
    const f = form || { Name: "", Amount: "", PromoRate: "", PromoLimit: "", PromoDays: "", StandardRate: "", PeriodDays: 365, ApplyTax: true };
    const r = Calc.savings({ ...f, Amount: num(f.Amount) || 0, PromoRate: num(f.PromoRate) || 0, PromoLimit: num(f.PromoLimit) || 0, PromoDays: num(f.PromoDays) || 0, StandardRate: num(f.StandardRate) || 0, PeriodDays: num(f.PeriodDays) || 0 });
    const ranked = d.Offers.map(o => ({ o, r: Calc.savings(o) })).sort((a, b) => b.r.net - a.r.net);
    el.innerHTML = `<div class="grid">
      ${card(`<form id="offer">${heading(T("Savings offer"))}
        ${field(T("Name"), textInput("Name", f.Name, T("e.g. {0}", "Bank X – konto oszczędnościowe")))}
        ${field(T("Amount you put in (zł)"), numInput("Amount", plain(num(f.Amount)), T("e.g. {0}", "50000")))}
        <div class="two">${field(T("Promo rate (% per year)"), numInput("PromoRate", plain(num(f.PromoRate)), "7"))}${field(T("Promo limit (zł)"), numInput("PromoLimit", plain(num(f.PromoLimit)), T("e.g. 100000 (empty = no limit)")))}</div>
        <div class="two">${field(T("Promo length (days)"), numInput("PromoDays", plain(num(f.PromoDays)), "90"))}${field(T("Rate after the promo (% per year)"), numInput("StandardRate", plain(num(f.StandardRate)), "2"))}</div>
        ${field(T("Compare over (days) - use the same number for all offers"), numInput("PeriodDays", plain(num(f.PeriodDays)), "365"))}
        ${check("ApplyTax", T("Deduct 19% Belka tax"), f.ApplyTax)}</form>`)}
      ${card(heading(T("Result")) + row(T("Interest during promo"), pln(r.promo)) + row(T("Interest after promo"), pln(r.after)) + row(T("Total before tax"), pln(r.gross)) +
        row(T("Belka tax"), pln(r.tax)) + row(T("You keep"), pln(r.net), "big good") + row(T("Real yearly rate after tax"), rate(r.effective)) +
        hint(T("Simple interest without compounding. Banks pay monthly, so the real result can be slightly higher.")) + button(T("Save to comparison"), "save-offer", "main"))}
      ${card(heading(T("Comparison")) + hint(T("Best offer on top. Tap an offer to load it into the form.")) + (ranked.length ? `<div class="list">${ranked.map((x, i) => `
        <div class="item clickable${i === 0 ? " best" : ""}" data-load="${x.o.Id}"><div><b>${i === 0 ? "🏆 " : ""}${esc(x.o.Name)}</b><span class="hint">${esc(T("{0} · {1} for {2} days{3}, then {4} · over {5} days", pln(x.o.Amount), rate(x.o.PromoRate), x.o.PromoDays, x.o.PromoLimit > 0 ? " (" + T("up to {0}", pln(x.o.PromoLimit)) + ")" : "", rate(x.o.StandardRate), x.o.PeriodDays))}</span></div>
        <div class="right"><b class="good">${pln(x.r.net)}</b><span class="hint">${rate(x.r.effective)}</span></div><button class="icon-btn danger" data-del-offer="${x.o.Id}">🗑</button></div>`).join("")}</div>` : hint(T("No saved offers yet."))), "wide")}
    </div>`;
    const fm = el.querySelector("#offer");
    fm.querySelectorAll("input").forEach(i => i.addEventListener("change", () => { form = values(fm); App.refresh(); }));
    el.querySelector('[data-action="save-offer"]').onclick = () => {
      const v = values(fm);
      const o = { Id: uuid(), Name: v.Name.trim() || T("Offer"), Amount: num(v.Amount) || 0, PromoRate: num(v.PromoRate) || 0, PromoLimit: num(v.PromoLimit) || 0,
        PromoDays: Math.round(num(v.PromoDays) || 0), StandardRate: num(v.StandardRate) || 0, PeriodDays: Math.round(num(v.PeriodDays) || 0), ApplyTax: v.ApplyTax };
      if (!(o.Amount > 0) || !(o.PeriodDays > 0)) { toast(T("Please enter an amount and the number of days to compare."), "bad"); return; }
      d.Offers.push(o); save(); form = null; toast(T("Saved \"{0}\" to the comparison.", o.Name)); App.refresh();
    };
    el.querySelectorAll("[data-load]").forEach(x => x.onclick = ev => {
      if (ev.target.closest("[data-del-offer]")) return;
      const o = d.Offers.find(y => y.Id === x.dataset.load);
      form = { ...o }; toast(T("Loaded \"{0}\". Change it and save again to add a new version.", o.Name)); App.refresh(); window.scrollTo({ top: 0, behavior: "smooth" });
    });
    el.querySelectorAll("[data-del-offer]").forEach(b => b.onclick = async () => {
      const o = d.Offers.find(y => y.Id === b.dataset.delOffer);
      if (await confirmBox(T("Delete?"), o.Name, T("Delete"), T("Cancel"), true)) { d.Offers = d.Offers.filter(y => y !== o); save(); App.refresh(); }
    });
  },
};

// ================================================================= Optimize my savings (pop-up)

const IKE = 28260, IKZE = 11304, IKZE_SELF = 16956, LIMITS_YEAR = 2026;
const BOND_NAMES = { OTS: "3 months · fixed", ROR: "1 year · variable", DOR: "2 years · variable", TOS: "3 years · fixed", COI: "4 years · inflation-linked", EDO: "10 years · inflation-linked", ROS: "6 years · family bond (800+)", ROD: "12 years · family bond (800+)" };
const TAB_NAMES = { income: "Income", expenses: "Expenses", emergency: "Emergency fund", portfolio: "My savings", savings: "Compare offers" };

export async function openOptimize() {
  if (!(await requirePro(T("Optimize my savings")))) return;
  const p = popup("", { width: 1200, cls: "wide-popup" });
  const draw = () => { p.el.innerHTML = optimizeHtml(); bind(); };
  const bind = () => {
    p.el.querySelectorAll("[data-route]").forEach(c => c.onclick = () => { p.close(); App.go(c.dataset.route); });
    p.el.querySelector('[data-action="refresh-rates"]').onclick = () => Rates.refresh(true);
    p.el.querySelectorAll("[data-compare]").forEach(b => b.onclick = async () => {
      const [list, i] = b.dataset.compare.split(":");
      const o = (list === "s" ? Rates.savings : Rates.deposits)[+i];
      const offer = Rates.toCompare(o, exampleAmount());
      D().Offers.push(offer); save();
      await alertBox(T("Added to Compare offers"), T("{0} is now in the Compare offers tab. Enter the rate after the promotion there – it is 0% until you do.", offer.Name));
    });
  };
  const listener = () => { if (!p.closed) draw(); };
  Rates.listeners.push(listener);
  const close = p.close; p.close = r => { Rates.listeners = Rates.listeners.filter(f => f !== listener); close(r); App.refresh(); };
  draw();
  Rates.refresh(true);
}
const exampleAmount = () => { const s = Calc.portfolio(D()).safe; return s > 0 ? Math.round(s) : 10000; };

function optimizeHtml() {
  const d = D(), advice = Advisor.analyse(d);
  const gain = advice.filter(a => a.kind === "money" || a.kind === "tip").reduce((s, a) => s + a.benefit, 0);
  const r = Rates.data;
  let status;
  if (!d.Settings.OnlineRates) status = T("Current rates are switched off in Options.");
  else if (Rates.updating) status = T("Updating rates…");
  else if (r.Updated) status = T("Current rates from NBP and the Ministry of Finance, updated {0}.", fmtDate(r.Updated.slice(0, 10)) + " " + r.Updated.slice(11, 16)) + (Rates.failed ? " " + T("No internet right now – showing the last known rates.") : "");
  else status = Rates.failed ? T("Could not download the current rates. Check your internet connection and press Refresh.") : T("Current rates have not been downloaded yet.");
  const ref = r.ReferenceRate > 0 ? rate(r.ReferenceRate) : null;
  const amt = exampleAmount();
  const offerRows = (list, key) => list.slice(0, 5).map((o, i) => {
    const inOffer = o.MaxAmount > 0 ? Math.min(amt, o.MaxAmount) : amt, days = Math.min(Math.max(o.Days || 365, 1), 365);
    const net = inOffer * o.Rate / 100 * days / 365 * (1 - BELKA);
    return `<div class="offer"><div><b>${esc(o.Bank)}</b>${o.Name ? `<div>${esc(o.Name)}</div>` : ""}${o.Details ? `<span class="hint">${esc(o.Details)}</span>` : ""}
      <div class="good small">${esc(days >= 365 ? T("On {0}: about {1} after tax in a year.", pln(inOffer), pln(net)) : T("On {0}: about {1} after tax in {2} days.", pln(inOffer), pln(net), days))}</div></div>
      <div class="offer-right"><b class="rate">${rate(o.Rate)}</b><a class="btn second small" href="${esc(Rates.link(o))}" target="_blank" rel="noopener">${esc(T("Open offer"))}</a>
      <button class="btn second small" data-compare="${key}:${i}">＋ ${esc(T("Compare"))}</button></div></div>`;
  }).join("<hr>");
  const offersStatus = T("Top rates from the {0} rankings, checked {1}. Conditions apply – always check the bank's own terms.", "rankomat.pl", fmtDate(String(Rates.checked).slice(0, 10)));
  const kind = { warning: ["⚠️", "bad"], safety: ["🛡️", "primary"], money: ["💳", "good"], tip: ["💡", "warn"] };
  const option = (icon, title, text, now, risk, access, best) => card(`<h3><span class="h-icon">${icon}</span>${esc(title)}</h3><p>${esc(text)}</p>
    <div class="facts"><span>${esc(T("Now"))}</span><div><b>${now}</b></div><span>${esc(T("Risk"))}</span><div>${esc(risk)}</div>
    <span>${esc(T("Access to money"))}</span><div>${esc(access)}</div><span>${esc(T("Best for"))}</span><div>${esc(best)}</div></div>`);
  const bonds = BOND_CODES.filter(c => Rates.bond(c) !== undefined).map(c => `<div class="bond"><b>${c}</b><span>${esc(T(BOND_NAMES[c]))}</span><b class="good">${rate(Rates.bond(c))}</b></div>`).join("") || "–";

  return `<h2 class="popup-title">⚡ ${esc(T("Optimize my savings"))}</h2><div class="grid">
    ${card(heading(T("Your personal plan")) + `<p class="${gain > 0 ? "good big-text" : "hint"}">${esc(gain > 0 ? T("Following these steps could be worth about {0} per year.", pln(gain)) : T("Your personal plan, based on what you entered."))}</p>` +
      hint(T("Click a step to go to the right tab.")) +
      (advice.length ? "" : `<h3 class="good">✔ ${esc(T("Well done!"))}</h3><p>${esc(T("Your emergency fund is complete, you save at least 20% and your money is in good places. Check your offers again when promotions end."))}</p>`) +
      advice.map((a, i) => `<div class="advice ${kind[a.kind][1]}"${a.route ? ` data-route="${a.route}"` : ""}><b>${kind[a.kind][0]} ${i + 1}. ${esc(a.title)}</b><p>${esc(a.text)}</p>
        ${a.benefit > 0 ? `<b class="${kind[a.kind][1]}">${esc(a.kind === "warning" ? T("Shortfall: about {0} per year", pln(a.benefit)) : T("Worth about {0} per year", pln(a.benefit)))}</b>` : ""}
        ${a.route ? `<span class="go-link">${esc(T("Go to {0} →", T(TAB_NAMES[a.route] || "Overview")))}</span>` : ""}</div>`).join(""), "wide")}
    ${card(heading(T("Best savings accounts now"), "🏦") + hint(offersStatus) + offerRows(Rates.savings, "s") + `<a class="btn second" href="${SAVINGS_RANKING}" target="_blank" rel="noopener">${esc(T("Open the full ranking"))}</a>`)}
    ${card(heading(T("Best 12-month deposits now"), "🔒") + hint(offersStatus) + offerRows(Rates.deposits, "d") + `<a class="btn second" href="${DEPOSITS_RANKING}" target="_blank" rel="noopener">${esc(T("Open the full ranking"))}</a>`)}
    ${card(heading(T("Ways to save money in Poland")) + hint(T("From the safest and most flexible to long-term. Rates change often – always check the current conditions.")) + `<p>📈 ${esc(status)}</p>` + button("⟳ " + esc(T("Refresh rates")), "refresh-rates"))}
    ${option("🏦", T("Savings account (konto oszczędnościowe)"), T("Pay in and take out any time. Banks pay the best rates as 3–6 month promotions for new money, then much less."),
      esc(ref ? T("NBP reference rate: {0}. The best promotions for new money are usually about 2–3 points higher for a few months; standard rates are often lower.", ref) : "–"),
      T("Very low – guaranteed by the BFG up to €100,000 per bank"), T("Same day"), T("Emergency fund, short-term savings"))}
    ${option("🔒", T("Fixed deposit (lokata)"), T("A fixed rate for a fixed time, e.g. 3, 6 or 12 months. If you take the money out early you usually lose the interest."),
      esc(ref ? T("Good 12-month deposits usually pay about the NBP reference rate ({0}).", ref) : "–"), T("Very low – guaranteed by the BFG"), T("At the end of the term"), T("Money you won't need for a while"))}
    ${option("🏛️", T("Polish treasury bonds (obligacje skarbowe)"), T("Lent to the State Treasury. Longer bonds (e.g. 4-year COI, 10-year EDO) follow inflation, so your money keeps its value. Bought online in PKO BP or Pekao."),
      `<div class="bonds">${bonds}</div><span class="hint">${esc(T("Interest in the first period for the bonds on sale now. Inflation-linked bonds then pay inflation plus a margin."))}</span><br><a class="btn second small" href="${BONDS_WEBSITE}" target="_blank" rel="noopener">${esc(T("Open the official bond website"))}</a>`,
      T("Very low – backed by the State"), T("Early redemption possible for a small fee"), T("Protecting savings against inflation"))}
    ${option("👤", T("IKE / IKZE (retirement accounts)"), T("Special accounts with tax benefits: IKE – no 19% Belka tax when you withdraw after 60. IKZE – payments lower your income tax every year. Can hold deposits, bonds or funds."),
      esc(T("Yearly limits in {0}: IKE {1}, IKZE {2} (self-employed: {3}).", LIMITS_YEAR, pln(IKE), pln(IKZE), pln(IKZE_SELF))), T("Depends on what you put inside"), T("Long-term (until retirement)"), T("Saving for retirement with less tax"))}
    ${option("💼", T("PPK (employee capital plan)"), T("Workplace plan: you pay a small part of your salary, your employer and the State add extra money on top. Leaving it means losing that free money."),
      esc(T("You pay 2% of your salary (0.5–4% possible), your employer at least 1.5%, and the State adds 250 zł once and 240 zł every year.")), T("Medium – invested in funds"), T("Long-term"), T("Almost everyone who is employed"))}
    ${option("📊", T("Crypto savings"), T("Higher rates on stablecoins and crypto, often without time limits. But no state guarantee: if the platform fails, your money can be lost."),
      esc(T("Rates differ a lot between platforms and coins and change often – there is no guarantee.")), T("High – no BFG guarantee, prices can fall"), T("Usually same day"), T("Only money you can afford to lose"))}
    ${card(heading(T("Please note")) + hint(T("These suggestions are calculated from what you entered and are estimates. They are not financial, investment or tax advice.")), "wide")}
  </div><div class="popup-buttons"><button class="btn second" data-close>${esc(T("Close"))}</button></div>`;
}

// ================================================================= Savings goals

let editGoal = null;
export const Goals = {
  route: "goals", title: "Savings goals",
  render(el) {
    const d = D();
    const g = editGoal ? d.Goals.find(x => x.Id === editGoal) : null;
    const f = g || { Name: "", Target: "", Saved: "", TargetDate: isoDate(addMonths(today(), 12)) };
    const perMonth = goal => {
      const months = Math.max(1, (parseDate(goal.TargetDate).getFullYear() - today().getFullYear()) * 12 + parseDate(goal.TargetDate).getMonth() - today().getMonth());
      return Math.max(0, goal.Target - goal.Saved) / months;
    };
    const target = d.Goals.reduce((s, x) => s + x.Target, 0), saved = d.Goals.reduce((s, x) => s + Math.min(x.Saved, x.Target), 0);
    el.innerHTML = `<div class="grid">
      ${card(`<form id="goal">${heading(g ? T("Edit goal") : T("Add a goal"))}
        ${field(T("Name"), textInput("name", f.Name, T("e.g. {0}", T("New car, holiday, flat"))))}
        <div class="two">${field(T("Goal amount (zł)"), numInput("target", plain(f.Target)))}${field(T("Already saved (zł)"), numInput("saved", plain(f.Saved)))}</div>
        ${field(T("Reach it by"), dateInput("date", inputDate(parseDate(f.TargetDate))))}
        <div class="buttons">${button(g ? T("Save changes") : T("Add"), "save-goal", "main")}${g ? button(T("Cancel"), "cancel-goal") : ""}</div></form>`)}
      ${card(heading(T("All goals together")) + row(T("Goal amount (zł)"), pln(target)) + row(T("Already saved"), pln(saved)) +
        row(T("To save per month for all goals"), pln(d.Goals.filter(x => x.Saved < x.Target).reduce((s, x) => s + perMonth(x), 0))) + (target > 0 ? progress(saved / target, "var(--goals)") : ""))}
      ${card(heading(T("Your goals")) + hint(T("Tap a goal to edit it, for example to update how much you have saved.")) + (d.Goals.length ? [...d.Goals].sort((a, b) => parseDate(a.TargetDate) - parseDate(b.TargetDate)).map(x => {
        const fr = x.Target > 0 ? x.Saved / x.Target : 0, done = x.Target > 0 && x.Saved >= x.Target;
        return `<div class="bar-item clickable" data-edit-goal="${x.Id}"><div class="bar-head"><b>${esc(x.Name)}</b><button class="icon-btn danger" data-del-goal="${x.Id}">🗑</button></div>
          ${progress(fr, done ? COLORS.leftOver : "var(--goals)")}<span class="hint">${esc(T("{0} of {1} ({2}%) · by {3}", pln(Math.min(x.Saved, x.Target)), pln(x.Target), Math.round(Math.min(100, fr * 100)), fmtDate(x.TargetDate)))}</span>
          <span class="${done ? "good" : ""}">${esc(done ? T("Goal reached – well done!") : T("Save about {0} per month to reach it in time.", pln(perMonth(x))))}</span></div>`;
      }).join("") : hint(T("No goals yet. Add your first one above."))), "wide")}
    </div>`;
    const fm = el.querySelector("#goal");
    el.querySelector('[data-action="save-goal"]').onclick = () => {
      const v = values(fm), t = num(v.target);
      if (!v.name.trim() || !(t > 0)) { toast(T("Please enter a name and a goal amount."), "bad"); return; }
      const item = { Name: v.name.trim(), Target: t, Saved: num(v.saved) || 0, TargetDate: isoDate(parseDate(v.date)) };
      if (g) Object.assign(g, item); else d.Goals.push({ Id: uuid(), ...item });
      editGoal = null; save(); toast(T("Saved.")); App.refresh();
    };
    const c = el.querySelector('[data-action="cancel-goal"]'); if (c) c.onclick = () => { editGoal = null; App.refresh(); };
    el.querySelectorAll("[data-edit-goal]").forEach(x => x.onclick = ev => { if (ev.target.closest("[data-del-goal]")) return; editGoal = x.dataset.editGoal; App.refresh(); window.scrollTo({ top: 0, behavior: "smooth" }); });
    el.querySelectorAll("[data-del-goal]").forEach(b => b.onclick = async () => {
      const x = d.Goals.find(y => y.Id === b.dataset.delGoal);
      if (await confirmBox(T("Delete goal?"), x.Name, T("Delete"), T("Cancel"), true)) { d.Goals = d.Goals.filter(y => y !== x); save(); App.refresh(); }
    });
  },
};

// ================================================================= Loans & debts

let editLoan = null;
export const Loans = {
  route: "loans", title: "Loans & debts",
  render(el) {
    const d = D();
    const l = editLoan ? d.Loans.find(x => x.Id === editLoan) : null;
    const f = l || { Name: "", Remaining: "", MonthlyPayment: "", RatePercent: "", EndDate: isoDate(addMonths(today(), 12)) };
    const running = d.Loans.filter(x => x.Remaining > 0);
    const payments = Calc.loanPayments(d), income = Calc.totalIncome(d), share = income > 0 ? payments / income : 0;
    const level = income <= 0 || !running.length ? "" : share > 0.4 ? `<p class="bad">${esc(T("Your loan payments take more than 40% of your income. This is high – try not to take new loans and pay off the most expensive one first."))}</p>`
      : share >= 0.3 ? `<p class="warn">${esc(T("Your loan payments take 30–40% of your income. Keep an eye on it before taking new loans."))}</p>`
      : `<p class="good">${esc(T("Your loan payments are at a safe level (below 30% of your income)."))}</p>`;
    const monthsLeft = x => Math.max(0, (parseDate(x.EndDate).getFullYear() - today().getFullYear()) * 12 + parseDate(x.EndDate).getMonth() - today().getMonth() + 1);
    el.innerHTML = `<div class="grid">
      ${card(`<form id="loan">${heading(l ? T("Edit loan") : T("Add a loan"))}
        ${field(T("Name"), textInput("name", f.Name, T("e.g. {0}", T("Car loan, credit card, mortgage"))))}
        <div class="two">${field(T("Still to pay back (zł)"), numInput("remaining", plain(f.Remaining)))}${field(T("Monthly payment (zł)"), numInput("payment", plain(f.MonthlyPayment)))}</div>
        <div class="two">${field(T("Interest rate (% per year, 0 if none)"), numInput("rate", plain(f.RatePercent), "0"))}${field(T("Last payment"), dateInput("end", inputDate(parseDate(f.EndDate))))}</div>
        <div class="buttons">${button(l ? T("Save changes") : T("Add"), "save-loan", "main")}${l ? button(T("Cancel"), "cancel-loan") : ""}</div></form>`)}
      ${card(heading(T("Your debts")) + row(T("Still to pay back"), pln(running.reduce((s, x) => s + x.Remaining, 0))) + row(T("Payments per month"), pln(payments)) +
        row(T("Share of your income"), income > 0 ? Math.round(share * 100) + "%" : "–") + row(T("Debt-free"), running.length ? monthName(new Date(Math.max(...running.map(x => parseDate(x.EndDate).getTime())))) : "–") +
        level + hint(T("These monthly payments are counted in your spending (Overview, Expenses, advice and reports) as \"Loan payments\". Don't enter them again in the Expenses tab.")))}
      ${card(heading(T("Loans")) + hint(T("Tap a loan to edit it, for example to update what is left.")) + (d.Loans.length ? `<div class="list">${d.Loans.map(x => `
        <div class="item clickable" data-edit-loan="${x.Id}"><div><b>${esc(x.Name)}</b><span class="hint">${esc(T("{0} per month · {1} per year · last payment {2} ({3} months left)", pln(x.MonthlyPayment), rate(x.RatePercent || 0), fmtDate(x.EndDate), monthsLeft(x)))}</span></div>
        <b>${pln(x.Remaining)}</b><button class="icon-btn danger" data-del-loan="${x.Id}">🗑</button></div>`).join("")}</div>` : hint(T("No loans – great! Add one above if you have any."))), "wide")}
    </div>`;
    const fm = el.querySelector("#loan");
    el.querySelector('[data-action="save-loan"]').onclick = () => {
      const v = values(fm), rem = num(v.remaining);
      if (!v.name.trim() || !(rem > 0)) { toast(T("Please enter a name and the amount still to pay back."), "bad"); return; }
      const item = { Name: v.name.trim(), Remaining: rem, MonthlyPayment: num(v.payment) || 0, RatePercent: num(v.rate) || 0, EndDate: isoDate(parseDate(v.end)) };
      if (l) Object.assign(l, item); else d.Loans.push({ Id: uuid(), ...item });
      editLoan = null; save(); toast(T("Saved.")); App.refresh();
    };
    const c = el.querySelector('[data-action="cancel-loan"]'); if (c) c.onclick = () => { editLoan = null; App.refresh(); };
    el.querySelectorAll("[data-edit-loan]").forEach(x => x.onclick = ev => { if (ev.target.closest("[data-del-loan]")) return; editLoan = x.dataset.editLoan; App.refresh(); window.scrollTo({ top: 0, behavior: "smooth" }); });
    el.querySelectorAll("[data-del-loan]").forEach(b => b.onclick = async () => {
      const x = d.Loans.find(y => y.Id === b.dataset.delLoan);
      if (await confirmBox(T("Delete loan?"), x.Name, T("Delete"), T("Cancel"), true)) { d.Loans = d.Loans.filter(y => y !== x); save(); App.refresh(); }
    });
  },
};

// ================================================================= Budget plan

export const Budget = {
  route: "budget", title: "Budget plan",
  render(el) {
    const d = D();
    const limits = d.Budgets.filter(b => b.MonthlyLimit > 0);
    const total = limits.reduce((s, b) => s + b.MonthlyLimit, 0), spent = limits.reduce((s, b) => s + Calc.spentThisMonth(b.Category), 0);
    el.innerHTML = `<div class="grid">
      ${card(heading(monthName(today())) + row(T("Spent in categories with a limit"), pln(spent)) + row(T("Your limits together"), pln(total)) +
        row(T("Left this month"), pln(total - spent), total - spent < 0 ? "bad" : "good"))}
      ${card(`<form id="budget">${heading(T("Set a monthly limit"))}${hint(T("Choose a category and how much you want to spend on it at most each month. Setting it again changes the limit."))}
        ${field(T("Category"), select("category", categories().map(c => [c.Name, categoryLabel(c.Name)]), categories()[0].Name))}
        ${field(T("Limit per month (zł)"), numInput("limit", "", T("e.g. {0}", "800")))}
        ${button(T("Save limit"), "save-limit", "main")}</form>`)}
      ${card(heading(T("Limits this month")) + hint(T("From your entries in the Expenses tab. Green: on track, amber: almost used, red: over the limit.")) +
        (limits.length ? budgetBars() : hint(T("No limits yet. Set your first one above."))), "wide")}
    </div>`;
    el.querySelectorAll("[data-budget]").forEach(b => {
      const del = document.createElement("button"); del.className = "icon-btn danger"; del.textContent = "🗑";
      del.onclick = async () => {
        if (await confirmBox(T("Delete limit?"), T(b.dataset.budget), T("Delete"), T("Cancel"), true)) { d.Budgets = d.Budgets.filter(x => x.Category !== b.dataset.budget); save(); App.refresh(); }
      };
      b.querySelector("b").after(del);
    });
    const fm = el.querySelector("#budget");
    el.querySelector('[data-action="save-limit"]').onclick = () => {
      const v = values(fm), lim = num(v.limit);
      if (!(lim > 0)) { toast(T("Please enter a limit above 0."), "bad"); return; }
      const ex = d.Budgets.find(b => b.Category === v.category);
      if (ex) ex.MonthlyLimit = lim; else d.Budgets.push({ Category: v.category, MonthlyLimit: lim });
      save(); toast(T("Saved.")); App.refresh();
    };
  },
};

// ================================================================= Bank import (pop-up)

export async function openBankImport() {
  if (!(await requirePro(T("Import from your bank")))) return;
  const fileObj = await pickFile(".csv,.txt,text/csv");
  if (!fileObj) return;
  let file;
  try { file = Csv.parse(Csv.decode(await fileObj.arrayBuffer())); }
  catch (e) { await alertBox(T("Import from your bank"), T("The file could not be read: {0}", e.message)); return; }
  if (!file.rows.length) { await alertBox(T("Import from your bank"), T("No transactions found in this file. Please choose the CSV export of your account history.")); return; }

  const d = D(), s = d.Settings;
  let showColumns = false;
  let state = null;
  const toPln = (a, cur) => cur === "PLN" ? a : ((cur === "USD" || cur === "EUR") && !Calc.rateMissing(cur, s)) ? Math.round(Calc.toPln(a, cur, s) * 100) / 100 : null;
  const sameDay = (a, b) => parseDate(a).getTime() === new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();

  const compute = () => {
    const rows = Csv.transactions(file, file.columns);
    const outgoing = rows.filter(r => r.amount < 0), incoming = rows.filter(r => r.amount > 0);
    const items = []; let dup = 0, foreign = 0;
    for (const r of outgoing.filter(r => !Csv.isOwnTransfer(r))) {
      const v = toPln(-r.amount, r.currency);
      if (v === null) { foreign++; continue; }
      if (d.Expenses.some(e => sameDay(e.Date, r.date) && Math.abs(e.Amount - v) < 0.005 && e.Description === r.description)) { dup++; continue; }
      items.push({ row: r, pln: v, category: Csv.category(r) });
    }
    const transfers = outgoing.filter(Csv.isOwnTransfer).filter(r => r.currency === "PLN")
      .filter(r => !d.Transfers.some(t => sameDay(t.Date, r.date) && Math.abs(t.Amount + r.amount) < 0.005 && t.Description === r.description))
      .map(r => ({ row: r, pln: -r.amount, toSavings: !r.ownAccount || Csv.isSavingsTransfer(r) })).sort((a, b) => b.row.date - a.row.date);
    const received = [];
    for (const r of incoming) {
      const v = toPln(r.amount, r.currency);
      if (v === null) continue;
      if (d.Received.some(x => sameDay(x.Date, r.date) && Math.abs(x.Amount - v) < 0.005 && x.Description === r.description)) continue;
      received.push({ Id: uuid(), Date: isoDate(r.date), Amount: v, Description: r.description, Kind: RECEIVED.income });
    }
    received.sort((a, b) => parseDate(b.Date) - parseDate(a.Date));
    state = { items, transfers, received, dup, foreign, total: rows.length };
  };

  const p = popup("", { width: 900, cls: "wide-popup" });
  const draw = () => {
    compute();
    const { items, transfers, received, dup, foreign } = state;
    const lines = [];
    if (items.length) {
      const dates = items.map(i => i.row.date);
      lines.push(T("{0} expenses from {1} to {2}, together {3}.", items.length, fmtDate(new Date(Math.min(...dates))), fmtDate(new Date(Math.max(...dates))), pln(items.reduce((a, i) => a + i.pln, 0))));
    } else lines.push(T("Nothing new to add."));
    if (dup) lines.push(T("{0} are already in MoneyCompass and are skipped.", dup));
    if (transfers.length) lines.push(T("{0} transfers to your own accounts – not expenses. Choose below which ones are savings.", transfers.length));
    if (received.length) lines.push(T("{0} payments received – choose below how each one counts.", received.length));
    if (foreign) lines.push(T("{0} payments in other currencies are skipped (no exchange rate).", foreign));
    const cols = Csv.columnCount(file);
    const colOptions = [[-1, "–"], ...Array.from({ length: cols }, (_, i) => [i, Csv.columnName(file, i)])];
    const byCat = {};
    items.forEach(i => { (byCat[i.category] ||= { n: 0, sum: 0 }); byCat[i.category].n++; byCat[i.category].sum += i.pln; });
    const unsorted = items.filter(i => i.category === OTHER).slice(0, 100);
    const anything = items.length || received.length || transfers.length;
    const holdNames = [...d.Holdings.map((h, i) => [i, h.Name]), [-1, T("New: Savings account")]];
    const defaultTarget = d.Holdings.findIndex(h => h.Place === "Bank");
    const date = r => fmtDate(r.date);
    p.el.innerHTML = `<h2 class="popup-title">⬆ ${esc(T("Import from your bank"))}</h2>
      ${hint(T("Your bank statement (CSV) becomes expenses, sorted into categories."))}
      <div class="grid">
      ${card(`<b>${esc(fileObj.name)}</b>` + hint(T("{0} – {1}, {2} rows.", file.bank || T("bank recognised from the columns"), "CSV", file.rows.length)) +
        hint(file.bank ? T("Found automatically for {0}. Change them only if the preview looks wrong.", file.bank) : T("Found from the content of the file. Check that date, amount and description are right.")) +
        button(esc(showColumns ? T("Hide columns") : T("Change columns")), "columns", "second small") +
        (showColumns ? `<div class="two">${["Date", "Amount", "Debit", "Credit", "Description", "Counterparty", "Category", "Currency"].map(k => field(T(k === "Debit" ? "Amount" : k === "Credit" ? "Amount" : k === "Counterparty" ? "Name" : k) + (k === "Debit" ? " −" : k === "Credit" ? " +" : ""), select("col-" + k, colOptions, file.columns[k]))).join("")}</div>` : "") +
        hint(T("The file is only read on this computer.")))}
      ${card(heading(T("3. What will be added")) + lines.map(l => `<p>${esc(l)}</p>`).join("") +
        Object.entries(byCat).sort((a, b) => b[1].sum - a[1].sum).map(([c, v]) => row(`${categoryLabel(c)} (${v.n})`, pln(v.sum))).join(""))}
      ${unsorted.length ? card(heading(T("Not sorted yet")) + hint(T("MoneyCompass could not tell what these are. Choose a category, or leave them as \"Other\".")) +
        `<div class="list">${unsorted.map((i, n) => `<div class="item"><div><b>${esc(i.row.description || "–")}</b><span class="hint">${date(i.row)} · ${pln(i.pln)}</span></div>
        ${select("cat-" + items.indexOf(i), categories().map(c => [c.Name, categoryLabel(c.Name)]), i.category)}</div>`).join("")}</div>`, "wide") : ""}
      ${received.length ? card(heading(T("Money received")) + hint(T("All money coming in counts as extra income for its month. Choose Salary for your regular pay: MoneyCompass then counts it every month. Not income is ignored.")) +
        `<div class="list">${received.slice(0, 150).map((r, n) => `<div class="item"><div><b>${esc(r.Description || "–")}</b><span class="hint">${fmtDate(r.Date)} · +${pln(r.Amount)}</span></div>
        ${select("kind-" + n, [[RECEIVED.income, T("Extra income (this month)")], [RECEIVED.salary, T("Salary (regular pay)")], [RECEIVED.none, T("Not income")]], r.Kind)}</div>`).join("")}</div>`, "wide") : ""}
      ${transfers.length ? card(heading(T("Moved to your own accounts")) + hint(T("These are not expenses. Choose which ones went into savings: they are added to My savings.")) +
        field(T("Add savings to"), select("target", holdNames, defaultTarget >= 0 ? defaultTarget : -1)) +
        `<div class="list">${transfers.map((t, n) => `<div class="item"><div><b>${esc(t.row.description || "–")}</b><span class="hint">${date(t.row)} · ${pln(t.pln)}</span></div>
        ${select("tr-" + n, [["1", T("Savings")], ["0", T("Not savings")]], t.toSavings ? "1" : "0")}</div>`).join("")}</div>`, "wide") : ""}
      </div>
      <div class="popup-buttons"><button class="btn second" data-close>${esc(T("Cancel"))}</button>
      <button class="btn main" data-import ${anything ? "" : "disabled"}>${esc(!anything ? T("Import") : !received.length ? T("Import {0} expenses", items.length) : T("Import {0} expenses and {1} payments received", items.length, received.length))}</button></div>`;
    p.el.querySelector('[data-action="columns"]').onclick = () => { showColumns = !showColumns; draw(); };
    p.el.querySelectorAll('select[name^="col-"]').forEach(sel => sel.onchange = () => { file.columns[sel.name.slice(4)] = +sel.value; draw(); });
    p.el.querySelector("[data-import]").onclick = () => doImport();
  };
  const doImport = async () => {
    const v = values(p.el);
    const { items, transfers, received } = state;
    items.forEach((i, n) => { if (v["cat-" + n]) i.category = v["cat-" + n]; });
    received.forEach((r, n) => { if (v["kind-" + n]) r.Kind = v["kind-" + n]; });
    transfers.forEach((t, n) => { if (v["tr-" + n] !== undefined) t.toSavings = v["tr-" + n] === "1"; });
    for (const i of items) {
      const c = findCategory(i.category);
      d.Expenses.push({ Id: uuid(), Date: isoDate(i.row.date), Description: i.row.description, Category: c ? c.Name : OTHER, Amount: i.pln, Essential: !!c?.Essential });
    }
    d.Received.push(...received);
    const saved = transfers.filter(t => t.toSavings);
    let target = null;
    if (saved.length) {
      const idx = +(v.target ?? -1);
      target = idx >= 0 ? d.Holdings[idx] : null;
      if (!target) { target = { Id: uuid(), Name: T("Savings account"), Place: "Bank", Amount: 0, Currency: "PLN", RatePercent: 0, Safe: true }; d.Holdings.push(target); }
      target.Amount += saved.reduce((a, t) => a + t.pln, 0);
    }
    for (const t of transfers) d.Transfers.push({ Id: uuid(), Date: isoDate(t.row.date), Amount: t.pln, Description: t.row.description, Saved: t.toSavings, HoldingId: t.toSavings ? target?.Id ?? null : null });
    save();
    let msg = !received.length ? T("{0} expenses were added. You find them in the Expenses tab.", items.length)
      : T("{0} expenses were added (Expenses tab) and {1} payments received (Income tab).", items.length, received.length);
    if (target) msg += "\n" + T("{0} went into savings: added to \"{1}\" (My savings tab).", pln(saved.reduce((a, t) => a + t.pln, 0)), target.Name);
    p.close();
    await alertBox(T("Import finished"), msg);
    for (const r of received.filter(r => r.Kind === RECEIVED.salary)) await offerSalary(r);
    App.refresh();
  };
  draw();
}
