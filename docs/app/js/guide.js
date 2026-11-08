// The "Getting started" guide: a step list on the left, the chosen step on the right with a quick form
// (fill it in right here), a live checklist and the other ways to do it (import, go to the tab).
// Opens by itself until all steps are done (or "Don't show again"), and any time from the profile menu (your name → Guide).
import { T, State, save, license, pln, num, uuid, isoDate, today, mainCur, categories, categoryLabel, OTHER, Calc } from "./core.js";
import { esc, popup, toast, field, numInput, textInput, select } from "./ui.js";
import { App } from "./app.js";
import { ico } from "./nw.js";
import { languageChips, setLanguage } from "./dialogs.js";

const D = () => State.data;
const lock = () => license.isPro ? "" : " 🔒";
const income = d => d.Incomes.length > 0 || d.Received.length > 0;

const STEPS = [
  { key: "in", route: "income", color: "#1D4ED8", icon: "💰", title: "Inflows",
    why: "Everything starts with what comes in: your salary and any other income.",
    text: "Inflows: add your salary and any other money that comes in, with its payday – or import your bank statement: MoneyCompass finds the salary and other inflows by itself.",
    done: income,
    form: () => `<div class="two">${field(T("Net salary per month"), numInput("amount", "", "6500"))}${field(T("Payday (day of the month)"), numInput("day", "10"))}</div>`,
    save: v => {
      const amt = num(v.amount), day = Math.min(28, Math.max(1, Math.round(num(v.day) || 10)));
      if (!(amt > 0)) return { err: T("Please enter an amount bigger than 0.") };
      const t = today(), next = new Date(t.getFullYear(), t.getMonth() + (t.getDate() > day ? 1 : 0), day);
      D().Incomes.push({ Id: uuid(), Name: T("Salary"), Type: "Salary", Amount: amt, Currency: mainCur(), Frequency: "Monthly", Date: isoDate(next), Active: true });
      return T("Salary added: {0} on day {1} of each month.", pln(amt), day);
    },
    checks: d => [[d.Incomes.length > 0, d.Incomes.length ? T("{0} income sources", d.Incomes.length) : T("No income source yet")],
      [d.Received.length > 0, d.Received.length ? T("{0} payments received imported", d.Received.length) : T("No bank statement imported yet")]],
    actions: [["import-all", "⬆ " + "Import bank statement (CSV)…", true], ["import-in", "↓ " + "Income only", true]] },
  { key: "out", route: "expenses", color: "#C2410C", icon: "🧾", title: "Outflows",
    why: "Your spending shows where the money goes – and where it can be saved.",
    text: "Outflows: import your current account statement (CSV) – one Import button, or drop the file on the page – or write down what you spend. Then sort what landed in \"Other\" by shop in one go.",
    done: d => d.Expenses.length > 0,
    form: () => `<div class="three">${field(T("What"), textInput("desc", "", T("e.g. Rent")))}${field(T("Amount"), numInput("amount", "", "2400"))}${field(T("Category"),
      select("cat", categories().map(c => [c.Name, categoryLabel(c.Name)]), "Housing / rent"))}</div>`,
    save: v => {
      const amt = num(v.amount);
      if (!(amt > 0)) return { err: T("Please enter an amount bigger than 0.") };
      const c = categories().find(x => x.Name === v.cat);
      D().Expenses.push({ Id: uuid(), Date: isoDate(today()), Description: (v.desc || "").trim() || T(v.cat || OTHER), Category: v.cat || OTHER, Amount: amt, Essential: !!c?.Essential, Repeat: "" });
      return T("Added: {0}.", `${(v.desc || "").trim() || T(v.cat)} · ${pln(amt)}`);
    },
    checks: d => { const n = d.Expenses.length, sorted = d.Expenses.filter(e => e.Category !== OTHER).length;
      return [[n > 0, n ? T("{0} expenses", n) : T("No expenses yet")], [n > 0 && sorted === n, n ? T("{0}% sorted into categories", Math.round(sorted / n * 100)) : T("Sorted into categories")]]; },
    actions: [["import-all", "⬆ " + "Import bank statement (CSV)…", true], ["import-out", "↑ " + "Expenses only", true]] },
  { key: "em", route: "emergency", color: "#B45309", icon: "🛟", title: "Emergency fund",
    why: "A reserve for the unexpected: a broken car or a lost job should not end on a credit card.",
    text: "Emergency fund: enter your essential monthly costs to see how much to keep aside.",
    done: d => d.Settings.MonthlyEssentials > 0,
    form: d => `<div class="two">${field(T("Essential costs per month (rent, bills, food, transport)"), numInput("ess", d.Settings.MonthlyEssentials || "", "4000"))}${field(T("Months to cover"),
      select("months", [3, 4, 5, 6].map(m => [m, T("{0} months", m)]), d.Settings.EmergencyMonths || 3))}</div>`,
    save: v => {
      const ess = num(v.ess); if (!(ess > 0)) return { err: T("Please enter an amount bigger than 0.") };
      Object.assign(D().Settings, { MonthlyEssentials: ess, EmergencyMonths: +v.months || 3 });
      return T("Your emergency fund target: {0}.", pln(Calc.emergency(D().Settings).target));
    },
    checks: d => { const e = Calc.emergency(d.Settings), p = Calc.portfolio(d);
      return [[d.Settings.MonthlyEssentials > 0, d.Settings.MonthlyEssentials > 0 ? T("Target: {0}", pln(e.target)) : T("Target not set yet")],
        [e.target > 0 && p.safe >= e.target, e.target > 0 ? T("{0}% covered by safe savings", Math.min(100, Math.round(p.safe / e.target * 100))) : T("Covered by safe savings")]]; },
    actions: [] },
  { key: "sav", route: "portfolio", color: "#15803D", icon: "🏦", title: "Savings",
    why: "See all your savings in one place, with the interest they really earn.",
    text: "Savings: add your bank accounts, cash and other savings with their interest rate. Import the statement of a savings account to see its real rate after tax and fees, and its balance month by month.",
    done: d => d.Holdings.length > 0,
    form: () => `<div class="three">${field(T("Account"), textInput("name", "", T("e.g. ING, Revolut, …")))}${field(T("Balance"), numInput("amount", "", "10000"))}${field(T("Interest rate (% per year)"), numInput("rate", "", "5"))}</div>`,
    save: v => {
      const amt = num(v.amount); if (!(amt > 0)) return { err: T("Please enter an amount bigger than 0.") };
      const name = (v.name || "").trim() || T("Savings account");
      D().Holdings.push({ Id: uuid(), Name: name, Place: "Bank", Amount: amt, Currency: mainCur(), RatePercent: num(v.rate) || 0, Safe: true });
      return T("Added: {0}.", `${name} · ${pln(amt)}`);
    },
    checks: d => { const p = Calc.portfolio(d);
      return [[d.Holdings.length > 0, d.Holdings.length ? T("{0} accounts · {1}", d.Holdings.length, pln(p.total)) : T("No savings account yet")],
        [(d.SavingsChecks || []).length > 0, (d.SavingsChecks || []).length ? T("{0} statements analysed", d.SavingsChecks.length) : T("No savings statement imported yet")]]; },
    actions: [["import-sav", "🏦 " + "Import savings account statement", true]] },
  { key: "ov", route: "overview", color: "#0F766E", icon: "🧭", title: "Overview",
    why: "Everything together – and a personal plan with concrete tips.",
    text: "Overview: see everything together, then press \"Optimize my finances\" for your health check and personal plan with concrete tips. Reports (Excel, PDF, Word) are in the Reports tab.",
    done: d => STEPS.slice(0, 4).every(s => s.done(d)),
    checks: d => STEPS.slice(0, 4).map(s => [s.done(d), T(s.title)]),
    actions: [["optimize", "⚡ " + "Optimize my finances", false]] },
  { key: "safe", route: null, color: "#7E22CE", icon: "🔒", title: "Protect your data",
    why: "Your data stays on this device only – protect it and keep a backup.",
    text: "Protect your data: set a PIN or fingerprint/face unlock in your profile, and turn on the automatic encrypted backup (Settings). Install MoneyCompass as an app on your phone or computer.",
    done: d => !!d.Settings.LastProfileSaved || !!d.Settings.PinHash,
    checks: d => [[!!d.Settings.PinHash, T("PIN or fingerprint/face unlock")], [!!d.Settings.LastProfileSaved, T("Profile saved (encrypted backup)")]],
    actions: [["profile", "🔑 " + "PIN & fingerprint", true], ["options", "💾 " + "Automatic backup", true], ["install", "📲 " + "Install as an app", false]] },
];
let current = 0;

