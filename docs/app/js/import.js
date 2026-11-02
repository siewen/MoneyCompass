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

/** The one import: pick (or drop) a CSV file, recognise it, open the right import with it. */
export async function smartImport(fileObj = null) {
  if (!(await requirePro(T("Import bank statement")))) return;
  if (!fileObj) fileObj = await pickFile(".csv,.txt,text/csv");
  if (!fileObj) return;
  let file;
  try { file = Csv.parse(Csv.decode(await fileObj.arrayBuffer())); }
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
