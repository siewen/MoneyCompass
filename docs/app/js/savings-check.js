// "What does my savings account really pay?" – reads the CSV statement of a savings account and works out
// the rate the bank really paid: interest, Belka tax and fees against the money that was on the account, day by day.
import { T, State, save, pln, rate, fmtDate, monthName, monthStart, addMonths, addDays, isoDate, parseDate, BELKA } from "./core.js";
import { esc, card, heading, hint, row, popup, alertBox, pickFile, toast, numInput, field, button, check } from "./ui.js";
import { Rates } from "./rates.js";
import * as Csv from "./csv.js";
import { App, requirePro } from "./app.js";

const DAY = 86400000;
const INTEREST = /odsetk|kapitalizac|naliczen.{0,12}odset|interest|oprocentowani/i;
const TAX = /podat|belk|\btax\b|withholding/i;
const FEE = /opłat|oplat|prowizj|\bfee\b|commission|charge/i;
const dayOf = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** All rows of the statement: date, amount, text and – when the bank gives it – the balance after the transaction. */
function readRows(file) {
  const c = file.columns, h = file.header.map(x => String(x || "").toLowerCase());
  const bal = h.findIndex(x => /saldo|balance|stan po|stan rachunku/.test(x));
  const list = [];
  for (const r of file.rows) {
    const cell = i => (i >= 0 && i < r.length ? r[i] : "");
    const date = Csv.parseDate(cell(c.Date)); if (!date) continue;
    let amount = c.Amount >= 0 ? Csv.parseAmount(cell(c.Amount)) : null;
    if (amount === null && c.Debit >= 0) { const v = Csv.parseAmount(cell(c.Debit)); if (v) amount = -Math.abs(v); }
    if (amount === null && c.Credit >= 0) { const v = Csv.parseAmount(cell(c.Credit)); if (v) amount = Math.abs(v); }
    if (!amount) continue;
    const text = [cell(c.Type), cell(c.Counterparty), cell(c.Description)].filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
      || r.filter(x => Csv.parseAmount(x) === null && !Csv.parseDate(x)).join(" ");
    const desc = [cell(c.Counterparty), cell(c.Description)].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    list.push({ date: dayOf(date), amount, text, desc, balance: bal >= 0 ? Csv.parseAmount(cell(bal)) : null });
  }
  // Banks list the newest first: put them in date order, keeping the order within one day
  if (list.length > 1 && list[0].date > list[list.length - 1].date) list.reverse();
  return { rows: list, hasBalance: bal >= 0 && list.some(x => x.balance !== null) };
}

