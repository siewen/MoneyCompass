// Pop-up windows: profile & license, Options, Help, Delete data, Import, Export.
import {
  T, State, save, license, LANGS, lang, currentName, initials, picture, setPicture, profiles, switchTo, createProfile, deleteProfile,
  replaceData, normalise, looksLikeProfile, summary, reset, MODULES, setModule, moduleOn, Calc, Advisor, ChartData, pln, rate, fmtDate,
  parseDate, categoryLabel, monthName, ONE_TIME, store,
  markFileBase, savingsRateText } from "./core.js";
import { esc, card, heading, hint, row, field, textInput, select, check, button, values, popup, confirmBox, alertBox, promptBox, toast, pickFile, download, stamp } from "./ui.js";
import { App, requirePro, windowsOrPro, DOWNLOAD_URL } from "./app.js";
import { hasPin, lock, pinDialog, bioAvailable, bioOn, enableBio, removeBio } from "./lock.js";
import { fileProtected, setFilePassword, removeFilePassword, profileFileText, isEncryptedFile, decryptFile, isBuiltinFile, openBuiltin } from "./crypt.js";
import { Rates } from "./rates.js";
import { autoSupported, backupInfo, backupLine, chooseBackupFile, stopBackup, drawBackupBar } from "./backup.js";
import { openBankImport } from "./pages-pro.js";

const D = () => State.data;
const COLORS_AVATAR = ["#0F766E", "#1D4ED8", "#C2410C", "#7E22CE", "#BE123C", "#0E7490", "#4338CA", "#15803D"];
export const avatarColor = name => COLORS_AVATAR[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS_AVATAR.length];
export function avatar(size = 36) {
  const pic = picture(), name = currentName();
  return pic ? `<img class="avatar" src="${pic}" alt="" style="width:${size}px;height:${size}px">`
    : `<span class="avatar" style="width:${size}px;height:${size}px;background:${avatarColor(name)};font-size:${size * 0.4}px">${esc(initials(name))}</span>`;
}

// ================================================================= Profile (name, picture, license, profiles)

