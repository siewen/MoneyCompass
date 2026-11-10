// MoneyCompass web: data, storage, translations, money maths and advice.
// The data has exactly the same shape as the Windows app, so profile files work in both.
import { TABLE } from "./lang-table.js";
import { EXTRA } from "./lang-extra.js";
import { NEW } from "./lang-new.js";
import { ADV } from "./lang-advisors.js";

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
    MonthlyEssentials: 0, YearlyCosts: 0, EmergencyMonths: 3, BufferPercent: 10, UsdToPln: 0, EurToPln: 0, Currency: "PLN",
    HelpButtonX: 0, HelpButtonY: 0, Language: "", AutoSaveProfile: true, CloseChoice: "", AskOnStart: true,
    MenuPosition: "top", ExportCharts: true, Design: "light", OnlineRates: true, CheckForUpdates: true,
    LastUpdateCheck: null, AutoExchangeRates: true, LicenseKey: "", Modules: [], CardOrder: {},
    LayoutIncluded: true, FreeExportsUsed: 0, LastProfileSaved: null, ProfileName: "", ProfilePicture: "", GuideHidden: false, NewsHidden: false, HintsOff: false, HintsHidden: [],
  };
}
export function newData() {
  return { Incomes: [], Expenses: [], Holdings: [], Offers: [], Loans: [], Goals: [], Received: [],
           Transfers: [], Categories: [], Budgets: [], Recurring: [], Deleted: [], SavingsChecks: [], Investments: [], Settings: newSettings() };
}
/** Fills in anything missing (older files, files from the Windows app). */
export function normalise(d) {
  const base = newData();
  const out = Object.assign(base, d || {});
  for (const k of ["Incomes", "Expenses", "Holdings", "Offers", "Loans", "Goals", "Received", "Transfers", "Categories", "Budgets", "Recurring", "Deleted", "SavingsChecks", "Investments"])
    if (!Array.isArray(out[k])) out[k] = [];
  out.Settings = Object.assign(newSettings(), out.Settings || {});
  if (!Array.isArray(out.Settings.Modules)) out.Settings.Modules = [];
  // Savings goals are now part of the Budget plan: whoever used goals gets the Budget plan ("goals" stays for the Windows app)
  if (out.Settings.Modules.includes("goals") && !out.Settings.Modules.includes("budget")) out.Settings.Modules.push("budget");
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
  noteHoldingAmounts();
  const ok = store.set("mc-p:" + State.id, JSON.stringify(State.data));
  saveFailed = !ok;
  try { window.dispatchEvent(new Event("mc-saved")); } catch { /* not in a browser */ }
}
export const lastSaveFailed = () => saveFailed;
// Each savings entry keeps the amounts it had over time (one per day, the last one counts) for the Savings chart
function noteHoldingAmounts() {
  const d = State.data; if (!d || !Array.isArray(d.Holdings)) return;
  const t = new Date(), day = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}T00:00:00`;
  for (const h of d.Holdings) {
    const hs = Array.isArray(h.History) ? h.History : (h.History = []);
    const last = hs[hs.length - 1];
    if (last && last.Amount === h.Amount) continue;
    if (last && last.Date === day) last.Amount = h.Amount; else hs.push({ Date: day, Amount: h.Amount });
    if (hs.length > 400) hs.splice(0, hs.length - 400);
  }
}

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
    return { id, name: id === State.id ? currentName() : (s.ProfileName || T("Demo User")), current: id === State.id };
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
  store.remove("mc-p:" + id); store.remove("mc-pic:" + id); store.remove("mc-filekey:" + id); store.remove("mc-bio:" + id); store.remove("mc-backup:" + id); store.remove("mc-backup-later:" + id);
  if (idx.current === id) idx.current = idx.ids[0] || "";
  writeIndex(idx); loadCurrent();
}
export function replaceData(d) { const name = State.data.Settings.ProfileName; State.data = normalise(d); if (!State.data.Settings.ProfileName) State.data.Settings.ProfileName = name; save(); }

export const picture = () => store.get("mc-pic:" + State.id);
export const setPicture = url => url ? store.set("mc-pic:" + State.id, url) : store.remove("mc-pic:" + State.id);

export function currentName() {
  const n = (State.data.Settings.ProfileName || "").trim();
  if (n) return n;
  return license.current?.name || T("Demo User");
}
export function initials(name) {
  const w = name.split(" ").filter(Boolean);
  if (!w.length) return "?";
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[w.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------- translations

export const LANGS = [["en", "English"], ["pl", "Polski"]];
export function lang() {
  const s = State.data.Settings;
  if (!LANGS.some(l => l[0] === s.Language)) {
    let pick = "";
    try { pick = store.get("mc-lang") || ""; } catch { /* none */ }
    if (!LANGS.some(l => l[0] === pick)) pick = (navigator.language || "en").slice(0, 2).toLowerCase();
    s.Language = LANGS.some(l => l[0] === pick) ? pick : "pl";   // made for Poland: Polish unless the browser speaks English
    save();
  }
  return s.Language;
}
export function T(english, ...args) {
  const l = lang();
  let text = english;
  if (l !== "en") text = (TABLE[l] && TABLE[l][english]) || (EXTRA[l] && EXTRA[l][english]) || (NEW[l] && NEW[l][english]) || (ADV[l] && ADV[l][english]) || english;
  if (text.includes("zł")) text = withCurrency(text);
  return args.length ? text.replace(/\{(\d+)\}/g, (m, i) => (args[i] ?? m)) : text;
}
// ---------- Main currency of the profile (Settings): PLN, EUR or USD. All amounts without their own currency are in it. ----------
export const CURRENCY_NAMES = { PLN: "złoty", EUR: "euro", USD: "dollars" };
export const mainCur = () => State.data?.Settings?.Currency || "PLN";
const SYMBOL = { PLN: "zł", EUR: "€", USD: "$" };
/** Texts written for złoty: "(zł)" and "złoty" follow the main currency. */
function withCurrency(text) {
  const c = mainCur(); if (c === "PLN") return text;
  return text.replace(/\(zł\)/g, "(" + SYMBOL[c] + ")").replace(/złotych|złote|złoty|Złoty/g, CURRENCY_NAMES[c]);
}
/** 1 unit of a currency in złoty (NBP rates); 0 when not known yet. */
export const plnRate = (cur, s = State.data?.Settings || {}) => cur === "PLN" ? 1 : cur === "USD" ? (s.UsdToPln || 0) : cur === "EUR" ? (s.EurToPln || 0) : 1;
/** A fixed amount in złoty (Polish limits and rules, bank offers) in the main currency. */
export const fromPln = v => { const r = plnRate(mainCur()); return r > 0 ? v / r : v; };
export function monthsCount(n) {
  switch (lang()) {
    case "pl": return n === 1 ? "1 miesiąc" : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? `${n} miesiące` : `${n} miesięcy`;
    default: return n === 1 ? "1 month" : `${n} months`;
  }
}
const locales = { en: "en-GB", pl: "pl-PL" };
export const locale = () => locales[lang()];
export const monthName = d => { const s = parseDate(d).toLocaleDateString(locale(), { month: "long", year: "numeric" }); return s.charAt(0).toUpperCase() + s.slice(1); };
export const monthShort = d => parseDate(d).toLocaleDateString(locale(), { month: "short" }).replace(".", "");

// ---------------------------------------------------------------- numbers

const nf = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" });
const round2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
export const pln = v => { const n = nf.format(round2(v || 0)).replace(/ /g, " "), c = mainCur(); return c === "EUR" ? n + " €" : c === "USD" ? (n.startsWith("-") ? "-$" + n.slice(1) : "$" + n) : n + " zł"; };
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

/** Filled in by other files at start (avoids circular imports): investmentsTotal(d) from investments.js. */
export const Hooks = { investmentsTotal: null };
export const MODULES = [
  { code: "loans", name: "Loans & debts", description: "Credits and loans: what is left to pay, monthly payments and when you are debt-free." },
  { code: "budget", name: "Budget plan", description: "Monthly limits per expense category and your savings goals: how much to set aside each month." },
  { code: "calendar", name: "Calendar", description: "Everything that comes back every month – salary, bills, subscriptions, savings – in a calendar, with a preview of the next 1 to 12 months." },
  { code: "taxes", name: "Taxes & Payroll", description: "A rough estimate of gross and net pay in Poland: insurance, income tax and the tax bracket you are in. Rates are kept in one file and updated each year." },
  { code: "investments", name: "Investments", description: "Crypto platforms and brokers in one place: what you hold, how it is spread, what it costs and how healthy the portfolio is. Beta." },
];
/** What is saved for a goal: the balance of its linked savings account, or the amount typed in. */
export function goalSaved(g, d = State.data) {
  const h = g.HoldingId && d.Holdings.find(x => x.Id === g.HoldingId);
  return h ? Calc.toPln(h.Amount, h.Currency, d.Settings) : (g.Saved || 0);
}
/** Savings rate as text: below −100% the number means nothing (you spend many times what comes in), so it says so. */
export const savingsRateText = (left, income) => { const r = Math.round(left / income * 100); return r < -100 ? "< −100%" : r + "%"; };
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
  "☕", "🚌", "🚲", "🅿️", "🔧", "🧾", "💼", "💻", "🖨️", "🌱", "🧹", "🏥", "🦷", "👓", "💰", "🚬",
  "👨‍👩‍👧", "👪", "🧒", "🧸", "💍", "🎂", "👵", "🏡", "🐾", "🐟", "🐦", "🐴", "🐰", "🦜",
  "👦", "👧", "📈", "💹", "🪙", "💳", "🏧", "💵", "💶"];

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
/** Change one of your own categories: name, icon and essential. A new name follows everywhere (expenses, budget,
 *  regular payments, learned shops); "essential" is also applied to the expenses already in it. Returns an error text or null. */
export function updateCategory(oldName, name, essential, icon) {
  const d = State.data, c = d.Categories.find(x => x.Name === oldName);
  if (!c) return T("This category no longer exists.");
  name = (name || "").trim();
  if (!name) return T("Please enter a name.");
  if (name.length > 40) return T("Please use a shorter name (up to 40 letters).");
  const lower = s => s.toLowerCase();
  if (lower(name) !== lower(oldName) && categories().some(x => x.Name !== oldName && (lower(x.Name) === lower(name) || lower(T(x.Name)) === lower(name)))) return T("This category already exists.");
  Object.assign(c, { Name: name, Essential: !!essential, Icon: icon || "" });
  for (const e of d.Expenses) if (e.Category === oldName) { e.Category = name; e.Essential = !!essential; }
  for (const b of d.Budgets) if (b.Category === oldName) b.Category = name;
  for (const r of d.Recurring || []) if (r.Category === oldName) r.Category = name;
  for (const r of d.Settings.CategoryRules || []) if (r.Category === oldName) r.Category = name;
  save();
  return null;
}
/** Change the main currency of a profile: every amount that has no currency of its own is converted once at today's NBP rate
 *  (expenses, inflows, transfers, loans, goals, budget limits, regular payments, offers, emergency fund costs, statement analyses,
 *  the bin). Savings entries and income sources keep their own currency and are shown converted. Returns an error text or null. */
export function convertProfile(d, to) {
  const s = d.Settings, from = s.Currency || "PLN";
  if (to === from) return null;
  const a = plnRate(from, s), b = plnRate(to, s);
  if (!(a > 0) || !(b > 0)) return T("The exchange rates are not known yet. Connect to the internet (NBP rates) or enter them in Savings → Exchange rates.");
  const f = a / b, r = v => typeof v === "number" ? Math.round(v * f * 100) / 100 : v;
  const fix = (o, keys) => { if (o) for (const k of keys) if (typeof o[k] === "number") o[k] = r(o[k]); };
  const byKind = {
    expense: o => fix(o, ["Amount"]), received: o => fix(o, ["Amount"]), transfer: o => fix(o, ["Amount"]),
    loan: o => { fix(o, ["Remaining", "MonthlyPayment", "Original", "InterestPaid"]); (o.Extra || []).forEach(e => fix(e, ["Amount"])); },
    goal: o => fix(o, ["Target", "Saved"]), budget: o => fix(o, ["MonthlyLimit"]), recurring: o => fix(o, ["Amount"]),
    offer: o => fix(o, ["Amount", "PromoLimit"]),
    check: o => { fix(o, ["Opening", "Closing", "Average", "Deposits", "Withdrawals", "Interest", "Tax", "Fees"]);
      (o.Months || []).forEach(m => fix(m, ["End", "Average", "Interest", "Fees", "Credits", "Debits"])); (o.Types || []).forEach(t => fix(t, ["Interest"])); },
  };
  d.Expenses.forEach(byKind.expense); d.Received.forEach(byKind.received); (d.Transfers || []).forEach(byKind.transfer);
  d.Loans.forEach(byKind.loan); d.Goals.forEach(byKind.goal); d.Budgets.forEach(byKind.budget); (d.Recurring || []).forEach(byKind.recurring);
  d.Offers.forEach(byKind.offer); (d.SavingsChecks || []).forEach(byKind.check);
  for (const x of d.Deleted || []) byKind[x.Kind]?.(x.Item);
  fix(s, ["MonthlyEssentials", "YearlyCosts"]);
  if (s.SavingsHistory) for (const k in s.SavingsHistory) s.SavingsHistory[k] = r(s.SavingsHistory[k]);
  s.Currency = to;
  save();
  return null;
}
export function removeCategory(name) {
  const d = State.data;
  d.Categories = d.Categories.filter(c => c.Name !== name);
  d.Expenses.forEach(e => { if (e.Category === name) e.Category = OTHER; });
  d.Budgets = d.Budgets.filter(b => b.Category !== name);
  for (const r of d.Recurring || []) if (r.Category === name) r.Category = OTHER;
  d.Settings.CategoryRules = (d.Settings.CategoryRules || []).filter(r => r.Category !== name);   // shops learned for it: forgotten
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

/** Is this expense the regular payment r on day n (already imported, so it must not be counted twice)?
 *  Within 5 days and about the same amount – and the same category, or the name in the description, or the exact amount.
 *  So a 42 zł gym membership is not mistaken for a 42,50 zł shopping trip a day later. */
export function isRecurringPayment(e, r, n) {
  if (Math.abs(parseDate(e.Date) - n) > 5 * 86400000) return false;
  const diff = Math.abs(e.Amount - r.Amount);
  if (diff > r.Amount * 0.05) return false;
  if (e.Category === (r.Category || OTHER) || diff < 0.005) return true;
  const word = matchKey(r.Name).split(" ").find(w => w.length >= 3);
  return !!word && matchKey(e.Description).includes(word);
}
export const Calc = {
  /** How many of the latest months with outflows count as "your data" (3 normally; the Overview period picker changes it for one render). */
  maxMonths: 3,
  /** Overview period: "all", "n2", "n3", "n6" (latest months) or "m:<year*12+month>" (one month). Returns the data limited to it. */
  scope(d, period) {
    const months = this.groupMonths(this.countedExpenses(d));
    let from = null, to = null, n = 3, label = "";
    if (period === "all") { n = 999; label = T("All data"); }
    else if (/^n\d+$/.test(period)) { n = +period.slice(1); const m = months.slice(0, n); if (m.length) from = m[m.length - 1].start; label = T("Last {0} months", n); }
    else if (period.startsWith("m:")) { const m = months.find(x => x.key === +period.slice(2)); n = 1; if (m) { from = m.start; to = addMonths(m.start, 1); label = monthName(m.start); } }
    else { const m = months.slice(0, 3); if (m.length) from = m[m.length - 1].start; label = T("Last {0} months", 3); }
    const inR = x => { const t = parseDate(x.Date); return (!from || t >= from) && (!to || t < to); };
    return { data: from || to ? { ...d, Expenses: d.Expenses.filter(inR), Received: d.Received.filter(inR), Transfers: d.Transfers.filter(inR) } : d, n, label, months };
  },
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
    const months = this.groupMonths(this.countedExpenses(d)).slice(0, this.maxMonths);
    if (!months.length) return { months: [], units: 0, days: 0, partial: false, from: null, to: null };
    const all = [...d.Expenses, ...d.Received, ...d.Transfers].map(x => parseDate(x.Date)).filter(x => x && !isNaN(x));
    let units = 0, days = 0, partial = false, from = null, to = null;
    for (const m of months) {
      const start = m.start, monthEnd = addDays(addMonths(start, 1), -1), end = monthEnd < today() ? monthEnd : today();
      let inM = all.filter(t => t >= start && t <= end);
      // Only entries dated later this month (planned): use their own dates, so nothing turns into "NaN"
      if (!inM.length) inM = m.items.map(x => parseDate(x.Date));
      let a = new Date(Math.min(...inM)), b = new Date(Math.max(...inM));
      if (b > end) b = new Date(Math.max(end, a));
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
  /** Regular payments added in the Calendar that fall in this month and are NOT already among your
   *  expenses (same amount within 5%, within 5 days) – e.g. paid from a bank you don't import. */
  recurringIn(d, start, end) {
    if (!moduleOn("calendar")) return [];
    const out = [];
    for (const r of (d.Recurring || []).filter(r => r.Active !== false && r.Kind !== "saving" && r.Amount > 0)) {
      const last = r.EndDate ? parseDate(r.EndDate) : null;
      let next = this.nextPayment(r, start), guard = 0;
      while (next && next <= end && (!last || next <= last) && guard++ < 62) {
        const n = next;
        const known = d.Expenses.some(e => isRecurringPayment(e, r, n));
        if (!known) out.push({ category: r.Category || OTHER, amount: r.Amount, essential: !!findCategory(r.Category)?.Essential });
        if (r.Frequency === ONE_TIME) break;
        next = this.nextPayment(r, addDays(next, 1));
      }
    }
    return out;
  },
  /** The same months as the expense averages (or this month when there are no expenses yet). */
  basisMonths(d) {
    const months = this.groupMonths(this.countedExpenses(d)).slice(0, this.maxMonths).map(m => m.start);
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
    const avg = { ...this.averages(this.countedExpenses(d), this.maxMonths, cov.units), estimate: cov.partial, days: cov.days, from: cov.from, to: cov.to };
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
  // An amount in its own currency → the main currency of the profile (the name stays "toPln": PLN is the default)
  toPln(value, currency, s) {
    const main = s?.Currency || "PLN", cur = currency || main;
    if (cur === main) return value;
    const a = plnRate(cur, s), b = plnRate(main, s);
    return a > 0 && b > 0 ? value * a / b : (cur === "PLN" ? value : 0);
  },
  rateMissing(currency, s) { const m = s?.Currency || "PLN"; return (currency || m) !== m && (!(plnRate(currency, s) > 0) || !(plnRate(m, s) > 0)); },
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
  /** The first and last payment of an income source (optional): nothing is counted before or after them. */
  incomeSpan(i) {
    const a = i.StartDate ? parseDate(i.StartDate) : null, b = i.EndDate ? parseDate(i.EndDate) : null;
    return { start: a && !isNaN(a) ? a : null, end: b && !isNaN(b) ? b : null };
  },
  /** The next payment of an income source from this day on, within its first and last payment. */
  nextIncome(i, from) {
    const { start, end } = this.incomeSpan(i);
    const n = this.nextPayment(i, start && start > from ? start : from);
    return n && (!end || n <= end) ? n : null;
  },
  upcoming(d, from, to) {
    const list = [];
    for (const i of d.Incomes.filter(x => x.Active)) {
      const amt = this.toPln(i.Amount, i.Currency, d.Settings);
      const { end } = this.incomeSpan(i);
      let next = this.nextIncome(i, from), guard = 0;
      while (next && next <= to && (!end || next <= end) && guard++ < 500) {
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
      if (i.Frequency === ONE_TIME) { if (parseDate(i.Date).getFullYear() === year) oneTime += this.toPln(i.Amount, i.Currency, d.Settings); continue; }
      // Regular income counts from its first payment until its last one
      const { start, end } = this.incomeSpan(i);
      if ((start && start > addMonths(today(), 1)) || (end && end < today())) continue;
      total += this.monthlyPln(i, d.Settings); count++;
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
    // Investments module: the value of your positions counts as risky money
    const invest = moduleOn("investments") && Hooks.investmentsTotal ? Hooks.investmentsTotal(d) : 0;
    total += invest; risky += invest;
    return { total, safe, risky, yearly, missing, invest };
  },
  spentThisMonth(category) {
    const start = monthStart(today()), end = addMonths(start, 1);
    return State.data.Expenses.filter(e => e.Category === category && parseDate(e.Date) >= start && parseDate(e.Date) < end).reduce((s, e) => s + e.Amount, 0)
      + Calc.recurringIn(State.data, start, today()).filter(x => x.category === category).reduce((s, x) => s + x.amount, 0);
  },
};

// ---------------------------------------------------------------- chart numbers (ChartData.cs)

export const COLORS = { income: "#2a78d6", expenses: "#eb6834", leftOver: "#1baf7a", other: "#a3a3a0",
  series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"],
  // One colour per category on the Outflows tab (the first six are the usual ones, so the biggest categories keep their colour)
  cats: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#8b7cf6", "#2bb5c8", "#c2410c", "#a3b827", "#d946ef", "#5b7c99",
    "#f2777a", "#7dd3a8", "#b08968", "#60a5fa", "#fbbf24", "#94a3b8"] };

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
    // All months from your oldest entry (typed in or imported) up to today; without entries the last 6 months
    const first0 = this.firstDate(d);
    let first = first0 ? monthStart(first0) : addMonths(thisMonth, -5);
    if (first > thisMonth) first = thisMonth;
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
    // Over more than one year the labels get the year too: "Sep 25", "Jan 26"
    if (out.length && out[0].start.getFullYear() !== thisMonth.getFullYear()) out.forEach(m => { m.month += " " + String(m.start.getFullYear()).slice(2); });
    return out;
  },
  /** The date of your oldest expense or money received, or null. */
  firstDate(d) {
    const t = [...d.Expenses, ...d.Received, ...(d.Transfers || [])].map(x => parseDate(x.Date)?.getTime()).filter(Number.isFinite);
    return t.length ? new Date(Math.min(...t)) : null;
  },
  categories(d) {
    const by = Advisor.spendingByCategory(d);
    const total = by.reduce((s, c) => s + c.perMonth, 0);
    // Every category its own colour (no grey "Everything else"): the ring and the list always match
    const slices = by.map((c, n) => ({ label: T(c.category), key: c.category, value: c.perMonth, color: COLORS.cats[n % COLORS.cats.length], text: pln(c.perMonth), icon: categoryIcon(c.category) }));
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
        const gain = movable * (best.rate - currentRate(h)) / 100 * (1 - BELKA);   // after a promotion: the rate it pays now
        if (v >= 1000 && gain >= 50)
          add("money", T("Move \"{0}\" to a better offer", h.Name), T("It earns {0}. Your best saved offer \"{1}\" pays on average {2} per year (promo and the rate after it together). Check that you meet the offer's conditions (new money, card payments...).", fmtPct(currentRate(h)), best.name, fmtPct(best.rate)), gain, "savings");
      }
    } else {
      const low = d.Holdings.filter(h => h.Safe && currentRate(h) < 2 && Calc.toPln(h.Amount, h.Currency, d.Settings) >= 1000);
      if (low.length)
        add("money", T("Your savings earn almost nothing"), T("{0} sits in accounts paying under 2%. Banks often offer 5–6% for new money. Enter a few offers in the Compare offers tab and MoneyCompass shows you exactly how much you'd gain.", pln(low.reduce((s, h) => s + Calc.toPln(h.Amount, h.Currency, d.Settings), 0))), 0, "savings", T("Compare offers"));
    }
    if (avg.monthsUsed > 0 && avg.nonEssential > 0) {
      const top = this.topNonEssential(d);
      for (let i = 0; i < top.length; i++) {
        const c = top[i];
        if (categoryRule(c.category)) continue;   // these get their own, more specific tip (moreAdvice)
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
    moreAdvice(d, add, { income, avg, spending, left, p, target, missing, best });
    const order = k => k === "warning" ? 0 : k === "safety" ? 1 : k === "insight" ? 3 : 2;
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
    // Regular payments from the Calendar that are not in your expenses
    for (const [category, perMonth] of Calc.recurringPerMonth(d).byCategory) {
      const x = list.find(c => c.category === category);
      if (x) x.perMonth += perMonth; else list.push({ category, perMonth });
    }
    return list.sort((a, b) => b.perMonth - a.perMonth);
  },
};
const fmtPct = v => (Math.round((v || 0) * 100) / 100).toString().replace(".", ",") + "%";

// ---------------------------------------------------------------- more analysis for "Your personal plan"

/** Tips for single categories: what it costs per year and concrete ways to spend less. `cut` = the part you could save.
 *  Matches the built-in names and your own categories (e.g. "Cigarettes", "Papierosy"). */
const CATEGORY_RULES = [
  { re: /cigar|papieros|tobac|tyto|zigarett|vape|e-?papieros|iqos|snus/i, cut: 1, min: 20, title: "Smoking costs you {0} a year",
    text: "{0} a month goes on smoking – {1} a year. Stopping is the biggest single saving you can make, and the best for your health. Put the same amount into a savings account instead: after 5 years that is about {2}. Free help: the national quit-smoking line 801 108 108." },
  { re: /alcohol|alkohol|beer|piwo|wine|wino|bier/i, cut: 0.5, min: 50, title: "Alcohol: {0} a year",
    text: "About {0} a month – {1} a year. Drinking half as much saves {3} a year. Tip: alcohol-free weeks, and don't buy for stock at home." },
  { re: /gambl|hazard|lott|lotek|zakład|zaklad|bukmach|casino|kasyno|betting|wett/i, cut: 1, min: 10, title: "Gambling: {0} a year",
    text: "{0} a month – {1} a year – goes on betting or lotteries, and on average you get back less than you pay. Put it into savings instead: after 5 years that is about {2}. If it's hard to stop: free help at the helpline for behavioural addictions 801 889 880 (daily 17:00–22:00)." },
  { re: /^shopping$|zakupy|einkauf/i, cut: 0.25, min: 300, title: "Shopping: {0} a month",
    text: "Shopping is {0} a month ({1} a year). Spending a quarter less saves {3} a year. What works: wait 48 hours before buying anything over 100 zł, shop with a list, unsubscribe from shop newsletters, remove saved cards from shopping apps, and check the lowest price on Ceneo before buying." },
  { re: /^food & groceries$|spożyw|lebensmittel/i, cut: 0.15, min: 800, title: "Groceries: {0} a month",
    text: "Groceries are {0} a month. Saving 15% is realistic and worth {3} a year: plan meals for the week and shop with a list, buy store brands, use the Lidl Plus or Biedronka app coupons, don't shop hungry, and freeze what you won't eat in time." },
  { re: /^restaurants & takeaway$|restaurac|jedzenie na wynos|restaurant/i, cut: 0.4, min: 150, title: "Eating out: {0} a month",
    text: "Restaurants and takeaway cost {0} a month ({1} a year). A meal cooked at home costs about a third. Takeaway once a week instead of several times, and lunch from home for work, saves around {3} a year." },
  { re: /^subscriptions$|subskryp|abonament|abo/i, cut: 0.3, min: 50, title: "Subscriptions: {0} a year",
    text: "{0} a month on subscriptions – {1} a year. Go through them once: cancel what you didn't use last month, share family plans, and switch to yearly payment for what you keep (often 2 months free). Usually about {3} a year less." },
  { re: /^transport \/ fuel$|paliwo|tank|kraftstoff/i, cut: 0.1, min: 300, title: "Transport & fuel: {0} a month",
    text: "Transport is {0} a month. Compare fuel prices in an app (e.g. e-petrol.pl), use the fuel loyalty programmes (Orlen VITAY, BP, Shell), check tyre pressure, and for daily trips in town compare with a monthly public-transport ticket. About {3} a year." },
  { re: /^electricity, gas, water, heating$|prąd|energia|strom/i, cut: 0.1, min: 250, title: "Energy: {0} a month",
    text: "Energy and water cost {0} a month. One degree less heating saves about 6%; LED bulbs, switching devices fully off and, if you use a lot in the evening, the two-zone G12 tariff help too. Around {3} a year." },
  { re: /^internet & phone$|telefon|internet/i, cut: 0.3, min: 120, title: "Internet & phone: {0} a month",
    text: "{0} a month for phone and internet. In Poland a good mobile plan costs about 30–40 zł, and bundles with home internet are cheaper. Ask your operator for a better offer before the contract ends, or switch – about {3} a year." },
  { re: /^car insurance & service$|ubezpiecz|versicher/i, cut: 0.2, min: 100, title: "Car insurance & service: {0} a month",
    text: "{0} a month on car insurance and service. Compare OC/AC every year a few weeks before it renews (e.g. on rankomat.pl) – another insurer is often 20–30% cheaper. About {3} a year." },
  { re: /^clothes|odzież|ubrania|kleidung/i, cut: 0.25, min: 200, title: "Clothes & shoes: {0} a month",
    text: "{0} a month on clothes. Buy in the end-of-season sales, second-hand (e.g. Vinted) and with a list of what you really miss – about {3} a year less." },
  { re: /crypto|krypto|bitcoin|btc/i, cut: 0, min: 50, info: true, title: "Crypto purchases: {0} a month",
    text: "You put {0} a month into crypto ({1} a year). That's fine only with money you can afford to lose: first a full emergency fund in a bank account, then crypto as a small part of your savings – prices can fall by half." },
];
export const categoryRule = name => CATEGORY_RULES.find(r => r.re.test(name || "")) || null;

/** Value after `years` of putting `perMonth` aside at `ratePct` per year (interest after the 19% tax). */
const futureValue = (perMonth, ratePct, years) => { const r = ratePct / 100 * (1 - BELKA) / 12, n = years * 12; return r > 0 ? perMonth * ((1 + r) ** n - 1) / r : perMonth * n; };

function moreAdvice(d, add, { income, avg, spending, left, p, target, missing, best }) {
  if (!(avg.monthsUsed > 0)) return;
  const rateForGrowth = best ? best.rate : 5;
  const cats = Advisor.perCategory(d).sort((a, b) => b.perMonth - a.perMonth);
  // 1. Category tips (cigarettes, shopping, groceries...): the biggest ones first, at most 6
  let n = 0;
  for (const c of cats) {
    const r = categoryRule(c.category); if (!r || c.perMonth < fromPln(r.min) || n >= 6) continue;
    const name = T(c.category), year = c.perMonth * 12, save = year * r.cut;
    add(r.info ? "insight" : "money", T(r.title, pln(r.title.includes("a year") ? year : c.perMonth)),
      T(r.text, pln(c.perMonth), pln(year), pln(futureValue(c.perMonth, rateForGrowth, 5)), pln(save)), save, "expenses");
    n++;
  }
  // 2. Spending that went up: the last whole month against the months before
  const months = Calc.groupMonths(Calc.countedExpenses(d)).filter(m => m.start < monthStart(today()));
  if (months.length >= 3) {
    const [lastM, ...before] = months.slice(0, 6);
    const sumBy = m => m.items.reduce((map, e) => map.set(e.Category, (map.get(e.Category) || 0) + e.Amount), new Map());
    const now = sumBy(lastM), prev = before.map(sumBy);
    const ups = [...now.entries()].map(([k, v]) => ({ k, v, was: prev.reduce((s, m) => s + (m.get(k) || 0), 0) / prev.length }))
      .filter(x => x.was > 0 && x.v - x.was >= fromPln(150) && x.v >= x.was * 1.3).sort((a, b) => (b.v - b.was) - (a.v - a.was)).slice(0, 2);
    for (const u of ups) add("insight", T("\"{0}\" went up in {1}", T(u.k), monthName(lastM.start)),
      T("{0} in {1}, against {2} a month on average before (+{3}%). A one-off – or a new habit worth watching?", pln(u.v), monthName(lastM.start), pln(u.was), Math.round((u.v / u.was - 1) * 100)), 0, "expenses");
  }
  // 3. Many small payments ("latte effect")
  const cov = Calc.coverage(d);
  const small = cov.months.flatMap(m => m.items).filter(e => e.Amount > 0 && e.Amount < fromPln(30) && e.Category !== LOAN_CATEGORY);
  const smallCount = small.length / cov.units, smallSum = small.reduce((s, e) => s + e.Amount, 0) / cov.units;
  if (smallCount >= 25 && smallSum >= fromPln(250))
    add("money", T("Small payments add up: {0} a month", pln(smallSum)),
      T("About {0} payments under 30 zł a month – coffee, snacks, small shopping – together {1} a month, {2} a year. Set a weekly limit for them, or take one cash amount per week. A fifth less saves {3} a year.", Math.round(smallCount), pln(smallSum), pln(smallSum * 12), pln(smallSum * 12 * 0.2)), smallSum * 12 * 0.2, "expenses");
  // 4. Too much in "Other": the plan can't see where it goes
  const otherShare = spending > 0 ? (cats.find(c => c.category === OTHER)?.perMonth || 0) / spending : 0;
  if (otherShare >= 0.15)
    add("tip", T("{0}% of your outflows are in \"Other\"", Math.round(otherShare * 100)),
      T("Sort them by shop in one go (Outflows tab). The better your categories, the more precise the tips here – for example on shopping or eating out."), 0, "expenses");
  if (income > 0) {
    // 5. Loan payments compared with income
    const loans = Calc.loanPayments(d), dti = loans / income;
    if (dti >= 0.3)
      add(dti >= 0.45 ? "warning" : "safety", T("Loan payments take {0}% of your income", Math.round(dti * 100)),
        T("{0} a month goes to loans. Above 30% it gets tight, and banks see 40–50% as the limit for new credit. Pay off the most expensive loan first, avoid new instalment purchases – and see the loan tips below.", pln(loans)), 0, "loans");
    // 6. Housing compared with income
    const housing = cats.find(c => c.category === "Housing / rent")?.perMonth || 0;
    if (housing / income >= 0.35)
      add("tip", T("Housing takes {0}% of your income", Math.round(housing / income * 100)),
        T("A common rule is at most 30–35%. Over a few years it can pay to look at a cheaper flat, a flatmate, or – with a mortgage – a refinance (see Loans vs. the market)."), 0, "expenses");
  }
  // 7. Savings goals: is the monthly surplus enough?
  const open = (d.Goals || []).map(g => ({ g, saved: goalSaved(g, d) })).filter(x => x.saved < x.g.Target && x.g.TargetDate);
  if (open.length) {
    const monthsTo = t => Math.max(1, (t.getFullYear() - today().getFullYear()) * 12 + t.getMonth() - today().getMonth());
    const need = open.reduce((s, x) => s + (x.g.Target - x.saved) / monthsTo(parseDate(x.g.TargetDate)), 0);
    if (left < need)
      add("safety", T("Your goals need {0} a month", pln(need)),
        T("To reach your savings goals on time you need {0} a month, but only {1} is left after your outflows. Push a date back, lower a target, or find the difference in the tips above.", pln(need), pln(Math.max(0, left))), 0, "budget");
    else add("insight", T("Your goals are on track"), T("They need {0} a month and {1} is left. Set up a standing order for {0} on payday so it happens by itself.", pln(need), pln(left)), 0, "budget");
  }
  // 8. A promotion ends soon
  const due = duePromos(d)[0];
  if (due) add("money", due.p.ended ? T("The promotion at {0} has ended", due.h.Name) : T("The promotion at {0} ends in {1} days", due.h.Name, due.p.daysLeft),
    T("After a promotion banks pay much less. Move the money to the best offer now – see Savings."), 0, "portfolio");
  // 9. Fees on the savings account (statement analysis)
  const chk = (d.SavingsChecks || [])[0];
  if (chk && chk.Fees > 0) add("money", T("Your savings account charges fees"),
    T("{0} paid {1} in fees between {2} and {3}. A savings account should be free – ask the bank or move the money.", chk.Name, pln(chk.Fees), fmtDate(chk.From), fmtDate(chk.To)), chk.Fees * 365 / Math.max(30, chk.Days || 365), "portfolio");
  // 10. More in the emergency fund than needed
  if (target > 0 && p.safe > target * 1.5) {
    const extra = p.safe - target;
    add("money", T("{0} more than your emergency fund needs", pln(extra)),
      T("Your safe money is well above your target. Money you won't need for years can earn more, e.g. in 4- or 10-year inflation-linked treasury bonds (COI, EDO) or an IKE without the 19% tax."), extra * 0.01, "portfolio");
  }
  // 11. IKZE: lower income tax
  if (left > 300 && missing <= 0 && target > 0) {
    const yearly = Math.min(left * 12, fromPln(11304));
    add("money", T("IKZE could lower your tax by about {0} a year", pln(yearly * 0.12)),
      T("Payments into an IKZE are deducted from your taxable income: putting {0} a year in returns about {1} in your tax settlement (12% tax bracket; 32% above 120 000 zł). The money is for retirement.", pln(yearly), pln(yearly * 0.12)), yearly * 0.12, "portfolio");
  }
}

/** Key ratios for the health check: { label, value, aim, state: good|warn|bad, tip }. */
export function healthCheck(d) {
  const income = Calc.totalIncome(d), avg = Calc.spending(d);
  if (!(income > 0) || !(avg.monthsUsed > 0)) return [];
  const spending = avg.essential + avg.nonEssential, left = income - spending, p = Calc.portfolio(d), em = Calc.emergency(d.Settings);
  const pc = v => Math.round(v * 100) + "%";
  const rows = [];
  const r = left / income;
  rows.push({ label: T("Savings rate"), value: savingsRateText(left, income), aim: T("20% or more"), state: r >= 0.2 ? "good" : r >= 0.1 ? "warn" : "bad" });
  rows.push({ label: T("Essential costs"), value: pc(avg.essential / income), aim: T("up to 50%"), state: avg.essential / income <= 0.5 ? "good" : avg.essential / income <= 0.6 ? "warn" : "bad" });
  rows.push({ label: T("Not essential"), value: pc(avg.nonEssential / income), aim: T("up to 30%"), state: avg.nonEssential / income <= 0.3 ? "good" : avg.nonEssential / income <= 0.4 ? "warn" : "bad" });
  const housing = Advisor.perCategory(d).find(c => c.category === "Housing / rent")?.perMonth || 0;
  if (housing > 0) rows.push({ label: T("Housing"), value: pc(housing / income), aim: T("up to 35%"), state: housing / income <= 0.35 ? "good" : housing / income <= 0.45 ? "warn" : "bad" });
  const loans = Calc.loanPayments(d);
  if (loans > 0) rows.push({ label: T("Loan payments"), value: pc(loans / income), aim: T("up to 30%"), state: loans / income <= 0.3 ? "good" : loans / income <= 0.45 ? "warn" : "bad" });
  const ess = em.monthly || avg.essential;
  if (ess > 0) { const m = p.safe / ess; rows.push({ label: T("Emergency fund"), value: T("{0} months", (Math.round(m * 10) / 10).toString().replace(".", ",")), aim: T("3–6 months"), state: m >= 3 ? "good" : m >= 1 ? "warn" : "bad" }); }
  if (p.safe > 0) { const yr = p.yearly / Math.max(1, p.total - (p.invest || 0)) * 100; rows.push({ label: T("Interest on your savings"), value: fmtPct(yr), aim: T("about the NBP rate or more"), state: yr >= 4 ? "good" : yr >= 2 ? "warn" : "bad" }); }
  return rows;
}

// ---------------------------------------------------------------- reset (Delete data)

export function reset(parts) {
  const d = State.data;
  if (parts.incomes) d.Incomes = [];
  if (parts.expenses) { d.Expenses = []; d.Received = []; d.Transfers = []; }
  if (parts.holdings) { d.Holdings = []; d.SavingsChecks = []; }
  if (parts.offers) d.Offers = [];
  if (parts.emergency) Object.assign(d.Settings, { MonthlyEssentials: 0, YearlyCosts: 0, EmergencyMonths: 3, BufferPercent: 10 });
  if (parts.rates) Object.assign(d.Settings, { UsdToPln: 0, EurToPln: 0 });
  if (parts.modules) { d.Goals = []; d.Loans = []; d.Budgets = []; d.Recurring = []; d.Investments = []; }
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
/** All running loans together, month by month from the first payment you entered to the last one:
 *  outstanding principal, cumulative principal repaid and cumulative interest paid (the lender's income).
 *  Before the first entered payment only what you entered is known (amount borrowed, interest paid so far). */
export function loanSchedule(d) {
  const loans = (d.Loans || []).filter(l => l.Remaining > 0 && l.MonthlyPayment > 0);
  if (!loans.length) return null;
  const per = loans.map(l => {
    const first = monthStart(parseDate(l.NextPayment || "") || loanNextPayment(l)), r = (+l.RatePercent || 0) / 100 / 12, P = +l.MonthlyPayment;
    const n = Math.min(loanMonthsNeeded(l), 600);
    return { first, r, P, n: n === Infinity ? 600 : n, A0: +l.Remaining, prin0: l.Original > l.Remaining ? l.Original - l.Remaining : 0, int0: +l.InterestPaid || 0 };
  });
  const start = new Date(Math.min(...per.map(p => addMonths(p.first, -1).getTime())));
  const endT = Math.max(...per.map(p => addMonths(p.first, p.n - 1).getTime()));
  const months = []; for (let m = new Date(start); m.getTime() <= endT && months.length < 601; m = addMonths(m, 1)) months.push(m);
  const balance = months.map(() => 0), principal = months.map(() => 0), interest = months.map(() => 0);
  for (const p of per) {
    let A = p.A0, cp = p.prin0, ci = p.int0;
    months.forEach((m, i) => {
      const k = Math.round((m - p.first) / (30.44 * 86400000));   // payment number (0 = the first payment you entered)
      if (k >= 0 && k < p.n && A > 0) { const it = A * p.r, pr = Math.min(A, p.P - it); ci += it; cp += pr; A = Math.max(0, A - pr); }
      balance[i] += A; principal[i] += cp; interest[i] += ci;
    });
  }
  const nowIdx = Math.max(0, months.findIndex(m => m > today()) - 1), past = months.findIndex(m => m > today());
  const round = a => a.map(v => Math.round(v * 100) / 100);
  return { months, balance: round(balance), principal: round(principal), interest: round(interest), pastCount: past < 0 ? months.length : Math.max(1, past),
    now: { balance: balance[nowIdx], principal: principal[nowIdx], interest: interest[nowIdx] }, totalInterest: interest[interest.length - 1],
    end: months[months.length - 1] };
}
export function planLoan(l) {
  if (!l.NextPayment) l.NextPayment = isoDate(loanNextPayment(l));
  const p = loanPlan(l);
  l.EndDate = p.end ? isoDate(p.end) : isoDate(addMonths(parseDate(l.NextPayment), 1200));
  l.Planned = true;
  return p;
}

// ---------- Learned categories: change one expense, and the same shop gets that category everywhere ----------
/** The shop or payee of a description, without card numbers, dates and amounts: "ŻABKA Z1234 SZCZECIN 12.10" → "żabka z szczecin". */
export const matchKey = text => String(text || "").toLowerCase().replace(/[0-9.,/#*:;_()+\-]+/g, " ").replace(/\b[a-z]\b/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
/** The category you chose earlier for this shop or payee (used for new imports), or null. */
export function ruleFor(d, text) {
  const k = matchKey(text);
  return k ? (d.Settings.CategoryRules || []).find(r => r.Match === k)?.Category || null : null;
}
export function learnCategory(d, text, category) {
  const k = matchKey(text); if (!k) return;
  const rules = d.Settings.CategoryRules || (d.Settings.CategoryRules = []);
  const r = rules.find(x => x.Match === k);
  if (r) r.Category = category; else rules.push({ Match: k, Category: category });
}
/** Other expenses from the same shop or payee. */
export function similarExpenses(d, e) {
  const k = matchKey(e.Description);
  return k ? d.Expenses.filter(x => x !== e && matchKey(x.Description) === k) : [];
}
/** Give a group of expenses a category (and its "essential" default). */
export function setCategory(list, category) {
  const ess = !!findCategory(category)?.Essential;
  for (const x of list) { x.Category = category; x.Essential = ess; x.Edited = true; }
}
