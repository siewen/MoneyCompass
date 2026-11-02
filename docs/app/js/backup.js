// Automatic backup (web app). Browsers don't let a website write files on their own, so the user picks the backup file once;
// after that MoneyCompass updates it by itself a few seconds after every change. The file is the normal profile file
// (encrypted when a file password is set), so "Load a profile…" restores it.
// Browsers without this (Firefox, Safari, phones) get a reminder to save the profile file instead.
// The file handle is kept in IndexedDB of this browser (it can't go into localStorage). Browsers show only the file name, never the folder.
import { T, State, store, fmtDate, markFileBase, license } from "./core.js";
import { esc, toast } from "./ui.js";
import { backupFileText } from "./crypt.js";

export const autoSupported = () => typeof window.showSaveFilePicker === "function" && window.isSecureContext;
const metaKey = () => "mc-backup:" + State.id, laterKey = () => "mc-backup-later:" + State.id;
const meta = () => { try { return JSON.parse(store.get(metaKey()) || "null"); } catch { return null; } };
const setMeta = m => m ? store.set(metaKey(), JSON.stringify(m)) : store.remove(metaKey());

// ---------- IndexedDB: one store "handles", key = profile id ----------
function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("moneycompass", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("handles");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idb(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => { const t = d.transaction("handles", mode); const q = fn(t.objectStore("handles")); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); });
}
const getHandle = id => idb("readonly", s => s.get(id)).catch(() => null);
const putHandle = (id, h) => idb("readwrite", s => s.put(h, id));
const delHandle = id => idb("readwrite", s => s.delete(id)).catch(() => {});

// ---------- state ----------
let status = "off";   // off | on | paused (the browser wants permission again) | error
let timer = 0, onChange = () => {};
/** Automatic backup of the current profile: { status, file, at } (file = file name, at = last backup time). */
export const backupInfo = () => ({ status, file: meta()?.file || "", at: meta()?.at || "" });

async function refresh() {
  const m = meta();
  if (!m || !autoSupported()) { status = "off"; return; }
  const h = await getHandle(State.id);
  if (!h) { status = "off"; setMeta(null); return; }
  try { status = (await h.queryPermission({ mode: "readwrite" })) === "granted" ? "on" : "paused"; } catch { status = "paused"; }
}

async function writeNow(h) {
  const w = await h.createWritable();
  await w.write(await backupFileText(State.data)); await w.close();
  const n = new Date(), at = new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 19);  // local time
  setMeta({ file: h.name, at });
  State.data.Settings.LastProfileSaved = at;
  store.set("mc-p:" + State.id, JSON.stringify(State.data));
  markFileBase();
}

/** Pick the backup file (needs a click). True when the backup is on. */
export async function chooseBackupFile() {
  if (!autoSupported()) return false;
  let h;
  try {
    h = await window.showSaveFilePicker({ suggestedName: `MoneyCompass-${(State.data.Settings.ProfileName || "profile").replace(/[^\p{L}\p{N} _-]/gu, "")}-backup.mcbak`,
      startIn: "documents", types: [{ description: "MoneyCompass backup", accept: { "application/octet-stream": [".mcbak"] } }] });
  } catch { return false; }  // cancelled
  try { await writeNow(h); await putHandle(State.id, h); status = "on"; store.remove(laterKey()); onChange(); return true; }
  catch { status = "error"; onChange(); return false; }
}
/** Ask again for permission after a browser restart (needs a click). */
export async function resumeBackup() {
  const h = await getHandle(State.id); if (!h) return chooseBackupFile();
  try { if ((await h.requestPermission({ mode: "readwrite" })) !== "granted") return false; await writeNow(h); status = "on"; onChange(); return true; }
  catch { status = "error"; onChange(); return false; }
}
export async function stopBackup() { await delHandle(State.id); setMeta(null); status = "off"; onChange(); }
export function forgetBackup(id) { delHandle(id); store.remove("mc-backup:" + id); store.remove("mc-backup-later:" + id); }

