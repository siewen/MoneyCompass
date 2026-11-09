// Lock screen: a PIN for each profile (saved in the profile) and an automatic lock after some minutes without use.
// Note: the PIN keeps other people on this device out of the app. It does not encrypt the data in the browser.
import { T, State, save, store, profiles, switchTo, deleteProfile, currentName } from "./core.js";
import { esc, popup, toast, confirmBox } from "./ui.js";

const enc = new TextEncoder();
// The PIN itself is never saved: only a salted PBKDF2-SHA-256 hash (200 000 rounds), which can't be turned back into the PIN
// and makes guessing slow. The same PIN gives a different hash in every profile (random salt).
const ROUNDS = 200000;
async function hash(pin, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode("moneycompass:" + salt), iterations: ROUNDS }, key, 256);
  return "pbkdf2$" + ROUNDS + "$" + [...new Uint8Array(bits)].map(x => x.toString(16).padStart(2, "0")).join("");
}
const S = () => State.data.Settings;
export const hasPin = () => !!S().PinHash;
export const lockMinutes = () => +S().AutoLockMinutes || 0;
const validPin = p => /^\d{4,8}$/.test(p);

export async function setPin(pin) {
  const salt = [...crypto.getRandomValues(new Uint8Array(12))].map(x => x.toString(16).padStart(2, "0")).join("");
  S().PinSalt = salt; S().PinHash = await hash(pin, salt); save();
}
export function removePin() { delete S().PinHash; delete S().PinSalt; save(); removeBio(); }
export async function checkPin(pin) { return hasPin() && await hash(pin, S().PinSalt) === S().PinHash; }

// ---------- fingerprint or face (WebAuthn, this device only) ----------
// Windows Hello, Android fingerprint, Touch ID or Face ID through the browser. The fingerprint or face never leaves the device:
// the device only confirms "the owner is here". The credential id is kept in this browser (not in the profile file),
// because it works only on the device where it was set up. It needs a PIN, which stays the fallback.
const bioKey = () => "mc-bio:" + State.id;
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
let bioAvail = false;
(async () => { try { bioAvail = !!(window.PublicKeyCredential && window.isSecureContext && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { bioAvail = false; } })();
/** Can this device unlock with fingerprint or face? */
export const bioAvailable = () => bioAvail;
export const bioOn = () => hasPin() && !!window.PublicKeyCredential && !!store.get(bioKey());
export function removeBio() { store.remove(bioKey()); }
/** Set up fingerprint or face for this profile on this device. True when it worked. */
export async function enableBio() {
  try {
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "MoneyCompass" },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: currentName() || "MoneyCompass", displayName: currentName() || "MoneyCompass" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      attestation: "none", timeout: 60000 } });
    if (!cred) return false;
    store.set(bioKey(), b64u(cred.rawId)); return true;
  } catch { return false; }
}
/** Ask the device for the fingerprint or face. True only when the device confirmed the owner.
 *  Only one request at a time: a second one (button click while the automatic try is still open) waits for the same answer
 *  instead of cancelling it. When it fails, bioWhy holds the reason shown on the lock screen. */
let bioPending = null, bioWhy = "";
function bioCheck() {
  if (bioPending) return bioPending;
  bioPending = (async () => {
    bioWhy = "";
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const a = await navigator.credentials.get({ publicKey: { challenge, allowCredentials: [{ type: "public-key", id: unb64u(store.get(bioKey())), transports: ["internal", "hybrid"] }], userVerification: "required", timeout: 60000 } });
      if (!a) { bioWhy = T("no answer from the device"); return false; }
      const cd = JSON.parse(new TextDecoder().decode(a.response.clientDataJSON));
      const flags = new Uint8Array(a.response.authenticatorData)[32];
      if (cd.type !== "webauthn.get" || cd.challenge !== b64u(challenge)) { bioWhy = T("the answer did not belong to this request"); return false; }
      if (cd.origin !== location.origin) { bioWhy = T("the answer came for another address ({0})", cd.origin); return false; }
      if (!(flags & 4)) { bioWhy = T("the device did not confirm your fingerprint or face"); return false; }
      return true;
    } catch (e) {
      bioWhy = e?.name === "NotAllowedError" ? T("cancelled, timed out, or this device does not know the saved fingerprint or face – set it up again in the profile")
        : e?.name === "InvalidStateError" ? T("this device does not know the saved fingerprint or face – set it up again in the profile")
        : (e?.name || "") + (e?.message ? ": " + e.message : "");
      return false;
    }
  })();
  bioPending.finally(() => { bioPending = null; });
  return bioPending;
}

