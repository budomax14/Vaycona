// Phase 12 — reduced-motion preference (spec §53). Two inputs feed the
// EFFECTIVE reduced-motion state: the OS's `prefers-reduced-motion` media
// query, and an explicit in-app override the user can set either way (spec
// §53: "the user may explicitly override... do not make reduced motion
// impossible to disable if the user intentionally creates animation").
// Modeled on precisionPreferences.js's small-localStorage-pref pattern —
// this is an app-level preference, not durable project data.

const STORAGE_KEY = "personal-canva-reduced-motion-v1";

// override: "system" (follow the OS) | "on" (force reduced motion) | "off"
// (force full motion, even if the OS prefers reduced).
export function loadReducedMotionOverride() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "on" || raw === "off" ? raw : "system";
  } catch {
    return "system";
  }
}

export function saveReducedMotionOverride(value) {
  try {
    if (value === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // best-effort, same as every other local pref in this app
  }
}

export function systemPrefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function resolveReducedMotion(override) {
  if (override === "on") return true;
  if (override === "off") return false;
  return systemPrefersReducedMotion();
}
