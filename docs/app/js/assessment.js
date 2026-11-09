// The Financial Assessment of the Overview: the banner (state, explanation, problem / opportunity / risk / if-you-do-nothing,
// potential improvement), the Wealth Score, the Next Actions and the advisor team – all built from the Financial State Engine.
import { T, pln, fmtDate, parseDate, today, monthsCount } from "./core.js";
import { esc } from "./ui.js";
import { ring } from "./page-head.js";
import { advise, opportunities, groupByAdvisor, ADVISORS } from "./engine/index.js";

/** The overall states (plus "start" when there is no data yet): colour, icon and name. */
export const STATES = {
  healthy:     { name: "Healthy",                  color: "#10B981", icon: "🟢" },
  stable:      { name: "Stable",                   color: "#14B8A6", icon: "🟦" },
  warning:     { name: "Warning",                  color: "#F59E0B", icon: "🟡" },
  critical:    { name: "Critical",                 color: "#EF4444", icon: "🔴" },
  debt:        { name: "Debt Risk",                color: "#F97316", icon: "🟠" },
  opportunity: { name: "Optimization Opportunity", color: "#22D3EE", icon: "💡" },
  start:       { name: "Getting started",          color: "#94A3B8", icon: "🌱" },
};
const pc = v => Math.round(v * 100) + "%";
/** "Source: bank offers (checked 03.11.2026) · your own entries": where a number comes from. Older than two weeks is marked. */
export function sourcesHtml(list) {
  const seen = new Set(), items = (list || []).filter(x => x && !seen.has(x.name) && seen.add(x.name));
  if (!items.length) return "";
  const part = x => {
    if (!x.date) return esc(x.name);
    let d = null, text = "";
    try { d = parseDate(String(x.date).slice(0, 10)); text = fmtDate(d); } catch { /* keep raw */ }
    const age = d && !isNaN(d) ? Math.floor((today() - d) / 86400000) : 0, old = age > 14;
    return `${esc(x.name)} (${esc(T("checked {0}", text || String(x.date)))}${old ? ` · <b class="src-old">⚠ ${esc(T("{0} days old, may be out of date", age))}</b>` : ""})`;
  };
  return `<small class="src">${esc(T("Source"))}: ${items.map(part).join(" · ")}</small>`;
}
/** Oldest age in days of the dated sources of a list of states (0 when none is dated). */
export function oldestSource(states) {
  let m = 0;
  for (const s of states) for (const x of s.sources || []) { if (!x || !x.date) continue; try { const d = parseDate(String(x.date).slice(0, 10)); if (!isNaN(d)) m = Math.max(m, Math.floor((today() - d) / 86400000)); } catch { /* skip */ } }
  return m;
}
export const staleHtml = days => days > 14 ? `<p class="stale">⚠ ${esc(T("Some rates and offers were last checked {0} days ago. The gains shown may have changed.", days))}</p>` : "";
const METHOD = () => ({
  financial: T("Compares your income, spending and savings from your own entries."),
  savings: T("Compares your accounts with current bank offers and the deposit guarantee."),
  debt: T("Compares loan payments with your income and your rates with offers on the market."),
  safety: T("Compares your safe money with your essential monthly costs."),
  tax: T("Applies the Polish tax and ZUS rules to your payroll numbers."),
  investment: T("Looks at the spread, risk and costs of your positions."),
  wealth: T("Tracks what you own minus what you owe, month by month."),
  goal: T("Compares what each goal needs per month with what you can set aside."),
  opportunity: T("Collects and ranks the ideas of all advisors."),
});
/** "Why this recommendation?": which advisor, how it worked it out, how sure it is and why, what is counted, where the data comes from. */
export function whyHtml(x, snap) {
  const A = ADVISORS[x.advisorType] || {}, pct = Math.round(x.confidence * 100), m = snap ? snap.months : 0;
  const level = x.confidence >= 0.8 ? T("High") : x.confidence >= 0.6 ? T("Medium") : T("Low");
  const why = m > 0 ? T("{0} confidence ({1}%): based on {2} of your own data.", level, pct, monthsCount(m)) : T("{0} confidence ({1}%): there is little data yet.", level, pct);
  const more = x.confidence < 0.8 ? " " + T("More months of data make it more certain.") : "";
  const counted = x.kind !== "opportunity" ? "" : x.potential > 0 ? T("Counted in your potential improvement: yes, because it is a gain we can measure.") : T("Counted in your potential improvement: no, because it is information, not a measurable gain.");
  const eff = x.minutes ? T("Effort: about {0}, risk {1}.", x.minutes >= 60 ? T("{0} h", Math.round(x.minutes / 60)) : T("{0} min", x.minutes), T({ low: "Low", medium: "Medium", high: "High" }[x.risk] || "Low").toLowerCase()) : "";
  return `<details class="why"><summary>${esc(T("Why this recommendation?"))}</summary><div class="why-b">
    <p><b>${esc(T(A.name || "Advisor"))}</b>: ${esc((METHOD()[x.advisorType] || ""))}</p><p>${esc(why + more)}</p>${counted ? `<p>${esc(counted)}</p>` : ""}${eff ? `<p>${esc(eff)}</p>` : ""}${sourcesHtml(x.sources)}</div></details>`;
}
const KIND_COLOR = { problem: "#F87171", risk: "#FBBF24", opportunity: "#22D3EE", positive: "#34D399" };

