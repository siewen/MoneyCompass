// Import of a crypto platform's transaction history (CSV). First: Nexo.
// Nexo export columns: Transaction, Type, Input Currency, Input Amount, Output Currency, Output Amount, USD Equivalent,
// Details, (Outstanding Loan), Date / Time. Money going out has a negative input amount; interest has the same amount in and out;
// cancelled rows say "rejected" in Details. Nexo keeps euro and dollar balances as EURX / USDX.
// MoneyCompass works out what you hold now (per coin), what you paid for it (from the USD value at the time), the interest
// you earned, deposits and withdrawals – shows a preview – and saves it as ONE savings account in Savings (never in Inflows/Outflows).
import { T, State, save, Calc, pln, fmtDate, isoDate, today, uuid } from "./core.js";
import { esc, popup, pickFile, alertBox, confirmBox, toast } from "./ui.js";
import { App, requirePro } from "./app.js";
import { parseDate } from "./csv.js";
import { loadPrices, priceOf, hasPrice } from "./investments.js";

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
    usd: at("usdequivalent"), details: at("details"), date: at("datetimeutc", "datetime", "date") };
  const bal = {}, cost = {}, income = {}, types = {}, skipped = {};
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
  for (const { r, d } of list) {
    const type = r[c.type] || "", t = norm(type), details = (r[c.details] || "").toLowerCase();
    if (details.startsWith("rejected") || details.startsWith("pending")) { rejected++; continue; }
    const inCur = (r[c.inCur] || "").toUpperCase(), outCur = (r[c.outCur] || "").toUpperCase();
    const inAmt = num(r[c.inAmt]), outAmt = num(r[c.outAmt]), usd = Math.abs(num(r[c.usd]));
    let counted = true;
    const walletMove = /^transfer(in|out)$/.test(t) && /wallet/.test(details);   // between your Savings and Credit Line wallet
    if (CREDIT.has(t)) { skipped[type] = (skipped[type] || 0) + 1; continue; }
    if (SAME.has(t) || walletMove) { /* inside Nexo, or the second line of a pair: nothing changes */ }
    else if (LOAN_INTEREST.test(t) || (t === "interest" && (inCur === "XUSD" || inAmt < 0))) {   // interest you PAID on the credit line
      loanInterestUsd += usd; if (LOAN_INTEREST.test(t)) take(inCur)(Math.abs(inAmt)); skipped[type] = (skipped[type] || 0) + 1; continue;
    }
    else if (INCOME.test(t)) {
      const cur = outCur && outCur !== "-" ? outCur : inCur, amt = Math.abs(outAmt || inAmt);
      add(cur, amt, 0); interestUsd += usd; income[cur] = (income[cur] || 0) + amt;
    }
    else if (DEPOSIT.test(t)) { add(outCur || inCur, Math.abs(outAmt || inAmt), usd); depositsUsd += usd; }
    else if (WITHDRAW.test(t)) { take(inCur || outCur)(Math.abs(inAmt || outAmt)); withdrawalsUsd += usd; }
    // A swap: the coin you get counts at what it was worth then (Nexo's USD value), so the return per coin is its own
    else if (SWAP.test(t)) { take(inCur)(Math.abs(inAmt)); add(outCur, Math.abs(outAmt), usd); }
    else { counted = false; skipped[type] = (skipped[type] || 0) + 1; }   // loans, card payments and other things that are not your holdings
    if (counted) { used++; types[type] = (types[type] || 0) + 1; if (d) { from = !from || d < from ? d : from; to = !to || d > to ? d : to; } }
  }
  const assets = Object.keys(bal).filter(k => bal[k] > 1e-5).map(k => ({ Coin: k, Amount: Math.round(bal[k] * 1e8) / 1e8, CostUsd: Math.max(0, cost[k] || 0) }))
    .sort((a, b) => b.CostUsd - a.CostUsd);
  return { assets, income, interestUsd, loanInterestUsd, depositsUsd, withdrawalsUsd, from, to, used, rejected, types, skipped, total: list.length };
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
  await loadPrices(x.assets.map(a => a.Coin).filter(hasPrice), true);
  preview(x, fileObj.name);
}

function preview(x, name) {
  const d = D(), s = d.Settings, usd = v => Calc.toPln(v, "USD", s);
  const rows = x.assets.map(a => ({ ...a, cost: usd(a.CostUsd), price: priceOf(a.Coin) })).map(a => ({ ...a, value: a.price ? a.price * a.Amount : null }));
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
        <div class="row"><span>${esc(T("Deposited"))}</span><b>${pln(usd(x.depositsUsd))}</b></div>
        <div class="row"><span>${esc(T("Withdrawn"))}</span><b>${pln(usd(x.withdrawalsUsd))}</b></div>
        ${x.loanInterestUsd > 0 ? `<div class="row out"><span>${esc(T("Interest paid on the credit line"))}</span><b>−${pln(usd(x.loanInterestUsd))}</b></div>` : ""}
        ${skipped.length ? `<p class="hint">${esc(T("Not counted (loans, card payments and similar): {0}", skipped.map(([k, n]) => k + " ×" + n).join(", ")))}</p>` : ""}
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
    const stats = { LoanInterestPln: usd(x.loanInterestUsd), File: name, From: x.from ? isoDate(x.from) : "", To: x.to ? isoDate(x.to) : "", InterestPln: usd(x.interestUsd),
      DepositsPln: usd(x.depositsUsd), WithdrawalsPln: usd(x.withdrawalsUsd), Rows: x.used, At: day, Coins: rows.map(a => ({ Coin: a.Coin, Amount: a.Amount, Value: Math.round((a.value ?? a.cost) * 100) / 100 })) };
    // Only Savings: one savings account (risky money, crypto platform) with today's value and the estimated rate
    let h = old;
    if (!h) { h = { Id: uuid(), Name: "Nexo", Place: "Crypto platform", Currency: "PLN", Safe: false, History: [] }; d.Holdings.push(h); }
    Object.assign(h, { Name: p.el.querySelector('[name="savname"]').value.trim() || "Nexo", Place: "Crypto platform", Amount: Math.round(value * 100) / 100, Currency: "PLN",
      RatePercent: Math.round(rate * 100) / 100, Safe: false, ImportedFrom: "nexo", Import: stats });
    const hist = h.History || (h.History = []), last = hist[hist.length - 1];
    if (last && last.Date === day) last.Amount = h.Amount; else hist.push({ Date: day, Amount: h.Amount });
    if (Array.isArray(d.Investments)) d.Investments = d.Investments.filter(q => q.Broker !== "nexo");   // a Nexo position in Investments would count it twice
    saved = true; save(); p.close(undefined, true); App.go("portfolio");
    toast(T("Nexo imported: {0}.", pln(value)), "good");
  };
}
