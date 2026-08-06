import Konva from "konva";

// Centralized image adjustments/filters pipeline (Phase 6) — the single
// place filter math lives, so DesignNode/ImageNode and FrameNode never
// duplicate this logic (each just calls useImageFilters with their own
// node ref, see useImageFilters.js).
//
// Realistic subset, checked against Konva's actual built-in filter set
// (Konva.Filters.*) rather than faking controls with no real effect:
//   brightness -> Konva.Filters.Brighten (native)
//   contrast   -> Konva.Filters.Contrast (native)
//   saturation -> Konva.Filters.HSL, saturation channel (native)
//   warmth     -> one small custom filter (R/B channel shift) — Konva's
//                 .filters() accepts plain (imageData)=>void functions
//   blur       -> Konva.Filters.Blur (native)
// Explicitly and honestly out of scope this phase (documented, not faked):
//   highlights/shadows — needs real per-tone-range curves, no Konva
//     primitive exists for this.
//   sharpen — no Konva built-in; a real unsharp-mask is expensive per-frame.
//   fade — not a distinct operation from contrast+brightness; would be a
//     decorative control doing nothing new.
//   exposure — aliased onto the same `brightness` value rather than a
//     second slider performing identical math under a different label.
//
// Recolor (tint/duotone) rides the same pipeline as a plain hex string
// (or null when off) rather than a boolean "enabled" flag — matches how
// every other color surface in this app (fill, stroke, brand tokens)
// represents "no color set" as null/undefined instead of a separate flag.
export const DEFAULT_ADJUSTMENTS = {
  brightness: 0, // -1..1
  contrast: 0, // -1..1 (mapped to Konva's -100..100 range)
  saturation: 0, // -1..1
  warmth: 0, // -1..1 (negative = cooler/blue, positive = warmer/orange)
  blur: 0, // 0..20 px radius
  tintColor: null, // hex string, or null = no tint
  tintAmount: 0.5, // 0..1, only meaningful once tintColor is set
  duotoneShadow: null, // hex string mapped to the darkest pixels
  duotoneHighlight: null, // hex string mapped to the lightest pixels — duotone is only active once BOTH colors are set
};

function isHex(value) {
  return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

export function normalizeAdjustments(adjustments) {
  const a = { ...DEFAULT_ADJUSTMENTS, ...(adjustments || {}) };
  const clamp = (v, min, max, fallback) => (typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback);
  return {
    brightness: clamp(a.brightness, -1, 1, 0),
    contrast: clamp(a.contrast, -1, 1, 0),
    saturation: clamp(a.saturation, -1, 1, 0),
    warmth: clamp(a.warmth, -1, 1, 0),
    blur: clamp(a.blur, 0, 20, 0),
    tintColor: isHex(a.tintColor) ? a.tintColor : null,
    tintAmount: clamp(a.tintAmount, 0, 1, 0.5),
    duotoneShadow: isHex(a.duotoneShadow) ? a.duotoneShadow : null,
    duotoneHighlight: isHex(a.duotoneHighlight) ? a.duotoneHighlight : null,
  };
}

export function hasAnyAdjustment(adjustments) {
  const a = normalizeAdjustments(adjustments);
  return (
    a.brightness !== 0 ||
    a.contrast !== 0 ||
    a.saturation !== 0 ||
    a.warmth !== 0 ||
    a.blur !== 0 ||
    (!!a.tintColor && a.tintAmount > 0) ||
    (!!a.duotoneShadow && !!a.duotoneHighlight)
  );
}

// Cheap custom filter — shifts the red/blue channels in opposite directions
// to simulate warmth/temperature. Konva calls filter functions with `this`
// bound to the Konva node and receives the raw ImageData to mutate in place.
function warmthFilter(amount) {
  const shift = Math.round(amount * 40); // px-value channel shift, small and cheap
  return function applyWarmth(imageData) {
    if (!shift) return;
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] + shift)); // R
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] - shift)); // B
    }
  };
}

