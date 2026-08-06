// Phase 10 — application-level precision preferences (spec §69's second
// category: "not durable project data"). Separate from the project's own
// durable fields (guides, per-page grid/margins/safeArea/bleed/layoutGrid/
// baselineGrid, preferredUnit) — those live in the workspace record via
// autosave like everything else. This is a small synchronous localStorage
// read/write, deliberately modeled on recentColorsContext.jsx's own
// "tiny local preference, not project data" pattern rather than routed
// through the autosave service.

import { PRECISION_PREFS_STORAGE_KEY } from "./constants";
import { DEFAULT_UNIT } from "./measurement";

export const SNAP_SENSITIVITY_PRESETS = { low: 3, medium: 6, high: 10 };

export function defaultPrecisionPrefs() {
  return {
    defaultUnit: DEFAULT_UNIT,
    // Editor chrome preference (not project content) — rulers are opt-in,
    // toggled from the View menu, and persisted here rather than per-project.
    showRulers: false,
    showGuides: true,
    showSmartGuides: true,
    showMeasurementLabels: true,
    snapSensitivityKey: "medium",
    snapSensitivityPx: SNAP_SENSITIVITY_PRESETS.medium,
    snapToObjects: true,
    snapToGuides: true,
    snapToGrid: false,
    snapToPage: true,
    snapToMargins: true,
    snapToLayoutGrid: true,
    snapToEqualSpacing: true,
    snapRotation: true,
    rotationSnapIncrement: 15,
    nudgeStandard: 1,
    nudgeLarge: 10,
    nudgeFine: 0.1,
  };
}

function clampPrefNumber(value, fallback, min, max) {
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

export function normalizePrecisionPrefs(raw) {
  const d = defaultPrecisionPrefs();
  if (!raw || typeof raw !== "object") return d;
  return {
    ...d,
    ...raw,
    defaultUnit: ["px", "in", "cm", "mm"].includes(raw.defaultUnit) ? raw.defaultUnit : d.defaultUnit,
    snapSensitivityPx: clampPrefNumber(raw.snapSensitivityPx, d.snapSensitivityPx, 1, 60),
    rotationSnapIncrement: clampPrefNumber(raw.rotationSnapIncrement, d.rotationSnapIncrement, 1, 90),
    nudgeStandard: clampPrefNumber(raw.nudgeStandard, d.nudgeStandard, 0.01, 500),
    nudgeLarge: clampPrefNumber(raw.nudgeLarge, d.nudgeLarge, 0.01, 1000),
    nudgeFine: clampPrefNumber(raw.nudgeFine, d.nudgeFine, 0.001, 100),
  };
}

export function loadPrecisionPrefs() {
  try {
    const raw = localStorage.getItem(PRECISION_PREFS_STORAGE_KEY);
    return raw ? normalizePrecisionPrefs(JSON.parse(raw)) : defaultPrecisionPrefs();
  } catch {
    return defaultPrecisionPrefs();
  }
}

export function savePrecisionPrefs(prefs) {
  try {
    localStorage.setItem(PRECISION_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Best-effort — a failed write just means prefs reset to defaults next
    // load, never blocks editing.
  }
}
