// One import for every bank statement (web app): the file says what it is.
// A current account (card payments, BLIK, salary…) goes to Outflows and Inflows; a savings account (interest, the 19% tax,
// transfers in and out, no shopping) goes to Savings. When the file doesn't say it clearly, MoneyCompass asks once.
import { T } from "./core.js";
import { esc, popup, pickFile, alertBox } from "./ui.js";
import * as Csv from "./csv.js";
import { requirePro } from "./app.js";

const INTEREST = /odsetk|kapitalizac|naliczen.{0,12}odset|interest|oprocentowani/i;
// Shopping and everyday payments: only on a current account
const SPENDING = /kart[aąęy]|karty\b|\bcard\b|blik|zakup|płatnoś|platnos|terminal|\bpos\b|visa|mastercard|apple ?pay|google ?pay|allegro|wypłata z bankomatu|wyplata z bankomatu|bankomat|\batm\b|wynagrodzenie|salary|polecenie zapłaty|direct debit|subskryp|abonament/i;

/** What kind of statement: { kind: "current" | "savings" | "unsure", interest, spending, rows } */
export function statementKind(file, name = "") {
  let rows = [];
  try { rows = Csv.transactions(file, file.columns); } catch { rows = []; }
  const text = r => r.allText + " " + (r.bankCategory || "");
  const interest = rows.filter(r => r.amount > 0 && INTEREST.test(text(r))).length;
  const spending = rows.filter(r => !INTEREST.test(text(r)) && SPENDING.test(text(r))).length;
  const n = rows.length, saysSavings = /oszcz|saving|lokat|sparkonto|epargne|épargne/i.test(name);
  let kind = "unsure";
  if (spending >= 3 || (n && spending / n > 0.2)) kind = "current";
  else if (interest >= 1 && spending === 0) kind = "savings";
  else if (saysSavings && spending < 3) kind = "savings";
  return { kind, interest, spending, rows: n };
}

/** Asks once when the file is not clear. Resolves to "current", "savings" or null (cancelled). */
function askKind(fileName) {
  return new Promise(resolve => {
    let res = null;
    const p = popup(`<div class="box-head"><span class="box-icon">⬆</span><h2>${esc(T("What kind of statement is this?"))}</h2></div>
      <p class="hint">${esc(fileName)}</p>
      <div class="kind-choice">
        <button class="kind-btn" data-k="current"><span>💳</span><b>${esc(T("Current account"))}</b><small>${esc(T("Card payments, bills, salary – goes to Outflows and Inflows"))}</small></button>
        <button class="kind-btn" data-k="savings"><span>🏦</span><b>${esc(T("Savings account"))}</b><small>${esc(T("Balance, interest, tax and the real rate – goes to Savings"))}</small></button>
      </div>
      <div class="box-buttons"><button class="btn second" data-close>${esc(T("Cancel"))}</button></div>`, { width: 520, cls: "box", onClose: () => resolve(res) });
    p.el.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { res = b.dataset.k; p.close(); });
  });
}

