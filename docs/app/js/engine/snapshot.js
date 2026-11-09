// The Financial Snapshot: every global number, worked out once, so all advisors read the same facts.
// Pure function – no page access. `c` holds the raw figures; everything else is derived here.

/** How sure we are, from how much data there is (months of income and spending). */
export const dataConfidence = months => months >= 3 ? 0.9 : months >= 2 ? 0.75 : months >= 1 ? 0.55 : 0.3;

/**
 * c: { has, income, spending, essential, left, both, svRate, emF, target, safe, total, covered, debt, wealth, months,
 *      loans:[{name, rate, pay, rem}], mv:{gain, bank, moved}|null }   (money per month unless noted)
 */
export function makeSnapshot(c) {
  const loans = c.loans || [];
  const payments = loans.reduce((a, l) => a + (l.pay || 0), 0);
  const dear = [...loans].sort((a, b) => b.rate - a.rate)[0] || null;       // most expensive loan
  const neg = !!c.both && c.left < 0;                                       // spending above income
  const target = c.target || 0;
  return {
    ...c,
    loans, dear, neg,
    months: c.months || 0,
    confidence: dataConfidence(c.months || 0),
    dti: c.income > 0 ? payments / c.income : 0,                            // loan payments / income
    payments,
    interestYear: loans.reduce((a, l) => a + (l.rem || 0) * (l.rate || 0) / 100, 0),
    lowEF: target > 0 ? (c.emF || 0) < 0.5 : (c.safe || 0) <= 0,
    fullEF: target > 0 && (c.emF || 0) >= 1,
    surplus: Math.max(0, (c.safe || 0) - target),                           // safe money above the emergency target
    runway: neg && c.total > 0 ? c.total / -c.left : null,                  // months until savings are used up at this pace
    gain: c.mv && c.mv.gain > 0 ? c.mv.gain : 0,                            // yearly gain from a better savings place
    income12: Math.max(0, c.income * 12),
  };
}
