// Current rates. A daily job on GitHub writes rates.json (NBP, treasury bonds, bank rankings),
// because a browser may not read those websites directly. Exchange rates also come straight from the NBP API.
import { State, save, store, today } from "./core.js";

const BUILT_IN_DATE = "2026-10-19";
const BUILT_IN = {
  SavingsOffers: [
    { Bank: "Erste Bank Polska", Name: "Konto Multi oszczędnościowe", Rate: 4.5, MaxAmount: 200000, Days: 30, Details: "nowe środki · do 29.11.2026", Url: "" },
    { Bank: "Volkswagen Bank", Name: "Plus Konto", Rate: 4.0, MaxAmount: 0, Days: 365, Details: "bez limitu kwoty · bez dodatkowych warunków", Url: "" },
    { Bank: "ING Bank Śląski", Name: "Otwarte Konto Oszczędnościowe", Rate: 4.0, MaxAmount: 400000, Days: 90, Details: "3 miesiące · dla nowych lub nieaktywnych oszczędzających", Url: "" },
    { Bank: "PKO Bank Polski", Name: "Konto Oszczędnościowe Plus", Rate: 4.0, MaxAmount: 250000, Days: 90, Details: "90 dni · nowe środki · do 07.01.2027", Url: "" },
    { Bank: "Toyota Bank", Name: "Indeksowane Konto Oszczędnościowe", Rate: 3.85, MaxAmount: 400000, Days: 365, Details: "zmienne, oparte na WIBOR 3M", Url: "" },
    { Bank: "Renault Bank", Name: "Elastyczny produkt oszczędnościowy", Rate: 3.8, MaxAmount: 400000, Days: 365, Details: "przez platformę Raisin · kapitalizacja kwartalna", Url: "" },
  ],
  DepositOffers: [
    { Bank: "Raiffeisen Digital Bank", Name: "Lokata dla nowych Klientów", Rate: 4.6, MaxAmount: 150000, Days: 365, Details: "nowi klienci, z kontem osobistym", Url: "" },
    { Bank: "Toyota Bank", Name: "Lokata Standard", Rate: 4.3, MaxAmount: 100000, Days: 365, Details: "2 000–100 000 zł · bez konta", Url: "" },
    { Bank: "Inbank", Name: "Lokata standardowa", Rate: 4.15, MaxAmount: 50000, Days: 365, Details: "1 000–50 000 zł · bez dodatkowych warunków", Url: "" },
    { Bank: "BFF Banking Group", Name: "Lokata Facto", Rate: 4.0, MaxAmount: 0, Days: 365, Details: "od 5 000 zł · rachunek Facto", Url: "" },
    { Bank: "Credit Agricole", Name: "Lokata na Nowe pieniądze", Rate: 3.8, MaxAmount: 250000, Days: 365, Details: "z Kontem dla Ciebie Prime · nowe środki", Url: "" },
    { Bank: "Nest Bank", Name: "Nest Lokata Nowe Środki", Rate: 3.7, MaxAmount: 2000000, Days: 365, Details: "z kontem osobistym · nowe środki", Url: "" },
  ],
};

// Typical interest rates for new loans in Poland, to compare your loans with (checked by hand; sources:
// finwire.pl – mortgages October 2026, totalmoney.pl – cash loans October/November 2026)
export const LOAN_MARKET = {
  checked: "2026-11-01",
  mortgage: { rate: 5.75, note: "variable: index about 3.55–3.9% + margin about 1.8–2.2%; fixed about 6.2%" },
  cash: { rate: 7.8, note: "best cash loan offers about 7.6–8.8% (RRSO about 7.9–9.2%)" },
  car: { rate: 8.5, note: "about like cash loans" },
  card: { rate: null, note: "most cards charge the legal maximum: 2 × (NBP reference rate + 3.5%)" },
  links: { mortgage: "https://www.bankier.pl/kredyty-hipoteczne/porownaj-oferty", cash: "https://www.totalmoney.pl/ranking-kredytow-gotowkowych", car: "https://www.totalmoney.pl/ranking-kredytow-gotowkowych" },
};
/** The legal maximum interest in Poland: 2 × (reference rate + 3.5 percentage points). */
export const maxLegalRate = () => 2 * ((Rates.data.ReferenceRate || 3.75) + 3.5);