export function openProfile() {
  const p = popup("", { width: 420, anchor: "top-right", cls: "profile-panel" });
  const draw = () => {
    const l = license.current;
    const list = profiles();
    p.el.innerHTML = `<div class="profile-head">${avatar(72)}<div><h2>${esc(currentName())}</h2>
        ${l?.email ? `<div class="hint">${esc(l.email)}</div>` : ""}<div class="${license.isPro ? "good" : "hint"}"><b>${esc(license.isPro ? T("MoneyCompass Pro") : T("Free version"))}</b></div>
        <div class="links"><a href="#" data-a="rename">${esc(T("Change name"))}</a> · <a href="#" data-a="pic">${esc(T("Change picture"))}</a>${picture() ? ` · <a href="#" data-a="nopic">${esc(T("Remove picture"))}</a>` : ""}</div></div></div>
      <hr><h3>${license.isPro ? "✔" : "🔒"} ${esc(T("Activation"))}</h3>
      ${license.isPro ? hint(license.status) + hint(T("Thank you! All features are unlocked.")) + button(esc(T("Remove license from this browser")), "remove-license", "second small")
        : (l ? `<p class="bad">${esc(license.status)}</p>` : "") +
          hint(T("Pro unlocks: Optimize my finances with current rates, Compare offers, Import bank statement, own categories with icons, the Modules and unlimited exports (the free version has {0}).", 0)) +
          field(T("License key"), `<textarea name="key" rows="3" placeholder="MC1-…" data-nofocus></textarea>`) + button(esc(T("Activate")), "activate", "main")}
      <hr><h3>🔒 ${esc(T("PIN"))}</h3>
      ${hint(hasPin() ? T("This profile is protected with a PIN.") : T("No PIN: anyone using this device can open this profile."))}
      <div class="buttons">${button(esc(hasPin() ? T("Change or remove PIN…") : T("Set a PIN…") + (license.isPro ? "" : " 🔒")), "pin", "second small")}</div>
      ${bioAvailable() ? (hasPin()
        ? `<label class="check"><input type="checkbox" data-bio${bioOn() ? " checked" : ""}><span>👆 ${esc(T("Unlock with fingerprint or face on this device") + (license.isPro ? "" : " 🔒"))}</span></label>`
        : hint("👆 " + T("Set a PIN to also unlock with fingerprint or face."))) : ""}
      <hr><h3>${esc(T("Profiles"))}</h3>
      <div class="list">${list.map(x => `<div class="item${x.current ? " current" : " clickable"}" data-switch="${x.id}"><div><b>${esc(x.name)}</b>${x.current ? `<span class="hint">${esc(T("in use"))}</span>` : ""}</div>
        ${x.current ? "" : `<button class="icon-btn danger" data-del-profile="${x.id}">🗑</button>`}</div>`).join("")}</div>
      <div class="buttons">${button("＋ " + esc(T("New profile")), "new-profile", "second")}${button(esc(T("Save profile") + (license.isPro ? "" : " 🔒")), "save-file", "second")}${button(esc(T("Load a profile…")), "load-file", "second")}</div>
      ${hint("🛡️ " + backupLine())}
      <div class="popup-buttons"><button class="btn second" data-close>${esc(T("Close"))}</button></div>`;
    bind();
  };
  const bind = () => {
    const on = (sel, fn) => { const x = p.el.querySelector(sel); if (x) x.onclick = ev => { ev.preventDefault(); fn(); }; };
    on('[data-a="rename"]', async () => {
      const n = await promptBox(T("Change name"), T("Name"), currentName());
      if (n && n.trim()) { D().Settings.ProfileName = n.trim(); save(); draw(); App.rebuild(); }
    });
    on('[data-a="pic"]', async () => {
      const f = await pickFile("image/*"); if (!f) return;
      const url = await shrinkPicture(f);
      if (url) { setPicture(url); draw(); App.rebuild(); }
    });
    on('[data-a="nopic"]', () => { setPicture(null); draw(); App.rebuild(); });
    on('[data-action="pin"]', async () => { if (!hasPin() && !(await requirePro(T("PIN")))) return; pinDialog(draw); });
    const bx = p.el.querySelector("[data-bio]");
    if (bx) bx.onchange = async () => {
      if (!bx.checked) { removeBio(); toast(T("Fingerprint or face unlock turned off."), "good"); return; }
      if (!(await requirePro(T("Unlock with fingerprint or face")))) { bx.checked = false; return; }
      bx.disabled = true;
      const ok = await enableBio(); bx.disabled = false;
      if (ok) toast(T("Fingerprint or face unlock is on for this device."), "good");
      else { bx.checked = false; toast(T("Fingerprint or face could not be set up on this device."), "bad"); }
    };
    on('[data-action="activate"]', async () => {
      const err = await license.activate(p.el.querySelector("textarea").value);
      if (err) { toast(err, "bad"); return; }
      await alertBox(T("MoneyCompass Pro"), T("Thank you! MoneyCompass Pro is now unlocked.\n{0}", license.status));
      draw(); App.rebuild();
    });
    on('[data-action="remove-license"]', async () => {
      if (await confirmBox(T("Remove license?"), T("MoneyCompass goes back to the free version. Keep your key, so you can enter it again later."), T("Remove"), T("Cancel"), true)) {
        license.remove(); draw(); App.rebuild();
      }
    });
    p.el.querySelectorAll("[data-switch]").forEach(x => x.onclick = ev => {
      if (ev.target.closest("[data-del-profile]") || x.classList.contains("current")) return;
      switchTo(x.dataset.switch); p.close(); App.rebuild();
      if (hasPin()) lock();
    });
    p.el.querySelectorAll("[data-del-profile]").forEach(b => b.onclick = async () => {
      const x = profiles().find(y => y.id === b.dataset.delProfile);
      if (await confirmBox(T("Delete profile?"), T("All entries of \"{0}\" are deleted from this browser.", x.name), T("Delete"), T("Cancel"), true)) { deleteProfile(x.id); switchTo(State.id); draw(); }
    });
    on('[data-action="new-profile"]', async () => {
      if (!license.isPro && profiles().length >= 1) { await windowsOrPro(T("More profiles")); return; }
      const n = await promptBox(T("New profile"), T("Name"), "");
      if (!n || !n.trim()) return;
      createProfile(n.trim()); p.close(); App.rebuild();
    });
    on('[data-action="save-file"]', saveProfileFile);
    on('[data-action="load-file"]', async () => { if (await loadProfileFile()) p.close(); });
  };
  draw();
}
function shrinkPicture(file) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const s = 160, c = document.createElement("canvas"); c.width = c.height = s;
      const k = Math.max(s / img.width, s / img.height), w = img.width * k, h = img.height * k;
      c.getContext("2d").drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
      resolve(c.toDataURL("image/jpeg", 0.85)); URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}

