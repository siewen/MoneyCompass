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
const CLOUD = '<path d="M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 10a4 4 0 0 1 0 8z"/><path d="M12 16v-6M9 12.5l3-3 3 3"/>';
const KINDS = [
  { k: "all", icon: ic('<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h6M9 16h6"/>', 30), title: "Complete Statement", text: "Import income, expenses, transfers and full account activity.", chips: ["Recommended", "Inflows + Outflows"], rec: true },
  { k: "in", icon: ic('<path d="M12 4v13M7 12l5 5 5-5"/><path d="M5 20h14"/>', 30), title: "Income Statement", text: "Import salary payments, refunds and incoming transactions.", chips: ["Inflows"], cls: "blue" },
  { k: "out", icon: ic('<path d="M12 20V7M7 12l5-5 5 5"/><path d="M5 4h14"/>', 30), title: "Expense Statement", text: "Import purchases, transfers, withdrawals and outgoing transactions.", chips: ["Outflows"], cls: "red" },
  { k: "savings", icon: ic('<path d="M5 12a7 5.5 0 0 1 7-5.5c3 0 5 1.2 6 3l2-.5v4l-2 .5c-.5 1-1.3 1.7-2.3 2.2V19h-3v-1.5h-3.4V19H7.3v-3.6C5.8 14.5 5 13.3 5 12z"/><circle cx="15" cy="11" r=".9"/>', 30), title: "Savings Account Statement", text: "Import monthly balances, interest payments, taxes, fees and account growth.", chips: ["Savings"], cls: "purple" },
];
const BANKS = ["PKO BP", "Pekao", "mBank", "ING", "Millennium", "Santander", "Alior Bank", "BNP Paribas"];
const tile = x => `<button class="ii-card${x.k === "all" ? " on" : ""} ${x.cls || ""}" data-kind="${x.k}"><span class="ii-check">✓</span><span class="ii-ico">${x.icon}</span><b>${esc(T(x.title))}</b><small>${esc(T(x.text))}</small>
  <span class="ii-chips">${x.chips.map(c => `<em class="${c === "Recommended" || c === "Inflows + Outflows" ? "g" : ""}">${esc(T(c))}</em>`).join("")}</span></button>`;
/** Opens the import centre: drop a file (recognised automatically) or choose what to import. */
export async function openImportCenter() {
  if (!(await requirePro(T("Import bank statement")))) return;
  const p = popup(`<div class="ii">
    <div class="ii-head"><span class="ii-hic">${ic(CLOUD, 34)}</span><div><h2>${esc(T("Import Financial Data"))}</h2><p>${esc(T("Import bank statements and let MoneyCompass automatically recognize and categorize your transactions."))}</p></div></div>
    <label class="ii-drop" tabindex="0"><input type="file" accept=".csv,.txt,text/csv" hidden>
      <span class="ii-cloud">${ic(CLOUD, 54)}</span><b>${esc(T("Drop your CSV file here"))}</b><span class="ii-or">${esc(T("or"))}</span>
      <span class="btn main ii-choose">${ic('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', 18)} ${esc(T("Choose CSV File"))}</span>
      <small>ⓘ ${esc(T("Supported financial statements are detected automatically."))}</small></label>
    <div class="ii-cols"><div class="ii-box"><h3>${ic('<path d="M3 9l9-5 9 5z"/><path d="M5.5 9v9M10 9v9M14 9v9M18.5 9v9"/><path d="M3 21h18"/>', 22)} ${esc(T("Current Account Statements"))}</h3><div class="ii-three">${KINDS.slice(0, 3).map(tile).join("")}</div></div>
      <div class="ii-box"><h3>${ic(KINDS[3].icon.match(/<path.*<\/svg>/s)[0].replace("</svg>", ""), 22)} ${esc(T("Savings Account Statements"))}</h3><div class="ii-one">${tile(KINDS[3])}</div></div></div>
    <div class="ii-cols2"><div class="ii-box"><h3>${ic('<path d="M3 9l9-5 9 5z"/><path d="M5.5 9v9M10 9v9M14 9v9M18.5 9v9"/><path d="M3 21h18"/>', 20)} ${esc(T("Supported Banks"))}</h3>
        <div class="ii-banks">${BANKS.map(b => `<span>${esc(b)}</span>`).join("")}</div><div class="ii-bfoot"><small>${esc(T("and most CSV exports automatically recognised."))}</small><em>✓ ${esc(T("Automatic Detection Enabled"))}</em></div></div>
      <div class="ii-box"><h3>${ic('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>', 20)} ${esc(T("Security & Privacy"))}</h3>
        <ul class="ii-sec">${["Files are processed locally on this device.", "No banking credentials are required.", "No personal data is uploaded.", "Statements are categorized automatically after import."].map(t => `<li><i>✓</i>${esc(T(t))}</li>`).join("")}</ul></div></div>
    <div class="ii-foot"><span class="ii-ready">${ic('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>', 22)} ${esc(T("Import ready. Your data remains private and secure."))}</span>
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
