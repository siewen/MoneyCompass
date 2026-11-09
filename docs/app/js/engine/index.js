// One entry point for pages: run the whole engine on the figures of the page.
import { moduleOn } from "../core.js";
import { makeSnapshot } from "./snapshot.js";
import { runEngine, overallStatus } from "./registry.js";
import { registerCoreAdvisors } from "./advisors.js";
export { registerAdvisor, unregisterAdvisor, opportunities, groupByAdvisor, potentialOf } from "./registry.js";
export { ADVISORS } from "./state.js";
export { makeSnapshot } from "./snapshot.js";

/** c = the raw figures (see makeSnapshot). Returns { snap, status, primary, secondary, states, byAdvisor, potential, confidence }. */
export function advise(c, isOn = moduleOn) {
  registerCoreAdvisors();
  const snap = makeSnapshot(c), res = runEngine(snap, isOn);
  return { snap, status: overallStatus(snap, res), ...res };
}
