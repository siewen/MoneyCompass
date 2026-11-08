// MoneyCompass Pro: Compare offers, Optimize my finances, Goals, Loans, Budget, bank import.
import {
  T, State, save, Calc, Advisor, pln, rate, num, plain, fmtDate, parseDate, isoDate, inputDate, today, addMonths, monthName,
  uuid, categories, findCategory, categoryLabel, license, moduleOn, OTHER, RECEIVED, COLORS, BELKA, goalSaved, fromPln } from "./core.js";
import { ico } from "./nw.js";
import { pageHead, band, si, IC, ring } from "./page-head.js";
import { budgetDash, loansDash, dcard, iconizeCards } from "./dash.js";
import { progress, hbars, savingsChart } from "./charts.js";
import { debtAdvice, extraEffect, applyExtra } from "./debts.js";
import { NEW_CAT } from "./ui.js";
import { esc, card, heading, hint, row, field, textInput, numInput, dateInput, select, check, button, values, popup, confirmBox, alertBox, toast, pickFile, ICONS, headingTip } from "./ui.js";
import { App, requirePro } from "./app.js";
import { Rates, BOND_CODES, BONDS_WEBSITE, SAVINGS_RANKING, DEPOSITS_RANKING } from "./rates.js";
import { budgetBars, offerSalary, binCard, bindBin } from "./pages-main.js";
import * as Csv from "./csv.js";
import { toBin, loanPlan, planLoan, loanNextPayment, lang, ruleFor, healthCheck, loanSchedule } from "./core.js";

const D = () => State.data;
const locked = (title, text) => `<div class="grid">${card(`<div class="locked">🔒<h3>${esc(title)}</h3><p>${esc(text)}</p>${button(esc(T("Enter license key")), "unlock", "main")}</div>`)}</div>`;
const bindUnlock = el => { const b = el.querySelector('[data-action="unlock"]'); if (b) b.onclick = () => App.openProfile(); };

// ================================================================= Compare offers

