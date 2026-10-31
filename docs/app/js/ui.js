// Small UI helpers: escaping, cards, fields, pop-up windows, messages.
import { T } from "./core.js";

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
export function popup(html, { width = 560, onClose, cls = "" } = {}) {
  const back = document.createElement("div");
  back.className = "popup-back";
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

export function confirmBox(title, text, ok = T("OK"), cancel = T("Cancel"), danger = false) {
  return new Promise(resolve => {
    const p = popup(`<h2 class="popup-title">${esc(title)}</h2><p class="popup-text">${esc(text).replace(/\n/g, "<br>")}</p>
      <div class="popup-buttons">${cancel ? `<button class="btn second" data-r="0">${esc(cancel)}</button>` : ""}<button class="btn ${danger ? "danger" : "main"}" data-r="1">${esc(ok)}</button></div>`,
      { width: 460, onClose: r => resolve(!!r) });
    p.el.querySelectorAll("[data-r]").forEach(b => b.onclick = () => p.close(b.dataset.r === "1"));
  });
}
export const alertBox = (title, text) => confirmBox(title, text, T("OK"), null);

export function promptBox(title, label, value = "") {
  return new Promise(resolve => {
    const p = popup(`<h2 class="popup-title">${esc(title)}</h2>${field(label, textInput("v", value))}
      <div class="popup-buttons"><button class="btn second" data-r="0">${esc(T("Cancel"))}</button><button class="btn main" data-r="1">${esc(T("OK"))}</button></div>`,
      { width: 440, onClose: r => resolve(r) });
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
