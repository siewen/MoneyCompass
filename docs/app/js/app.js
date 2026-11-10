// Shared app actions, filled in by main.js (keeps the page modules independent of each other).
import { T, license, State, save } from "./core.js";
import { confirmBox } from "./ui.js";

export const App = {
  go: route => {},          // open a tab
  refresh: () => {},        // draw the current tab again
  rebuild: () => {},        // tabs, theme and language changed
  openProfile: () => {},
  openOptions: () => {},
  openHelp: () => {},
  openExport: () => {},
  openImport: () => {},
  openDelete: () => {},
  openBankImport: () => {},
  applyTheme: () => {},
  openOptimize: () => {},
};


/** For Pro features: true when unlocked, else explains and offers the profile (license key). */
export async function requirePro(feature) {
  if (license.isPro) return true;
  const enter = await confirmBox(T("MoneyCompass Pro"),
    T("\"{0}\" is part of MoneyCompass Pro. Enter your license key in your profile (top right) to unlock it.", feature),
    T("Enter license key"), T("Not now"));
  if (enter) App.openProfile();
  return false;
}

/** Features that need a Pro license (kept under its old name, many pages call it). */
export async function windowsOrPro(feature) { return requirePro(feature); }

export function changed() { save(); App.refresh(); }
export { State };