let form = null;
let bankAfter = null;   // rate after the promo assumed for the bank offers (null = not set yet)
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
    // ---------- Today's bank offers, calculated for the same amount and period ----------
    const safe = Calc.portfolio(d).safe;
    const A = num(f.Amount) || (safe > 0 ? Math.round(safe) : 10000);
    const period = Math.round(num(f.PeriodDays) || 365);
    const after = bankAfter ?? 0;
    const bankRows = [...Rates.savings.map(o => ({ o, kind: T("Savings account") })), ...Rates.deposits.map(o => ({ o, kind: T("12-month deposit") }))].map(x => {
      const offer = { Amount: A, PromoRate: x.o.Rate, PromoLimit: x.o.MaxAmount ? fromPln(x.o.MaxAmount) : 0, PromoDays: Math.min(Math.max(x.o.Days || 365, 1), period), StandardRate: after, PeriodDays: period, ApplyTax: f.ApplyTax !== false };
      return { ...x, offer, r: Calc.savings(offer) };
    }).sort((a, b) => b.r.net - a.r.net);
    const mine = (num(f.Amount) || 0) > 0 ? r : null;
    const bestBank = bankRows[0];
    const diff = v => mine ? `<span class="${v - mine.net >= 0 ? "good" : "bad"}">${v - mine.net >= 0 ? "+" : "−"}${pln(Math.abs(v - mine.net))}</span>` : "";
    const chartItems = [...(mine ? [{ label: (f.Name || T("Your offer")).slice(0, 22), value: mine.net, color: "#7E22CE", text: pln(mine.net) }] : []),
      ...bankRows.slice(0, 5).map((x, i) => ({ label: x.o.Bank.slice(0, 22), value: x.r.net, color: ["#2a78d6", "#1baf7a", "#eda100", "#e87ba4", "#008300"][i], text: pln(x.r.net) }))];
    const checked = String(Rates.checked);
    const checkedText = checked.length > 10 ? fmtDate(checked.slice(0, 10)) + " " + new Date(checked).toTimeString().slice(0, 5) : fmtDate(checked);
    const bankCard = card(heading(T("Today's bank offers compared"), "🏦") +
      `<div class="sync-line"><span>🔄 ${esc(T("Bank offers last updated: {0}", checkedText))}${Rates.updating ? " · " + esc(T("Updating rates…")) : ""}</span>${button("⟳ " + esc(T("Refresh rates")), "refresh-offers", "second small")}</div>` +
      hint(T("The best savings accounts and 12-month deposits right now, calculated for {0} over {1} days{2}.", pln(A), period, f.ApplyTax !== false ? ", " + T("after the 19% Belka tax") : "")) +
      `<div class="two">${field(T("Amount to compare (zł)"), numInput("bank-amount", plain(A)))}${field(T("Rate after the promotion, for all offers (% per year)"), numInput("bank-after", plain(after), "0"))}</div>` +
      hint(T("Most banks pay much less after a promotion ends, and the rankings don't say how much. 0% shows only what the promotion itself brings.")) +
      (mine && bestBank ? `<p class="${bestBank.r.net > mine.net ? "good" : ""}"><b>${esc(bestBank.r.net > mine.net
        ? T("{0} would bring about {1} more than your offer.", `${bestBank.o.Bank}${bestBank.o.Name ? " – " + bestBank.o.Name : ""}`, pln(bestBank.r.net - mine.net))
        : T("Your offer pays more than today's best bank offer."))}</b></p>` : "") +
      hbars(chartItems) +
      `<div class="list bank-list">${bankRows.map((x, i) => `<div class="item${i === 0 ? " best" : ""}">
        <div><b>${i === 0 ? "🏆 " : ""}${esc(x.o.Bank)}</b>${x.o.Name ? ` – ${esc(x.o.Name)}` : ""}
          <span class="hint">${esc(x.kind)} · ${rate(x.o.Rate)} · ${esc(x.o.MaxAmount > 0 ? T("up to {0}", pln(fromPln(x.o.MaxAmount))) : T("no limit"))} · ${esc(T("{0} days", Math.min(x.o.Days || 365, period)))}${x.o.Details ? " · " + esc(x.o.Details) : ""}</span></div>
        <div class="right"><b class="good">${pln(x.r.net)}</b><span class="hint">${rate(x.r.effective)} ${diff(x.r.net)}</span></div>
        <div class="row-actions"><a class="btn second small" href="${esc(Rates.link(x.o))}" target="_blank" rel="noopener">${esc(T("Open offer"))}</a>
        <button class="btn second small" data-bank="${i}">＋ ${esc(T("Compare"))}</button></div></div>`).join("")}</div>` +
      hint(T("Top rates from the {0} rankings, checked {1}. Conditions apply – always check the bank's own terms.", "rankomat.pl", fmtDate(String(Rates.checked).slice(0, 10)))), "wide");
    const avgNet = bankRows.length ? bankRows.reduce((a, x) => a + x.r.net, 0) / bankRows.length : 0, avgRate = bankRows.length ? bankRows.reduce((a, x) => a + x.o.Rate, 0) / bankRows.length : 0;
    const bestNet = bestBank ? bestBank.r.net : 0, extra = Math.max(0, bestNet - avgNet);
    const topHead = pageHead({ icon: "scale", title: T("Compare Offers"), sub: T("Compare savings accounts, deposits and promotional offers to maximize your returns."),
        kpis: [{ l: T("Best Offer Return"), v: pln(bestNet), icon: "trophy" }, { l: T("Average Yield"), v: rate(avgRate), icon: "trend", cls: "in" }, { l: T("Potential Extra Profit"), v: pln(extra), icon: "coins", cls: "left" }, { l: T("Compared Banks"), v: String(bankRows.length), icon: "bank", cls: "rate", hi: true }], btn: `<button class="btn main rp-gen" data-action="add-offer">＋ ${esc(T("Add Offer"))}</button>` }) +
      (bestBank ? `<div class="rec-band"><div class="rec-l"><div class="rec-t">${si(IC.star, 30)}<span>${esc(T("Recommended Offer"))}</span></div>
        <div class="rec-b"><span class="rec-logo">${esc((bestBank.o.Bank || "?").trim().charAt(0).toUpperCase())}</span><div><b class="rec-name">${esc(bestBank.o.Bank)}</b><small>${esc(bestBank.o.Name || "")}</small><span class="rec-stars">★★★★★</span></div></div></div>
        <div class="rec-f"><small>${esc(T("Deposit Amount"))}</small><b>${esc(pln(A))}</b></div>
        <div class="rec-f"><small>${esc(T("Annual Return After Tax"))}</small><b class="good">${esc(pln(bestNet))}</b></div>
        <div class="rec-f"><small>${esc(T("Annual Yield"))}</small><b>${esc(A > 0 ? rate(bestNet / A * 100) : "–")}</b></div>
        <div class="rec-f"><small>${esc(T("Advantage Over Average"))}</small><b class="good">+${esc(pln(extra))}</b><a class="rec-btn" href="${esc(Rates.link(bestBank.o))}" target="_blank" rel="noopener">${esc(T("View Offer Details"))} →</a></div></div>` : "");
    const bottomBand = bestBank ? band(T("Profit Projection"), "bars", [{ l: T("Deposit"), v: pln(A) }, { l: T("Best Current Offer"), v: pln(bestNet) }, { l: T("Average Offer"), v: pln(avgNet) }, { l: T("Additional Profit"), v: pln(extra), cls: "good" }, { l: T("Projected Additional Profit Over 5 Years"), v: pln(extra * 5), big: true, cls: "good" }], "rp-trend2") : "";
    const savedCard = card(`<div class="nw-ch"><span class="rp-si i-save">${si(IC.save, 24)}</span><h3>${esc(T("My Saved Offers"))}</h3></div>` + hint(T("Best offer on top. Tap an offer to load it into the form.")) + (ranked.length ? `<div class="list">${ranked.map((x, i) => `
        <div class="item clickable${i === 0 ? " best" : ""}" data-load="${x.o.Id}"><div><b>${i === 0 ? "🏆 " : ""}${esc(x.o.Name)}</b><span class="hint">${esc(T("{0} · {1} for {2} days{3}, then {4} · over {5} days", pln(x.o.Amount), rate(x.o.PromoRate), x.o.PromoDays, x.o.PromoLimit > 0 ? " (" + T("up to {0}", pln(x.o.PromoLimit)) + ")" : "", rate(x.o.StandardRate), x.o.PeriodDays))}</span></div>
        <div class="right"><b class="good">${pln(x.r.net)}</b><span class="hint">${rate(x.r.effective)}</span></div><button class="icon-btn danger" data-del-offer="${x.o.Id}">🗑</button></div>`).join("")}</div>` : hint(T("No saved offers yet."))));
    const formCard = card(`<form id="offer"><div class="nw-ch"><span class="rp-si i-calc">${si(IC.calc, 24)}</span><h3>${esc(T("Savings Offer Calculator"))}</h3></div>
        ${d.Holdings.length ? field(T("Fill in from Savings"), select("from-holding", [["", T("Choose…")], ...d.Holdings.map(h => [h.Id, `${h.Name} · ${pln(Calc.toPln(h.Amount, h.Currency, d.Settings))} · ${rate(h.RatePercent || 0)}`])], "")) +
          hint(T("Compare what your savings earn now with other offers.")) : ""}
        ${field(T("Name"), textInput("Name", f.Name, T("e.g. {0}", "Bank X – konto oszczędnościowe")))}
        ${field(T("Amount you put in (zł)"), numInput("Amount", plain(num(f.Amount)), T("e.g. {0}", "50000")))}
        <div class="two">${field(T("Promo rate (% per year)"), numInput("PromoRate", plain(num(f.PromoRate)), "7"))}${field(T("Promo limit (zł)"), numInput("PromoLimit", plain(num(f.PromoLimit)), T("e.g. 100000 (empty = no limit)")))}</div>
        <div class="two">${field(T("Promo length (days)"), numInput("PromoDays", plain(num(f.PromoDays)), "90"))}${field(T("Rate after the promo (% per year)"), numInput("StandardRate", plain(num(f.StandardRate)), "2"))}</div>
        ${field(T("Compare over (days) - use the same number for all offers"), numInput("PeriodDays", plain(num(f.PeriodDays)), "365"))}
        ${check("ApplyTax", T("Deduct 19% Belka tax"), f.ApplyTax)}<button type="button" class="btn main cmp-calcbtn" data-action="calc">${esc(T("Calculate"))}</button></form>`);
    const resultCard = card(`<div class="nw-ch"><span class="rp-si i-res">${si(IC.res, 24)}</span><h3>${esc(T("Calculator Result"))}</h3></div>` + row(T("Interest during promo"), pln(r.promo)) + row(T("Interest after promo"), pln(r.after)) + row(T("Total before tax"), pln(r.gross)) +
        row(T("Belka tax"), pln(r.tax)) + row(T("You keep"), pln(r.net), "big good") + row(T("Real yearly rate after tax"), rate(r.effective)) +
        hint(T("Simple interest without compounding. Banks pay monthly, so the real result can be slightly higher.")) + button(T("Save to comparison"), "save-offer", "main"));
    const top5 = bankRows.slice(0, 5), barMax = Math.max(1, ...top5.map(x => x.r.net)), barCol = ["#1FBF85", "#22C7A0", "#3B9BEA", "#5B7CF0", "#8B5CF6"];
    const okIc = `<span class="nw-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12.500l4.500 4.500L19 7.500"/></svg></span>`;
    const rankCard = `<div class="nw-card cmp-rank"><div class="nw-ch"><span class="rp-si i-rank">${si(IC.bars, 24)}</span><h3>${esc(T("Offer Comparison Ranking"))}</h3></div>${top5.map((x, i) => `<div class="cr-row"><b class="cr-n">${i + 1}.</b><span class="cr-name">${esc(x.o.Bank)}</span><span class="cr-bar"><i style="width:${Math.max(8, x.r.net / barMax * 100)}%;background:${barCol[i]}"></i></span><span class="cr-v">${esc(pln(x.r.net))}</span></div>`).join("") || `<p class="hint">–</p>`}</div>`;
    const soonest = bankRows.filter(x => x.o.Days && x.o.Days < 60).length;
    const ins = [bestBank ? T("{0} currently provides the highest return.", bestBank.o.Bank) : null,
      bestBank ? T("Switching from a standard 2% account could generate an additional {0} annually.", pln(Math.max(0, bestNet - A * 0.02 * (f.ApplyTax !== false ? 0.81 : 1)))) : null,
      soonest ? T("{0} promotional rates expire within 60 days.", soonest) : null,
      top5.length ? T("Expected annual returns range from {0} to {1}.", pln(top5[top5.length - 1].r.net), pln(top5[0].r.net)) : null,
      T("Current savings rates remain attractive.")].filter(Boolean);
    const insCard = `<div class="nw-card cmp-ins"><div class="nw-ch"><span class="rp-si i-bulb">${si(IC.bulb, 24)}</span><h3>${esc(T("AI Offer Insights"))}</h3></div><ul class="nw-ul">${ins.map(x => `<li>${okIc}<span>${esc(x)}</span></li>`).join("")}</ul></div>`;
    const tableCard = `<div class="nw-card cmp-table"><div class="nw-ch"><span class="rp-si i-table">${si(IC.table, 24)}</span><h3>${esc(T("Comparison Table"))}</h3>${button("⟳ " + esc(T("Refresh rates")), "refresh-offers", "second small")}</div>
      <div class="cmp-ctl"><label>${esc(T("Amount to compare (zł)"))}${numInput("bank-amount", plain(A))}</label><label>${esc(T("Rate after the promotion, for all offers (% per year)"))}${numInput("bank-after", plain(after), "0")}</label></div>
      <p class="hint">${esc(T("Bank offers last updated: {0}", checkedText))}</p><table><thead><tr><th>${esc(T("Bank"))}</th><th>${esc(T("Promotional Rate"))}</th><th>${esc(T("Effective Annual Yield"))}</th><th>${esc(T("Expected Profit"))}</th><th>${esc(T("Risk Rating"))}</th><th></th></tr></thead><tbody>${bankRows.slice(0, 8).map((x, i) => `<tr><td class="ct-bank">${i === 0 ? '<span class="ct-tr">🏆</span>' : `<span class="ct-dot">${esc((x.o.Bank || "?").trim().charAt(0).toUpperCase())}</span>`}<span>${esc(x.o.Bank)}${x.o.Name ? `<small class="ct-sub">${esc(x.o.Name)}</small>` : ""}</span></td><td>${esc(rate(x.o.Rate))}</td><td>${esc(rate(x.r.effective))}</td><td><b>${esc(pln(x.r.net))}</b></td><td><span class="ct-risk" title="${esc(T("Covered by the deposit guarantee scheme"))}">A</span></td><td class="ct-act"><a class="nw-pill" href="${esc(Rates.link(x.o))}" target="_blank" rel="noopener">${esc(T("Open offer"))}</a> <button class="nw-pill" data-bank="${i}">＋ ${esc(T("Compare"))}</button></td></tr>`).join("")}</tbody></table></div>`;
    const bestCard = `<div class="nw-card cmp-best"><div class="nw-ch"><span class="rp-si">${si(IC.trend, 24)}</span><h3>${esc(T("Best Opportunity Summary"))}</h3></div><div class="cb-body"><div><small>${esc(T("Current Selection"))}:</small><b>${esc(bestBank ? bestBank.o.Bank : "–")}</b>
      <p><span>${esc(T("Expected Profit"))}:</span><em>${esc(pln(bestNet))}</em></p><p><span>${esc(T("Average Competitor"))}:</span><b>${esc(pln(avgNet))}</b></p></div><div class="cb-box"><small>${esc(T("Additional Earnings"))}:</small><b>${esc(pln(extra))}</b></div></div></div>`;
    el.innerHTML = topHead + `<div class="cmp-grid">${rankCard}${insCard}<div class="cmp-calc">${formCard}${savedCard}${resultCard}</div>${tableCard}${bestCard}</div>
    <div class="grid">
      ${binCard(["offer"])}
    </div>` + bottomBand;
    const fm = el.querySelector("#offer");
    const pick = fm.querySelector('[name="from-holding"]');
    if (pick) pick.onchange = () => {
      const h = d.Holdings.find(x => x.Id === pick.value);
      if (!h) return;
      form = { Name: h.Name, Amount: Math.round(Calc.toPln(h.Amount, h.Currency, d.Settings) * 100) / 100, PromoRate: h.RatePercent || 0, PromoLimit: "", PromoDays: 0,
        StandardRate: h.RatePercent || 0, PeriodDays: 365, ApplyTax: true };
      App.refresh();
    };
    fm.querySelectorAll("input").forEach(i => i.addEventListener("change", () => { form = values(fm); App.refresh(); }));
    el.querySelector('[data-action="add-offer"]').onclick = () => { fm.scrollIntoView({ behavior: "smooth", block: "center" }); const n = fm.querySelector('[name="Name"]'); if (n) n.focus(); };
    fm.querySelector('[data-action="calc"]').onclick = () => { form = values(fm); App.refresh(); };
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
    el.querySelector('[data-action="refresh-offers"]').onclick = async () => { await Rates.refresh(true); App.refresh(); toast(T("Bank offers last updated: {0}", fmtDate(String(Rates.checked).slice(0, 10)))); };
    el.querySelector('[name="bank-amount"]').onchange = e => { const v = num(e.target.value); form = { ...(form || f), Amount: v > 0 ? v : "" }; App.refresh(); };
    el.querySelector('[name="bank-after"]').onchange = e => { bankAfter = Math.max(0, num(e.target.value) || 0); App.refresh(); };
    el.querySelectorAll("[data-bank]").forEach(b => b.onclick = () => {
      const x = bankRows[+b.dataset.bank];
      const o = { Id: uuid(), Name: x.o.Name ? `${x.o.Bank} – ${x.o.Name}` : x.o.Bank, ...x.offer };
      d.Offers.push(o); save(); toast(T("Saved \"{0}\" to the comparison.", o.Name)); App.refresh();
    });
    el.querySelectorAll("[data-del-offer]").forEach(b => b.onclick = async () => {
      const o = d.Offers.find(y => y.Id === b.dataset.delOffer);
      if (await confirmBox(T("Delete?"), o.Name, T("Delete"), T("Cancel"), true)) { toBin("offer", o); d.Offers = d.Offers.filter(y => y !== o); save(); App.refresh(); }
    });
  },
};

// ================================================================= Optimize my finances (pop-up)

