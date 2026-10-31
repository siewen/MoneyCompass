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

export const DOWNLOAD_URL = "https://github.com/siewen/MoneyCompass/releases/latest";

/** For Pro features: true when unlocked, else explains and offers the profile (license key). */
export async function requirePro(feature) {
  if (license.isPro) return true;
  const enter = await confirmBox(T("MoneyCompass Pro"),
    T("\"{0}\" is part of MoneyCompass Pro. Enter your license key in your profile (top right) to unlock it.", feature),
    T("Enter license key"), T("Not now"));
  if (enter) App.openProfile();
  return false;
}

/** Free web version: only the Windows app (or Pro) has this. */
export async function windowsOrPro(feature) {
  if (license.isPro) return true;
  const go = await confirmBox(T("MoneyCompass Pro"),
    T("\"{0}\" is not part of the free web version. Download the free Windows app, or enter a Pro license key in your profile (top right).", feature),
    T("Download for Windows"), T("Not now"));
  if (go) window.open(DOWNLOAD_URL, "_blank", "noopener");
  return false;
}

export function changed() { save(); App.refresh(); }
export { State };
