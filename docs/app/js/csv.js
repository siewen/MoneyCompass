// Bank statements (CSV) – ported from BankCsv.cs of the Windows app.

export function decode(buffer) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^﻿/, ""); }
  catch { return new TextDecoder("windows-1250").decode(buffer); }
}

const norm = s => s.trim().replace(/^#+/, "").trim().toLowerCase();

function countOutside(line, d) {
  let n = 0, q = false;
  for (const ch of line) { if (ch === '"') q = !q; else if (ch === d && !q) n++; }
  return n;
}
function findDelimiter(lines) {
  const sample = lines.filter(l => l.length).slice(0, 40);
  let best = ";", bestScore = -1;
  for (const d of [";", ",", "\t", "|"]) {
    const counts = sample.map(l => countOutside(l, d)).filter(c => c > 0);
    if (!counts.length) continue;
    const freq = new Map(); counts.forEach(c => freq.set(c, (freq.get(c) || 0) + 1));
    const [key, cnt] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
    const score = cnt * 10 + key;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}
function splitRows(text, d) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += (ch === "\n" || ch === "\r") ? " " : ch;
    } else if (ch === '"') q = true;
    else if (ch === d) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = ""; rows.push(row); row = [];
    } else cell += ch;
  }
  row.push(cell); rows.push(row);
  return rows;
}
function cleanCell(c) {
  c = c.trim();
  if (c.length >= 2 && c[0] === "'" && c[c.length - 1] === "'") c = c.slice(1, -1).trim();
  return c;
}
function isHeader(row) {
  const cells = row.map(norm);
  const hasDate = cells.some(c => c.startsWith("data") || c === "date" || c.includes("data operacji") || c.includes("data transakcji")
    || c === "transaction date" || c === "booking date" || c === "posting date");
  const hasAmount = cells.some(c => c.startsWith("kwota") || c.includes("obciążenia") || c.includes("obciazenia") || c.includes("uznania")
    || ["amount", "debits", "credits", "debit", "credit"].includes(c));
  return hasDate && hasAmount;
}
function find(header, ...names) {
  const cells = header.map(norm);
  for (const n of names) { const i = cells.indexOf(n); if (i >= 0) return i; }
  for (const n of names) { const i = cells.findIndex(c => c.startsWith(n)); if (i >= 0) return i; }
  return -1;
}
function fromHeader(h) {
  return {
    Date: find(h, "data operacji", "data transakcji", "data księgowania", "data ksiegowania", "data", "transaction date", "booking date", "date"),
    Amount: find(h, "kwota", "kwota operacji", "kwota transakcji (waluta rachunku)", "kwota transakcji", "amount"),
    Debit: find(h, "obciążenia", "obciazenia", "debits", "debit"),
    Credit: find(h, "uznania", "credits", "credit"),
    Description: find(h, "opis operacji", "opis transakcji", "tytuł", "tytul", "tytułem", "tytulem", "opis", "description", "title"),
    Counterparty: find(h, "dane kontrahenta", "nadawca / odbiorca", "odbiorca/zleceniodawca", "nadawca/odbiorca", "kontrahent", "odbiorca",
      "benefeciary/sender", "beneficiary/sender", "sender/recipient", "recipient/sender", "counterparty", "payee"),
    Category: find(h, "kategoria", "category"),
    Currency: find(h, "waluta", "currency"),
    Type: exact(h, "rodzaj transakcji", "typ transakcji", "typ operacji", "transaction type", "type"),
    // Account numbers, when the bank puts them in the file (only shown in the ⓘ info of an entry)
    OwnAccount: exact(h, "numer rachunku/karty", "account/card number", "account / card number", "account number/card", "card/account number", "account number",
      "own account", "rachunek źródłowy", "rachunek zrodlowy", "rachunek", "konto", "numer rachunku", "numer karty", "card number", "account"),
    OtherAccount: exact(h, "nr rachunku", "na konto/z konta", "rachunek kontrahenta", "rachunek odbiorcy/nadawcy", "rachunek nadawcy/odbiorcy",
      "rachunek docelowy", "counterparty account", "beneficiary account", "to account/from account", "to/from account", "from/to account", "beneficiary/sender account"),
  };
}
function exact(header, ...names) {
  const cells = header.map(norm);
  for (const n of names) { const i = cells.indexOf(n); if (i >= 0) return i; }
  return -1;
}
const ACCOUNT = /\b(?:PL)?\d{2}(?:[ ]?\d{4}){6}\b/;
/** "PL61 1090 1014 0000 0712 1981 2874" – an account number in the usual groups of 4 */
export function formatAccount(v) {
  const t = (v || "").replace(/\s+/g, "");
  const m = /^(PL)?(\d{26})$/.exec(t);
  if (!m) return (v || "").trim();
  return (m[1] || "") + m[2].slice(0, 2) + " " + m[2].slice(2).match(/.{4}/g).join(" ");
}
function recogniseBank(header) {
  const all = header.map(norm).join("|");
  if (header.some(c => c.trimStart().startsWith("#"))) return "mBank";
  if (all.includes("dane kontrahenta")) return "ING";
  if (all.includes("odbiorca/zleceniodawca") || all.includes("obciążenia") || all.includes("obciazenia")
    || all.includes("benefeciary/sender") || (all.includes("debits") && all.includes("credits"))) return "Millennium";
  if (all.includes("typ transakcji") && all.includes("opis transakcji")) return "PKO BP";
  if (all.includes("nadawca / odbiorca") || all.includes("tytułem")) return "Pekao";
  return "";
}

