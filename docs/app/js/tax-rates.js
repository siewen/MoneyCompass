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
  youngLimit: 85528,               // under-26 relief: no income tax on income up to this amount a year
};