/** c: the raw figures of the page (see engine/snapshot.js). Returns everything the banner shows. */
/** The last result. Other pages ask for a fresh one with currentAssessment(): the Overview registers how to work it out. */
export let lastAssessment = null;
let source = null;
export const setAssessSource = f => { source = f; };
export function currentAssessment() { if (source) { try { source(); } catch (e) { console.warn("assessment failed", e); } } return lastAssessment; }
export function assess(c) {
  const r = advise(c), s = r.snap, st = r.status, P = r.primary;
  const lead = {
    debt: T("Debt is the most urgent topic."), critical: T("Your finances are in a critical state."), warning: T("Your finances need attention."),
    stable: T("You stand on a steady footing."), opportunity: T("Your finances are healthy and your money could work harder."), healthy: T("Your finances are in good shape."),
  }[st];
  const more = r.states.filter(x => x !== P && (x.kind === "problem" || x.kind === "risk")).slice(0, 2).map(x => x.text);
  const text = st === "start" ? T("Add your income and your spending (or import a bank statement) and MoneyCompass will tell you how you are doing, what your biggest problem is and what to do next.")
    : [lead, P ? P.text : "", ...more].filter(Boolean).join(" ");
  const bad = r.states.find(x => x.kind === "problem" || x.kind === "risk");
  const opp = opportunities(r)[0];
  const problem = !s.has ? T("Not enough data yet to find a problem.") : bad ? bad.text : T("No urgent problem. Keep your habits and review your numbers every month.");
  const win = opp ? opp.text : T("Nothing to improve right now. Keep saving.");
  let risk;
  if (!s.has) risk = T("Without numbers, risks stay invisible.");
  else if (s.neg) risk = T("Your savings shrink every month while spending is above income.");
  else if (s.dti > 0.2) risk = T("High loan payments leave little room if your income drops.");
  else if (!s.fullEF) risk = T("An unexpected bill or a lost job would go straight onto a loan or card.");
  else risk = T("No major risk visible. Keep the emergency fund full.");
  const doNothing = !s.has ? T("Nothing changes, and you stay without a clear picture.") : bad ? bad.doNothing : opp ? opp.doNothing : T("Nothing bad. Your situation stays as it is.");

  // next actions: the most urgent state first, one action per title, at most three
  const act = [], add = x => { if (x.title && !act.some(a => a.title === x.title || (a.go === x.go && a.btn === x.btn))) act.push(x); };
  if (!s.has) { add({ icon: "💶", title: T("Add your income"), desc: T("Your salary and other income."), btn: T("Open Inflows"), go: "income" }); add({ icon: "🛒", title: T("Add your spending"), desc: T("Enter or import your expenses."), btn: T("Open Outflows"), go: "expenses" }); add({ icon: "🏦", title: T("Add your savings"), desc: T("Bank accounts and cash, with their interest."), btn: T("Open Savings"), go: "portfolio" }); }
  else r.states.forEach(x => x.actions.forEach(add));
  lastAssessment = r;
  return { ...r, state: st, text, problem, win, risk, doNothing, actions: act.slice(0, 3), dti: s.dti };
}

