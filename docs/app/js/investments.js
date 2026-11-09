// Module "Investments" (Pro, in development): crypto platforms and brokers – one card per broker with what it is,
// the key facts, a link, and YOUR position: what you put in, what it is worth now and the return in %.
// A position is either one total amount, or a list of coins (with live prices for crypto) – then MoneyCompass
// works out the value and your average buying price. Also: value history, a monthly plan and a tax (PIT-38) estimate.
// Information only: no advice, no responsibility for decisions or losses.
// core.js imports investmentsTotal from here (wealth totals): nothing at the top level may use core.js values.
import { T, State, save, Calc, pln, num, plain, fmtDate, isoDate, today, uuid, lang, store, Hooks } from "./core.js";
import { esc, card, heading, hint, row, field, numInput, select, button, toast, confirmBox } from "./ui.js";
import { App } from "./app.js";

const D = () => State.data;
export const CHECKED = "2026-11-03";   // when the broker facts below were last checked

/** The brokers and platforms we describe. Facts change – each card says when they were checked. */
export const BROKERS = [
  { id: "nexo", name: "Nexo", kind: "Crypto platform", url: "https://nexo.com", crypto: true,
    about: "Crypto platform: buy and hold crypto, earn interest on it (Earn), borrow against it (crypto-backed credit line) and pay with the Nexo card. Interest is paid daily; fixed terms pay more than flexible savings.",
    facts: [
      ["Earn – interest (up to)", "BTC 5,5% · ETH 6% · USDC 10,5% · USDT 11,5% · NEXO token 9%"],
      ["Good to know", "The highest rates usually need a fixed term or a higher loyalty tier (holding NEXO tokens). Rates change often and depend on your country."],
      ["In the EU", "Served through two MiCA-licensed partners: Tangany (custody) and DLT Finance (brokerage). Lending is not covered by these licences."],
      ["Risk", "High: crypto prices can fall sharply, and there is no state guarantee (no BFG) if the platform fails."],
    ] },
  { id: "xtb", name: "XTB", kind: "Broker: stocks & ETFs", url: "https://www.xtb.com/pl",
    about: "Polish broker for stocks and ETFs (also fractional shares and regular investment plans), with IKE and IKZE retirement accounts. Also offers CFDs – leveraged products where most private investors lose money.",
    facts: [
      ["Fees", "0% commission on stocks and ETFs up to €100 000 turnover a month, then 0,2% (at least €10). Currency conversion: 0,5%."],
      ["Retirement accounts", "IKE and IKZE: invest with the tax benefits of retirement accounts."],
      ["Supervision", "Supervised by the Polish KNF. Investor compensation scheme (KDPW) up to €20 100."],
      ["Risk", "Medium to high: share prices go up and down. CFDs are very risky."],
    ] },
  { id: "revolut", name: "Revolut", kind: "Banking app: stocks & crypto", url: "https://www.revolut.com/pl-PL/",
    about: "Banking app with stocks, ETFs and crypto in one place. How many trades are free each month depends on your plan.",
    facts: [
      ["Crypto in the EU", "MiCA licence from the Cyprus regulator CySEC (2025)."],
      ["Good to know", "Easy for small amounts and beginners. Compare the fees of your plan – above the free trades each trade costs extra."],
      ["Risk", "Stocks: medium to high. Crypto: high – no state guarantee."],
    ] },
  { id: "etoro", name: "eToro", kind: "Broker & crypto", url: "https://www.etoro.com",
    about: "Platform for stocks, ETFs and crypto, known for copy trading (copying other investors' trades). Also offers CFDs – leveraged products where most private investors lose money.",
    facts: [
      ["Crypto in the EU", "MiCA licence from the Cyprus regulator CySEC (February 2025)."],
      ["Good to know", "Copying other investors also copies their losses. Check the fees for currency conversion and withdrawals."],
      ["Risk", "Stocks: medium to high. Crypto and CFDs: high."],
    ] },
  { id: "bybit", name: "Bybit", kind: "Crypto exchange", url: "https://www.bybit.eu", crypto: true,
    about: "Large crypto exchange. EU customers are served by Bybit EU from Vienna. Offers spot trading, Earn products and very risky derivatives.",
    facts: [
      ["In the EU", "Bybit EU holds a MiCA licence from the Austrian regulator FMA (2025)."],
      ["Good to know", "In February 2025 Bybit was hacked (about 1,5 billion USD in crypto). Keep large amounts in your own wallet, not on an exchange."],
      ["Risk", "High: crypto prices can fall sharply, no state guarantee. Derivatives can lose more than you expect."],
    ] },
  { id: "binance", name: "Binance", kind: "Crypto exchange", url: "https://www.binance.com", crypto: true,
    alert: "Since 1 July 2026 Binance has limited its services in Poland, because it has no EU (MiCA) licence: no new trades, deposits or Earn subscriptions. Withdrawing and selling (Convert) are still possible – consider moving your funds to a provider with an EU licence or to your own wallet.",
    about: "The world's largest crypto exchange.",
    facts: [
      ["Status in Poland", "Limited since 1 July 2026 – no MiCA licence."],
      ["Risk", "High: crypto prices can fall sharply, no state guarantee."],
    ] },
];

