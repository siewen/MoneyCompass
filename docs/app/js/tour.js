// First-run tour: four short steps that explain the Financial Assessment, the advisors, the Optimization Center and the Wealth Score.
import { State, save, T } from "./core.js";
import { esc, popup } from "./ui.js";

const STEPS = () => [
  { ic: "🧭", h: T("Your Financial Assessment"), p: T("The top of the Overview tells you in one look how you are doing: your biggest problem, your biggest opportunity, your main risk and what happens if you do nothing."), go: "overview" },
  { ic: "👥", h: T("A team of advisors"), p: T("Savings, debt, safety, tax, investment, wealth and goal advisors each watch their own part of your money. Every advice says why, how sure it is and where the numbers come from."), go: "overview" },
  { ic: "💡", h: T("The Optimization Center"), p: T("All opportunities in one list, ranked by gain, certainty, effort and risk. Only gains we can measure are added up, and they are estimates."), go: "optcenter" },
  { ic: "💎", h: T("Your Wealth Score"), p: T("A score from 0 to 100 from three things: your emergency fund, your savings rate and your debt. Tap the info icon next to it to see every point."), go: "overview" },
];

export const shouldTour = () => !State.data.Settings.TourDone && !State.data.Settings.GuideHidden;

export function openTour(onDone, goTo) {
  const steps = STEPS(); let i = 0;
  const pp = popup("", { width: 460, cls: "tour-win", onClose: () => { State.data.Settings.TourDone = true; save(); onDone && onDone(); } });
  const draw = () => {
    const s = steps[i], last = i === steps.length - 1;
    pp.el.innerHTML = `<div class="tour"><div class="tour-ic">${s.ic}</div><h3>${esc(s.h)}</h3><p>${esc(s.p)}</p>
      <div class="tour-dots">${steps.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
      <div class="tour-btns">${i ? `<button class="sv-btn sec" data-b="back">← ${esc(T("Back"))}</button>` : `<button class="sv-btn sec" data-b="skip">${esc(T("Skip"))}</button>`}<button class="sv-btn" data-b="next">${esc(last ? T("Start") : T("Next"))} →</button></div>
      <small>${i + 1} / ${steps.length}</small></div>`;
    pp.el.querySelector('[data-b="next"]').onclick = () => { if (last) pp.close(); else { i++; draw(); } };
    (pp.el.querySelector('[data-b="back"]') || {}).onclick = () => { i--; draw(); };
    (pp.el.querySelector('[data-b="skip"]') || {}).onclick = () => pp.close();
  };
  draw();
}