/** The bands for the top of the Overview: assessment + wealth score, next actions, advisor team. */
export function assessmentHtml(a, wealth, wl, part = "all") {
  const S = STATES[a.state];
  const box = (ic, label, txt, cls) => `<div class="oa-box oa-b-${cls}"><span class="oa-bi">${ic}</span><div><small>${esc(label)}</small><p>${esc(txt)}</p></div></div>`;
  const act = a.actions.map((x, i) => `<div class="oa-act"><span class="oa-n">${i + 1}</span><span class="oa-ai">${x.icon}</span><div><b>${esc(x.title)}</b><p>${esc(x.desc)}</p></div>${x.go.startsWith("@") ? `<button class="sv-btn" data-action="${x.go.slice(1)}">${esc(x.btn)} →</button>` : `<button class="sv-btn" data-go="${x.go}">${esc(x.btn)} →</button>`}</div>`).join("");
  const pot = a.potential.total, has = a.snap.has;
  const potSrc = sourcesHtml(a.potential.counted.flatMap(x => x.sources));
  const stale = staleHtml(oldestSource(a.states));
  const potLine = stale + (has && pot > 0 ? `<div class="oa-pot"><span><small>${esc(T("Confidence"))}</small><b>${pc(a.confidence)}</b></span>${potSrc ? `<span class="oa-ps">${potSrc}</span>` : ""}</div>` : "");
  const sec = a.secondary.filter(x => x.kind !== "positive");
  const seenT = new Set(), uniq = a.states.filter(x => { if (x.kind === "positive" || seenT.has(x.title)) return false; seenT.add(x.title); return true; });
  const team = groupByAdvisor(uniq).map(g => `<div class="oa-adv"><div class="oa-ah"><span>${g.icon}</span><b>${esc(T(g.name))}</b></div>${g.list.map(x => `<button class="oa-st" data-go="${x.target.startsWith("@") ? g.route : x.target}" style="--k:${KIND_COLOR[x.kind]}"><i></i><span><b>${esc(x.title)}</b>${x.annualImpact > 0 && (x.kind !== "opportunity" || x.potential > 0) ? `<em>${esc(pln(x.annualImpact))} ${esc(T("per year"))}</em>` : ""}</span></button>`).join("")}</div>`).join("");
  const nextH = `<div class="nw-card oa-next"><div class="oa-top"><h3>${esc(T("Next Actions"))}</h3><small>${esc(T("In this order"))}</small></div>${act || `<p class="hint">${esc(T("No action needed right now."))}</p>`}</div>`;
  const teamH = sec.length || a.primary && a.primary.kind !== "positive" ? `<details class="nw-card oa-team"${uniq.length > 4 ? "" : " open"}><summary class="oa-top"><h3>${esc(T("Your advisors"))}</h3><small>${esc(uniq.length === 1 ? T("1 insight") : T("{0} insights", uniq.length))} · ${esc(T("Each advisor looks at its own part of your money"))}</small></summary><div class="oa-advs">${team}</div></details>` : "";
  if (part === "next") return `<div class="ov-solo" style="--st:${S.color}">${nextH}</div>`;
  if (part === "team") return teamH ? `<div class="ov-solo">${teamH}</div>` : "";
  return `<section class="ov-assess" style="--st:${S.color}">
    <div class="nw-card oa-main"><div class="oa-top"><span class="oa-badge">${S.icon} ${esc(T(S.name))}</span><h3>${esc(T("Financial Assessment"))}</h3>${a.primary && a.state !== "start" ? `<span class="oa-by">${esc(T("Led by"))} ${esc(T(groupByAdvisor([a.primary])[0].name))}</span>` : ""}</div>
      <p class="oa-text">${esc(a.text)}</p>
      ${a.state === "start" ? `<div class="oa-start"><button class="sv-btn" data-import-start>⬆ ${esc(T("Import a bank statement"))}</button><button class="sv-btn sec" data-demo>🧪 ${esc(T("Try the demo profile"))}</button><small>${esc(T("The demo is a separate profile with made-up numbers. Your own data is not touched."))}</small></div>` : ""}
      <div class="oa-boxes">${box("⚠️", T("Biggest problem"), a.problem, "bad")}${box("📈", T("Biggest opportunity"), a.win, "good")}${box("🛡️", T("Main risk"), a.risk, "warn")}${box("⏳", T("If you do nothing"), a.doNothing, "wait")}</div>
      ${potLine}
      <small class="oa-note">${esc(T("General information based on your own numbers. It is not personal financial advice."))} <button class="oa-tour" data-tour>${esc(T("Take the tour"))}</button></small></div>
    <div class="nw-card oa-score" data-go="portfolio"><small>${esc(T("Wealth Score"))}</small>${a.state === "start" ? ring(0, "–", "/100", 132) : ring(wealth, String(wealth), "/100", 132)}<b>${esc(a.state === "start" ? T("Add your data") : wl)}</b></div>
  </section>`;
}

