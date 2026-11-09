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
  ppk: { employee: 0.02, employer: 0.015 },   // PPK (employee pension plan): employer share is taxable income
  youngLimit: 85528,               // under-26 relief: no income tax on income up to this amount a year
};

// Where the figures come from (official sources). Check them once a year together with the numbers above.
export const TAX_SOURCES = [
  ["Social insurance (ZUS): contribution rates and limits", "https://www.zus.pl/baza-wiedzy/skladki-wskazniki-odsetki"],
  ["Income tax (PIT): rates, tax-free amount, costs of earning income", "https://www.podatki.gov.pl/pit/"],
  ["Ministry of Finance", "https://www.gov.pl/web/finanse"],
  ["Employee capital plans (PPK)", "https://www.mojeppk.pl"],
];