export async function saveProfileFile() {
  // Backups (profile file, automatic backup, file password) are part of Pro – the free version is a demo
  if (!(await requirePro(T("Save profile")))) return false;
  const now = new Date(); D().Settings.LastProfileSaved = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 19);  // local time
  save();
  const locked = fileProtected();
  download(`MoneyCompass-profile-${stamp()}${locked ? "-protected" : ""}.json`, await profileFileText(D()), "application/json");
  markFileBase(); drawBackupBar(saveProfileFile);
  toast(locked ? "🔒 " + T("Profile saved, protected with your password") : T("Profile saved"));
  return true;
}
/** Ask for a password in a box with hidden letters: the text, or null when cancelled. */
function passwordBox(title, text, twice = false) {
  return new Promise(resolve => {
    let result = null;
    const p = popup(`<div class="box-head"><span class="box-icon">🔒</span><h2>${esc(title)}</h2></div><p class="hint">${esc(text)}</p>
      <form class="pin-form"><label class="field"><span>${esc(T("Password"))}</span><input type="password" name="pw" autocomplete="new-password"></label>
      ${twice ? `<label class="field"><span>${esc(T("Repeat the password"))}</span><input type="password" name="pw2" autocomplete="new-password"></label>` : ""}</form>
      <div class="box-buttons"><button class="btn main" data-ok>${esc(T("OK"))}</button><button class="btn second" data-close>${esc(T("Cancel"))}</button></div>`,
      { width: 440, cls: "box", onClose: () => resolve(result) });
    const f = p.el.querySelector("form"), ok = () => {
      const a = f.elements.pw.value;
      if (twice) {
        if (a.length < 8) { toast(T("Use at least 8 characters."), "bad"); return; }
        if (a !== f.elements.pw2.value) { toast(T("The two passwords are not the same."), "bad"); return; }
      } else if (!a) return;
      result = a; p.close();
    };
    f.onsubmit = e => { e.preventDefault(); ok(); };
    p.el.querySelector("[data-ok]").onclick = ok;
    setTimeout(() => f.elements.pw.focus(), 50);
  });
}
async function openProtected(x) {
  for (;;) {
    const pw = await passwordBox(T("Protected profile file"), T("This profile file is protected. Enter its password to open it."));
    if (pw === null) return null;
    const data = await decryptFile(x, pw);
    if (data) return data;
    toast(T("Wrong password – the file could not be opened."), "bad");
  }
}
export async function loadProfileFile() {
  const f = await pickFile(".json,.mcbak,application/json");
  if (!f) return false;
  let data;
  try { data = JSON.parse(await f.text()); } catch { data = null; }
  if (isBuiltinFile(data)) data = await openBuiltin(data);
  else if (isEncryptedFile(data)) { data = await openProtected(data); if (!data) return false; }
  if (!looksLikeProfile(data)) { await alertBox(T("Profile not loaded"), T("This file is not a MoneyCompass profile.")); return false; }
  const n = normalise(data);
  if (!(await confirmBox(T("Load this profile?"), T("It contains: {0}.\n\nThis replaces everything you have entered now. Tip: save your current profile first.", summary(n)), T("Load"), T("Cancel")))) return false;
  replaceData(n); markFileBase(); App.rebuild(); return true;
}

// ================================================================= Options