/** The panel at the top of an advisor's page: that advisor's states with what happens if you do nothing and what to do. */
export function advisorPanelHtml(type) {
  const r = currentAssessment(), A = ADVISORS[type];
  if (!r || !A || !r.snap.has) return "";
  const list = (r.byAdvisor[type] || []).filter(x => x.kind !== "positive" || true);
  const worth = list.filter(x => x.kind !== "positive");
  const pot = list.reduce((m, x) => x.potential > 0 ? m + x.potential : m, 0);
  const row = x => { const b = x.actions[0];
    return `<div class="ap-row"><i style="background:${KIND_COLOR[x.kind]}"></i><div class="ap-t"><b>${esc(x.title)}</b>${x.annualImpact > 0 && (x.kind !== "opportunity" || x.potential > 0) ? `<em>${esc(pln(x.annualImpact))} ${esc(T("per year"))}</em>` : ""}<p>${esc(x.text)}</p>${x.doNothing && x.kind !== "positive" ? `<p class="ap-dn">⏳ ${esc(x.doNothing)}</p>` : ""}${x.kind !== "positive" ? whyHtml(x, r.snap) : ""}</div>
      ${b ? (b.go.startsWith("@") ? `<button class="sv-btn" data-action="${b.go.slice(1)}">${esc(b.btn)} →</button>` : `<button class="sv-btn" data-go="${b.go}">${esc(b.btn)} →</button>`) : ""}</div>`; };
  return `<section class="nw-card adv-panel"><div class="ap-h"><span class="ap-ic">${A.icon}</span><div><h3>${esc(T(A.name))}</h3><small>${worth.length ? esc(worth.length === 1 ? T("1 insight") : T("{0} insights", worth.length)) + (pot > 0 ? " · " + esc(T("potential {0} per year", pln(pot))) : "") : esc(T("Nothing to report"))}</small></div><button class="sv-btn ap-oc" data-go="optcenter">${esc(T("Optimization Center"))} →</button></div>
    ${list.length ? list.slice(0, 5).map(row).join("") : `<p class="hint ap-ok">✓ ${esc(T("Your {0} found nothing that needs attention.", T(A.name)))}</p>`}</section>`;
}