/** The calculation: average balance day by day, interest, tax and fees, and the real yearly rate. */
export function analyse(rows, opening) {
  if (!rows.length) return null;
  const from = rows[0].date, to = rows[rows.length - 1].date;
  const kind = x => x.amount > 0 && INTEREST.test(x.text) ? "interest" : x.amount < 0 && TAX.test(x.text) ? "tax" : x.amount < 0 && FEE.test(x.text) ? "fee" : x.amount > 0 ? "in" : "out";
  const sum = k => rows.filter(x => kind(x) === k).reduce((s, x) => s + Math.abs(x.amount), 0);
  // Balance at the end of each day
  const days = Math.round((to - from) / DAY) + 1, bal = [];
  let b = opening, i = 0;
  for (let n = 0; n < days; n++) {
    const d = addDays(from, n);
    while (i < rows.length && rows[i].date <= d) b += rows[i++].amount;
    bal.push({ d, b });
  }
  const avg = bal.reduce((s, x) => s + x.b, 0) / days;
  const interest = sum("interest"), tax = sum("tax"), fees = sum("fee");
  const yearly = (v, base, n) => base > 0 && n > 0 ? v / base * 365 / n * 100 : 0;
  // Interest credited on the first days of a month is usually for the month before. Interest for a month before the
  // statement (e.g. September's interest credited on 1 October) is not counted in the rate: its money isn't in the file.
  const belongs = x => x.date.getDate() <= 3 ? monthStart(addMonths(x.date, -1)) : monthStart(x.date);
  const counted = rows.filter(x => kind(x) === "interest" && belongs(x) >= monthStart(from));
  const earned = counted.reduce((s, x) => s + x.amount, 0), share = interest > 0 ? earned / interest : 0;
  const months = [];
  for (let m = monthStart(from); m <= to; m = addMonths(m, 1)) {
    const inM = bal.filter(x => x.d >= m && x.d < addMonths(m, 1));
    if (!inM.length) continue;
    const mAvg = inM.reduce((s, x) => s + x.b, 0) / inM.length;
    const forM = counted.filter(x => belongs(x).getTime() === m.getTime()).reduce((s, x) => s + x.amount, 0);
    const feeM = rows.filter(x => kind(x) === "fee" && x.date >= m && x.date < addMonths(m, 1)).reduce((s, x) => s - x.amount, 0);
    months.push({ m, avg: mAvg, interest: forM, fees: feeM, end: inM[inM.length - 1].b, days: inM.length, rate: yearly(forM, mAvg, inM.length) });
  }
  // Interest lines with different titles (e.g. promotional and standard interest) – shown separately
  const groups = new Map();
  for (const x of rows.filter(x => kind(x) === "interest")) {
    const k = (x.desc || x.text).replace(/[\d.,/:-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || T("Interest");
    groups.set(k, (groups.get(k) || 0) + x.amount);
  }
  // Polish banks usually credit the interest already after the 19% Belka tax (no tax line in the file):
  // then what you got is the net interest, and the gross is worked back from it.
  const taxInFile = tax > 0;
  const grossAll = taxInFile ? interest : interest / (1 - BELKA), taxAll = taxInFile ? tax : grossAll - interest, netAll = grossAll - taxAll;
  const grossEarned = grossAll * share, netEarned = netAll * share;
  return {
    from, to, days, opening, closing: b, avg, deposits: sum("in"), withdrawals: sum("out"), interest, fees, taxInFile,
    grossAll, taxAll, netAll, netEarned, earlier: interest - earned, earlierShare: 1 - share,
    gross: yearly(grossEarned, avg, days), netAfterBelka: yearly(netEarned - fees, avg, days),
    months: months.map(m => ({ ...m, rate: taxInFile ? m.rate : m.rate / (1 - BELKA) })), groups: [...groups.entries()],
  };
}

export async function openSavingsCheck() {
  if (!(await requirePro(T("What does my savings account really pay?")))) return;
  const fileObj = await pickFile(".csv,.txt,text/csv");
  if (!fileObj) return;
  let file;
  try { file = Csv.parse(Csv.decode(await fileObj.arrayBuffer())); }
  catch (e) { await alertBox(T("Import bank statement"), T("The file could not be read: {0}", e.message)); return; }
  const { rows, hasBalance } = readRows(file);
  if (!rows.length) { await alertBox(T("Import bank statement"), T("No transactions found in this file. Please choose the CSV export of your account history.")); return; }
  // Balance at the start: from the bank's balance column, or entered by you
  let opening = hasBalance && rows[0].balance !== null ? Math.round((rows[0].balance - rows[0].amount) * 100) / 100 : 0;
  const d = State.data;
  const r2 = v => Math.round((v || 0) * 100) / 100;
  const defaultName = fileObj.name.replace(/\.(csv|txt)$/i, "");
  const p = popup("", { width: 900, cls: "wide-popup" });
  const draw = () => {
    const r = analyse(rows, opening);
    // Compared with the best savings ACCOUNT (money stays available), not with a locked deposit
    const best = [...Rates.savings].sort((a, b) => b.Rate - a.Rate)[0];
    const bestGain = best ? r.avg * best.Rate / 100 * r.days / 365 * (1 - BELKA) - r.netEarned : 0;
    const warn = r.avg <= 0 ? `<p class="bad">${esc(T("The average balance is 0 or below – enter the balance at the start of the statement."))}</p>` : "";
    // No window title (the button already says what this is). Cards in two even columns, the month table across the bottom.
    p.el.innerHTML = `
      ${hint(T("From your statement {0} – {1} ({2} days). Interest, tax and fees are compared with the money that was really on the account, day by day. Whole months give the most exact result.", fmtDate(r.from), fmtDate(r.to), r.days))}
      <div class="grid">
        ${card(heading(T("The real rate"), "📊") + warn +
          `<div class="real-rate"><div><span>${esc(T("Before tax"))}</span><b>${rate(r.gross)}</b></div><div><span>${esc(T("After tax and fees"))}</span><b class="${r.netAfterBelka < 2 ? "bad" : "good"}">${rate(r.netAfterBelka)}</b></div></div>` +
          hint(T("Per year, on your average balance. Per month that is about {0} of your money after tax.", rate(r.netAfterBelka / 12))) +
          (best ? `<p>${esc(bestGain > 1 ? T("With {0} ({1}) you would have earned about {2} more in this period, after tax.", `${best.Bank}${best.Name ? " – " + best.Name : ""}`, rate(best.Rate), pln(bestGain)) : T("Your account pays about as much as today's best offers."))}</p>` : ""))}
        ${card(heading(T("Your money in this period"), "💰") +
          (hasBalance ? "" : field(T("Balance at the start of the statement (zł)"), numInput("opening", String(opening).replace(".", ","))) + hint(T("This file has no balance column – enter what was on the account on {0}.", fmtDate(r.from)))) +
          row(T("At the start"), pln(r.opening)) + row(T("New money paid in"), "+" + pln(r.deposits)) + row(T("Taken out"), "−" + pln(r.withdrawals)) +
          row(T("At the end"), pln(r.closing)) + row(T("Average balance"), pln(r.avg)))}
        ${card(heading(T("What the bank paid and took"), "🧾") +
          row(T("Interest (before tax)"), "+" + pln(r.grossAll), "good") +
          (r.earlier > 0.005 ? hint(T("{0} of it was credited on {1} for the month before the statement – not counted in the rate.", pln(r.grossAll * r.earlierShare), fmtDate(r.from))) : "") +
          row(T("Belka tax 19%"), "−" + pln(r.taxAll)) + (r.taxInFile ? "" : hint(T("Your bank credits the interest already after the 19% tax ({0} credited) – the interest before tax is worked out from it.", pln(r.interest)))) +
          row(T("Fees"), "−" + pln(r.fees), r.fees > 0 ? "bad" : "") + row(T("Fees per month (average)"), "−" + pln(r.fees / (r.days / 30.44)), r.fees > 0 ? "bad" : "") +
          row(T("Your real gain"), pln(r.netAll - r.fees), "big") +
          (r.groups.length > 1 ? `<h3 class="sub-h">${esc(T("Interest by type"))}</h3>` + r.groups.map(([k, v]) => row(k, "+" + pln(v))).join("") +
            hint(T("Your bank credits these separately – e.g. promotional interest on new money and standard interest on the rest.")) : ""))}
        ${card(heading(T("Use it in MoneyCompass"), "✔") + hint(T("Puts the balance at the end and the real rate before tax into one of your savings entries.")) +
          `<div class="two">${`<label class="field"><span>${esc(T("Savings entry"))}</span><select name="hold">${d.Holdings.map((h, i) => `<option value="${i}">${esc(h.Name)}</option>`).join("")}<option value="-1">${esc(T("New: Savings account"))}</option></select></label>`}
          <div class="buttons" style="align-self:end">${button(esc(T("Update")), "use-check", "main")}</div></div>` +
          `<hr>${hint(T("Keep this check in the Savings tab, to compare it with later statements. Nothing is kept unless you save it."))}
          <div class="two"><label class="field"><span>${esc(T("Name of the check"))}</span><input name="checkname" value="${esc(defaultName)}"></label>
          <div class="buttons" style="align-self:end">${button("💾 " + esc(T("Save result")), "save-check", "second")}</div></div>
          ${check("alsohold", T("Also put the balance and rate into the savings entry above"), true)}`)}
        ${card(heading(T("Month by month"), "📅") + hint(T("Interest credited in the first days of a month counts for the month before.")) +
          `<table class="rate-table"><thead><tr><th>${esc(T("Month"))}</th><th>${esc(T("Balance at the end"))}</th><th>${esc(T("Average balance"))}</th><th>${esc(T("Interest"))}</th><th>${esc(T("Fees"))}</th><th>${esc(T("Rate per year"))}</th></tr></thead><tbody>` +
          r.months.map(m => `<tr><td>${esc(monthName(m.m))}</td><td>${pln(m.end)}</td><td>${pln(m.avg)}</td><td>${m.interest ? "+" + pln(m.interest) : "–"}</td><td class="${m.fees > 0 ? "bad" : ""}">${m.fees > 0 ? "−" + pln(m.fees) : "–"}</td><td class="${m.interest && m.rate < 2 ? "bad" : ""}">${m.interest ? rate(m.rate) : "–"}</td></tr>`).join("") +
          `</tbody></table>`, "wide")}
      </div>
      <div class="popup-buttons"><button class="btn second" data-close>${esc(T("Close"))}</button></div>`;
    p.el.querySelector('[name="opening"]')?.addEventListener("change", e => { opening = Csv.parseAmount(e.target.value) || 0; draw(); });
    // Puts the balance at the end and the real rate (before tax) into the chosen savings entry, or a new one
    const toHolding = name => {
      const idx = +p.el.querySelector('[name="hold"]').value;
      let h = d.Holdings[idx];
      if (!h) { h = { Id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), Name: name || T("Savings account"), Place: "Bank", Currency: "PLN", Safe: true }; d.Holdings.push(h); }
      h.Amount = r2(r.closing); h.RatePercent = r2(r.gross);
      return h;
    };
    p.el.querySelector('[data-action="save-check"]').onclick = () => {
      const name = p.el.querySelector('[name="checkname"]').value.trim() || defaultName;
      const h = p.el.querySelector('[name="alsohold"]').checked ? toHolding(name) : null;
      d.SavingsChecks.unshift({ HoldingId: h?.Id || "", Id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), Name: name, Saved: new Date().toISOString().slice(0, 19),
        From: isoDate(r.from), To: isoDate(r.to), Days: r.days, Opening: r2(r.opening), Closing: r2(r.closing), Average: r2(r.avg),
        Deposits: r2(r.deposits), Withdrawals: r2(r.withdrawals), Interest: r2(r.grossAll), Tax: r2(r.taxAll), Fees: r2(r.fees),
        Gross: r2(r.gross), Net: r2(r.netAfterBelka), Months: r.months.map(m => ({ Month: isoDate(m.m), End: r2(m.end), Average: r2(m.avg), Interest: r2(m.interest), Fees: r2(m.fees), Rate: r2(m.rate) })),
        Types: r.groups.map(([k, v]) => ({ Name: k, Interest: r2(v) })) });
      save(); p.close(); App.refresh();
      toast(T("Saved in Savings: {0}.", name) + (h ? " " + T("{0}: {1} at {2}.", h.Name, pln(h.Amount), rate(h.RatePercent)) : ""), "good");
    };
    p.el.querySelector('[data-action="use-check"]').onclick = () => {
      const h = toHolding(T("Savings account"));
      save(); p.close(); App.refresh();
      toast(T("{0}: {1} at {2}.", h.Name, pln(h.Amount), rate(h.RatePercent)), "good");
    };
  };
  draw();
}