export function openOptions() {
  const s = D().Settings;
  const p = popup(`<h2 class="popup-title">⚙ ${esc(T("Options"))}</h2><div class="grid">
    ${card(heading(T("Language")) + hint(T("Your data stays the same; only the texts change.")) + select("language", LANGS, lang()))}
    ${card(heading(T("Layout")) + hint(T("Drag a card by its handle (⠿, top right) to move it, on any tab. Reset layout puts all cards back in their standard order.")) +
      `<div class="buttons">${button(esc(T("Reset layout")), "reset-layout", "second")}${button(esc(T("Reset help button position")), "reset-help", "second")}</div>`)}
    ${card(heading(T("Modules")) + hint(license.isPro ? T("Switch on the modules you want. Each one adds its own tab; the tabs appear when you close Options. Your entries stay saved when you switch a module off.")
        : T("Modules are part of MoneyCompass Pro. Enter your license key in your profile (top right) to use them.")) +
      MODULES.map(m => `<label class="check"><input type="checkbox" name="mod-${m.code}"${s.Modules.includes(m.code) ? " checked" : ""}${license.isPro ? "" : " disabled"}><span><b>${esc(T(m.name))}</b><br><span class="hint">${esc(T(m.description))}</span></span></label>`).join(""))}
    ${card(heading(T("Current rates")) + check("online", T("Download current rates from the internet"), s.OnlineRates) +
      hint(T("Exchange rates and the reference rate from NBP (Narodowy Bank Polski), treasury bond rates from the Ministry of Finance. Only public numbers are downloaded – your own data never leaves this device.")))}
    ${card(heading("🔒 " + T("Automatic lock")) + hint(T("After this time without using MoneyCompass the screen locks, so nobody else sees your finances. With a PIN (set it in your profile, top right) the PIN is needed to open it again.")) +
      select("autolock", [[0, T("Off")], ...[1, 5, 10, 15, 30, 60].map(m => [m, T("After {0} minutes", m)])], +s.AutoLockMinutes || 0) +
      hint(hasPin() ? T("This profile has a PIN.") : T("This profile has no PIN yet.")))}
    ${card(heading(T("Backup & restore")) + hint(T("Everything you enter is saved automatically, only in this browser on this device. Nothing is sent to the internet.")) +
      hint(T("Your profile is one file with all your entries (income, expenses, emergency fund, saved offers, savings, exchange rates) and your language. Use it as a backup or to move MoneyCompass to another computer.")) +
      hint(T("The file works in the Windows app too.")) +
      hint(s.LastProfileSaved ? T("Last saved: {0}", fmtDate(s.LastProfileSaved) + " " + String(s.LastProfileSaved).slice(11, 16)) : T("Your profile has not been saved yet.")) +
      check("askstart", T("Ask what to do when MoneyCompass starts"), s.AskOnStart) +
      check("showguide", T("Show the step-by-step guide when MoneyCompass starts"), !s.GuideHidden) +
      check("shownews", T("Show what's new after an update"), !s.NewsHidden) +
      field(T("When I close MoneyCompass"), select("closechoice", [["", T("Ask every time")], ["with", T("Save profile and close")], ["without", T("Close without saving")]], s.CloseChoice === "none" ? "without" : s.CloseChoice || "")) +
      `<div class="buttons">${button(esc(T("Save profile now") + (license.isPro ? "" : " 🔒")), "save-file", "second")}${button(esc(T("Load a profile…")), "load-file", "second")}</div>` +
      `<hr><h3>🛡️ ${esc(T("Automatic backup"))}</h3>` +
      hint(T("MoneyCompass keeps a copy of your profile in a file on this computer and updates it by itself after every change. If the browser data is ever deleted, open the file with \"Load a profile…\". Choose a folder like Documents or OneDrive.")) +
      `<p class="backup-line">${esc(backupLine())}</p>` +
      hint("🔒 " + (fileProtected() ? T("The backup is encrypted with your file password.")
        : T("The backup is encrypted, so it can't be read in Notepad. For full protection, also set a password for profile files below."))) +
      (autoSupported() ? `<div class="buttons">${backupInfo().status === "off" ? button(esc(T("Choose where to keep it…") + (license.isPro ? "" : " 🔒")), "bk-on", "main")
        : button(esc(T("Choose another file…")), "bk-on", "second") + button(esc(T("Turn off")), "bk-off", "second")}</div>` : "") +
      `<hr><h3>🔒 ${esc(T("Password for profile files"))}</h3>` +
      hint(fileProtected() ? T("On: profile files you save are encrypted (AES-256). They can only be opened with the password, in the web app.")
        : T("Off: profile files are plain text – anyone who opens the file can read your figures.")) +
      hint(T("The password is never saved and can't be recovered – if you forget it, protected files can't be opened. The Windows app can't open protected files.")) +
      `<div class="buttons">${fileProtected() ? button(esc(T("Change password…")), "file-pw", "second") + button(esc(T("Turn off")), "file-pw-off", "second")
        : button(esc(T("Protect with a password…") + (license.isPro ? "" : " 🔒")), "file-pw", "main")}</div>`)}
    ${card(heading(T("Reset")) + hint(T("Delete all or only some of your entries: income, expenses, savings, saved offers, emergency fund settings or exchange rates. Your language and other options stay.")) +
      button(esc(T("Choose what to delete…")), "delete", "danger"))}
    </div><div class="popup-buttons"><button class="btn main" data-close>${esc(T("Close"))}</button></div>`, { width: 980, cls: "wide-popup", onClose: () => App.rebuild() });
  const el = p.el;
  el.querySelector('select[name="language"]').onchange = e => { s.Language = e.target.value; store.set("mc-lang", s.Language); save(); p.close(); openOptions(); };
  el.querySelectorAll('input[name^="mod-"]').forEach(c => c.onchange = () => setModule(c.name.slice(4), c.checked));
  el.querySelector('input[name="online"]').onchange = e => { s.OnlineRates = e.target.checked; save(); if (s.OnlineRates) Rates.refresh(true); };
  el.querySelector('select[name="closechoice"]').onchange = e => { s.CloseChoice = e.target.value; save(); };
  el.querySelector('input[name="shownews"]').onchange = e => { s.NewsHidden = !e.target.checked; save(); };
  el.querySelector('input[name="showguide"]').onchange = e => { s.GuideHidden = !e.target.checked; save(); };
  el.querySelector('[data-action="file-pw"]').onclick = async () => {
    if (!(await requirePro(T("Password for profile files")))) return;
    const pw = await passwordBox(T("Password for profile files"), T("At least 8 characters. Every profile file you save from now on is encrypted with it."), true);
    if (!pw) return;
    await setFilePassword(pw); toast("🔒 " + T("Profile files are now protected."), "good"); p.close(); openOptions();
  };
  el.querySelector('[data-action="file-pw-off"]')?.addEventListener("click", async () => {
    if (!(await confirmBox(T("Turn off the password?"), T("New profile files will be plain text again. Files you saved before stay protected with the old password."), T("Turn off"), T("Cancel")))) return;
    removeFilePassword(); p.close(); openOptions();
  });
  el.querySelector('[data-action="bk-on"]')?.addEventListener("click", async () => {
    if (!(await requirePro(T("Automatic backup")))) return;
    if (await chooseBackupFile()) { toast(T("Automatic backup is on: {0}", backupInfo().file), "good"); p.close(); openOptions(); }
  });
  el.querySelector('[data-action="bk-off"]')?.addEventListener("click", async () => {
    if (!(await confirmBox(T("Turn off the automatic backup?"), T("The backup file stays where it is, but it is no longer updated."), T("Turn off"), T("Cancel")))) return;
    await stopBackup(); p.close(); openOptions();
  });
  el.querySelector('select[name="autolock"]').onchange = async e => {
    const v = +e.target.value;
    // Turning the automatic lock on (or changing it) is Pro; turning it off is always possible
    if (v > 0 && !(await requirePro(T("Automatic lock")))) { e.target.value = String(s.AutoLockMinutes || 0); return; }
    s.AutoLockMinutes = v; save();
  };
  el.querySelector('input[name="askstart"]').onchange = e => { s.AskOnStart = e.target.checked; save(); };
  el.querySelector('[data-action="save-file"]').onclick = saveProfileFile;
  el.querySelector('[data-action="reset-layout"]').onclick = () => {
    const o = s.CardOrder || {};
    Object.keys(o).filter(k => k.startsWith("web")).forEach(k => delete o[k]);
    save(); toast(T("All cards are back in their standard order when you close Options."));
  };
  el.querySelector('[data-action="reset-help"]').onclick = () => { App.resetHelpButton?.(); toast(T("The help button is back in the bottom-right corner.")); };
  el.querySelector('[data-action="load-file"]').onclick = async () => { if (await loadProfileFile()) p.close(); };
  el.querySelector('[data-action="delete"]').onclick = () => { p.close(); openDelete(); };
}

