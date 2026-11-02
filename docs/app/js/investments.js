// Module "Investments" (Pro, in development): crypto platforms and brokers – one card per broker with what it is,
// the key facts, a link, and YOUR position: how much you put in, what it is worth now and the return in %.
// Information only: no advice, no responsibility for decisions or losses.
import { T, State, save, Calc, pln, num, plain, fmtDate, isoDate, today, parseDate, uuid } from "./core.js";
import { esc, card, heading, hint, row, field, numInput, select, button, toast, confirmBox } from "./ui.js";
import { App } from "./app.js";

const D = () => State.data;
export const CHECKED = "2026-11-02";   // when the broker facts below were last checked

/** The brokers and platforms we describe. Facts change – each card says when they were checked. */
export const BROKERS = [
  { id: "nexo", name: "Nexo", kind: "Crypto platform", url: "https://nexo.com",
    about: "Crypto platform: buy and hold crypto, earn interest on it (Earn), borrow against it (crypto-backed credit line) and pay with the Nexo card. Interest is paid daily; fixed terms pay more than flexible savings.",
    facts: [
      ["Earn – interest (up to)", "BTC 5,5% · ETH 6% · USDC 10,5% · USDT 11,5% · NEXO token 9%"],
      ["Good to know", "The highest rates usually need a fixed term or a higher loyalty tier (holding NEXO tokens). Rates change often and depend on your country."],
      ["In the EU", "Served through two MiCA-licensed partners: Tangany (custody) and DLT Finance (brokerage). Lending is not covered by these licences."],
      ["Risk", "High: crypto prices can fall sharply, and there is no state guarantee (no BFG) if the platform fails."],
    ] },
];

const pct = v => (v >= 0 ? "+" : "−") + (Math.round(Math.abs(v) * 100) / 100).toString().replace(".", ",") + "%";
const toPln = p => Calc.toPln(+p.Value || 0, p.Currency || "PLN", D().Settings);
const investedPln = p => Calc.toPln(+p.Invested || 0, p.Currency || "PLN", D().Settings);
/** Return of a position: value against what was put in, and the trend since the update before. */
function result(p) {
  const inv = +p.Invested || 0, val = +p.Value || 0;
  const ret = inv > 0 ? (val - inv) / inv * 100 : null;
  const h = p.History || [], prev = h.length >= 2 ? h[h.length - 2].Value : null;
  const trend = prev !== null ? (val > prev ? "up" : val < prev ? "down" : "flat") : (ret === null ? "flat" : ret > 0 ? "up" : ret < 0 ? "down" : "flat");
  return { inv, val, ret, gain: val - inv, trend, since: prev !== null ? (val - prev) / (prev || 1) * 100 : null };
}
const trendChip = t => t === "up" ? `<span class="trend up">▲ ${esc(T("Rising"))}</span>` : t === "down" ? `<span class="trend down">▼ ${esc(T("Falling"))}</span>` : `<span class="trend">■ ${esc(T("Unchanged"))}</span>`;

