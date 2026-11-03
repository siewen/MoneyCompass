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
const KINDS = [
  { k: "all", icon: "↕", c: "#0F766E", title: "Everything", text: "Salary, other income, card payments, bills and transfers in one go", to: "Inflows + Outflows" },
  { k: "out", icon: "↑", c: "#C2410C", title: "Expenses only", text: "Only the money going out – the income stays as it is", to: "Outflows" },
  { k: "in", icon: "↓", c: "#1D4ED8", title: "Income only", text: "Only the money coming in: salary, refunds, other income", to: "Inflows" },
  { k: "savings", icon: "🏦", c: "#15803D", title: "Savings account statement", text: "Balance month by month, interest, tax, fees and the real rate", to: "Savings" },
];
const tile = x => `<button class="ic-tile" data-kind="${x.k}" style="--c:${x.c}"><span class="ic-icon">${x.icon}</span>
  <span class="ic-text"><b>${esc(T(x.title))}</b><small>${esc(T(x.text))}</small></span><span class="ic-to">→ ${esc(T(x.to))}</span></button>`;
/** Opens the import centre: drop a file (recognised automatically) or choose what to import. */
export async function openImportCenter() {
  if (!(await requirePro(T("Import bank statement")))) return;
  const p = popup(`<div class="ic-head"><span class="ic-badge">⬆</span><div><h2>${esc(T("Import"))}</h2>
      <p class="hint">${esc(T("Bring in your statements – MoneyCompass recognises the file and sorts everything for you."))}</p></div></div>
    <label class="ic-drop" tabindex="0"><input type="file" accept=".csv,.txt,text/csv" hidden>
      <span class="ic-drop-icon">📄</span><b class="ic-desk">${esc(T("Drop your CSV file here"))}</b><b class="ic-touch">${esc(T("Choose your CSV file"))}</b>
      <span class="hint ic-desk">${esc(T("or click to choose it – the kind of statement is recognised automatically"))}</span><span class="hint ic-touch">${esc(T("The kind of statement is recognised automatically."))}</span></label>
    <h3 class="ic-sub">${esc(T("Current account"))} <small>→ ${esc(T("Inflows and Outflows"))}</small></h3>
    <div class="ic-grid">${KINDS.slice(0, 3).map(tile).join("")}</div>
    <h3 class="ic-sub">${esc(T("Savings account"))} <small>→ ${esc(T("Savings"))}</small></h3>
    <div class="ic-grid one-up">${KINDS.slice(3).map(tile).join("")}</div>
    <p class="ic-note">🔒 ${esc(T("The file is read only on this device. Recognised automatically: PKO BP, Pekao, mBank, ING, Millennium and most other banks' CSV exports."))}</p>
    <div class="popup-buttons"><button class="btn second" data-close>${esc(T("Close"))}</button></div>`, { width: 780, cls: "import-center" });
  const drop = p.el.querySelector(".ic-drop"), input = drop.querySelector("input");
  const go = f => { if (f) { p.close(); smartImport(f); } };
  input.onchange = () => go(input.files[0]);
  drop.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
  drop.addEventListener("dragover", e => { e.preventDefault(); e.stopPropagation(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => { e.preventDefault(); e.stopPropagation(); dragDepth = 0; document.body.classList.remove("drop-on"); go([...e.dataTransfer.files][0]); });
  p.el.querySelectorAll("[data-kind]").forEach(b => b.onclick = async () => {
    const k = b.dataset.kind; p.close();
    if (k === "savings") return (await import("./savings-check.js")).openSavingsCheck();
    (await import("./pages-pro.js")).openBankImport(null, k);
  });
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