/** Called after every save: the backup is written a few seconds later (several changes in a row = one write). */
export function backupSoon() {
  if (status !== "on" || !license.isPro) return;   // automatic backup is Pro: without it, nothing is written
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const h = await getHandle(State.id); if (!h) return;
    try {
      if ((await h.queryPermission({ mode: "readwrite" })) !== "granted") { status = "paused"; onChange(); return; }
      await writeNow(h);
    } catch { status = "error"; onChange(); }
  }, 3000);
}

// ---------- the reminder bar (top of the page) ----------
const entries = () => { const d = State.data; return ["Expenses", "Received", "Income", "Holdings", "Loans", "Recurring", "Offers", "Goals"].reduce((n, k) => n + (Array.isArray(d[k]) ? d[k].length : 0), 0); };
const daysSince = iso => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : Infinity;
const later = () => { const l = store.get(laterKey()); return l && daysSince(l) < 7; };

/** Text and buttons for the bar, or null when nothing is needed. */
function barContent(saveFile) {
  // Without Pro: no automatic backup – only the reminder to save the profile file (free)
  if (!license.isPro) {
    if (entries() < 10 || later()) return null;
    const last = State.data.Settings.LastProfileSaved, d = daysSince(last);
    if (d < 14) return null;
    return { text: "🛡️ " + (last ? T("Last backup: {0} days ago.", d) : T("No backup yet: clearing the browser data would delete your entries.")), btn: T("Save now"), act: saveFile };
  }
  if (status === "paused") return { text: "🛡️ " + T("Automatic backup is paused until you allow it again."), btn: T("Continue backup"), act: resumeBackup };
  if (status === "error") return { text: "⚠️ " + T("The automatic backup could not be written."), btn: T("Choose the file again"), act: chooseBackupFile };
  if (status === "on" || later() || entries() < 10) return null;
  if (autoSupported()) return { text: "🛡️ " + T("Protect your data: keep an automatic backup on this computer."), btn: T("Choose where to keep it"), act: chooseBackupFile };
  const last = State.data.Settings.LastProfileSaved, d = daysSince(last);
  if (d < 14) return null;
  return { text: "🛡️ " + (last ? T("Last backup: {0} days ago.", d) : T("No backup yet: clearing the browser data would delete your entries.")), btn: T("Save now"), act: saveFile };
}
export function drawBackupBar(saveFile) {
  const el = document.getElementById("backup-bar"); if (!el) return;
  const c = barContent(saveFile);
  el.hidden = !c; if (!c) { el.innerHTML = ""; return; }
  el.innerHTML = `<span>${esc(c.text)}</span><button class="btn main small" data-bk="go">${esc(c.btn)}</button>${status === "off" ? `<button class="btn second small" data-bk="later">${esc(T("Later"))}</button>` : ""}`;
  el.querySelector('[data-bk="go"]').onclick = async () => { const ok = await c.act(); if (ok && status === "on") toast(T("Automatic backup is on: {0}", backupInfo().file), "good"); drawBackupBar(saveFile); };
  el.querySelector('[data-bk="later"]')?.addEventListener("click", () => { store.set(laterKey(), new Date().toISOString()); drawBackupBar(saveFile); });
}

/** Start: ask the browser to keep our data, read the backup state, and redraw the bar when it changes. */
export async function startBackup(redraw) {
  onChange = redraw;
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch { /* not supported */ }
  await refresh(); onChange();
  window.addEventListener("mc-saved", backupSoon);
}
/** After switching profile. */
export async function backupProfileChanged() { clearTimeout(timer); await refresh(); onChange(); }

/** One line for the profile panel and Options. */
export function backupLine() {
  const b = backupInfo();
  if (!license.isPro) return T("Automatic backup is part of MoneyCompass Pro. Save your profile regularly.");
  if (b.status === "on") return T("Automatic backup: on · file {0} · last saved {1}", b.file, fmtDate(b.at) + " " + b.at.slice(11, 16));
  if (b.status === "paused") return T("Automatic backup: paused · file {0}", b.file);
  if (b.status === "error") return T("Automatic backup: could not write file {0}", b.file);
  return autoSupported() ? T("Automatic backup: off") : T("Automatic backup is not possible in this browser (use Chrome or Edge on a computer). Save your profile regularly.");
}
