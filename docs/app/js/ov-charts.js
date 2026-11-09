// Charts for the Overview in the "Emerald Balanced" design: grouped bars, trend lines with dots, donut with a short legend.
import { esc } from "./ui.js";
import { donut } from "./charts.js";

export const C_IN = "#35D399", C_OUT = "#3B82F6", C_LEFT = "#EAF1EE";
const spaced = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const niceMax = v => { if (!(v > 0)) return 1; const p = 10 ** Math.floor(Math.log10(v)), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
let W = 520, H = 240; const L = 66, R = 8, TOP = 10, B = 38;

/** Axis, grid lines and month names; returns the svg start, and a y() to place values. */
const compactAx = v => { const a = Math.abs(v), sg = v < 0 ? "−" : ""; return a >= 1e6 ? sg + (Math.round(a / 1e5) / 10).toString().replace(".", ",") + "M" : a >= 1000 ? sg + Math.round(a / 1000) + "k" : String(Math.round(v)); };
function frame(months, min, max) {
  const n = months.length, inner = W - L - R, h = H - TOP - B, step = (max - min) / 4;
  const y = v => TOP + h - (v - min) / (max - min) * h;
  let g = "";
  for (let i = 0; i <= 4; i++) { const v = min + step * i; g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.08)"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" class="oc-ax">${max >= 100000 ? compactAx(v) : spaced(v)}</text>`; }
  const x = i => L + inner * (i + .5) / n;
  const lab = months.map((m, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="oc-ax${m.current ? " cur" : ""}">${esc((/^(\d{4}|\w{3} \d{4})$/.test(m.month) ? m.month : m.month.slice(0, 3)) + (m.current ? "*" : ""))}</text>`).join("");
  return { g: g + lab, x, y, inner, n };
}

/** Income and expenses as two bars per month. */
export function ovBars(months) {
  const max = niceMax(Math.max(1, ...months.flatMap(m => [m.income, m.expenses])));
  const f = frame(months, 0, max), bw = Math.min(26, f.inner / f.n / 2.2);
  const bars = months.map((m, i) => {
    const cx = f.x(i), op = m.current ? ' opacity=".55"' : "";
    // rounded top, soft gradient: the bar fades towards the baseline
    const bar = (v, c, gid, dx) => { if (!(v > 0)) return ""; const x = cx + dx, y = f.y(v), h = f.y(0) - y, r = Math.min(6, bw / 2, h);
      return `<path d="M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${y + h}Z" fill="url(#${gid})"${op}><title>${esc(m.month)}: ${spaced(v)}</title></path>`; };
    return bar(m.income, C_IN, "ovg-in", -bw - 2) + bar(m.expenses, C_OUT, "ovg-out", 2);
  }).join("");
  const defs = `<defs><linearGradient id="ovg-in" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C_IN}"/><stop offset="1" stop-color="${C_IN}" stop-opacity=".45"/></linearGradient><linearGradient id="ovg-out" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C_OUT}"/><stop offset="1" stop-color="${C_OUT}" stop-opacity=".45"/></linearGradient></defs>`;
  return `<svg class="oc" viewBox="0 0 ${W} ${H}" role="img">${defs}${f.g}${bars}</svg>`;
}

/** Lines with dots: income, expenses and what is left over (dashed). */
export function ovTrend(months, col) {
  const cIn = col ? col[0] : C_IN, cOut = col ? col[1] : C_OUT, cLeft = col ? col[2] : C_LEFT, dashLeft = !col;
  const left = months.map(m => m.income - m.expenses);
  const hi = Math.max(1, ...months.flatMap(m => [m.income, m.expenses])), lo = Math.min(0, ...left);
  const max = niceMax(hi), min = lo < 0 ? -niceMax(-lo) : 0;
  const f = frame(months, min, max);
  const line = (vals, c, dash, dots) => {
    const pts = vals.map((v, i) => `${f.x(i).toFixed(1)},${f.y(v).toFixed(1)}`);
    return `<polyline points="${pts.join(" ")}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"${dash ? ' stroke-dasharray="5 4"' : ""}/>` +
      (dots ? vals.map((v, i) => `<circle cx="${f.x(i).toFixed(1)}" cy="${f.y(v).toFixed(1)}" r="3.4" fill="${c}"><title>${esc(months[i].month)}: ${spaced(v)}</title></circle>`).join("") : "");
  };
  return `<svg class="oc" viewBox="0 0 ${W} ${H}" role="img">${f.g}${line(months.map(m => m.income), cIn, false, true)}${line(months.map(m => m.expenses), cOut, false, true)}${line(left, cLeft, dashLeft, !!col)}</svg>`;
}

/** A small donut with its legend on the right: colour, name, share. */
export function donutList(items, top, bottom, share) {
  const rows = items.filter(i => i.value > 0);
  return `<div class="dl-row">${donut(rows, top, bottom, 150)}<ul class="dl-list">${rows.map(i => `<li data-tip="${esc(i.label + (i.text ? " · " + i.text : ""))}"><i style="background:${i.color}"></i><span>${esc(i.label)}</span><b>${esc(share(i.value))}</b></li>`).join("")}</ul></div>`;
}