const IKE = 28260, IKZE = 11304, IKZE_SELF = 16956, LIMITS_YEAR = 2026;
const BOND_NAMES = { OTS: "3 months · fixed", ROR: "1 year · variable", DOR: "2 years · variable", TOS: "3 years · fixed", COI: "4 years · inflation-linked", EDO: "10 years · inflation-linked", ROS: "6 years · family bond (800+)", ROD: "12 years · family bond (800+)" };
const TAB_NAMES = { income: "Inflows", expenses: "Outflows", emergency: "Emergency fund", portfolio: "Savings", savings: "Compare offers" };

export async function openOptimize() {
  if (!(await requirePro(T("Optimize my finances")))) return;
  const p = popup("", { width: 1280, cls: "wide-popup nw-win nw-opt" });
  const draw = () => { p.el.innerHTML = optimizeHtml(); bind(); };
  const bind = () => {
    p.el.querySelectorAll("[data-route]").forEach(c => c.onclick = () => { p.close(); App.go(c.dataset.route); });
    // Choose the type of a loan right here – the comparison appears at once
    p.el.querySelectorAll("[data-loan-kind]").forEach(s => { s.onclick = e => e.stopPropagation(); s.onchange = () => {
      const l = D().Loans.find(x => x.Id === s.dataset.loanKind); if (l) { l.Kind = s.value; save(); draw(); } }; });
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

const RISK_LABEL = { low: "Low risk", mid: "Medium risk", high: "High risk" };
function optimizeHtml() {
  const d = D(), advice = Advisor.analyse(d);
  const gain = advice.filter(a => a.kind === "money" || a.kind === "tip").reduce((s, a) => s + a.benefit, 0);
  const r = Rates.data;
  let status;
  if (!d.Settings.OnlineRates) status = T("Current rates are switched off in Settings.");
  else if (Rates.updating) status = T("Updating rates…");
  else if (r.Updated) status = T("Current rates from NBP and the Ministry of Finance, updated {0}.", fmtDate(r.Updated.slice(0, 10)) + " " + r.Updated.slice(11, 16)) + (Rates.failed ? " " + T("No internet right now – showing the last known rates.") : "");
  else status = Rates.failed ? T("Could not download the current rates. Check your internet connection and press Refresh.") : T("Current rates have not been downloaded yet.");
  const ref = r.ReferenceRate > 0 ? rate(r.ReferenceRate) : null;
  const amt = exampleAmount();
  const offerRows = (list, key) => list.slice(0, 5).map((o, i) => {
    const inOffer = o.MaxAmount > 0 ? Math.min(amt, fromPln(o.MaxAmount)) : amt, days = Math.min(Math.max(o.Days || 365, 1), 365);
    const net = inOffer * o.Rate / 100 * days / 365 * (1 - BELKA);
    return `<div class="offer"><div><b>${esc(o.Bank)}</b>${o.Name ? `<div>${esc(o.Name)}</div>` : ""}${o.Details ? `<span class="hint">${esc(o.Details)}</span>` : ""}
      <div class="good small">${esc(days >= 365 ? (key === "s" ? T("On {0}: about {1} a year after tax – a savings account, your money stays available.", pln(inOffer), pln(net)) : T("On {0}: about {1} after tax in a year.", pln(inOffer), pln(net))) : T("On {0}: about {1} after tax in {2} days.", pln(inOffer), pln(net), days))}</div></div>
      <div class="offer-right"><b class="rate">${rate(o.Rate)}</b><a class="btn second small" href="${esc(Rates.link(o))}" target="_blank" rel="noopener">${esc(T("Open offer"))}</a>
      <button class="btn second small" data-compare="${key}:${i}">＋ ${esc(T("Compare"))}</button></div></div>`;
  }).join("<hr>");
  const offersStatus = T("Top rates from the {0} rankings, checked {1}. Conditions apply – always check the bank's own terms.", "rankomat.pl", fmtDate(String(Rates.checked).slice(0, 10)));
  const kind = { warning: [ICONS.alert, "bad"], safety: [ICONS.shield, "primary"], money: [ICONS.coins, "good"], tip: [ICONS.bulb, "warn"], insight: [ICONS.chart, "info"] };
  const option = (icon, title, text, now, risk, access, best) => card(`<h3><span class="h-icon">${icon}</span>${esc(title)}</h3><p>${esc(text)}</p>
    <div class="facts"><span>${esc(T("Now"))}</span><div><b>${now}</b></div><span>${esc(T("Risk"))}</span><div><span class="risk ${risk[0]}">${esc(T(RISK_LABEL[risk[0]]))}</span> ${esc(risk[1].includes(" – ") ? risk[1].slice(risk[1].indexOf(" – ") + 3) : risk[1])}</div>
    <span>${esc(T("Access to money"))}</span><div>${esc(access)}</div><span>${esc(T("Best for"))}</span><div>${esc(best)}</div></div>`);
  const bonds = BOND_CODES.filter(c => Rates.bond(c) !== undefined).map(c => `<div class="bond"><b>${c}</b><span>${esc(T(BOND_NAMES[c]))}</span><b class="good">${rate(Rates.bond(c))}</b></div>`).join("") || "–";

  // No window title: the button that opens it already says "Optimize my finances", and each card has its own heading
  return `<div class="grid optimize-grid">
    ${(() => { const hc = healthCheck(d); if (!hc.length) return "";
      const good = hc.filter(x => x.state === "good").length;
      return card(headingTip(T("Financial health check"), T("Your numbers compared with common rules of thumb, e.g. the 50/30/20 rule: up to 50% of income for essentials, up to 30% for the rest, at least 20% saved.")) +
        `<p class="hint">${esc(T("{0} of {1} in the green.", good, hc.length))}</p><div class="health">` +
        hc.map(x => `<div class="h-row"><span class="h-dot ${x.state}"></span><span class="h-label">${esc(x.label)}</span><b class="h-val ${x.state === "good" ? "" : x.state}">${esc(x.value)}</b><span class="h-aim">${esc(T("aim: {0}", x.aim))}</span></div>`).join("") + "</div>");
    })()}
    ${card(heading(T("Your personal plan"), "🧭") + `<p class="${gain > 0 ? "good big-text" : "hint"}">${esc(gain > 0 ? T("Following these steps could be worth about {0} per year.", pln(gain)) : T("Your personal plan, based on what you entered."))}</p>` +
      hint(T("Click a step to go to the right tab.")) +
      (advice.length ? "" : `<h3 class="good">✔ ${esc(T("Well done!"))}</h3><p>${esc(T("Your emergency fund is complete, you save at least 20% and your money is in good places. Check your offers again when promotions end."))}</p>`) +
      advice.map((a, i) => `<div class="advice ${kind[a.kind][1]}"${a.route ? ` data-route="${a.route}"` : ""}><b class="adv-title"><span class="adv-ic">${kind[a.kind][0]}</span>${i + 1}. ${esc(a.title)}</b><p>${esc(a.text)}</p>
        ${a.benefit > 0 ? `<b class="${kind[a.kind][1]}">${esc(a.kind === "warning" ? T("Shortfall: about {0} per year", pln(a.benefit)) : T("Worth about {0} per year", pln(a.benefit)))}</b>` : ""}
        ${a.route ? `<span class="go-link">${esc(T("Go to {0} →", T(TAB_NAMES[a.route] || "Overview")))}</span>` : ""}</div>`).join(""))}
    ${moduleOn("loans") ? debtAdvice(d) : ""}
    ${card(heading(T("Best savings accounts now"), "🏦") + hint(offersStatus) + offerRows(Rates.savings, "s") + `<a class="btn second" href="${SAVINGS_RANKING}" target="_blank" rel="noopener">${esc(T("Open the full ranking"))}</a>`)}
    ${card(heading(T("Best 12-month deposits now"), "🔒") + hint(offersStatus) + offerRows(Rates.deposits, "d") + `<a class="btn second" href="${DEPOSITS_RANKING}" target="_blank" rel="noopener">${esc(T("Open the full ranking"))}</a>`)}
    ${card(heading(T("Ways to save money in Poland"), "🗺️") + hint(T("From the safest and most flexible to long-term. Rates change often – always check the current conditions.")) + `<p>📈 ${esc(status)}</p>` + button("⟳ " + esc(T("Refresh rates")), "refresh-rates"))}
    ${option("🏦", T("Savings account (konto oszczędnościowe)"), T("Pay in and take out any time. Banks pay the best rates as 3–6 month promotions for new money, then much less."),
      esc(ref ? T("NBP reference rate: {0}. The best promotions for new money are usually about 2–3 points higher for a few months; standard rates are often lower.", ref) : "–"),
      ["low", T("Very low – guaranteed by the BFG up to €100,000 per bank")], T("Same day"), T("Emergency fund, short-term savings"))}
    ${option("🔒", T("Fixed deposit (lokata)"), T("A fixed rate for a fixed time, e.g. 3, 6 or 12 months. If you take the money out early you usually lose the interest."),
      esc(ref ? T("Good 12-month deposits usually pay about the NBP reference rate ({0}).", ref) : "–"), ["low", T("Very low – guaranteed by the BFG")], T("At the end of the term"), T("Money you won't need for a while"))}
    ${option("🏛️", T("Polish treasury bonds (obligacje skarbowe)"), T("Lent to the State Treasury. Longer bonds (e.g. 4-year COI, 10-year EDO) follow inflation, so your money keeps its value. Bought online in PKO BP or Pekao."),
      `<div class="bonds">${bonds}</div><span class="hint">${esc(T("Interest in the first period for the bonds on sale now. Inflation-linked bonds then pay inflation plus a margin."))}</span><br><a class="btn second small" href="${BONDS_WEBSITE}" target="_blank" rel="noopener">${esc(T("Open the official bond website"))}</a>`,
      ["low", T("Very low – backed by the State")], T("Early redemption possible for a small fee"), T("Protecting savings against inflation"))}
    ${option("👤", T("IKE / IKZE (retirement accounts)"), T("Special accounts with tax benefits: IKE – no 19% Belka tax when you withdraw after 60. IKZE – payments lower your income tax every year. Can hold deposits, bonds or funds."),
      esc(T("Yearly limits in {0}: IKE {1}, IKZE {2} (self-employed: {3}).", LIMITS_YEAR, pln(fromPln(IKE)), pln(fromPln(IKZE)), pln(fromPln(IKZE_SELF)))), ["mid", T("Depends on what you put inside")], T("Long-term (until retirement)"), T("Saving for retirement with less tax"))}
    ${option("💼", T("PPK (employee capital plan)"), T("Workplace plan: you pay a small part of your salary, your employer and the State add extra money on top. Leaving it means losing that free money."),
      esc(T("You pay 2% of your salary (0.5–4% possible), your employer at least 1.5%, and the State adds 250 zł once and 240 zł every year.")), ["mid", T("Medium – invested in funds")], T("Long-term"), T("Almost everyone who is employed"))}
    ${option("📊", T("Crypto savings"), T("Higher rates on stablecoins and crypto, often without time limits. But no state guarantee: if the platform fails, your money can be lost."),
      esc(T("Rates differ a lot between platforms and coins and change often – there is no guarantee.")), ["high", T("High – no BFG guarantee, prices can fall")], T("Usually same day"), T("Only money you can afford to lose"))}
    ${card(heading(T("Please note")) + hint(T("These suggestions are calculated from what you entered and are estimates. They are not financial, investment or tax advice.")) + `<p class="hint"><a href="../terms.html#${lang()}" target="_blank" rel="noopener">${esc(T("Terms of use"))}</a></p>`)}
  </div><div class="nw-foot"><span class="nw-fsh">${ico("shield", "big")}</span><div><small>${esc(T("Your data is processed locally and remains private."))}</small></div><button class="btn second" data-close>${esc(T("Close"))}</button></div>`;
}

// ================================================================= Savings goals

/** How much to set aside per month for the goals not reached yet. */
const monthsTo = date => Math.max(1, (parseDate(date).getFullYear() - today().getFullYear()) * 12 + parseDate(date).getMonth() - today().getMonth());
export const goalsPerMonth = d => d.Goals.map(x => ({ ...x, Saved: goalSaved(x, d) })).filter(x => x.Saved < x.Target).reduce((s, x) => s + (x.Target - x.Saved) / monthsTo(x.TargetDate), 0);
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
    const goals = d.Goals.map(x => ({ ...x, Saved: goalSaved(x, d), ref: x }));
    const target = goals.reduce((s, x) => s + x.Target, 0), saved = goals.reduce((s, x) => s + Math.min(x.Saved, x.Target), 0);
    el.innerHTML = `<div class="grid">
      ${dcard("pie","res",T("All goals together"), row(T("Goal amount (zł)"), pln(target)) + row(T("Already saved"), pln(saved)) +
        row(T("To save per month for all goals"), pln(goals.filter(x => x.Saved < x.Target).reduce((s, x) => s + perMonth(x), 0))) + (target > 0 ? progress(saved / target, "var(--goals)") : ""))}
      ${dcard("star","save",T("Your goals"), hint(T("Tap a goal to edit it, for example to update how much you have saved.")) + (goals.length ? [...goals].sort((a, b) => parseDate(a.TargetDate) - parseDate(b.TargetDate)).map(x => {
        const fr = x.Target > 0 ? x.Saved / x.Target : 0, done = x.Target > 0 && x.Saved >= x.Target;
        return `<div class="bar-item clickable" data-edit-goal="${x.Id}"><div class="bar-head"><b>${esc(x.Name)}</b><button class="icon-btn danger" data-del-goal="${x.Id}">🗑</button></div>
          ${progress(fr, done ? COLORS.leftOver : "var(--goals)")}<span class="hint">${esc(T("{0} of {1} ({2}%) · by {3}", pln(Math.min(x.Saved, x.Target)), pln(x.Target), Math.round(Math.min(100, fr * 100)), fmtDate(x.TargetDate)))}${x.HoldingId && d.Holdings.some(h => h.Id === x.HoldingId) ? " · 🔗 " + esc(d.Holdings.find(h => h.Id === x.HoldingId).Name) : ""}</span>
          <span class="${done ? "good" : ""}">${esc(done ? T("Goal reached – well done!") : T("Save about {0} per month to reach it in time.", pln(perMonth(x))))}</span></div>`;
      }).join("") : hint(T("No goals yet. Add your first one above."))))}
      ${dcard("plus","res",g ? T("Edit goal") : T("Add a goal"), `<form id="goal">
        ${field(T("Name"), textInput("name", f.Name, T("e.g. {0}", T("New car, holiday, flat"))))}
        <div class="two">${field(T("Goal amount (zł)"), numInput("target", plain(f.Target)))}${field(T("Already saved (zł)"), numInput("saved", plain(f.Saved)))}</div>
        ${d.Holdings.length ? field(T("Linked savings account (optional)"), select("holding", [["", T("None – I enter the amount")], ...d.Holdings.map(h => [h.Id, h.Name])], f.HoldingId || "")) + hint(T("With a linked account, the amount saved is its balance and updates by itself.")) : ""}
        ${field(T("Reach it by"), dateInput("date", inputDate(parseDate(f.TargetDate))))}
        <div class="buttons">${button(g ? T("Save changes") : T("Add"), "save-goal", "main")}${g ? button(T("Cancel"), "cancel-goal") : ""}</div></form>`)}
      ${binCard(["goal"])}
    </div>`;
    const fm = el.querySelector("#goal");
    el.querySelector('[data-action="save-goal"]').onclick = () => {
      const v = values(fm), t = num(v.target);
      if (!v.name.trim() || !(t > 0)) { toast(T("Please enter a name and a goal amount."), "bad"); return; }
      const item = { Name: v.name.trim(), Target: t, Saved: num(v.saved) || 0, TargetDate: isoDate(parseDate(v.date)), HoldingId: v.holding || "" };
      if (g) Object.assign(g, item); else d.Goals.push({ Id: uuid(), ...item });
      editGoal = null; save(); toast(T("Saved.")); App.refresh();
    };
    const c = el.querySelector('[data-action="cancel-goal"]'); if (c) c.onclick = () => { editGoal = null; App.refresh(); };
    el.querySelectorAll("[data-edit-goal]").forEach(x => x.onclick = ev => { if (ev.target.closest("[data-del-goal]")) return; editGoal = x.dataset.editGoal; App.refresh(); window.scrollTo({ top: 0, behavior: "smooth" }); });
    el.querySelectorAll("[data-del-goal]").forEach(b => b.onclick = async () => {
      const x = d.Goals.find(y => y.Id === b.dataset.delGoal);
      if (await confirmBox(T("Delete goal?"), x.Name, T("Delete"), T("Cancel"), true)) { toBin("goal", x); d.Goals = d.Goals.filter(y => y !== x); save(); App.refresh(); }
    });
  },
};

