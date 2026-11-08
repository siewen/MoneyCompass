// Charts for the Overview in the "Emerald Balanced" design: grouped bars, trend lines with dots, donut with a short legend.
import { esc } from "./ui.js";
import { donut } from "./charts.js";

export const C_IN = "#35D399", C_OUT = "#3B82F6", C_LEFT = "#EAF1EE";
const spaced = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const niceMax = v => { if (!(v > 0)) return 1; const p = 10 ** Math.floor(Math.log10(v)), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
const W = 520, H = 240, L = 58, R = 8, TOP = 10, B = 30;

/** Axis, grid lines and month names; returns the svg start, and a y() to place values. */
function frame(months, min, max) {
  const n = months.length, inner = W - L - R, h = H - TOP - B, step = (max - min) / 4;
  const y = v => TOP + h - (v - min) / (max - min) * h;
  let g = "";
  for (let i = 0; i <= 4; i++) { const v = min + step * i; g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.08)"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" class="oc-ax">${spaced(v)}</text>`; }
  const x = i => L + inner * (i + .5) / n;
  const lab = months.map((m, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="oc-ax${m.current ? " cur" : ""}">${esc(m.month.slice(0, 3) + (m.current ? "*" : ""))}</text>`).join("");
  return { g: g + lab, x, y, inner, n };
}

/** Income and expenses as two bars per month. */
export function ovBars(months) {
  const max = niceMax(Math.max(1, ...months.flatMap(m => [m.income, m.expenses])));
  const f = frame(months, 0, max), bw = Math.min(14, f.inner / f.n / 2.6);
  const bars = months.map((m, i) => {
    const cx = f.x(i), op = m.current ? ' opacity=".55"' : "";
    const bar = (v, c, dx) => v > 0 ? `<rect x="${cx + dx}" y="${f.y(v)}" width="${bw}" height="${f.y(0) - f.y(v)}" rx="2.5" fill="${c}"${op}><title>${esc(m.month)}: ${spaced(v)}</title></rect>` : "";
    return bar(m.income, C_IN, -bw - 1) + bar(m.expenses, C_OUT, 1);
  }).join("");
  return `<svg class="oc" viewBox="0 0 ${W} ${H}" role="img">${f.g}${bars}</svg>`;
}

/** Lines with dots: income, expenses and what is left over (dashed). */
export function ovTrend(months) {
  const left = months.map(m => m.income - m.expenses);
  const hi = Math.max(1, ...months.flatMap(m => [m.income, m.expenses])), lo = Math.min(0, ...left);
  const max = niceMax(hi), min = lo < 0 ? -niceMax(-lo) : 0;
  const f = frame(months, min, max);
  const line = (vals, c, dash, dots) => {
    const pts = vals.map((v, i) => `${f.x(i).toFixed(1)},${f.y(v).toFixed(1)}`);
    return `<polyline points="${pts.join(" ")}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"${dash ? ' stroke-dasharray="5 4"' : ""}/>` +
      (dots ? vals.map((v, i) => `<circle cx="${f.x(i).toFixed(1)}" cy="${f.y(v).toFixed(1)}" r="3.4" fill="${c}"><title>${esc(months[i].month)}: ${spaced(v)}</title></circle>`).join("") : "");
  };
  return `<svg class="oc" viewBox="0 0 ${W} ${H}" role="img">${f.g}${line(months.map(m => m.income), C_IN, false, true)}${line(months.map(m => m.expenses), C_OUT, false, true)}${line(left, C_LEFT, true, false)}</svg>`;
}

/** A small donut with its legend on the right: colour, name, share. */
export function donutList(items, top, bottom, share) {
  const rows = items.filter(i => i.value > 0);
  return `<div class="dl-row">${donut(rows, top, bottom, 150)}<ul class="dl-list">${rows.map(i => `<li data-tip="${esc(i.label + (i.text ? " · " + i.text : ""))}"><i style="background:${i.color}"></i><span>${esc(i.label)}</span><b>${esc(share(i.value))}</b></li>`).join("")}</ul></div>`;
}

export const legendKeys = keys => `<div class="oc-keys">${keys.map(k => `<span><i style="${k.dash ? `border-top:2px dashed ${k.color};background:none;height:0;border-radius:0;width:14px` : `background:${k.color}`}"></i>${esc(k.label)}</span>`).join("")}</div>`;
