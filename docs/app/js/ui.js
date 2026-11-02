// Small UI helpers: escaping, cards, fields, pop-up windows, messages.
import { T, State, save } from "./core.js";

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const card = (inner, cls = "") => `<section class="card ${cls}">${inner}</section>`;
export const heading = (text, icon = "") => `<h3>${icon ? `<span class="h-icon">${icon}</span>` : ""}${esc(text)}</h3>`;
export const hint = (text, cls = "") => `<p class="hint ${cls}">${esc(text)}</p>`;
export const row = (label, value, cls = "") => `<div class="row ${cls}"><span>${esc(label)}</span><b>${value}</b></div>`;

export function field(label, input, cls = "") { return `<label class="field ${cls}"><span>${esc(label)}</span>${input}</label>`; }
export const textInput = (name, value = "", placeholder = "", attrs = "") =>
  `<input name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${attrs}>`;
export const numInput = (name, value = "", placeholder = "") =>
  `<input name="${name}" inputmode="decimal" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off">`;
export const dateInput = (name, value) => `<input type="date" name="${name}" value="${value}">`;
export function select(name, options, selected) {
  return `<select name="${name}">${options.map(o => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}"${String(v) === String(selected) ? " selected" : ""}>${esc(l)}</option>`;
  }).join("")}</select>`;
}
export const check = (name, label, on) => `<label class="check"><input type="checkbox" name="${name}"${on ? " checked" : ""}><span>${esc(label)}</span></label>`;
export const button = (text, action, cls = "second", extra = "") => `<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${text}</button>`;

/** Form values by name. */
export function values(root) {
  const v = {};
  root.querySelectorAll("input[name],select[name],textarea[name]").forEach(el => {
    v[el.name] = el.type === "checkbox" ? el.checked : el.value;
  });
  return v;
}

// ---------------------------------------------------------------- pop-up windows (same pop style as the app)

const stack = [];
export function popup(html, { width = 560, onClose, cls = "", anchor = "" } = {}) {
  const back = document.createElement("div");
  back.className = "popup-back" + (anchor ? " anchor-" + anchor : "");
  back.innerHTML = `<div class="popup ${cls}" role="dialog" aria-modal="true" style="max-width:${width}px">${html}</div>`;
  document.body.appendChild(back);
  const box = back.firstElementChild;
  requestAnimationFrame(() => back.classList.add("open"));
  const api = {
    el: box,
    close(result) {
      if (api.closed) return;
      api.closed = true;
      back.classList.remove("open"); back.classList.add("closing");
      setTimeout(() => back.remove(), 180);
      const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
      onClose && onClose(result);
    },
  };
  back.addEventListener("mousedown", e => { if (e.target === back) api.close(); });
  box.addEventListener("click", e => { if (e.target.closest("[data-close]")) api.close(); });
  stack.push(api);
  const first = box.querySelector("input:not([type=checkbox]),select,textarea");
  if (first && !first.matches("[data-nofocus]")) setTimeout(() => first.focus(), 60);
  return api;
}
document.addEventListener("keydown", e => { if (e.key === "Escape" && stack.length) stack[stack.length - 1].close(); });

export function confirmBox(title, text, ok = T("OK"), cancel = T("Cancel"), danger = false, icon = null) {
  return new Promise(resolve => {
    const ic = icon || (danger ? "!" : cancel ? "?" : "i");
    const p = popup(`<div class="box-head"><span class="box-icon${danger ? " danger" : ""}">${esc(ic)}</span><h2>${esc(title)}</h2></div>
      <p class="popup-text">${esc(text).replace(/\n/g, "<br>")}</p>
      <div class="box-buttons"><button class="btn ${danger ? "danger" : "main"}" data-r="1">${esc(ok)}</button>${cancel ? `<button class="btn second" data-r="0">${esc(cancel)}</button>` : ""}</div>`,
      { width: 440, cls: "box", onClose: r => resolve(!!r) });
    p.el.querySelectorAll("[data-r]").forEach(b => b.onclick = () => p.close(b.dataset.r === "1"));
  });
}
export const alertBox = (title, text) => confirmBox(title, text, T("OK"), null);

/** "＋ New category…" at the end of every category list: choosing it asks for a name and creates the category. */
export const NEW_CAT = () => ["__new__", "＋ " + T("New category…")];
document.addEventListener("change", async e => {
  const sel = e.target;
  if (!(sel instanceof HTMLSelectElement) || sel.value !== "__new__") return;
  const prev = sel.dataset.prev ?? sel.options[0]?.value ?? "";
  const { addCategory, categoryLabel, ICON_CHOICES } = await import("./core.js");
  const got = await categoryBox(ICON_CHOICES);
  const err = got === null ? "" : addCategory(got.name, got.essential, got.icon);
  if (got === null || err) { if (err) toast(err, "bad"); sel.value = prev; return; }
  const clean = got.name.trim();
  // Add the new category to every category list on screen, and choose it here
  document.querySelectorAll("select").forEach(s => {
    const n = s.querySelector('option[value="__new__"]');
    if (!n || s.querySelector(`option[value="${CSS.escape(clean)}"]`)) return;
    const o = document.createElement("option"); o.value = clean; o.textContent = categoryLabel(clean); s.insertBefore(o, n);
  });
  sel.value = clean; sel.dataset.prev = clean;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  toast(T("Added: {0}.", clean));
}, true);
document.addEventListener("focusin", e => { if (e.target instanceof HTMLSelectElement && e.target.value !== "__new__") e.target.dataset.prev = e.target.value; });

/** New category from a category list: name, icon and essential. Resolves to { name, icon, essential } or null. */
function categoryBox(icons) {
  return new Promise(resolve => {
    let icon = "📦";
    const p = popup(`<div class="box-head"><span class="box-icon">🏷️</span><h2>${esc(T("New category"))}</h2></div>
      ${field(T("Name of the category"), textInput("v", "", T("e.g. {0}", T("Pets"))))}
      <div class="field"><span>${esc(T("Icon"))}</span><div class="icon-grid">${icons.map(i => `<button type="button" class="icon-pick${i === icon ? " on" : ""}" data-icon="${i}">${i}</button>`).join("")}</div></div>
      ${check("ess", T("Essential (must pay even in a crisis)"), false)}
      <div class="box-buttons"><button class="btn main" data-r="1">${esc(T("Add category"))}</button><button class="btn second" data-r="0">${esc(T("Cancel"))}</button></div>`,
      { width: 460, cls: "box", onClose: r => resolve(r) });
    const input = p.el.querySelector('input[name="v"]');
    p.el.querySelectorAll("[data-icon]").forEach(b => b.onclick = () => {
      icon = b.dataset.icon; p.el.querySelectorAll("[data-icon]").forEach(x => x.classList.toggle("on", x === b));
    });
    const done = ok => p.close(ok ? { name: input.value, icon, essential: p.el.querySelector('input[name="ess"]').checked } : null);
    p.el.querySelectorAll("[data-r]").forEach(b => b.onclick = () => done(b.dataset.r === "1"));
    input.addEventListener("keydown", e => { if (e.key === "Enter") done(true); });
    setTimeout(() => input.focus(), 50);
  });
}

export function promptBox(title, label, value = "") {
  return new Promise(resolve => {
    const p = popup(`<div class="box-head"><span class="box-icon">✎</span><h2>${esc(title)}</h2></div>${field(label, textInput("v", value))}
      <div class="box-buttons"><button class="btn main" data-r="1">${esc(T("OK"))}</button><button class="btn second" data-r="0">${esc(T("Cancel"))}</button></div>`,
      { width: 440, cls: "box", onClose: r => resolve(r) });
    const input = p.el.querySelector("input");
    const done = ok => p.close(ok ? input.value : null);
    p.el.querySelectorAll("[data-r]").forEach(b => b.onclick = () => done(b.dataset.r === "1"));
    input.addEventListener("keydown", e => { if (e.key === "Enter") done(true); });
  });
}

let toastTimer;
export function toast(text, kind = "good") {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.textContent = text; t.className = "show " + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = "", 2600);
}

export function pickFile(accept) {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = accept;
    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}
export function download(name, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
export const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };

// ---------------------------------------------------------------- card layout like the app (CardBoard)

/** Puts the cards of every .grid in 1, 2 or 3 columns: card 1 left, card 2 middle, card 3 right, then the next row.
 *  On the tabs (grid with data-key) the cards can be moved with their handle ⠿, like in the app. */
// Fixed: tiles and big buttons stay where they are. Wide cards span the whole width but can be moved too.
const isFull = el => el.matches(".tiles, .btn, .tip, .fixed");
const spans = el => el.matches(".tiles, .btn, .tip, .wide, .fixed");
function layoutGrid(grid) {
  if (!grid._items) {
    grid._items = [...grid.children];
    grid._orig = grid._items.filter(x => !isFull(x));
    const key = grid.dataset.key;
    const saved = key && State.data.Settings.CardOrder?.[key];
    // A moved order is kept by card position: only use it while the tab has the same cards. When a card appears or disappears
    // (e.g. "Your account checks" after the first saved check) the positions no longer match, so the standard order is used.
    if (Array.isArray(saved) && saved.length === grid._orig.length) {
      const ordered = [...new Set(saved)].filter(i => i >= 0 && i < grid._orig.length).map(i => grid._orig[i]);
      grid._orig.forEach(c => { if (!ordered.includes(c)) ordered.push(c); });
      let k = 0;
      grid._items = grid._items.map(x => isFull(x) ? x : ordered[k++]);
    }
    if (key) grid._orig.forEach(card => addHandle(grid, card));
  }
  const width = grid.clientWidth || grid.parentElement?.clientWidth || window.innerWidth;
  const n = width >= 1100 ? 3 : width >= 720 ? 2 : 1;
  if (grid._cols === n) return;
  grid._cols = n;
  const parts = [];
  let group = null;
  for (const item of grid._items) {
    if (spans(item)) { parts.push(item); group = null; continue; }
    if (!group) {
      group = document.createElement("div"); group.className = "cols";
      group.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
      for (let i = 0; i < n; i++) { const c = document.createElement("div"); c.className = "col"; group.appendChild(c); }
      group._count = 0; parts.push(group);
    }
    group._items = group._items || []; group._items.push(item);
  }
  grid.replaceChildren(...parts);
  // Fill the columns evenly: each card goes into the column that is shortest so far (no big empty gaps)
  for (const g of parts) {
    if (!g._items) continue;
    const cols = [...g.children], h = cols.map(() => 0), cnt = cols.map(() => 0);
    for (const item of g._items) {
      let k = 0;
      for (let j = 1; j < cols.length; j++) if (h[j] < h[k] - 1 || (Math.abs(h[j] - h[k]) <= 1 && cnt[j] < cnt[k])) k = j;
      cols[k].appendChild(item); cnt[k]++;
      h[k] += item.offsetHeight || 0;
    }
    delete g._items;
  }
}

function addHandle(grid, card) {
  if (card.querySelector(":scope > .drag-handle")) return;
  const h = document.createElement("span");
  h.className = "drag-handle"; h.textContent = "⠿"; h.title = T("Drag to move this card");
  card.prepend(h);
  h.addEventListener("click", e => e.stopPropagation());
  // Drag by the handle ⠿ or by the card's title
  card.addEventListener("pointerdown", e => {
    const grip = e.target.closest(".drag-handle") || (e.target.closest("h3") && card.contains(e.target.closest("h3")) ? e.target.closest("h3") : null);
    if (!grip || e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY;
    let started = false, target = null, ghost = null, px = sx, py = sy, raf = 0;
    const findTarget = () => {
      const under = document.elementFromPoint(px, py);
      const t = under && grid._orig.find(c => c !== card && c.contains(under));
      if (t !== target) { target?.classList.remove("drop-target"); target = t || null; target?.classList.add("drop-target"); }
    };
    const tick = () => {
      // Scroll the page when the pointer is near the top or bottom edge
      const edge = 70;
      if (py < edge + 60) window.scrollBy(0, -Math.ceil((edge + 60 - py) / 4));
      else if (py > window.innerHeight - edge) window.scrollBy(0, Math.ceil((py - window.innerHeight + edge) / 4));
      findTarget();
      raf = requestAnimationFrame(tick);
    };
    const move = ev => {
      px = ev.clientX; py = ev.clientY;
      if (!started) {
        if (Math.hypot(px - sx, py - sy) < 6) return;
        started = true;
        document.body.classList.add("is-dragging");
        card.classList.add("dragging");
        ghost = document.createElement("div"); ghost.className = "drag-ghost";
        ghost.textContent = "⠿  " + (card.querySelector("h3")?.textContent || "");
        document.body.appendChild(ghost);
        raf = requestAnimationFrame(tick);
      }
      ghost.style.left = px + 14 + "px"; ghost.style.top = py + 10 + "px";
      ev.preventDefault();
    };
    const up = () => {
      document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
      cancelAnimationFrame(raf);
      if (!started) return;
      // The click after a drag must not open the tab behind the card
      const swallow = ev => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 50);
      document.body.classList.remove("is-dragging");
      card.classList.remove("dragging"); target?.classList.remove("drop-target"); ghost?.remove();
      if (!target) return;
      const movable = grid._items.filter(x => !isFull(x));
      const from = movable.indexOf(card), to = movable.indexOf(target);
      movable.splice(from, 1); movable.splice(to, 0, card);
      let k = 0;
      grid._items = grid._items.map(x => isFull(x) ? x : movable[k++]);
      const s = State.data.Settings;
      s.CardOrder = s.CardOrder || {};
      s.CardOrder[grid.dataset.key] = movable.map(c => grid._orig.indexOf(c));
      save();
      grid._cols = 0; layoutGrid(grid);
    };
    document.addEventListener("pointermove", move); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
  });
}
const resize = new ResizeObserver(entries => entries.forEach(e => layoutGrid(e.target)));
new MutationObserver(() => {
  document.querySelectorAll(".grid:not([data-laid])").forEach(g => {
    g.dataset.laid = "1"; layoutGrid(g); resize.observe(g);
    // A section opened or closed in a card changes its height: spread the cards over the columns again (no big gaps)
    g.addEventListener("toggle", e => { if (e.target.closest(".grid") === g && e.target.closest(".popup") === g.closest(".popup")) { g._cols = 0; layoutGrid(g); } }, true);
  });
}).observe(document.documentElement, { childList: true, subtree: true });

// ---------------------------------------------------------------- small line icons (they take the button's colour)
const svg = d => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  trash: svg('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>'),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  repeat: svg('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>'),
};

// ---------------------------------------------------------------- hover details (a styled tooltip instead of the slow browser one)
// Shows for anything with data-tip, a title, or an SVG <title> (chart bars and rings).
(() => {
  if (!window.matchMedia?.("(hover: hover)").matches) return;   // phones: no hover
  const box = document.createElement("div"); box.className = "tip-box"; box.hidden = true;
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(box));
  if (document.body) document.body.appendChild(box);
  let cur = null;
  const textOf = el => {
    if (el.dataset?.tip) return el.dataset.tip;
    if (el.getAttribute?.("title")) { el.dataset.tip = el.getAttribute("title"); el.removeAttribute("title"); return el.dataset.tip; }
    const t = el.querySelector?.(":scope > title"); return t ? t.textContent : "";
  };
  document.addEventListener("mouseover", e => {
    const el = e.target.closest?.("[data-tip], [title], svg rect, svg circle");
    const text = el ? textOf(el) : "";
    if (!text) { box.hidden = true; cur = null; return; }
    cur = el; box.textContent = text; box.hidden = false;
  });
  document.addEventListener("mousemove", e => {
    if (box.hidden) return;
    const w = box.offsetWidth, h = box.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 18;
    if (x + w > innerWidth - 8) x = Math.max(8, e.clientX - w - 14);
    if (y + h > innerHeight - 8) y = e.clientY - h - 12;
    box.style.left = x + "px"; box.style.top = y + "px";
  });
  document.addEventListener("mouseout", e => { if (cur && !cur.contains(e.relatedTarget)) { box.hidden = true; cur = null; } });
  document.addEventListener("pointerdown", () => { box.hidden = true; }, true);
})();
