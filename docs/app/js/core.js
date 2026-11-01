// MoneyCompass web: data, storage, translations, money maths and advice.
// The data has exactly the same shape as the Windows app, so profile files work in both.
import { TABLE } from "./lang-table.js";
import { EXTRA } from "./lang-extra.js";

// ---------------------------------------------------------------- storage helpers

const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
};
export { store };

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16);
    }));

// ---------------------------------------------------------------- dates (saved like .NET: "2026-10-31T00:00:00")

export function today() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
export function parseDate(v) {
  if (!v) return today();
  if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : today();
}
const pad = n => String(n).padStart(2, "0");
export const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00`;
export const inputDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fmtDate = d => { d = parseDate(d); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`; };
export const monthStart = d => new Date(d.getFullYear(), d.getMonth(), 1);
export function addMonths(d, n) {
  // Like .NET AddMonths: the 31st becomes the last day of a shorter month
  const y = d.getFullYear(), m = d.getMonth() + n;
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(d.getDate(), last));
}
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const sameDay = (a, b) => a.getTime() === b.getTime();

// ---------------------------------------------------------------- the data (same as Models.cs)

export function newSettings() {
  return {
    MonthlyEssentials: 0, YearlyCosts: 0, EmergencyMonths: 3, BufferPercent: 10, UsdToPln: 0, EurToPln: 0,
    HelpButtonX: 0, HelpButtonY: 0, Language: "", AutoSaveProfile: true, CloseChoice: "", AskOnStart: true,
    MenuPosition: "top", ExportCharts: true, Design: "light", OnlineRates: true, CheckForUpdates: true,
    LastUpdateCheck: null, AutoExchangeRates: true, LicenseKey: "", Modules: [], CardOrder: {},
    LayoutIncluded: true, FreeExportsUsed: 0, LastProfileSaved: null, ProfileName: "", ProfilePicture: "", GuideHidden: false, NewsHidden: false,
  };
}
export function newData() {
  return { Incomes: [], Expenses: [], Holdings: [], Offers: [], Loans: [], Goals: [], Received: [],
           Transfers: [], Categories: [], Budgets: [], Recurring: [], Deleted: [], Settings: newSettings() };
}
/** Fills in anything missing (older files, files from the Windows app). */
export function normalise(d) {
  const base = newData();
  const out = Object.assign(base, d || {});
  for (const k of ["Incomes", "Expenses", "Holdings", "Offers", "Loans", "Goals", "Received", "Transfers", "Categories", "Budgets", "Recurring", "Deleted"])
    if (!Array.isArray(out[k])) out[k] = [];
  out.Settings = Object.assign(newSettings(), out.Settings || {});
  if (!Array.isArray(out.Settings.Modules)) out.Settings.Modules = [];
  // Older loans had a "Last payment" typed in by hand: now it is worked out from the amount, payment and interest
  for (const l of out.Loans) if (!l.Planned && l.Remaining > 0) planLoan(l);
  return out;
}
export const looksLikeProfile = d => d && typeof d === "object" && d.Settings && typeof d.Settings === "object"
  && ["Incomes", "Expenses", "Holdings"].some(k => Array.isArray(d[k]));

// ---------------------------------------------------------------- profiles in this browser

const INDEX = "mc-index";
function readIndex() {
  try { const i = JSON.parse(store.get(INDEX)); if (i && Array.isArray(i.ids)) return i; } catch { /* new */ }
  return { current: "", ids: [] };
}
function writeIndex(i) { store.set(INDEX, JSON.stringify(i)); }

export const State = { data: newData(), id: "", listeners: [] };

export function loadCurrent() {
  const idx = readIndex();
  if (!idx.current || !idx.ids.includes(idx.current)) {
    const id = uuid();
    idx.ids.push(id); idx.current = id; writeIndex(idx);
    State.id = id; State.data = newData(); save(); markFileBase(); return;
  }
  State.id = idx.current;
  try { State.data = normalise(JSON.parse(store.get("mc-p:" + idx.current))); }
  catch { State.data = newData(); }
  markFileBase();
}
let saveFailed = false;
export function save() {
  const ok = store.set("mc-p:" + State.id, JSON.stringify(State.data));
  saveFailed = !ok;
}
export const lastSaveFailed = () => saveFailed;

// Changes since the profile was opened or last saved as a file (layout and settings don't count):
// used to ask before the window is closed with the X
const fingerprint = () => { const { Settings, ...rest } = State.data; return State.id + JSON.stringify(rest); };
let fileBase = "";
export const markFileBase = () => { fileBase = fingerprint(); };
export const changedSinceFile = () => fileBase !== "" && fileBase !== fingerprint();

