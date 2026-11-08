// Pop-up windows: profile & license, Settings, Help, Delete data, Import, Export.
import {
  T, State, save, license, LANGS, lang, currentName, initials, picture, setPicture, profiles, switchTo, createProfile, deleteProfile,
  replaceData, normalise, looksLikeProfile, summary, reset, MODULES, setModule, moduleOn, Calc, Advisor, ChartData, pln, rate, fmtDate,
  parseDate, categoryLabel, monthName, ONE_TIME, store,
  markFileBase, savingsRateText, convertProfile, plnRate } from "./core.js";
import { esc, card, heading, hint, row, field, textInput, select, check, button, values, popup, confirmBox, alertBox, promptBox, toast, pickFile, download, stamp } from "./ui.js";
import { App, requirePro, windowsOrPro, DOWNLOAD_URL } from "./app.js";
import { hasPin, lock, pinDialog, bioAvailable, bioOn, enableBio, removeBio } from "./lock.js";
import { fileProtected, setFilePassword, removeFilePassword, profileFileText, backupFileText, isEncryptedFile, decryptFile, isBuiltinFile, openBuiltin } from "./crypt.js";
import { Rates } from "./rates.js";
import { autoSupported, backupInfo, backupLine, chooseBackupFile, stopBackup, drawBackupBar } from "./backup.js";
import { openBankImport } from "./pages-pro.js";
import { ico } from "./nw.js";

const D = () => State.data;
const COLORS_AVATAR = ["#0F766E", "#1D4ED8", "#C2410C", "#7E22CE", "#BE123C", "#0E7490", "#4338CA", "#15803D"];
export const avatarColor = name => COLORS_AVATAR[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS_AVATAR.length];
export function avatar(size = 36) {
  const pic = picture(), name = currentName();
  return pic ? `<img class="avatar" src="${pic}" alt="" style="width:${size}px;height:${size}px">`
    : `<span class="avatar" style="width:${size}px;height:${size}px;background:linear-gradient(135deg,#34D399,#0F8F66);color:#06231A;font-weight:700;font-size:${size * 0.4}px">${esc(initials(name))}</span>`;
}

// ================================================================= Profile (name, picture, license, profiles)