// ---------------------------------------------------------------- live crypto prices (CoinGecko, free, no key)
const COINS = { BTC: "bitcoin", ETH: "ethereum", USDT: "tether", USDC: "usd-coin", SOL: "solana", XRP: "ripple", DOT: "polkadot", ADA: "cardano",
  BNB: "binancecoin", NEXO: "nexo", DOGE: "dogecoin", LTC: "litecoin", TRX: "tron", AVAX: "avalanche-2", LINK: "chainlink", POL: "polygon-ecosystem-token", EURC: "euro-coin", XLM: "stellar", AXS: "axie-infinity", ETHW: "ethereum-pow-iou", DAI: "dai", PAXG: "pax-gold", ATOM: "cosmos", MATIC: "matic-network" };
export const COIN_LIST = Object.keys(COINS);
const PRICE_KEY = "mc-prices";
let prices = null, loading = false;
const cache = () => prices || (prices = (() => { try { return JSON.parse(store.get(PRICE_KEY) || "null") || { at: 0, pln: {} }; } catch { return { at: 0, pln: {} }; } })());
/** Prices in złoty for the coins you hold (refreshed at most every 10 minutes). True when new prices arrived. */
export async function loadPrices(symbols, force = false) {
  const ids = [...new Set(symbols.map(s => COINS[s]).filter(Boolean))], c = cache();
  if (!ids.length || loading) return false;
  if (!force && Date.now() - c.at < 10 * 60000 && ids.every(id => c.pln[id] > 0)) return false;
  loading = true;
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=pln`, { signal: ctl.signal });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    for (const id of ids) if (j[id]?.pln > 0) c.pln[id] = j[id].pln;
    c.at = Date.now(); store.set(PRICE_KEY, JSON.stringify(c));
    return true;
  } catch { return false; } finally { loading = false; }
}
// Cash balances on a platform (Nexo: EURX, USDX) and plain currencies: priced with the NBP rates
const FIAT = { EURX: "EUR", USDX: "USD", EUR: "EUR", USD: "USD", PLN: "PLN" };
export const priceOf = sym => FIAT[sym] ? Calc.toPln(1, FIAT[sym], D().Settings) : (cache().pln[COINS[sym]] || 0);
export const hasPrice = sym => !!FIAT[sym] || !!COINS[sym];

// ---------------------------------------------------------------- one position
const pct = v => (v >= 0 ? "+" : "−") + (Math.round(Math.abs(v) * 100) / 100).toString().replace(".", ",") + "%";
const cur = p => p.Currency || "PLN";
const inPln = (v, p) => Calc.toPln(+v || 0, cur(p), D().Settings);
const coinsOf = p => (p.Assets || []).filter(x => +x.Amount > 0);
/** Value now: with coins and known prices, from the live prices; otherwise the amount you entered. */
export function positionValue(p) {
  const a = coinsOf(p);
  if (a.length && a.some(x => priceOf(x.Coin) > 0)) return a.reduce((s, x) => s + (priceOf(x.Coin) > 0 ? x.Amount * priceOf(x.Coin) : (+x.Cost || 0)), 0);
  return inPln(p.Value, p);
}
export function positionInvested(p) {
  const a = coinsOf(p);
  return a.length ? a.reduce((s, x) => s + (+x.Cost || 0), 0) : inPln(p.Invested, p);
}
function result(p) {
  const inv = positionInvested(p), val = positionValue(p);
  const ret = inv > 0 ? (val - inv) / inv * 100 : null;
  const h = p.History || [], prev = h.length >= 2 ? h[h.length - 2].Value : null;
  const trend = prev !== null ? (val > prev ? "up" : val < prev ? "down" : "flat") : (ret === null ? "flat" : ret > 0 ? "up" : ret < 0 ? "down" : "flat");
  return { inv, val, ret, gain: val - inv, trend, since: prev ? (val - prev) / prev * 100 : null };
}
const trendChip = t => t === "up" ? `<span class="trend up">▲ ${esc(T("Rising"))}</span>` : t === "down" ? `<span class="trend down">▼ ${esc(T("Falling"))}</span>` : `<span class="trend">■ ${esc(T("Unchanged"))}</span>`;
/** Remember today's value (one point per day), so the history line can be drawn. */
function notePoint(p) {
  const v = Math.round(positionValue(p) * 100) / 100, day = isoDate(today());
  if (!(v > 0)) return false;
  const h = p.History || (p.History = []), last = h[h.length - 1];
  if (last && last.Date === day) { if (last.Value === v) return false; last.Value = v; } else h.push({ Date: day, Value: v });
  if (h.length > 400) h.splice(0, h.length - 400);
  return true;
}
/** A small line of the value over time. */
function spark(points) {
  if (points.length < 2) return "";
  const w = 300, h = 60, vs = points.map(x => x.Value), min = Math.min(...vs), max = Math.max(...vs), span = max - min || 1;
  const xy = points.map((x, i) => [Math.round(i / (points.length - 1) * w), Math.round(h - 6 - (x.Value - min) / span * (h - 12))]);
  const line = "M" + xy.map(p => p.join(",")).join(" L");
  return `<svg class="inv-spark ${vs[vs.length - 1] >= vs[0] ? "up" : "down"}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img"><title>${esc(fmtDate(points[0].Date))}: ${esc(pln(vs[0]))} → ${esc(fmtDate(points[points.length - 1].Date))}: ${esc(pln(vs[vs.length - 1]))}</title>
    <path d="${line} L${w},${h} L0,${h} Z" class="fill"/><path d="${line}" class="line"/></svg>`;
}

export const Investments = {
  route: "investments", title: "Investments",
  render(el) {
    const d = D();
    if (!Array.isArray(d.Investments)) d.Investments = [];
    const pos = id => d.Investments.find(x => x.Broker === id);
    // Live prices for the coins you hold; when new ones arrive the page is drawn again
    const syms = d.Investments.flatMap(p => coinsOf(p).map(a => a.Coin));
    if (syms.length) loadPrices(syms).then(changed => { if (changed && document.body.contains(el)) { d.Investments.forEach(notePoint); save(); App.refresh(); } });

    const all = d.Investments.filter(p => positionValue(p) > 0 || positionInvested(p) > 0);
    const totInv = all.reduce((s, p) => s + positionInvested(p), 0), totVal = all.reduce((s, p) => s + positionValue(p), 0);
    const totRet = totInv > 0 ? (totVal - totInv) / totInv * 100 : null;
    const wealth = Calc.portfolio(d).total, share = wealth > 0 ? totVal / wealth * 100 : 0;
    const monthly = all.reduce((s, p) => s + inPln(p.Monthly, p), 0);
    // Value of all positions together per day (each position's last known value)
    const days = [...new Set(all.flatMap(p => (p.History || []).map(h => h.Date)))].sort();
    const totalHist = days.map(day => ({ Date: day, Value: all.reduce((s, p) => { const h = (p.History || []).filter(x => x.Date <= day); return s + (h.length ? h[h.length - 1].Value : 0); }, 0) }));
    const isCrypto = p => !!BROKERS.find(b => b.id === p.Broker)?.crypto || coinsOf(p).length > 0;
    const gainOf = list => list.reduce((s, p) => s + (positionValue(p) - positionInvested(p)), 0);
    const cryptoGain = gainOf(all.filter(isCrypto)), otherGain = gainOf(all.filter(p => !isCrypto(p)));
    const c = cache(), pricesLine = syms.length ? hint(c.at ? T("Crypto prices from CoinGecko, {0}.", new Date(c.at).toLocaleString(lang(), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })) : T("Crypto prices could not be loaded – the values you entered are used.")) : "";

    const assetRows = p => (p.Assets || []).map((a, i) => {
      const price = priceOf(a.Coin), val = price * a.Amount, avg = a.Amount > 0 && a.Cost > 0 ? a.Cost / a.Amount : 0;
      const r = a.Cost > 0 && price ? (val - a.Cost) / a.Cost * 100 : null;
      return `<div class="item inv-asset"><div><b>${esc(a.Coin)} · ${esc(String(a.Amount).replace(".", ","))}</b>
        <span class="hint">${esc(T("Average buying price {0}", avg ? pln(avg) : "–"))}${price ? " · " + esc(T("now {0}", pln(price))) : ""}</span></div>
        <div class="right"><b>${price ? pln(val) : "–"}</b>${r !== null ? `<span class="hint ${r >= 0 ? "in" : "out"}">${pct(r)}</span>` : ""}</div>
        <button class="icon-btn danger" data-del-asset="${p.Broker}:${i}" title="${esc(T("Delete"))}">🗑</button></div>`;
    }).join("");

    const brokerCard = b => {
      const p = pos(b.id) || { Currency: "PLN" }, r = result(p), has = r.inv > 0 || r.val > 0, coins = coinsOf(p).length > 0;
      return card(`<div class="inv-head"><h3>${esc(b.name)}</h3><span class="inv-kind">${esc(T(b.kind))}</span></div>
        ${b.alert ? `<div class="alert bad inv-alert"><b>⚠ ${esc(T("Important"))}</b><p>${esc(T(b.alert))}</p></div>` : ""}
        <p>${esc(T(b.about))}</p>
        <div class="facts">${b.facts.map(([k, v]) => `<span>${esc(T(k))}</span><div>${esc(T(v))}</div>`).join("")}</div>
        <p class="hint">${esc(T("Facts checked {0} – rates and conditions change, always check the current terms.", fmtDate(CHECKED)))}</p>
        <a class="btn second small" href="${b.url}" target="_blank" rel="noopener">${esc(T("Open the {0} website", b.name))} ↗</a>
        <hr><h3 class="sub-h">${esc(T("Your position"))}</h3>
        ${has ? `<div class="inv-result"><div><span>${esc(T("Return"))}</span><b class="${r.ret === null ? "" : r.ret >= 0 ? "in" : "out"}">${r.ret === null ? "–" : pct(r.ret)}</b></div>${trendChip(r.trend)}</div>` +
          spark(p.History || []) +
          row(T("Invested"), pln(r.inv)) + row(T("Current value"), pln(r.val)) +
          row(T("Profit / loss"), (r.gain >= 0 ? "+" : "−") + pln(Math.abs(r.gain)), r.gain >= 0 ? "in" : "out") +
          (r.since !== null ? row(T("Since your last update"), pct(r.since), r.since >= 0 ? "in" : "out") : "") +
          (+p.Monthly > 0 ? row(T("Regular investing"), T("{0} per month", pln(inPln(p.Monthly, p)))) : "") +
          (p.Import ? row(T("Interest and bonuses earned"), "+" + pln(p.Import.InterestPln), "in") + (p.Import.LoanInterestPln > 0 ? row(T("Interest paid on the credit line"), "−" + pln(p.Import.LoanInterestPln), "out") : "") + hint(T("Imported from {0} ({1} – {2}).", p.Import.File, fmtDate(p.Import.From), fmtDate(p.Import.To))) : "") +
          (p.Updated ? hint(T("Last updated {0}.", fmtDate(p.Updated))) : "")
          : hint(b.crypto ? T("Add your coins (e.g. BTC 0,05) – the value comes from live prices – or enter one total amount.") : T("Enter what you put in and what it is worth today – MoneyCompass shows your return."))}
        ${has ? "" : `<details class="inv-more inv-add"><summary>＋ ${esc(T("Add your position"))}</summary>`}
        ${b.crypto ? `<div class="list">${assetRows(p)}</div>
          <form class="inv-coin" data-broker="${b.id}"><div class="three">${field(T("Coin"), select("coin", COIN_LIST.map(x => [x, x]), "BTC"))}${field(T("Amount"), numInput("amount", "", T("e.g. {0}", "0,05")))}${field(T("Paid (zł)"), numInput("cost", "", T("e.g. {0}", "15000")))}</div>
          <div class="buttons">${button("＋ " + esc(T("Add coin")), "inv-coin-add", "second small")}</div></form>` : ""}
        <details class="inv-more"${(has && !coins) || (!has && !b.crypto) ? " open" : ""}><summary>${esc(coins ? T("Regular investing") : b.crypto ? T("Or enter one total amount") : T("Your amounts"))}</summary>
        <form class="inv-form" data-broker="${b.id}">
          ${coins ? "" : `<div class="two">${field(T("Invested (total paid in)"), numInput("invested", p.Invested ? plain(p.Invested) : "", T("e.g. {0}", "5000")))}
          ${field(T("Value today"), numInput("value", p.Value ? plain(p.Value) : "", T("e.g. {0}", "5400")))}</div>`}
          <div class="two">${field(T("Regular investing per month (optional)"), numInput("monthly", p.Monthly ? plain(p.Monthly) : "", T("e.g. {0}", "500")))}
          ${field(T("Currency"), select("currency", [["PLN", "PLN"], ["EUR", "EUR"], ["USD", "USD"]], cur(p)))}</div>
          <div class="two">${field(T("Yearly cost in % of the value (optional)"), numInput("fee", p.FeePercent ? plain(p.FeePercent) : "", T("e.g. {0}", "0,5")))}</div>
          <div class="buttons">${button(esc(has ? T("Update") : T("Save")), "inv-save", "main")}${has ? button(esc(T("Remove")), "inv-del", "second") : ""}</div>
        </form></details>${has ? "" : "</details>"}`, "inv-card");
    };

    const taxCard = () => {
      if (!all.length) return "";
      const tax = v => Math.max(0, v) * 0.19, sign = v => (v >= 0 ? "+" : "−") + pln(Math.abs(v));
      return card(heading(T("Tax (PIT-38) – estimate")) +
        `<p>${esc(T("In Poland, profit from crypto and from stocks is taxed at 19% when you sell. You report it in your PIT-38 by 30 April of the following year."))}</p>` +
        row(T("Crypto: profit if you sold everything today"), sign(cryptoGain), cryptoGain >= 0 ? "in" : "out") +
        (cryptoGain > 0 ? row(T("Tax on it (19%)"), "−" + pln(tax(cryptoGain)), "out") : "") +
        row(T("Stocks & ETFs: profit if you sold everything today"), sign(otherGain), otherGain >= 0 ? "in" : "out") +
        (otherGain > 0 ? row(T("Tax on it (19%)"), "−" + pln(tax(otherGain)), "out") : "") +
        `<ul class="inv-rules">${["Swapping one crypto for another is not taxed – only selling for money or paying with crypto.",
          "Report what you paid for crypto every year in your PIT-38, even without selling: unused costs carry over to later years.",
          "Crypto and stocks are counted separately: a crypto loss does not lower the tax on stock profits.",
          "Polish brokers send you a PIT-8C; with a foreign broker you work out the figures yourself.",
          "In an IKE no 19% tax is paid when you withdraw after 60."].map(x => `<li>${esc(T(x))}</li>`).join("")}</ul>` +
        hint(T("A simple estimate from your totals, not tax advice. Your real tax depends on your actual sales and costs – ask a tax advisor if unsure.")));
    };

    el.innerHTML = `<div class="tip warn-tip inv-beta">🚧 <b>${esc(T("In development"))}</b> – ${esc(T("This module is new and is still being built. Information only: it is not investment advice, and MoneyCompass takes no responsibility for your decisions or any losses. Crypto and trading can lose value quickly."))}</div>
    <div class="grid" data-key="investments">
      ${card(heading(T("Your investments")) + (all.length
        ? `<div class="inv-result big"><div><span>${esc(T("Total return"))}</span><b class="${totRet >= 0 ? "in" : "out"}">${totRet === null ? "–" : pct(totRet)}</b></div>${trendChip(totRet > 0 ? "up" : totRet < 0 ? "down" : "flat")}</div>` +
          spark(totalHist) +
          row(T("Invested"), pln(totInv)) + row(T("Current value"), pln(totVal), "strong") +
          row(T("Profit / loss"), (totVal - totInv >= 0 ? "+" : "−") + pln(Math.abs(totVal - totInv)), totVal - totInv >= 0 ? "in" : "out") +
          (monthly > 0 ? row(T("Regular investing"), T("{0} per month", pln(monthly))) + row(T("Paid in over the next 12 months"), pln(monthly * 12)) : "") +
          row(T("Share of your wealth"), Math.round(share) + "%", share > 20 ? "out" : "") +
          (share > 20 ? hint(T("More than a fifth of your money is in investments that can lose value. A common rule: only invest money you won't need for years, after a full emergency fund.")) : "") +
          pricesLine
        : hint(T("Add your position at a broker below to see your return."))) +
        hint(T("Your investments count as risky money in the Overview and in Savings. If you also entered the same money as a savings entry, delete it there, so it isn't counted twice.")))}
      ${taxCard()}
      ${BROKERS.map(brokerCard).join("")}
      ${card(heading(T("Import transactions (CSV)")) + `<span class="soon-tag">${esc(T("Preview"))}</span>` +
        `<p>${esc(T("Import the transaction history of your Nexo account: MoneyCompass works out your coins, the interest you earned and today's value – shows a preview first – and saves it as a savings account in Savings."))}</p>` +
        `<p class="hint">${esc(T("In Nexo: Transactions → Export (CSV). Planned next: Binance, Revolut, XTB, eToro and a general CSV format."))}</p>` +
        `<div class="buttons"><button class="btn main" data-inv-import>⬆ ${esc(T("Import CSV"))}</button></div>`)}
    </div>`;

    el.querySelector("[data-inv-import]")?.addEventListener("click", async () => (await import("./invest-import.js")).openInvestImport());
    const get = id => { let p = pos(id); if (!p) { p = { Id: uuid(), Broker: id, Currency: "PLN", History: [], Assets: [] }; d.Investments.push(p); } return p; };
    el.querySelectorAll(".inv-form").forEach(f => {
      const id = f.dataset.broker;
      f.querySelector('[data-action="inv-save"]').onclick = () => {
        const p0 = pos(id), coins = p0 ? coinsOf(p0).length > 0 : false;
        const inv = f.invested ? num(f.invested.value) : 0, val = f.value ? num(f.value.value) : 0, mon = num(f.monthly.value);
        if (!coins && !(inv > 0) && !(val > 0)) { toast(T("Please enter an amount bigger than 0."), "bad"); return; }
        const p = get(id);
        if (!coins) Object.assign(p, { Invested: inv || 0, Value: val || 0 });
        Object.assign(p, { Monthly: mon > 0 ? mon : 0, Currency: f.currency.value, FeePercent: f.fee ? Math.max(0, num(f.fee.value) || 0) : 0, Updated: isoDate(today()) });
        notePoint(p); save(); App.refresh(); toast(T("Saved."), "good");
      };
      const del = f.querySelector('[data-action="inv-del"]');
      if (del) del.onclick = async () => {
        if (!(await confirmBox(T("Remove this position?"), T("Your entries for {0} are deleted.", BROKERS.find(b => b.id === id)?.name || id), T("Remove"), T("Cancel")))) return;
        d.Investments = d.Investments.filter(x => x.Broker !== id); save(); App.refresh();
      };
    });
    el.querySelectorAll(".inv-coin").forEach(f => {
      f.querySelector('[data-action="inv-coin-add"]').onclick = async () => {
        const amount = num(f.amount.value), cost = num(f.cost.value);
        if (!(amount > 0)) { toast(T("Please enter an amount bigger than 0."), "bad"); return; }
        const p = get(f.dataset.broker);
        p.Assets = p.Assets || [];
        const same = p.Assets.find(a => a.Coin === f.coin.value);
        if (same) { same.Amount = Math.round((+same.Amount + amount) * 1e8) / 1e8; same.Cost = (+same.Cost || 0) + (cost || 0); }   // bought more: the average price follows
        else p.Assets.push({ Coin: f.coin.value, Amount: amount, Cost: cost || 0 });
        p.Currency = "PLN"; p.Updated = isoDate(today());
        await loadPrices(p.Assets.map(a => a.Coin), true);
        notePoint(p); save(); App.refresh(); toast(T("Saved."), "good");
      };
    });
    el.querySelectorAll("[data-del-asset]").forEach(b => b.onclick = async () => {
      const [id, i] = b.dataset.delAsset.split(":"), p = pos(id); if (!p) return;
      const a = p.Assets[+i];
      if (!(await confirmBox(T("Remove this position?"), `${a.Coin} · ${String(a.Amount).replace(".", ",")}`, T("Remove"), T("Cancel")))) return;
      p.Assets.splice(+i, 1); save(); App.refresh();
    });
  },
};

/** Value of all investments in złoty (counted as risky money in the totals). */
export const investmentsTotal = d => (d.Investments || []).reduce((s, p) => s + positionValue(p), 0);
Hooks.investmentsTotal = investmentsTotal;

/** For the Investment Advisor: the positions, their mix and the cost, worked out from the saved data. */
export function investFacts(d) {
  const list = (d.Investments || []).filter(p => positionValue(p) > 0 || positionInvested(p) > 0);
  const positions = list.map(p => { const b = BROKERS.find(x => x.id === p.Broker), value = positionValue(p), invested = positionInvested(p);
    return { name: b ? b.name : p.Broker, value, invested, ret: invested > 0 ? (value - invested) / invested : null, crypto: !!(b && b.crypto) || coinsOf(p).length > 0, monthly: inPln(p.Monthly, p), fee: +p.FeePercent || 0 }; });
  const total = positions.reduce((a, x) => a + x.value, 0), top = [...positions].sort((a, b) => b.value - a.value)[0];
  const wealth = Calc.portfolio(d).total;
  return { positions, count: positions.length, total, topName: top ? top.name : "", topShare: top && total > 0 ? top.value / total : 0,
    cryptoShare: total > 0 ? positions.filter(x => x.crypto).reduce((a, x) => a + x.value, 0) / total : 0, shareOfWealth: wealth > 0 ? total / wealth : 0, monthly: positions.reduce((a, x) => a + x.monthly, 0) };
}