// ================================================================= Loans & debts

let editLoan = null;
/** Chart at the top of Loans & debts: outstanding principal, principal repaid and interest paid (the lender's income),
 *  month by month over the whole term – the months from today on are a projection with today's rate and payment. */
function loanChartCard(d) {
  const x = loanSchedule(d); if (!x || x.months.length < 2) return "";
  const hid = new Set(d.Settings.LoanChartHidden || []);
  const short = m => m.toLocaleDateString(lang(), { month: "short", year: "2-digit" });
  const lines = [
    { key: "bal", label: T("Outstanding principal"), color: "#E5484D", values: x.balance, main: true },
    { key: "prin", label: T("Principal repaid (cumulative)"), color: "#1BAF7A", values: x.principal },
    { key: "int", label: T("Interest paid – lender's income (cumulative)"), color: "#F59E0B", values: x.interest },
  ];
  const axis = v => v >= 1000 ? +(v / 1000).toFixed(v >= 100000 ? 0 : 1) + "k" : String(Math.round(v));
  const fmtV = Object.assign(v => pln(v), { forecast: T("Projection") });
  const fig = (l, v, cls = "", tip = "") => `<div${tip ? ` data-tip="${esc(tip)}"` : ""}><span>${esc(l)}${tip ? " ⓘ" : ""}</span><b class="${cls}">${esc(v)}</b></div>`;
  const keys = lines.map(sr => `<button class="wave-key${hid.has(sr.key) ? " off" : ""}" data-loanchart="${sr.key}" style="--c:${sr.color}"><i></i>${esc(sr.label)}</button>`).join("");
  // Today's figures exactly as on the Overview (payments made up to today)
  const run = d.Loans.filter(l => l.Remaining > 0), pl = run.map(l => [l, loanPlan(l)]);
  const nowBal = pl.reduce((s2, [, p]) => s2 + p.remainingNow, 0), nowInt = pl.reduce((s2, [, p]) => s2 + p.interestRepaid, 0);
  const nowPrin = pl.reduce((s2, [l, p]) => s2 + (l.Original > p.remainingNow ? l.Original - p.remainingNow : 0), 0);
  return card(heading(T("Loan repayment")) +
    `<div class="sav-figures">${fig(T("Outstanding principal"), pln(nowBal), "bad")}${nowPrin > 0 ? fig(T("Principal repaid to date"), pln(nowPrin), "good") : ""}
      ${fig(T("Interest paid to date (lender's income)"), pln(nowInt), "warn", T("Interest you have paid so far: what the bank has earned on your loans. Includes the interest you entered from your bank."))}
      ${fig(T("Total cost of credit (all interest)"), pln(x.totalInterest), "", T("All interest over the whole term: paid so far plus the interest still to come with today's rate and payment. Fees and insurance are not included."))}
      ${x.end ? fig(T("Debt-free"), monthName(x.end)) : ""}</div>` +
    `<div class="wave-legend">${keys}</div>` + savingsChart(x.months.map(short), lines, [], axis, fmtV, hid, x.pastCount, ...(window.innerWidth < 700 ? [760, 230] : [1500, 190])) +
    hint(T("Month by month for all your loans together. Up to today: from the payments since you entered each loan; from today on (shaded): a projection with today's rate and monthly payment. Click a name to show or hide it.")), "wide fixed loan-chart-card");
}
export const Loans = {
  route: "loans", title: "Loans & debts",
  render(el) {
    const d = D();
    const l = editLoan ? d.Loans.find(x => x.Id === editLoan) : null;
    const f = l || { Name: "", Remaining: "", MonthlyPayment: "", RatePercent: "", NextPayment: isoDate(addMonths(today(), 1)) };
    const running = d.Loans.filter(x => x.Remaining > 0);
    const now = x => loanPlan(x).remainingNow;
    const payments = Calc.loanPayments(d), income = Calc.totalIncome(d), share = income > 0 ? payments / income : 0;
    const level = income <= 0 || !running.length ? "" : share > 0.4 ? `<p class="bad">${esc(T("Your loan payments take more than 40% of your income. This is high – try not to take new loans and pay off the most expensive one first."))}</p>`
      : share >= 0.3 ? `<p class="warn">${esc(T("Your loan payments take 30–40% of your income. Keep an eye on it before taking new loans."))}</p>`
      : `<p class="good">${esc(T("Your loan payments are at a safe level (below 30% of your income)."))}</p>`;
    const plans = new Map(running.map(x => [x.Id, loanPlan(x)]));
    const ends = [...plans.values()];
    const debtFree = !running.length ? "–" : ends.some(p => p.never) ? T("never – see the warning") : monthName(new Date(Math.max(...ends.map(p => p.end.getTime()))));
    const ld = loansDash(d, debtFree);
    const lHead = pageHead({ icon: "bank", title: T("Loans & Debts"), sub: T("Track debts, reduce interest costs and accelerate your journey to financial freedom."),
      kpis: [{ l: T("Total Debt Remaining"), v: pln(ld.kpis.rem), icon: "coins", cls: "in" }, { l: T("Monthly Payments"), v: pln(ld.kpis.payments), icon: "calx", cls: "in" }, { l: T("Debt-Free Date"), v: debtFree, icon: "flag", cls: "in" }, { l: T("Debt Score"), v: ld.kpis.dScore + " / 100", icon: "gauge", cls: "in", hi: true }],
      btn: `<button class="btn main rp-gen" data-action="l-new">＋ ${esc(T("Add Loan"))}</button>` });
    el.innerHTML = lHead + ld.html + `<details class="cal-fold bp-manage"><summary>⚙ ${esc(T("Manage loans and overpayments"))}</summary><div class="grid">
      ${loanChartCard(d)}
      ${card(`<form id="loan">${heading(l ? T("Edit loan") : T("Add a loan"))}
        ${field(T("Name"), textInput("name", f.Name, T("e.g. {0}", T("Car loan, credit card, mortgage"))))}
        ${field(T("Type of loan"), select("kind", LOAN_KINDS.map(([k, n]) => [k, T(n)]), f.Kind || "other"))}
        <div class="two">${field(T("Loan amount at the start (zł)"), numInput("original", plain(f.Original), T("optional")))}${field(T("Remaining principal amount to be repaid (zł)"), numInput("remaining", plain(l ? loanPlan(l).remainingNow : f.Remaining)))}</div>
        ${field(T("Interest repaid so far (zł, optional)"), numInput("interestpaid", l ? plain(Math.round(loanPlan(l).interestRepaid * 100) / 100) : "", T("from your bank, e.g. {0}", "12 450,00")))}
        ${hint(T("Your bank shows these in the loan details: principal amount repaid, interest repaid and remaining principal amount to be repaid. With the amount at the start, MoneyCompass shows how much principal you have already repaid."))}
        <div class="two">${field(T("Loan payment per month (zł)"), numInput("payment", plain(f.MonthlyPayment)))}${field(T("Interest rate (% per year, 0 if none)"), numInput("rate", plain(f.RatePercent), "0"))}</div>
        <div class="two">${field(T("Next payment on (then every month)"), dateInput("next", inputDate(l ? (loanPlan(l).next || loanNextPayment(l)) : parseDate(f.NextPayment))))}
        ${field(T("Paid from which account (optional)"), `<input name="paidfrom" list="loan-accounts" value="${esc(f.PaidFrom || "")}" placeholder="${esc(T("e.g. {0}", "Pekao"))}">`)}</div>
        <datalist id="loan-accounts">${[...new Set([...d.Holdings.map(h => h.Name), ...d.Expenses.concat(d.Received).map(x => x.Info?.Bank).filter(Boolean), "Pekao", "PKO BP", "mBank", "ING", "Millennium", "Santander", "Alior", "Credit Agricole"])].map(n => `<option value="${esc(n)}">`).join("")}</datalist>
        ${hint(T("The loan payment counts every month on this day – also when it is paid from a bank you don't import. If it shows up in a bank import, it is not counted twice."))}
        <p class="loan-preview hint" id="loan-preview"></p>
        ${hint(T("MoneyCompass works out the debt-free date from what is left, the monthly payment and the interest."))}
        <div class="buttons">${button(l ? T("Save changes") : T("Add"), "save-loan", "main")}${l ? button(T("Cancel"), "cancel-loan") : ""}</div></form>`)}
      ${card(heading(T("Loans")) + hint(T("Tap a loan to edit it, for example to update what is left.")) + (d.Loans.length ? `<div class="list">${d.Loans.map(x => `
        <div class="item clickable loan-item" data-edit-loan="${x.Id}"><div class="loan-main"><b>${esc(x.Name)}</b>
          <span class="hint">${esc(loanLine(x, plans.get(x.Id) || loanPlan(x)))}</span>
          ${x.Original > 0 ? `<div class="loan-progress">${progress(1 - now(x) / x.Original, "#1BAF7A")}<span class="hint">${esc(T("Principal amount repaid: {0} of {1} ({2}%)", pln(x.Original - now(x)), pln(x.Original), Math.round((1 - now(x) / x.Original) * 100)))}</span></div>` : ""}
          ${(x.RateChanges || []).length ? `<span class="hint">${esc(x.RateChanges.slice(-3).map(c => T("Rate change {0}: {1} (previously {2})", fmtDate(c.Date), rate(c.To), rate(c.From))).join(" · "))}</span>` : ""}
          ${(x.Extra || []).length ? `<span class="hint good">💰 ${esc(T("Overpayments: {0}", x.Extra.map(e => `${pln(e.Amount)} (${fmtDate(e.Date)})`).join(", ")))}</span>` : ""}
          ${loanWarning(x)}</div>
        <div class="right"><b>${pln((plans.get(x.Id) || loanPlan(x)).remainingNow)}</b>${(plans.get(x.Id) || loanPlan(x)).done ? `<span class="hint">${esc(T("estimated today"))}</span>` : ""}</div><button class="icon-btn danger" data-del-loan="${x.Id}">🗑</button></div>`).join("")}</div>` : hint(T("No loans – great! Add one above if you have any."))))}
      ${running.length ? card(`<form id="extra">${heading(T("Partial early repayment (overpayment)"), "💰")}
        ${hint(T("An overpayment goes straight to the principal (the capital you still owe), so you pay less interest. Banks call it a partial early repayment. Enter it here – or just try an amount to see what it would bring."))}
        ${field(T("Loan"), select("loan", running.map(x => [x.Id, x.Name]), running[0].Id))}
        <div class="two">${field(T("Amount paid towards the principal (zł)"), numInput("amount", "", T("e.g. {0}", "5000")))}${field(T("Date"), dateInput("date", inputDate(today())))}</div>
        ${field(T("After the overpayment"), select("mode", [["shorter", T("Shorten the loan term – same monthly payment")], ["lower", T("Reduce the monthly payment – same term")]], "shorter"))}
        ${field(T("Regular extra principal every month? (zł, calculation only)"), numInput("monthly", "", T("e.g. {0}", "200")))}
        <div class="extra-result" id="extra-result"></div>
        <div class="buttons">${button("✔ " + esc(T("Save the overpayment")), "save-extra", "main")}</div></form>`) : ""}
      ${card(heading(T("Your debts")) + loanProgress(running.map(x => ({ ...x, Remaining: now(x) }))) +
        (running.some(x => loanPlan(x).interestRepaid > 0) ? row(T("Interest repaid"), pln(running.reduce((s, x) => s + loanPlan(x).interestRepaid, 0))) : "") +
        row(T("Remaining principal amount to be repaid"), pln(running.reduce((s, x) => s + now(x), 0))) +
        row(T("Interest still to be repaid (estimate)"), pln(running.reduce((s, x) => s + (loanPlan(x).never ? 0 : loanPlan(x).interest), 0))) +
        row(T("Loan payments per month"), pln(payments)) +
        row(T("Share of your income"), income > 0 ? Math.round(share * 100) + "%" : "–") + row(T("Debt-free"), debtFree) +
        level + hint(T("These monthly payments are counted in your spending (Overview, Expenses, advice and reports) as \"Loan payments\". Don't enter them again in the Outflows tab.")))}
      ${binCard(["loan"])}
    </div></details>`;
    el.querySelector('[data-action="l-new"]').onclick = () => { const dt = el.querySelector(".bp-manage"); if (dt) dt.open = true; const f = el.querySelector("#loan"); f.scrollIntoView({ behavior: "smooth", block: "center" }); f.querySelector('[name="name"]')?.focus(); };
    el.querySelectorAll('[data-action="l-extra"]').forEach(b => b.onclick = () => { const dt = el.querySelector(".bp-manage"); if (dt) dt.open = true; const f = el.querySelector("#extra") || el.querySelector("#loan"); f.scrollIntoView({ behavior: "smooth", block: "center" }); });
    iconizeCards(el);
    const fm = el.querySelector("#loan");
    el.querySelector('[data-action="save-loan"]').onclick = () => {
      const v = values(fm), rem = num(v.remaining);
      if (!v.name.trim() || !(rem > 0)) { toast(T("Please enter a name and the amount still to pay back."), "bad"); return; }
      const orig = num(v.original) || 0;
      if (orig > 0 && orig < rem) { toast(T("The amount at the start can't be smaller than what is still to pay back."), "bad"); return; }
      // Rate change: kept in the loan's history, like on the bank's statement
      const newRate = num(v.rate) || 0;
      if (l && (+l.RatePercent || 0) !== newRate) (l.RateChanges ||= []).push({ Date: isoDate(today()), From: +l.RatePercent || 0, To: newRate });
      const ip = num(v.interestpaid);
      const item = { Name: v.name.trim(), Kind: v.kind || "other", Original: orig > 0 ? orig : null, Remaining: rem, MonthlyPayment: num(v.payment) || 0, RatePercent: num(v.rate) || 0,
        InterestPaid: ip > 0 ? ip : null,
        NextPayment: isoDate(parseDate(v.next || isoDate(addMonths(today(), 1)))), PaidFrom: (v.paidfrom || "").trim() };
      const saved = l ? Object.assign(l, item) : (d.Loans.push({ Id: uuid(), ...item }), d.Loans[d.Loans.length - 1]);
      const plan = planLoan(saved);
      editLoan = null; save(); App.refresh();
      if (plan.never) toast(T("Saved – but the monthly payment doesn't cover the interest, see the warning."), "bad");
      else toast(T("Saved. Debt-free in {0} ({1} payments).", monthName(plan.end), plan.needed));
    };
    // Extra repayment: what it changes, live; saved only with the button
    const xf = el.querySelector("#extra");
    if (xf) {
      const show = () => {
        const v = values(xf), loan = d.Loans.find(y => y.Id === v.loan), amt = num(v.amount) || 0, monthly = num(v.monthly) || 0, out = el.querySelector("#extra-result");
        if (!loan || (!(amt > 0) && !(monthly > 0))) { out.innerHTML = hint(T("Enter an amount to see what it changes.")); return; }
        const e = extraEffect(loan, amt, v.mode, monthly);
        const lines = [];
        if (v.mode === "lower" && amt > 0) lines.push(T("New monthly payment: about {0} instead of {1}.", pln(e.newPayment), pln(loan.MonthlyPayment)));
        if (e.after.months !== Infinity && e.after.months !== e.before.months) lines.push(T("Debt-free in {0} instead of {1}.", monthName(addMonths(e.next, e.after.months - 1)), e.before.months === Infinity ? T("never") : monthName(addMonths(e.next, e.before.months - 1))));
        if (e.saved > 0 && e.saved !== Infinity) lines.push(T("You save about {0} in interest.", pln(e.saved)));
        if (monthly > 0) lines.push(T("Includes {0} extra every month – that part is only a calculation.", pln(monthly)));
        out.innerHTML = `<div class="alert good-alert">${lines.map(l => `<p>✔ ${esc(l)}</p>`).join("")}</div>`;
      };
      xf.querySelectorAll("input, select").forEach(i => i.addEventListener("input", show)); show();
      el.querySelector('[data-action="save-extra"]').onclick = async () => {
        const v = values(xf), loan = d.Loans.find(y => y.Id === v.loan), amt = num(v.amount) || 0;
        if (!loan || !(amt > 0)) { toast(T("Enter the amount you paid towards the principal."), "bad"); return; }
        if (amt > loanPlan(loan).remainingNow) { toast(T("That is more than the principal still owed."), "bad"); return; }
        if (!(await confirmBox(T("Save the overpayment?"), T("{0} paid towards the principal of {1} on {2}. The principal still owed goes down by this amount{3}.", pln(amt), loan.Name, fmtDate(parseDate(v.date)), v.mode === "lower" ? ", " + T("and the monthly payment is lowered") : ""), T("Save"), T("Cancel")))) return;
        applyExtra(loan, amt, v.mode, parseDate(v.date));
        toast(T("Saved. Debt-free in {0}.", monthName(loanPlan(loan).end || today()))); App.refresh();
      };
    }
    // Live preview while typing: payments left and the debt-free date
    const preview = () => {
      const v = values(fm), x = { Remaining: num(v.remaining) || 0, MonthlyPayment: num(v.payment) || 0, RatePercent: num(v.rate) || 0, NextPayment: v.next };
      const out = el.querySelector("#loan-preview");
      if (!(x.Remaining > 0) || !(x.MonthlyPayment > 0)) { out.textContent = ""; return; }
      const p = loanPlan(x);
      out.className = "loan-preview " + (p.never ? "bad" : "good");
      out.textContent = p.never ? "⚠ " + T("{0} a month doesn't even cover the interest – the loan would never be paid back.", pln(x.MonthlyPayment))
        : "✔ " + T("{0} payments left – debt-free in {1}.", p.needed, monthName(p.end)) + (p.interest > 0.5 ? " " + T("About {0} of interest still to pay.", pln(p.interest)) : "");
    };
    fm.querySelectorAll("input").forEach(i => i.addEventListener("input", preview)); preview();
    const c = el.querySelector('[data-action="cancel-loan"]'); if (c) c.onclick = () => { editLoan = null; App.refresh(); };
    el.querySelectorAll("[data-loanchart]").forEach(b => b.onclick = () => {
      const h = new Set(d.Settings.LoanChartHidden || []), k = b.dataset.loanchart;
      h.has(k) ? h.delete(k) : h.add(k); d.Settings.LoanChartHidden = [...h]; save(); App.refresh();
    });
    el.querySelectorAll("[data-edit-loan]").forEach(x => x.onclick = ev => { if (ev.target.closest("[data-del-loan]")) return; editLoan = x.dataset.editLoan; App.refresh(); window.scrollTo({ top: 0, behavior: "smooth" }); });
    el.querySelectorAll("[data-del-loan]").forEach(b => b.onclick = async () => {
      const x = d.Loans.find(y => y.Id === b.dataset.delLoan);
      if (await confirmBox(T("Delete loan?"), x.Name, T("Delete"), T("Cancel"), true)) { toBin("loan", x); d.Loans = d.Loans.filter(y => y !== x); save(); App.refresh(); }
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
    const bd = budgetDash(d);
    const bHead = pageHead({ icon: "wallet", title: T("Budget Plan"), sub: T("Plan spending, control expenses and maximize savings."),
      kpis: [{ l: T("Monthly Budget"), v: pln(bd.kpis.total), icon: "wallet", cls: "in" }, { l: T("Spent This Month"), v: pln(bd.kpis.spent), icon: "cart", cls: "src" }, { l: T("Remaining Budget"), v: pln(bd.kpis.left), icon: "check", cls: "in", vcls: bd.kpis.left < 0 ? "bad" : "" }, { l: T("Budget Health Score"), v: bd.kpis.score + " / 100", icon: "heart", cls: "in", hi: true }],
      btn: `<button class="btn main rp-gen" data-action="b-new">＋ ${esc(T("Create Budget"))}</button>` });
    el.innerHTML = bHead + bd.html + `<details class="cal-fold bp-manage"><summary>⚙ ${esc(T("Manage limits"))}</summary><div class="grid">
      ${dcard("cal","cal",monthName(today()), row(T("Spent in categories with a limit"), pln(spent)) + row(T("Your limits together"), pln(total)) +
        row(T("Left this month"), pln(total - spent), total - spent < 0 ? "bad" : "good") +
        (d.Goals.length ? row(T("To set aside for savings goals"), pln(goalsPerMonth(d))) : ""))}
      ${dcard("table","table",T("Limits this month"), hint(T("From your entries in the Outflows tab. Green: on track, amber: almost used, red: over the limit.")) +
        (limits.length ? budgetBars() : hint(T("No limits yet. Set your first one above."))))}
      ${dcard("save","save",T("Set a monthly limit"), `<form id="budget">${hint(T("Choose a category and how much you want to spend on it at most each month. Setting it again changes the limit."))}
        ${field(T("Category"), select("category", [...categories().map(c => [c.Name, categoryLabel(c.Name)]), NEW_CAT()], categories()[0].Name))}
        ${field(T("Limit per month (zł)"), numInput("limit", "", T("e.g. {0}", "800")))}
        ${button(T("Save limit"), "save-limit", "main")}</form>`)}
      ${binCard(["budget"])}
    </div></details>`;
    // Savings goals: part of the budget plan (how much to set aside each month), with their own cards
    const sec = document.createElement("section"); sec.className = "goals-section";
    sec.innerHTML = `<h2 class="section-title"><span class="rp-si i-res">${si(IC.flag, 26)}</span> ${esc(T("Savings goals"))}</h2><div class="goals-host"></div>`;
    el.appendChild(sec);
    Goals.render(sec.querySelector(".goals-host"));
    const gg = sec.querySelector(".goals-host .grid"); if (gg) gg.dataset.key = "web2:goals";
    el.querySelectorAll("[data-budget]").forEach(b => {
      const del = document.createElement("button"); del.className = "icon-btn danger"; del.textContent = "🗑";
      del.onclick = async () => {
        if (await confirmBox(T("Delete limit?"), T(b.dataset.budget), T("Delete"), T("Cancel"), true)) { toBin("budget", d.Budgets.find(x => x.Category === b.dataset.budget)); d.Budgets = d.Budgets.filter(x => x.Category !== b.dataset.budget); save(); App.refresh(); }
      };
      b.querySelector("b").after(del);
    });
    const fm = el.querySelector("#budget");
    el.querySelector('[data-action="b-new"]').onclick = () => { const dt = fm.closest("details"); if (dt) dt.open = true; fm.scrollIntoView({ behavior: "smooth", block: "center" }); fm.querySelector('[name="limit"]')?.focus(); };
    el.querySelector('[data-action="b-opt"]').onclick = () => App.openOptimize();
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

/** mode: "all" (salary, income and expenses together), "out" (only the expenses) or "in" (only the money received). */
export async function openBankImport(fileObj = null, mode = "all") {
  if (!(await requirePro(T("Import bank statement")))) return;
  if (!fileObj) fileObj = await pickFile(".csv,.txt,text/csv");
  if (!fileObj) return;
  let file;
  try { file = Csv.parse(Csv.decode(await fileObj.arrayBuffer())); }
  catch (e) { await alertBox(T("Import bank statement"), T("The file could not be read: {0}", e.message)); return; }
  if (!file.rows.length) { await alertBox(T("Import bank statement"), T("No transactions found in this file. Please choose the CSV export of your account history.")); return; }

  const d = D(), s = d.Settings;
  let showColumns = false;
  let state = null;
  // Which dates to import: the whole file, or only some of it (e.g. 1 month of a 3-month statement)
  let from = null, to = null;
  const toPln = (a, cur) => cur === "PLN" ? a : ((cur === "USD" || cur === "EUR") && !Calc.rateMissing(cur, s)) ? Math.round(Calc.toPln(a, cur, s) * 100) / 100 : null;
  const sameDay = (a, b) => parseDate(a).getTime() === new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();

  const compute = () => {
    const all = Csv.transactions(file, file.columns);
    const rows = all.filter(r => (!from || r.date >= from) && (!to || r.date <= to));
    state = { allDates: all.map(r => r.date) };
    const outgoing = rows.filter(r => r.amount < 0), incoming = rows.filter(r => r.amount > 0);
    const items = [], known = []; let dup = 0, foreign = 0, ownIn = 0;
    // Your own accounts – from this file and from every bank you imported before. Money moved between them
    // (e.g. Pekao → Millennium) is neither an expense nor income, also when the bank calls it a normal transfer.
    const digits = a => String(a || "").replace(/\D/g, "").slice(-26);
    const mine = new Set([...d.Expenses, ...d.Received, ...d.Transfers].map(x => digits(x.Info?.Account)).filter(x => x.length >= 10));
    all.forEach(r => { const a = digits(r.info?.Account); if (a.length >= 10) mine.add(a); });
    const ownMove = r => Csv.isOwnTransfer(r) || mine.has(digits(r.info?.OtherAccount));
    // Already imported earlier: only the bank details (ⓘ) are added, if they are missing
    const remember = (x, r) => { if (x && r.info && Object.keys(r.info).length > Object.keys(x.Info || {}).length) known.push([x, r.info]); };
    for (const r of outgoing.filter(r => !ownMove(r))) {
      const v = toPln(-r.amount, r.currency);
      if (v === null) { foreign++; continue; }
      const old = d.Expenses.find(e => sameDay(e.Date, r.date) && Math.abs(e.Amount - v) < 0.005 && e.Description === r.description);
      if (old) { dup++; remember(old, r); continue; }
      items.push({ row: r, pln: v, category: ruleFor(d, r.description) || Csv.category(r) });
    }
    const transfers = outgoing.filter(ownMove).filter(r => r.currency === "PLN")
      .filter(r => { const old = d.Transfers.find(t => sameDay(t.Date, r.date) && Math.abs(t.Amount + r.amount) < 0.005 && t.Description === r.description); remember(old, r); return !old; })
      .map(r => ({ row: r, pln: -r.amount,
        // To your current account in another bank: a move, not savings (unless it says so)
        toSavings: mine.has(digits(r.info?.OtherAccount)) ? Csv.isSavingsTransfer(r) : !r.ownAccount || Csv.isSavingsTransfer(r) })).sort((a, b) => b.row.date - a.row.date);
    // Money coming back from your own accounts (e.g. from savings to the current account): not income – but it lowers the savings
    const back = incoming.filter(ownMove).filter(r => r.currency === "PLN")
      .filter(r => !d.Transfers.some(t => t.Back && sameDay(t.Date, r.date) && Math.abs(t.Amount + r.amount) < 0.005 && t.Description === r.description))
      .map(r => ({ row: r, pln: r.amount }));
    const received = [];
    for (const r of incoming) {
      const v = toPln(r.amount, r.currency);
      if (v === null) continue;
      const old = d.Received.find(x => sameDay(x.Date, r.date) && Math.abs(x.Amount - v) < 0.005 && x.Description === r.description);
      if (old) { remember(old, r); continue; }
      // From your own account (e.g. salary account in another bank): "Not income" at first – a move between your accounts.
      // Still listed, because when that bank's statement is not imported, this may be your only sign of the salary: switch it to Salary.
      if (ownMove(r)) { ownIn++; received.push({ Id: uuid(), Date: isoDate(r.date), Amount: v, Description: r.description, Kind: RECEIVED.none, Own: true, ...withInfo(r) }); continue; }
      received.push({ Id: uuid(), Date: isoDate(r.date), Amount: v, Description: r.description, Kind: RECEIVED.income, ...withInfo(r) });
    }
    received.sort((a, b) => parseDate(b.Date) - parseDate(a.Date));
    // Only part of the statement: the other side is left out (nothing of it is added)
    if (mode === "out") { received.length = 0; back.length = 0; }
    if (mode === "in") { items.length = 0; transfers.length = 0; }
    state = { ...state, mine, digits, items, transfers, received, back, known, dup, foreign, ownIn, total: rows.length, skippedByDate: all.length - rows.length };
  };

  const p = popup("", { width: 1000, cls: "wide-popup nw-win nw-imp" });
  const draw = () => {
    compute();
    const { items, transfers, received, dup, foreign } = state;
    const lines = [];
    if (items.length) {
      const dates = items.map(i => i.row.date);
      lines.push(T("{0} expenses from {1} to {2}, together {3}.", items.length, fmtDate(new Date(Math.min(...dates))), fmtDate(new Date(Math.max(...dates))), pln(items.reduce((a, i) => a + i.pln, 0))));
    } else lines.push(T("Nothing new to add."));
    if (dup) lines.push(T("{0} are already in MoneyCompass and are skipped.", dup));
    if (state.known.length) lines.push(T("ⓘ {0} entries you imported before get the details from your bank (accounts, title).", state.known.length));
    if (transfers.length) lines.push(T("{0} transfers to your own accounts – not expenses (listed in Outflows).", transfers.length));
    if (received.length) lines.push(T("{0} payments received – choose below how each one counts.", received.length));
    if (foreign) lines.push(T("{0} payments in other currencies are skipped (no exchange rate).", foreign));
    if (state.ownIn) lines.push(T("{0} payments came from your own accounts – marked \"Not income\". If your salary arrives in an account whose statement you don't import, choose Salary for them below.", state.ownIn));
    const cols = Csv.columnCount(file);
    const colOptions = [[-1, "–"], ...Array.from({ length: cols }, (_, i) => [i, Csv.columnName(file, i)])];
    const byCat = {};
    items.forEach(i => { (byCat[i.category] ||= { n: 0, sum: 0 }); byCat[i.category].n++; byCat[i.category].sum += i.pln; });
    const unsorted = items.filter(i => i.category === OTHER).slice(0, 100);
    const anything = items.length || received.length || transfers.length || state.known.length;
    const date = r => fmtDate(r.date);
    const dates = state.allDates;
    const first = dates.length ? new Date(Math.min(...dates)) : today(), last = dates.length ? new Date(Math.max(...dates)) : today();
    const months = [];
    for (let m = new Date(first.getFullYear(), first.getMonth(), 1); m <= last; m = addMonths(m, 1)) months.push(m);
    const isMonth = m => from && to && from.getTime() === m.getTime() && to.getTime() === addMonths(m, 1).getTime() - 86400000;
    const dateCard = card(heading(T("Which dates?"), "📅") + hint(T("The file has transactions from {0} to {1}. Import all of them, or only some.", fmtDate(first), fmtDate(last))) +
      `<div class="chips"><button class="chip${!from && !to ? " on" : ""}" data-range="all">${esc(T("All"))}</button>${months.map((m, i) =>
        `<button class="chip${isMonth(m) ? " on" : ""}" data-range="${i}">${esc(monthName(m))}</button>`).join("")}</div>` +
      `<div class="two">${field(T("From"), dateInput("from", inputDate(from || first)))}${field(T("To"), dateInput("to", inputDate(to || last)))}</div>` +
      (state.skippedByDate ? hint(T("{0} transactions outside these dates are not imported.", state.skippedByDate)) : ""));
    const pv = [...items.map(i => ({ d: i.row.date, t: i.row.description, c: i.category, a: -i.pln, k: "exp" })), ...received.map(r => ({ d: parseDate(r.Date), t: r.Description, c: r.Kind === RECEIVED.salary ? T("Salary") : T("Income"), a: r.Amount, k: "inc" })), ...transfers.map(t => ({ d: t.row.date, t: t.row.description, c: T("Transfer"), a: -t.pln, k: "trf" }))].sort((x, y) => y.d - x.d).slice(0, 5);
    const kindTag = { exp: [T("Expense"), "r"], inc: [T("Income"), "g"], trf: [T("Transfer"), "b"] };
    const mt = (k, label, icon, on) => `<button class="seg-btn nw-it${on ? " on" : ""}" data-mode="${k}">${ico(icon)}<span>${esc(label)}</span></button>`;
    p.el.innerHTML = `<div class="nw-hd"><span class="nw-hi">${ico("bank")}</span><h2>${esc(T("Import bank statement"))}</h2><button class="nw-x" data-close aria-label="Close">✕</button></div>
      <div class="nw-itype"><div class="nw-itl"><span class="nw-ibig">${ico("bank")}</span><b>${esc(T("Import type"))}:</b></div><div class="nw-itbs">
        ${mt("all", T("Complete Statement"), "check", mode === "all")}${mt("out", T("Expense Statement"), "wallet", mode === "out")}${mt("in", T("Income Statement"), "down", mode === "in")}
        <button class="seg-btn nw-it" data-other-kind>${ico("coins")}<span>${esc(T("Savings Account Statement"))}</span></button></div></div>
      <div class="nw-file nw-card"><span class="nw-fi">${ico("doc")}<em>CSV</em></span><div class="nw-fd"><small>${esc(T("Statement file"))}</small><b>${esc(fileObj.name)}</b>
        <p><span>${esc(T("Detected bank"))}:</span><b>${esc(file.bank || T("bank recognised from the columns"))}</b></p><p><span>${esc(T("File format"))}:</span><b>CSV</b></p><p><span>${esc(T("Rows detected"))}:</span><b>${file.rows.length}</b></p></div>
        <div class="nw-rec"><div class="nw-recs">${ico("check", "ring big")}<span><small>${esc(T("Recognition status"))}:</small><b>${esc(file.bank ? T("Automatically recognized") : T("Check the columns"))}</b></span></div>
        <button class="nw-pill" data-action="columns">${esc(showColumns ? T("Hide columns") : T("Review columns"))}</button></div></div>
      <p class="nw-note">${ico("info")}${esc(T("Statement recognized automatically. Adjust only if detected incorrectly."))}</p>
      ${showColumns ? `<div class="nw-card nw-cols"><div class="two">${["Date", "Amount", "Debit", "Credit", "Description", "Counterparty", "Category", "Currency", "OwnAccount", "OtherAccount"].map(k => field(T(k === "Debit" ? "Amount" : k === "Credit" ? "Amount" : k === "Counterparty" ? "Name" : k === "OwnAccount" ? "Your account" : k === "OtherAccount" ? "Their account" : k) + (k === "Debit" ? " −" : k === "Credit" ? " +" : ""), select("col-" + k, colOptions, file.columns[k] ?? -1))).join("")}</div></div>` : ""}
      <div class="nw-prev nw-card"><div class="nw-ch">${ico("bars")}<h3>${esc(T("Transaction preview"))} <small>(${esc(T("first {0} rows", pv.length))})</small></h3></div>
        <table><tr><th>${esc(T("Date"))}</th><th>${esc(T("Description"))}</th><th>${esc(T("Category"))}</th><th>${esc(T("Amount"))}</th><th>${esc(T("Type"))}</th></tr>
        ${pv.map(x => `<tr><td>${fmtDate(x.d)}</td><td>${esc(x.t || "–")}</td><td><span class="nw-cat">${esc(x.k === "exp" ? categoryLabel(x.c) : x.c)}</span></td><td>${x.a < 0 ? "−" : ""}${pln(Math.abs(x.a))}</td><td><span class="nw-ty ${kindTag[x.k][1]}">${esc(kindTag[x.k][0])}</span></td></tr>`).join("") || `<tr><td colspan="5" class="hint">${esc(T("Nothing new to add."))}</td></tr>`}</table></div>
      <div class="grid nw-igrid">
      ${dateCard}
      ${card(heading(T("3. What will be added")) + lines.map(l => `<p>${esc(l)}</p>`).join("") +
        Object.entries(byCat).sort((a, b) => b[1].sum - a[1].sum).map(([c, v]) => row(`${categoryLabel(c)} (${v.n})`, pln(v.sum))).join(""))}
      ${unsorted.length ? card(heading(T("Not sorted yet")) + hint(T("MoneyCompass could not tell what these are. Choose a category, or leave them as \"Other\".")) +
        `<div class="list">${unsorted.map((i, n) => `<div class="item"><div><b>${esc(i.row.description || "–")}</b><span class="hint">${date(i.row)} · ${pln(i.pln)}</span></div>
        ${select("cat-" + items.indexOf(i), [...categories().map(c => [c.Name, categoryLabel(c.Name)]), NEW_CAT()], i.category)}</div>`).join("")}</div>`, "wide") : ""}
      ${received.length ? card(heading(T("Money received")) + hint(T("All money coming in counts as extra income for its month. Choose Salary for your regular pay: MoneyCompass then counts it every month. Not income is ignored.")) +
        `<div class="list">${received.slice(0, 150).map((r, n) => `<div class="item"><div><b>${esc(r.Description || "–")}</b><span class="hint">${fmtDate(r.Date)} · +${pln(r.Amount)}${r.Own ? " · 🔁 " + esc(T("from your own account")) : ""}</span></div>
        ${select("kind-" + n, [[RECEIVED.income, T("Extra income (this month)")], [RECEIVED.salary, T("Salary (regular pay)")], [RECEIVED.none, T("Not income")]], r.Kind)}</div>`).join("")}</div>`, "wide") : ""}
      ${transfers.length ? card(heading(T("Moved to your own accounts")) + hint(T("Not expenses and not income: money moved between your own accounts. Listed in Outflows, not counted as spending. A savings account's balance comes only from its own statement (Savings tab).")) +
        `<div class="list">${transfers.map(t => `<div class="item"><div><b>${esc(t.row.description || "–")}</b><span class="hint">${date(t.row)} · ${pln(t.pln)}${t.toSavings ? " · 🏦 " + esc(T("Savings")) : ""}</span></div></div>`).join("")}</div>`, "wide") : ""}
      </div>
      <div class="nw-foot"><span class="nw-fsh">${ico("shield", "big")}</span><div><small>${esc(T("The file is only read on this computer."))}</small></div><button class="btn main" data-import ${anything ? "" : "disabled"}>${esc(!anything ? T("Import") : !items.length && !received.length && !transfers.length ? T("Add the bank details") : !received.length ? T("Import {0} expenses", items.length) : !items.length ? T("Import {0} payments received", received.length) : T("Import {0} expenses and {1} payments received", items.length, received.length))}</button><button class="btn second" data-close>${esc(T("Cancel"))}</button></div>`;
    p.el.querySelector('[data-action="columns"]').onclick = () => { showColumns = !showColumns; draw(); };
    p.el.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { mode = b.dataset.mode; draw(); });
    p.el.querySelectorAll("[data-range]").forEach(b => b.onclick = () => {
      if (b.dataset.range === "all") { from = to = null; }
      else { const m = months[+b.dataset.range]; from = m; to = new Date(addMonths(m, 1).getTime() - 86400000); }
      draw();
    });
    p.el.querySelectorAll('input[name="from"], input[name="to"]').forEach(inp => inp.onchange = () => {
      const f = p.el.querySelector('input[name="from"]').value, t = p.el.querySelector('input[name="to"]').value;
      from = f ? parseDate(f) : null; to = t ? parseDate(t) : null;
      if (from && to && from > to) [from, to] = [to, from];
      draw();
    });
    p.el.querySelectorAll('select[name^="col-"]').forEach(sel => sel.onchange = () => { file.columns[sel.name.slice(4)] = +sel.value; draw(); });
    p.el.querySelector("[data-import]").onclick = () => doImport();
    p.el.querySelector("[data-other-kind]").onclick = async e => { e.preventDefault(); p.close(); (await import("./savings-check.js")).openSavingsCheck(fileObj); };
  };
  const doImport = async () => {
    const v = values(p.el);
    const { items, transfers, received, known } = state;
    for (const [x, info] of known) x.Info = info;
    items.forEach((i, n) => { if (v["cat-" + n]) i.category = v["cat-" + n]; });
    received.forEach((r, n) => { if (v["kind-" + n]) r.Kind = v["kind-" + n]; });
    for (const i of items) {
      const c = findCategory(i.category);
      d.Expenses.push({ Id: uuid(), Date: isoDate(i.row.date), Description: i.row.description, Category: c ? c.Name : OTHER, Amount: i.pln, Essential: !!c?.Essential, ...withInfo(i.row) });
    }
    d.Received.push(...received);
    // Money received earlier from an account that turns out to be yours (now that this bank is imported too): not income
    let fixedOwn = 0;
    for (const x of d.Received) if (x.Kind !== RECEIVED.none && state.mine.has(state.digits(x.Info?.OtherAccount))) { x.Kind = RECEIVED.none; fixedOwn++; }
    // …and money sent earlier to such an account: a move between your accounts, not an expense
    const moved = d.Expenses.filter(x => state.mine.has(state.digits(x.Info?.OtherAccount)));
    if (moved.length) {
      d.Expenses = d.Expenses.filter(x => !moved.includes(x));
      d.Transfers.push(...moved.map(x => ({ Id: uuid(), Date: x.Date, Amount: x.Amount, Description: x.Description, Saved: false, ...(x.Info ? { Info: x.Info } : {}) })));
      fixedOwn += moved.length;
    }
    if (fixedOwn) toast(T("{0} earlier payments were moves between your own accounts in different banks – no longer counted as income or expenses.", fixedOwn), "good");
    // Transfers to your own accounts (savings, another bank): kept as moves, never as expenses – and they never change a
    // savings account. Its balance comes only from its own statement (Savings → Import savings account statement).
    for (const t of transfers) d.Transfers.push({ Id: uuid(), Date: isoDate(t.row.date), Amount: t.pln, Description: t.row.description, Saved: t.toSavings, ...withInfo(t.row) });
    save();
    let msg = !received.length ? T("{0} expenses were added. You find them in the Outflows tab.", items.length)
      : !items.length ? T("{0} payments received were added. You find them in the Inflows tab.", received.length)
      : T("{0} expenses were added (Outflows tab) and {1} payments received (Inflows tab).", items.length, received.length);
    if (transfers.length) msg += "\n" + T("{0} transfers to your own accounts ({1}) are listed in Outflows under \"Moved to your own accounts\" – not counted as spending. Savings balances come from the savings account's own statement (Savings tab).", transfers.length, pln(transfers.reduce((a, t) => a + t.pln, 0)));
    p.close();
    await alertBox(T("Import finished"), msg);
    // One salary source is enough: offer the newest salary payment (not one question per month)
    const lastSalary = received.filter(r => r.Kind === RECEIVED.salary).sort((a, b) => parseDate(b.Date) - parseDate(a.Date))[0];
    if (lastSalary) await offerSalary(lastSalary);
    App.refresh();
  };
  draw();
}

// The bank's details of an imported transaction (accounts, name, title), for the ⓘ button
const withInfo = r => r.info && Object.keys(r.info).length ? { Info: r.info } : {};
/** "ING ··2874": your bank and the end of your account number, as the "from" of a regular deposit */
function accountName(info) {
  if (!info) return "";
  const digits = (info.Account || "").replace(/\D/g, "");
  return [info.Bank, digits.length >= 4 ? "··" + digits.slice(-4) : info.Account].filter(Boolean).join(" ");
}

/** All loans together: paid back so far (green) of what was borrowed – for loans with the amount at the start. */
export function loanProgress(loans) {
  const known = loans.filter(l => l.Original > 0);
  if (!known.length) return "";
  const orig = known.reduce((s, l) => s + l.Original, 0), rem = known.reduce((s, l) => s + l.Remaining, 0), f = orig > 0 ? 1 - rem / orig : 0;
  return progress(f, "#1BAF7A") + `<p class="good"><b>${esc(T("Principal amount repaid: {0} of {1} ({2}%)", pln(orig - rem), pln(orig), Math.round(f * 100)))}</b></p>`;
}

/** One line about a loan: payment, interest, next payment, payments left, debt-free date. */
export const LOAN_KINDS = [["mortgage", "Mortgage"], ["cash", "Cash loan"], ["car", "Car loan"], ["card", "Credit card / overdraft"], ["other", "Other loan or debt"]];
export function loanLine(l, p = loanPlan(l)) {
  return T("{0} per month · {1} per year", pln(l.MonthlyPayment || 0), rate(l.RatePercent || 0)) + (l.PaidFrom ? " · " + T("from {0}", l.PaidFrom) : "") + (p.next ? " · " + T("next payment {0}", fmtDate(p.next)) : "") +
    (p.never ? "" : " · " + T("{0} payments left · debt-free {1}", p.left, monthName(p.end)));
}
/** A loan that can never be paid back: the monthly payment doesn't cover the interest. */
export function loanWarning(l, short = false) {
  const p = loanPlan(l);
  if (!p.never) return "";
  return short ? `<p class="hint warn">⚠ ${esc(T("{0}: the monthly payment doesn't cover the interest – check it in Loans & debts.", l.Name))}</p>`
    : `<div class="alert warn loan-warn">⚠ ${esc(T("{0} a month doesn't even cover the interest – the loan would never be paid back. Check the monthly payment.", pln(l.MonthlyPayment || 0)))}</div>`;
}
