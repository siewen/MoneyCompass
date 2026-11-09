// Long-term money maths, shared by the Wealth Advisor and the Net Worth page. Pure functions.

/** Value after `years` of saving `c` a month on top of `A`, at `ret` % a year (monthly compounding). */
export function fv(A, c, ret, years) {
  const n = Math.round(years * 12), r = ret / 100 / 12;
  return r === 0 ? A + c * n : A * (1 + r) ** n + c * ((1 + r) ** n - 1) / r;
}
/** Months until `target` is reached (null if it takes more than 100 years). */
export function monthsTo(target, A, c, ret) {
  if (A >= target) return 0;
  const r = ret / 100 / 12;
  for (let m = 1; m <= 1200; m++) { A = A * (1 + r) + c; if (A >= target) return m; }
  return null;
}
/** The monthly amount needed to reach `target` in `years` from `A`. */
export function neededMonthly(target, A, ret, years) {
  const n = Math.round(years * 12), r = ret / 100 / 12, need = target - A * (1 + r) ** n;
  if (need <= 0 || n <= 0) return 0;
  return r === 0 ? need / n : need * r / ((1 + r) ** n - 1);
}
export const MILESTONES = [10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2000000];

/** Financial independence and retirement figures from the snapshot (and the saved plan). */
export function wealthFacts(s) {
  const n = s.nw || { net: 0, assets: 0, liabilities: 0, history: [] }, p = s.plan || { age: 0, retireAge: 65, spend: 0, ret: 4, contrib: null };
  const spend = p.spend > 0 ? p.spend : s.spending || 0;                       // spending per month in retirement (today's money)
  const contrib = p.contrib !== null && p.contrib !== undefined ? p.contrib : Math.max(0, s.left || 0);
  const fiNumber = spend * 12 * 25;                                           // "25 times yearly spending": the 4% rule of thumb
  const base = Math.max(0, n.net);
  const years = p.age > 0 ? Math.max(0, p.retireAge - p.age) : 0;
  const projected = p.age > 0 ? fv(base, contrib, p.ret, years) : null;
  return { spend, contrib, fiNumber, progress: fiNumber > 0 ? base / fiNumber : 0, fiMonths: fiNumber > 0 ? monthsTo(fiNumber, base, contrib, p.ret) : null,
    years, projected, readiness: projected !== null && fiNumber > 0 ? projected / fiNumber : null,
    gapMonthly: projected !== null && fiNumber > 0 && projected < fiNumber ? neededMonthly(fiNumber, base, p.ret, years) - contrib : 0, ret: p.ret };
}
