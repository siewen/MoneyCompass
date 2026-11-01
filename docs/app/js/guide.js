// The step-by-step guide for new users. Opens by itself until all steps are done (or "Don't show again"),
// and any time from the ? menu → Guide.
import { T, State, save, license } from "./core.js";
import { esc, popup } from "./ui.js";
import { App } from "./app.js";
import { languageChips, setLanguage } from "./dialogs.js";

const STEPS = [
  { route: "income", color: "#1D4ED8", title: "Inflows", text: "Inflows: add your salary and any other money that comes in, with its payday.",
    done: d => d.Incomes.length > 0 || d.Received.length > 0, import: true },
  { route: "expenses", color: "#C2410C", title: "Outflows", text: "Outflows: write down what you spend, or enter your usual monthly bills once.",
    done: d => d.Expenses.length > 0, import: true },
  { route: "emergency", color: "#B45309", title: "Emergency fund", text: "Emergency fund: enter your essential monthly costs to see how much to keep aside.",
    done: d => d.Settings.MonthlyEssentials > 0 },
  { route: "portfolio", color: "#15803D", title: "My savings", text: "My savings: add your bank accounts, cash and other savings with their interest rate.",
    done: d => d.Holdings.length > 0 },
  { route: "overview", color: "#0F766E", title: "Overview", text: "Overview: see everything together, then press \"Optimize my finances\" for your personal plan.",
    done: d => STEPS.slice(0, 4).every(s => s.done(d)), optimize: true },
  { route: null, color: "#7E22CE", title: "Backup & app", text: "Save your profile as a backup, and install MoneyCompass as an app on your phone or computer.",
    done: d => !!d.Settings.LastProfileSaved, backup: true },
];
let current = 0;

export const allDone = () => STEPS.every(s => s.done(State.data));
export const shouldShowGuide = () => !State.data.Settings.GuideHidden && !allDone();

export function openGuide(step) {
  hideBar();
  const d = State.data;
  current = step ?? Math.max(0, STEPS.findIndex(s => !s.done(d)));
  const p = popup("", { width: 760, cls: "guide-popup" });
  const draw = () => {
    const s = STEPS[current];
    const doneCount = STEPS.filter(x => x.done(d)).length;
    p.el.innerHTML = `
      <div class="guide-head"><div class="guide-lang"><h2>🧭 ${esc(T("Getting started"))}</h2>${languageChips()}</div>
        <p class="hint">${esc(T("Follow these steps – or jump to any of them. You can open this guide again with the ? button."))}</p>
        <div class="progress"><span style="width:${doneCount / STEPS.length * 100}%;background:#15803D"></span></div></div>
      <div class="guide-steps">${STEPS.map((x, i) => `
        <button class="guide-step${i === current ? " on" : ""}${x.done(d) ? " done" : ""}${i % 2 ? " low" : ""}" data-step="${i}" style="--c:${x.color}">
          <span class="ring"><span class="circle"><small>${esc(T("Step"))}</small><b>${x.done(d) ? "✔" : i + 1}</b></span></span>
          <span class="label">${esc(T(x.title))}</span></button>`).join("")}</div>
      <div class="guide-detail" style="--c:${s.color}">
        <div class="guide-num">${current + 1}</div>
        <div class="guide-body"><h3>${esc(T(s.title))}${s.done(d) ? ` <span class="done-tag">✔ ${esc(T("Done"))}</span>` : ""}</h3>
          <p>${esc(T(s.text))}</p>
          <div class="buttons">
            ${s.route ? `<button class="btn main" data-g="go">${esc(T("Go to {0} →", T(s.title)))}</button>` : ""}
            ${s.import ? `<button class="btn second" data-g="import">⬆ ${esc(T("Import bank statement (CSV)…"))}${license.isPro ? "" : " 🔒"}</button>` : ""}
            ${s.optimize ? `<button class="btn go" data-g="optimize">⚡ ${esc(T("Optimize my finances"))}</button>` : ""}
            ${s.backup ? `<button class="btn main" data-g="save">💾 ${esc(T("Save profile"))}</button><button class="btn second" data-g="install">📲 ${esc(T("Install app"))}</button>` : ""}
          </div></div></div>
      <div class="guide-foot">
        <label class="check"><input type="checkbox" name="hide"${d.Settings.GuideHidden ? " checked" : ""}><span>${esc(T("Don't show the guide again"))}</span></label>
        <div class="buttons">
          ${current > 0 ? `<button class="btn second" data-g="back">← ${esc(T("Back"))}</button>` : ""}
          ${current < STEPS.length - 1 ? `<button class="btn second" data-g="next">${esc(T("Next step"))} →</button>` : ""}
          <button class="btn second" data-close>${esc(T("Close"))}</button></div></div>`;
    p.el.querySelectorAll("[data-step]").forEach(b => b.onclick = () => { current = +b.dataset.step; draw(); });
    p.el.querySelectorAll("[data-lang]").forEach(b => b.onclick = () => { setLanguage(b.dataset.lang); draw(); });
    p.el.querySelector('[name="hide"]').onchange = e => { d.Settings.GuideHidden = e.target.checked; save(); };
    const act = (k, fn) => { const b = p.el.querySelector(`[data-g="${k}"]`); if (b) b.onclick = fn; };
    act("back", () => { current--; draw(); });
    act("next", () => { current++; draw(); });
    act("go", () => { p.close(); App.go(s.route); showBar(); });
    act("import", () => { p.close(); App.go(s.route); showBar(); App.openBankImport(); });
    act("optimize", () => { p.close(); App.openOptimize(); });
    act("save", () => { App.saveProfile(); draw(); });
    act("install", () => { p.close(); App.install(); });
  };
  draw();
}

// While the user follows a step: a small bar at the bottom with "Next step"
function showBar() {
  hideBar();
  const s = STEPS[current];
  const bar = document.createElement("div");
  bar.className = "guide-bar";
  bar.style.setProperty("--c", s.color);
  bar.innerHTML = `<span class="dot">${current + 1}</span><span>${esc(T("Step {0} of {1}", current + 1, STEPS.length))}: <b>${esc(T(s.title))}</b></span>
    <button class="btn main small" data-b="next">${esc(current < STEPS.length - 1 ? T("Next step") : T("Guide"))} →</button>
    <button class="icon-btn" data-b="close" title="${esc(T("Close"))}">✕</button>`;
  document.body.appendChild(bar);
  requestAnimationFrame(() => bar.classList.add("open"));
  bar.querySelector('[data-b="next"]').onclick = () => openGuide(Math.min(current + 1, STEPS.length - 1));
  bar.querySelector('[data-b="close"]').onclick = hideBar;
}
function hideBar() { document.querySelectorAll(".guide-bar").forEach(b => b.remove()); }
