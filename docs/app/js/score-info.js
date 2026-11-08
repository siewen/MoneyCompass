// "How is this calculated?" – a small ⓘ button next to a score and a popup showing the parts and the user's own numbers.
import { T } from "./core.js";
import { esc, popup } from "./ui.js";
import { ico } from "./nw.js";

/** parts: [{ label, points, max, detail }] (points/max optional for pass/fail lists: state "good|warn|bad"). */
export function infoBtn(title, total, parts, note = "") {
  const data = encodeURIComponent(JSON.stringify({ title, total, parts, note }));
  return `<button type="button" class="si-i" data-score-info="${data}" aria-label="${esc(T("How is this calculated?"))}" title="${esc(T("How is this calculated?"))}">i</button>`;
}
function open(o) {
  const rows = o.parts.map(p => {
    const pct = p.max ? Math.round(Math.max(0, Math.min(1, p.points / p.max)) * 100) : null;
    return `<div class="sc-row"><div class="sc-t"><b>${esc(p.label)}</b>${p.max ? `<span>${Math.round(p.points)} / ${p.max}</span>` : p.state ? `<span class="sc-${p.state}">${p.state === "good" ? "✓" : p.state === "warn" ? "!" : "✗"}</span>` : ""}</div>
      ${pct !== null ? `<div class="sc-bar"><i style="width:${pct}%"></i></div>` : ""}<small>${esc(p.detail || "")}</small></div>`;
  }).join("");
  popup(`<div class="nw-hd"><span class="nw-hi">${ico("info")}</span><div><h2>${esc(o.title)}</h2><p class="nw-sub">${esc(T("How is this calculated?"))}</p></div><button class="nw-x" data-close aria-label="Close">✕</button></div>
    <div class="sc-body"><div class="sc-total"><b>${esc(String(o.total))}</b><small>${esc(T("Your score"))}</small></div>${rows}
    <p class="hint">${esc(o.note || T("A MoneyCompass estimate based on the numbers you entered. It is not financial advice."))}</p></div>
    <div class="nw-ft"><span></span><button class="btn main" data-close>${esc(T("Close"))}</button></div>`, { width: 560, cls: "nw-win sc-win" });
}
if (!window.__scoreInfo) {
  window.__scoreInfo = true;
  document.addEventListener("click", e => {
    const b = e.target.closest?.("[data-score-info]"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    try { open(JSON.parse(decodeURIComponent(b.dataset.scoreInfo))); } catch {}
  }, true);
}
