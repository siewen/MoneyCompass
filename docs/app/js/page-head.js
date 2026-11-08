// Shared top of the redesigned pages: title, four figures, a highlighted summary band and a bottom band.
import { esc } from "./ui.js";
export const si = (d, n = 26) => `<svg class="nwi" width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const IC = {
  tag: '<path d="M2.500 12.500V4.500A1.500 1.500 0 014 3h8l9.500 9.500-8.500 8.500zM7.500 6.500a1.500 1.500 0 100 3 1.500 1.500 0 000-3z" fill-rule="evenodd" stroke="none"/>',
  palette: '<path fill-rule="evenodd" d="M12 3a9 9 0 100 18c1.100 0 1.800-.9 1.500-1.900-.3-1 .3-2.100 1.400-2.100H17a4 4 0 004-4c0-5-4-10-9-10zM7.500 11.500a1.400 1.400 0 110-2.800 1.400 1.400 0 010 2.800zm3-4a1.400 1.400 0 110-2.800 1.400 1.400 0 010 2.800zm5 0a1.400 1.400 0 110-2.800 1.400 1.400 0 010 2.800z" stroke="none"/>',
  house: '<path d="M12 3l9.500 8.200h-3V21h-5.500v-6h-2v6H5.500v-9.800h-3z" stroke="none"/>', bolt: '<path d="M13.500 2L4 14h6.200l-1 8L19 9.800h-6.300z" stroke="none"/>',
  car: '<path fill-rule="evenodd" d="M5.200 11l1.400-4.300A2 2 0 018.500 5.300h7a2 2 0 011.900 1.400L18.800 11a2 2 0 011.700 2v4.500h-2.200v1.300a1.300 1.300 0 01-2.600 0v-1.300H8.400v1.300a1.300 1.300 0 01-2.600 0v-1.300H3.500V13a2 2 0 011.700-2zm2.600 0h8.400l-.9-3H8.700zm-.8 3a1.200 1.200 0 100 2.400 1.200 1.200 0 000-2.400zm10 0a1.200 1.200 0 100 2.400 1.200 1.200 0 000-2.400z" stroke="none"/>',
  percent: '<path fill-rule="evenodd" d="M12 2a10 10 0 100 20 10 10 0 000-20zM8.500 6.800a1.700 1.700 0 110 3.400 1.700 1.700 0 010-3.400zm7 7a1.700 1.700 0 110 3.400 1.700 1.700 0 010-3.400zM16.600 7.100l1.200 1.200-9.400 9.400-1.200-1.200z" stroke="none"/>',
  gauge: '<path d="M12 3a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 016 6h-2a4 4 0 00-8 0H6a6 6 0 016-6zm1 7.500l3.500-4.500 1.200 1-3.600 4.700a1.600 1.600 0 11-1.100-1.200z" fill-rule="evenodd" stroke="none"/>',
  flag: '<path d="M5 2h2v20H5zM8 3h12l-3 5 3 5H8z" stroke="none"/>',
  cart: '<path d="M2 3h3l.6 3H21l-2 9H8L5 4H2zM9 18a1.700 1.700 0 100 3.400A1.700 1.700 0 009 18zm9 0a1.700 1.700 0 100 3.400A1.700 1.700 0 0018 18z" stroke="none"/>',
  check: '<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1.500 14.500l-4-4 1.400-1.400 2.600 2.600 5.600-5.600 1.400 1.400z" fill-rule="evenodd" stroke="none"/>',
  heart: '<path d="M12 21s-8-5.400-8-11a4.500 4.500 0 018-2.800A4.500 4.500 0 0120 10c0 5.600-8 11-8 11z" stroke="none"/><path d="M3 12h4l2-3 3 6 2-3h7" fill="none" stroke="#0A4A36" stroke-width="1.600"/>',
  sparkle: '<path d="M10 2l2.200 6.300L18.500 10.500 12.200 12.700 10 19l-2.200-6.300L1.500 10.500 7.800 8.300zM19 14l1.100 2.900L23 18l-2.900 1.100L19 22l-1.100-2.900L15 18l2.900-1.100z" stroke="none"/>',
  warn: '<path d="M12 2L1 21h22zM11 9h2v6h-2zm0 8h2v2h-2z" fill-rule="evenodd" stroke="none"/>',
  leaf: '<path d="M12 22V12M12 12C12 7 8 4 3 4c0 5 3 8 9 8zM12 14c0-4 3-7 9-7 0 5-3 8-9 8z" stroke="none"/><path d="M11 12h2v10h-2z" stroke="none"/>',
  pie: '<path d="M11 2v10h10A10 10 0 0011 2zM9 4.200A10 10 0 1019.800 14H9z" stroke="none"/>',
  shield: '<path d="M12 2l8 3v6c0 5-3.400 9.300-8 11-4.600-1.700-8-6-8-11V5zm-1.500 14l6-6-1.400-1.400-4.600 4.600-2-2L7.100 12.600z" fill-rule="evenodd" stroke="none"/>',
  plus: '<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 5v4h4v2h-4v4h-2v-4H7v-2h4V7z" fill-rule="evenodd" stroke="none"/>',
  repeat: '<path d="M12 4V1L7 5l5 4V6a6 6 0 016 6c0 1-.3 2-.8 2.900l1.500 1.500A8 8 0 0012 4zm-6.700 3.600A8 8 0 0012 20v3l5-4-5-4v3a6 6 0 01-6-6c0-1 .3-2 .8-2.900z" stroke="none"/>',
  eye: '<path d="M12 5C6.500 5 2.700 9 1.500 12c1.200 3 5 7 10.500 7s9.300-4 10.500-7C21.300 9 17.500 5 12 5zm0 11a4 4 0 110-8 4 4 0 010 8zm0-6a2 2 0 100 4 2 2 0 000-4z" fill-rule="evenodd" stroke="none"/>',
  calx: '<path d="M7 2h2v2h6V2h2v2h2a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2h2zM5 9v11h14V9zm2 2h3v3H7z" fill-rule="evenodd" stroke="none"/>',
  docs: '<path d="M6 2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm7 1.500V9h5.500zM8 13h8v1.500H8zm0 3.500h8V18H8z" fill-rule="evenodd" stroke="none"/>',
  dl: '<path d="M11 3h2v9l3-3 1.400 1.400L12 16l-5.400-5.600L8 9l3 3zM4 18h16v3H4z" stroke="none"/>',
  save: '<path d="M6 2h12a2 2 0 012 2v18l-8-5-8 5V4a2 2 0 012-2z" stroke="none"/>',
  res: '<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1.500 14.500l-4-4 1.400-1.400 2.600 2.600 5.600-5.600 1.400 1.400z" fill-rule="evenodd" stroke="none"/>',
  bulb: '<path d="M12 2a7 7 0 00-4 12.700V17h8v-2.300A7 7 0 0012 2zM9 19h6v1.500a1.500 1.500 0 01-1.500 1.500h-3A1.500 1.500 0 019 20.500z" stroke="none"/>',
  calc: '<path d="M6 2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm1 3v4h10V5zm1 6.500a1.200 1.200 0 100 2.400 1.200 1.200 0 000-2.400zm4 0a1.200 1.200 0 100 2.400 1.200 1.200 0 000-2.400zm4 0a1.200 1.200 0 100 2.400 1.200 1.200 0 000-2.400zM8 16a1.200 1.200 0 100 2.400A1.200 1.200 0 008 16zm4 0a1.200 1.200 0 100 2.400 1.200 1.200 0 000-2.400zm4 0a1.200 1.200 0 100 2.400 1.200 1.200 0 000-2.400z" stroke="none"/>',
  table: '<path d="M3 4h18v16H3zm2 4v3h4V8zm6 0v3h8V8zm-6 5v3h4v-3zm6 0v3h8v-3z" fill-rule="evenodd" stroke="none"/>',
  trophy: '<path d="M7 3h10v5a5 5 0 01-10 0zM7 5H3v2a4 4 0 004 4zM17 5h4v2a4 4 0 01-4 4zM10.500 13h3v3h-3zM8 18h8v3H8z" stroke="none"/>',
  trend: '<path d="M3 18l6-6 4 4 7-9" fill="none" stroke="#2EDC9A" stroke-width="3"/><path d="M14 6h7v7z" stroke="none"/>', coins: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.700 3 3 7 3s7-1.300 7-3V6M5 12v6c0 1.700 3 3 7 3s7-1.300 7-3v-6"/>',
  bank: '<path d="M12 2L2 8v2h20V8zM4 11h3v8H4zM10.500 11h3v8h-3zM17 11h3v8h-3zM2 20h20v2H2z" stroke="none"/>', up: '<circle cx="12" cy="12" r="9"/><path d="M12 17V8M8 11l4-4 4 4"/>', down: '<circle cx="12" cy="12" r="9"/><path d="M12 7v9M8 13l4 4 4-4"/>',
  pig: '<path d="M5 12a7 6 0 0114 0c0 2-1 3-2 4v3h-3v-2h-4v2H7v-3c-1-1-2-2-2-4zM19 10h2M9 10h.01"/>', bars: '<path d="M4 12h4v8H4zM10 5h4v15h-4zM16 9h4v11h-4z" stroke="none"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>', wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/>',
  star: '<path d="M12 3l2.800 5.800 6.200.9-4.500 4.400 1 6.200L12 17.300 6.500 20.300l1-6.200L3 9.700l6.200-.9z"/>', pie: '<path d="M12 3a9 9 0 109 9h-9z"/>',
};
export function pageHead({ icon, title, sub, btn = "", kpis = [] }) {
  return `<div class="pg-title"><span class="pg-ic">${si(IC[icon] || IC.bars, 34)}</span><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>${btn}</div>
    <div class="ov-kpis">${kpis.map(k => `<div class="kpi static${k.hi ? " hi" : ""}"><span class="kpi-ic ${k.cls || "in"}">${si(IC[k.icon] || IC.bars)}</span><span class="kpi-t"><span class="kpi-l">${esc(k.l)}</span><b class="${k.vcls || ""}">${esc(k.v)}</b>${k.sub ? `<small class="kpi-sub">${esc(k.sub)}</small>` : ""}</span></div>`).join("")}</div>`;
}
/** A glowing band: title (with icon) and a row of label/value figures. */
export function band(title, icon, figs, cls = "", extra = "") {
  return `<div class="rp-sum nw-card ${cls}"><span class="rp-si i-${icon}">${si(IC[icon] || IC.bars, 44)}</span><div class="rp-st"><h3>${esc(title)}</h3></div>
    ${figs.map(f => `<div class="${f.big ? "rp-net" : ""}"><small>${esc(f.l)}</small><b class="${f.cls || ""}">${esc(f.v)}</b></div>`).join("")}${extra}</div>`;
}

/** Progress ring: pct 0-100, big text inside, small text under it. */
export const ring = (pct, big, small = "", size = 150, col = "#2EDC9A") => {
  const r = 52, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct));
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 120 120" width="${size}" height="${size}"><circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="11"/><circle cx="60" cy="60" r="${r}" fill="none" stroke="${col}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(c * p / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)" style="filter:drop-shadow(0 0 6px ${col})"/></svg><div class="ring-t"><b style="font-size:${Math.round(size * 0.2)}px">${big}</b><small>${small}</small></div></div>`;
};