// ---------- the lock screen ----------
let locked = false, last = Date.now(), fails = 0, waitUntil = 0, after = null, rebuild = () => {};
export const isLocked = () => locked;

/** Show the lock screen. Without a PIN (only the timer is on) one click opens MoneyCompass again. */
export function lock(next = null, note = "") {
  if (locked) return;
  locked = true; after = next;
  document.body.classList.add("is-locked");
  const others = profiles().filter(p => !p.current);
  const el = document.createElement("div");
  el.className = "lock-screen";
  el.innerHTML = `<div class="lock-box">
    <img src="../logo.svg" alt="" class="lock-logo">
    <h2>${esc(currentName())}</h2>
    <p class="hint">${esc(note || (hasPin() ? T("Enter your PIN to open MoneyCompass.") : T("MoneyCompass was locked because it was not used for a while.")))}</p>
    ${hasPin() ? `<input class="pin-input" type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="• • • •" aria-label="${esc(T("PIN"))}">
      <p class="lock-error bad" hidden></p>` : ""}
    <button class="btn main lock-open">🔓 ${esc(T("Open"))}</button>
    ${bioOn() ? `<button class="btn second lock-bio">👆 ${esc(T("Unlock with fingerprint or face"))}</button>` : ""}
    ${others.length ? `<label class="lock-switch"><span>${esc(T("Other profile"))}</span><select><option value="">–</option>${others.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></label>` : ""}
    ${hasPin() ? `<a href="#" class="lock-forgot">${esc(T("Forgot your PIN?"))}</a>` : ""}
  </div>`;
  document.body.appendChild(el);
  const input = el.querySelector(".pin-input"), err = el.querySelector(".lock-error");
  const open = async () => {
    if (hasPin()) {
      if (Date.now() < waitUntil) { err.hidden = false; err.textContent = T("Too many wrong PINs. Try again in {0} seconds.", Math.ceil((waitUntil - Date.now()) / 1000)); return; }
      if (!(await checkPin(input.value.trim()))) {
        fails++; input.value = ""; input.focus();
        if (fails >= 5) { waitUntil = Date.now() + 30000; fails = 0; }
        err.hidden = false; err.textContent = Date.now() < waitUntil ? T("Too many wrong PINs. Try again in {0} seconds.", 30) : T("Wrong PIN. Please try again.");
        el.querySelector(".lock-box").classList.remove("shake"); void el.offsetWidth; el.querySelector(".lock-box").classList.add("shake");
        return;
      }
    }
    fails = 0; unlock();
  };
  el.querySelector(".lock-open").onclick = open;
  const bio = async () => {
    if (await bioCheck()) { if (el.isConnected) { fails = 0; unlock(); } }
    else if (el.isConnected && err) { err.hidden = false; err.textContent = T("Not recognised. Try again or enter your PIN.") + (bioWhy ? " (" + bioWhy + ")" : ""); }
  };
  const bioBtn = el.querySelector(".lock-bio");
  if (bioBtn) { bioBtn.onclick = bio; setTimeout(() => { if (el.isConnected && !document.hidden && document.hasFocus()) bio(); }, 300); }
  input?.addEventListener("keydown", e => { if (e.key === "Enter") open(); });
  el.querySelector(".lock-switch select")?.addEventListener("change", e => {
    if (!e.target.value) return;
    switchTo(e.target.value); el.remove(); locked = false;
    const n = after; rebuild();
    if (hasPin()) lock(n); else { document.body.classList.remove("is-locked"); n && n(); }
  });
  el.querySelector(".lock-forgot")?.addEventListener("click", async ev => {
    ev.preventDefault();
    const ok = await confirmBox(T("Forgot your PIN?"),
      T("The PIN can't be shown or reset – that is what keeps others out.\nYou can delete this profile from this browser and then load your saved profile file (it has the PIN you had when you saved it), or start fresh."),
      T("Delete this profile"), T("Cancel"), true);
    if (!ok) return;
    deleteProfile(State.id); el.remove(); locked = false; document.body.classList.remove("is-locked");
    rebuild(); toast(T("The profile was deleted from this browser."), "good");
  });
  setTimeout(() => (input || el.querySelector(".lock-open")).focus(), 50);
}
function unlock() {
  document.querySelector(".lock-screen")?.remove();
  document.body.classList.remove("is-locked");
  locked = false; last = Date.now();
  const n = after; after = null; n && n();
}

/** Start watching for activity. The app locks after the minutes set in Settings (and at start when the profile has a PIN). */
export function startLock(rebuildApp) {
  rebuild = rebuildApp;
  const touch = () => { if (!locked) last = Date.now(); };
  ["pointerdown", "keydown", "wheel", "touchstart", "scroll"].forEach(e => window.addEventListener(e, touch, { passive: true, capture: true }));
  let moved = 0;
  window.addEventListener("mousemove", () => { const n = Date.now(); if (n - moved > 5000) { moved = n; touch(); } }, { passive: true });
  const check = () => { const m = lockMinutes(); if (m && !locked && Date.now() - last > m * 60000) lock(); };
  setInterval(check, 10000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
}

// ---------- set, change or remove the PIN (profile panel) ----------
export function pinDialog(done = () => {}) {
  const had = hasPin();
  const p = popup(`<div class="box-head"><span class="box-icon">🔒</span><h2>${esc(had ? T("Change or remove your PIN") : T("Set a PIN"))}</h2></div>
    <p class="hint">${esc(T("4 to 8 digits. The PIN is asked when MoneyCompass starts, after the automatic lock and when you switch to this profile. It is saved in this profile and in your profile file."))}</p>
    <form class="pin-form">
      ${had ? `<label class="field"><span>${esc(T("Current PIN"))}</span><input type="password" inputmode="numeric" name="old" maxlength="8" autocomplete="off"></label>` : ""}
      <label class="field"><span>${esc(had ? T("New PIN") : T("PIN"))}</span><input type="password" inputmode="numeric" name="pin" maxlength="8" autocomplete="off"></label>
      <label class="field"><span>${esc(T("Repeat the PIN"))}</span><input type="password" inputmode="numeric" name="pin2" maxlength="8" autocomplete="off"></label>
    </form>
    <p class="hint">${esc(T("Write it down somewhere safe: a forgotten PIN can't be reset. The PIN keeps others on this device out of the app; it does not encrypt your data."))}</p>
    <div class="box-buttons"><button class="btn main" data-p="save">${esc(had ? T("Save new PIN") : T("Set PIN"))}</button>
      ${had ? `<button class="btn danger" data-p="remove">${esc(T("Remove PIN"))}</button>` : ""}<button class="btn second" data-close>${esc(T("Cancel"))}</button></div>`, { width: 440, cls: "box" });
  const f = p.el.querySelector("form"), v = n => (f.elements[n]?.value || "").trim();
  f.onsubmit = e => e.preventDefault();
  const oldOk = async () => { if (!had) return true; if (await checkPin(v("old"))) return true; toast(T("The current PIN is wrong."), "bad"); return false; };
  p.el.querySelector('[data-p="save"]').onclick = async () => {
    if (!(await oldOk())) return;
    if (!(await (await import("./app.js")).requirePro(T("PIN")))) return;   // setting or changing a PIN is Pro (removing it is not)
    if (!validPin(v("pin"))) { toast(T("The PIN must have 4 to 8 digits."), "bad"); return; }
    if (v("pin") !== v("pin2")) { toast(T("The two PINs are not the same."), "bad"); return; }
    await setPin(v("pin")); p.close(); toast(T("PIN saved."), "good"); done();
  };
  p.el.querySelector('[data-p="remove"]')?.addEventListener("click", async () => {
    if (!(await oldOk())) return;
    removePin(); p.close(); toast(T("PIN removed."), "good"); done();
  });
  setTimeout(() => f.querySelector("input")?.focus(), 50);
}