export function openProfile() {
  const p = popup("", { width: 1000, cls: "profile-panel nw-win nw-prof" });
  const draw = () => {
    const l = license.current, pro = license.isPro;
    const list = profiles(), bk = backupInfo(), bkOn = bk.status === "on";
    const ok = `<span class="nw-ok">✓</span>`;
    const tile = (i, a, b) => `<div class="nw-tile">${ico(i, "big")}<small>${esc(a)}</small><b>${esc(b)}</b></div>`;
    const bio = bioAvailable();
    p.el.innerHTML = `<div class="nw-hd"><span class="nw-hi">${ico("shield")}</span><h2>${esc(T("Profile & Security"))}</h2><button class="nw-x" data-close aria-label="Close">✕</button></div>
      <div class="nw-ph"><div class="nw-av">${avatar(96)}</div><div class="nw-pn"><h2>${esc(currentName())}</h2>${l?.email ? `<div class="hint">${esc(l.email)}</div>` : ""}
        ${pro ? `<div class="nw-ver">${ok} ${esc(T("Verified Account"))}</div>` : ""}
        <div class="nw-pa"><a href="#" class="nw-pill" data-a="pic">${ico("cam")}${esc(T("Change picture"))}</a><a href="#" class="nw-pill" data-a="rename">${ico("pen")}${esc(T("Change name"))}</a>${picture() ? `<a href="#" class="nw-pill" data-a="nopic">${esc(T("Remove picture"))}</a>` : ""}</div></div>
        <div class="nw-tiles">${tile(pro ? "gem" : "user", T("Plan"), pro ? "MoneyCompass Pro" : T("Free version"))}${tile("shield", T("Security"), hasPin() ? T("Protected") : T("No PIN"))}${tile("user", T("Profiles"), T("{0} Active", list.length))}${tile("cloud", T("Backup"), bkOn ? T("Enabled") : T("Off"))}</div></div>
      <div class="nw-g2 p">
        <div class="nw-card"><div class="nw-ch">${ico("crown", "gold")}<h3>MoneyCompass ${pro ? "Pro" : ""}</h3></div>
          ${pro ? `<div class="nw-pro">${ico("gem", "gem")}<div><p><span>${esc(T("Status"))}</span><em class="nw-tag">${esc(T("Active"))}</em></p><p><span>${esc(T("Licensed to"))}</span><b>${esc(l?.name || currentName())}</b></p><p>${ok} ${esc(T("Thank you! All features are unlocked."))}</p></div></div>
            <p class="hint">${esc(license.status)}</p>${button(esc(T("Remove license from this browser")), "remove-license", "nw-wide second small")}`
          : `${l ? `<p class="bad">${esc(license.status)}</p>` : ""}${hint(T("Pro unlocks: Optimize my finances with current rates, Compare offers, Import bank statement, own categories with icons, the Modules and unlimited exports (the free version has {0}).", 0))}
            ${field(T("License key"), `<textarea name="key" rows="2" placeholder="MC1-…" data-nofocus></textarea>`)}${button(ico("crown") + esc(T("Activate")), "activate", "nw-wide main")}`}</div>
        <div class="nw-card"><div class="nw-ch">${ico("shield", "cy")}<h3>${esc(T("Security Center"))}</h3></div>
          <p class="nw-sr">${ico("lock")}<span>${esc(T("PIN"))}</span>${ok}<em>${esc(hasPin() ? T("Enabled") : T("Off"))}</em></p>
          ${bio ? `<p class="nw-sr">${ico("finger")}<span>${esc(T("Fingerprint or face"))}</span><label class="nw-sw"><input type="checkbox" data-bio${bioOn() ? " checked" : ""}><i></i></label></p>` : ""}
          <p class="nw-sr">${ico("clock")}<span>${esc(T("Last Sign-In"))}</span>${ok}<em>${esc(T("Today"))}</em></p>
          <p class="nw-sr">${ico("shield")}<span>${esc(T("Security Status"))}</span>${ok}<em>${esc(hasPin() ? T("Protected") : T("No PIN"))}</em></p>
          ${button(ico("shield") + esc(hasPin() ? T("Change or remove PIN…") : T("Set a PIN…") + (pro ? "" : " 🔒")), "pin", "nw-wide main")}</div>
      </div>
      <div class="nw-g3 q">
        <div class="nw-card"><div class="nw-ch">${ico("user")}<h3>${esc(T("Profiles"))}</h3></div>
          <div class="nw-pl">${list.map(x => `<div class="nw-pr${x.current ? " current" : ""}" data-switch="${x.id}"><span class="nw-mini">${esc(initials(x.name))}</span><div><b>${esc(x.name)}</b><small>${x.current ? esc(T("in use")) : ""}</small></div>${x.current ? `<span class="nw-tag">${esc(T("Active Profile"))}</span>` : `<button class="icon-btn danger" data-del-profile="${x.id}">🗑</button>`}</div>`).join("")}</div>
          <div class="nw-bt">${button(ico("plus") + esc(T("New profile")), "new-profile", "nw-sm")}${button(ico("save") + esc(T("Save profile") + (pro ? "" : " 🔒")), "save-file", "nw-sm")}${button(ico("folder") + esc(T("Load a profile…")), "load-file", "nw-sm")}</div></div>
        <div class="nw-card"><div class="nw-ch">${ico("cloud", "cy")}<h3>${esc(T("Automatic Backup"))}</h3></div>
          <p class="hint">${esc(backupLine())}</p>
          <p class="nw-sr s">${ico("check")}<span>${esc(T("Automatic Backup"))}</span><em>${esc(bkOn ? T("Enabled") : T("Off"))}</em></p>
          ${bk.file ? `<p class="nw-sr s">${ico("doc")}<span>${esc(T("Backup File"))}</span><em class="f">${esc(bk.file)}</em></p>` : ""}
          <div class="nw-bt">${button(ico("gear") + esc(T("Settings")), "to-settings", "nw-sm")}</div></div>
        <div class="nw-card"><div class="nw-ch">${ico("bars", "cy")}<h3>${esc(T("Activity & Privacy"))}</h3></div>
          <ul class="nw-ul s">${["Local data encryption enabled", "Biometric protection enabled", "Automatic backups enabled", "No personal data shared"].map(x => `<li>${ok}<span>${esc(T(x))}</span></li>`).join("")}</ul></div>
      </div>
      <div class="nw-foot">${ico("shield", "big")}<div><b>${esc(T("Account Health"))}</b><small>${esc(T("Your MoneyCompass data stays only on this device."))}</small></div>
        <div class="nw-fs"><small>${esc(T("Security"))}</small><b>${esc(hasPin() ? T("Protected") : T("No PIN"))}</b></div><div class="nw-fs"><small>${esc(T("Backup"))}</small><b>${esc(bkOn ? T("Enabled") : T("Off"))}</b></div>
        <button class="btn main" data-close>${esc(T("Close"))}</button></div>`;
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
    on('[data-action="to-settings"]', () => { p.close(); openOptions(); });
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
  // Always encrypted (.mcbak): with the file password when one is set, otherwise with the key built into MoneyCompass,
  // so the file can never be read in Notepad or another program.
  download(`MoneyCompass-profile-${stamp()}${locked ? "-protected" : ""}.mcbak`, await backupFileText(D()), "application/octet-stream");
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

// ================================================================= Settings

export function openOptions() {
  const s = D().Settings;
  const bkOn = backupInfo().status === "on", tl = (i, a, b, c = "") => `<div class="nw-card nw-st">${ico(i, "big")}<span><small>${esc(a)}</small><b>${esc(b)}</b></span></div>`;
  const pinOn = hasPin(), bioNow = bioOn(), lockMin = +s.AutoLockMinutes || 0, ok = `<span class="nw-ok">${ico("check")}</span>`, warnI = `<span class="nw-wn">!</span>`;
  const lastBk = backupInfo().at ? fmtDate(backupInfo().at) + " " + String(backupInfo().at).slice(11, 16) : "–";
  const secOk = pinOn, modsOn = MODULES.filter(m => s.Modules.includes(m.code)).length;
  const hd = (i, t, tip = "") => `<div class="st-h">${ico(i)}<h3>${esc(t)}</h3></div>`;
  const rowI = (i, label, val, good = true) => `<div class="st-row">${ico(i)}<span class="st-l">${esc(label)}</span><span class="st-v ${good ? "good" : ""}">${good ? ok : ""}${esc(val)}</span></div>`;
  const modI = { loans: "bank", budget: "pie", calendar: "cal" };
  const tabs = App.tabList();
  const p = popup(`<div class="nw-hd"><span class="nw-hi">${ico("gear")}</span><h2>${esc(T("Settings & Preferences"))}</h2><button class="nw-x" data-close aria-label="Close">✕</button></div>
    <div class="nw-g4 nw-sum">${tl("globe", T("Language"), (LANGS.find(x => x[0] === lang()) || [0, lang()])[1])}${tl("coins", T("Currency"), s.Currency || "PLN")}${tl("shield", T("Security"), pinOn ? T("Protected") : T("No PIN"))}${tl("cloud", T("Backup"), bkOn ? T("Enabled") : T("Off"))}</div>
    <div class="nw-g2 st-g">
      <div class="nw-card st-c">${hd("globe", T("Language"))}${select("language", LANGS, lang())}<p class="hint">${esc(T("Your data stays the same; only the texts change."))}</p></div>
      <div class="nw-card st-c">${hd("coins", T("Currency"))}${select("maincur", [["PLN", "PLN – złoty"], ["EUR", "EUR – euro"], ["USD", "USD – dollar"]], s.Currency || "PLN")}<p class="hint">${esc(T("Used throughout reports, charts and calculations."))}</p></div>
    </div>
    <div class="nw-g2 st-g">
      <div class="nw-card st-c">${hd("shield", T("Security & Privacy"))}
        <div class="st-row">${ico("lock")}<span class="st-l">${esc(T("Automatic lock"))}</span>${select("autolock", [[0, T("Off")], ...[1, 5, 10, 15, 30, 60].map(m => [m, T("After {0} minutes", m)])], lockMin)}</div>
        ${rowI("shield", T("PIN Protection"), pinOn ? T("Enabled") : T("Not set"), pinOn)}
        ${rowI("finger", T("Biometric unlock"), bioNow ? T("Enabled") : bioAvailable() ? T("Available") : T("Not available"), bioNow || bioAvailable())}
        ${rowI("shield", T("Security Status"), pinOn ? T("Protected") : T("No PIN"), pinOn)}
        <button class="btn second st-wide" data-action="manage-sec">${ico("shield")} ${esc(T("Manage Security"))}</button></div>
      <div class="nw-card st-c">${hd("cloud", T("Backup & Restore"))}
        ${rowI("cloud", T("Automatic Backup"), bkOn ? T("Enabled") : T("Off"), bkOn)}
        ${rowI("clock", T("Last Backup"), lastBk, false)}
        ${rowI("folder", T("Backup Location"), backupInfo().file || "–", false)}
        <div class="st-btns"><button class="btn main" data-action="make-backup">${ico("download")} ${esc(T("Create Backup"))}</button><button class="btn second" data-action="restore-backup">${ico("up")} ${esc(T("Restore Backup"))}</button></div></div>
    </div>
    <div class="nw-card st-c st-mods">${hd("cube", T("Modules"))}<div class="st-mg">${MODULES.map(m => `<div class="st-mod"><span class="st-mi">${ico(modI[m.code] || "cube", "big")}</span><span class="st-mt"><b>${esc(T(m.name))}</b><small>${esc(T(m.description))}</small><em class="${s.Modules.includes(m.code) ? "good" : ""}">${esc(T("Status"))}: ${s.Modules.includes(m.code) ? T("Enabled") : T("Off")}</em></span><input type="checkbox" name="mod-${m.code}"${s.Modules.includes(m.code) ? " checked" : ""}${license.isPro ? "" : " disabled"}></div>`).join("")}</div>${license.isPro ? "" : `<p class="hint">${esc(T("Modules are part of MoneyCompass Pro. Enter your license key in your profile (click your name) to use them."))}</p>`}</div>
    <div class="nw-g3 st-g st-b">
      <div class="nw-card st-c">${hd("list", T("Navigation Order"))}
        ${license.isPro ? `<div class="st-nav">${tabs.map((t, i, a) => `<div class="st-ni"><span class="st-n">${i + 1}</span><span class="st-nt">${esc(t.title)}</span><span class="tab-arrows"><button class="icon-btn" data-tab-up="${t.route}"${i === 0 ? " disabled" : ""} title="${esc(T("Up"))}">▲</button><button class="icon-btn" data-tab-down="${t.route}"${i === a.length - 1 ? " disabled" : ""} title="${esc(T("Down"))}">▼</button></span></div>`).join("")}</div>
        <button class="btn second st-small" data-action="reset-tabs">${esc(T("Standard order"))}</button>` : `<button class="btn second" data-action="tabs-pro">${esc(T("Change the menu order"))} 🔒</button>`}</div>
      <div class="nw-card st-c">${hd("trend", T("Financial Data Sources"))}
        <label class="check"><input type="checkbox" name="online"${s.OnlineRates ? " checked" : ""}><span>${esc(T("Download current rates from the internet"))}</span></label>
        ${[T("Exchange rates (NBP)"), T("NBP reference rate"), T("Treasury bond rates"), T("Market reference data")].map(x => `<div class="st-src">${ok}<span>${esc(x)}</span></div>`).join("")}
        <p class="hint">${esc(T("Only public numbers are downloaded – your own data never leaves this device."))}</p></div>
      <div class="nw-card st-c st-sys ${secOk ? "" : "warn"}">${hd("check", T("System Status"))}
        <p>${esc(secOk ? T("MoneyCompass is configured correctly and all protection features are active.") : T("Set a PIN to protect your data."))}</p>
        <div class="st-sl">${[[T("Language"), (LANGS.find(x => x[0] === lang()) || [0, lang()])[1]], [T("Currency"), s.Currency || "PLN"], [T("Security"), pinOn ? T("Protected") : T("No PIN")], [T("Automatic Backup"), bkOn ? T("Enabled") : T("Off")], [T("Modules"), modsOn === MODULES.length ? T("All Active") : modsOn + "/" + MODULES.length]].map(x => `<div>${ok}<span>${esc(x[0])}: ${esc(x[1])}</span></div>`).join("")}</div>
        <button class="btn main st-wide" data-action="adv-open">${ico("gear")} ${esc(T("Advanced Settings"))}</button></div>
    </div>
    <details class="st-adv" id="st-adv"><summary>${ico("gear")} ${esc(T("Advanced Settings"))}</summary><div class="st-ag">
      <div class="nw-card st-c">${hd("gear", T("General"))}
        <label class="check"><input type="checkbox" name="askstart"${s.AskOnStart ? " checked" : ""}><span>${esc(T("Ask what to do when MoneyCompass starts"))}</span></label>
        <label class="check"><input type="checkbox" name="showguide"${!s.GuideHidden ? " checked" : ""}><span>${esc(T("Show the step-by-step guide when MoneyCompass starts"))}</span></label>
        <label class="check"><input type="checkbox" name="shownews"${!s.NewsHidden ? " checked" : ""}><span>${esc(T("Show what's new after an update"))}</span></label>
        <label class="field"><span>${esc(T("When I close MoneyCompass"))}</span>${select("closechoice", [["", T("Ask every time")], ["with", T("Save profile and close")], ["without", T("Close without saving")]], s.CloseChoice === "none" ? "without" : s.CloseChoice || "")}</label>
        <button class="btn second st-wide" data-action="reset-layout">${ico("list")} ${esc(T("Reset layout"))}</button>
        <p class="hint">${esc(T("Cards you moved go back to their standard order."))}</p></div>
      <div class="nw-card st-c">${hd("cloud", T("Automatic backup"))}
        ${rowI("cloud", T("Status"), bkOn ? T("Enabled") : T("Off"), bkOn)}
        <p class="backup-line">${esc(backupLine())}</p>
        <p class="hint">🔒 ${esc(fileProtected() ? T("The backup is encrypted with your file password.") : T("The backup is encrypted, so it can't be read in Notepad."))}</p>
        ${autoSupported() ? `<div class="st-btns">${backupInfo().status === "off" ? `<button class="btn main" data-action="bk-on">${ico("folder")} ${esc(T("Choose where to keep it…") + (license.isPro ? "" : " 🔒"))}</button>`
          : `<button class="btn second" data-action="bk-on">${ico("folder")} ${esc(T("Choose another file…"))}</button><button class="btn second" data-action="bk-off">${esc(T("Turn off"))}</button>`}</div>` : ""}
        <p class="hint">${esc(T("A copy of your profile is saved in a file on this computer after every change. Choose a folder like Documents or OneDrive."))}</p></div>
      <div class="nw-card st-c">${hd("lock", T("Password for profile files"))}
        ${rowI("lock", T("Status"), fileProtected() ? T("Protected") : T("Off"), fileProtected())}
        <p class="hint">${esc(fileProtected() ? T("Profile files you save are encrypted (AES-256) and open only with the password.") : T("Set a password so that only you can open your profile files."))}</p>
        <p class="hint">${esc(T("The password is never saved and can't be recovered. The Windows app can't open protected files."))}</p>
        <div class="st-btns">${fileProtected() ? `<button class="btn second" data-action="file-pw">${esc(T("Change password…"))}</button><button class="btn second" data-action="file-pw-off">${esc(T("Turn off"))}</button>`
          : `<button class="btn main" data-action="file-pw">${ico("lock")} ${esc(T("Protect with a password…") + (license.isPro ? "" : " 🔒"))}</button>`}</div></div>
      <div class="nw-card st-c st-danger">${hd("shield", T("Reset"))}
        <p class="hint">${esc(T("Delete all or only some of your entries. Your language and other options stay."))}</p>
        <button class="btn danger st-wide" data-action="delete">${esc(T("Choose what to delete…"))}</button></div>
    </div></details>
    <div class="nw-foot"><div></div><button class="btn second" data-close>✕ ${esc(T("Close"))}</button></div>`, { width: 1100, cls: "wide-popup nw-win nw-set", onClose: () => App.rebuild() });
  p.el.querySelector('[data-action="manage-sec"]').onclick = () => { p.close(); openProfile(); };
  p.el.querySelector('[data-action="make-backup"]').onclick = () => saveProfileFile();
  p.el.querySelector('[data-action="restore-backup"]').onclick = async () => { if (await loadProfileFile()) p.close(); };
  p.el.querySelector('[data-action="adv-open"]').onclick = () => { const d = p.el.querySelector("#st-adv"); d.open = true; d.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const el = p.el;
  el.querySelector('select[name="maincur"]').onchange = async e => {
    const to = e.target.value, from = s.Currency || "PLN";
    const rateText = [from, to].filter(c => c !== "PLN").map(c => `1 ${c} = ${plnRate(c, s).toFixed(4).replace(".", ",")} zł`).join(" · ");
    if (!(await confirmBox(T("Change the main currency to {0}?", to), T("All amounts in this profile are converted from {0} to {1} at today's NBP rate ({2}). Tip: save your profile first, so you can go back exactly.", from, to, rateText), T("Convert"), T("Cancel")))) { e.target.value = from; return; }
    const err = convertProfile(D(), to);
    if (err) { await alertBox(T("Main currency"), err); e.target.value = from; return; }
    toast(T("Main currency: {0}. All amounts were converted.", to), "good"); p.close(); App.rebuild(); openOptions();
  };
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
    if (!(await confirmBox(T("Turn off the password?"), T("New profile files will be encrypted with MoneyCompass's own key again (they open without a password). Files you saved before stay protected with the old password."), T("Turn off"), T("Cancel")))) return;
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
  const redrawOptions = () => { p.close(); openOptions(); };
  el.querySelectorAll("[data-tab-up]").forEach(b => b.onclick = () => { App.moveTab(b.dataset.tabUp, -1); redrawOptions(); });
  el.querySelectorAll("[data-tab-down]").forEach(b => b.onclick = () => { App.moveTab(b.dataset.tabDown, 1); redrawOptions(); });
  el.querySelector('[data-action="reset-tabs"]')?.addEventListener("click", () => { App.resetTabs(); redrawOptions(); });
  el.querySelector('[data-action="tabs-pro"]')?.addEventListener("click", () => requirePro(T("Menu order")));
  el.querySelector('[data-action="reset-layout"]').onclick = () => {
    const o = s.CardOrder || {};
    Object.keys(o).filter(k => k.startsWith("web")).forEach(k => delete o[k]);
    save(); toast(T("All cards are back in their standard order when you close Settings."));
  };
  el.querySelector('[data-action="delete"]').onclick = () => { p.close(); openDelete(); };
}

// ================================================================= Delete data

export function openDelete() {
  const d = D();
  const parts = [["incomes", T("Income sources"), d.Incomes.length], ["expenses", T("Expenses, money received and transfers (bank imports)"), d.Expenses.length + d.Received.length + d.Transfers.length], ["holdings", T("Savings"), d.Holdings.length],
    ["offers", T("Saved savings offers"), d.Offers.length], ["emergency", T("Emergency fund settings"), T("monthly costs, yearly costs, months, buffer")],
    ["rates", T("Exchange rates"), ""], ["modules", T("Modules: loans, budget and goals, calendar"), d.Goals.length + d.Loans.length + d.Budgets.length + (d.Recurring || []).length + (d.Investments || []).length],
    ["categories", T("Your own expense categories"), d.Categories.length || T("none")], ["bin", T("Deleted items"), (d.Deleted || []).length]];
  const p = popup(`<h2 class="popup-title bad">🗑 ${esc(T("Delete data"))}</h2>${hint(T("Choose exactly what to delete."))}
    <label class="check select-all"><input type="checkbox" data-all><span><b>${esc(T("Select all"))}</b></span></label><hr>
    ${parts.map(x => check(x[0], `${x[1]}${x[2] !== "" ? ` (${x[2]})` : ""}`, false)).join("")}
    ${hint(T("Tip: save your profile first (click your name → Profile), so you can load it again if you change your mind."))}
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

export function openHelp(guide = false) {
  if (!guide) { import("./about-help.js").then(m => m.openHelpCenter()); return; }
  const tabs = [["Overview", "Your money at a glance: inflows, outflows, balance and savings rate, with diagrams. \"Optimize my finances\" gives your financial health check and a personal plan with concrete tips."],
    ["Inflows", "Add every source of income: salary, side jobs, bonuses – each with its own amount, frequency, currency and payday, and gross → net for a salary. Money received from bank imports is listed here too."],
    ["Outflows", "Enter what you spend or import a bank statement (one Import button, or drop the file). Mark expenses essential or not, set repeats (🔁), filter and search. Transfers to your own accounts are listed apart and not counted."],
    ["Emergency fund", "Shows how much you should keep aside for bad times (3–6 months of essential costs)."],
    ["Savings", "All your savings in one place (bank, crypto, cash) with a balance chart. Import a savings account statement to see its real rate after tax and fees."],
    ...MODULES.map(m => [m.name, m.description]),
    ["Compare offers", "Compare bank offers: promo rate, promo limit and length, the rate afterwards and the 19% Belka tax."],
    ["Reports", "Choose the period and what to include, and export to Excel, PDF or Word – with diagrams."]];
  popup(`<h2 class="popup-title">? ${esc(T("Help"))}</h2><div class="grid">
    ${card(heading(T("Getting started")) + `<ol>${["Inflows: add your salary and any other money that comes in, with its payday – or import your bank statement: MoneyCompass finds the salary and other inflows by itself.",
      "Outflows: import your current account statement (CSV) – one Import button, or drop the file on the page – or write down what you spend. Then sort what landed in \"Other\" by shop in one go.",
      "Emergency fund: enter your essential monthly costs to see how much to keep aside.",
      "Savings: add your bank accounts, cash and other savings with their interest rate. Import the statement of a savings account to see its real rate after tax and fees, and its balance month by month.",
      "Overview: see everything together, then press \"Optimize my finances\" for your health check and personal plan with concrete tips. Reports (Excel, PDF, Word) are in the Reports tab.",
      "Protect your data: set a PIN or fingerprint/face unlock in your profile, and turn on the automatic encrypted backup (Settings). Install MoneyCompass as an app on your phone or computer."].map(x => `<li>${esc(T(x))}</li>`).join("")}</ol>` + hint(T("Numbers can be typed with a dot or a comma: 1234.50 or 1234,50.")))}
    ${card(heading(T("The tabs")) + tabs.map(t => `<p><b>${esc(T(t[0]))}</b><br><span class="hint">${esc(T(t[1]))}</span></p>`).join("") + hint(T("Loans & debts, Budget plan (with savings goals) and Calendar are modules: switch them on in Settings → Modules.")))}
    ${card(heading("MoneyCompass Pro") + `<p>${esc(T("The free version has all the basics. A license key unlocks:"))}</p><ul>${[
      ["Optimize my finances", "Your personal plan for savings and loans, with current rates from NBP, the Ministry of Finance and bank rankings."], ["Compare offers", "See which bank offer really pays the most after tax."],
      ["Smart import", "Current and savings account statements (CSV): one Import button, or drop the file – MoneyCompass recognises which account it is and sorts the payments into categories."], ["Own categories", "Make your own expense categories, each with an icon of your choice."],
      ["Security & backups", "PIN, fingerprint/face unlock, automatic lock, an automatic encrypted backup and encrypted profile files."], ["Menu order", "Put the tabs in your own order."],
      ["Modules", "Loans & debts, Budget plan and Calendar (Pro): switch them on in Settings → Modules. Each adds its own tab; savings goals are in the Budget plan."]].map(x => `<li><b>${esc(T(x[0]))}</b> – ${esc(T(x[1]))}</li>`).join("")}
      <li><b>${esc(T("Reports"))}</b> – ${esc(T("Reports as Excel, PDF or Word."))}</li><li><b>${esc(T("Profiles"))}</b> – ${esc(T("Separate data for each person or household."))}</li></ul>` +
      hint(T("To unlock: click your name → Profile & license, paste your key under Activation and press Activate.")))}
    ${card(heading(T("Your data & backup")) + `<p>${esc(T("Everything you enter is saved automatically, only in this browser on this device. Nothing is sent to the internet."))}</p>` +
      hint(T("Clearing your browser data deletes your entries. With Pro, turn on the automatic encrypted backup (Settings) or save your profile (click your name → Profile). Loading a profile is free. The Windows app opens these files from version 2.1.")))}
    ${card(heading(T("Windows app")) + `<p>${esc(T("The free Windows app has more than the free web version: reports and several profiles. From version 2.1 it also opens the encrypted profile files of the web app."))}</p>
      <a class="btn go" href="${DOWNLOAD_URL}" target="_blank" rel="noopener">⬇ ${esc(T("Download for Windows"))}</a>`)}
    ${card(heading(T("Please note")) + hint(T("MoneyCompass helps you keep an overview. All results are estimates based on what you enter. They are not financial, investment or tax advice. Interest rates and offers change - always check the bank's own terms.")) +
      hint(T("© {0} MoneyCompass. All rights reserved.", new Date().getFullYear())) + `<a href="../privacy.html#${lang()}" target="_blank">${esc(T("Privacy policy"))}</a> · <a href="../terms.html#${lang()}" target="_blank">${esc(T("Terms of use"))}</a>`)}
    </div><div class="popup-buttons"><button class="btn main" data-close>${esc(T("Close"))}</button></div>`, { width: 1000, cls: "wide-popup" });
}

// ================================================================= Export (Pro on the web)

/** Export: the Reports tab (period, parts and format). */
export async function openExport() { (await import("./export-dialog.js")).openExportDialog(); }

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
  let pick = lang();
  const nm = (c, n) => c === "en" ? "English (United Kingdom)" : n;
  const p = popup(`<button class="nw-x cl-x" data-close aria-label="Close">✕</button>
    <div class="cl"><span class="cl-ic">${ico("globe")}</span><div><h2>${esc(T("Language"))}</h2>
    <p>${esc(T("Choose the language used throughout MoneyCompass."))} ${esc(T("Your data stays the same; only the texts change."))}</p></div></div>
    <div class="lg-list">${LANGS.map(([c, n]) => `<button class="lg-opt${c === pick ? " on" : ""}" data-lang="${c}"><span><b>${esc(nm(c, n))}</b><small>${esc(T("Current language"))}</small></span><i>${ico("check")}</i></button>`).join("")}</div>
    <p class="cl-note">${ico("info")}${esc(T("Language changes are applied immediately across the application."))}</p>
    <div class="cl-btns"><button class="btn main" data-apply>${esc(T("Apply language"))}</button><button class="btn second" data-close>${esc(T("Cancel"))}</button></div>`, { width: 600, cls: "nw-win cl-win lg-win" });
  p.el.querySelectorAll("[data-lang]").forEach(b => b.onclick = () => { pick = b.dataset.lang; p.el.querySelectorAll("[data-lang]").forEach(x => x.classList.toggle("on", x === b)); });
  p.el.querySelector("[data-apply]").onclick = () => { p.close(); setLanguage(pick); };
}