export function parseDate(value) {
  const v = (value || "").trim().replace(/^"|"$/g, "");
  if (v.length < 8 || v.length > 19) return null;
  let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(v);
  let y, mo, d;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else {
    m = /^(\d{1,2})[-./](\d{1,2})[-./](\d{4})(?: \d{1,2}:\d{2}(?::\d{2})?)?$/.exec(v);
    if (!m) return null;
    d = +m[1]; mo = +m[2]; y = +m[3];
  }
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}
export function parseAmount(value) {
  let v = (value || "").replace(/[\s ]|PLN|zł|EUR|USD|GBP|CHF/gi, "");
  if (!v || !/^[+-]?[\d.,]+$/.test(v) || !/\d/.test(v)) return null;
  const c = v.lastIndexOf(","), d = v.lastIndexOf(".");
  if (c >= 0 && d >= 0) v = c > d ? v.replace(/\./g, "").replace(",", ".") : v.replace(/,/g, "");
  else if (c >= 0) v = v.replace(/,/g, ".");
  if ((v.match(/\./g) || []).length > 1) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
const looksLikeId = v => /^\d{10,}$/.test(v.trim());

function guessMissing(file) {
  const c = file.columns, sample = file.rows.slice(0, 60);
  if (!sample.length) return;
  const count = columnCount(file);
  const share = (col, test) => sample.filter(r => col < r.length && test(r[col])).length / sample.length;
  if (c.Date < 0) for (let i = 0; i < count; i++) if (share(i, v => parseDate(v)) > 0.7) { c.Date = i; break; }
  if (c.Amount < 0 && c.Debit < 0) {
    let best = -1, bestNeg = 0;
    for (let i = 0; i < count; i++) {
      if (i === c.Date || share(i, v => parseAmount(v) !== null && !looksLikeId(v)) < 0.7) continue;
      const neg = share(i, v => (parseAmount(v) ?? 0) < 0);
      if (neg > bestNeg) { bestNeg = neg; best = i; }
    }
    c.Amount = best;
  }
  if (c.Description < 0 && c.Counterparty < 0) {
    let best = -1, bestLen = 0;
    for (let i = 0; i < count; i++) {
      if (i === c.Date || i === c.Amount || i === c.Debit) continue;
      const avg = sample.reduce((s, r) => s + (i < r.length && parseAmount(r[i]) === null ? r[i].length : 0), 0) / sample.length;
      if (avg > bestLen) { bestLen = avg; best = i; }
    }
    c.Description = best;
  }
}
/** Account columns found from the content, when the header names are unknown (e.g. an English export). */
const looksLikeAccount = v => { const t = (v || "").replace(/^'|'$/g, "").trim(); return ACCOUNT.test(t) || /^\d{4}[ ]?[*xX•.]{2,}[ *xX•.\d]*\d{4}$/.test(t); };
function guessAccounts(file) {
  const c = file.columns, sample = file.rows.slice(0, 200);
  if (!sample.length) return;
  const count = columnCount(file), used = new Set(Object.values(c).filter(i => i >= 0));
  const share = i => sample.filter(r => i < r.length && looksLikeAccount(r[i])).length / sample.length;
  for (let i = 0; i < count; i++) {
    if (used.has(i)) continue;
    const sh = share(i);
    if (c.OwnAccount < 0 && sh > 0.7) { c.OwnAccount = i; used.add(i); }
    else if (c.OtherAccount < 0 && sh > 0.02) { c.OtherAccount = i; used.add(i); }
  }
}
export const columnCount = f => Math.max(f.header.length, ...f.rows.map(r => r.length), 0);
export function columnName(f, i) {
  let name = i < f.header.length ? f.header[i].replace(/^[#\s]+|[#\s]+$/g, "") : "";
  if (!name.trim()) name = (f.rows.map(r => r[i] || "").find(v => v.trim()) || "");
  if (name.length > 40) name = name.slice(0, 39) + "…";
  return `${i + 1}: ${name}`;
}

export function parse(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const d = findDelimiter(lines);
  let rows = splitRows(text, d).map(r => r.map(cleanCell)).filter(r => r.some(c => c.length));
  const file = { header: [], rows: [], columns: { Date: -1, Amount: -1, Debit: -1, Credit: -1, Description: -1, Counterparty: -1, Category: -1, Currency: -1, OwnAccount: -1, OtherAccount: -1, Type: -1 }, bank: "", ownAccount: "" };
  const hi = rows.findIndex(isHeader);
  if (hi >= 0) {
    file.header = rows[hi]; file.rows = rows.slice(hi + 1);
    file.columns = fromHeader(file.header); file.bank = recogniseBank(file.header);
    // mBank & co. write your own account number above the table
    for (const r of rows.slice(0, hi)) { const m = r.map(c => ACCOUNT.exec(c)).find(Boolean); if (m) { file.ownAccount = m[0]; break; } }
  } else {
    if (rows.length > 1 && rows[0].some(c => /^(PL)?\d{2}( ?\d{4}){6}$/.test(c))) rows = rows.slice(1);
    file.rows = rows;
  }
  guessMissing(file);
  guessAccounts(file);
  if (file.columns.Date >= 0) file.rows = file.rows.filter(r => file.columns.Date < r.length && parseDate(r[file.columns.Date]));
  return file;
}

function describe(counterparty, description, row) {
  for (const cell of row) {
    const m = /(?:Nazwa odbiorcy|Nazwa nadawcy|Adres):\s*(.+?)(?:\s+(?:Miasto|Kraj|Adres odbiorcy|Adres nadawcy|Tytuł|Rachunek)\b|$)/i.exec(cell);
    if (m && m[1].trim().length > 1 && !counterparty.trim()) { counterparty = m[1].trim(); break; }
  }
  if (/^\s*(Rachunek (odbiorcy|nadawcy)|Numer karty|Tytuł:\s*[\d\s]*$)/i.test(description)) {
    description = "";
    for (const cell of row) {
      const t = /^\s*Tytuł:\s*(.+)$/i.exec(cell);
      if (t && !/^[\d\s]+$/.test(t[1])) { description = t[1].trim(); break; }
    }
  }
  if (/^\s*(Płatność kartą|Platnosc karta|Transakcja kartą)\b.*(Nr karty|\d{2}\.\d{2}\.\d{4})/i.test(description)) description = "";
  if (counterparty.trim() && /^\s*(Funds transfer|Przelew środków|\/OPT\/)/i.test(description)) description = "";
  let text = counterparty.trim() ? counterparty : description;
  if (counterparty.trim() && description.trim() && !/^\s*(Tytuł:)?\s*[\d\s]+$/.test(description)) text = `${counterparty} – ${description}`;
  text = text.replace(/^(ZAKUP PRZY UŻYCIU KARTY|ZAKUP PRZY UZYCIU KARTY|PŁATNOŚĆ KARTĄ|PLATNOSC KARTA|TRANSAKCJA KARTĄ|Płatność kartą)\s*/i, "");
  text = text.replace(/^DOP\.\s*(VISA|MC|MASTERCARD)\s*\d+\s*PŁATNOŚĆ KARTĄ\s*[\d.,]+\s*[A-Z]{3}\s*/i, "");
  text = text.replace(/\s+(?:[A-Z]{2,3}|[A-Z] ?[A-Z]{1,2})?\s*\d{4}-\d{2}-\d{2}\s*$/, "");
  text = text.replace(/\s+/g, " ").trim().replace(/^[\s\-–/]+|[\s\-–/]+$/g, "");
  text = text.replace(/\s+(P|PO|PO L|POL)$/, "");
  return text.length > 80 ? text.slice(0, 79).trimEnd() + "…" : text;
}

export function transactions(file, c) {
  const list = [];
  for (const r of file.rows) {
    const cell = i => i >= 0 && i < r.length ? r[i] : "";
    const date = parseDate(cell(c.Date));
    if (!date) continue;
    let amount = c.Amount >= 0 ? parseAmount(cell(c.Amount)) : null;
    if (amount === null && c.Debit >= 0) { const v = parseAmount(cell(c.Debit)); if (v) amount = -Math.abs(v); }
    if (amount === null && c.Credit >= 0) { const v = parseAmount(cell(c.Credit)); if (v) amount = Math.abs(v); }
    if (!amount) continue;
    const cur = /\b(PLN|EUR|USD|GBP|CHF)\b/.exec(cell(c.Currency) + " " + cell(c.Amount));
    list.push({
      date, amount, currency: cur ? cur[1] : "PLN",
      description: describe(cell(c.Counterparty), cell(c.Description), r),
      bankCategory: cell(c.Category),
      allText: r.filter(x => parseAmount(x) === null && !parseDate(x)).join(" "),
      counterparty: cell(c.Counterparty), ownAccount: false,
      info: rowInfo(file, c, r, cell, amount),
    });
  }
  markOwnAccounts(list);
  return list;
}
/** What the bank says about one transaction: accounts, name, title – kept as the ⓘ info of the entry. */
function rowInfo(file, c, r, cell, amount) {
  let own = c.OwnAccount >= 0 ? cell(c.OwnAccount) : "", other = c.OtherAccount >= 0 ? cell(c.OtherAccount) : "";
  // Pekao: "source" and "target" account – which one is yours depends on the direction
  const hdr = i => i >= 0 ? norm(file.header[i] || "") : "";
  if (/docelowy/.test(hdr(c.OtherAccount)) && /źródłowy|zrodlowy/.test(hdr(c.OwnAccount)) && amount > 0) [own, other] = [other, own];
  for (const x of r) {
    const m = /Rachunek (?:odbiorcy|nadawcy|kontrahenta)\s*:\s*((?:PL)?[\d ]{20,40})/i.exec(x);
    if (m && !other.trim()) other = m[1].trim();
  }
  if (!own.trim()) own = file.ownAccount || "";
  const info = { Bank: file.bank || "", Account: formatAccount(own), Name: cell(c.Counterparty).trim(), OtherAccount: formatAccount(other),
    Title: cell(c.Description).trim(), Category: cell(c.Category).trim(), Type: c.Type >= 0 ? cell(c.Type).trim() : "" };
  for (const k of Object.keys(info)) if (!info[k]) delete info[k];
  return info;
}
function words(s) { return new Set((s.toLowerCase().match(/\p{L}{3,}/gu) || [])); }
function markOwnAccounts(rows) {
  const own = rows.filter(r => isOwnTransfer(r) && r.counterparty.trim()).map(r => words(r.counterparty)).filter(w => w.size >= 2);
  if (!own.length) return;
  for (const row of rows) {
    const w = words(row.counterparty);
    if (own.some(name => [...name].every(x => w.has(x)))) row.ownAccount = true;
  }
}

export const isOwnTransfer = r => r.ownAccount || /przelew własny|przelew wlasny|na rachunek własny|między rachunkami|miedzy rachunkami|własne konto|wlasne konto|lokat[aęy]|konto oszczędnościowe|rachunek oszczędnościowy|zasilenie|spłata karty kredytowej|przelew środków własnych|own transfer/i.test(r.allText + " " + r.bankCategory);
// "Internal transfer" (e.g. Millennium) only means: to another account in the same bank – also someone else's. Not a sign of your own account.
export const isSavingsTransfer = r => /own transfer|przelew własny|przelew wlasny|oszczędn|oszczedn|lokat[aęy]|saving|deposit/i.test(r.allText + " " + r.bankCategory);

const RULES = [
  // Bank fees first: "opłata za kartę", "prowizja"… (before "kredyt" or "przelew" catch them)
  ["Bank fees", /opłat[ay] za (prowadzenie|kart|użytkowanie karty|uzytkowanie karty|wypłat|wyplat|przelew|sms|powiadom|rachun|konto|wydanie|pakiet|obsług|obslug|zestawien|wyciąg|wyciag|bankomat)|oplat[ay] za (prowadzenie|kart|wypłat|wyplat|przelew|sms|rachun|konto|pakiet|bankomat)|prowizj|opłata miesięczna|oplata miesieczna|opłata za ekspres|odsetki (od debetu|karne|od zadłużenia|od zadluzenia|od salda ujemnego)|bank fee|account fee|card fee|atm fee|service charge|monthly fee|commission/i],
  ["Food & groceries", /biedronk|\blidl|żabk|zabka|kaufland|carrefour|auchan|\bnetto\b|\bdino\b|stokrotk|lewiatan|\baldi\b|intermarch|polomarket|\bspar\b|delikates|piekarni|frisco|\bmarket\b|żywność|zywnosc|spożywcz/i],
  ["Restaurants & takeaway", /mcdonald|\bkfc\b|burger king|pizz|pyszne|glovo|uber ?eats|\bwolt\b|restaura|bistro|kebab|starbucks|costa coffee|kawiarni|\bcafe\b|subway|jedzenie poza domem|bar mleczny|sushi/i],
  ["Transport / fuel", /orlen|\bbp\b|\bshell\b|circle ?k|\bmoya\b|lotos|\bamic\b|\buber\b|\bbolt\b|free ?now|\bpkp\b|intercity|koleje|jakdojade|\bmpk\b|\bztm\b|skycash|parking|paliwo|transport|autostrad/i],
  ["Car insurance & service", /warsztat|serwis samoch|norauto|vulco|myjnia|wulkaniz|motoryzac|samochód|samochod|części samoch|ubezpieczenie oc|\boc\/ac\b/i],
  ["Electricity, gas, water, heating", /\bpge\b|tauron|\benea\b|energa|innogy|\be\.?on\b|pgnig|\bgaz\b|wodociąg|wodociag|\bmpwik\b|ciepł|ciepl|veolia|fortum|energia|prąd|prad/i],
  ["Subscriptions", /netflix|spotify|\bhbo\b|hbomax|max\.com|disney|youtube|apple\.com|google play|amazon prime|canal\+|player\.pl|tidal|microsoft|adobe|chatgpt|openai|anthropic|claude\.ai|subskryp|abonament/i],
  ["Internet & phone", /\borange\b|\bplay\b|\bplus\b|t-mobile|netia|\bupc\b|vectra|\binea\b|multimedia polska|heyah|\bnju\b|telefon|internet|telekom/i],
  ["Health & medicine", /aptek|lux ?med|medicover|enel-med|dentyst|stomatolog|lekarz|przychodni|\bdoz\b|zdrowie|szpital|optyk/i],
  ["Insurance", /\bpzu\b|warta|allianz|hestia|generali|uniqa|link4|aviva|compensa|ubezpiecz/i],
  ["Loan payments", /\brata\b|raty|kredyt|pożycz|pozycz|spłata|splata|leasing/i],
  ["Housing / rent", /czynsz|najem|wynajem|spółdzielni|spoldzielni|wspólnot|wspolnot|\btbs\b|towarzystwo bud|mieszkani|administracja/i],
  ["Hobbies & leisure", /\bkino\b|cinema city|multikino|helios|bilet|empik|steam|battle\.net|playstation|xbox|siłowni|silowni|fitness|multisport|rozrywk|sport|hobby|teatr|koncert/i],
  ["Travel", /booking\.com|airbnb|ryanair|wizz|\blot\b|hotel|flixbus|trivago|podróż|podroz|wakacj|biuro podróży/i],
  ["Shopping", /allegro|amazon|zalando|\bh&m\b|reserved|\bccc\b|ikea|castorama|leroy|\bobi\b|media ?markt|rtv euro|x-kom|morele|rossmann|hebe|pepco|\baction\b|temu|aliexpress|shein|decathlon|smyk|sinsay|odzież|odziez|zakupy|ubrania/i],
];
export function category(row) {
  for (const text of [row.bankCategory, row.description, row.allText]) {
    if (!text || !text.trim()) continue;
    for (const [cat, re] of RULES) if (re.test(text)) return cat;
  }
  return "Other";
}