// ---------- The import centre: one window for every kind of import ----------
const ic = (d, s = 26) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const sol = (d, s = 30) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="currentColor" stroke="none" aria-hidden="true">${d}</svg>`;
const DK = '#0F171C';
const CLOUD = '<path d="M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 10a4 4 0 0 1 0 8z"/><path d="M12 16v-6M9 12.5l3-3 3 3"/>';
const KINDS = [
  { k: "all", icon: sol(`<path d="M6 2h9l5 5v15H6z"/><path d="M9 12h7M9 16h7M9 8h3" stroke="${DK}" stroke-width="1.8" stroke-linecap="round"/>`, 34), title: "Complete Statement", text: "Import income, expenses, transfers and full account activity.", chips: [["✓", "Recommended"], ["✓", "Inflows + Outflows"]], rec: true },
  { k: "in", icon: sol(`<path d="M10 3h4v9h4l-6 7-6-7h4z"/><path d="M5 21h14v-2H5z"/>`, 34), title: "Income Statement", text: "Import salary payments, refunds and incoming transactions.", chips: [["↓", "Inflows"]], cls: "blue" },
  { k: "out", icon: sol(`<path d="M10 21h4v-9h4l-6-7-6 7h4z"/><path d="M5 3h14v2H5z"/>`, 34), title: "Expense Statement", text: "Import purchases, transfers, withdrawals and outgoing transactions.", chips: [["+", "Outflows"]], cls: "red" },
  { k: "savings", icon: sol(`<path d="M4 12.500a8 6 0 0 1 8-6c3 0 5.500 1.300 6.500 3.200L21 9v4.500l-2 .600c-.6 1.100-1.500 2-2.600 2.600V20h-3.500v-1.500h-3V20H6.500v-3.800C5 15.300 4 14 4 12.500z"/><circle cx="15.500" cy="11" r="1" fill="${DK}"/>`, 34), title: "Savings Account Statement", text: "Import monthly balances, interest payments, taxes, fees and account growth.", chips: [["●", "Savings"]], cls: "purple" },
];
const BANKS = ["PKO BP", "Pekao", "mBank", "ING", "Millennium", "Santander", "Alior Bank", "BNP Paribas"];
const tile = x => `<button class="ii-card${x.k === "all" ? " on" : ""} ${x.cls || ""}" data-kind="${x.k}"><span class="ii-check">✓</span><span class="ii-ico">${x.icon}</span><b>${esc(T(x.title))}</b><small>${esc(T(x.text))}</small>
  <span class="ii-chips">${x.chips.map(([g, c]) => `<em class="${x.k === "all" ? "g" : ""}"><i>${g}</i>${esc(T(c))}</em>`).join("")}</span></button>`;
/** Opens the import centre: drop a file (recognised automatically) or choose what to import. */
export async function openImportCenter() {
  if (!(await requirePro(T("Import bank statement")))) return;
  const p = popup(`<div class="ii">
    <div class="ii-head"><span class="ii-hic">${sol(`<path d="M7 20a5.500 5.500 0 0 1-.8-10.900A7 7 0 0 1 19.500 11.500 4.300 4.300 0 0 1 18.500 20z"/><path d="M12 17.500v-7M8.800 13.500l3.200-3.200 3.200 3.200" fill="none" stroke="${DK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`, 40)}</span><div><h2>${esc(T("Import Financial Data"))}</h2><p>${esc(T("Import bank statements and let MoneyCompass automatically recognize and categorize your transactions."))}</p></div></div>
    <label class="ii-drop" tabindex="0"><input type="file" accept=".csv,.txt,text/csv" hidden>
      <span class="ii-cloud">${sol(`<path d="M7 20a5.500 5.500 0 0 1-.8-10.900A7 7 0 0 1 19.500 11.500 4.300 4.300 0 0 1 18.500 20z"/><path d="M12 17.500v-7M8.800 13.500l3.200-3.200 3.200 3.200" fill="none" stroke="${DK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`, 76)}</span><b>${esc(T("Drop your CSV file here"))}</b><span class="ii-or">${esc(T("or"))}</span>
      <span class="btn main ii-choose">${sol(`<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`, 20)} ${esc(T("Choose CSV File"))}</span>
      <small><b class="ii-i">i</b> ${esc(T("Supported financial statements are detected automatically."))}</small></label>
    <div class="ii-cols"><div class="ii-box"><h3>${sol(`<path d="M12 3l10 5H2z"/><path d="M4 10h3v8H4zM10.500 10h3v8h-3zM17 10h3v8h-3zM2 20h20v2H2z"/>`, 26)} ${esc(T("Current Account Statements"))}</h3><div class="ii-three">${KINDS.slice(0, 3).map(tile).join("")}</div></div>
      <div class="ii-box"><h3><span class="ii-pig">${KINDS[3].icon.replace('width="34" height="34"','width="26" height="26"')}</span> ${esc(T("Savings Account Statements"))}</h3><div class="ii-one">${tile(KINDS[3])}</div></div></div>
    <div class="ii-cols2"><div class="ii-box"><h3>${sol(`<path d="M12 3l10 5H2z"/><path d="M4 10h3v8H4zM10.500 10h3v8h-3zM17 10h3v8h-3zM2 20h20v2H2z"/>`, 24)} ${esc(T("Supported Banks"))}</h3>
        <div class="ii-banks">${BANKS.map(b => `<span>${sol(`<path d="M12 3l10 5H2z"/><path d="M4 10h3v8H4zM10.500 10h3v8h-3zM17 10h3v8h-3zM2 20h20v2H2z"/>`, 20)}${esc(b)}</span>`).join("")}</div><div class="ii-bfoot"><small>${esc(T("and most CSV exports automatically recognised."))}</small><em>✓ ${esc(T("Automatic Detection Enabled"))}</em></div></div>
      <div class="ii-box"><h3>${sol(`<path d="M12 2l9 3.500v6.500c0 5.200-3.800 8.800-9 10-5.200-1.200-9-4.800-9-10V5.500z"/><path d="M8.500 12l2.500 2.500 4.500-4.500" fill="none" stroke="${DK}" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/>`, 26)} ${esc(T("Security & Privacy"))}<span class="ii-priv">${sol(`<path d="M12 2l9 3.500v6.500c0 5.200-3.800 8.800-9 10-5.200-1.200-9-4.800-9-10V5.500z"/><path d="M8.500 12l2.500 2.500 4.500-4.500" fill="none" stroke="${DK}" stroke-width="2.200" stroke-linecap="round"/>`, 26)}${esc(T("Privacy Protected"))}</span></h3>
        <ul class="ii-sec">${["Files are processed locally on this device.", "No banking credentials are required.", "No personal data is uploaded.", "Statements are categorized automatically after import."].map(t => `<li><i>✓</i>${esc(T(t))}</li>`).join("")}</ul></div></div>
    <div class="ii-foot"><span class="ii-ready">${sol(`<path d="M12 2l9 3.500v6.500c0 5.200-3.800 8.800-9 10-5.200-1.200-9-4.800-9-10V5.500z"/><path d="M8.500 12l2.500 2.500 4.500-4.500" fill="none" stroke="${DK}" stroke-width="2.200" stroke-linecap="round"/>`, 28)} ${esc(T("Import ready. Your data remains private and secure."))}</span>
      <button class="btn main" data-go>${ic('<path d="M12 15V4M8 8l4-4 4 4"/><path d="M4 20h16"/>', 18)} ${esc(T("Import Statement"))}</button><button class="btn second" data-close>${esc(T("Cancel"))}</button></div></div>`, { width: 1000, cls: "import-dlg" });
  let kind = "all";
  const drop = p.el.querySelector(".ii-drop"), input = drop.querySelector("input");
  const go = f => { if (f) { p.close(); smartImport(f); } };
  input.onchange = () => go(input.files[0]);
  drop.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
  drop.addEventListener("dragover", e => { e.preventDefault(); e.stopPropagation(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => { e.preventDefault(); e.stopPropagation(); dragDepth = 0; document.body.classList.remove("drop-on"); go([...e.dataTransfer.files][0]); });
  p.el.querySelectorAll("[data-kind]").forEach(b => b.onclick = () => { kind = b.dataset.kind; p.el.querySelectorAll("[data-kind]").forEach(x => x.classList.toggle("on", x === b)); });
  p.el.querySelector("[data-go]").onclick = async () => {
    p.close();
    if (kind === "savings") return (await import("./savings-check.js")).openSavingsCheck();
    (await import("./pages-pro.js")).openBankImport(null, kind);
  };
}

/** The one import: pick (or drop) a CSV file, recognise it, open the right import with it. */
export async function smartImport(fileObj = null) {
  if (!(await requirePro(T("Import bank statement")))) return;
  if (!fileObj) fileObj = await pickFile(".csv,.txt,text/csv");
  if (!fileObj) return;
  let file;
  // A crypto platform export (Nexo) goes to Investments
  const raw = Csv.decode(await fileObj.arrayBuffer());
  const inv = await import("./invest-import.js");
  if (inv.isNexoCsv(raw)) { inv.openInvestImport(fileObj); return; }
  try { file = Csv.parse(raw); }
  catch (e) { await alertBox(T("Import bank statement"), T("The file could not be read: {0}", e.message)); return; }
  if (!file.rows.length) { await alertBox(T("Import bank statement"), T("No transactions found in this file. Please choose the CSV export of your account history.")); return; }
  let { kind } = statementKind(file, fileObj.name);
  if (kind === "unsure") kind = await askKind(fileObj.name);
  if (!kind) return;
  if (kind === "savings") (await import("./savings-check.js")).openSavingsCheck(fileObj);
  else (await import("./pages-pro.js")).openBankImport(fileObj);
}

// Drag a CSV file onto the app: the same import starts
let dragDepth = 0;
const hasFile = e => [...(e.dataTransfer?.types || [])].includes("Files");
window.addEventListener("dragenter", e => { if (!hasFile(e)) return; dragDepth++; document.body.classList.add("drop-on"); });
window.addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove("drop-on"); } });
window.addEventListener("dragover", e => { if (hasFile(e)) e.preventDefault(); });
window.addEventListener("drop", e => {
  if (!hasFile(e)) return;
  e.preventDefault(); dragDepth = 0; document.body.classList.remove("drop-on");
  if (document.body.classList.contains("is-locked")) return;
  const f = [...e.dataTransfer.files].find(x => /\.(csv|txt)$/i.test(x.name) || /csv|text/.test(x.type));
  if (f) smartImport(f);
  else alertBox(T("Import bank statement"), T("Please drop the CSV file of your bank statement."));
});