// ================================================================= Delete data

export function openDelete() {
  const d = D();
  const parts = [["incomes", T("Income sources"), d.Incomes.length], ["expenses", T("Expenses, money received and transfers (bank imports)"), d.Expenses.length + d.Received.length + d.Transfers.length], ["holdings", T("Savings"), d.Holdings.length],
    ["offers", T("Saved savings offers"), d.Offers.length], ["emergency", T("Emergency fund settings"), T("monthly costs, yearly costs, months, buffer")],
    ["rates", T("Exchange rates"), ""], ["modules", T("Modules: loans, budget and goals, calendar"), d.Goals.length + d.Loans.length + d.Budgets.length + (d.Recurring || []).length],
    ["categories", T("Your own expense categories"), d.Categories.length || T("none")], ["bin", T("Deleted items"), (d.Deleted || []).length]];
  const p = popup(`<h2 class="popup-title bad">🗑 ${esc(T("Delete data"))}</h2>${hint(T("Choose exactly what to delete."))}
    <label class="check select-all"><input type="checkbox" data-all><span><b>${esc(T("Select all"))}</b></span></label><hr>
    ${parts.map(x => check(x[0], `${x[1]}${x[2] !== "" ? ` (${x[2]})` : ""}`, false)).join("")}
    ${hint(T("Tip: save your profile first (your profile, top right), so you can load it again if you change your mind."))}
    <div class="popup-buttons"><button class="btn second" data-close>${esc(T("Cancel"))}</button><button class="btn danger" data-go>${esc(T("Delete"))}</button></div>`, { width: 560 });
  const boxes = parts.map(x => p.el.querySelector(`input[name="${x[0]}"]`)), all = p.el.querySelector("[data-all]");
  all.onchange = () => boxes.forEach(b => { b.checked = all.checked; });
  boxes.forEach(b => b.onchange = () => { all.checked = boxes.every(x => x.checked); all.indeterminate = !all.checked && boxes.some(x => x.checked); });
  p.el.querySelector("[data-go]").onclick = async () => {
    const v = values(p.el); delete v[""];
    if (!Object.values(v).some(Boolean)) { p.close(); return; }
    if (!(await confirmBox(T("Delete?"), T("This cannot be undone."), T("Delete"), T("Cancel"), true))) return;
    reset(v); p.close(); App.rebuild(); toast(T("Deleted."));
  };
}

// ================================================================= Import menu

