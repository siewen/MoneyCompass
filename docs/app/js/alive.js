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

// ---- Colour with meaning: tiles with a good / bad change glow green / red; empty hints become friendly panels ----
const TIPS = ["Pay yourself first: move your savings on payday, before you spend.", "Three months of essential costs is a good first emergency fund.", "Small leaks sink ships: check your subscriptions once a quarter.", "A saving account with a better rate costs you 15 minutes and earns all year.", "Pay the loan with the highest interest first – it saves the most.", "Review your numbers once a week; it takes five minutes.", "Round up your spending goal, not your savings goal.", "A budget is not a cage – it is permission to spend without guilt.", "Automate what matters: standing orders for savings and bills.", "Celebrate milestones – every filled ring is a real achievement."];
function decorate() {
  document.querySelectorAll("#page .kpi:not([data-tone])").forEach(k => {
    k.dataset.tone = k.querySelector(".delta.bad") ? "bad" : k.querySelector(".delta.good, .good") ? "good" : "none";
  });
  document.querySelectorAll("#page .hint:not([data-empty]), #page .cm-empty:not([data-empty])").forEach(h => {
    h.dataset.empty = "0";
    if (h.matches(".hint") && h.children.length === 0 && /^(No |Nothing|Mark an expense|Add your|Nothing yet|–$)/.test(h.textContent.trim()) && h.textContent.trim().length > 2) { h.dataset.empty = "1"; h.classList.add("mc-empty"); }
  });
  const ov = document.querySelector("#page .pg-title p");
  if (ov && !document.querySelector("#page .mc-tip") && document.documentElement.dataset.page === "overview") {
    const d = new Date(), tip = TIPS[(d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate()) % TIPS.length];
    const w = document.querySelector("#page .ov-wins") || document.querySelector("#page .pg-title");
    const el = document.createElement("div"); el.className = "mc-tip"; el.innerHTML = "<span>💡</span><p><b>Tip of the day:</b> " + tip + "</p>";
    w.after(el);
  }
}
let t2 = 0;
new MutationObserver(() => { clearTimeout(t2); t2 = setTimeout(decorate, 150); }).observe(document.body, { childList: true, subtree: true });