export const Investments = {
  route: "investments", title: "Investments",
  render(el) {
    const d = D();
    if (!Array.isArray(d.Investments)) d.Investments = [];
    const pos = id => d.Investments.find(x => x.Broker === id);
    const all = d.Investments.filter(x => +x.Invested > 0 || +x.Value > 0);
    const totInv = all.reduce((s, p) => s + investedPln(p), 0), totVal = all.reduce((s, p) => s + toPln(p), 0);
    const totRet = totInv > 0 ? (totVal - totInv) / totInv * 100 : null;
    const wealth = Calc.portfolio(d).total + totVal, share = wealth > 0 ? totVal / wealth * 100 : 0;

    const brokerCard = b => {
      const p = pos(b.id) || { Currency: "PLN" }, r = result(p), has = +p.Invested > 0 || +p.Value > 0;
      return card(`<div class="inv-head"><h3>${esc(b.name)}</h3><span class="inv-kind">${esc(T(b.kind))}</span></div>
        <p>${esc(T(b.about))}</p>
        <div class="facts">${b.facts.map(([k, v]) => `<span>${esc(T(k))}</span><div>${esc(T(v))}</div>`).join("")}</div>
        <p class="hint">${esc(T("Facts checked {0} on the provider's website – rates and conditions change, always check the current terms.", fmtDate(CHECKED)))}</p>
        <a class="btn second small" href="${b.url}" target="_blank" rel="noopener">${esc(T("Open the {0} website", b.name))} ↗</a>
        <hr><h3 class="sub-h">${esc(T("Your position"))}</h3>
        ${has ? `<div class="inv-result"><div><span>${esc(T("Return"))}</span><b class="${r.ret === null ? "" : r.ret >= 0 ? "in" : "out"}">${r.ret === null ? "–" : pct(r.ret)}</b></div>${trendChip(r.trend)}</div>` +
          row(T("Invested"), pln(investedPln(p))) + row(T("Current value"), pln(toPln(p))) +
          row(T("Profit / loss"), (r.gain >= 0 ? "+" : "−") + pln(Math.abs(Calc.toPln(r.gain, p.Currency || "PLN", d.Settings))), r.gain >= 0 ? "in" : "out") +
          (r.since !== null ? row(T("Since your last update"), pct(r.since), r.since >= 0 ? "in" : "out") : "") +
          (p.Updated ? hint(T("Last updated {0}.", fmtDate(p.Updated))) : "") : hint(T("Enter what you put in and what it is worth today – MoneyCompass shows your return."))}
        <form class="inv-form" data-broker="${b.id}">
          <div class="two">${field(T("Invested (total paid in)"), numInput("invested", p.Invested ? plain(p.Invested) : "", T("e.g. {0}", "5000")))}
          ${field(T("Value today"), numInput("value", p.Value ? plain(p.Value) : "", T("e.g. {0}", "5400")))}</div>
          <div class="two">${field(T("Currency"), select("currency", [["PLN", "PLN"], ["EUR", "EUR"], ["USD", "USD"]], p.Currency || "PLN"))}
          <div class="buttons" style="align-self:end">${button(has ? T("Update") : T("Save"), "inv-save", "main")}${has ? button(T("Remove"), "inv-del", "second") : ""}</div></div>
        </form>`, "inv-card");
    };

    el.innerHTML = `<div class="tip warn-tip inv-beta">🚧 <b>${esc(T("In development"))}</b> – ${esc(T("This module is new and is still being built. Information only: it is not investment advice, and MoneyCompass takes no responsibility for your decisions or any losses. Crypto and trading can lose value quickly."))}</div>
    <div class="grid" data-key="investments">
      ${card(heading(T("Your investments")) + (all.length
        ? `<div class="inv-result big"><div><span>${esc(T("Total return"))}</span><b class="${totRet >= 0 ? "in" : "out"}">${totRet === null ? "–" : pct(totRet)}</b></div>${trendChip(totRet > 0 ? "up" : totRet < 0 ? "down" : "flat")}</div>` +
          row(T("Invested"), pln(totInv)) + row(T("Current value"), pln(totVal), "strong") +
          row(T("Profit / loss"), (totVal - totInv >= 0 ? "+" : "−") + pln(Math.abs(totVal - totInv)), totVal - totInv >= 0 ? "in" : "out") +
          row(T("Share of your wealth"), Math.round(share) + "%", share > 20 ? "out" : "") +
          (share > 20 ? hint(T("More than a fifth of your money is in investments that can lose value. A common rule: only invest money you won't need for years, after a full emergency fund.")) : "")
        : hint(T("Add your position at a broker below to see your return."))) + hint(T("Values in other currencies are converted to złoty with the NBP rates.")))}
      ${BROKERS.map(brokerCard).join("")}
      ${card(heading(T("Import transactions (CSV)")) + `<span class="soon-tag">${esc(T("In preparation"))}</span>` +
        `<p>${esc(T("Soon you can import the transaction history from your crypto or trading account: deposits, purchases, interest and fees – and MoneyCompass works out your return by itself."))}</p>` +
        `<p class="hint">${esc(T("Planned: Nexo, Binance, Revolut, XTB, eToro and a general CSV format."))}</p>`)}
    </div>`;

    el.querySelectorAll(".inv-form").forEach(f => {
      const id = f.dataset.broker;
      f.querySelector('[data-action="inv-save"]').onclick = () => {
        const inv = num(f.invested.value), val = num(f.value.value);
        if (!(inv > 0) && !(val > 0)) { toast(T("Please enter an amount bigger than 0."), "bad"); return; }
        let p = d.Investments.find(x => x.Broker === id);
        if (!p) { p = { Id: uuid(), Broker: id, History: [] }; d.Investments.push(p); }
        Object.assign(p, { Invested: inv || 0, Value: val || 0, Currency: f.currency.value, Updated: isoDate(today()) });
        p.History = (p.History || []).filter(h => h.Date !== p.Updated).concat([{ Date: p.Updated, Value: p.Value }]).slice(-120);
        save(); App.refresh(); toast(T("Saved."), "good");
      };
      const del = f.querySelector('[data-action="inv-del"]');
      if (del) del.onclick = async () => {
        if (!(await confirmBox(T("Remove this position?"), T("Your entries for {0} are deleted.", BROKERS.find(b => b.id === id)?.name || id), T("Remove"), T("Cancel")))) return;
        d.Investments = d.Investments.filter(x => x.Broker !== id); save(); App.refresh();
      };
    });
  },
};
