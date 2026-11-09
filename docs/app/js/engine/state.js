// The shared model of one "financial state" – the same shape for every advisor on every page.
// An advisor looks at the Snapshot and returns states; the engine ranks them; pages show them.

/** The advisor teams. Each state names the advisor it comes from (advisorType), so pages can group by team. */
export const ADVISORS = {
  financial:   { name: "Financial Advisor",        icon: "🧭", route: "overview"  },
  savings:     { name: "Savings Advisor",          icon: "🏦", route: "portfolio" },
  debt:        { name: "Debt Advisor",             icon: "💳", route: "loans"     },
  safety:      { name: "Financial Safety Advisor", icon: "🛡️", route: "emergency" },
  tax:         { name: "Tax Advisor",              icon: "🧾", route: "taxes"     },
  investment:  { name: "Investment Advisor",       icon: "📈", route: "investments" },
  opportunity: { name: "Opportunity Advisor",      icon: "💡", route: "overview"  },
  wealth:      { name: "Wealth Advisor",           icon: "💎", route: "networth"  },
  goal:        { name: "Goal Advisor",             icon: "🎯", route: "budget"    },
};

/** kind: problem | risk | opportunity | positive.  pot: the money an opportunity uses, so it is never counted twice. */
export const KINDS = ["problem", "risk", "opportunity", "positive"];
export const PRIORITY = ["low", "medium", "high", "critical"];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Builds one state with all the fields every page can rely on. Missing values get safe defaults.
 * severity 1-5 · confidence 0-1 · impactMonthly / annualImpact / potential: size of the effect in the main currency (≥ 0)
 */
export function makeState(s) {
  if (!s.id || !ADVISORS[s.advisorType]) throw new Error("state needs an id and a known advisorType: " + s.id);
  const severity = clamp(Math.round(s.severity || 1), 1, 5);
  const annualImpact = Math.max(0, s.annualImpact || 0);
  const kind = KINDS.includes(s.kind) ? s.kind : "problem";
  const actions = s.actions || [];
  return {
    id: s.id,
    advisorType: s.advisorType,
    kind,
    title: s.title || "",
    text: s.text || "",
    severity,
    priority: s.priority || PRIORITY[severity >= 5 ? 3 : severity >= 4 ? 2 : severity >= 2 ? 1 : 0],
    confidence: clamp(s.confidence ?? 0.5, 0, 1),
    impactMonthly: Math.max(0, s.impactMonthly ?? annualImpact / 12),
    annualImpact,
    doNothing: s.doNothing || "",
    actions,                                       // { icon, title, desc, btn, go }  go = route, or "@optimize"
    target: s.target || (actions[0] ? actions[0].go : ADVISORS[s.advisorType].route),   // the page that fixes it
    potential: Math.max(0, s.potential ?? (kind === "opportunity" ? annualImpact : 0)),
    pot: s.pot || "",                              // cash | surplus | debt | tax | …: opportunities in one pot do not add up
    risk: s.risk || "low",                         // risk of acting on it: low | medium | high
    difficulty: s.difficulty || "medium",          // easy | medium | hard
    minutes: s.minutes ?? 30,                      // time it takes to do
    impactScore: clamp(Math.round(s.impactScore ?? severity * 12 + clamp(annualImpact / Math.max(1, s.income12 || 12000) * 200, 0, 40)), 0, 100),
    sources: s.sources || [],                      // [{ name, date }]: where the numbers come from and when they were checked
    source: s.source || "",                        // which advisor registered it
  };
}

/** Most severe first; then the bigger yearly effect; then the more certain one. */
export const rank = (a, b) => b.severity - a.severity || b.annualImpact - a.annualImpact || b.confidence - a.confidence;
