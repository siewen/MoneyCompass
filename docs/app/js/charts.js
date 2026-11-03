// Small SVG charts: horizontal bars, donut, monthly bars, progress bar.
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function hbars(items) {
  const max = Math.max(1, ...items.map(i => i.value));
  return `<div class="hbars">${items.map(i => `
    <div class="hbar" data-tip="${esc(i.tip || `${i.label}: ${i.text}`)}">
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
      stroke-dasharray="${Math.max(0, len - gap)} ${c}" stroke-dashoffset="${-offset}" transform="rotate(-90 90 90)"><title>${esc(i.label)}: ${esc(i.text)} (${Math.round(i.value / total * 100)}%)</title></circle>`;
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
    <div class="legend-row${r.key ? " clickable" : ""}"${r.key ? ` data-cat="${esc(r.key)}"` : ""} data-tip="${esc(r.tip || [r.label, r.text, r.share].filter(Boolean).join(" · ") + (r.key ? "  🔍" : ""))}">
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
    return `<rect x="${x - bw - 1}" y="${top + plotH - hi}" width="${bw}" height="${hi}" rx="3" fill="#2E9E5B" stroke="#2E9E5B"${cur}><title>${esc(m.month)} · ${esc(names[0])}: ${esc(fmtValue(m.income))} · ${esc(names[1])}: ${esc(fmtValue(m.expenses))} · = ${esc(fmtValue(m.income - m.expenses))}</title></rect>
      <rect x="${x + 1}" y="${top + plotH - he}" width="${bw}" height="${he}" rx="3" fill="#C81E26" stroke="#C81E26"${cur}><title>${esc(m.month)} · ${esc(names[0])}: ${esc(fmtValue(m.income))} · ${esc(names[1])}: ${esc(fmtValue(m.expenses))} · = ${esc(fmtValue(m.income - m.expenses))}</title></rect>
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
  return `<div class="progress"${title ? ` data-tip="${esc(title)}"` : ""}><span style="width:${f * 100}%;background:${color}"></span></div>`;
}

/** Smooth wave lines over the months, one per series, with a soft colour under each line.
 *  series: [{ key, label, color (CSS colour or var), values: [] }]; labels: month names; hidden: Set of keys to leave out. */
