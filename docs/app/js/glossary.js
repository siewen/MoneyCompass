// Plain-language explanations: a small ⓘ is added next to money terms wherever they appear as a heading or label.
import { T } from "./core.js";
import { esc, popup } from "./ui.js";
import { ico } from "./nw.js";

// term shown on screen (English) → [what it is, why it matters, rule of thumb]
const G = {
  "Emergency Fund": ["Money kept aside, in a safe and easily reachable account, for surprises: losing your job, a car repair, a medical bill.", "Without it, one bad month can push you into debt.", "Aim for 3–6 months of your essential costs (rent, food, bills, loan payments)."],
  "My Savings": ["Everything you have put aside: savings accounts, deposits, bonds, cash.", "Savings that sit in a low-interest account lose value to inflation.", "Keep the money you may need soon in an easy-access account; put long-term money where it earns more."],
  "Your Savings": ["Everything you have put aside: savings accounts, deposits, bonds, cash.", "Savings that sit in a low-interest account lose value to inflation.", "Keep the money you may need soon in an easy-access account; put long-term money where it earns more."],
  "Savings Rate": ["The part of your income you keep instead of spending.", "It is the best single sign of how fast your money grows.", "At least 20% is good. 10–20% is fine to start, under 10% is tight."],
  "Net Worth": ["Everything you own (savings, investments) minus everything you owe (loans, debts).", "It shows your real financial position, not just your account balance.", "What matters is the direction: it should grow from month to month."],
  "Budget Plan": ["A plan for how much you allow yourself to spend per category each month.", "You see early when a category runs over, not after the month is gone.", "A common rule: 50% needs, 30% wants, 20% saving (the 50/30/20 rule)."],
  "Debt Position": ["How much you still owe in loans, cards and other debts.", "Debt costs interest every month and reduces what you can save.", "Pay off the most expensive debt (highest interest) first."],
  "Loans & Debts": ["Your loans, credit cards and instalments, with the remaining amount, rate and monthly payment.", "Knowing the interest still to pay shows whether paying early or refinancing is worth it.", "A monthly debt payment above about 35% of income is a warning sign."],
  "Monthly Surplus": ["What is left each month after all your spending: income minus expenses.", "This is the money you can save, invest or use to pay debt faster.", "A steady positive surplus is the base of every plan."],
  "Wealth Score": ["A MoneyCompass estimate (0–100) of how solid your finances are, from your emergency fund, savings rate, debts and where your money is kept.", "It gives you one number to improve over time.", "Tap its ⓘ to see how your own numbers add up."],
  "Compare Offers": ["Current savings account and deposit offers from banks, calculated for your amount.", "Banks pay very different rates for the same money. Moving it can mean hundreds of zł a year.", "Promotions often last only a few months, so check the conditions."],
  "Promotional Rate": ["The higher interest a bank pays for a limited time, usually for new customers or new money.", "After the promotion the rate usually drops a lot.", "Check how long it lasts and the limit."],
  "Effective Annual Yield": ["What you really earn over a full year after the promotion ends, as a percentage.", "It is more honest than the headline promo rate.", "Compare this figure, not only the promotion."],
  "Expected Profit": ["The interest you would get on your amount over the chosen period, after the 19% Belka tax.", "It tells you what the offer is worth in złoty, not only in percent.", "Simple estimate: banks may pay monthly, so the real result can be slightly higher."],
  "Risk Rating": ["How safe the money is. Polish bank deposits are guaranteed by the BFG up to €100,000 per bank.", "A higher rate is not worth it if the money can be lost.", "A means very low risk."],
  "Belka tax": ["The 19% tax Poland takes from interest on savings and deposits. The bank deducts it for you.", "Every rate you see is higher than what you actually keep.", "MoneyCompass shows results after this tax."],
  "Savings goals": ["Something you save for, with an amount and a date: a holiday, a car, a deposit for a flat.", "A clear goal and a monthly amount make saving much easier to keep up.", "Set up a standing order on payday for the monthly amount."],
  "Regular Payments": ["Bills and payments that repeat: rent, subscriptions, loan instalments, salary.", "MoneyCompass uses them to show your future cash flow and warn you before money runs short.", "Check once a year which subscriptions you no longer use."],
  "Cashflow Forecast": ["A forecast of your account balance in the coming weeks, from your income and regular payments.", "It shows in advance when money may run out.", "If the line goes below zero, move a payment or build a buffer."],
  "Optimization Score": ["How well your own finances are set up, 0–100. It falls when the plan finds more things to improve.", "It is about you, not about one bank's offer.", "Tap its ⓘ to see the parts."],
  "Income Health Score": ["A MoneyCompass estimate of how stable and sufficient your income is for your costs.", "Several income sources and a high surplus make you more secure.", "Tap its ⓘ to see the parts."],
  "Financial Health Overview": ["Your most important figures on one screen: net worth, surplus, emergency fund, debt and savings rate.", "A quick check of whether you are on track.", "Click any figure to open the page behind it."]
};

export function glossBtn(term) {
  return G[term] ? `<button type="button" class="si-i gl-i" data-gloss="${esc(term)}" aria-label="${esc(T("What is this?"))}" title="${esc(T("What is this?"))}">i</button>` : "";
}
function open(term) {
  const g = G[term]; if (!g) return;
  const row = (h, t) => `<div class="gl-r"><b>${esc(T(h))}</b><p>${esc(T(t))}</p></div>`;
  popup(`<div class="nw-hd"><span class="nw-hi">${ico("info")}</span><div><h2>${esc(T(term))}</h2><p class="nw-sub">${esc(T("What is this?"))}</p></div><button class="nw-x" data-close aria-label="Close">✕</button></div>
    <div class="sc-body gl-body">${row("What it is", g[0])}${row("Why it matters", g[1])}${row("Rule of thumb", g[2])}</div>
    <div class="nw-ft"><span></span><button class="btn main" data-close>${esc(T("Close"))}</button></div>`, { width: 520, cls: "nw-win sc-win" });
}
function decorate(root = document.body) {
  const names = new Map(Object.keys(G).map(k => [T(k).trim().toLowerCase(), k]));
  root.querySelectorAll("h2,h3,.kpi-t > span,.kpi-t small,.rp-st h3,.ov-lbl,th,.hl-lbl").forEach(el => {
    if (el.closest(".nw-hd, .sc-win, .dz .nw-ch") || el.querySelector(".si-i") || el.closest(".si-i") || el.children.length > 1) return;
    const k = names.get((el.textContent || "").trim().toLowerCase()); if (!k) return;
    if (el.parentElement?.querySelector(":scope > .si-i, :scope > * > .si-i")) return;
    el.insertAdjacentHTML("beforeend", " " + glossBtn(k));
  });
}
if (!window.__gloss) {
  window.__gloss = true;
  document.addEventListener("click", e => {
    const b = e.target.closest?.("[data-gloss]"); if (!b) return;
    e.preventDefault(); e.stopPropagation(); open(b.dataset.gloss);
  }, true);
  let t = 0;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => { try { decorate(); } catch {} }, 120); }).observe(document.body, { childList: true, subtree: true });
}