export const allDone = () => STEPS.every(s => s.done(State.data));
export const shouldShowGuide = () => !State.data.Settings.GuideHidden && !allDone();

/** A ring that fills with the steps done. */
function ring(done, total) {
  const r = 26, c = 2 * Math.PI * r, f = done / total;
  return `<svg class="g2-ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="bg"/><circle cx="32" cy="32" r="${r}" class="fg" stroke-dasharray="${c * f} ${c}"/></svg>
    <span class="g2-ring-text"><b>${done}/${total}</b></span>`;
}

export function openGuide(step) {
  hideBar();
  const d = D();
  current = step ?? Math.max(0, STEPS.findIndex(s => !s.done(d)));
  const p = popup("", { width: 1100, cls: "guide-popup g2 nw-win nw-gd" });
  let flash = "";   // the message after a quick form was saved
  const draw = () => {
    const s = STEPS[current], doneCount = STEPS.filter(x => x.done(d)).length, finished = doneCount === STEPS.length;
    const checks = s.checks ? s.checks(d) : [];
    p.el.innerHTML = `
      <div class="nw-hd"><span class="nw-hi">${ico("rocket")}</span><h2>${esc(T("Interactive Onboarding"))}</h2><button class="nw-x" data-close aria-label="Close">✕</button></div>
      <div class="g2-head nw-gh">
        <div class="g2-progress">${ring(doneCount, STEPS.length)}</div>
        <div class="g2-title"><h2>${esc(finished ? T("All set – MoneyCompass knows enough to give you a full picture.") : T("Complete these {0} steps to set up MoneyCompass and build your financial overview.", STEPS.length))}</h2>
          <div class="nw-seg">${STEPS.map(x => `<i class="${x.done(d) ? "on" : ""}"></i>`).join("")}</div></div></div>
      <div class="g2-main">
        <nav class="g2-nav">${STEPS.map((x, i) => `<button class="g2-step${i === current ? " on" : ""}${x.done(d) ? " done" : ""}" data-step="${i}" style="--c:${x.color}">
          <span class="g2-dot">${x.done(d) ? "✓" : i + 1}</span><span class="g2-step-text"><b>${esc(T(x.title))}</b><small>${esc(x.done(d) ? T("Done") : i === current ? T("Now") : T("To do"))}</small></span></button>`).join("")}</nav>
        <section class="g2-panel" style="--c:${s.color}">
          <div class="g2-panel-head"><span class="g2-icon">${s.icon}</span><div><small>${esc(T("Step {0} of {1}", current + 1, STEPS.length))}</small>
            <h3>${esc(T(s.title))}${s.done(d) ? ` <span class="done-tag">✓ ${esc(T("Done"))}</span>` : ""}</h3></div></div>
          <p class="g2-why">${esc(T(s.why))}</p>
          ${flash ? `<p class="g2-flash">✓ ${esc(flash)}</p>` : ""}
          ${s.form ? `<form class="g2-form"><h4>${esc(T("Quick start – fill it in here"))}</h4>${s.form(d)}<div class="buttons"><button class="btn main" data-g="save">${esc(T("Save"))}</button></div></form>` : ""}
          ${checks.length ? `<ul class="g2-checks">${checks.map(([ok, l]) => `<li class="${ok ? "ok" : ""}"><span>${ok ? "✓" : "○"}</span>${esc(l)}</li>`).join("")}</ul>` : ""}
          <div class="g2-more">${s.actions.length ? `<span class="hint">${esc(s.form ? T("Or:") : T("Next:"))}</span>` : ""}
            ${s.actions.map(([k, l, pro]) => `<button class="btn ${s.form ? "second" : "main"}" data-g="${k}">${esc(l.replace(/^(\S+ )(.*)$/, (_, a, b) => a + T(b)))}${pro ? lock() : ""}</button>`).join("")}
            ${s.route ? `<button class="btn link-btn" data-g="go">${esc(T("Open {0}", T(s.title)))} →</button>` : ""}</div>
          <details class="g2-detail"><summary>${esc(T("More about this step"))}</summary><p>${esc(T(s.text))}</p></details>
        </section></div>
      <div class="g2-foot">
        <span class="nw-fsh">${ico("shield", "big")}</span><small class="nw-fnote">${esc(T("Your data is secure and will never be shared with third parties."))}</small>
        <label class="check"><input type="checkbox" name="hide"${d.Settings.GuideHidden ? " checked" : ""}><span>${esc(T("Don't show the guide again"))}</span></label>
        <div class="buttons">
          ${current > 0 ? `<button class="btn second" data-g="back">← ${esc(T("Back"))}</button>` : ""}
          ${current < STEPS.length - 1 ? `<button class="btn main" data-g="next">${esc(T("Next step"))} →</button>` : `<button class="btn main" data-close>${esc(T("Finish"))}</button>`}
          ${current < STEPS.length - 1 ? `<button class="btn second" data-close>${esc(T("Close"))}</button>` : ""}</div></div>`;
    p.el.querySelector(".g2-step.on")?.scrollIntoView({ block: "nearest", inline: "center" });
    p.el.querySelectorAll("[data-step]").forEach(b => b.onclick = () => { current = +b.dataset.step; flash = ""; draw(); });
    p.el.querySelectorAll("[data-lang]").forEach(b => b.onclick = () => { setLanguage(b.dataset.lang); draw(); });
    p.el.querySelector('[name="hide"]').onchange = e => { d.Settings.GuideHidden = e.target.checked; save(); };
    const form = p.el.querySelector(".g2-form");
    if (form) form.onsubmit = e => { e.preventDefault(); p.el.querySelector('[data-g="save"]').click(); };
    const act = (k, fn) => { const b = p.el.querySelector(`[data-g="${k}"]`); if (b) b.onclick = e => { e.preventDefault(); fn(); }; };
    const leave = (route, then) => async () => { p.close(); if (route) App.go(route); if (route) showBar(); if (then) then(); };
    act("save", () => {
      const v = {}; form.querySelectorAll("[name]").forEach(el => v[el.name] = el.value);
      const wasDone = s.done(d), msg = s.save(v);
      if (msg?.err) { toast(msg.err, "bad"); return; }
      save(); App.refresh(); toast(msg, "good"); flash = msg;
      if (!wasDone) { const next = STEPS.findIndex(x => !x.done(d)); if (next > current) { current = next; flash = msg; } }
      draw();
    });
    act("back", () => { current--; flash = ""; draw(); });
    act("next", () => { current++; flash = ""; draw(); });
    act("go", leave(s.route));
    act("import-all", leave(s.route, async () => (await import("./pages-pro.js")).openBankImport(null, "all")));
    act("import-in", leave("income", async () => (await import("./pages-pro.js")).openBankImport(null, "in")));
    act("import-out", leave("expenses", async () => (await import("./pages-pro.js")).openBankImport(null, "out")));
    act("import-sav", leave("portfolio", async () => (await import("./savings-check.js")).openSavingsCheck()));
    act("optimize", () => { p.close(); App.openOptimize(); });
    act("profile", () => { p.close(); App.openProfile(); });
    act("options", () => { p.close(); App.openOptions(); });
    act("install", () => { p.close(); App.install(); });
  };
  draw();
}

// While the user follows a step in a tab: a small bar at the bottom with "Next step"
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
