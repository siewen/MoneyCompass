// Import of a crypto platform's transaction history (CSV). First: Nexo.
// Nexo export columns: Transaction, Type, Input Currency, Input Amount, Output Currency, Output Amount, USD Equivalent,
// Details, (Outstanding Loan), Date / Time. Money going out has a negative input amount; interest has the same amount in and out;
// cancelled rows say "rejected" in Details. Nexo keeps euro and dollar balances as EURX / USDX.
// MoneyCompass works out what you hold now (per coin), what you paid for it (from the USD value at the time), the interest
// you earned, deposits and withdrawals – shows a preview – and saves it as ONE savings account in Savings (never in Inflows/Outflows).
import { T, State, save, Calc, pln, fmtDate, isoDate, today, uuid, mainCur } from "./core.js";
import { esc, popup, pickFile, alertBox, confirmBox, toast } from "./ui.js";
import { App, requirePro } from "./app.js";
import { parseDate } from "./csv.js";
import { loadPrices, priceOf, hasPrice } from "./investments.js";
import { Rates } from "./rates.js";

const D = () => State.data;

// ---------------------------------------------------------------- reading the file
function splitCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some(c => c.trim())) rows.push(row); row = []; }
    else cell += ch;
  }
  row.push(cell); if (row.some(c => c.trim())) rows.push(row);
  return rows.map(r => r.map(c => c.trim()));
}
const norm = s => s.toLowerCase().replace(/[^a-z]/g, "");
/** Is this text a Nexo transaction export? */
export function isNexoCsv(text) {
  const head = norm((text || "").split(/\r?\n/, 1)[0]);
  return head.includes("transaction") && head.includes("inputcurrency") && head.includes("outputcurrency");
}
const num = v => { const n = parseFloat(String(v || "").replace(/[$\s,]/g, "")); return Number.isFinite(n) ? n : 0; };
const dateOf = v => parseDate(String(v || "").slice(0, 19)) || parseDate(String(v || "").slice(0, 10));

// Types that are not your holdings, or the second line of a pair: moves inside Nexo (fixed terms, wallets), the credit line
// (borrowing, repaying, the Nexo card paid from it), and lines that repeat another one (the bank side of a deposit, the
// liquidation line next to the "Manual Sell Order" that really takes the coins).
const SAME = new Set(["lockingtermdeposit", "unlockingtermdeposit", "exchangedepositedon", "exchangeliquidation"]);   // read, changes nothing
const CREDIT = new Set(["exchangecredit", "creditcardwithdrawalcredit", "nexocardpurchase", "nexocardrefund", "nexocardcashbackreversal",
  "nexocardtransactionfee", "loanwithdrawal", "manualrepayment", "repayment", "assimilation", "depositoverrepayment", "interestdiscount", "creditcardstatus"]);
const INCOME = /interest|cashback|bonus|reward|dividend|airdrop|staking/;
const DEPOSIT = /^(deposit|topupcrypto|transferin|deposittoexchange)$/;
const WITHDRAW = /^(withdrawal|withdraw|transferout|withdrawexchanged|liquidation|manualsellorder)$/;
const SWAP = /^(exchange|exchangecollateral|exchangetowithdraw)$/;
const LOAN_INTEREST = /^interestadditional$/;
const PLAIN_FIAT = new Set(["EUR", "USD", "GBP", "CHF", "PLN", "XUSD"]);   // outside the platform (bank side) or the credit line itself (xUSD)

