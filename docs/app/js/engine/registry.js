// The registry: any module can add an advisor. The engine runs all of them on one snapshot,
// ranks their states, picks the one that drives the banner and adds up the potential without double counting.
import { makeState, rank, ADVISORS } from "./state.js";

const advisors = new Map();     // id → { id, module, advise(snapshot) → [state] }

/** Adds (or replaces) an advisor. `module` is the Pro module code (or "core"); it is skipped when that module is off. */
export function registerAdvisor({ id, module = "core", advise }) { advisors.set(id, { id, module, advise }); return () => advisors.delete(id); }
export const unregisterAdvisor = id => advisors.delete(id);
export const listAdvisors = () => [...advisors.values()].map(a => ({ id: a.id, module: a.module }));

/**
 * Runs every active advisor. isOn(moduleCode) tells whether a module is switched on (core is always on).
 * Returns { states (ranked), primary, secondary, byAdvisor, potential, confidence }.
 */
export function runEngine(snap, isOn = () => true) {
  const states = [];
  for (const a of advisors.values()) {
    if (a.module !== "core" && !isOn(a.module)) continue;
    let out = [];
    try { out = a.advise(snap) || []; } catch (e) { console.warn("advisor failed", a.id, e); }     // one broken advisor never breaks the rest
    for (const s of out) { try { states.push(makeState({ income12: snap.income12, source: a.id, ...s })); } catch (e) { console.warn("bad state", e); } }
  }
  states.sort(rank);
  // The banner is driven by the most severe problem or risk; with none, the biggest opportunity; with none, a positive state.
  const pick = kinds => states.find(s => kinds.includes(s.kind));
  const primary = pick(["problem", "risk"]) || pick(["opportunity"]) || pick(["positive"]) || null;
  const byAdvisor = {};
  for (const s of states) (byAdvisor[s.advisorType] ||= []).push(s);
  return { states, primary, secondary: states.filter(s => s !== primary), byAdvisor, potential: potentialOf(states), confidence: snap.confidence };
}

/** Total yearly improvement: in each pot only the best opportunity counts, so one zloty is never claimed twice. */
export function potentialOf(states) {
  const best = new Map();
  for (const s of states) {
    if (s.potential <= 0) continue;
    const key = s.pot || "own:" + s.id;
    if (!best.has(key) || best.get(key).potential < s.potential) best.set(key, s);
  }
  return { total: [...best.values()].reduce((a, s) => a + s.potential, 0), counted: [...best.values()] };
}

/** Opportunities of all advisors, best first – the list the Optimization Center will show. */
export const opportunities = res => res.states.filter(s => s.kind === "opportunity").sort((a, b) => b.potential - a.potential || b.confidence - a.confidence);
/** Groups states by advisor team: [{ type, name, icon, route, list }]. */
export const groupByAdvisor = states => Object.entries(states.reduce((m, s) => ((m[s.advisorType] ||= []).push(s), m), {})).map(([type, list]) => ({ type, ...ADVISORS[type], list }));

/** The overall status (the label of the banner) from the snapshot and the states. */
export function overallStatus(snap, res) {
  if (!snap.has) return "start";
  if (snap.dti > 0.35 || (snap.debt > 0 && snap.neg)) return "debt";
  if ((snap.neg && snap.emF < 0.25) || snap.wealth < 30) return "critical";
  if (snap.neg || (snap.both && snap.svRate < 0.05) || snap.lowEF || snap.wealth < 55) return "warning";
  if (snap.wealth < 75 || !snap.fullEF || (snap.both && snap.svRate < 0.2)) return "stable";
  return res.states.some(s => s.id === "better-deposit") ? "opportunity" : "healthy";
}
