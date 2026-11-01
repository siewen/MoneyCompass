// Downloads the public rates for the MoneyCompass web app and writes docs/app/rates.json.
// Runs every day on GitHub (see .github/workflows/rates.yml). Same sources as the Windows app.
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const OUT = new URL("../docs/app/rates.json", import.meta.url);
const UA = { "User-Agent": "MoneyCompass/2.0 (personal finance app)", "Accept": "text/html,application/json,application/xml;q=0.9,*/*;q=0.8" };
const get = async url => { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error(url + " " + r.status); return r.text(); };
const decode = s => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)));
const num = s => { const v = parseFloat(String(s || "").replace(",", ".")); return Number.isFinite(v) ? v : 0; };
const old = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const data = { ...old };

const BOND_CODES = ["OTS", "ROR", "DOR", "TOS", "COI", "EDO", "ROS", "ROD"];
function parseBonds(html) {
  let text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ");
  text = decode(text.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
  const find = re => {
    const found = [];
    for (const m of text.matchAll(re)) {
      const code = m[2].toUpperCase();
      if (!BOND_CODES.includes(code) || found.some(b => b.Code === code)) continue;
      const rate = num(m[1]);
      if (rate > 0 && rate < 30) found.push({ Code: code, Rate: rate });
    }
    return found;
  };
  let f = find(/(\d{1,2}[,.]\d{1,2})\s?%\s{0,5}Obligacje.{0,900}?symbol:?\s*([A-Za-z]{3})/gis);
  if (f.length < 4) f = find(/(\d{1,2}[,.]\d{1,2})\s?%(?:(?!\d{1,2}[,.]\d{1,2}\s?%).){0,900}?symbol:?\s*([A-Za-z]{3})/gis);
  return f.sort((a, b) => BOND_CODES.indexOf(a.Code) - BOND_CODES.indexOf(b.Code));
}

const RATE = /(\d{1,2}(?:[,.]\d{1,2})?)\s?%/;
const clean = html => decode(html.replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, " $1 ").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
function maxAmount(text) {
  const a = "(\\d{1,3}(?:[\\s\\u00A0.]\\d{3})+|\\d+)";
  let m = new RegExp("do(?: kwoty)?(?: niższej niż)?\\s+" + a + "\\s*(tys\\.?)?\\s*(?:zł|PLN)", "i").exec(text), n;
  if (m) n = m[1]; else { m = new RegExp(a + "\\s*[-–]\\s*" + a + "\\s*(tys\\.?)?\\s*(?:zł|PLN)", "i").exec(text); if (!m) return 0; n = m[2]; }
  const v = num(n.replace(/[\s .]/g, ""));
  return /tys/i.test(m[0]) ? v * 1000 : v;
}
function days(text, fallback) {
  if (/bezterminow|bez ograniczeń czasowych/i.test(text)) return 365;
  const d = /(\d{1,3})\s*dni/i.exec(text); if (d) return +d[1];
  const m = /(\d{1,2})\s*(?:mies|m-c)/i.exec(text); if (!m) return fallback;
  return +m[1] >= 12 ? 365 : +m[1] * 30;
}
function parseOffers(html, defaultDays) {
  const offers = [];
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => clean(c[1]));
    if (cells.length < 3) continue;
    const ri = cells.findIndex(c => RATE.test(c));
    if (ri < 1) continue;
    const rate = num(RATE.exec(cells[ri])[1]);
    if (rate < 0.5 || rate > 15) continue;
    const names = cells.slice(0, ri).filter(c => c.length > 1 && !/^\d+\.?$/.test(c));
    if (!names.length) continue;
    const rest = cells[ri].replace(RATE, "").trim().replace(/^[\s/·-]+|[\s/·-]+$/g, "");
    const details = [rest, ...cells.slice(ri + 1)].filter(c => c.length > 1 && !/^(porównaj|otwórz.*|sprawdź.*|załóż.*|więcej.*)$/i.test(c));
    const all = details.join(" · ").replace(/\s*·?\s*(Porównaj inne|Porównaj|Sprawdź szczegóły|Załóż konto|Otwórz konto)\s*$/i, "").trim();
    let url = "";
    for (const a of row[1].matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      let href = decode(a[1]).trim(); const t = clean(a[2]);
      if (href.startsWith("#") || /^javascript/i.test(href) || /porównaj|compare/i.test(t)) continue;
      if (href.startsWith("/")) href = "https://rankomat.pl" + href;
      if (/^http/i.test(href)) { url = href; break; }
    }
    offers.push({ Url: url, Bank: names[0], Name: names[1] || "", Rate: rate, MaxAmount: maxAmount(all), Days: days(all, defaultDays), Details: all.length > 160 ? all.slice(0, 157).trimEnd() + "…" : all });
  }
  const seen = new Set();
  return offers.filter(o => { const k = o.Bank + "|" + o.Name; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => b.Rate - a.Rate).slice(0, 6);
}