/** Saved checks in the Savings tab – only shown when you saved at least one. */
export function savedChecksCard(d) {
  if (!d.SavingsChecks?.length) return "";
  return card(heading(T("Your account checks"), "📑") + hint(T("The real rate of your savings accounts, from the statements you checked. Click a check for the months.")) +
    d.SavingsChecks.map(c => {
      const linked = d.Holdings.find(h => h.Id === c.HoldingId), perMonth = c.Days ? c.Fees / (c.Days / 30.44) : 0;
      return `<details class="rec-month check-item"><summary><div class="check-head"><b>${esc(c.Name)}</b>
        <span class="hint">${fmtDate(c.From)} – ${fmtDate(c.To)}</span></div>
        <div class="right"><b>${pln(c.Closing)}</b><span class="hint"><b class="${c.Net < 2 ? "bad" : "good"}">${rate(c.Net)}</b> ${esc(T("after tax"))}</span></div>
        <button class="icon-btn danger" data-del-check="${esc(c.Id)}" title="${esc(T("Delete"))}">🗑</button></summary>
        ${row(T("Balance on {0}", fmtDate(c.To)), pln(c.Closing), "big")}
        ${row(T("At the start"), pln(c.Opening))}${row(T("New money paid in"), "+" + pln(c.Deposits))}${row(T("Taken out"), "−" + pln(c.Withdrawals))}${row(T("Average balance"), pln(c.Average))}
        ${row(T("Before tax"), rate(c.Gross))}${row(T("After tax and fees"), rate(c.Net))}
        ${row(T("Interest (before tax)"), "+" + pln(c.Interest), "good")}${row(T("Belka tax 19%"), "−" + pln(c.Tax))}
        ${row(T("Fees"), "−" + pln(c.Fees), c.Fees > 0 ? "bad" : "")}${row(T("Fees per month (average)"), "−" + pln(perMonth), c.Fees > 0 ? "bad" : "")}
        ${(c.Types || []).length > 1 ? c.Types.map(t => row(t.Name, "+" + pln(t.Interest))).join("") : ""}
        ${(c.Months || []).length ? `<table class="rate-table"><thead><tr><th>${esc(T("Month"))}</th><th>${esc(T("Balance at the end"))}</th><th>${esc(T("Interest"))}</th><th>${esc(T("Fees"))}</th><th>${esc(T("Rate per year"))}</th></tr></thead><tbody>` +
          c.Months.map(m => `<tr><td>${esc(monthName(parseDate(m.Month)))}</td><td>${m.End !== undefined ? pln(m.End) : pln(m.Average)}</td><td>${m.Interest ? "+" + pln(m.Interest) : "–"}</td><td class="${m.Fees > 0 ? "bad" : ""}">${m.Fees > 0 ? "−" + pln(m.Fees) : "–"}</td><td>${m.Interest ? rate(m.Rate) : "–"}</td></tr>`).join("") + "</tbody></table>" : ""}
        ${linked ? hint("✔ " + T("In Your savings as \"{0}\".", linked.Name))
          : `<div class="buttons">${button("＋ " + esc(T("Add to Your savings")), "check-hold", "second small", `data-check="${esc(c.Id)}"`)}</div>`}
      </details>`; }).join(""));
}
export function bindSavedChecks(el, d) {
  // A saved check without a savings entry: create one with the balance at the end and the rate before tax
  el.querySelectorAll('[data-action="check-hold"]').forEach(b => b.onclick = () => {
    const c = d.SavingsChecks.find(x => x.Id === b.dataset.check); if (!c) return;
    const h = { Id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), Name: c.Name, Place: "Bank", Currency: "PLN", Safe: true, Amount: c.Closing, RatePercent: c.Gross };
    d.Holdings.push(h); c.HoldingId = h.Id; save(); App.refresh();
    toast(T("{0}: {1} at {2}.", h.Name, pln(h.Amount), rate(h.RatePercent)), "good");
  });
  el.querySelectorAll("[data-del-check]").forEach(b => b.onclick = async ev => {
    ev.preventDefault(); ev.stopPropagation();
    const { confirmBox } = await import("./ui.js");
    if (!(await confirmBox(T("Delete this check?"), d.SavingsChecks.find(c => c.Id === b.dataset.delCheck)?.Name || "", T("Delete"), T("Cancel"), true))) return;
    d.SavingsChecks = d.SavingsChecks.filter(c => c.Id !== b.dataset.delCheck); save(); App.refresh();
  });
}
