// Shared top of the redesigned pages: title, four figures, a highlighted summary band and a bottom band.
import { esc } from "./ui.js";
export const si = (d, n = 26) => `<svg class="nwi" width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const IC = {
  trophy: '<path d="M8 4h8v5a4 4 0 01-8 0zM8 6H4v1a3 3 0 003 3M16 6h4v1a3 3 0 01-3 3M12 13v4M8 20h8M10 17h4"/>',
  trend: '<path d="M4 17l6-6 4 4 6-8M15 7h5v5"/>', coins: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.700 3 3 7 3s7-1.300 7-3V6M5 12v6c0 1.700 3 3 7 3s7-1.300 7-3v-6"/>',
  bank: '<path d="M3 10l9-6 9 6M5 10v8M9.500 10v8M14.500 10v8M19 10v8M3 20h18"/>', up: '<circle cx="12" cy="12" r="9"/><path d="M12 17V8M8 11l4-4 4 4"/>', down: '<circle cx="12" cy="12" r="9"/><path d="M12 7v9M8 13l4 4 4-4"/>',
  pig: '<path d="M5 12a7 6 0 0114 0c0 2-1 3-2 4v3h-3v-2h-4v2H7v-3c-1-1-2-2-2-4zM19 10h2M9 10h.01"/>', bars: '<path d="M5 20V12M12 20V6M19 20V10"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>', wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/>',
  star: '<path d="M12 3l2.800 5.800 6.200.9-4.500 4.400 1 6.200L12 17.300 6.500 20.300l1-6.200L3 9.700l6.200-.9z"/>', pie: '<path d="M12 3a9 9 0 109 9h-9z"/>',
};
export function pageHead({ icon, title, sub, btn = "", kpis = [] }) {
  return `<div class="pg-title"><span class="pg-ic">${si(IC[icon] || IC.bars, 34)}</span><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>${btn}</div>
    <div class="ov-kpis">${kpis.map(k => `<div class="kpi static"><span class="kpi-ic ${k.cls || "in"}">${si(IC[k.icon] || IC.bars)}</span><span class="kpi-t"><span class="kpi-l">${esc(k.l)}</span><b class="${k.vcls || ""}">${esc(k.v)}</b>${k.sub ? `<small class="kpi-sub">${esc(k.sub)}</small>` : ""}</span></div>`).join("")}</div>`;
}
/** A glowing band: title (with icon) and a row of label/value figures. */
export function band(title, icon, figs, cls = "", extra = "") {
  return `<div class="rp-sum nw-card ${cls}"><span class="rp-si">${si(IC[icon] || IC.bars, 36)}</span><div class="rp-st"><h3>${esc(title)}</h3></div>
    ${figs.map(f => `<div class="${f.big ? "rp-net" : ""}"><small>${esc(f.l)}</small><b class="${f.cls || ""}">${esc(f.v)}</b></div>`).join("")}${extra}</div>`;
}