// Loan offers from the totalmoney.pl rankings (text based, so small layout changes don't break it).
const LOAN_BANKS = ["PKO Bank Polski", "Bank Pekao", "Pekao", "mBank", "ING Bank Śląski", "Santander Bank Polska", "Santander", "Bank Millennium", "Millennium", "VeloBank", "Alior Bank",
  "Credit Agricole", "BNP Paribas", "Erste Bank Polska", "UniCredit", "Raiffeisen Digital Bank", "Citi Handlowy", "Nest Bank", "Bank BPS", "Inbank", "Toyota Bank", "Smartney"];
export function parseLoans(html, min, max) {
  const text = decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " | ")).replace(/\s+/g, " ");
  const names = LOAN_BANKS.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const found = [];
  const hits = [...text.matchAll(new RegExp("(" + names + ")", "g"))];
  for (let i = 0; i < hits.length; i++) {
    const m = hits[i], start = m.index + m[0].length, end = Math.min(hits[i + 1]?.index ?? text.length, start + 700);
    const win = text.slice(start, end);
    const rrso = /RRSO[^\d]{0,40}(\d{1,2}[,.]\d{1,2})\s?%/i.exec(win);
    if (!rrso) continue;
    const nominal = /oprocentowanie(?! ?m)(?: nominalne)?(?:(?!RRSO)[^\d]){0,40}(\d{1,2}[,.]\d{1,2})\s?%/i.exec(win);
    const o = { Bank: m[1].replace(/^Pekao$/, "Bank Pekao").replace(/^Millennium$/, "Bank Millennium"), Name: "", Rrso: num(rrso[1]) };
    if (nominal) o.Rate = num(nominal[1]);
    if (/stał/i.test(win)) o.Fixed = true; else if (/zmienn/i.test(win)) o.Fixed = false;
    if (!(o.Rrso >= min && o.Rrso <= max) || (o.Rate && !(o.Rate >= min - 1 && o.Rate <= o.Rrso))) continue;
    if (found.some(f => f.Bank === o.Bank && f.Fixed === o.Fixed)) continue;
    found.push(o);
  }
  return found.sort((a, b) => a.Rrso - b.Rrso).slice(0, 6);
}

const tasks = {
  usd: get("https://api.nbp.pl/api/exchangerates/rates/a/usd/?format=json"),
  eur: get("https://api.nbp.pl/api/exchangerates/rates/a/eur/?format=json"),
  ref: get("https://static.nbp.pl/dane/stopy/stopy_procentowe.xml"),
  bonds: get("https://www.obligacjeskarbowe.pl/"),
  savings: get("https://rankomat.pl/finanse/rankingi/ranking-kont-oszczednosciowych/"),
  deposits: get("https://rankomat.pl/finanse/rankingi/ranking-lokat-na-12-miesiecy/"),
  mortgages: get("https://www.totalmoney.pl/kredyty_hipoteczne"),
  cashLoans: get("https://www.totalmoney.pl/kredyty_gotowkowe"),
};
const r = {};
for (const [k, p] of Object.entries(tasks)) { try { r[k] = await p; } catch (e) { console.log("failed:", k, e.message); } }
const now = new Date().toISOString();
try { const u = JSON.parse(r.usd).rates[0], e = JSON.parse(r.eur).rates[0]; data.Usd = u.mid; data.Eur = e.mid; data.ExchangeDate = u.effectiveDate; } catch { /* keep */ }
try {
  const m = /<pozycja[^>]*id="ref"[^>]*>/i.exec(r.ref || "");
  if (m) { data.ReferenceRate = num(/oprocentowanie="([^"]+)"/.exec(m[0])?.[1]); data.ReferenceSince = /obowiazuje_od="([^"]+)"/.exec(m[0])?.[1] || null; }
} catch { /* keep */ }
try { const b = parseBonds(r.bonds || ""); if (b.length >= 4) data.Bonds = b; } catch { /* keep */ }
try {
  const s = parseOffers(r.savings || "", 90), d = parseOffers(r.deposits || "", 365);
  if (s.length >= 3 && d.length >= 3) { data.SavingsOffers = s; data.DepositOffers = d; data.OffersChecked = now; }
} catch { /* keep */ }
try {
  const mo = parseLoans(r.mortgages || "", 3.5, 10), ca = parseLoans(r.cashLoans || "", 5, 20);
  const L = { ...(data.LoanOffers || {}) };
  if (mo.length >= 3) L.mortgage = mo.map(o => ({ ...o, Name: o.Name || (o.Fixed ? "Kredyt hipoteczny – stałe" : o.Fixed === false ? "Kredyt hipoteczny – zmienne" : "Kredyt hipoteczny") }));
  if (ca.length >= 3) L.cash = ca.map(o => ({ ...o, Name: o.Name || "Kredyt gotówkowy" }));
  if (mo.length >= 3 || ca.length >= 3) { L.Checked = now; data.LoanOffers = L; }
  console.log("loans: mortgage", mo.length, "cash", ca.length);
} catch (e) { console.log("loans failed:", e.message); }
data.Updated = now;
writeFileSync(OUT, JSON.stringify(data, null, 1) + "\n");
console.log("bonds", data.Bonds?.length, "savings", data.SavingsOffers?.length, "deposits", data.DepositOffers?.length, "usd", data.Usd, "ref", data.ReferenceRate);