export function waveChart(labels, series, fmtAxis, fmtValue, hidden = new Set()) {
  const w = 600, h = 240, left = 46, right = 10, top = 14, bottom = 28;
  const shown = series.filter(s => !hidden.has(s.key));
  const all = shown.flatMap(s => s.values).filter(v => v !== null && v !== undefined);   // null = no data that month
  const maxV = Math.max(1, ...all), minV = Math.min(0, ...all);
  const top0 = niceMax(maxV), bot0 = minV < 0 ? -niceMax(-minV) : 0, span = top0 - bot0 || 1;
  const plotW = w - left - right, plotH = h - top - bottom, n = labels.length;
  const X = i => left + (n === 1 ? plotW / 2 : plotW * i / (n - 1)), Y = v => top + (top0 - v) / span * plotH;
  let grid = "";
  for (let k = 0; k <= 4; k++) {
    const v = bot0 + span / 4 * k, y = Y(v);
    grid += `<line x1="${left}" x2="${w - right}" y1="${y}" y2="${y}" stroke="var(--grid)"${Math.abs(v) < 1e-9 ? ' stroke-width="1.5"' : ' stroke-dasharray="3 4"'}/>
      <text x="${left - 6}" y="${y + 4}" text-anchor="end" class="axis">${esc(fmtAxis(v))}</text>`;
  }
  const step = Math.max(1, Math.ceil(n / 12));
  const xl = labels.map((l, i) => i % step === 0 || i === n - 1 ? `<text x="${X(i)}" y="${h - 8}" text-anchor="middle" class="axis">${esc(l)}</text>` : "").join("");
  // Catmull-Rom → Bézier: a smooth wave through every point
  const path = pts => pts.length < 2 ? "" : pts.map((p, i) => {
    if (i === 0) return `M${p[0]},${p[1]}`;
    const p0 = pts[i - 2] || pts[i - 1], p1 = pts[i - 1], p3 = pts[i + 1] || p;
    const c1 = [p1[0] + (p[0] - p0[0]) / 6, p1[1] + (p[1] - p0[1]) / 6], c2 = [p[0] - (p3[0] - p1[0]) / 6, p[1] - (p3[1] - p1[1]) / 6];
    return `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  }).join(" ");
  const base = Y(Math.max(bot0, 0));
  const defs = shown.map(s => `<linearGradient id="wg-${s.key}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".28"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`).join("");
  const lines = shown.map(s => {
    const idx = s.values.map((v, i) => v === null || v === undefined ? -1 : i).filter(i => i >= 0);
    const pts = idx.map(i => [X(i), Y(s.values[i])]), d = path(pts);
    const area = d ? `<path d="${d} L${pts[pts.length - 1][0]},${base} L${pts[0][0]},${base} Z" fill="url(#wg-${s.key})" class="wave-area"/>` : "";
    const dots = pts.map((p, k) => `<circle cx="${p[0]}" cy="${p[1]}" r="${n > 18 ? 2.5 : 3.5}" fill="var(--card)" stroke="${s.color}" stroke-width="2" class="wave-dot"><title>${esc(labels[idx[k]])} · ${esc(s.label)}: ${esc(fmtValue(s.values[idx[k]]))}</title></circle>`).join("");
    return `${area}<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.6" stroke-linecap="round" class="wave-line"/>${dots}`;
  }).join("");
  return `<svg class="wave-chart" viewBox="0 0 ${w} ${h}" role="img"><defs>${defs}</defs>${grid}${lines}${xl}</svg>`;
}

/** Savings account chart: one panel, only lines.
 *  Balance lines (lines: [{ key, label, color, values: [number|null], dashed, main }]) use the left scale.
 *  Monthly movements (flows: same shape, amounts ≥ 0) use their own scale on the right, so small fees stay visible next to a big balance.
 *  hidden: Set of keys to leave out. future: index of the first forecast month (or labels.length). */
export function savingsChart(labels, lines, flows, fmtAxis, fmtValue, hidden = new Set(), future = labels.length, w = 1000, h1 = 250) {
  // Series marked left: true (big amounts like credits and debits) share the balance scale; the rest (interest, fees) use the right scale
  const L = [...lines, ...flows.filter(s => s.left)].filter(s => !hidden.has(s.key)), F = flows.filter(s => !s.left && !hidden.has(s.key));
  const left = 52, right = F.length ? 52 : 34, top = 14, bottom = 30, h = top + h1 + bottom;
  const n = labels.length, plotW = w - left - right, X = i => left + (n === 1 ? plotW / 2 : plotW * i / (n - 1));
  const vals = a => a.flatMap(s => s.values.filter(v => v !== null && v !== undefined));
  const lMax = niceMax(Math.max(1, ...vals(L)) / 4) * 4, Y1 = v => top + h1 - v / lMax * h1;
  const fMax = niceMax(Math.max(1, ...vals(F)) / 4) * 4, Y2 = v => top + h1 - v / fMax * h1;
  let out = "";
  for (let k = 0; k <= 4; k++) {
    const y = Y1(lMax / 4 * k);
    out += `<line x1="${left}" x2="${w - right}" y1="${y}" y2="${y}" stroke="var(--grid)"${k ? ' stroke-dasharray="3 4"' : ' stroke-width="1.5"'}/>`;
    if (L.length) out += `<text x="${left - 6}" y="${y + 4}" text-anchor="end" class="axis">${esc(fmtAxis(lMax / 4 * k))}</text>`;
    if (F.length) out += `<text x="${w - right + 6}" y="${y + 4}" class="axis">${esc(fmtAxis(fMax / 4 * k))}</text>`;
  }
  if (future < n) out += `<rect x="${X(future - 1)}" y="${top}" width="${X(n - 1) - X(future - 1)}" height="${h1}" fill="var(--grid)" opacity=".35"/><text x="${X(future - 1) + 6}" y="${top + 12}" class="axis">${esc(fmtValue.forecast || "")}</text>`;
  const draw = (s, Y, thin) => {
    const pts = s.values.map((v, i) => v === null || v === undefined ? null : [X(i), Y(v)]);
    let d = "", pen = false;
    pts.forEach(p => { if (!p) { pen = false; return; } d += `${pen ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)} `; pen = true; });
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.main ? 3 : thin ? 1.8 : 2.2}" stroke-linejoin="round" stroke-linecap="round"${s.dashed ? ' stroke-dasharray="6 5"' : ""}/>` +
      pts.map((p, i) => p ? `<circle cx="${p[0]}" cy="${p[1]}" r="${s.main ? 3.5 : 2.6}" fill="var(--card)" stroke="${s.color}" stroke-width="2"${n > 60 ? ' opacity="0"' : ""}><title>${esc(labels[i])}${esc(s.tips?.[i] ? s.tips[i] : " · " + s.label + ": " + fmtValue(s.values[i]))}</title></circle>` : "").join("");
  };
  out += F.map(s => draw(s, Y2, true)).join("") + L.filter(s => s.left).map(s => draw(s, Y1, true)).join("") + L.filter(s => !s.left).map(s => draw(s, Y1)).join("");
  const step = Math.max(1, Math.ceil(n / 12));
  out += labels.map((l, i) => i % step === 0 || i === n - 1 ? `<text x="${X(i)}" y="${h - 8}" text-anchor="middle" class="axis">${esc(l)}</text>` : "").join("");
  return `<svg class="savings-chart" viewBox="0 0 ${w} ${h}" role="img">${out}</svg>`;
}