export const legendKeys = keys => `<div class="oc-keys">${keys.map(k => `<span><i style="${k.dash ? `border-top:2px dashed ${k.color};background:none;height:0;border-radius:0;width:14px` : `background:${k.color}`}"></i>${esc(k.label)}</span>`).join("")}</div>`;

/** Income forecast: what came in (green) and what is expected from your income sources (blue). */
export function ovForecast(past, future) {
  const all = [...past.map(p => ({ month: p.month })), ...future.map(p => ({ month: p.month }))];
  const max = niceMax(Math.max(1, ...past.map(p => p.value), ...future.map(p => p.value)));
  const f = frame(all, 0, max), np = past.length;
  const pts = (vals, off) => vals.map((v, i) => [f.x(i + off), f.y(v), v]);
  const dots = (arr, c) => arr.map(([x, y, v], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" fill="${c}"><title>${spaced(v)}</title></circle>`).join("");
  const pa = pts(past.map(p => p.value), 0), pf = pts([past.length ? past[past.length - 1].value : 0, ...future.map(p => p.value)], np - 1);
  const poly = (arr, c, dash) => `<polyline points="${arr.map(a => a[0].toFixed(1) + "," + a[1].toFixed(1)).join(" ")}" fill="none" stroke="${c}" stroke-width="2.4" stroke-linejoin="round"${dash ? ' stroke-dasharray="6 4"' : ""}/>`;
  const area = pa.length > 1 ? `<path d="M${pa[0][0]},${f.y(0)} L${pa.map(a => a[0].toFixed(1) + "," + a[1].toFixed(1)).join(" L")} L${pa[pa.length - 1][0]},${f.y(0)}z" fill="rgba(52,211,153,.14)"/>` : "";
  return `<svg class="oc" viewBox="0 0 ${W} ${H}" role="img">${f.g}${area}${poly(pa, C_IN)}${poly(pf, C_OUT, true)}${dots(pa, C_IN)}${dots(pf.slice(1), C_OUT)}</svg>`;
}
export const spark = (vals, color) => {
  if (vals.length < 2) return "";
  const mx = Math.max(...vals), mn = Math.min(...vals), r = mx - mn || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * 100).toFixed(1)},${(30 - (v - mn) / r * 26 - 2).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
};

/** Generic line chart: labels on x, any number of series {vals, color, dash, dots, area}. */
export function lineChart(labels, series, opt = {}) {
  const w0 = W, h0 = H; if (opt.w) W = opt.w; if (opt.h) H = opt.h;
  try { return lineChart0(labels, series, opt); } finally { W = w0; H = h0; }
}
function lineChart0(labels, series, opt = {}) {
  const all = series.flatMap(s => s.vals.filter(v => v != null));
  const lo = Math.min(0, ...all), hi = Math.max(lo < 0 ? 0 : 1, ...all);
  const max = hi <= 0 ? 0 : niceMax(hi), min = lo < 0 ? -niceMax(-lo) : 0;
  const f = frame(labels.map(m => ({ month: String(m) })), min, max);
  const mk = s => {
    const pts = s.vals.map((v, i) => v == null ? null : [f.x(i), f.y(v), v]).filter(Boolean);
    if (!pts.length) return "";
    const pl = pts.map(a => a[0].toFixed(1) + "," + a[1].toFixed(1)).join(" ");
    const area = s.area && pts.length > 1 ? `<path d="M${pts[0][0].toFixed(1)},${f.y(0)} L${pl.replace(/ /g, " L")} L${pts[pts.length - 1][0].toFixed(1)},${f.y(0)}z" fill="${s.color}" fill-opacity=".16"/>` : "";
    return area + `<polyline points="${pl}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round"${s.dash ? ' stroke-dasharray="6 4"' : ""} style="filter:drop-shadow(0 0 4px ${s.color})"/>` +
      (s.dots ? pts.map(a => `<circle cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="3.6" fill="${s.color}"><title>${spaced(a[2])}</title></circle>`).join("") : "");
  };
  return `<svg class="oc" viewBox="0 0 ${W} ${H}" role="img">${f.g}${series.map(mk).join("")}</svg>`;
}

/** Single-series columns with the value above each bar. */
export function colBars(labels, vals, color = "#22E39A") {
  const max = niceMax(Math.max(1, ...vals)), f = frame(labels.map(m => ({ month: String(m) })), 0, max), bw = Math.min(34, f.inner / f.n / 1.8);
  return `<svg class="oc cb" viewBox="0 0 ${W} ${H}" role="img">${f.g}${vals.map((v, i) => v > 0 ? `<rect x="${f.x(i) - bw / 2}" y="${f.y(v)}" width="${bw}" height="${f.y(0) - f.y(v)}" rx="4" fill="${color}" style="filter:drop-shadow(0 0 5px ${color})"/><text x="${f.x(i)}" y="${f.y(v) - 5}" text-anchor="middle" class="oc-ax" fill="#fff">${spaced(v)}</text>` : "").join("")}</svg>`;
}