export function openImport() {
  const p = popup(`<h2 class="popup-title">⬆ ${esc(T("Import"))}</h2><div class="buttons col">
    <button class="btn main" data-csv>🏦 ${esc(T("Import bank statement (CSV)…"))}${license.isPro ? "" : " 🔒"}</button>
    <button class="btn second" data-profile>👤 ${esc(T("Load a profile…"))}</button></div>
    <div class="popup-buttons"><button class="btn second" data-close>${esc(T("Close"))}</button></div>`, { width: 460 });
  p.el.querySelector("[data-csv]").onclick = async () => { p.close(); (await import("./import.js")).smartImport(); };
  p.el.querySelector("[data-profile]").onclick = async () => { p.close(); await loadProfileFile(); };
}

// ================================================================= Help & About

export function openHelp() {
  const tabs = [["Overview", "Your money at a glance: inflows, outflows, balance and savings rate, with diagrams. The green \"Optimize my finances\" button shows your best next steps and the main ways to save."],
    ["Inflows", "Add every source of income: salary, side jobs, bonuses – each with its own amount, frequency, currency and payday, and gross → net for a salary. Money received from bank imports is listed here too."],
    ["Outflows", "Enter what you spend or import a bank statement. Mark expenses essential or not, set repeats (🔁), filter and search. With whole months of data you see reliable averages."],
    ["Emergency fund", "Shows how much you should keep aside for bad times (3–6 months of essential costs)."],
    ["Savings", "All your savings in one place (bank, crypto, cash), safe vs risky, and how much interest they earn."],
    ...MODULES.map(m => [m.name, m.description]),
    ["Compare offers", "Compare bank offers: promo rate, promo limit and length, the rate afterwards and the 19% Belka tax."]];
  popup(`<h2 class="popup-title">? ${esc(T("Help"))}</h2><div class="grid">
    ${card(heading(T("Getting started")) + `<ol>${["Inflows: add your salary and any other money that comes in, with its payday.", "Outflows: write down what you spend, or enter your usual monthly bills once.",
      "Emergency fund: enter your essential monthly costs to see how much to keep aside.", "Savings: add your bank accounts, cash and other savings with their interest rate.",
      "Overview: see everything together, then press \"Optimize my finances\" for your personal plan."].map(x => `<li>${esc(T(x))}</li>`).join("")}</ol>` + hint(T("Numbers can be typed with a dot or a comma: 1234.50 or 1234,50.")))}
    ${card(heading(T("The tabs")) + tabs.map(t => `<p><b>${esc(T(t[0]))}</b><br><span class="hint">${esc(T(t[1]))}</span></p>`).join("") + hint(T("Loans & debts, Budget plan (with savings goals) and Calendar are modules: switch them on in Options → Modules.")))}
    ${card(heading("MoneyCompass Pro") + `<p>${esc(T("The free version has all the basics. A license key unlocks:"))}</p><ul>${[
      ["Optimize my finances", "Your personal plan for savings and loans, with current rates from NBP, the Ministry of Finance and bank rankings."], ["Compare offers", "See which bank offer really pays the most after tax."],
      ["Import bank statement", "The bank statement (CSV) becomes expenses, sorted into categories."], ["Own categories", "Make your own expense categories, each with an icon of your choice."],
      ["Modules", "Loans & debts, Budget plan and Calendar (Pro): switch them on in Options → Modules. Each adds its own tab; savings goals are in the Budget plan."]].map(x => `<li><b>${esc(T(x[0]))}</b> – ${esc(T(x[1]))}</li>`).join("")}
      <li><b>${esc(T("Export"))}</b> – ${esc(T("Reports as Excel, PDF or Word."))}</li><li><b>${esc(T("Profiles"))}</b> – ${esc(T("Separate data for each person or household."))}</li></ul>` +
      hint(T("To unlock: click your profile picture (top right), paste your key under Activation and press Activate.")))}
    ${card(heading(T("Your data & backup")) + `<p>${esc(T("Everything you enter is saved automatically, only in this browser on this device. Nothing is sent to the internet."))}</p>` +
      hint(T("Clearing your browser data deletes your entries. Save your profile regularly (your profile, top right → Save profile) – the file works in the Windows app too.")))}
    ${card(heading(T("Windows app")) + `<p>${esc(T("The free Windows app has more than the free web version: reports and several profiles. Your profile file works in both."))}</p>
      <a class="btn go" href="${DOWNLOAD_URL}" target="_blank" rel="noopener">⬇ ${esc(T("Download for Windows"))}</a>`)}
    ${card(heading(T("Please note")) + hint(T("MoneyCompass helps you keep an overview. All results are estimates based on what you enter. They are not financial, investment or tax advice. Interest rates and offers change - always check the bank's own terms.")) +
      hint(T("© {0} MoneyCompass. All rights reserved.", new Date().getFullYear())) + `<a href="../privacy.html#${lang()}" target="_blank">${esc(T("Privacy policy"))}</a> · <a href="../terms.html#${lang()}" target="_blank">${esc(T("Terms of use"))}</a>`)}
    </div><div class="popup-buttons"><button class="btn main" data-close>${esc(T("Close"))}</button></div>`, { width: 1000, cls: "wide-popup" });
}