export function profiles() {
  const idx = readIndex();
  return idx.ids.map(id => {
    let s = {};
    try { s = JSON.parse(store.get("mc-p:" + id))?.Settings || {}; } catch { /* empty */ }
    return { id, name: id === State.id ? currentName() : (s.ProfileName || T("Me")), current: id === State.id };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
export function switchTo(id) { save(); const idx = readIndex(); idx.current = id; writeIndex(idx); loadCurrent(); }
export function createProfile(name, data) {
  save();
  const idx = readIndex(); const id = uuid();
  const d = normalise(data || newData());
  if (!data) { d.Settings.Language = State.data.Settings.Language; d.Settings.Design = State.data.Settings.Design; }
  d.Settings.ProfileName = name;
  store.set("mc-p:" + id, JSON.stringify(d));
  idx.ids.push(id); idx.current = id; writeIndex(idx); loadCurrent();
}
export function deleteProfile(id) {
  const idx = readIndex();
  idx.ids = idx.ids.filter(x => x !== id);
  store.remove("mc-p:" + id); store.remove("mc-pic:" + id);
  if (idx.current === id) idx.current = idx.ids[0] || "";
  writeIndex(idx); loadCurrent();
}
export function replaceData(d) { const name = State.data.Settings.ProfileName; State.data = normalise(d); if (!State.data.Settings.ProfileName) State.data.Settings.ProfileName = name; save(); }

export const picture = () => store.get("mc-pic:" + State.id);
export const setPicture = url => url ? store.set("mc-pic:" + State.id, url) : store.remove("mc-pic:" + State.id);

export function currentName() {
  const n = (State.data.Settings.ProfileName || "").trim();
  if (n) return n;
  return license.current?.name || T("Me");
}
export function initials(name) {
  const w = name.split(" ").filter(Boolean);
  if (!w.length) return "?";
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[w.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------- translations

export const LANGS = [["en", "English"], ["de", "Deutsch"], ["fr", "Français"], ["pl", "Polski"]];
export function lang() {
  const s = State.data.Settings;
  if (!LANGS.some(l => l[0] === s.Language)) {
    let pick = "";
    try { pick = store.get("mc-lang") || ""; } catch { /* none */ }
    if (!LANGS.some(l => l[0] === pick)) pick = (navigator.language || "en").slice(0, 2).toLowerCase();
    s.Language = LANGS.some(l => l[0] === pick) ? pick : "pl";   // made for Poland: Polish unless the browser speaks English, German or French
    save();
  }
  return s.Language;
}
export function T(english, ...args) {
  const l = lang();
  let text = english;
  if (l !== "en") text = (TABLE[l] && TABLE[l][english]) || (EXTRA[l] && EXTRA[l][english]) || english;
  return args.length ? text.replace(/\{(\d+)\}/g, (m, i) => (args[i] ?? m)) : text;
}
export function monthsCount(n) {
  switch (lang()) {
    case "pl": return n === 1 ? "1 miesiąc" : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? `${n} miesiące` : `${n} miesięcy`;
    case "de": return n === 1 ? "1 Monat" : `${n} Monate`;
    case "fr": return `${n} mois`;
    default: return n === 1 ? "1 month" : `${n} months`;
  }
}
const locales = { en: "en-GB", de: "de-DE", fr: "fr-FR", pl: "pl-PL" };
export const locale = () => locales[lang()];
export const monthName = d => { const s = parseDate(d).toLocaleDateString(locale(), { month: "long", year: "numeric" }); return s.charAt(0).toUpperCase() + s.slice(1); };
export const monthShort = d => parseDate(d).toLocaleDateString(locale(), { month: "short" }).replace(".", "");

// ---------------------------------------------------------------- numbers

const nf = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" });
const round2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
export const pln = v => nf.format(round2(v || 0)).replace(/ /g, " ") + " zł";
export const rate = v => (v || 0).toFixed(2).replace(".", ",") + "%";
export function amount(v, cur) {
  const n = nf.format(round2(v || 0)).replace(/ /g, " ");
  return cur === "USD" ? "$" + n : cur === "EUR" ? "€" + n : cur === "PLN" ? n + " zł" : n + " " + cur;
}
/** "1 234,50", "1234.5" → 1234.5. Empty → null. */
export function num(text) {
  if (text === null || text === undefined) return null;
  let v = String(text).replace(/[\s zł%]/g, "");
  if (!v) return null;
  const c = v.lastIndexOf(","), d = v.lastIndexOf(".");
  if (c >= 0 && d >= 0) v = c > d ? v.replace(/\./g, "").replace(",", ".") : v.replace(/,/g, "");
  else if (c >= 0) v = v.replace(",", ".");
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
export const plain = v => (v === 0 || v) ? String(Math.round(v * 100) / 100).replace(".", ",") : "";

// ---------------------------------------------------------------- license (same keys as the Windows app)

const PUBLIC_KEY = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE13kV127//P+BWPUsOX3hN2RZLj+EKAP2ANQYpknXmmsCAH2Bfb6osIz6+ro1qe7t+fZCXUuZrL1bRKu5CIvhEA==";
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const EPOCH = Date.UTC(2020, 0, 1);

function fromBase32(text) {
  const out = []; let buffer = 0, bits = 0;
  for (const raw of text) {
    const c = raw === "I" || raw === "L" ? "1" : raw === "O" ? "0" : raw;
    const v = ALPHABET.indexOf(c);
    if (v < 0) return null;
    buffer = ((buffer << 5) | v) & 0xffffff; bits += 5;
    if (bits >= 8) { out.push((buffer >> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(out);
}
const dayToDate = days => { const d = new Date(EPOCH + days * 86400000); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };

function readPayload(p) {
  if (p.length < 7 || (p[0] !== 1 && p[0] !== 2)) return null;
  const u16 = i => p[i] | (p[i + 1] << 8);
  const issued = dayToDate(u16(1)), expDays = u16(3), pro = (p[5] & 1) === 1, len = p[6];
  const dec = new TextDecoder();
  const expires = expDays === 0 ? null : dayToDate(expDays);
  if (p[0] === 1) {
    if (p.length !== 7 + len) return null;
    return { name: dec.decode(p.slice(7, 7 + len)), pro, issued, expires, email: "" };
  }
  if (p.length < 8 + len) return null;
  const elen = p[7 + len];
  if (p.length !== 8 + len + elen) return null;
  return { name: dec.decode(p.slice(7, 7 + len)), pro, issued, expires, email: dec.decode(p.slice(8 + len, 8 + len + elen)) };
}

let publicKey = null;
export async function verifyKey(key) {
  try {
    if (!key || !key.trim()) return null;
    const clean = key.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!clean.startsWith("MC1")) return null;
    const bytes = fromBase32(clean.slice(3));
    if (!bytes || bytes.length <= 64 + 7) return null;
    const payload = bytes.slice(0, bytes.length - 64), sig = bytes.slice(bytes.length - 64);
    if (!publicKey) {
      const raw = Uint8Array.from(atob(PUBLIC_KEY), c => c.charCodeAt(0));
      publicKey = await crypto.subtle.importKey("spki", raw, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    }
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, sig, payload);
    return ok ? readPayload(payload) : null;
  } catch { return null; }
}

export const license = {
  current: null,
  get expired() { return !!(this.current && this.current.expires && today() > this.current.expires); },
  get isPro() { return !!(this.current && this.current.pro && !this.expired); },
  async load() { this.current = await verifyKey(store.get("mc-license") || ""); },
  async activate(key) {
    const info = await verifyKey(key);
    if (!info) return T("This license key is not valid. Please check that you copied all of it.");
    if (info.expires && today() > info.expires) return T("This license key ended on {0}.", fmtDate(info.expires));
    store.set("mc-license", key.trim()); this.current = info; return null;
  },
  remove() { store.remove("mc-license"); this.current = null; },
  get status() {
    const l = this.current;
    if (!l) return T("Free version");
    if (this.expired) return T("Pro license of {0} ended on {1}", l.name, fmtDate(l.expires));
    return l.expires ? T("Pro – licensed to {0}, valid until {1}", l.name, fmtDate(l.expires)) : T("Pro – licensed to {0}", l.name);
  },
};
export const FREE_EXPORTS = 3;
export const freeExportsLeft = () => Math.max(0, FREE_EXPORTS - (State.data.Settings.FreeExportsUsed || 0));

// ---------------------------------------------------------------- modules

export const MODULES = [
  { code: "goals", name: "Savings goals", description: "Goals like a car or a holiday: progress and how much to save per month – shown in the Savings tab." },
  { code: "loans", name: "Loans & debts", description: "Credits and loans: what is left to pay, monthly payments and when you are debt-free." },
  { code: "budget", name: "Budget plan", description: "A monthly limit per expense category, with a warning when you go over." },
  { code: "calendar", name: "Payment calendar", description: "Everything that comes back every month – salary, bills, subscriptions, savings – in a calendar, with a preview of the next 1 to 12 months." },
];
export const moduleOn = code => license.isPro && State.data.Settings.Modules.includes(code);
export function setModule(code, on) {
  const list = State.data.Settings.Modules.filter(m => m !== code);
  if (on) list.push(code);
  State.data.Settings.Modules = list; save();
}

// ---------------------------------------------------------------- categories

export const OTHER = "Other";
export const BANK_FEES = "Bank fees";
const BUILT_IN = [
  ["Housing / rent", true, "🏠"], ["Electricity, gas, water, heating", true, "💡"], ["Internet & phone", true, "📱"],
  ["Food & groceries", true, "🛒"], ["Transport / fuel", true, "⛽"], ["Car insurance & service", true, "🚗"],
  ["Health & medicine", true, "💊"], ["Insurance", true, "🛡️"], ["Loan payments", true, "🏦"],
  ["Restaurants & takeaway", false, "🍽️"], ["Subscriptions", false, "📺"], ["Hobbies & leisure", false, "🎮"],
  ["Shopping", false, "🛍️"], ["Travel", false, "✈️"], [BANK_FEES, false, "🧾"],
].map(([Name, Essential, Icon]) => ({ Name, Essential, Icon, Custom: false }));
const OTHER_CAT = { Name: OTHER, Essential: false, Icon: "📦", Custom: false };
export const ICON_CHOICES = ["🏠", "💡", "📱", "🛒", "⛽", "🚗", "💊", "🛡️", "🏦", "🍽️", "📺", "🎮", "🛍️", "✈️", "📦",
  "👶", "🐶", "🐱", "🎓", "📚", "💇", "👗", "👟", "🎁", "🎉", "🏋️", "⚽", "🎵", "🎬", "🍺",
  "☕", "🚌", "🚲", "🅿️", "🔧", "🧾", "💼", "💻", "🖨️", "🌱", "🧹", "🏥", "🦷", "👓", "💰", "🚬"];

export const categories = () => [...BUILT_IN, ...State.data.Categories.map(c => ({ ...c, Custom: true })), OTHER_CAT];
export function findCategory(name) {
  if (name === OTHER) return OTHER_CAT;
  return BUILT_IN.find(c => c.Name === name) || (State.data.Categories.find(c => c.Name === name) ? { ...State.data.Categories.find(c => c.Name === name), Custom: true } : null);
}
export const categoryIcon = name => license.isPro ? (findCategory(name)?.Icon || "") : "";
export const categoryLabel = name => { const i = categoryIcon(name); return i ? `${i}  ${T(name)}` : T(name); };
export function addCategory(name, essential, icon) {
  name = (name || "").trim();
  if (!name) return T("Please enter a name.");
  if (name.length > 40) return T("Please use a shorter name (up to 40 letters).");
  const lower = s => s.toLowerCase();
  if (categories().some(c => lower(c.Name) === lower(name) || lower(T(c.Name)) === lower(name))) return T("This category already exists.");
  const stem = s => s.trim().toLowerCase().replace(/s+$/, "");
  const similar = categories().find(c => stem(c.Name) === stem(name) || stem(T(c.Name)) === stem(name));
  if (similar) return T("A very similar category already exists: {0}", T(similar.Name));
  State.data.Categories.push({ Name: name, Essential: !!essential, Icon: icon || "" }); save();
  return null;
}
export function removeCategory(name) {
  const d = State.data;
  d.Categories = d.Categories.filter(c => c.Name !== name);
  d.Expenses.forEach(e => { if (e.Category === name) e.Category = OTHER; });
  d.Budgets = d.Budgets.filter(b => b.Category !== name);
  save();
}

// ---------------------------------------------------------------- money maths (Calc.cs)

export const BELKA = 0.19;
export const LOAN_CATEGORY = "Loan payments";
export const ONE_TIME = "One-time";
export const FREQUENCIES = [["Monthly", 1], ["Every 2 weeks", 26 / 12], ["Weekly", 52 / 12], ["Daily", 365.25 / 12], ["Quarterly", 1 / 3],
  ["Twice a year", 1 / 6], ["Yearly", 1 / 12], [ONE_TIME, 0]];
// Your own repeat: "Every:3:d" = every 3 days, "Every:2:w" = every 2 weeks, "Every:5:m" = every 5 months
const CUSTOM = /^Every:(\d{1,3}):([dwm])$/;
export const customFrequency = (n, unit) => `Every:${Math.max(1, Math.min(999, Math.round(n) || 1))}:${unit}`;
export const parseCustom = f => { const m = CUSTOM.exec(f || ""); return m ? { n: +m[1], unit: m[2] } : null; };
/** How a repeat is shown: "Monthly", "Every 3 days"… */
export function freqLabel(f) {
  const c = parseCustom(f);
  if (!c) return T(f || "Monthly");
  return T(c.unit === "d" ? (c.n === 1 ? "Daily" : "Every {0} days") : c.unit === "w" ? (c.n === 1 ? "Weekly" : "Every {0} weeks") : (c.n === 1 ? "Monthly" : "Every {0} months"), c.n);
}
export const RECEIVED = { income: "income", salary: "salary", none: "none" };

export const Calc = {
  emergency(s) {
    const monthly = (s.MonthlyEssentials || 0) + (s.YearlyCosts || 0) / 12;
    const buffer = 1 + (s.BufferPercent || 0) / 100;
    return { monthly, three: monthly * 3 * buffer, six: monthly * 6 * buffer, target: monthly * (s.EmergencyMonths || 0) * buffer };
  },
  groupMonths(expenses) {
    const map = new Map();
    for (const e of expenses) {
      const d = parseDate(e.Date), key = d.getFullYear() * 12 + d.getMonth();
      if (!map.has(key)) map.set(key, { key, start: monthStart(d), items: [] });
      map.get(key).items.push(e);
    }
    return [...map.values()].sort((a, b) => b.key - a.key);
  },
  /** Which days your data really covers: the last 1–3 months with expenses, and for each month the days from the
   *  first to the last entry (a whole month when it starts and ends near the month's edges). "units" is the number
   *  of months this is worth – e.g. one week of October ≈ 0,23 – used to turn totals into "per month". */
  coverage(d) {
    const months = this.groupMonths(this.countedExpenses(d)).slice(0, 3);
    if (!months.length) return { months: [], units: 0, days: 0, partial: false, from: null, to: null };
    const all = [...d.Expenses, ...d.Received, ...d.Transfers].map(x => parseDate(x.Date)).filter(x => x && !isNaN(x));
    let units = 0, days = 0, partial = false, from = null, to = null;
    for (const m of months) {
      const start = m.start, monthEnd = addDays(addMonths(start, 1), -1), end = monthEnd < today() ? monthEnd : today();
      const inM = all.filter(t => t >= start && t <= end);
      let a = new Date(Math.min(...inM)), b = new Date(Math.max(...inM));
      if ((a - start) / 86400000 <= 4) a = start;          // starts near the 1st: from the 1st
      if ((end - b) / 86400000 <= 4) b = end;              // ends near the month end (or today): until then
      const span = Math.round((b - a) / 86400000) + 1, len = Math.round((monthEnd - start) / 86400000) + 1;
      if (span < len - 0.5) partial = true;
      units += span / len; days += span;
      from = !from || a < from ? a : from; to = !to || b > to ? b : to;
    }
    return { months, units: Math.max(units, 1 / 31), days, partial, short: days < 21, from, to };
  },
  averages(expenses, maxMonths = 3, units = null) {
    const months = this.groupMonths(expenses).slice(0, maxMonths);
    if (!months.length) return { essential: 0, nonEssential: 0, monthsUsed: 0, label: "" };
    let ess = 0, other = 0;
    for (const m of months) for (const e of m.items) (e.Essential ? (ess += e.Amount) : (other += e.Amount));
    const label = [...months].reverse().map(m => `${pad(m.start.getMonth() + 1)}.${m.start.getFullYear()}`).join(", ");
    const div = units || months.length;
    return { essential: ess / div, nonEssential: other / div, monthsUsed: months.length, label };
  },
  receivedIn(d, month) {
    const start = monthStart(month), end = addMonths(start, 1);
    return d.Received.filter(r => r.Kind === RECEIVED.income && parseDate(r.Date) >= start && parseDate(r.Date) < end).reduce((s, r) => s + r.Amount, 0);
  },
  /** Money in during one month: salary as really received (or as planned from your income sources) + extra income received. */
  monthIncome(d, start, end) {
    const inMonth = r => { const t = parseDate(r.Date); return t >= start && t <= end; };
    const salary = d.Received.filter(r => r.Kind === RECEIVED.salary && inMonth(r)).reduce((s, r) => s + r.Amount, 0);
    const planned = this.upcoming(d, start, end).reduce((s, p) => s + p.amount, 0);
    const extra = d.Received.filter(r => r.Kind === RECEIVED.income && inMonth(r)).reduce((s, r) => s + r.Amount, 0);
    return { salary: salary > 0 ? salary : planned, extra, total: (salary > 0 ? salary : planned) + extra };
  },
  /** Income per month for the same months as the expense averages (your imported or entered period).
   *  Without expenses yet: your regular income from the income sources. */
  periodIncome(d) {
    const cov = this.coverage(d), months = cov.months;
    if (!months.length) return { perMonth: this.income(d).monthlyTotal, salary: this.income(d).monthlyTotal, extra: 0, months: 0 };
    let salary = 0, extra = 0;
    for (const m of months) {
      const start = monthStart(m.start), end = addDays(addMonths(start, 1), -1);
      const x = this.monthIncome(d, start, end);
      salary += x.salary; extra += x.extra;
    }
    // Salary is paid once a month; extra income is turned into "per month" by the days really covered
    salary /= months.length; extra /= cov.units;
    return { perMonth: salary + extra, salary, extra, months: months.length };
  },
  totalIncome(d) { return this.periodIncome(d).perMonth; },
  loanPayments(d, month) {
    if (!moduleOn("loans")) return 0;
    const start = monthStart(month || today());
    return d.Loans.filter(l => l.Remaining > 0 && parseDate(l.EndDate) >= start).reduce((s, l) => s + l.MonthlyPayment, 0);
  },
  loansCounted(d) { return this.loanPayments(d) > 0; },
  countedExpenses(d) { return this.loansCounted(d) ? d.Expenses.filter(e => e.Category !== LOAN_CATEGORY) : d.Expenses; },
  /** Regular payments added in the Payment calendar that fall in this month and are NOT already among your
   *  expenses (same amount within 5%, within 5 days) – e.g. paid from a bank you don't import. */
  recurringIn(d, start, end) {
    if (!moduleOn("calendar")) return [];
    const out = [];
    for (const r of (d.Recurring || []).filter(r => r.Active !== false && r.Kind !== "saving" && r.Amount > 0)) {
      const last = r.EndDate ? parseDate(r.EndDate) : null;
      let next = this.nextPayment(r, start), guard = 0;
      while (next && next <= end && (!last || next <= last) && guard++ < 62) {
        const n = next;
        const known = d.Expenses.some(e => Math.abs(parseDate(e.Date) - n) <= 5 * 86400000 && Math.abs(e.Amount - r.Amount) <= r.Amount * 0.05);
        if (!known) out.push({ category: r.Category || OTHER, amount: r.Amount, essential: !!findCategory(r.Category)?.Essential });
        if (r.Frequency === ONE_TIME) break;
        next = this.nextPayment(r, addDays(next, 1));
      }
    }
    return out;
  },
  /** The same months as the expense averages (or this month when there are no expenses yet). */
  basisMonths(d) {
    const months = this.groupMonths(this.countedExpenses(d)).slice(0, 3).map(m => m.start);
    return months.length ? months : [monthStart(today())];
  },
  recurringPerMonth(d) {
    const months = this.basisMonths(d), list = [];
    // Regular payments count once per month – they are known monthly amounts, so no estimate is needed
    for (const m of months) list.push(...this.recurringIn(d, m, addDays(addMonths(m, 1), -1)));
    const per = { essential: 0, other: 0, byCategory: new Map() };
    for (const x of list) {
      per[x.essential ? "essential" : "other"] += x.amount / months.length;
      per.byCategory.set(x.category, (per.byCategory.get(x.category) || 0) + x.amount / months.length);
    }
    return per;
  },
  spending(d) {
    const cov = this.coverage(d);
    const avg = { ...this.averages(this.countedExpenses(d), 3, cov.units), estimate: cov.partial, days: cov.days, from: cov.from, to: cov.to };
    const loans = this.loanPayments(d), rec = this.recurringPerMonth(d);
    if (loans <= 0 && rec.essential + rec.other <= 0) return avg;
    return { ...avg, essential: avg.essential + loans + rec.essential, nonEssential: avg.nonEssential + rec.other, monthsUsed: Math.max(1, avg.monthsUsed) };
  },
  savings(o) {
    if (!(o.Amount > 0) || !(o.PeriodDays > 0)) return { promo: 0, after: 0, gross: 0, tax: 0, net: 0, effective: 0 };
    const promoDays = Math.min(Math.max(o.PromoDays || 0, 0), o.PeriodDays);
    const afterDays = o.PeriodDays - promoDays;
    const inPromo = o.PromoLimit > 0 ? Math.min(o.Amount, o.PromoLimit) : o.Amount;
    const over = o.Amount - inPromo;
    const promo = inPromo * (o.PromoRate || 0) / 100 * promoDays / 365 + over * (o.StandardRate || 0) / 100 * promoDays / 365;
    const after = o.Amount * (o.StandardRate || 0) / 100 * afterDays / 365;
    const gross = promo + after;
    const tax = o.ApplyTax ? round2(gross * BELKA) : 0;
    const net = gross - tax;
    return { promo, after, gross, tax, net, effective: net / o.Amount * 365 / o.PeriodDays * 100 };
  },
  toPln(value, currency, s) { return currency === "USD" ? value * (s.UsdToPln || 0) : currency === "EUR" ? value * (s.EurToPln || 0) : value; },
  rateMissing(currency, s) { return (currency === "USD" && !(s.UsdToPln > 0)) || (currency === "EUR" && !(s.EurToPln > 0)); },
  stepN(start, freq, n) {
    switch (freq) {
      case "Daily": return addDays(start, n);
      case "Weekly": return addDays(start, 7 * n);
      case "Every 2 weeks": return addDays(start, 14 * n);
      case "Quarterly": return addMonths(start, 3 * n);
      case "Twice a year": return addMonths(start, 6 * n);
      case "Yearly": return addMonths(start, 12 * n);
      default: {
        const c = parseCustom(freq);
        if (c) return c.unit === "d" ? addDays(start, c.n * n) : c.unit === "w" ? addDays(start, 7 * c.n * n) : addMonths(start, c.n * n);
        return addMonths(start, n);
      }
    }
  },
  nextPayment(i, from) {
    const start = parseDate(i.Date);
    if (i.Frequency === ONE_TIME) return start >= from ? start : null;
    let n = 0;
    if (start >= from) { while (this.stepN(start, i.Frequency, n - 1) >= from) n--; }
    else { while (this.stepN(start, i.Frequency, n) < from) n++; }
    return this.stepN(start, i.Frequency, n);
  },
  upcoming(d, from, to) {
    const list = [];
    for (const i of d.Incomes.filter(x => x.Active)) {
      const amt = this.toPln(i.Amount, i.Currency, d.Settings);
      let next = this.nextPayment(i, from), guard = 0;
      while (next && next <= to && guard++ < 500) {
        list.push({ source: i, date: next, amount: amt });
        if (i.Frequency === ONE_TIME) break;
        next = this.nextPayment(i, addDays(next, 1));
      }
    }
    return list.sort((a, b) => a.date - b.date);
  },
  perMonth(freq) {
    const f = FREQUENCIES.find(x => x[0] === freq);
    if (f) return f[1];
    const c = parseCustom(freq);
    return c ? (c.unit === "d" ? 365.25 / 12 : c.unit === "w" ? 52 / 12 : 1) / c.n : 1;
  },
  monthlyPln(i, s) { return this.toPln(i.Amount, i.Currency, s) * this.perMonth(i.Frequency); },
  income(d) {
    let total = 0, oneTime = 0, count = 0, missing = false;
    const year = today().getFullYear();
    for (const i of d.Incomes.filter(x => x.Active)) {
      if (this.rateMissing(i.Currency, d.Settings)) missing = true;
      if (i.Frequency === ONE_TIME) { if (parseDate(i.Date).getFullYear() === year) oneTime += this.toPln(i.Amount, i.Currency, d.Settings); }
      else { total += this.monthlyPln(i, d.Settings); count++; }
    }
    return { monthlyTotal: total, activeSources: count, oneTimeThisYear: oneTime, missing };
  },
  portfolio(d) {
    let total = 0, safe = 0, risky = 0, yearly = 0, missing = false;
    for (const h of d.Holdings) {
      if (this.rateMissing(h.Currency, d.Settings)) missing = true;
      const v = this.toPln(h.Amount, h.Currency, d.Settings);
      total += v; if (h.Safe) safe += v; else risky += v;
      yearly += v * currentRate(h) / 100;
    }
    return { total, safe, risky, yearly, missing };
  },
  spentThisMonth(category) {
    const start = monthStart(today()), end = addMonths(start, 1);
    return State.data.Expenses.filter(e => e.Category === category && parseDate(e.Date) >= start && parseDate(e.Date) < end).reduce((s, e) => s + e.Amount, 0)
      + Calc.recurringIn(State.data, start, today()).filter(x => x.category === category).reduce((s, x) => s + x.amount, 0);
  },
};

// ---------------------------------------------------------------- chart numbers (ChartData.cs)

export const COLORS = { income: "#2a78d6", expenses: "#eb6834", leftOver: "#1baf7a", other: "#a3a3a0",
  series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"] };

export const ChartData = {
  inOut(d) {
    const income = Calc.totalIncome(d), avg = Calc.spending(d), spending = avg.essential + avg.nonEssential, left = income - spending;
    return [
      { label: T("Inflows"), value: income, color: COLORS.income, text: pln(income) },
      { label: T("Outflows"), value: spending, color: COLORS.expenses, text: pln(spending) },
      { label: T("Balance"), value: Math.max(0, left), color: COLORS.leftOver, text: pln(left) },
    ];
  },
  hasInOut(d) { return Calc.totalIncome(d) > 0 || Calc.spending(d).monthsUsed > 0; },
  trend(d) {
    const thisMonth = monthStart(today());
    let first = addMonths(thisMonth, -5);
    if (d.Expenses.length) {
      const fm = monthStart(new Date(Math.min(...d.Expenses.map(e => parseDate(e.Date).getTime()))));
      if (fm > first) first = fm > thisMonth ? thisMonth : fm;
    }
    const count = (thisMonth.getFullYear() - first.getFullYear()) * 12 + thisMonth.getMonth() - first.getMonth() + 1;
    const out = [];
    for (let n = 0; n < count; n++) {
      const start = addMonths(first, n), end = addDays(addMonths(start, 1), -1);
      // Past months: salary as really received when imported; the current month: as planned
      const income = start.getTime() === thisMonth.getTime()
        ? Calc.upcoming(d, start, end).reduce((s, p) => s + p.amount, 0) + Calc.receivedIn(d, start)
        : Calc.monthIncome(d, start, end).total;
      const expenses = Calc.countedExpenses(d).filter(e => parseDate(e.Date) >= start && parseDate(e.Date) <= end).reduce((s, e) => s + e.Amount, 0)
        + Calc.loanPayments(d, start) + Calc.recurringIn(d, start, end).reduce((s, x) => s + x.amount, 0);
      out.push({ month: monthShort(start), start, income, expenses, current: start.getTime() === thisMonth.getTime() });
    }
    return out;
  },
  categories(d) {
    const by = Advisor.spendingByCategory(d);
    const total = by.reduce((s, c) => s + c.perMonth, 0);
    const slices = by.slice(0, 6).map((c, n) => ({ label: T(c.category), key: c.category, value: c.perMonth, color: COLORS.series[n], text: pln(c.perMonth), icon: categoryIcon(c.category) }));
    if (by.length > 6) {
      const rest = by.slice(6).reduce((s, c) => s + c.perMonth, 0);
      slices.push({ label: T("Everything else"), value: rest, color: COLORS.other, text: pln(rest) });
    }
    return { slices, total, all: by };
  },
  money(p) {
    return [
      { label: T("Safe money"), value: p.safe, color: COLORS.income, text: pln(p.safe) },
      { label: T("Risky money"), value: p.risky, color: COLORS.expenses, text: pln(p.risky) },
    ];
  },
  share(value, total) { return total > 0 ? `${Math.round(value / total * 100)}%` : ""; },
};

// ---------------------------------------------------------------- advice (Advisor.cs)

export const Advisor = {
  analyse(d) {
    const list = [];
    const income = Calc.totalIncome(d), avg = Calc.spending(d);
    const spending = avg.essential + avg.nonEssential, left = income - spending;
    const p = Calc.portfolio(d), target = Calc.emergency(d.Settings).target, missing = target - p.safe;
    const best = this.bestOffer(d);
    const add = (kind, title, text, benefit, route, action) => list.push({ kind, title, text, benefit, route, action });

    if (income <= 0 || avg.monthsUsed === 0)
      add("tip", T("Enter your income and expenses first"), T("The more you enter in the Inflows and Outflows tabs, the better MoneyCompass can suggest how to save. One month of expenses is enough to start."), 0, "income");
    if (income > 0 && avg.monthsUsed > 0 && left < 0)
      add("warning", T("You spend more than you earn"), T("On average you are {0} short every month. Look at the not-essential costs first, before saving or investing.", pln(-left)), -left * 12, "expenses");
    if (target <= 0)
      add("safety", T("Set your emergency fund target"), T("Before investing, keep 3–6 months of essential costs in a safe bank account. Enter your costs in the Emergency fund tab."), 0, "emergency");
    else if (missing > 0) {
      const text = left > 0
        ? T("You still need {0} in safe money. Putting {1} aside every month, you reach your target in about {2} month(s). Keep it in a savings account in złoty, not in crypto.", pln(missing), pln(Math.min(left, missing)), Math.ceil(missing / Math.max(1, left)))
        : T("You still need {0} in safe money. Keep it in a savings account in złoty, not in crypto.", pln(missing));
      add("safety", T("Build your emergency fund first"), text, 0, "emergency");
    }
    if (p.total > 0 && p.risky / p.total > 0.5 && missing > 0)
      add("safety", T("Most of your money is in risky places"), T("{0}% of your money is on crypto platforms or investments, but your emergency fund isn't full. Consider moving {1} to a guaranteed bank account.", Math.round(p.risky / p.total * 100), pln(Math.min(missing, p.risky))), 0, "portfolio");
    if (best) {
      for (const h of d.Holdings.filter(h => h.Safe)) {
        const v = Calc.toPln(h.Amount, h.Currency, d.Settings);
        const movable = best.limit > 0 ? Math.min(v, best.limit) : v;
        const gain = movable * (best.rate - (h.RatePercent || 0)) / 100 * (1 - BELKA);
        if (v >= 1000 && gain >= 50)
          add("money", T("Move \"{0}\" to a better offer", h.Name), T("It earns {0}. Your best saved offer \"{1}\" pays on average {2} per year (promo and the rate after it together). Check that you meet the offer's conditions (new money, card payments...).", fmtPct(h.RatePercent), best.name, fmtPct(best.rate)), gain, "savings");
      }
    } else {
      const low = d.Holdings.filter(h => h.Safe && (h.RatePercent || 0) < 2 && Calc.toPln(h.Amount, h.Currency, d.Settings) >= 1000);
      if (low.length)
        add("money", T("Your savings earn almost nothing"), T("{0} sits in accounts paying under 2%. Banks often offer 5–6% for new money. Enter a few offers in the Compare offers tab and MoneyCompass shows you exactly how much you'd gain.", pln(low.reduce((s, h) => s + Calc.toPln(h.Amount, h.Currency, d.Settings), 0))), 0, "savings", T("Compare offers"));
    }
    if (avg.monthsUsed > 0 && avg.nonEssential > 0) {
      const top = this.topNonEssential(d);
      for (let i = 0; i < top.length; i++) {
        const c = top[i];
        if (i > 0 && c.perMonth < top[0].perMonth * 0.6) break;
        const cut = c.perMonth * 0.2;
        add("money", T("Spend a little less on \"{0}\"", T(c.category)), i === 0
          ? T("It's your biggest not-essential cost: about {0} per month. Spending 20% less there saves {1} per month.", pln(c.perMonth), pln(cut))
          : T("Another big not-essential cost: about {0} per month. Spending 20% less there saves {1} per month.", pln(c.perMonth), pln(cut)), cut * 12, "expenses");
      }
    }
    // Bank fees: many Polish banks have accounts and cards without fees
    const fees = Advisor.perCategory(d, e => e.Category === BANK_FEES)[0]?.perMonth || 0;
    if (fees >= 5)
      add("money", T("You pay {0} a month in bank fees", pln(fees)), T("Account, card, ATM or transfer fees add up to {0} a year. Many Polish banks have a free account and card if you meet simple conditions (e.g. a monthly salary payment or a few card payments) – check your bank's conditions or switch.", pln(fees * 12)), fees * 12, "expenses");
    if (income > 0 && avg.monthsUsed > 0 && left >= 0) {
      const r = left / income * 100;
      if (r < 20) {
        const needed = income * 0.2 - left;
        add("tip", T("Aim to save 20% of your income"), T("You save {0}% now. To reach 20% you need {1} more per month. A standing order on payday makes it automatic.", Math.round(r), pln(needed)), needed * 12, "expenses");
      }
    }
    if (left > 0 && missing <= 0 && target > 0) {
      const r = best ? best.rate : 0;
      const gain = r > 0 ? left * 12 * r / 100 / 2 * (1 - BELKA) : 0;
      add("money", T("Put your monthly surplus to work"), T("Your emergency fund is complete and {0} is left every month. Long-term money can go to tax-friendly options like IKE/IKZE or Polish treasury bonds (see the options below).", pln(left)), gain, "portfolio");
    }
    const order = k => k === "warning" ? 0 : k === "safety" ? 1 : 2;
    return list.sort((a, b) => order(a.kind) - order(b.kind) || b.benefit - a.benefit);
  },
  bestOffer(d) {
    const best = d.Offers.map(o => ({ o, r: Calc.savings(o) })).filter(x => x.r.effective > 0).sort((a, b) => b.r.effective - a.r.effective)[0];
    if (!best) return null;
    const gross = best.o.ApplyTax ? best.r.effective / (1 - BELKA) : best.r.effective;
    return { name: best.o.Name, rate: Math.round(gross * 100) / 100, limit: best.o.PromoLimit || 0 };
  },
  perCategory(d, filter) {
    const cov = Calc.coverage(d), months = cov.months;
    if (!months.length) return [];
    const map = new Map();
    for (const m of months) for (const e of m.items) if (!filter || filter(e)) map.set(e.Category, (map.get(e.Category) || 0) + e.Amount);
    return [...map.entries()].map(([category, sum]) => ({ category, perMonth: sum / cov.units }));
  },
  topNonEssential(d) { return this.perCategory(d, e => !e.Essential).sort((a, b) => b.perMonth - a.perMonth).slice(0, 3); },
  spendingByCategory(d) {
    const list = this.perCategory(d);
    const loans = Calc.loanPayments(d);
    if (loans > 0) list.push({ category: LOAN_CATEGORY, perMonth: loans });
    // Regular payments from the Payment calendar that are not in your expenses
    for (const [category, perMonth] of Calc.recurringPerMonth(d).byCategory) {
      const x = list.find(c => c.category === category);
      if (x) x.perMonth += perMonth; else list.push({ category, perMonth });
    }
    return list.sort((a, b) => b.perMonth - a.perMonth);
  },
};
const fmtPct = v => (Math.round((v || 0) * 100) / 100).toString().replace(".", ",") + "%";

// ---------------------------------------------------------------- reset (Delete data)

export function reset(parts) {
  const d = State.data;
  if (parts.incomes) d.Incomes = [];
  if (parts.expenses) { d.Expenses = []; d.Received = []; d.Transfers = []; }
  if (parts.holdings) d.Holdings = [];
  if (parts.offers) d.Offers = [];
  if (parts.emergency) Object.assign(d.Settings, { MonthlyEssentials: 0, YearlyCosts: 0, EmergencyMonths: 3, BufferPercent: 10 });
  if (parts.rates) Object.assign(d.Settings, { UsdToPln: 0, EurToPln: 0 });
  if (parts.modules) { d.Goals = []; d.Loans = []; d.Budgets = []; d.Recurring = []; }
  if (parts.bin) d.Deleted = [];
  if (parts.categories) {
    const own = new Set(d.Categories.map(c => c.Name));
    d.Expenses.forEach(e => { if (own.has(e.Category)) e.Category = OTHER; });
    d.Budgets = d.Budgets.filter(b => !own.has(b.Category));
    d.Categories = [];
  }
  save();
}

export function summary(d) {
  return T("{0} income sources, {1} expenses, {2} savings entries, {3} saved offers", d.Incomes.length, d.Expenses.length, d.Holdings.length, d.Offers.length);
}

// ---------------------------------------------------------------- gross → net salary (Poland, employment contract)

/** Estimate of the monthly net pay from the gross pay for an employment contract (umowa o pracę) in Poland, 2026 rules:
 *  social insurance 13.71%, health insurance 9%, income tax 12% (32% above 120 000 zł a year), tax-free amount
 *  30 000 zł a year (300 zł less tax per month), costs of earning 250 zł per month. Without PPK and the under-26 relief. */
export function netFromGross(gross) {
  if (!(gross > 0)) return 0;
  const social = Math.round(gross * 0.1371 * 100) / 100;
  const health = Math.round((gross - social) * 0.09 * 100) / 100;
  const base = Math.max(0, Math.round(gross - social - 250));
  const yearly = base * 12;
  const yearTax = yearly <= 120000 ? yearly * 0.12 - 3600 : 120000 * 0.12 - 3600 + (yearly - 120000) * 0.32;
  const tax = Math.max(0, Math.round(yearTax / 12));
  return Math.round((gross - social - health - tax) * 100) / 100;
}

// ---------------------------------------------------------------- repeating expenses (🔁)

/** The key that groups the payments of one repeating expense: its description (or its category). */
export const seriesKey = e => ((e.Description || e.Category || "").toLowerCase().replace(/[0-9.,/#*-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 40)) + "|" + e.Category;

/** Expenses marked "repeats": the most recent payment of each one, which the calendar continues into the future. */
export function repeatingExpenses(d) {
  const latest = new Map();
  for (const e of d.Expenses) {
    if (!e.Repeat) continue;
    const k = seriesKey(e), cur = latest.get(k);
    if (!cur || parseDate(e.Date) > parseDate(cur.Date)) latest.set(k, e);
  }
  return [...latest.values()];
}
/** Money received (not salary) marked 🔁: the newest payment of each series. */
export function repeatingReceived(d) {
  const latest = new Map();
  for (const r of d.Received) {
    if (!r.Repeat || r.Kind === RECEIVED.none || r.Kind === RECEIVED.salary) continue;
    const k = seriesKey(r), cur = latest.get(k);
    if (!cur || parseDate(r.Date) > parseDate(cur.Date)) latest.set(k, r);
  }
  return [...latest.values()];
}
/** Repeat a received payment: the newest one of its series carries the repeat ("" = stop). */
export function setReceivedRepeat(d, r, freq) {
  const k = seriesKey(r), series = d.Received.filter(x => seriesKey(x) === k);
  series.forEach(x => { x.Repeat = ""; });
  if (freq) series.reduce((a, b) => parseDate(a.Date) > parseDate(b.Date) ? a : b).Repeat = freq;
}
export const receivedRepeatOn = (d, r) => { const k = seriesKey(r); return d.Received.find(x => x.Repeat && seriesKey(x) === k)?.Repeat || ""; };
export function setRepeat(d, e, freq) {
  if (freq) e.Repeat = freq;
  else { const k = seriesKey(e); d.Expenses.forEach(x => { if (seriesKey(x) === k) x.Repeat = ""; }); }
}

// ---------------------------------------------------------------- deleted items (can be put back)

const BIN = { expense: "Expenses", income: "Incomes", received: "Received", holding: "Holdings", offer: "Offers", goal: "Goals", loan: "Loans", budget: "Budgets", recurring: "Recurring" };
export function toBin(kind, item) {
  const d = State.data;
  d.Deleted = [{ Id: uuid(), Kind: kind, DeletedAt: new Date().toISOString(), Item: item }, ...(d.Deleted || [])].slice(0, 300);
}
export function restoreFromBin(id) {
  const d = State.data, entry = (d.Deleted || []).find(x => x.Id === id);
  if (!entry) return null;
  const list = d[BIN[entry.Kind]] || (d[BIN[entry.Kind]] = []);
  if (entry.Kind === "budget") { const i = list.findIndex(b => b.Category === entry.Item.Category); if (i >= 0) list.splice(i, 1); }
  list.push(entry.Item);
  d.Deleted = d.Deleted.filter(x => x !== entry);
  save();
  return entry;
}
export function binLabel(entry) {
  const x = entry.Item;
  const name = x.Name || x.Description || (x.Category ? T(x.Category) : "") || "–";
  const value = x.Amount ?? x.Remaining ?? x.Target ?? x.MonthlyLimit;
  return { name, value };
}

// ---------------------------------------------------------------- savings promotions (end date, rate afterwards)

/** A savings promotion: when it ends, how many days are left, the rate that is paid now. */
export function promo(h) {
  if (!h || !h.PromoEnd) return null;
  const end = parseDate(h.PromoEnd);
  if (!end || isNaN(end)) return null;
  const daysLeft = Math.round((end - today()) / 86400000);
  return { end, daysLeft, ended: daysLeft < 0, rateAfter: h.RateAfter ?? null };
}
/** The rate a savings entry pays today: after a promotion has ended, the rate afterwards. */
export function currentRate(h) {
  const p = promo(h);
  if (p && p.ended && p.rateAfter !== null && p.rateAfter !== "") return +p.rateAfter || 0;
  return +h.RatePercent || 0;
}
/** Promotions that end within 14 days, or ended in the last 60 days (and were not dealt with). */
export function duePromos(d) {
  return d.Holdings.map(h => ({ h, p: promo(h) })).filter(x => x.p && x.p.daysLeft <= 14 && x.p.daysLeft >= -60 && x.h.Amount > 0)
    .sort((a, b) => a.p.daysLeft - b.p.daysLeft);
}

// ---------------------------------------------------------------- loans: does it add up?

/** Months needed to pay back what is left with this monthly payment (with interest), or Infinity. */
export function loanMonthsNeeded(l) {
  const A = +l.Remaining || 0, P = +l.MonthlyPayment || 0, r = (+l.RatePercent || 0) / 100 / 12;
  if (A <= 0) return 0;
  if (P <= 0) return Infinity;
  if (r <= 0) return Math.ceil(A / P);
  if (P <= A * r) return Infinity;            // the payment doesn't even cover the interest
  return Math.ceil(-Math.log(1 - r * A / P) / Math.log(1 + r));
}
/** The next payment date of a loan: the one entered, or the same day of the month as before, from today on. */
export function loanNextPayment(l) {
  const base = parseDate(l.NextPayment || l.EndDate || isoDate(addMonths(today(), 1)));
  if (!base || isNaN(base)) return addMonths(today(), 1);
  return Calc.nextPayment({ Date: isoDate(base), Frequency: "Monthly" }, today()) || base;
}
/** Worked out from what was left on the day you entered it, the monthly payment and the interest:
 *  the debt-free date, the payments still to go and about how much is left today. */
export function loanPlan(l) {
  const needed = loanMonthsNeeded(l);
  const first = parseDate(l.NextPayment || "") || loanNextPayment(l);
  const end = needed === Infinity || needed <= 0 ? null : addMonths(first, needed - 1);
  // Payments that have already been made since then (on the payment day, every month)
  let done = 0;
  if (needed !== Infinity) while (done < needed && addMonths(first, done) <= today()) done++;
  const P = +l.MonthlyPayment || 0, r = (+l.RatePercent || 0) / 100 / 12;
  let A = +l.Remaining || 0, interest = 0;
  for (let i = 0; i < done; i++) { interest += A * r; A = Math.max(0, A * (1 + r) - P); }
  let B = A, future = 0;
  if (needed !== Infinity) for (let i = done; i < needed; i++) { future += B * r; B = Math.max(0, B * (1 + r) - P); }
  return { needed, left: needed === Infinity ? Infinity : needed - done, done, next: done < needed ? addMonths(first, done) : null, end,
    never: needed === Infinity, remainingNow: needed === Infinity ? +l.Remaining || 0 : Math.round(A * 100) / 100, interest: future,
    // Interest repaid: what you entered from your bank, plus the interest in the payments made since then
    interestRepaid: (+l.InterestPaid || 0) + interest };
}
export function planLoan(l) {
  if (!l.NextPayment) l.NextPayment = isoDate(loanNextPayment(l));
  const p = loanPlan(l);
  l.EndDate = p.end ? isoDate(p.end) : isoDate(addMonths(parseDate(l.NextPayment), 1200));
  l.Planned = true;
  return p;
}
