// Password-protected profile files (web app only): AES-256-GCM, key from the password with PBKDF2-SHA-256 (300 000 rounds).
// The password is never saved. This browser keeps only the derived key (per profile, not in the profile itself),
// so saving a file doesn't ask for the password every time. Opening a protected file anywhere needs the password.
import { State, store } from "./core.js";

const ROUNDS = 300000, MAGIC = "MoneyCompassEncrypted";
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = buf => { const a = new Uint8Array(buf); let s = ""; for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode(...a.subarray(i, i + 8192)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const keyName = () => "mc-filekey:" + State.id;

async function derive(password, salt) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ROUNDS }, base, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}
/** Is this profile's file protected with a password? */
export const fileProtected = () => !!store.get(keyName());

export async function setFilePassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await derive(password, salt);
  store.set(keyName(), JSON.stringify({ salt: b64(salt), key: b64(await crypto.subtle.exportKey("raw", key)) }));
}
export function removeFilePassword() { store.remove(keyName()); }

/** The text of the profile file: encrypted when a password is set, plain JSON otherwise. */
export async function profileFileText(data) {
  const json = JSON.stringify(data, null, 2);
  const saved = store.get(keyName());
  if (!saved) return json;
  const { salt, key } = JSON.parse(saved);
  const k = await crypto.subtle.importKey("raw", unb64(key), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, enc.encode(json));
  return JSON.stringify({ [MAGIC]: 1, Kdf: "PBKDF2-SHA256", Rounds: ROUNDS, Salt: salt, Iv: b64(iv), Data: b64(ct) }, null, 1);
}

// Automatic backup file (.mcbak): always encrypted. With a file password set, with that password (real protection).
// Without one, with a key built into MoneyCompass: the file can't be read in Notepad or another program, and it doesn't depend on
// anything kept in the browser, so it still opens after the browser data is deleted. It is not a secret against someone who studies the app.
const BUILTIN = Uint8Array.from("4d43a7f2c91e5b08d63af1729e0c84b5173ad96e2fb4c80e5a91d3762cf0b84e".match(/../g), h => parseInt(h, 16));
export async function backupFileText(data) {
  if (fileProtected()) return profileFileText(data);
  const k = await crypto.subtle.importKey("raw", BUILTIN, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, enc.encode(JSON.stringify(data)));
  return JSON.stringify({ [MAGIC]: 1, Kdf: "builtin", Iv: b64(iv), Data: b64(ct) });
}
/** A backup encrypted with the built-in key (opens without a password). */
export const isBuiltinFile = x => isEncryptedFile(x) && x.Kdf === "builtin";
export async function openBuiltin(x) {
  try {
    const k = await crypto.subtle.importKey("raw", BUILTIN, "AES-GCM", false, ["decrypt"]);
    return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(x.Iv) }, k, unb64(x.Data))));
  } catch { return null; }
}

export const isEncryptedFile = x => !!(x && typeof x === "object" && x[MAGIC]);
/** Open a protected file with its password: the profile object, or null when the password is wrong. */
export async function decryptFile(x, password) {
  try {
    const salt = unb64(x.Salt);
    const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: x.Rounds || ROUNDS }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(x.Iv) }, key, unb64(x.Data));
    return JSON.parse(dec.decode(pt));
  } catch { return null; }
}
