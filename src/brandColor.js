// Phase 11 — brand color model. One normalized internal representation
// ({ r, g, b, a }, 0-255 channels / 0-1 alpha) that every supported input
// format (HEX, RGB, RGBA, HSL, HSLA) parses into and every output format
// renders from — so brand color tokens, contrast checks, and color-replace
// tolerance matching all compare apples to apples regardless of how the
// user typed the color in.
//
// Deliberately a plain parser, not a CSS-expression evaluator: no url(),
// var(), calc(), or arbitrary CSS is ever accepted (spec §9/§94) — only the
// five explicit formats below are recognized, anything else is rejected.

const HEX3_RE = /^#([0-9a-f]{3})$/i;
const HEX4_RE = /^#([0-9a-f]{4})$/i;
const HEX6_RE = /^#([0-9a-f]{6})$/i;
const HEX8_RE = /^#([0-9a-f]{8})$/i;
const RGB_RE = /^rgb\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/i;
const RGBA_RE = /^rgba\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/i;
const HSL_RE = /^hsl\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)%\s*,\s*(-?[\d.]+)%\s*\)$/i;
const HSLA_RE = /^hsla\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)%\s*,\s*(-?[\d.]+)%\s*,\s*(-?[\d.]+)\s*\)$/i;

function clampChannel(n) {
  return Math.min(255, Math.max(0, Math.round(n)));
}
function clampAlpha(n) {
  return Math.min(1, Math.max(0, n));
}
function isFinite01(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.min(100, Math.max(0, s)) / 100;
  l = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return { r: clampChannel((r1 + m) * 255), g: clampChannel((g1 + m) * 255), b: clampChannel((b1 + m) * 255) };
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s: s * 100, l: l * 100 };
}

// Returns { r, g, b, a } (channels 0-255, alpha 0-1) or null if the input
// isn't one of the five supported formats / has out-of-range or
// non-finite values.
export function parseColor(input) {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value) return null;

  let m;
  if ((m = HEX8_RE.exec(value))) {
    const h = m[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: parseInt(h.slice(6, 8), 16) / 255 };
  }
  if ((m = HEX6_RE.exec(value))) {
    const h = m[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  if ((m = HEX4_RE.exec(value))) {
    const h = m[1];
    return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16), a: parseInt(h[3] + h[3], 16) / 255 };
  }
  if ((m = HEX3_RE.exec(value))) {
    const h = m[1];
    return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16), a: 1 };
  }
  if ((m = RGBA_RE.exec(value))) {
    const [, r, g, b, a] = m.map(Number);
    if (![r, g, b, a].every(isFinite01)) return null;
    return { r: clampChannel(r), g: clampChannel(g), b: clampChannel(b), a: clampAlpha(a) };
  }
  if ((m = RGB_RE.exec(value))) {
    const [, r, g, b] = m.map(Number);
    if (![r, g, b].every(isFinite01)) return null;
    return { r: clampChannel(r), g: clampChannel(g), b: clampChannel(b), a: 1 };
  }
  if ((m = HSLA_RE.exec(value))) {
    const [, h, s, l, a] = m.map(Number);
    if (![h, s, l, a].every(isFinite01)) return null;
    return { ...hslToRgb(h, s, l), a: clampAlpha(a) };
  }
  if ((m = HSL_RE.exec(value))) {
    const [, h, s, l] = m.map(Number);
    if (![h, s, l].every(isFinite01)) return null;
    return { ...hslToRgb(h, s, l), a: 1 };
  }
  return null;
}

export function isValidColor(input) {
  return parseColor(input) !== null;
}

export function toHex(color, { includeAlpha = false } = {}) {
  const c = typeof color === "string" ? parseColor(color) : color;
  if (!c) return null;
  const hex = (n) => clampChannel(n).toString(16).padStart(2, "0");
  const base = `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`;
  if (includeAlpha && c.a < 1) return `${base}${hex(Math.round(c.a * 255))}`;
  return base;
}

export function toRgbaString(color) {
  const c = typeof color === "string" ? parseColor(color) : color;
  if (!c) return null;
  return `rgba(${clampChannel(c.r)}, ${clampChannel(c.g)}, ${clampChannel(c.b)}, ${Number(clampAlpha(c.a).toFixed(3))})`;
}

export function toHslaString(color) {
  const c = typeof color === "string" ? parseColor(color) : color;
  if (!c) return null;
  const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
  return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${Number(clampAlpha(c.a).toFixed(3))})`;
}

// The CSS string actually used on canvas (Konva accepts hex/rgba directly).
// Solid opaque colors render as plain hex for readability; anything with
// alpha < 1 renders as rgba() so opacity is never silently dropped.
export function toCssColor(color) {
  const c = typeof color === "string" ? parseColor(color) : color;
  if (!c) return null;
  return c.a >= 1 ? toHex(c) : toRgbaString(c);
}

export function detectFormat(input) {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (HEX3_RE.test(value) || HEX4_RE.test(value) || HEX6_RE.test(value) || HEX8_RE.test(value)) return "hex";
  if (RGBA_RE.test(value)) return "rgba";
  if (RGB_RE.test(value)) return "rgb";
  if (HSLA_RE.test(value)) return "hsla";
  if (HSL_RE.test(value)) return "hsl";
  return null;
}

// Roughly-equal comparison used by "similar color" replace tolerance (spec
// §52) — Euclidean distance in RGB space, normalized to 0-1 (0 = identical,
// 1 = maximally different, i.e. black vs white).
const MAX_RGB_DISTANCE = Math.sqrt(3 * 255 * 255);
export function colorDistance(a, b) {
  const ca = typeof a === "string" ? parseColor(a) : a;
  const cb = typeof b === "string" ? parseColor(b) : b;
  if (!ca || !cb) return 1;
  const d = Math.sqrt((ca.r - cb.r) ** 2 + (ca.g - cb.g) ** 2 + (ca.b - cb.b) ** 2);
  return d / MAX_RGB_DISTANCE;
}

export function colorsEqual(a, b, { ignoreAlpha = false } = {}) {
  const ca = typeof a === "string" ? parseColor(a) : a;
  const cb = typeof b === "string" ? parseColor(b) : b;
  if (!ca || !cb) return false;
  if (ca.r !== cb.r || ca.g !== cb.g || ca.b !== cb.b) return false;
  if (ignoreAlpha) return true;
  return Math.abs(ca.a - cb.a) < 0.004; // ~1/255
}

// --- WCAG 2.x contrast (spec §16) — reference only, not a compliance claim ---

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(color) {
  const c = typeof color === "string" ? parseColor(color) : color;
  if (!c) return null;
  const r = srgbToLinear(c.r);
  const g = srgbToLinear(c.g);
  const b = srgbToLinear(c.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Assumes both colors are composited opaque (alpha handled by the caller,
// e.g. flattened against a background) — contrast ratio is only meaningful
// between two fully-resolved colors.
export function contrastRatio(foreground, background) {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  if (l1 == null || l2 == null) return null;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// WCAG 2.x AA thresholds — "reference only", per spec §16 ("without
// claiming legal compliance").
export function evaluateContrast(foreground, background) {
  const ratio = contrastRatio(foreground, background);
  if (ratio == null) return null;
  return {
    ratio: Math.round(ratio * 100) / 100,
    normalTextPass: ratio >= 4.5,
    largeTextPass: ratio >= 3,
    normalTextWarning: ratio < 4.5,
    largeTextWarning: ratio < 3,
  };
}

export const COLOR_ROLES = [
  "primary", "secondary", "accent", "background", "surface",
  "text", "mutedText", "border", "success", "warning", "error", "custom",
];