function hexToRgb(hex) {
  const normalized = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  const num = parseInt(normalized.slice(1), 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

// Duotone — replaces the image's own colors entirely, mapping each pixel's
// luminance onto a gradient between the shadow color (darkest) and
// highlight color (lightest). Applied before tint so a tint wash can still
// sit on top of a duotoned image rather than the two fighting over which
// one "owns" the final color.
function duotoneFilter(shadowHex, highlightHex) {
  const shadow = hexToRgb(shadowHex);
  const highlight = hexToRgb(highlightHex);
  return function applyDuotone(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const luminance = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      data[i] = shadow.r + (highlight.r - shadow.r) * luminance;
      data[i + 1] = shadow.g + (highlight.g - shadow.g) * luminance;
      data[i + 2] = shadow.b + (highlight.b - shadow.b) * luminance;
    }
  };
}

// Tint — a simple linear blend of every pixel toward one color, i.e. a
// colored wash over whatever is already there (unlike duotone, which
// replaces the image's colors outright).
function tintFilter(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return function applyTint(imageData) {
    if (amount <= 0) return;
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] += (r - data[i]) * amount;
      data[i + 1] += (g - data[i + 1]) * amount;
      data[i + 2] += (b - data[i + 2]) * amount;
    }
  };
}

// Builds the Konva filter function list + the numeric attrs those filters
// read (Konva's built-in filters read values off the node itself, set via
// node.setAttrs before calling node.filters([...])).
export function buildFilterPipeline(adjustments) {
  const a = normalizeAdjustments(adjustments);
  const filters = [];
  const props = {};

  if (a.brightness !== 0) {
    filters.push(Konva.Filters.Brighten);
    props.brightness = a.brightness; // Konva.Filters.Brighten expects roughly -1..1
  }
  if (a.contrast !== 0) {
    filters.push(Konva.Filters.Contrast);
    props.contrast = a.contrast * 100; // Konva.Filters.Contrast expects -100..100
  }
  if (a.saturation !== 0) {
    filters.push(Konva.Filters.HSL);
    props.saturation = a.saturation * 5; // Konva.Filters.HSL saturation is a multiplier-ish scale
  }
  if (a.warmth !== 0) {
    filters.push(warmthFilter(a.warmth));
  }
  if (a.duotoneShadow && a.duotoneHighlight) {
    filters.push(duotoneFilter(a.duotoneShadow, a.duotoneHighlight));
  }
  if (a.tintColor && a.tintAmount > 0) {
    filters.push(tintFilter(a.tintColor, a.tintAmount));
  }
  if (a.blur > 0) {
    filters.push(Konva.Filters.Blur);
    props.blurRadius = a.blur;
  }

  return { filters, props };
}

// Filter presets — each one SETS adjustment values directly (one consistent
// model per the spec: "a filter has a separate preset layer" was the
// alternative; this project uses "a filter sets adjustment values", so
// manual tweaking after applying a preset keeps working through the same
// sliders rather than a second hidden layer).
export const FILTER_PRESETS = [
  { key: "original", label: "Original", adjustments: { ...DEFAULT_ADJUSTMENTS } },
  { key: "grayscale", label: "Grayscale", adjustments: { ...DEFAULT_ADJUSTMENTS, saturation: -1 } },
  { key: "warm", label: "Warm", adjustments: { ...DEFAULT_ADJUSTMENTS, warmth: 0.5, saturation: 0.15 } },
  { key: "cool", label: "Cool", adjustments: { ...DEFAULT_ADJUSTMENTS, warmth: -0.5, saturation: 0.05 } },
  { key: "vintage", label: "Vintage", adjustments: { ...DEFAULT_ADJUSTMENTS, warmth: 0.35, saturation: -0.35, contrast: -0.1 } },
  { key: "highContrast", label: "High Contrast", adjustments: { ...DEFAULT_ADJUSTMENTS, contrast: 0.5, saturation: 0.15 } },
  { key: "soft", label: "Soft", adjustments: { ...DEFAULT_ADJUSTMENTS, contrast: -0.15, blur: 1.5 } },
  { key: "sepia", label: "Sepia", adjustments: { ...DEFAULT_ADJUSTMENTS, warmth: 0.7, saturation: -0.6 } },
];