/** Works through all rows: balances per coin, cost (USD at the time), interest, deposits, withdrawals. */
export function parseNexo(text) {
  const rows = splitCsv(text);
  const h = rows[0].map(norm), at = (...names) => { for (const n of names) { const i = h.indexOf(n); if (i >= 0) return i; } return h.findIndex(c => names.some(n => c.startsWith(n))); };
  const c = { type: at("type"), inCur: at("inputcurrency"), inAmt: at("inputamount"), outCur: at("outputcurrency"), outAmt: at("outputamount"),
    usd: at("usdequivalent"), details: at("details"), date: at("datetimeutc", "datetime", "date"), fee: h.indexOf("fee"), feeCur: at("feecurrency") };
  const flows = {};   // per month: interest earned, credits (deposits), debits (withdrawals), fees & charges – all in USD
  const flow = (k, v) => { if (curMonth === null || !(v > 0)) return; const f = flows[curMonth] || (flows[curMonth] = { int: 0, dep: 0, wd: 0, fee: 0 }); f[k] += v; };
  const incomeUsd = {};
  let feesUsd = 0;
  const bal = {}, cost = {}, income = {}, types = {}, skipped = {};
  let curMonth = null;
  let interestUsd = 0, loanInterestUsd = 0, depositsUsd = 0, withdrawalsUsd = 0, from = null, to = null, used = 0, rejected = 0;
  // Add coins. When more went out earlier than the file shows coming in (balance below 0), the first part only fills that gap:
  // cost counts just for the part above zero.
  const add = (cur, amt, usd = 0) => {
    if (!cur || cur === "-" || PLAIN_FIAT.has(cur) || !(amt > 0)) return;
    const before = bal[cur] || 0, above = Math.max(0, before + amt) - Math.max(0, before);
    bal[cur] = before + amt; cost[cur] = (cost[cur] || 0) + usd * (above / amt);
  };
  const take = cur => amt => {
    if (!cur || PLAIN_FIAT.has(cur)) return null;                       // paid from outside (bank, card)
    if (!(bal[cur] > 0)) { bal[cur] = (bal[cur] || 0) - amt; return null; }   // not seen arriving (file starts later): cost unknown
    const part = Math.min(1, amt / bal[cur]), moved = (cost[cur] || 0) * part;
    bal[cur] -= amt; cost[cur] = (cost[cur] || 0) - moved; return moved;
  };
  // Oldest first: the export is newest first
  const list = rows.slice(1).filter(r => r.length > 3).map(r => ({ r, d: dateOf(r[c.date]) })).sort((a, b) => (a.d || 0) - (b.d || 0));
  // Month by month: the balance of each coin at the end of every month, valued with the last price seen in the file
  // (Nexo gives the USD value on every row – the daily interest rows alone give a price almost every day)
  const price = {}, monthly = [];
  const snapshot = () => { if (!curMonth) return; let v = 0; for (const k in bal) if (bal[k] > 1e-9) v += bal[k] * (price[k] || (PLAIN_FIAT.has(k) ? 1 : 0)); monthly.push({ month: curMonth, usd: v }); };
  for (const { r, d } of list) {
    const type = r[c.type] || "", t = norm(type), details = (r[c.details] || "").toLowerCase();
    if (details.startsWith("rejected") || details.startsWith("pending")) { rejected++; continue; }
    const inCur = (r[c.inCur] || "").toUpperCase(), outCur = (r[c.outCur] || "").toUpperCase();
    const inAmt = num(r[c.inAmt]), outAmt = num(r[c.outAmt]), usd = Math.abs(num(r[c.usd]));
    if (d) {
      const m = d.getFullYear() * 12 + d.getMonth();
      if (curMonth !== null && m !== curMonth) { snapshot(); for (let k = curMonth + 1; k < m; k++) { curMonth = k; snapshot(); } }
      curMonth = m;
    }
    if (usd > 0) {   // price of a coin = USD value / amount (the receiving side of an exchange, or the one coin of the row)
      if (outCur && outCur !== "-" && Math.abs(outAmt) > 0) price[outCur] = usd / Math.abs(outAmt);
      else if (inCur && Math.abs(inAmt) > 0) price[inCur] = usd / Math.abs(inAmt);
    }
    let counted = true;
    const walletMove = /^transfer(in|out)$/.test(t) && /wallet/.test(details);   // between your Savings and Credit Line wallet
    // Fees: Nexo's own fee column, and the card's currency-conversion fee
    const feeAmt = c.fee >= 0 ? num(r[c.fee]) : 0, feeCur = c.feeCur >= 0 ? (r[c.feeCur] || "").toUpperCase() : "";
    if (feeAmt > 0 && feeCur) { const fu = feeAmt * (["USD", "USDX", "XUSD", "USDT", "USDC"].includes(feeCur) ? 1 : price[feeCur] || (feeCur.startsWith("EUR") ? price.EURX || 1.1 : 0)); feesUsd += fu; flow("fee", fu); }
    if (t === "nexocardtransactionfee") { feesUsd += usd; flow("fee", usd); }
    if (CREDIT.has(t)) { skipped[type] = (skipped[type] || 0) + 1; continue; }
    if (SAME.has(t) || walletMove) { /* inside Nexo, or the second line of a pair: nothing changes */ }
    else if (LOAN_INTEREST.test(t) || (t === "interest" && (inCur === "XUSD" || inAmt < 0))) {   // interest you PAID on the credit line
      loanInterestUsd += usd; if (LOAN_INTEREST.test(t)) take(inCur)(Math.abs(inAmt)); skipped[type] = (skipped[type] || 0) + 1; continue;
    }
    else if (INCOME.test(t)) {
      const cur = outCur && outCur !== "-" ? outCur : inCur, amt = Math.abs(outAmt || inAmt);
      add(cur, amt, 0); interestUsd += usd; income[cur] = (income[cur] || 0) + amt; incomeUsd[cur] = (incomeUsd[cur] || 0) + usd; flow("int", usd);
    }
    else if (DEPOSIT.test(t)) { add(outCur || inCur, Math.abs(outAmt || inAmt), usd); depositsUsd += usd; flow("dep", usd); }
    else if (WITHDRAW.test(t)) { take(inCur || outCur)(Math.abs(inAmt || outAmt)); withdrawalsUsd += usd; flow("wd", usd); }
    // A swap: the coin you get counts at what it was worth then (Nexo's USD value), so the return per coin is its own
    else if (SWAP.test(t)) { take(inCur)(Math.abs(inAmt)); add(outCur, Math.abs(outAmt), usd); }
    else { counted = false; skipped[type] = (skipped[type] || 0) + 1; }   // loans, card payments and other things that are not your holdings
    if (counted) { used++; types[type] = (types[type] || 0) + 1; if (d) { from = !from || d < from ? d : from; to = !to || d > to ? d : to; } }
  }
  snapshot();
  const months = monthly.map(x => ({ date: new Date(Math.floor(x.month / 12), x.month % 12 + 1, 0), usd: Math.round(x.usd * 100) / 100, ...(flows[x.month] || { int: 0, dep: 0, wd: 0, fee: 0 }) }));
  const assets = Object.keys(bal).filter(k => bal[k] > 1e-5).map(k => ({ Coin: k, Amount: Math.round(bal[k] * 1e8) / 1e8, CostUsd: Math.max(0, cost[k] || 0) }))
    .sort((a, b) => b.CostUsd - a.CostUsd);
  return { months, assets, income, incomeUsd, feesUsd, interestUsd, loanInterestUsd, depositsUsd, withdrawalsUsd, from, to, used, rejected, types, skipped, total: list.length };
}

