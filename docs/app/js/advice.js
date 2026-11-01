// "Where should my savings go?" and promotion reminders.
// Compares what each savings entry earns now with today's best bank offers (from rates.json),
// and warns before a promotion ends – after that most banks pay only about 0.5%.
import { T, State, save, Calc, pln, rate, fmtDate, isoDate, today, addDays, uuid, license, promo, currentRate, duePromos } from "./core.js";
import { esc, card, heading, hint, popup, confirmBox, toast } from "./ui.js";
import { App } from "./app.js";
import { Rates } from "./rates.js";

const TAX = 0.81;   // 19% Belka tax

/** For one savings entry: the offer that would bring the most extra interest, after tax. */
function bestMove(d, h) {
  const amount = Calc.toPln(h.Amount, h.Currency, d.Settings);
  if (!(amount > 0) || !h.Safe || h.Currency !== "PLN") return null;
  const p = promo(h);
  const now = currentRate(h), after = p && !p.ended && p.rateAfter !== null && p.rateAfter !== "" ? +p.rateAfter || 0 : now;
  const offers = [...Rates.savings.map(o => ({ o, kind: "savings" })), ...Rates.deposits.map(o => ({ o, kind: "deposit" }))];
  let best = null;
  for (const { o, kind } of offers) {
    if (!(o.Rate > 0)) continue;
    const days = Math.min(Math.max(o.Days || 365, 30), 365);
    const moved = o.MaxAmount > 0 ? Math.min(amount, o.MaxAmount) : amount;
    // What the moved money would earn where it is now, over the same days (the promo may end on the way)
    const left = p && !p.ended ? Math.max(0, Math.min(days, p.daysLeft)) : 0;
    const stay = moved * (now * left + after * (days - left)) / 100 / 365 * TAX;
    const go = moved * o.Rate * days / 100 / 365 * TAX;
    const gain = go - stay;
    if (!best || gain > best.gain) best = { h, o, kind, days, moved, gain, go, stay, now, after, promoEnd: p && !p.ended ? p.end : null };
  }
  return best && best.gain >= 10 ? best : null;
}
export function moves(d) {
  return d.Holdings.map(h => bestMove(d, h)).filter(Boolean).sort((a, b) => b.gain - a.gain);
}

const offerName = o => `${o.Bank}${o.Name ? " – " + o.Name : ""}`;

/** The badge in the My savings list: "🎁 6% until 23.02.2027 · 12 days left". */
export function promoBadge(h) {
  const p = promo(h);
  if (!p) return "";
  const cls = p.ended ? "bad" : p.daysLeft <= 14 ? "warn" : "primary";
  const text = p.ended ? T("Promotion ended {0} – now {1}", fmtDate(p.end), rate(currentRate(h)))
    : T("{0} until {1} · {2} days left", rate(+h.RatePercent || 0), fmtDate(p.end), p.daysLeft);
  return `<span class="hint ${cls}">🎁 ${esc(text)}</span>`;
}

/** The card in My savings (and the tip on the Overview). */
export function adviceCard(d) {
  const all = moves(d);
  const due = duePromos(d);
  const checked = String(Rates.checked).slice(0, 10);
  let body = "";
  if (due.length) body += due.map(({ h, p }) => `<p class="${p.ended ? "bad" : "warn"} promo-alert"><b>⏰ ${esc(p.ended
      ? T("The promotion at {0} ended on {1}.", h.Name, fmtDate(p.end))
      : T("The promotion at {0} ends on {1} – in {2} days.", h.Name, fmtDate(p.end), p.daysLeft))}</b></p>`).join("");
  if (!all.length) {
    body += hint(d.Holdings.some(h => h.Safe && h.Amount > 0)
      ? T("Your savings already earn about as much as today's best offers. Nothing to move right now.")
      : T("Add your savings (bank, cash) above, with their interest rate, to see where they would earn more."));
  } else {
    const shown = license.isPro ? all : all.slice(0, 1);
    body += `<div class="list">${shown.map((m, i) => `<div class="item move${i === 0 ? " best" : ""}">
      <div><b>${esc(T("Move {0} from {1}", pln(m.moved), m.h.Name))}</b>
        <span class="hint">${esc(T("to {0}", offerName(m.o)))} · ${rate(m.o.Rate)} ${esc(m.promoEnd ? T("instead of {0} (then {1})", rate(m.now), rate(m.after)) : T("instead of {0}", rate(m.now)))} · ${esc(T("{0} days", m.days))}${m.o.MaxAmount > 0 ? " · " + esc(T("up to {0}", pln(m.o.MaxAmount))) : ""}</span>
        ${m.promoEnd ? `<span class="hint warn">⏰ ${esc(T("Best moved when your promotion ends on {0}.", fmtDate(m.promoEnd)))}</span>` : ""}</div>
      <div class="right"><b class="good">+${pln(m.gain)}</b><span class="hint">${esc(T("more after tax"))}</span></div>
      <div class="row-actions"><a class="btn second small" href="${esc(Rates.link(m.o))}" target="_blank" rel="noopener">${esc(T("Open offer"))}</a>
        <button class="btn go small" data-moved="${i}">✔ ${esc(T("I moved it"))}</button></div></div>`).join("")}</div>`;
    if (!license.isPro && all.length > 1) body += `<p class="hint">🔒 ${esc(T("{0} more suggestions for your other savings with MoneyCompass Pro.", all.length - 1))}</p>`;
    body += hint(T("Promotions are usually for new money and need a personal account in that bank and some card payments – check the bank's terms. Offers checked {0}. This is a calculation, not financial advice.", fmtDate(checked)));
  }
  return card(heading(T("Where should my savings go?"), "🧭") + body, "wide advice-card");
}

