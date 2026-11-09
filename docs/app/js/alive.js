// Makes the pages feel alive: numbers count up and cards rise in when you open a page.
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let lastPage = "";
function countUp(el) {
  const t = el.textContent, m = t.match(/\d[\d\s\u00a0.,]*/);
  if (!m || el.children.length) return;
  const raw = m[0].replace(/[\s\u00a0]/g, ""), sep = Math.max(raw.lastIndexOf(","), raw.lastIndexOf("."));
  const dec = sep >= 0 && raw.length - sep - 1 <= 2 ? raw.length - sep - 1 : 0;
  const num = parseFloat(dec ? raw.slice(0, sep).replace(/[.,]/g, "") + "." + raw.slice(sep + 1) : raw.replace(/[.,]/g, ""));
  if (!isFinite(num) || num === 0) return;
  const fmt = new Intl.NumberFormat(document.documentElement.lang || undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: true });
  const t0 = performance.now(), D = 900;
  const step = now => {
    const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3);
    el.textContent = k >= 1 ? t : t.replace(m[0], fmt.format(num * e));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function run() {
  const page = document.documentElement.dataset.page || "";
  if (page === lastPage || calm()) { lastPage = page; return; }
  lastPage = page;
  document.querySelectorAll(".kpi-t > b, .ov-wins span").forEach((e, i) => { if (e.matches(".kpi-t > b")) countUp(e); });
}
let timer = 0;
new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(run, 120); }).observe(document.body, { childList: true, subtree: true });