// ---------------------------------------------------------------- preview and saving
/** Pick (or get) a file, check it, show the preview. */
export async function openInvestImport(fileObj = null) {
  if (!(await requirePro(T("Import CSV")))) return;
  if (!fileObj) fileObj = await pickFile(".csv,.txt,text/csv");
  if (!fileObj) return;
  const text = new TextDecoder("utf-8").decode(await fileObj.arrayBuffer()).replace(/^﻿/, "");
  if (!isNexoCsv(text)) {
    await alertBox(T("Import CSV"), T("This file is not a Nexo transaction export. Nexo works now; Binance, Revolut, XTB, eToro and a general format are planned."));
    return;
  }
  let x;
  try { x = parseNexo(text); } catch (e) { await alertBox(T("Import CSV"), T("The file could not be read: {0}", e.message)); return; }
  if (!x.used) { await alertBox(T("Import CSV"), T("No transactions found in this file.")); return; }
  await loadPrices([...x.assets.map(a => a.Coin).filter(hasPrice), "USDC"], true);
  const fx = await usdRate();
  if (!(fx.usd > 0)) { await alertBox(T("Import CSV"), T("The dollar exchange rate is not known, so the Nexo amounts (in USD) cannot be converted. Connect to the internet or enter the rate in Savings → Exchange rates, then import again.")); return; }
  preview(x, fileObj.name, fx);
}
/** 1 USD and 1 EUR in złoty: your exchange rates, else today's NBP rates (downloaded now), else the USDC price as a last resort. */
async function usdRate() {
  const s = D().Settings;
  let usd = s.UsdToPln || Rates.data.Usd || 0, eur = s.EurToPln || Rates.data.Eur || 0;
  if (!(usd > 0) || !(eur > 0)) {
    const get = c => fetch(`https://api.nbp.pl/api/exchangerates/rates/a/${c}/?format=json`).then(r => r.json()).then(j => j.rates[0].mid).catch(() => 0);
    const [u, e] = await Promise.all([usd > 0 ? usd : get("usd"), eur > 0 ? eur : get("eur")]);
    usd = u; eur = e;
  }
  if (!(usd > 0)) usd = priceOf("USDC") || priceOf("USDT") || 0;
  return { usd, eur };
}

