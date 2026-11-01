// Small SVG charts: horizontal bars, donut, monthly bars, progress bar.
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function hbars(items) {
  const max = Math.max(1, ...items.map(i => i.value));
  return `<div class="hbars">${items.map(i => `
    <div class="hbar" title="${esc(i.label)}: ${esc(i.text)}">
      <span class="hbar-label">${esc(i.label)}</span>
      <span class="hbar-track"><span style="width:${Math.max(0.5, i.value / max * 100)}%;background:${i.color}"></span></span>
      <span class="hbar-value">${esc(i.text)}</span>
    </div>`).join("")}</div>`;
}

export function donut(items, top, bottom, size = 180) {
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0);
  const r = 70, c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = total <= 0 ? "" : items.filter(i => i.value > 0).map(i => {
    const len = i.value / total * c;
    const gap = items.filter(x => x.value > 0).length > 1 ? Math.min(2, len / 3) : 0;
    const s = `<circle r="${r}" cx="90" cy="90" fill="none" stroke="${i.color}" stroke-width="22"
      stroke-dasharray="${Math.max(0, len - gap)} ${c}" stroke-dashoffset="${-offset}" transform="rotate(-90 90 90)"><title>${esc(i.label)}: ${esc(i.text)}</title></circle>`;
    offset += len;
    return s;
  }).join("");
  return `<svg class="donut" viewBox="0 0 180 180" width="${size}" height="${size}" role="img">
    <circle r="${r}" cx="90" cy="90" fill="none" stroke="var(--grid)" stroke-width="22"/>${arcs}
    <text x="90" y="88" text-anchor="middle" class="donut-top">${esc(top)}</text>
    <text x="90" y="108" text-anchor="middle" class="donut-bottom">${esc(bottom)}</text></svg>`;
}

export function legend(rows) {
  return `<div class="legend">${rows.map(r => `
    <div class="legend-row${r.key ? " clickable" : ""}"${r.key ? ` data-cat="${esc(r.key)}"` : ""}>
      <i style="background:${r.color || "transparent"}"></i><span class="legend-label">${esc(r.label)}</span>
      <span class="legend-value">${esc(r.text || "")}</span>${r.share !== undefined ? `<span class="legend-share">${esc(r.share)}</span>` : ""}
    </div>`).join("")}</div>`;
}

export function monthBars(months, fmtAxis, fmtValue, names) {
  const w = 560, h = 220, left = 44, bottom = 26, top = 10;
  const max = Math.max(1, ...months.flatMap(m => [m.income, m.expenses]));
  const nice = niceMax(max);
  const plotH = h - bottom - top, plotW = w - left - 6;
  const group = plotW / Math.max(1, months.length), bw = Math.min(26, group / 3);
  let grid = "";
  for (let k = 0; k <= 4; k++) {
    const v = nice / 4 * k, y = top + plotH - v / nice * plotH;
    grid += `<line x1="${left}" x2="${w - 4}" y1="${y}" y2="${y}" stroke="var(--grid)"/>
      <text x="${left - 6}" y="${y + 4}" text-anchor="end" class="axis">${esc(fmtAxis(v))}</text>`;
  }
  const bars = months.map((m, i) => {
    const x = left + group * i + group / 2;
    const hi = m.income / nice * plotH, he = m.expenses / nice * plotH;
    // The current month is not finished: lighter bars with a dashed outline
    const cur = m.current ? ` fill-opacity="0.4" stroke-dasharray="4 3" stroke-width="1.5"` : "";
    return `<rect x="${x - bw - 1}" y="${top + plotH - hi}" width="${bw}" height="${hi}" rx="3" fill="#2a78d6" stroke="#2a78d6"${cur}><title>${esc(m.month)} · ${esc(names[0])}: ${esc(fmtValue(m.income))}</title></rect>
      <rect x="${x + 1}" y="${top + plotH - he}" width="${bw}" height="${he}" rx="3" fill="#eb6834" stroke="#eb6834"${cur}><title>${esc(m.month)} · ${esc(names[1])}: ${esc(fmtValue(m.expenses))}</title></rect>
      <text x="${x}" y="${h - 8}" text-anchor="middle" class="axis">${esc(m.month)}${m.current ? " *" : ""}</text>`;
  }).join("");
  return `<svg class="months" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img">${grid}${bars}</svg>`;
}
function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

export function progress(fraction, color, title = "") {
  const f = Math.max(0, Math.min(1, fraction || 0));
  return `<div class="progress" title="${esc(title)}"><span style="width:${f * 100}%;background:${color}"></span></div>`;
}