export function bindAdvice(el, d) {
  const all = moves(d), shown = license.isPro ? all : all.slice(0, 1);
  el.querySelectorAll("[data-moved]").forEach(b => b.onclick = () => movedIt(shown[+b.dataset.moved]));
}

/** "I moved it": a new savings entry for the offer – with the promotion end date, so MoneyCompass reminds you in time. */
async function movedIt(m) {
  const d = State.data;
  const end = addDays(today(), m.days);
  if (!(await confirmBox(T("Moved to {0}?", m.o.Bank), T("MoneyCompass then:\n• takes {0} from \"{1}\"\n• adds \"{2}\" with {3} until {4}\n• reminds you 2 weeks before the promotion ends.", pln(m.moved), m.h.Name, m.o.Bank, rate(m.o.Rate), fmtDate(end)), T("Yes, update Savings"), T("Cancel")))) return;
  m.h.Amount = Math.round((m.h.Amount - m.moved) * 100) / 100;
  d.Holdings.push({ Id: uuid(), Name: m.o.Bank, Place: "Bank", Amount: m.moved, Currency: "PLN", RatePercent: m.o.Rate, Safe: true, PromoEnd: isoDate(end), RateAfter: null });
  if (m.h.Amount <= 0) d.Holdings = d.Holdings.filter(x => x !== m.h);
  save(); toast(T("Updated: {0}.", m.o.Bank)); App.refresh();
}

/** On start: one box when a promotion ends soon (once a day, "Remind me tomorrow" or "Don't remind me again"). */
export function promoReminder() {
  const d = State.data, todayIso = isoDate(today());
  const due = duePromos(d).filter(x => x.h.PromoSnooze !== todayIso && x.h.PromoDone !== x.h.PromoEnd);
  if (!due.length) return false;
  const { h, p } = due[0];
  const m = bestMove(d, h);
  const box = popup(`<div class="box-head"><span class="box-icon warn">⏰</span><h2>${esc(p.ended ? T("Your promotion has ended") : T("Your promotion ends soon"))}</h2></div>
    <p><b>${esc(p.ended ? T("{0}: the {1} ended on {2}.", h.Name, rate(+h.RatePercent || 0), fmtDate(p.end)) : T("{0}: the {1} ends on {2} – in {3} days.", h.Name, rate(+h.RatePercent || 0), fmtDate(p.end), p.daysLeft))}</b></p>
    <p class="hint">${esc(h.RateAfter !== null && h.RateAfter !== undefined && h.RateAfter !== "" ? T("After that it pays {0}.", rate(+h.RateAfter)) : T("After a promotion most banks pay only about 0.5%."))}</p>
    ${m ? `<p class="good"><b>${esc(T("Best offer now: {0}, {1} → about {2} more after tax in {3} days.", offerName(m.o), rate(m.o.Rate), pln(m.gain), m.days))}</b></p>` : ""}
    <div class="box-buttons"><button class="btn go" data-r="show">🧭 ${esc(T("Show me where to move it"))}</button>
      <button class="btn second" data-r="later">${esc(T("Remind me tomorrow"))}</button>
      <button class="btn second" data-r="done">${esc(T("Don't remind me again"))}</button></div>`, { width: 480, cls: "box" });
  box.el.querySelectorAll("[data-r]").forEach(b => b.onclick = () => {
    if (b.dataset.r === "later") h.PromoSnooze = todayIso;
    if (b.dataset.r === "done") h.PromoDone = h.PromoEnd;
    save(); box.close();
    if (b.dataset.r === "show") App.go("portfolio");
  });
  return true;
}