// ================================================================= Export (Pro on the web)

export async function openExport() {
  if (!(await windowsOrPro(T("Export report")))) return;
  const p = popup(`<h2 class="popup-title">⬇ ${esc(T("Export report"))}</h2>${hint(T("Save a copy of your numbers to keep a record over time."))}
    ${card(heading(T("What's in the report")) + hint(T("Summary, diagrams (optional), income sources, monthly totals, expenses by category, all expenses, your savings, saved offers and your personal savings plan.")) +
      hint(T("Each export is a new file with date and time, so older reports are kept.")))}
    <div class="buttons col">
      <button class="btn second" data-f="xlsx"><b>${esc(T("Excel (.xlsx)"))}</b><br><span class="hint">${esc(T("Every part on its own sheet, with real numbers you can calculate with."))}</span></button>
      <button class="btn second" data-f="pdf"><b>${esc(T("PDF"))}</b><br><span class="hint">${esc(T("Opens the print window: choose \"Save as PDF\"."))}</span></button>
      <button class="btn second" data-f="doc"><b>${esc(T("Word (.docx)").replace(".docx", ".doc"))}</b><br><span class="hint">${esc(T("A document you can still edit, add notes to or send."))}</span></button></div>
    <div class="popup-buttons"><button class="btn second" data-close>${esc(T("Close"))}</button></div>`, { width: 560 });
  p.el.querySelectorAll("[data-f]").forEach(b => b.onclick = async () => {
    try {
      if (b.dataset.f === "xlsx") await exportExcel();
      else if (b.dataset.f === "pdf") printReport();
      else download(`MoneyCompass-report-${stamp()}.doc`, "﻿" + reportHtml(true), "application/msword");
      toast(T("Report saved"));
    } catch (e) { alertBox(T("Export report"), T("The report could not be created.") + "\n" + e.message); }
  });
}

function reportParts() {
  const d = D(), inc = Calc.income(d), avg = Calc.spending(d), p = Calc.portfolio(d), em = Calc.emergency(d.Settings);
  const spending = avg.essential + avg.nonEssential, left = inc.monthlyTotal - spending;
  const summaryRows = [
    [T("Regular income per month"), pln(inc.monthlyTotal)], [T("Extra income received this month (bank import)"), pln(Calc.receivedIn(d, new Date()))],
    [T("One-time income in {0}", new Date().getFullYear()), pln(inc.oneTimeThisYear)],
    [T("Average expenses per month (Outflows tab)"), avg.monthsUsed ? pln(spending) : T("no data yet")],
    [T("Balance per month"), avg.monthsUsed ? pln(left) : "–"], [T("Savings rate"), avg.monthsUsed && inc.monthlyTotal > 0 ? savingsRateText(left, inc.monthlyTotal) : "–"],
    [T("Secure savings (bank, cash)"), pln(p.safe)], [T("Investments at risk (crypto, securities)"), pln(p.risky)], [T("Total"), pln(p.total)],
    [T("Interest p.a. (gross)"), pln(p.yearly)], [T("Emergency fund target"), pln(em.target)], [T("Emergency fund covered"), em.target > 0 ? Math.round(Math.min(1, p.safe / em.target) * 100) + "%" : "–"]];
  const income = [[T("Name"), T("Type"), T("How often"), T("Per month (zł)"), T("Active")], ...d.Incomes.map(i => [i.Name, T(i.Type), T(i.Frequency), i.Frequency === ONE_TIME ? T("one-time") : round(Calc.monthlyPln(i, d.Settings)), i.Active ? T("Yes") : T("No")])];
  const months = [[T("Month"), T("Inflows"), T("Outflows"), T("Balance")], ...ChartData.trend(d).map(m => [monthName(m.start), round(m.income), round(m.expenses), round(m.income - m.expenses)])];
  const cats = ChartData.categories(d);
  const byCat = [[T("Category"), T("Per month"), T("Share")], ...cats.all.map(c => [T(c.category), round(c.perMonth), ChartData.share(c.perMonth, cats.total)])];
  const expenses = [[T("Date"), T("Category"), T("Description"), T("Amount (zł)"), T("Essential")], ...[...d.Expenses].sort((a, b) => parseDate(b.Date) - parseDate(a.Date)).map(e => [fmtDate(e.Date), T(e.Category), e.Description, e.Amount, e.Essential ? T("Yes") : T("No")])];
  const holdings = [[T("Name"), T("Where"), T("In złoty"), T("Interest rate"), T("Safe")], ...d.Holdings.map(h => [h.Name, T(h.Place), round(Calc.toPln(h.Amount, h.Currency, d.Settings)), (h.RatePercent || 0) + "%", h.Safe ? T("Yes") : T("No")])];
  const offers = [[T("Name"), T("Promo rate"), T("Promo days"), T("Rate after"), T("You keep"), T("Real yearly rate after tax")], ...d.Offers.map(o => ({ o, r: Calc.savings(o) })).sort((a, b) => b.r.net - a.r.net).map(x => [x.o.Name, x.o.PromoRate + "%", x.o.PromoDays, x.o.StandardRate + "%", round(x.r.net), rate(x.r.effective)])];
  const plan = [[T("Step"), T("Details"), T("Worth per year")], ...Advisor.analyse(d).map(a => [a.title, a.text, a.benefit > 0 ? round(a.benefit) : ""])];
  return { summaryRows, sections: [[T("Income"), income], [T("Monthly totals"), months], [T("Outflows by category"), byCat], [T("Outflows"), expenses], [T("Savings"), holdings], [T("Comparison"), offers], [T("Your personal plan"), plan]] };
}
const round = v => Math.round(v * 100) / 100;

