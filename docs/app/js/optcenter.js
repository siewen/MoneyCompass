// Optimization Center: the opportunities of every advisor in one place, ranked. It tells you WHAT to do;
// Compare Offers (the marketplace) helps you do it.
import { T, pln } from "./core.js";
import { esc } from "./ui.js";
import { currentAssessment } from "./assessment.js";
import { improvements, rankScore, groupByAdvisor, potentialOf } from "./engine/index.js";

const pc = v => Math.round(v * 100) + "%";
const LVL = { low: "Low", medium: "Medium", high: "High", easy: "Easy", hard: "Hard" };
const mins = m => m < 60 ? T("{0} min", m) : T("{0} h", Math.round(m / 6) / 10);


export const OptCenter = {
  route: "optcenter", title: "Optimization Center",
  render(el) {
    const r = currentAssessment();
    if (!r || !r.snap.has) {
      el.innerHTML = `<div class="ox"><div class="nw-card ox-empty"><h3>💡 ${esc(T("Optimization Center"))}</h3><p>${esc(T("Add your income, spending and savings first. Then every advisor looks for ways to earn or save more, and this page ranks them for you."))}</p><button class="sv-btn" data-go="income">${esc(T("Open Inflows"))} →</button></div></div>`;
      return;
    }
    const list = improvements(r), counted = new Set(potentialOf(r.states).counted.map(s => s.id));
    const total = potentialOf(r.states).total, quick = list.filter(s => s.difficulty === "easy").reduce((a, s) => a + (counted.has(s.id) ? s.potential : 0), 0);
    const avgConf = list.length ? list.reduce((a, s) => a + s.confidence, 0) / list.length : 0;
    const card = (s, i) => { const x = s.actions[0], by = groupByAdvisor([s])[0];
      return `<article class="nw-card ox-card${counted.has(s.id) || s.potential <= 0 ? "" : " ox-alt"}"><div class="ox-rk">${i + 1}</div>
        <div class="ox-body"><div class="ox-t"><span class="ox-adv">${by.icon} ${esc(T(by.name))}</span><h4>${esc(s.title)}</h4></div><p>${esc(s.text)}</p>
          <div class="ox-m"><span><small>${esc(T("Impact"))}</small><b>${s.impactScore}/100</b></span><span><small>${esc(T("Confidence"))}</small><b>${pc(s.confidence)}</b></span><span><small>${esc(T("Risk"))}</small><b>${esc(T(LVL[s.risk]))}</b></span><span><small>${esc(T("Difficulty"))}</small><b>${esc(T(LVL[s.difficulty]))}</b></span><span><small>${esc(T("Time"))}</small><b>${esc(mins(s.minutes))}</b></span></div>
          ${s.doNothing ? `<p class="ox-dn">⏳ ${esc(s.doNothing)}</p>` : ""}${counted.has(s.id) || s.potential <= 0 ? "" : `<p class="ox-dn">${esc(T("Uses the same money as a better option above, so it is not added to the total."))}</p>`}</div>
        <div class="ox-side"><small>${esc(s.potential > 0 ? T("Potential gain") : T("No yearly gain counted"))}</small><b>${s.potential > 0 ? esc(pln(s.potential)) : "–"}</b><i>${esc(s.potential > 0 ? T("per year") : T("insight"))}</i>${x ? (x.go.startsWith("@") ? `<button class="sv-btn" data-action="${x.go.slice(1)}">${esc(x.btn)} →</button>` : `<button class="sv-btn" data-go="${x.go}">${esc(x.btn)} →</button>`) : ""}</div></article>`; };
    const body = list.length ? `<div data-ox="rank">${list.map(card).join("")}</div>
      <div data-ox="adv" hidden>${groupByAdvisor(list).map(g => `<h3 class="ox-gh">${g.icon} ${esc(T(g.name))}</h3>${g.list.map(card.bind(null)).map((h, k) => h).join("")}`).join("")}</div>`
      : `<div class="nw-card ox-empty"><p>${esc(T("Nothing to optimise right now. Your advisors found no opportunity. Check again after your next month of data."))}</p></div>`;
    el.innerHTML = `<div class="ox"><div class="ox-head"><span class="ox-logo">💡</span><div><h2>${esc(T("Optimization Center"))}</h2><p>${esc(T("The Opportunity Advisor collects the ideas of all your advisors and ranks them by gain, certainty, effort and risk."))}</p></div></div>
      <div class="ox-kpis"><div class="nw-card"><small>${esc(T("Potential improvement"))}</small><b class="good">${esc(pln(total))}</b><i>${esc(T("per year"))}</i></div>
        <div class="nw-card"><small>${esc(T("Opportunities"))}</small><b>${list.length}</b><i>${esc(T("found"))}</i></div>
        <div class="nw-card"><small>${esc(T("Quick wins"))}</small><b>${esc(pln(quick))}</b><i>${esc(T("easy, per year"))}</i></div>
        <div class="nw-card"><small>${esc(T("Average confidence"))}</small><b>${pc(avgConf)}</b><i>${esc(T("based on your data"))}</i></div></div>
      ${list.length ? `<div class="ox-tabs"><button class="on" data-oxv="rank">${esc(T("Ranked"))}</button><button data-oxv="adv">${esc(T("By advisor"))}</button></div>` : ""}
      ${body}<small class="oa-note">${esc(T("General information based on your own numbers. It is not personal financial advice. Gains are estimates."))}</small></div>`;
    el.querySelectorAll("[data-oxv]").forEach(b => b.onclick = () => {
      el.querySelectorAll("[data-oxv]").forEach(x => x.classList.toggle("on", x === b));
      el.querySelectorAll("[data-ox]").forEach(p => { p.hidden = p.dataset.ox !== b.dataset.oxv; });
    });
  },
};
