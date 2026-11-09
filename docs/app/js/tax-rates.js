// ONE place for the Polish tax and insurance figures used by the Taxes module.
// Update this file once a year (new year → change `year` and the numbers below). Everything else reads from here.
export const TAX = {
  year: 2026,
  checked: "2026-11",
  // Employment contract (umowa o pracę), employee side
  zus: { pension: 0.0976, disability: 0.015, sickness: 0.0245 },   // social insurance, % of gross (together 13.71%)
  zusYearLimit: 282600,            // pension and disability stop once the gross for the year passes this (30 × average wage)
  health: 0.09,                    // health insurance, % of (gross − social insurance); not deductible from tax
  pit: { low: 0.12, high: 0.32, threshold: 120000, taxFree: 30000 },   // tax-free amount 30 000 zł = 3 600 zł less tax a year
  kup: { standard: 250, raised: 300 },   // costs of earning income, zł per month (raised = you work in another town)
  sick: { rate: 0.8, employerDays: 33 },   // sick leave: 80% of the pay after social insurance; the employer pays the first 33 days a year, ZUS from day 34
  // Other contract types
  zlecenie: { kup: 0.2, kupCopyright: 0.5, copyrightLimit: 120000 },   // umowa zlecenie / umowa o dzieło: costs = 20% of the pay after social insurance, 50% for copyright (up to 120 000 zł a year)
  b2b: {   // own business (B2B): ZUS for the self-employed, monthly amounts
    zus: {
      full: { base: 5652, pension: 0.1952, disability: 0.08, accident: 0.0167, fund: 0.0245, sickness: 0.0245 },   // "big ZUS": base = 60% of the forecast average wage
      pref: { base: 1441.8, pension: 0.1952, disability: 0.08, accident: 0.0167, fund: 0, sickness: 0.0245 },     // preferential ZUS, first 24 months: base = 30% of the minimum wage
    },
    linear: 0.19,                                           // flat tax
    health: { min: 432.54, minJan: 314.96, scale: 0.09, linear: 0.049, lump: [[60000, 5537.18], [300000, 9228.64], [Infinity, 16611.55]] },   // lump: yearly revenue limit → base; 9% of the base
    lumpRates: [0.17, 0.15, 0.14, 0.125, 0.12, 0.10, 0.085, 0.055, 0.03, 0.02],
  },
  family: {   // yearly tax return (PIT): child relief and who can use it
    childRelief: [0, 1112.04, 2224.08, 4224.12, 6924.12], childExtra: 2700,   // a year, for 1, 2, 3, 4 children, and for every child after the 4th
    limitOne: { joint: 112000, other: 56000 },   // with ONE child the relief needs an income below this (married or single parent: 112 000, others: 56 000 per parent)
  },
  ppk: { employee: 0.02, employer: 0.015 },   // PPK (employee pension plan): employer share is taxable income
  youngLimit: 85528,               // under-26 relief: no income tax on income up to this amount a year
};

// Where the figures come from (official sources). Check them once a year together with the numbers above.
export const TAX_SOURCES = [
  ["Social insurance (ZUS): contribution rates and limits", "https://www.zus.pl/baza-wiedzy/skladki-wskazniki-odsetki"],
  ["Income tax (PIT): rates, tax-free amount, costs of earning income", "https://www.podatki.gov.pl/pit/"],
  ["Ministry of Finance", "https://www.gov.pl/web/finanse"],
  ["Self-employed: ZUS and health contributions", "https://www.zus.pl/firma/oplacanie-skladek"],
  ["Employee capital plans (PPK)", "https://www.mojeppk.pl"],
];