function reportHtml(forWord = false) {
  const { summaryRows, sections } = reportParts();
  const table = rows => `<table><tr>${rows[0].map(h => `<th>${esc(h)}</th>`).join("")}</tr>${rows.slice(1).map(r => `<tr>${r.map(c => `<td>${esc(typeof c === "number" ? pln(c) : c)}</td>`).join("")}</tr>`).join("")}</table>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(T("MoneyCompass report"))}</title><style>
    body{font-family:Segoe UI,Arial,sans-serif;color:#111827;margin:24px}h1{color:#0F766E;margin:0}h2{color:#0F766E;margin-top:28px;font-size:18px}
    table{border-collapse:collapse;width:100%;font-size:12px;margin-top:6px}th{background:#0F766E;color:#fff;text-align:left;padding:5px}td{border-bottom:1px solid #E5E7EB;padding:5px;vertical-align:top}
    .muted{color:#6B7280;font-size:12px}${forWord ? "" : "@media print{h2{break-after:avoid}table{break-inside:auto}tr{break-inside:avoid}}"}</style></head><body>
    <h1>${esc(T("MoneyCompass report"))}</h1><p class="muted">${esc(T("Created on {0}", fmtDate(new Date())))} · ${esc(currentName())}</p>
    <h2>${esc(T("Summary"))}</h2>${table([[T("Item"), T("Value")], ...summaryRows])}
    ${sections.map(([title, rows]) => rows.length > 1 ? `<h2>${esc(title)}</h2>${table(rows)}` : "").join("")}
    <p class="muted">${esc(T("These suggestions are calculated from what you entered and are estimates. They are not financial, investment or tax advice."))}</p></body></html>`;
}
function printReport() {
  const w = window.open("", "_blank");
  if (!w) { alertBox(T("Export report"), T("Please allow pop-up windows for this page.")); return; }
  w.document.write(reportHtml()); w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
}
async function exportExcel() {
  if (!window.XLSX) await new Promise((res, rej) => {
    const sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    sc.onload = res; sc.onerror = () => rej(new Error("Excel library could not be loaded.")); document.head.appendChild(sc);
  });
  const X = window.XLSX, wb = X.utils.book_new();
  const { summaryRows, sections } = reportParts();
  const add = (name, rows) => X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(rows), name.replace(/[\\/?*[\]:]/g, "").slice(0, 31));
  add(T("Summary"), [[T("Item"), T("Value")], ...summaryRows]);
  const used = new Set([T("Summary")]);
  for (const [title, rows] of sections) { let n = title.slice(0, 31); while (used.has(n)) n = n.slice(0, 29) + "2"; used.add(n); add(n, rows); }
  X.writeFile(wb, `MoneyCompass-report-${stamp()}.xlsx`);
}

// ---------- Language: from the 🌐 button in the top bar and from the guide ----------
export const FLAGS = { en: "🇬🇧", de: "🇩🇪", fr: "🇫🇷", pl: "🇵🇱" };
export function setLanguage(code) {
  const s = State.data.Settings;
  if (s.Language === code) return;
  s.Language = code; store.set("mc-lang", code); save();
  App.rebuild();
}
export function languageChips() {
  return `<div class="lang-chips">${LANGS.map(([c, n]) => `<button class="chip${c === lang() ? " on" : ""}" data-lang="${c}">${FLAGS[c] || ""} ${esc(n)}</button>`).join("")}</div>`;
}
export function openLanguage() {
  const p = popup(`<h3>🌐 ${esc(T("Language"))}</h3>${hint(T("Your data stays the same; only the texts change."))}${languageChips()}`, { width: 320, anchor: "top-right", cls: "lang-panel" });
  p.el.querySelectorAll("[data-lang]").forEach(b => b.onclick = () => { p.close(); setLanguage(b.dataset.lang); });
}
