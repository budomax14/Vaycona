// Local-only admin gate for the Template Management Admin page. This app
// has no server, no user accounts, and no real authentication system (see
// EDITOR_INTEGRATION_PROMPT.txt-era exploration) — "administrator" here
// means "knows the passcode set in this browser." It's a soft convenience
// wall to keep the admin dashboard out of the way of normal editing, not a
// security boundary: the hash lives in this browser's own localStorage,
// readable by anyone with devtools access to this device.
//
// Hashing reuses the exact same primitive assetStore.js's computeChecksum
// already uses (crypto.subtle.digest SHA-256) rather than introducing a
// new crypto dependency for a non-cryptographic-security use case.

import { ADMIN_PASSCODE_HASH_KEY, ADMIN_UNLOCKED_KEY } from "./constants";

async function sha256Hex(text) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hasAdminPasscode() {
  return !!localStorage.getItem(ADMIN_PASSCODE_HASH_KEY);
}

export async function setAdminPasscode(code) {
  const trimmed = (code || "").trim();
  if (trimmed.length < 4) return { ok: false, error: "Use at least 4 characters." };
  const hash = await sha256Hex(trimmed);
  localStorage.setItem(ADMIN_PASSCODE_HASH_KEY, hash);
  localStorage.setItem(ADMIN_UNLOCKED_KEY, "1");
  return { ok: true, error: null };
}

export async function verifyAdminPasscode(code) {
  const stored = localStorage.getItem(ADMIN_PASSCODE_HASH_KEY);
  if (!stored) return false;
  const hash = await sha256Hex((code || "").trim());
  const ok = hash === stored;
  if (ok) localStorage.setItem(ADMIN_UNLOCKED_KEY, "1");
  return ok;
}

export function isAdminUnlocked() {
  return hasAdminPasscode() && localStorage.getItem(ADMIN_UNLOCKED_KEY) === "1";
}

export function lockAdmin() {
  localStorage.removeItem(ADMIN_UNLOCKED_KEY);
}

// Full reset — lets an admin who forgot their passcode start over. Only
// clears the gate itself; never touches template data.
export function resetAdminPasscode() {
  localStorage.removeItem(ADMIN_PASSCODE_HASH_KEY);
  localStorage.removeItem(ADMIN_UNLOCKED_KEY);
}