function preview(x, name, fx) {
  // Nexo keeps everything in USD: amounts go into the main currency through złoty (rates from usdRate)
  const d = D(), s = d.Settings, toMain = v => Calc.toPln(v, "PLN", s), usd = v => toMain(v * fx.usd);
  const FX = { USDX: fx.usd, USD: fx.usd, EURX: fx.eur, EUR: fx.eur, PLN: 1 };
  const priceMain = c => c in FX ? toMain(FX[c] || 0) : toMain(priceOf(c));   // coin prices come in złoty
  const rows = x.assets.map(a => ({ ...a, cost: usd(a.CostUsd), price: priceMain(a.Coin) })).map(a => ({ ...a, value: a.price ? a.price * a.Amount : null }));
  const value = rows.reduce((t, a) => t + (a.value ?? a.cost), 0), paid = rows.reduce((t, a) => t + a.cost, 0);
  const days = x.from && x.to ? Math.max(30, (x.to - x.from) / 86400000) : 365;
  const rate = value > 0 ? usd(x.interestUsd) / (days / 365) / value * 100 : 0;
  const skipped = Object.entries(x.skipped);
  const old = d.Holdings.find(q => q.ImportedFrom === "nexo") || d.Holdings.find(q => /^nexo$/i.test(q.Name));
  let saved = false;
  const p = popup(`<h2 class="popup-title">⬆ ${esc(T("Import from Nexo – preview"))}</h2>
    <p class="hint">${esc(name)} · ${x.from ? esc(fmtDate(x.from) + " – " + fmtDate(x.to)) : ""} · ${esc(T("{0} transactions read", x.used))}${x.rejected ? " · " + esc(T("{0} cancelled, not counted", x.rejected)) : ""}</p>
    <div class="import-top"><div><span>${esc(T("Closing balance today"))}</span><b>${pln(value)}</b></div>
      <div><span>${esc(T("Interest and bonuses earned"))}</span><b class="in">+${pln(usd(x.interestUsd))}</b></div>
      <div><span>${esc(T("Estimated interest rate p.a."))}</span><b>${rate ? (Math.round(rate * 100) / 100).toString().replace(".", ",") + "%" : "–"}</b></div></div>
    <div class="grid">
      <section class="card"><h3>${esc(T("What you hold now"))}</h3>
        <table class="rate-table"><thead><tr><th>${esc(T("Coin"))}</th><th>${esc(T("Amount"))}</th><th>${esc(T("Paid"))}</th><th>${esc(T("Value now"))}</th></tr></thead><tbody>
        ${rows.map(a => `<tr><td>${esc(a.Coin)}</td><td>${esc(String(a.Amount).replace(".", ","))}</td><td>${a.cost ? pln(a.cost) : "–"}</td><td>${a.value !== null ? pln(a.value) : `<span class="hint">${esc(T("no price"))}</span>`}</td></tr>`).join("")}
        </tbody></table>
        <div class="row ${value - paid >= 0 ? "in" : "out"}"><span>${esc(T("Profit / loss"))}</span><b>${value - paid >= 0 ? "+" : "−"}${pln(Math.abs(value - paid))}</b></div>
        <p class="hint">${esc(T("Paid = what each coin was worth when you got it (deposit, purchase or exchange), in złoty at today's NBP rate. Interest and bonuses count as free (paid 0)."))}</p>
      </section>
      <section class="card"><h3>${esc(T("Interest and money in / out"))}</h3>
        ${Object.entries(x.income).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `<div class="row"><span class="hint">${esc(T("Interest in {0}", k))}</span><b class="hint">+${esc(String(Math.round(v * 1e6) / 1e6).replace(".", ","))}</b></div>`).join("")}
        <div class="row in"><span>${esc(T("Credits (deposits)"))}</span><b>+${pln(usd(x.depositsUsd))}</b></div>
        <div class="row out"><span>${esc(T("Debits (withdrawals)"))}</span><b>−${pln(usd(x.withdrawalsUsd))}</b></div>
        <div class="row ${x.feesUsd > 0 ? "out" : "nil"}"><span>${esc(T("Fees & charges"))}</span><b>${x.feesUsd > 0 ? "−" : ""}${pln(usd(x.feesUsd))}</b></div>
        ${x.loanInterestUsd > 0 ? `<div class="row out"><span>${esc(T("Interest paid on the credit line"))}</span><b>−${pln(usd(x.loanInterestUsd))}</b></div>` : ""}
        ${skipped.length ? `<p class="hint">${esc(T("Not counted (loans, card payments and similar): {0}", skipped.map(([k, n]) => k + " ×" + n).join(", ")))}</p>` : ""}
        <p class="hint">${esc(T("The balance at the end of each month ({0} months) is saved too, so the Savings chart shows how it developed – valued with the prices in your file, in złoty at today's USD rate.", x.months.length))}</p>
        <p class="hint">${esc(T("Only your Savings are changed: Inflows and Outflows stay as they are."))}</p>
      </section>
    </div>
    <div class="popup-buttons save-bar">
      <label class="field"><span>${esc(old ? T("Updates your savings account") : T("New savings account"))}</span><input name="savname" value="${esc(old ? old.Name : "Nexo")}"></label>
      <span class="save-gap"></span>
      <button class="btn second" data-close>${esc(T("Close"))}</button>
      <button class="btn main big-save" data-go>💾 ${esc(T("Save to Savings"))}</button></div>`,
    { width: 900, beforeClose: () => saved || confirmBox(T("Close without saving?"), T("The import is not kept and your savings account is not updated."), T("Close without saving"), T("Back")) });
  p.el.querySelector("[data-go]").onclick = () => {
    const day = isoDate(today());
    // Keep the rates that were used, so the rest of the app can convert dollars and euros too
    if (!(s.UsdToPln > 0) && fx.usd > 0) s.UsdToPln = fx.usd;
    if (!(s.EurToPln > 0) && fx.eur > 0) s.EurToPln = fx.eur;
    const stats = { LoanInterestPln: usd(x.loanInterestUsd), File: name, From: x.from ? isoDate(x.from) : "", To: x.to ? isoDate(x.to) : "", InterestPln: usd(x.interestUsd),
      DepositsPln: usd(x.depositsUsd), WithdrawalsPln: usd(x.withdrawalsUsd), Rows: x.used, At: day, Coins: rows.map(a => ({ Coin: a.Coin, Amount: a.Amount, Value: Math.round((a.value ?? a.cost) * 100) / 100 })) };
    // Only Savings: one savings account (risky money, crypto platform) with today's value and the estimated rate
    let h = old;
    if (!h) { h = { Id: uuid(), Name: "Nexo", Place: "Crypto platform", Currency: mainCur(), Safe: false, History: [] }; d.Holdings.push(h); }
    Object.assign(h, { Name: p.el.querySelector('[name="savname"]').value.trim() || "Nexo", Place: "Crypto platform", Amount: Math.round(value * 100) / 100, Currency: mainCur(),
      RatePercent: Math.round(rate * 100) / 100, Safe: false, ImportedFrom: "nexo", Import: stats });
    // The month-end balances become the account's history: the Savings chart shows how it developed
    // (in złoty at today's USD rate; the current month is today's value)
    const thisMonth = isoDate(new Date(today().getFullYear(), today().getMonth() + 1, 0));
    h.History = x.months.map(m => ({ Date: isoDate(m.date), Amount: Math.round(usd(m.usd) * 100) / 100 })).filter(q => q.Date < thisMonth && q.Amount > 0)
      .concat([{ Date: day, Amount: h.Amount }]);
    // Also a statement analysis (like a bank savings statement): balance, credits, debits, interest and fees month by month.
    // It feeds the Savings chart (interest and fee lines) and the "Statement analyses" card. Replaces the previous Nexo analysis.
    const pl = v => Math.round(usd(v) * 100) / 100;
    const ms = x.months.map(m => { const end = pl(m.usd), int = pl(m.int);
      return { Month: isoDate(new Date(m.date.getFullYear(), m.date.getMonth(), 1)), End: end, Average: end, Interest: int, Fees: pl(m.fee), Credits: pl(m.dep), Debits: pl(m.wd), Rate: end > 0 ? Math.round(int * 12 / end * 10000) / 100 : 0 }; });
    const avg = ms.length ? ms.reduce((t, m) => t + m.End, 0) / ms.length : value;
    const feeTotal = pl(x.feesUsd), intTotal = pl(x.interestUsd), yrs = Math.max(1 / 12, days / 365);
    d.SavingsChecks = (d.SavingsChecks || []).filter(q => q.Source !== "nexo");
    d.SavingsChecks.unshift({ Id: uuid(), Source: "nexo", HoldingId: h.Id, Name: h.Name, Saved: new Date().toISOString().slice(0, 19),
      From: stats.From, To: stats.To, Days: Math.round(days), Opening: ms[0]?.End || 0, Closing: Math.round(value * 100) / 100, Average: Math.round(avg * 100) / 100,
      Deposits: pl(x.depositsUsd), Withdrawals: pl(x.withdrawalsUsd), Interest: intTotal, Tax: 0, Fees: feeTotal,
      Gross: avg > 0 ? Math.round(intTotal / yrs / avg * 10000) / 100 : 0, Net: avg > 0 ? Math.round((intTotal - feeTotal) / yrs / avg * 10000) / 100 : 0,
      Months: ms, Types: Object.entries(x.incomeUsd).sort((a, b2) => b2[1] - a[1]).slice(0, 8).map(([k, v]) => ({ Name: T("Interest in {0}", k), Interest: pl(v) })) });
    if (Array.isArray(d.Investments)) d.Investments = d.Investments.filter(q => q.Broker !== "nexo");   // a Nexo position in Investments would count it twice
    saved = true; save(); p.close(undefined, true); App.go("portfolio");
    toast(T("Nexo imported: {0}.", pln(value)), "good");
  };
}