export const BOND_CODES = ["OTS", "ROR", "DOR", "TOS", "COI", "EDO", "ROS", "ROD"];
export const BONDS_WEBSITE = "https://www.obligacjeskarbowe.pl/";
export const SAVINGS_RANKING = "https://rankomat.pl/finanse/rankingi/ranking-kont-oszczednosciowych/";
export const DEPOSITS_RANKING = "https://rankomat.pl/finanse/rankingi/ranking-lokat-na-12-miesiecy/";

function load() { try { return JSON.parse(store.get("mc-rates")) || {}; } catch { return {}; } }

export const Rates = {
  data: Object.assign({ Usd: 0, Eur: 0, ExchangeDate: null, ReferenceRate: 0, Bonds: [], SavingsOffers: [], DepositOffers: [], OffersChecked: null, Updated: null }, load()),
  updating: false, failed: false, listeners: [],

  get savings() { return this.data.SavingsOffers?.length ? this.data.SavingsOffers : BUILT_IN.SavingsOffers; },
  get deposits() { return this.data.DepositOffers?.length ? this.data.DepositOffers : BUILT_IN.DepositOffers; },
  get checked() { return this.data.DepositOffers?.length && this.data.OffersChecked ? this.data.OffersChecked : BUILT_IN_DATE; },
  bond(code) { return this.data.Bonds?.find(b => b.Code === code)?.Rate; },
  bestOffer() { return [...this.savings, ...this.deposits].sort((a, b) => b.Rate - a.Rate)[0] || null; },
  link(o) { return o.Url || "https://www.google.com/search?q=" + encodeURIComponent(`${o.Bank} ${o.Name}`.trim()); },

  async refresh(force = false) {
    if (!State.data.Settings.OnlineRates || this.updating) return;
    if (!force && this.data.Updated && Date.now() - new Date(this.data.Updated).getTime() < 3600_000) { this.applyExchange(); return; }
    this.updating = true; this.notify();
    let anything = false;
    const [file, usd, eur] = await Promise.allSettled([
      fetch("rates.json?t=" + Date.now()).then(r => r.ok ? r.json() : Promise.reject()),
      fetch("https://api.nbp.pl/api/exchangerates/rates/a/usd/?format=json").then(r => r.json()),
      fetch("https://api.nbp.pl/api/exchangerates/rates/a/eur/?format=json").then(r => r.json()),
    ]);
    if (file.status === "fulfilled" && file.value) {
      const f = file.value;
      for (const k of ["Usd", "Eur", "ExchangeDate", "ReferenceRate", "ReferenceSince"]) if (f[k]) this.data[k] = f[k];
      if (f.Bonds?.length >= 4) this.data.Bonds = f.Bonds;
      if (f.SavingsOffers?.length >= 3 && f.DepositOffers?.length >= 3) {
        this.data.SavingsOffers = f.SavingsOffers; this.data.DepositOffers = f.DepositOffers; this.data.OffersChecked = f.OffersChecked || f.Updated;
      }
      anything = true;
    }
    if (usd.status === "fulfilled" && eur.status === "fulfilled") {
      try {
        this.data.Usd = usd.value.rates[0].mid; this.data.Eur = eur.value.rates[0].mid;
        this.data.ExchangeDate = usd.value.rates[0].effectiveDate; anything = true;
      } catch { /* keep the old */ }
    }
    if (anything) { this.data.Updated = new Date().toISOString(); store.set("mc-rates", JSON.stringify(this.data)); }
    this.failed = !anything; this.updating = false;
    this.applyExchange(); this.notify();
  },
  applyExchange() {
    const s = State.data.Settings;
    if (!s.AutoExchangeRates || !(this.data.Usd > 0) || !(this.data.Eur > 0)) return;
    if (s.UsdToPln === this.data.Usd && s.EurToPln === this.data.Eur) return;
    s.UsdToPln = this.data.Usd; s.EurToPln = this.data.Eur; save();
  },
  notify() { this.listeners.forEach(f => f()); },
  toCompare(o, amt) {
    return {
      Id: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
      Name: o.Name ? `${o.Bank} – ${o.Name}` : o.Bank,
      Amount: o.MaxAmount > 0 ? Math.min(amt, o.MaxAmount) : amt,
      PromoRate: o.Rate, PromoLimit: o.MaxAmount || 0, PromoDays: Math.min(Math.max(o.Days || 365, 1), 365),
      StandardRate: 0, PeriodDays: 365, ApplyTax: true,
    };
  },
};
export const todayIso = () => today().toISOString();
