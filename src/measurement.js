// Phase 10 — centralized unit conversion/formatting/parsing. Internal
// geometry stays px everywhere (every existing system — items, pages,
// bounds, snapping — already assumes px; see pageSizes.js's UNITS table,
// which this module wraps rather than duplicates). This is purely a
// DISPLAY-layer concern: converting px to/from a user-facing unit for
// rulers, the status bar, numeric transform fields, and guide creation.

import { UNITS, getUnit } from "./pageSizes";

export const DEFAULT_UNIT = "px";

// Decimal places shown per unit — px is always a whole number in this
// editor's geometry; physical units need enough precision to round-trip
// sensibly (e.g. 96px = 1.00in exactly) without looking noisy.
const UNIT_PRECISION = { px: 0, in: 2, cm: 2, mm: 1 };

export function isSupportedUnit(unitKey) {
  return UNITS.some((u) => u.key === unitKey);
}

export function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// px -> a display number in `unitKey`, rounded to that unit's precision.
export function pxToDisplay(px, unitKey) {
  if (!Number.isFinite(px)) return 0;
  const unit = getUnit(unitKey);
  return roundTo(unit.fromPx(px), UNIT_PRECISION[unitKey] ?? 2);
}

// A display number in `unitKey` -> px (not rounded — callers that need
// stable geometry should round in px themselves, e.g. Math.round for a
// guide position).
export function displayToPx(value, unitKey) {
  const unit = getUnit(unitKey);
  return unit.toPx(Number(value) || 0);
}

// px -> "12.5 mm" style string for display-only contexts (status bar,
// Guide Manager rows). Not meant to be parsed back — use formatBareValue +
// the unit label separately for an editable field.
export function formatMeasurement(px, unitKey) {
  const value = pxToDisplay(px, unitKey);
  return `${value}${unitKey === "px" ? "" : unitKey}`;
}

export function formatBareValue(px, unitKey) {
  return String(pxToDisplay(px, unitKey));
}

// Parses user input that may carry its own unit suffix ("2in", "25.4 mm",
// "10cm", "96px", or a bare number interpreted in `fallbackUnitKey`).
// Returns { px, ok } — ok:false on anything non-finite, so callers can
// reject without guessing a fallback value themselves (spec §5 "finite-
// number validation"). Locale-safe: only accepts '.' as decimal separator
// and optional leading '-', matching every other numeric field in this
// editor (no locale-specific parsing anywhere else in the codebase either).
export function parseMeasurementInput(text, fallbackUnitKey = DEFAULT_UNIT) {
  if (typeof text === "number") {
    return Number.isFinite(text) ? { ok: true, px: displayToPx(text, fallbackUnitKey) } : { ok: false, px: 0 };
  }
  const trimmed = String(text ?? "").trim().toLowerCase();
  if (!trimmed) return { ok: false, px: 0 };
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*(px|in|cm|mm)?$/);
  if (!match) return { ok: false, px: 0 };
  const [, numText, suffix] = match;
  const num = Number(numText);
  if (!Number.isFinite(num)) return { ok: false, px: 0 };
  const unitKey = suffix && isSupportedUnit(suffix) ? suffix : fallbackUnitKey;
  return { ok: true, px: displayToPx(num, unitKey) };
}

export function unitLabel(unitKey) {
  return getUnit(unitKey).label;
}

export { UNITS };
